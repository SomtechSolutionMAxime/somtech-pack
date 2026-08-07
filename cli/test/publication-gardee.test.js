// Garde-fou : seule une poussée de tag peut atteindre le registre.
//
// `publish.yml` tourne désormais AUSSI hors tag — sur les PR qui touchent ce
// qui est publié, et à la main — pour que la chaîne de publication soit
// éprouvée avant qu'on tague, et pas au moment où on tague (un tag ne se
// rejoue pas ; c'est ce qui a laissé v1.29.1 partir vers un échec invisible).
//
// Ce chemin nouveau ouvre un risque qui n'existait pas : une PR qui publie.
// Ces tests l'interdisent — le vrai `npm publish` reste gardé, et le passage à
// blanc reste réservé au reste.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLISH = join(resolve(HERE, '..', '..'), '.github', 'workflows', 'publish.yml');
const yml = readFileSync(PUBLISH, 'utf8');

// Découpe le fichier en steps : chaque bloc commence à un « - name: » et court
// jusqu'au suivant. Suffisant ici, et sans dépendance (le CLI n'en a aucune).
const steps = yml
  .split(/^ {6}- name:/m)
  .slice(1)
  .map((bloc) => ({ nom: bloc.split('\n')[0].trim(), corps: bloc }));

const stepQuiLance = (commande) => steps.filter(
  (s) => new RegExp(`^\\s*run:\\s*${commande}\\s*$`, 'm').test(s.corps),
);

test('la publication réelle est gardée par un tag poussé', () => {
  const vrais = stepQuiLance('npm publish');
  assert.equal(vrais.length, 1, 'exactement un step doit lancer le vrai « npm publish »');

  assert.match(
    vrais[0].corps,
    /^\s*if:\s*env\.RELEASE == 'true'\s*$/m,
    `Le step « ${vrais[0].nom} » écrit au registre sans être gardé par env.RELEASE. `
      + 'Depuis que publish.yml tourne aussi sur les PR, un step non gardé publierait '
      + 'depuis une branche en revue.',
  );
});

test('RELEASE ne vaut vrai que pour une poussée de tag', () => {
  const m = yml.match(/^\s*RELEASE:\s*(.+)$/m);
  assert.ok(m, 'publish.yml doit définir env.RELEASE au niveau du job');

  assert.equal(
    m[1].trim(),
    "${{ github.event_name == 'push' && github.ref_type == 'tag' }}",
    'RELEASE doit exiger LES DEUX : un évènement push ET un ref de type tag. '
      + 'Le seul ref_type suffirait à publier depuis un workflow_dispatch lancé sur un tag.',
  );
});

test('le passage à blanc couvre tout ce qui n’est pas un tag', () => {
  const blancs = stepQuiLance('npm publish --dry-run');
  assert.equal(blancs.length, 1, 'exactement un step doit lancer le « npm publish --dry-run »');

  assert.match(
    blancs[0].corps,
    /^\s*if:\s*env\.RELEASE != 'true'\s*$/m,
    `Le step « ${blancs[0].nom} » doit couvrir exactement le complément du vrai publish, `
      + 'sinon la chaîne s’arrête avant sa dernière marche et ne prouve plus rien.',
  );
});

test('publish.yml se déclenche hors tag — sinon la chaîne n’est éprouvée qu’au tag', () => {
  const entete = yml.slice(0, yml.indexOf('\njobs:'));
  for (const declencheur of ['pull_request:', 'workflow_dispatch:']) {
    assert.ok(
      new RegExp(`^\\s*${declencheur}`, 'm').test(entete),
      `publish.yml doit accepter « ${declencheur} » : sans lui, la publication n'est `
        + 'essayée pour la première fois qu\'au moment où on tague, et un tag ne se rejoue pas.',
    );
  }
});
