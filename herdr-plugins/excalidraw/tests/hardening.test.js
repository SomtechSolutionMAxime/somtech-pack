/**
 * Tests issus de la revue de code : perte de données, sécurité locale, pane qui ment.
 * Chacun échouerait si le garde-fou correspondant sautait.
 */
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'

import { startServer } from '../server/server.js'
import { EMPTY_SCENE } from '../server/scene.js'

let dir
let server

const rectangle = { id: 'rect-1', type: 'rectangle', x: 10, y: 10, width: 100, height: 50 }
const withRect = { ...EMPTY_SCENE, elements: [rectangle] }

const post = (port, body, { type = 'application/json', origin, query = '' } = {}) =>
  fetch(`http://127.0.0.1:${port}/api/scene${query}`, {
    method: 'POST',
    headers: { 'content-type': type, ...(origin ? { origin } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'herdr-excalidraw-'))
})

afterEach(async () => {
  await server?.close()
  server = null
  await rm(dir, { recursive: true, force: true }) // ne pas laisser de mkdtemp derrière soi
})

test('un corps sans `elements` est refusé et ne touche pas au fichier', async () => {
  const file = join(dir, 'canvas.excalidraw')
  await writeFile(file, JSON.stringify(withRect))
  server = await startServer({ file, port: 0 })

  const res = await post(server.port, { hello: 'world' })

  assert.equal(res.status, 400)
  assert.equal(JSON.parse(await readFile(file, 'utf8')).elements.length, 1)
})

test('une requête sans content-type JSON est refusée (pas de POST cross-site)', async () => {
  const file = join(dir, 'canvas.excalidraw')
  await writeFile(file, JSON.stringify(withRect))
  server = await startServer({ file, port: 0 })

  // `text/plain` est une requête « simple » : aucun préflight CORS ne la protège.
  const res = await post(server.port, { ...EMPTY_SCENE, elements: [{ ...rectangle, id: 'PWNED' }] }, { type: 'text/plain' })

  assert.equal(res.status, 415)
  assert.equal(JSON.parse(await readFile(file, 'utf8')).elements[0].id, 'rect-1')
})

test("une requête portant l'origine d'un autre site est refusée", async () => {
  const file = join(dir, 'canvas.excalidraw')
  await writeFile(file, JSON.stringify(withRect))
  server = await startServer({ file, port: 0 })

  const res = await post(server.port, { ...EMPTY_SCENE, elements: [{ ...rectangle, id: 'PWNED' }] }, {
    origin: 'https://evil.example',
  })

  assert.equal(res.status, 403)
  assert.equal(JSON.parse(await readFile(file, 'utf8')).elements[0].id, 'rect-1')
})

test("un WebSocket venu d'un autre site est refusé (pas d'espionnage du canvas)", async () => {
  const file = join(dir, 'canvas.excalidraw')
  server = await startServer({ file, port: 0 })

  const socket = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, { origin: 'https://evil.example' })
  const outcome = await new Promise((resolve) => {
    socket.once('open', () => resolve('ouvert'))
    socket.once('error', () => resolve('refusé'))
  })

  assert.equal(outcome, 'refusé')
})

test('chaque écriture laisse une copie de secours du contenu précédent', async () => {
  const file = join(dir, 'canvas.excalidraw')
  await writeFile(file, JSON.stringify(withRect))
  server = await startServer({ file, port: 0 })

  const res = await post(server.port, { ...EMPTY_SCENE, elements: [rectangle, { ...rectangle, id: 'rect-2' }] })
  assert.equal(res.status, 200)

  const backup = JSON.parse(await readFile(`${file}.bak`, 'utf8'))
  assert.equal(backup.elements.length, 1, 'la sauvegarde doit contenir l’état AVANT écriture')
})

test('le pane sait si un éditeur est connecté (sinon son image peut être périmée)', async () => {
  const file = join(dir, 'canvas.excalidraw')
  server = await startServer({ file, port: 0 })

  const pane = new WebSocket(`ws://127.0.0.1:${server.port}/ws?role=pane`)
  const messages = []
  pane.on('message', (raw) => messages.push(JSON.parse(raw.toString())))
  await new Promise((r) => pane.once('open', r))
  await new Promise((r) => setTimeout(r, 200))

  const first = messages.filter((m) => m.type === 'editors').at(-1)
  assert.equal(first.count, 0, 'aucun navigateur ouvert')

  const editor = new WebSocket(`ws://127.0.0.1:${server.port}/ws?role=editor`)
  await new Promise((r) => editor.once('open', r))
  await new Promise((r) => setTimeout(r, 200))

  assert.equal(messages.filter((m) => m.type === 'editors').at(-1).count, 1)

  editor.close()
  await new Promise((r) => setTimeout(r, 300))
  assert.equal(messages.filter((m) => m.type === 'editors').at(-1).count, 0, 'la fermeture doit être signalée')

  pane.close()
})
