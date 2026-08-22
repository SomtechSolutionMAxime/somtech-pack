// formes-reelles.js — LES FORMES QUE herdr REND VRAIMENT, capturées et datées.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE — le même défaut trois fois dans un seul lot
//
// Trois fois, un banc de ce module a été tenu vert par un COLLABORATEUR IMAGINAIRE :
//
//   ① un `roleDuLieu` injecté qui JETTE, là où le vrai se tait — l'état qu'il gardait était
//      structurellement inatteignable en production, et le banc restait vert ;
//   ② un `{ agent: null }` pour un pane sans agent — forme que `herdr pane list` ne produit
//      JAMAIS : il OMET la clé. La garde n'écartait donc rien, et trois terminaux du poste
//      étaient rendus comme des agents vivants ;
//   ③ un paramètre `reference` au singulier, mort depuis un renommage — le banc mesurait
//      « aucune référence donnée » sous le titre « une référence introuvable ».
//
// > Les trois ont la MÊME forme : quelqu'un a écrit à la main ce qu'il croyait que la source
// > rendait, et personne n'a jamais comparé. Ce n'est plus un défaut, c'est une propriété du
// > banc — et la corriger au cas par cas ne l'arrête pas.
//
// ⚠️ CE FICHIER N'INTERDIT PAS D'INJECTER — ce serait impossible ici. Ce module est conçu pour
// que TOUTE l'I/O entre par paramètre : c'est ce qui le rend éprouvable en chaîne, loin des
// agents vivants. Ce qui manquait n'est pas moins d'injection, c'est que la CONFORMITÉ du
// double à la source soit MESURÉE au lieu d'être crue.
//
// Il porte donc deux choses :
//   • un ÉCHANTILLON RÉEL, daté, avec sa provenance — ce que `herdr pane list` a rendu ;
//   • des FABRIQUES qui produisent cette forme, pour que les bancs cessent de l'inventer.
//
// La garde qui l'accompagne (`les-formes-des-doubles.test.js`) compare les fabriques à
// l'échantillon : si l'une dérive, elle rougit.

/**
 * CE QUE `herdr pane list` A RENDU, LE 2026-08-22 À 09 H 30, SUR LES 97 PANES DU POSTE.
 *
 * Relevé par `herdr.panes()`, agrégé sur les 13 sessions du poste, réduit aux CLÉS et à leur
 * présence — aucune donnée d'agent réel n'est recopiée ici.
 *
 * ⚠️ CE QU'IL FAUT EN LIRE, ET QUI A COÛTÉ UN REJET : `agent: null` n'existe pas. Un pane sans
 * agent OMET la clé et porte `agent_status: "unknown"`. Et `agent_session` est le discriminant
 * réel — présent sur les 94 qui portent un agent, absent sur les 3 terminaux.
 */
export const ECHANTILLON_PANES = {
  releve_le: '2026-08-22T09:30:00-04:00',
  provenance: 'herdr.panes() — 13 sessions agrégées, poste de développement',
  total: 97,
  formes: [
    { compte: 57, agent: true, agent_session: true, agent_status: 'done' },
    { compte: 34, agent: true, agent_session: true, agent_status: 'idle' },
    { compte: 3, agent: false, agent_session: false, agent_status: 'unknown' },
    { compte: 2, agent: true, agent_session: true, agent_status: 'blocked' },
    { compte: 1, agent: true, agent_session: true, agent_status: 'working' },
  ],
  /** Ce que la source ne produit JAMAIS — mesuré, pas supposé. */
  jamais: {
    'agent: null': 0,
    'agent_session sans agent': 0,
    'clé agent absente avec un statut ≠ unknown': 0,
  },
};

/** Un pane qui PORTE un agent, tel que herdr le rend. */
export function unPaneDAgent({ pane_id = 'w1:p1', statut = 'idle', ...reste } = {}) {
  return {
    pane_id,
    agent: 'claude',
    agent_session: { agent: 'claude', kind: 'id', value: `session-${pane_id}` },
    agent_status: statut,
    ...reste,
  };
}

/**
 * Un pane qui NE porte PAS d'agent — un terminal.
 *
 * ⚠️ PAS DE CLÉ `agent`, ET C'EST TOUT L'OBJET DE CETTE FABRIQUE. Écrire `{ agent: null }` est
 * le geste naturel, et c'est celui qui a laissé trois terminaux passer pour des agents.
 */
export function unPaneSansAgent({ pane_id = 'w1:p2', ...reste } = {}) {
  return { pane_id, agent_status: 'unknown', ...reste };
}

/**
 * Un pane qu'une session d'agent HABITE, mais dont herdr ignore le statut.
 *
 * C'est la forme mesurée de T-20260820-0022 : toute session née après le 18 août 14 h 52 sortait
 * ainsi. La confondre avec un terminal fait DISPARAÎTRE un agent vivant du registre.
 */
export function unPaneHabiteSansStatut({ pane_id = 'w1:p3', ...reste } = {}) {
  return {
    pane_id,
    agent_status: 'unknown',
    agent_session: { agent: 'claude', kind: 'id', value: `session-${pane_id}` },
    ...reste,
  };
}
