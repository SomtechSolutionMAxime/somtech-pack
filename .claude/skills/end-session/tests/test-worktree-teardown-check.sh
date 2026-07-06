#!/usr/bin/env bash
# ============================================================
# test-worktree-teardown-check.sh
# Teste le diagnostic de teardown (worktree-teardown-check.sh). Prouve que le
# helper expose EXACTEMENT ce qui bloque le retrait d'un worktree claude-swt :
#   • classement du working-tree sale (TRACKED / ARTIFACT / ORPHAN) ;
#   • commits non mergés sur HEAD + socle wt/<sess> ;
#   • code retour du verdict (0 = teardown-ready, 1 = bloqué).
#
# RED (le bug d'origine) : sans ce helper, /end-session écrivait CHANGELOG sans
# committer → working-tree sale → `git worktree remove` échouait, sans aucune
# explication à l'utilisateur. Cas 1 reproduit cet état et vérifie que le helper
# le DÉTECTE désormais (verdict bloqué + fichier listé).
# ============================================================
set -u

HERE="$(cd "$(dirname "$0")/../lib" && pwd)"
# shellcheck source=/dev/null
. "$HERE/worktree-teardown-check.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t

fail=0
ok()   { printf '  ✅ %s\n' "$1"; }
ko()   { printf '  ❌ %s\n' "$1"; fail=1; }
eq()   { [ "$2" = "$3" ] && ok "$1" || { ko "$1"; printf '     attendu=[%s] obtenu=[%s]\n' "$3" "$2"; }; }
has()  { printf '%s' "$2" | grep -q -- "$3" && ok "$1" || { ko "$1"; printf '     [%s] ne contient pas [%s]\n' "$2" "$3"; }; }

# --- setup : origin bare + repo principal "main" ---
git init -q --bare "$TMP/origin.git"
git clone -q "$TMP/origin.git" "$TMP/main"
MAIN="$TMP/main"
git -C "$MAIN" checkout -q -b main
echo seed > "$MAIN/f"; git -C "$MAIN" add f; git -C "$MAIN" commit -q -m seed
git -C "$MAIN" push -q -u origin main

mkwt() { git -C "$MAIN" worktree add -q "$TMP/$1" -b "wt/$1" origin/main; }

echo "→ Cas 0 : détection worktree lié vs repo principal"
( cd "$MAIN"; wtc_is_worktree ) && ko "repo principal détecté comme worktree" || ok "repo principal : PAS un worktree lié"
mkwt A
( cd "$TMP/A"; wtc_is_worktree ) && ok "worktree lié détecté" || ko "worktree lié NON détecté"

echo "→ Cas 1 (RED d'origine) : worktree propre SAUF un doc écrit non commité → bloqué + listé"
# reproduit ce que /end-session faisait : écrire CHANGELOG sans committer
mkwt B
echo "## 2026-07-06" > "$TMP/B/CHANGELOG.md"
out="$( cd "$TMP/B"; wtc_report origin/main )"; rc=$?
eq  "verdict bloqué (rc=1)" "$rc" "1"
has "CHANGELOG listé comme suivi/à committer" "$out" "CHANGELOG.md"
has "verdict explicite affiché" "$out" "NE POURRA PAS"

echo "→ Cas 2 : classement TRACKED / ARTIFACT / ORPHAN"
mkwt C
( cd "$TMP/C" && echo a > tracked.txt && git add tracked.txt )   # staged → TRACKED
touch "$TMP/C/.DS_Store"                                          # → ARTIFACT
touch "$TMP/C/debug.log"                                          # → ARTIFACT
touch "$TMP/C/mystere.dat"                                        # → ORPHAN
dirty="$( cd "$TMP/C"; wtc_dirty )"
has "tracked.txt → TRACKED"   "$dirty" "$(printf 'TRACKED\ttracked.txt')"
has ".DS_Store → ARTIFACT"    "$dirty" "$(printf 'ARTIFACT\t.DS_Store')"
has "debug.log → ARTIFACT"    "$dirty" "$(printf 'ARTIFACT\tdebug.log')"
has "mystere.dat → ORPHAN"    "$dirty" "$(printf 'ORPHAN\tmystere.dat')"

echo "→ Cas 3 : commits non mergés sur la socle wt/<sess> → pending le liste"
mkwt D
( cd "$TMP/D" && echo x >> f && git add f && git commit -q -m "wip socle" )
eq  "D pending = wt/D" "$( cd "$TMP/D"; wtc_pending origin/main )" "wt/D"
out="$( cd "$TMP/D"; wtc_report origin/main )"; rc=$?
eq  "D verdict bloqué (rc=1)" "$rc" "1"
has "commit non mergé affiché" "$out" "1 commit"

echo "→ Cas 4 : HEAD sur feat non mergée → pending liste feat, pas la socle"
mkwt E
( cd "$TMP/E" && git checkout -q -b feat/x && echo y >> f && git add f && git commit -q -m "wip x" )
eq  "E pending = feat/x" "$( cd "$TMP/E"; wtc_pending origin/main )" "feat/x"

echo "→ Cas 5 : worktree PROPRE et mergé → teardown-ready (rc=0)"
mkwt F   # socle wt/F == origin/main, rien de sale
out="$( cd "$TMP/F"; wtc_report origin/main )"; rc=$?
eq  "F verdict ready (rc=0)" "$rc" "0"
has "verdict ready affiché" "$out" "teardown-ready"

echo "→ Cas 6 : rapport liste CHAQUE orphelin sur sa propre puce (multi-lignes, pas de fusion)"
mkwt G
touch "$TMP/G/premier.dat" "$TMP/G/deuxieme.dat" "$TMP/G/troisieme.dat"
out="$( cd "$TMP/G"; wtc_report origin/main )"
has "puce premier.dat"   "$out" "$(printf '     - premier.dat')"
has "puce deuxieme.dat"  "$out" "$(printf '     - deuxieme.dat')"
has "puce troisieme.dat" "$out" "$(printf '     - troisieme.dat')"
n_bullets="$(printf '%s\n' "$out" | grep -c '^     - ')"
eq  "3 puces distinctes (aucune ligne fusionnée)" "$n_bullets" "3"

echo
[ "$fail" -eq 0 ] && { echo "✅ TOUS LES TESTS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
