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

import { option, optionsRepetees, premierLibre, OPTIONS_A_VALEUR } from '../src/arguments.js';

test('premierLibre saute les VALEURS d’options — le défaut d’origine', async () => {
  assert.equal(premierLibre(['--inviter', 'maxime@somtech.ca', 'D-1']), 'D-1');
  assert.equal(premierLibre(['annonces-agents', '--dirigeant', 'maxime@somtech.ca']), 'annonces-agents');
  // Celui-ci est le cas du geste `commun` tapé dans l'autre ordre : sans `--dirigeant` dans
  // les options à valeur, le canal désigné serait l'adresse courriel du dirigeant.
  assert.equal(premierLibre(['--dirigeant', 'maxime@somtech.ca', 'annonces-agents']), 'annonces-agents');
  assert.equal(premierLibre(['--sans-archiver']), null, 'un drapeau seul ne laisse aucun argument libre');
});

test('toute option à valeur est déclarée — sinon sa valeur devient l’argument principal', async () => {
  // Garde de COMPTE, pas de présence : une option ajoutée demain sans être déclarée ici fait
  // rougir, au lieu de faire nommer un canal d'après un titre ou un chemin de dépôt.
  assert.deepEqual(
    [...OPTIONS_A_VALEUR].sort(),
    ['--bilan', '--canal', '--depot', '--dirigeant', '--inviter', '--nature', '--sujet', '--titre']
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
