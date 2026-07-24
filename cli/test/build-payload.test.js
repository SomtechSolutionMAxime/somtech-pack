// Test du build de payload bundlé (anti-drift).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolvePayloadRoot, readManifest, defaultModules } from '../src/modules.js';
import { collectFiles } from '../src/engine.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_DIR = resolve(HERE, '..');
const REPO = resolve(CLI_DIR, '..');
const BUILD = join(CLI_DIR, 'scripts', 'build-payload.mjs');

function buildInto(out) {
  execFileSync(process.execPath, [BUILD], { env: { ...process.env, PAYLOAD_OUT: out }, stdio: 'pipe' });
}

test('build-payload : embarque pack.json + VERSION + modules, identiques au repo', () => {
  const out = mkdtempSync(join(tmpdir(), 'smtk-payload-build-'));
  buildInto(out);

  // pack.json bundlé == pack.json du repo (pas de drift)
  assert.ok(existsSync(join(out, 'pack.json')), 'pack.json manquant');
  assert.equal(
    readFileSync(join(out, 'pack.json'), 'utf8'),
    readFileSync(join(REPO, 'pack.json'), 'utf8'),
    'pack.json bundlé diverge du repo'
  );
  if (existsSync(join(REPO, 'VERSION'))) {
    assert.ok(existsSync(join(out, 'VERSION')), 'VERSION manquant dans le payload');
  }

  // Un fichier de module connu est présent et IDENTIQUE à la source du repo.
  const sample = 'scripts/remote-install.sh';
  assert.ok(existsSync(join(out, sample)), `${sample} absent du payload`);
  assert.equal(
    readFileSync(join(out, sample), 'utf8'),
    readFileSync(join(REPO, sample), 'utf8'),
    `${sample} bundlé diverge du repo (drift)`
  );
});

test('build-payload : le canvas voyage dans le paquet, prêt à démarrer', () => {
  const out = mkdtempSync(join(tmpdir(), 'smtk-payload-build-'));
  buildInto(out);

  // Sans ces fichiers, /canvas échoue à sa première étape chez celui qui installe.
  for (const f of [
    'herdr-plugins/excalidraw/herdr-plugin.toml',
    'herdr-plugins/excalidraw/server/server.js',
    'herdr-plugins/excalidraw/server/bin.js',
    'herdr-plugins/excalidraw/scripts/open.sh',
  ]) {
    assert.ok(existsSync(join(out, f)), `${f} absent du paquet — le canvas ne démarrera pas`);
  }

  // La page construite et les dépendances d'exécution du serveur ne sont pas versionnées :
  // la chaîne de publication les produit avant de construire le paquet. Quand elles sont
  // là, elles doivent voyager — sinon le paquet promet un canvas qu'il ne livre pas.
  for (const [src, why] of [
    ['herdr-plugins/excalidraw/web/dist', 'la page construite'],
    ['herdr-plugins/excalidraw/node_modules', "les dépendances d'exécution du serveur"],
  ]) {
    if (existsSync(join(REPO, src))) {
      assert.ok(existsSync(join(out, src)), `${why} (${src}) présente au dépôt mais absente du paquet`);
    }
  }
});

test('build-payload : aucun résidu de construction ni d\'exécution dans le paquet', () => {
  const out = mkdtempSync(join(tmpdir(), 'smtk-payload-build-'));
  buildInto(out);

  for (const residue of [
    'herdr-plugins/excalidraw/web/node_modules',
    'herdr-plugins/excalidraw/web/src',
    'herdr-plugins/excalidraw/web/vite.config.js',
    'herdr-plugins/excalidraw/.herdr',
    'herdr-plugins/excalidraw/tests',
  ]) {
    assert.ok(!existsSync(join(out, residue)), `${residue} n'a rien à faire dans le paquet publié`);
  }
});

test('build-payload : le payload produit est un payload CLI consommable', () => {
  const out = mkdtempSync(join(tmpdir(), 'smtk-payload-build-'));
  buildInto(out);

  const root = resolvePayloadRoot({ source: out });
  assert.equal(root, resolve(out));
  const m = readManifest(root);
  assert.ok(defaultModules(m).includes('core'));
  const { files } = collectFiles(root, m.modules.core.paths);
  assert.ok(files.length > 0, 'le module core du payload bundlé doit contenir des fichiers');
});
