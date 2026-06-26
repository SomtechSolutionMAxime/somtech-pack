#!/usr/bin/env bash
# ============================================================
# test-plan-servicedesk-debug.sh — v1.0.0
# Cohérence du contrat du skill plan-servicedesk pour le param `debug`
# (invoque superpowers:systematic-debugging comme alternative au brainstorm).
#
# Anti-drift : si `debug` est annoncé dans l'argument-hint, il DOIT être
# câblé partout (parsing, matrice, invocation du skill, exclusivité). Un
# param documenté en surface mais pas relié au comportement = bug réel.
#
# Usage : bash scripts/tests/test-plan-servicedesk-debug.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SKILL="${ROOT}/.claude/skills/plan-servicedesk/SKILL.md"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

echo "== Contrat plan-servicedesk : param debug =="
[ -f "$SKILL" ] || { ko "SKILL.md introuvable: $SKILL"; }

if [ -f "$SKILL" ]; then
  grep -qE '^argument-hint:.*\bdebug\b' "$SKILL" \
    && ok "argument-hint annonce 'debug'" || ko "argument-hint sans 'debug'"

  grep -q 'superpowers:systematic-debugging' "$SKILL" \
    && ok "invoque superpowers:systematic-debugging" || ko "systematic-debugging jamais invoqué (param non câblé)"

  # STOP doit être ANCRÉ à l'exclusivité (la matrice porte « brain + debug → STOP »).
  # Un grep STOP non scopé serait un faux négatif : STOP existe déjà ailleurs (gate Phase D).
  grep -qiE 'mutuellement exclusif' "$SKILL" && grep -qE 'brain.*\+.*debug.*STOP' "$SKILL" \
    && ok "exclusivité brainstorming/debug documentée + STOP ancré à la matrice" || ko "exclusivité brainstorming/debug non documentée (ou STOP non ancré)"

  grep -qE '\bdebug D-xxxx\b' "$SKILL" \
    && ok "matrice de comportement couvre 'debug D-xxxx'" || ko "matrice ne couvre pas 'debug D-xxxx'"

  # anti-drift : les DEUX modes coexistent (on n'a pas remplacé brainstorming par debug)
  grep -q 'superpowers:brainstorming' "$SKILL" \
    && ok "brainstorming toujours présent (debug est un AJOUT, pas un remplacement)" \
    || ko "superpowers:brainstorming disparu — régression"
fi

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"
FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
