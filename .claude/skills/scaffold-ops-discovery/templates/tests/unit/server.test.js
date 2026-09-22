'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const http = require('node:http');

const { createServer } = require(path.join('..', '..', 'src', 'server.js'));
const { createMetricsRegistry } = require(path.join('..', '..', 'src', 'metrics.js'));
const { validateConfig } = require(path.join('..', '..', 'src', 'config.js'));

function request(server, options) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request(
      {
        host: '127.0.0.1',
        port: address.port,
        path: options.path,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function withServer(config, fn) {
  return new Promise((resolve, reject) => {
    const metrics = createMetricsRegistry();
    const server = createServer(config, metrics);
    server.listen(0, async () => {
      try {
        await fn(server);
        server.close(() => resolve());
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

test('GET /health repond 200 {"status":"healthy"}', async () => {
  const config = validateConfig({});
  await withServer(config, async (server) => {
    const res = await request(server, { path: '/health' });
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.body), { status: 'healthy' });
  });
});

test('GET /metrics expose les compteurs STD-032 SS2.8 en texte Prometheus', async () => {
  const config = validateConfig({});
  await withServer(config, async (server) => {
    const res = await request(server, { path: '/metrics' });
    assert.equal(res.status, 200);
    assert.match(res.body, /^agents_total 0$/m);
    assert.match(res.body, /^sessions_stale 0$/m);
  });
});

test('GET /.well-known/agents.json en mode public repond 200 sans auth', async () => {
  const config = validateConfig({
    department: { name: 'dept-ia-test', organization: 'Test' },
    agents: [{ name: 'ing-x', sector: 'ing' }],
  });
  await withServer(config, async (server) => {
    const res = await request(server, { path: '/.well-known/agents.json' });
    assert.equal(res.status, 200);
    const parsed = JSON.parse(res.body);
    assert.equal(parsed.agents.length, 1);
    assert.deepEqual(parsed.sessions, []);
  });
});

test('mode bearer : sans header -> 401, mauvaise cle -> 401, bonne cle -> 200', async () => {
  process.env.TEST_DISCOVERY_KEY = 'secret-du-test';
  const config = validateConfig({ auth: { mode: 'bearer', api_key_env: 'TEST_DISCOVERY_KEY' } });

  await withServer(config, async (server) => {
    const noAuth = await request(server, { path: '/.well-known/agents.json' });
    assert.equal(noAuth.status, 401);

    const wrongKey = await request(server, {
      path: '/.well-known/agents.json',
      headers: { Authorization: 'Bearer mauvaise-cle' },
    });
    assert.equal(wrongKey.status, 401);

    const rightKey = await request(server, {
      path: '/.well-known/agents.json',
      headers: { Authorization: 'Bearer secret-du-test' },
    });
    assert.equal(rightKey.status, 200);
  });

  delete process.env.TEST_DISCOVERY_KEY;
});

test('route inconnue -> 404', async () => {
  const config = validateConfig({});
  await withServer(config, async (server) => {
    const res = await request(server, { path: '/route-qui-n-existe-pas' });
    assert.equal(res.status, 404);
  });
});
