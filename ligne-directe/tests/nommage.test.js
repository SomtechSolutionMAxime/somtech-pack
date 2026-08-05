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

// —————————————————————————————————————————————————————————————————————————————————
// Le nom du canal vient du TITRE, pas du code.
//
// `#d-20260805-0004` ne dit rien à personne — et devant un client, c'est franchement
// mauvais. Le code ne disparaît pas : il part dans le sujet du canal et le message
// d'ouverture. La traçabilité change de place, elle ne se perd pas.

test('LE CANAL PORTE LE TITRE, pas le code du chantier', async () => {
  const { libelleDeCanal, nomDeCanal } = await import('../src/nommage.js');
  const libelle = libelleDeCanal('D-20260805-0004', 'Ligne directe Slack entre un agent et le dirigeant');
  assert.equal(nomDeCanal(libelle), 'ligne-directe-slack-entre-un-agent-et-le-dirigeant');
});

test('les préfixes de catégorie sont retirés du nom', async () => {
  const { libelleDeCanal } = await import('../src/nommage.js');
  // Utiles dans un registre de tickets, muets dans un nom de canal.
  assert.equal(libelleDeCanal('D-1', '[FEAT] Export des devis en PDF'), 'Export des devis en PDF');
  assert.equal(libelleDeCanal('D-1', '[FIX][URGENT] Calcul des taxes'), 'Calcul des taxes');
});

test('SANS TITRE, on retombe sur le code — jamais d’échec pour un nom', async () => {
  const { libelleDeCanal } = await import('../src/nommage.js');
  // Un nom moche vaut mieux qu'une ligne qui refuse de s'ouvrir.
  assert.equal(libelleDeCanal('D-20260805-0004', ''), 'D-20260805-0004');
  assert.equal(libelleDeCanal('D-20260805-0004', null), 'D-20260805-0004');
  assert.equal(libelleDeCanal('D-20260805-0004', '   '), 'D-20260805-0004');
});

test('un titre qui n’est QUE des préfixes retombe sur le code', async () => {
  const { libelleDeCanal } = await import('../src/nommage.js');
  assert.equal(libelleDeCanal('D-1', '[FEAT]'), 'D-1');
});

test('un titre à rallonge reste un nom de canal valide', async () => {
  const { libelleDeCanal, nomDeCanal } = await import('../src/nommage.js');
  const nom = nomDeCanal(libelleDeCanal('D-1', 'Un titre interminable '.repeat(20)));
  assert.ok(nom.length <= 80, `${nom.length} caractères`);
});
