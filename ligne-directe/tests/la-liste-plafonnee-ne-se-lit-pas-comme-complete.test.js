// la-liste-plafonnee-ne-se-lit-pas-comme-complete.test.js
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE (T-20260819-0056)
//
// `accesServiceDesk` lisait UNE page et s'arrêtait. Mesuré sur le service réel le 2026-09-20 :
//
//     projects, action list          →  total: 252,  limit: 50   (défaut)
//     projects, action list, limit 100  →  total: 252,  limit: 100
//     projects, action list, limit 252  →  total: 252,  limit: 100   ← LE PLAFOND ÉCRASE
//     projects, action list, limit 1000 →  total: 252,  limit: 100   ← EN SILENCE
//     projects, list, limit 3, offset 250 →  2 éléments, total: 252  ← LA PAGINATION EXISTE
//
// ⚠️ L'OUTIL EST HONNÊTE, C'EST LE LECTEUR QUI NE L'ÉCOUTAIT PAS. Chaque réponse porte `total`
// À CÔTÉ de ses données : le lecteur avait donc, DANS LA MÊME RÉPONSE, de quoi savoir qu'il lui
// manquait 152 projets — et il ne le savait pas.
//
// 🔴 CE QUE ÇA COÛTAIT, MESURÉ : deux des treize orchestrateurs vivants de ce poste
// (`p-20260522-0001`, `p-20260601-0094`) rendaient « non mesurée » — non pas parce que leur
// projet est introuvable, mais parce qu'il était au-delà de la page. Les deux sont
// `in_progress`, vérifié à la main. Le doute était donc ÉVITABLE, et un doute évitable qu'on
// laisse devient une dette.
//
// ⚠️ ET CE LECTEUR EST PARTAGÉ. Le recensement s'en sert aussi : la même page tronquée y
// rendait « non mesuré » pour les mêmes chantiers. Une seule correction, deux surfaces.
//
// **Le geste qui tranche, et il est réutilisable tel quel : comparer la taille ANNONCÉE au
// nombre RÉELLEMENT rendu, dans la MÊME réponse.** Ce qui reste plus petit après pagination
// n'est pas « rien de plus à lire » — c'est « je n'ai pas pu tout lire », et ça se dit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accesServiceDesk } from '../src/mandat.js';

/** Une réponse MCP telle que le vrai service la rend : du JSON dans du texte dans une enveloppe. */
const enveloppe = (corps) => ({ ok: true, json: async () => ({ result: { content: [{ type: 'text', text: JSON.stringify(corps) }] } }) });

/**
 * Un faux ServiceDesk qui PAGINE COMME LE VRAI — plafond de page à 100, `total` dans chaque
 * réponse, `offset` respecté.
 *
 * ⚠️ IL N'EST PAS PLUS INDULGENT QUE LE RÉEL : il ÉCRASE une limite demandée au-delà de son
 * plafond, en silence, exactement comme le service mesuré. Un double qui servirait 252 d'un coup
 * rendrait la garde verte sans qu'elle garde quoi que ce soit.
 */
function fauxServiceDeskPagine(total, { plafond = 100, journal = [] } = {}) {
  const tous = Array.from({ length: total }, (_, i) => ({ project_id: `P-2026${String(i).padStart(4, '0')}-0001`, status: 'in_progress' }));
  return {
    journal,
    fetcher: async (_url, init) => {
      const args = JSON.parse(init.body).params.arguments;
      journal.push({ action: args.action, limit: args.limit, offset: args.offset ?? 0 });
      if (args.action === 'get') return enveloppe({ erreur: 'get par code non servi' });
      const limit = Math.min(args.limit ?? 50, plafond);
      const offset = args.offset ?? 0;
      return enveloppe({ data: tous.slice(offset, offset + limit), total, limit, offset });
    },
  };
}

test('LE LECTEUR PAGINE JUSQU’AU BOUT — un code au-delà de la première page est TROUVÉ', async () => {
  const faux = fauxServiceDeskPagine(252);
  const acces = accesServiceDesk({ cle: 'k', fetcher: faux.fetcher });

  // `P-20260251-0001` est le DERNIER des 252 : il n'existe que si la pagination est allée au bout.
  const vu = await acces('projects', 'P-20260251-0001');

  assert.equal(vu.status, 'in_progress', 'le dernier élément de la dernière page doit être atteint');
  const listes = faux.journal.filter((a) => a.action === 'list');
  assert.ok(listes.length >= 3, `il faut au moins 3 pages pour 252 à 100 par page — ${listes.length} demandée(s)`);
  // ⚠️ ET LES OFFSETS AVANCENT VRAIMENT. Trois appels au même offset liraient trois fois la
  // première page et rendraient le même « il n'y est pas », en ayant l'air de paginer.
  const offsets = listes.map((a) => a.offset);
  assert.equal(new Set(offsets).size, offsets.length, `chaque page doit viser un offset distinct — vus : ${offsets}`);
});

test('UN CODE QUI N’EXISTE NULLE PART RESTE INTROUVABLE — la pagination n’invente rien', async () => {
  // ⚠️ LA CONTRE-ÉPREUVE DE L'INSTRUMENT : on lui fait chercher une chose qu'on SAIT absente.
  // Sans elle, le « trouvé » du premier essai ne vaudrait rien — on ne saurait pas si ce lecteur
  // sait encore dire non.
  const faux = fauxServiceDeskPagine(252);
  const acces = accesServiceDesk({ cle: 'k', fetcher: faux.fetcher });

  await assert.rejects(() => acces('projects', 'P-20269999-9999'), /ne figure pas/);
});

test('🔴 CE QU’ON N’A PAS PU LIRE SE DIT — le compte rendu compare le rendu au TOTAL annoncé', async () => {
  // Le service annonce 252 mais n'en sert que 120 : une page se vide plus tôt que promis
  // (droits, filtre, panne partielle). On ne peut alors PAS conclure « il n'y est pas ».
  const faux = fauxServiceDeskPagine(120, { plafond: 100 });
  // On ment sur le total : chaque réponse annonce 252 alors que la source n'en a que 120.
  const fetcher = async (url, init) => {
    const r = await faux.fetcher(url, init);
    const corps = JSON.parse((await r.json()).result.content[0].text);
    if (corps.data) corps.total = 252;
    return enveloppe(corps);
  };
  const acces = accesServiceDesk({ cle: 'k', fetcher });

  await assert.rejects(
    () => acces('projects', 'P-20269999-9999'),
    (err) => {
      assert.match(err.message, /120/, 'le refus dit combien il a RÉELLEMENT lu');
      assert.match(err.message, /252/, 'et combien le service en ANNONÇAIT');
      // ⚠️ ET IL NE SE LIT PAS COMME UNE ABSENCE. « il n'y est pas » et « je n'ai pas pu tout
      // lire » appellent des conduites opposées : la première ferme la question, la seconde
      // envoie lever le plafond.
      assert.match(err.message, /incompl|pas pu|manque/i, 'le refus dit que sa lecture est incomplète');
      return true;
    }
  );
});

test('UNE LECTURE COMPLÈTE NE CRIE PAS À L’INCOMPLÉTUDE — la garde ne parle pas dans le vide', async () => {
  // ⚠️ LE SECOND CHIFFRE D'UNE GARDE. Une garde qui signalerait une lecture incomplète à chaque
  // fois cesserait d'être lue — et elle meurt là, pas sur un faux négatif.
  const faux = fauxServiceDeskPagine(252);
  const acces = accesServiceDesk({ cle: 'k', fetcher: faux.fetcher });

  await assert.rejects(
    () => acces('projects', 'P-20269999-9999'),
    (err) => {
      assert.doesNotMatch(err.message, /incompl|pas pu tout/i, 'lecture complète : aucun doute à déclarer');
      assert.match(err.message, /252/, 'et elle dit sur combien elle a cherché');
      return true;
    }
  );
});

// ───────────────── LA BORNE QUI MANQUAIT — trouvée par une passe de revue, pas par l'auteur

test('🔴 UNE SOURCE QUI IGNORE `offset` EN PRODUISANT DU NEUF NE FAIT PAS TOURNER LA BOUCLE SANS FIN', async () => {
  // 🔴 REJET D'UNE PASSE PORTAIL, et il était fondé. Les deux gardes de CONTENU posées au
  // premier jet — « page vide » et « page qui n'apporte aucun code neuf » — ferment le cas d'une
  // source qui RESERT la même page. Elles ne ferment PAS celui d'une source qui ignore `offset`
  // tout en rendant des codes inédits à chaque tour : rien ne borne alors le nombre de tours.
  // Reproduit par le reviewer : `heap out of memory`, process tué, 256 Mo de plafond.
  //
  // ⚠️ ET L'AUTEUR AVAIT ÉCARTÉ LA BORNE DURE PAR UN RAISONNEMENT QUI SONNAIT JUSTE : « un compte
  // de pages maximal aurait été un nombre choisi par celui-là même dont on éprouve les angles
  // morts ». C'est vrai d'une borne inventée ; ça ne justifiait pas de n'en poser aucune.
  //
  // ✅ LA BORNE QUI N'EST PAS INVENTÉE : **on ne pagine que vers une destination connue.** Sans
  // `total` annoncé, on ne sait pas où s'arrêter — donc on ne fait pas semblant de paginer : on
  // lit UNE page et on dit que la lecture est peut-être plafonnée. C'est exactement ce que
  // faisait la version d'avant, et cette moitié-là avait raison.
  let pages = 0;
  const fetcher = async (_url, init) => {
    const args = JSON.parse(init.body).params.arguments;
    if (args.action === 'get') return enveloppe({ erreur: 'non servi' });
    pages += 1;
    if (pages > 50) throw new Error('la boucle ne s’arrête pas : plus de 50 pages demandées');
    // Chaque page ignore `offset` ET rend des codes NEUFS — et n'annonce JAMAIS de total.
    return enveloppe({
      data: Array.from({ length: 100 }, (_, i) => ({ project_id: `P-2026${String(pages).padStart(2, '0')}${String(i).padStart(2, '0')}-0001`, status: 'x' })),
      limit: 100,
    });
  };
  const acces = accesServiceDesk({ cle: 'k', fetcher });

  await assert.rejects(() => acces('projects', 'P-20269999-9999'), /ne figure pas/);
  assert.equal(pages, 1, `sans total annoncé, on lit UNE page et on le dit — ${pages} demandée(s)`);
});

test('ET CETTE LECTURE-LÀ SE DÉCLARE PLAFONNÉE — un doute tu est un doute perdu', async () => {
  const fetcher = async (_url, init) => {
    const args = JSON.parse(init.body).params.arguments;
    if (args.action === 'get') return enveloppe({ erreur: 'non servi' });
    return enveloppe({ data: Array.from({ length: 100 }, (_, i) => ({ project_id: `P-20260${String(i).padStart(3, '0')}-0001`, status: 'x' })), limit: 100 });
  };
  const acces = accesServiceDesk({ cle: 'k', fetcher });

  await assert.rejects(() => acces('projects', 'P-20269999-9999'), /PLAFONN/);
});

test('UN SERVICE QUI ANNONCE SON TOTAL EST BIEN PAGINÉ — la borne ne bride pas le cas nominal', async () => {
  // ⚠️ LE SECOND CHIFFRE DE LA BORNE. Une borne qui fermerait aussi le cas nominal rendrait la
  // pagination inopérante sur exactement la population qu'elle vise — et le lot entier avec.
  const faux = fauxServiceDeskPagine(252);
  const acces = accesServiceDesk({ cle: 'k', fetcher: faux.fetcher });

  const vu = await acces('projects', 'P-20260251-0001');
  assert.equal(vu.status, 'in_progress', 'le dernier des 252 reste atteint');
});

// ───── LE COMPTEUR QUI MENT — deux pages qui se chevauchent atteignent le total sans tout lire

test('🔴 DES PAGES QUI SE CHEVAUCHENT NE FONT PAS PASSER UNE LECTURE PARTIELLE POUR COMPLÈTE', async () => {
  // 🔴 TROUVÉ PAR UNE PASSE DE FOND, sur une sonde qu'elle a écrite — pas par une mutation du
  // code, par une ENTRÉE ADVERSE. La condition d'arrêt comparait `vus`, un compteur BRUT
  // d'éléments reçus, au total annoncé d'enregistrements UNIQUES. Deux pages qui se recouvrent
  // font donc atteindre le total sans que tout ait été lu.
  //
  // ⚠️ ET LE CAS N'EST PAS THÉORIQUE ICI : ce lecteur tourne PENDANT que treize orchestrateurs
  // vivants écrivent sur le même ServiceDesk. Un tri instable entre deux appels suffit.
  //
  // ⚠️ CE QUE LE DÉFAUT NE FAIT PAS, et il faut le dire pour ne pas le surévaluer : il ne peut
  // pas transformer un mandat ouvert en mandat clos. `etatDuMandat` rend « non mesurée » sur
  // toute exception du lecteur, jamais `clos: true`. Le réveil ne s'arrête donc pas à tort.
  // CE QU'IL FAIT : il annule discrètement l'objectif du correctif — le mandat reste « non
  // mesuré » comme avant, mais désormais présenté comme une recherche EXHAUSTIVE, sans trace
  // pour dire que la lecture a pu être trompée. C'est un faux témoin pour qui lit le journal.
  const tous = Array.from({ length: 200 }, (_, i) => ({ project_id: `P-2026${String(i).padStart(4, '0')}-0001`, status: 'x' }));
  const fetcher = async (_url, init) => {
    const args = JSON.parse(init.body).params.arguments;
    if (args.action === 'get') return enveloppe({ erreur: 'non servi' });
    const offset = args.offset ?? 0;
    // Le tri a bougé entre les deux appels : la page 2 recouvre la moitié de la page 1.
    const debut = offset === 0 ? 0 : 50;
    return enveloppe({ data: tous.slice(debut, debut + 100), total: 200, limit: 100 });
  };
  const acces = accesServiceDesk({ cle: 'k', fetcher });

  // `P-20260160-0001` est dans le segment 150-199, que ces deux pages n'ont JAMAIS servi.
  await assert.rejects(
    () => acces('projects', 'P-20260160-0001'),
    (err) => {
      assert.match(
        err.message,
        /INCOMPL|PLAFONN/,
        `la lecture n’a pas tout vu et doit le dire — elle affirme au contraire l’exhaustivité : ${err.message}`
      );
      return true;
    }
  );
});

test('ET UNE PAGINATION SANS CHEVAUCHEMENT NE CRIE TOUJOURS PAS — la garde ne parle pas dans le vide', async () => {
  const faux = fauxServiceDeskPagine(252);
  const acces = accesServiceDesk({ cle: 'k', fetcher: faux.fetcher });

  await assert.rejects(
    () => acces('projects', 'P-20269999-9999'),
    (err) => {
      assert.doesNotMatch(err.message, /INCOMPL|PLAFONN/, `lecture propre : aucun doute à déclarer — ${err.message}`);
      return true;
    }
  );
});
