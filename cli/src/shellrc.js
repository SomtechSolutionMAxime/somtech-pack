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
export function stripBlock(text, begin = MARKER_BEGIN, end = MARKER_END) {
  const out = [];
  let skip = false;
  for (const line of text.split('\n')) {
    if (line === begin) { skip = true; continue; }
    if (skip) { if (line === end) skip = false; continue; }
    out.push(line);
  }
  return out.join('\n').replace(/\n+$/, '\n');
}

/**
 * Pose (ou remplace) un bloc gardé dans un fichier de configuration de shell, de façon
 * idempotente : jamais de doublon, backup `.somtech.bak` avant réécriture, et refus net
 * si le fichier porte un bloc déséquilibré (BEGIN≠END) — auquel cas on ne devine pas où
 * il finit, et deviner coûterait les lignes de quelqu'un d'autre.
 *
 * Extrait de `installRcBlock` quand un second bloc a eu besoin des mêmes garanties :
 * celui qui met les outils de poste sur le PATH (T-20260819-0013). Deux mécanismes de
 * pose auraient divergé, et c'est celui qu'on ne relit plus qui aurait perdu le backup.
 *
 * Renvoie { action: 'added'|'updated', backup? }.
 */
export function upsertGuardedBlock({ file, begin, end, block }) {
  const existed = existsSync(file);
  const text = existed ? readFileSync(file, 'utf8') : '';

  const nBegin = count(text, begin);
  const nEnd = count(text, end);
  if (nBegin !== nEnd) {
    throw new Error(
      `Bloc déséquilibré dans ${file} (BEGIN=${nBegin}, END=${nEnd}). ` +
        `Édition refusée pour éviter une perte de données — corrige/supprime le bloc à la main.`
    );
  }

  let backup;
  if (existed && text.length > 0) {
    backup = `${file}.somtech.bak`;
    writeFileSync(backup, text);
  }

  let next;
  let action;
  if (nBegin > 0) {
    next = stripBlock(text, begin, end) + block;
    action = 'updated';
  } else {
    const sep = text.length === 0 || text.endsWith('\n') ? '\n' : '\n\n';
    next = text + sep + block;
    action = 'added';
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, next);
  return { action, backup };
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
 * - copie les libs voisines de `snippetSrc` → `<destDir>/` si présentes (claude-swt.sh
 *   les source depuis son dossier d'install) :
 *     · `swt-db.sh` — BD par worktree (D-20260709-0003) ; sans elle, `swt_db_up` jamais
 *       défini, aucun Postgres provisionné ;
 *     · `mcp-env.sh` — jetons MCP du poste (E-20260807-0009) ; sans elle, aucune
 *       session née hors de `claude-swt` n'a de registre joignable ;
 *     · `pack-freshness.sh` — fraîcheur du pack : nudge + auto-PR au launch
 *       (D-20260715-0001) ; sans elle, `pf_nudge_launch`/`pf_auto_pr` jamais définies →
 *       feature inerte (bug D-20260715-0003).
 *   Parité avec scripts/install-claude-swt.sh.
 * - ajoute/met à jour un bloc gardé qui le source (jamais de doublon)
 * - backup `<rcFile>.somtech.bak` avant réécriture
 * Lève si le rc contient un bloc déséquilibré (BEGIN≠END) → anti-perte de données.
 * Renvoie { action: 'added'|'updated'|'dry-run', destFile, backup? }.
 */
export function installRcBlock({ rcFile, destDir, snippetSrc, dryRun = false }) {
  if (!existsSync(snippetSrc)) throw new Error(`snippet claude-swt introuvable : ${snippetSrc}`);
  const destFile = join(destDir, 'claude-swt.sh');

  if (dryRun) return { action: 'dry-run', destFile };

  // 1. Installer le fichier source (+ les libs voisines sourcées par claude-swt.sh).
  mkdirSync(destDir, { recursive: true });
  copyFileSync(snippetSrc, destFile);
  // Chaque lib DOIT être copiée : claude-swt.sh les source depuis son dossier d'install ;
  // absente, le `source` échoue en silence et la fonctionnalité correspondante est inerte.
  for (const lib of ['swt-db.sh', 'pack-freshness.sh', 'mcp-env.sh']) {
    const libSrc = join(dirname(snippetSrc), lib);
    if (existsSync(libSrc)) copyFileSync(libSrc, join(destDir, lib));
  }

  // 2. Mettre à jour le rc de façon idempotente (mêmes garanties pour tous les blocs
  //    gardés du pack : pas de doublon, backup, refus si déséquilibré).
  const { action, backup } = upsertGuardedBlock({
    file: rcFile,
    begin: MARKER_BEGIN,
    end: MARKER_END,
    block: buildBlock(destFile),
  });
  return { action, destFile, backup };
}
