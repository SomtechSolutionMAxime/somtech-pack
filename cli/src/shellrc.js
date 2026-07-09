// shellrc.js — installation idempotente du snippet claude-swt dans un rc shell.
// Port Node de scripts/install-claude-swt.sh (bloc gardé par marqueurs, backup,
// refus si déséquilibré). Aucun chemin hors de ce qui est demandé.
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

export const MARKER_BEGIN = '# >>> somtech claude-swt >>>';
export const MARKER_END = '# <<< somtech claude-swt <<<';

function count(text, needle) {
  return text.split(needle).length - 1;
}

/** Retire tout bloc gardé (entre marqueurs) du texte, normalise les fins de ligne. */
export function stripBlock(text) {
  const out = [];
  let skip = false;
  for (const line of text.split('\n')) {
    if (line === MARKER_BEGIN) { skip = true; continue; }
    if (skip) { if (line === MARKER_END) skip = false; continue; }
    out.push(line);
  }
  return out.join('\n').replace(/\n+$/, '\n');
}

/** Construit le bloc gardé qui source le snippet installé. */
export function buildBlock(destFile) {
  return [
    MARKER_BEGIN,
    '# claude-swt — worktree par session (somtech-pack). Ne pas éditer à la main.',
    `[ -f "${destFile}" ] && source "${destFile}"`,
    MARKER_END,
    '',
  ].join('\n');
}

/**
 * Installe le snippet claude-swt dans `rcFile`, idempotent.
 * - copie `snippetSrc` → `<destDir>/claude-swt.sh`
 * - copie la lib `swt-db.sh` (voisine de `snippetSrc`) → `<destDir>/swt-db.sh`
 *   si présente : claude-swt.sh la source pour provisionner la BD par worktree
 *   (D-20260709-0003). Sans elle, `swt_db_up` n'est jamais défini et aucun
 *   Postgres n'est provisionné — parité avec scripts/install-claude-swt.sh.
 * - ajoute/met à jour un bloc gardé qui le source (jamais de doublon)
 * - backup `<rcFile>.somtech.bak` avant réécriture
 * Lève si le rc contient un bloc déséquilibré (BEGIN≠END) → anti-perte de données.
 * Renvoie { action: 'added'|'updated'|'dry-run', destFile, backup? }.
 */
export function installRcBlock({ rcFile, destDir, snippetSrc, dryRun = false }) {
  if (!existsSync(snippetSrc)) throw new Error(`snippet claude-swt introuvable : ${snippetSrc}`);
  const destFile = join(destDir, 'claude-swt.sh');

  if (dryRun) return { action: 'dry-run', destFile };

  // 1. Installer le fichier source (+ la lib swt-db.sh à côté, sourcée par claude-swt.sh).
  mkdirSync(destDir, { recursive: true });
  copyFileSync(snippetSrc, destFile);
  const libSrc = join(dirname(snippetSrc), 'swt-db.sh');
  if (existsSync(libSrc)) copyFileSync(libSrc, join(destDir, 'swt-db.sh'));

  // 2. Mettre à jour le rc de façon idempotente.
  const existed = existsSync(rcFile);
  const rc = existed ? readFileSync(rcFile, 'utf8') : '';

  const nBegin = count(rc, MARKER_BEGIN);
  const nEnd = count(rc, MARKER_END);
  if (nBegin !== nEnd) {
    throw new Error(
      `Bloc claude-swt déséquilibré dans ${rcFile} (BEGIN=${nBegin}, END=${nEnd}). ` +
        `Édition refusée pour éviter une perte de données — corrige/supprime le bloc à la main.`
    );
  }

  let backup;
  if (existed && rc.length > 0) {
    backup = `${rcFile}.somtech.bak`;
    writeFileSync(backup, rc);
  }

  const block = buildBlock(destFile);
  let next;
  let action;
  if (nBegin > 0) {
    const base = stripBlock(rc);
    next = (base === '' ? '' : base) + block;
    action = 'updated';
  } else {
    const sep = rc.length === 0 || rc.endsWith('\n') ? '\n' : '\n\n';
    next = rc + sep + block;
    action = 'added';
  }
  writeFileSync(rcFile, next);
  return { action, destFile, backup };
}
