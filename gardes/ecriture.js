#!/usr/bin/env node
// ecriture.js — le FIL MINCE du hook PreToolUse qui tient la frontière de l'écriture.
//
// Patron de STD-047 R3bis : ici, uniquement de l'I/O réelle — lire stdin, situer
// le lieu, répondre. Toute la décision vit dans un module PUR (`juger`), qui est
// ce que les tests exercent.
//
// ⚠️ REFUS PAR DÉFAUT, et il pèse plus lourd ici qu'ailleurs : depuis
// T-20260824-0002, `permissions.deny` ne porte plus les outils d'édition — cette
// garde est ce qui refuse l'écriture d'un livrable. Un « oui » de repli ouvrirait
// tout. Si la décision est introuvable, illisible, ou lève, ce fil refuse.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, writeSync } from 'node:fs';

const ICI = dirname(fileURLToPath(import.meta.url));

/** Une seule réponse part, quoi qu'il arrive ensuite. */
let repondu = false;

/** Les outils que cette garde juge. Le reste passe : elle ne garde que l'écriture. */
const OUTILS_ECRITURE = new Set(['Write', 'Edit', 'NotebookEdit', 'MultiEdit']);

function repondre(decision, raison) {
  if (repondu) return;
  repondu = true;
  // ⚠️ UN VERDICT MAL FORMÉ N'EST PAS UN REFUS — et il ne ressemble pas à une panne.
  // MESURÉ le 2026-08-24 : une décision qui rend une PROMESSE au lieu d'un objet
  // (un `juger` devenu asynchrone) donnait `decision === undefined`. `JSON.stringify`
  // omet les clés indéfinies, et la garde émettait
  // `{"hookSpecificOutput":{"hookEventName":"PreToolUse"}}` — un verdict SANS décision,
  // sorti en code 0 avec une sortie non vide. La commande de hook le transmet donc tel
  // quel, croyant à un verdict, et Claude Code retombe sur la demande de permission :
  // un oui sous `acceptEdits`. Le fil normalise donc lui-même ce qu'il ne reconnaît pas.
  const connue = decision === 'allow' || decision === 'deny';
  const verdict = JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: connue ? decision : 'deny',
      permissionDecisionReason: connue ? String(raison ?? '')
        : `La garde de l'écriture a rendu un verdict que le fil ne reconnaît pas `
          + `(« ${String(decision)} »). Elle refuse : un verdict sans décision n'est pas `
          + `un refus, il dégrade en demande de permission — donc en oui dès que la `
          + `session accepte les éditions.`,
    },
  }) + '\n';
  // ⚠️ ÉCRITURE SYNCHRONE, ET CE N'EST PAS UN DÉTAIL DE STYLE. `process.stdout.write`
  // est asynchrone sur un tube — ce qu'est toujours la sortie d'un hook — et le
  // `process.exit(0)` qui suit COUPE le tampon. MESURÉ le 2026-08-24 : le verdict
  // partait tronqué à `{"hookSpecificOutput":{"hookEventName":"PreToolUse"}}`, sans
  // `permissionDecision`. Un verdict sans décision n'est pas un refus : Claude Code
  // retombe sur la demande de permission, qui sous `acceptEdits` est un oui.
  // C'est le même défaut permissif que la garde existe pour fermer, un cran plus bas.
  try {
    writeSync(1, verdict);
  } catch {
    process.stdout.write(verdict);
  }
  process.exit(0);
}

// ⚠️ CE QUI TOMBE HORS DU `try`. Une panne qui remonte jusqu'ici sortirait en
// code non nul sans rien écrire — et c'est le mode de panne MESURÉ le 2026-08-24 :
// le geste dégrade alors en DEMANDE de permission, qui sous `acceptEdits` est un
// oui. La commande de hook rattrape ce cas à son tour ; ces deux filets sont
// délibérément redondants, parce que la garde porte seule un refus qui vivait
// dans `permissions.deny`.
/**
 * Le délai que la garde s'impose à elle-même.
 *
 * ⚠️ TROISIÈME MODE DE PANNE, MESURÉ le 2026-08-24 sur la vraie chaîne : un hook qui
 * PEND laisse le geste PASSER — `CLAUDE.md` a été écrit alors que le hook ne rendait
 * rien. Ni le `try` du fil ni la commande de hook ne ferment ce cas : le shell attend
 * `node` avec lui, et `timeout` n'existe pas sur macOS. Le seul endroit d'où l'on peut
 * couper est l'intérieur du processus.
 *
 * Court devant le délai de Claude Code (60 s par défaut) : la garde doit rendre SON
 * refus avant que l'hôte n'abandonne, sinon elle ne rend rien du tout.
 *
 * ⚠️ CE QU'IL NE FERME PAS, écrit plutôt qu'espéré : une BOUCLE de calcul. Node est
 * mono-thread — un `while` qui tourne empêche ce minuteur de se déclencher. Mesuré.
 * Le délai couvre l'attente, jamais le calcul.
 */
const DELAI_MS = Number(process.env.SOMTECH_GARDE_DELAI_MS || 10_000);
setTimeout(() => {
  repondre('deny', `La garde de l'écriture n'a pas rendu de verdict en ${DELAI_MS} ms. Elle refuse `
    + "plutôt que de laisser l'hôte l'abandonner : une garde qui pend laisse le geste PASSER.");
}, DELAI_MS);

for (const evenement of ['uncaughtException', 'unhandledRejection']) {
  process.on(evenement, (e) => {
    repondre('deny', `La garde de l'écriture est tombée en panne (${e?.message ?? evenement}). `
      + "Elle refuse plutôt que de rendre un verdict qu'elle n'a pas calculé.");
  });
}

async function lireStdin() {
  const morceaux = [];
  for await (const m of process.stdin) morceaux.push(m);
  return Buffer.concat(morceaux).toString('utf8');
}

/**
 * Le chemin que l'outil vise, quel que soit le nom que l'outil lui donne.
 *
 * Chercher `file_path` seul laisserait `NotebookEdit` sans chemin — la garde le
 * refuserait alors pour la mauvaise raison, et le dirait mal.
 */
function cheminVise(entree = {}) {
  return entree.file_path ?? entree.notebook_path ?? entree.path ?? '';
}

async function main() {
  let requete;
  try {
    requete = JSON.parse(await lireStdin());
  } catch {
    repondre('deny', "La garde de l'écriture n'a pas pu lire la requête. Elle refuse plutôt que de laisser passer ce qu'elle n'a pas vu.");
    return;
  }
  if (!OUTILS_ECRITURE.has(requete?.tool_name)) { repondre('allow', ''); return; }

  let juger;
  try {
    for (const p of [join(ICI, 'ecriture-decision.js'), join(ICI, '..', '..', 'cli', 'src', 'metier', 'gardes', 'ecriture.js')]) {
      if (existsSync(p)) { ({ juger } = await import(p)); break; }
    }
  } catch (e) {
    repondre('deny', `La garde de l'écriture n'a pas pu être chargée (${e?.message ?? 'cause inconnue'}). Un garde illisible ne vaut jamais un garde permissif.`);
    return;
  }
  if (!juger) {
    repondre('deny', "La garde de l'écriture est introuvable sur ce poste. Un garde absent ne vaut jamais un garde permissif : le geste est refusé.");
    return;
  }

  try {
    const d = juger({
      outil: requete?.tool_name,
      chemin: cheminVise(requete?.tool_input),
      lieu: requete?.cwd || process.cwd(),
      role: process.env.SOMTECH_ROLE || 'orchestrateur',
    });
    repondre(d.decision, d.raison);
  } catch (e) {
    repondre('deny', `La garde de l'écriture a échoué (${e?.message ?? 'cause inconnue'}). Elle refuse plutôt que de rendre un verdict qu'elle n'a pas calculé.`);
  }
}

main().catch((e) => {
  repondre('deny', `La garde de l'écriture a échoué avant de juger (${e?.message ?? 'cause inconnue'}). Elle refuse plutôt que de laisser passer ce qu'elle n'a pas vu.`);
});
