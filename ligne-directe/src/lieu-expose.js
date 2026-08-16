// lieu-expose.js — UN LIEU QU'UN TIERS PEUT RETIRER SOUS SON AGENT (T-20260814-0014).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE FAIT — deux occurrences de ce défaut — le ticket en compte cinq, dont trois relèvent d’une autre surface
//
// Le lieu d'un orchestrateur vit sous `.orchestrateur/<nom>/` dans l'arbre de travail du dépôt
// **partagé**. Qu'une autre session bascule ce dépôt sur une branche qui ne porte pas ce
// répertoire, et le répertoire courant de l'agent disparaît **en pleine session**.
//
// Deux orchestrateurs l'ont vécu. L'un travaillait encore sans le savoir — son métier était
// chargé en contexte, pas relu sur le disque — et **n'aurait pas survécu à un redémarrage** :
// il ne saurait plus ni qui il est, ni quelle est sa portée. Rien ne le lui disait.
//
// Ses exécutants, eux, naissent chacun dans un worktree à eux. **C'est un renversement complet
// de la protection : ceux qui vivent quelques heures sont isolés ; celui qui vit des jours ne
// l'est pas.**
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// LE CRITÈRE, ET POURQUOI CE N'EST PAS « EST-CE SUR LA BRANCHE PAR DÉFAUT »
//
// ⚠️ La première formulation demandait si le lieu est porté par `main`. **Elle aurait déclaré
// sain le pire des cas**, mesuré le 2026-08-16 sur un orchestrateur vivant : son lieu n'est
// porté que par sa propre branche, et **cette branche est celle qui est sortie**. Tout paraît
// normal, rien ne se voit, et il suffit d'un `git checkout` par n'importe qui.
//
// Le critère est donc **combien de branches portent le lieu, et lesquelles** — jamais laquelle
// est sortie. Un lieu porté par une seule branche est exposé même quand c'est la sienne.
//
// ⚠️ ET CE MODULE NE RÉPARE RIEN. Le rattrapage évident est le plus dommageable : rétablir la
// branche remettrait les fichiers **et écraserait le travail de la session qui y a commité
// depuis**. Le ticket le dit deux fois. On nomme, on ne force pas — et le geste qu'on nomme
// n'est jamais celui-là.

/** Les trois façons dont un lieu peut être retiré à celui qui l'habite. */
export const RISQUE = {
  /** Aucun commit ne le porte : un `git clean` l'emporte, et rien ne le restaure. */
  AUCUNE_BRANCHE: 'aucune-branche',
  /** Une seule branche le porte — même si c'est celle qui est sortie. */
  UNE_SEULE_BRANCHE: 'une-seule-branche',
  /** Plusieurs branches, mais aucune n'est celle dont les autres descendent. */
  PAS_SUR_LA_PAR_DEFAUT: 'pas-sur-la-branche-par-defaut',
};

/** La branche dont les autres descendent — la seule qui met un lieu à l'abri. */
const PAR_DEFAUT = /(^|\/)main$/;

/**
 * Le geste qui met le lieu à l'abri — jamais celui qui rétablit une branche partagée.
 *
 * ⚠️ IL NOMME SA SORTIE (invariant de `T-20260816-0045`) et il dit **à qui elle appartient** :
 * verser un lieu sur la branche par défaut passe par une fusion, que l'agent qui l'habite n'a
 * pas toujours le droit de faire. Un signalement qui laisserait croire le contraire enverrait
 * quelqu'un se heurter à ses propres droits.
 */
function gesteQuiLeve(lieu) {
  return (
    `verse « ${lieu} » sur la branche par défaut — une fois porté par « main », il l'est par ` +
    `tout ce qui en descend, et aucun changement de branche ne peut plus le retirer. ` +
    `Ça passe par une fusion : c'est le geste de qui peut fusionner, pas de qui habite le lieu.`
  );
}

/**
 * Ce lieu peut-il être retiré sous son agent ? — ou `null` s'il n'y a rien à dire.
 *
 * `branchesQuiPortent` est la liste **mesurée** des branches dont un commit contient le lieu.
 *
 * ⚠️ ON NE CONCLUT PAS D'UNE ABSENCE DE MESURE. Une interrogation de git qui échoue rendrait
 * une liste vide, et « vide » vaut ici l'alarme maximale — on signalerait un lieu parfaitement
 * sain au motif qu'on n'a pas su regarder. `null`/`undefined` veut donc dire « pas mesuré » et
 * fait taire ce module, là où `[]` veut dire « mesuré, et rien ne le porte ».
 */
export function expositionDuLieu({ lieu, branchesQuiPortent, brancheCourante } = {}) {
  if (!lieu) return null;
  if (!Array.isArray(branchesQuiPortent)) return null; // pas mesuré : on se tait

  const geste = gesteQuiLeve(lieu);
  const commun = { lieu, branches: branchesQuiPortent, branche_courante: brancheCourante ?? null, geste };

  if (branchesQuiPortent.length === 0) {
    return {
      ...commun,
      risque: RISQUE.AUCUNE_BRANCHE,
      quoi:
        `« ${lieu} » n'est porté par aucune branche — il n'est pas versionné du tout. Un ` +
        `nettoyage de l'arbre l'emporterait, et il n'y aurait rien d'où le reprendre.`,
    };
  }

  if (branchesQuiPortent.some((b) => PAR_DEFAUT.test(String(b)))) return null;

  if (branchesQuiPortent.length === 1) {
    return {
      ...commun,
      risque: RISQUE.UNE_SEULE_BRANCHE,
      quoi:
        `« ${lieu} » n'est porté que par une seule branche (${branchesQuiPortent[0]}). Il ` +
        `disparaîtra de l'arbre dès que quelqu'un en changera — y compris si c'est ` +
        `aujourd'hui la branche sortie : rien ne se voit tant que personne ne bouge.`,
    };
  }

  // ⚠️ LE NOMBRE NE SUFFIT PAS. Deux branches de travail peuvent disparaître toutes les deux ;
  // seule celle dont les autres descendent porte le lieu partout.
  return {
    ...commun,
    risque: RISQUE.PAS_SUR_LA_PAR_DEFAUT,
    quoi:
      `« ${lieu} » est porté par ${branchesQuiPortent.length} branches, mais aucune n'est la ` +
      `branche par défaut — elles peuvent toutes disparaître, et le lieu avec.`,
  };
}
