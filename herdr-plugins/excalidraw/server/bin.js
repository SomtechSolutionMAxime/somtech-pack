#!/usr/bin/env node
/**
 * Démarre le serveur du canvas pour un projet, sauf s'il tourne déjà.
 *
 * Usage : node server/bin.js [--project <dir>] [--file <canvas.excalidraw>] [--print-port]
 */
import { readFile, mkdir, rm } from 'node:fs/promises'

import { startServer, DEFAULT_PORT } from './server.js'
import { paths } from './paths.js'

/** Décalage de port stable et sans surprise pour un nom donné. */
const hashName = (value) => [...value].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 100000, 7)

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const project = arg('project', process.cwd())
const name = arg('name', 'canvas')
const { runtimeDir, canvasFile, portFile, backupFile } = paths(project, name)
const file = canvasFile

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

await mkdir(runtimeDir, { recursive: true })

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

// Un port publié par un serveur tué (-9) enverrait le pane et le navigateur
// dans le vide le temps que le nouveau serveur écrase le fichier.
await rm(portFile, { force: true })

// Un canvas par serveur : le port de départ dépend du nom, pour que deux canvas
// ouverts en même temps ne se disputent pas le même port.
const startPort = DEFAULT_PORT + (hashName(name) % 100)

const server = await startServer({ file, port: startPort, portFile, backupFile }).catch((err) => {
  console.error(`démarrage impossible : ${err.message}`)
  process.exit(1)
})
console.log(server.port)

const shutdown = async () => {
  await server.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
