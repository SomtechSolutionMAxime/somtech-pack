'use strict';

const http = require('node:http');
const path = require('node:path');
const { loadConfig } = require('./config');
const { createMetricsRegistry } = require('./metrics');
const { buildAgentsResponse } = require('./agents-response');

const CONFIG_PATH = process.env.OPS_DISCOVERY_CONFIG || path.join(__dirname, '..', 'config.yaml');

function checkBearerAuth(config, req) {
  if (config.auth.mode !== 'bearer') return true;
  const expected = process.env[config.auth.api_key_env];
  const header = req.headers['authorization'] || '';
  const match = header.match(/^Bearer (.+)$/);
  return Boolean(expected) && Boolean(match) && match[1] === expected;
}

function createServer(config, metrics) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy' }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      res.end(metrics.render());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/.well-known/agents.json') {
      if (!checkBearerAuth(config, req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }
      metrics.set('agents_total', config.agents.length);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(buildAgentsResponse(config), null, 2));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });
}

function main() {
  const config = loadConfig(CONFIG_PATH);
  const metrics = createMetricsRegistry();
  const server = createServer(config, metrics);

  server.listen(config.port, () => {
    console.log(`ops-discovery scaffold en ecoute sur :${config.port} (auth.mode=${config.auth.mode})`);
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (require.main === module) {
  main();
}

module.exports = { createServer, checkBearerAuth };
