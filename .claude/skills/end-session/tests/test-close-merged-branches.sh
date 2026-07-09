#!/usr/bin/env bash
# ============================================================
# test-close-merged-branches.sh — v1.2.0
# Classification + fermeture sûre des branches mergées.
#
# Scénarios (repo jetable) :
#   featX        squash-mergée + corroborée (CMB_CONFIRMED) → MERGED
#   featReal     vraie merge (--no-ff, ancêtre)             → MERGED
#   featY        travail non mergé                          → KEEP
#   featNetZero  add+revert (net-zéro, NON corroborée)      → REVIEW (jamais supprimée distante)
#   featConflict modifie un fichier que main change aussi    → KEEP (merge-tree conflit)
#   staging / wt/<ts>  protégées                            → PROTECTED
#   featCurrent  mergée MAIS checked-out                    → CURRENT
#   featX + worktree  mergée MAIS vivante dans un worktree  → WORKTREE (ni local ni distant)
#
# Le cas featNetZero est LE garde-fou anti-perte-de-données (faux positif merge-tree).
# Le cas worktree (D-20260709-0009) est LE garde-fou anti-décapitation de session vivante.
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
    set -e
    cd "$r"
    git init -q; git config user.email t@t.io; git config user.name t; git config commit.gpgsign false
    commit init; git branch -m main
    git branch staging
    git branch wt/20260101-000000
    echo base > z.txt; git add -A; git commit -qm "z base"        # fichier pour le conflit
    git checkout -q -b featX main;    commit fx; git checkout -q main; git merge --squash featX -q; git commit -qm "squash featX"
    git checkout -q -b featReal main; commit fr; git checkout -q main; git merge --no-ff featReal -qm "merge featReal"
    git checkout -q -b featY main;    commit fy
    git checkout -q -b featNetZero main; echo a > nz.txt; git add -A; git commit -qm "nz add"; git rm -q nz.txt; git commit -qm "nz revert"
    git checkout -q -b featConflict main; echo branch > z.txt; git add -A; git commit -qm "z branch"
    git checkout -q main; echo mainmod > z.txt; git add -A; git commit -qm "z mainmod"
    git checkout -q -b featCurrent main; commit fc; git checkout -q main; git merge --squash featCurrent -q; git commit -qm "squash featCurrent"
    git checkout -q featCurrent
  ) >/dev/null 2>&1
  echo "$r"
}

echo "== Classification (base=main, featX corroborée) =="
REPO="$(build_repo)"
cls="$(cd "$REPO" && CMB_CONFIRMED="featX" cmb_classify main)"
check() { echo "$cls" | grep -qx "$1" && ok "$1" || ko "attendu '$1' dans :\n$cls"; }
check "MERGED featX"
check "MERGED featReal"
check "KEEP featY"
check "REVIEW featNetZero"
check "KEEP featConflict"
check "PROTECTED staging"
check "PROTECTED wt/20260101-000000"
check "CURRENT featCurrent"
rm -rf "$REPO"; REPO=""

echo "== Fermeture — supprime les corroborées, CONSERVE net-zéro/non-mergées/protégées =="
REPO="$(build_repo)"
( cd "$REPO" && CMB_CONFIRMED="featX" CMB_REMOTE="origin-inexistant" cmb_close main >/dev/null 2>&1 )
present() { ( cd "$REPO" && git show-ref --verify --quiet "refs/heads/$1" ); }
present featX       && ko "featX (mergée corroborée) aurait dû être supprimée" || ok "featX supprimée"
present featReal    && ko "featReal (ancêtre) aurait dû être supprimée" || ok "featReal supprimée"
present featNetZero && ok "featNetZero (net-zéro non corroborée) CONSERVÉE (anti-perte)" || ko "DANGER: featNetZero supprimée à tort"
present featY       && ok "featY (non mergée) conservée" || ko "featY ne devait PAS être supprimée"
present featConflict && ok "featConflict (conflit) conservée" || ko "featConflict ne devait PAS être supprimée"
present staging     && ok "staging (protégée) conservée" || ko "staging ne devait PAS être supprimée"
present wt/20260101-000000 && ok "wt-socle (protégée) conservée" || ko "wt-socle ne devait PAS être supprimée"
present featCurrent && ok "featCurrent (courante) conservée" || ko "featCurrent ne devait PAS être supprimée"
rm -rf "$REPO"; REPO=""

echo "== Sans corroboration, une squash-mergée tombe en REVIEW (pas supprimée) =="
REPO="$(build_repo)"
( cd "$REPO" && CMB_REMOTE="origin-inexistant" cmb_close main >/dev/null 2>&1 )   # PAS de CMB_CONFIRMED
present featX && ok "featX non corroborée → conservée (REVIEW), pas de suppression aveugle" || ko "featX supprimée sans corroboration (risque)"
rm -rf "$REPO"; REPO=""

echo "== Dry-run — ne supprime rien =="
REPO="$(build_repo)"
( cd "$REPO" && CMB_DRY_RUN=1 CMB_CONFIRMED="featX" CMB_REMOTE="origin-inexistant" cmb_close main >/dev/null 2>&1 )
present featX && ok "dry-run : featX conservée" || ko "dry-run n'aurait rien dû supprimer"
rm -rf "$REPO"; REPO=""

echo "== Worktree vivant — branche mergée attachée à un AUTRE worktree : NI local NI distant supprimés (D-20260709-0009) =="
# LE test de non-régression du bug : featX est squash-mergée+corroborée MAIS checked-out dans
# un worktree vivant. git refuse 'branch -D' (silencieux) mais 'push --delete' partait quand même
# → branche distante détruite, session vivante décapitée. Doit être classée WORKTREE et intouchée.
REPO="$(build_repo)"
BARE="$(mktemp -d)"; WT="$(mktemp -d)"; rm -rf "$WT"   # 'worktree add' exige un path inexistant
(
  set -e
  cd "$REPO"
  git init -q --bare "$BARE"
  git remote add wtorigin "$BARE"
  git push -q wtorigin main featX          # featX (squash-mergée) publiée sur le "distant"
  git worktree add -q "$WT" featX          # featX désormais vivante dans un autre worktree
) >/dev/null 2>&1
cls2="$(cd "$REPO" && CMB_CONFIRMED="featX" cmb_classify main)"
echo "$cls2" | grep -qx "WORKTREE featX" && ok "featX classée WORKTREE (attachée à un worktree actif)" || ko "featX aurait dû être WORKTREE, obtenu :\n$cls2"
( cd "$REPO" && CMB_CONFIRMED="featX" CMB_REMOTE="wtorigin" cmb_close main >/dev/null 2>&1 )
( cd "$REPO" && git show-ref --verify --quiet "refs/heads/featX" ) && ok "featX locale préservée (worktree actif)" || ko "featX locale supprimée à tort"
( cd "$REPO" && git ls-remote --exit-code --heads wtorigin featX >/dev/null 2>&1 ) && ok "featX DISTANTE préservée (le bug d'origine)" || ko "DANGER: featX distante détruite — régression D-20260709-0009"
( cd "$REPO" && git worktree remove --force "$WT" >/dev/null 2>&1 ) || true
rm -rf "$REPO" "$BARE" "$WT"; REPO=""

echo "== Filet de sécurité — même si une branche verrouillée atteignait MERGED, le distant survit (D-20260709-0009) =="
# Défense en profondeur : on court-circuite le statut WORKTREE en forçant cmb_classify à
# émettre 'MERGED featX' pour une branche RÉELLEMENT verrouillée par un worktree. git refusera
# 'branch -D' → le push --delete distant NE DOIT PAS partir. Prouve le garde-fou racine seul.
REPO="$(build_repo)"
BARE="$(mktemp -d)"; WT="$(mktemp -d)"; rm -rf "$WT"
(
  set -e
  cd "$REPO"
  git init -q --bare "$BARE"; git remote add wtorigin "$BARE"
  git push -q wtorigin main featX
  git worktree add -q "$WT" featX          # featX verrouillée → 'branch -D featX' échouera
) >/dev/null 2>&1
out="$(cd "$REPO" && cmb_classify() { echo "MERGED featX"; } && CMB_REMOTE="wtorigin" cmb_close main 2>&1)"
( cd "$REPO" && git ls-remote --exit-code --heads wtorigin featX >/dev/null 2>&1 ) && ok "distant préservé quand 'branch -D' échoue (filet racine)" || ko "DANGER: distant supprimé alors que la locale a survécu"
echo "$out" | grep -q "0 mergée(s) traitée(s)" && ok "compteur honnête : 0 suppression réelle comptée" || ko "compteur ment (a compté une suppression qui n'a pas eu lieu) : $out"
( cd "$REPO" && git worktree remove --force "$WT" >/dev/null 2>&1 ) || true
rm -rf "$REPO" "$BARE" "$WT"; REPO=""

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"; FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
