// shared.js — pipeline commun init/update : résolution, application, rapport.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { resolvePayloadRoot, readManifest, defaultModules, resolveModules, allModuleNames } from '../modules.js';
import { collectFiles, applyFiles } from '../engine.js';

/** Détermine les modules à installer (flag explicite > défauts ; prompt si TTY interactif). */
export async function selectModules(manifest, flags) {
  if (flags.modules != null && flags.modules !== '') {
    return flags.modules.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const defaults = defaultModules(manifest);
  if (flags.yes || !process.stdin.isTTY) return defaults;

  // Prompt interactif minimal (zéro dépendance).
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(`Modules disponibles : ${allModuleNames(manifest).join(', ')}`);
    const answer = await rl.question(`Modules à installer [${defaults.join(',')}] : `);
    const picked = answer.trim();
    return picked ? picked.split(',').map((s) => s.trim()).filter(Boolean) : defaults;
  } finally {
    rl.close();
  }
}

/** Écrit le marqueur de version dans la cible. */
export function writeVersionFile(target, manifest, modules) {
  const dir = join(target, '.somtech-pack');
  mkdirSync(dir, { recursive: true });
  const data = {
    name: manifest.name ?? 'somtech-pack',
    version: manifest.version ?? '0.0.0',
    modules,
    installedBy: '@somtech/pack (cli)',
  };
  writeFileSync(join(dir, 'version.json'), JSON.stringify(data, null, 2) + '\n');
}

function summarize(label, list) {
  if (list.length) console.log(`  ${label} : ${list.length}`);
}

/** Pipeline partagé. Renvoie { code, report, modules }. */
export async function runApply(flags, { mode }) {
  const payloadRoot = resolvePayloadRoot({ source: flags.source });
  const manifest = readManifest(payloadRoot);
  const modules = await selectModules(manifest, flags);
  resolveModules(manifest, modules); // lève sur module inconnu
  const paths = modules.flatMap((name) => manifest.modules[name].paths || []);

  const { files, missing, rejected, links } = collectFiles(payloadRoot, paths);
  const target = resolve(flags.target || process.cwd());

  const report = applyFiles({ payloadRoot, target, files, force: flags.force, dryRun: flags.dryRun });

  console.log(`${mode === 'update' ? 'Mise à jour' : 'Installation'} (${modules.join(', ')}) → ${target}${flags.dryRun ? ' [dry-run]' : ''}`);
  summarize('créés', report.created);
  summarize('mis à jour', report.updated);
  summarize('inchangés', report.unchanged);
  if (report.conflicts.length) {
    console.log(`  ⚠️  divergents (NON écrasés) : ${report.conflicts.length}`);
    for (const f of report.conflicts) console.log(`     - ${f}`);
    console.log(`  → relance avec --force pour écraser ces fichiers.`);
  }
  if (missing.length) console.log(`  (chemins de module absents du payload : ${missing.join(', ')})`);
  // Sécurité : chemins qui s'évadent du payload/de la cible — jamais écrits.
  const escaped = [...(rejected || []), ...report.rejected];
  if (escaped.length) console.log(`  ⛔ chemins refusés (évasion hors cible) : ${escaped.join(', ')}`);
  if (links && links.length) console.log(`  (symlinks ignorés : ${links.join(', ')})`);

  if (!flags.dryRun) writeVersionFile(target, manifest, modules);

  // Exit 2 si des divergences restent non appliquées (utile en CI pour détecter le drift).
  const code = report.conflicts.length && !flags.force ? 2 : 0;
  return { code, report, modules };
}
