// Tests du miroir GLOBAL des workflows du pack (globalworkflows.js).
// TOUT se passe dans des dossiers temporaires — jamais le vrai ~/.claude.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { installGlobalWorkflows } from '../src/globalworkflows.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..'); // racine du pack : contient .claude/workflows/*
const tmp = (p) => mkdtempSync(join(tmpdir(), p));

test('global workflows : mirror des workflows du pack dans un dir vierge', () => {
  const wd = tmp('smtk-gw-');
  const r = installGlobalWorkflows({ payloadRoot: REPO, workflowsDir: wd });
  // le workflow connu du pack doit être présent
  assert.ok(existsSync(join(wd, 'analyse-decoupage-demande.js')), 'analyse-decoupage-demande copié');
  assert.ok(r.workflows.includes('analyse-decoupage-demande'), 'détecté dans la liste (sans extension)');
  assert.ok(r.created.length > 0 && r.conflicts.length === 0);
});

test('global workflows : un workflow PERSO hors-pack n’est jamais touché', () => {
  const wd = tmp('smtk-gw-');
  writeFileSync(join(wd, 'mon-workflow-perso.js'), 'PERSO — ne pas toucher');
  installGlobalWorkflows({ payloadRoot: REPO, workflowsDir: wd });
  assert.equal(
    readFileSync(join(wd, 'mon-workflow-perso.js'), 'utf8'),
    'PERSO — ne pas toucher',
    'workflow perso intact'
  );
});

test('global workflows : workflow du pack DIVERGENT en global → CONVERGE par défaut + backup (D-20260715-0002)', () => {
  const wd = tmp('smtk-gw-');
  writeFileSync(join(wd, 'analyse-decoupage-demande.js'), 'VERSION LOCALE MODIFIÉE');
  // sans --force : convergence par défaut (le pack est la source de vérité)
  const r = installGlobalWorkflows({ payloadRoot: REPO, workflowsDir: wd, force: false });
  assert.notEqual(
    readFileSync(join(wd, 'analyse-decoupage-demande.js'), 'utf8'),
    'VERSION LOCALE MODIFIÉE',
    'la dérive locale est écrasée par la version du pack'
  );
  assert.ok(r.updated.includes('analyse-decoupage-demande.js'), 'reporté comme convergé (updated)');
  assert.equal(r.conflicts.length, 0, 'plus de conflit pour un fichier pack-owned');
  const bak = join(wd, 'analyse-decoupage-demande.js.somtech.bak');
  assert.ok(existsSync(bak), 'backup créé automatiquement');
  assert.equal(readFileSync(bak, 'utf8'), 'VERSION LOCALE MODIFIÉE', 'backup = version locale d’avant');
  assert.ok(r.backedUp.includes('analyse-decoupage-demande.js'), 'reporté dans backedUp');
});

test('global workflows : --force est redondant (convergence identique avec ou sans)', () => {
  const wd = tmp('smtk-gw-');
  writeFileSync(join(wd, 'analyse-decoupage-demande.js'), 'VERSION LOCALE MODIFIÉE');
  const r = installGlobalWorkflows({ payloadRoot: REPO, workflowsDir: wd, force: true });
  assert.notEqual(readFileSync(join(wd, 'analyse-decoupage-demande.js'), 'utf8'), 'VERSION LOCALE MODIFIÉE');
  assert.ok(r.updated.includes('analyse-decoupage-demande.js'), 'convergé même avec --force (aucune différence)');
  assert.ok(r.backedUp.includes('analyse-decoupage-demande.js'), 'backup créé');
});

test('global workflows : dry-run n’écrit rien', () => {
  const wd = tmp('smtk-gw-');
  const r = installGlobalWorkflows({ payloadRoot: REPO, workflowsDir: wd, dryRun: true });
  assert.ok(!existsSync(join(wd, 'analyse-decoupage-demande.js')), 'rien copié en dry-run');
  assert.ok(r.created.length > 0, 'le rapport liste quand même ce qui SERAIT créé');
});

test('global workflows : ré-exécution idempotente (2e run = tout inchangé)', () => {
  const wd = tmp('smtk-gw-');
  installGlobalWorkflows({ payloadRoot: REPO, workflowsDir: wd });
  const r2 = installGlobalWorkflows({ payloadRoot: REPO, workflowsDir: wd });
  assert.equal(r2.created.length, 0, '2e run : rien de neuf');
  assert.equal(r2.conflicts.length, 0, '2e run : aucun divergent');
  assert.ok(r2.unchanged.length > 0, '2e run : tout inchangé');
});

test('global workflows : workflowsDir absent du pack → rapport vide, aucune erreur', () => {
  const wd = tmp('smtk-gw-');
  const emptyPayload = tmp('smtk-pl-'); // pas de .claude/workflows
  const r = installGlobalWorkflows({ payloadRoot: emptyPayload, workflowsDir: wd });
  assert.deepEqual(r.workflows, []);
  assert.equal(r.created.length, 0);
});
