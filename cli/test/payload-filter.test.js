// Ce qui entre dans le paquet publié, et ce qui n'y entre pas.
//
// Le canvas apporte au dépôt deux catégories de fichiers qui ne doivent PAS voyager :
// les dépendances de construction de sa page (273 Mo, sans usage après la construction)
// et son état d'exécution (fichiers de port, journaux, sauvegardes). En face, ce qui doit
// voyager : les sources du serveur, la page construite, et les dépendances d'exécution
// du serveur lui-même — sans quoi le canvas ne démarre pas chez celui qui installe.
//
// Décision : docs/superpowers/specs/2026-07-24-distribution-canvas-decision.md (T-20260724-0018)
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isPayloadResidue } from '../src/payload-filter.js';

test('payload-filter : les dépendances de construction de la page ne voyagent pas', () => {
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/web/node_modules'), true);
  assert.equal(
    isPayloadResidue('herdr-plugins/excalidraw/web/node_modules/vite/package.json'),
    true,
    'un fichier SOUS les dépendances de construction doit être exclu, pas seulement le dossier'
  );
});

test('payload-filter : les dépendances d\'exécution du serveur voyagent, elles', () => {
  assert.equal(
    isPayloadResidue('herdr-plugins/excalidraw/node_modules'),
    false,
    'chokidar et ws sont nécessaires au démarrage du serveur — les exclure casserait le canvas'
  );
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/node_modules/ws/index.js'), false);
});

test('payload-filter : la page construite voyage, ses sources non', () => {
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/web/dist/index.html'), false);
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/web/dist/assets/index-abc.js'), false);
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/web/src/main.jsx'), true);
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/web/vite.config.js'), true);
});

test('payload-filter : l\'état d\'exécution ne voyage jamais', () => {
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/.herdr'), true);
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/.herdr/canvas.excalidraw'), true);
  assert.equal(isPayloadResidue('some/project/.herdr/excalidraw-archi.port'), true);
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/.herdr/excalidraw-archi.log'), true);
  assert.equal(isPayloadResidue('docs/diagrams/pack.excalidraw.somtech.bak'), true);
  // L'engine numérote ses copies de secours quand le nom de base est déjà pris.
  assert.equal(isPayloadResidue('.claude/skills/merge/SKILL.md.somtech.bak.1'), true);
  assert.equal(isPayloadResidue('.claude/skills/merge/SKILL.md.somtech.bak.12'), true);
});

test('payload-filter : les tests du plugin restent au dépôt', () => {
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/tests'), true);
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/tests/server.test.js'), true);
});

test('payload-filter : ce qui fait tourner le canvas voyage', () => {
  for (const keep of [
    'herdr-plugins/excalidraw/server/server.js',
    'herdr-plugins/excalidraw/server/bin.js',
    'herdr-plugins/excalidraw/scripts/open.sh',
    'herdr-plugins/excalidraw/herdr-plugin.toml',
    'herdr-plugins/excalidraw/package.json',
    'herdr-plugins/excalidraw/package-lock.json',
    'herdr-plugins/excalidraw/web/package-lock.json',
  ]) {
    assert.equal(isPayloadResidue(keep), false, `${keep} doit voyager`);
  }
});

test('payload-filter : aucun fichier d\'ignore ne voyage', () => {
  // npm applique les .gitignore IMBRIQUÉS dans l'arborescence d'un paquet quand il n'y a
  // pas de .npmignore. Un .gitignore de plugin arrivé jusque dans le payload retirerait
  // du tarball publié la page construite et les dépendances du serveur — c'est-à-dire
  // exactement ce que le paquet est censé livrer, sans qu'aucun voyant ne s'allume.
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/.gitignore'), true);
  assert.equal(isPayloadResidue('plugins/audit-loi25/.gitignore'), true);
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/.npmignore'), true);
});

test('payload-filter : les dépendances imbriquées du serveur voyagent aussi', () => {
  // npm crée un node_modules imbriqué dès qu'il y a conflit de version. En perdre un
  // casserait le démarrage du serveur, silencieusement : rien ne le signalerait avant
  // qu'un poste tente d'ouvrir un canvas.
  assert.equal(
    isPayloadResidue('herdr-plugins/excalidraw/node_modules/chokidar/node_modules/readdirp/index.js'),
    false
  );
  assert.equal(
    isPayloadResidue('herdr-plugins/excalidraw/node_modules/.package-lock.json'),
    false
  );
});

test('payload-filter : sous la page web, seul ce qui sert à la servir voyage', () => {
  // Liste blanche et non liste noire : un fichier ajouté demain sous web/ ne doit pas
  // partir dans un paquet distribué à toute l'entreprise parce que personne n'a pensé
  // à l'exclure — un .env local, par exemple.
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/web/dist/index.html'), false);
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/web/package.json'), false);
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/web/package-lock.json'), false);

  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/web/index.html'), true);
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/web/tsconfig.json'), true);
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/web/.env.example'), true);
  assert.equal(isPayloadResidue('herdr-plugins/excalidraw/web/public/logo.svg'), true);
});

test('payload-filter : le reste du pack n\'est pas affecté', () => {
  for (const keep of [
    '.claude/commands/canvas.md',
    '.claude/skills/merge/SKILL.md',
    'scripts/remote-install.sh',
    'docs/diagrams/pack-skills-workflows.excalidraw',
    'features/README.md',
  ]) {
    assert.equal(isPayloadResidue(keep), false, `${keep} ne doit pas être pris pour un résidu`);
  }
});

test('payload-filter : les chemins Windows sont traités comme les autres', () => {
  assert.equal(isPayloadResidue('herdr-plugins\\excalidraw\\web\\node_modules\\vite'), true);
  assert.equal(isPayloadResidue('herdr-plugins\\excalidraw\\server\\server.js'), false);
});
