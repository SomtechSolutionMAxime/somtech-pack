// Tests du CLI @somtech/pack (node:test, zéro dépendance).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync, chmodSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseArgs, run } from '../src/cli.js';
import { readManifest, defaultModules, resolveModules, resolvePayloadRoot } from '../src/modules.js';
import { collectFiles, applyFiles } from '../src/engine.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_DIR = resolve(HERE, '..');
const REPO_ROOT = resolve(HERE, '..', '..');

function tmp(prefix) { return mkdtempSync(join(tmpdir(), prefix)); }

// Construit un payload de pack fixture déterministe. Renvoie son chemin.
function makeFixture() {
  const root = tmp('smtk-payload-');
  const manifest = {
    name: 'fixture-pack',
    version: '9.9.9',
    modules: {
      core: { default: true, paths: ['.claude/'] },
      features: { default: true, paths: ['features/'] },
      tools: { default: false, paths: ['tools/'] },
    },
  };
  writeFileSync(join(root, 'pack.json'), JSON.stringify(manifest, null, 2));
  mkdirSync(join(root, '.claude/skills/x'), { recursive: true });
  writeFileSync(join(root, '.claude/skills/x/SKILL.md'), 'skill v1\n');
  writeFileSync(join(root, '.claude/agents.md'), 'agents\n');
  mkdirSync(join(root, 'features'), { recursive: true });
  writeFileSync(join(root, 'features/blueprint.md'), 'bp\n');
  mkdirSync(join(root, 'tools'), { recursive: true });
  const sh = join(root, 'tools/run.sh');
  writeFileSync(sh, '#!/usr/bin/env bash\necho hi\n');
  chmodSync(sh, 0o755);
  return root;
}

test('parseArgs : commande, csv, formes --x=y et flags', () => {
  const p = parseArgs(['init', '--modules', 'a,b', '--yes', '--target=/t']);
  assert.equal(p.command, 'init');
  assert.equal(p.flags.modules, 'a,b');
  assert.equal(p.flags.yes, true);
  assert.equal(p.flags.target, '/t');
  const p2 = parseArgs(['update', '--modules=core', '--force']);
  assert.equal(p2.flags.modules, 'core');
  assert.equal(p2.flags.force, true);
  assert.throws(() => parseArgs(['init', '--inconnu']), /Option inconnue/);
});

test('modules : défauts et rejet d’un module inconnu', () => {
  const payload = makeFixture();
  const m = readManifest(payload);
  assert.deepEqual(defaultModules(m).sort(), ['core', 'features']);
  assert.doesNotThrow(() => resolveModules(m, ['core', 'tools']));
  assert.throws(() => resolveModules(m, ['core', 'nope']), /Module\(s\) inconnu\(s\) : nope/);
});

test('engine : init crée tout, re-run idempotent (no-op)', () => {
  const payload = makeFixture();
  const target = tmp('smtk-target-');
  const m = readManifest(payload);
  const { files } = collectFiles(payload, m.modules.core.paths.concat(m.modules.features.paths));

  const r1 = applyFiles({ payloadRoot: payload, target, files });
  assert.equal(r1.created.length, files.length);
  assert.equal(r1.unchanged.length, 0);
  // tous les fichiers existent côté cible
  for (const f of files) assert.ok(existsSync(join(target, f)), `manque ${f}`);

  const r2 = applyFiles({ payloadRoot: payload, target, files });
  assert.equal(r2.created.length, 0, 'aucun nouveau fichier au 2e run');
  assert.equal(r2.unchanged.length, files.length, 'tout doit être inchangé (idempotent)');
});

test('engine : fichier pack-owned divergent CONVERGE par défaut (écrasé + backup) SANS force (D-20260715-0002)', () => {
  const payload = makeFixture();
  const target = tmp('smtk-target-');
  const m = readManifest(payload);
  const { files } = collectFiles(payload, m.modules.core.paths);
  applyFiles({ payloadRoot: payload, target, files });

  // l'utilisateur a dérivé un fichier du pack (modif locale = dérive, pas un état protégé)
  const touched = join(target, '.claude/skills/x/SKILL.md');
  writeFileSync(touched, 'MODIF UTILISATEUR\n');

  // convergence par DÉFAUT (sans --force) : le fichier reprend la version du pack, backup créé.
  const r = applyFiles({ payloadRoot: payload, target, files });
  assert.ok(r.updated.includes('.claude/skills/x/SKILL.md'), 'doit converger (updated) sans force');
  assert.ok(r.backedUp.includes('.claude/skills/x/SKILL.md'), 'la version dérivée doit être sauvegardée');
  assert.equal(r.conflicts.length, 0, 'plus de conflit pour un fichier pack-owned');
  assert.equal(readFileSync(touched, 'utf8'), 'skill v1\n', 'doit être écrasé par la version du pack');
  assert.ok(existsSync(`${touched}.somtech.bak`), 'backup .somtech.bak présent');
  assert.equal(readFileSync(`${touched}.somtech.bak`, 'utf8'), 'MODIF UTILISATEUR\n', 'backup = ancienne version dérivée');

  // idempotence : 2e run, plus rien à converger.
  const r2 = applyFiles({ payloadRoot: payload, target, files });
  assert.ok(r2.unchanged.includes('.claude/skills/x/SKILL.md'), '2e run : inchangé');
  assert.equal(r2.updated.length, 0, '2e run : rien à converger');
});

test('engine : symlink en CIBLE jamais écrit à travers (dev setup protégé), même en convergence', () => {
  const payload = makeFixture();
  const target = tmp('smtk-target-');
  const m = readManifest(payload);
  const { files } = collectFiles(payload, m.modules.core.paths);
  applyFiles({ payloadRoot: payload, target, files });

  // remplacer une cible par un symlink vers un fichier hors-cible (dev qui symlink vers le repo source)
  const dest = join(target, '.claude/skills/x/SKILL.md');
  const external = tmp('smtk-ext-'); writeFileSync(join(external, 'linked.md'), 'CONTENU LIÉ\n');
  rmSync(dest); symlinkSync(join(external, 'linked.md'), dest);

  const r = applyFiles({ payloadRoot: payload, target, files });
  assert.ok(r.conflicts.includes('.claude/skills/x/SKILL.md'), 'symlink → conflict (jamais écrit à travers)');
  assert.equal(readFileSync(join(external, 'linked.md'), 'utf8'), 'CONTENU LIÉ\n', 'la cible du symlink n’est jamais touchée');
});

test('engine : répertoire PARENT symlinké → jamais écrit à travers (dev setup ~/.claude/skills → repo) (B1, D-20260715-0002)', () => {
  const payload = makeFixture();
  const target = tmp('smtk-target-');
  // le "repo" du dev, hors cible, avec sa copie de travail non commitée
  const repo = tmp('smtk-repo-');
  mkdirSync(join(repo, 'x'), { recursive: true });
  writeFileSync(join(repo, 'x', 'SKILL.md'), 'DEV WORKING COPY\n');
  // dans la cible, .claude/skills est un SYMLINK de RÉPERTOIRE vers le repo (dev setup courant)
  mkdirSync(join(target, '.claude'), { recursive: true });
  symlinkSync(repo, join(target, '.claude', 'skills'));

  const m = readManifest(payload);
  const { files } = collectFiles(payload, m.modules.core.paths);
  const r = applyFiles({ payloadRoot: payload, target, files });

  assert.ok(r.conflicts.includes('.claude/skills/x/SKILL.md'), 'parent symlinké → conflict');
  assert.ok(!r.updated.includes('.claude/skills/x/SKILL.md'), 'jamais convergé à travers le lien de dossier');
  assert.equal(readFileSync(join(repo, 'x', 'SKILL.md'), 'utf8'), 'DEV WORKING COPY\n', 'checkout du dev INTACT');
  assert.ok(!existsSync(join(repo, 'x', 'SKILL.md.somtech.bak')), 'aucun .somtech.bak déposé dans le repo');
});

test('engine : backup impossible → NE PAS écraser (jamais de troncature sans filet) (M1, D-20260715-0002)', { skip: process.getuid && process.getuid() === 0 }, () => {
  const payload = tmp('smtk-pl-'); const target = tmp('smtk-tg-');
  writeFileSync(join(payload, 'a.txt'), 'PACK\n');
  writeFileSync(join(target, 'a.txt'), 'DERIVE\n');
  chmodSync(target, 0o555); // dossier en lecture seule → création du .somtech.bak impossible
  try {
    const r = applyFiles({ payloadRoot: payload, target, files: ['a.txt'] });
    assert.ok(r.conflicts.includes('a.txt'), 'backup KO → conflict, pas d’écrasement');
    assert.ok(!r.updated.includes('a.txt'), 'non convergé');
    assert.equal(readFileSync(join(target, 'a.txt'), 'utf8'), 'DERIVE\n', 'fichier NON tronqué (donnée préservée)');
  } finally {
    chmodSync(target, 0o755);
  }
});

test('engine : convergences répétées → backups numérotés, aucune version perdue (M2, D-20260715-0002)', () => {
  const payload = tmp('smtk-pl-'); const target = tmp('smtk-tg-');
  writeFileSync(join(payload, 'a.txt'), 'PACK\n');
  writeFileSync(join(target, 'a.txt'), 'DERIVE 1\n');
  applyFiles({ payloadRoot: payload, target, files: ['a.txt'] });   // converge → .somtech.bak = DERIVE 1
  writeFileSync(join(target, 'a.txt'), 'DERIVE 2\n');                // re-dérive
  const r = applyFiles({ payloadRoot: payload, target, files: ['a.txt'] });   // → .somtech.bak.1 = DERIVE 2
  assert.ok(r.backedUp.includes('a.txt'));
  assert.equal(readFileSync(join(target, 'a.txt.somtech.bak'), 'utf8'), 'DERIVE 1\n', '1er backup préservé');
  assert.equal(readFileSync(join(target, 'a.txt.somtech.bak.1'), 'utf8'), 'DERIVE 2\n', '2e backup numéroté');
  assert.equal(readFileSync(join(target, 'a.txt'), 'utf8'), 'PACK\n', 'converge à la fin');
});

test('engine : préserve le bit exécutable', () => {
  const payload = makeFixture();
  const target = tmp('smtk-target-');
  const m = readManifest(payload);
  const { files } = collectFiles(payload, m.modules.tools.paths);
  applyFiles({ payloadRoot: payload, target, files });
  const mode = statSync(join(target, 'tools/run.sh')).mode & 0o111;
  assert.ok(mode !== 0, 'le script copié doit rester exécutable');
});

test('engine : dry-run n’écrit rien', () => {
  const payload = makeFixture();
  const target = tmp('smtk-target-');
  const m = readManifest(payload);
  const { files } = collectFiles(payload, m.modules.core.paths);
  const r = applyFiles({ payloadRoot: payload, target, files, dryRun: true });
  assert.equal(r.created.length, files.length, 'rapport indique created');
  for (const f of files) assert.ok(!existsSync(join(target, f)), `dry-run ne doit pas écrire ${f}`);
});

test('run init : installe + écrit version.json, exit 0', async () => {
  const payload = makeFixture();
  const target = tmp('smtk-target-');
  const code = await run(['init', '--modules', 'core,features', '--yes', '--source', payload, '--target', target]);
  assert.equal(code, 0);
  assert.ok(existsSync(join(target, '.claude/skills/x/SKILL.md')));
  assert.ok(existsSync(join(target, 'features/blueprint.md')));
  const ver = JSON.parse(readFileSync(join(target, '.somtech-pack/version.json'), 'utf8'));
  // version.json reflète la version du PACKAGE CLI (= version npm/tag), pas le pack.json bundlé
  const cliVer = JSON.parse(readFileSync(join(CLI_DIR, 'package.json'), 'utf8')).version;
  assert.equal(ver.version, cliVer, 'version = version du package CLI');
  assert.equal(ver.name, '@somtech-solutions/pack');
  assert.equal(ver.installedBy, '@somtech-solutions/pack (cli)');
  assert.equal(ver.packContentVersion, '9.9.9', 'version du contenu du pack (pack.json) tracée à part');
  assert.deepEqual(ver.modules, ['core', 'features']);
});

test('preserve : créé si absent, JAMAIS écrasé si présent (même --force)', () => {
  const payload = tmp('smtk-preserve-payload-');
  writeFileSync(join(payload, 'pack.json'), JSON.stringify({
    name: 'fx', version: '9.9.9',
    preserve: ['.claude/settings.json'],
    modules: { core: { default: true, paths: ['.claude/'] } },
  }));
  mkdirSync(join(payload, '.claude'), { recursive: true });
  writeFileSync(join(payload, '.claude/settings.json'), '{"pack":"default"}\n');
  writeFileSync(join(payload, '.claude/agents.md'), 'agents\n');

  const m = readManifest(payload);
  const { files } = collectFiles(payload, m.modules.core.paths);
  const target = tmp('smtk-preserve-target-');

  // 1) absent → créé (starter)
  let r = applyFiles({ payloadRoot: payload, target, files, preserve: m.preserve });
  assert.ok(r.created.includes('.claude/settings.json'), 'settings.json créé si absent');

  // 2) modifié côté projet + --force → PRÉSERVÉ (pas écrasé)
  writeFileSync(join(target, '.claude/settings.json'), '{"projet":"custom"}\n');
  r = applyFiles({ payloadRoot: payload, target, files, preserve: m.preserve, force: true });
  assert.ok(r.preserved.includes('.claude/settings.json'), 'settings.json en statut preserved');
  assert.ok(!r.updated.includes('.claude/settings.json'), 'settings.json NON écrasé malgré --force');
  assert.equal(readFileSync(join(target, '.claude/settings.json'), 'utf8'), '{"projet":"custom"}\n', 'config projet intacte');
});

test('run update --force : settings.json projet préservé bout-en-bout (câblage manifest.preserve)', async () => {
  // Couvre le chemin complet run() → runApply → applyFiles avec preserve.
  const payload = tmp('smtk-preserve-e2e-');
  writeFileSync(join(payload, 'pack.json'), JSON.stringify({
    name: 'fx', version: '9.9.9',
    preserve: ['.claude/settings.json'],
    modules: { core: { default: true, paths: ['.claude/'] } },
  }));
  mkdirSync(join(payload, '.claude'), { recursive: true });
  writeFileSync(join(payload, '.claude/settings.json'), '{"pack":"default"}\n');
  writeFileSync(join(payload, '.claude/agents.md'), 'agents\n');
  const target = tmp('smtk-preserve-e2e-target-');

  await run(['init', '--modules', 'core', '--yes', '--source', payload, '--target', target]);
  const f = join(target, '.claude/settings.json');
  writeFileSync(f, '{"projet":"custom"}\n');                 // l'utilisateur personnalise

  const code = await run(['update', '--modules', 'core', '--yes', '--force', '--source', payload, '--target', target]);
  assert.equal(code, 0, 'preserve → pas de conflit → exit 0 même sans rien forcer');
  assert.equal(readFileSync(f, 'utf8'), '{"projet":"custom"}\n', 'settings.json projet NON écrasé même via run --force');
});

test('run init : module inconnu → exit 1', async () => {
  const payload = makeFixture();
  const target = tmp('smtk-target-');
  const code = await run(['init', '--modules', 'core,nope', '--yes', '--source', payload, '--target', target]);
  assert.equal(code, 1);
});

test('run update : converge par défaut un fichier pack-owned dérivé (écrase + backup), exit 0 (D-20260715-0002)', async () => {
  const payload = makeFixture();
  const target = tmp('smtk-target-');
  await run(['init', '--modules', 'core', '--yes', '--source', payload, '--target', target]);
  const f = join(target, '.claude/agents.md');
  const pack = readFileSync(f, 'utf8');           // version du pack, telle qu'installée
  writeFileSync(f, 'LOCAL\n');                     // dérive locale
  const code = await run(['update', '--modules', 'core', '--yes', '--source', payload, '--target', target]);
  assert.equal(code, 0, 'convergence appliquée → exit 0');
  assert.equal(readFileSync(f, 'utf8'), pack, 'update converge : le fichier reprend la version du pack');
  assert.equal(readFileSync(`${f}.somtech.bak`, 'utf8'), 'LOCAL\n', 'la version locale est sauvegardée (.somtech.bak)');
});

test('run update --dry-run : détecte la dérive sans écrire, exit 2 (CI drift) (D-20260715-0002)', async () => {
  const payload = makeFixture();
  const target = tmp('smtk-target-');
  await run(['init', '--modules', 'core', '--yes', '--source', payload, '--target', target]);
  const f = join(target, '.claude/agents.md');
  writeFileSync(f, 'LOCAL\n');
  const code = await run(['update', '--modules', 'core', '--yes', '--dry-run', '--source', payload, '--target', target]);
  assert.equal(code, 2, 'dry-run + dérive → exit 2 (détection CI)');
  assert.equal(readFileSync(f, 'utf8'), 'LOCAL\n', 'dry-run ne doit rien écrire');
  assert.ok(!existsSync(`${f}.somtech.bak`), 'dry-run ne crée pas de backup');
});

test('SÉCURITÉ : un path de module avec ../ est rejeté, rien écrit hors target', async () => {
  const root = tmp('smtk-evil-payload-');
  writeFileSync(join(root, 'pack.json'), JSON.stringify({
    name: 'evil', version: '0.0.0',
    modules: { evil: { default: true, paths: ['../escape/'] } },
  }));
  mkdirSync(join(root, '../escape'), { recursive: true });
  writeFileSync(resolve(root, '../escape/secret.txt'), 'pwn\n');

  // collectFiles rejette le chemin évadé
  const m = readManifest(root);
  const c = collectFiles(root, m.modules.evil.paths);
  assert.equal(c.files.length, 0, 'aucun fichier collecté depuis un chemin évadé');
  assert.deepEqual(c.rejected, ['../escape/']);

  // run() ne doit RIEN écrire hors de la cible
  const target = tmp('smtk-evil-target-');
  const outside = resolve(target, '../escape/secret.txt');
  const before = existsSync(outside);
  await run(['init', '--modules', 'evil', '--yes', '--source', root, '--target', target]);
  // la cible ne contient pas le fichier évadé, et rien n'a été (ré)écrit dehors
  assert.ok(!existsSync(join(target, 'escape/secret.txt')));
  assert.equal(existsSync(outside), before, 'aucun fichier touché hors de la cible');
});

test('SÉCURITÉ : les symlinks du payload sont ignorés (jamais copiés)', () => {
  const root = makeFixture();
  // place un symlink dans le module core
  const linkPath = join(root, '.claude/link-to-secret');
  writeFileSync(join(root, 'outside-secret.txt'), 'secret\n');
  symlinkSync(resolve(root, 'outside-secret.txt'), linkPath);

  const m = readManifest(root);
  const c = collectFiles(root, m.modules.core.paths);
  assert.ok(!c.files.some((f) => f.endsWith('link-to-secret')), 'le symlink ne doit pas être collecté');
  assert.ok(c.links.some((l) => l.endsWith('link-to-secret')), 'le symlink doit être listé dans links');
});

test('parseArgs : --modules sans valeur → erreur', () => {
  assert.throws(() => parseArgs(['init', '--modules']), /attend une valeur/);
  assert.throws(() => parseArgs(['init', '--target', '--yes']), /attend une valeur/);
});

test('run --version → exit 0', async () => {
  const code = await run(['--version']);
  assert.equal(code, 0);
});

test('payload réel du repo : résolution + collecte non vides', () => {
  // Prouve que le CLI fonctionne avec le vrai pack.json du repo (mode dev).
  const payload = resolvePayloadRoot({ source: REPO_ROOT });
  const m = readManifest(payload);
  assert.ok(defaultModules(m).includes('core'));
  const { files } = collectFiles(payload, m.modules.core.paths);
  assert.ok(files.length > 0, 'le module core doit contenir des fichiers');
});
