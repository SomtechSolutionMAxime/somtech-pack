#!/usr/bin/env bash
# ============================================================
# test-graphify-share-out.sh — partage du dossier de sortie graphify entre
# worktrees (D-20260716-0001). HOME isolé (jamais le vrai ~/graphify). Couvre :
# B1 (anti-collision par hash), B2 (auto-init), legacy respecté, idempotence,
# M4 (.graphify_root vivant), partage main↔worktree.
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARE="${SCRIPT_DIR}/../shell/graphify-share-out.sh"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
SANDBOX="$(mktemp -d)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"; rm -rf "$SANDBOX"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

[ -x "$SHARE" ] || { echo "❌ script introuvable/non exécutable : $SHARE"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "⚠️  git indisponible — test sauté"; exit 0; }

# HOME isolé → le script écrit dans $SANDBOX/home/graphify, jamais le vrai ~.
FAKEHOME="$SANDBOX/home"; mkdir -p "$FAKEHOME"
run_share() ( cd "$1" && HOME="$FAKEHOME" bash "$SHARE" >/dev/null 2>&1 )

mkrepo() { local d="$1"; mkdir -p "$d"; git -C "$d" init -q; git -C "$d" config user.email t@t.co; git -C "$d" config user.name t; }

echo "== A. B2 — auto-init : symlink + dossier partagé au 1er appel =="
mkrepo "$SANDBOX/repoA"
run_share "$SANDBOX/repoA"
[ -L "$SANDBOX/repoA/graphify-out" ] && ok "symlink graphify-out posé" || ko "symlink absent (B2)"
target=$(readlink "$SANDBOX/repoA/graphify-out" 2>/dev/null)
[ -d "$target" ] && case "$target" in "$FAKEHOME"/graphify/repoA-*) ok "cible = ~/graphify/repoA-<hash> ($(basename "$target"))" ;; *) ko "cible inattendue : $target" ;; esac || ko "cible inexistante"

echo "== B. M4 — .graphify_root pointe le worktree courant =="
# Le script écrit `git rev-parse --show-toplevel` (chemin résolu ; macOS /var→/private).
root=$(cat "$target/.graphify_root" 2>/dev/null)
expA=$(git -C "$SANDBOX/repoA" rev-parse --show-toplevel)
[ "$root" = "$expA" ] && ok ".graphify_root = repoA" || ko ".graphify_root faux : $root (attendu $expA)"

echo "== C. B1 — anti-collision : 2 repos homonymes, chemins différents =="
mkrepo "$SANDBOX/x/web"; mkrepo "$SANDBOX/y/web"
run_share "$SANDBOX/x/web"; run_share "$SANDBOX/y/web"
kx=$(basename "$(readlink "$SANDBOX/x/web/graphify-out")")
ky=$(basename "$(readlink "$SANDBOX/y/web/graphify-out")")
[ "$kx" != "$ky" ] && ok "clés distinctes malgré même nom 'web' ($kx ≠ $ky)" || ko "COLLISION B1 : $kx == $ky"

echo "== D. Idempotence — 2e appel : rc 0, symlink stable =="
before=$(readlink "$SANDBOX/repoA/graphify-out")
HOME="$FAKEHOME" bash -c "cd '$SANDBOX/repoA' && '$SHARE'" ; rc=$?
after=$(readlink "$SANDBOX/repoA/graphify-out")
[ "$rc" = 0 ] && ok "2e appel rc=0" || ko "2e appel rc=$rc"
[ "$before" = "$after" ] && ok "symlink inchangé" || ko "symlink modifié : $before → $after"

echo "== E. Legacy — un VRAI dossier graphify-out n'est jamais écrasé =="
mkrepo "$SANDBOX/repoLegacy"
mkdir -p "$SANDBOX/repoLegacy/graphify-out"; echo real > "$SANDBOX/repoLegacy/graphify-out/graph.json"
run_share "$SANDBOX/repoLegacy"
[ ! -L "$SANDBOX/repoLegacy/graphify-out" ] && [ -f "$SANDBOX/repoLegacy/graphify-out/graph.json" ] \
  && ok "dossier réel préservé (pas de symlink par-dessus)" || ko "legacy écrasé !"

echo "== F. Partage main ↔ worktree : même clé =="
mkrepo "$SANDBOX/mainrepo"; ( cd "$SANDBOX/mainrepo" && git commit -q --allow-empty -m init )
git -C "$SANDBOX/mainrepo" worktree add -q "$SANDBOX/wt1" -b wt1 2>/dev/null
run_share "$SANDBOX/mainrepo"; run_share "$SANDBOX/wt1"
km=$(basename "$(readlink "$SANDBOX/mainrepo/graphify-out")")
kw=$(basename "$(readlink "$SANDBOX/wt1/graphify-out")")
[ "$km" = "$kw" ] && ok "main et worktree partagent la même clé ($km)" || ko "clés divergentes main=$km wt=$kw"
# M4 depuis le worktree : .graphify_root doit maintenant pointer le worktree
rootw=$(cat "$(readlink "$SANDBOX/wt1/graphify-out")/.graphify_root")
expW=$(git -C "$SANDBOX/wt1" rev-parse --show-toplevel)
[ "$rootw" = "$expW" ] && ok ".graphify_root suit le dernier worktree scanné (M4)" || ko ".graphify_root=$rootw (attendu $expW)"

# ── Bilan ────────────────────────────────────────────────────────────────────
P=$(wc -l < "$PASS_FILE"); F=$(wc -l < "$FAIL_FILE")
echo; echo "== Bilan : ${P// /} réussis, ${F// /} échoués =="
[ "${F// /}" -eq 0 ] || exit 1
