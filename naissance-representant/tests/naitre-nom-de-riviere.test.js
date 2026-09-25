// `naitre <nom de rivière>` — le binaire RÉEL (bin/naitre.js) accepte le nom là où il exigeait le
// code du mandat (D-20260925-0002). Un faux herdr (journal) en tête de PATH : aucune vraie
// session n'est touchée. Ce que ce banc éprouve, que le banc de la fonction ne peut pas : que le
// binaire APPELLE la traduction, et que tout ce qui suit reçoit le CODE.
//
// Les refus tombent AVANT tout appel herdr et toute écriture — la preuve est l'absence : aucun
// appel journalisé, aucun lieu créé à côté.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(resolve(HERE, '..'), 'bin', 'naitre.js');

function essai(lieux) {
  const depot = mkdtempSync(join(tmpdir(), 'smtk-naitre-riviere-'));
  execFileSync('git', ['-C', depot, 'init', '-q']);
  for (const [code, nomAgent] of Object.entries(lieux)) {
    const l = join(depot, '.orchestrateur', code);
    mkdirSync(l, { recursive: true });
    writeFileSync(join(l, 'CLAUDE.md'), "# Tu es l'orchestrateur de ce chantier\n");
    writeFileSync(join(l, 'CONTEXTE.md'), '# Ce qui est propre à ce dépôt\n');
    if (nomAgent) writeFileSync(join(l, '.nom-agent'), `${nomAgent}\n`);
  }
  const bin = mkdtempSync(join(tmpdir(), 'smtk-faux-herdr-'));
  const journal = join(bin, 'appels.log');
  writeFileSync(join(bin, 'herdr'), `#!/bin/sh\necho "$@" >> "${journal}"\necho '{"error":{"code":"essai"}}'\nexit 1\n`);
  chmodSync(join(bin, 'herdr'), 0o755);
  return { depot, bin, journal };
}

function naitre(e, saisie) {
  const r = spawnSync(process.execPath, [BIN, saisie, '--workspace', 'w9', '--role', 'orchestrateur', '--depot', e.depot], {
    env: { ...process.env, PATH: `${e.bin}:${process.env.PATH}`, HERDR_SOCKET_PATH: '', NAISSANCE_ESSAIS: '1', NAISSANCE_DELAI_MS: '5' },
  });
  return { code: r.status ?? 1, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? '') };
}

const appels = (e) => (existsSync(e.journal) ? readFileSync(e.journal, 'utf8').trim().split('\n').filter(Boolean) : []);
const lieux = (e) => readdirSync(join(e.depot, '.orchestrateur')).sort();

test('un nom de rivière qu’aucun lieu ne porte est REFUSÉ — aucun appel herdr, aucun lieu posé à son nom', () => {
  const e = essai({ 'j-20260814-0001': 'bonaventure' });
  const r = naitre(e, 'saguenay');
  assert.equal(r.code, 1, r.stderr);
  assert.match(r.stderr, /inscrit dans aucun lieu/);
  assert.match(r.stderr, /Rien n.a été créé/);
  assert.equal(appels(e).length, 0);
  assert.deepEqual(lieux(e), ['j-20260814-0001'], 'un lieu « saguenay » aurait été un nom pris pour un code');
});

test('deux lieux portent le nom : refus qui les nomme, aucun appel herdr', () => {
  const e = essai({ 'j-20260814-0001': 'bonaventure', 'j-20260814-0002': 'bonaventure' });
  const r = naitre(e, 'bonaventure');
  assert.equal(r.code, 1, r.stderr);
  assert.match(r.stderr, /j-20260814-0001/);
  assert.match(r.stderr, /j-20260814-0002/);
  assert.equal(appels(e).length, 0);
});

test('le nom d’un lieu existant est TRADUIT en son code : la commande le dit, et rien n’est posé au nom de la rivière', () => {
  const e = essai({ 'j-20260814-0001': 'bonaventure' });
  const r = naitre(e, 'bonaventure');
  assert.match(r.stdout, /« bonaventure » est le nom inscrit dans le lieu « j-20260814-0001 »/);
  assert.deepEqual(lieux(e), ['j-20260814-0001'], 'aucun lieu « bonaventure » ne doit naître : la traduction précède toute pose');
});

test('le code du mandat, lui, ne dit rien de plus qu’avant', () => {
  const e = essai({ 'j-20260814-0001': 'bonaventure' });
  const r = naitre(e, 'j-20260814-0001');
  assert.doesNotMatch(r.stdout, /est le nom inscrit dans le lieu/);
});
