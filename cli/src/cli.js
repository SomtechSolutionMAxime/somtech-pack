// cli.js — parsing des arguments et dispatch des sous-commandes.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cmdInit } from './commands/init.js';
import { cmdUpdate } from './commands/update.js';
import { cmdSetup } from './commands/setup.js';

const HERE = dirname(fileURLToPath(import.meta.url));

function pkgVersion() {
  try {
    return JSON.parse(readFileSync(resolve(HERE, '..', 'package.json'), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
}

/** Parse argv (sans node/bin) → { command, flags, positionals }. */
export function parseArgs(argv) {
  const flags = { modules: null, yes: false, force: false, dryRun: false, source: null, target: null, help: false, version: false };
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--modules': flags.modules = argv[++i] ?? ''; break;
      case '--source': flags.source = argv[++i] ?? ''; break;
      case '--target': flags.target = argv[++i] ?? ''; break;
      case '--yes': case '-y': flags.yes = true; break;
      case '--force': flags.force = true; break;
      case '--dry-run': flags.dryRun = true; break;
      case '--help': case '-h': flags.help = true; break;
      case '--version': case '-v': flags.version = true; break;
      default:
        if (a.startsWith('--modules=')) flags.modules = a.slice('--modules='.length);
        else if (a.startsWith('--target=')) flags.target = a.slice('--target='.length);
        else if (a.startsWith('--source=')) flags.source = a.slice('--source='.length);
        else if (a.startsWith('-')) throw new Error(`Option inconnue : ${a}`);
        else positionals.push(a);
    }
  }
  return { command: positionals[0] ?? null, positionals: positionals.slice(1), flags };
}

const HELP = `somtech-pack — installateur du somtech-pack

Usage :
  somtech-pack <commande> [options]

Commandes :
  init     Installe le pack dans le projet courant (modules core,features par défaut)
  update   Met à jour le projet (présente un diff, n'écrase pas sans --force)
  setup    Configure le poste (skills globaux + claude-swt) — à venir (E-20260623-0020)

Options :
  --modules <csv>   Modules à installer (ex: core,features,mockmig)
  --target <dir>    Projet cible (défaut: répertoire courant)
  --source <dir>    Racine du payload du pack (défaut: auto)
  --force           Écrase les fichiers divergents (update)
  --dry-run         N'écrit rien, affiche le plan
  --yes, -y         Non-interactif (CI) : pas de prompt
  --version, -v     Affiche la version
  --help, -h        Affiche cette aide
`;

/** Point d'entrée. Renvoie un code de sortie. */
export async function run(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    return 1;
  }
  const { command, flags } = parsed;

  if (flags.version) { console.log(pkgVersion()); return 0; }
  if (flags.help || !command) { console.log(HELP); return command ? 0 : 1; }

  try {
    switch (command) {
      case 'init': return await cmdInit(flags);
      case 'update': return await cmdUpdate(flags);
      case 'setup': return await cmdSetup(flags);
      default:
        console.error(`✗ Commande inconnue : ${command}\n`);
        console.log(HELP);
        return 1;
    }
  } catch (e) {
    console.error(`✗ ${e.message}`);
    return 1;
  }
}
