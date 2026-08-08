// setup.js — configure le poste : skills globaux + claude-swt, en une commande.
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { resolvePayloadRoot } from '../modules.js';
import { installRcBlock } from '../shellrc.js';
import { installUserSkills } from '../userskills.js';
import { installGlobalSkills } from '../globalskills.js';
import { installGlobalWorkflows } from '../globalworkflows.js';
import { installGlobalCommands } from '../globalcommands.js';
import { installPosteModules } from '../posteonly.js';
import { installGlobalVersionHook, installGraphifyShareHook, installGlobalRegistreHook } from '../userhooks.js';

/** True si un binaire est sur le PATH (best-effort, jamais fatal). */
function hasBinary(name) {
  try {
    // `name` passé en $1 (pas d'interpolation dans la commande) → aucune injection.
    execFileSync('/bin/sh', ['-c', 'command -v "$1" >/dev/null 2>&1', 'sh', name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Consentement avant d'écrire des fichiers personnels (rc shell, skills globaux).
 * --yes ou --dry-run → OK. Sinon prompt TTY. Non-TTY sans --yes → refus.
 */
async function consent(flags, targets) {
  if (flags.yes || flags.dryRun) return true;
  const list = targets.join(', ');
  if (!process.stdin.isTTY) {
    console.error(
      `✗ setup va modifier ta config globale : ${list}.\n` +
        `  Relance avec --yes (consentement) ou --dry-run (aperçu sans écrire).`
    );
    return false;
  }
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const a = await rl.question(`setup va modifier ta config globale (${list}). Continuer ? [y/N] `);
    return /^y(es)?$/i.test(a.trim());
  } finally {
    rl.close();
  }
}

export async function cmdSetup(flags) {
  const payloadRoot = resolvePayloadRoot({ source: flags.source });
  const home = homedir();
  const rcFile = flags.rc || join(home, '.zshrc');
  const skillsDir = flags.skillsDir || join(home, '.claude', 'skills');
  const workflowsDir = flags.workflowsDir || join(home, '.claude', 'workflows');
  const commandsDir = flags.commandsDir || join(home, '.claude', 'commands');
  const destDir = flags.dest || join(home, '.somtech');
  const settingsFile = flags.settings || join(home, '.claude', 'settings.json');
  const hooksDir = flags.hooksDir || join(home, '.claude', 'hooks');
  const doSkills = !flags.noSkills;
  const doWorkflows = !flags.noWorkflows;
  const doCommands = !flags.noCommands;
  // Chaque outil de poste a SON drapeau : un seul drapeau pour toute la famille faisait
  // disparaître des outils que l'utilisateur ne visait pas.
  const exclurePoste = [];
  if (flags.noCanvas) exclurePoste.push('canvas');
  if (flags.noLigneDirecte) exclurePoste.push('ligne-directe');
  if (flags.noNaissanceRepresentant) exclurePoste.push('naissance-representant');
  const doPoste = !(flags.noCanvas && flags.noLigneDirecte && flags.noNaissanceRepresentant);
  const doSwt = !flags.noClaudeSwt;
  const doVersionHook = !flags.noVersionHook;
  const doGraphify = !flags.noGraphify;
  // Hook « registre injoignable » (E-20260807-0009) : installé par défaut. C'est la
  // garantie de dernier recours — l'agent qui naît sans registre le sait tout de suite.
  const doRegistreHook = !flags.noRegistreHook;

  if (!doSkills && !doWorkflows && !doCommands && !doPoste && !doSwt && !doVersionHook && !doGraphify && !doRegistreHook) {
    console.log('Rien à faire (--no-skills, --no-workflows, --no-commands, --no-canvas, --no-ligne-directe, --no-naissance-representant, --no-claude-swt, --no-version-hook, --no-graphify et --no-registre-hook).');
    return 0;
  }

  const consentTargets = [];
  if (doSkills) consentTargets.push(skillsDir);
  if (doWorkflows) consentTargets.push(workflowsDir);
  if (doCommands) consentTargets.push(commandsDir);
  if (doPoste && !consentTargets.includes(destDir)) consentTargets.push(destDir);
  if (doSwt) consentTargets.push(rcFile);
  if (doVersionHook) consentTargets.push(settingsFile);
  if (doGraphify && !consentTargets.includes(settingsFile)) consentTargets.push(settingsFile);
  if (doRegistreHook && !consentTargets.includes(settingsFile)) consentTargets.push(settingsFile);
  if (doRegistreHook && !consentTargets.includes(hooksDir)) consentTargets.push(hooksDir);
  if (doGraphify && !consentTargets.includes(destDir)) consentTargets.push(destDir);
  if (!(await consent(flags, consentTargets))) return 1;

  console.log(`Setup poste${flags.dryRun ? ' [dry-run]' : ''} :`);

  if (doSkills) {
    // 1) User-skills (skills pensés pour le poste : somtech-pack-install…).
    const r = installUserSkills({ payloadRoot, skillsDir, dryRun: flags.dryRun, force: flags.force });
    console.log(
      `  user-skills → ${skillsDir} : ${r.skills.join(', ') || '(aucun)'}` +
        ` (créés ${r.created.length}, maj ${r.updated.length}, inchangés ${r.unchanged.length})`
    );
    if (r.conflicts.length) {
      console.log(`    ↩︎  ${r.conflicts.length} symlink(s) en cible, non écrit(s) à travers.`);
    }

    // 2) Miroir GLOBAL de tous les skills du pack (convergence : ~/.claude/skills reprend
    //    TOUJOURS la version du pack, source de vérité unique). Ne touche jamais les skills
    //    perso hors-pack ; toute dérive locale est sauvegardée (.somtech.bak) avant écrasement.
    const g = installGlobalSkills({ payloadRoot, skillsDir, dryRun: flags.dryRun, force: flags.force });
    console.log(
      `  skills du pack (global) → ${skillsDir} : ${g.skills.length} skills` +
        ` (créés ${g.created.length}, convergés ${g.updated.length}, inchangés ${g.unchanged.length})` +
        (g.backedUp.length ? `, dérives sauvegardées ${g.backedUp.length}` : '')
    );
    if (g.conflicts.length) {
      console.log(
        `    ↩︎  ${g.conflicts.length} skill(s) symlinké(s) en global, non écrit(s) à travers (dev setup préservé).`
      );
    }
    if (g.payloadLinks?.length) {
      console.log(`    ℹ️  ${g.payloadLinks.length} symlink(s) ignoré(s) dans le pack source (non mirrorés).`);
    }
  }

  if (doWorkflows) {
    // Miroir GLOBAL des workflows du pack (~/.claude/workflows). Dépendance des skills
    // déjà globaux (ex. plan-servicedesk/superplan → workflow analyse-decoupage-demande) :
    // sans ça, le skill voyage mais casse à l'invocation du workflow sur un poste neuf.
    // Mêmes garanties que les skills : perso hors-pack jamais touché ; convergence par
    // défaut vers la version du pack, avec sauvegarde .somtech.bak de toute dérive.
    const w = installGlobalWorkflows({ payloadRoot, workflowsDir, dryRun: flags.dryRun, force: flags.force });
    console.log(
      `  workflows du pack (global) → ${workflowsDir} : ${w.workflows.length} workflow(s)` +
        ` (créés ${w.created.length}, convergés ${w.updated.length}, inchangés ${w.unchanged.length})` +
        (w.backedUp.length ? `, dérives sauvegardées ${w.backedUp.length}` : '')
    );
    if (w.conflicts.length) {
      console.log(
        `    ↩︎  ${w.conflicts.length} workflow(s) symlinké(s) en global, non écrit(s) à travers (dev setup préservé).`
      );
    }
    if (w.payloadLinks?.length) {
      console.log(`    ℹ️  ${w.payloadLinks.length} symlink(s) ignoré(s) dans le pack source (non mirrorés).`);
    }
  }

  if (doCommands) {
    // Miroir GLOBAL des commandes du pack (~/.claude/commands). Les commandes slash
    // (`/canvas`, `/brd`, `/pousse`…) voyagent déjà vers les projets avec `.claude/`,
    // mais n'existaient nulle part au poste : une session ouverte hors d'un projet
    // installé ne les avait pas, contrairement aux compétences. Mêmes garanties que
    // les skills : perso hors-pack jamais touché ; convergence vers la version du pack
    // avec sauvegarde .somtech.bak de toute dérive.
    const c = installGlobalCommands({ payloadRoot, commandsDir, dryRun: flags.dryRun, force: flags.force });
    console.log(
      `  commandes du pack (global) → ${commandsDir} : ${c.commands.length} commande(s)` +
        ` (créées ${c.created.length}, convergées ${c.updated.length}, inchangées ${c.unchanged.length})` +
        (c.backedUp.length ? `, dérives sauvegardées ${c.backedUp.length}` : '')
    );
    if (c.conflicts.length) {
      console.log(
        `    ↩︎  ${c.conflicts.length} commande(s) symlinkée(s) en global, non écrite(s) à travers (dev setup préservé).`
      );
    }
    if (c.payloadLinks?.length) {
      console.log(`    ℹ️  ${c.payloadLinks.length} symlink(s) ignoré(s) dans le pack source (non mirrorés).`);
    }
  }

  if (doPoste) {
    // Outils de poste : une copie par machine, jamais dans les projets (le module porte
    // scope: poste, et l'installation projet le refuse). Le canvas est le premier de la
    // famille. Il est déposé avec les autres outils de poste du pack (claude-swt et ses
    // bibliothèques) — pas dans ~/.claude, qui est la CONFIG de Claude Code, pas un
    // dépôt de binaires.
    const p = installPosteModules({ payloadRoot, toolsDir: destDir, dryRun: flags.dryRun, force: flags.force, exclure: exclurePoste });
    if (p.modules.length) {
      console.log(
        `  outils de poste → ${destDir} : ${p.modules.join(', ')}` +
          ` (créés ${p.created.length}, convergés ${p.updated.length}, inchangés ${p.unchanged.length})` +
          (p.backedUp.length ? `, dérives sauvegardées ${p.backedUp.length}` : '')
      );
    } else if (!p.conflicts.length) {
      console.log('  outils de poste : aucun module de portée poste dans ce pack.');
    }
    // Hors du test ci-dessus : un dossier symlinké vers le dépôt source donne 0 fichier
    // appliqué et 187 conflits — c'est justement le cas où le diagnostic compte le plus.
    if (p.conflicts.length) {
      console.log(
        `  outils de poste → ${destDir} : ${p.conflicts.length} fichier(s) symlinké(s) en global,` +
          ' non écrit(s) à travers (dev setup préservé).'
      );
    }
    if (p.payloadLinks?.length) {
      console.log(`    ℹ️  ${p.payloadLinks.length} symlink(s) ignoré(s) dans le pack source (non mirrorés).`);
    }
    for (const w of p.warnings) console.log(`    ⚠️  ${w}`);
  }

  if (doSwt) {
    const snippetSrc = join(payloadRoot, 'scripts', 'shell', 'claude-swt.sh');
    const res = installRcBlock({ rcFile, destDir, snippetSrc, dryRun: flags.dryRun });
    if (flags.dryRun) {
      console.log(`  claude-swt → bloc dans ${rcFile} + ${res.destFile} [dry-run]`);
    } else {
      console.log(
        `  claude-swt → bloc ${res.action} dans ${rcFile} (source ${res.destFile})` +
          (res.backup ? `, backup ${res.backup}` : '')
      );
    }
  }

  if (doVersionHook) {
    const r = installGlobalVersionHook({ payloadRoot, hooksDir, settingsFile, dryRun: flags.dryRun });
    if (!r.ok) {
      console.log(`  ⚠️  hook version global non installé : ${r.reason}`);
    } else if (flags.dryRun) {
      console.log(`  hook version (global) → ${r.dest} + câblage ${settingsFile} [dry-run]`);
    } else {
      console.log(
        `  hook version (global) → ${r.dest}` +
          (r.wired ? ` (câblé dans ${settingsFile})` : ` (déjà câblé dans ${settingsFile})`) +
          (r.backup ? `, backup ${r.backup}` : '')
      );
    }
  }

  if (doRegistreHook) {
    const r = installGlobalRegistreHook({ payloadRoot, hooksDir, settingsFile, dryRun: flags.dryRun });
    if (!r.ok) {
      console.log(`  ⚠️  hook registre global non installé : ${r.reason}`);
    } else if (flags.dryRun) {
      console.log(`  hook registre (global) → ${r.dest} + câblage ${settingsFile} [dry-run]`);
    } else {
      console.log(
        `  hook registre (global) → ${r.dest}` +
          (r.wired ? ` (câblé dans ${settingsFile})` : ` (déjà câblé dans ${settingsFile})`) +
          (r.backup ? `, backup ${r.backup}` : '')
      );
    }
  }

  if (doGraphify) {
    const r = installGraphifyShareHook({ payloadRoot, destDir, settingsFile, dryRun: flags.dryRun });
    if (!r.ok) {
      console.log(`  ⚠️  hook graphify (partage worktrees) non installé : ${r.reason}`);
    } else if (flags.dryRun) {
      console.log(`  hook graphify → ${r.dest} + câblage ${settingsFile} [dry-run]`);
    } else {
      console.log(
        `  hook graphify → ${r.dest}` +
          (r.wired ? ` (câblé dans ${settingsFile})` : ` (déjà câblé dans ${settingsFile})`) +
          (r.backup ? `, backup ${r.backup}` : '')
      );
      // Prérequis binaire : graphify-mcp (extra [mcp]). Hint non bloquant.
      if (!hasBinary('graphify-mcp')) {
        console.log('    ℹ️  Prérequis graphify absent : installe le binaire avec l\'extra MCP →');
        console.log('        uv tool install "graphifyy[mcp]"');
        console.log('        (sans l\'extra [mcp], graphify-mcp lève ImportError: mcp not installed)');
      }
    }
  }

  if (!flags.dryRun && doSwt) console.log(`→ Ouvre un nouveau terminal (ou \`source ${rcFile}\`) puis : claude-swt`);
  return 0;
}
