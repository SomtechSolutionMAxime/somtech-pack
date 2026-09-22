'use strict';

// Metriques Prometheus exposees par ops-discovery (STD-032 SS2.8).
// Compteurs en memoire, initialises a 0 — la logique de pull/agregation
// (mecanismes #1/#2/#3 de SS2.10) n'est PAS du perimetre de ce scaffold
// initial (STD-032 SS4 : "Dockerfile, config, health check, metriques
// Prometheus" seulement).

const COUNTER_NAMES = [
  'agents_total',
  'agents_online',
  'agents_degraded',
  'agents_offline',
  'pull_errors_total',
  'sessions_total',
  'sessions_live',
  'sessions_stale',
];

const HISTOGRAM_NAME = 'pull_duration_ms';

function createMetricsRegistry() {
  const counters = new Map(COUNTER_NAMES.map((name) => [name, 0]));

  return {
    set(name, value) {
      if (!counters.has(name)) {
        throw new Error(`metrique inconnue : ${name}`);
      }
      counters.set(name, value);
    },
    render() {
      const lines = [];
      for (const name of COUNTER_NAMES) {
        lines.push(`# HELP ${name} Compteur ops-discovery (STD-032 SS2.8)`);
        lines.push(`# TYPE ${name} gauge`);
        lines.push(`${name} ${counters.get(name)}`);
      }
      lines.push(`# HELP ${HISTOGRAM_NAME} Duree du dernier cycle de pull, en millisecondes`);
      lines.push(`# TYPE ${HISTOGRAM_NAME} gauge`);
      lines.push(`${HISTOGRAM_NAME} 0`);
      return lines.join('\n') + '\n';
    },
  };
}

module.exports = { createMetricsRegistry, COUNTER_NAMES, HISTOGRAM_NAME };
