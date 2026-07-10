// Tests end-to-end de la sous-commande `somtech-pack brd project` via run().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../src/cli.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures', 'brd', 'input');

function captureStdout(fn) {
  const orig = process.stdout.write.bind(process.stdout);
  let buf = '';
  process.stdout.write = (chunk) => { buf += chunk; return true; };
  return fn().then((code) => { process.stdout.write = orig; return { code, out: buf }; },
    (e) => { process.stdout.write = orig; throw e; });
}

test('brd project --mode index --file → JSON compact valide, exit 0', async () => {
  const { code, out } = await captureStdout(() => run(['brd', 'project', '--mode', 'index', '--file', join(FIX, 'valid-minimal.md')]));
  assert.equal(code, 0);
  const parsed = JSON.parse(out);
  assert.ok(Array.isArray(parsed.ef));
  assert.equal(parsed.ef[0].id, 'EF-CLI-001');
  assert.ok('md_block_id' in parsed.ef[0]);
  assert.ok(!('description' in parsed.ef[0]), 'index ne doit pas contenir de corps lourd');
  // compact = pas d'indentation multi-lignes dans le corps JSON
  assert.ok(!out.includes('\n  '), 'la sortie index doit être compacte');
});

test('brd project --mode full --file → structure complète indentée, exit 0', async () => {
  const { code, out } = await captureStdout(() => run(['brd', 'project', '--mode', 'full', '--file', join(FIX, 'valid-minimal.md')]));
  assert.equal(code, 0);
  const parsed = JSON.parse(out);
  assert.equal(parsed.requirements.ef[0].id, 'EF-CLI-001');
  assert.ok('teste_par' in parsed.requirements.ef[0], 'full doit contenir les corps complets');
});

test('brd project sur BRD invalide → exit 2 (erreur parser)', async () => {
  const code = await run(['brd', 'project', '--mode', 'full', '--file', join(FIX, 'invalid-priority.md')]);
  assert.equal(code, 2);
});

test('brd project --mode invalide → exit 1', async () => {
  const code = await run(['brd', 'project', '--mode', 'xml', '--file', join(FIX, 'valid-minimal.md')]);
  assert.equal(code, 1);
});

test('brd sans sous-commande → aide, exit 1', async () => {
  const { code } = await captureStdout(() => run(['brd']));
  assert.equal(code, 1);
});

test('brd edit → { block_id, newContent } avec la modif appliquée, exit 0', async () => {
  const { code, out } = await captureStdout(() => run(['brd', 'edit', '--id', 'EF-CLI-001', '--patch', '{"statut":"accepted"}', '--file', join(FIX, 'valid-with-bids.md')]));
  assert.equal(code, 0);
  const res = JSON.parse(out);
  assert.equal(res.block_id, 't-cli-ef');
  assert.equal(res.kind, 'ef');
  assert.match(res.newContent, /EF-CLI-001 \| Première fonction \| accepted/);
  assert.match(res.newContent, /EF-CLI-002 \| Deuxième fonction \| draft/, 'le voisin est préservé');
});

test('brd edit --patch JSON invalide → exit 1', async () => {
  const code = await run(['brd', 'edit', '--id', 'EF-CLI-001', '--patch', 'pas-du-json', '--file', join(FIX, 'valid-with-bids.md')]);
  assert.equal(code, 1);
});

test('brd edit sur exigence sans bid → exit 3 (erreur écriture)', async () => {
  const code = await run(['brd', 'edit', '--id', 'EF-CLI-001', '--patch', '{"statut":"accepted"}', '--file', join(FIX, 'valid-minimal.md')]);
  assert.equal(code, 3);
});
