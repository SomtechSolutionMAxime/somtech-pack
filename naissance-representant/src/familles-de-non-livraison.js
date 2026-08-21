// familles-de-non-livraison.js — LE VRAI CAS NE SE NOIE PLUS DANS LE BRUIT (T-20260821-0011).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QUE CE FICHIER FERME, ET CE N'EST PAS UN DÉFAUT DE COMPTE
//
// MESURÉ sur le journal du dispositif — 69 rondes, 486 cibles :
//
//     255 prises        231 NON-LIVRAISONS, toutes rangées sous le même mot
//                        ├─  98  `agent_prompt_stalled`  ← fabriquées par le dispositif lui-même
//                        ├─  57  session devant un DIALOGUE  ← BLOCAGE RÉEL, un humain doit agir
//                        ├─  50  boîte de saisie OCCUPÉE     ← BLOCAGE RÉEL
//                        ├─  18  boîte illisible
//                        └─   6  statut indisponible
//
// **107 blocages réels, noyés dans 231 lignes qui se lisent toutes pareil.**
//
// Le dispositif AVAIT l'information : les motifs diffèrent, mot à mot. C'est sa PRÉSENTATION
// qui les égalise — un total unique, et une prose qu'il fallait relire ligne à ligne pour
// distinguer celui qui méritait qu'on se lève.
//
// 🔴 CE QUE ÇA COÛTAIT : quelqu'un lit ce journal, conclut que la moitié du parc est morte, et
// RELANCE ou FAIT RENAÎTRE. Ça détruit du contexte, et ça se fait sur la foi d'un chiffre juste
// mal présenté.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ ON TRIE SUR DES CHAMPS, JAMAIS SUR LA PROSE
//
// Les motifs sont écrits pour un LECTEUR, et ils changent quand on les améliore. Un tri qui les
// analyserait par mots-clés casserait à la première reformulation — silencieusement, en
// reclassant des blocages réels en bruit. Les causes sont donc lues là où `livrerBrief` les
// POSE, sur la branche qu'il vient de prendre.

import { CAUSES, CAUSES_REPARATION } from './livraison.js';
import { ACTIVITE } from './activite-session.js';

/**
 * LES FAMILLES, DANS L'ORDRE OÙ ELLES APPELLENT UNE ACTION — ce n'est pas un détail de
 * présentation, c'est la seule chose qui rend le journal lisible en diagonale.
 */
export const FAMILLES = Object.freeze({
  /** Le brief est parti et une preuve positive l'établit. */
  PRIS: 'pris',
  /**
   * 🔴 UN HUMAIN OU L'AGENT LUI-MÊME DOIT AGIR — boîte occupée par un texte non soumis, ou
   * session devant un dialogue qui attend un choix. **C'est le seul cas qui mérite qu'on se
   * lève**, et c'était le plus difficile à voir.
   */
  BLOQUE: 'bloque',
  /** herdr n'a pas répondu, ou le pane n'existe plus. Le destinataire n'y est pour rien. */
  INJOIGNABLE: 'injoignable',
  /**
   * ⚠️ ON N'A PAS PU REGARDER — et ce n'est PAS un constat sur le destinataire. Le compter comme
   * un blocage serait déclarer mort un agent qu'on n'a pas su voir : le défaut d'origine, à
   * l'identique, sous un autre nom.
   */
  SONDE_MUETTE: 'sonde-muette',
  /** On a regardé, la session est restée au repos : rien ne prouve qu'elle a pris le brief. */
  SANS_PREUVE: 'sans-preuve',
});

/**
 * ⚠️ L'ORDRE DES QUESTIONS EST LA MOITIÉ DE LA GARDE. Une boîte coincée l'emporte sur une sonde
 * muette : le geste à poser est le même qu'on ait pu lire l'activité ou non, et rétrograder un
 * blocage réel parce qu'une sonde secondaire s'est tue le remettrait exactement là d'où ce lot
 * le sort.
 */
export function familleDeNonLivraison(resultat) {
  if (!resultat) return FAMILLES.SONDE_MUETTE;
  if (resultat.ok) return FAMILLES.PRIS;

  // ① CE QUI BLOQUE POUR DE VRAI — quelqu'un doit poser un geste devant ce pane.
  if (resultat.cause === CAUSES.ENCOMBREE || resultat.cause === CAUSES.DIALOGUE) return FAMILLES.BLOQUE;
  if (
    resultat.causeRepare === CAUSES_REPARATION.DIALOGUE ||
    resultat.causeRepare === CAUSES_REPARATION.SOUMISE ||
    resultat.causeRepare === CAUSES_REPARATION.ENVOI_REFUSE
  ) {
    // Une touche d'envoi a été tentée ou posée et la boîte n'est pas rendue : le texte y est
    // toujours. C'est un blocage, et il porte en plus un geste irréversible déjà fait.
    return FAMILLES.BLOQUE;
  }

  // ② CE QU'ON N'A PAS PU JOINDRE — l'écran ne se lit pas, ou le statut est indisponible.
  if (resultat.cause === CAUSES.ILLISIBLE || resultat.cause === CAUSES.STATUT) return FAMILLES.INJOIGNABLE;
  if (resultat.causeRepare === CAUSES_REPARATION.BOITE_ILLISIBLE) return FAMILLES.INJOIGNABLE;

  // ③ CE QU'ON N'A PAS PU REGARDER — un silence, pas un constat.
  if (resultat.activite?.apres === ACTIVITE.INDETERMINEE) return FAMILLES.SONDE_MUETTE;

  // ④ On a regardé, et il n'y avait rien à voir. C'est une DÉCISION, et elle se distingue des
  //    trois autres — c'est précisément ce que le dispositif ne savait pas dire.
  return FAMILLES.SANS_PREUVE;
}

/**
 * LE COMPTE PAR FAMILLE — parce qu'un total unique était le défaut.
 *
 * Rend TOUJOURS les cinq clés, y compris à zéro. ⚠️ Un journal dont les clés apparaissent et
 * disparaissent selon la ronde ne se compare pas d'une ronde à l'autre : « pas de blocage » et
 * « je n'ai pas compté les blocages » se liraient pareil, et c'est le motif de tout ce lot.
 */
export function comptesParFamille(comptes) {
  const t = Object.fromEntries(Object.values(FAMILLES).map((f) => [f, 0]));
  for (const c of comptes ?? []) t[c.famille ?? FAMILLES.SONDE_MUETTE] += 1;
  return t;
}

/**
 * CE QUI MÉRITE QU'ON SE LÈVE — sorti à part, en tête, nommément.
 *
 * ⚠️ POURQUOI UNE LISTE SÉPARÉE ET PAS SEULEMENT UN CHAMP `famille`. Le champ suffit à une
 * machine ; il ne suffit pas à un humain qui ouvre ce journal à 3 h du matin. La ligne qui
 * compte doit être LA PREMIÈRE CHOSE QU'IL VOIT, pas la sixième d'une liste de neuf. C'est la
 * différence exacte entre « l'information était là » et « on pouvait la lire ».
 */
export function ceQuiBloque(comptes) {
  return (comptes ?? [])
    .filter((c) => c.famille === FAMILLES.BLOQUE)
    .map((c) => ({ agent: c.agent, pane: c.pane, motif: c.motif }));
}
