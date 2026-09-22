// Test du parseur YAML minimal (src/yaml-lite.js) — sous-ensemble volontairement
// restreint : scalaires top-level, un niveau d'imbrication, listes d'objets plats.
// Rouge avant vert : ce test echoue tant que yaml-lite.js n'existe pas.
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const { parseYamlLite } = require(path.join('..', '..', 'src', 'yaml-lite.js'));

test('scalaires top-level et imbrication a un niveau', () => {
  const yaml = [
    'department:',
    '  name: "dept-ia-test"',
    '  organization: "Test Org"',
    'ttl_seconds: 60',
    'port: 8080',
  ].join('\n');

  const parsed = parseYamlLite(yaml);

  assert.deepEqual(parsed, {
    department: { name: 'dept-ia-test', organization: 'Test Org' },
    ttl_seconds: 60,
    port: 8080,
  });
});

test('auth.mode et les trois valeurs enum valides', () => {
  for (const mode of ['public', 'bearer', 'network']) {
    const yaml = `auth:\n  mode: "${mode}"\n  api_key_env: "DISCOVERY_API_KEY"`;
    const parsed = parseYamlLite(yaml);
    assert.equal(parsed.auth.mode, mode);
    assert.equal(parsed.auth.api_key_env, 'DISCOVERY_API_KEY');
  }
});

test('liste d objets plats sous une cle (agents statiques, mecanisme #1 STD-032 SS2.10)', () => {
  const yaml = [
    'agents:',
    '  - name: ing-curateur-architecture',
    '    sector: ing',
    '    url: https://ing-curateur-architecture.dept-ia-test.somtech.ca',
    '  - name: ops-pm',
    '    sector: ops',
  ].join('\n');

  const parsed = parseYamlLite(yaml);

  assert.deepEqual(parsed.agents, [
    { name: 'ing-curateur-architecture', sector: 'ing', url: 'https://ing-curateur-architecture.dept-ia-test.somtech.ca' },
    { name: 'ops-pm', sector: 'ops' },
  ]);
});

test('item de liste avec un mapping imbrique (extensions.somtech, SS2.4, REJET revue de fond T-20260922-0062)', () => {
  const yaml = [
    'agents:',
    '  - name: nicolet',
    '    sector: ops',
    '    extensions:',
    '      somtech:',
    '        mandate: "P-20260601-0094"',
    '        repo: "org/repo"',
  ].join('\n');

  const parsed = parseYamlLite(yaml);

  assert.deepEqual(parsed.agents, [
    {
      name: 'nicolet',
      sector: 'ops',
      extensions: { somtech: { mandate: 'P-20260601-0094', repo: 'org/repo' } },
    },
  ]);
});

test('liste vide (agents: []) reste une liste vide, jamais absente', () => {
  const parsed = parseYamlLite('agents: []');
  assert.deepEqual(parsed.agents, []);
});

test('cle absente du texte est absente du resultat — pas de valeur inventee', () => {
  const parsed = parseYamlLite('port: 8080');
  assert.equal('auth' in parsed, false);
  assert.equal('agents' in parsed, false);
});

test('commentaires et lignes vides ignores', () => {
  const yaml = [
    '# ceci est un commentaire',
    '',
    'port: 8080',
    '  # commentaire indente',
    'ttl_seconds: 60',
  ].join('\n');
  const parsed = parseYamlLite(yaml);
  assert.deepEqual(parsed, { port: 8080, ttl_seconds: 60 });
});

test('booleens et chaines non quotees sont distingues des nombres', () => {
  const yaml = ['enabled: true', 'name: dept-ia-test', 'count: 3'].join('\n');
  const parsed = parseYamlLite(yaml);
  assert.equal(parsed.enabled, true);
  assert.equal(parsed.name, 'dept-ia-test');
  assert.equal(parsed.count, 3);
});
