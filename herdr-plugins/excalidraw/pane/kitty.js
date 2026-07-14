/**
 * Protocole graphique Kitty — le terminal de herdr le supporte, donc on affiche
 * de vraies images plutôt que de l'ASCII art.
 *
 * Une transmission = une suite de séquences APC `ESC _G <clés> ; <base64> ESC \`.
 * La charge utile base64 est découpée : `m=1` sur tous les morceaux sauf le
 * dernier, qui porte `m=0`. On émet les octets nous-mêmes — pas de `kitten
 * icat`, pas de `chafa` : le plugin ne doit rien exiger de plus que Node.
 */

/** Limite recommandée par la spec Kitty pour un morceau base64. */
export const CHUNK_SIZE = 4096

/** Lignes réservées en bas du pane pour le bandeau d'état. */
export const STATUS_ROWS = 1

const APC = '\x1b_G'
const ST = '\x1b\\'

/** Efface toutes les images posées par ce pane (évite les résidus au resize). */
export function clearImages() {
  return `${APC}a=d${ST}`
}

/**
 * Transmet-et-affiche `png`, mis à l'échelle dans la zone disponible du pane.
 * Le terminal conserve le ratio de l'image à l'intérieur de la boîte c×r.
 */
export function encodeImage(png, { columns, rows }) {
  const cols = Math.max(1, columns)
  const imageRows = Math.max(1, rows - STATUS_ROWS)
  const base64 = png.toString('base64')

  let out = ''
  for (let offset = 0; offset < base64.length; offset += CHUNK_SIZE) {
    const chunk = base64.slice(offset, offset + CHUNK_SIZE)
    const isLast = offset + CHUNK_SIZE >= base64.length
    const control =
      offset === 0
        ? `a=T,f=100,c=${cols},r=${imageRows},m=${isLast ? 0 : 1}`
        : `m=${isLast ? 0 : 1}`
    out += `${APC}${control};${chunk}${ST}`
  }
  return out
}
