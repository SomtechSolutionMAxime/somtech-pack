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

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

const METIER_DU_PACK = '# Tu es le représentant de ce client\n\nLe métier tel que le pack le distribue.\n';
const METIER_DU_LIEU = '# Tu es le représentant de ce client\n\nCe que ce lieu porte aujourd’hui.\n';
const CONTEXTE = '# Ce qu’on sait de ce client\n\nÉcrit à la main, jamais écrasé.\n';

const GABARIT_DE = { representant: 'gestionnaire-client', orchestrateur: 'orchestrateur' };
const DOSSIER_DE = { representant: '.gestionnaire', orchestrateur: '.orchestrateur' };
const DESIGNE_DE = { representant: '--client', orchestrateur: '--nom' };

/** Un payload de pack, dont le gabarit porte le métier donné. */
function payload(role, metier = METIER_DU_PACK) {
  const root = tmp('smtk-fraich-payload-');
  writeFileSync(join(root, 'pack.json'), JSON.stringify({
    name: 'fixture-pack', version: '9.9.9', modules: { core: { default: true, paths: ['.claude/'] } },
  }));
  const gabarit = join(root, '.claude', 'templates', GABARIT_DE[role]);
  mkdirSync(gabarit, { recursive: true });
  writeFileSync(join(gabarit, 'CLAUDE.md'), metier);
  writeFileSync(join(gabarit, 'CONTEXTE.md'), CONTEXTE);
  return root;
}

/** Un dépôt où un lieu est DÉJÀ posé — c'est le seul cas que cette commande traite. */
function depotAvecLieu(role, nom = 'acme') {
  const repo = tmp('smtk-fraich-depot-');
  const lieu = join(repo, DOSSIER_DE[role], nom);
  mkdirSync(lieu, { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), METIER_DU_LIEU);
  writeFileSync(join(lieu, 'CONTEXTE.md'), CONTEXTE);
  return { repo, lieu };
}

const majDe = (role, nom, source, target, extra = []) =>
  run([`${role}-update`, DESIGNE_DE[role], nom, '--source', source, '--target', target, ...extra]);

// ═════════════════════════════ 1. CE QU'ELLE ATTRAPE — et le lieu n'est pas touché

test('refus : le gabarit servi diverge du pack du poste — LE LIEU N’EST PAS TOUCHÉ (prouvé par le disque)', async () => {
  for (const role of ['representant', 'orchestrateur']) {
    // Le poste est conforme à UN pack ; la commande sert un AUTRE gabarit. C'est très
    // exactement la situation des six dépôts du parc, et celle d'un `cli/payload` périmé.
    alignerLePosteSur(payload(role, METIER_DU_PACK));
    const perime = payload(role, '# Tu es le pilote d’un chantier.\n\nUn métier d’une autre époque.\n');
    const { repo, lieu } = depotAvecLieu(role);

    const avant = readFileSync(join(lieu, 'CLAUDE.md'), 'utf8');
    const empreinteAvant = readdirSync(lieu).sort().join(',');

    const code = await majDe(role, 'acme', perime, repo);

    assert.notEqual(code, 0, `${role} : la mise à jour a abouti sur un gabarit divergent`);
    assert.equal(
      readFileSync(join(lieu, 'CLAUDE.md'), 'utf8'), avant,
      `${role} : le métier du lieu a été remplacé par un gabarit divergent — le geste qui répare a abîmé`,
    );
    assert.equal(readdirSync(lieu).sort().join(','), empreinteAvant, `${role} : la mise à jour refusée a laissé des fichiers`);
    // Et surtout : aucune sauvegarde. Un `.somtech.bak` prouverait qu'on a commencé à écrire.
    assert.ok(
      !readdirSync(lieu).some((f) => f.includes('.somtech.bak')),
      `${role} : une sauvegarde a été déposée — la convergence avait donc commencé avant le refus`,
    );
  }
});

test('le refus PORTE LES DEUX EMPREINTES et dit que le lieu n’a pas bougé', async () => {
  alignerLePosteSur(payload('orchestrateur'));
  const perime = payload('orchestrateur', '# ailleurs\n');
  const { repo, lieu } = depotAvecLieu('orchestrateur', 'd-1');

  const erreurs = [];
  const avant = console.error;
  console.error = (...a) => erreurs.push(a.join(' '));
  try {
    await majDe('orchestrateur', 'd-1', perime, repo);
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

test('un pack CONFORME converge comme avant — la garde n’a rien changé au cas normal', async () => {
  for (const role of ['representant', 'orchestrateur']) {
    const p = payload(role);
    alignerLePosteSur(p);
    const { repo, lieu } = depotAvecLieu(role);

    const code = await majDe(role, 'acme', p, repo);

    assert.equal(code, 0, `${role} : une convergence légitime a été refusée — c’est un faux refus`);
    assert.equal(readFileSync(join(lieu, 'CLAUDE.md'), 'utf8'), METIER_DU_PACK, `${role} : le métier n’a pas convergé`);
    assert.equal(readFileSync(join(lieu, 'CONTEXTE.md'), 'utf8'), CONTEXTE, `${role} : CONTEXTE.md a été touché (RA-REL-014)`);
  }
});

test('RÉFÉRENCE INTROUVABLE : la mise à jour PROCÈDE, et le dit — jamais un refus', async () => {
  unPosteSansPack();
  const perime = payload('representant', '# un métier quelconque\n');
  const { repo, lieu } = depotAvecLieu('representant');

  const lignes = [];
  const avant = console.log;
  console.log = (...a) => lignes.push(a.join(' '));
  let code;
  try {
    code = await majDe('representant', 'acme', perime, repo);
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

test('LE DÉPÔT-SOURCE DU PACK n’est pas comparé à lui-même — et la commande le dit', async () => {
  alignerLePosteSur(payload('orchestrateur'));
  const enTravail = payload('orchestrateur', '# un métier en cours de réécriture\n');
  const { repo, lieu } = depotAvecLieu('orchestrateur', 'd-1');
  writeFileSync(join(repo, 'pack.json'), '{"name":"somtech-pack"}');

  const lignes = [];
  const avant = console.log;
  console.log = (...a) => lignes.push(a.join(' '));
  let code;
  try {
    code = await majDe('orchestrateur', 'd-1', enTravail, repo);
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
  alignerLePosteSur(payload('orchestrateur'));
  const perime = payload('orchestrateur', '# ailleurs\n');
  const { repo, lieu } = depotAvecLieu('orchestrateur', 'd-1');

  const code = await majDe('orchestrateur', 'd-1', perime, repo, ['--dry-run']);

  assert.notEqual(code, 0, '--dry-run a rendu un plan de convergence vers un gabarit divergent');
  assert.equal(readFileSync(join(lieu, 'CLAUDE.md'), 'utf8'), METIER_DU_LIEU);
});

test('un lieu ABSENT reste un lieu absent — la fraîcheur ne coiffe pas ce refus-là', async () => {
  // Deux causes, deux gestes : « ce lieu n'a jamais été posé » n'envoie pas mettre un pack à
  // jour. Confondre les deux enverrait réparer ce qui n'est pas cassé.
  alignerLePosteSur(payload('representant'));
  const perime = payload('representant', '# ailleurs\n');
  const repo = tmp('smtk-fraich-vide-');

  const erreurs = [];
  const avant = console.error;
  console.error = (...a) => erreurs.push(a.join(' '));
  try {
    await majDe('representant', 'acme', perime, repo);
  } finally {
    console.error = avant;
  }

  assert.match(erreurs.join('\n'), /n’a jamais été|n'a jamais été/, 'le refus rendu n’est pas celui du lieu absent');
  assert.equal(existsSync(join(repo, '.gestionnaire', 'acme')), false, 'un lieu a été créé par une commande qui n’en pose aucun');
});
