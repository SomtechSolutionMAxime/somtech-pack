// userskills.js — installation idempotente des skills globaux Somtech.
// Copie payload/.claude/user-skills/* → <skillsDir>/* (réutilise le moteur).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { collectFiles, applyFiles } from './engine.js';

/**
 * Installe les skills globaux depuis le payload vers `skillsDir` (def: ~/.claude/skills).
 * Idempotent (copie via applyFiles : created/unchanged/conflicts, containment, no symlink).
 * Renvoie le rapport + la liste des skills détectés.
 */
export function installUserSkills({ payloadRoot, skillsDir, dryRun = false, force = false }) {
  const base = join(payloadRoot, '.claude', 'user-skills');
  const empty = { created: [], unchanged: [], updated: [], conflicts: [], rejected: [], skills: [] };
  if (!existsSync(base)) return empty;

  const { files } = collectFiles(base, ['']);
  const report = applyFiles({ payloadRoot: base, target: skillsDir, files, force, dryRun });

  // Dériver la liste des skills des fichiers RÉELLEMENT collectés (cohérent avec
  // le moteur : un dossier-skill symlinké est ignoré par collectFiles, donc absent
  // ici aussi — pas de "skill annoncé mais non installé").
  const handled = [...report.created, ...report.unchanged, ...report.updated];
  const skills = [...new Set(handled.map((rel) => rel.split('/')[0]).filter(Boolean))].sort();
  return { ...report, skills };
}
