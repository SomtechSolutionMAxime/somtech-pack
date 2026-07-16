#!/usr/bin/env bash
# ============================================================
# test-archi-ci-toolkit.sh — pipeline du modèle vivant (D-20260715-0004).
# Récolteurs + merge + validate + gate + ERD, de bout en bout, sur fixture.
# Prouve le comportement rouge/vert du gate. Requiert python3 + PyYAML.
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
S="${SCRIPT_DIR}/../archi-ci"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
WORK="$(mktemp -d)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"; rm -rf "$WORK"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

PY="${SOMTECH_PYTHON:-python3}"
command -v "$PY" >/dev/null 2>&1 || { echo "⚠️  python3 indisponible — test sauté (skip)"; exit 0; }
"$PY" -c 'import yaml' 2>/dev/null || { echo "⚠️  PyYAML indisponible — test sauté (skip)"; exit 0; }

# ── Fixture : un mini repo applicatif ────────────────────────────────────────
REPO="$WORK/repo"
mkdir -p "$REPO/supabase/migrations" "$REPO/app/api/users/[id]" "$REPO/pages/api"
cat > "$REPO/supabase/migrations/0001.sql" <<'SQL'
CREATE TABLE public.users ( id uuid PRIMARY KEY );
CREATE TABLE posts ( id uuid, author_id uuid REFERENCES users(id) );
SQL
printf 'export async function GET(){}\nexport const POST=async()=>{}\n' > "$REPO/app/api/users/route.ts"
printf 'export async function DELETE(){}\n' > "$REPO/app/api/users/[id]/route.ts"
printf 'export default function h(){}\n' > "$REPO/pages/api/health.ts"
printf 'app = "demo-app"\n' > "$REPO/fly.toml"
printf 'ANTHROPIC_API_KEY=\n' > "$REPO/.env.example"

echo "== A. Récolteurs =="
"$PY" "$S/harvest-supabase.py" "$REPO/supabase/migrations" --app demo-app --out "$WORK/t.yaml" 2>/dev/null
grep -q 'id: demo-app.users' "$WORK/t.yaml" && ok "tables : users récoltée" || ko "table users manquante"
grep -q 'from: demo-app.posts' "$WORK/t.yaml" && ok "tables : FK posts→users" || ko "FK manquante"

"$PY" "$S/harvest-routes.py" "$REPO" --app demo-app --out "$WORK/r.yaml" 2>/dev/null
grep -q 'name: GET /api/users' "$WORK/r.yaml" && ok "endpoints : GET /api/users" || ko "endpoint App Router manquant"
grep -q 'name: DELETE /api/users/\[id\]' "$WORK/r.yaml" && ok "endpoints : segment dynamique [id]" || ko "route dynamique manquante"
grep -q 'name: ANY /api/health' "$WORK/r.yaml" && ok "endpoints : Pages API /api/health" || ko "endpoint Pages API manquant"

"$PY" "$S/harvest-config.py" "$REPO" --app demo-app --out "$WORK/c.yaml" 2>/dev/null
grep -q 'to: flyio' "$WORK/c.yaml" && ok "config : dépendance flyio" || ko "flyio manquant"
grep -q 'to: anthropic' "$WORK/c.yaml" && ok "config : dépendance anthropic (env)" || ko "anthropic manquant"

echo "== B. Fusion + validation =="
"$PY" "$S/merge-manifests.py" "$WORK/c.yaml" "$WORK/t.yaml" "$WORK/r.yaml" --app demo-app --out "$WORK/harvested.yaml" 2>/dev/null
"$PY" "$S/validate-manifest.py" "$WORK/harvested.yaml" >/dev/null 2>&1 && ok "manifeste fusionné valide (schéma)" || ko "manifeste fusionné invalide"

echo "== C. Gate diff-manifest =="
# Committé identique au récolté → aucun drift
"$PY" "$S/diff-manifest.py" "$WORK/harvested.yaml" "$WORK/harvested.yaml" --mode strict >/dev/null 2>&1
[ $? -eq 0 ] && ok "identique/strict → exit 0" || ko "identique devrait passer en strict"

# Committé amputé d'un endpoint → drift bloquant
cat > "$WORK/committed.yaml" <<'YAML'
app: demo-app
elements:
  - {id: demo-app, kind: service, name: demo-app}
  - {id: demo-app.users, kind: table, name: users, parent: demo-app}
  - {id: demo-app.dashboard, kind: screen, name: Dashboard, parent: demo-app}
YAML
"$PY" "$S/diff-manifest.py" "$WORK/committed.yaml" "$WORK/harvested.yaml" --mode warn --report "$WORK/drift.md" >/dev/null 2>&1
[ $? -eq 0 ] && ok "drift/warn → exit 0 (non bloquant)" || ko "warn ne devrait jamais bloquer"
"$PY" "$S/diff-manifest.py" "$WORK/committed.yaml" "$WORK/harvested.yaml" --mode strict >/dev/null 2>&1
[ $? -eq 1 ] && ok "drift/strict → exit 1 (bloquant)" || ko "strict devrait bloquer sur drift"
grep -q 'demo-app.dashboard' "$WORK/drift.md" && grep -q 'informatif' "$WORK/drift.md" \
  && ok "écran manuel classé informatif (non bloquant)" || ko "extra manuel mal classé"
grep -q 'demo-app.posts' "$WORK/drift.md" && ok "table posts (code) signalée manquante dans la doc" || ko "drift table non signalé"

echo "== D. Vue ERD =="
"$PY" "$S/generate-erd.py" "$WORK/harvested.yaml" --out "$WORK/erd.md" 2>/dev/null
grep -q 'erDiagram' "$WORK/erd.md" && ok "ERD : bloc mermaid" || ko "erDiagram manquant"
grep -q 'posts }o--|| users' "$WORK/erd.md" && ok "ERD : relation FK posts→users" || ko "relation ERD manquante"
"$PY" "$S/generate-erd.py" "$WORK/harvested.yaml" --out "$WORK/erd.md" --check >/dev/null 2>&1
[ $? -eq 0 ] && ok "ERD --check : à jour → exit 0" || ko "ERD --check devrait être à jour"
printf 'obsolete\n' > "$WORK/erd.md"
"$PY" "$S/generate-erd.py" "$WORK/harvested.yaml" --out "$WORK/erd.md" --check >/dev/null 2>&1
[ $? -eq 1 ] && ok "ERD --check : obsolète → exit 1" || ko "ERD --check devrait détecter l'obsolescence"

# ── Bilan ────────────────────────────────────────────────────────────────────
P=$(wc -l < "$PASS_FILE"); F=$(wc -l < "$FAIL_FILE")
echo; echo "== Bilan : ${P// /} réussis, ${F// /} échoués =="
[ "${F// /}" -eq 0 ] || exit 1
