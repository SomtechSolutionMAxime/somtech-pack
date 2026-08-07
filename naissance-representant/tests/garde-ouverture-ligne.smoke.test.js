// garde-ouverture-ligne.smoke.test.js — preuve que le FICHIER EXÉCUTABLE réel (chemins
// d'import, lecture stdin, forme JSON de sortie) fonctionne, sans jamais emprunter la
// branche qui parlerait à herdr ou à un veilleur.
//
// Le cwd choisi ici n'est délibérément PAS un lieu de représentant : `traiterRequete`
// retourne alors avant d'appeler `obtenirPaneEtEtat` (voir src/hook.js). C'est ce qui rend
// ce test sûr à exécuter en CI sans jamais approcher le vrai espace de conversation
// (RA-REL-012) — la branche herdr/ligne-directe, elle, est prouvée par tests/hook.test.js
// avec un double injecté, jamais par un vrai sous-processus.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = resolve(HERE, '..', 'hooks', 'garde-ouverture-ligne.js');

// `execFile` ASYNCHRONE n'a pas d'option `input` — seule la variante SYNCHRONE en a une
// (elle écrit sur stdin puis ferme). L'utiliser sans passer par `input` laisserait le hook
// bloqué indéfiniment sur `for await (const chunk of process.stdin)`, en attente d'un flux
// qui ne se ferme jamais : ce piège a fait suspendre la suite entière au premier essai.

test('smoke : hors du lieu d’un représentant, le fichier exécutable rend allow — sans toucher herdr', () => {
  const d = mkdtempSync(join(tmpdir(), 'smtk-smoke-'));
  try {
    const requete = JSON.stringify({ cwd: d, tool_name: 'Bash', tool_input: { command: 'git status' } });
    const stdout = execFileSync(process.execPath, [HOOK], { input: requete, timeout: 5000 });
    const reponse = JSON.parse(stdout);
    assert.equal(reponse.hookSpecificOutput.hookEventName, 'PreToolUse');
    assert.equal(reponse.hookSpecificOutput.permissionDecision, 'allow');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('smoke : une entrée illisible sur stdin rend deny, jamais un crash silencieux', () => {
  const stdout = execFileSync(process.execPath, [HOOK], { input: 'ceci n’est pas du JSON', timeout: 5000 });
  const reponse = JSON.parse(stdout);
  assert.equal(reponse.hookSpecificOutput.permissionDecision, 'deny');
});
