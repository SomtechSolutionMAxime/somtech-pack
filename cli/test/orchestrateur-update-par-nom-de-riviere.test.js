// `orchestrateur-update` accepte le NOM de rivière là où il exigeait le code du mandat
// (D-20260925-0002 : « je trouve ça mêlant »).
//
// Le dirigeant tape `bonaventure` ; le lieu s'appelle `j-20260814-0001` et le reste. La commande
// résout le lieu par son `.nom-agent`, DIT lequel elle a retenu, et refuse — en nommant — quand
// deux lieux portent le nom ou quand aucun ne le porte. Preuve par CONTENU du lieu réel.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { run } from '../src/cli.js';
import { alignerLePosteSur } from './lib/poste-conforme.js';

const tmp = (p) => mkdtempSync(join(tmpdir(), p));
const V1 = '# metier v1\n';
const V2 = '# metier v2 — apres correctif\n';

function payload() {
  const root = tmp('smtk-riviere-payload-');
  writeFileSync(join(root, 'pack.json'), JSON.stringify({
    name: 'fixture-pack', version: '9.9.9', modules: { core: { default: true, paths: ['.claude/'] } },
  }));
  const g = join(root, '.claude', 'templates', 'orchestrateur');
  mkdirSync(g, { recursive: true });
  writeFileSync(join(g, 'CLAUDE.md'), V2);
  alignerLePosteSur(root);
  return root;
}

function depot(lieux) {
  const repo = tmp('smtk-riviere-repo-');
  for (const [code, nomAgent] of Object.entries(lieux)) {
    const l = join(repo, '.orchestrateur', code);
    mkdirSync(l, { recursive: true });
    writeFileSync(join(l, 'CLAUDE.md'), V1);
    writeFileSync(join(l, 'CONTEXTE.md'), '# contexte\n');
    if (nomAgent !== undefined) writeFileSync(join(l, '.nom-agent'), `${nomAgent}\n`);
  }
  return repo;
}

/** Capture stdout/stderr de la commande : ce qu'elle DIT fait partie de ce qu'elle promet. */
async function lancer(args) {
  const sorties = [];
  const log = console.log, err = console.error;
  console.log = (...a) => sorties.push(a.join(' '));
  console.error = (...a) => sorties.push(a.join(' '));
  try {
    const code = await run(args);
    return { code, texte: sorties.join('\n') };
  } finally {
    console.log = log; console.error = err;
  }
}

const lu = (repo, code) => readFileSync(join(repo, '.orchestrateur', code, 'CLAUDE.md'), 'utf8');

test('G1 — le nom de rivière met à jour le lieu qui le porte, et la commande DIT lequel', async () => {
  const repo = depot({ 'j-20260814-0001': 'bonaventure', 'j-20260814-0002': 'batiscan' });
  const { code, texte } = await lancer(['orchestrateur-update', '--nom', 'bonaventure', '--source', payload(), '--target', repo]);
  assert.equal(code, 0, texte);
  assert.equal(lu(repo, 'j-20260814-0001'), V2, 'le lieu du nom a convergé');
  assert.equal(lu(repo, 'j-20260814-0002'), V1, 'l’autre lieu n’a PAS bougé');
  assert.match(texte, /bonaventure/);
  assert.match(texte, /j-20260814-0001/, 'la commande dit quel lieu elle a retenu');
  assert.deepEqual(readdirSync(join(repo, '.orchestrateur')).sort(), ['j-20260814-0001', 'j-20260814-0002'], 'aucun lieu créé à côté');
});

test('G1 — le CODE du mandat marche toujours, sans le dire comme une traduction', async () => {
  const repo = depot({ 'j-20260814-0001': 'bonaventure' });
  const { code, texte } = await lancer(['orchestrateur-update', '--nom', 'j-20260814-0001', '--source', payload(), '--target', repo]);
  assert.equal(code, 0, texte);
  assert.equal(lu(repo, 'j-20260814-0001'), V2);
  assert.doesNotMatch(texte, /porte le nom|inscrit/i);
});

test('G2 — deux lieux portent le nom : refus qui les nomme, rien écrit', async () => {
  const repo = depot({ 'j-20260814-0001': 'bonaventure', 'j-20260814-0002': 'bonaventure' });
  const { code, texte } = await lancer(['orchestrateur-update', '--nom', 'bonaventure', '--source', payload(), '--target', repo]);
  assert.notEqual(code, 0);
  assert.match(texte, /j-20260814-0001/);
  assert.match(texte, /j-20260814-0002/);
  assert.equal(lu(repo, 'j-20260814-0001'), V1);
  assert.equal(lu(repo, 'j-20260814-0002'), V1);
});

test('G3 — aucun lieu ne porte le nom : « inscrit dans aucun lieu », jamais « n’existe pas »', async () => {
  const repo = depot({ 'j-20260814-0001': 'bonaventure' });
  const { code, texte } = await lancer(['orchestrateur-update', '--nom', 'saguenay', '--source', payload(), '--target', repo]);
  assert.notEqual(code, 0);
  assert.match(texte, /inscrit dans aucun lieu/);
  assert.doesNotMatch(texte, /n['’]existe pas|jamais « posé »/);
  assert.equal(lu(repo, 'j-20260814-0001'), V1);
});

test('G4 — un .nom-agent illisible : le refus dit que la mesure a manqué, pas « aucun lieu »', {
  skip: process.getuid?.() === 0 ? 'root lit tout : non prouvable ici' : false,
}, async () => {
  const repo = depot({ 'j-20260814-0001': 'bonaventure', 'j-20260814-0002': 'batiscan' });
  const f = join(repo, '.orchestrateur', 'j-20260814-0002', '.nom-agent');
  chmodSync(f, 0o000);
  let r;
  try {
    r = await lancer(['orchestrateur-update', '--nom', 'batiscan', '--source', payload(), '--target', repo]);
  } finally { chmodSync(f, 0o600); }
  assert.notEqual(r.code, 0);
  assert.match(r.texte, /j-20260814-0002/);
  assert.doesNotMatch(r.texte, /inscrit dans aucun lieu/);
});

test('un nom qui traverse un répertoire reste refusé par la garde anti-évasion', async () => {
  const repo = depot({ 'j-20260814-0001': 'bonaventure' });
  const { code, texte } = await lancer(['orchestrateur-update', '--nom', '../evil', '--source', payload(), '--target', repo]);
  assert.notEqual(code, 0);
  assert.match(texte, /segment de chemin/);
});
