// ============================================================
// LE CHEMIN RÉEL — T-20260816-0020.
//
// POURQUOI CE FICHIER EXISTE, séparé du banc des fonctions.
//
// `version-poste.test.js` garde les CALCULS. Une revue de fond a montré qu'ils
// pouvaient tous être justes et **silencieusement contournés à l'endroit où on
// les appelle** : vider la route `case 'version'` de `cli.js`, inverser deux
// champs dans l'appel de `setup.js`, figer le registre à `null` — **aucune des
// quatre mutations ne faisait rougir quoi que ce soit**.
//
// *Un correctif parfait qui n'est jamais atteint ne corrige rien.* C'est la
// forme exacte qui a coûté un tour entier sur `T-20260815-0013`, où le bloc
// livré n'exécutait jamais son `source`.
//
// Ce banc-ci emprunte donc le chemin qu'un humain emprunte : `run([...])`.
// Le module d'entrée est surchargeable par SOMTECH_CLI_SRC, pour que le banc
// de mutation puisse jouer cette suite contre une COPIE mutée de `cli/src`.
// ============================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, utimesSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

const SRC_CLI = process.env.SOMTECH_CLI_SRC || join(REPO, 'cli', 'src', 'cli.js');
const SRC_CMD = process.env.SOMTECH_VERSION_CMD_SRC || join(REPO, 'cli', 'src', 'commands', 'version-poste-cmd.js');

const { run } = await import(pathToFileURL(SRC_CLI).href);
const { interrogerRegistre } = await import(pathToFileURL(SRC_CMD).href);

// Le vrai ~/.claude ne doit jamais être touché, même si un test oublie un drapeau.
process.env.HOME = mkdtempSync(join(tmpdir(), 'smtk-home-'));

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

/** Capture ce que la commande ÉCRIT — ce que l'humain lit est la moitié du livrable. */
async function capturer(argv) {
  const vrai = console.log;
  const lignes = [];
  console.log = (...a) => lignes.push(a.join(' '));
  try {
    const code = await run(argv);
    return { code, sortie: lignes.join('\n') };
  } finally {
    console.log = vrai;
  }
}

function poserMarqueur(dir, version) {
  mkdirSync(join(dir, '.somtech-pack'), { recursive: true });
  writeFileSync(join(dir, '.somtech-pack', 'version.json'), JSON.stringify({ version }));
}

test('CHEMIN RÉEL — `pack version` sur un poste VIERGE : le dit, rc=2, aucun numéro', async () => {
  const d = tmp('poste-vierge-');
  process.env.SOMTECH_PACK_REGISTRE = '9.9.9';
  try {
    const { code, sortie } = await capturer(['version', '--dest', d]);
    assert.equal(code, 2, 'rc=0 se lirait « tout va bien » par quiconque scripte');
    assert.match(sortie, /AUCUNE INSTALLATION POSTE/);
    assert.doesNotMatch(sortie, /installée sur ce poste : \d/);
  } finally { delete process.env.SOMTECH_PACK_REGISTRE; rmSync(d, { recursive: true, force: true }); }
});

test('CHEMIN RÉEL — `pack version` en retard : rend les DEUX moitiés, rc=1', async () => {
  const d = tmp('poste-retard-');
  poserMarqueur(d, '1.99.2');
  process.env.SOMTECH_PACK_REGISTRE = '1.100.0';
  try {
    const { code, sortie } = await capturer(['version', '--dest', d]);
    assert.equal(code, 1);
    assert.match(sortie, /1\.99\.2/, 'la version installée');
    assert.match(sortie, /1\.100\.0/, 'la version publiée');
    assert.match(sortie, /EN RETARD/, 'et l’écart entre les deux');
  } finally { delete process.env.SOMTECH_PACK_REGISTRE; rmSync(d, { recursive: true, force: true }); }
});

test('CHEMIN RÉEL — `pack version` à jour : rc=0', async () => {
  const d = tmp('poste-ajour-');
  poserMarqueur(d, '2.0.0');
  process.env.SOMTECH_PACK_REGISTRE = '2.0.0';
  try {
    const { code, sortie } = await capturer(['version', '--dest', d]);
    assert.equal(code, 0);
    assert.match(sortie, /À JOUR/);
  } finally { delete process.env.SOMTECH_PACK_REGISTRE; rmSync(d, { recursive: true, force: true }); }
});

test('CHEMIN RÉEL — registre injoignable : INDÉTERMINÉ, rc=3, jamais « à jour »', async () => {
  const d = tmp('poste-sansregistre-');
  poserMarqueur(d, '1.0.0');
  process.env.SOMTECH_PACK_REGISTRE = ''; // stub présent mais non-semver → « on n'a pas pu regarder »
  try {
    const { code, sortie } = await capturer(['version', '--dest', d]);
    assert.equal(code, 3);
    assert.match(sortie, /INDÉTERMIN/);
    assert.doesNotMatch(sortie, /À JOUR/);
  } finally { delete process.env.SOMTECH_PACK_REGISTRE; rmSync(d, { recursive: true, force: true }); }
});

test('CHEMIN RÉEL — les verrous périmés sont nommés dans la sortie de la commande', async () => {
  const d = tmp('poste-verrous-');
  poserMarqueur(d, '1.0.0');
  const lock = join(d, 'pack-update-antique.lock');
  mkdirSync(lock, { recursive: true });
  const vieux = Date.now() / 1000 - 86400 * 40;
  utimesSync(lock, vieux, vieux);
  process.env.SOMTECH_PACK_REGISTRE = '1.0.0';
  try {
    const { sortie } = await capturer(['version', '--dest', d]);
    assert.match(sortie, /pack-update-antique\.lock/);
    assert.match(sortie, /40 j/);
    assert.match(sortie, /setup --yes/);
  } finally { delete process.env.SOMTECH_PACK_REGISTRE; rmSync(d, { recursive: true, force: true }); }
});

test('CHEMIN RÉEL — `setup` ÉCRIT le marqueur, et il porte la version du PAQUET', async () => {
  const w = tmp('smtk-setup-');
  const dd = join(w, 'somtech');

  // ⚠️ LE CAS DOIT DISCRIMINER. Dans le dépôt, `cli/package.json` et `pack.json`
  // portent le MÊME numéro : inverser les deux champs y serait indiscernable, et
  // l'assertion ne prouverait rien. On fabrique donc un payload dont la version du
  // CONTENU diffère de celle du PAQUET — c'est la seule façon de faire rougir
  // l'inversion, et c'est exactement le vestige que le commentaire du code dénonce
  // (`VERSION` du dépôt à 1.64.0 pendant que le publié était à 1.75.0).
  const payload = join(w, 'payload');
  mkdirSync(payload, { recursive: true });
  const manifeste = JSON.parse(readFileSync(join(REPO, 'pack.json'), 'utf8'));
  manifeste.version = '0.0.42';
  writeFileSync(join(payload, 'pack.json'), JSON.stringify(manifeste, null, 2));

  const args = ['setup', '--source', payload, '--rc', join(w, 'zshrc'), '--skills-dir', join(w, 'sk'),
    '--workflows-dir', join(w, 'wf'), '--commands-dir', join(w, 'cmd'), '--dest', dd,
    '--settings', join(w, 'settings.json'), '--yes', '--no-version-hook', '--no-registre-hook',
    '--no-graphify', '--no-claude-swt', '--no-miroir'];
  try {
    const code = await run(args);
    assert.equal(code, 0);

    const marqueur = join(dd, '.somtech-pack', 'version.json');
    assert.ok(existsSync(marqueur), 'setup doit écrire le marqueur du poste — c’est la moitié qui manquait');
    const data = JSON.parse(readFileSync(marqueur, 'utf8'));

    const versionPaquet = JSON.parse(readFileSync(join(REPO, 'cli', 'package.json'), 'utf8')).version;
    assert.notEqual(versionPaquet, '0.0.42', 'SCÉNARIO INOPÉRANT : les deux versions doivent différer');
    assert.equal(data.version, versionPaquet,
      'le marqueur porte la version du PAQUET installé, jamais le vestige du dépôt');
    assert.equal(data.packContentVersion, '0.0.42',
      'et la version du CONTENU reste à sa place, en traçabilité');
    assert.equal(data.portee, 'poste');

    // Et la commande relit ce que setup vient d'écrire : l'aller-retour, par le chemin réel.
    process.env.SOMTECH_PACK_REGISTRE = versionPaquet;
    const { code: rc, sortie } = await capturer(['version', '--dest', dd]);
    assert.equal(rc, 0);
    assert.match(sortie, new RegExp(versionPaquet.replace(/\./g, '\\.')));
  } finally { delete process.env.SOMTECH_PACK_REGISTRE; rmSync(w, { recursive: true, force: true }); }
});

test('CHEMIN RÉEL — `setup` RAMASSE les verrous périmés et épargne les frais', async () => {
  const w = tmp('smtk-setup-verrous-');
  const dd = join(w, 'somtech');
  mkdirSync(dd, { recursive: true });
  const vieux = join(dd, 'pack-update-vieux.lock');
  const frais = join(dd, 'pack-update-frais.lock');
  mkdirSync(vieux); mkdirSync(frais);
  const t = Date.now() / 1000 - 86400 * 40;
  utimesSync(vieux, t, t);
  try {
    await run(['setup', '--source', REPO, '--rc', join(w, 'zshrc'), '--skills-dir', join(w, 'sk'),
      '--workflows-dir', join(w, 'wf'), '--commands-dir', join(w, 'cmd'), '--dest', dd,
      '--settings', join(w, 'settings.json'), '--yes', '--no-version-hook', '--no-registre-hook',
      '--no-graphify', '--no-claude-swt', '--no-miroir']);
    assert.equal(existsSync(vieux), false, 'le verrou périmé doit être ramassé');
    assert.equal(existsSync(frais), true, 'le verrou frais doit survivre — ramasser n’est pas vider');
  } finally { rmSync(w, { recursive: true, force: true }); }
});

test('interrogerRegistre — le CHEMIN PAR DÉFAUT est éprouvé, pas seulement la couture', () => {
  // ⚠️ Sans ce cas, la couture d'injection soustrairait le vrai appel à l'épreuve.
  let vu = null;
  const exec = (bin, argv) => { vu = { bin, argv }; return '1.100.0\n'; };
  assert.equal(interrogerRegistre({ exec }), '1.100.0');
  assert.equal(vu.bin, 'npm', 'c’est bien npm qui est interrogé');
  assert.ok(vu.argv.includes('view'));
  assert.ok(vu.argv.some((a) => a.startsWith('--registry=')), 'et sur le registre du pack');
});

test('interrogerRegistre — une sortie qui n’est pas un semver ne devient pas une version', () => {
  assert.equal(interrogerRegistre({ exec: () => 'npm WARN quelque chose\n' }), null);
  assert.equal(interrogerRegistre({ exec: () => '' }), null);
  assert.equal(interrogerRegistre({ exec: () => 'latest\n' }), null);
});

test('interrogerRegistre — un npm qui échoue rend null, et n’explose pas', () => {
  assert.equal(interrogerRegistre({ exec: () => { throw new Error('ENOENT'); } }), null);
});

test('interrogerRegistre — un stub PRÉSENT, même vide, ne tombe JAMAIS sur le chemin réel', () => {
  // ⚠️ LE GARDE-FOU DE LA COUTURE, et il ne se juge pas sur la valeur rendue.
  // Écrire `if (stub)` au lieu de `if (stub !== undefined)` rend la chaîne vide
  // *falsy* — le code part alors interroger le VRAI registre. Une assertion sur le
  // seul résultat ne le verrait pas : le `catch` générique avale l'exception et
  // rend `null` quand même. C'est l'APPEL qu'il faut mesurer, pas son retour.
  //
  // Sans ce cas, le banc tenait par un hasard d'environnement : le `$HOME` factice
  // prive `npm` de l'auth du poste, donc l'appel réel échouait *pour une autre
  // raison que celle voulue*. Sur un runner où l'auth passerait, le même test
  // deviendrait faux — un vert qui dépend de la machine n'est pas un vert.
  process.env.SOMTECH_PACK_REGISTRE = '';
  let appele = false;
  try {
    const r = interrogerRegistre({ exec: () => { appele = true; return '9.9.9'; } });
    assert.equal(appele, false, 'un stub présent — même vide — ne doit JAMAIS déclencher le chemin réel');
    assert.equal(r, null, 'et un stub non-semver ne devient pas une version');
  } finally { delete process.env.SOMTECH_PACK_REGISTRE; }
});

test('interrogerRegistre — stub ABSENT : le chemin réel EST emprunté', () => {
  // Le symétrique, sans lequel la garde ci-dessus pourrait être satisfaite en ne
  // prenant jamais le chemin réel du tout.
  delete process.env.SOMTECH_PACK_REGISTRE;
  let appele = false;
  const r = interrogerRegistre({ exec: () => { appele = true; return '3.2.1'; } });
  assert.equal(appele, true, 'sans stub, c’est le vrai appel qui décide');
  assert.equal(r, '3.2.1');
});
