#!/usr/bin/env bash
# ============================================================
# test-staging-migration-gate.sh — v1.0.0
# Test reproductible du gate migrations multi-contributeur.
#
# Reproduit 2 migrations concurrentes en repo jetable et vérifie que
# la collision est attrapée EN LOCAL (avant staging), pas après.
#
# Pas de Supabase requis : `supabase db reset` est simulé par un replay
# sqlite3 de toutes les migrations en ordre de timestamp (analogue fidèle
# — un CREATE TABLE dupliqué échoue comme en Postgres).
#
# Scénarios :
#   A. Baseline (le bug) : sans gate, rejouer seulement les migrations de
#      la branche feat NE voit PAS la collision → réussit à tort.
#   B. Gate : détecte la migration voisine sur staging, la merge, et le
#      db reset rejoue tout → la collision échoue EN LOCAL (rc=3).
#   C. No-op solo : staging non divergent → gate ne fait rien (rc=0),
#      aucun merge.
#   D. Concurrent non-collisionnant : staging a une migration sans
#      conflit → gate merge + reset OK (rc=0), migration bien présente.
#
# Usage : bash .claude/skills/pousse-staging/tests/test-staging-migration-gate.sh
# Sortie : exit 0 si tous les scénarios passent, 1 sinon.
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/staging-migration-gate.sh
source "${SCRIPT_DIR}/../lib/staging-migration-gate.sh"

# Compteurs via fichiers : les scénarios tournent dans des sous-shells `( )`
# qui héritent de ces variables mais ne peuvent PAS muter celles du parent.
# Écrire dans des fichiers garantit qu'un `ko` en sous-shell fait bien
# échouer la suite (sinon un test cassé passerait en silence).
PASS_FILE="$(mktemp)"
FAIL_FILE="$(mktemp)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"' EXIT
ok()   { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko()   { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

# Simule `supabase db reset` : rejoue toutes les migrations en ordre via sqlite.
smg_test_reset() {
  local db rc=0 f
  db="$(mktemp -u)"
  for f in $(ls "${SMG_MIGRATIONS_DIR:-supabase/migrations}"/*.sql 2>/dev/null | sort); do
    if ! sqlite3 "$db" < "$f" 2>/dev/null; then rc=1; break; fi
  done
  rm -f "$db"
  return $rc
}

mig() { # mig <timestamp> <table> <repo>  → crée une migration CREATE TABLE
  local ts="$1" table="$2" repo="$3"
  printf 'CREATE TABLE %s (id INTEGER PRIMARY KEY);\n' "$table" \
    > "${repo}/supabase/migrations/${ts}_${table}.sql"
}

# Construit un repo jetable : main (init) + branche staging + branche feat.
# $1 = table créée par la migration "voisine" sur staging
# $2 = table créée par la migration de la branche feat
# (tables identiques => collision ; différentes => pas de collision)
# $3 = "with_neighbor" | "solo"  (staging a-t-elle une migration en plus ?)
make_repo() {
  local neighbor_table="$1" feat_table="$2" mode="$3"
  local repo; repo="$(mktemp -d)"
  (
    cd "$repo"
    git init -q
    git config user.email t@t.io; git config user.name t
    git config commit.gpgsign false
    mkdir -p supabase/migrations
    mig 20260101000000 app "$repo"
    git add -A && git commit -qm "init"
    git branch staging
    if [ "$mode" = "with_neighbor" ]; then
      git checkout -q staging
      mig 20260102000000 "$neighbor_table" "$repo"
      git add -A && git commit -qm "neighbor migration"
    fi
    git checkout -q -b feat main
    mig 20260103000000 "$feat_table" "$repo"
    git add -A && git commit -qm "feat migration"
  )
  echo "$repo"
}

count_migrations() { ls "$1"/supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' '; }

echo "== Scénario A — baseline (sans gate, la collision est invisible) =="
REPO="$(make_repo widget widget with_neighbor)"
(
  cd "$REPO"
  export SMG_MIGRATIONS_DIR="supabase/migrations"
  # Branche feat seule : 20260101 (app) + 20260103 (widget). Aucune collision visible.
  if smg_test_reset; then ok "db reset réussit sur la branche feat seule (collision NON détectée — c'est le bug)"; \
    else ko "db reset devrait réussir sans le voisin"; fi
)
rm -rf "$REPO"

echo "== Scénario B — gate : la collision est attrapée EN LOCAL (rc=3) =="
REPO="$(make_repo widget widget with_neighbor)"
(
  cd "$REPO"
  export SMG_MIGRATIONS_DIR="supabase/migrations"
  export SMG_FETCH=0 SMG_STAGING_REF="staging" SMG_DB_RESET_CMD="smg_test_reset"
  git checkout -q feat
  before="$(count_migrations "$REPO")"
  if smg_run_gate >/dev/null 2>&1; then rc=0; else rc=$?; fi
  after="$(count_migrations "$REPO")"
  [ "$rc" = "3" ] && ok "gate retourne 3 (collision attrapée en local)" || ko "gate aurait dû retourner 3, a retourné $rc"
  [ "$after" -gt "$before" ] && ok "staging a bien été mergé dans feat (migrations: $before → $after)" \
    || ko "le voisin aurait dû être mergé (migrations: $before → $after)"
)
rm -rf "$REPO"

echo "== Scénario C — no-op solo (staging non divergent, rc=0, aucun merge) =="
REPO="$(make_repo widget widget solo)"   # staging == main, pas de migration voisine
(
  cd "$REPO"
  export SMG_MIGRATIONS_DIR="supabase/migrations"
  export SMG_FETCH=0 SMG_STAGING_REF="staging" SMG_DB_RESET_CMD="smg_test_reset"
  git checkout -q feat
  before="$(count_migrations "$REPO")"
  out="$(smg_run_gate 2>&1)"; rc=$?
  after="$(count_migrations "$REPO")"
  [ "$rc" = "0" ] && ok "gate retourne 0 en mode solo" || ko "gate aurait dû retourner 0, a retourné $rc"
  echo "$out" | grep -q "no-op" && ok "gate annonce explicitement le no-op" || ko "gate aurait dû annoncer un no-op"
  [ "$after" = "$before" ] && ok "aucun merge en mode solo (migrations inchangées: $before)" \
    || ko "le mode solo ne doit rien merger ($before → $after)"
)
rm -rf "$REPO"

echo "== Scénario D — concurrent non-collisionnant (merge + reset OK, rc=0) =="
REPO="$(make_repo gadget widget with_neighbor)"  # voisin=gadget, feat=widget → pas de collision
(
  cd "$REPO"
  export SMG_MIGRATIONS_DIR="supabase/migrations"
  export SMG_FETCH=0 SMG_STAGING_REF="staging" SMG_DB_RESET_CMD="smg_test_reset"
  git checkout -q feat
  if smg_run_gate >/dev/null 2>&1; then rc=0; else rc=$?; fi
  [ "$rc" = "0" ] && ok "gate retourne 0 (merge + reset OK, pas de faux positif)" || ko "gate aurait dû retourner 0, a retourné $rc"
  [ -f "$REPO/supabase/migrations/20260102000000_gadget.sql" ] \
    && ok "la migration voisine a bien été intégrée" || ko "la migration voisine manque après merge"
)
rm -rf "$REPO"

echo "== Scénario E — conflit git lors du merge de staging (rc=2 + merge en cours) =="
# staging et feat modifient le MÊME fichier de façon divergente => conflit au merge.
REPO_E="$(mktemp -d)"
(
  cd "$REPO_E"
  git init -q; git config user.email t@t.io; git config user.name t; git config commit.gpgsign false
  mkdir -p supabase/migrations
  printf 'CREATE TABLE app (id INTEGER PRIMARY KEY);\n' > supabase/migrations/20260101000000_app.sql
  git add -A && git commit -qm "init"
  git branch staging
  # staging : modifie le fichier init + ajoute une migration voisine (=> divergence détectée)
  git checkout -q staging
  printf 'CREATE TABLE app (id INTEGER PRIMARY KEY, col_staging TEXT);\n' > supabase/migrations/20260101000000_app.sql
  printf 'CREATE TABLE neighbor (id INTEGER PRIMARY KEY);\n' > supabase/migrations/20260102000000_neighbor.sql
  git add -A && git commit -qm "staging edit + neighbor"
  # feat : modifie le MÊME fichier init différemment (=> conflit)
  git checkout -q -b feat main
  printf 'CREATE TABLE app (id INTEGER PRIMARY KEY, col_feat TEXT);\n' > supabase/migrations/20260101000000_app.sql
  git add -A && git commit -qm "feat edit"
)
(
  cd "$REPO_E"
  export SMG_MIGRATIONS_DIR="supabase/migrations"
  export SMG_FETCH=0 SMG_STAGING_REF="staging" SMG_DB_RESET_CMD="smg_test_reset"
  git checkout -q feat
  out="$(smg_run_gate 2>&1)"; rc=$?
  [ "$rc" = "2" ] && ok "gate retourne 2 sur conflit git" || ko "gate aurait dû retourner 2, a retourné $rc"
  [ -f "$REPO_E/.git/MERGE_HEAD" ] && ok "merge en cours signalé (.git/MERGE_HEAD présent)" \
    || ko ".git/MERGE_HEAD attendu après un conflit"
  # rc=2 doit court-circuiter AVANT db reset : pas de message de succès db reset
  echo "$out" | grep -q "db reset OK" && ko "db reset n'aurait pas dû s'exécuter sur conflit" \
    || ok "db reset non atteint sur conflit (rc=2 court-circuite, attendu)"
  echo "$out" | grep -q "merge --abort" && ok "le message guide vers 'git merge --abort'" \
    || ko "le message rc=2 devrait mentionner 'git merge --abort'"
)
rm -rf "$REPO_E"

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"
FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
