// Installation au poste des modules de portée « poste ».
//
// Un module de portée poste est un OUTIL : il ne va pas dans les projets (cf.
// modules.test.js), il s'installe une fois par machine. Le canvas est le premier :
// la commande `/canvas` cherche son serveur dans `~/.somtech/herdr-plugins/excalidraw`,
// un emplacement que personne ne remplissait — la commande était distribuée partout
// et ne trouvait son serveur nulle part.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { installPosteModules } from '../src/posteonly.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const tmp = (p) => mkdtempSync(join(tmpdir(), p));

test('poste : le serveur du canvas est déposé là où la commande le cherche', () => {
  const toolsDir = tmp('smtk-poste-');
  const r = installPosteModules({ payloadRoot: REPO, toolsDir });

  for (const f of [
    'herdr-plugins/excalidraw/server/bin.js',
    'herdr-plugins/excalidraw/server/server.js',
    'herdr-plugins/excalidraw/scripts/open.sh',
    'herdr-plugins/excalidraw/herdr-plugin.toml',
  ]) {
    assert.ok(existsSync(join(toolsDir, f)), `${f} absent — /canvas ne trouvera pas son serveur`);
  }
  assert.ok(r.modules.includes('canvas'), 'le module canvas doit être rapporté comme installé');
  assert.ok(r.created.length > 0);
});

test('poste : le script d\'ouverture reste exécutable', () => {
  const toolsDir = tmp('smtk-poste-');
  installPosteModules({ payloadRoot: REPO, toolsDir });
  const { mode } = statSync(join(toolsDir, 'herdr-plugins/excalidraw/scripts/open.sh'));
  assert.ok(mode & 0o111, 'open.sh doit rester exécutable, sinon la commande ne peut pas le lancer');
});

test('poste : ce qui est nécessaire au démarrage voyage jusqu\'au poste', () => {
  const toolsDir = tmp('smtk-poste-');
  installPosteModules({ payloadRoot: REPO, toolsDir });
  // Ces deux-là ne sont pas versionnés : ils viennent de la construction (dépôt local)
  // ou du paquet publié (poste réel). Quand ils sont là, ils doivent suivre — sinon le
  // serveur démarre sans ses dépendances, ou sert une page qui n'existe pas.
  for (const [src, why] of [
    ['herdr-plugins/excalidraw/node_modules', "les dépendances d'exécution du serveur"],
    ['herdr-plugins/excalidraw/web/dist', 'la page construite'],
  ]) {
    if (existsSync(join(REPO, src))) {
      assert.ok(existsSync(join(toolsDir, src)), `${why} présente à la source mais absente du poste`);
    }
  }
});

test('poste : les dépendances de construction ne sont pas installées', () => {
  // Le filtre ne doit pas s'appliquer qu'à la fabrication du paquet : installer depuis
  // le dépôt (cas du développeur) doit donner le même résultat qu'installer depuis le
  // paquet publié. Sinon on copie 273 Mo de dépendances de construction dans ~/.somtech.
  const toolsDir = tmp('smtk-poste-');
  const r = installPosteModules({ payloadRoot: REPO, toolsDir });

  assert.ok(
    !existsSync(join(toolsDir, 'herdr-plugins/excalidraw/web/node_modules')),
    'les dépendances de construction de la page n\'ont rien à faire sur le poste'
  );
  assert.ok(!existsSync(join(toolsDir, 'herdr-plugins/excalidraw/web/src')), 'sources de la page non installées');
  assert.ok(!existsSync(join(toolsDir, 'herdr-plugins/excalidraw/tests')), 'tests du plugin non installés');
  assert.ok(
    r.created.length < 1000,
    `installation démesurée : ${r.created.length} fichiers — le filtre du paquet n'est pas appliqué`
  );
});

test('poste : un fichier personnel de l\'utilisateur n\'est jamais touché', () => {
  const toolsDir = tmp('smtk-poste-');
  mkdirSync(join(toolsDir, 'herdr-plugins', 'mon-plugin'), { recursive: true });
  writeFileSync(join(toolsDir, 'herdr-plugins', 'mon-plugin', 'note.md'), 'PERSO');
  installPosteModules({ payloadRoot: REPO, toolsDir });
  assert.equal(
    readFileSync(join(toolsDir, 'herdr-plugins', 'mon-plugin', 'note.md'), 'utf8'),
    'PERSO',
    'un plugin perso hors-pack doit rester intact'
  );
});

test('poste : dry-run n\'écrit rien, ré-exécution idempotente', () => {
  const toolsDir = tmp('smtk-poste-');
  const dry = installPosteModules({ payloadRoot: REPO, toolsDir, dryRun: true });
  assert.ok(!existsSync(join(toolsDir, 'herdr-plugins')), 'dry-run ne doit rien copier');
  assert.ok(dry.created.length > 0, 'le rapport liste quand même ce qui SERAIT créé');

  installPosteModules({ payloadRoot: REPO, toolsDir });
  const r2 = installPosteModules({ payloadRoot: REPO, toolsDir });
  assert.equal(r2.created.length, 0, '2e run : rien de neuf');
  assert.ok(r2.unchanged.length > 0, '2e run : tout inchangé');
});

test('poste : un canvas installé sans sa page construite le dit', () => {
  // Cas du développeur qui installe depuis un clone jamais construit : `web/dist` et
  // les dépendances du serveur sont gitignorés. Sans avertissement, `setup` se déclare
  // réussi et `/canvas` échoue plus tard sur une trace Node dans un fichier de log —
  // exactement le travers que ce chantier existe pour supprimer.
  const fake = tmp('smtk-pl-');
  mkdirSync(join(fake, 'herdr-plugins', 'excalidraw', 'server'), { recursive: true });
  writeFileSync(join(fake, 'herdr-plugins', 'excalidraw', 'server', 'bin.js'), '// serveur\n');
  writeFileSync(join(fake, 'pack.json'), JSON.stringify({
    modules: { canvas: { default: false, scope: 'poste', paths: ['herdr-plugins/'] } },
  }));

  const r = installPosteModules({ payloadRoot: fake, toolsDir: tmp('smtk-poste-') });
  assert.ok(r.warnings.length > 0, 'une installation incomplète doit être signalée');
  assert.match(r.warnings.join(' '), /canvas/, "l'avertissement doit nommer le module concerné");
  assert.match(r.warnings.join(' '), /build\.sh|paquet/, 'il doit dire quoi faire');
});

test('poste : le rapport ne liste que les modules réellement installés', () => {
  // Les trois miroirs aînés dérivent leur liste de ce qui a été traité, pas du manifeste.
  const fake = tmp('smtk-pl-');
  writeFileSync(join(fake, 'pack.json'), JSON.stringify({
    modules: { canvas: { default: false, scope: 'poste', paths: ['herdr-plugins/'] } },
  }));
  const r = installPosteModules({ payloadRoot: fake, toolsDir: tmp('smtk-poste-') });
  assert.deepEqual(r.modules, [], 'un module déclaré mais absent du payload ne doit pas être annoncé installé');
});

test('poste : un manifeste illisible ne casse pas la configuration du poste', () => {
  const fake = tmp('smtk-pl-');
  writeFileSync(join(fake, 'pack.json'), '{ ceci n est pas du JSON');
  const r = installPosteModules({ payloadRoot: fake, toolsDir: tmp('smtk-poste-') });
  assert.deepEqual(r.modules, [], 'on dégrade proprement au lieu d\'interrompre setup en plein milieu');
});

test('poste : un pack sans module de portée poste ne fait rien, sans erreur', () => {
  const fake = tmp('smtk-pl-');
  writeFileSync(join(fake, 'pack.json'), JSON.stringify({ modules: { core: { default: true, paths: ['.claude/'] } } }));
  const r = installPosteModules({ payloadRoot: fake, toolsDir: tmp('smtk-poste-') });
  assert.deepEqual(r.modules, []);
  assert.deepEqual(r.created, []);
});
