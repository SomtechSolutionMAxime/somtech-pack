#!/usr/bin/env bash
# ============================================================
# test-worktree-aware-delete.sh — v1.0.0
# Test du plan de suppression worktree-aware de /merge.
#
# Reproduit un repo avec worktrees réels (principal + lié) et vérifie que
# mwt_plan_delete décide correctement PROTECTED / DELETE / DEFER.
#
# Scénarios :
#   A. staging                          → PROTECTED (jamais supprimée)
#   B. branche non checked-out          → DELETE (--delete-branch classique)
#   C. branche dans un worktree LIÉ     → DEFER <path> <timestamp>
#   D. branche dans le worktree PRINCIPAL → DELETE (flux gh classique OK)
#   E. détection worktree lié (mwt_in_linked_worktree) principal vs lié
#
# Usage : bash .claude/skills/merge/tests/test-worktree-aware-delete.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/worktree-aware-delete.sh
source "${SCRIPT_DIR}/../lib/worktree-aware-delete.sh"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

# --- Construction du repo jetable ---
ROOT="$(mktemp -d)"
REPO="${ROOT}/repo"
WT_LINKED="${ROOT}/20260623-120000"   # basename = timestamp claude-swt
git init -q "$REPO"
(
  cd "$REPO"
  git config user.email t@t.io; git config user.name t; git config commit.gpgsign false
  echo init > f.txt && git add -A && git commit -qm "init"   # branche par défaut
  git branch -m main 2>/dev/null || true
  git branch staging       # A
  git branch feat-nowt     # B : existe mais jamais checked-out
  git worktree add -q "$WT_LINKED" -b feat-session   # C : worktree lié
  git checkout -q -b feat-primary                    # D : checked-out dans le principal
)

echo "== Scénario A — staging → PROTECTED =="
plan="$(cd "$REPO" && mwt_plan_delete staging)"
[ "$plan" = "PROTECTED" ] && ok "staging protégée" || ko "attendu PROTECTED, obtenu '$plan'"

echo "== Scénario B — branche non checked-out → DELETE =="
plan="$(cd "$REPO" && mwt_plan_delete feat-nowt)"
[ "$plan" = "DELETE" ] && ok "suppression classique" || ko "attendu DELETE, obtenu '$plan'"

echo "== Scénario C — branche dans worktree LIÉ → DEFER =="
plan="$(cd "$REPO" && mwt_plan_delete feat-session)"
# Chemins résolus (macOS symlinke /var → /private/var via mktemp).
WT_LINKED_REAL="$(cd "$WT_LINKED" && pwd -P)"
read -r c_verb c_path c_ts <<<"$plan"
c_path_real="$( [ -d "$c_path" ] && cd "$c_path" && pwd -P )"
if [ "$c_verb" = "DEFER" ] && [ "$c_path_real" = "$WT_LINKED_REAL" ] && [ "$c_ts" = "20260623-120000" ]; then
  ok "DEFER avec chemin worktree + timestamp corrects"
else
  ko "attendu 'DEFER <${WT_LINKED_REAL}> 20260623-120000', obtenu '$plan'"
fi

echo "== Scénario D — branche dans worktree PRINCIPAL → DELETE =="
plan="$(cd "$REPO" && mwt_plan_delete feat-primary)"
[ "$plan" = "DELETE" ] && ok "branche du principal → flux gh classique" || ko "attendu DELETE, obtenu '$plan'"

echo "== Scénario E — détection worktree lié =="
( cd "$REPO" && ! mwt_in_linked_worktree ) && ok "principal: non-lié" || ko "le principal ne devrait PAS être détecté comme lié"
( cd "$WT_LINKED" && mwt_in_linked_worktree ) && ok "lié: détecté" || ko "le worktree lié devrait être détecté comme lié"

# --- Cleanup ---
( cd "$REPO" && git worktree remove --force "$WT_LINKED" 2>/dev/null || true )
rm -rf "$ROOT"

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"
FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
