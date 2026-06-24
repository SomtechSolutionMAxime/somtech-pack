// setup.js — configure le poste : skills globaux + claude-swt, en une commande.
import { join } from 'node:path';
import { homedir } from 'node:os';
import { resolvePayloadRoot } from '../modules.js';
import { installRcBlock } from '../shellrc.js';
import { installUserSkills } from '../userskills.js';

/**
 * Consentement avant d'écrire des fichiers personnels (rc shell, skills globaux).
 * --yes ou --dry-run → OK. Sinon prompt TTY. Non-TTY sans --yes → refus.
 */
async function consent(flags, rcFile, skillsDir) {
  if (flags.yes || flags.dryRun) return true;
  if (!process.stdin.isTTY) {
    console.error(
      `✗ setup va modifier ${rcFile} et ${skillsDir}.\n` +
        `  Relance avec --yes (consentement) ou --dry-run (aperçu sans écrire).`
    );
    return false;
  }
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const a = await rl.question(`setup va modifier ${rcFile} et installer des skills dans ${skillsDir}. Continuer ? [y/N] `);
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
  const doSkills = !flags.noSkills;
  const doSwt = !flags.noClaudeSwt;

  if (!doSkills && !doSwt) {
    console.log('Rien à faire (--no-skills et --no-claude-swt).');
    return 0;
  }

  if (!(await consent(flags, doSwt ? rcFile : skillsDir, skillsDir))) return 1;

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

  if (!flags.dryRun && doSwt) console.log(`→ Ouvre un nouveau terminal (ou \`source ${rcFile}\`) puis : claude-swt`);
  return 0;
}
