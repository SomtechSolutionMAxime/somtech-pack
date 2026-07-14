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
 * Requête de capacité : une image 1×1 que le terminal doit accepter sans
 * l'afficher. Un terminal qui comprend le protocole répond `…;OK`.
 */
export const SUPPORT_QUERY = `${APC}i=31,s=1,v=1,a=q,t=d,f=24;AAAA${ST}`

/**
 * Le terminal supporte-t-il le protocole ? On le LUI DEMANDE.
 *
 * Deviner d'après les variables d'environnement ne marche pas : dans un pane
 * herdr, TERM_PROGRAM vaut encore celui du terminal hôte (Apple_Terminal) alors
 * que herdr, lui, sait afficher des images. On interroge, on écoute, et sans
 * réponse dans le délai on dégrade.
 */
export function detectSupport(stdin, stdout, timeoutMs = 400) {
  if (!stdout.isTTY || !stdin.isTTY) return Promise.resolve(false)

  return new Promise((resolve) => {
    let buffer = ''
    const done = (supported) => {
      clearTimeout(timer)
      stdin.removeListener('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      resolve(supported)
    }
    const onData = (chunk) => {
      buffer += chunk.toString('latin1')
      if (buffer.includes('_G') && buffer.includes(';OK')) done(true)
    }
    const timer = setTimeout(() => done(false), timeoutMs)

    stdin.setRawMode(true)
    stdin.resume()
    stdin.on('data', onData)
    stdout.write(SUPPORT_QUERY)
  })
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
