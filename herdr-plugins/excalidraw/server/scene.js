/**
 * Lecture / écriture du fichier .excalidraw — la source de vérité du canvas.
 *
 * Le garde anti-écho vit ici : le serveur mémorise le hash de ce qu'il vient
 * d'écrire, pour distinguer sa propre écriture de celle d'un tiers (Claude).
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export const EMPTY_SCENE = {
  type: 'excalidraw',
  version: 2,
  source: 'herdr-excalidraw',
  elements: [],
  appState: { viewBackgroundColor: '#ffffff' },
  files: {},
}

const hash = (text) => createHash('sha256').update(text).digest('hex')

/** Une scène Excalidraw exploitable : un objet avec un tableau `elements`. */
export function isValidScene(scene) {
  return Boolean(scene) && typeof scene === 'object' && Array.isArray(scene.elements)
}

export class SceneStore {
  #file
  #lastWriteHash = null

  constructor(file) {
    this.#file = file
  }

  get file() {
    return this.#file
  }

  /** Crée le fichier avec une scène vide s'il n'existe pas encore. */
  async ensureFile() {
    try {
      await readFile(this.#file, 'utf8')
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
      await mkdir(dirname(this.#file), { recursive: true })
      await this.write(EMPTY_SCENE)
    }
  }

  async read() {
    const text = await readFile(this.#file, 'utf8')
    const scene = JSON.parse(text)
    if (!isValidScene(scene)) throw new SyntaxError('scène Excalidraw invalide : `elements` manquant')
    return scene
  }

  async write(scene) {
    const text = JSON.stringify(scene, null, 2)
    this.#lastWriteHash = hash(text)
    await writeFile(this.#file, text, 'utf8')
  }

  /**
   * Le contenu actuel du fichier est-il celui que NOUS venons d'écrire ?
   * Sans ce test, une sauvegarde navigateur déclencherait un rechargement
   * navigateur, qui déclencherait une sauvegarde… en boucle.
   */
  isOwnWrite(text) {
    return this.#lastWriteHash !== null && hash(text) === this.#lastWriteHash
  }
}
