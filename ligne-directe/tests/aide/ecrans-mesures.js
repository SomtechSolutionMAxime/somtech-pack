// ecrans-mesures.js — LES ÉCRANS RÉELS DE CE POSTE, FIGÉS (E-20260821-0003).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ AUCUN DE CES ÉCRANS N'EST ÉCRIT DE MÉMOIRE. Chacun a été capturé le 2026-08-21 par
// `herdr pane read <pane> --format ansi` sur un pane vivant du poste, puis recopié ici
// caractère pour caractère — séquences ANSI comprises, puisque ce sont elles qui portent
// le seul discriminant que ce dispositif sache lire.
//
// 🔴 POURQUOI ILS SONT FIGÉS ICI. Les panes de ce poste sont INTERMITTENTS : durée de vie
// observée entre 110 s et 15 min. Une mesure prise sur eux ne se rejoue pas — elle se
// perd. Le banc qui les rejoue est donc le seul endroit où ces cas survivent à leur pane.
//
// ⚠️ ET ILS NE REMPLACENT PAS LA MESURE SUR LE POSTE. Un écran figé prouve qu'une forme
// connue est traitée ; il ne prouve jamais qu'aucune autre forme n'existe. Le mot juste
// pour ce qu'on n'a pas mesuré reste `[non établi]`.

const ESC = String.fromCharCode(27);

/** Le filet nu qui encadre la boîte de saisie d'une session ordinaire. */
const FILET_NU = '─'.repeat(157);

/**
 * ① LA BORDURE TITRÉE — l'écran qui a rendu `bonaventure` injoignable.
 *
 * 🔴 MESURÉ SUR `w7M:p2` le 2026-08-21 à 15 h 07, lignes 32 à 36 de son dump, recopiées
 * telles quelles. Une session **rattachée** (ouverte par `claude agents`) porte le nom de
 * son chantier DANS le filet haut, rendu en inversé — fond cyan, texte noir.
 *
 * ⚠️ LES DEUX FILETS FONT LA MÊME LONGUEUR À L'ÉCRAN et sont indistinguables à l'œil : le
 * haut fait 165 caractères une fois les séquences retirées, le bas aussi. Le seul écart
 * est que le haut porte 30 caractères de titre là où le bas n'a que du tracé — et c'est
 * exactement ce qu'une sonde qui exige « rien que du tracé » refuse de reconnaître.
 *
 * ⚠️ SA BOÎTE PORTE UN TEXTE GRISÉ (`ESC[2m`), donc une SUGGESTION — pas un texte à
 * soumettre. C'est un fait de la mesure, et il corrige au passage une attente : l'état
 * juste de ce pane n'est pas `vide` mais `suggestion`. Les deux se conduisent pareil —
 * il n'y a rien à soumettre — et aucun des deux n'est `illisible`.
 */
export const BORDURE_TITREE = [
  `                    ${ESC}[0m${ESC}[38;5;7mnew task? ${ESC}[0m${ESC}[38;5;12m/clear${ESC}[0m${ESC}[38;5;7m to save ${ESC}[0m${ESC}[38;5;12m941.6k tokens${ESC}[0m`,
  `${ESC}[0m${ESC}[38;5;14m${'─'.repeat(133)}${ESC}[0m${ESC}[38;5;0m${ESC}[48;5;14m CRM ActionProgex finalisation ${ESC}[0m${ESC}[38;5;14m─${ESC}[0m`,
  `❯ ${ESC}[0m${ESC}[2mRien à signaler, silence.${ESC}[0m`,
  `${ESC}[0m${ESC}[38;5;14m${FILET_NU}${ESC}[0m`,
  `  ${ESC}[0m${ESC}[38;5;11m⏵⏵ auto mode on${ESC}[0m${ESC}[38;5;7m (shift+tab to cycle) · ← for agents${ESC}[0m`,
].join('\n');

/**
 * ② LA SUGGESTION GRISÉE sur une session ORDINAIRE — le cas des ~3 h perdues deux fois le
 * 2026-08-19, et le contrôle qui prouve qu'on n'a pas cassé ce qui marchait.
 */
export const SUGGESTION_GRISEE = [
  '⏺ un travail quelconque au-dessus',
  FILET_NU,
  `❯ ${ESC}[2mignore that, check the staging sas on this repo${ESC}[22m`,
  FILET_NU,
  '  ⏵⏵ auto mode on (shift+tab to cycle)',
].join('\n');

/** ③ UNE BOÎTE FRANCHEMENT VIDE, sur une session ordinaire. */
export const BOITE_VIDE = [
  '⏺ un travail quelconque au-dessus',
  FILET_NU,
  '❯ ',
  FILET_NU,
  '  ⏵⏵ auto mode on (shift+tab to cycle)',
].join('\n');

/**
 * ④ UN SHELL DÉTACHÉ — un pane qui n'est PAS une session Claude Code.
 *
 * ⚠️ `illisible` EST LE VERDICT HONNÊTE ICI, et il doit le rester. Sur les 297 lectures du
 * poste mesurées le 2026-08-21, 135 des 141 boîtes non lues étaient de cette nature : il
 * n'y a pas de boîte de saisie à lire, et prétendre le contraire serait le défaut inverse
 * de celui qu'on ferme.
 */
export const SHELL_DETACHE = [
  'maximeleboeuf@Mac somtech-pack % git status',
  'On branch main',
  'nothing to commit, working tree clean',
  'maximeleboeuf@Mac somtech-pack % ',
].join('\n');

/**
 * ⑤ UNE BOÎTE PLEINE — un texte arrivé par COLLAGE, dont l'écran ne montre qu'un repli.
 *
 * ⚠️ C'EST LE CAS QU'ON NE DOIT JAMAIS DÉCLARER VIDE. Écrire par-dessus collerait deux
 * textes que personne n'a écrits ensemble en un seul message, et le soumettrait.
 */
export const BOITE_PLEINE = [
  '⏺ un travail quelconque au-dessus',
  FILET_NU,
  '❯ [Pasted text #137 +19 lines]',
  FILET_NU,
  '  ⏵⏵ auto mode on (shift+tab to cycle)',
].join('\n');

/**
 * ⑥ UN VRAI DIALOGUE DE PERMISSION — mesuré le 2026-08-17, et il a FAIT EXÉCUTER une
 * commande : le texte envoyé n'a pas été reçu comme un message, il a servi de confirmation.
 *
 * ⚠️ CE CAS EXISTE POUR PROUVER QU'ON NE L'A PAS DÉSARMÉ en corrigeant le faux motif.
 */
export const DIALOGUE_ACTIF = [
  '⏺ Do you want to proceed?',
  '  ❯ 1. Yes',
  '    2. No',
  FILET_NU,
  '❯ ',
  FILET_NU,
].join('\n');

/**
 * ⑦ CE QUE `herdr` REND QUAND LA LECTURE ÉCHOUE — sur stdout, avec un code de sortie 1.
 *
 * 🔴 CE N'EST PAS UN ÉCRAN, ET TOUT LE DÉFAUT EST DE L'AVOIR TRAITÉ COMME TEL. Mesuré le
 * 2026-08-21 : `herdr agent read w0:p24 --format ansi` rend cette ligne, que le lecteur
 * rendait ensuite comme s'il s'agissait du terminal du destinataire. Aucun filet dedans,
 * donc « boîte illisible » — c'est-à-dire un verdict sur l'écran d'autrui, tiré d'un aveu
 * sur soi.
 */
export const ERREUR_HERDR =
  '{"error":{"code":"agent_not_found","message":"agent target w0:p24 not found"},"id":"cli:agent:read"}\n';
