import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer as createTcpServer } from 'node:net'
import WebSocket from 'ws'

import { startServer } from '../server/server.js'
import { EMPTY_SCENE } from '../server/scene.js'

let dir
let server

/** Collecte les messages WS pendant `ms`, puis rend la liste. */
async function collect(port, ms, trigger) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)
  const messages = []
  // Attaché AVANT l'attente d'ouverture : le serveur pousse le dernier aperçu
  // dès la connexion, un handler posé après le raterait.
  ws.on('message', (raw) => messages.push(JSON.parse(raw.toString())))
  await new Promise((resolve, reject) => {
    ws.once('open', resolve)
    ws.once('error', reject)
  })
  await trigger()
  await new Promise((r) => setTimeout(r, ms))
  ws.close()
  return messages
}

const rectangle = { id: 'rect-1', type: 'rectangle', x: 10, y: 10, width: 100, height: 50 }

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'herdr-excalidraw-'))
})

after(async () => {
  await server?.close()
})

test('crée le fichier avec une scène vide valide quand il est absent', async () => {
  const file = join(dir, 'nested', 'canvas.excalidraw')
  server = await startServer({ file, port: 0 })

  const scene = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(scene.type, EMPTY_SCENE.type)
  assert.deepEqual(scene.elements, [])

  await server.close()
})

test('POST /api/scene écrit la scène sur disque', async () => {
  const file = join(dir, 'canvas.excalidraw')
  server = await startServer({ file, port: 0 })

  const scene = { ...EMPTY_SCENE, elements: [rectangle] }
  const res = await fetch(`http://127.0.0.1:${server.port}/api/scene`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(scene),
  })
  assert.equal(res.status, 200)

  const written = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(written.elements[0].id, 'rect-1')

  await server.close()
})

test("une sauvegarde du navigateur ne produit AUCUN scene:update (pas de boucle d'écho)", async () => {
  const file = join(dir, 'canvas.excalidraw')
  server = await startServer({ file, port: 0 })

  const messages = await collect(server.port, 600, async () => {
    await fetch(`http://127.0.0.1:${server.port}/api/scene`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...EMPTY_SCENE, elements: [rectangle] }),
    })
  })

  assert.equal(messages.filter((m) => m.type === 'scene:update').length, 0)
  await server.close()
})

test('une écriture externe du fichier (Claude) produit un scene:update', async () => {
  const file = join(dir, 'canvas.excalidraw')
  server = await startServer({ file, port: 0 })

  const messages = await collect(server.port, 800, async () => {
    await writeFile(file, JSON.stringify({ ...EMPTY_SCENE, elements: [rectangle] }))
  })

  const updates = messages.filter((m) => m.type === 'scene:update')
  assert.equal(updates.length, 1)
  assert.equal(updates[0].scene.elements[0].id, 'rect-1')

  await server.close()
})

test('un JSON invalide ne produit aucun scene:update mais une erreur', async () => {
  const file = join(dir, 'canvas.excalidraw')
  server = await startServer({ file, port: 0 })

  const messages = await collect(server.port, 800, async () => {
    await writeFile(file, '{ ceci nest pas du json')
  })

  assert.equal(messages.filter((m) => m.type === 'scene:update').length, 0)
  assert.equal(messages.filter((m) => m.type === 'error').length, 1)

  await server.close()
})



test('si le port demandé est occupé, le serveur en prend un autre et le publie', async () => {
  const file = join(dir, 'canvas.excalidraw')
  const portFile = join(dir, 'excalidraw.port')

  const squatter = createTcpServer()
  await new Promise((r) => squatter.listen(0, '127.0.0.1', r))
  const taken = squatter.address().port

  server = await startServer({ file, port: taken, portFile })
  assert.notEqual(server.port, taken)
  assert.equal((await readFile(portFile, 'utf8')).trim(), String(server.port))

  await server.close()
  await new Promise((r) => squatter.close(r))
})

test("refuse d'écraser une scène non-vide par une scène vide (perte de données)", async () => {
  const file = join(dir, 'canvas.excalidraw')
  await writeFile(file, JSON.stringify({ ...EMPTY_SCENE, elements: [rectangle] }))
  server = await startServer({ file, port: 0 })

  // Le navigateur qui n'a pas fini de charger la scène poste `elements: []`.
  const res = await fetch(`http://127.0.0.1:${server.port}/api/scene`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(EMPTY_SCENE),
  })

  assert.equal(res.status, 409)
  const kept = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(kept.elements.length, 1, 'le dessin ne doit pas avoir été effacé')

  await server.close()
})

test('un effacement délibéré (allowEmpty) est bien accepté', async () => {
  const file = join(dir, 'canvas.excalidraw')
  await writeFile(file, JSON.stringify({ ...EMPTY_SCENE, elements: [rectangle] }))
  server = await startServer({ file, port: 0 })

  const res = await fetch(`http://127.0.0.1:${server.port}/api/scene?allowEmpty=1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(EMPTY_SCENE),
  })

  assert.equal(res.status, 200)
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')).elements, [])

  await server.close()
})
