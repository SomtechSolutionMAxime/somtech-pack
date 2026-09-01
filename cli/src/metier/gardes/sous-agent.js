// sous-agent.js — la garde qui tient la frontière des sous-agents (D-20260826-0010).
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QU'ELLE REMPLACE, ET POURQUOI IL A FALLU LA CONSTRUIRE
//
// Le refus d'un orchestrateur portait sur l'OUTIL NU — `permissions.deny` listait
// `Task`. Un outil nu refuse tout : l'ABC 3.0.0 (GF-ORC-002, R2.6, TOOL-ORC-010)
// renverse l'interdit — les sous-agents d'ANALYSE (lecture seule, résultat au
// ServiceDesk) deviennent les propres moyens de l'orchestrateur, pendant que la
// construction et les revues de lot restent chez les chefs d'équipe. Un `deny`
// est tout-ou-rien ; la frontière passe DANS l'outil, donc elle se tient ici.
//
// LE CRITÈRE MÉCANIQUE, ET CE QU'IL GARANTIT VRAIMENT : le TYPE de sous-agent.
// `Explore` et `Plan` sont les deux types dont l'outillage EXCLUT l'écriture de
// fichiers (pas d'Edit/Write/NotebookEdit) — un sous-agent né sous l'un d'eux ne
// peut pas construire, quel que soit son prompt. Tout autre type (`general-purpose`,
// un agent projet comme `backend`, un `fork`…) porte des outils d'écriture, ou en
// hérite : il est refusé. Leurs gestes de terminal restent jugés par la garde
// « terminal » de la même session — les hooks s'appliquent aussi aux sous-agents.
//
// ⚠️ CE QUE LE TYPE NE BORNE PAS, écrit plutôt qu'espéré : la REVUE d'un lot est
// une lecture — un sous-agent en lecture seule peut la faire. Aucune couche ne
// distingue « lire pour analyser » de « lire pour rendre un verdict de revue » :
// cette moitié de GF-ORC-002 reste tenue par le métier, pas par cette garde.
//
// ⚠️ CONSÉQUENCE SUR LA POLARITÉ, la même que la garde d'écriture : depuis que
// `Task` a quitté `permissions.deny`, cette garde porte SEULE le refus d'ouvrir
// un sous-agent de construction. Un `allow` par défaut ouvrirait tout. Hors du
// seul cas qu'elle reconnaît — un type d'analyse, chez un rôle qu'elle connaît —
// elle refuse.
//
// ⚠️ Ce module est PUR : il ne lit rien, n'écrit rien, ne touche pas au disque.
// Patron de STD-047 R3bis — fil mince dans `settings.json`, décision pure dans un
// module, refus par défaut.
//
// 🔴 CONTRAINTE SUR LES ÉVOLUTIONS FUTURES, héritée de la garde d'écriture : un
// hook qui PEND laisse le geste passer (Node est mono-thread, le minuteur du fil
// ne tire pas pendant un `while`). Cette décision reste donc LA PLUS SIMPLE
// POSSIBLE — deux appartenances d'ensemble, zéro boucle.

/** Les rôles à qui cette garde s'applique. Elle ne décide pas pour les autres. */
export const ROLES_GARDES = new Set(['orchestrateur']);

/** Le seul outil que cette garde sait juger. */
export const OUTIL_GARDE = 'Task';

/**
 * Les types de sous-agent dont l'outillage exclut l'écriture de fichiers.
 *
 * `Explore` et `Plan` sont définis par l'hôte comme « tous les outils SAUF les
 * outils d'édition » — c'est cette exclusion, pas leur nom, qui fait d'eux des
 * moyens d'analyse. Un type absent de cette table est refusé, y compris le type
 * par défaut (`general-purpose`, outillage complet) qu'on obtient en omettant
 * `subagent_type`.
 */
export const TYPES_ANALYSE = new Set(['Explore', 'Plan']);

const deny = (raison) => ({ decision: 'deny', raison });
const allow = (raison) => ({ decision: 'allow', raison });

/** La phrase que le métier fait sienne — GF-ORC-002, ABC 3.0.0. */
const PAS_A_TOI =
  "La construction et les revues de lot vivent chez les chefs d'équipe, qui distribuent chez "
  + "eux. Tes sous-agents d'analyse (lecture seule, résultat consigné au ServiceDesk) sont tes "
  + "propres moyens — ils ne portent jamais un lot.";

/**
 * Juge l'ouverture d'un sous-agent.
 *
 * @param {{outil?:string, typeSousAgent?:string, role?:string}} req
 *   `typeSousAgent` est le `subagent_type` de la requête `Task` — absent quand
 *   l'appelant s'en remet au type par défaut, qui porte l'outillage complet.
 * @returns {{decision:'allow'|'deny', raison:string}}
 */
export function juger(req = {}) {
  const { outil, typeSousAgent, role = 'orchestrateur' } = req;

  // ⚠️ Un rôle inconnu ne rend PAS `allow` — voir la note de polarité en tête.
  if (!ROLES_GARDES.has(role)) {
    return deny(
      `Cette garde ne connaît pas le rôle « ${role} », et elle ne sait donc pas quels `
      + "sous-agents il a le droit d'ouvrir. Elle refuse plutôt que de le supposer : depuis "
      + "qu'elle porte le refus à elle seule, un « oui » par défaut ouvrirait tout.",
    );
  }

  if (outil !== OUTIL_GARDE) {
    return deny(
      "La garde des sous-agents n'a pas reconnu l'outil qu'on lui demande de juger "
      + `(« ${outil ?? 'aucun'} »). Elle refuse plutôt que de laisser passer ce qu'elle n'a pas vu.`,
    );
  }

  if (typeof typeSousAgent !== 'string' || typeSousAgent.trim() === '') {
    return deny(
      "Ce geste ouvre un sous-agent sans déclarer son type — le type par défaut porte "
      + `l'outillage complet, écriture comprise. ${PAS_A_TOI}`,
    );
  }

  if (!TYPES_ANALYSE.has(typeSousAgent)) {
    return deny(
      `Ce geste ouvre un sous-agent « ${typeSousAgent} », dont l'outillage n'exclut pas `
      + `l'écriture. ${PAS_A_TOI} La question n'est pas « puis-je ? » mais « pourquoi ce `
      + 'travail est-il tombé chez moi plutôt que chez un chef d\'équipe ? ».',
    );
  }

  return allow(
    `Un sous-agent « ${typeSousAgent} » est un moyen d'analyse : son outillage exclut `
    + "l'écriture de fichiers, et mener tes analyses de tes propres moyens est ton métier "
    + '(R2.6). Le résultat durable s\'inscrit au ServiceDesk — un résultat qui meurt avec '
    + 'la session n\'a pas été rendu.',
  );
}
