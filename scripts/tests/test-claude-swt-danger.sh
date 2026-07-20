#!/usr/bin/env bash
# ============================================================
# test-claude-swt-danger.sh — v1.0.0
# Contrat de la variante claude-swt-danger : même logique de session que
# claude-swt, mais lance `claude --dangerously-skip-permissions`.
#
# Invariants :
#   (1) claude-swt-danger est définie + sourçable.
#   (2) Elle passe --dangerously-skip-permissions à claude.
#   (3) claude-swt « normale » ne saute PAS les permissions.
#   (4) Anti-duplication : la logique worktree (worktree add) n'est écrite
#       qu'UNE fois — les deux commandes délèguent à une fonction interne.
#   (5) Un avertissement est affiché en mode danger.
#
# Discriminant : ROUGE sur claude-swt.sh v1.2.0 (pas de variante danger), VERT après.
#
# Usage : bash scripts/tests/test-claude-swt-danger.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SNIPPET="${ROOT}/scripts/shell/claude-swt.sh"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

echo "== Contrat claude-swt-danger =="
[ -f "$SNIPPET" ] || ko "snippet introuvable: $SNIPPET"

if [ -f "$SNIPPET" ]; then
  # (1) fonction définie
  grep -qE '^claude-swt-danger\(\)' "$SNIPPET" \
    && ok "claude-swt-danger() est définie" || ko "claude-swt-danger() absente"

  # (1bis) sourçable sans effet de bord + fonction exposée
  if bash -c "source '$SNIPPET' >/dev/null 2>&1 && declare -f claude-swt-danger >/dev/null 2>&1"; then
    ok "snippet sourçable et claude-swt-danger exposée"
  else
    ko "snippet non sourçable ou claude-swt-danger non exposée"
  fi

  # (2) passe --dangerously-skip-permissions à claude
  grep -qE 'claude --dangerously-skip-permissions' "$SNIPPET" \
    && ok "lance 'claude --dangerously-skip-permissions'" || ko "--dangerously-skip-permissions absent"

  # (4) anti-duplication : la logique worktree n'apparaît qu'UNE fois
  n_wt=$(grep -cE 'worktree add "\$wt"' "$SNIPPET")
  if [ "$n_wt" -eq 1 ]; then
    ok "logique worktree non dupliquée (worktree add ×1)"
  else
    ko "logique worktree dupliquée ou absente (worktree add ×$n_wt — attendu 1)"
  fi

  # (4bis) les deux commandes délèguent à une fonction interne partagée
  grep -qE '^_claude-swt-launch\(\)' "$SNIPPET" \
    && ok "fonction interne partagée _claude-swt-launch définie" \
    || ko "pas de fonction interne partagée (risque de duplication)"

  # (5) avertissement visible en mode danger
  grep -qiE 'danger|⚠|permissions? sautées|skip.*permission' "$SNIPPET" \
    && ok "avertissement de mode danger présent" || ko "aucun avertissement de mode danger"

  # (3) la commande normale ne force pas le mode danger inconditionnellement : le
  # chemin `else` lance `claude` SANS --dangerously-skip-permissions. Depuis
  # T-20260720-0004 la ligne porte une prompt optionnelle (`claude "$@"`), d'où le
  # `"$@"?` toléré — mais jamais le flag danger sur ce chemin.
  grep -qE '^[[:space:]]*claude( "\$@")?[[:space:]]*$' "$SNIPPET" \
    && ok "chemin normal (claude sans flag danger) préservé" || ko "chemin normal sans flag danger introuvable"
fi

echo ""
P=$(wc -l < "$PASS_FILE" | tr -d ' '); F=$(wc -l < "$FAIL_FILE" | tr -d ' ')
echo "Résultat : ${P} OK, ${F} KO"
[ "$F" -eq 0 ] && { echo "✅ PASS"; exit 0; } || { echo "❌ FAIL"; exit 1; }
