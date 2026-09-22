'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const { validateConfig, VALID_AUTH_MODES } = require(
  path.join('..', '..', 'src', 'config.js')
);

test('config minimale recoit ses defauts (public, ttl 60, port 8080)', () => {
  const config = validateConfig({});
  assert.equal(config.auth.mode, 'public');
  assert.equal(config.ttl_seconds, 60);
  assert.equal(config.port, 8080);
  assert.deepEqual(config.agents, []);
});

test('les trois modes valides passent', () => {
  for (const mode of VALID_AUTH_MODES) {
    const authField = mode === 'bearer' ? { mode, api_key_env: 'DISCOVERY_API_KEY' } : { mode };
    assert.doesNotThrow(() => validateConfig({ auth: authField }));
  }
});

test('un mode inconnu leve — STD-032 SS2.5 n en definit que trois', () => {
  assert.throws(
    () => validateConfig({ auth: { mode: 'yolo' } }),
    /auth\.mode invalide/
  );
});

test('bearer sans api_key_env leve', () => {
  assert.throws(() => validateConfig({ auth: { mode: 'bearer' } }), /exige auth\.api_key_env/);
});

test('network combine avec api_key_env leve — SS2.5 "network ne se combine pas avec bearer"', () => {
  assert.throws(
    () => validateConfig({ auth: { mode: 'network', api_key_env: 'X' } }),
    /ne se combine pas/
  );
});
