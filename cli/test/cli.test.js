// Tests du CLI @somtech/pack (node:test, zéro dépendance).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseArgs, run } from '../src/cli.js';
import { readManifest, defaultModules, resolveModules, resolvePayloadRoot } from '../src/modules.js';
import { collectFiles, applyFiles } from '../src/engine.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

function tmp(prefix) { return mkdtempSync(join(tmpdir(), prefix)); }

// Construit un payload de pack fixture déterministe. Renvoie son chemin.
function makeFixture() {
  const root = tmp('smtk-payload-');
  const manifest = {
    name: 'fixture-pack',
    version: '9.9.9',
    modules: {
      core: { default: true, paths: ['.claude/'] },
      features: { default: true, paths: ['features/'] },
      tools: { default: false, paths: ['tools/'] },
    },
  };
  writeFileSync(join(root, 'pack.json'), JSON.stringify(manifest, null, 2));
  mkdirSync(join(root, '.claude/skills/x'), { recursive: true });
  writeFileSync(join(root, '.claude/skills/x/SKILL.md'), 'skill v1\n');
  writeFileSync(join(root, '.claude/agents.md'), 'agents\n');
  mkdirSync(join(root, 'features'), { recursive: true });
  writeFileSync(join(root, 'features/blueprint.md'), 'bp\n');
  mkdirSync(join(root, 'tools'), { recursive: true });
  const sh = join(root, 'tools/run.sh');
  writeFileSync(sh, '#!/usr/bin/env bash\necho hi\n');
  chmodSync(sh, 0o755);
  return root;
}

test('parseArgs : commande, csv, formes --x=y et flags', () => {
  const p = parseArgs(['init', '--modules', 'a,b', '--yes', '--target=/t']);
  assert.equal(p.command, 'init');
  assert.equal(p.flags.modules, 'a,b');
  assert.equal(p.flags.yes, true);
  assert.equal(p.flags.target, '/t');
  const p2 = parseArgs(['update', '--modules=core', '--force']);
  assert.equal(p2.flags.modules, 'core');
  assert.equal(p2.flags.force, true);
  assert.throws(() => parseArgs(['init', '--inconnu']), /Option inconnue/);
});

test('modules : défauts et rejet d’un module inconnu', () => {
  const payload = makeFixture();
  const m = readManifest(payload);
  assert.deepEqual(defaultModules(m).sort(), ['core', 'features']);
  assert.doesNotThrow(() => resolveModules(m, ['core', 'tools']));
  assert.throws(() => resolveModules(m, ['core', 'nope']), /Module\(s\) inconnu\(s\) : nope/);
});

test('engine : init crée tout, re-run idempotent (no-op)', () => {
  const payload = makeFixture();
  const target = tmp('smtk-target-');
  const m = readManifest(payload);
  const { files } = collectFiles(payload, m.modules.core.paths.concat(m.modules.features.paths));

  const r1 = applyFiles({ payloadRoot: payload, target, files });
  assert.equal(r1.created.length, files.length);
  assert.equal(r1.unchanged.length, 0);
  // tous les fichiers existent côté cible
  for (const f of files) assert.ok(existsSync(join(target, f)), `manque ${f}`);

  const r2 = applyFiles({ payloadRoot: payload, target, files });
  assert.equal(r2.created.length, 0, 'aucun nouveau fichier au 2e run');
  assert.equal(r2.unchanged.length, files.length, 'tout doit être inchangé (idempotent)');
});

test('engine : fichier divergent NON écrasé sans force, écrasé avec force', () => {
  const payload = makeFixture();
  const target = tmp('smtk-target-');
  const m = readManifest(payload);
  const { files } = collectFiles(payload, m.modules.core.paths);
  applyFiles({ payloadRoot: payload, target, files });

  // l'utilisateur modifie un fichier installé
  const touched = join(target, '.claude/skills/x/SKILL.md');
  writeFileSync(touched, 'MODIF UTILISATEUR\n');

  const noForce = applyFiles({ payloadRoot: payload, target, files });
  assert.ok(noForce.conflicts.includes('.claude/skills/x/SKILL.md'), 'doit être un conflit');
  assert.equal(readFileSync(touched, 'utf8'), 'MODIF UTILISATEUR\n', 'NE DOIT PAS être écrasé sans force');

  const withForce = applyFiles({ payloadRoot: payload, target, files, force: true });
  assert.ok(withForce.updated.includes('.claude/skills/x/SKILL.md'));
  assert.equal(readFileSync(touched, 'utf8'), 'skill v1\n', 'doit être écrasé avec force');
});

test('engine : préserve le bit exécutable', () => {
  const payload = makeFixture();
  const target = tmp('smtk-target-');
  const m = readManifest(payload);
  const { files } = collectFiles(payload, m.modules.tools.paths);
  applyFiles({ payloadRoot: payload, target, files });
  const mode = statSync(join(target, 'tools/run.sh')).mode & 0o111;
  assert.ok(mode !== 0, 'le script copié doit rester exécutable');
});

test('engine : dry-run n’écrit rien', () => {
  const payload = makeFixture();
  const target = tmp('smtk-target-');
  const m = readManifest(payload);
  const { files } = collectFiles(payload, m.modules.core.paths);
  const r = applyFiles({ payloadRoot: payload, target, files, dryRun: true });
  assert.equal(r.created.length, files.length, 'rapport indique created');
  for (const f of files) assert.ok(!existsSync(join(target, f)), `dry-run ne doit pas écrire ${f}`);
});

test('run init : installe + écrit version.json, exit 0', async () => {
  const payload = makeFixture();
  const target = tmp('smtk-target-');
  const code = await run(['init', '--modules', 'core,features', '--yes', '--source', payload, '--target', target]);
  assert.equal(code, 0);
  assert.ok(existsSync(join(target, '.claude/skills/x/SKILL.md')));
  assert.ok(existsSync(join(target, 'features/blueprint.md')));
  const ver = JSON.parse(readFileSync(join(target, '.somtech-pack/version.json'), 'utf8'));
  assert.equal(ver.version, '9.9.9');
  assert.deepEqual(ver.modules, ['core', 'features']);
});

test('run init : module inconnu → exit 1', async () => {
  const payload = makeFixture();
  const target = tmp('smtk-target-');
  const code = await run(['init', '--modules', 'core,nope', '--yes', '--source', payload, '--target', target]);
  assert.equal(code, 1);
});

test('run update : sans --force ne touche pas un fichier modifié, exit 0', async () => {
  const payload = makeFixture();
  const target = tmp('smtk-target-');
  await run(['init', '--modules', 'core', '--yes', '--source', payload, '--target', target]);
  const f = join(target, '.claude/agents.md');
  writeFileSync(f, 'LOCAL\n');
  const code = await run(['update', '--modules', 'core', '--yes', '--source', payload, '--target', target]);
  assert.equal(code, 0);
  assert.equal(readFileSync(f, 'utf8'), 'LOCAL\n', 'update sans --force ne doit pas écraser');
});

test('run --version → exit 0', async () => {
  const code = await run(['--version']);
  assert.equal(code, 0);
});

test('payload réel du repo : résolution + collecte non vides', () => {
  // Prouve que le CLI fonctionne avec le vrai pack.json du repo (mode dev).
  const payload = resolvePayloadRoot({ source: REPO_ROOT });
  const m = readManifest(payload);
  assert.ok(defaultModules(m).includes('core'));
  const { files } = collectFiles(payload, m.modules.core.paths);
  assert.ok(files.length > 0, 'le module core doit contenir des fichiers');
});
