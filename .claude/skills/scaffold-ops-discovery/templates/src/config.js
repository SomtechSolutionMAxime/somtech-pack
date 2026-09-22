'use strict';

const fs = require('node:fs');
const { parseYamlLite } = require('./yaml-lite');

const VALID_AUTH_MODES = ['public', 'bearer', 'network'];

// Valide et normalise une config deja parsee (objet JS). Separee de loadConfig()
// pour rester testable sans toucher le systeme de fichiers.
function validateConfig(raw) {
  const config = {
    department: {
      name: (raw.department && raw.department.name) || 'dept-ia-unknown',
      organization: (raw.department && raw.department.organization) || 'Unknown',
    },
    ttl_seconds: typeof raw.ttl_seconds === 'number' ? raw.ttl_seconds : 60,
    port: typeof raw.port === 'number' ? raw.port : 8080,
    auth: {
      mode: 'public',
      api_key_env: null,
    },
    agents: Array.isArray(raw.agents) ? raw.agents : [],
  };

  if (raw.auth && raw.auth.mode !== undefined) {
    if (!VALID_AUTH_MODES.includes(raw.auth.mode)) {
      throw new Error(
        `auth.mode invalide : "${raw.auth.mode}" (attendu : ${VALID_AUTH_MODES.join(', ')}) — STD-032 SS2.5`
      );
    }
    config.auth.mode = raw.auth.mode;
    config.auth.api_key_env = raw.auth.api_key_env || null;
  }

  if (config.auth.mode === 'network' && raw.auth && raw.auth.api_key_env) {
    throw new Error(
      'auth.mode "network" ne se combine pas avec api_key_env — STD-032 SS2.5 ("network ne se combine pas avec bearer")'
    );
  }

  if (config.auth.mode === 'bearer' && !config.auth.api_key_env) {
    throw new Error('auth.mode "bearer" exige auth.api_key_env — STD-032 SS2.5');
  }

  return config;
}

function loadConfig(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const raw = parseYamlLite(text);
  return validateConfig(raw);
}

module.exports = { loadConfig, validateConfig, VALID_AUTH_MODES };
