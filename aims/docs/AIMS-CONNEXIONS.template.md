# Connexions AIMS — {{PROJECT_NAME}}

> Ce fichier est genere par `/scaffold-aims`. Il est la source de verite pour l'agent qui opere l'orchestrator.

## ServiceDesk MCP

| Parametre | Valeur |
|-----------|--------|
| **URL** | `https://vdpuktsqrecdxbmweate.supabase.co/functions/v1/servicedesk-mcp` |
| **Auth** | Header `Authorization: Bearer <SERVICEDESK_API_KEY>` |
| **Protocole** | JSON-RPC 2.0 |
| **Application ID** | `{{APPLICATION_ID}}` |

### Format d'appel

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tickets",
    "arguments": {
      "action": "<action>",
      "<arg>": "<value>"
    }
  }
}
```

### Actions disponibles

| Action | Arguments | Description |
|--------|-----------|-------------|
| `silo_discover` | `application_id` | Retourne `{pending_analysis, pending_review, ready_for_dev}` |
| `get` | `id` | Ticket complet avec comments et metadata |
| `list` | `application_id`, `status?`, `limit?` | Lister les tickets filtres |
| `update` | `id`, `run_status`, `trace_id`, `agent_id`, `extra?` | Mettre a jour statut + metadata |
| `add_comment` | `id`, `content`, `author_label` | Commentaire dual-view |

### Mapping RunStatus → TicketStatus

| RunStatus | TicketStatus |
|-----------|-------------|
| `ANALYZING` | `in_progress` |
| `PLANNING` | `in_progress` |
| `APPROVED` | `in_progress` |
| `RUNNING` | `in_progress` |
| `BLOCKED` | `in_review` |
| `VALIDATING` | `qa` |
| `LANDING` | `qa` |
| `DONE` | `completed` |
| `FAILED` | `in_progress` (reste visible pour action manuelle) |

### Retry et circuit breaker

- 2 retries max par appel, 1s backoff
- 15s timeout par requete
- Circuit breaker : 5 echecs consecutifs → pause 5 min

## Slack

| Parametre | Valeur |
|-----------|--------|
| **Bot Token** | Env var `SLACK_BOT_TOKEN` |
| **Canal** | `{{SLACK_CHANNEL}}` |
| **Permissions requises** | `chat:write`, `channels:history`, `reactions:write` |
| **Mode degrade** | Sans token → auto-approve, pas de threads Slack |

## GitHub

| Parametre | Valeur |
|-----------|--------|
| **Owner** | `{{GITHUB_OWNER}}` |
| **Repo** | `{{GITHUB_REPO}}` |
| **Token** | Env var `GITHUB_TOKEN` |
| **Convention branches** | `aims/{ticket-id}` |
| **Merge policy** | Human-gate (jamais auto-merge sur main) |

## Anthropic API

| Parametre | Valeur |
|-----------|--------|
| **Cle** | Env var `ANTHROPIC_API_KEY` |
| **SDK** | `@anthropic-ai/claude-agent-sdk` ^0.2.71 |
| **Modeles** | Opus (analyst), Sonnet (dev, qa, security, devops) |
