// cli.js — parsing des arguments et dispatch des sous-commandes.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cmdInit } from './commands/init.js';
import { cmdUpdate } from './commands/update.js';
import { cmdSetup } from './commands/setup.js';
import { cmdBrd } from './commands/brd.js';
import { cmdArchi, isArchiCommand } from './commands/archi.js';

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
    rc: null, skillsDir: null, workflowsDir: null, dest: null, noClaudeSwt: false,
    noSkills: false, noWorkflows: false,
    settings: null, hooksDir: null, noVersionHook: false, noGraphify: false,
    mode: null, file: null, id: null, patch: null,
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
      case '--workflows-dir': flags.workflowsDir = value('--workflows-dir', ++i); break;
      case '--dest': flags.dest = value('--dest', ++i); break;
      case '--settings': flags.settings = value('--settings', ++i); break;
      case '--hooks-dir': flags.hooksDir = value('--hooks-dir', ++i); break;
      case '--mode': flags.mode = value('--mode', ++i); break;
      case '--file': flags.file = value('--file', ++i); break;
      case '--id': flags.id = value('--id', ++i); break;
      case '--patch': flags.patch = value('--patch', ++i); break;
      case '--no-claude-swt': flags.noClaudeSwt = true; break;
      case '--no-skills': flags.noSkills = true; break;
      case '--no-workflows': flags.noWorkflows = true; break;
      case '--no-version-hook': flags.noVersionHook = true; break;
      case '--no-graphify': flags.noGraphify = true; break;
      case '--yes': case '-y': flags.yes = true; break;
      case '--force': flags.force = true; break;
      case '--dry-run': flags.dryRun = true; break;
      case '--help': case '-h': flags.help = true; break;
      case '--version': case '-v': flags.version = true; break;
      default:
        if (a.startsWith('--modules=')) flags.modules = a.slice('--modules='.length);
        else if (a.startsWith('--target=')) flags.target = a.slice('--target='.length);
        else if (a.startsWith('--source=')) flags.source = a.slice('--source='.length);
        else if (a.startsWith('--mode=')) flags.mode = a.slice('--mode='.length);
        else if (a.startsWith('--file=')) flags.file = a.slice('--file='.length);
        else if (a.startsWith('--id=')) flags.id = a.slice('--id='.length);
        else if (a.startsWith('--patch=')) flags.patch = a.slice('--patch='.length);
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
  update   Met à jour le projet : les fichiers du pack reprennent TOUJOURS la version
           du pack (convergence), toute dérive locale est sauvegardée en .somtech.bak.
           Config projet (settings.json) et symlinks jamais écrasés.
  setup    Configure le poste : skills globaux (user-skills + miroir des skills du
           pack dans ~/.claude/skills) + workflows globaux (~/.claude/workflows) +
           claude-swt + hook de version. Re-jouable = mise à jour. Préserve skills et
           workflows perso hors-pack ; un fichier du pack divergent CONVERGE vers la
           version du pack (backup .somtech.bak auto), les symlinks sont épargnés
  brd      Projections BRD calculées à la demande (parser déterministe, zéro LLM) :
           brd project --mode index|full|graph [--file <BRD.md>] (défaut : stdin)

Modèle vivant (STD-031 §2.7 — récolte du manifeste architecture.yaml, gate CI) :
  harvest-supabase <migrations…> --app <slug>   Grain tables (schéma Supabase)
  harvest-routes   <racine> --app <slug>         Grain endpoints (routes HTTP)
  harvest-config   <racine> --app <slug>         Grain topologie (fly/mcp/env)
  merge-manifests  <a.yaml…> --app <slug>        Fusionne les grains récoltés
  validate-manifest <architecture.yaml>          Valide la forme du manifeste
  diff-manifest    <committé> <récolté> --mode warn|strict   Gate de complétude
  generate-erd     <architecture.yaml> --out <md>            Vue ERD Mermaid
           (chaque sous-commande accepte --help ; scripts Python bundlés)

Options (init / update) :
  --modules <csv>   Modules à installer (ex: core,features,mockmig)
  --target <dir>    Projet cible (défaut: répertoire courant)
  --source <dir>    Racine du payload du pack (défaut: auto)
  --force           Déprécié / no-op : la convergence est désormais le défaut (un
                    fichier du pack divergent est toujours écrasé, avec backup)

Options (setup) :
  --rc <fichier>    Fichier rc shell (défaut: ~/.zshrc)
  --skills-dir <d>  Dossier des skills globaux (défaut: ~/.claude/skills)
  --workflows-dir <d> Dossier des workflows globaux (défaut: ~/.claude/workflows)
  --dest <dir>      Dossier d'install de claude-swt (défaut: ~/.somtech)
  --settings <f>    Fichier settings global (défaut: ~/.claude/settings.json)
  --hooks-dir <d>   Dossier des hooks globaux (défaut: ~/.claude/hooks)
  --no-skills       Ne pas installer les skills globaux
  --no-workflows    Ne pas installer les workflows globaux
  --no-claude-swt   Ne pas installer claude-swt
  --no-version-hook Ne pas installer le hook de version global
  --no-graphify     Ne pas installer le hook graphify (dossier de sortie partagé)

Options communes :
  --dry-run         N'écrit rien, affiche le plan
  --yes, -y         Non-interactif (CI) / consentement explicite (setup écrit le rc)
  --version, -v     Affiche la version
  --help, -h        Affiche cette aide
`;

/** Point d'entrée. Renvoie un code de sortie. */
export async function run(argv) {
  // Sous-commandes du modèle vivant : forward verbatim vers le script Python
  // (leurs flags — --app, --out, --mode… — ne passent pas par parseArgs).
  if (argv[0] && isArchiCommand(argv[0])) {
    return cmdArchi(argv[0], argv.slice(1));
  }

  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    return 1;
  }
  const { command, positionals, flags } = parsed;

  if (flags.version) { console.log(pkgVersion()); return 0; }
  // `brd` gère sa propre aide (--help) ; les autres commandes + le cas sans commande → aide globale.
  if ((flags.help && command !== 'brd') || !command) { console.log(HELP); return command ? 0 : 1; }

  try {
    switch (command) {
      case 'init': return await cmdInit(flags);
      case 'update': return await cmdUpdate(flags);
      case 'setup': return await cmdSetup(flags);
      case 'brd': return await cmdBrd(positionals, flags);
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
