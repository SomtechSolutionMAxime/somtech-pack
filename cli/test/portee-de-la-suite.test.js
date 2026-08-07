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

test('un seul fichier de test construit cli/payload — sinon la course revient, par intermittence', () => {
  // Le danger JUMEAU de la découverte récursive, et il s'est produit sur la PR #180.
  //
  // `npm pack` lit `cli/payload`, un répertoire UNIQUE et partagé, et `node --test` exécute
  // UN PROCESSUS PAR FICHIER. Deux fichiers qui le reconstruisent se marchent dessus :
  // l'un le supprime pendant que l'autre l'empaquette, et le test qui perd la course
  // accuse un fichier d'ignore imaginaire — donc le mauvais coupable.
  //
  // L'invariant « un seul fichier y touche » était jusqu'ici un COMMENTAIRE. Un commentaire
  // n'arrête personne : le prochain fichier qui a besoin d'interroger le vrai paquet
  // rouvrira la course, qui se manifestera par intermittence — donc au pire moment.
  //
  // Les autres fichiers gardent le droit de CONSTRUIRE un payload : ils passent
  // `PAYLOAD_OUT` vers un répertoire temporaire, qui ne partage rien.
  // ⚠️ CETTE GARDE A ÉTÉ CORRIGÉE UNE FOIS, ET LA LEÇON EST LA MÊME QUE PARTOUT AILLEURS
  // SUR CE CHANTIER. Sa première version cherchait toute MENTION de « cli/payload », y
  // compris dans une chaîne de caractères — elle s'attrapait donc elle-même, ainsi que le
  // commentaire d'un autre fichier qui explique précisément pourquoi il n'y touche pas.
  // Elle gardait le texte, pas le comportement. On vise désormais les deux GESTES qui
  // provoquent réellement la course, et les commentaires sont dépouillés d'abord.
  const PROPRIETAIRE = 'build-payload.test.js';
  const sansCommentaires = (src) => src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');

  const GESTES = [
    { forme: /join\(\s*CLI_DIR\s*,\s*['"`]payload['"`]\s*\)/, quoi: 'construit un chemin vers le payload partagé' },
    { forme: /['"`]npm['"`]\s*,\s*\[\s*['"`]pack['"`]/, quoi: 'lance « npm pack », qui lit le payload partagé' },
  ];

  const fautifs = [];
  for (const f of readdirSync(HERE).filter((n) => /\.test\.[cm]?js$/.test(n) && n !== PROPRIETAIRE)) {
    const src = sansCommentaires(readFileSync(join(HERE, f), 'utf8'));
    for (const { forme, quoi } of GESTES) {
      if (forme.test(src)) fautifs.push(`${f} (${quoi})`);
    }
  }

  assert.deepEqual(
    fautifs, [],
    `Ces fichiers désignent cli/payload alors que seul ${PROPRIETAIRE} peut y toucher : `
      + `${fautifs.join(', ')}. Deux fichiers qui le construisent entrent en course (un processus `
      + `par fichier) et le perdant accuse un fichier d'ignore imaginaire. Construire ailleurs `
      + `via PAYLOAD_OUT, ou ajouter l'assertion dans ${PROPRIETAIRE}.`,
  );
});

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
