#!/usr/bin/env bash
# ============================================================
# test-pack-auto-pr.sh — auto-PR single-writer gardé (E3, T-20260715-0004/0005/0006)
# Vrai git local (origin bare + clone en retard) + stubs npx/gh. Aucun réseau.
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB="${SCRIPT_DIR}/../shell/pack-freshness.sh"
PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }
[ -r "$LIB" ] || { echo "❌ lib introuvable: $LIB"; exit 1; }
# shellcheck source=/dev/null
source "$LIB"

# --- stubs -------------------------------------------------
# npx stub : simule `pack update` en bumpant .somtech-pack/version.json à $STUB_LATEST.
make_npx() { local f="$1/npx"; cat > "$f" <<EOF
#!/usr/bin/env bash
printf '{"name":"@somtech-solutions/pack","version":"${STUB_LATEST}"}\n' > .somtech-pack/version.json
exit 0
EOF
chmod +x "$f"; echo "$f"; }
# npx stub no-op (ne change rien → pas de diff → pas de bump)
make_npx_noop() { local f="$1/npx-noop"; printf '#!/usr/bin/env bash\nexit 0\n' > "$f"; chmod +x "$f"; echo "$f"; }
# gh stub : `pr list` lit un fichier d'état ; `pr create` l'écrit. Journalise les créations.
make_gh() { local f="$1/gh" state="$1/pr_state" log="$1/gh_pr_created"; cat > "$f" <<EOF
#!/usr/bin/env bash
sub="\$1"; shift; [ "\$sub" = pr ] || exit 0; act="\$1"; shift
if [ "\$act" = list ]; then cat "$state" 2>/dev/null; exit 0; fi
if [ "\$act" = create ]; then echo created >> "$log"; echo "https://pr/1" > "$state"; echo "https://pr/1"; exit 0; fi
exit 0
EOF
chmod +x "$f"; echo "$f"; }
# gh stub dont `pr create` ÉCHOUE (pour tester le rollback)
make_gh_fail() { local f="$1/gh"; cat > "$f" <<'EOF'
#!/usr/bin/env bash
sub="$1"; shift; [ "$sub" = pr ] || exit 0; act="$1"; shift
[ "$act" = list ] && exit 0
[ "$act" = create ] && exit 1
exit 0
EOF
chmod +x "$f"; echo "$f"; }

# setup_repo <installed> <latest> → echo "root|main|cache" (origin bare + clone en retard + cache)
setup_repo() {
  local installed="$1" latest="$2" root origin main cache
  root="$(mktemp -d)"; origin="$root/origin.git"; main="$root/main"; cache="$root/cache.json"
  git init -q --bare "$origin"
  git init -q "$main"
  ( cd "$main"; git config user.email t@t; git config user.name t; git config commit.gpgsign false
    mkdir -p .somtech-pack
    printf '{"name":"@somtech-solutions/pack","version":"%s"}\n' "$installed" > .somtech-pack/version.json
    git add -A; git commit -q -m init; git branch -M main
    git remote add origin "$origin"; git push -q -u origin main )
  printf '{"checkedAt":%s,"latest":"%s"}\n' "$(date +%s)" "$latest" > "$cache"
  echo "$root|$main|$cache"
}
# nombre de refs chore/pack-* sur l'origin
remote_chore_count() { git -C "$1" ls-remote --heads origin 'chore/pack-*' 2>/dev/null | grep -c . || true; }
# nombre TOTAL de worktrees (main inclus) — après cleanup on attend 1 (main seul).
# NB : ne pas filtrer par chemin (macOS /var → /private/var casse la comparaison).
total_worktrees() { git -C "$1" worktree list --porcelain 2>/dev/null | grep -c '^worktree ' || true; }

echo "== 3.1 — happy-path : bump isolé + PR draft =="
STUB_LATEST=1.1.0
s="$(setup_repo 1.0.0 1.1.0)"; root="${s%%|*}"; rest="${s#*|}"; main="${rest%%|*}"; cache="${rest##*|}"
gh="$(make_gh "$root")"; npx="$(make_npx "$root")"
(
  export SOMTECH_PACK_CACHE="$cache" SOMTECH_PACK_NPM=0 SOMTECH_PACK_LOCKDIR="$root/locks" PF_GH="$gh" PF_NPX="$npx"
  pf_auto_pr "$main"
)
[ "$(remote_chore_count "$main")" = "1" ] && ok "1 branche chore/pack sur l'origin" || ko "attendu 1 branche chore/pack (eu $(remote_chore_count "$main"))"
[ -f "$root/gh_pr_created" ] && [ "$(wc -l < "$root/gh_pr_created" | tr -d ' ')" = "1" ] && ok "PR draft créée 1×" || ko "PR draft non créée / dupliquée"
[ -z "$(git -C "$main" status --porcelain)" ] && ok "\$main reste propre" || ko "\$main sali"
[ "$(total_worktrees "$main")" = "1" ] && ok "worktree éphémère jeté (main seul restant)" || ko "worktree éphémère résiduel ($(total_worktrees "$main") worktrees)"
git -C "$main" show-ref --verify --quiet refs/heads/chore/pack-v1.1.0 && ko "branche locale résiduelle" || ok "branche locale nettoyée"
rm -rf "$root"

echo "== 3.2a — idempotence : branche déjà sur l'origin → skip =="
STUB_LATEST=1.1.0
s="$(setup_repo 1.0.0 1.1.0)"; root="${s%%|*}"; rest="${s#*|}"; main="${rest%%|*}"; cache="${rest##*|}"
gh="$(make_gh "$root")"; npx="$(make_npx "$root")"
# pré-créer la branche sur l'origin
git -C "$main" push -q origin main:refs/heads/chore/pack-v1.1.0
(
  export SOMTECH_PACK_CACHE="$cache" SOMTECH_PACK_NPM=0 SOMTECH_PACK_LOCKDIR="$root/locks" PF_GH="$gh" PF_NPX="$npx"
  pf_auto_pr "$main"
)
[ ! -f "$root/gh_pr_created" ] && ok "branche existante → aucune PR créée (skip)" || ko "a créé une PR malgré branche existante"
rm -rf "$root"

echo "== 3.2b — concurrence : 2 lancements simultanés → 1 seule PR =="
STUB_LATEST=1.1.0
s="$(setup_repo 1.0.0 1.1.0)"; root="${s%%|*}"; rest="${s#*|}"; main="${rest%%|*}"; cache="${rest##*|}"
gh="$(make_gh "$root")"; npx="$(make_npx "$root")"
(
  export SOMTECH_PACK_CACHE="$cache" SOMTECH_PACK_NPM=0 SOMTECH_PACK_LOCKDIR="$root/locks" PF_GH="$gh" PF_NPX="$npx"
  pf_auto_pr "$main" & pf_auto_pr "$main" & wait
)
c="$( [ -f "$root/gh_pr_created" ] && wc -l < "$root/gh_pr_created" | tr -d ' ' || echo 0 )"
[ "$c" = "1" ] && ok "2 lancements → exactement 1 PR" || ko "attendu 1 PR, eu $c"
[ "$(remote_chore_count "$main")" = "1" ] && ok "1 seule branche chore sur origin" || ko "branches dupliquées ($(remote_chore_count "$main"))"
rm -rf "$root"

echo "== 3.2c — lock périmé récupéré → MAJ procède =="
STUB_LATEST=1.1.0
s="$(setup_repo 1.0.0 1.1.0)"; root="${s%%|*}"; rest="${s#*|}"; main="${rest%%|*}"; cache="${rest##*|}"
gh="$(make_gh "$root")"; npx="$(make_npx "$root")"
(
  export SOMTECH_PACK_CACHE="$cache" SOMTECH_PACK_NPM=0 SOMTECH_PACK_LOCKDIR="$root/locks" PF_GH="$gh" PF_NPX="$npx" PF_LOCK_TTL=1
  lp="$(pf_lock_path "$main")"; mkdir -p "$lp"       # lock résiduel
  touch -t 202001010000 "$lp" 2>/dev/null || true    # très vieux → périmé
  pf_auto_pr "$main"
)
[ -f "$root/gh_pr_created" ] && ok "lock périmé récupéré → PR créée" || ko "lock périmé a gelé la MAJ"
rm -rf "$root"

echo "== 3.2d — lock frais tenu par un autre → skip =="
STUB_LATEST=1.1.0
s="$(setup_repo 1.0.0 1.1.0)"; root="${s%%|*}"; rest="${s#*|}"; main="${rest%%|*}"; cache="${rest##*|}"
gh="$(make_gh "$root")"; npx="$(make_npx "$root")"
(
  export SOMTECH_PACK_CACHE="$cache" SOMTECH_PACK_NPM=0 SOMTECH_PACK_LOCKDIR="$root/locks" PF_GH="$gh" PF_NPX="$npx" PF_LOCK_TTL=600
  lp="$(pf_lock_path "$main")"; mkdir -p "$lp"        # lock frais (une autre session)
  pf_auto_pr "$main"
)
[ ! -f "$root/gh_pr_created" ] && ok "lock frais → skip (pas de PR)" || ko "a agi malgré un lock frais"
rm -rf "$root"

echo "== 3.3a — rollback : gh pr create échoue → branche poussée nettoyée =="
STUB_LATEST=1.1.0
s="$(setup_repo 1.0.0 1.1.0)"; root="${s%%|*}"; rest="${s#*|}"; main="${rest%%|*}"; cache="${rest##*|}"
gh="$(make_gh_fail "$root")"; npx="$(make_npx "$root")"
(
  export SOMTECH_PACK_CACHE="$cache" SOMTECH_PACK_NPM=0 SOMTECH_PACK_LOCKDIR="$root/locks" PF_GH="$gh" PF_NPX="$npx"
  pf_auto_pr "$main"
)
[ "$(remote_chore_count "$main")" = "0" ] && ok "échec PR → branche distante supprimée (pas d'orpheline)" || ko "branche orpheline laissée ($(remote_chore_count "$main"))"
git -C "$main" show-ref --verify --quiet refs/heads/chore/pack-v1.1.0 && ko "branche locale résiduelle" || ok "branche locale nettoyée"
rm -rf "$root"

echo "== 3.3b — no-op offline : push échoue → aucune orpheline, \$main propre =="
STUB_LATEST=1.1.0
s="$(setup_repo 1.0.0 1.1.0)"; root="${s%%|*}"; rest="${s#*|}"; main="${rest%%|*}"; cache="${rest##*|}"
gh="$(make_gh "$root")"; npx="$(make_npx "$root")"
git -C "$main" remote set-url origin "$root/nonexistent.git"   # push impossible (offline simulé)
(
  export SOMTECH_PACK_CACHE="$cache" SOMTECH_PACK_NPM=0 SOMTECH_PACK_LOCKDIR="$root/locks" PF_GH="$gh" PF_NPX="$npx"
  pf_auto_pr "$main"
)
[ ! -f "$root/gh_pr_created" ] && ok "push échoué → aucune PR" || ko "PR créée malgré push échoué"
git -C "$main" show-ref --verify --quiet refs/heads/chore/pack-v1.1.0 && ko "branche locale résiduelle après échec push" || ok "branche locale nettoyée après échec push"
[ -z "$(git -C "$main" status --porcelain)" ] && ok "\$main propre après échec" || ko "\$main sali après échec"
rm -rf "$root"

echo "== 3.3c — pas de bump si npx ne change rien (garde diff vide) =="
STUB_LATEST=1.1.0
s="$(setup_repo 1.0.0 1.1.0)"; root="${s%%|*}"; rest="${s#*|}"; main="${rest%%|*}"; cache="${rest##*|}"
gh="$(make_gh "$root")"; npx="$(make_npx_noop "$root")"
(
  export SOMTECH_PACK_CACHE="$cache" SOMTECH_PACK_NPM=0 SOMTECH_PACK_LOCKDIR="$root/locks" PF_GH="$gh" PF_NPX="$npx"
  pf_auto_pr "$main"
)
[ "$(remote_chore_count "$main")" = "0" ] && ok "diff vide → aucune branche poussée" || ko "a poussé sans changement"
[ ! -f "$root/gh_pr_created" ] && ok "diff vide → aucune PR" || ko "PR créée sans changement"
rm -rf "$root"

echo "== 3.x — à jour → no-op total =="
STUB_LATEST=1.1.0
s="$(setup_repo 1.1.0 1.1.0)"; root="${s%%|*}"; rest="${s#*|}"; main="${rest%%|*}"; cache="${rest##*|}"
gh="$(make_gh "$root")"; npx="$(make_npx "$root")"
(
  export SOMTECH_PACK_CACHE="$cache" SOMTECH_PACK_NPM=0 SOMTECH_PACK_LOCKDIR="$root/locks" PF_GH="$gh" PF_NPX="$npx"
  pf_auto_pr "$main"
)
{ [ "$(remote_chore_count "$main")" = "0" ] && [ ! -f "$root/gh_pr_created" ]; } && ok "à jour → aucune action" || ko "a agi alors qu'à jour"
rm -rf "$root"

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"; FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
