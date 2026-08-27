#!/usr/bin/env node
// sous-agent.js — le FIL MINCE du hook PreToolUse qui tient la frontière des sous-agents.
//
// Patron de STD-047 R3bis : ici, uniquement de l'I/O réelle — lire stdin, répondre.
// Toute la décision vit dans un module PUR (`juger`), qui est ce que les tests
// exercent.
//
// ⚠️ REFUS PAR DÉFAUT, et il pèse lourd : depuis D-20260826-0010, `permissions.deny`
// ne porte plus `Task` — cette garde est ce qui refuse d'ouvrir un sous-agent de
// construction ou de revue. Un « oui » de repli ouvrirait tout. Si la décision est
// introuvable, illisible, ou lève, ce fil refuse.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, writeSync } from 'node:fs';

const ICI = dirname(fileURLToPath(import.meta.url));

/** Une seule réponse part, quoi qu'il arrive ensuite. */
let repondu = false;

/** Le seul outil que cette garde juge. Le reste passe : elle ne garde que les sous-agents. */
const OUTIL_GARDE = 'Task';

function repondre(decision, raison) {
  if (repondu) return;
  repondu = true;
  // ⚠️ UN VERDICT MAL FORMÉ N'EST PAS UN REFUS — et il ne ressemble pas à une panne.
  // MESURÉ le 2026-08-24 sur la garde jumelle (écriture) : une décision qui rend une
  // PROMESSE au lieu d'un objet donnait `decision === undefined`, `JSON.stringify`
  // omettait la clé, et le verdict partait SANS décision — Claude Code retombe alors
  // sur la demande de permission, un oui sous `acceptEdits`. Le fil normalise donc
  // lui-même ce qu'il ne reconnaît pas.
  const connue = decision === 'allow' || decision === 'deny';
  const verdict = JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: connue ? decision : 'deny',
      permissionDecisionReason: connue ? String(raison ?? '')
        : `La garde des sous-agents a rendu un verdict que le fil ne reconnaît pas `
          + `(« ${String(decision)} »). Elle refuse : un verdict sans décision n'est pas `
          + `un refus, il dégrade en demande de permission — donc en oui dès que la `
          + `session accepte les éditions.`,
    },
  }) + '\n';
  // ⚠️ ÉCRITURE SYNCHRONE, ET CE N'EST PAS UN DÉTAIL DE STYLE. `process.stdout.write`
  // est asynchrone sur un tube — ce qu'est toujours la sortie d'un hook — et le
  // `process.exit(0)` qui suit COUPE le tampon. Mesuré le 2026-08-24 sur la garde
  // jumelle : le verdict partait tronqué, sans `permissionDecision`, et le geste
  // dégradait en demande de permission.
  try {
    writeSync(1, verdict);
  } catch {
    process.stdout.write(verdict);
  }
  process.exit(0);
}

/**
 * Le délai que la garde s'impose à elle-même.
 *
 * ⚠️ Un hook qui PEND laisse le geste PASSER — le shell attend `node` avec lui, et
 * `timeout` n'existe pas sur macOS. Le seul endroit d'où l'on peut couper est
 * l'intérieur du processus. Court devant le délai de Claude Code (60 s par défaut).
 *
 * ⚠️ CE QU'IL NE FERME PAS, écrit plutôt qu'espéré : une BOUCLE de calcul. Node est
 * mono-thread — un `while` qui tourne empêche ce minuteur de se déclencher. C'est
 * pourquoi la décision reste la plus simple possible.
 */
const DELAI_MS = Number(process.env.SOMTECH_GARDE_DELAI_MS || 10_000);
setTimeout(() => {
  repondre('deny', `La garde des sous-agents n'a pas rendu de verdict en ${DELAI_MS} ms. Elle refuse `
    + "plutôt que de laisser l'hôte l'abandonner : une garde qui pend laisse le geste PASSER.");
}, DELAI_MS);

for (const evenement of ['uncaughtException', 'unhandledRejection']) {
  process.on(evenement, (e) => {
    repondre('deny', `La garde des sous-agents est tombée en panne (${e?.message ?? evenement}). `
      + "Elle refuse plutôt que de rendre un verdict qu'elle n'a pas calculé.");
  });
}

async function lireStdin() {
  const morceaux = [];
  for await (const m of process.stdin) morceaux.push(m);
  return Buffer.concat(morceaux).toString('utf8');
}

async function main() {
  let requete;
  try {
    requete = JSON.parse(await lireStdin());
  } catch {
    repondre('deny', "La garde des sous-agents n'a pas pu lire la requête. Elle refuse plutôt que de laisser passer ce qu'elle n'a pas vu.");
    return;
  }
  if (requete?.tool_name !== OUTIL_GARDE) { repondre('allow', ''); return; }

  let juger;
  try {
    for (const p of [join(ICI, 'sous-agent-decision.js'), join(ICI, '..', '..', 'cli', 'src', 'metier', 'gardes', 'sous-agent.js')]) {
      if (existsSync(p)) { ({ juger } = await import(p)); break; }
    }
  } catch (e) {
    repondre('deny', `La garde des sous-agents n'a pas pu être chargée (${e?.message ?? 'cause inconnue'}). Un garde illisible ne vaut jamais un garde permissif.`);
    return;
  }
  if (!juger) {
    repondre('deny', "La garde des sous-agents est introuvable sur ce poste. Un garde absent ne vaut jamais un garde permissif : le geste est refusé.");
    return;
  }

  try {
    const d = juger({
      outil: requete?.tool_name,
      typeSousAgent: requete?.tool_input?.subagent_type,
      role: process.env.SOMTECH_ROLE || 'orchestrateur',
    });
    repondre(d.decision, d.raison);
  } catch (e) {
    repondre('deny', `La garde des sous-agents a échoué (${e?.message ?? 'cause inconnue'}). Elle refuse plutôt que de rendre un verdict qu'elle n'a pas calculé.`);
  }
}

main().catch((e) => {
  repondre('deny', `La garde des sous-agents a échoué avant de juger (${e?.message ?? 'cause inconnue'}). Elle refuse plutôt que de laisser passer ce qu'elle n'a pas vu.`);
});
