/**
 * Emplacements par projet ET par canvas.
 *
 * Un canvas nommé vit dans `docs/diagrams/<nom>.excalidraw` : versionnable, à
 * côté de la doc qu'il illustre. Chaque canvas a son propre serveur (donc son
 * propre port) — ouvrir un second schéma n'écrase jamais le premier.
 */
import { join, isAbsolute, basename, extname } from 'node:path'

export const CANVAS_DIR = 'docs/diagrams'
export const RUNTIME_DIR = '.herdr'
export const DEFAULT_NAME = 'canvas'

/** `archi`, `docs/diagrams/archi.excalidraw`, `/abs/chemin.excalidraw` → tous acceptés. */
export function paths(project = process.cwd(), name = DEFAULT_NAME) {
  const looksLikePath = name.includes('/') || extname(name) === '.excalidraw'
  const canvasFile = looksLikePath
    ? (isAbsolute(name) ? name : join(project, name))
    : join(project, CANVAS_DIR, `${name}.excalidraw`)

  const slug = basename(canvasFile, '.excalidraw')

  return {
    project,
    slug,
    canvasFile,
    runtimeDir: join(project, RUNTIME_DIR),
    backupFile: join(project, RUNTIME_DIR, `${slug}.excalidraw.bak`),
    portFile: join(project, RUNTIME_DIR, `excalidraw-${slug}.port`),
    logFile: join(project, RUNTIME_DIR, `excalidraw-${slug}.log`),
  }
}
