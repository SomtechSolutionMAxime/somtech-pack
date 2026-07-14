#!/usr/bin/env node
/**
 * Le pane miroir : se connecte au serveur du canvas et redessine l'aperçu à
 * chaque changement. Lecture seule — l'édition vit dans le navigateur.
 *
 * Usage : node pane/bin.js [--project <dir>]
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import WebSocket from 'ws'

import { encodeImage, clearImages } from './kitty.js'
import { paths } from '../server/paths.js'

const projectIndex = process.argv.indexOf('--project')
const project = projectIndex === -1 ? process.cwd() : process.argv[projectIndex + 1]
const { portFile, canvasFile } = paths(project)

const OUT = process.stdout
const supportsGraphics = OUT.isTTY && process.env.TERM_PROGRAM !== 'Apple_Terminal'

let lastPng = null
let connected = false

const size = () => ({ columns: OUT.columns ?? 80, rows: OUT.rows ?? 24 })

function status(text) {
  const { rows } = size()
  OUT.write(`\x1b[${rows};1H\x1b[2K\x1b[2m${text}\x1b[0m`)
}

function draw() {
  OUT.write('\x1b[2J\x1b[H') // efface l'écran
  OUT.write(clearImages()) // ...et les images précédentes, sinon elles s'empilent

  if (!lastPng) {
    status(connected ? 'en attente du premier aperçu…' : 'connexion au canvas…')
    return
  }
  OUT.write(encodeImage(lastPng, size()))
  status(connected ? `${canvasFile}` : `${canvasFile} — déconnecté (dernier aperçu connu)`)
}

/** Sans protocole graphique, on informe au lieu de vomir des octets. */
function degrade(port) {
  console.log('Ce terminal ne supporte pas le protocole graphique Kitty.')
  console.log(`Canvas   : http://127.0.0.1:${port}/`)
  console.log(`Fichier  : ${canvasFile}`)
}

async function readPort() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      return Number((await readFile(portFile, 'utf8')).trim())
    } catch {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  throw new Error(`Serveur du canvas introuvable (${portFile} absent). Lancer l'action « Open Excalidraw canvas ».`)
}

function connect(port) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`)

  socket.on('open', () => {
    connected = true
    draw()
  })

  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString())
    if (message.type === 'preview:update') {
      lastPng = Buffer.from(message.png, 'base64')
      draw()
    } else if (message.type === 'error') {
      status(`⚠ ${message.message}`)
    }
  })

  const retry = () => {
    connected = false
    draw()
    setTimeout(() => connect(port), 1000)
  }
  socket.on('close', retry)
  socket.on('error', () => {})
}

const port = await readPort()
if (!supportsGraphics) {
  degrade(port)
} else {
  OUT.write('\x1b[?25l') // masque le curseur
  process.on('exit', () => OUT.write('\x1b[?25h'))
  process.stdout.on('resize', draw)
  draw()
  connect(port)
}
