// Tests du miroir GLOBAL des commandes du pack (globalcommands.js).
// TOUT se passe dans des dossiers temporaires — jamais le vrai ~/.claude.
//
// Pourquoi ce miroir : les commandes du pack (`/canvas`, `/brd`, `/pousse`…) voyagent
// avec `.claude/` vers les PROJETS, mais la configuration du poste ne les installait
// nulle part. Une commande n'existait donc que dans les projets ayant reçu le pack —
// jamais dans une session ouverte ailleurs, alors que les compétences, elles, y sont.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { installGlobalCommands } from '../src/globalcommands.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..'); // racine du pack : contient .claude/commands/*
const tmp = (p) => mkdtempSync(join(tmpdir(), p));

test('global commands : mirror des commandes du pack dans un dossier vierge', () => {
  const cd = tmp('smtk-gc-');
  const r = installGlobalCommands({ payloadRoot: REPO, commandsDir: cd });

  assert.ok(existsSync(join(cd, 'canvas.md')), 'canvas copié — sans lui /canvas n\'existe hors projet');
  assert.ok(existsSync(join(cd, 'brd.md')), 'brd copié');
  assert.ok(existsSync(join(cd, 'pousse.md')), 'pousse copié');
  assert.ok(r.commands.includes('canvas'), 'canvas détecté dans le rapport');
  assert.ok(r.created.length > 0 && r.conflicts.length === 0);
});

test('global commands : une commande PERSO hors-pack n\'est jamais touchée', () => {
  const cd = tmp('smtk-gc-');
  writeFileSync(join(cd, 'ma-commande-perso.md'), 'PERSO — ne pas toucher');
  installGlobalCommands({ payloadRoot: REPO, commandsDir: cd });
  assert.equal(
    readFileSync(join(cd, 'ma-commande-perso.md'), 'utf8'),
    'PERSO — ne pas toucher',
    'contenu perso intact'
  );
});

test('global commands : une commande du pack divergente CONVERGE, avec sauvegarde', () => {
  const cd = tmp('smtk-gc-');
  writeFileSync(join(cd, 'canvas.md'), 'VERSION LOCALE MODIFIÉE');
  const r = installGlobalCommands({ payloadRoot: REPO, commandsDir: cd, force: false });

  assert.notEqual(
    readFileSync(join(cd, 'canvas.md'), 'utf8'),
    'VERSION LOCALE MODIFIÉE',
    'la version du pack fait foi'
  );
  assert.ok(existsSync(join(cd, 'canvas.md.somtech.bak')), 'la dérive est sauvegardée avant écrasement');
  assert.equal(
    readFileSync(join(cd, 'canvas.md.somtech.bak'), 'utf8'),
    'VERSION LOCALE MODIFIÉE',
    'la sauvegarde contient bien ce qui a été écrasé'
  );
  assert.ok(r.backedUp.includes('canvas.md'), 'reporté dans backedUp');
});

test('global commands : dry-run n\'écrit rien', () => {
  const cd = tmp('smtk-gc-');
  const r = installGlobalCommands({ payloadRoot: REPO, commandsDir: cd, dryRun: true });
  assert.ok(!existsSync(join(cd, 'canvas.md')), 'rien copié en dry-run');
  assert.ok(r.created.length > 0, 'le rapport liste quand même ce qui SERAIT créé');
});

test('global commands : ré-exécution idempotente', () => {
  const cd = tmp('smtk-gc-');
  installGlobalCommands({ payloadRoot: REPO, commandsDir: cd });
  const r2 = installGlobalCommands({ payloadRoot: REPO, commandsDir: cd });
  assert.equal(r2.created.length, 0, '2e run : rien de neuf');
  assert.equal(r2.conflicts.length, 0, '2e run : aucun divergent');
  assert.ok(r2.unchanged.length > 0, '2e run : tout inchangé');
});

test('global commands : pack sans dossier de commandes → rapport vide, pas d\'erreur', () => {
  const fakePayload = tmp('smtk-pl-');
  mkdirSync(join(fakePayload, '.claude'), { recursive: true });
  const r = installGlobalCommands({ payloadRoot: fakePayload, commandsDir: tmp('smtk-gc-') });
  assert.deepEqual(r.commands, []);
  assert.deepEqual(r.created, []);
});
