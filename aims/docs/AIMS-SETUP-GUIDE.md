# Guide : Monter des Agents Autonomes Claude sur Fly.io

> Documentation de reference pour reproduire l'architecture AIMS (AI-Implemented & Maintained Software) sur un nouveau projet. Basee sur l'implementation v5 du projet Orbit.

---

## Table des matieres

1. [Vue d'ensemble](#1-vue-densemble)
2. [Prerequis](#2-prerequis)
3. [Architecture](#3-architecture)
4. [Stack technique](#4-stack-technique)
5. [Structure des fichiers](#5-structure-des-fichiers)
6. [L'orchestrator](#6-lorchestrator)
7. [Les sub-agents](#7-les-sub-agents)
8. [Machine a etats](#8-machine-a-etats)
9. [Integration Slack](#9-integration-slack)
10. [Integration ServiceDesk (tickets)](#10-integration-servicedesk-tickets)
11. [Dockerfile](#11-dockerfile)
12. [Entrypoint](#12-entrypoint)
13. [Docker Compose (dev local)](#13-docker-compose-dev-local)
14. [Deploiement Fly.io](#14-deploiement-flyio)
15. [Variables d'environnement](#15-variables-denvironnement)
16. [Definir un agent (agent.md)](#16-definir-un-agent-agentmd)
17. [Skills (injection de competences)](#17-skills-injection-de-competences)
18. [Proof of Work (validation QA)](#18-proof-of-work-validation-qa)
19. [Landing strategy (human-gate)](#19-landing-strategy-human-gate)
20. [Circuit breaker et resilience](#20-circuit-breaker-et-resilience)
21. [Monitoring et observabilite](#21-monitoring-et-observabilite)
22. [Checklist pour nouveau projet](#22-checklist-pour-nouveau-projet)

---

## 1. Vue d'ensemble

L'architecture AIMS permet de deployer un **agent autonome** qui :

1. **Poll** un systeme de tickets (ServiceDesk) pour detecter du travail
2. **Analyse** chaque ticket avec un sub-agent specialise (analyst)
3. **Presente un plan** a un architecte humain via Slack
4. **Implemente** le code via un sub-agent dev (branches, commits, PR)
5. **Valide** le travail via un sub-agent QA (build, tests, lint, types)
6. **Attend l'approbation humaine** avant tout merge (human-gate)

Le tout tourne dans **un seul container Docker** deploye sur Fly.io. Les sub-agents sont des processus ephemeres spawnes via le Claude Agent SDK.

---

## 2. Prerequis

| Outil | Usage |
|-------|-------|
| **Node.js 20+** | Runtime |
| **TypeScript 5+** | Language de l'orchestrator |
| **Docker** | Containerisation |
| **Fly.io CLI** (`flyctl`) | Deploiement production |
| **GitHub CLI** (`gh`) | Creation de PR par les agents |
| **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) | Spawn des sub-agents |
| **Slack Bot Token** | Communication avec l'architecte (optionnel) |
| **Cle API Anthropic** | Appels a Claude |

### Comptes necessaires

- **Anthropic** : Cle API avec acces aux modeles Opus et Sonnet
- **Fly.io** : Compte avec organisation configuree
- **GitHub** : Token avec permissions `repo`, `workflow`, `read:org`
- **Slack** : App bot avec permissions `chat:write`, `channels:history`, `reactions:write`

---

## 3. Architecture

```
Systeme de Tickets (ServiceDesk / Linear / Jira)
       │
       │  polling toutes les 30s
       ▼
┌─────────────────────────────────────────┐
│  ORCHESTRATOR  (1 container Fly.io)      │
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │ Poller   │  │ State    │  │ HTTP  │ │
│  │ tickets  │  │ Machine  │  │ /health│ │
│  └──────────┘  └──────────┘  └───────┘ │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ Slack Client (polling threads)    │   │
│  └──────────────────────────────────┘   │
│                                          │
│  Spawns via Agent SDK query() :          │
│  ┌─────────┐ ┌─────┐ ┌────┐ ┌────────┐ │
│  │ analyst │ │ dev │ │ qa │ │security│ │
│  └─────────┘ └─────┘ └────┘ └────────┘ │
└─────────────────────────────────────────┘
       │
       │  git push + gh pr create
       ▼
    GitHub (PRs en attente de review)
```

**Principe cle** : 1 container persistant (l'orchestrator) qui spawne des sub-agents ephemeres via le SDK. Pas de microservices, pas de queues, pas de bases de donnees additionnelles.

---

## 4. Stack technique

```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.2.71",
    "@anthropic-ai/sdk": "^0.39.0",
    "@slack/web-api": "^7.0.0",
    "yaml": "^2.7.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^20.0.0"
  }
}
```

Le SDK `claude-agent-sdk` est le coeur : il permet de spawner des processus Claude Code avec des outils (Read, Write, Edit, Bash, Grep, Glob) et de streamer leurs resultats.

---

## 5. Structure des fichiers

```
project/
├── src/
│   ├── orchestrator.ts              # Boucle principale
│   └── lib/
│       ├── types.ts                 # Types TypeScript
│       ├── ticket-processor.ts      # Analyse + gate PLANNING
│       ├── slack-client.ts          # Client Slack direct
│       ├── slack-poller.ts          # Poll threads architecte
│       ├── servicedesk-client.ts    # Client tickets (MCP JSON-RPC)
│       ├── agents.ts                # Chargement definitions agents + skills
│       ├── intent-classifier.ts     # Parse messages architecte
│       ├── proof-of-work.ts         # Validation QA
│       ├── landing.ts               # Merge PR
│       ├── state-machine.ts         # Transitions d'etat
│       ├── graceful-shutdown.ts     # Arret propre (SIGTERM)
│       └── hooks.ts                 # Circuit breaker, audit
├── agents/
│   ├── dev-orchestrator/
│   │   ├── brief.yaml               # Design brief de l'orchestrator
│   │   └── agent.md                 # Prompt systeme
│   ├── sub-agent-analyst/agent.md
│   ├── sub-agent-dev/agent.md
│   ├── sub-agent-qa/agent.md
│   ├── sub-agent-security/agent.md
│   └── sub-agent-devops/agent.md
├── skills/
│   ├── transversal/                 # Skills communs a tous
│   │   ├── silo-logging/SKILL.md
│   │   ├── desk-comm/SKILL.md
│   │   └── error-escalation/SKILL.md
│   ├── dev-workers/                 # Skills dev
│   │   ├── code-implementation/SKILL.md
│   │   ├── test-writing/SKILL.md
│   │   └── pr-workflow/SKILL.md
│   └── security-auditor/           # Skills securite
│       ├── vulnerability-scan/SKILL.md
│       └── compliance-audit/SKILL.md
├── infra/
│   ├── Dockerfile.agent
│   ├── entrypoint-v5.sh
│   ├── package.json
│   └── tsconfig.json
├── fly.toml                         # Config Fly.io
└── AIMS-v5.md                       # Reference operationnelle
```

---

## 6. L'orchestrator

L'orchestrator est le cerveau. C'est un processus Node.js toujours actif qui :

### Boucle principale

```typescript
async function main() {
  const config = loadConfig();              // Lire env vars
  const context = await loadProjectContext(); // Pre-charger ontologie, constitution
  const agents = loadAgentDefinitions();     // Charger agent.md + skills

  // Demarrer le serveur HTTP (health check)
  startHttpServer(config);

  // Boucle de polling
  while (true) {
    // 1. Poll ServiceDesk pour nouveaux tickets
    const tickets = await discoverTickets(config.applicationId);

    for (const ticket of tickets) {
      if (activeRuns >= config.maxConcurrentRuns) break;

      // 2. Analyser le ticket (sub-agent-analyst)
      const trace = await runAnalysis(ticket, config, agents, context);

      // 3. Si Slack dispo : presenter le plan et attendre approbation
      if (config.slackToken) {
        await postPlanToSlack(ticket, trace);
        // Le slack-poller detectera "go"/"ok" et declenchera l'execution
      } else {
        // Mode degrade : auto-approve
        await executeTicket(ticket, trace, agents);
      }
    }

    // 4. Poll les threads Slack pour reponses architecte
    await pollSlackThreads();

    await sleep(config.pollInterval * 1000);
  }
}
```

### Etat global

```typescript
// Compteur de runs actifs (limite par MAX_CONCURRENT_RUNS)
let activeRuns = 0;

// Threads Slack actifs (pour polling des reponses architecte)
const activeThreads = new Map<string, {
  channel: string;
  threadTs: string;
  lastProcessedTs: string;
  ticketId: string;
  trace: OrchestratorTrace;
}>();

// Cache anti-double-traitement (TTL 2h)
const mergedTickets = new Map<string, number>();
```

---

## 7. Les sub-agents

Chaque sub-agent est **ephemere** : il est spawne, execute sa tache, retourne un JSON, et meurt.

### Spawn via Agent SDK

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

async function spawnSubAgent(
  agentDefinition: string,  // Contenu du agent.md
  prompt: string,           // Tache specifique
  tools: string[],          // Outils autorises
  timeout: number           // Timeout en ms
): Promise<string> {
  let result = "";

  for await (const message of query({
    prompt,
    options: {
      systemPrompt: agentDefinition,
      allowedTools: tools,
      permissionMode: "acceptEdits",  // Auto-approve edits fichiers
      maxTurns: 50,
    },
  })) {
    if (message.type === "result" && message.subtype === "success") {
      result = message.result;
    }
  }

  return result;
}
```

### Les 5 sub-agents

| Agent | Modele | Timeout | Outils | Role |
|-------|--------|---------|--------|------|
| `sub-agent-analyst` | Opus | 5 min | Read, Grep, Glob | Analyse ticket, classifie complexite/risque |
| `sub-agent-dev` | Sonnet | 30 min | Read, Write, Edit, Bash, Grep, Glob | Implemente le code, cree branche + PR |
| `sub-agent-qa` | Sonnet | 10 min | Bash, Read | Valide build, tests, lint, types |
| `sub-agent-security` | Sonnet | 15 min | Read, Grep, Glob, Bash | Audit RLS, secrets, vulnerabilites |
| `sub-agent-devops` | Sonnet | 15 min | Bash, Read, Write | Deploiement, migrations, infra |

### Exemple : definition du sub-agent-dev (`agents/sub-agent-dev/agent.md`)

```markdown
# Sub-Agent : dev

**Type :** Sub-agent natif (spawne par l'orchestrator via Agent SDK)
**Duree de vie :** Ephemere

## Identite

| Propriete | Valeur |
|---|---|
| **Nom** | `sub-agent-dev` |
| **Role** | Implementation de code (feature, bugfix, refactor) |
| **Outils** | Read, Write, Edit, Bash, Grep, Glob |
| **Timeout** | 600 000 ms (10 min) |

## Responsabilites

1. Creer une branche `aims/{ticket-id}`
2. Implementer les changements selon le plan
3. Commit avec messages conventionnels (`type(scope): description`)
4. Pousser et creer une PR avec `gh pr create`
5. Retourner un JSON structure

## Convention de sortie

### Succes
{
  "status": "SUCCESS",
  "branch": "aims/TICKET-123",
  "pr_url": "https://github.com/org/repo/pull/42",
  "files_modified": ["src/components/Form.tsx"],
  "summary": "Composant Form implemente"
}

### Question (declenche BLOCKED)
[QUESTION]
Dois-je creer une migration pour la nouvelle table ?

## Regles

- Ne jamais pousser sur `main` directement
- Si doute -> retourner `[QUESTION]`
- Format commit : `type(scope): description`
- Toujours creer une PR avec `gh pr create`
- Ne JAMAIS modifier le statut du ticket
```

---

## 8. Machine a etats

Chaque ticket traverse ces etats :

```
QUEUED → ANALYZING → PLANNING → APPROVED → RUNNING → VALIDATING → LANDING → DONE
                        │                     │
                     BLOCKED ──────────→ PLANNING/RUNNING
                        │
                     FAILED ──(retry)──→ QUEUED
```

| Etat | Description | Qui agit |
|------|-------------|----------|
| `QUEUED` | Ticket detecte, en attente | Orchestrator |
| `ANALYZING` | sub-agent-analyst en cours | Analyst |
| `PLANNING` | Plan presente, attente approbation | Architecte humain |
| `APPROVED` | Architecte a dit "go" | Orchestrator |
| `RUNNING` | sub-agent-dev implemente | Dev |
| `BLOCKED` | Question en attente de reponse | Architecte humain |
| `VALIDATING` | sub-agent-qa valide (PoW) | QA |
| `LANDING` | PR prete, attente merge humain | Architecte humain |
| `DONE` | Termine | - |
| `FAILED` | Echec apres max retries | Orchestrator |

### Transitions valides

```typescript
const RUN_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  QUEUED:     ["ANALYZING"],
  ANALYZING:  ["PLANNING", "BLOCKED", "FAILED"],
  PLANNING:   ["APPROVED", "BLOCKED", "FAILED"],
  APPROVED:   ["RUNNING"],
  RUNNING:    ["VALIDATING", "BLOCKED", "FAILED"],
  BLOCKED:    ["PLANNING", "RUNNING", "FAILED"],
  VALIDATING: ["LANDING", "RUNNING", "FAILED"],
  LANDING:    ["DONE", "FAILED"],
  DONE:       [],
  FAILED:     ["QUEUED"],
};
```

---

## 9. Integration Slack

L'orchestrator communique directement avec Slack via le `@slack/web-api` (pas de bot framework Bolt.js, juste l'API).

### Client Slack

```typescript
import { WebClient } from "@slack/web-api";

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

// Poster dans un canal
await slack.chat.postMessage({
  channel: "#dev-agent",
  text: "Nouveau ticket detecte : T-123",
});

// Poster dans un thread
await slack.chat.postMessage({
  channel: "#dev-agent",
  thread_ts: parentMessageTs,
  text: "Plan d'execution : ...",
});

// Lire les reponses d'un thread
const replies = await slack.conversations.replies({
  channel: "#dev-agent",
  ts: parentMessageTs,
  oldest: lastProcessedTs,  // Seulement les nouveaux messages
});
```

### Polling des threads

L'orchestrator poll les threads actifs toutes les 15 secondes pour detecter les reponses de l'architecte :

```typescript
async function pollSlackThreads() {
  for (const [ticketId, thread] of activeThreads) {
    const replies = await slack.conversations.replies({
      channel: thread.channel,
      ts: thread.threadTs,
      oldest: thread.lastProcessedTs,
    });

    for (const msg of replies.messages) {
      // Ignorer les messages du bot
      if (msg.bot_id) continue;

      // Classifier l'intent
      const intent = classifyIntent(msg.text);

      switch (intent) {
        case "approve":  // "go", "ok", "valide"
          await transitionToApproved(ticketId);
          break;
        case "reject":   // "non", "reject"
          await transitionToFailed(ticketId);
          break;
        case "question": // Autre message
          await respondToArchitect(ticketId, msg.text);
          break;
      }
    }
  }
}
```

### Mode degrade (sans Slack)

Si `SLACK_BOT_TOKEN` n'est pas configure, l'orchestrator fonctionne en mode degrade :
- Les tickets sont auto-approuves (skip PLANNING gate)
- Les resultats sont postes uniquement dans le ServiceDesk
- Le human-gate reste actif (PR creee, merge manuel)

---

## 10. Integration ServiceDesk (tickets)

Le ServiceDesk est le systeme de tickets. L'orchestrator communique via un protocole **MCP JSON-RPC 2.0**.

### Client MCP

```typescript
async function callServiceDesk(action: string, args: Record<string, any>) {
  const response = await fetch(SERVICEDESK_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICEDESK_API_KEY}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "tickets",
        arguments: { action, ...args },
      },
    }),
  });

  return response.json();
}
```

### Operations cles

```typescript
// Decouvrir les tickets a traiter
const tickets = await callServiceDesk("silo_discover", {
  application_id: APPLICATION_ID,
});
// Retourne : { pending_analysis: [...], pending_review: [...], ready_for_dev: [...] }

// Lire un ticket complet
const ticket = await callServiceDesk("get", { id: ticketId });

// Mettre a jour le statut
await callServiceDesk("update", {
  id: ticketId,
  run_status: "ANALYZING",
  trace_id: traceId,
  agent_id: "dev-orchestrator",
});

// Ajouter un commentaire (dual-view : visible dans tickets + Slack)
await callServiceDesk("add_comment", {
  id: ticketId,
  content: "Build OK, Tests OK, Lint OK",
  author_label: "sub-agent-qa",
});
```

### Adaptation a d'autres systemes

Si vous utilisez Linear, Jira, ou un autre systeme, remplacez le client ServiceDesk par un adaptateur equivalent. L'interface necessaire :

```typescript
interface TicketSystem {
  discover(appId: string): Promise<Ticket[]>;
  getTicket(id: string): Promise<Ticket>;
  updateStatus(id: string, status: string, metadata: any): Promise<void>;
  addComment(id: string, content: string, author: string): Promise<void>;
}
```

---

## 11. Dockerfile

```dockerfile
# AIMS v5 — Dockerfile unifie pour orchestrator TypeScript
FROM node:20-slim AS base

ARG AGENT_ID
ARG SILO_NAME=aims-silo

ENV AGENT_ID=${AGENT_ID}
ENV SILO_NAME=${SILO_NAME}
ENV NODE_ENV=production

# Dependances systeme
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git curl jq \
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI (requis pour gh pr create)
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Claude Code CLI (requis pour Agent SDK)
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /silo

# Build TypeScript
COPY infra/package.json infra/tsconfig.json /silo/
RUN npm install --include=dev
COPY src/ /silo/src/
RUN npx tsc -p tsconfig.json && rm -rf src/

# Fichiers runtime
COPY agents/ /silo/agents/
COPY skills/ /silo/skills/
COPY infra/entrypoint-v5.sh /silo/entrypoint-v5.sh
RUN chmod +x /silo/entrypoint-v5.sh

# User non-root
RUN groupadd -r aims && useradd -r -g aims -d /silo -s /bin/bash aims \
    && mkdir -p /silo/workspace /home/aims/.claude \
    && chown -R aims:aims /silo /home/aims
ENV HOME=/home/aims
USER aims

HEALTHCHECK --interval=90s --timeout=5s --retries=3 \
  CMD pgrep -f "orchestrator.js" > /dev/null || exit 1

ENTRYPOINT ["/silo/entrypoint-v5.sh"]
```

### Points importants

- **`@anthropic-ai/claude-code`** doit etre installe globalement — c'est le runtime requis par le Agent SDK
- **`gh` CLI** est necessaire pour que les sub-agents puissent creer des PR
- **User non-root** (`aims`) pour la securite
- **Healthcheck** verifie que le processus tourne

---

## 12. Entrypoint

Le script d'entrypoint prepare l'environnement avant de lancer l'orchestrator :

```bash
#!/bin/bash
set -euo pipefail

# 1. Verifier les variables requises
for var in ANTHROPIC_API_KEY SERVICEDESK_MCP_URL SERVICEDESK_API_KEY AIMS_APPLICATION_ID; do
  if [ -z "${!var:-}" ]; then
    echo "FATAL: ${var} non definie"
    exit 1
  fi
done

# 2. Warning si pas de Slack
if [ -z "${SLACK_BOT_TOKEN:-}" ]; then
  echo "WARNING: SLACK_BOT_TOKEN not set — running in degraded mode"
fi

# 3. Recuperer les infos du repo depuis le systeme de tickets
APP_DATA=$(curl -sf -H "Authorization: Bearer ${SERVICEDESK_API_KEY}" \
  -H "Content-Type: application/json" \
  "${SERVICEDESK_MCP_URL}" \
  -d '{"tool":"servicedesk_applications_get","arguments":{"application_id":"'"${AIMS_APPLICATION_ID}"'"}}')

REPO_URL=$(echo "$APP_DATA" | jq -r '.metadata.repo.url // empty')
REPO_BRANCH=$(echo "$APP_DATA" | jq -r '.metadata.repo.default_branch // "main"')

# Fallback sur env vars
REPO_URL="${REPO_URL:-${CLIENT_REPO_URL:-}}"
REPO_BRANCH="${REPO_BRANCH:-${CLIENT_REPO_BRANCH:-main}}"

# 4. Cloner le repo client
WORKSPACE="${WORKSPACE:-/silo/workspace}"
if [ -n "${REPO_URL}" ] && [ ! -d "${WORKSPACE}/.git" ]; then
  AUTH_URL=$(echo "$REPO_URL" | sed "s|https://|https://${GITHUB_TOKEN}@|")
  git clone --branch "${REPO_BRANCH}" "$AUTH_URL" "${WORKSPACE}"
  cd "${WORKSPACE}"
  git config user.name "AIMS Agent (${AGENT_ID})"
  git config user.email "aims-${AGENT_ID}@somtech.ca"
  cd /silo
elif [ -d "${WORKSPACE}/.git" ]; then
  cd "${WORKSPACE}" && git pull --rebase origin "${REPO_BRANCH}" || true
  cd /silo
fi

# 5. Configurer gh CLI
if [ -n "${GITHUB_TOKEN:-}" ]; then
  echo "${GITHUB_TOKEN}" | gh auth login --with-token
fi

# 6. Lancer l'orchestrator
exec node /silo/dist/orchestrator.js
```

---

## 13. Docker Compose (dev local)

```yaml
services:
  dev-orchestrator:
    build:
      context: .
      dockerfile: infra/Dockerfile.agent
      args:
        AGENT_ID: dev-orchestrator
        SILO_NAME: mon-projet
    ports:
      - "8080:8080"
    environment:
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      SERVICEDESK_MCP_URL: ${SERVICEDESK_MCP_URL}
      SERVICEDESK_API_KEY: ${SERVICEDESK_API_KEY}
      AIMS_APPLICATION_ID: ${AIMS_APPLICATION_ID}
      SLACK_BOT_TOKEN: ${AIMS_SLACK_BOT_TOKEN}
      GITHUB_TOKEN: ${GITHUB_TOKEN}
      GITHUB_OWNER: ${GITHUB_OWNER}
      GITHUB_REPO: ${GITHUB_REPO}
      POLL_INTERVAL: 30
      MAX_CONCURRENT_RUNS: 2
      MAX_RETRIES: 2
    volumes:
      - orchestrator-workspace:/silo/workspace
    restart: unless-stopped

volumes:
  orchestrator-workspace:
```

```bash
# Demarrer
docker compose up -d dev-orchestrator

# Voir les logs
docker compose logs -f dev-orchestrator

# Arreter
docker compose down
```

---

## 14. Deploiement Fly.io

### fly.toml

```toml
app = "mon-projet-dev-orchestrator"
primary_region = "yyz"  # Toronto (ajuster selon votre region)

[build]
  dockerfile = "infra/Dockerfile.agent"

[build.args]
  AGENT_ID = "dev-orchestrator"
  SILO_NAME = "mon-projet"

[env]
  POLL_INTERVAL = "30"
  MAX_CONCURRENT_RUNS = "2"
  MAX_RETRIES = "2"

[[services]]
  internal_port = 8080
  protocol = "tcp"
  auto_stop_machines = false    # IMPORTANT: toujours actif
  auto_start_machines = true
  min_machines_running = 1      # IMPORTANT: au moins 1 machine

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
    force_https = true

  [[services.http_checks]]
    interval = 30000       # 30s
    timeout = 5000
    path = "/health"
    method = "GET"

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"

[mounts]
  source = "workspace"
  destination = "/silo/workspace"
```

### Commandes de deploiement

```bash
# Creer l'app
fly apps create mon-projet-dev-orchestrator

# Creer le volume (persistance du workspace git)
fly volumes create workspace --size 10 --region yyz \
  -a mon-projet-dev-orchestrator

# Configurer les secrets
fly secrets set \
  ANTHROPIC_API_KEY="sk-ant-..." \
  SERVICEDESK_MCP_URL="https://..." \
  SERVICEDESK_API_KEY="sk_live_..." \
  AIMS_APPLICATION_ID="uuid-..." \
  SLACK_BOT_TOKEN="xoxb-..." \
  GITHUB_TOKEN="ghp_..." \
  GITHUB_OWNER="mon-org" \
  GITHUB_REPO="mon-repo" \
  -a mon-projet-dev-orchestrator

# Deployer
fly deploy -a mon-projet-dev-orchestrator

# Voir les logs
fly logs -a mon-projet-dev-orchestrator

# Verifier le health
fly status -a mon-projet-dev-orchestrator
curl https://mon-projet-dev-orchestrator.fly.dev/health
```

### Points critiques Fly.io

| Parametre | Valeur | Raison |
|-----------|--------|--------|
| `auto_stop_machines` | `false` | L'orchestrator doit tourner en permanence |
| `min_machines_running` | `1` | Au moins une instance active |
| `memory` | `512mb` | Le Agent SDK + Node.js consomment ~300MB |
| Volume mount | `/silo/workspace` | Le repo git persiste entre deploys |
| Region | `yyz` | Choisir la region la plus proche de vos devs |

---

## 15. Variables d'environnement

### Requises

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Cle API Anthropic (sk-ant-...) |
| `SERVICEDESK_MCP_URL` | URL de votre systeme de tickets |
| `SERVICEDESK_API_KEY` | Token d'authentification tickets |
| `AIMS_APPLICATION_ID` | UUID de l'application a gerer |

### Optionnelles

| Variable | Description | Defaut |
|----------|-------------|--------|
| `SLACK_BOT_TOKEN` | Token Slack (xoxb-...) | Mode degrade |
| `SLACK_POLL_INTERVAL` | Intervalle polling Slack (sec) | `15` |
| `POLL_INTERVAL` | Intervalle polling tickets (sec) | `30` |
| `MAX_CONCURRENT_RUNS` | Runs simultanes max | `2` |
| `MAX_RETRIES` | Retries par ticket | `2` |
| `WORKSPACE` | Chemin workspace git | `/silo/workspace` |
| `GITHUB_TOKEN` | Token GitHub (ghp_...) | - |
| `GITHUB_OWNER` | Organisation GitHub | - |
| `GITHUB_REPO` | Nom du repo | - |
| `CLIENT_REPO_URL` | URL du repo (fallback) | - |
| `CLIENT_REPO_BRANCH` | Branche par defaut | `main` |

---

## 16. Definir un agent (agent.md)

Chaque sub-agent est defini par un fichier `agent.md` qui sert de prompt systeme. Structure type :

```markdown
# Sub-Agent : {nom}

**Type :** Sub-agent natif (spawne par l'orchestrator via Agent SDK)
**Duree de vie :** Ephemere
**Modele :** sonnet | opus

## Identite

| Propriete | Valeur |
|---|---|
| **Nom** | `sub-agent-{nom}` |
| **Role** | {description du role} |
| **Outils** | {liste des outils autorises} |
| **Timeout** | {timeout en ms} |

## Responsabilites

1. {Responsabilite 1}
2. {Responsabilite 2}
3. ...

## Convention de sortie

{Format JSON attendu en sortie}

## Regles

- {Regle 1}
- {Regle 2}
- Ne JAMAIS modifier le statut du ticket (role de l'orchestrator)
```

### Bonnes pratiques

- **Format de sortie strict** : Toujours definir le JSON attendu pour que l'orchestrator puisse parser
- **Convention `[QUESTION]`** : Si le sub-agent a une question, il retourne `[QUESTION]\n{la question}` au lieu d'un JSON, ce qui declenche l'etat BLOCKED
- **Regles negatives** : Lister explicitement ce que l'agent ne doit PAS faire
- **Contexte minimal** : Le prompt d'execution fournit le contexte du ticket, pas besoin de tout mettre dans agent.md

---

## 17. Skills (injection de competences)

Les skills sont des fichiers Markdown injectes dans le prompt des sub-agents pour leur donner des competences specifiques.

### Structure

```
skills/
├── transversal/          # Injectes dans TOUS les sub-agents
│   ├── silo-logging/SKILL.md
│   ├── desk-comm/SKILL.md
│   ├── error-escalation/SKILL.md
│   ├── audit-trail/SKILL.md
│   └── problem-analysis/SKILL.md
├── dev-workers/          # Injectes dans sub-agent-dev + qa
│   ├── code-implementation/SKILL.md
│   ├── test-writing/SKILL.md
│   └── pr-workflow/SKILL.md
└── security-auditor/     # Injectes dans sub-agent-security
    ├── vulnerability-scan/SKILL.md
    └── compliance-audit/SKILL.md
```

### Mapping agent → skills

```typescript
const agentSkillMap = {
  "sub-agent-analyst": ["transversal/*"],
  "sub-agent-dev":     ["transversal/*", "dev-workers/*"],
  "sub-agent-qa":      ["transversal/*", "dev-workers/test-writing"],
  "sub-agent-security":["transversal/*", "security-auditor/*"],
  "sub-agent-devops":  ["transversal/*", "devops-silo/*"],
};
```

### Chargement

```typescript
function loadAgentDefinitions(basePath: string) {
  const agents: Record<string, AgentSpec> = {};

  for (const [agentId, skillPatterns] of Object.entries(agentSkillMap)) {
    // Charger le agent.md de base
    let prompt = fs.readFileSync(`${basePath}/agents/${agentId}/agent.md`, "utf-8");

    // Injecter les skills
    for (const pattern of skillPatterns) {
      const skillFiles = glob.sync(`${basePath}/skills/${pattern}/SKILL.md`);
      for (const file of skillFiles) {
        prompt += "\n\n---\n\n" + fs.readFileSync(file, "utf-8");
      }
    }

    agents[agentId] = { prompt, ...parseConfig(agentId) };
  }

  return agents;
}
```

---

## 18. Proof of Work (validation QA)

Apres l'implementation par sub-agent-dev, le sub-agent-qa valide le travail :

```typescript
async function runProofOfWork(ticket, trace, agents, config) {
  const qaPrompt = `
    Valide le travail sur la branche ${trace.branch} :
    1. npm run build
    2. npm test
    3. npm run lint
    4. npx tsc --noEmit

    Retourne un JSON avec le resultat de chaque check.
  `;

  const result = await spawnSubAgent(
    agents["sub-agent-qa"].prompt,
    qaPrompt,
    ["Bash", "Read"],
    10 * 60 * 1000  // 10 min
  );

  const parsed = JSON.parse(result);

  if (parsed.status === "PASS") {
    // Tout est vert → LANDING
    await transition(ticket.id, "LANDING");
  } else {
    // Echec → relancer sub-agent-dev avec le feedback
    await retryWithFeedback(ticket, parsed.errors);
  }
}
```

### Sortie attendue du QA

```json
{
  "status": "PASS",
  "checks": {
    "build": true,
    "tests": true,
    "lint": true,
    "types": true
  },
  "errors": [],
  "summary": "Build OK, Tests OK, Lint OK, Types OK"
}
```

---

## 19. Landing strategy (human-gate)

**Principe** : un humain doit toujours approuver le merge. Jamais d'auto-merge.

```typescript
async function executeLanding(ticket, trace) {
  // 1. Poster la PR dans Slack
  await slack.chat.postMessage({
    channel: thread.channel,
    thread_ts: thread.threadTs,
    text: [
      `:rocket: *PR prete pour review*`,
      `> ${trace.pr_url}`,
      ``,
      `*Fichiers modifies :* ${trace.files_modified.join(", ")}`,
      `*PoW :* :white_check_mark: Build, Tests, Lint, Types`,
      ``,
      `Repondez "merge" pour merger, ou laissez un commentaire.`,
    ].join("\n"),
  });

  // 2. Attendre la reponse dans le thread
  // (le slack-poller detectera "merge" et executera gh pr merge)
}

async function mergePR(prUrl: string) {
  // Merge via gh CLI
  execSync(`gh pr merge ${prUrl} --squash --delete-branch`, {
    cwd: WORKSPACE,
    env: { ...process.env, GH_TOKEN: GITHUB_TOKEN },
  });
}
```

### Politique de merge

| Niveau | Quand | Action |
|--------|-------|--------|
| **Branches feature** | Apres PoW vert | PR creee, attente merge humain |
| **Branche main** | Jamais auto-merge | Seul l'humain merge |
| **Production** | Jamais auto-deploy | Confirmation humaine obligatoire |

---

## 20. Circuit breaker et resilience

### Circuit breaker

Si le ServiceDesk ou l'API Claude echouent 5 fois consecutives, l'orchestrator passe en mode "circuit ouvert" pendant 5 minutes :

```typescript
let failureCount = 0;
let circuitOpen = false;

function recordFailure() {
  failureCount++;
  if (failureCount >= 5) {
    circuitOpen = true;
    setTimeout(() => {
      circuitOpen = false;
      failureCount = 0;
    }, 5 * 60 * 1000);  // 5 min
    notifySlack("Circuit breaker ouvert — pause de 5 min");
  }
}

function recordSuccess() {
  failureCount = 0;
}
```

### Graceful shutdown

Sur `SIGTERM` (deploy, restart) :

```typescript
process.on("SIGTERM", async () => {
  console.log("SIGTERM recu — arret gracieux...");

  // 1. Arreter le polling
  isPolling = false;

  // 2. Attendre les runs actifs (drain)
  while (activeRuns > 0) {
    await sleep(1000);
  }

  // 3. Marquer les tickets en cours comme BLOCKED (pas FAILED)
  for (const [ticketId, thread] of activeThreads) {
    await updateStatus(ticketId, "BLOCKED", "Arret gracieux orchestrator");
  }

  // 4. Fermer les connexions
  process.exit(0);
});
```

### Crash recovery

Au redemarrage, l'orchestrator recupere ses threads actifs depuis le ServiceDesk :

```typescript
async function recoverActiveThreads() {
  // Chercher les tickets avec un thread Slack actif et un statut non-terminal
  const tickets = await callServiceDesk("list", {
    application_id: APPLICATION_ID,
    filters: { has_slack_thread: true, status_not_in: ["DONE", "FAILED"] },
  });

  for (const ticket of tickets) {
    activeThreads.set(ticket.id, {
      channel: ticket.metadata.slack_channel,
      threadTs: ticket.metadata.slack_thread_ts,
      lastProcessedTs: ticket.metadata.last_processed_ts || ticket.metadata.slack_thread_ts,
      ticketId: ticket.id,
    });
  }

  console.log(`Recupere ${activeThreads.size} threads actifs`);
}
```

---

## 21. Monitoring et observabilite

### Health endpoint

L'orchestrator expose un endpoint `/health` :

```typescript
import http from "http";

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "healthy",
      version: "v5",
      uptime_s: Math.floor(process.uptime()),
      active_runs: activeRuns,
      active_threads: activeThreads.size,
      circuit_breaker: circuitOpen ? "open" : "closed",
      is_polling: isPolling,
    }));
  }
});

server.listen(8080);
```

### Suivi des couts

Chaque execution de sub-agent retourne des metriques de tokens :

```typescript
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  totalCostUSD: number;
  numTurns: number;
}
```

Ces metriques sont stockees dans les metadata du ticket pour analyse.

### Logs

Tous les logs sont prefixes avec l'agent ID et incluent un trace ID unique par ticket :

```
[dev-orchestrator] [trace:abc123] Ticket T-456 → ANALYZING
[dev-orchestrator] [trace:abc123] sub-agent-analyst spawne
[dev-orchestrator] [trace:abc123] Analyse complete: feature/medium/low-risk
[dev-orchestrator] [trace:abc123] Plan poste dans #dev-agent (thread: 1234567890.123456)
```

---

## 22. Checklist pour nouveau projet

### Etape 1 : Setup initial

- [ ] Creer le repo avec la structure `src/`, `agents/`, `skills/`, `infra/`
- [ ] Copier le `package.json` et ajuster le nom
- [ ] Copier le `tsconfig.json`
- [ ] Copier le `Dockerfile.agent` et `entrypoint-v5.sh`

### Etape 2 : Definir les agents

- [ ] Ecrire `agents/dev-orchestrator/agent.md`
- [ ] Ecrire `agents/sub-agent-analyst/agent.md`
- [ ] Ecrire `agents/sub-agent-dev/agent.md`
- [ ] Ecrire `agents/sub-agent-qa/agent.md`
- [ ] (Optionnel) `agents/sub-agent-security/agent.md`
- [ ] (Optionnel) `agents/sub-agent-devops/agent.md`

### Etape 3 : Ecrire les skills

- [ ] Skills transversaux (logging, communication, escalation)
- [ ] Skills dev (implementation, tests, PR workflow)
- [ ] Skills specifiques au domaine

### Etape 4 : Implementer l'orchestrator

- [ ] Boucle de polling tickets
- [ ] Machine a etats
- [ ] Spawn des sub-agents via Agent SDK
- [ ] Proof of Work
- [ ] Landing strategy
- [ ] Health endpoint
- [ ] Graceful shutdown

### Etape 5 : Integration Slack

- [ ] Creer une app Slack avec bot token
- [ ] Permissions : `chat:write`, `channels:history`, `reactions:write`
- [ ] Inviter le bot dans le canal cible
- [ ] Configurer `SLACK_BOT_TOKEN`

### Etape 6 : Docker Compose (dev local)

- [ ] Ecrire le `docker-compose.yml`
- [ ] Creer le `.env` avec toutes les variables
- [ ] Tester `docker compose up -d`
- [ ] Verifier `curl localhost:8080/health`

### Etape 7 : Deploiement Fly.io

- [ ] Ecrire le `fly.toml`
- [ ] `fly apps create`
- [ ] `fly volumes create workspace`
- [ ] `fly secrets set ...`
- [ ] `fly deploy`
- [ ] Verifier les logs : `fly logs`
- [ ] Verifier le health : `curl https://app.fly.dev/health`

### Etape 8 : Validation

- [ ] Creer un ticket test dans le ServiceDesk
- [ ] Verifier que l'orchestrator le detecte
- [ ] Verifier que l'analyse se fait dans Slack
- [ ] Repondre "go" et verifier l'execution
- [ ] Verifier la PR creee sur GitHub
- [ ] Verifier le PoW (build, tests, lint, types)
- [ ] Merger manuellement et verifier DONE

---

## Couts estimes

| Composant | Cout mensuel |
|-----------|-------------|
| Fly.io (1 machine shared-cpu-1x, 512MB) | ~$5-10 |
| Volume 10GB | ~$1.50 |
| Anthropic API (10 tickets/jour, mix Opus/Sonnet) | ~$200-500 |
| **Total** | **~$210-510/mois** |

Le cout principal est l'API Anthropic. Optimisations possibles :
- Utiliser Sonnet pour l'analyst au lieu d'Opus
- Reduire le nombre de turns (`maxTurns`)
- Cacher le contexte projet (prompt caching automatique)

---

## References

- [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents/claude-agent-sdk)
- [Fly.io docs](https://fly.io/docs/)
- [@slack/web-api](https://slack.dev/node-slack-sdk/web-api)
- [MCP Protocol](https://modelcontextprotocol.io/)
