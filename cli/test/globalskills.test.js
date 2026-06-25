// Tests du miroir GLOBAL des skills du pack (globalskills.js) + backup moteur.
// TOUT se passe dans des dossiers temporaires — jamais le vrai ~/.claude.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyFiles } from '../src/engine.js';
import { installGlobalSkills } from '../src/globalskills.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..'); // racine du pack : contient .claude/skills/*
const tmp = (p) => mkdtempSync(join(tmpdir(), p));

// ---------- Moteur : option backup ----------

test('engine backup : --force avec backup → backup .somtech.bak de l’ancienne version', () => {
  const payload = tmp('smtk-pl-'); const target = tmp('smtk-tg-');
  writeFileSync(join(payload, 'a.txt'), 'NOUVEAU (pack)');
  writeFileSync(join(target, 'a.txt'), 'ANCIEN (local)');
  const r = applyFiles({ payloadRoot: payload, target, files: ['a.txt'], force: true, backup: true });
  assert.deepEqual(r.updated, ['a.txt']);
  assert.deepEqual(r.backedUp, ['a.txt']);
  assert.equal(readFileSync(join(target, 'a.txt'), 'utf8'), 'NOUVEAU (pack)', 'écrasé par le pack');
  assert.ok(existsSync(join(target, 'a.txt.somtech.bak')), 'backup créé');
  assert.equal(readFileSync(join(target, 'a.txt.somtech.bak'), 'utf8'), 'ANCIEN (local)', 'backup = ancienne version');
});

test('engine backup : défaut (backup=false) → AUCUN .somtech.bak', () => {
  const payload = tmp('smtk-pl-'); const target = tmp('smtk-tg-');
  writeFileSync(join(payload, 'a.txt'), 'NOUVEAU');
  writeFileSync(join(target, 'a.txt'), 'ANCIEN');
  const r = applyFiles({ payloadRoot: payload, target, files: ['a.txt'], force: true });
  assert.deepEqual(r.updated, ['a.txt']);
  assert.deepEqual(r.backedUp, [], 'pas de backup sans opt-in');
  assert.ok(!existsSync(join(target, 'a.txt.somtech.bak')), 'aucun backup');
});

test('engine backup : dry-run n’écrit ni le fichier ni le backup', () => {
  const payload = tmp('smtk-pl-'); const target = tmp('smtk-tg-');
  writeFileSync(join(payload, 'a.txt'), 'NOUVEAU');
  writeFileSync(join(target, 'a.txt'), 'ANCIEN');
  applyFiles({ payloadRoot: payload, target, files: ['a.txt'], force: true, backup: true, dryRun: true });
  assert.equal(readFileSync(join(target, 'a.txt'), 'utf8'), 'ANCIEN', 'cible intacte');
  assert.ok(!existsSync(join(target, 'a.txt.somtech.bak')), 'pas de backup en dry-run');
});

// ---------- installGlobalSkills ----------

test('global skills : mirror des skills du pack dans un skillsDir vierge', () => {
  const sd = tmp('smtk-gs-');
  const r = installGlobalSkills({ payloadRoot: REPO, skillsDir: sd });
  // des skills connus du pack doivent être présents
  assert.ok(existsSync(join(sd, 'end-session', 'SKILL.md')), 'end-session copié');
  assert.ok(existsSync(join(sd, 'plan-servicedesk', 'SKILL.md')), 'plan-servicedesk copié');
  assert.ok(r.skills.includes('merge'), 'merge détecté');
  assert.ok(r.created.length > 0 && r.conflicts.length === 0);
});

test('global skills : un skill PERSO hors-pack n’est jamais touché', () => {
  const sd = tmp('smtk-gs-');
  // skill perso (nom absent du pack) avec contenu propre
  mkdirSync(join(sd, 'mon-skill-perso'), { recursive: true });
  writeFileSync(join(sd, 'mon-skill-perso', 'SKILL.md'), 'PERSO — ne pas toucher');
  installGlobalSkills({ payloadRoot: REPO, skillsDir: sd });
  assert.ok(existsSync(join(sd, 'mon-skill-perso', 'SKILL.md')), 'skill perso préservé');
  assert.equal(
    readFileSync(join(sd, 'mon-skill-perso', 'SKILL.md'), 'utf8'),
    'PERSO — ne pas toucher',
    'contenu perso intact'
  );
});

test('global skills : skill du pack DIVERGENT en global → NON écrasé sans --force', () => {
  const sd = tmp('smtk-gs-');
  mkdirSync(join(sd, 'end-session'), { recursive: true });
  writeFileSync(join(sd, 'end-session', 'SKILL.md'), 'VERSION LOCALE MODIFIÉE');
  const r = installGlobalSkills({ payloadRoot: REPO, skillsDir: sd, force: false });
  assert.equal(
    readFileSync(join(sd, 'end-session', 'SKILL.md'), 'utf8'),
    'VERSION LOCALE MODIFIÉE',
    'divergent non écrasé'
  );
  assert.ok(r.conflicts.some((p) => p.startsWith('end-session/')), 'reporté comme divergent');
  assert.ok(!existsSync(join(sd, 'end-session', 'SKILL.md.somtech.bak')), 'pas de backup sans écrasement');
});

test('global skills : --force écrase un divergent MAIS crée un backup .somtech.bak', () => {
  const sd = tmp('smtk-gs-');
  mkdirSync(join(sd, 'end-session'), { recursive: true });
  writeFileSync(join(sd, 'end-session', 'SKILL.md'), 'VERSION LOCALE MODIFIÉE');
  const r = installGlobalSkills({ payloadRoot: REPO, skillsDir: sd, force: true });
  const after = readFileSync(join(sd, 'end-session', 'SKILL.md'), 'utf8');
  assert.notEqual(after, 'VERSION LOCALE MODIFIÉE', 'écrasé par la version du pack');
  const bak = join(sd, 'end-session', 'SKILL.md.somtech.bak');
  assert.ok(existsSync(bak), 'backup créé');
  assert.equal(readFileSync(bak, 'utf8'), 'VERSION LOCALE MODIFIÉE', 'backup = version locale d’avant');
  assert.ok(r.backedUp.some((p) => p.startsWith('end-session/')), 'reporté dans backedUp');
});

test('global skills : dry-run n’écrit rien', () => {
  const sd = tmp('smtk-gs-');
  const r = installGlobalSkills({ payloadRoot: REPO, skillsDir: sd, dryRun: true });
  assert.ok(!existsSync(join(sd, 'end-session')), 'rien copié en dry-run');
  assert.ok(r.created.length > 0, 'le rapport liste quand même ce qui SERAIT créé');
});

test('global skills : ré-exécution idempotente (2e run = tout inchangé)', () => {
  const sd = tmp('smtk-gs-');
  installGlobalSkills({ payloadRoot: REPO, skillsDir: sd });
  const r2 = installGlobalSkills({ payloadRoot: REPO, skillsDir: sd });
  assert.equal(r2.created.length, 0, '2e run : rien de neuf');
  assert.equal(r2.conflicts.length, 0, '2e run : aucun divergent');
  assert.ok(r2.unchanged.length > 0, '2e run : tout inchangé');
});
