#!/usr/bin/env bash
# ============================================================
# test-staging-slot-gate.sh — v1.0.0
# Test reproductible du gate « slot unique » de /pousse-staging.
#
# Prouve que staging se comporte en SAS À UNE SEULE LIVRAISON :
#   A. Slot libre (staging == main)                  → rc=0, on pousse.
#   B. Slot occupé par MA livraison (itération QA)    → rc=0, autorisé.
#   C. Slot occupé par une AUTRE livraison            → rc=4, BLOQUÉ.
#   D. Slot occupé, occupant inconnu (legacy, pas de  → rc=4, BLOQUÉ
#      trailer) — fail-safe conservateur.                (on ne devine pas).
#   E. Après merge en prod (squash staging→main) le   → rc=0, slot libéré
#      slot se libère, robuste au squash-merge.           (diff de tree vide).
#   F. main AVANCE seul au-dessus d'un staging déjà     → rc=0, pas de faux
#      mergé (staging ancêtre de main, trees diffèrent)    positif (ancêtre).
#
# Pas de Supabase ni de remote requis : refs locales injectées via
# SSG_MAIN_REF / SSG_STAGING_REF, SSG_FETCH=0.
#
# Usage : bash .claude/skills/pousse-staging/tests/test-staging-slot-gate.sh
# Sortie : exit 0 si tous les scénarios passent, 1 sinon.
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/staging-slot-gate.sh
source "${SCRIPT_DIR}/../lib/staging-slot-gate.sh"

# Compteurs via fichiers : les scénarios tournent dans des sous-shells `( )`
# qui héritent de ces variables mais ne peuvent PAS muter celles du parent.
PASS_FILE="$(mktemp)"
FAIL_FILE="$(mktemp)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"' EXIT
ok()   { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko()   { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

# Initialise un repo jetable : main (init) + branche staging alignée.
init_repo() {
  local repo; repo="$(mktemp -d)"
  (
    cd "$repo"
    git init -q
    git config user.email t@t.io; git config user.name t
    git config commit.gpgsign false
    echo "v0" > app.txt
    git add -A && git commit -qm "init"
    git branch staging
  )
  echo "$repo"
}

# Pousse une "livraison" sur staging avec un trailer Staging-Source.
# $1=repo  $2=contenu  $3=branche-source (vide => commit SANS trailer = legacy)
push_delivery() {
  local repo="$1" content="$2" source="$3"
  (
    cd "$repo"
    git checkout -q staging
    echo "$content" > app.txt
    git add -A
    if [ -n "$source" ]; then
      git commit -qm "feat(x): livraison ${content}

Staging-Source: ${source}"
    else
      git commit -qm "feat(x): livraison legacy ${content}"
    fi
  )
}

run_gate() { # $1=repo $2=current_branch  → echo rc
  (
    cd "$1"
    export SSG_FETCH=0 SSG_MAIN_REF="main" SSG_STAGING_REF="staging"
    ssg_run_gate "$2" >/dev/null 2>&1; echo $?
  )
}

echo "== Scénario A — slot LIBRE (staging == main, rc=0) =="
REPO="$(init_repo)"
rc="$(run_gate "$REPO" "feat/A")"
[ "$rc" = "0" ] && ok "gate autorise quand staging est aligné sur main" \
  || ko "gate aurait dû retourner 0, a retourné $rc"
rm -rf "$REPO"

echo "== Scénario B — slot occupé par MA livraison (itération QA, rc=0) =="
REPO="$(init_repo)"
push_delivery "$REPO" "v1" "feat/A"
rc="$(run_gate "$REPO" "feat/A")"   # je suis sur feat/A, c'est MA livraison
[ "$rc" = "0" ] && ok "gate autorise la ré-itération de la livraison occupante" \
  || ko "gate aurait dû retourner 0 (même branche), a retourné $rc"
rm -rf "$REPO"

echo "== Scénario C — slot occupé par une AUTRE livraison (rc=4, BLOQUÉ) =="
REPO="$(init_repo)"
push_delivery "$REPO" "v1" "feat/A"
rc="$(run_gate "$REPO" "feat/B")"   # feat/A occupe, je tente feat/B
[ "$rc" = "4" ] && ok "gate BLOQUE une 2e livraison tant que staging n'est pas en prod" \
  || ko "gate aurait dû retourner 4 (autre branche), a retourné $rc"
rm -rf "$REPO"

echo "== Scénario D — occupant inconnu / legacy sans trailer (rc=4, fail-safe) =="
REPO="$(init_repo)"
push_delivery "$REPO" "v1" ""       # commit SANS trailer Staging-Source
rc="$(run_gate "$REPO" "feat/B")"
[ "$rc" = "4" ] && ok "gate BLOQUE quand l'occupant est inconnu (conservateur)" \
  || ko "gate aurait dû retourner 4 (occupant inconnu), a retourné $rc"
rm -rf "$REPO"

echo "== Scénario E — merge en prod (squash) libère le slot (rc=0, robuste au squash) =="
REPO="$(init_repo)"
push_delivery "$REPO" "v1" "feat/A"
# Simule /merge en SQUASH : main absorbe le contenu de staging sans hériter
# de son historique (commit distinct). Le slot doit redevenir LIBRE.
(
  cd "$REPO"
  git checkout -q main
  git merge --squash staging >/dev/null 2>&1
  git commit -qm "merge(prod): livraison v1 via squash"
)
# Vérifie d'abord que l'historique DIVERGE (rev-list non vide) — c'est le
# piège que `git diff --quiet` (comparaison de tree) doit éviter.
divergence="$(cd "$REPO" && git rev-list --count main..staging)"
[ "$divergence" -gt 0 ] && ok "l'historique diverge après squash (rev-list main..staging=$divergence)" \
  || ko "le squash aurait dû laisser une divergence d'historique"
rc="$(run_gate "$REPO" "feat/B")"   # nouvelle livraison, slot censé être libre
[ "$rc" = "0" ] && ok "gate voit le slot LIBRE malgré la divergence d'historique (compare le tree)" \
  || ko "gate aurait dû retourner 0 (contenu identique), a retourné $rc"
rm -rf "$REPO"

echo "== Scénario F — main avance seul au-dessus de staging mergé (rc=0, pas de faux positif) =="
REPO="$(init_repo)"
push_delivery "$REPO" "v1" "feat/A"
# Simule le vrai /merge (merge-commit : staging devient ancetre de main),
# puis main AVANCE seul (commit de prod au-dessus). Le tree main != tree
# staging, MAIS staging n'a aucun commit absent de main => slot LIBRE.
(
  cd "$REPO"
  git checkout -q main
  git merge --no-ff --no-edit staging >/dev/null 2>&1   # staging ⊆ ancestry(main)
  echo "hotfix-prod" >> app.txt                         # main avance seul
  git add -A && git commit -qm "fix(prod): hotfix au-dessus de staging"
)
ancestor_ok="$(cd "$REPO" && git rev-list --count main..staging)"   # doit être 0
tree_differs="$(cd "$REPO" && git diff --quiet main staging; echo $?)" # doit être 1
[ "$ancestor_ok" = "0" ] && [ "$tree_differs" = "1" ] \
  && ok "état piège reproduit : staging ancêtre de main mais trees différents" \
  || ko "état piège non reproduit (ancêtre=$ancestor_ok, tree_differs=$tree_differs)"
rc="$(run_gate "$REPO" "feat/B")"
[ "$rc" = "0" ] && ok "gate ne bloque PAS quand staging est déjà entièrement en prod" \
  || ko "gate aurait dû retourner 0 (faux positif hotfix), a retourné $rc"
rm -rf "$REPO"

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"
FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
