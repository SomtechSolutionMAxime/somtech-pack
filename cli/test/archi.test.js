// Tests du dispatch des sous-commandes du modèle vivant (D-20260715-0004).
// node:test, zéro dépendance. Le pont JS→Python est testé via `harvest-supabase`
// (aucune dépendance tierce : regex + émission YAML à la main).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run } from '../src/cli.js';
import { isArchiCommand, archiCommands, cmdArchi } from '../src/commands/archi.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

function tmp(p) { return mkdtempSync(join(tmpdir(), p)); }

function pythonAvailable() {
  try {
    execFileSync(process.env.SOMTECH_PYTHON || 'python3', ['--version'], { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

test('isArchiCommand reconnaît les sous-commandes du modèle vivant', () => {
  for (const c of ['harvest-supabase', 'harvest-routes', 'harvest-config',
                   'merge-manifests', 'validate-manifest', 'diff-manifest', 'generate-erd']) {
    assert.equal(isArchiCommand(c), true, `${c} devrait être une commande archi`);
  }
  assert.equal(isArchiCommand('init'), false);
  assert.equal(isArchiCommand('brd'), false);
  assert.equal(isArchiCommand('generate-erd '), false); // pas de fuzzy match
});

test('archiCommands liste les 7 outils, triés', () => {
  const cmds = archiCommands();
  assert.equal(cmds.length, 7);
  assert.deepEqual(cmds, [...cmds].sort());
});

test('cmdArchi échoue proprement si le payload ne contient pas les scripts', () => {
  const empty = tmp('smtk-archi-empty-');
  // pack.json présent mais scripts/archi-ci absent → script introuvable → code 1
  writeFileSync(join(empty, 'pack.json'), JSON.stringify({ modules: {} }));
  const code = cmdArchi('diff-manifest', ['a', 'b'], { source: empty });
  assert.equal(code, 1);
});

test('pont JS→Python : harvest-supabase récolte les tables (dev payload = repo)', (t) => {
  if (!pythonAvailable()) return t.skip('python3 indisponible');
  const work = tmp('smtk-archi-sql-');
  mkdirSync(join(work, 'migrations'), { recursive: true });
  writeFileSync(join(work, 'migrations', '0001.sql'),
    'CREATE TABLE users (id uuid PRIMARY KEY);\n'
    + 'CREATE TABLE posts (id uuid, author_id uuid REFERENCES users(id));\n');
  const out = join(work, 'tables.yaml');
  // run() résout le payload sur la racine du repo (dev) → scripts/archi-ci présent.
  const code = cmdArchi('harvest-supabase',
    [join(work, 'migrations'), '--app', 'demo', '--out', out],
    { source: REPO_ROOT });
  assert.equal(code, 0, 'harvest-supabase devrait réussir');
  assert.ok(existsSync(out), 'le fichier de sortie devrait exister');
  const yaml = readFileSync(out, 'utf8');
  assert.match(yaml, /id: demo\.users/);
  assert.match(yaml, /id: demo\.posts/);
  assert.match(yaml, /kind: table/);
  assert.match(yaml, /from: demo\.posts/); // relation FK posts → users
});

test('run() propage le code de sortie du gate strict (drift → 1)', async (t) => {
  if (!pythonAvailable()) return t.skip('python3 indisponible');
  // pyyaml requis pour diff-manifest ; on skippe sinon.
  try {
    execFileSync(process.env.SOMTECH_PYTHON || 'python3', ['-c', 'import yaml'], { stdio: 'ignore' });
  } catch { return t.skip('PyYAML indisponible'); }

  const work = tmp('smtk-archi-diff-');
  const committed = join(work, 'committed.yaml');
  const harvested = join(work, 'harvested.yaml');
  writeFileSync(committed,
    'app: demo\nelements:\n  - {id: demo, kind: service, name: demo}\n');
  writeFileSync(harvested,
    'app: demo\nelements:\n'
    + '  - {id: demo, kind: service, name: demo}\n'
    + '  - {id: demo.t, kind: table, name: t, parent: demo}\n');

  process.env.SOMTECH_PACK_PAYLOAD = REPO_ROOT; // force le payload dev pour run()
  const drift = await run(['diff-manifest', committed, harvested, '--mode', 'strict']);
  const clean = await run(['diff-manifest', harvested, harvested, '--mode', 'strict']);
  delete process.env.SOMTECH_PACK_PAYLOAD;
  assert.equal(drift, 1, 'drift en strict → exit 1');
  assert.equal(clean, 0, 'identique en strict → exit 0');
});
