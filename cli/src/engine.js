// engine.js — moteur de copie idempotente avec rapport de diff.
// Sécurité : aucun fichier n'est lu/écrit hors du payload / de la cible
// (containment strict), les symlinks sont ignorés (jamais suivis).
import {
  readdirSync, lstatSync, statSync, existsSync, readFileSync,
  mkdirSync, copyFileSync, chmodSync,
} from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';

const IGNORED = new Set(['.DS_Store']);

/** Vrai si `resolve(base, p)` reste à l'intérieur de `base` (pas d'évasion `../`). */
function within(base, p) {
  const b = resolve(base);
  const r = resolve(base, p);
  return r === b || r.startsWith(b + sep);
}

function basename(p) {
  const i = p.lastIndexOf('/');
  return i === -1 ? p : p.slice(i + 1);
}

/**
 * Walk récursif : chemins de fichiers relatifs à `root`, sous `rel`.
 * Utilise lstat → les symlinks sont IGNORÉS (jamais suivis), reportés dans `links`.
 */
function walk(root, rel, links) {
  const abs = rel ? join(root, rel) : root;
  if (!existsSync(abs)) return [];
  let st;
  try { st = lstatSync(abs); } catch { return []; }
  if (st.isSymbolicLink()) { links.push(rel); return []; }
  if (st.isFile()) return IGNORED.has(basename(rel)) ? [] : [rel];
  if (!st.isDirectory()) return [];
  const out = [];
  for (const entry of readdirSync(abs).sort()) {
    if (IGNORED.has(entry)) continue;
    out.push(...walk(root, rel ? join(rel, entry) : entry, links));
  }
  return out;
}

/**
 * Collecte les fichiers (chemins relatifs au payload) couverts par `modulePaths`.
 * - `missing`  : chemins de module absents du payload (non bloquant)
 * - `rejected` : chemins de module qui s'évadent du payload (`../`) — IGNORÉS
 * - `links`    : symlinks rencontrés et ignorés
 */
export function collectFiles(payloadRoot, modulePaths) {
  const files = [];
  const missing = [];
  const rejected = [];
  const links = [];
  for (const p of modulePaths) {
    const clean = p.replace(/\/+$/, ''); // retire le slash final
    if (!within(payloadRoot, clean)) { rejected.push(p); continue; }
    const abs = join(payloadRoot, clean);
    if (!existsSync(abs)) { missing.push(clean); continue; }
    files.push(...walk(payloadRoot, clean, links));
  }
  return { files: [...new Set(files)].sort(), missing, rejected, links };
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
 * - fichier absent      → created (copié sauf dryRun)
 * - identique           → unchanged (no-op)
 * - différent + force   → updated (copié)
 * - différent sans force → conflicts (diff, JAMAIS écrasé)
 * - hors target/payload → rejected (défense en profondeur, JAMAIS écrit)
 *
 * Renvoie { created, unchanged, updated, conflicts, rejected }.
 */
export function applyFiles({ payloadRoot, target, files, force = false, dryRun = false }) {
  const report = { created: [], unchanged: [], updated: [], conflicts: [], rejected: [] };
  for (const rel of files) {
    // Défense en profondeur : refuser tout chemin qui s'évade de la cible OU du payload.
    if (!within(target, rel) || !within(payloadRoot, rel)) {
      report.rejected.push(rel);
      continue;
    }
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
