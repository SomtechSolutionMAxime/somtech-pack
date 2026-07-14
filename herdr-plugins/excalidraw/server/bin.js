#!/usr/bin/env node
/**
 * Démarre le serveur du canvas pour un projet, sauf s'il tourne déjà.
 *
 * Usage : node server/bin.js [--project <dir>] [--file <canvas.excalidraw>] [--print-port]
 */
import { readFile, mkdir } from 'node:fs/promises'

import { startServer, DEFAULT_PORT } from './server.js'
import { paths } from './paths.js'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const project = arg('project', process.cwd())
const { dir, canvasFile, portFile } = paths(project)
const file = arg('file', canvasFile)

/** Le serveur d'une session précédente répond-il encore ? */
async function existingPort() {
  try {
    const port = Number((await readFile(portFile, 'utf8')).trim())
    const res = await fetch(`http://127.0.0.1:${port}/api/scene`, { signal: AbortSignal.timeout(500) })
    return res.ok ? port : null
  } catch {
    return null
  }
}

await mkdir(dir, { recursive: true })

const running = await existingPort()

// `--check` sonde et rend la main : c'est ce que le lanceur appelle AVANT de
// décider s'il doit démarrer un serveur. Ne jamais démarrer ici — le lanceur
// resterait bloqué sur un process qui, par nature, ne se termine pas.
if (process.argv.includes('--check')) {
  if (running) console.log(running)
  process.exit(running ? 0 : 1)
}

// Deuxième invocation de l'action : on se rattache, pas de second serveur.
if (running) {
  console.log(running)
  process.exit(0)
}

const server = await startServer({ file, port: DEFAULT_PORT, portFile })
console.log(server.port)

const shutdown = async () => {
  await server.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
