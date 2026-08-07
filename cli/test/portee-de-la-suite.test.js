// Garde-fou : la suite du CLI ne doit ramasser QUE ses propres tests.
//
// `cli/payload/` est un artefact de construction : il embarque une COPIE de
// tous les modules du pack, dont `ligne-directe/` avec ses tests. Un
// `node --test` sans portée, lancé depuis `cli/`, découvre récursivement cette
// copie et l'exécute une seconde fois — sous le Node du job courant.
//
// C'est ce qui a bloqué la publication de v1.29.1 : le job publish construit le
// payload PUIS lance `node --test` en Node 20, donc la suite de la ligne
// directe (qui exige Node 22 pour le WebSocket natif) tombait là où elle
// n'aurait jamais dû tourner. Symptôme jumeau : le double comptage signalé en
// T-20260806-0165 (195 tests d'un côté, 392 de l'autre — la même suite comptée
// deux fois).
//
// Les originaux de `ligne-directe/` restent couverts par le job dédié de
// tests.yml, en Node 22. Ce test empêche la copie de repartir en vadrouille.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_DIR = resolve(HERE, '..');
const REPO_ROOT = resolve(HERE, '..', '..');
const WORKFLOWS = join(REPO_ROOT, '.github', 'workflows');

test('le script `test` du CLI est borné à test/ (jamais une découverte récursive depuis cli/)', () => {
  const script = JSON.parse(readFileSync(join(CLI_DIR, 'package.json'), 'utf8')).scripts.test;

  assert.match(
    script,
    /^node --test\s+test\//,
    `cli/package.json scripts.test = « ${script} » — sans portée explicite sur test/, `
      + 'la découverte récursive ramasse cli/payload/ (copie de ligne-directe, Node 22 requis).',
  );
});

test('aucun workflow ne lance un `node --test` sans portée', () => {
  const fautifs = [];
  for (const f of readdirSync(WORKFLOWS).filter((n) => /\.ya?ml$/.test(n))) {
    const lignes = readFileSync(join(WORKFLOWS, f), 'utf8').split('\n');
    lignes.forEach((l, i) => {
      // `run: node --test` seul sur sa ligne = découverte récursive depuis le
      // working-directory du step. Passer par `npm test` garde une seule
      // source de vérité pour la portée (le package.json du paquet visé).
      if (/^\s*run:\s*node --test\s*$/.test(l)) fautifs.push(`${f}:${i + 1}`);
    });
  }

  assert.deepEqual(
    fautifs, [],
    `Ces steps lancent un « node --test » non borné : ${fautifs.join(', ')}. `
      + 'Utiliser « npm test » (working-directory du paquet) pour que la portée '
      + 'vienne du package.json, pas du hasard de l\'arborescence.',
  );
});

test('tous les tests du CLI sont à plat dans test/ — sinon le motif test/*.test.js en oublie', () => {
  // Le motif du script `test` est plat. Un test rangé dans un sous-dossier ne
  // serait PLUS exécuté, en silence : c'est le risque que fait naître le
  // bornage, donc on le garde sous surveillance ici.
  const caches = [];
  const parcourir = (dir, rel) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const sousRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) parcourir(join(dir, e.name), sousRel);
      else if (/\.test\.[cm]?js$/.test(e.name) && rel) caches.push(`test/${sousRel}`);
    }
  };
  parcourir(HERE, '');

  assert.deepEqual(
    caches, [],
    `Ces tests ne sont pas à la racine de cli/test/ et ne seraient donc jamais exécutés : `
      + `${caches.join(', ')}. Les remonter dans cli/test/, ou élargir scripts.test.`,
  );
});
