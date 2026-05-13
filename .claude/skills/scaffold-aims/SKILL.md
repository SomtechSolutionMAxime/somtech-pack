---
name: scaffold-aims
description: Generer la structure AIMS v5 (agents autonomes) dans un projet. Copie les templates depuis .claude/aims-template/, remplace les placeholders, installe les deps, compile TypeScript. Prerequis - somtech-pack deja installe via /somtech-pack-install (ou /somtech-pack-maj sur projet existant).
license: MIT
metadata:
  author: somtech-pack
  version: "1.0.0"
  project: generic
---

# Scaffold AIMS v5

Ce skill genere la structure complete pour deployer un orchestrator AIMS v5 (agents autonomes Claude) dans le projet courant.

## Prerequis

- Le somtech-pack a ete installe (via `/somtech-pack-install` ou `/somtech-pack-maj`) — le dossier `.claude/aims-template/` doit exister
- Le projet est un repo Git
- L'humain a prepare : application dans ServiceDesk, cle API, bot Slack (optionnel)

## Etape 1 : Preflight

```bash
# Verifier qu'on est dans un repo git
git rev-parse --show-toplevel

# Verifier que les templates sont installes
ls .claude/aims-template/infra/Dockerfile.agent
# Si absent → "Lancer /somtech-pack-install d'abord"

# Verifier si AIMS est deja scaffold
ls orbit/silo/aims/src/orchestrator.ts 2>/dev/null
# Si present ET dist/orchestrator.js existe → "AIMS deja scaffold. Ecraser ? (les fichiers generiques seront ecrases, l'orchestrator personnalise sera preserve)"
# Si present MAIS dist/ absent → scaffold partiel, safe a ecraser
```

## Etape 2 : Auto-detection

```bash
# Detecter GITHUB_OWNER et GITHUB_REPO
REMOTE_URL=$(git remote get-url origin 2>/dev/null)
# Parse: https://github.com/OWNER/REPO.git ou git@github.com:OWNER/REPO.git
GITHUB_OWNER=$(echo "$REMOTE_URL" | sed -E 's|.*[:/]([^/]+)/[^/]+\.git$|\1|')
GITHUB_REPO=$(echo "$REMOTE_URL" | sed -E 's|.*[:/][^/]+/([^/]+)\.git$|\1|')

# Detecter PROJECT_NAME
PROJECT_NAME=$(basename $(git rev-parse --show-toplevel))
```

## Etape 3 : Collecte des inputs

Demander a l'utilisateur :

| Parametre | Question | Validation |
|-----------|----------|-----------|
| `APPLICATION_ID` | "Quel est l'UUID de l'application dans le ServiceDesk ?" | Format UUID |
| `SERVICEDESK_API_KEY` | "Quelle est la cle API ServiceDesk (sk_live_...) ?" | Commence par `sk_live_` |
| `SLACK_CHANNEL` | "Quel canal Slack pour l'agent ? (optionnel, entrer pour skip)" | Commence par `#` ou vide |
| `FLY_ORG` | "Quelle organisation Fly.io pour ce client ?" | Nom d'org Fly.io valide |
| `FLY_REGION` | "Region Fly.io ? (defaut: yyz)" | Code region Fly.io |

Proposer les valeurs auto-detectees :
- `GITHUB_OWNER` : detecte → confirmer
- `GITHUB_REPO` : detecte → confirmer
- `PROJECT_NAME` : detecte → confirmer

## Etape 4 : Deriver FLY_APP_NAME

```
1. Prendre PROJECT_NAME (ex: "construction-gauthier")
2. Split par "-" → ["construction", "gauthier"]
3. Prendre la premiere lettre de chaque segment → "cg"
4. Si 1 seul segment → prendre les 3 premieres lettres (ex: "gauthier" → "gau")
5. Si >= 4 segments → prendre les 4 premiers (ex: "abc-def-ghi-jkl-mno" → "adgj")
6. Suffixer avec "-dev-orchestrator" → "cg-dev-orchestrator"
7. Tronquer a 30 caracteres max (limite Fly.io)
8. Presenter le nom derive a l'utilisateur pour confirmation
```

## Etape 5 : Copier les fichiers generiques

Source : `.claude/aims-template/`
Destination : `orbit/silo/aims/`

### Fichiers a copier (liste explicite, PAS de glob)

**src/lib/ (19 fichiers) :**
```
types.ts, agents.ts, servicedesk-client.ts, slack-client.ts, slack-poller.ts,
intent-classifier.ts, state-machine.ts, hooks.ts, graceful-shutdown.ts,
helpers.ts, trace.ts, file-handler.ts, preflight.ts, dual-view.ts,
ticket-processor.ts, response-handler.ts, proof-of-work.ts, landing.ts, index.ts
```

**agents/ (5 sub-agents) :**
```
sub-agent-analyst/agent.md
sub-agent-dev/agent.md
sub-agent-qa/agent.md
sub-agent-security/agent.md
sub-agent-devops/agent.md
```

**skills/ (7 categories) :**
```
transversal/, dev-workers/, dev-orchestrator/, clientele/,
security-auditor/, security-validator/, devops/
```
Copier avec toute l'arborescence (`cp -r`).

**infra/ (4 fichiers) :**
```
Dockerfile.agent, entrypoint-v5.sh, tsconfig.json, parse-yaml.js
```

## Etape 6 : Generer les fichiers depuis les templates

Pour chaque fichier `.template.*`, lire le contenu et remplacer les placeholders :

| Source template | Destination | Placeholders |
|-----------------|-------------|-------------|
| `orchestrator.template.ts` | `orbit/silo/aims/src/orchestrator.ts` | Aucun (copie directe) |
| `agents/dev-orchestrator/agent.template.md` | `orbit/silo/aims/agents/dev-orchestrator/agent.md` | `{{FLY_APP_NAME}}` |
| `agents/dev-orchestrator/brief.template.yaml` | `orbit/silo/aims/agents/dev-orchestrator/brief.yaml` | Aucun (deja generique) |
| `configs/fly.toml.template` | `orbit/silo/aims/fly.toml` | `{{FLY_APP_NAME}}`, `{{FLY_ORG}}`, `{{FLY_REGION}}`, `{{PROJECT_NAME}}` |
| `configs/docker-compose.yml.template` | `orbit/silo/aims/docker-compose.yml` | `{{PROJECT_NAME}}` |
| `infra/package.json.template` | `orbit/silo/aims/infra/package.json` | `{{PROJECT_NAME}}` |
| `configs/.env.example` | `orbit/silo/aims/.env.example` | Aucun (copie directe) |

## Etape 7 : Generer AIMS-CONNEXIONS.md

Creer `orbit/silo/aims/AIMS-CONNEXIONS.md` avec le contenu suivant (remplacer les placeholders par les vraies valeurs collectees) :

```markdown
# Connexions AIMS — {PROJECT_NAME}

## ServiceDesk MCP

| Parametre | Valeur |
|-----------|--------|
| **URL** | `https://vdpuktsqrecdxbmweate.supabase.co/functions/v1/servicedesk-mcp` |
| **Auth** | Header `Authorization: Bearer <SERVICEDESK_API_KEY>` |
| **Protocole** | JSON-RPC 2.0 |
| **Application ID** | `{APPLICATION_ID}` |

### Format d'appel

POST sur l'URL avec :
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tickets",
    "arguments": {
      "action": "<action>",
      ...
    }
  }
}

### Actions disponibles

| Action | Arguments | Description |
|--------|-----------|-------------|
| `silo_discover` | `application_id` | Retourne {pending_analysis, pending_review, ready_for_dev} |
| `get` | `id` | Ticket complet avec comments et metadata |
| `list` | `application_id`, `status?`, `limit?` | Lister les tickets filtres |
| `update` | `id`, `run_status`, `trace_id`, `agent_id`, `extra?` | Mettre a jour statut + metadata |
| `add_comment` | `id`, `content`, `author_label` | Commentaire dual-view |

### Mapping RunStatus → TicketStatus

| RunStatus | TicketStatus |
|-----------|-------------|
| ANALYZING | in_progress |
| PLANNING | in_progress |
| APPROVED | in_progress |
| RUNNING | in_progress |
| BLOCKED | in_review |
| VALIDATING | qa |
| LANDING | qa |
| DONE | completed |
| FAILED | in_progress (reste visible pour action manuelle) |

### Retry et circuit breaker

- 2 retries max par appel, 1s backoff
- 15s timeout par requete
- Circuit breaker : 5 echecs consecutifs → pause 5 min

## Slack

| Parametre | Valeur |
|-----------|--------|
| **Bot Token** | Env var SLACK_BOT_TOKEN |
| **Canal** | {SLACK_CHANNEL} |
| **Permissions** | chat:write, channels:history, reactions:write |
| **Mode degrade** | Sans token → auto-approve, pas de threads |

## GitHub

| Parametre | Valeur |
|-----------|--------|
| **Owner** | {GITHUB_OWNER} |
| **Repo** | {GITHUB_REPO} |
| **Token** | Env var GITHUB_TOKEN |
| **Branches** | aims/{ticket-id} |
| **Merge** | Human-gate (jamais auto-merge) |

## Anthropic API

| Parametre | Valeur |
|-----------|--------|
| **Cle** | Env var ANTHROPIC_API_KEY |
| **SDK** | @anthropic-ai/claude-agent-sdk ^0.2.71 |
| **Modeles** | Opus (analyst), Sonnet (dev, qa, security, devops) |
```

## Etape 8 : Generer .env pre-rempli

Creer `orbit/silo/aims/.env` avec les valeurs collectees :

```bash
ANTHROPIC_API_KEY=
SERVICEDESK_MCP_URL=https://vdpuktsqrecdxbmweate.supabase.co/functions/v1/servicedesk-mcp
SERVICEDESK_API_KEY={SERVICEDESK_API_KEY collectee}
AIMS_APPLICATION_ID={APPLICATION_ID collecte}
SLACK_BOT_TOKEN=
GITHUB_TOKEN=
GITHUB_OWNER={GITHUB_OWNER}
GITHUB_REPO={GITHUB_REPO}
POLL_INTERVAL=30
MAX_CONCURRENT_RUNS=2
MAX_RETRIES=2
```

Ajouter `orbit/silo/aims/.env` dans `.gitignore` du projet si pas deja present.

## Etape 9 : Generer AIMS-SETUP-CHECKLIST.md

Creer `orbit/silo/aims/AIMS-SETUP-CHECKLIST.md` :

```markdown
# AIMS Setup — {PROJECT_NAME}

## Fait par /scaffold-aims
- [x] Structure aims/ creee
- [x] Agents configures (5 sub-agents + orchestrator)
- [x] Skills copies ({nombre} skills)
- [x] Infra Docker prete
- [x] TypeScript compile (ou echec a corriger)
- [x] AIMS-CONNEXIONS.md genere
- [x] .env pre-rempli

## A faire avant deploy
- [ ] Obtenir ANTHROPIC_API_KEY et ajouter dans .env
- [ ] Configurer le bot Slack et inviter dans {SLACK_CHANNEL}
- [ ] Verifier AIMS_APPLICATION_ID dans ServiceDesk
- [ ] Tester en local : docker compose up -d dev-orchestrator
- [ ] Creer un ticket test dans ServiceDesk
- [ ] Lancer /deploy-aims quand pret
```

## Etape 10 : Generer VERSION

Creer `orbit/silo/aims/VERSION` :

```
AIMS_TEMPLATE_VERSION=5.0.0
SCAFFOLDED_AT={date ISO courante}
PACK_COMMIT={hash du dernier commit du repo}
```

## Etape 11 : Documentation projet (optionnel)

> Le pack ne pousse plus de `.claude/CLAUDE.md` projet (cf. D-20260513-0009). Cette etape ne s'applique que si le projet a deja un `.claude/CLAUDE.md` local cree par ses mainteneurs.

Si le projet a un `.claude/CLAUDE.md` local, **proposer** (sans imposer) d'y ajouter cette section :

```markdown
## Architecture AIMS v5

### Skills disponibles
| Skill | Usage |
|-------|-------|
| `/scaffold-aims` | Regenerer la structure AIMS |
| `/deploy-aims` | Deployer AIMS sur Fly.io |

### Documentation
- Connexions : `orbit/silo/aims/AIMS-CONNEXIONS.md`
- Reference : `orbit/silo/aims/docs/AIMS-v5-REFERENCE.md`
- Checklist : `orbit/silo/aims/AIMS-SETUP-CHECKLIST.md`

### Variables d'environnement requises
Voir `orbit/silo/aims/.env.example`
```

Si pas de CLAUDE.md projet local : skipper cette etape, l'information reste accessible via le README du dossier `orbit/silo/aims/`.

## Etape 12 : npm install + TypeScript build

```bash
cd orbit/silo/aims/infra
npm install
npx tsc -p tsconfig.json
```

Si le build echoue, afficher les erreurs. Ne pas arreter le scaffold — les fichiers sont copies, l'utilisateur peut corriger.

## Etape 13 : Resume

Afficher :
- Nombre de fichiers copies
- Build TypeScript OK/FAIL
- FLY_APP_NAME derive
- Prochaines etapes (corriger erreurs si build fail, tester local, puis `/deploy-aims`)

## Idempotence

- Si `orbit/silo/aims/` existe et contient `dist/orchestrator.js` → scaffold complet, demander confirmation
- Si `orbit/silo/aims/` existe SANS `dist/` → scaffold partiel, proposer de recommencer
- Les fichiers generiques (src/lib/, agents/sub-agent-*, skills/) sont TOUJOURS ecrases
- Les fichiers generes (CONNEXIONS, CHECKLIST) sont regeneres
- `orchestrator.ts` est ecrase SEULEMENT si la premiere ligne contient `// AIMS-TEMPLATE-GENERATED`
- Si l'orchestrator a ete personnalise (premiere ligne differente), il est PRESERVE
