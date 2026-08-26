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
// ⚠️ CE QUI GARDE LA PROPRIÉTÉ DES LARGEURS NE DÉPEND PAS DE CE FICHIER. L'invariant « rien de
// ce que le TUI écrit ne dépasse la largeur du pane » est gardé par une mesure DIRECTE —
// `largeurAffichee(texte) <= largeur` — à quatre endroits de `rien-ne-deborde-du-pane.test.js`.
// Ce fichier ne s'en mêle plus.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴 UN MODÈLE D'AUTO-WRAP SIMPLE A VÉCU ICI. IL EST SUPPRIMÉ, ET SA DISPARITION EST UN
// CORRECTIF — mesuré par une revue, pas trouvé en relisant.
//
// `rangeesPhysiques`, `ecranVisible`, `texteVisible` : trois fonctions exportées, **zéro
// appelant dans tout le dépôt**. Et la prose qui tenait cette place les annonçait comme « un
// SECOND instrument, indépendant du premier, qui attrape le même défaut par une autre route ».
// Elles n'attrapaient rien : elles n'étaient branchées nulle part.
//
// ⚠️ CE N'EST PAS LA MÊME FAUTE QUE LES AUTRES PROSES FAUSSES DE CE LOT, ET LE REMÈDE DIFFÈRE.
// Une note qui décrit l'intention d'un banc au lieu de ce qu'il asserte est fausse À L'ÉCRITURE.
// Celle-ci était VRAIE quand elle a été écrite : le modèle servait alors sur le chemin de
// `rendreEcran`. Elle s'est périmée toute seule quand ce qu'elle décrivait a DÉMÉNAGÉ — le
// modèle a été déplacé sur la ligne de progression, où c'est `ecranApresEcritures` qui travaille.
// Une affirmation ne devient pas fausse seulement en étant mal écrite : elle le devient aussi
// quand ce qu'elle décrit bouge et qu'on ne relit pas ce qu'on laisse derrière.
//
// LA FORME QUI FERME ÇA : déplacer quelque chose se termine par COMPTER LES APPELANTS de ce
// qu'on laisse derrière. Zéro appelant = un garde qui n'en est pas, et sa légende ment.
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * UN TERMINAL QUI SAIT REVENIR EN ARRIÈRE ET EFFACER — le sous-ensemble VT100 que l'incident
 * du dirigeant met en jeu, et que le modèle ci-dessus ne pouvait pas voir.
 *
 * 🔴 CE QU'IL EXISTE POUR REPRODUIRE, ET QU'AUCUN AUTRE INSTRUMENT DU DÉPÔT N'ATTEINT :
 * la ligne de progression est écrite DROIT AU TERMINAL par `avecProgression`, pas composée par
 * `rendreEcran`. Elle ne passe donc PAS par `borner`. C'est elle qui a produit l'incident :
 * un texte de 115 à 117 caractères selon le compteur, réécrit toutes les 120 ms avec un retour
 * chariot et un effacement de ligne. Sous sa longueur, il WRAPPE ; le retour chariot revient au début
 * de la rangée PHYSIQUE COURANTE — la seconde — et l'effacement ne nettoie que celle-là. La
 * première reste. Une ligne de plus toutes les 120 ms : +21 lignes en 8 secondes, mesuré dans
 * un vrai pane herdr.
 *
 * ⚠️ ET LE SEUIL EST UNE PLAGE, PAS UN NOMBRE — c'est ce qui rend ce défaut coûteux à chercher.
 * La longueur varie avec le NOMBRE DE CHIFFRES du compteur : 115 caractères de 0 à 9 secondes,
 * 116 de 10 à 99, 117 au-delà. Donc sous 115 colonnes ça empile systématiquement ; entre 115 et
 * 117, ça se met à empiler EN COURS DE ROUTE, quand le compteur passe à deux chiffres puis à
 * trois.
 *
 * 🔴 QUELQU'UN QUI TESTE À 116 COLONNES PENDANT LES NEUF PREMIÈRES SECONDES NE VOIT RIEN, et
 * conclut que le défaut n'existe pas. Un défaut qu'on ne voit pas quand on le cherche mal coûte
 * plus cher qu'un défaut franc.
 *
 * ⚠️ CETTE PROSE A DIT « 116 caractères, longueur fixe » — une constante INVENTÉE pour expliquer
 * le mécanisme, dans un commentaire qu'aucune garde ne peut atteindre. C'est la deuxième fois
 * dans ce lot. Le code, lui, n'a jamais dépendu du chiffre : il mesure `[...texte].length` à
 * l'exécution.
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
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * CE QU'IL COMPREND — ET CHAQUE LIGNE DE CETTE LISTE A SON CAS, CAPTURÉ DEPUIS L'ÉMULATEUR
 *
 * 🔴 CETTE LISTE A DÉJÀ MENTI. Elle annonçait le saut de ligne ; le modèle le traitait mal, et
 * une revue l'a mesuré. Une capacité énumérée sans cas en regard se lit comme vérifiée par
 * quelqu'un — c'est une description juste d'intention, fausse de fait, dans un document écrit
 * pour protéger. Elle est désormais GARDÉE : le banc « LE DOUBLE DU TERMINAL EST CONFRONTÉ À UN
 * VRAI ÉMULATEUR » porte la même liste et ROUGIT si l'une de ses entrées n'a pas de cas.
 * Ajouter une capacité ici sans capturer son cas fait rougir la suite.
 *
 *     auto-wrap · ligne vide · retour chariot · retour chariot désarme le report ·
 *     saut de ligne · le report survit au saut de ligne · report armé puis imprimable ·
 *     effacement de rangée (`[K`, `[1K`, `[2K` — trois portées distinctes) · défilement
 *
 * 🔴 « SÉQUENCE INCONNUE IGNORÉE » A ÉTÉ RETIRÉE DE CETTE LISTE, ET C'EST UN CORRECTIF.
 * Le double sait avaler un `ESC` suivi d'un caractère — mesuré conforme. Il ne sait PAS traiter
 * une séquence CSI **tronquée** (`ESC[12` sans caractère final) : un vrai terminal la garde en
 * attente, ce double imprime ses paramètres. J'ai essayé de le modéliser et j'ai INVENTÉ un
 * mécanisme (« une CSI tronquée avale tout le reste ») qui a produit 45 écarts sur un tirage.
 *
 * ⚠️ ON NE MODÉLISE PAS CE DONT ON N'A PAS LA SPEC, et on ne prétend pas le comprendre. La
 * frontière est GARDÉE à la place : le banc `LA PRODUCTION N'ÉMET QUE DES SÉQUENCES BIEN
 * FORMÉES` vérifie que rien de ce que le TUI écrit ne sort du sous-ensemble éprouvé ici.
 * Le jour où la production émettrait une CSI tronquée, c'est ce banc-là qui rougirait.
 *
 * ⚠️ CE QU'IL NE COMPREND PAS, ET NE PRÉTEND PAS COMPRENDRE : les couleurs, l'écran alternatif,
 * le curseur adressable, et les caractères HORS BMP — l'émulateur de référence rompt sur ces
 * derniers, donc aucun cas ne peut les couvrir, donc ils ne sont pas dans la liste. Toute autre
 * séquence de contrôle est IGNORÉE plutôt que devinée : un double qui devine fabrique les
 * défauts qu'il devrait trouver.
 * ═══════════════════════════════════════════════════════════════════════════════════════
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
  // 🔴 LE REPORT DE RETOUR À LA LIGNE, MODÉLISÉ COMME LE FAIT UN VRAI TERMINAL : la colonne
  // avance JUSQU'À `cols` — une position hors de l'écran — et le retour à la ligne ne se produit
  // qu'au caractère imprimable SUIVANT. Écrire dans la dernière colonne ne descend donc pas.
  //
  // ⚠️ MA PREMIÈRE VERSION DESCENDAIT IMMÉDIATEMENT, et elle affirmait que la progression
  // CORRIGÉE empilait encore — alors qu'un vrai pane herdr en montre UNE ligne, mesuré. Le
  // double contredisait le réel, et c'est LUI qui avait tort. Ce détail n'en est pas un : c'est
  // la RAISON pour laquelle le correctif fonctionne — une ligne bornée à la largeur exacte
  // remplit la dernière colonne SANS descendre, donc le retour chariot suivant la retrouve.
  //
  // ⚠️ MA DEUXIÈME VERSION FIGEAIT LA COLONNE à `cols - 1` derrière un drapeau. C'était juste
  // pour l'écriture et FAUX pour l'effacement : `[K` efface à partir de la colonne courante, et
  // avec la colonne figée il emportait le dernier caractère. Trouvé par tirage différentiel, pas
  // par relecture. Laisser la colonne sortir de l'écran rend les deux justes d'un seul coup.
  const poser = (c) => {
    if (col >= cols) { ligne += 1; col = 0; }
    while (rangees.length <= ligne) rangees.push('');
    const r = [...rangees[ligne]];
    while (r.length < col) r.push(' ');
    r[col] = c;
    rangees[ligne] = r.join('');
    col += 1;
  };

  for (const brut of ecrits) {
    const t = String(brut ?? '');
    for (let i = 0; i < t.length; ) {
      if (t[i] === '\r') { col = 0; i += 1; continue; }
      if (t[i] === '\n') {
        // ⚠️ LA COLONNE NE BOUGE PAS sur un saut de ligne, et un report en cours SURVIT —
        // il est porté par la colonne elle-même, qui reste hors de l'écran.
        ligne += 1; while (rangees.length <= ligne) rangees.push(''); i += 1; continue; }
      if (t[i] === ESC) {
        // ⚠️ ON NE RECONNAÎT QUE L'EFFACEMENT DE RANGÉE. Le reste est SAUTÉ, pas interprété.
        const m = /^\[([0-9;?]*)([A-Za-z])/.exec(t.slice(i + 1));
        if (m) {
          // 🔴 `[K` N'EST PAS `[2K`, ET LES CONFONDRE EFFACE TROP. Trouvé par tirage différentiel
          // contre un vrai émulateur — jamais par relecture, et jamais par les cas que j'aurais
          // choisis moi-même : `[K` efface DE LA COLONNE COURANTE À LA FIN de la rangée, `[1K`
          // du DÉBUT jusqu'à la colonne courante, `[2K` la rangée ENTIÈRE. Mon modèle traitait
          // `[K` comme `[2K` et emportait le texte à gauche du curseur.
          if (m[2] === 'K') {
            const r = [...(rangees[ligne] ?? '')];
            if (m[1] === '2') rangees[ligne] = '';
            else if (m[1] === '1') rangees[ligne] = r.map((c, k) => (k <= col ? ' ' : c)).join('');
            else rangees[ligne] = r.slice(0, col).join('');
          }
          i += m[0].length + 1;
          continue;
        }
        // 🔴 UNE SÉQUENCE QUE LA REGEX NE RECONNAÎT PAS ÉTAIT À MOITIÉ IMPRIMÉE — mesuré contre
        // l'émulateur, sur un geste que mon corpus ne produisait JAMAIS :
        //
        //     `ab` ESC `Xcd`   émulateur « abcd »   ce double « abXcd »
        //     `ab` ESC `[`     émulateur « ab »     ce double « ab[  »
        //
        // Il n'avalait que l'ESC et imprimait la suite. Un vrai terminal avale ESC + le
        // caractère qui le suit ; et une séquence CSI TRONQUÉE reste EN ATTENTE — rien de ce
        // qui la compose n'atteint l'écran.
        //
        // ⚠️ ET MA NOTE DÉCLARAIT « séquence inconnue IGNORÉE ». Elle ne l'était pas : elle
        // était à moitié imprimée. Une capacité annoncée que le corpus n'atteignait pas.
        // ⚠️ ESC + LE CARACTÈRE QUI LE SUIT, AVALÉS — et rien de plus. Ma première correction
        // ajoutait « une CSI tronquée avale tout le reste du flux » : une INVENTION, dont je
        // n'avais pas la spec. Elle a produit 45 écarts sur un tirage élargi. Retirer la
        // reconstruction suffit : les deux cas mesurés tombent juste sans elle.
        i += 2;
        continue;
      }
      // Points de code, pas unités UTF-16 — un hors-BMP occupe UNE colonne.
      const pt = String.fromCodePoint(t.codePointAt(i));
      poser(pt);
      i += pt.length;
    }
  }
  // ⚠️ UN ÉCRAN A TOUJOURS `rows` RANGÉES, même si rien n'y a été écrit — un terminal ne rend
  // pas un écran plus court parce qu'on ne l'a pas rempli. Sans ce complément, ce modèle rendait
  // moins de rangées que l'émulateur sur le MÊME contenu, et la confrontation accusait le modèle
  // là où seul le comparateur était en cause.
  while (rangees.length < rows) rangees.push('');
  return rangees.slice(-rows);
}

/** Les rangées que le lecteur voit encore ÉCRITES — celles qui portent autre chose que du vide. */
export function rangeesNonVides(ecrits, cols, rows) {
  return ecranApresEcritures(ecrits, cols, rows).filter((l) => l.trim() !== '').length;
}
