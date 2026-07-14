/**
 * Serveur local du plugin : sert la page Excalidraw, expose la scène, diffuse
 * les aperçus PNG aux panes, et surveille le fichier pour les écritures externes.
 *
 * Il ne connaît rien du terminal ; le pane ne connaît rien d'Excalidraw.
 */
import { createServer } from 'node:http'
import { createServer as createTcpServer } from 'node:net'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import chokidar from 'chokidar'
import { WebSocketServer } from 'ws'

import { SceneStore, isValidScene } from './scene.js'

export const DEFAULT_PORT = 4870
const WEB_ROOT = fileURLToPath(new URL('../web/dist/', import.meta.url))

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
}

/**
 * Premier port libre à partir de `port` (0 = laisser l'OS choisir).
 *
 * On sonde avec un serveur TCP jetable plutôt que de re-`listen()` le serveur
 * HTTP après un échec : un serveur HTTP qui a émis EADDRINUSE peut en émettre
 * un second de façon asynchrone, hors de portée du handler — exception non
 * rattrapée.
 */
function probe(port) {
  return new Promise((resolve, reject) => {
    const socket = createTcpServer()
    socket.once('error', reject)
    socket.listen(port, '127.0.0.1', () => {
      const bound = socket.address().port
      socket.close(() => resolve(bound))
    })
  })
}

async function findFreePort(port, attemptsLeft = 20) {
  if (port === 0) return 0
  try {
    return await probe(port)
  } catch (err) {
    if (err.code !== 'EADDRINUSE' || attemptsLeft === 0) throw err
    return findFreePort(port + 1, attemptsLeft - 1)
  }
}

function listen(httpServer, port) {
  return new Promise((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(port, '127.0.0.1', () => resolve(httpServer.address().port))
  })
}

/**
 * Une requête venue d'une page web tierce porte un `Origin` qui n'est pas le
 * nôtre. Sans origine (curl, agent local) : accepté — l'attaquant visé ici est
 * un site web, pas un process qui a déjà accès à la machine.
 */
function sameOrigin(req) {
  const origin = req.headers.origin
  if (!origin) return true
  try {
    const { hostname } = new URL(origin)
    return hostname === '127.0.0.1' || hostname === 'localhost'
  } catch {
    return false
  }
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

export async function startServer({ file, port = DEFAULT_PORT, portFile = null } = {}) {
  const store = new SceneStore(file)
  await store.ensureFile()

  let lastPreview = null

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')

    try {
      // Le serveur écoute en local, mais un site web quelconque ouvert dans le
      // navigateur peut lui parler. Sans ce contrôle, il écraserait le canvas.
      if (req.method === 'POST' && !sameOrigin(req)) {
        return json(res, 403, { error: 'origine refusée' })
      }

      if (url.pathname === '/api/scene' && req.method === 'GET') {
        return json(res, 200, await store.read())
      }

      if (url.pathname === '/api/scene' && req.method === 'POST') {
        // `text/plain` est une requête « simple » : aucun préflight CORS ne la
        // filtre. Exiger du JSON force le préflight, donc le contrôle d'origine.
        if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) {
          return json(res, 415, { error: 'content-type application/json requis' })
        }

        const scene = JSON.parse((await readBody(req)).toString('utf8'))

        // Une scène sans `elements` n'est pas une scène. L'écrire détruirait le
        // canvas ET rendrait le fichier illisible.
        if (!isValidScene(scene)) {
          return json(res, 400, { error: 'scène invalide : `elements` manquant' })
        }

        // Garde-fou anti-perte : un navigateur qui n'a pas fini de charger la
        // scène poste `elements: []`. Sans ce refus, un simple rechargement de
        // page efface le dessin. Un effacement voulu passe par `?allowEmpty=1`.
        if (scene.elements.length === 0 && url.searchParams.get('allowEmpty') !== '1') {
          const current = await store.read().catch(() => null)
          if (current?.elements.length) {
            return json(res, 409, { error: 'scène vide refusée : le canvas courant contient des éléments' })
          }
        }

        await store.write(scene)
        return json(res, 200, { ok: true })
      }

      if (url.pathname === '/api/preview' && req.method === 'POST') {
        lastPreview = await readBody(req)
        broadcast({ type: 'preview:update', png: lastPreview.toString('base64') })
        return json(res, 200, { ok: true })
      }

      return serveStatic(url.pathname, res)
    } catch (err) {
      return json(res, 400, { error: err.message })
    }
  })

  // `verifyClient` : un WebSocket ignore CORS par construction. Sans ce filtre,
  // n'importe quel site web pourrait lire en continu les scènes et les aperçus.
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    verifyClient: ({ req }) => sameOrigin(req),
  })

  const broadcast = (message) => {
    const payload = JSON.stringify(message)
    for (const client of wss.clients) if (client.readyState === 1) client.send(payload)
  }

  /**
   * Seul le navigateur produit les aperçus. Si aucun n'est connecté, l'image du
   * pane peut être périmée sans qu'il puisse le deviner : on le lui dit.
   */
  const editorCount = () => [...wss.clients].filter((c) => c.role === 'editor' && c.readyState === 1).length
  const announceEditors = () => broadcast({ type: 'editors', count: editorCount() })

  wss.on('connection', (socket, req) => {
    socket.role = new URL(req.url, 'http://127.0.0.1').searchParams.get('role') ?? 'editor'

    // Un pane qui arrive en cours de route ne doit pas rester noir.
    if (lastPreview) {
      socket.send(JSON.stringify({ type: 'preview:update', png: lastPreview.toString('base64') }))
    }
    announceEditors()
    socket.on('close', announceEditors)
  })

  const boundPort = await listen(httpServer, await findFreePort(port))
  if (portFile) await writeFile(portFile, `${boundPort}\n`, 'utf8')

  // Écritures externes du fichier (Claude) → poussées au navigateur et au pane.
  const watcher = chokidar.watch(file, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 120 } })
  watcher.on('change', async () => {
    let text
    try {
      text = await readFile(file, 'utf8')
    } catch {
      return
    }
    if (store.isOwnWrite(text)) return // notre propre sauvegarde : ne pas rebondir

    try {
      const scene = JSON.parse(text)
      if (!Array.isArray(scene?.elements)) throw new SyntaxError('`elements` manquant')
      broadcast({ type: 'scene:update', scene })
    } catch (err) {
      // On ne pousse RIEN : un fichier cassé ne doit pas détruire le dessin en cours.
      broadcast({ type: 'error', message: `Fichier .excalidraw invalide — ${err.message}` })
    }
  })

  return {
    port: boundPort,
    url: `http://127.0.0.1:${boundPort}/`,
    file,
    async close() {
      await watcher.close()
      for (const client of wss.clients) client.terminate()
      wss.close()
      await new Promise((resolve) => httpServer.close(resolve))
      if (portFile) await unlink(portFile).catch(() => {})
    },
  }
}

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(payload)
}

async function serveStatic(pathname, res) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const target = join(WEB_ROOT, relative)
  if (!target.startsWith(WEB_ROOT)) return json(res, 403, { error: 'interdit' })

  try {
    const body = await readFile(target)
    res.writeHead(200, { 'content-type': MIME[extname(target)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    return json(res, 404, { error: `introuvable : ${relative}. Lancer \`npm run build\` dans le plugin.` })
  }
}
