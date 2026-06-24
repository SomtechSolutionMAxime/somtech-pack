// Tests de l'installation GLOBALE du hook de version (userhooks.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { wireSessionStartCommand, installGlobalVersionHook } from '../src/userhooks.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..'); // contient .claude/hooks/session-start-pack-version.sh
const tmp = (p) => mkdtempSync(join(tmpdir(), p));

// Compte les groupes SessionStart qui référencent `command`.
function countCmd(settingsFile, command) {
  if (!existsSync(settingsFile)) return 0;
  const s = JSON.parse(readFileSync(settingsFile, 'utf8'));
  const groups = s.hooks?.SessionStart || [];
  let n = 0;
  for (const g of groups) for (const h of g.hooks || []) if (h.command === command) n++;
  return n;
}

test('wireSessionStartCommand : ajoute 1×, idempotent, préserve l’existant', () => {
  const s = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'existant.sh' }] }] }, other: 1 };
  assert.equal(wireSessionStartCommand(s, '/abs/hook.sh'), true, 'ajouté');
  assert.equal(wireSessionStartCommand(s, '/abs/hook.sh'), false, '2e fois : déjà présent');
  // existant préservé + le nôtre présent + autre clé intacte
  const cmds = s.hooks.SessionStart.flatMap((g) => g.hooks.map((h) => h.command));
  assert.ok(cmds.includes('existant.sh') && cmds.includes('/abs/hook.sh'));
  assert.equal(s.other, 1);
});

test('install global : copie le hook + crée settings + câble, idempotent', () => {
  const w = tmp('smtk-uh-');
  const hooksDir = join(w, 'hooks'); const settingsFile = join(w, 'settings.json');
  const r1 = installGlobalVersionHook({ payloadRoot: REPO_ROOT, hooksDir, settingsFile });
  assert.ok(r1.ok && r1.wired, 'installé + câblé');
  assert.ok(existsSync(join(hooksDir, 'session-start-pack-version.sh')), 'script copié');
  assert.equal(countCmd(settingsFile, r1.dest), 1, '1 câblage');
  // re-run → pas de doublon
  const r2 = installGlobalVersionHook({ payloadRoot: REPO_ROOT, hooksDir, settingsFile });
  assert.ok(r2.ok && r2.wired === false, '2e run : déjà câblé');
  assert.equal(countCmd(settingsFile, r1.dest), 1, 'toujours 1 câblage (idempotent)');
});

test('install global : préserve un settings existant + backup', () => {
  const w = tmp('smtk-uh-');
  const hooksDir = join(w, 'hooks'); const settingsFile = join(w, 'settings.json');
  writeFileSync(settingsFile, JSON.stringify({
    permissions: { allow: ['Read'] },
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'app-state.sh' }] }] },
  }, null, 2));
  const r = installGlobalVersionHook({ payloadRoot: REPO_ROOT, hooksDir, settingsFile });
  assert.ok(r.ok && r.wired);
  const s = JSON.parse(readFileSync(settingsFile, 'utf8'));
  assert.deepEqual(s.permissions, { allow: ['Read'] }, 'permissions préservées');
  const cmds = s.hooks.SessionStart.flatMap((g) => g.hooks.map((h) => h.command));
  assert.ok(cmds.includes('app-state.sh'), 'hook existant préservé');
  assert.ok(existsSync(`${settingsFile}.somtech.bak`), 'backup créé');
});

test('install global : settings.json JSON invalide → REFUS (pas de clobber)', () => {
  const w = tmp('smtk-uh-');
  const hooksDir = join(w, 'hooks'); const settingsFile = join(w, 'settings.json');
  writeFileSync(settingsFile, '{ ceci n’est pas du JSON ');
  const before = readFileSync(settingsFile, 'utf8');
  const r = installGlobalVersionHook({ payloadRoot: REPO_ROOT, hooksDir, settingsFile });
  assert.equal(r.ok, false, 'refusé');
  assert.match(r.reason, /invalide/);
  assert.equal(readFileSync(settingsFile, 'utf8'), before, 'fichier NON modifié');
  assert.ok(!existsSync(join(hooksDir, 'session-start-pack-version.sh')), 'rien copié non plus');
});

test('install global : settings valide mais structure ATYPIQUE → REFUS gracieux (pas de throw, pas d’effet de bord)', () => {
  const atypiques = [
    JSON.stringify('je suis une string'),
    JSON.stringify(['array', 'top', 'level']),
    JSON.stringify({ hooks: 'pas-un-objet' }),
    JSON.stringify({ hooks: ['array'] }),
    JSON.stringify({ hooks: { SessionStart: { pas: 'un array' } } }),
  ];
  for (const content of atypiques) {
    const w = tmp('smtk-uh-');
    const hooksDir = join(w, 'hooks'); const settingsFile = join(w, 'settings.json');
    writeFileSync(settingsFile, content);
    const before = readFileSync(settingsFile, 'utf8');
    let r;
    assert.doesNotThrow(() => { r = installGlobalVersionHook({ payloadRoot: REPO_ROOT, hooksDir, settingsFile }); }, `ne doit pas throw : ${content}`);
    assert.equal(r.ok, false, `refusé : ${content}`);
    assert.equal(readFileSync(settingsFile, 'utf8'), before, `fichier intact : ${content}`);
    assert.ok(!existsSync(join(hooksDir, 'session-start-pack-version.sh')), `rien copié : ${content}`);
  }
});

test('install global : le hook copié reste exécutable', () => {
  const w = tmp('smtk-uh-');
  const hooksDir = join(w, 'hooks'); const settingsFile = join(w, 'settings.json');
  const r = installGlobalVersionHook({ payloadRoot: REPO_ROOT, hooksDir, settingsFile });
  assert.ok(r.ok);
  assert.ok((statSync(r.dest).mode & 0o111) !== 0, 'le hook copié doit être exécutable');
});

test('install global : dry-run n’écrit rien', () => {
  const w = tmp('smtk-uh-');
  const hooksDir = join(w, 'hooks'); const settingsFile = join(w, 'settings.json');
  const r = installGlobalVersionHook({ payloadRoot: REPO_ROOT, hooksDir, settingsFile, dryRun: true });
  assert.ok(r.ok && r.dryRun);
  assert.ok(!existsSync(hooksDir), 'pas de copie');
  assert.ok(!existsSync(settingsFile), 'pas de settings écrit');
});
