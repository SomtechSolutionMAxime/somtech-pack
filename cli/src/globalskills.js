// globalskills.js — miroir GLOBAL des skills du pack vers ~/.claude/skills.
// Copie payload/.claude/skills/* → <skillsDir>/* (réutilise le moteur idempotent).
//
// Garanties :
// - ne touche QUE les skills présents dans le pack ; les skills perso hors-pack
//   (assemblyai, brand, graphify…) ne sont jamais dans le payload donc jamais
//   écrits ni supprimés (le moteur ne supprime rien) ;
// - un skill du pack modifié à la main en global est « divergent » : NON écrasé
//   sans `force` ;
// - avec `force`, chaque écrasement crée un backup `<fichier>.somtech.bak` (anti-perte).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { collectFiles, applyFiles } from './engine.js';

/**
 * Mirror des skills du pack (`.claude/skills/*`) vers `skillsDir` (def: ~/.claude/skills).
 * Renvoie le rapport applyFiles (avec `backedUp`) + la liste des skills détectés.
 */
export function installGlobalSkills({ payloadRoot, skillsDir, dryRun = false, force = false }) {
  const base = join(payloadRoot, '.claude', 'skills');
  const empty = { created: [], unchanged: [], updated: [], conflicts: [], rejected: [], preserved: [], backedUp: [], skills: [] };
  if (!existsSync(base)) return empty;

  const { files } = collectFiles(base, ['']);
  const report = applyFiles({ payloadRoot: base, target: skillsDir, files, force, dryRun, backup: true });

  // Liste des skills réellement pris en charge (1er segment du chemin relatif).
  const handled = [...report.created, ...report.unchanged, ...report.updated];
  const skills = [...new Set(handled.map((rel) => rel.split('/')[0]).filter(Boolean))].sort();
  return { ...report, skills };
}
