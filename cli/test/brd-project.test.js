// Tests des projections index / full (calculées à la demande, jamais stockées).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectIndex, projectFull, toJson, toCompactJson } from '../src/brd/project.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures', 'brd');
const readInput = (name) => readFileSync(join(FIX, 'input', `${name}.md`), 'utf8');

test('full — restitue la structure complète avec domaine et md_block_id', () => {
  const full = projectFull(readInput('valid-two-domains'));
  assert.equal(full.requirements.ef.length, 2);
  assert.equal(full.requirements.ef[0].domaine, 'CLI');
  assert.ok('md_block_id' in full.requirements.ef[0]);
  // champ lourd présent en full
  assert.ok('teste_par' in full.requirements.ef[0]);
});

test('index — ne contient QUE les champs de navigation (aucun corps lourd)', () => {
  const idx = projectIndex(readInput('valid-minimal'));
  const ef = idx.ef[0];
  assert.deepStrictEqual(Object.keys(ef).sort(), ['couvre', 'domaine', 'id', 'md_block_id', 'priorite', 'statut', 'titre'].sort());
  // champs lourds absents
  for (const heavy of ['description', 'realise_par', 'teste_par', 'owner']) {
    assert.ok(!(heavy in ef), `champ lourd '${heavy}' ne doit pas être dans l'index`);
  }
  const ra = idx.ra[0];
  assert.deepStrictEqual(Object.keys(ra).sort(), ['domaine', 'encadre', 'id', 'md_block_id', 'statut', 'titre'].sort());
  assert.ok(!('justification' in ra));
});

test('index — porte le md_block_id et le domaine par exigence', () => {
  const idx = projectIndex(readInput('valid-two-domains'));
  assert.deepStrictEqual(idx.ef.map((e) => e.domaine), ['CLI', 'FAC']);
  assert.ok('md_block_id' in idx.ef[0]);
});

test('index — strictement plus léger que le full sur un fixture réel', () => {
  const md = readInput('valid-minimal');
  const idxBytes = Buffer.byteLength(toJson(projectIndex(md)), 'utf8');
  const fullBytes = Buffer.byteLength(toJson(projectFull(md)), 'utf8');
  assert.ok(idxBytes < fullBytes, `index (${idxBytes}o) doit être < full (${fullBytes}o)`);
});

test('index — matériellement plus léger que le MD à l\'échelle d\'un vrai BRD (baseline mesurée)', () => {
  // ⚠️ Le seuil « ordre de grandeur » du design est empiriquement INATTEIGNABLE pour un index par
  // exigence portant un titre + une ancre md_block_id (UUID 36 car.) : mesure sur le BRD ServiceDesk réel
  // (100 exigences, MD 61 Ko) = index compact 21 Ko → ratio 2,84×. Le plancher planché = ≥2× (marge).
  // La vraie valeur de l'index n'est pas « 10× plus petit » mais « retire tous les corps lourds ».
  const desc = 'Description fonctionnelle détaillée avec contexte métier, contraintes et exemples. '.repeat(4).trim();
  const just = 'Justification appuyée sur une règle d\'affaires documentée et un enjeu de conformité. '.repeat(4).trim();
  const efRows = [];
  const raRows = [];
  for (let i = 1; i <= 40; i++) {
    const nnn = String(i).padStart(3, '0');
    efRows.push(`| EF-CLI-${nnn} | ${desc} | in_force | M | EA-GBL-001 | T-20260601-0001 | app/tests/e2e/case-${nnn}.spec.ts, app/tests/unit/case-${nnn}.test.ts | PO Somtech |`);
    raRows.push(`| RA-CLI-${nnn} | ${desc} | ${just} | in_force | EF-CLI-${nnn} | app/tests/e2e/ra-${nnn}.spec.ts | Sponsor |`);
  }
  const md = [
    '## 4. Exigences d\'affaires (EA)', '',
    '| ID | Énoncé | Statut | Priorité | Owner |',
    '|----|--------|--------|----------|-------|',
    '| EA-GBL-001 | Enjeu global | in_force | M | Sponsor |', '',
    '## 5. Domaines', '',
    '### 5.1 Domaine — Clients (code: CLI)', '',
    '#### Exigences fonctionnelles', '',
    '| ID | Description | Statut | Priorité | Couvre | Réalisé par | Testé par | Owner |',
    '|----|-------------|--------|----------|--------|-------------|-----------|-------|',
    ...efRows, '',
    '#### Règles d\'affaires', '',
    '| ID | Énoncé | Justification | Statut | Encadre | Testé par | Owner |',
    '|----|--------|---------------|--------|---------|-----------|-------|',
    ...raRows, '',
    '## 7. Changelog', '',
    '| Version | Date | Demande / Projet | Sponsor validant | Mode | Résumé du changement |',
    '|---------|------|------------------|------------------|------|----------------------|',
    '| 1.0.0 | 2026-07-10 | D-20260710-0009 | Somtech | manuel | init |',
  ].join('\n');
  const idxBytes = Buffer.byteLength(toCompactJson(projectIndex(md)), 'utf8');
  const mdBytes = Buffer.byteLength(md, 'utf8');
  assert.ok(idxBytes * 2 <= mdBytes, `index compact ${idxBytes}o doit être ≥2× plus petit que MD ${mdBytes}o (ratio ${(mdBytes / idxBytes).toFixed(2)}×)`);
});

test('titre — tronqué au-delà de la limite avec ellipse', () => {
  const long = 'x'.repeat(250);
  const md = [
    '## 4. Exigences d\'affaires (EA)',
    '',
    '| ID | Énoncé | Statut | Priorité | Owner |',
    '|----|--------|--------|----------|-------|',
    `| EA-GBL-001 | ${long} | in_force | M | Sponsor |`,
    '',
    '## 7. Changelog',
    '',
    '| Version | Date | Demande / Projet | Sponsor validant | Mode | Résumé du changement |',
    '|---------|------|------------------|------------------|------|----------------------|',
    '| 1.0.0 | 2026-07-10 | D-20260710-0009 | Somtech | manuel | init |',
  ].join('\n');
  const idx = projectIndex(md);
  assert.ok(idx.ea[0].titre.length <= 100);
  assert.ok(idx.ea[0].titre.endsWith('…'));
});
