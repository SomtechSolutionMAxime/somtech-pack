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
  const flags = {
    modules: null, yes: false, force: false, dryRun: false, source: null, target: null,
    rc: null, skillsDir: null, dest: null, noClaudeSwt: false, noSkills: false,
    settings: null, hooksDir: null, noVersionHook: false,
    help: false, version: false,
  };
  const positionals = [];
  const value = (name, i) => {
    const v = argv[i];
    if (v === undefined || v.startsWith('-')) throw new Error(`L'option ${name} attend une valeur`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--modules': flags.modules = value('--modules', ++i); break;
      case '--source': flags.source = value('--source', ++i); break;
      case '--target': flags.target = value('--target', ++i); break;
      case '--rc': flags.rc = value('--rc', ++i); break;
      case '--skills-dir': flags.skillsDir = value('--skills-dir', ++i); break;
      case '--dest': flags.dest = value('--dest', ++i); break;
      case '--settings': flags.settings = value('--settings', ++i); break;
      case '--hooks-dir': flags.hooksDir = value('--hooks-dir', ++i); break;
      case '--no-claude-swt': flags.noClaudeSwt = true; break;
      case '--no-skills': flags.noSkills = true; break;
      case '--no-version-hook': flags.noVersionHook = true; break;
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
  setup    Configure le poste : skills globaux (user-skills + miroir des skills du
           pack dans ~/.claude/skills) + claude-swt + hook de version. Re-jouable =
           mise à jour. Préserve les skills perso hors-pack ; un skill du pack
           divergent n'est pris qu'avec --force (backup .somtech.bak auto)

Options (init / update) :
  --modules <csv>   Modules à installer (ex: core,features,mockmig)
  --target <dir>    Projet cible (défaut: répertoire courant)
  --source <dir>    Racine du payload du pack (défaut: auto)
  --force           Écrase les fichiers divergents (update)

Options (setup) :
  --rc <fichier>    Fichier rc shell (défaut: ~/.zshrc)
  --skills-dir <d>  Dossier des skills globaux (défaut: ~/.claude/skills)
  --dest <dir>      Dossier d'install de claude-swt (défaut: ~/.somtech)
  --settings <f>    Fichier settings global (défaut: ~/.claude/settings.json)
  --hooks-dir <d>   Dossier des hooks globaux (défaut: ~/.claude/hooks)
  --no-skills       Ne pas installer les skills globaux
  --no-claude-swt   Ne pas installer claude-swt
  --no-version-hook Ne pas installer le hook de version global

Options communes :
  --dry-run         N'écrit rien, affiche le plan
  --yes, -y         Non-interactif (CI) / consentement explicite (setup écrit le rc)
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
