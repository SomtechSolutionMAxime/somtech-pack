#!/usr/bin/env node
// garde-ouverture-ligne.js — le hook PreToolUse posé dans .gestionnaire/<client>/.claude/
// settings.json à la naissance.
//
// Ce fichier est volontairement un FIL MINCE : toute décision testable vit dans
// src/hook.js (pur, injectable) et src/garde.js (pur). Ici, seulement de l'I/O réelle —
// lue stdin, herdr, ligne-directe — jamais exercée par les tests (voir src/hook.js).

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { traiterRequete } from '../src/hook.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIGNE_DIRECTE_SRC = join(HERE, '..', '..', 'ligne-directe', 'src');

async function lireStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function repondre(decision) {
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision.permissionDecision,
        permissionDecisionReason: decision.permissionDecisionReason,
      },
    })}\n`
  );
  process.exit(0);
}

/** Le pane courant et l'état des lignes, lus dans le monde réel (herdr + ligne-directe). */
async function obtenirPaneEtEtat() {
  const herdr = await import(join(LIGNE_DIRECTE_SRC, 'herdr.js'));
  const { parler } = await import(join(LIGNE_DIRECTE_SRC, 'client.js'));
  const ici = await herdr.paneCourant();
  const etat = await parler({ geste: 'etat' });
  return { pane: ici.pane, etat };
}

async function main() {
  let requete;
  try {
    requete = JSON.parse(await lireStdin());
  } catch {
    repondre({ permissionDecision: 'deny', permissionDecisionReason: 'requête de hook illisible — refus par défaut' });
    return;
  }
  repondre(await traiterRequete(requete, obtenirPaneEtEtat));
}

main().catch(() => {
  repondre({ permissionDecision: 'deny', permissionDecisionReason: 'panne du garde d’ouverture — refus par défaut' });
});
