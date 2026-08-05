import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normaliserNom, nomDeCanal, visageDe } from '../src/nommage.js';

test('un code de chantier devient un nom de canal en minuscules', () => {
  assert.equal(normaliserNom('D-20260805-0004'), 'd-20260805-0004');
});

test('les accents sont dépliés, pas supprimés', () => {
  // Le piège : une suppression naïve des non-ASCII donnerait « clture », illisible.
  assert.equal(normaliserNom('Clôture du chantier'), 'cloture-du-chantier');
  assert.equal(normaliserNom('Épic à réviser'), 'epic-a-reviser');
});

test('un libellé qui ne laisse aucun caractère valide reste nommable', () => {
  assert.equal(normaliserNom('###'), 'ligne');
  assert.equal(normaliserNom(''), 'ligne');
});

test('un nom trop long est coupé à la limite de Slack', () => {
  assert.equal(normaliserNom('a'.repeat(200)).length, 80);
});

test("DEUX WORKTREES DU MÊME DÉPÔT : le second chantier n'écrase pas le canal du premier", () => {
  // Le cas nominal du parallélisme Somtech — claude-swt crée N copies de travail du même
  // dépôt. Sans suffixe, les deux agents partageraient un canal et le dirigeant parlerait
  // au mauvais.
  const pris = new Set(['d-20260805-0004']);
  const second = nomDeCanal('D-20260805-0004', (n) => pris.has(n));
  assert.equal(second, 'd-20260805-0004-2');
  pris.add(second);
  assert.equal(nomDeCanal('D-20260805-0004', (n) => pris.has(n)), 'd-20260805-0004-3');
});

test('le suffixe de collision ne fait jamais dépasser la limite de Slack', () => {
  const long = 'x'.repeat(80);
  const nom = nomDeCanal(long, (n) => n === 'x'.repeat(80));
  assert.ok(nom.length <= 80, `${nom.length} caractères`);
  assert.ok(nom.endsWith('-2'));
});

test('le visage d’un chantier est stable', () => {
  assert.equal(visageDe('D-20260805-0004'), visageDe('d-20260805-0004'));
  assert.notEqual(visageDe('D-20260805-0004'), '');
});
