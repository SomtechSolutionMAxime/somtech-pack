// UN TERMINAL, POUR ÉPROUVER CE QUE LE LECTEUR VOIT — pas ce que la chaîne contient.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 POURQUOI CE FICHIER EXISTE : UN VERT QUI NE TOUCHAIT PAS CE QU'IL PRÉTENDAIT ÉPROUVER
//
// Le banc de l'invariant de largeur faisait `texte.includes('q quitter')` sur la chaîne
// LOGIQUE. Il ne pouvait donc pas voir qu'un terminal **wrappe** une ligne trop longue et
// **fait défiler** ce qui précède. Le défaut a traversé TROIS corrections successives derrière
// ce vert — chacune corrigeait ce que le banc savait regarder.
//
// Mesuré au VT100 sur le flux exact de `dessiner()`, avant la décision `00a7b645` : à 3×1 le
// lecteur voyait `'ter'`, à 8×2 `'q quitte'` / `'r'` — **et le titre avait disparu**.
//
// ⚠️ CE N'EST PAS UN PIS-ALLER, C'EST LE SEUL INSTRUMENT QUI ATTEINT LE CAS. Mesuré sur ce
// poste : un pane herdr ne descend pas sous **12 colonnes** (un split, cinq rétrécissements,
// plancher à 12). La branche « sous le seuil » n'est donc PAS atteignable dans un vrai pane —
// mais le TUI vit hors de herdr, et n'importe quel terminal peut être à 3 colonnes.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// CE MODÈLE EST PROUVÉ CONFORME AVANT D'ÊTRE UTILISÉ
//
// Un double non conforme ne rate pas seulement un défaut : il en FABRIQUE dans les gardes qui
// s'appuient dessus. Celui-ci a été confronté à `pyte` (émulateur VT100/xterm complet) sur les
// cas mêmes qui ont révélé le défaut — 3×1, 5×1, 8×1, 8×2, 9×1, 20×3, et un cas multi-lignes :
// **0 écart sur 7**. La confrontation vit dans le scratchpad de la session, pas ici — ce fichier
// ne dépend d'aucun paquet externe, pour que la suite reste éprouvable sans installation.
//
// ⚠️ CE QU'IL MODÉLISE, ET RIEN D'AUTRE : l'auto-wrap (une ligne de n points de code sur `cols`
// colonnes occupe ⌈n/cols⌉ rangées) et le défilement (seules les `rows` dernières rangées
// restent visibles). Il ne modélise ni les couleurs, ni le curseur, ni les modes — le TUI
// repeint l'écran entier à chaque frame, donc rien de tout cela n'entre dans la propriété.

/** Les rangées PHYSIQUES qu'un écran logique occupe une fois écrit sur `cols` colonnes. */
export function rangeesPhysiques(lignes, cols) {
  return lignes.reduce((n, l) => {
    const long = [...String(l?.texte ?? l ?? '')].length;
    return n + Math.max(1, Math.ceil(long / cols));
  }, 0);
}

/**
 * CE QUE LE LECTEUR VOIT ENCORE — les `rows` dernières rangées, le reste ayant défilé.
 *
 * ⚠️ C'EST LA SEULE FORME QUI RÉVÈLE LE DÉFAUT. Une ligne trop longue ne se contente pas de
 * dépasser : elle POUSSE ce qui la précède hors de l'écran.
 */
export function ecranVisible(lignes, cols, rows) {
  const rangees = [];
  for (const l of lignes) {
    const pts = [...String(l?.texte ?? l ?? '')];
    if (pts.length === 0) rangees.push('');
    for (let i = 0; i < pts.length; i += cols) rangees.push(pts.slice(i, i + cols).join(''));
  }
  return rangees.slice(-rows);
}

/** Le texte que le lecteur voit, toutes rangées visibles confondues. */
export function texteVisible(lignes, cols, rows) {
  return ecranVisible(lignes, cols, rows).join('\n');
}
