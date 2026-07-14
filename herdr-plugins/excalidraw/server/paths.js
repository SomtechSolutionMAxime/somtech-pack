/**
 * Emplacements par projet. Le canvas est versionnable (il vit dans le repo) ;
 * le fichier de port est un détail d'exécution.
 */
import { join } from 'node:path'

export const CANVAS_DIR = '.herdr'
export const CANVAS_NAME = 'canvas.excalidraw'
export const PORT_NAME = 'excalidraw.port'

export function paths(project = process.cwd()) {
  const dir = join(project, CANVAS_DIR)
  return {
    project,
    dir,
    canvasFile: join(dir, CANVAS_NAME),
    portFile: join(dir, PORT_NAME),
  }
}
