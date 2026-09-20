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
