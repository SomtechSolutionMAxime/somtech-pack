// Tests de l'écriture ciblée (Epic B) : round-trip, préservation, isolation, concurrence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBrd } from '../src/brd/parser.js';
import { serializeTable, applyEdit, assertBlockUnchanged, BRDWriteError } from '../src/brd/write.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures', 'brd', 'input');
const readInput = (name) => readFileSync(join(FIX, `${name}.md`), 'utf8');

/** Ré-encadre un tableau EF sérialisé dans un BRD minimal pour le re-parser. */
function reparseEfTable(tableMd, bid = 'blk-1') {
  const md = [
    '## 4. Exigences d\'affaires (EA)', '',
    '| ID | Énoncé | Statut | Priorité | Owner |',
    '|----|--------|--------|----------|-------|',
    '| EA-GBL-001 | x | in_force | M | S |', '',
    '## 5. Domaines', '',
    '### 5.1 Domaine — Clients (code: CLI)', '',
    '#### Exigences fonctionnelles', '',
    `<!-- bid:${bid} -->`,
    tableMd, '',
    '## 7. Changelog', '',
    '| Version | Date | Demande / Projet | Sponsor validant | Mode | Résumé du changement |',
    '|---------|------|------------------|------------------|------|----------------------|',
    '| 1.0.0 | 2026-07-10 | D-20260710-0009 | Somtech | manuel | init |',
  ].join('\n');
  return parseBrd(md);
}

const stripMeta = (r) => { const { md_block_id, domaine, ...rest } = r; return rest; };

test('round-trip — serializeTable puis re-parse restitue les mêmes rows (EF)', () => {
  const parsed = parseBrd(readInput('valid-minimal'));
  const efRows = parsed.requirements.ef; // 2 rows, même domaine CLI
  const table = serializeTable(efRows, 'ef');
  const back = reparseEfTable(table).requirements.ef;
  assert.deepStrictEqual(back.map(stripMeta), efRows.map(stripMeta));
});

test('round-trip — le pipe échappé survit à serialize→parse', () => {
  const parsed = parseBrd(readInput('valid-with-escaped-pipe'));
  const efRows = parsed.requirements.ef;
  assert.match(efRows[0].description, /--output\|stdout/); // parsé sans échappement
  const table = serializeTable(efRows, 'ef');
  assert.match(table, /--output\\\|stdout/); // ré-échappé dans le markdown
  const back = reparseEfTable(table).requirements.ef;
  assert.equal(back[0].description, efRows[0].description); // identique après round-trip
});

test('applyEdit — modifie la cible ET préserve les voisins du même bloc (B1)', () => {
  // valid-minimal : EF-CLI-001 et EF-CLI-002 partagent le même tableau/bloc.
  const md = readInput('valid-minimal');
  // injecter un marqueur bid avant le tableau EF pour ancrer l'écriture
  const mdWithBid = md.replace('#### Exigences fonctionnelles\n', '#### Exigences fonctionnelles\n\n<!-- bid:ef-cli -->');
  const { block_id, newContent, kind } = applyEdit(mdWithBid, 'EF-CLI-001', { statut: 'accepted' });
  assert.equal(block_id, 'ef-cli');
  assert.equal(kind, 'ef');
  const back = reparseEfTable(newContent, 'ef-cli').requirements.ef;
  assert.equal(back.length, 2, 'le voisin EF-CLI-002 doit être préservé');
  const e1 = back.find((r) => r.id === 'EF-CLI-001');
  const e2 = back.find((r) => r.id === 'EF-CLI-002');
  assert.equal(e1.statut, 'accepted', 'la cible est modifiée');
  assert.equal(e2.statut, 'in_force', 'le voisin est inchangé');
  // les autres champs de la cible sont préservés
  assert.equal(e1.description, 'Afficher la fiche client avec son historique');
  assert.deepStrictEqual(e1.teste_par, ['app/tests/e2e/clients-history.spec.ts']);
});

test('applyEdit — isolation : n\'inclut que le bloc de la cible, pas les autres domaines', () => {
  const md = [
    '## 4. Exigences d\'affaires (EA)', '',
    '| ID | Énoncé | Statut | Priorité | Owner |',
    '|----|--------|--------|----------|-------|',
    '| EA-GBL-001 | x | in_force | M | S |', '',
    '## 5. Domaines', '',
    '### 5.1 Domaine — Clients (code: CLI)', '',
    '#### Exigences fonctionnelles', '',
    '<!-- bid:ef-cli -->',
    '| ID | Description | Statut | Priorité | Couvre | Réalisé par | Testé par | Owner |',
    '|----|-------------|--------|----------|--------|-------------|-----------|-------|',
    '| EF-CLI-001 | Fx clients | in_force | M | EA-GBL-001 |  | t.spec.ts | PO |', '',
    '### 5.2 Domaine — Facturation (code: FAC)', '',
    '#### Exigences fonctionnelles', '',
    '<!-- bid:ef-fac -->',
    '| ID | Description | Statut | Priorité | Couvre | Réalisé par | Testé par | Owner |',
    '|----|-------------|--------|----------|--------|-------------|-----------|-------|',
    '| EF-FAC-001 | Fx factu | proposed | S | EA-GBL-001 |  | t.spec.ts | PO |', '',
    '## 7. Changelog', '',
    '| Version | Date | Demande / Projet | Sponsor validant | Mode | Résumé du changement |',
    '|---------|------|------------------|------------------|------|----------------------|',
    '| 1.0.0 | 2026-07-10 | D-20260710-0009 | Somtech | manuel | init |',
  ].join('\n');
  const { block_id, newContent } = applyEdit(md, 'EF-CLI-001', { statut: 'accepted' });
  assert.equal(block_id, 'ef-cli');
  assert.match(newContent, /EF-CLI-001/);
  assert.doesNotMatch(newContent, /EF-FAC-001/, 'le bloc CLI ne doit pas contenir la FAC');
});

test('applyEdit — refuse si l\'exigence n\'a pas de md_block_id (pas de marqueur bid)', () => {
  const md = readInput('valid-minimal'); // pas de marqueurs bid
  assert.throws(() => applyEdit(md, 'EF-CLI-001', { statut: 'accepted' }), BRDWriteError);
});

test('applyEdit — refuse un patch qui change l\'ID', () => {
  const md = readInput('valid-minimal').replace('#### Exigences fonctionnelles\n', '#### Exigences fonctionnelles\n\n<!-- bid:ef-cli -->');
  assert.throws(() => applyEdit(md, 'EF-CLI-001', { id: 'EF-CLI-999' }), BRDWriteError);
});

test('assertBlockUnchanged — conflit détecté si le bloc a changé entre lecture et écriture (B2)', () => {
  const snap = '<!-- bid:x -->\n| ID | ... |\n| EF-CLI-001 | in_force |';
  // identique (marqueur bid ignoré) → OK
  assert.doesNotThrow(() => assertBlockUnchanged('| ID | ... |\n| EF-CLI-001 | in_force |', snap));
  // divergent → conflit
  assert.throws(() => assertBlockUnchanged('| ID | ... |\n| EF-CLI-001 | accepted |', snap), BRDWriteError);
});
