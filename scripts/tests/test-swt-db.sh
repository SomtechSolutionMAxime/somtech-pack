#!/usr/bin/env bash
# ============================================================
# test-swt-db.sh
# Teste la lib swt-db.sh (BD Supabase isolée par worktree, D-20260709-0003).
# Fonctions pures / filesystem — AUCUN appel Docker ou Supabase ici.
#
# Couvre les 3 critères d'acceptation de T-20260709-0038 :
#   1. mapping profil -> services exclus (-x) avec les noms réels du CLI ;
#   2. allocation d'offset non-collidante + réutilisable après libération ;
#   3. patch config.toml (ports + project_id) masqué de git status (skip-worktree).
# ============================================================
set -u

HERE="$(cd "$(dirname "$0")/../shell" && pwd)"
# shellcheck source=/dev/null
. "$HERE/swt-db.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t

fail=0
ok()  { printf '  ✅ %s\n' "$1"; }
ko()  { printf '  ❌ %s\n' "$1"; fail=1; }
eq()  { [ "$2" = "$3" ] && ok "$1" || { ko "$1"; printf '     attendu=[%s] obtenu=[%s]\n' "$3" "$2"; }; }
has() { case "$2" in *"$3"*) ok "$1" ;; *) ko "$1"; printf '     [%s] ne contient pas [%s]\n' "$2" "$3" ;; esac; }
hasnt(){ case "$2" in *"$3"*) ko "$1"; printf '     [%s] contient [%s] (ne devrait pas)\n' "$2" "$3" ;; *) ok "$1" ;; esac; }

echo "== 1. Mapping profil -> services exclus =="
DB=$(swt_db_excludes db)
has  "db exclut logflare (analytics = poste le plus lourd)" "$DB" "logflare"
has  "db exclut vector" "$DB" "vector"
has  "db exclut gotrue (auth)" "$DB" "gotrue"
has  "db exclut studio" "$DB" "studio"
has  "db exclut mailpit (ex-inbucket)" "$DB" "mailpit"
has  "db exclut supavisor (pooler)" "$DB" "supavisor"
has  "db exclut postgrest (API REST -> profil auth ; kong requis)" "$DB" "postgrest"
has  "db exclut postgres-meta" "$DB" "postgres-meta"

AUTH=$(swt_db_excludes auth)
has  "auth exclut realtime" "$AUTH" "realtime"
has  "auth exclut storage-api" "$AUTH" "storage-api"
has  "auth exclut logflare" "$AUTH" "logflare"
hasnt "auth GARDE gotrue" "$AUTH" "gotrue"
hasnt "auth GARDE kong" "$AUTH" "kong"

eq   "full n'exclut rien" "$(swt_db_excludes full)" ""
swt_db_excludes n_importe_quoi >/dev/null 2>&1 && ko "profil invalide devrait échouer" || ok "profil invalide échoue (code != 0)"

echo "== 2. Allocation d'offset non-collidante =="
o1=$(swt_db_alloc_offset "20260709-101010" "")
o1b=$(swt_db_alloc_offset "20260709-101010" "")
eq   "offset déterministe (même session -> même offset)" "$o1" "$o1b"
[ "$o1" -ge 1 ] && [ "$o1" -le 8 ] && ok "offset dans la plage worktree [1..8]" || ko "offset hors plage : $o1"

# le candidat déterministe est pris -> doit en prendre un autre, hors 'taken'
o2=$(swt_db_alloc_offset "20260709-101010" "$o1")
[ "$o2" != "$o1" ] && ok "collision évitée (offset différent du pris)" || ko "collision non évitée : $o2"
case ",$o1," in *",$o2,"*) ko "offset alloué figure dans taken" ;; *) ok "offset alloué hors de taken" ;; esac

# tous pris -> échec
swt_db_alloc_offset "sess" "1,2,3,4,5,6,7,8" >/dev/null 2>&1 && ko "plein devrait échouer" || ok "plage pleine échoue (code != 0)"

echo "== 3. Patch config.toml (ports + project_id + skip-worktree) =="
REPO="$TMP/repo"
git init -q "$REPO"
mkdir -p "$REPO/supabase"
cat > "$REPO/supabase/config.toml" <<'EOF'
project_id = "monapp"

[api]
port = 54321

[db]
port = 54322
shadow_port = 54320

[db.pooler]
port = 54329

[studio]
port = 54323

[inbucket]
port = 54324
# smtp_port = 54325

[auth.email.smtp]
# port = 587

[edge_runtime]
inspector_port = 8083

[analytics]
port = 54327
EOF
git -C "$REPO" add -A && git -C "$REPO" commit -q -m init

swt_db_patch_config "$REPO/supabase/config.toml" "monapp-20260709-101010" 1
cfg=$(cat "$REPO/supabase/config.toml")
has  "project_id remplacé par l'ID de session" "$cfg" 'project_id = "monapp-20260709-101010"'
has  "api 54321 -> 54341 (offset 1, delta 20)" "$cfg" "port = 54341"
has  "db 54322 -> 54342" "$cfg" "port = 54342"
has  "shadow 54320 -> 54340" "$cfg" "shadow_port = 54340"
has  "pooler 54329 -> 54349" "$cfg" "port = 54349"
has  "analytics 54327 -> 54347" "$cfg" "port = 54347"
has  "SMTP externe 587 NON touché" "$cfg" "# port = 587"
has  "inspector 8083 NON touché" "$cfg" "inspector_port = 8083"

# skip-worktree : config.toml ne doit plus apparaître dans git status
status=$(git -C "$REPO" status --porcelain -- supabase/config.toml)
eq   "config.toml patché absent de git status (skip-worktree)" "$status" ""

echo "== 4. Écriture .env.local =="
WT="$TMP/wt"; mkdir -p "$WT"
swt_db_write_env "$WT" "http://127.0.0.1:54341" "anon.key.xyz" "service.key.xyz"
[ -f "$WT/.env.local" ] && ok ".env.local créé" || ko ".env.local absent"
env=$(cat "$WT/.env.local" 2>/dev/null)
has  "URL API du worktree" "$env" "54341"
has  "clé anon exposée" "$env" "anon.key.xyz"

echo
[ "$fail" -eq 0 ] && echo "✅ TOUS LES TESTS PASSENT" || echo "❌ DES TESTS ÉCHOUENT"
exit "$fail"
