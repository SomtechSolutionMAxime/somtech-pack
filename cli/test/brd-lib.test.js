// Tests de la lib publique @somtech-solutions/pack/brd (Epic C — réutilisation Orbit).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as lib from '../src/brd/index.js';
import { run } from '../src/cli.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures', 'brd', 'input');
const readInput = (name) => readFileSync(join(FIX, `${name}.md`), 'utf8');

function captureStdout(fn) {
  const orig = process.stdout.write.bind(process.stdout);
  let buf = '';
  process.stdout.write = (c) => { buf += c; return true; };
  return fn().then((code) => { process.stdout.write = orig; return { code, out: buf }; },
    (e) => { process.stdout.write = orig; throw e; });
}

test('la lib expose l\'API publique attendue', () => {
  for (const fn of ['parseBrd', 'projectIndex', 'projectFull', 'applyEdit', 'assertBlockUnchanged', 'serializeTable', 'toJson', 'toCompactJson']) {
    assert.equal(typeof lib[fn], 'function', `${fn} doit être exporté`);
  }
});

test('parité lib ↔ CLI — projectIndex identique à `brd project --mode index`', async () => {
  const md = readInput('valid-minimal');
  const viaLib = lib.projectIndex(md);
  const { out } = await captureStdout(() => run(['brd', 'project', '--mode', 'index', '--file', join(FIX, 'valid-minimal.md')]));
  assert.deepStrictEqual(viaLib, JSON.parse(out));
});

test('parité lib ↔ CLI — applyEdit identique à `brd edit`', async () => {
  const md = readInput('valid-with-bids');
  const viaLib = lib.applyEdit(md, 'EF-CLI-001', { statut: 'accepted' });
  const { out } = await captureStdout(() => run(['brd', 'edit', '--id', 'EF-CLI-001', '--patch', '{"statut":"accepted"}', '--file', join(FIX, 'valid-with-bids.md')]));
  assert.deepStrictEqual(viaLib, JSON.parse(out));
});

test('garde-fou anti-cache côté appelant — un index caché puis réutilisé après réécriture intercalée est rejeté', () => {
  // Scénario Orbit : l'agent lit le bloc (snapshot), un AUTRE agent le réécrit, puis le 1er tente
  // d'écrire sur la base de son snapshot périmé. assertBlockUnchanged doit signaler le conflit.
  const md = readInput('valid-with-bids');
  const snapshot = lib.applyEdit(md, 'EF-CLI-001', {}).newContent; // état lu par l'agent 1
  // agent 2 réécrit le bloc entre-temps
  const intercalated = lib.applyEdit(md, 'EF-CLI-001', { statut: 'accepted' }).newContent;
  // agent 1 relit juste avant d'écrire → détecte la divergence
  assert.throws(() => lib.assertBlockUnchanged(intercalated, snapshot), lib.BRDWriteError);
  // si rien n'a bougé, pas de conflit
  assert.doesNotThrow(() => lib.assertBlockUnchanged(snapshot, snapshot));
});
