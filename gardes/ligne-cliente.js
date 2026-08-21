#!/usr/bin/env node
// ligne-cliente.js — le FIL MINCE du hook PreToolUse qui tient GF-ORC-005.
//
// Patron de STD-047 R3bis : ici, uniquement de l'I/O réelle — lire stdin, MESURER
// le rôle, répondre. Toute la décision vit dans un module PUR (`juger`), qui est
// ce que les tests exercent.
//
// ⚠️ LE RÔLE SE MESURE, IL NE SE SUPPOSE PAS. Le même geste est refusé à
// l'orchestrateur et est le métier du représentant. Une valeur par défaut se
// tromperait donc systématiquement d'un côté — et du mauvais : elle empêcherait
// un représentant d'ouvrir la ligne de son client, sans que rien ne relie le
// symptôme à ce fichier.
//
// Ce qui le mesure est le LIEU où l'agent vit : `.orchestrateur/<nom>/` ou
// `.gestionnaire/<nom>/`, posés par le CLI (`ROLES` de cli/src/commands/representant.js).
// À défaut, `SOMTECH_ROLE`. À défaut encore, aucun rôle — et la décision refuse,
// mais seulement sur le geste lui-même : le reste du trafic passe.
//
// ⚠️ REFUS PAR DÉFAUT. Si la décision est introuvable, illisible, ou lève, ce fil
// refuse — un garde absent ne vaut jamais un garde permissif.

import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ICI = dirname(fileURLToPath(import.meta.url));

/** Le segment de chemin que pose le CLI pour chaque rôle. */
const LIEU_DU_ROLE = [
  ['.orchestrateur', 'orchestrateur'],
  ['.gestionnaire', 'gestionnaire-client'],
];

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

/**
 * Le rôle, lu au lieu où l'agent vit. Rend `undefined` quand aucun des deux lieux
 * n'apparaît — et `undefined` est une mesure, pas un défaut : la décision sait
 * quoi en faire.
 */
export function roleDuLieu(cwd) {
  if (typeof cwd !== 'string' || cwd === '') return undefined;
  const segments = cwd.split(sep);
  for (const [dossier, role] of LIEU_DU_ROLE) {
    if (segments.includes(dossier)) return role;
  }
  return undefined;
}

async function main() {
  let requete;
  try {
    requete = JSON.parse(await lireStdin());
  } catch {
    repondre('deny', "La garde de la ligne cliente n'a pas pu lire la requête. Elle refuse plutôt que de laisser passer ce qu'elle n'a pas vu.");
    return;
  }
  if (requete?.tool_name !== 'Bash') { repondre('allow', ''); return; }

  let juger;
  for (const p of [join(ICI, 'ligne-cliente-decision.js'), join(ICI, '..', '..', 'cli', 'src', 'metier', 'gardes', 'ligne-cliente.js')]) {
    if (existsSync(p)) { ({ juger } = await import(p)); break; }
  }
  if (!juger) {
    repondre('deny', "La garde de la ligne cliente est introuvable sur ce poste. Un garde absent ne vaut jamais un garde permissif : le geste est refusé.");
    return;
  }

  try {
    const cwd = requete?.cwd || process.cwd();
    const d = juger({
      commande: requete?.tool_input?.command,
      role: roleDuLieu(cwd) || process.env.SOMTECH_ROLE,
    });
    repondre(d.decision, d.raison);
  } catch (e) {
    repondre('deny', `La garde de la ligne cliente a échoué (${e?.message ?? 'cause inconnue'}). Elle refuse plutôt que de rendre un verdict qu'elle n'a pas calculé.`);
  }
}

main();
