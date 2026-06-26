#!/usr/bin/env bash
# ============================================================
# test-no-hardcoded-mcp-secrets.sh — v1.0.0
# Lint de garde (T-20260625-0014) : aucun snippet .mcp.json documenté
# dans le pack ne doit montrer une clé Bearer EN CLAIR.
#
# Règle : un header d'auth de serveur MCP HTTP documenté en JSON
#   "Authorization": "Bearer ..."
# DOIT référencer une variable d'environnement `${VAR}` — jamais une
# clé littérale (sk_..., <from-1password>, sk_live_...).
#
# Pourquoi : Claude Code expanse ${VAR} dans les headers HTTP
# (doc officielle). Coller la clé en clair dans un .mcp.json versionné
# = fuite de secret (incident T-20260625-0012). Le bon pattern est
# `Bearer ${SOMCRAFT_MCP_API_KEY}` + la valeur dans .env (gitignored),
# sourcé par claude-swt (T-20260625-0013).
#
# Ce qui n'est PAS visé : les `curl -H "Authorization: Bearer $VAR"`
# en shell (légitimes), qui n'ont pas la forme JSON "Authorization": "...".
#
# Usage : bash scripts/tests/test-no-hardcoded-mcp-secrets.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

echo "== Lint — clés Bearer en clair dans les snippets .mcp.json (.md) =="

# Toutes les lignes JSON "Authorization": "Bearer ..." du pack — snippets .md,
# templates .tpl ET fichiers .mcp.json/.json réels (committés = risque max).
# Hors node_modules et hors ce répertoire de tests.
hits="$(grep -rIn --include='*.md' --include='*.tpl' --include='*.json' \
  -E '"Authorization"[[:space:]]*:[[:space:]]*"Bearer ' "$ROOT" 2>/dev/null \
  | grep -v '/node_modules/' \
  | grep -v '/scripts/tests/' || true)"

# Conforme = "Bearer ${VAR}" PUR (pas de défaut `:-…` qui pourrait masquer un
# secret ni produire un Bearer vide → 401 silencieux). Tout le reste est une
# violation (clé littérale sk_…, placeholder <from-1password>, $VAR non accolé).
violations="$(printf '%s\n' "$hits" | grep -E '"Authorization"' | grep -vE '"Bearer \$\{[A-Z_][A-Z0-9_]*\}"' || true)"

if [ -z "$violations" ]; then
  ok "aucun secret Bearer en clair dans les snippets .mcp.json"
else
  ko "snippet(s) .mcp.json avec clé Bearer en clair (doit être \${VAR}) :"
  printf '%s\n' "$violations" | sed 's/^/       /'
fi

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"
FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
