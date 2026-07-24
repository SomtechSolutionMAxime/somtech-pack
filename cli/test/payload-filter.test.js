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
