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
