#!/usr/bin/env node
// terminal.js — le FIL MINCE du hook PreToolUse qui ferme la brèche du terminal.
//
// Patron de STD-047 R3bis, celui du seul hook déjà en service : ici, uniquement
// de l'I/O réelle — lire stdin, trouver le dépôt, répondre. Toute la décision
// vit dans un module PUR (`juger`), qui est ce que les tests exercent.
//
// ⚠️ REFUS PAR DÉFAUT. Si la décision est introuvable, illisible, ou lève, ce
// fil refuse — un garde absent ne vaut jamais un garde permissif.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ICI = dirname(fileURLToPath(import.meta.url));

function repondre(decision, raison) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: raison,
    },
  }) + '\n');
  process.exit(0);
}

async function lireStdin() {
  const morceaux = [];
  for await (const m of process.stdin) morceaux.push(m);
  return Buffer.concat(morceaux).toString('utf8');
}

/** La racine du dépôt du chantier — celle où vit le lieu de l'agent. */
function depotDuChantier(cwd) {
  let d = cwd;
  for (let i = 0; i < 40 && d !== '/'; i++) {
    if (existsSync(join(d, '.git'))) return d;
    d = dirname(d);
  }
  return null;
}

async function main() {
  let requete;
  try {
    requete = JSON.parse(await lireStdin());
  } catch {
    repondre('deny', "La garde du terminal n'a pas pu lire la requête. Elle refuse plutôt que de laisser passer ce qu'elle n'a pas vu.");
    return;
  }
  if (requete?.tool_name !== 'Bash') { repondre('allow', ''); return; }

  let juger;
  for (const p of [join(ICI, 'terminal-decision.js'), join(ICI, '..', '..', 'cli', 'src', 'metier', 'gardes', 'terminal.js')]) {
    if (existsSync(p)) { ({ juger } = await import(p)); break; }
  }
  if (!juger) {
    repondre('deny', "La garde du terminal est introuvable sur ce poste. Un garde absent ne vaut jamais un garde permissif : le geste est refusé.");
    return;
  }

  try {
    const d = juger({
      commande: requete?.tool_input?.command,
      depot: depotDuChantier(requete?.cwd || process.cwd()),
      role: process.env.SOMTECH_ROLE || 'orchestrateur',
    });
    repondre(d.decision, d.raison);
  } catch (e) {
    repondre('deny', `La garde du terminal a échoué (${e?.message ?? 'cause inconnue'}). Elle refuse plutôt que de rendre un verdict qu'elle n'a pas calculé.`);
  }
}

main();
