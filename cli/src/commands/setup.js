// setup.js — configure le poste : skills globaux + claude-swt, en une commande.
import { join } from 'node:path';
import { homedir } from 'node:os';
import { resolvePayloadRoot } from '../modules.js';
import { installRcBlock } from '../shellrc.js';
import { installUserSkills } from '../userskills.js';

export async function cmdSetup(flags) {
  const payloadRoot = resolvePayloadRoot({ source: flags.source });
  const home = homedir();
  const rcFile = flags.rc || join(home, '.zshrc');
  const skillsDir = flags.skillsDir || join(home, '.claude', 'skills');
  const destDir = flags.dest || join(home, '.somtech');
  const doSkills = !flags.noSkills;
  const doSwt = !flags.noClaudeSwt;

  console.log(`Setup poste${flags.dryRun ? ' [dry-run]' : ''} :`);

  if (doSkills) {
    const r = installUserSkills({ payloadRoot, skillsDir, dryRun: flags.dryRun, force: flags.force });
    console.log(
      `  skills globaux → ${skillsDir} : ${r.skills.join(', ') || '(aucun)'}` +
        ` (créés ${r.created.length}, inchangés ${r.unchanged.length})`
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

  if (!flags.dryRun) console.log(`→ Ouvre un nouveau terminal (ou \`source ${rcFile}\`) puis : claude-swt`);
  return 0;
}
