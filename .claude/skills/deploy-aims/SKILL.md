---
name: deploy-aims
description: Deployer un AIMS v5 scaffold sur Fly.io. Valide le scaffold, teste en local (optionnel), cree l'app Fly.io, configure les secrets, deploie et verifie le health. Prerequis - /scaffold-aims deja execute.
license: MIT
metadata:
  author: somtech-pack
  version: "1.0.0"
  project: generic
---

# Deploy AIMS v5

Ce skill deploie un AIMS v5 deja scaffold sur Fly.io.

## Prerequis

- `/scaffold-aims` a ete execute — la structure `orbit/silo/aims/` existe
- `flyctl` CLI installe et authentifie (`fly auth login`)
- Les secrets sont prets (ANTHROPIC_API_KEY, SERVICEDESK_API_KEY, etc.)

## Etape 1 : Preflight

Verifier que ces fichiers existent :

```bash
ls orbit/silo/aims/src/orchestrator.ts    # ou dist/orchestrator.js
ls orbit/silo/aims/infra/Dockerfile.agent
ls orbit/silo/aims/infra/entrypoint-v5.sh
ls orbit/silo/aims/agents/dev-orchestrator/agent.md
ls orbit/silo/aims/fly.toml
```

Si un fichier manque → "Lancer `/scaffold-aims` d'abord."

Lire `fly.toml` pour extraire `FLY_APP_NAME` et `FLY_REGION`.

## Etape 2 : Collecter les secrets

Verifier `.env` dans `orbit/silo/aims/` ou demander a l'utilisateur :

| Secret | Source | Validation |
|--------|--------|-----------|
| `ANTHROPIC_API_KEY` | `.env` ou demander | Commence par `sk-ant-` |
| `SERVICEDESK_API_KEY` | `.env` ou demander | Commence par `sk_live_` |
| `AIMS_APPLICATION_ID` | `.env` ou demander | Format UUID |
| `SLACK_BOT_TOKEN` | Demander (optionnel) | Commence par `xoxb-` ou vide |
| `GITHUB_TOKEN` | `gh auth token` ou demander | Commence par `ghp_` ou `github_pat_` |
| `GITHUB_OWNER` | `.env` ou demander | Non vide |
| `GITHUB_REPO` | `.env` ou demander | Non vide |

## Etape 3 : Validation locale (optionnel, recommande)

Proposer a l'utilisateur : "Tester en local avec Docker avant de deployer sur Fly.io ?"

Si oui :
```bash
cd orbit/silo/aims
docker compose up -d dev-orchestrator
# Attendre 30s
sleep 30
curl -s http://localhost:8080/health | jq .
# Verifier status: "healthy"
docker compose down
```

Si echec → afficher les logs (`docker compose logs dev-orchestrator`) et arreter.

## Etape 4 : Fly.io setup

Lire `fly.toml` pour extraire `FLY_ORG` (champ `org`). Si absent, demander a l'utilisateur.

```bash
# Creer l'app dans l'organisation du client (idempotent — ignore si elle existe deja)
fly apps create FLY_APP_NAME --org FLY_ORG 2>/dev/null || true

# Creer le volume pour le workspace git (10GB)
fly volumes create workspace --size 10 --region FLY_REGION -a FLY_APP_NAME

# Configurer tous les secrets
fly secrets set \
  ANTHROPIC_API_KEY="..." \
  SERVICEDESK_MCP_URL="https://vdpuktsqrecdxbmweate.supabase.co/functions/v1/servicedesk-mcp" \
  SERVICEDESK_API_KEY="..." \
  AIMS_APPLICATION_ID="..." \
  SLACK_BOT_TOKEN="..." \
  GITHUB_TOKEN="..." \
  GITHUB_OWNER="..." \
  GITHUB_REPO="..." \
  -a FLY_APP_NAME
```

> **IMPORTANT** : Ne jamais logger les valeurs des secrets. Afficher seulement "Secret X configure" ou "Secret X absent (optionnel)".

## Etape 5 : Deploy

```bash
cd orbit/silo/aims
fly deploy -a FLY_APP_NAME --wait-timeout 300
```

Attendre que le deploiement soit complet (machine running).

## Etape 6 : Verification

```bash
# Statut de l'app
fly status -a FLY_APP_NAME

# Health endpoint
curl -s https://FLY_APP_NAME.fly.dev/health | jq .
# Doit retourner: {"status": "healthy", ...}

# Verifier que le polling demarre dans les logs
fly logs -a FLY_APP_NAME | head -50
# Chercher: "polling" ou "ServiceDesk" ou "AIMS"
```

## Etape 7 : Test E2E (optionnel)

Proposer a l'utilisateur : "Creer un ticket test pour verifier la detection ?"

Si oui :
1. Creer un ticket test via le ServiceDesk MCP :
```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tickets",
    "arguments": {
      "action": "create",
      "title": "[TEST] Ticket de validation AIMS",
      "description": "Ticket automatique pour valider le deploiement AIMS. A supprimer.",
      "application_id": "APPLICATION_ID",
      "type": "request",
      "priority": "low"
    }
  }
}
```
2. Attendre 60s max
3. Verifier dans les logs que l'orchestrator detecte le ticket
4. Verifier que le ticket passe en `ANALYZING` (ou `PLANNING` si Slack actif)
5. Supprimer le ticket test

## Etape 8 : Resume

Afficher :
```
AIMS v5 deploye avec succes !

  App URL  : https://FLY_APP_NAME.fly.dev
  Health   : https://FLY_APP_NAME.fly.dev/health
  Logs     : fly logs -a FLY_APP_NAME
  Status   : fly status -a FLY_APP_NAME

Prochaines etapes :
  - Creer un ticket dans le ServiceDesk pour tester
  - Verifier que l'architecte recoit le plan dans Slack
  - Approuver avec "go" pour lancer l'execution
```

Mettre a jour `orbit/silo/aims/AIMS-SETUP-CHECKLIST.md` — cocher les etapes deploy.

## Rollback en cas d'echec

| Etape qui echoue | Etat laisse | Action |
|-------------------|------------|--------|
| Validation locale (3) | Container arrete | Corriger le code, relancer `/deploy-aims` |
| `fly apps create` (4) | App creee vide | Laisser (idempotent), relancer `/deploy-aims` |
| `fly volumes create` (4) | Volume cree | Laisser (~$1.50/mois), relancer `/deploy-aims` |
| `fly deploy` (5) | App creee, deploy fail | Corriger, `fly deploy` manuellement |
| Health check (6) | Machine running, unhealthy | `fly logs`, corriger, relancer |

Pour supprimer tout :
```bash
fly apps destroy FLY_APP_NAME --yes
```
