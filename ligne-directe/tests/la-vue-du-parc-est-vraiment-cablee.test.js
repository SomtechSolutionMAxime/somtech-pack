// LA VUE DU PARC EST VRAIMENT CÂBLÉE — du geste au rendu, et le compte qu'elle annonce
// (E-20260822-0002, sous P-20260822-0001 — T-20260822-0012/0013/0014.)
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE FICHIER EXISTE PARCE QUE DEUX PASSES DE REVUE ONT REJETÉ LE LOT, ET ELLES AVAIENT RAISON
//
// **Le geste `vue` n'était exercé par personne.** `grep vueDuParc tests/` rendait ZÉRO. Une
// passe a remplacé `case 'vue': return this.vueDuParc();` par un retour bidon : les 872 essais
// sont restés VERTS. La commande que le dirigeant tape pouvait répondre « geste inconnu » sans
// qu'un seul banc rougisse.
//
// Le motif est écrit noir sur blanc dans le fichier voisin, `le-recensement-est-vraiment-cable`,
// et ce dépôt dit l'avoir déjà payé plusieurs fois : *« un câblage manquant ne produit AUCUNE
// erreur : la ronde ne tourne pas, le geste répond "geste inconnu", et tout a l'air installé. »*
// Le geste `recensement` avait son banc. Le geste `vue`, livré à côté, ne l'avait pas.
//
// ⚠️ ET L'AUTEUR AVAIT ÉCRIT « CÂBLÉE DE BOUT EN BOUT » DANS SON MESSAGE DE COMMIT. Il l'avait
// exercée à la main, depuis le dépôt, en appelant les fonctions directement — jamais par le
// geste. Mesurer un objet et conclure sur un autre : exactement ce que ce lot reproche aux
// instruments du poste.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ET LE COMPTE QUE LA VUE ANNONCE N'ÉTAIT GARDÉ QUE SUR DEUX DE SES SEPT CHIFFRES
//
// Mesuré : `compte.orchestrateurs`, `horsHierarchie`, `epicsLus`, `chantiersNonEtablis` et
// `panesAmbigus` — ZÉRO assertion dans les 872 essais. Seuls `chantiersNonMesures` et
// `entreesComparees` en avaient une. **La phrase que le dirigeant lit EN PREMIER** pouvait
// afficher n'importe quel nombre, juste ou faux, sans qu'un banc rougisse.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Veilleur } from '../src/veilleur.js';
import { unRecensement } from '../src/recensement.js';
import { roleDuLieu } from '../src/lieu-agent.js';
import { role as roleDe } from '../src/roles.js';
import { laVueDuParc, rendreLaVue, ecrireLaVue, GESTE_DE_LA_VUE, lecteurDeChantier } from '../src/vue-du-parc.js';
import { unPaneDAgent } from './aide/formes-reelles.js';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let bac;
before(() => {
  bac = mkdtempSync(join(tmpdir(), 'vue-cablee-'));
});
after(() => rmSync(bac, { recursive: true, force: true }));

const veilleurNu = (nom) => new Veilleur({ cheminSocket: join(bac, `${nom}.sock`), identite: { equipe: 'T' } });

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE CÂBLAGE — du geste jusqu'à la fonction
// ═══════════════════════════════════════════════════════════════════════════════════════

test('le geste « vue » est SERVI — sans quoi la commande du dirigeant répondrait « geste inconnu » sans que rien ne le signale', async () => {
  const v = veilleurNu('geste');
  let appels = 0;
  v.vueDuParc = async () => {
    appels += 1;
    return { orchestrateurs: [], resume: 'la vue' };
  };

  const rendu = await v.traiterGeste({ geste: 'vue' });

  assert.equal(appels, 1, 'le geste doit ATTEINDRE la vue, pas répondre « geste inconnu »');
  assert.equal(rendu.resume, 'la vue', 'et il rend le compte rendu tel quel, sans le recomposer');
});

test('la vue MESURE à la demande : elle appelle le recensement du moment, elle ne ressert pas un tour précédent', async () => {
  // ⚠️ RA-VUE-004 — LE REGISTRE EST UNIQUE, ET LA VUE N'EN CONSTITUE PAS UN SECOND. Un cache
  // de la vue deviendrait une seconde source qui périmerait sans le dire : le défaut même que
  // ce chantier existe pour fermer. Deux appels doivent donc coûter deux recensements.
  const v = veilleurNu('frais');
  let recensements = 0;
  v.recensementDuPoste = async () => {
    recensements += 1;
    return { quand: 'T', agents: [] };
  };

  await v.traiterGeste({ geste: 'vue' });
  await v.traiterGeste({ geste: 'vue' });

  assert.equal(recensements, 2, 'chaque demande RECENSE : aucune photo qui périme sans le dire');
});

test('le geste « vue » ne se confond pas avec « recensement » — deux gestes, deux rendus', async () => {
  // Sans cette garde, un aiguillage qui renverrait le recensement pour les deux gestes
  // passerait : le premier banc ne regarde que « vue » atteint bien quelque chose.
  const v = veilleurNu('distincts');
  v.recensementDuPoste = async () => ({ quand: 'T', agents: [], marque: 'RECENSEMENT' });

  const vue = await v.traiterGeste({ geste: 'vue' });
  const rec = await v.traiterGeste({ geste: 'recensement' });

  assert.equal(rec.marque, 'RECENSEMENT', 'le geste « recensement » rend le recensement');
  assert.equal(vue.marque, undefined, 'le geste « vue » rend LA VUE, pas le recensement brut');
  assert.ok('orchestrateurs' in vue, 'et la vue porte bien sa forme à elle');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE COMPTE ANNONCÉ — les sept chiffres de la première phrase que lit le dirigeant
// ═══════════════════════════════════════════════════════════════════════════════════════

const METIER = {
  orchestrateur: "# Tu es l'orchestrateur de ce chantier\n\nle métier du jour.\n",
  representant: '# Tu es le représentant de ce client\n\nle métier du jour.\n',
};
const CONTEXTE = {
  orchestrateur: '# Ce qui est propre à ce dépôt\n\nrien.\n',
  representant: "# Ce qu'on sait de ce client\n\nrien.\n",
};

function poserLieu(depot, nomDuRole, nom) {
  const lieu = join(depot, roleDe(nomDuRole).dossier, nom);
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), METIER[nomDuRole]);
  writeFileSync(join(lieu, 'CONTEXTE.md'), CONTEXTE[nomDuRole]);
  writeFileSync(join(lieu, '.mcp.json'), '{}\n');
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{}\n');
  return lieu;
}

const nomsLus = (e) => ({
  mesure: 'lue',
  noms: new Map(e.map(([pane, nom, session]) => [`${session ?? ''}\u0000${pane}`, nom])),
});

test('CHACUN des sept chiffres du résumé est exact — la phrase que le dirigeant lit en premier ne peut plus mentir en silence', async (t) => {
  const tmp = mkdtempSync(join(tmpdir(), 'compte-'));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const d = join(tmp, 'depot');
  const lieuA = poserLieu(d, 'orchestrateur', 'p-20260822-0001'); // chantier lu, 2 epics
  const lieuB = poserLieu(d, 'orchestrateur', 'p-20260822-0002'); // chantier illisible
  const lieuC = poserLieu(d, 'orchestrateur', 'matapedia'); //       mandat non-code
  const lieuD = poserLieu(d, 'representant', 'Charles-Olivier'); //  hors hiérarchie

  const rendu = await unRecensement({
    panes: () => ({
      panes: [
        unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieuA, herdr_socket: 'A' }),
        unPaneDAgent({ pane_id: 'w2:p1', foreground_cwd: lieuB, herdr_socket: 'A' }),
        unPaneDAgent({ pane_id: 'w3:p1', foreground_cwd: lieuC, herdr_socket: 'A' }),
        unPaneDAgent({ pane_id: 'w4:p1', foreground_cwd: lieuD, herdr_socket: 'A' }),
        // Un pane ambigu : même identifiant, deux sessions.
        unPaneDAgent({ pane_id: 'w4:p1', foreground_cwd: join(tmp, 'ailleurs'), herdr_socket: 'B' }),
      ],
      sessionsInterrogees: 2,
      sessionsRefusees: [],
    }),
    roleDuLieu,
    nomsConnus: nomsLus([
      ['w1:p1', 'un', 'A'],
      ['w2:p1', 'deux', 'A'],
      ['w3:p1', 'matapedia', 'A'],
      ['w4:p1', 'charles-olivier', 'A'],
      ['w4:p1', 'autre', 'B'],
    ]),
  });

  const vue = await laVueDuParc({
    recensement: rendu,
    lireChantier: async (code) => {
      if (code === 'P-20260822-0002') throw new Error('HTTP 503');
      return { code, epics: [{ code: 'E-1', stories: [] }, { code: 'E-2', stories: [] }] };
    },
  });

  // 🔴 LES SEPT, UN PAR UN. Cinq d'entre eux n'étaient assertés NULLE PART dans les 872 essais
  // du dépôt : n'importe quelle valeur passait, et la première phrase de la vue avec.
  assert.equal(vue.compte.orchestrateurs, 3, 'trois orchestrateurs : le représentant n’en est pas un');
  assert.equal(vue.compte.horsHierarchie, 2, 'le représentant et l’entrée ambiguë de l’autre session');
  assert.equal(vue.compte.epicsLus, 2, 'les deux epics du seul chantier lu');
  assert.equal(vue.compte.chantiersNonMesures, 1, 'celui dont la lecture a échoué');
  assert.equal(vue.compte.chantiersNonEtablis, 1, 'matapedia, dont le mandat n’est pas un code');
  assert.equal(vue.compte.panesAmbigus, 1, 'w4:p1, porté par deux sessions');
  assert.equal(vue.compte.entreesComparees, 5, 'et le DÉNOMINATEUR sur lequel l’ambiguïté a été comptée');

  // ⚠️ ET LES MÊMES CHIFFRES DANS LA PHRASE — un compte juste dans un résumé qui en affiche un
  // autre laisse le lecteur devoir tout remesurer. La donnée et le texte se gardent ensemble.
  const r = vue.resume;
  assert.match(r, /AU MOINS 3 orchestrateur/, 'le résumé porte le compte d’orchestrateurs');
  assert.match(r, /2 epic\(s\) lu\(s\)/);
  assert.match(r, /1 chantier\(s\) NON MESURÉ/);
  assert.match(r, /1 mandat\(s\) qui ne sont pas des codes/);
  assert.match(r, /2 agent\(s\) hors de toute/);
  assert.match(r, /1 identifiant\(s\) de pane ambigu\(s\) sur 5 entrée\(s\)/);
  assert.ok(rendreLaVue(vue).includes(r), 'et le texte rendu porte cette phrase telle quelle');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// L'ÉCART DU FILTRE — il est calculé, il doit ARRIVER jusqu'au lecteur
//
// 🔴 DÉFAUT TROUVÉ PAR LA PASSE DE FOND, ET REPRODUIT SANS MUTATION. `lecteurDeChantier`
// calcule `epicsEcartes` avec soin et le documente : « l'écart ne disparaît pas ». Il
// disparaissait UNE COUCHE PLUS HAUT — `laVueDuParc` ne recopiait que `code`, `titre`,
// `statut`. Mesuré : le lecteur rendait 1, la vue rendait `undefined`, le compte ne le portait
// pas, et le texte n'en disait rien. La prose du module affirmait le contraire du code, à
// l'endroit exact que le dirigeant lit.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('l’écart d’un filtre qui n’a pas filtré ARRIVE jusqu’au lecteur — il ne meurt pas entre le lecteur de chantier et la vue', async (t) => {
  const tmp = mkdtempSync(join(tmpdir(), 'ecart-'));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260822-0001');

  const rendu = await unRecensement({
    panes: [unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieu })],
    roleDuLieu,
    nomsConnus: nomsLus([['w1:p1', 'kamouraska', undefined]]),
  });

  const vue = await laVueDuParc({
    recensement: rendu,
    // Le service a rendu 3 epics dont 2 qui ne sont pas de ce chantier : le lecteur les a
    // retamisés, et c'est CE FAIT qui doit remonter.
    lireChantier: async (code) => ({ code, epics: [{ code: 'E-1', stories: [] }], epicsEcartes: 2 }),
  });

  assert.equal(vue.orchestrateurs[0].chantier.epicsEcartes, 2, 'la vue PORTE l’écart');
  assert.equal(vue.compte.epicsEcartes, 2, 'le compte le totalise');

  const texte = rendreLaVue(vue);
  assert.match(texte, /2 epic\(s\) écarté\(s\)/, 'et le TEXTE le dit au lecteur — sinon l’écart est perdu là où il compte');
});

test('quand aucun filtre n’a échoué, la vue ne parle PAS d’écart — le signal reste un signal', async (t) => {
  // ⚠️ LE SYMÉTRIQUE DU BANC PRÉCÉDENT, et il n'est pas décoratif : une vue qui annoncerait
  // « 0 epic écarté » à chaque ligne rendrait le signal invisible par habitude. Fermer un faux
  // négatif ouvre son faux positif sur la même frontière.
  const tmp = mkdtempSync(join(tmpdir(), 'sans-ecart-'));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260822-0001');

  const rendu = await unRecensement({
    panes: [unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieu })],
    roleDuLieu,
    nomsConnus: nomsLus([['w1:p1', 'kamouraska', undefined]]),
  });
  const vue = await laVueDuParc({
    recensement: rendu,
    lireChantier: async (code) => ({ code, epics: [{ code: 'E-1', stories: [] }], epicsEcartes: 0 }),
  });

  assert.equal(vue.compte.epicsEcartes, 0);
  assert.ok(!/écarté/.test(rendreLaVue(vue)), 'rien n’est dit quand rien n’a été écarté');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LA CLÉ D'IDENTITÉ EST APPELÉE, PAS RÉÉCRITE — « une porte sur deux »
// ═══════════════════════════════════════════════════════════════════════════════════════

test('la clé d’identité vient d’UN SEUL endroit — un agent joint par son mandat ne réapparaît pas « hors hiérarchie »', async (t) => {
  const tmp = mkdtempSync(join(tmpdir(), 'cle-'));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const d = join(tmp, 'depot');
  const lieuOrch = poserLieu(d, 'orchestrateur', 'p-20260822-0001');
  const lieuChef = poserLieu(d, 'orchestrateur', 'e-20260822-0002');

  const rendu = await unRecensement({
    panes: [
      unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieuOrch }),
      unPaneDAgent({ pane_id: 'w1:p2', foreground_cwd: lieuChef }),
    ],
    roleDuLieu,
    nomsConnus: nomsLus([['w1:p1', 'kamouraska', undefined], ['w1:p2', 'castor', undefined]]),
  });

  const vue = await laVueDuParc({
    recensement: rendu,
    lireChantier: async (code) => ({ code, epics: [{ code: 'E-20260822-0002', stories: [] }] }),
  });

  // `castor` porte le mandat de l'epic : il est JOINT dans l'arbre. L'y compter ET le remettre
  // hors hiérarchie le ferait apparaître deux fois — et c'est ce que produisait la clé
  // recomposée à la main dès qu'elle divergeait de `cleDeLAgent`.
  assert.equal(vue.orchestrateurs[0].epics[0].agent.mesure, 'lue', 'préalable : il est bien joint');
  assert.ok(
    !vue.horsHierarchie.some((p) => p.agent.nom === 'castor'),
    'un agent joint dans l’arbre n’est PAS aussi hors hiérarchie'
  );
  assert.equal(vue.compte.horsHierarchie, 0, 'et le compte ne le compte pas deux fois');
});

test('un code ABSENT se dit « (sans code) » — jamais le mot « null » en toutes lettres', async (t) => {
  const tmp = mkdtempSync(join(tmpdir(), 'sanscode-'));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260822-0001');

  const rendu = await unRecensement({
    panes: [unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieu })],
    roleDuLieu,
    nomsConnus: nomsLus([['w1:p1', 'kamouraska', undefined]]),
  });
  const vue = await laVueDuParc({
    recensement: rendu,
    // Un epic et une story sans code — un ticket ServiceDesk peut n'avoir ni `epic_id` ni
    // `ticket_id` renseigné.
    lireChantier: async (code) => ({ code, epics: [{ code: null, titre: 'epic sans code', stories: [{ code: null, titre: 'story sans code' }] }] }),
  });

  const texte = rendreLaVue(vue);
  assert.ok(texte.includes('(sans code)'), 'l’absence de code est DITE');
  assert.ok(!/\bnull\b/.test(texte), 'et le mot « null » ne fuit jamais dans un texte destiné à être lu');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA PORTE DU RENDU — un refus ne se rend JAMAIS comme un parc désert
//
// MESURÉ EN TAPANT LA COMMANDE, pas en mutant : le veilleur en vie ne connaissait pas le geste
// et rendait `{ ok: false, erreur: 'geste inconnu : vue' }`. Cet objet traversait `rendreLaVue`
// sans résistance et sortait une vue PARFAITEMENT MISE EN PAGE ET PARFAITEMENT VIDE.
//
// ⚠️ CETTE ARÊTE NE SE MUTE PAS, ELLE S'EXERCE. Elle traverse un PROCESSUS : le code des deux
// côtés était juste, aucune mutation du dépôt ne pouvait la révéler. Ce banc la ramène à
// l'intérieur du dépôt en faisant manger au rendu ce que le veilleur rend RÉELLEMENT.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('un REFUS du veilleur se rend comme un refus — jamais comme un parc où personne ne travaille', () => {
  // La forme EXACTE mesurée sur le poste, pas une forme inventée.
  const refus = { ok: false, erreur: 'geste inconnu : vue' };

  const texte = rendreLaVue(refus);

  assert.match(texte, /REFUSÉE/, 'le refus est annoncé dès la première ligne');
  assert.ok(texte.includes('geste inconnu : vue'), 'et la CAUSE est rendue — sans elle on cherche au mauvais endroit');
  // 🔴 LE CŒUR : ce qui distingue un refus d'un parc vide, c'est qu'il ne PORTE PAS les titres
  // de sections d'une vue. Un en-tête suivi de deux sections vides se lit comme un parc désert.
  assert.ok(!texte.includes('HORS DE TOUTE HIÉRARCHIE'), 'aucune section de vue n’est dressée sur un refus');
  assert.ok(
    texte.includes('n’ai pas su regarder'),
    'et la vue dit explicitement que ce n’est pas « personne ne travaille »'
  );
});

test('les formes qu’un transport peut rendre à la place d’une vue sont TOUTES refusées, pas mises en page', () => {
  // ⚠️ UNE SEULE FORME NE SUFFIT PAS. Le veilleur d'aujourd'hui rend `{ok:false,erreur}` ; un
  // transport coupé rend `null`, un service qui répond mal rend `{}` ou une chaîne. Toutes
  // doivent buter sur la porte — sinon on ferme un cas et on laisse ses voisins ouverts.
  for (const forme of [null, undefined, {}, { ok: true }, 'une chaîne', 42, []]) {
    const texte = rendreLaVue(forme);
    assert.match(texte, /REFUSÉE/, `${JSON.stringify(forme)} doit être refusé`);
    assert.ok(!texte.includes('HORS DE TOUTE HIÉRARCHIE'), `${JSON.stringify(forme)} ne dresse aucune section`);
  }
});

test('une VRAIE vue, elle, passe la porte — la garde ne refuse pas ce qu’elle doit rendre', async (t) => {
  // ⚠️ LE SYMÉTRIQUE, ET IL N'EST PAS DÉCORATIF : une porte qui refuse TOUT satisferait les
  // deux bancs ci-dessus et rendrait l'outil inutilisable. Fermer un faux négatif ouvre son
  // faux positif sur la même frontière.
  const tmp = mkdtempSync(join(tmpdir(), 'porte-'));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const lieu = poserLieu(join(tmp, 'depot'), 'orchestrateur', 'p-20260822-0001');

  const rendu = await unRecensement({
    panes: [unPaneDAgent({ pane_id: 'w1:p1', foreground_cwd: lieu })],
    roleDuLieu,
    nomsConnus: nomsLus([['w1:p1', 'kamouraska', undefined]]),
  });
  const vue = await laVueDuParc({ recensement: rendu, lireChantier: async (code) => ({ code, epics: [] }) });

  const texte = rendreLaVue(vue);
  assert.ok(!texte.includes('REFUSÉE'), 'une vue légitime n’est pas refusée');
  assert.ok(texte.includes('kamouraska'), 'et elle rend bien son contenu');

  // Et une vue dont le REGISTRE a refusé garde son propre rendu, distinct des deux autres :
  // trois états, trois textes.
  const sansRegistre = rendreLaVue(await laVueDuParc({ recensement: { agents: null, inventaireRefuse: 'herdr muet' } }));
  assert.ok(sansRegistre.includes('SANS REGISTRE'), 'un registre en panne a SON texte');
  assert.ok(!sansRegistre.includes('REFUSÉE'), 'qui n’est pas celui d’un refus de transport');
});

test('un « geste inconnu » DIT ce qu’il faut faire — sinon le lecteur cherche une panne qui n’existe pas', () => {
  const texte = rendreLaVue({ ok: false, erreur: 'geste inconnu : vue' });

  // ⚠️ LA CAUSE SEULE NE SUFFIT PAS. « geste inconnu » envoie chercher un défaut de code — or
  // le code est juste des DEUX côtés : c'est le PROCESSUS en vie qui porte une version plus
  // ancienne. Un refus qui ne nomme pas ça produit exactement le faux échec d'instrument que
  // ce module a déjà corrigé une fois : on diagnostique une panne inexistante.
  // 🔴 DEUX CAUSES, ET LE MESSAGE NE CHOISIT PAS. La première version n'affirmait QUE le
  // veilleur périmé — la cause vue une fois, un matin, retenue comme si elle était la seule.
  // Mesuré ensuite : le geste n'était installé NULLE PART (ni dans le paquet du poste, ni sur
  // la branche principale) et le processus était tout neuf. Le message envoyait recharger un
  // veilleur à jour. C'est RA-VUE-003 retournée contre son auteur : l'absence se MONTRE, elle
  // ne se comble pas — et « je ne sais pas laquelle des deux » est un fait qui se dit.
  assert.match(texte, /DEUX CAUSES/, 'le refus dit qu’il y en a deux, il n’en choisit pas une');
  assert.match(texte, /installé NULLE PART/, '① le geste n’est livré nulle part');
  assert.match(texte, /PROCESSUS en vie porte un code plus ancien/, '② le processus est en retard');
  assert.match(texte, /POUR TRANCHER/, 'et il dit COMMENT départager les deux');
  assert.match(texte, /inutile d’y chercher une panne/, 'en écartant explicitement la fausse piste du module');
});

test('un refus qui N’EST PAS un geste inconnu ne raconte PAS l’histoire du veilleur', () => {
  // ⚠️ LE SYMÉTRIQUE. Coller l'explication du veilleur sur tout refus ferait diagnostiquer un
  // processus périmé là où le transport est simplement coupé — la fausse piste, inversée. Un
  // correctif ouvre son symétrique sur la même frontière.
  const texte = rendreLaVue({ ok: false, erreur: 'connexion refusée sur le socket' });

  assert.match(texte, /REFUSÉE/, 'il refuse quand même');
  assert.ok(texte.includes('connexion refusée'), 'et rend SA cause à lui');
  assert.ok(!texte.includes('VEILLEUR EN VIE'), 'sans inventer un veilleur périmé qui n’est pas en cause');
  assert.ok(!texte.includes('CE QU’IL FAUT FAIRE'), 'ni prescrire un geste qui ne réglerait rien');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// LE VEILLEUR DONNE À LA VUE DE QUOI LIRE LE SERVICEDESK — arête trouvée par mutation
//
// `lireChantier: lecteurDeChantier()` remplacé par `null` laissait les 886 essais VERTS. La vue
// aurait alors rendu « chantier NON MESURÉ — aucun accès au ServiceDesk » pour CHAQUE
// orchestrateur, sur un poste parfaitement configuré : aucune erreur, aucun symptôme, et un
// parc entier déclaré illisible. Le module était juste, le veilleur était juste ; c'est le
// PASSAGE de l'un à l'autre qui n'appartenait à aucun banc.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('le veilleur CONSTRUIT un lecteur de chantier — il ne passe pas « aucun accès » à la vue', async () => {
  const v = veilleurNu('lecteur');
  v.recensementDuPoste = async () => ({ quand: 'T', agents: [] });

  let construit = 0;
  await v.vueDuParc({
    construireLecteur: () => {
      construit += 1;
      return async (code) => ({ code, epics: [] });
    },
  });

  assert.equal(construit, 1, 'le veilleur construit le lecteur — il ne passe pas null');
});

test('le lecteur construit ARRIVE jusqu’à la vue : un chantier lisible n’est pas rendu « non mesuré »', async () => {
  const v = veilleurNu('arrive');
  v.recensementDuPoste = async () => ({
    quand: 'T',
    agents: [{
      pane: 'w1:p1', session: 's', statut: 'idle',
      role: { mesure: 'établi', nom: 'orchestrateur' },
      nom: { mesure: 'lu', valeur: 'kamouraska' },
      mandat: 'p-20260822-0001', lieu: '/x',
    }],
  });

  const vue = await v.vueDuParc({
    construireLecteur: () => async (code) => ({ code, titre: 'lu', epics: [{ code: 'E-1', stories: [] }] }),
  });

  // 🔴 COMPTER L'APPEL NE SUFFIT PAS — il faut que son RÉSULTAT traverse. Un veilleur qui
  // construirait le lecteur puis ne le passerait pas satisferait le banc précédent.
  assert.equal(vue.orchestrateurs[0].chantier.mesure, 'lue', 'le chantier est LU, pas « non mesuré »');
  assert.equal(vue.orchestrateurs[0].epics.length, 1, 'et ses epics arrivent jusqu’à la vue');
});

test('le DÉFAUT du veilleur construit un lecteur RÉEL — c’est ce chemin-là, et lui seul, que le poste emprunte', async () => {
  // ⚠️ LES DEUX BANCS CI-DESSUS INJECTENT LEUR LECTEUR : ils ne prouvent RIEN du défaut, qui est
  // pourtant le seul chemin du poste réel. Une garde qui n'éprouve que ce qu'elle fournit
  // elle-même est vacante — le motif que ce lot a déjà payé deux fois.
  const v = veilleurNu('defaut');
  v.recensementDuPoste = async () => ({ quand: 'T', agents: [] });

  // On lit la valeur par défaut du paramètre, sans la remplacer : elle doit être la fabrique du
  // module, jamais une constante figée à `null` ou à une fonction vide.
  const source = v.vueDuParc.toString();
  assert.match(source, /construireLecteur = lecteurDeChantier/, 'le défaut EST la fabrique du module');
  assert.ok(!/lireChantier:\s*null/.test(source), 'et jamais un « aucun accès » codé en dur');

  const vue = await v.vueDuParc();
  assert.ok(vue.orchestrateurs !== null, 'et le défaut ne casse pas la vue');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE LA COMMANDE ÉCRIT — deux survivantes de la campagne des arêtes
//
// Tant que ce choix vivait dans le `bin`, le muter laissait 889 essais VERTS : le `bin` n'est
// atteignable que par un vrai lancement, et un lancement sous test tente de faire naître un
// veilleur — que la cloison refuse. La couche était STRUCTURELLEMENT non gardée : ni la
// relecture ni la mutation ne pouvaient la voir. Elle est sortie du `bin` pour exister ici.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('la commande écrit du TEXTE par défaut — c’est là, et seulement là, que se joue la garde du rendu', () => {
  const vue = { registre: { mesure: 'lu' }, orchestrateurs: [], horsHierarchie: [], resume: 'r', regle: 'g' };

  const defaut = ecrireLaVue(vue, []);

  assert.ok(!defaut.trimStart().startsWith('{'), 'le défaut n’est PAS du JSON');
  assert.ok(defaut.includes('LA VUE DU PARC'), 'c’est bien le rendu texte');
  // ⚠️ SI LE DÉFAUT ÉTAIT DU JSON, les trois conditions de l'arbitrage — « NON ÉTABLI » avant
  // l'indice, l'indice avec sa phrase — seraient hors de portée du seul lecteur qu'elles
  // protègent. Ce banc garde donc bien plus que le format d'une sortie.
});

test('« --json » rend du JSON — le symétrique, sinon une commande qui rendrait TOUJOURS du texte passerait', () => {
  const vue = { registre: { mesure: 'lu' }, orchestrateurs: [], horsHierarchie: [], resume: 'r', regle: 'g' };

  const json = ecrireLaVue(vue, ['--json']);

  assert.ok(json.trimStart().startsWith('{'), 'avec --json, c’est du JSON');
  assert.deepEqual(JSON.parse(json).resume, 'r', 'et c’est du JSON valide, qui porte la vue');
});

test('le geste demandé est « vue » — pas « recensement », qui rendrait le registre brut mis en page comme une vue', () => {
  // 🔴 SURVIVANTE MESURÉE : remplacer le geste dans le `bin` laissait 889 essais verts. La
  // commande aurait rendu des agents sans arbre, sans epic, sans story — et l'air normal.
  assert.equal(GESTE_DE_LA_VUE, 'vue');
});

test('le `bin` emploie la constante et la fonction — il ne réécrit ni le geste ni le choix du rendu', () => {
  // ⚠️ SORTIR LA DÉCISION NE SERT À RIEN SI LE `bin` GARDE SA PROPRE COPIE. C'est « une porte
  // sur deux » : deux chemins pour la même décision, dont un seul est gardé.
  const bin = readFileSync(fileURLToPath(new URL('../bin/ligne-directe.js', import.meta.url)), 'utf8');
  assert.match(bin, /geste: GESTE_DE_LA_VUE/, 'le geste vient de la constante');
  assert.match(bin, /ecrireLaVue\(vue, args\)/, 'et le rendu de la fonction');
  assert.ok(!/geste: 'vue'/.test(bin), 'aucun geste « vue » codé en dur ne subsiste');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI REND UNE ÉQUIVALENCE VRAIE SE GARDE — sinon elle cesse de l'être en silence
//
// La campagne des arêtes a posé une mutation sur le SÉPARATEUR de `cleDeLAgent` : elle a
// survécu. Verdict rendu : **mutation ÉQUIVALENTE**, pas survivante — depuis que les cinq
// usages passent par la fonction, il ne reste qu'UNE occurrence du séparateur, donc le changer
// ne modifie aucun comportement observable.
//
// 🔴 MAIS CETTE ÉQUIVALENCE REPOSE SUR UN FAIT, PAS SUR UNE PROPRIÉTÉ. Le jour où quelqu'un
// écrit un second usage sans passer par `cleDeLAgent`, la mutation redevient mordante — et
// RIEN ne le dirait : ni le banc, ni le compte, ni la note qui l'explique. Une équivalence
// non gardée est une survivante en attente.
//
// Ce banc ne garde donc pas l'équivalence : il garde CE QUI LA REND VRAIE.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('le séparateur de la clé n’existe qu’à UN endroit — c’est ce qui rend sa mutation équivalente, et ça peut cesser', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/vue-du-parc.js', import.meta.url)), 'utf8');

  // La séquence échappée telle qu'elle s'écrit dans le fichier — deux caractères, pas l'octet.
  const occurrences = source.split('\\u0000').length - 1;
  assert.equal(
    occurrences,
    1,
    'le séparateur ne doit apparaître QUE dans `cleDeLAgent` : un second usage écrit à la main ' +
      'rendrait la clé divergente sans qu’aucun banc ne rougisse'
  );

});

test('aucun fichier du lot ne porte d’octet NUL littéral — un fichier binaire pour git est un lot INREVIEWABLE', () => {
  // 🔴 CETTE GARDE COUVRAIT LE MODULE SEUL, ET UN BANC L'A CONTOURNÉE LE JOUR MÊME. Mesuré :
  // `git diff --numstat` rendait « - - » sur `la-vue-du-parc-est-vraiment-cablee.test.js` —
  // aucun reviewer n'aurait pu lire ce fichier, et aucun test ne le disait. C'est « une porte
  // sur deux » : j'avais gardé la porte du module et laissé celle des bancs ouverte, dans le
  // lot même qui dénonce ce motif.
  //
  // ⚠️ POURQUOI L'OCTET REVIENT TOUT SEUL : la séquence `\u0000` s'écrit en DEUX caractères dans
  // le source, mais tout outil qui écrit le fichier depuis une chaîne JavaScript déjà
  // interprétée y dépose l'OCTET. Le geste est naturel, l'effet est invisible à la relecture,
  // et il ne se voit que dans `git diff` — d'où cette garde, qui balaie le lot ENTIER.
  const R = fileURLToPath(new URL('..', import.meta.url));
  const fichiers = [
    'src/vue-du-parc.js',
    'src/veilleur.js',
    'src/mandat.js',
    'bin/ligne-directe.js',
    ...readdirSync(join(R, 'tests'))
      .filter((n) => n.endsWith('.test.js'))
      .map((n) => join('tests', n)),
  ];

  const fautifs = fichiers.filter((rel) => readFileSync(join(R, rel)).includes(0));
  assert.deepEqual(fautifs, [], 'ces fichiers portent un octet NUL et sont BINAIRES pour git');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUI RESTE DANS LE `bin`, ET QUE RIEN D'AUTRE NE DOIT Y ENTRER
//
// 🔴 LE RISQUE N'EST PAS ÉTEINT, IL EST RÉDUIT À SA PLUS PETITE SURFACE — et c'est une nuance
// qui se perd si on ne l'écrit pas. Le `bin` reste STRUCTURELLEMENT hors d'atteinte des bancs :
// un lancement sous `node --test` transmet le contexte de test à l'enfant, qui tente de faire
// naître un veilleur que la cloison refuse à juste titre. Aucune garde ne peut couvrir ces
// lignes.
//
// Il n'en reste que DEUX qui décident de quelque chose :
//
//     const vue = await parler({ geste: GESTE_DE_LA_VUE });
//     process.stdout.write(ecrireLaVue(vue, args));
//
// Toutes deux ne font que DÉLÉGUER — le geste vient d'une constante gardée, le rendu d'une
// fonction gardée. **Aucune décision nouvelle ne doit entrer ici** : un `if` sur un drapeau, un
// format, une valeur par défaut, un message — tout cela vivrait dans un endroit qu'aucun banc
// ne peut atteindre, et redeviendrait invisible à la mutation comme à la relecture.
//
// Ce banc est la seule protection possible d'une surface non gardable : il refuse qu'elle
// grossisse.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('la branche « vue » du `bin` ne fait que DÉLÉGUER — aucune décision nouvelle n’y entre', () => {
  const bin = readFileSync(fileURLToPath(new URL('../bin/ligne-directe.js', import.meta.url)), 'utf8');

  const branche = bin
    .slice(bin.indexOf("} else if (geste === 'vue') {"), bin.indexOf("} else if (geste === 'recensement') {"))
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('} else if'));

  assert.deepEqual(
    branche,
    ['const vue = await parler({ geste: GESTE_DE_LA_VUE });', 'process.stdout.write(ecrireLaVue(vue, args));'],
    'la branche « vue » du bin doit rester EXACTEMENT ces deux lignes de délégation — cet ' +
      'endroit est hors d’atteinte de tout banc, donc rien qui décide ne doit y vivre'
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 LE JUMEAU DU SIGNAL — trouvé par une passe de revue, un cycle APRÈS son frère
//
// `lecteurDeChantier` rend DEUX signaux sur les filtres, et son commentaire les nomme tous les
// deux : « DEUX PANNES DE FILTRE, PAS UNE ». `epicsEcartes` dit qu'on a reçu TROP (des epics
// d'autres chantiers, retamisés ici) ; `epicsPlafonnes` dit qu'on a peut-être reçu TROP PEU
// (la page était pleine, il en manque peut-être).
//
// Le premier a été câblé jusqu'au texte. **Le second est mort à la même jointure, dans la même
// expression, à une ligne près** — et il y est resté un cycle entier, alors que le commentaire
// du correctif de son frère le nommait.
//
// ⚠️ C'est « une garde posée sur un fichier ne garde pas sa famille », appliqué à un champ :
// on ferme le défaut QU'ON VIENT DE VOIR, pas le défaut POSSIBLE. Ce banc garde donc les DEUX,
// et le dernier banc du fichier garde la FAMILLE elle-même.
// ═══════════════════════════════════════════════════════════════════════════════════════

test('une liste d’epics PLAFONNÉE traverse jusqu’au texte — sinon la vue montre un parc complet là où il en manque', async () => {
  const recensement = {
    quand: 'T',
    agents: [{
      pane: 'w1:p1', session: 's', statut: 'idle',
      role: { mesure: 'établi', nom: 'orchestrateur' },
      nom: { mesure: 'lu', valeur: 'kamouraska' },
      mandat: 'p-20260822-0001', lieu: '/x',
    }],
  };
  const vue = await laVueDuParc({
    recensement,
    lireChantier: async (code) => ({ code, epics: [{ code: 'E-1', stories: [] }], epicsEcartes: 0, epicsPlafonnes: true }),
  });

  assert.equal(vue.orchestrateurs[0].chantier.epicsPlafonnes, true, 'la vue PORTE le plafond');
  assert.equal(vue.compte.chantiersPlafonnes, 1, 'le compte le totalise');
  assert.match(vue.resume, /PLAFONNÉE/, 'et le résumé le DIT — c’est là que le dirigeant le lit');
  assert.match(vue.resume, /il en manque peut-être/, 'avec ce que ça signifie, pas seulement le mot');
});

test('les DEUX pannes de filtre se disent SÉPARÉMENT — « écarté » et « plafonné » appellent des gestes opposés', async () => {
  const recensement = {
    quand: 'T',
    agents: [{
      pane: 'w1:p1', session: 's', statut: 'idle',
      role: { mesure: 'établi', nom: 'orchestrateur' },
      nom: { mesure: 'lu', valeur: 'kamouraska' },
      mandat: 'p-20260822-0001', lieu: '/x',
    }],
  };
  const vueDe = (o) => laVueDuParc({ recensement, lireChantier: async (code) => ({ code, epics: [], ...o }) });

  // Écarté seul : on a reçu trop, on a retamisé. Rien à dire du plafond.
  const ecarte = await vueDe({ epicsEcartes: 2, epicsPlafonnes: false });
  assert.match(ecarte.resume, /écarté/);
  assert.ok(!/PLAFONNÉE/.test(ecarte.resume), 'aucun plafond invoqué quand il n’a pas joué');

  // Plafonné seul : on a peut-être reçu trop peu. Rien à dire des intrus.
  const plafonne = await vueDe({ epicsEcartes: 0, epicsPlafonnes: true });
  assert.match(plafonne.resume, /PLAFONNÉE/);
  assert.ok(!/écarté/.test(plafonne.resume), 'aucun écart invoqué quand rien n’a été écarté');

  // ⚠️ ET AUCUN DES DEUX QUAND TOUT VA BIEN : un signal répété à chaque ligne cesse d'être un
  // signal. C'est le faux positif symétrique, sur la même frontière.
  const sain = await vueDe({ epicsEcartes: 0, epicsPlafonnes: false });
  assert.ok(!/écarté|PLAFONNÉE/.test(sain.resume), 'rien n’est dit quand rien n’a mal tourné');
});

test('TOUT signal que le lecteur de chantier rend traverse jusqu’à la vue — la garde de la FAMILLE, pas d’un champ', async () => {
  // 🔴 CE BANC EXISTE PARCE QUE LES DEUX PRÉCÉDENTS NE SUFFISENT PAS. Ils gardent deux champs
  // NOMMÉS ; ils ne diraient rien d'un troisième signal ajouté demain à `lecteurDeChantier` et
  // oublié à la jointure — exactement ce qui vient d'arriver à `epicsPlafonnes`, nommé dans le
  // commentaire du correctif de son frère et laissé en arrière un cycle entier.
  //
  // ⚠️ PREMIÈRE VERSION DE CE BANC : VACANTE, et sa mutation l'a prouvé. Elle comparait la vue
  // à un objet `renduDuLecteur` ÉCRIT À LA MAIN dans le test — donc ajouter un signal neuf au
  // vrai lecteur ne changeait rien, et la garde restait verte. Une garde qui n'examine que ce
  // qu'elle fabrique elle-même ne garde rien. Elle interroge maintenant le VRAI
  // `lecteurDeChantier`, avec un transport de banc, et compare ce QU'IL REND à ce que la vue
  // en porte.
  const appeler = async (nom) =>
    nom === 'projects'
      ? { projects: [{ id: 'u1', project_id: 'P-20260822-0001', title: 't', status: 'in_progress' }] }
      : nom === 'epics'
        ? { epics: [{ id: 'e1', epic_id: 'E-1', project_id: 'u1' }] }
        : { tickets: [] };

  const lire = lecteurDeChantier({ appeler });
  const renduDuLecteur = await lire('P-20260822-0001');

  const recensement = {
    quand: 'T',
    agents: [{
      pane: 'w1:p1', session: 's', statut: 'idle',
      role: { mesure: 'établi', nom: 'orchestrateur' },
      nom: { mesure: 'lu', valeur: 'kamouraska' },
      mandat: 'p-20260822-0001', lieu: '/x',
    }],
  };
  const vue = await laVueDuParc({ recensement, lireChantier: lire });
  const chantier = vue.orchestrateurs[0].chantier;

  // `epics` est rendu à part (c'est l'arbre lui-même), `code` est celui du mandat : tout autre
  // signal que le lecteur produit doit se retrouver sur le chantier de la vue.
  const attendus = Object.keys(renduDuLecteur).filter((k) => k !== 'epics' && k !== 'code');
  const perdus = attendus.filter((k) => !(k in chantier));

  // 🔴 CE QUE CETTE GARDE NE COUVRE PAS, ET IL FAUT LE LIRE ICI — sinon son nom ment.
  //
  // MESURÉ, en tuant un signal neuf à chacune des quatre jointures et en n'exécutant QUE ce
  // banc : ① lecteur → vue ATTRAPÉE · ② vue → compte PASSE · ③ compte → résumé PASSE ·
  // ④ résumé → texte PASSE. **Une porte sur quatre.**
  //
  // Les mêmes mutations contre la suite ENTIÈRE sont attrapées toutes les trois — mais par des
  // bancs NOMMÉS, pour des signaux CONNUS. Le cas qui tranche a été construit exprès : un
  // signal NEUF qui traverse ① correctement, donc satisfait cette garde, et meurt en ②③④.
  // **895 verts. Il passe.**
  //
  // Donc, en une phrase, et c'est celle qui empêche de mal lire ce banc :
  //
  //   Cette garde attrape L'OUBLI DE RECOPIE, pas l'oubli d'agrégation ni l'oubli de rendu.
  //   Un signal NEUF est gardé au premier passage et À NU sur les trois autres.
  //   Les signaux CONNUS sont gardés partout, par des bancs nommés.
  //
  // ⚠️ C'est la même leçon un cran plus loin : une garde posée sur UNE arête ne garde pas sa
  // famille. Les trois passages manquants sont une CONDITION DE FIN de `E-20260822-0003`, le
  // lot qui ajoute justement des signaux à cette vue — pas une dette sans date.
  assert.ok(attendus.length >= 4, 'préalable : le lecteur rend bien plusieurs signaux à garder');
  assert.deepEqual(
    perdus,
    [],
    'ces signaux du lecteur de chantier meurent à la jointure : calculés, jamais rendus'
  );
});

test('le plafond des STORIES traverse les quatre jointures — jusqu’à la ligne que lit le dirigeant', async () => {
  const recensement = {
    quand: 'T',
    agents: [{
      pane: 'w1:p1', session: 's', statut: 'idle',
      role: { mesure: 'établi', nom: 'orchestrateur' },
      nom: { mesure: 'lu', valeur: 'kamouraska' },
      mandat: 'p-20260822-0001', lieu: '/x',
    }],
  };
  const vue = await laVueDuParc({
    recensement,
    lireChantier: async (code) => ({
      code,
      epics: [{ code: 'E-1', stories: [{ code: 'T-1' }], storiesPlafonnees: true }],
    }),
  });

  assert.equal(vue.orchestrateurs[0].epics[0].storiesPlafonnees, true, '① la vue le porte');
  assert.equal(vue.compte.epicsAuxStoriesPlafonnees, 1, '② le compte le totalise');
  assert.match(vue.resume, /stories est PLAFONNÉE/, '③ le résumé le dit');
  assert.match(rendreLaVue(vue), /liste de stories PLAFONNÉE/, '④ et le texte le porte sur la ligne');
});

test('un agent joint au niveau STORY n’est pas AUSSI rendu hors hiérarchie — garde vacante trouvée en revue', async () => {
  // 🔴 LA BOUCLE QUI RETIRE UN PORTEUR DE STORY DE « hors hiérarchie » N'ÉTAIT ÉPROUVÉE PAR
  // PERSONNE : la supprimer laissait la suite verte. Le comportement était juste, rien ne le
  // protégeait — et son équivalent au niveau EPIC, lui, était gardé. Une porte sur deux, dans
  // la même boucle.
  const recensement = {
    quand: 'T',
    agents: [
      {
        pane: 'w1:p1', session: 's', statut: 'idle',
        role: { mesure: 'établi', nom: 'orchestrateur' },
        nom: { mesure: 'lu', valeur: 'kamouraska' },
        mandat: 'p-20260822-0001', lieu: '/x',
      },
      {
        // Porteur d'une STORY, pas d'un epic — c'est le cas que rien ne gardait.
        pane: 'w2:p1', session: 's', statut: 'working',
        role: { mesure: 'établi', nom: 'orchestrateur' },
        nom: { mesure: 'lu', valeur: 'castor' },
        mandat: 't-20260822-0012', lieu: '/y',
      },
    ],
  };
  const vue = await laVueDuParc({
    recensement,
    lireChantier: async (code) => ({ code, epics: [{ code: 'E-1', stories: [{ code: 'T-20260822-0012' }] }] }),
  });

  assert.equal(vue.orchestrateurs[0].epics[0].stories[0].agent.mesure, 'lue', 'préalable : il est joint sur sa story');
  assert.ok(
    !vue.horsHierarchie.some((p) => p.agent.nom === 'castor'),
    'un agent joint au niveau STORY n’est pas aussi hors hiérarchie — il serait compté deux fois'
  );

  // 🔴 CE BANC PASSE, MAIS PAS POUR LA RAISON QU'IL ANNONCE — mesuré, et il fallait le dire.
  // `castor` est un ORCHESTRATEUR : il est déjà dans `dansUneHierarchie` par la boucle du
  // dessus, avant que celle des stories ne s'exécute. Retirer les DEUX boucles de jointure
  // laisse les 899 essais verts.
  //
  // La raison est structurelle : seul le rôle « orchestrateur » porte un mandat qui EST un code
  // de chantier, donc `parMandat` — et donc `quiPorte` étage 1 — ne peut rendre que des
  // orchestrateurs, tous déjà dans le Set. **Les deux boucles sont inatteignables aujourd'hui.**
  //
  // Elles s'allumeront quand un chef d'équipe aura un lieu (`T-20260822-0018`). D'ici là, aucun
  // banc ne peut les éprouver — et prétendre le contraire serait une garde vacante de plus.
  // On le DIT ici, comme on l'a dit pour la surface du `bin` et pour le périmètre de la garde
  // de famille : ce qui n'est pas couvert se déclare, sinon le nom du banc ment.
});

test('les stories ÉCARTÉES traversent les quatre jointures — le troisième jumeau, fermé', async () => {
  // 🔴 MUTATION SURVIVANTE AU CYCLE 5 : `storiesEcartees` était calculé par le lecteur ET
  // s'arrêtait là. Même forme que ses deux aînés, à un étage de distance chacun. Un signal
  // calculé qui n'arrive pas au lecteur ne sert à rien — c'est le travail fait pour rien qui
  // ressemble le plus à du travail fait.
  const recensement = {
    quand: 'T',
    agents: [{
      pane: 'w1:p1', session: 's', statut: 'idle',
      role: { mesure: 'établi', nom: 'orchestrateur' },
      nom: { mesure: 'lu', valeur: 'kamouraska' },
      mandat: 'p-20260822-0001', lieu: '/x',
    }],
  };
  const vue = await laVueDuParc({
    recensement,
    lireChantier: async (code) => ({
      code,
      epics: [{ code: 'E-1', stories: [{ code: 'T-1' }], storiesEcartees: 3 }],
    }),
  });

  assert.equal(vue.orchestrateurs[0].epics[0].storiesEcartees, 3, '① la vue le porte');
  assert.equal(vue.compte.storiesEcartees, 3, '② le compte le totalise');
  assert.match(vue.resume, /story\(s\) écartée\(s\)/, '③ le résumé le dit');
  assert.match(rendreLaVue(vue), /story\(s\) écartée\(s\)/, '④ et le texte le porte');

  // ⚠️ LE SYMÉTRIQUE : rien n'est dit quand rien n'a été écarté, sinon le signal s'éteint par
  // habitude — troisième fois qu'on pose cette paire, et elle vaut à chaque étage.
  const sain = await laVueDuParc({
    recensement,
    lireChantier: async (code) => ({ code, epics: [{ code: 'E-1', stories: [], storiesEcartees: 0 }] }),
  });
  assert.ok(!/écartée/.test(sain.resume), 'aucun bruit quand le filtre a bien filtré');
});
