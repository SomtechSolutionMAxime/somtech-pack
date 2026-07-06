#!/usr/bin/env bash
# ============================================================
# test-claude-swt-done.sh
# Teste claude-swt-done : la résolution du worktree doit passer par `git worktree
# list`, jamais par `basename "$PWD"`.
#
# RED (bug d'origine) : `repo=$(basename "$PWD")` — lancé DEPUIS un worktree,
# $PWD se termine par le timestamp de session, donc `repo` valait le timestamp et
# le chemin `$HOME/worktrees/<timestamp>/<cible>` était faux. `git worktree
# remove` échouait en silence (2>/dev/null) mais la fonction affichait quand même
# « ✅ nettoyée » → l'utilisateur croyait le worktree supprimé alors qu'il restait.
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

# --- setup : origin bare + repo principal + 2 worktrees (sessions mergées, propres) ---
git init -q --bare "$TMP/origin.git"
git clone -q "$TMP/origin.git" "$TMP/main"
MAIN="$TMP/main"
git -C "$MAIN" checkout -q -b main
echo seed > "$MAIN/f"; git -C "$MAIN" add f; git -C "$MAIN" commit -q -m seed
git -C "$MAIN" push -q -u origin main

WTROOT="$TMP/worktrees/repo"
mkdir -p "$WTROOT"
git -C "$MAIN" worktree add -q "$WTROOT/SESS-A" -b "wt/SESS-A" origin/main
git -C "$MAIN" worktree add -q "$WTROOT/SESS-B" -b "wt/SESS-B" origin/main

echo "→ Cas 1 (RED) : done lancé DEPUIS un worktree retire la CIBLE (résolution via git, pas \$PWD)"
# On se place dans SESS-A (cwd finit par 'SESS-A') et on supprime SESS-B.
out="$( cd "$WTROOT/SESS-A" && claude-swt-done SESS-B 2>&1 )"; rc=$?
[ "$rc" -eq 0 ] && ok "rc=0" || ko "rc attendu 0, obtenu $rc"
git -C "$MAIN" worktree list --porcelain | grep -q "SESS-B" \
  && ko "SESS-B toujours présent (retrait raté)" || ok "SESS-B effectivement retiré"
git -C "$MAIN" show-ref --verify --quiet refs/heads/wt/SESS-B \
  && ko "branche wt/SESS-B toujours là" || ok "branche socle wt/SESS-B supprimée"
printf '%s' "$out" | grep -q "SESS-B" && ok "message mentionne la session" || ko "message muet"

echo "→ Cas 2 : session introuvable → rc=1, message d'erreur (pas de faux « nettoyée »)"
out="$( cd "$MAIN" && claude-swt-done SESS-INEXISTANTE 2>&1 )"; rc=$?
[ "$rc" -eq 1 ] && ok "rc=1" || ko "rc attendu 1, obtenu $rc"
printf '%s' "$out" | grep -q "introuvable" && ok "message d'erreur explicite" || ko "pas de message d'erreur"
printf '%s' "$out" | grep -q "nettoyée" && ko "affiche « nettoyée » à tort" || ok "n'affiche PAS « nettoyée »"

echo "→ Cas 3 : worktree SALE → retrait refusé (rc=1), pas de faux succès"
touch "$WTROOT/SESS-A/orphelin.txt"           # fichier non suivi → remove refuse sans --force
out="$( cd "$MAIN" && claude-swt-done SESS-A 2>&1 )"; rc=$?
[ "$rc" -eq 1 ] && ok "rc=1 (refus)" || ko "rc attendu 1, obtenu $rc"
git -C "$MAIN" worktree list --porcelain | grep -q "SESS-A" \
  && ok "SESS-A conservé (données protégées)" || ko "SESS-A retiré malgré fichier non suivi"
printf '%s' "$out" | grep -q "nettoyée" && ko "affiche « nettoyée » à tort" || ok "n'affiche PAS « nettoyée »"

echo
[ "$fail" -eq 0 ] && { echo "✅ TOUS LES TESTS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
