#!/bin/bash
set -euo pipefail

echo "╔══════════════════════════════════════════╗"
echo "║  AIMS v5 Orchestrator                     "
echo "║  Agent: ${AGENT_ID}                       "
echo "║  Silo: ${SILO_NAME}                      "
echo "║  Started: $(date -u +%Y-%m-%dT%H:%M:%SZ) "
echo "╚══════════════════════════════════════════╝"

# ─── Verifications ───
for var in ANTHROPIC_API_KEY SERVICEDESK_MCP_URL SERVICEDESK_API_KEY AIMS_APPLICATION_ID; do
  if [ -z "${!var:-}" ]; then
    echo "FATAL: ${var} non definie"
    exit 1
  fi
done

# v5: Slack direct (optional, degraded mode without it)
if [ -z "${SLACK_BOT_TOKEN:-}" ]; then
  echo "[entrypoint] WARNING: SLACK_BOT_TOKEN not set — running in degraded mode (no Slack)"
fi

# ─── Recuperer la fiche technique depuis ServiceDesk ───
echo "Recuperation de la fiche technique..."
APP_DATA=$(curl -sf -H "Authorization: Bearer ${SERVICEDESK_API_KEY}" \
  -H "Content-Type: application/json" \
  "${SERVICEDESK_MCP_URL}" \
  -d '{"tool":"servicedesk_applications_get","arguments":{"application_id":"'"${AIMS_APPLICATION_ID}"'"}}' \
  2>/dev/null || echo '{}')

# Extraire les infos du repo
REPO_URL=$(echo "$APP_DATA" | jq -r '.metadata.repo.url // .repo_url // .github_repo_url // empty' 2>/dev/null || echo "")
REPO_BRANCH=$(echo "$APP_DATA" | jq -r '.metadata.repo.default_branch // "main"' 2>/dev/null || echo "main")
APP_NAME=$(echo "$APP_DATA" | jq -r '.name // .nom // "unknown"' 2>/dev/null || echo "unknown")

# Fallback sur env vars
REPO_URL="${REPO_URL:-${CLIENT_REPO_URL:-}}"
REPO_BRANCH="${REPO_BRANCH:-${CLIENT_REPO_BRANCH:-main}}"

echo "Application: ${APP_NAME}"
echo "Repo URL: ${REPO_URL:-non configure}"
echo "Branche: ${REPO_BRANCH}"

# ─── Cloner le repo client si necessaire ───
WORKSPACE="${WORKSPACE:-/silo/workspace}"
if [ -n "${REPO_URL}" ] && [ ! -d "${WORKSPACE}/.git" ]; then
  echo "Clonage du repo client..."
  CLONE_OK=false
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    AUTH_URL=$(echo "$REPO_URL" | sed "s|https://|https://${GITHUB_TOKEN}@|")
    if git clone --branch "${REPO_BRANCH}" "$AUTH_URL" "${WORKSPACE}" 2>&1; then
      CLONE_OK=true
    fi
  else
    if git clone --branch "${REPO_BRANCH}" "$REPO_URL" "${WORKSPACE}" 2>&1; then
      CLONE_OK=true
    fi
  fi
  if [ "$CLONE_OK" = true ]; then
    echo "Repo clone dans ${WORKSPACE}"
    cd "${WORKSPACE}"
    git config user.name "AIMS Agent (${AGENT_ID})"
    git config user.email "aims-${AGENT_ID}@somtech.ca"
    cd /silo
  else
    echo "WARN: Echec du clonage — l'agent continue sans workspace"
  fi
elif [ -d "${WORKSPACE}/.git" ]; then
  echo "Workspace existant — mise a jour..."
  cd "${WORKSPACE}"
  git config user.name "AIMS Agent (${AGENT_ID})"
  git config user.email "aims-${AGENT_ID}@somtech.ca"
  git pull --rebase origin "${REPO_BRANCH}" 2>/dev/null || true
  cd /silo
fi

# ─── Configurer gh CLI si GITHUB_TOKEN est disponible ───
if [ -n "${GITHUB_TOKEN:-}" ]; then
  echo "${GITHUB_TOKEN}" | gh auth login --with-token 2>/dev/null && \
    echo "gh CLI authentifie" || echo "WARN: gh auth login echoue"
fi

# ─── Exporter les variables pour le processus Node.js ───
export WORKSPACE="${WORKSPACE}"

# ─── Lancer l'orchestrator TypeScript ───
echo "Demarrage de l'orchestrator v5..."
exec node /silo/dist/orchestrator.js
