# AIMS v5 — Reference Operationnelle

**Version:** 5.0
**Date:** 2026-03-12

## Architecture

1 container orchestrator + 5 subagents SDK-natifs.

```
ServiceDesk → Orchestrator (container unique)
                   ↕ Slack (bot token, polling API)
               Architecte
                   ↓ spawn via Agent SDK query()
         ┌────────┼─────────┬──────────┐
      analyst    dev       qa     security   devops
```

## Subagents

| Subagent | Role | Model | Timeout |
|----------|------|-------|---------|
| sub-agent-analyst | Analyse ticket, ontologie, constitution, securite | opus | 5 min |
| sub-agent-dev | Implementation, feature, bugfix, refactor | sonnet | 30 min |
| sub-agent-qa | Validation build/tests/lint/types (PoW) | sonnet | 10 min |
| sub-agent-security | Audit securite, RLS, Loi 25 | sonnet | 15 min |
| sub-agent-devops | Deploiement, infra, migrations | sonnet | 15 min |

## State Machine

```
QUEUED → ANALYZING → PLANNING → APPROVED → RUNNING → VALIDATING → LANDING → DONE
                        ↓                     ↓
                     BLOCKED ──────────→ PLANNING/RUNNING
```

### Transitions valides

```
QUEUED     → [ANALYZING]
ANALYZING  → [PLANNING, FAILED]
PLANNING   → [APPROVED, BLOCKED, FAILED]
APPROVED   → [RUNNING]
RUNNING    → [BLOCKED, VALIDATING, FAILED]
BLOCKED    → [PLANNING, RUNNING]
VALIDATING → [LANDING, RUNNING, FAILED]
LANDING    → [DONE, FAILED]
DONE       → []                              # Terminal
FAILED     → []                              # Terminal
```

> FAILED est terminal. Le retry se fait manuellement via le ServiceDesk.
> BLOCKED ne peut pas transitionner vers FAILED — attend une reponse humaine.

## Variables d'environnement

| Variable | Description | Defaut |
|----------|-------------|--------|
| ANTHROPIC_API_KEY | Cle API Anthropic | (requis) |
| SERVICEDESK_MCP_URL | URL du ServiceDesk MCP | (requis) |
| SERVICEDESK_API_KEY | Bearer token MCP | (requis) |
| AIMS_APPLICATION_ID | ID application ServiceDesk | (requis) |
| SLACK_BOT_TOKEN | Token Slack de l'orchestrator | (optionnel, mode degrade) |
| SLACK_POLL_INTERVAL | Intervalle polling Slack (sec) | 15 |
| POLL_INTERVAL | Intervalle polling ServiceDesk (sec) | 30 |
| MAX_CONCURRENT_RUNS | Runs simultanes max | 2 |
| MAX_RETRIES | Retries par ticket | 2 |
| WORKSPACE | Chemin workspace repo | /silo/workspace |
| GITHUB_TOKEN | Token GitHub | (optionnel) |

## Demarrage

```bash
# Docker local
docker compose up -d dev-orchestrator

# Fly.io
fly deploy -a <app-name>
```

## Troubleshooting

| Symptome | Cause probable | Action |
|----------|---------------|--------|
| "No SLACK_BOT_TOKEN" au demarrage | Token non configure | Configurer SLACK_BOT_TOKEN dans .env |
| Circuit breaker ouvert | 5+ echecs ServiceDesk | Verifier ServiceDesk, attendre 5 min |
| Tickets non detectes | AIMS_APPLICATION_ID incorrect | Verifier l'ID dans ServiceDesk |
| Mode degrade Slack | Token invalide ou absent | Verifier SLACK_BOT_TOKEN, les tickets continuent via ServiceDesk |
| `channel_not_found` | Channel Slack non resolu | Verifier `metadata.slack.channel_name` dans la fiche app ServiceDesk, s'assurer que le bot est invite dans le canal |
| Ticket reste en PLANNING | L'architecte n'a pas approuve | Repondre "go" dans le thread Slack du ticket |

## Flux PLANNING (v5 gate)

1. **ANALYZING** : L'orchestrator analyse le ticket (sub-agent-analyst)
2. **PLANNING** : Le plan est poste dans un thread Slack. L'architecte doit approuver.
   - `"go"` / `"ok"` / `"valide"` → APPROVED
   - Question → l'orchestrator repond et attend
   - `"reject"` / `"non"` → FAILED
3. **APPROVED** : L'execution demarre automatiquement apres approbation
4. **Mode degrade** (pas de Slack) : auto-approve, execution immediate
5. **Mode revision** : skip PLANNING, execution directe avec feedback QA

Le canal Slack est resolu depuis `metadata.slack.channel_name` de la fiche application ServiceDesk.
