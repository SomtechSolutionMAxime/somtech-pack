// globalworkflows.js — miroir GLOBAL des workflows du pack vers ~/.claude/workflows.
// Copie payload/.claude/workflows/* → <workflowsDir>/* (réutilise le moteur idempotent).
//
// Pourquoi : les Workflows Somtech (fichiers .js exécutés par l'outil Workflow) sont
// invoqués GLOBALEMENT (ex. `analyse-decoupage-demande`, appelé par le skill
// `plan-servicedesk`/`superplan`). Le skill voyage déjà via le pack, mais sa
// dépendance — le workflow — ne l'était pas : sur un poste neuf, `superplan` casse
// dès qu'il invoque le découpage. Ce miroir comble ce trou, comme `globalskills`.
//
// Garanties (identiques à globalskills) :
// - ne touche QUE les workflows présents dans le pack ; un workflow perso hors-pack
//   n'est jamais dans le payload donc jamais écrit ni supprimé (le moteur ne supprime rien) ;
// - un workflow du pack modifié à la main en global est « divergent » : NON écrasé
//   sans `force` ;
// - avec `force`, chaque écrasement crée un backup `<fichier>.somtech.bak` (anti-perte).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { collectFiles, applyFiles } from './engine.js';

/**
 * Mirror des workflows du pack (`.claude/workflows/*`) vers `workflowsDir`
 * (def: ~/.claude/workflows). Renvoie le rapport applyFiles (avec `backedUp`)
 * + la liste des workflows détectés (basename sans extension).
 */
export function installGlobalWorkflows({ payloadRoot, workflowsDir, dryRun = false, force = false }) {
  const base = join(payloadRoot, '.claude', 'workflows');
  const empty = { created: [], unchanged: [], updated: [], conflicts: [], rejected: [], preserved: [], backedUp: [], workflows: [] };
  if (!existsSync(base)) return empty;

  const { files, links, rejected } = collectFiles(base, ['']);
  const report = applyFiles({ payloadRoot: base, target: workflowsDir, files, force, dryRun, backup: true });

  // Liste des workflows réellement pris en charge (nom de fichier .js sans extension).
  const handled = [...report.created, ...report.unchanged, ...report.updated];
  const workflows = [...new Set(
    handled.filter((rel) => rel.endsWith('.js')).map((rel) => rel.replace(/\.js$/, ''))
  )].sort();
  // `payloadLinks`/`payloadRejected` : symlinks ou chemins évadés rencontrés DANS le pack
  // (ignorés par le moteur). Vides aujourd'hui ; remontés pour visibilité si ça change.
  return { ...report, workflows, payloadLinks: links, payloadRejected: rejected };
}
