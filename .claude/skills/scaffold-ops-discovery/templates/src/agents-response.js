'use strict';

// Construit la reponse agregee /.well-known/agents.json (STD-032 SS2.4).
// Ce scaffold ne cable AUCUN mecanisme de decouverte (SS2.10) : les agents
// exposes sont uniquement ceux declares statiquement dans config.agents
// (mecanisme #1). Aucun pull, aucune self-registration — hors perimetre de
// ce lot (cf. ticket T-20260922-0062, "ce que ce lot NE fait PAS").
//
// SS2.10 interdit d'ecrire agents.json a la main : ici on ne l'ecrit pas, on
// le CALCULE a chaque requete depuis la config + sessions[] (toujours [],
// aucune session n'est jamais ecrite par ce scaffold).

function buildAgentsResponse(config) {
  const department = config.department || {};
  const agents = Array.isArray(config.agents) ? config.agents : [];
  const ttlSeconds = typeof config.ttl_seconds === 'number' ? config.ttl_seconds : 60;

  return {
    department: {
      name: department.name || 'dept-ia-unknown',
      organization: department.organization || 'Unknown',
      isomorphic_version: '1.1',
    },
    generated_at: new Date().toISOString(),
    ttl_seconds: ttlSeconds,
    agents: agents.map((agent) => buildAgentEntry(agent)),
    sessions: [],
  };
}

function buildAgentEntry(agent) {
  const entry = {
    name: agent.name,
    sector: agent.sector,
  };
  if (agent.url) entry.url = agent.url;
  if (agent.agent_card_url) entry.agent_card_url = agent.agent_card_url;
  // Aucun mecanisme de pull ni de sessions[] n'est cable dans ce scaffold :
  // le statut ne peut etre calcule honnêtement -> "unknown" (valeur valide
  // du schema SS2.4), jamais invente en "online".
  entry.status = 'unknown';
  // extensions.somtech (SS2.4) est le SEUL bloc ou du vocabulaire Somtech-only
  // est permis (mandate/repo/application_id/born_at/closed_at) — propage tel
  // quel si present en config, jamais invente s'il est absent (defaut trouve
  // en revue de fond, T-20260922-0062 : ce champ etait silencieusement
  // supprime, alors que c'est le cas d'usage central d'un agent-session sans
  // URL, cf. I10).
  if (agent.extensions && agent.extensions.somtech) {
    entry.extensions = { somtech: agent.extensions.somtech };
  }
  return entry;
}

module.exports = { buildAgentsResponse };
