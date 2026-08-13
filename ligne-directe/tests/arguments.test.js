// La lecture de la ligne de commande — la partie qui se trompe EN SILENCE.
//
// Elle vivait dans `bin/`, sans test, et le défaut d'origine le dit assez : `ouvrir --inviter
// maxime@somtech.ca D-1` créait un canal nommé d'après l'adresse courriel. Rien ne le signalait,
// et le canal restait.
//
// Le geste `commun` a ajouté une option RÉPÉTABLE, et c'est là que le silence coûte le plus
// cher : `--dirigeant a --dirigeant b` dont une seule valeur est lue désigne un canal commun
// où la personne oubliée s'entend refuser la parole sans que rien ne le dise — sur le canal
// qui sert précisément à ne plus attendre.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { option, optionsRepetees, premierLibre, OPTIONS_A_VALEUR } from '../src/arguments.js';

test('premierLibre saute les VALEURS d’options — le défaut d’origine', async () => {
  assert.equal(premierLibre(['--inviter', 'maxime@somtech.ca', 'D-1']), 'D-1');
  assert.equal(premierLibre(['annonces-agents', '--dirigeant', 'maxime@somtech.ca']), 'annonces-agents');
  // Celui-ci est le cas du geste `commun` tapé dans l'autre ordre : sans `--dirigeant` dans
  // les options à valeur, le canal désigné serait l'adresse courriel du dirigeant.
  assert.equal(premierLibre(['--dirigeant', 'maxime@somtech.ca', 'annonces-agents']), 'annonces-agents');
  assert.equal(premierLibre(['--sans-archiver']), null, 'un drapeau seul ne laisse aucun argument libre');
});

test('toute option à valeur EMPLOYÉE PAR LA COMMANDE est déclarée', async () => {
  // ═══════════════════════════════════════════════════════════════════════════════════════
  // CE TEST A ÉTÉ RÉÉCRIT APRÈS UNE REVUE QUI L'A PRIS EN FAUX TÉMOIN.
  //
  // Il comparait `OPTIONS_A_VALEUR` à une liste écrite à la main juste à côté : il ne prouvait
  // que son propre accord avec lui-même. Le reviewer a ajouté une option `--espace` dans le
  // binaire sans la déclarer — c'est-à-dire le défaut d'origine rejoué à l'identique, une
  // valeur d'option prise pour l'argument principal — et les 313 tests sont restés verts.
  //
  // Il lit donc LA SOURCE DE LA COMMANDE, et vérifie que chaque option qu'elle interroge y est
  // déclarée. Une option ajoutée demain sans l'être fait rougir ici, quel que soit le geste.
  const source = readFileSync(new URL('../bin/ligne-directe.js', import.meta.url), 'utf8');
  const employees = new Set(
    [...source.matchAll(/(?:option|optionsRepetees)\(args,\s*'(--[a-z-]+)'\)/g)].map((m) => m[1])
  );
  assert.ok(employees.size >= 6, `la lecture de la source a échoué : ${employees.size} option(s) trouvée(s)`);
  const oubliees = [...employees].filter((o) => !OPTIONS_A_VALEUR.has(o));
  assert.deepEqual(
    oubliees,
    [],
    `option(s) employée(s) par la commande mais absente(s) d’OPTIONS_A_VALEUR : ${oubliees.join(', ')} — ` +
      `leur valeur sera prise pour l’argument principal (le canal, le chantier, le client)`
  );
});

test('optionsRepetees rend TOUTES les valeurs — une liste amputée se paie en silence', async () => {
  const args = ['annonces-agents', '--dirigeant', 'maxime@somtech.ca', '--dirigeant', 'U0123456'];
  assert.deepEqual(optionsRepetees(args, '--dirigeant'), ['maxime@somtech.ca', 'U0123456']);
  assert.deepEqual(option(args, '--dirigeant'), 'maxime@somtech.ca', 'la première seulement, pour comparaison');

  assert.deepEqual(optionsRepetees(['annonces'], '--dirigeant'), [], 'aucune valeur : liste vide, pas [undefined]');
  assert.deepEqual(
    optionsRepetees(['--dirigeant', '--titre', 'x'], '--dirigeant'),
    [],
    'une valeur oubliée ne vaut pas l’option suivante'
  );
  assert.deepEqual(optionsRepetees(['--dirigeant'], '--dirigeant'), [], 'ni la fin de la ligne');
});
