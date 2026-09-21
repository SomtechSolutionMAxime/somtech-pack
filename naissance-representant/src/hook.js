// hook.js — l'orchestration du garde PreToolUse, injectable et donc testable SANS jamais
// faire naître un vrai veilleur ni toucher le vrai espace de conversation (RA-REL-012).
//
// `garde-ouverture-ligne.js`, dans hooks/, est la seule chose qui touche à l'I/O réelle
// (stdin, herdr, ligne-directe) : il n'est qu'un fil qui relie ce fichier au monde. Toute la
// décision qu'on peut mettre à l'épreuve vit ici, à l'abri d'un vrai processus enfant.

import { roleDuLieu } from './lieu.js';
import { decider, naturesOuvertesDuPane } from './garde.js';
import { ancreDeLigne } from '../../ligne-directe/src/registre.js';

/**
 * LES CODES QUI DÉSIGNENT UNE PANNE DU VEILLEUR — jamais une exception inconnue
 * (T-20260914-0004).
 *
 * ⚠️ POURQUOI UNE LISTE FERMÉE, PAS UN `.match()` SUR LE MESSAGE. Le défaut fermé ici : ce
 * fichier avalait TOUTE exception de `obtenirPaneEtEtat` en `naturesOuvertes = []`, et
 * `decider()` appliquait alors la branche « lignes manquantes » — Grep, tail, date refusés
 * avec « n'ouvre aucune de tes lignes », comme si la ligne n'avait jamais existé. Un veilleur
 * en panne et une ligne jamais ouverte tombaient dans le MÊME état, et l'agent ne pouvait
 * même pas lire le journal pour comprendre pourquoi.
 *
 * `ligne-directe/src/client.js` pose désormais un `code` STABLE sur chacune de ses erreurs
 * (`VEILLEUR_MUET`, `VEILLEUR_LENT`, `VEILLEUR_NE_DEMARRE_PAS`), et Node pose déjà les siens
 * sur `ENOENT` / `ECONNREFUSED`. C'est cette liste-là qui distingue « le veilleur est en
 * cause » de « autre chose a cassé » — jamais le texte du message, qui peut changer de mot
 * sans changer de fait.
 */
const CODES_DE_PANNE_DU_VEILLEUR = new Set([
  'VEILLEUR_MUET',
  'VEILLEUR_LENT',
  'VEILLEUR_NE_DEMARRE_PAS',
  'ECONNREFUSED',
  'ENOENT',
]);

/**
 * Traite une requête de hook PreToolUse déjà parsée.
 *
 * @param {object} requete - `{ cwd, tool_name, tool_input }`, tel que Claude Code le pose sur stdin.
 * @param {() => Promise<{pane: string, etat: object}>} obtenirPaneEtEtat - résolu par le
 *   monde réel (herdr + ligne-directe) dans le hook exécutable ; remplacé par un double dans
 *   les tests. Une exception qu'il lève n'élargit JAMAIS l'accès — mais elle n'est plus
 *   avalée en silence : sa CAUSE est classée et transmise à `decider()` sous forme de
 *   `panne`, pour que le garde puisse distinguer un veilleur en panne (lecture et diagnostic
 *   permis) d'une ligne simplement jamais ouverte.
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

  // LES NATURES OUVERTES, PAS UN BOOLÉEN — un rôle peut devoir PLUSIEURS lignes
  // (T-20260813-0076), et « il y en a une » ne dit pas laquelle. Un gestionnaire qui n'aurait
  // ouvert que celle de son client serait relâché par un booléen, et naîtrait sans aucun
  // chemin vers le dirigeant : le manque exact que ce lot ferme.
  let naturesOuvertes = [];
  // `panne` — la CAUSE de l'échec du sondage, classée. `null` tant que le sondage réussit.
  let panne = null;
  // Les lignes de CE LIEU ouvertes sur un AUTRE pane — un état local périmé, pas une ligne
  // jamais ouverte (T-20260914-0004, voisin de T-20260908-0057). Calculée seulement quand le
  // sondage a réussi : sans `etat`, il n'y a rien à comparer.
  let lignesDuLieu = [];
  try {
    const { pane, etat } = await obtenirPaneEtEtat(cwd);
    naturesOuvertes = naturesOuvertesDuPane(etat, pane);
    // `cwd` du hook peut être le lieu lui-même ou un sous-répertoire ; `ancreDeLigne` remonte
    // au lieu de rôle des deux côtés, donc une ligne inscrite depuis la racine du lieu se
    // reconnaît même quand l'appel courant vient d'un sous-dossier.
    lignesDuLieu = (etat?.ouvertes || []).filter(
      (l) => l.pane !== pane && ancreDeLigne(l.worktree) === ancreDeLigne(cwd)
    );
  } catch (err) {
    naturesOuvertes = [];
    const code = err?.code ?? null;
    // ⚠️ `OutilIntrouvable` EST TESTÉE AVANT LE CODE, ET C'EST OBLIGATOIRE — pas une
    // préférence de style. `ENOENT` est un code PARTAGÉ par deux mondes distincts :
    // `ligne-directe/src/outils.js` le pose quand un binaire (`herdr`, par exemple) n'est
    // pas dans le `PATH` du processus — un défaut de POSTE, sans aucun rapport avec le
    // socket du veilleur — et Node pose le MÊME code littéral quand la connexion à ce
    // socket échoue. Classer sur le seul code aurait fait dire à un `herdr` introuvable
    // « le veilleur ne répond plus », un diagnostic FAUX de la même famille que celui que ce
    // lot ferme par ailleurs (T-20260914-0004 : un refus doit dire ce qu'il a MESURÉ, jamais
    // ce qu'il devine d'un code ambigu). `OutilIntrouvable` est la SEULE à poser
    // `err.name === 'OutilIntrouvable'` — c'est ce fait-là qui tranche, jamais le code.
    const causeOutil = err?.name === 'OutilIntrouvable';
    panne = {
      cause: !causeOutil && CODES_DE_PANNE_DU_VEILLEUR.has(code) ? 'veilleur' : 'inconnue',
      code,
      message: err?.message ?? String(err),
    };
  }

  return decider({
    toolName: requete?.tool_name,
    toolInput: requete?.tool_input,
    naturesOuvertes,
    role,
    panne,
    lignesDuLieu,
  });
}
