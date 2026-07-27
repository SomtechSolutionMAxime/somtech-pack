// Une compétence du pack ne cite jamais une commande herdr qui n'existe pas (EF-AGT-002).
//
// Constat qui motive ce test (D-20260727-0011) : une compétence documentait
// `herdr wait <pane> --match …`. Cette commande n'existe pas — herdr n'expose aucun
// `wait` de premier niveau. La vraie forme est `herdr agent wait <cible> --until <statut>`
// pour un état d'agent, et `herdr pane wait-output` pour une sortie de terminal. L'agent
// qui suivait la doc se cassait les dents à l'exécution, et rien ne l'avait signalé avant.
//
// Le test lit les blocs de code des fichiers du pack et vérifie que le premier mot après
// `herdr` est un groupe de commandes réel. Portée assumée : **blocs de code délimités par
// ``` uniquement**. C'est là que vivent les commandes qu'on copie, et c'est ce qui évite
// les faux positifs sur la prose (« herdr refuse les majuscules ») comme sur les mentions
// délibérées d'une commande fautive citée en contre-exemple.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

// Groupes et commandes de premier niveau de herdr (protocole 17). Attention : `herdr --help`
// n'est PAS exhaustif — `plugin` par exemple n'y figure nulle part alors qu'il existe. Une
// entrée ne s'ajoute donc ici qu'après vérification contre le binaire, et le second test
// ci-dessous re-prouve cette liste auprès de herdr chaque fois qu'il est installé.
const HERDR_TOP_LEVEL = new Set([
  'agent', 'api', 'channel', 'completion', 'config', 'help', 'integration',
  'notification', 'pane', 'plugin', 'server', 'session', 'status', 'tab',
  'update', 'workspace', 'worktree',
]);

// Groupes qu'on ne sonde jamais : les invoquer, même avec un drapeau invalide, peut agir
// (télécharger une version, démarrer un serveur). On les tient pour connus sur parole.
const NE_PAS_SONDER = new Set(['update', 'server', 'session', 'channel', 'completion']);

/** Concatène le contenu des blocs de code délimités par ``` d'un texte Markdown. */
function fencedBlocks(text) {
  const out = [];
  const re = /^[ \t]*```[^\n]*\n([\s\S]*?)^[ \t]*```/gm;
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out.join('\n');
}

/** Fichiers du pack susceptibles de documenter des commandes, sous `.claude/`. */
function packDocs(root) {
  const base = join(root, '.claude');
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(md|js)$/.test(entry)) found.push(p);
    }
  };
  walk(base);
  return found;
}

/**
 * Cherche les invocations `herdr <mot>` dont le premier mot n'est pas un groupe réel.
 * @returns {{file: string, command: string, line: number}[]}
 */
export function findUnknownHerdrCommands(root) {
  const problems = [];
  for (const file of packDocs(root)) {
    const code = fencedBlocks(readFileSync(file, 'utf8'));
    const lines = code.split('\n');
    lines.forEach((line, idx) => {
      const re = /\bherdr\s+([a-z][a-z0-9_-]*)/g;
      let m;
      while ((m = re.exec(line)) !== null) {
        const sub = m[1];
        if (!HERDR_TOP_LEVEL.has(sub)) {
          problems.push({ file: relative(root, file), command: `herdr ${sub}`, line: idx + 1 });
        }
      }
    });
  }
  return problems;
}

test("aucune compétence du pack ne cite une commande herdr de premier niveau inexistante", () => {
  const problems = findUnknownHerdrCommands(REPO);
  const details = problems
    .map((p) => `  ${p.file} → « ${p.command} » (ligne ${p.line} du bloc de code)`)
    .join('\n');
  assert.equal(
    problems.length,
    0,
    `Commande(s) herdr inconnue(s) citée(s) dans le pack :\n${details}\n` +
      `Groupes réels : ${[...HERDR_TOP_LEVEL].sort().join(', ')}. ` +
      `Rappel : l'attente d'un état d'agent est \`herdr agent wait … --until …\`, ` +
      `l'attente d'une sortie est \`herdr pane wait-output\`.`
  );
});

test("les groupes cités par le pack sont reconnus par le binaire herdr (si installé)", (t) => {
  const probe = spawnSync('herdr', ['--version'], { encoding: 'utf8' });
  if (probe.error) {
    t.skip('herdr absent de cette machine — la liste statique reste la garantie en CI');
    return;
  }

  const cites = new Set();
  for (const file of packDocs(REPO)) {
    const code = fencedBlocks(readFileSync(file, 'utf8'));
    for (const m of code.matchAll(/\bherdr\s+([a-z][a-z0-9_-]*)/g)) cites.add(m[1]);
  }

  const inconnus = [];
  for (const groupe of cites) {
    if (NE_PAS_SONDER.has(groupe)) continue;
    // Un drapeau volontairement absurde : herdr répond par l'aide du groupe s'il existe,
    // et par « unknown command » sinon. Aucune action déclenchée dans les deux cas.
    const r = spawnSync('herdr', [groupe, '--somtech-probe-inexistant'], { encoding: 'utf8' });
    const sortie = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    if (/unknown command/i.test(sortie)) inconnus.push(groupe);
  }

  assert.deepEqual(
    inconnus,
    [],
    `Le pack cite des groupes que herdr ne connaît pas : ${inconnus.join(', ')}. ` +
      `Si la liste blanche du test les autorise, c'est elle qui a menti.`
  );
});

test("le garde-fou attrape bien une commande fantôme, et laisse passer la vraie", () => {
  const root = mkdtempSync(join(tmpdir(), 'smtk-herdr-lint-'));
  const dir = join(root, '.claude', 'skills', 'faux-temoin');
  mkdirSync(dir, { recursive: true });

  // Cas fautif : la commande qui a réellement induit un agent en erreur.
  writeFileSync(
    join(dir, 'SKILL.md'),
    ['# Faux témoin', '', '```bash', 'herdr wait output 1-3 --match "ready" --timeout 30000', '```', ''].join('\n')
  );
  const bad = findUnknownHerdrCommands(root);
  assert.equal(bad.length, 1, 'la commande fantôme doit être détectée');
  assert.equal(bad[0].command, 'herdr wait');
  assert.match(bad[0].file, /faux-temoin/);

  // Cas correct : la forme réelle, vérifiée contre `herdr agent wait --help`.
  writeFileSync(
    join(dir, 'SKILL.md'),
    ['# Vrai témoin', '', '```bash', 'herdr agent wait "$P" --until done --until blocked', 'herdr pane wait-output "$P" --match ready', '```', ''].join('\n')
  );
  assert.deepEqual(findUnknownHerdrCommands(root), [], 'la forme réelle ne doit pas être signalée');

  // La prose reste hors de portée : elle cite parfois une commande fautive à dessein.
  writeFileSync(
    join(dir, 'SKILL.md'),
    ['# Prose', '', 'Il nexiste pas de `herdr wait` de premier niveau : herdr refuse cette forme.', ''].join('\n')
  );
  assert.deepEqual(findUnknownHerdrCommands(root), [], 'la prose ne doit pas déclencher le garde-fou');
});
