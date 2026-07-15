// setup.js — configure le poste : skills globaux + claude-swt, en une commande.
import { join } from 'node:path';
import { homedir } from 'node:os';
import { resolvePayloadRoot } from '../modules.js';
import { installRcBlock } from '../shellrc.js';
import { installUserSkills } from '../userskills.js';
import { installGlobalSkills } from '../globalskills.js';
import { installGlobalWorkflows } from '../globalworkflows.js';
import { installGlobalVersionHook } from '../userhooks.js';

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
  const destDir = flags.dest || join(home, '.somtech');
  const settingsFile = flags.settings || join(home, '.claude', 'settings.json');
  const hooksDir = flags.hooksDir || join(home, '.claude', 'hooks');
  const doSkills = !flags.noSkills;
  const doWorkflows = !flags.noWorkflows;
  const doSwt = !flags.noClaudeSwt;
  const doVersionHook = !flags.noVersionHook;

  if (!doSkills && !doWorkflows && !doSwt && !doVersionHook) {
    console.log('Rien à faire (--no-skills, --no-workflows, --no-claude-swt et --no-version-hook).');
    return 0;
  }

  const consentTargets = [];
  if (doSkills) consentTargets.push(skillsDir);
  if (doWorkflows) consentTargets.push(workflowsDir);
  if (doSwt) consentTargets.push(rcFile);
  if (doVersionHook) consentTargets.push(settingsFile);
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

  if (!flags.dryRun && doSwt) console.log(`→ Ouvre un nouveau terminal (ou \`source ${rcFile}\`) puis : claude-swt`);
  return 0;
}
