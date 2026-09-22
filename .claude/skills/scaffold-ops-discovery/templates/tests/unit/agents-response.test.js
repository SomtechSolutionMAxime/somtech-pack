'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const { buildAgentsResponse } = require(
  path.join('..', '..', 'src', 'agents-response.js')
);

test('schema SS2.4 respecte avec une config minimale (aucun agent)', () => {
  const response = buildAgentsResponse({
    department: { name: 'dept-ia-test', organization: 'Test' },
    ttl_seconds: 60,
    agents: [],
  });

  assert.equal(response.department.name, 'dept-ia-test');
  assert.equal(response.department.organization, 'Test');
  assert.equal(response.department.isomorphic_version, '1.1');
  assert.equal(response.ttl_seconds, 60);
  assert.deepEqual(response.agents, []);
  assert.deepEqual(response.sessions, []); // toujours present, toujours vide (aucune session cablee)
  assert.match(response.generated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

test('un agent statique de la config apparait avec status "unknown", jamais invente en ligne', () => {
  const response = buildAgentsResponse({
    department: { name: 'dept-ia-test', organization: 'Test' },
    agents: [{ name: 'ing-curateur-architecture', sector: 'ing', url: 'https://example.somtech.ca' }],
  });

  assert.equal(response.agents.length, 1);
  assert.equal(response.agents[0].name, 'ing-curateur-architecture');
  assert.equal(response.agents[0].sector, 'ing');
  assert.equal(response.agents[0].url, 'https://example.somtech.ca');
  assert.equal(response.agents[0].status, 'unknown');
});

test('agent sans url (agent-session usine, I1/I10) reste valide sans le champ url', () => {
  const response = buildAgentsResponse({
    department: { name: 'dept-ia-test', organization: 'Test' },
    agents: [{ name: 'nicolet', sector: 'ops' }],
  });

  assert.equal('url' in response.agents[0], false);
  assert.equal('agent_card_url' in response.agents[0], false);
});

test('sessions[] est toujours present meme si non fourni en config — isomorphisme SS3.3', () => {
  const response = buildAgentsResponse({ department: {}, agents: [] });
  assert.ok(Array.isArray(response.sessions));
});

test('extensions.somtech present en config est propage tel quel (SS2.4, REJET revue de fond T-20260922-0062)', () => {
  const response = buildAgentsResponse({
    department: { name: 'd', organization: 'o' },
    agents: [
      {
        name: 'nicolet',
        sector: 'ops',
        extensions: {
          somtech: { mandate: 'P-20260601-0094', repo: 'org/repo', born_at: '2026-09-14T15:41:00Z' },
        },
      },
    ],
  });

  assert.deepEqual(response.agents[0].extensions, {
    somtech: { mandate: 'P-20260601-0094', repo: 'org/repo', born_at: '2026-09-14T15:41:00Z' },
  });
});

test('extensions absent de la config n ajoute pas le champ (pas de valeur inventee)', () => {
  const response = buildAgentsResponse({
    department: { name: 'd', organization: 'o' },
    agents: [{ name: 'a', sector: 'ops' }],
  });
  assert.equal('extensions' in response.agents[0], false);
});

test('anti-pattern : aucun champ Somtech-only bare n ajoute hors extensions.somtech', () => {
  const response = buildAgentsResponse({
    department: { name: 'd', organization: 'o' },
    agents: [{ name: 'a', sector: 'ops' }],
  });
  const agentKeys = Object.keys(response.agents[0]);
  for (const forbidden of ['pricing', 'cost', 'metering', 'silo_id', 'core_id', 'chantier', 'depot']) {
    assert.equal(agentKeys.includes(forbidden), false, `champ interdit present: ${forbidden}`);
  }
});
