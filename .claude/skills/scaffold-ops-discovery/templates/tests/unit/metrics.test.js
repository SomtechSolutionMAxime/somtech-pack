'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const {
  createMetricsRegistry,
  COUNTER_NAMES,
} = require(path.join('..', '..', 'src', 'metrics.js'));

test('toutes les metriques STD-032 SS2.8 sont exposees, initialisees a 0', () => {
  const registry = createMetricsRegistry();
  const rendered = registry.render();

  for (const name of COUNTER_NAMES) {
    assert.match(rendered, new RegExp(`^${name} 0$`, 'm'));
    assert.match(rendered, new RegExp(`# TYPE ${name} gauge`));
  }
  assert.match(rendered, /^pull_duration_ms 0$/m);
});

test('set() change la valeur rendue', () => {
  const registry = createMetricsRegistry();
  registry.set('agents_total', 3);
  registry.set('agents_online', 2);

  const rendered = registry.render();
  assert.match(rendered, /^agents_total 3$/m);
  assert.match(rendered, /^agents_online 2$/m);
  // Une metrique non touchee reste a 0 — set() ne doit pas en affecter d'autres.
  assert.match(rendered, /^agents_offline 0$/m);
});

test('set() sur une metrique inconnue leve — pas de faux-positif silencieux', () => {
  const registry = createMetricsRegistry();
  assert.throws(() => registry.set('metrique_inexistante', 1));
});
