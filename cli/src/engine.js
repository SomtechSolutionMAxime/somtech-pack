// engine.js — moteur de copie idempotente avec rapport de diff.
// Sécurité : aucun fichier n'est lu/écrit hors du payload / de la cible
// (containment strict) ; les symlinks du payload SOURCE sont ignorés (jamais suivis) ;
// un symlink en CIBLE n'est jamais écrit à travers (traité comme divergent) ;
// le moteur ne supprime JAMAIS rien.
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
 * Sauvegarde `dest` AVANT de l'écraser (filet anti-perte). Best-effort, préserve le mode.
 * N'écrase JAMAIS un backup existant : si `<dest>.somtech.bak` est pris, suffixe numéroté
 * `.somtech.bak.1`, `.2`… → aucune version sauvegardée n'est jamais perdue.
 * Renvoie le chemin du backup, ou null si dryRun/échec.
 */
function backupFile(dest, dryRun) {
  if (dryRun) return null;
  let bak = `${dest}.somtech.bak`;
  if (existsSync(bak)) {
    let n = 1;
    while (existsSync(`${dest}.somtech.bak.${n}`)) n++;
    bak = `${dest}.somtech.bak.${n}`;
  }
  try {
    copyFileSync(dest, bak);
    try { chmodSync(bak, statSync(dest).mode & 0o777); } catch { /* best-effort */ }
    return bak;
  } catch {
    return null;
  }
}

/**
 * Applique les fichiers du payload vers `target`. Idempotent.
 *
 * **Convergence par défaut (D-20260715-0002)** — le pack est la source de vérité unique.
 * Un fichier **pack-owned** (hors `preserve`, non symlinké) prend TOUJOURS la version du
 * pack : une copie locale qui diffère est de la DÉRIVE, pas un état à protéger.
 * - fichier absent          → created (copié sauf dryRun)
 * - identique               → unchanged (no-op)
 * - différent (pack-owned)  → updated : ÉCRASÉ par la version du pack + backup .somtech.bak
 *                             (par défaut, sans `--force` ; `force` est donc redondant ici)
 * - symlink en cible        → conflicts : JAMAIS écrit à travers (protège un dev setup qui
 *                             symlinke vers le repo source)
 * - hors target/payload     → rejected (défense en profondeur, JAMAIS écrit)
 *
 * `preserve` : chemins (relatifs) appartenant au projet/perso — créés s'ils sont ABSENTS
 * (starter), mais JAMAIS écrasés s'ils existent (ex. `.claude/settings.json` :
 * permissions/plugins/hooks propres au projet). C'est la SEULE catégorie protégée.
 *
 * `force` / `backup` : conservés pour compat ascendante mais **sans effet sur la
 * convergence** — un divergent pack-owned est toujours écrasé, et toujours sauvegardé
 * avant (filet anti-perte). `--force` ne débloque plus rien (il n'y a plus de gate).
 *
 * Renvoie { created, unchanged, updated, conflicts, rejected, preserved, backedUp }.
 */
export function applyFiles({ payloadRoot, target, files, force = false, dryRun = false, preserve = [], backup = false }) {
  void force; void backup; // acceptés (compat) mais la convergence ne dépend plus d'eux
  const preserveSet = new Set(preserve);
  const report = { created: [], unchanged: [], updated: [], conflicts: [], rejected: [], preserved: [], backedUp: [] };
  for (const rel of files) {
    // Défense en profondeur : refuser tout chemin qui s'évade de la cible OU du payload.
    if (!within(target, rel) || !within(payloadRoot, rel)) {
      report.rejected.push(rel);
      continue;
    }
    const src = join(payloadRoot, rel);
    const dest = join(target, rel);
    // Ne JAMAIS écrire à travers un symlink en cible : `copyFileSync` suivrait le lien
    // et écraserait la donnée pointée (potentiellement un fichier perso hors-cible, ou le
    // repo source dans un dev setup). Un dest symlinké est laissé tel quel (conflict).
    let destLink = null;
    try { destLink = lstatSync(dest); } catch { /* n'existe pas */ }
    if (destLink && destLink.isSymbolicLink()) {
      report.conflicts.push(rel);
      continue;
    }
    if (!existsSync(dest)) {
      copyPreservingMode(src, dest, dryRun);
      report.created.push(rel);
    } else if (preserveSet.has(rel)) {
      report.preserved.push(rel); // appartient au projet : jamais écrasé
    } else if (filesEqual(src, dest)) {
      report.unchanged.push(rel);
    } else {
      // pack-owned + divergent → CONVERGE : backup anti-perte PUIS écrasement (par défaut).
      const bak = backupFile(dest, dryRun);
      if (bak) report.backedUp.push(rel);
      copyPreservingMode(src, dest, dryRun);
      report.updated.push(rel);
    }
  }
  return report;
}
