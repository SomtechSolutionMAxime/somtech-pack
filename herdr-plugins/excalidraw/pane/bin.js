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

import { encodeImage, clearImages, detectSupport } from './kitty.js'
import { paths } from '../server/paths.js'

const projectIndex = process.argv.indexOf('--project')
const project = projectIndex === -1 ? process.cwd() : process.argv[projectIndex + 1]
const { portFile, canvasFile } = paths(project)

const OUT = process.stdout

let currentPort = null
let lastPng = null
let connected = false
let editors = 0
let lastError = null
let elementCount = null
let lastUpdate = null

/**
 * Le protocole graphique est relayé au terminal HÔTE : herdr sait le faire, mais
 * Terminal.app (par exemple) ne sait pas dessiner d'image. Interroger le terminal
 * ne le révèle pas — c'est herdr qui répond OK, pas l'hôte. Le pane affiche donc
 * TOUJOURS un état lisible en texte, et tente l'image par-dessus.
 */

const size = () => ({ columns: OUT.columns ?? 80, rows: OUT.rows ?? 24 })

function status(text) {
  const { rows } = size()
  OUT.write(`\x1b[${rows};1H\x1b[2K\x1b[2m${text}\x1b[0m`)
}

/**
 * L'état, dit honnêtement. L'aperçu n'est produit QUE par le navigateur : sans
 * éditeur connecté, l'image affichée peut être périmée — le pane ne peut pas le
 * deviner tout seul, donc il l'annonce.
 */
function statusLine() {
  if (lastError) return `⚠ ${lastError}`
  if (!connected) return `${canvasFile} — serveur injoignable (dernier aperçu connu)`
  if (editors === 0) return `${canvasFile} — aucun onglet ouvert : image possiblement périmée`
  return canvasFile
}

function draw() {
  OUT.write('\x1b[2J\x1b[H') // efface l'écran
  OUT.write(clearImages()) // ...et notre image précédente, sinon elles s'empilent

  // Le texte d'abord : si le terminal hôte ne dessine pas les images, c'est tout
  // ce que l'utilisateur verra — un pane noir ne dit rien à personne.
  const lines = [
    '\x1b[1mCanvas Excalidraw\x1b[0m',
    `  fichier   ${canvasFile}`,
    `  éditer    http://127.0.0.1:${currentPort}/`,
    `  éléments  ${elementCount ?? '—'}`,
    `  màj       ${lastUpdate ?? '—'}`,
  ]
  OUT.write(lines.join('\r\n') + '\r\n')

  if (lastPng) OUT.write(encodeImage(lastPng, { columns: size().columns, rows: size().rows - lines.length }))
  status(statusLine())
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
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?role=pane`)

  socket.on('open', () => {
    connected = true
    draw()
  })

  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString())
    if (message.type === 'preview:update') {
      lastPng = Buffer.from(message.png, 'base64')
      lastError = null // un nouvel aperçu prouve que le fichier est de nouveau lisible
      lastUpdate = new Date().toLocaleTimeString('fr-CA')
      readCount()
      draw()
    } else if (message.type === 'editors') {
      editors = message.count
      draw()
    } else if (message.type === 'error') {
      // Gardée jusqu'à la prochaine bonne nouvelle : sinon le prochain aperçu
      // l'effacerait et l'utilisateur ne saurait jamais que son fichier est cassé.
      lastError = message.message
      status(statusLine())
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

/** Le nombre d'éléments : la seule info de contenu lisible sans image. */
async function readCount() {
  try {
    const scene = JSON.parse(await readFile(canvasFile, 'utf8'))
    elementCount = scene.elements?.length ?? null
  } catch {
    elementCount = null
  }
}

currentPort = await readPort()

if (!OUT.isTTY) {
  degrade(currentPort)
} else {
  OUT.write('\x1b[?25l') // masque le curseur
  process.on('exit', () => OUT.write('\x1b[?25h'))
  process.stdout.on('resize', draw)
  await readCount()
  draw()
  connect(currentPort)
}
