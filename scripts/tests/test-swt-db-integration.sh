#!/usr/bin/env bash
# ============================================================
# test-swt-db-integration.sh
# Smoke test RÉEL de l'orchestration swt_db_up / swt_db_down (D-20260709-0003).
# Monte une vraie stack Supabase profil db (Postgres seul, ~65 Mo) puis l'arrête.
# NÉCESSITE Docker + supabase CLI — se SKIP proprement sinon (non bloquant CI).
# ============================================================
set -u

command -v supabase >/dev/null 2>&1 || { echo "⏭️  SKIP : supabase CLI absent"; exit 0; }
docker info >/dev/null 2>&1            || { echo "⏭️  SKIP : Docker inactif"; exit 0; }

HERE="$(cd "$(dirname "$0")/../shell" && pwd)"
# shellcheck source=/dev/null
. "$HERE/swt-db.sh"

TMP="$(mktemp -d)"
export SWT_DB_REG="$TMP/reg"
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
REPO="$TMP/main"
SESS="itest-$$"
PID=""
cleanup() { [ -n "$PID" ] && ( cd "$REPO" 2>/dev/null && supabase stop --no-backup >/dev/null 2>&1 ); rm -rf "$TMP"; }
trap cleanup EXIT

fail=0
ok() { printf '  ✅ %s\n' "$1"; }
ko() { printf '  ❌ %s\n' "$1"; fail=1; }

echo "== Setup : repo Supabase temporaire =="
git init -q "$REPO"
( cd "$REPO" && supabase init --force >/dev/null 2>&1 && git add -A && git commit -q -m init )
echo "  projet initialisé"

echo "== swt_db_up (profil db) — démarre une vraie stack Postgres =="
PID=$(swt_db_up "$REPO" "$REPO" "$SESS" db)
[ -n "$PID" ] && ok "project_id renvoyé : $PID" || ko "swt_db_up n'a rien renvoyé (start échoué ?)"
if [ -n "$PID" ]; then
  docker ps --format '{{.Names}}' | grep -q "$PID" && ok "conteneur Postgres démarré" || ko "aucun conteneur pour $PID"
  ncont=$(docker ps --format '{{.Names}}' | grep -c "$PID")
  [ "$ncont" -eq 1 ] && ok "profil db = 1 seul conteneur (élagage effectif)" || ko "attendu 1 conteneur, obtenu $ncont"
  [ -f "$REPO/.env.local" ] && ok ".env.local écrit" || ko ".env.local absent"
  [ -f "$SWT_DB_REG/$SESS" ] && ok "offset enregistré dans le registre" || ko "offset non enregistré"
  grep -q "project_id = \"$PID\"" "$REPO/supabase/config.toml" && ok "config.toml patché (project_id)" || ko "project_id non patché"
  st=$(git -C "$REPO" status --porcelain -- supabase/config.toml)
  [ -z "$st" ] && ok "config.toml patché masqué de git status (skip-worktree)" || ko "config.toml visible dans git status : [$st]"
  envst=$(git -C "$REPO" status --porcelain -- .env.local)
  [ -z "$envst" ] && ok ".env.local ignoré de git status" || ko ".env.local visible dans git status"
fi

echo "== swt_db_down (destroy=1) — arrête et libère =="
swt_db_down "$REPO" "$SESS" 1
sleep 2
if [ -n "$PID" ]; then
  docker ps --format '{{.Names}}' | grep -q "$PID" && ko "conteneur toujours actif après stop" || ok "conteneur arrêté"
  [ -f "$SWT_DB_REG/$SESS" ] && ko "offset non libéré (destroy)" || ok "offset libéré"
fi
PID=""  # déjà arrêté ; évite le double stop du cleanup

echo
[ "$fail" -eq 0 ] && echo "✅ INTÉGRATION OK" || echo "❌ INTÉGRATION EN ÉCHEC"
exit "$fail"
