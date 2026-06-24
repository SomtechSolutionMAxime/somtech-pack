// setup.js — configure le poste : skills globaux + claude-swt, en une commande.
import { join } from 'node:path';
import { homedir } from 'node:os';
import { resolvePayloadRoot } from '../modules.js';
import { installRcBlock } from '../shellrc.js';
import { installUserSkills } from '../userskills.js';
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
  const destDir = flags.dest || join(home, '.somtech');
  const settingsFile = flags.settings || join(home, '.claude', 'settings.json');
  const hooksDir = flags.hooksDir || join(home, '.claude', 'hooks');
  const doSkills = !flags.noSkills;
  const doSwt = !flags.noClaudeSwt;
  const doVersionHook = !flags.noVersionHook;

  if (!doSkills && !doSwt && !doVersionHook) {
    console.log('Rien à faire (--no-skills, --no-claude-swt et --no-version-hook).');
    return 0;
  }

  const consentTargets = [];
  if (doSkills) consentTargets.push(skillsDir);
  if (doSwt) consentTargets.push(rcFile);
  if (doVersionHook) consentTargets.push(settingsFile);
  if (!(await consent(flags, consentTargets))) return 1;

  console.log(`Setup poste${flags.dryRun ? ' [dry-run]' : ''} :`);

  if (doSkills) {
    const r = installUserSkills({ payloadRoot, skillsDir, dryRun: flags.dryRun, force: flags.force });
    console.log(
      `  skills globaux → ${skillsDir} : ${r.skills.join(', ') || '(aucun)'}` +
        ` (créés ${r.created.length}, maj ${r.updated.length}, inchangés ${r.unchanged.length})`
    );
    if (r.conflicts.length) {
      console.log(`    ⚠️  divergents non écrasés : ${r.conflicts.length} → relance avec --force`);
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
