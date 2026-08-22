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
  /**
   * ⚠️ « 13 SESSIONS AGRÉGÉES » ÉTAIT FAUX, ET C'ÉTAIT LA MÊME FAUTE QUE LE `jamais`.
   *
   * Mesuré : 13 sessions INTERROGÉES, **3 ont répondu**, 10 muettes (`server_not_running`). Le
   * relevé couvre donc 3 sessions sur 13 — et il l'écrivait comme une couverture complète. Un
   * relevé qui ne déclare pas ce qu'il n'a pas vu est exactement ce que ce module interdit
   * partout ailleurs : son propre compte est un PLANCHER, pas un total.
   */
  provenance: 'herdr.panes() — 3 sessions ayant répondu sur 13 interrogées (10 muettes), poste de développement',
  sessions: { interrogees: 13, repondu: 3, muettes: 10 },
  /**
   * Ce que ce relevé compte est un PLANCHER, comme le recensement lui-même : 10 sessions n'ont
   * pas répondu, donc des panes existent qu'il n'a pas vus.
   */
  total: 97,
  nature_du_total: 'plancher',
  formes: [
    { compte: 57, agent: true, agent_session: true, agent_status: 'done' },
    { compte: 34, agent: true, agent_session: true, agent_status: 'idle' },
    { compte: 3, agent: false, agent_session: false, agent_status: 'unknown' },
    { compte: 2, agent: true, agent_session: true, agent_status: 'blocked' },
    { compte: 1, agent: true, agent_session: true, agent_status: 'working' },
  ],
  /**
   * Ce qui n'a AUCUNE occurrence dans CE relevé — un compte, pas une propriété.
   *
   * ⚠️ CE CHAMP S'EST APPELÉ `jamais`, ET C'ÉTAIT FAUX — trouvé par les deux passes du cycle 6,
   * dans le fichier même qui existe pour empêcher de croire une forme sans l'avoir mesurée.
   *
   * Il déclarait « `agent_session` sans `agent` : JAMAIS ». Or c'est exactement la forme que
   * T-20260820-0022 a MESURÉE le 2026-08-20 — toute session née après le 18 août 14 h 52 sortait
   * ainsi — et c'est la raison d'être de la protection `agent_session` dans `recensement.js`.
   * J'avais transformé « zéro occurrence aujourd'hui » en « jamais » : un verdict tiré d'une
   * ABSENCE, dans la pièce posée pour interdire ce geste. Le risque n'est pas théorique — un
   * lecteur qui croit ce « jamais » retire la protection qui empêche un agent vivant d'être
   * effacé du registre.
   *
   * Le champ compte donc ce que CE relevé n'a pas vu, et nomme à côté ce qui a été vu AILLEURS.
   */
  aucune_occurrence_dans_ce_releve: {
    'agent: null': 0,
    'clé agent absente avec un statut ≠ unknown': 0,
    'agent_session sans clé agent': 0,
  },
  /**
   * Ce qu'un AUTRE relevé a vu, et que celui-ci n'a pas — la moitié qui manquait.
   *
   * Sans elle, « 0 occurrence » se lit « n'existe pas », et c'est le pas exact qui a produit le
   * faux « jamais ».
   */
  vu_ailleurs: {
    /**
     * ⚠️ LES TROIS ENTRÉES SONT TRAITÉES, PAS UNE SEULE — relevé au cycle 7, et la réserve était
     * juste : le remède du cycle 6 n'avait été appliqué qu'à l'entrée qui l'avait déclenché. Un
     * lecteur appliquant le raisonnement corrigé (« 0 ici, rien dans `vu_ailleurs` ») aurait
     * conclu que les deux autres branches sont mortes — dont celle qui déclenche
     * `panesIndecidables`, donc toute la distinction plancher / incertain.
     */
    'clé agent absente avec un statut ≠ unknown': {
      ou: '[non mesurée] — aucun relevé connu ne l’a vue',
      quoi:
        'aucune source ne l’a produite à ce jour ; ce n’est PAS une preuve qu’elle n’existe pas, ' +
        'c’est l’aveu qu’on n’a pas de mesure',
      consequence:
        'c’est elle qui déclenche `panesIndecidables`, donc `borne.nature: incertaine` — la ' +
        'branche se garde justement parce qu’on ne peut pas prouver qu’elle est morte',
    },
    'agent: null': {
      ou: '[non mesurée] — aucun relevé connu ne l’a vue',
      quoi: 'la forme que trois bancs ont pourtant fabriquée à la main, et qui a coûté un rejet',
      consequence:
        'la défense `|| !p.agent` de `recensement.js` la couvre — on ne la retire pas sur la foi ' +
        'd’un relevé qui ne l’a pas vue',
    },
    'agent_session sans clé agent': {
      ou: 'T-20260820-0022, mesuré le 2026-08-20',
      quoi:
        'toute session née après le 18 août 14 h 52 sortait avec `agent_session` présent, aucune ' +
        'clé `agent`, et `agent_status: "unknown"` — herdr ignorait son statut, pas son existence',
      consequence:
        'c’est la forme que `unPaneHabiteSansStatut` fabrique, et que la protection `agent_session` ' +
        'de `recensement.js` existe pour ne pas confondre avec un terminal',
    },
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
