// Le pack ne cite jamais une commande herdr qui n'existe pas (EF-AGT-002).
//
// Constat qui motive ce test (D-20260727-0011) : une compétence documentait
// `herdr wait <pane> --match …`. Cette commande n'existe pas — herdr n'expose aucun
// `wait` de premier niveau. La vraie forme est `herdr agent wait <cible> --until <statut>`
// pour un état d'agent, et `herdr pane wait-output` pour une sortie de terminal. L'agent
// qui suivait la doc se cassait les dents à l'exécution, et rien ne l'avait signalé avant.
//
// Le test lit les blocs de code du contenu livré par le pack et vérifie le groupe ET la
// sous-commande. Vérifier le seul groupe ne suffisait pas : `herdr agent frobnicate` est
// tout aussi fantôme, et herdr y répond en affichant l'aide du groupe plutôt qu'une
// erreur — une sonde ne peut donc pas l'attraper, seule une table le peut.
//
// Portée assumée : **blocs de code délimités** (``` et ~~~). C'est là que vivent les
// commandes qu'on copie, et c'est ce qui évite les faux positifs sur la prose
// (« herdr refuse les majuscules ») comme sur les mentions délibérées d'une commande
// fautive citée en contre-exemple.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

// Carte des commandes herdr (protocole 17 / herdr 0.7.5), relevée sur le binaire lui-même.
// `herdr --help` n'est PAS exhaustif — `plugin` n'y figure nulle part alors qu'il existe, et
// `help` s'y devine alors qu'il n'existe pas. Chaque entrée est donc prouvée contre le binaire,
// et le second test ci-dessous re-prouve cette table dès que herdr est installé.
//
// `null` = groupe réel dont on ne vérifie pas les sous-commandes, parce qu'on refuse de le
// sonder : l'invoquer, même avec un drapeau invalide, peut agir (télécharger une version,
// démarrer un serveur).
const HERDR_COMMANDS = {
  agent: ['attach', 'explain', 'focus', 'get', 'list', 'prompt', 'read', 'rename', 'send-keys', 'start', 'wait'],
  api: ['schema', 'snapshot'],
  channel: null,
  completion: null,
  config: ['check', 'reset-keys'],
  integration: ['install', 'status', 'uninstall'],
  notification: ['show'],
  pane: ['close', 'current', 'edges', 'focus', 'get', 'layout', 'list', 'move', 'neighbor',
    'process-info', 'read', 'release-agent', 'rename', 'report-agent', 'report-agent-session',
    'report-metadata', 'resize', 'run', 'send-keys', 'send-text', 'split', 'swap', 'wait-output', 'zoom'],
  plugin: ['action', 'config-dir', 'disable', 'enable', 'install', 'link', 'list', 'log', 'pane', 'uninstall', 'unlink'],
  server: null,
  session: null,
  status: ['client', 'server'],
  tab: ['close', 'create', 'focus', 'get', 'list', 'rename'],
  update: null,
  workspace: ['close', 'create', 'focus', 'get', 'list', 'rename', 'report-metadata'],
  worktree: ['create', 'list', 'open', 'remove'],
};

// Dossiers dont le contenu part chez les utilisateurs (modules de pack.json). Une commande
// fantôme y est aussi nuisible dans un README de plugin que dans une compétence.
const DOSSIERS_LIVRES = ['.claude', 'herdr-plugins', 'scripts', 'docs', 'features', 'plugins'];

/** Concatène le contenu des blocs de code délimités (``` ou ~~~) d'un texte Markdown. */
function fencedBlocks(text) {
  const out = [];
  // La fermeture doit reprendre le même type de délimiteur, sinon un bloc ``` contenant
  // un ~~~ se refermerait trop tôt.
  const re = /^[ \t]*(```|~~~)[^\n]*\n([\s\S]*?)^[ \t]*\1/gm;
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[2]);
  return out.join('\n');
}

/** Fichiers du contenu livré susceptibles de documenter des commandes. */
function packDocs(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.git')) continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(md|js|sh)$/.test(entry)) found.push(p);
    }
  };
  for (const d of DOSSIERS_LIVRES) {
    const base = join(root, d);
    if (existsSync(base)) walk(base);
  }
  return found;
}

/** Un second mot n'est une sous-commande que si c'est un mot nu : ni drapeau, ni variable, ni gabarit. */
function estSousCommande(mot) {
  return typeof mot === 'string' && /^[a-z][a-z0-9-]*$/.test(mot);
}

/**
 * Cherche les invocations `herdr …` dont le groupe ou la sous-commande n'existe pas.
 * @returns {{file: string, command: string, raison: string}[]}
 */
export function findUnknownHerdrCommands(root) {
  const problems = [];
  for (const file of packDocs(root)) {
    const code = fencedBlocks(readFileSync(file, 'utf8'));
    const rel = relative(root, file);
    for (const m of code.matchAll(/\bherdr\s+([a-z][a-z0-9_-]*)(?:\s+([^\s|;&)"']+))?/g)) {
      const [, groupe, suivant] = m;
      if (!Object.hasOwn(HERDR_COMMANDS, groupe)) {
        problems.push({ file: rel, command: `herdr ${groupe}`, raison: 'groupe inconnu' });
        continue;
      }
      const sous = HERDR_COMMANDS[groupe];
      if (sous && estSousCommande(suivant) && !sous.includes(suivant)) {
        problems.push({
          file: rel,
          command: `herdr ${groupe} ${suivant}`,
          raison: `sous-commande inconnue (attendu : ${sous.join(', ')})`,
        });
      }
    }
  }
  return problems;
}

test("le pack ne cite aucune commande herdr inexistante", () => {
  const problems = findUnknownHerdrCommands(REPO);
  const details = problems.map((p) => `  ${p.file} → « ${p.command} » : ${p.raison}`).join('\n');
  assert.equal(
    problems.length,
    0,
    `Commande(s) herdr inconnue(s) citée(s) dans le contenu livré :\n${details}\n` +
      `Rappel : l'attente d'un état d'agent est \`herdr agent wait … --until …\`, ` +
      `l'attente d'une sortie est \`herdr pane wait-output\`, et on ferme un agent seul ` +
      `avec \`herdr pane close\` (fermer son tab emporterait ses voisins).`
  );
});

test("la table de commandes est celle du binaire herdr (si installé)", (t) => {
  if (spawnSync('herdr', ['--version'], { encoding: 'utf8' }).error) {
    t.skip('herdr absent de cette machine — la table statique reste la garantie en CI');
    return;
  }

  const menteuses = [];
  for (const [groupe, sous] of Object.entries(HERDR_COMMANDS)) {
    // Un drapeau volontairement absurde : herdr répond par l'aide du groupe s'il existe,
    // et par « unknown command » sinon. Aucune action déclenchée dans les deux cas.
    const r = spawnSync('herdr', [groupe, '--somtech-probe-inexistant'], { encoding: 'utf8' });
    const sortie = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    if (sous === null) continue; // groupe volontairement non sondé (cf. commentaire de la table)
    if (/unknown command/i.test(sortie)) {
      menteuses.push(`herdr ${groupe} (groupe absent du binaire)`);
      continue;
    }
    const reelles = new Set(
      [...sortie.matchAll(new RegExp(`^\\s*herdr ${groupe} ([a-z][a-z0-9-]*)`, 'gm'))].map((m) => m[1])
    );
    for (const s of sous) {
      if (!reelles.has(s)) menteuses.push(`herdr ${groupe} ${s} (absente du binaire)`);
    }
  }

  assert.deepEqual(
    menteuses,
    [],
    `La table du test prétend des commandes que herdr ne connaît pas :\n  ${menteuses.join('\n  ')}`
  );
});

test("le garde-fou attrape les commandes fantômes, et laisse passer les vraies", () => {
  const root = mkdtempSync(join(tmpdir(), 'smtk-herdr-lint-'));
  const dir = join(root, '.claude', 'skills', 'faux-temoin');
  mkdirSync(dir, { recursive: true });
  const ecrire = (lignes) => writeFileSync(join(dir, 'SKILL.md'), lignes.join('\n'));

  // 1. La commande qui a réellement induit un agent en erreur.
  ecrire(['# Faux témoin', '', '```bash', 'herdr wait output 1-3 --match "ready" --timeout 30000', '```', '']);
  let p = findUnknownHerdrCommands(root);
  assert.equal(p.length, 1, 'la commande fantôme de premier niveau doit être détectée');
  assert.equal(p[0].command, 'herdr wait');

  // 2. Groupe réel, sous-commande fantôme — herdr y répond par une aide, pas par une erreur,
  //    donc seule la table peut l'attraper.
  ecrire(['# Niveau 2', '', '```bash', 'herdr agent frobnicate w1:p1', '```', '']);
  p = findUnknownHerdrCommands(root);
  assert.equal(p.length, 1, 'la sous-commande fantôme doit être détectée');
  assert.equal(p[0].command, 'herdr agent frobnicate');

  // 3. Fence alternative ~~~ : légale en Markdown, donc surveillée aussi.
  ecrire(['# Fence tilde', '', '~~~bash', 'herdr wait agent-status 1-1 --status done', '~~~', '']);
  assert.equal(findUnknownHerdrCommands(root).length, 1, 'un bloc ~~~ doit être inspecté');

  // 4. Appel par chemin absolu — la faute reste la même.
  ecrire(['# Chemin', '', '```bash', '/opt/homebrew/bin/herdr wait output 1-3 --match ready', '```', '']);
  assert.equal(findUnknownHerdrCommands(root).length, 1, 'un appel par chemin absolu doit être inspecté');

  // 5. Les formes réelles, vérifiées contre le binaire, ne doivent rien déclencher.
  ecrire(['# Vrai témoin', '', '```bash', 'herdr agent wait "$P" --until done --until blocked',
    'herdr pane wait-output "$P" --match ready', 'herdr pane close "$P"',
    'herdr tab create --workspace w1 --label sujet --no-focus', '```', '']);
  assert.deepEqual(findUnknownHerdrCommands(root), [], 'les formes réelles ne doivent pas être signalées');

  // 6. La prose reste hors de portée : elle cite parfois une commande fautive à dessein.
  ecrire(['# Prose', '', 'Il nexiste pas de `herdr wait` de premier niveau : herdr refuse cette forme.', '']);
  assert.deepEqual(findUnknownHerdrCommands(root), [], 'la prose ne doit pas déclencher le garde-fou');
});
