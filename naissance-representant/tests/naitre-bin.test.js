// naitre-bin.test.js — le fichier exécutable réel (bin/naitre.js), avec un FAUX herdr en
// tête de PATH — même technique que ligne-directe/tests/herdr.test.js. Aucun vrai pane
// n'est créé, aucune vraie session herdr n'est touchée.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, rmdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_NAISSANCE = resolve(HERE, '..');
const BIN = join(REPO_NAISSANCE, 'bin', 'naitre.js');

let bac;
let pathOriginal;

/** Un faux `herdr` qui journalise chaque appel (dans un fichier, un sous-processus ne
 * partage pas la mémoire du test) et répond selon le premier argument. */
function installerFauxHerdr() {
  const journal = join(bac, 'appels.jsonl');
  writeFileSync(journal, '');
  const script = `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(journal)}, JSON.stringify(args) + '\\n');
if (args[0] === 'tab' && args[1] === 'create') {
  process.stdout.write(JSON.stringify({ result: { root_pane: { pane_id: 'w9:p1' } } }));
} else {
  process.stdout.write(JSON.stringify({ result: { ok: true } }));
}
`;
  writeFileSync(join(bac, 'herdr'), script);
  chmodSync(join(bac, 'herdr'), 0o755);
  return journal;
}

function appelsJournalises(journal) {
  return readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

before(() => {
  bac = mkdtempSync(join(tmpdir(), 'smtk-naitre-bin-'));
  pathOriginal = process.env.PATH;
  process.env.PATH = `${bac}:${pathOriginal}`;
});

after(() => {
  process.env.PATH = pathOriginal;
  rmSync(bac, { recursive: true, force: true });
});

// bin/naitre.js calcule REPO_ROOT depuis SA PROPRE position sur disque (../..) —
// invariable. On ne peut donc pas lui faire croire à un autre dépôt sans le copier ; les
// tests qui suivent posent un lieu réel, temporaire et nommé par PID, sous CE dépôt, et le
// retirent dans un `finally`.

test('naitre.js refuse proprement quand le lieu n’existe pas — sans jamais appeler herdr', () => {
  const journal = installerFauxHerdr();
  const clientInexistant = `smoke-inexistant-${process.pid}`;
  assert.throws(() => execFileSync(process.execPath, [BIN, clientInexistant, '--workspace', 'w1'], { stdio: 'pipe' }));
  assert.equal(appelsJournalises(journal).length, 0, 'aucun appel herdr ne doit avoir lieu si le lieu est absent');
});

test('naitre.js exige --workspace', () => {
  assert.throws(() => execFileSync(process.execPath, [BIN, 'un-client'], { stdio: 'pipe' }));
});

test('naitre.js pose le garde puis fait naître le pane, dans cet ordre, via herdr réel remplacé', () => {
  const journal = installerFauxHerdr();
  const client = `smoke-${process.pid}`;
  const REPO_ROOT = resolve(REPO_NAISSANCE, '..');
  const lieu = join(REPO_ROOT, '.gestionnaire', client);
  mkdirSync(lieu, { recursive: true });
  writeFileSync(join(lieu, 'CLAUDE.md'), '# Tu es le représentant de ce client\n');
  writeFileSync(join(lieu, 'CONTEXTE.md'), "# Ce qu'on sait de ce client\n");
  writeFileSync(join(lieu, '.mcp.json'), '{"mcpServers":{"servicedesk":{}}}\n');
  mkdirSync(join(lieu, '.claude'), { recursive: true });
  writeFileSync(join(lieu, '.claude', 'settings.json'), '{"permissions":{"allow":["mcp__servicedesk__*"]}}\n');

  try {
    const sortie = execFileSync(process.execPath, [BIN, client, '--workspace', 'w9'], { stdio: 'pipe' }).toString();
    const rendu = JSON.parse(sortie);
    assert.equal(rendu.ok, true);
    assert.equal(rendu.pane, 'w9:p1');

    // Le garde a réellement été fusionné DANS leur fichier, sans effacer leurs permissions.
    const settingsFinal = JSON.parse(readFileSync(join(lieu, '.claude', 'settings.json'), 'utf8'));
    assert.deepEqual(settingsFinal.permissions, { allow: ['mcp__servicedesk__*'] });
    assert.match(settingsFinal.hooks.PreToolUse[0].hooks[0].command, /garde-ouverture-ligne\.js$/);

    const appels = appelsJournalises(journal);
    assert.equal(appels.length, 3, `3 appels herdr attendus (tab create, agent rename, pane run) — ${appels.length} vus`);
    assert.deepEqual(appels[0].slice(0, 2), ['tab', 'create']);
    assert.deepEqual(appels[1], ['agent', 'rename', 'w9:p1', client]);
    assert.deepEqual(appels[2], ['pane', 'run', 'w9:p1', `cd ${lieu} && claude`]);
  } finally {
    rmSync(lieu, { recursive: true, force: true });
    // Retire aussi `.gestionnaire/` si ce test l'a créé et qu'il ne reste rien dedans —
    // sinon un répertoire vide traîne dans le dépôt à chaque exécution de la suite.
    try {
      rmdirSync(join(REPO_ROOT, '.gestionnaire'));
    } catch {
      /* non vide (un autre client y vit) ou déjà absent : rien à faire */
    }
  }
});
