#!/usr/bin/env bash
# ============================================================
# test-close-merged-branches.sh — v1.0.0
# Vérifie la classification et la fermeture des branches mergées.
#
# Scénarios (repo jetable) :
#   featX        squash-mergée dans main      → MERGED (détecté malgré le squash)
#   featReal     vraie merge (--no-ff)        → MERGED
#   featY        travail non mergé            → KEEP
#   staging      protégée                     → PROTECTED
#   wt/<ts>      socle de worktree            → PROTECTED
#   featCurrent  mergée MAIS checked-out      → CURRENT (jamais supprimée)
#
# Usage : bash .claude/skills/end-session/tests/test-close-merged-branches.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/close-merged-branches.sh
source "${SCRIPT_DIR}/../lib/close-merged-branches.sh"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"; [ -n "${REPO:-}" ] && rm -rf "$REPO"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

commit() { echo "$1" > "$1.txt"; git add -A; git commit -qm "$1"; }

build_repo() {
  local r; r="$(mktemp -d)"
  (
    cd "$r"
    git init -q; git config user.email t@t.io; git config user.name t; git config commit.gpgsign false
    commit init; git branch -m main
    git branch staging
    git branch wt/20260101-000000
    git checkout -q -b featX main;       commit fx; git checkout -q main; git merge --squash featX -q; git commit -qm "squash featX" >/dev/null
    git checkout -q -b featReal main;    commit fr; git checkout -q main; git merge --no-ff featReal -qm "merge featReal"
    git checkout -q -b featY main;       commit fy
    git checkout -q -b featCurrent main; commit fc; git checkout -q main; git merge --squash featCurrent -q; git commit -qm "squash featCurrent" >/dev/null
    git checkout -q featCurrent   # reste checked-out → CURRENT
  ) >/dev/null 2>&1
  echo "$r"
}

echo "== Classification (base = main) =="
REPO="$(build_repo)"
cls="$(cd "$REPO" && cmb_classify main)"
check() { echo "$cls" | grep -qx "$1" && ok "$1" || ko "attendu '$1' dans la classification :\n$cls"; }
check "MERGED featX"
check "MERGED featReal"
check "KEEP featY"
check "PROTECTED staging"
check "PROTECTED wt/20260101-000000"
check "CURRENT featCurrent"
rm -rf "$REPO"; REPO=""

echo "== Fermeture (cmb_close) — supprime les mergées, garde le reste =="
REPO="$(build_repo)"
(
  cd "$REPO"
  CMB_REMOTE="origin-inexistant" cmb_close main >/dev/null 2>&1
)
present() { ( cd "$REPO" && git show-ref --verify --quiet "refs/heads/$1" ); }
present featX     && ko "featX (mergée) aurait dû être supprimée" || ok "featX supprimée"
present featReal  && ko "featReal (mergée) aurait dû être supprimée" || ok "featReal supprimée"
present featY     && ok "featY (non mergée) conservée" || ko "featY ne devait PAS être supprimée"
present staging   && ok "staging (protégée) conservée" || ko "staging ne devait PAS être supprimée"
present wt/20260101-000000 && ok "wt-socle (protégée) conservée" || ko "wt-socle ne devait PAS être supprimée"
present featCurrent && ok "featCurrent (courante) conservée" || ko "featCurrent (courante) ne devait PAS être supprimée"
rm -rf "$REPO"; REPO=""

echo "== Dry-run — ne supprime rien =="
REPO="$(build_repo)"
( cd "$REPO" && CMB_DRY_RUN=1 CMB_REMOTE="origin-inexistant" cmb_close main >/dev/null 2>&1 )
present featX && ok "dry-run : featX conservée" || ko "dry-run n'aurait rien dû supprimer"
rm -rf "$REPO"; REPO=""

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"; FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
