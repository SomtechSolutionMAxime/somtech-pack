// globalcommands.js — miroir GLOBAL des commandes du pack vers ~/.claude/commands.
// Copie payload/.claude/commands/* → <commandsDir>/* (réutilise le moteur idempotent).
//
// Pourquoi : les commandes slash du pack (`/canvas`, `/brd`, `/pousse`…) voyagent avec
// `.claude/` vers les PROJETS, mais la configuration du poste ne les installait nulle
// part — contrairement aux compétences et aux workflows, qui ont chacun leur miroir.
// Une commande n'existait donc que dans les projets ayant reçu le pack, jamais dans une
// session ouverte ailleurs. C'est le trou que ce miroir comble.
//
// Garanties (identiques à globalskills / globalworkflows) :
// - ne touche QUE les commandes présentes dans le pack ; une commande perso hors-pack
//   n'est jamais dans le payload donc jamais écrite ni supprimée (le moteur ne supprime rien) ;
// - une commande du pack modifiée à la main en global CONVERGE vers la version du pack
//   par défaut (source de vérité unique), avec sauvegarde `<fichier>.somtech.bak` avant
//   écrasement ;
// - une commande symlinkée (dev qui link vers le repo source) n'est jamais écrite à travers.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { collectFiles, applyFiles } from './engine.js';

/**
 * Mirror des commandes du pack (`.claude/commands/*`) vers `commandsDir`
 * (def: ~/.claude/commands). Renvoie le rapport applyFiles (avec `backedUp`)
 * + la liste des commandes détectées (nom du fichier .md sans extension).
 */
export function installGlobalCommands({ payloadRoot, commandsDir, dryRun = false, force = false }) {
  const base = join(payloadRoot, '.claude', 'commands');
  const empty = { created: [], unchanged: [], updated: [], conflicts: [], rejected: [], preserved: [], backedUp: [], commands: [] };
  if (!existsSync(base)) return empty;

  const { files, links, rejected } = collectFiles(base, ['']);
  const report = applyFiles({ payloadRoot: base, target: commandsDir, files, force, dryRun, backup: true });

  // Liste des commandes réellement prises en charge (nom de fichier .md sans extension).
  const handled = [...report.created, ...report.unchanged, ...report.updated];
  const commands = [...new Set(
    handled.filter((rel) => rel.endsWith('.md')).map((rel) => rel.replace(/\.md$/, ''))
  )].sort();
  // `payloadLinks`/`payloadRejected` : symlinks ou chemins évadés rencontrés DANS le pack
  // (ignorés par le moteur). Vides aujourd'hui ; remontés pour visibilité si ça change.
  return { ...report, commands, payloadLinks: links, payloadRejected: rejected };
}
