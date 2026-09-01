// LA MISE À JOUR REFUSE AUSSI UN GABARIT DIVERGENT (T-20260818-0112, epic E-20260818-0014).
//
// ─────────────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER EXISTE À CÔTÉ DE CELUI DE LA POSE
//
// La garde vaut pour la FONCTION — servir le métier —, pas pour le geste où on l'a écrite.
// `representant-update` et `orchestrateur-update` sont le geste qu'on RECOMMANDE pour remettre
// un lieu d'aplomb : sans garde, rafraîchir un lieu dans l'un des six dépôts mesurés périmés
// au 2026-08-18 y aurait réinstallé un métier d'une autre époque, en annonçant un succès. Le
// geste censé réparer aurait abîmé.
//
// ⚠️ CE QUI SE MESURE ICI N'EST PAS CE QUE MESURE LA POSE. La pose sert le gabarit du DÉPÔT ;
// cette commande sert celui du PAYLOAD résolu — `--source`, `SOMTECH_PACK_PAYLOAD`, puis
// `cli/payload`, un produit de build IGNORÉ PAR GIT qui peut être périmé sans qu'aucun
// `git status` ne le dise. Le payload est donc ce qu'on MESURE, jamais ce contre quoi on
// mesure : `fraicheur-gabarit-miroir.test.js` tient cette moitié-là.
//
// ⚠️ ET LES ASSERTIONS PORTENT SUR LE DISQUE. Un refus qui tomberait APRÈS `applyFiles`
// passerait un test qui ne lirait que le code de sortie — le lieu serait déjà écrasé.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { run } from '../src/cli.js';
import { alignerLePosteSur, unPosteSansPack } from './lib/poste-conforme.js';
// La table RÉELLE des rôles que cette commande sait rafraîchir, importée — jamais recopiée.
// C'est celle que `cmdLieuUpdate` consulte (`ROLES[roleNom]`), donc la seule qui ne puisse pas
// se déphaser de ce qu'on mesure.
import { ROLES as REGISTRE } from '../src/commands/representant.js';

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

const METIER_DU_PACK = '# Tu es le représentant de ce client\n\nLe métier tel que le pack le distribue.\n';
const METIER_DU_LIEU = '# Tu es le représentant de ce client\n\nCe que ce lieu porte aujourd’hui.\n';
const CONTEXTE = '# Ce qu’on sait de ce client\n\nÉcrit à la main, jamais écrasé.\n';

/**
 * LE DÉNOMINATEUR DE CE FICHIER — MESURÉ SUR LE REGISTRE, PLUS ÉCRIT À LA MAIN
 * (T-20260826-0083).
 *
 * Trois tables le portaient en toutes lettres :
 *   `GABARIT_DE = { representant: 'gestionnaire-client', orchestrateur: 'orchestrateur' }`,
 *   `DOSSIER_DE = { representant: '.gestionnaire', … }`, `DESIGNE_DE = { … }`.
 * Un rôle absent de ces trois-là n'était pas refusé : il n'était pas VU. La garde de fraîcheur
 * de sa commande de mise à jour n'aurait été mesurée nulle part, et « rafraîchir son lieu » —
 * le geste qu'on recommande pour le remettre d'aplomb — aurait pu y réinstaller un métier
 * d'une autre époque en annonçant un succès, comme dans les six dépôts mesurés périmés au
 * 2026-08-18.
 *
 * ⚠️ POURQUOI LE REGISTRE ET NON `metier/*` — les deux ont été mesurées, et le SUJET tranche :
 * ce fichier ne lit RIEN du dépôt. Il fabrique des payloads jetables et exerce la commande
 * `<clé>-update`. Ce qu'il énumère, ce sont donc des CLÉS DE REGISTRE — « representant »,
 * « orchestrateur » —, un vocabulaire que `metier/` ne parle pas : `metier/` porte des NOMS DE
 * GABARIT (« gestionnaire-client »). Les deux mots désignent le même rôle et le dépôt les
 * confond par endroits (voir `cli/src/metier/gardes/roles-connus.js`, qui existe pour ça). Le
 * registre est le seul endroit où la clé, son gabarit et son dossier sont déclarés ENSEMBLE :
 * les trois tables en dérivent, elles ne le paraphrasent plus.
 *
 * ⚠️ ET IL EST DÉJÀ TENU EN MIROIR. `registre-des-roles-miroir.test.js` compare cette table à
 * `ligne-directe/src/roles.js` DANS LES DEUX SENS : un rôle ajouté à l'une sans l'autre rougit.
 * Notre dénominateur suit donc le registre de la naissance sans le lire — et sans importer
 * `ligne-directe/`, absent du paquet publié ailleurs que sous `payload/`.
 */
const CLES = Object.keys(REGISTRE).sort();

/**
 * LE TROISIÈME VOCABULAIRE — le drapeau qui désigne le lieu — N'EST PAS RECOPIÉ NON PLUS.
 *
 * La table `DESIGNE_DE` disait `--client` pour le représentant et `--nom` pour l'orchestrateur.
 * Mesuré le 2026-08-26 dans le code de production : `cmdLieuUpdate` lit `flags.client ??
 * flags.nom` — les DEUX drapeaux sont acceptés, pour TOUS les rôles ; celui de la table ne sert
 * qu'à formuler le message quand le nom est invalide. `--nom` vaut donc pour n'importe quel
 * rôle, y compris celui qu'on inscrira demain, et il n'y a rien à tenir à jour ici.
 */
const majDe = (cle, nom, source, target, extra = []) =>
  run([`${cle}-update`, '--nom', nom, '--source', source, '--target', target, ...extra]);

/** Un payload de pack, dont le gabarit porte le métier donné. */
function payload(cle, metier = METIER_DU_PACK) {
  const root = tmp('smtk-fraich-payload-');
  writeFileSync(join(root, 'pack.json'), JSON.stringify({
    name: 'fixture-pack', version: '9.9.9', modules: { core: { default: true, paths: ['.claude/'] } },
  }));
  const gabarit = join(root, '.claude', 'templates', REGISTRE[cle].gabarit);
  mkdirSync(gabarit, { recursive: true });
  writeFileSync(join(gabarit, 'CLAUDE.md'), metier);
  writeFileSync(join(gabarit, 'CONTEXTE.md'), CONTEXTE);
  return root;
}

/** Un dépôt où un lieu est DÉJÀ posé — c'est le seul cas que cette commande traite. */
function depotAvecLieu(cle, nom = 'acme') {
  const repo = tmp('smtk-fraich-depot-');
  const lieu = join(repo, REGISTRE[cle].dossier, nom);
  mkdirSync(lieu, { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), METIER_DU_LIEU);
  writeFileSync(join(lieu, 'CONTEXTE.md'), CONTEXTE);
  return { repo, lieu };
}

/** Ce que la commande a dit sur `console.error`, sans le laisser polluer le rapport de test. */
async function enEcoutantErreur(faire) {
  const vrai = console.error;
  const vu = [];
  console.error = (...a) => vu.push(a.join(' '));
  try { return { code: await faire(), dit: vu.join('\n') }; } finally { console.error = vrai; }
}

// ═════════════════════════════ 0. LE DÉNOMINATEUR LUI-MÊME

test('🔴 le dénominateur de ce fichier est MESURÉ, il n’est pas vide, et chaque rôle a sa commande', async () => {
  // ⚠️ SANS CE CONTRÔLE, LA GARDE SE DÉSARME TOUTE SEULE. Les contrôles ci-dessous vivent dans
  // une boucle `for (const cle of CLES)` : si le registre est vidé, la boucle n’enregistre AUCUN
  // test et le fichier passe au vert en n’ayant rien mesuré. « Un test qui attend RIEN ne peut
  // pas distinguer *rien trouvé* de *rien cherché* » (feed du 2026-08-25).
  assert.ok(CLES.length > 0,
    'le registre des rôles du CLI est vide : les contrôles de fraîcheur ne sont pas verts, ils '
    + 'n’existent pas.');

  // ⚠️ ET « CODE NON NUL » NE PROUVERAIT RIEN. Le switch de `src/cli.js` énumère ses commandes
  // en toutes lettres (`case 'representant-update'` …) : un rôle inscrit au registre sans sa
  // commande tombe dans le `default`, qui rend 1 lui aussi. Le test de refus ci-dessous serait
  // donc VERT sur un rôle dont la commande n’existe pas — un refus qui n’empêche rien. On exige
  // ici que le message ne soit PAS celui d’une commande inconnue.
  // Un poste NU, pour que ce contrôle ne dépende pas de la machine qui le lance : le vrai
  // `$HOME` porterait un pack réel, et le verdict changerait d'un poste à l'autre. Sans pack
  // installé la garde de fraîcheur ne refuse pas — la commande va jusqu'au bout et rend le
  // refus « ce lieu n'a jamais été posé », qui est justement ce qu'on distingue de « Commande
  // inconnue ».
  unPosteSansPack();
  const absentes = [];
  for (const cle of CLES) {
    const { dit } = await enEcoutantErreur(() =>
      majDe(cle, 'acme', payload(cle), tmp('smtk-fraich-vide-')));
    if (/Commande inconnue/i.test(dit)) absentes.push(cle);
  }
  assert.deepEqual(absentes, [],
    `ces rôles sont au registre du CLI mais n’ont pas de commande « <rôle>-update » : `
    + `${absentes.join(', ')}. Leur lieu ne peut pas être rafraîchi, donc la fraîcheur de leur `
    + `gabarit n’est gardée nulle part — ajouter le « case » dans src/cli.js.`);

  console.log(`  → dénominateur mesuré depuis le registre du CLI : ${CLES.join(', ')}`);
});

/**
 * LE RÔLE-TÉMOIN des contrôles qui ne varient PAS d'un rôle à l'autre — le texte d'un refus,
 * l'exemption du dépôt-source, le poste sans pack. Ils mesurent un chemin de code UNIQUE,
 * partagé par tous les rôles (`cmdLieuUpdate`, appelée deux fois) : les dérouler par rôle
 * mesurerait la même ligne N fois. Il est PRIS AU REGISTRE, jamais nommé — un témoin écrit à la
 * main serait le dénominateur en dur qu'on vient de retirer, revenu par la porte de derrière.
 */
const TEMOIN = CLES[0];

// ═════════════════════════════ 1. CE QU'ELLE ATTRAPE — et le lieu n'est pas touché

// ⚠️ UN TEST PAR RÔLE, PLUS UNE BOUCLE DANS UN TEST. Une boucle s'arrête à la première
// assertion rouge : le deuxième rôle n'est alors pas mesuré, et le rapport laisse croire qu'un
// seul est en cause. Avec un test par rôle, chacun rend son propre verdict.
for (const cle of CLES) {
  test(`${cle} — refus : le gabarit servi diverge du pack du poste, LE LIEU N’EST PAS TOUCHÉ (prouvé par le disque)`, async () => {
    // Le poste est conforme à UN pack ; la commande sert un AUTRE gabarit. C'est très
    // exactement la situation des six dépôts du parc, et celle d'un `cli/payload` périmé.
    alignerLePosteSur(payload(cle, METIER_DU_PACK));
    const perime = payload(cle, '# Tu es le pilote d’un chantier.\n\nUn métier d’une autre époque.\n');
    const { repo, lieu } = depotAvecLieu(cle);

    const avant = readFileSync(join(lieu, 'CLAUDE.md'), 'utf8');
    const empreinteAvant = readdirSync(lieu).sort().join(',');

    const code = await majDe(cle, 'acme', perime, repo);

    assert.notEqual(code, 0, `${cle} : la mise à jour a abouti sur un gabarit divergent`);
    assert.equal(
      readFileSync(join(lieu, 'CLAUDE.md'), 'utf8'), avant,
      `${cle} : le métier du lieu a été remplacé par un gabarit divergent — le geste qui répare a abîmé`,
    );
    assert.equal(readdirSync(lieu).sort().join(','), empreinteAvant, `${cle} : la mise à jour refusée a laissé des fichiers`);
    // Et surtout : aucune sauvegarde. Un `.somtech.bak` prouverait qu'on a commencé à écrire.
    assert.ok(
      !readdirSync(lieu).some((f) => f.includes('.somtech.bak')),
      `${cle} : une sauvegarde a été déposée — la convergence avait donc commencé avant le refus`,
    );
  });
}

test(`le refus PORTE LES DEUX EMPREINTES et dit que le lieu n’a pas bougé (témoin : ${TEMOIN})`, async () => {
  alignerLePosteSur(payload(TEMOIN));
  const perime = payload(TEMOIN, '# ailleurs\n');
  const { repo, lieu } = depotAvecLieu(TEMOIN, 'd-1');

  const erreurs = [];
  const avant = console.error;
  console.error = (...a) => erreurs.push(a.join(' '));
  try {
    await majDe(TEMOIN, 'd-1', perime, repo);
  } finally {
    console.error = avant;
  }

  const dit = erreurs.join('\n');
  assert.match(dit, /empreinte [0-9a-f]{64}[\s\S]*empreinte [0-9a-f]{64}/, 'le refus ne porte pas les DEUX empreintes entières');
  assert.match(dit, /npx @somtech-solutions\/pack update/, 'le refus ne nomme pas la commande de rattrapage');
  assert.ok(dit.includes(lieu), 'le refus ne nomme pas le lieu qu’il a laissé intact');
  for (const destructeur of [/\brm\b/, /--force/, /\bgit\s+reset\b/, /--hard/]) {
    assert.ok(!destructeur.test(dit), `le refus met « ${destructeur} » dans la bouche de l’opérateur`);
  }
});

// ═════════════════════════════ 2. CE QU'ELLE LAISSE PASSER — le second chiffre

// Le SECOND CHIFFRE d'une garde : ce qu'elle refuse à tort. Déroulé par rôle comme le premier —
// un faux refus qui ne frapperait qu'un rôle sur trois est le plus difficile à voir.
for (const cle of CLES) {
  test(`${cle} — un pack CONFORME converge comme avant : la garde n’a rien changé au cas normal`, async () => {
    const p = payload(cle);
    alignerLePosteSur(p);
    const { repo, lieu } = depotAvecLieu(cle);

    const code = await majDe(cle, 'acme', p, repo);

    assert.equal(code, 0, `${cle} : une convergence légitime a été refusée — c’est un faux refus`);
    assert.equal(readFileSync(join(lieu, 'CLAUDE.md'), 'utf8'), METIER_DU_PACK, `${cle} : le métier n’a pas convergé`);
    assert.equal(readFileSync(join(lieu, 'CONTEXTE.md'), 'utf8'), CONTEXTE, `${cle} : CONTEXTE.md a été touché (RA-REL-014)`);
  });
}

test(`RÉFÉRENCE INTROUVABLE : la mise à jour PROCÈDE, et le dit — jamais un refus (témoin : ${TEMOIN})`, async () => {
  unPosteSansPack();
  const perime = payload(TEMOIN, '# un métier quelconque\n');
  const { repo, lieu } = depotAvecLieu(TEMOIN);

  const lignes = [];
  const avant = console.log;
  console.log = (...a) => lignes.push(a.join(' '));
  let code;
  try {
    code = await majDe(TEMOIN, 'acme', perime, repo);
  } finally {
    console.log = avant;
  }

  assert.equal(code, 0, 'un poste sans pack installé a fait échouer la mise à jour — la garde crie à tort');
  assert.equal(readFileSync(join(lieu, 'CLAUDE.md'), 'utf8'), '# un métier quelconque\n', 'la convergence n’a pas eu lieu');
  assert.match(
    lignes.join('\n'), /métier NON VÉRIFIÉ/,
    'la commande s’est tue sur ce qu’elle n’a pas pu mesurer — c’est le succès muet que ce lot ferme',
  );
});

test(`LE DÉPÔT-SOURCE DU PACK n’est pas comparé à lui-même — et la commande le dit (témoin : ${TEMOIN})`, async () => {
  alignerLePosteSur(payload(TEMOIN));
  const enTravail = payload(TEMOIN, '# un métier en cours de réécriture\n');
  const { repo, lieu } = depotAvecLieu(TEMOIN, 'd-1');
  // Le manifeste de la source, en ENTIER : depuis la passe 2, le nom seul ne dispense
  // plus de rien — il faut aussi que le dépôt distribue « .claude/ ».
  writeFileSync(join(repo, 'pack.json'), JSON.stringify({ name: 'somtech-pack', modules: { core: { paths: ['.claude/'] } } }));

  const lignes = [];
  const avant = console.log;
  console.log = (...a) => lignes.push(a.join(' '));
  let code;
  try {
    code = await majDe(TEMOIN, 'd-1', enTravail, repo);
  } finally {
    console.log = avant;
  }

  assert.equal(code, 0, 'le dépôt-source du pack a été refusé sur son propre gabarit en cours de travail');
  assert.equal(readFileSync(join(lieu, 'CLAUDE.md'), 'utf8'), '# un métier en cours de réécriture\n');
  assert.match(lignes.join('\n'), /source du pack/i, 'l’exemption s’est prise en silence — elle doit se dire');
});

// ═════════════════════════════ 3. L'ORDRE — le refus tombe avant l'écriture

test('--dry-run n’écrit rien non plus quand la garde refuse, et refuse quand même', async () => {
  // `--dry-run` n'écrit jamais : ce que ce test éprouve, c'est que la garde ne devient pas
  // permissive parce qu'on lui promet qu'on n'écrira pas. Un lieu dont on ANNONCE la
  // convergence vers un gabarit périmé a déjà enseigné le mauvais geste à qui lit la sortie.
  alignerLePosteSur(payload(TEMOIN));
  const perime = payload(TEMOIN, '# ailleurs\n');
  const { repo, lieu } = depotAvecLieu(TEMOIN, 'd-1');

  const code = await majDe(TEMOIN, 'd-1', perime, repo, ['--dry-run']);

  assert.notEqual(code, 0, '--dry-run a rendu un plan de convergence vers un gabarit divergent');
  assert.equal(readFileSync(join(lieu, 'CLAUDE.md'), 'utf8'), METIER_DU_LIEU);
});

test('un lieu ABSENT reste un lieu absent — la fraîcheur ne coiffe pas ce refus-là', async () => {
  // Deux causes, deux gestes : « ce lieu n'a jamais été posé » n'envoie pas mettre un pack à
  // jour. Confondre les deux enverrait réparer ce qui n'est pas cassé.
  alignerLePosteSur(payload(TEMOIN));
  const perime = payload(TEMOIN, '# ailleurs\n');
  const repo = tmp('smtk-fraich-vide-');

  const erreurs = [];
  const avant = console.error;
  console.error = (...a) => erreurs.push(a.join(' '));
  try {
    await majDe(TEMOIN, 'acme', perime, repo);
  } finally {
    console.error = avant;
  }

  assert.match(erreurs.join('\n'), /n’a jamais été|n'a jamais été/, 'le refus rendu n’est pas celui du lieu absent');
  assert.equal(existsSync(join(repo, REGISTRE[TEMOIN].dossier, 'acme')), false, 'un lieu a été créé par une commande qui n’en pose aucun');
});
