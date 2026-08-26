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
// 🔴 CECI EST UN DOUBLE DU TERMINAL. SA FIDÉLITÉ N'EST PAS ÉPROUVÉE DANS CE DÉPÔT.
//
// Un double non conforme ne rate pas seulement un défaut : il en FABRIQUE dans les gardes qui
// s'appuient dessus. Celui-ci a été confronté à un vrai émulateur VT100 hors du dépôt — mais
// cette confrontation n'est rejouable par personne ici, donc **elle ne compte pas comme preuve**.
//
// ⚠️ UN CHIFFRE PRÉCIS TENAIT CETTE PLACE, ET IL EN A ÉTÉ RETIRÉ. Une mesure invérifiable posée
// à côté du code n'est pas faible : elle est AUTORITAIRE. Elle ne laisse pas un doute que le
// lecteur ira lever — elle FERME la question, et personne ne remesure jamais.
//
// ⚠️ CE QUI GARDE LA PROPRIÉTÉ NE DÉPEND PAS DE CE FICHIER. L'invariant « rien de ce que le TUI
// écrit ne dépasse la largeur du pane » est gardé par une mesure DIRECTE — `largeurAffichee(texte)
// <= largeur` — à quatre endroits de `rien-ne-deborde-du-pane.test.js`. Ce modèle est un SECOND
// instrument, indépendant du premier : il attrape le même défaut par une autre route (une ligne
// plus longue que `cols` occupe plus d'une rangée, donc la somme dépasse `rows`). Deux
// instruments indépendants valent mieux qu'un, même en disant honnêtement de l'un ce qu'il est.
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

/**
 * UN TERMINAL QUI SAIT REVENIR EN ARRIÈRE ET EFFACER — le sous-ensemble VT100 que l'incident
 * du dirigeant met en jeu, et que le modèle ci-dessus ne pouvait pas voir.
 *
 * 🔴 CE QU'IL EXISTE POUR REPRODUIRE, ET QU'AUCUN AUTRE INSTRUMENT DU DÉPÔT N'ATTEINT :
 * la ligne de progression est écrite DROIT AU TERMINAL par `avecProgression`, pas composée par
 * `rendreEcran`. Elle ne passe donc PAS par `borner`. C'est elle qui a produit l'incident :
 * 116 caractères fixes, réécrits toutes les 120 ms avec un retour chariot et un effacement de
 * ligne. Sous 116 colonnes le texte WRAPPE ; le retour chariot du tour suivant revient au début
 * de la rangée PHYSIQUE COURANTE — la seconde — et l'effacement ne nettoie que celle-là. La
 * première reste. Une ligne de plus toutes les 120 ms : +21 lignes en 8 secondes, mesuré dans
 * un vrai pane herdr.
 *
 * ⚠️ POURQUOI IL FALLAIT L'ÉCRIRE : le modèle d'auto-wrap seul ne peut pas voir ça. Il calcule
 * combien de rangées un écran OCCUPE ; l'incident est une histoire de CURSEUR — où le retour
 * chariot atterrit, et ce que l'effacement nettoie. Deux choses qu'un compte de rangées ignore.
 *
 * ⚠️ ET C'EST ICI QUE CE DOUBLE GAGNE SA PLACE. Sur le chemin de `rendreEcran`, il ne pouvait
 * PLUS RIEN attraper : `borner` y rend chaque ligne d'exactement la largeur du pane, donc
 * `ceil(longueur / colonnes)` vaut 1 par construction — mesuré, zéro divergence sur 80 couples.
 * Un double bâti pour une classe de défaut que le correctif voisin avait rendue irreproductible
 * là où on le branchait. Ici, le défaut est atteignable, et lui seul l'atteint.
 *
 * ⚠️ CE QU'IL COMPREND, ET RIEN D'AUTRE : l'écriture de texte avec auto-wrap, le retour chariot,
 * le saut de ligne, et l'effacement de la rangée courante. Toute autre séquence de contrôle est
 * IGNORÉE plutôt que devinée — un double qui devine fabrique les défauts qu'il devrait trouver.
 * Il ne modélise ni couleurs, ni écran alternatif, ni curseur adressable : rien de tout cela
 * n'entre dans la propriété qu'on mesure ici.
 */
export function ecranApresEcritures(ecrits, cols, rows) {
  const ESC = String.fromCharCode(27);
  const rangees = [''];
  let ligne = 0;
  let col = 0;
  // 🔴 LE REPORT DE RETOUR À LA LIGNE (« pending wrap ») — ET SANS LUI CE DOUBLE FABRIQUE UN
  // DÉFAUT QUI N'EXISTE PAS. Ma première version descendait d'une rangée dès que le curseur
  // atteignait la dernière colonne. Un VRAI terminal ne fait pas ça : écrire dans la dernière
  // colonne ARME un report, et c'est le caractère IMPRIMABLE SUIVANT qui déclenche la descente.
  // Un retour chariot, lui, désarme le report et reste sur la MÊME rangée.
  //
  // ⚠️ MESURÉ, ET C'EST CE QUI L'A RÉVÉLÉ : avec le wrap immédiat, ce modèle disait que la
  // progression CORRIGÉE empilait encore 20 rangées — alors que le vrai pane herdr en montre
  // UNE, mesuré. Le double contredisait le terminal. Une ligne bornée à EXACTEMENT la largeur
  // du pane remplit la dernière colonne sans descendre : c'est précisément ce qui fait que le
  // correctif fonctionne, et un modèle sans report ne peut pas le voir.
  let report = false;
  const poser = (c) => {
    if (report) { ligne += 1; col = 0; report = false; }
    while (rangees.length <= ligne) rangees.push('');
    const r = [...rangees[ligne]];
    while (r.length < col) r.push(' ');
    r[col] = c;
    rangees[ligne] = r.join('');
    if (col + 1 >= cols) report = true;
    else col += 1;
  };

  for (const brut of ecrits) {
    const t = String(brut ?? '');
    for (let i = 0; i < t.length; ) {
      if (t[i] === '\r') { col = 0; report = false; i += 1; continue; }
      if (t[i] === '\n') { ligne += 1; report = false; while (rangees.length <= ligne) rangees.push(''); i += 1; continue; }
      if (t[i] === ESC) {
        // ⚠️ ON NE RECONNAÎT QUE L'EFFACEMENT DE RANGÉE. Le reste est SAUTÉ, pas interprété.
        const m = /^\[([0-9;?]*)([A-Za-z])/.exec(t.slice(i + 1));
        if (m) {
          if (m[2] === 'K' && (m[1] === '2' || m[1] === '')) rangees[ligne] = '';
          i += m[0].length + 1;
          continue;
        }
        i += 1;
        continue;
      }
      // Points de code, pas unités UTF-16 — un hors-BMP occupe UNE colonne.
      const pt = String.fromCodePoint(t.codePointAt(i));
      poser(pt);
      i += pt.length;
    }
  }
  return rangees.slice(-rows);
}

/** Les rangées que le lecteur voit encore ÉCRITES — celles qui portent autre chose que du vide. */
export function rangeesNonVides(ecrits, cols, rows) {
  return ecranApresEcritures(ecrits, cols, rows).filter((l) => l.trim() !== '').length;
}
