// Tests de la projection graphe node-link (mode `project --mode graph`, Epic F / G1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph } from '../src/brd/graph.js';
import { run } from '../src/cli.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures', 'brd', 'input');
const readInput = (name) => readFileSync(join(FIX, `${name}.md`), 'utf8');

const CHANGELOG = [
  '## 7. Changelog', '',
  '| Version | Date | Demande / Projet | Sponsor validant | Mode | Résumé du changement |',
  '|---------|------|------------------|------------------|------|----------------------|',
  '| 1.0.0 | 2026-07-10 | D-20260710-0009 | Somtech | manuel | init |',
].join('\n');

function captureStdout(fn) {
  const orig = process.stdout.write.bind(process.stdout);
  let buf = '';
  process.stdout.write = (c) => { buf += c; return true; };
  return fn().then((code) => { process.stdout.write = orig; return { code, out: buf }; },
    (e) => { process.stdout.write = orig; throw e; });
}

const nodesByKind = (g, kind) => g.nodes.filter((n) => n.kind === kind);
const linksByRel = (g, rel) => g.links.filter((l) => l.rel === rel);

test('forme node-link valide (directed, non-multigraphe, clés nodes/links)', () => {
  const g = buildGraph(readInput('valid-two-domains'));
  assert.equal(g.directed, true);
  assert.equal(g.multigraph, false);
  assert.ok(Array.isArray(g.nodes) && Array.isArray(g.links));
  // toute arête pointe vers un nœud existant (pas de nœud fantôme)
  const ids = new Set(g.nodes.map((n) => n.id));
  for (const l of g.links) {
    assert.ok(ids.has(l.source), `source manquante: ${l.source}`);
    assert.ok(ids.has(l.target), `target manquante: ${l.target}`);
  }
});

test('comptes nœuds/arêtes attendus (valid-two-domains)', () => {
  const g = buildGraph(readInput('valid-two-domains'));
  // 1 EA + 2 EF + 2 RA + 1 HS = 6 exigences + 2 domaines (CLI, FAC) = 8 nœuds
  assert.equal(nodesByKind(g, 'ea').length, 1);
  assert.equal(nodesByKind(g, 'ef').length, 2);
  assert.equal(nodesByKind(g, 'ra').length, 2);
  assert.equal(nodesByKind(g, 'hs').length, 1);
  assert.equal(nodesByKind(g, 'domaine').length, 2);
  assert.equal(g.nodes.length, 8);
  // couvre: 2 (EF-CLI-001→EA, EF-FAC-001→EA) ; encadre: 2 ; appartient: 5 (2 ef + 2 ra + 1 hs)
  assert.equal(linksByRel(g, 'couvre').length, 2);
  assert.equal(linksByRel(g, 'encadre').length, 2);
  assert.equal(linksByRel(g, 'appartient').length, 5);
  assert.equal(g.links.length, 9);
  assert.deepStrictEqual(g.graph.domaines, ['CLI', 'FAC']);
  assert.deepStrictEqual(g.graph.dangling_refs, []);
});

test('chaque nœud exigence porte md_block_id ; les EA n\'ont pas d\'arête appartient', () => {
  const g = buildGraph(readInput('valid-with-bids'));
  for (const n of g.nodes.filter((x) => x.kind !== 'domaine')) {
    assert.ok('md_block_id' in n, `${n.id} doit porter md_block_id`);
  }
  // EA globale : aucune arête appartient partant d'une EA
  const eaIds = new Set(nodesByKind(g, 'ea').map((n) => n.id));
  assert.ok(!g.links.some((l) => l.rel === 'appartient' && eaIds.has(l.source)), 'une EA ne doit pas appartenir à un domaine');
});

test('arête de traçabilité correcte (EF couvre EA, RA encadre EF)', () => {
  const g = buildGraph(readInput('valid-two-domains'));
  assert.ok(g.links.some((l) => l.source === 'EF-CLI-001' && l.target === 'EA-GBL-001' && l.rel === 'couvre'));
  assert.ok(g.links.some((l) => l.source === 'RA-CLI-001' && l.target === 'EF-CLI-001' && l.rel === 'encadre'));
  assert.ok(g.links.some((l) => l.source === 'EF-FAC-001' && l.target === 'domaine:FAC' && l.rel === 'appartient'));
});

test('référence cassée → graph.dangling_refs, PAS de nœud fantôme ni d\'arête', () => {
  const md = [
    '## 4. Exigences d\'affaires (EA)', '',
    '| ID | Énoncé | Statut | Priorité | Owner |',
    '|----|--------|--------|----------|-------|',
    '| EA-GBL-001 | x | in_force | M | S |', '',
    '## 5. Domaines', '',
    '### 5.1 Domaine — Clients (code: CLI)', '',
    '#### Exigences fonctionnelles', '',
    '| ID | Description | Statut | Priorité | Couvre | Réalisé par | Testé par | Owner |',
    '|----|-------------|--------|----------|--------|-------------|-----------|-------|',
    '| EF-CLI-001 | ok | in_force | M | EA-GBL-999 |  | t.spec.ts | PO |', // couvre une EA inexistante
    '', CHANGELOG,
  ].join('\n');
  const g = buildGraph(md);
  assert.equal(g.links.filter((l) => l.rel === 'couvre').length, 0, 'aucune arête couvre vers une cible absente');
  assert.ok(!g.nodes.some((n) => n.id === 'EA-GBL-999'), 'pas de nœud fantôme');
  assert.deepStrictEqual(g.graph.dangling_refs, [{ from: 'EF-CLI-001', rel: 'couvre', missing: 'EA-GBL-999' }]);
});

test('mutation — retirer un couvre du source change le compte d\'arêtes (le test attrape un vrai bug)', () => {
  const withCouvre = readInput('valid-two-domains');
  const withoutCouvre = withCouvre.replace('| EF-CLI-001 | Fonction du domaine Clients | in_force | M | EA-GBL-001 |', '| EF-CLI-001 | Fonction du domaine Clients | in_force | M |  |');
  const g1 = buildGraph(withCouvre);
  const g2 = buildGraph(withoutCouvre);
  assert.equal(linksByRel(g1, 'couvre').length - linksByRel(g2, 'couvre').length, 1, 'le graphe doit refléter la donnée : 1 couvre en moins');
});

test('CLI — brd project --mode graph → node-link compact, exit 0', async () => {
  const { code, out } = await captureStdout(() => run(['brd', 'project', '--mode', 'graph', '--file', join(FIX, 'valid-two-domains.md')]));
  assert.equal(code, 0);
  const g = JSON.parse(out);
  assert.equal(g.directed, true);
  assert.equal(g.nodes.length, 8);
  assert.ok(!out.includes('\n  '), 'la sortie graph doit être compacte');
});
