// LA VUE EN PARALLÈLE REND LE MÊME OCTET QUE LA VUE EN SÉQUENTIEL — E-20260824-0011,
// T-20260825-0001, critères 1 à 4.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE BANC NE COMPARE PAS À UNE RÉÉCRITURE — IL COMPARE AU VRAI PRÉDÉCESSEUR
//
// La contrainte du lot est écrite en rouge : « LE RÉSULTAT NE CHANGE PAS D'UN OCTET », et la
// preuve attendue est une comparaison **champ à champ** sur le même instantané. Un banc qui
// réécrirait la lecture séquentielle « comme elle était » ne prouverait rien : un double non
// conforme ne rate pas seulement un défaut, il finit par exiger le comportement fautif.
//
// Alors on ne réécrit rien. `tests/pieces/vue-du-parc-avant-le-parallelisme.js.txt` est la copie
// **octet pour octet** de `src/vue-du-parc.js` tel qu'il était sur `origin/main` au commit
// `1492aa0b43cd3b22970194c9b2dbf7641b971ca4` — le code qui a coûté 81 s le 2026-08-25. Son
// empreinte est épinglée ci-dessous : le modifier rougit.
//
//   ⚠️ POURQUOI UN `.txt`, ET POURQUOI PAS `git show` AU MOMENT DU BANC. `.txt` pour qu'aucun
//   ramassage de fichiers d'essais ne le prenne pour une suite. Et versé plutôt que tiré de git
//   parce qu'un clone d'intégration continue est superficiel : `git show origin/main:…` y
//   échoue, et un banc qui ne peut pas mesurer se met à ne rien mesurer.
//
//   ⚠️ CE QUE L'ÉPINGLE GARDE, ET CE QU'ELLE NE GARDE PAS. Elle garde la copie contre une
//   édition — la faire dériver rougit. Elle ne garde pas contre quelqu'un qui remplacerait la
//   copie ET l'empreinte ensemble : une suite ne peut pas se garder elle-même, c'est écrit
//   ailleurs dans ce dépôt et ça reste vrai ici.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// L'INSTANTANÉ — un vrai transport de ServiceDesk, gelé, qui répond pareil à tout le monde
//
// 🔴 IL RÉPOND PAR LA QUESTION, JAMAIS PAR L'ORDRE D'ARRIVÉE. C'est ce qui rend la comparaison
// honnête : si les deux vues diffèrent, c'est le code qui diffère, jamais l'instantané. Un
// double qui répondrait « le suivant de ma liste » ferait diverger les deux lectures pour une
// raison qui n'appartient à aucune des deux.
//
// Et il porte les cas que le parc réel porte, pas un parc de démonstration : un chantier tenu
// par DEUX orchestrateurs, un epic dont les stories REFUSENT, une liste d'epics PLAFONNÉE, un
// filtre d'epics qui n'a PAS filtré, un chantier dont l'application ne figure nulle part, un
// mandat qui n'est pas un code, un lieu sans terminal vivant.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { laVueDuParc, lecteurDeChantier, rendreLaVue } from '../src/vue-du-parc.js';
import { PLAFOND_SERVICEDESK, borner } from '../src/plafond.js';

const ICI = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(ICI, '..', 'src');
const COPIE = join(ICI, 'pieces', 'vue-du-parc-avant-le-parallelisme.js.txt');

/** L'empreinte du prédécesseur, épinglée. La copie dérive → ce banc rougit. */
const EMPREINTE_DU_PREDECESSEUR = '65acbedd824e5d1fc8521a2a0c1b8cf21a4d9236d3af9e7714f76cce45d41c98';
const COMMIT_DU_PREDECESSEUR = '1492aa0b43cd3b22970194c9b2dbf7641b971ca4';

/**
 * LE PRÉDÉCESSEUR, CHARGÉ COMME UN MODULE VIVANT — pas relu comme un texte.
 *
 * ⚠️ LA SEULE CHOSE QU'ON LUI CHANGE EST LE CHEMIN DE SES VOISINS, et on le dit : depuis un
 * dossier temporaire, `./mandat.js` ne désigne plus rien. On réécrit donc `from './x.js'` en
 * chemin absolu vers le VRAI `src/` — les modules qu'il importe sont ceux d'aujourd'hui, ce
 * qui est exactement ce qu'on veut : **une seule chose change entre les deux lectures, et
 * c'est le fichier qu'on éprouve.**
 */
let predecesseur = null;
async function chargerLePredecesseur() {
  if (predecesseur) return predecesseur;
  const source = readFileSync(COPIE);
  const empreinte = createHash('sha256').update(source).digest('hex');
  assert.equal(
    empreinte,
    EMPREINTE_DU_PREDECESSEUR,
    `la copie du prédécesseur a changé. Si c'est voulu, dis d'où vient la nouvelle (commit) ` +
      `et remets son empreinte ici — sinon ce banc compare le parallèle à autre chose que ce ` +
      `qui tournait avant le lot.`
  );
  const reecrit = source.toString('utf8').replace(/ from '\.\/([^']+)'/g, ` from '${pathToFileURL(SRC).href}/$1'`);
  const dossier = mkdtempSync(join(tmpdir(), 'vue-avant-'));
  const chemin = join(dossier, 'vue-du-parc-sequentielle.mjs');
  writeFileSync(chemin, reecrit);
  predecesseur = await import(pathToFileURL(chemin).href);
  // ⚠️ ON VÉRIFIE QU'ON A CHARGÉ UN MODULE, PAS UN FICHIER QUI SE TAIT. Un import qui rendrait
  // un objet vide ferait passer ce banc pour vert sur une comparaison qui n'a jamais eu lieu.
  assert.equal(typeof predecesseur.laVueDuParc, 'function', 'le prédécesseur doit exposer laVueDuParc');
  assert.equal(typeof predecesseur.lecteurDeChantier, 'function', 'le prédécesseur doit exposer lecteurDeChantier');
  return predecesseur;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// L'INSTANTANÉ
// ═══════════════════════════════════════════════════════════════════════════════════════

const CHANTIERS = [
  // code, famille, champ parent, epics, cas particulier
  { code: 'P-20260820-0001', famille: 'projects', epics: 6 },
  { code: 'P-20260822-0001', famille: 'projects', epics: 9 },
  { code: 'D-20260824-0003', famille: 'demands', epics: 4 },
  { code: 'J-20260814-0002', famille: 'deliveries', epics: 3 },
  { code: 'P-20260819-0001', famille: 'projects', epics: 5, appInconnue: true },
  { code: 'D-20260822-0001', famille: 'demands', epics: 0 },
  { code: 'P-20260815-0002', famille: 'projects', epics: 7, intrus: 2 },
];
const CHAMP_DU_CODE = { projects: 'project_id', demands: 'demand_id', deliveries: 'delivery_id' };
const CHAMP_PARENT = { projects: 'project_id', demands: 'demand_id', deliveries: 'delivery_id' };
const APP = '2098c2fd-5448-46a3-bd98-83778e7a064d';
const LIMITE = 12; // petit exprès : le plafond de liste doit être ATTEIGNABLE dans l'instantané

const idDe = (code) => `id-${code}`;
const epicsDe = (c) =>
  Array.from({ length: c.epics }, (_, i) => ({
    id: `${idDe(c.code)}-e${i}`,
    epic_id: `E-2026082${(i % 9) + 1}-00${10 + i}`,
    title: `epic ${i} de ${c.code}`,
    status: ['draft', 'in_execution', 'completed'][i % 3],
    [CHAMP_PARENT[c.famille]]: idDe(c.code),
  }));
const storiesDe = (epic, n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${epic.id}-t${i}`,
    ticket_id: `T-2026082${(i % 9) + 1}-00${20 + i}`,
    title: `story ${i} de ${epic.epic_id}`,
    status: ['new', 'in_progress', 'ready_to_deploy'][i % 3],
    epic_id: epic.id,
  }));

/** Le nombre de stories d'un epic — dérivé de son id, donc STABLE d'une lecture à l'autre. */
const combienDeStories = (epic) => (epic.id.charCodeAt(epic.id.length - 1) % 5) + (epic.id.endsWith('e0') ? 0 : 1);
/** Un epic dont les stories REFUSENT — `stories: null`, jamais `[]`. */
const storiesRefusent = (epic) => epic.epic_id.endsWith('012');

/**
 * L'INSTANTANÉ GELÉ. Il répond à la QUESTION, jamais au moment où elle arrive.
 *
 * @param compteur  un objet où l'on note chaque appel — c'est ce qui prouve « lu une fois ».
 * @param espion    `(enVol) → void` appelé à chaque entrée/sortie, pour mesurer le parallélisme.
 */
function instantane({ compteur = null, espion = null, retard = 0, refuser = null } = {}) {
  let enVol = 0;
  return async (nom, args) => {
    if (compteur) {
      const cle = `${nom}/${args?.action}/${args?.epic_id ?? args?.project_id ?? args?.demand_id ?? args?.delivery_id ?? ''}`;
      compteur[cle] = (compteur[cle] ?? 0) + 1;
      compteur[nom] = (compteur[nom] ?? 0) + 1;
    }
    enVol += 1;
    if (espion) espion(enVol);
    try {
      if (retard) await new Promise((r) => setTimeout(r, retard));
      // 🔴 UN REFUS SE DÉCIDE SUR LA QUESTION, JAMAIS SUR LE RANG DE L'APPEL — et ce banc a
      // d'abord refusé « les trois premiers ». Il rougissait, et il accusait le lot : le lot
      // CHANGE l'ordre des appels, c'est tout son objet, donc « les trois premiers » ne désigne
      // pas les mêmes trois appels des deux côtés. Le banc mesurait l'ordre en croyant mesurer
      // le rendu. Un refus attaché à la question est le même refus pour les deux lectures.
      if (refuser && refuser(nom, args)) throw new Error(`le ServiceDesk refuse ${nom}/${args?.action}`);
      return repondre(nom, args);
    } finally {
      enVol -= 1;
      if (espion) espion(enVol);
    }
  };
}

function repondre(nom, args) {
  if (nom === 'applications') {
    return { applications: [{ id: APP, name: 'somtech-pack' }] };
  }
  if (nom === 'tickets') {
    const epic = CHANTIERS.flatMap(epicsDe).find((e) => e.id === args.epic_id);
    if (!epic) return { tickets: [] };
    if (storiesRefusent(epic)) throw new Error('les tickets de cet epic ne se lisent pas');
    return { tickets: storiesDe(epic, combienDeStories(epic)) };
  }
  if (nom === 'epics') {
    const champ = ['project_id', 'demand_id', 'delivery_id'].find((k) => args[k]);
    const c = CHANTIERS.find((x) => idDe(x.code) === args[champ]);
    if (!c) return { epics: [] };
    const miens = epicsDe(c);
    // Le filtre qui n'a pas filtré : le service rend des epics d'un AUTRE chantier.
    const intrus = c.intrus ? epicsDe(CHANTIERS[0]).slice(0, c.intrus) : [];
    return { epics: [...miens, ...intrus] };
  }
  // Les familles de chantier : `projects`, `demands`, `deliveries`.
  const miens = CHANTIERS.filter((c) => c.famille === nom);
  return {
    [nom]: miens.map((c) => ({
      id: idDe(c.code),
      [CHAMP_DU_CODE[c.famille]]: c.code,
      title: `le chantier ${c.code}`,
      status: 'in_progress',
      application_id: c.appInconnue ? 'app-qui-nexiste-pas' : APP,
    })),
  };
}

/** Le recensement gelé — deux orchestrateurs sur le MÊME chantier, et un mandat qui n'est pas un code. */
const RECENSEMENT = {
  quand: '2026-08-25T11:00:00.000Z',
  borne: { sessionsRefusees: [] },
  agents: [
    ag('s1', 'w1:p1', 'kamouraska', 'orchestrateur', 'P-20260822-0001'),
    ag('s1', 'w1:p2', 'natashquan', 'orchestrateur', 'P-20260820-0001'),
    // 🔴 LE MÊME CHANTIER, UN SECOND PORTEUR — mesuré sur le poste le 2026-08-25.
    ag('s2', 'w2:p1', 'mitis', 'orchestrateur', 'P-20260820-0001'),
    ag('s2', 'w2:p2', 'matapedia', 'orchestrateur', 'matapedia'),
    ag('s2', 'w2:p3', 'batiscan', 'orchestrateur', 'J-20260814-0002'),
    ag('s3', 'w3:p1', 'e-20260824-0011', null, null),
    ag('s3', 'w3:p9', 'saguenay', 'orchestrateur', 'D-20260822-0001'),
  ],
};
function ag(session, pane, nom, role, mandat) {
  return {
    session,
    pane,
    nom: { mesure: 'lu', valeur: nom },
    role: role ? { mesure: 'établi', nom: role } : { mesure: 'non établi', pourquoi: 'aucun lieu ne le porte' },
    mandat,
    lieu: role ? `/lieux/${nom}` : null,
    titre: `✳ ${nom}`,
  };
}

const LIEUX = {
  mesure: 'lue',
  racines: ['/lieux'],
  entrees: [
    // Sans terminal vivant : ils n'apparaissent que par le disque.
    { role: 'orchestrateur', mandat: 'D-20260824-0003', chemins: ['/lieux/a', '/lieux/b'] },
    { role: 'orchestrateur', mandat: 'P-20260819-0001', chemins: ['/lieux/c'] },
    { role: 'orchestrateur', mandat: 'P-20260815-0002', chemins: ['/lieux/d'] },
    // Déjà vu vivant : il ne doit PAS réapparaître.
    { role: 'orchestrateur', mandat: 'P-20260822-0001', chemins: ['/lieux/e'] },
    // Un mandat qui n'est pas un code.
    { role: 'orchestrateur', mandat: 'general', chemins: ['/lieux/f'] },
    { role: 'representant', mandat: 'un-client', chemins: ['/lieux/g'] },
  ],
};

/** Construit la vue avec le module D'AUJOURD'HUI. */
async function vueParallele(reglages = {}) {
  const lireChantier = lecteurDeChantier({ appeler: instantane(reglages), limite: LIMITE, ...reglages });
  return laVueDuParc({ recensement: RECENSEMENT, lieux: LIEUX, lireChantier });
}

/** Construit la vue avec le module D'AVANT — le vrai, celui qui coûtait 81 s. */
async function vueSequentielle(reglages = {}) {
  const avant = await chargerLePredecesseur();
  const lireChantier = avant.lecteurDeChantier({ appeler: instantane(reglages), limite: LIMITE });
  return avant.laVueDuParc({ recensement: RECENSEMENT, lieux: LIEUX, lireChantier });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1. LE BANC CENTRAL — IDENTITÉ CHAMP À CHAMP
// ═══════════════════════════════════════════════════════════════════════════════════════

test('LE MÊME INSTANTANÉ REND LA MÊME VUE — champ à champ, contre le code qui tournait avant le lot', async () => {
  const avant = await vueSequentielle();
  const apres = await vueParallele();

  // ⚠️ `deepStrictEqual` D'ABORD — c'est LUI qui compare champ à champ, y compris les
  // déclarations d'incomplétude (`epics: null`, `stories: null`, `storiesPlafonnees`,
  // `epicsEcartes`) que le lot n'a pas le droit de toucher.
  assert.deepStrictEqual(apres, avant, 'la vue parallèle diffère de la vue séquentielle');

  // ⚠️ ET L'ÉGALITÉ DES OCTETS ENSUITE, parce que `deepStrictEqual` ne regarde PAS l'ordre des
  // clés d'un objet ni ne distingue un `undefined` absent d'un `undefined` présent — or c'est
  // du JSON qui part au socket, et le dirigeant lit ce JSON-là.
  assert.equal(JSON.stringify(apres), JSON.stringify(avant), 'les deux vues ne rendent pas les mêmes octets');
});

test('ET LE TEXTE QUE LE DIRIGEANT LIT EST LE MÊME — pas seulement le JSON', async () => {
  // 🔴 TOUTE LA GARDE DE HS-VUE-002 SE JOUE SUR LA LIGNE RENDUE, pas sur le champ. Comparer le
  // JSON seul laisserait passer une divergence d'ORDRE des lignes — le JSON serait égal champ à
  // champ tableau par tableau, et l'arbre affiché serait dans un autre ordre.
  const avant = rendreLaVue(await vueSequentielle());
  const apres = rendreLaVue(await vueParallele());
  assert.equal(apres, avant, 'le texte rendu diffère');
  assert.ok(apres.includes('P-20260820-0001'), "l'instantané doit vraiment porter le chantier à deux porteurs");
});

test('LA VUE NE DÉPEND PAS DU PLAFOND — 1, 8, 32 rendent le même octet', async () => {
  // 🔴 C'EST LA QUESTION QUE LE PRÉDÉCESSEUR NE PEUT PAS POSER : il n'a pas de plafond. Celle-ci
  // dit que le RÉSULTAT ne dépend pas du nombre d'appels en vol — donc qu'aucune part du rendu
  // n'est décidée par l'ordre où le service répond.
  const [un, huit, trenteDeux] = await Promise.all([
    vueParallele({ plafond: 1 }),
    vueParallele({ plafond: 8 }),
    vueParallele({ plafond: 32 }),
  ]);
  assert.equal(JSON.stringify(huit), JSON.stringify(un), 'plafond 8 ≠ plafond 1');
  assert.equal(JSON.stringify(trenteDeux), JSON.stringify(un), 'plafond 32 ≠ plafond 1');
});

test('UN INSTANTANÉ QUI REFUSE REND LE MÊME REFUS DES DEUX CÔTÉS', async () => {
  // 🔴 L'IDENTITÉ DOIT TENIR AUSSI QUAND ÇA CASSE, et c'est là qu'un lot de vitesse dérape : il
  // accélère en avalant les refus, la vue devient plus rapide ET plus fausse, et un
  // `deepStrictEqual` sur le seul chemin heureux ne le verrait jamais.
  //
  // Trois refus, à trois étages différents, chacun attaché à SA question :
  //   • la liste des applications refuse   → « APP NON ÉTABLIE » avec sa cause, partout
  //   • les epics d'un chantier refusent   → `epics: null`, jamais `[]`
  //   • les tickets d'un epic refusent     → `stories: null`, jamais `[]`
  const refuser = (nom, args) =>
    nom === 'applications' ||
    (nom === 'epics' && args?.project_id === idDe('P-20260822-0001')) ||
    (nom === 'tickets' && args?.epic_id === `${idDe('D-20260824-0003')}-e1`);

  const avant = await vueSequentielle({ refuser });
  const apres = await vueParallele({ refuser });
  assert.deepStrictEqual(apres, avant, 'le refus ne se rend pas pareil');
  assert.equal(JSON.stringify(apres), JSON.stringify(avant), 'le refus ne rend pas les mêmes octets');

  // ⚠️ ET ON VÉRIFIE QUE LE BANC A VRAIMENT FAIT REFUSER QUELQUE CHOSE. Deux vues identiquement
  // intactes seraient vertes ici sans avoir rien éprouvé — c'est la forme « une étape verte
  // parce qu'elle n'a jamais touché ce qu'elle prétend éprouver ».
  const ligneRefusee = apres.orchestrateurs.find((o) => o.chantier?.code === 'P-20260822-0001');
  assert.equal(ligneRefusee.epics, null, 'un chantier dont les epics refusent rend `epics: null`, pas `[]`');
  assert.equal(ligneRefusee.chantier.mesure, 'non mesurée', 'et il se dit « non mesurée », il ne disparaît pas');

  const ligneD = apres.orchestrateurs.find((o) => o.chantier?.code === 'D-20260824-0003');
  const epicMuet = ligneD.epics.find((e) => e.stories === null);
  assert.ok(epicMuet, 'un epic dont les tickets refusent doit rendre `stories: null`, jamais `[]`');

  assert.match(
    JSON.stringify(apres),
    /applications n’a pas pu être lue/,
    'une liste d’applications refusée doit voyager avec sa cause'
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2. LA LECTURE EST PARTAGÉE — un chantier à deux porteurs se lit UNE fois, s'affiche DEUX
// ═══════════════════════════════════════════════════════════════════════════════════════

test('UN CHANTIER PORTÉ PAR DEUX ORCHESTRATEURS EST LU UNE FOIS — et le prédécesseur le lisait deux fois', async () => {
  const compteurAvant = {};
  const avant = await vueSequentielle({ compteur: compteurAvant });
  const compteurApres = {};
  const apres = await vueParallele({ compteur: compteurApres });

  // ⚠️ ON COMPTE L'APPEL QUI PORTE LE CHANTIER — `epics/list` filtré sur SON id. C'est le seul
  // qui distingue « ce chantier a été lu N fois » de « la famille a été listée N fois ».
  const cle = `epics/list/${idDe('P-20260820-0001')}`;
  assert.equal(compteurAvant[cle], 2, "le prédécesseur lisait bien le chantier DEUX fois — sinon ce banc ne mesure rien");
  assert.equal(compteurApres[cle], 1, 'un chantier porté par deux orchestrateurs doit être lu UNE fois');

  // 🔴 ET IL RESTE AFFICHÉ DEUX FOIS. Le partage de lecture n'est PAS un dédoublonnage
  // d'affichage : les deux orchestrateurs sont deux réalités du parc, et l'epic interdit
  // explicitement de les fondre.
  const lignes = apres.orchestrateurs.filter((o) => o.chantier?.code === 'P-20260820-0001');
  assert.equal(lignes.length, 2, 'les deux porteurs gardent chacun leur ligne');
  assert.deepStrictEqual(
    lignes.map((l) => l.agent?.nom),
    ['natashquan', 'mitis'],
    'et ce sont bien DEUX agents différents, dans l’ordre du registre'
  );
  // Et la vue rendue par le prédécesseur en affichait deux aussi : rien n'a changé au rendu.
  assert.equal(avant.orchestrateurs.filter((o) => o.chantier?.code === 'P-20260820-0001').length, 2);
});

test('LE PARTAGE MEURT AVEC LA LECTURE — ce n’est pas un cache entre deux rafraîchissements', async () => {
  // 🔴 HORS-LOT N°2 DE L'EPIC : « un cache entre deux rafraîchissements est HORS LOT — le `r`
  // doit relire le réel, pas resservir l'ancien ». Un lecteur neuf ne doit RIEN savoir de ce
  // que le précédent a lu.
  const compteur = {};
  const appeler = instantane({ compteur });
  const premier = lecteurDeChantier({ appeler, limite: LIMITE });
  await premier('P-20260820-0001');
  const apresPremier = compteur[`epics/list/${idDe('P-20260820-0001')}`];
  const second = lecteurDeChantier({ appeler, limite: LIMITE });
  await second('P-20260820-0001');
  assert.equal(apresPremier, 1, 'la première lecture appelle une fois');
  assert.equal(
    compteur[`epics/list/${idDe('P-20260820-0001')}`],
    2,
    'un lecteur NEUF doit relire le réel — sinon le `r` du TUI resservirait de l’ancien'
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3. LE PLAFOND TIENT — et il est vraiment atteint, sinon il ne borne rien qui existe
// ═══════════════════════════════════════════════════════════════════════════════════════

test('LE PLAFOND N’EST JAMAIS DÉPASSÉ, ET IL EST ATTEINT', async () => {
  for (const plafond of [1, 2, 4, 8]) {
    let max = 0;
    const espion = (enVol) => {
      max = Math.max(max, enVol);
    };
    // ⚠️ UN RETARD, ET IL N'EST PAS DÉCORATIF : sans lui, chaque appel rend dans le même tour
    // de boucle et deux appels ne se croisent jamais — le banc mesurerait « 1 en vol » sur un
    // code parfaitement parallèle, et passerait pour vert en ne gardant rien.
    await vueParallele({ plafond, espion, retard: 5 });
    assert.ok(max <= plafond, `${max} appels en vol pour un plafond de ${plafond}`);
    assert.equal(max, plafond, `le plafond de ${plafond} n’est jamais atteint : la lecture ne se parallélise pas`);
  }
});

test('LES STORIES D’UN MÊME CHANTIER PARTENT DE FRONT — la boucle qui coûtait 65 % du temps', async () => {
  // 🔴 CE BANC VISE UNE SEULE ARÊTE : le `tickets/list` par epic. Un banc qui regarderait
  // seulement « la vue parallélise » resterait VERT si on remettait cette boucle en séquentiel,
  // parce que les autres chantiers, eux, partiraient toujours de front. On mesure donc UN
  // chantier, tout seul, et on demande à voir plusieurs appels de tickets se croiser.
  let max = 0;
  const appeler = instantane({ espion: (n) => (max = Math.max(max, n)), retard: 5 });
  const lire = lecteurDeChantier({ appeler, limite: LIMITE, plafond: 8 });
  const chantier = await lire('P-20260822-0001'); // 9 epics
  assert.equal(chantier.epics.length, 9, 'l’instantané doit vraiment porter 9 epics');
  assert.ok(max > 1, 'les tickets des 9 epics partent un par un : la boucle est restée séquentielle');
});

test('LES CHANTIERS PARTENT DE FRONT LES UNS DES AUTRES', async () => {
  // Le jumeau du banc ci-dessus, un étage plus haut. Sans lui, remettre la boucle des LIGNES en
  // séquentiel resterait vert : les stories d'un même chantier suffiraient à croiser des appels.
  let max = 0;
  const appeler = instantane({ espion: (n) => (max = Math.max(max, n)), retard: 5 });
  // Un seul epic par chantier serait l'idéal ; ici on prend le lecteur tel quel et on regarde
  // le PREMIER moment de la lecture : les listes de familles doivent déjà se croiser.
  const vues = [];
  const lire = lecteurDeChantier({ appeler, limite: LIMITE, plafond: 8 });
  await laVueDuParc({
    recensement: RECENSEMENT,
    lieux: LIEUX,
    lireChantier: (c) => {
      vues.push(c);
      return lire(c);
    },
  });
  assert.ok(vues.length >= 7, 'l’instantané doit porter plusieurs chantiers');
  assert.ok(max > 1, 'les chantiers se lisent un par un : la boucle des lignes est restée séquentielle');
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4. LA BORNE ELLE-MÊME — ce que `borner` promet, éprouvé sans passer par la vue
// ═══════════════════════════════════════════════════════════════════════════════════════

test('UNE PLACE SE REND MÊME QUAND L’APPEL JETTE — sinon un parc qui refuse fige la vue', async () => {
  // 🔴 LE DÉFAUT QUI NE SE VOIT PAS : sans libération sur erreur, `plafond` refus successifs
  // consomment toutes les places et la vue attend pour toujours. Le symptôme serait « la vue ne
  // rend plus », jamais « le ServiceDesk refuse ».
  let sert = 0;
  const appeler = async (n) => {
    sert += 1;
    if (n <= 4) throw new Error('refus');
    return n;
  };
  const borne = borner(appeler, { plafond: 4 });
  const issues = await Promise.allSettled([1, 2, 3, 4, 5, 6, 7, 8].map((n) => borne(n)));
  assert.equal(sert, 8, 'les huit appels doivent être servis : quatre refus n’immobilisent pas les places');
  assert.deepEqual(
    issues.map((i) => i.status),
    ['rejected', 'rejected', 'rejected', 'rejected', 'fulfilled', 'fulfilled', 'fulfilled', 'fulfilled']
  );
});

test('UN TRANSPORT QUI JETTE AVANT DE RENDRE SA PROMESSE REND SA PLACE AUSSI', async () => {
  // Le jumeau synchrone du banc ci-dessus. Sans le `try` autour de l'appel, cette place-là est
  // perdue sans qu'aucun refus ne soit visible.
  let sert = 0;
  const appeler = (n) => {
    sert += 1;
    if (n <= 2) throw new Error('refus synchrone');
    return Promise.resolve(n);
  };
  const borne = borner(appeler, { plafond: 2 });
  const issues = await Promise.allSettled([1, 2, 3, 4].map((n) => borne(n)));
  assert.equal(sert, 4, 'un refus synchrone ne doit pas garder sa place');
  assert.deepEqual(
    issues.map((i) => i.status),
    ['rejected', 'rejected', 'fulfilled', 'fulfilled']
  );
});

test('UN PLAFOND ILLISIBLE VAUT UN, JAMAIS L’INFINI', async () => {
  // ⚠️ LE CAS DÉGRADÉ NE DOIT PAS ÊTRE LE CAS LE PLUS AGRESSIF POUR UN SERVICE PARTAGÉ. Se
  // replier sur « pas de borne » quand le réglage est absurde inverse exactement ce que la
  // borne existe pour empêcher.
  for (const absurde of [0, -3, Number.NaN, Infinity, null, 'huit']) {
    let max = 0;
    let enVol = 0;
    const appeler = async () => {
      enVol += 1;
      max = Math.max(max, enVol);
      await new Promise((r) => setTimeout(r, 3));
      enVol -= 1;
    };
    const borne = borner(appeler, { plafond: absurde });
    await Promise.all([1, 2, 3, 4, 5, 6].map(() => borne()));
    assert.equal(max, 1, `un plafond « ${String(absurde)} » doit valoir 1, il a laissé passer ${max}`);
  }
});

test('SANS TRANSPORT, LA BORNE NE FABRIQUE PAS DE TRANSPORT', async () => {
  // ⚠️ « aucun accès au ServiceDesk » ≠ « un accès qui refuse ». C'est ce `null` qui fait rendre
  // « aucun accès ne m'a été donné » plutôt qu'un parc inventé — le contrat ne bouge pas.
  assert.equal(borner(null), null);
  assert.equal(borner(undefined), undefined);
  assert.equal(lecteurDeChantier({ appeler: null }), null);
});

test('LE PLAFOND DE PRODUCTION N’A PAS BOUGÉ PAR ACCIDENT — la sonde qui l’a choisi est datée', () => {
  // ⚠️ MÊME NATURE QUE L'ÉPINGLE DE LA BORNE DU GESTE, ET MÊMES LIMITES : elle garde contre un
  // changement ACCIDENTEL, pas contre quelqu'un qui change la valeur et ce banc ensemble. Ce
  // qu'elle exige, c'est qu'on relise la sonde de `src/plafond.js` avant de toucher au chiffre.
  assert.equal(
    PLAFOND_SERVICEDESK,
    8,
    'le plafond a changé. Si c’est voulu : refais la sonde contre le VRAI ServiceDesk, reporte ' +
      'le tableau dans src/plafond.js, et dis ici pourquoi le nouveau chiffre.'
  );
  assert.ok(PLAFOND_SERVICEDESK >= 2, 'un plafond de 1 est un retour au séquentiel, déguisé en réglage');
});

test('LE COMMIT DU PRÉDÉCESSEUR EST DIT — sinon « avant » ne désigne rien', () => {
  assert.match(COMMIT_DU_PREDECESSEUR, /^[0-9a-f]{40}$/, 'la provenance de la copie doit être un commit');
});
