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
import { existsSync } from 'node:fs';

const ICI = dirname(fileURLToPath(import.meta.url));

/** Une seule réponse part, quoi qu'il arrive ensuite. */
let repondu = false;

/** Les outils que cette garde juge. Le reste passe : elle ne garde que l'écriture. */
const OUTILS_ECRITURE = new Set(['Write', 'Edit', 'NotebookEdit', 'MultiEdit']);

function repondre(decision, raison) {
  if (repondu) return;
  repondu = true;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: raison,
    },
  }) + '\n');
  process.exit(0);
}

// ⚠️ CE QUI TOMBE HORS DU `try`. Une panne qui remonte jusqu'ici sortirait en
// code non nul sans rien écrire — et c'est le mode de panne MESURÉ le 2026-08-24 :
// le geste dégrade alors en DEMANDE de permission, qui sous `acceptEdits` est un
// oui. La commande de hook rattrape ce cas à son tour ; ces deux filets sont
// délibérément redondants, parce que la garde porte seule un refus qui vivait
// dans `permissions.deny`.
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
