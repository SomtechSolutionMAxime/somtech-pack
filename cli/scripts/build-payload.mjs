#!/usr/bin/env node
// build-payload.mjs — construit le payload bundlé du CLI DEPUIS le repo.
//
// Embarque pack.json + VERSION + le contenu de TOUS les modules déclarés dans
// pack.json dans cli/payload/ (ou $PAYLOAD_OUT), pour que le package npm publié
// soit auto-contenu. Construit toujours depuis les sources réelles → anti-drift.
//
// Lancé par `npm run build:payload` et par `prepublishOnly`.
import { rmSync, mkdirSync, cpSync, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // cli/scripts
const CLI_DIR = resolve(HERE, '..'); // cli
const REPO = resolve(CLI_DIR, '..'); // racine du repo
const OUT = resolve(process.env.PAYLOAD_OUT || join(CLI_DIR, 'payload'));

const manifestPath = join(REPO, 'pack.json');
if (!existsSync(manifestPath)) {
  console.error(`✗ pack.json introuvable à la racine du repo : ${manifestPath}`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// Repart d'un payload propre.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Métadonnées du pack.
copyFileSync(manifestPath, join(OUT, 'pack.json'));
if (existsSync(join(REPO, 'VERSION'))) copyFileSync(join(REPO, 'VERSION'), join(OUT, 'VERSION'));

// Contenu de tous les modules (dédupliqué).
const paths = new Set();
for (const m of Object.values(manifest.modules || {})) {
  for (const p of m.paths || []) paths.add(p.replace(/\/+$/, ''));
}

let copied = 0;
const skipped = [];
for (const p of [...paths].sort()) {
  const src = join(REPO, p);
  if (!existsSync(src)) { skipped.push(p); continue; }
  cpSync(src, join(OUT, p), {
    recursive: true,
    dereference: false, // ne pas suivre les symlinks
    filter: (s) => !s.endsWith('.DS_Store'),
  });
  copied++;
}

console.log(`✓ payload construit : ${OUT}`);
console.log(`  modules embarqués : ${copied} chemin(s)`);
if (skipped.length) console.log(`  (absents du repo, ignorés : ${skipped.join(', ')})`);
