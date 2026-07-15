// shared.js — pipeline commun init/update : résolution, application, rapport.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePayloadRoot, readManifest, defaultModules, resolveModules, allModuleNames } from '../modules.js';
import { collectFiles, applyFiles } from '../engine.js';

const HERE = dirname(fileURLToPath(import.meta.url)); // cli/src/commands

/** Version du package CLI (= version npm publiée, alignée sur le tag au publish). */
function cliVersion() {
  try {
    return JSON.parse(readFileSync(resolve(HERE, '..', '..', 'package.json'), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
}

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
    name: '@somtech-solutions/pack',
    version: cliVersion(), // version du package npm installé (= tag), pas celle du pack.json bundlé
    packContentVersion: manifest.version ?? null, // version du contenu du pack (traçabilité)
    modules,
    installedBy: '@somtech-solutions/pack (cli)',
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

  const report = applyFiles({
    payloadRoot, target, files,
    force: flags.force, dryRun: flags.dryRun,
    preserve: manifest.preserve || [],
  });

  const converged = flags.dryRun ? 'à converger' : 'convergés (version du pack)';
  console.log(`${mode === 'update' ? 'Mise à jour' : 'Installation'} (${modules.join(', ')}) → ${target}${flags.dryRun ? ' [dry-run]' : ''}`);
  summarize('créés', report.created);
  summarize(converged, report.updated);
  summarize('inchangés', report.unchanged);
  if (report.backedUp.length) {
    console.log(`  💾 dérives sauvegardées avant convergence (.somtech.bak) : ${report.backedUp.length}`);
  }
  if (report.preserved.length) {
    console.log(`  🔒 préservés (config projet, jamais écrasés) : ${report.preserved.join(', ')}`);
  }
  if (report.conflicts.length) {
    // Ne restent en conflit que les symlinks en cible : jamais écrits à travers (dev setup).
    console.log(`  ↩︎  symlinks en cible, non écrits à travers (${report.conflicts.length}) : ${report.conflicts.join(', ')}`);
  }
  if (missing.length) console.log(`  (chemins de module absents du payload : ${missing.join(', ')})`);
  // Sécurité : chemins qui s'évadent du payload/de la cible — jamais écrits.
  const escaped = [...(rejected || []), ...report.rejected];
  if (escaped.length) console.log(`  ⛔ chemins refusés (évasion hors cible) : ${escaped.join(', ')}`);
  if (links && links.length) console.log(`  (symlinks ignorés : ${links.join(', ')})`);

  if (!flags.dryRun) writeVersionFile(target, manifest, modules);

  // Exit 2 en DRY-RUN si de la dérive existe (fichiers qui convergeraient) — détection CI.
  // En mode réel, tout converge → exit 0 (les symlinks non écrits ne sont pas un échec).
  const code = flags.dryRun && report.updated.length ? 2 : 0;
  return { code, report, modules };
}
