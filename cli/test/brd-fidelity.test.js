// Tests de non-régression issus de la revue de code indépendante (2026-07-10) :
// fidélité au parser Python + anti-corruption silencieuse de l'écriture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBrd, BRDParseError } from '../src/brd/parser.js';
import { applyEdit, serializeTable, BRDWriteError } from '../src/brd/write.js';

const CHANGELOG = [
  '## 7. Changelog', '',
  '| Version | Date | Demande / Projet | Sponsor validant | Mode | Résumé du changement |',
  '|---------|------|------------------|------------------|------|----------------------|',
  '| 1.0.0 | 2026-07-10 | D-20260710-0009 | Somtech | manuel | init |',
].join('\n');

test('fidélité — séparateur avec un nombre de colonnes ≠ en-tête est rejeté (comme Python)', () => {
  const md = [
    '## 4. Exigences d\'affaires (EA)', '',
    '| ID | Énoncé | Statut | Priorité | Owner |',
    '|----|--------|', // 2 colonnes de séparateur pour un en-tête à 5
    '| EA-GBL-001 | x | in_force | M | S |', '',
    CHANGELOG,
  ].join('\n');
  assert.throws(() => parseBrd(md), (e) => e instanceof BRDParseError && /[Ss]éparateur/.test(e.message));
});

test('fidélité — séparateur indenté est rejeté (match brut, comme Python)', () => {
  const md = [
    '## 4. Exigences d\'affaires (EA)', '',
    '| ID | Énoncé | Statut | Priorité | Owner |',
    '  |----|--------|--------|----------|-------|', // indenté
    '| EA-GBL-001 | x | in_force | M | S |', '',
    CHANGELOG,
  ].join('\n');
  assert.throws(() => parseBrd(md), BRDParseError);
});

test('fidélité — un séparateur de ligne Unicode (U+2028) dans une cellule casse la ligne (comme splitlines)', () => {
  const md = [
    '## 4. Exigences d\'affaires (EA)', '',
    '| ID | Énoncé | Statut | Priorité | Owner |',
    '|----|--------|--------|----------|-------|',
    '| EA-GBL-001 | avant après | in_force | M | S |', '',
    CHANGELOG,
  ].join('\n');
  // La ligne est coupée en deux → compte de cellules incohérent → rejet (pas d'ingestion silencieuse).
  assert.throws(() => parseBrd(md), BRDParseError);
});

test('anti-corruption — un patch contenant un saut de ligne est rejeté (pas de bloc corrompu)', () => {
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
    '| EF-CLI-001 | ok | draft | M | EA-GBL-001 |  | t.spec.ts | PO |', '',
    CHANGELOG,
  ].join('\n');
  // \n injecté dans une valeur scalaire → doit lever, JAMAIS produire un newContent multi-ligne.
  assert.throws(() => applyEdit(md, 'EF-CLI-001', { description: 'avant\nAPRES | x | y' }), BRDWriteError);
  // idempotence : sans saut de ligne, ça passe et reste une seule ligne de données
  const { newContent } = applyEdit(md, 'EF-CLI-001', { description: 'nouvelle desc' });
  assert.equal(newContent.split('\n').filter((l) => l.startsWith('| EF-CLI-001')).length, 1);
});

test('anti-corruption — serializeTable rejette une valeur multi-ligne', () => {
  assert.throws(() => serializeTable([{ id: 'EA-GBL-001', enonce: 'a\nb', statut: 'draft', priorite: 'M', owner: 'x' }], 'ea'), BRDWriteError);
});
