// hygiene.js — LE REGISTRE CESSE DE MENTIR, IL N'EST PAS FILTRÉ (T-20260816-0083).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE FAIT
//
// Une ligne dont le worktree a disparu du disque reste ouverte au registre, attachée à un
// numéro de pane que le poste peut réattribuer à n'importe quel chantier. Le prochain occupant
// hérite alors d'une ligne ouverte pour un client dont il n'a jamais entendu parler.
//
//   > Une ligne qu'on abandonne sans la refermer ne reste pas inerte : elle attend le
//   > prochain occupant du numéro. — `T-20260816-0003`
//
// MESURÉ sur le registre du poste le 2026-08-16, et cette mesure a dû être REFAITE : le premier
// compte annonçait « 2 lignes ouvertes sur 42 » en filtrant sur un champ qui n'existe pas au
// registre (`fermee_le`) — donc en ne filtrant rien. Sur le vrai champ (`close_le`) : **25
// lignes ouvertes, aucune au chantier disparu** ; les 2 lignes concernées sont **closes**.
//
// ⚠️ CE QUE ÇA CHANGE, ET IL FAUT LE DIRE : le mécanisme est réel — une ligne ouverte qu'on
// n'a pas refermée attend le prochain occupant de son pane — mais AUCUNE occurrence vivante
// n'est observée aujourd'hui. Cette passe est une prévention, pas la réponse à un incident en
// cours. Elle coûte une lecture de registre par ronde et ne se déclenche que sur preuve.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI UNE HYGIÈNE ET PAS UN FILTRE — l'arbitrage, et sa raison
//
// La première écriture posait la garde dans `ligneDuPane` : la ligne morte cessait d'être
// proposée. Ça marchait, et c'était la mauvaise place.
//
// **Un filtre à la sélection laisse le registre DIRE que la ligne est ouverte pendant qu'on la
// cache.** Deux sources de vérité qui divergent en silence — le motif exact que ce dépôt paie
// le plus cher, et qu'il a passé deux jours à fermer ailleurs. Une passe d'hygiène fait que le
// registre **cesse de mentir** au lieu d'en corriger la lecture : on soigne le fait, pas sa
// lecture.
//
// Un second symptôme le confirmait : brancher le disque dans la sélection faisait rougir 26
// essais dont les registres portent des chemins inventés. Ce n'est PAS la raison du choix —
// une garde bien placée mérite qu'on paie son nettoyage — mais c'est ce qui a fait regarder.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CETTE PASSE NE FAIT PAS
//
// ⚠️ ELLE SIGNALE, ELLE NE FERME RIEN. Refermer une ligne à tort ferait taire un canal client.
// C'est la même règle que la ronde et la vigie : on nomme, on ne force pas. Et conformément à
// l'invariant de `T-20260816-0045`, ce signalement **nomme sa sortie** — la commande exacte qui
// referme la ligne, et l'endroit d'où elle doit être lancée.
//
// ⚠️ ON N'ÉCARTE QUE SUR PREUVE. Un chemin qu'on n'a pas pu lire n'est pas un chemin absent.
// Un worktree non enregistré, vide, ou illisible ne prouve RIEN et ne fait rien signaler. C'est
// la même distinction que « boîte vide » et « message livré » — et l'erreur que le correctif de
// `T-20260816-0003` a déjà payée vingt essais rouges, en rendant des lignes injoignables au nom
// d'une absence de donnée.

/**
 * Le geste qui referme une ligne, écrit avec ses valeurs réelles — jamais un gabarit.
 *
 * ⚠️ ET IL DIT D'OÙ LE LANCER. `fermer` choisit parmi les lignes du pane courant : la commande
 * seule ne suffit donc pas, il faut être au bon endroit. Un conseil qu'on ne peut pas exécuter
 * là où on le lit est un demi-geste, c'est-à-dire le défaut que `T-20260816-0045` a fermé.
 */
export function gesteDeFermeture(ligne) {
  const chantier = ligne?.chantier ?? '';
  const pane = ligne?.pane ?? null;
  const commande = `ligne-directe fermer --a ${chantier}`;
  return pane
    ? `depuis le pane « ${pane} » : \`${commande}\``
    : `\`${commande}\` (depuis le pane qui porte cette ligne)`;
}

/**
 * Les lignes ouvertes dont le chantier a disparu du disque — et rien d'autre.
 *
 * `chantierExiste` est INJECTÉ : ce module rend un jugement, il ne va pas chercher le disque
 * de lui-même. C'est ce qui le rend éprouvable sans monter un poste, et ce qui garantit qu'il
 * ne s'active pas tout seul là où personne ne le lui a demandé.
 */
export function lignesAuChantierDisparu(ouvertes, { chantierExiste } = {}) {
  if (typeof chantierExiste !== 'function') return [];
  return (ouvertes || [])
    .filter((l) => {
      const w = typeof l?.worktree === 'string' ? l.worktree.trim() : '';
      if (!w) return false; // pas de worktree connu : aucune preuve, aucun signalement
      try {
        return !chantierExiste(w);
      } catch {
        return false; // un chemin qu'on n'a pas pu interroger n'est pas un chemin absent
      }
    })
    .map((l) => ({
      chantier: l.chantier ?? null,
      canal_nom: l.canal_nom ?? null,
      pane: l.pane ?? null,
      worktree: l.worktree,
      geste: gesteDeFermeture(l),
    }));
}

/**
 * Ce qu'on écrit à un humain — ce qui bloque, avec les valeurs trouvées, et le geste qui lève.
 *
 * Rend `null` quand il n'y a rien à dire : une passe d'hygiène qui parle pour ne rien dire
 * finit par n'être plus lue, et emporte avec elle le jour où elle avait raison.
 */
export function avisDHygiene(mortes) {
  if (!mortes?.length) return null;
  const lignes = mortes.map(
    (m) => `  • « ${m.chantier} » (#${m.canal_nom}) — chantier disparu : ${m.worktree}\n    → ${m.geste}`
  );
  return (
    `${mortes.length} ligne(s) ouverte(s) pointent vers un chantier qui n'existe plus. Elles ` +
    `attendent le prochain occupant de leur pane, avec un canal ouvert pour un autre client :\n` +
    `${lignes.join('\n')}\n` +
    `Rien n'a été fermé — refermer une ligne à tort ferait taire un canal client.`
  );
}
