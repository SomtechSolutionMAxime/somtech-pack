import { test } from 'node:test'
import assert from 'node:assert/strict'

import { encodeImage, CHUNK_SIZE, clearImages } from '../pane/kitty.js'

const png = Buffer.alloc(10_000, 0x42)

test("l'image est transmise en PNG (f=100), pas en pixels bruts", () => {
  const out = encodeImage(png, { columns: 80, rows: 24 })
  assert.match(out, /\x1b_G[^;]*f=100/)
})

test('la charge utile est découpée en morceaux de 4096 octets maximum', () => {
  const out = encodeImage(png, { columns: 80, rows: 24 })
  const payloads = [...out.matchAll(/\x1b_G[^;]*;([^\x1b]*)\x1b\\/g)].map((m) => m[1])

  assert.ok(payloads.length > 1, 'une image de 10 ko doit produire plusieurs morceaux')
  for (const payload of payloads) assert.ok(payload.length <= CHUNK_SIZE, 'morceau trop gros')
})

test('tous les morceaux sauf le dernier sont marqués m=1, le dernier m=0', () => {
  const out = encodeImage(png, { columns: 80, rows: 24 })
  const controls = [...out.matchAll(/\x1b_G([^;]*);/g)].map((m) => m[1])

  assert.ok(controls.slice(0, -1).every((c) => c.includes('m=1')))
  assert.ok(controls.at(-1).includes('m=0'))
})

test("l'image est dimensionnée en cellules d'après la taille du pane", () => {
  const out = encodeImage(png, { columns: 80, rows: 24 })
  assert.match(out, /c=80/)
  assert.match(out, /r=2[0-9]/) // quelques lignes réservées au bandeau d'état
})

test('la charge utile est du base64 valide et reconstitue le PNG', () => {
  const out = encodeImage(png, { columns: 80, rows: 24 })
  const payloads = [...out.matchAll(/\x1b_G[^;]*;([^\x1b]*)\x1b\\/g)].map((m) => m[1])
  const rebuilt = Buffer.from(payloads.join(''), 'base64')
  assert.equal(rebuilt.toString('hex'), png.toString('hex'))
})

test('effacer les images émet la séquence de suppression', () => {
  assert.match(clearImages(), /\x1b_Ga=d/)
})

test("la détection interroge le terminal plutôt que de deviner d'après l'environnement", async (t) => {
  const { detectSupport, SUPPORT_QUERY } = await import('../pane/kitty.js')
  const written = []

  // Un terminal qui répond OK → supporté, quelles que soient les variables d'env.
  const stdin = new (await import('node:events')).EventEmitter()
  Object.assign(stdin, { isTTY: true, setRawMode() {}, resume() {}, pause() {}, removeListener: stdin.removeListener.bind(stdin) })
  const stdout = { isTTY: true, write: (s) => { written.push(s); queueMicrotask(() => stdin.emit('data', Buffer.from('\x1b_Gi=31;OK\x1b\\'))) } }

  assert.equal(await detectSupport(stdin, stdout, 300), true)
  assert.equal(written[0], SUPPORT_QUERY)
})

test('un terminal muet est considéré comme non supporté (repli, pas de blocage)', async () => {
  const { detectSupport } = await import('../pane/kitty.js')
  const stdin = new (await import('node:events')).EventEmitter()
  Object.assign(stdin, { isTTY: true, setRawMode() {}, resume() {}, pause() {} })
  const stdout = { isTTY: true, write() {} }

  assert.equal(await detectSupport(stdin, stdout, 100), false)
})
