// hook.js — l'orchestration du garde PreToolUse, injectable et donc testable SANS jamais
// faire naître un vrai veilleur ni toucher le vrai espace de conversation (RA-REL-012).
//
// `garde-ouverture-ligne.js`, dans hooks/, est la seule chose qui touche à l'I/O réelle
// (stdin, herdr, ligne-directe) : il n'est qu'un fil qui relie ce fichier au monde. Toute la
// décision qu'on peut mettre à l'épreuve vit ici, à l'abri d'un vrai processus enfant.

import { roleDuLieu } from './lieu.js';
import { decider, ligneEstOuverte } from './garde.js';

/**
 * Traite une requête de hook PreToolUse déjà parsée.
 *
 * @param {object} requete - `{ cwd, tool_name, tool_input }`, tel que Claude Code le pose sur stdin.
 * @param {() => Promise<{pane: string, etat: object}>} obtenirPaneEtEtat - résolu par le
 *   monde réel (herdr + ligne-directe) dans le hook exécutable ; remplacé par un double dans
 *   les tests. Toute exception qu'il lève est traitée comme « ligne non ouverte » — un
 *   environnement cassé (herdr injoignable, veilleur absent) ne doit jamais élargir l'accès,
 *   seulement bloquer plus tôt. C'est le même repli que le métier enseigne lui-même :
 *   « si la ligne de discussion n'est pas installée sur ce poste, tu t'arrêtes ».
 * @returns {Promise<{permissionDecision: 'allow'|'deny', permissionDecisionReason: string}>}
 */
export async function traiterRequete(requete, obtenirPaneEtEtat) {
  const cwd = requete?.cwd || process.cwd();

  // Le rôle est lu du LIEU, jamais reçu de l'appelant : c'est ce qui fait qu'un garde posé
  // dans un lieu d'orchestrateur ne peut pas se voir présenter la séquence d'un représentant.
  const role = roleDuLieu(cwd);
  if (!role) {
    return { permissionDecision: 'allow', permissionDecisionReason: 'hors du lieu d’un agent' };
  }

  let ligneOuverte = false;
  try {
    const { pane, etat } = await obtenirPaneEtEtat(cwd);
    ligneOuverte = ligneEstOuverte(etat, pane);
  } catch {
    ligneOuverte = false;
  }

  return decider({ toolName: requete?.tool_name, toolInput: requete?.tool_input, ligneOuverte, role });
}
