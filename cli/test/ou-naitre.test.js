// Où un agent peut-il naître — et la garde qui empêche la réponse de basculer sur l'index git.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CES TESTS DÉFENDENT (T-20260818-0043, critère 3)
//
// La commande `agent ou-naitre` EXPOSE `etatSource`, elle ne la réimplémente pas. Deux choses
// peuvent donc casser, et ce sont les deux seules qui comptent :
//
//   ① Qu'on finisse par écrire une DEUXIÈME SONDE — une détection « équivalente » qui
//      divergerait en silence de celle que la pose consulte. Gardé par un test d'identité :
//      la sonde de production DOIT être l'objet fonction `etatSource` de `lieu-agent.js`.
//
//   ② Que la mesure bascule sur l'INDEX GIT au lieu du DISQUE. Mesuré le 2026-08-20 :
//      `git ls-files` rend 0 gabarit chez les dépôts qui ont REÇU le pack — y compris chez
//      les quatre qui fonctionnent — et 4 chez la SOURCE, où ils sont du code versionné.
//      Un recensement fondé sur git rendrait « 15 en panne » au lieu de « 11 » : faux, et faux
//      seulement sur les dépôts qui marchent, donc invisible.
//
// ⚠️ CE QUI N'EST PAS TESTÉ ICI, ET POURQUOI : le recensement RÉEL de ce poste (4 servis / 11
// non). C'est la vérité terrain qui a servi d'oracle, mais elle dépend de la machine — en CI
// elle rendrait 0 sur 0. Un test qui l'affirmerait mesurerait le poste, pas le code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import {
  recenserDepots,
  sondeParDefaut,
  cibles,
  depotsSousRacine,
  estUnDepot,
  versionInstallee,
  cheminsParDefaut,
  rendreTexte,
  AIDE_OU_NAITRE,
} from '../src/commands/ou-naitre.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

/** Les quatre gabarits, en chemins relatifs — dont un qui vit un niveau plus bas. */
const GABARITS = ['CLAUDE.md', 'CONTEXTE.md', '.mcp.json', join('.claude', 'settings.json')];
const GABARITS_DIR = join('.claude', 'templates', 'orchestrateur');

let temporaires = [];
function tempo() {
  const d = mkdtempSync(join(tmpdir(), 'ou-naitre-'));
  temporaires.push(d);
  return d;
}
test.after(() => {
  for (const d of temporaires) rmSync(d, { recursive: true, force: true });
  temporaires = [];
});

/** Un dépôt de fixture : pack installé, gabarits posés sur le DISQUE, git vierge. */
function poserDepot(racine, nom, { version = '1.48.0', gabarits = GABARITS, git = false } = {}) {
  const depot = join(racine, nom);
  mkdirSync(join(depot, '.somtech-pack'), { recursive: true });
  writeFileSync(join(depot, '.somtech-pack', 'version.json'), JSON.stringify({ version }) + '\n');
  for (const rel of gabarits) {
    const cible = join(depot, GABARITS_DIR, rel);
    mkdirSync(dirname(cible), { recursive: true });
    writeFileSync(cible, `# ${rel}\n`);
  }
  if (git) {
    execFileSync('git', ['init', '-q'], { cwd: depot });
    // ⚠️ RIEN N'EST AJOUTÉ À L'INDEX, ET C'EST TOUT LE POINT DE LA FIXTURE.
    // C'est l'état réel mesuré chez les dépôts qui ont REÇU le pack : l'installation dépose
    // les gabarits sans les faire suivre par le git du client.
  }
  return depot;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// ① LA SONDE EST CELLE DE LA POSE — pas une copie, pas une équivalente
// ─────────────────────────────────────────────────────────────────────────────────────────

test('la sonde de production EST `etatSource` de lieu-agent.js — pas une deuxième sonde', async () => {
  const { etatSource } = await import(join(REPO, 'ligne-directe', 'src', 'lieu-agent.js'));
  const sonde = await sondeParDefaut();
  assert.equal(
    sonde,
    etatSource,
    'la commande doit APPELER etatSource. Toute autre fonction ici est une deuxième sonde sur ' +
      'le même état — elle divergera en silence de celle que la pose consulte pour refuser.'
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ② LE DISQUE, JAMAIS L'INDEX GIT — le test central, et sa contre-mesure
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * La sonde qu'on NE DOIT PAS avoir : celle qui interroge l'index git.
 * Elle n'existe que pour la contre-mesure — elle prouve que la fixture discrimine.
 */
function sondeParIndexGit(depot, role) {
  const source = join(depot, '.claude', 'templates', role);
  const presents = GABARITS.filter((f) => {
    try {
      const rel = join('.claude', 'templates', role, f);
      return execFileSync('git', ['ls-files', '--', rel], { cwd: depot, encoding: 'utf8' }).trim() !== '';
    } catch {
      return false;
    }
  });
  const manquants = GABARITS.filter((f) => !presents.includes(f));
  return { source, complete: manquants.length === 0, presents, manquants };
}

test('un dépôt dont git ne suit AUCUN gabarit peut quand même recevoir un agent', async () => {
  const racine = tempo();
  const depot = poserDepot(racine, 'receveur', { git: true });

  // Prémisse de la fixture, vérifiée et non supposée : git n'en suit aucun.
  const suivis = execFileSync('git', ['ls-files'], { cwd: depot, encoding: 'utf8' }).trim();
  assert.equal(suivis, '', 'la fixture doit reproduire l\'état mesuré : index git vide');

  const [ligne] = await recenserDepots([depot]);
  assert.equal(
    ligne.peutRecevoir,
    true,
    'la pose lit le DISQUE : un dépôt dont git ne suit rien accepte quand même la pose. ' +
      'Un recensement qui répondrait non ici déclarerait en panne les dépôts qui marchent.'
  );
  assert.deepEqual(ligne.manquants, [], 'rien ne manque sur le disque');
});

test('CONTRE-MESURE — la même fixture, sondée par l\'index git, BASCULE au faux', async () => {
  // ⚠️ SANS CE TEST, LE PRÉCÉDENT NE PROUVE RIEN. Il pourrait rester vert parce que la fixture
  // ne distingue pas le disque de l'index — auquel cas faire basculer la production sur
  // `git ls-files` ne le ferait pas rougir. Ici on MUTE la sonde et on EXIGE le verdict inverse.
  const racine = tempo();
  const depot = poserDepot(racine, 'receveur', { git: true });

  const [parLeDisque] = await recenserDepots([depot]);
  const [parGit] = await recenserDepots([depot], { sonde: sondeParIndexGit });

  assert.equal(parLeDisque.peutRecevoir, true, 'référence : le disque dit oui');
  assert.equal(
    parGit.peutRecevoir,
    false,
    'la fixture DOIT discriminer : sondée par l\'index git elle doit dire non. ' +
      'Si elle disait oui, le test du disque serait vert pour une mauvaise raison.'
  );
  assert.deepEqual(
    parGit.manquants,
    GABARITS,
    'et la sonde git déclarerait manquants les quatre fichiers qui sont pourtant là'
  );
});

test('CONTRE-MESURE — sur la SOURCE, l\'index git ne discrimine pas, et c\'est pourquoi il trompe', () => {
  // Le fait mesuré des deux côtés : `git ls-files` rend 4 chez la source (les gabarits y sont
  // du code versionné) et 0 chez les receveurs. C'est ce qui rend l'erreur invisible : celui
  // qui l'écrit la vérifie chez lui — où elle donne raison.
  const parGit = sondeParIndexGit(REPO, 'orchestrateur');
  assert.equal(
    parGit.complete,
    true,
    'chez la source, une sonde git répond juste — un auteur qui ne teste que chez lui ne voit rien'
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ③ DESCENDRE DANS LES SOUS-DOSSIERS
// ─────────────────────────────────────────────────────────────────────────────────────────

test('le gabarit d\'un niveau plus bas compte — et il est NOMMÉ quand il manque', async () => {
  const racine = tempo();
  const sansSettings = poserDepot(racine, 'sans-settings', {
    gabarits: ['CLAUDE.md', 'CONTEXTE.md', '.mcp.json'],
  });
  const [ligne] = await recenserDepots([sansSettings]);
  assert.equal(ligne.peutRecevoir, false, '3 gabarits sur 4 ne suffisent pas');
  assert.deepEqual(
    ligne.manquants,
    [join('.claude', 'settings.json')],
    'le fichier manquant doit être NOMMÉ, avec son chemin — un « ls » à plat, qui ne descend pas, ' +
      'aurait déclaré incomplets les dépôts complets (défaut mesuré le 2026-08-20)'
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ④ QUELS DÉPÔTS ON EXAMINE
// ─────────────────────────────────────────────────────────────────────────────────────────

test('sous une racine, on examine les dépôts qui ont REÇU le pack — pas tous les dossiers', () => {
  const racine = tempo();
  poserDepot(racine, 'servi');
  mkdirSync(join(racine, 'depot-sans-pack', '.git'), { recursive: true });
  mkdirSync(join(racine, 'dossier-quelconque'), { recursive: true });
  writeFileSync(join(racine, 'un-fichier.txt'), 'x');

  const trouves = depotsSousRacine(racine).map((d) => d.split('/').pop());
  assert.deepEqual(
    trouves,
    ['servi'],
    'un dépôt qui n\'a jamais reçu le pack n\'est pas « en panne » : le compter noierait les ' +
      'vrais écarts sous des dizaines de faux'
  );
});

test('un dépôt nommé explicitement n\'est jamais balayé comme une racine', () => {
  const racine = tempo();
  const depot = poserDepot(racine, 'parent');
  poserDepot(depot, 'enfant');
  assert.equal(estUnDepot(depot), true);
  assert.deepEqual(
    cibles([depot]),
    [depot],
    'rendre l\'état des sous-dossiers serait une réponse bien formée à une autre question'
  );
});

test('une racine inexistante ne fait pas tomber le recensement', () => {
  assert.deepEqual(depotsSousRacine(join(tempo(), 'nulle-part')), []);
  assert.deepEqual(cibles([join(tempo(), 'nulle-part')]), []);
});

test('un même dépôt nommé deux fois n\'est examiné qu\'une fois', () => {
  const racine = tempo();
  const depot = poserDepot(racine, 'servi');
  assert.deepEqual(cibles([racine, depot]), [depot]);
});

test('sans chemin : $SOMTECH_DEPOTS s\'il est posé, sinon le dossier courant', () => {
  assert.deepEqual(cheminsParDefaut({ SOMTECH_DEPOTS: '/a:/b' }, '/cwd'), ['/a', '/b']);
  assert.deepEqual(cheminsParDefaut({ SOMTECH_DEPOTS: '  ' }, '/cwd'), ['/cwd']);
  assert.deepEqual(cheminsParDefaut({}, '/cwd'), ['/cwd']);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ⑤ CE QUE LA COMMANDE REND
// ─────────────────────────────────────────────────────────────────────────────────────────

test('la version installée est rendue — et illisible vaut absent, jamais deviné', () => {
  const racine = tempo();
  const servi = poserDepot(racine, 'servi', { version: '1.49.1' });
  assert.equal(versionInstallee(servi), '1.49.1');

  const casse = join(racine, 'casse');
  mkdirSync(join(casse, '.somtech-pack'), { recursive: true });
  writeFileSync(join(casse, '.somtech-pack', 'version.json'), '{ pas du json');
  assert.equal(versionInstallee(casse), null, 'on n\'établit rien d\'un fichier qu\'on n\'a pas pu lire');

  assert.equal(versionInstallee(join(racine, 'inexistant')), null);

  // ⚠️ JSON VALIDE MAIS MUET SUR LA VERSION — le cas que le test précédent ne couvrait pas, et qui
  // laissait survivre une mutation (`?? null` → une valeur inventée). Trouvé par la contre-mesure
  // de la passe de fond. Un fichier lisible dont le champ manque n'établit pas plus de version
  // qu'un fichier illisible : c'est « absent », jamais une chaîne devinée qu'on afficherait.
  const muet = join(racine, 'muet');
  mkdirSync(join(muet, '.somtech-pack'), { recursive: true });
  writeFileSync(join(muet, '.somtech-pack', 'version.json'), JSON.stringify({ pas_la_version: 'x' }));
  assert.equal(
    versionInstallee(muet),
    null,
    'un JSON valide sans le champ « version » vaut absent — jamais une valeur devinée'
  );
});

test('le rendu nomme les dépôts, leur verdict, et les fichiers qui manquent', async () => {
  const racine = tempo();
  poserDepot(racine, 'servi', { version: '1.48.0' });
  poserDepot(racine, 'en-retard', { version: '1.20.0', gabarits: ['CLAUDE.md'] });

  const lignes = await recenserDepots(cibles([racine]));
  const texte = rendreTexte(lignes, 'orchestrateur');

  assert.match(texte, /1 sur 2/, 'le compte doit être rendu');
  assert.match(texte, /servi/, 'les dépôts sont NOMMÉS, pas comptés');
  assert.match(texte, /en-retard/);
  assert.match(texte, /1\.20\.0/, 'la version doit apparaître');
  assert.match(texte, /CONTEXTE\.md/, 'les fichiers manquants doivent être nommés');
  assert.match(texte, /\.claude\/settings\.json/, 'y compris celui d\'un niveau plus bas');
});

test('un dépôt qui n\'a pas reçu le pack est examinable, et sa version est dite absente', async () => {
  const racine = tempo();
  const nu = join(racine, 'jamais-servi');
  mkdirSync(join(nu, '.git'), { recursive: true });
  const lignes = await recenserDepots(cibles([nu]));
  assert.equal(lignes.length, 1, 'nommé explicitement, il est examiné');
  assert.equal(lignes[0].peutRecevoir, false);
  assert.equal(lignes[0].version, null);
  assert.match(rendreTexte(lignes, 'orchestrateur'), /pack non installé/);
});

test('rien à examiner se dit, et dit par où passer', () => {
  assert.match(rendreTexte([], 'orchestrateur'), /Aucun dépôt/);
  assert.match(rendreTexte([], 'orchestrateur'), /SOMTECH_DEPOTS/);
});

test('le rôle traverse jusqu\'à la sonde — un rôle inconnu ne rend pas un faux « oui »', async () => {
  const racine = tempo();
  const depot = poserDepot(racine, 'servi');
  const vus = [];
  await recenserDepots([depot], { role: 'representant', sonde: (d, r) => { vus.push(r); return { source: '', complete: false, presents: [], manquants: ['x'] }; } });
  assert.deepEqual(vus, ['representant'], 'le rôle demandé doit être celui qu\'on sonde');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ⑥ LA PORTE ELLE-MÊME — argv, dispatch, code de sortie
//
// ⚠️ CETTE SECTION EXISTE PARCE QU'ELLE MANQUAIT, ET LA PASSE DE FOND L'A MESURÉ.
// Le premier banc de mutation rendait « 7 points, 7 rouges, zéro survivante » — vrai, mais
// il ne mutait QUE le moteur. La revue a muté la PORTE et trouvé QUATRE SURVIVANTS :
//   • `--role` silencieusement ignoré ;
//   • `--json` transformé en geste vide ;
//   • le code de sortie forcé à 1 ;
//   • le dispatch `agent ou-naitre` débranché (`sous === 'ou-naitre-XXX'`).
// Les quatre passaient sans un seul rouge : le moteur et le dispatch étaient justes SÉPARÉMENT,
// et rien ne vérifiait qu'ils se parlaient. « Zéro survivante » ne couvre jamais que ce qui
// était gardé — c'est le dénominateur, pas le résultat, qui trompait.
import { cmdOuNaitre } from '../src/commands/ou-naitre.js';
import { cmdAgent } from '../src/commands/agent.js';

/** Capture ce que la commande dit, pour l'interroger. */
function silence() {
  const dits = [];
  const log = console.log;
  const err = console.error;
  console.log = (...a) => dits.push(a.join(' '));
  console.error = (...a) => dits.push(a.join(' '));
  return { dits, rendre: () => { console.log = log; console.error = err; } };
}

test('porte : --role traverse jusqu\'au rendu — pas seulement jusqu\'au moteur', async () => {
  const racine = tempo();
  poserDepot(racine, 'servi');
  const s = silence();
  try {
    assert.equal(await cmdOuNaitre([racine, '--role', 'representant']), 0);
  } finally { s.rendre(); }
  const texte = s.dits.join('\n');
  assert.match(texte, /representant/, 'le rôle demandé doit apparaître dans le rendu');
  assert.doesNotMatch(
    texte,
    /Peut recevoir un orchestrateur/,
    'un --role ignoré rendrait le rôle par défaut sans le dire — mutant survivant relevé en revue'
  );
});

test('porte : --json rend du JSON analysable, pas le tableau', async () => {
  const racine = tempo();
  poserDepot(racine, 'servi', { version: '1.48.0' });
  const s = silence();
  try {
    assert.equal(await cmdOuNaitre([racine, '--json']), 0);
  } finally { s.rendre(); }
  const objet = JSON.parse(s.dits.join('\n'));
  assert.equal(objet.role, 'orchestrateur');
  assert.equal(objet.depots.length, 1);
  assert.equal(objet.depots[0].peutRecevoir, true);
  assert.equal(objet.depots[0].version, '1.48.0');
});

test('porte : un dépôt qui refuse ne fait PAS échouer la commande', async () => {
  const racine = tempo();
  poserDepot(racine, 'en-retard', { gabarits: ['CLAUDE.md'] });
  const s = silence();
  let code;
  try { code = await cmdOuNaitre([racine]); } finally { s.rendre(); }
  assert.equal(
    code,
    0,
    'la commande RÉPOND à une question, elle ne constate pas un échec. Un code non nul ferait ' +
      'passer « des dépôts non servis » — fait connu et arbitré — pour une panne de l\'outil.'
  );
  assert.match(s.dits.join('\n'), /refuseraient la pose/);
});

test('porte : une option inconnue est refusée, et le refus se distingue d\'un rendu', async () => {
  const s = silence();
  let code;
  try { code = await cmdOuNaitre(['--nawak']); } finally { s.rendre(); }
  assert.equal(code, 1, 'une option inconnue doit échouer, sinon une faute de frappe passe pour une mesure');
  assert.match(s.dits.join('\n'), /Option inconnue/);
});

test('porte : --role sans valeur est refusé plutôt que deviné', async () => {
  const s = silence();
  let code;
  try { code = await cmdOuNaitre(['--role']); } finally { s.rendre(); }
  assert.equal(code, 1);
  assert.match(s.dits.join('\n'), /--role attend une valeur/);
});

test('porte : --help rend l\'aide et réussit', async () => {
  const s = silence();
  let code;
  try { code = await cmdOuNaitre(['--help']); } finally { s.rendre(); }
  assert.equal(code, 0);
  assert.match(s.dits.join('\n'), /ou-naitre/);
  assert.match(s.dits.join('\n'), /etatSource/, 'l\'aide doit dire d\'où vient la mesure');
});

// ⚠️ L'AIDE PROMETTAIT `-h`, ET RIEN NE L'APPELAIT — survivant trouvé par la contre-mesure de la
// passe de fond. Sans ce test, retirer l'alias faisait répondre « ✗ Option inconnue : -h » (code 1)
// à quelqu'un qui suivait l'aide du texte même de la commande.
test('porte : -h fait la même chose que --help — l\'aide le promet', async () => {
  const s = silence();
  let code;
  try { code = await cmdOuNaitre(['-h']); } finally { s.rendre(); }
  assert.equal(code, 0, 'un alias que l\'aide documente doit fonctionner');
  assert.match(s.dits.join('\n'), /ou-naitre/);
  assert.match(AIDE_OU_NAITRE, /-h/, 'et l\'aide doit continuer de le promettre');
});

test('porte : un rôle inconnu LÈVE — il ne rend pas un faux « aucun dépôt ne peut »', async () => {
  const racine = tempo();
  poserDepot(racine, 'servi');
  const s = silence();
  try {
    await assert.rejects(
      () => cmdOuNaitre([racine, '--role', 'nawak']),
      /nawak|rôle|role/i,
      'répondre « non » pour un rôle qui n\'existe pas serait une réponse bien formée à rien'
    );
  } finally { s.rendre(); }
});

// ⚠️ LA JOINTURE — deux étages justes séparément dont la ligne qui les relie n'était pas gardée.
test('dispatch : `agent ou-naitre` atteint réellement la commande', async () => {
  const racine = tempo();
  poserDepot(racine, 'servi');
  const s = silence();
  let code;
  try { code = await cmdAgent(['ou-naitre', racine]); } finally { s.rendre(); }
  assert.equal(code, 0);
  assert.match(
    s.dits.join('\n'),
    /Peut recevoir un orchestrateur/,
    'débrancher le dispatch doit rougir ici — sinon la sous-commande est injoignable en silence'
  );
  assert.doesNotMatch(s.dits.join('\n'), /Sous-commande inconnue/);
});

test('dispatch : `agent nawak` reste refusé, et `naitre` n\'est pas capturé par erreur', async () => {
  const s = silence();
  let code;
  try { code = await cmdAgent(['nawak']); } finally { s.rendre(); }
  assert.equal(code, 1);
  assert.match(s.dits.join('\n'), /Sous-commande inconnue/);
});

test('dispatch : l\'aide de `agent` annonce la sous-commande — sinon personne ne la trouve', async () => {
  const s = silence();
  try { await cmdAgent(['--help']); } finally { s.rendre(); }
  assert.match(
    s.dits.join('\n'),
    /ou-naitre/,
    'une commande que l\'aide ne nomme pas ne « rend pas l\'écart visible sans qu\'on le cherche »'
  );
});

test('un lien symbolique vers un dépôt ne le compte pas deux fois', () => {
  const racine = tempo();
  const depot = poserDepot(racine, 'servi');
  const lien = join(racine, 'alias');
  symlinkSync(depot, lien, 'dir');
  assert.equal(
    cibles([depot, lien]).length,
    1,
    'compter deux fois le même dépôt rendrait « 16 sur 15 » et ferait douter du compte entier'
  );
});
