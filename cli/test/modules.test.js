// Portée d'un module : poste vs projet.
//
// Le canvas est un OUTIL : une copie par machine suffit, et un dépôt client n'a pas à
// porter 8 Mo d'outillage interne (décision T-20260724-0018). Il doit néanmoins être
// déclaré comme module, car la construction du paquet n'embarque que les chemins des
// modules déclarés. `default: false` ne suffit donc pas : il empêche l'installation par
// défaut, pas l'installation sur demande — `init --modules canvas` déposait bien les
// 189 fichiers du canvas dans un dépôt client.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readManifest, resolveModules, defaultModules } from '../src/modules.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('portée : un module réservé au poste est refusé à l\'installation projet', () => {
  const manifest = {
    modules: {
      core: { default: true, paths: ['.claude/'] },
      canvas: { default: false, scope: 'poste', paths: ['herdr-plugins/'] },
    },
  };
  assert.throws(
    () => resolveModules(manifest, ['core', 'canvas']),
    /canvas/,
    'demander explicitement un module de poste doit échouer'
  );
  assert.doesNotThrow(() => resolveModules(manifest, ['core']), 'les autres modules restent installables');
});

test('portée : le refus explique pourquoi et où aller', () => {
  const manifest = { modules: { canvas: { default: false, scope: 'poste', paths: ['herdr-plugins/'] } } };
  assert.throws(() => resolveModules(manifest, ['canvas']), (err) => {
    assert.match(err.message, /poste/i, 'le message doit nommer la portée');
    assert.match(err.message, /setup/, 'le message doit indiquer par où passer');
    return true;
  });
});

test('portée : le canvas du vrai pack.json est réservé au poste', () => {
  const manifest = readManifest(REPO);
  assert.equal(
    manifest.modules.canvas?.scope,
    'poste',
    'sans scope: poste, un init --modules canvas dépose 8 Mo d\'outillage dans un dépôt client'
  );
  assert.throws(() => resolveModules(manifest, ['canvas']), /poste/i);
});

test('portée : un module de poste reste déclaré, mais hors des modules par défaut', () => {
  const manifest = readManifest(REPO);
  assert.ok(!defaultModules(manifest).includes('canvas'), 'le canvas ne doit pas être installé par défaut');
  // …mais il reste déclaré, sinon la construction du paquet ne l'embarquerait pas.
  assert.ok(Object.keys(manifest.modules).includes('canvas'), 'le canvas doit rester un module déclaré');
});
