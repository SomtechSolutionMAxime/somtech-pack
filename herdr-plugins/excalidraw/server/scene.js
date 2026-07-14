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

/** On retient plusieurs hash : deux sauvegardes rapprochées peuvent se croiser. */
const RECENT_WRITES = 8

export class SceneStore {
  #file
  #backupFile
  #recentWrites = []

  /** `backupFile` vit hors du dossier versionné : un .bak à côté du schéma serait du bruit git. */
  constructor(file, backupFile = `${file}.bak`) {
    this.#file = file
    this.#backupFile = backupFile
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
    if (!isValidScene(scene)) throw new TypeError('refus d’écrire une scène invalide')

    const text = JSON.stringify(scene, null, 2)
    this.#recentWrites.push(hash(text))
    if (this.#recentWrites.length > RECENT_WRITES) this.#recentWrites.shift()

    // Copie de secours de l'état précédent : le canvas est du travail utilisateur,
    // et une écriture est destructrice par nature.
    const previous = await readFile(this.#file, 'utf8').catch(() => null)
    if (previous) {
      await mkdir(dirname(this.#backupFile), { recursive: true })
      await writeFile(this.#backupFile, previous, 'utf8')
    }

    await writeFile(this.#file, text, 'utf8')
  }

  /**
   * Le contenu actuel du fichier est-il l'une de NOS écritures récentes ?
   * Sans ce test, une sauvegarde navigateur déclencherait un rechargement
   * navigateur, qui déclencherait une sauvegarde… en boucle.
   *
   * Plusieurs hash, pas un seul : deux sauvegardes rapprochées peuvent se
   * croiser avec l'événement du watcher, qui lirait alors l'avant-dernière.
   */
  isOwnWrite(text) {
    return this.#recentWrites.includes(hash(text))
  }
}
