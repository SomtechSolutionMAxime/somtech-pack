// Tests de parité sémantique du parser BRD (port Python→TS).
// Parité = comparaison APRÈS re-parse (goldens JSON générés depuis extract-brd-yaml.py), PAS byte-à-byte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBrd, BRDParseError } from '../src/brd/parser.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures', 'brd');
const readInput = (name) => readFileSync(join(FIX, 'input', `${name}.md`), 'utf8');
const readGolden = (name) => JSON.parse(readFileSync(join(FIX, 'golden', `${name}.json`), 'utf8'));

/** Retire récursivement md_block_id (absent des goldens Python) pour comparer la sémantique pure. */
function stripBlockIds(node) {
  if (Array.isArray(node)) return node.map(stripBlockIds);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === 'md_block_id') continue;
      out[k] = stripBlockIds(v);
    }
    return out;
  }
  return node;
}

const VALID_GOLDENS = ['valid-minimal', 'valid-with-escaped-pipe', 'valid-warning-in-force-no-test', 'valid-two-domains'];

for (const name of VALID_GOLDENS) {
  test(`parité sémantique — ${name}`, () => {
    const parsed = parseBrd(readInput(name));
    assert.deepStrictEqual(stripBlockIds(parsed), readGolden(name));
  });
}

test('parité multi-domaines — chaque row porte son domaine et l\'accumulation extend fonctionne', () => {
  const parsed = parseBrd(readInput('valid-two-domains'));
  assert.equal(parsed.requirements.ef.length, 2);
  assert.deepStrictEqual(parsed.requirements.ef.map((r) => r.domaine), ['CLI', 'FAC']);
  assert.deepStrictEqual(parsed.requirements.ra.map((r) => r.domaine), ['CLI', 'FAC']);
  assert.equal(parsed.out_of_scope[0].domaine, 'FAC');
});

test('sensibilité à la mutation — une divergence sémantique casse la comparaison (le test teste bien qqch)', () => {
  const golden = readGolden('valid-minimal');
  const parsed = stripBlockIds(parseBrd(readInput('valid-minimal')));
  // sanity : sans mutation, c'est égal
  assert.deepStrictEqual(parsed, golden);
  // mutation type "bug de port" : inversion couvre/encadre sémantique
  const mutated = structuredClone(parsed);
  mutated.requirements.ef[0].couvre = ['WRONG-XXX-999'];
  assert.notDeepStrictEqual(mutated, golden);
  // mutation : oubli du champ domaine (bug fréquent du port)
  const mutated2 = structuredClone(parsed);
  delete mutated2.requirements.ef[0].domaine;
  assert.notDeepStrictEqual(mutated2, golden);
});

test('pipe échappé — le `\\|` littéral est restauré dans la cellule', () => {
  const parsed = parseBrd(readInput('valid-with-escaped-pipe'));
  assert.match(parsed.requirements.ea[0].enonce, /pipe \| échappé/);
  assert.match(parsed.requirements.ef[0].description, /--output\|stdout/);
});

// Cas invalides que le PARSER doit rejeter (throw), avec le numéro de ligne 1-based attendu.
const PARSER_ERRORS = [
  ['invalid-domain-id-mismatch', 11],
  ['invalid-header-order', 5],
  ['invalid-id-format', 7],
  ['invalid-list-no-space', 18],
  ['invalid-no-sections', null],
  ['invalid-priority', 7],
  ['invalid-status', 7],
  ['invalid-ticket-format', 17],
  ['invalid-trailing-comma', 18],
];

for (const [name, lineNo] of PARSER_ERRORS) {
  test(`rejet parser — ${name}`, () => {
    assert.throws(() => parseBrd(readInput(name)), (err) => {
      assert.ok(err instanceof BRDParseError, `attendu BRDParseError, reçu ${err.name}`);
      if (lineNo !== null) assert.equal(err.lineNo, lineNo, `n° ligne attendu ${lineNo}, reçu ${err.lineNo}`);
      return true;
    });
  });
}

// Les invalid-cross-* sont des erreurs SÉMANTIQUES (validateur, non porté ici) — le parser les accepte.
const CROSS = ['invalid-cross-bad-date', 'invalid-cross-couvre-broken', 'invalid-cross-duplicate-id'];
for (const name of CROSS) {
  test(`parser accepte (validation sémantique hors parser) — ${name}`, () => {
    assert.doesNotThrow(() => parseBrd(readInput(name)));
  });
}

test('md_block_id — chaque exigence porte le block_id du tableau qui la contient', () => {
  const md = [
    '<!-- bid:heading-4 -->',
    '## 4. Exigences d\'affaires (EA)',
    '',
    '<!-- bid:table-ea -->',
    '| ID | Énoncé | Statut | Priorité | Owner |',
    '|----|--------|--------|----------|-------|',
    '| EA-GBL-001 | Enjeu | in_force | M | Sponsor |',
    '',
    '## 5. Domaines',
    '',
    '### 5.1 Domaine — Clients (code: CLI)',
    '',
    '#### Exigences fonctionnelles',
    '',
    '<!-- bid:table-ef -->',
    '| ID | Description | Statut | Priorité | Couvre | Réalisé par | Testé par | Owner |',
    '|----|-------------|--------|----------|--------|-------------|-----------|-------|',
    '| EF-CLI-001 | Fx | in_force | M | EA-GBL-001 |  | t.spec.ts | PO |',
    '',
    '## 7. Changelog',
    '',
    '<!-- bid:table-cl -->',
    '| Version | Date | Demande / Projet | Sponsor validant | Mode | Résumé du changement |',
    '|---------|------|------------------|------------------|------|----------------------|',
    '| 1.0.0 | 2026-07-10 | D-20260710-0009 | Somtech | manuel | init |',
  ].join('\n');
  const parsed = parseBrd(md);
  assert.equal(parsed.requirements.ea[0].md_block_id, 'table-ea');
  assert.equal(parsed.requirements.ef[0].md_block_id, 'table-ef');
  assert.equal(parsed.changelog[0].md_block_id, 'table-cl');
});

test('md_block_id — null quand aucun marqueur bid ne précède le tableau (fixtures Python)', () => {
  const parsed = parseBrd(readInput('valid-minimal'));
  assert.equal(parsed.requirements.ea[0].md_block_id, null);
});
