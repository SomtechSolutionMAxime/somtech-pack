// Tests du dispatch des sous-commandes du modèle vivant (D-20260715-0004).
// node:test, zéro dépendance. Le pont JS→Python est testé via `harvest-supabase`
// (aucune dépendance tierce : regex + émission YAML à la main).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run } from '../src/cli.js';
import { isArchiCommand, archiCommands, cmdArchi } from '../src/commands/archi.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

function tmp(p) { return mkdtempSync(join(tmpdir(), p)); }

function pythonAvailable() {
  try {
    execFileSync(process.env.SOMTECH_PYTHON || 'python3', ['--version'], { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

test('isArchiCommand reconnaît les sous-commandes du modèle vivant', () => {
  for (const c of ['harvest-supabase', 'harvest-routes', 'harvest-screens', 'harvest-config',
                   'merge-manifests', 'validate-manifest', 'diff-manifest', 'generate-erd']) {
    assert.equal(isArchiCommand(c), true, `${c} devrait être une commande archi`);
  }
  assert.equal(isArchiCommand('init'), false);
  assert.equal(isArchiCommand('brd'), false);
  assert.equal(isArchiCommand('generate-erd '), false); // pas de fuzzy match
});

test('archiCommands liste les 8 outils, triés', () => {
  const cmds = archiCommands();
  assert.equal(cmds.length, 8);
  assert.deepEqual(cmds, [...cmds].sort());
});

test('cmdArchi échoue proprement si le payload ne contient pas les scripts', () => {
  const empty = tmp('smtk-archi-empty-');
  // pack.json présent mais scripts/archi-ci absent → script introuvable → code 1
  writeFileSync(join(empty, 'pack.json'), JSON.stringify({ modules: {} }));
  const code = cmdArchi('diff-manifest', ['a', 'b'], { source: empty });
  assert.equal(code, 1);
});

test('pont JS→Python : harvest-supabase récolte les tables (dev payload = repo)', (t) => {
  if (!pythonAvailable()) return t.skip('python3 indisponible');
  const work = tmp('smtk-archi-sql-');
  mkdirSync(join(work, 'migrations'), { recursive: true });
  writeFileSync(join(work, 'migrations', '0001.sql'),
    'CREATE TABLE users (id uuid PRIMARY KEY);\n'
    + 'CREATE TABLE posts (id uuid, author_id uuid REFERENCES users(id));\n');
  const out = join(work, 'tables.yaml');
  // run() résout le payload sur la racine du repo (dev) → scripts/archi-ci présent.
  const code = cmdArchi('harvest-supabase',
    [join(work, 'migrations'), '--app', 'demo', '--out', out],
    { source: REPO_ROOT });
  assert.equal(code, 0, 'harvest-supabase devrait réussir');
  assert.ok(existsSync(out), 'le fichier de sortie devrait exister');
  const yaml = readFileSync(out, 'utf8');
  assert.match(yaml, /id: demo\.users/);
  assert.match(yaml, /id: demo\.posts/);
  assert.match(yaml, /kind: table/);
  assert.match(yaml, /from: demo\.posts/); // relation FK posts → users
});

test('run() propage le code de sortie du gate strict (drift → 1)', async (t) => {
  if (!pythonAvailable()) return t.skip('python3 indisponible');
  // pyyaml requis pour diff-manifest ; on skippe sinon.
  try {
    execFileSync(process.env.SOMTECH_PYTHON || 'python3', ['-c', 'import yaml'], { stdio: 'ignore' });
  } catch { return t.skip('PyYAML indisponible'); }

  const work = tmp('smtk-archi-diff-');
  const committed = join(work, 'committed.yaml');
  const harvested = join(work, 'harvested.yaml');
  writeFileSync(committed,
    'app: demo\nelements:\n  - {id: demo, kind: service, name: demo}\n');
  writeFileSync(harvested,
    'app: demo\nelements:\n'
    + '  - {id: demo, kind: service, name: demo}\n'
    + '  - {id: demo.t, kind: table, name: t, parent: demo}\n');

  process.env.SOMTECH_PACK_PAYLOAD = REPO_ROOT; // force le payload dev pour run()
  const drift = await run(['diff-manifest', committed, harvested, '--mode', 'strict']);
  const clean = await run(['diff-manifest', harvested, harvested, '--mode', 'strict']);
  delete process.env.SOMTECH_PACK_PAYLOAD;
  assert.equal(drift, 1, 'drift en strict → exit 1');
  assert.equal(clean, 0, 'identique en strict → exit 0');
});

// Un ALTER TABLE ne doit jamais s'apparier au REFERENCES d'une AUTRE instruction
// (D-20260731-0001, mesuré sur le chantier SI Bélanger).
//
// Le défaut : `.*?` combiné à re.DOTALL n'avait aucune borne de fin d'instruction, donc
// n'importe quel ALTER TABLE s'appariait au prochain `REFERENCES` du fichier — parfois des
// centaines de lignes plus loin — et le récolteur inventait une relation inexistante. Le
// nombre de fausses relations croît avec le dépôt, et le gate en mode strict finissait par
// exiger qu'on écrive dans le manifeste une contrainte qui n'existe pas : un gate conçu pour
// empêcher la documentation de mentir se mettait à l'exiger.
//
// Les DEUX cas ci-dessous sont volontaires. Une contre-mesure qui filtrerait les lignes de
// RLS attraperait le second et laisserait passer le premier, en donnant l'impression d'avoir
// fini — le déclencheur n'est pas le RLS, c'est tout ALTER TABLE qui déborde.
test('harvest-supabase : un ALTER TABLE ne déborde pas sur l’instruction suivante', (t) => {
  if (!pythonAvailable()) return t.skip('python3 indisponible');
  const work = tmp('smtk-archi-fk-');
  mkdirSync(join(work, 'migrations'), { recursive: true });
  writeFileSync(join(work, 'migrations', '0001.sql'), [
    // les cibles sont declarees ici : sans ca le recolteur les classe en dependances externes
    'CREATE TABLE facture (id uuid PRIMARY KEY);',
    'CREATE TABLE utilisateur (id uuid PRIMARY KEY);',
    'CREATE TABLE transporteur (id uuid PRIMARY KEY);',
    // cas 1 — DROP CONSTRAINT : aucun rapport avec le RLS
    'CREATE TABLE paiement (id uuid PRIMARY KEY, facture_id uuid REFERENCES facture(id));',
    'ALTER TABLE paiement DROP CONSTRAINT IF EXISTS paiement_ancien_fk;',
    'CREATE TABLE note (id uuid PRIMARY KEY, auteur_id uuid REFERENCES utilisateur(id));',
    // cas 2 — activation du RLS, le plus fréquent mais pas la cause
    'ALTER TABLE note ENABLE ROW LEVEL SECURITY;',
    'CREATE TABLE livraison (id uuid PRIMARY KEY, transporteur_id uuid REFERENCES transporteur(id));',
    // témoin positif — une vraie clé étrangère déclarée par ALTER TABLE doit rester récoltée
    'ALTER TABLE livraison ADD CONSTRAINT livraison_note_fk FOREIGN KEY (note_id) REFERENCES note(id);',
    '',
  ].join('\n'));
  const out = join(work, 'tables.yaml');
  assert.equal(cmdArchi('harvest-supabase',
    [join(work, 'migrations'), '--app', 'demo', '--out', out],
    { source: REPO_ROOT }), 0);
  const yaml = readFileSync(out, 'utf8');

  // Les relations réelles, toutes présentes.
  for (const [from, to] of [['paiement', 'facture'], ['note', 'utilisateur'],
                            ['livraison', 'transporteur'], ['livraison', 'note']]) {
    assert.match(yaml, new RegExp(`from: demo\\.${from}\\n\\s*to: demo\\.${to}`),
      `la relation réelle ${from} → ${to} devrait être récoltée`);
  }
  // Les relations fabriquées par débordement, aucune.
  for (const [from, to] of [['paiement', 'utilisateur'], ['note', 'transporteur']]) {
    assert.doesNotMatch(yaml, new RegExp(`from: demo\\.${from}\\n\\s*to: demo\\.${to}`),
      `${from} → ${to} n'existe pas : elle vient du débordement d'un ALTER TABLE`);
  }
});

// Le bornage a l'instruction ne doit pas casser la forme la plus courante d'une contrainte
// declaree apres coup : `ALTER TABLE ONLY … ADD CONSTRAINT … REFERENCES …` sur plusieurs
// lignes. `[^;]` traverse les sauts de ligne, contrairement a ce qu'on pourrait craindre.
test('harvest-supabase : une clé étrangère déclarée sur plusieurs lignes reste récoltée', (t) => {
  if (!pythonAvailable()) return t.skip('python3 indisponible');
  const work = tmp('smtk-archi-fk-ml-');
  mkdirSync(join(work, 'migrations'), { recursive: true });
  writeFileSync(join(work, 'migrations', '0001.sql'), [
    'CREATE TABLE a (id uuid PRIMARY KEY);',
    'CREATE TABLE b (id uuid PRIMARY KEY);',
    'ALTER TABLE ONLY public.b',
    '    ADD CONSTRAINT b_a_fk',
    '    FOREIGN KEY (a_id)',
    '    REFERENCES public.a(id)',
    '    ON DELETE CASCADE;',
    '',
  ].join('\n'));
  const out = join(work, 'tables.yaml');
  assert.equal(cmdArchi('harvest-supabase',
    [join(work, 'migrations'), '--app', 'demo', '--out', out],
    { source: REPO_ROOT }), 0);
  assert.match(readFileSync(out, 'utf8'), /from: demo\.b\n\s*to: demo\.a/);
});
