// engine.js — moteur de copie idempotente avec rapport de diff.
import {
  readdirSync, statSync, existsSync, readFileSync,
  mkdirSync, copyFileSync, chmodSync,
} from 'node:fs';
import { join, dirname } from 'node:path';

const IGNORED = new Set(['.DS_Store']);

/** Walk récursif : renvoie les chemins de fichiers relatifs à `root`, sous `rel`. */
function walk(root, rel = '') {
  const abs = rel ? join(root, rel) : root;
  if (!existsSync(abs)) return [];
  const st = statSync(abs);
  if (st.isFile()) return IGNORED.has(basename(rel)) ? [] : [rel];
  if (!st.isDirectory()) return [];
  const out = [];
  for (const entry of readdirSync(abs).sort()) {
    if (IGNORED.has(entry)) continue;
    out.push(...walk(root, rel ? join(rel, entry) : entry));
  }
  return out;
}

function basename(p) {
  const i = p.lastIndexOf('/');
  return i === -1 ? p : p.slice(i + 1);
}

/**
 * Collecte les fichiers (chemins relatifs au payload) couverts par `modulePaths`.
 * Les chemins inexistants sont renvoyés dans `missing` (non bloquant).
 */
export function collectFiles(payloadRoot, modulePaths) {
  const files = [];
  const missing = [];
  for (const p of modulePaths) {
    const clean = p.replace(/\/+$/, ''); // retire le slash final
    const abs = join(payloadRoot, clean);
    if (!existsSync(abs)) {
      missing.push(clean);
      continue;
    }
    files.push(...walk(payloadRoot, clean));
  }
  return { files: [...new Set(files)].sort(), missing };
}

function filesEqual(a, b) {
  try {
    return readFileSync(a).equals(readFileSync(b));
  } catch {
    return false;
  }
}

function copyPreservingMode(src, dest, dryRun) {
  if (dryRun) return;
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  try {
    chmodSync(dest, statSync(src).mode & 0o777);
  } catch {
    /* best-effort : préserver le bit exécutable */
  }
}

/**
 * Applique les fichiers du payload vers `target`. Idempotent.
 * mode : 'init' | 'update' (sémantique/messages ; même logique de copie).
 * - fichier absent     → created (copié sauf dryRun)
 * - identique          → unchanged (no-op)
 * - différent + force  → updated (copié)
 * - différent sans force→ conflicts (diff, JAMAIS écrasé)
 *
 * Renvoie { created, unchanged, updated, conflicts } (chemins relatifs).
 */
export function applyFiles({ payloadRoot, target, files, force = false, dryRun = false }) {
  const report = { created: [], unchanged: [], updated: [], conflicts: [] };
  for (const rel of files) {
    const src = join(payloadRoot, rel);
    const dest = join(target, rel);
    if (!existsSync(dest)) {
      copyPreservingMode(src, dest, dryRun);
      report.created.push(rel);
    } else if (filesEqual(src, dest)) {
      report.unchanged.push(rel);
    } else if (force) {
      copyPreservingMode(src, dest, dryRun);
      report.updated.push(rel);
    } else {
      report.conflicts.push(rel);
    }
  }
  return report;
}
