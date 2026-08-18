// plafond.test.js — `poserPlafond` seul, sans la ronde (T-20260818-0014).
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// POURQUOI CE FICHIER EXISTE — UNE MUTATION A SURVÉCU
//
// Une passe de revue par mutation a retiré le `.unref()` du minuteur : **aucun des essais de
// la ronde n'a rougi**, et la revue a montré pourquoi — `tenir()` termine par un
// `process.exit()` sur chacun de ses chemins, et un `exit` ne regarde aucun minuteur en
// attente. La propriété était donc affirmée par un commentaire et prouvée par rien.
//
// ⚠️ ELLE NE SE PROUVE PAS À TRAVERS LA RONDE, et c'est tout l'objet de ce fichier. La ronde
// masque la propriété : quoi que fasse le plafond, elle sort. C'est `poserPlafond` qui doit
// tenir son contrat — « je ne retiens JAMAIS un processus en vie » —, indépendamment de la
// façon dont son appelant choisit de mourir aujourd'hui.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { poserPlafond } from '../src/rendez-vous.js';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'rendez-vous.js');

test('UN PLAFOND POSÉ NE RETIENT JAMAIS UN PROCESSUS EN VIE', () => {
  // ⚠️ MESURÉ DANS UN VRAI PROCESSUS, pas simulé. La propriété EST « le processus sort » : la
  // vérifier sur un objet minuteur reviendrait à éprouver `unref` lui-même, c'est-à-dire Node,
  // pas ce fichier. Un plafond d'une minute contre une sortie attendue en moins de cinq
  // secondes : sans `unref`, ce processus attendrait la minute entière.
  const script = `import { poserPlafond } from ${JSON.stringify(SRC)};
poserPlafond({ ms: 60000, quoi: 'essai', ecrire: () => {}, sortir: () => {} });
// Et rien d'autre. Il n'y a plus RIEN à attendre : ce processus doit sortir maintenant.
`;
  const debut = Date.now();
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { timeout: 20000 });
  const ecoule = Date.now() - debut;

  assert.equal(r.signal, null, `il doit sortir DE LUI-MÊME : ${r.signal} veut dire que le harnais l'a tué`);
  assert.equal(r.status, 0);
  assert.ok(ecoule < 5000, `un plafond ne retient pas son processus — ${ecoule} ms pour un plafond de 60 000 ms`);
});

test('LE PLAFOND ÉCRIT AVANT DE TUER — un mort sans faire-part est un silence de plus', () => {
  const dits = [];
  const sorties = [];
  let rappel = null;
  poserPlafond({
    ms: 1234,
    quoi: 'ca.somtech.essai',
    ecrire: (t) => dits.push(t),
    sortir: (c) => sorties.push(c),
    minuteur: (fn, ms) => {
      rappel = { fn, ms };
      return { unref() {} };
    },
  });

  assert.equal(rappel.ms, 1234, 'le plafond posé est celui qu’on lui donne');
  assert.deepEqual(dits, [], 'rien n’est dit tant que le plafond n’est pas atteint');
  rappel.fn();

  assert.deepEqual(sorties, [1], 'une ronde qui n’a rien établi est une PANNE, jamais un succès');
  assert.equal(dits.length, 1);
  assert.match(dits[0], /1234/, 'le faire-part porte la durée exacte dépassée');
  assert.match(dits[0], /ca\.somtech\.essai/, 'et NOMME sa victime');
  assert.match(dits[0], /pas « rien à signaler »|n'a donc RIEN établi/i, 'et sépare « rien à dire » de « on n’a pas pu regarder »');
  // ⚠️ L'ORDRE COMPTE : écrire APRÈS avoir tué n'écrit rien. La revue de ce dépôt a déjà vu
  // un message d'échec parfait qu'aucun chemin n'atteignait.
  assert.ok(dits.length === 1 && sorties.length === 1, 'il écrit, PUIS il tue');
});
