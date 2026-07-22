/**
 * Polices Excalidraw — utilitaire de préchargement.
 *
 * Excalidraw mesure la largeur des éléments texte avec la police COURANTE. Au
 * tout premier rendu (cache navigateur froid), les web-fonts (Excalifont,
 * Nunito, Cascadia, Virgil) ne sont pas encore chargées → largeurs
 * sous-évaluées → texte coupé à droite (T-20260721-0001).
 *
 * `fontsToPreload` déduit, depuis les éléments de la scène, la liste des polices
 * à charger explicitement avant de re-mesurer. Module pur (aucune dépendance
 * React/Excalidraw) → testable sous `node --test`.
 */

/** Mapping numéro Excalidraw → nom de famille CSS (FONT_FAMILY, v0.18). */
export const FONT_NAMES = { 1: 'Virgil', 2: 'Helvetica', 3: 'Cascadia', 5: 'Excalifont', 6: 'Nunito' }

/** Défaut hand-drawn d'Excalidraw quand `fontFamily` est absent. */
export const DEFAULT_FONT_FAMILY = 5 // Excalifont

/**
 * Spécificateurs CSS (`<px>px <Nom>`) des polices présentes dans la scène,
 * dédupliqués, prêts pour `document.fonts.load(...)`. Ignore les éléments
 * non-texte ; retombe sur Excalifont si `fontFamily` manque.
 */
export function fontsToPreload(elements, px = 20) {
  const families = new Set()
  for (const el of elements ?? []) {
    if (el?.type !== 'text') continue
    families.add(el.fontFamily ?? DEFAULT_FONT_FAMILY)
  }
  const specs = []
  for (const family of families) {
    const name = FONT_NAMES[family]
    if (name) specs.push(`${px}px ${name}`)
  }
  return specs
}
