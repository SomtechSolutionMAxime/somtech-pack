#!/usr/bin/env bash
# ============================================================
# test-claude-swt-pending.sh
# Teste _claude-swt-pending : la décision de teardown d'un worktree ne doit
# valider QUE les branches de la session courante (HEAD du worktree + socle
# wt/<sess>), jamais les branches feat/fix globales des AUTRES worktrees.
#
# Prouve aussi (RED) que l'ancienne logique « for-each-ref refs/heads/feat
# refs/heads/fix » bloquait à tort dès qu'une autre session avait une branche.
# ============================================================
set -u

HERE="$(cd "$(dirname "$0")/../shell" && pwd)"
# shellcheck source=/dev/null
. "$HERE/claude-swt.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t

fail=0
ok()   { printf '  ✅ %s\n' "$1"; }
ko()   { printf '  ❌ %s\n' "$1"; fail=1; }
eq()   { [ "$2" = "$3" ] && ok "$1" || { ko "$1"; printf '     attendu=[%s] obtenu=[%s]\n' "$3" "$2"; }; }

# --- setup : origin bare + repo principal "main" sur branche main ---
git init -q --bare "$TMP/origin.git"
git clone -q "$TMP/origin.git" "$TMP/main"
MAIN="$TMP/main"
git -C "$MAIN" checkout -q -b main
echo seed > "$MAIN/f"; git -C "$MAIN" add f; git -C "$MAIN" commit -q -m seed
git -C "$MAIN" push -q -u origin main

mkwt() { git -C "$MAIN" worktree add -q "$TMP/$1" -b "wt/$1" origin/main; }
commit_on() { ( cd "$1" && echo x >> f && git add f && git commit -q -m "$2"; ); }

# Worktree A : reste sur la socle wt/A == origin/main (rien fait) → DOIT être retirable
mkwt A
# Worktree B : crée feat/x avec un commit non mergé (= une AUTRE session active)
mkwt B
( cd "$TMP/B" && git checkout -q -b feat/x ); commit_on "$TMP/B" "wip x"
# Worktree C : commits directs sur la socle wt/C (bug latent : branch -D sans validation)
mkwt C; commit_on "$TMP/C" "wip on socle"
# Worktree D : feat/y mergée dans origin/main → DOIT être retirable
mkwt D
( cd "$TMP/D" && git checkout -q -b feat/y ); commit_on "$TMP/D" "feat y"
git -C "$TMP/D" push -q origin feat/y:main          # « merge » feat/y dans main distant
git -C "$MAIN" fetch -q origin

echo "→ Cas 1 : worktree mergé, IGNORE les feat/fix des autres sessions (bug principal)"
new=$(_claude-swt-pending "$MAIN" "$TMP/A" A)
eq "A retirable (pending vide) malgré feat/x ailleurs" "$new" ""
# RED : l'ancienne logique globale aurait listé feat/x → blocage à tort
old=$(git -C "$TMP/A" for-each-ref --format='%(refname:short)' refs/heads/feat refs/heads/fix 2>/dev/null \
  | while read -r b; do git -C "$MAIN" merge-base --is-ancestor "$b" origin/main 2>/dev/null || echo "$b"; done)
[ -n "$old" ] && ok "ancienne logique aurait bloqué (RED confirmé : [$old])" \
              || ko "ancienne logique aurait dû bloquer (RED non reproduit)"

echo "→ Cas 2 : HEAD du worktree sur une feat non mergée → bloque"
eq "B conservé (feat/x)" "$(_claude-swt-pending "$MAIN" "$TMP/B" B)" "feat/x"

echo "→ Cas 3 : commits directs sur la socle wt/<sess> → bloque (bug latent corrigé)"
eq "C conservé (wt/C)" "$(_claude-swt-pending "$MAIN" "$TMP/C" C)" "wt/C"

echo "→ Cas 4 : HEAD sur une feat déjà mergée → retirable"
eq "D retirable (pending vide)" "$(_claude-swt-pending "$MAIN" "$TMP/D" D)" ""

echo
[ "$fail" -eq 0 ] && { echo "✅ TOUS LES TESTS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
