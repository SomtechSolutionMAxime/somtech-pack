#!/usr/bin/env bash
# ============================================================
# test-archi-ci-toolkit.sh — pipeline du modèle vivant (D-20260715-0004).
# Récolteurs + merge + validate + gate + ERD, de bout en bout, sur fixture.
# Prouve le comportement rouge/vert du gate. Requiert python3 + PyYAML.
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# SOMTECH_ARCHI_CI permet de pointer la suite sur une AUTRE version des récolteurs
# (ex. celle d'avant un correctif) pour vérifier qu'un test est bien rouge avant.
S="${SOMTECH_ARCHI_CI:-${SCRIPT_DIR}/../archi-ci}"

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
# La dépendance `next` est la PREUVE que `app/` et `pages/` sont des routeurs et non de
# simples dossiers. Depuis D-20260804-0006 les récolteurs l'exigent : sans elle, le
# `src/pages/` d'une app Vite passerait pour un routeur (cf. F21). Un vrai dépôt Next.js
# porte toujours cette preuve — la fixture doit donc la porter aussi.
printf '{"dependencies":{"next":"^14"}}\n' > "$REPO/package.json"

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

echo "== E. Régressions de revue (F1/F2/F6) =="

# F1 — FK « à qualifier » (auth.users) ne bloque JAMAIS en strict, même si le committé
#      la qualifie autrement (auth.users) que le récolté (bare users).
cat > "$WORK/f1-harvested.yaml" <<'YAML'
app: demo-app
elements:
  - {id: demo-app, kind: service, name: demo-app}
  - {id: demo-app.profiles, kind: table, name: profiles, parent: demo-app}
depends_on:
  - {from: demo-app.profiles, to: users, label: FK cross-repo (à qualifier)}
YAML
cat > "$WORK/f1-committed.yaml" <<'YAML'
app: demo-app
elements:
  - {id: demo-app, kind: service, name: demo-app}
  - {id: demo-app.profiles, kind: table, name: profiles, parent: demo-app}
depends_on:
  - {from: demo-app.profiles, to: auth.users, label: FK vers auth Supabase}
YAML
"$PY" "$S/diff-manifest.py" "$WORK/f1-committed.yaml" "$WORK/f1-harvested.yaml" --mode strict --report "$WORK/f1.md" >/dev/null 2>&1
[ $? -eq 0 ] && ok "F1 : FK 'à qualifier' → strict NON bloquant" || ko "F1 : FK à qualifier bloque le strict (régression)"
grep -q 'à qualifier' "$WORK/f1.md" && ok "F1 : FK à qualifier listée en informatif" || ko "F1 : FK à qualifier absente du rapport"

# F2 — .mcp.json vers un MCP hébergé sur Netlify NE crée PAS de dépendance netlify.
mkdir -p "$WORK/f2"
printf 'app = "svc"\n' > "$WORK/f2/fly.toml"
printf '{"mcpServers":{"sd":{"url":"https://servicedesksomtech.netlify.app/mcp"}}}\n' > "$WORK/f2/.mcp.json"
"$PY" "$S/harvest-config.py" "$WORK/f2" --app svc --out "$WORK/f2.yaml" 2>/dev/null
grep -q 'to: netlify' "$WORK/f2.yaml" && ko "F2 : netlify fantôme récolté depuis .mcp.json" || ok "F2 : pas de netlify fantôme"
grep -q 'to: flyio' "$WORK/f2.yaml" && ok "F2 : flyio récolté (fly.toml présent)" || ko "F2 : flyio manquant"

# F6 — ERD sur manifeste 0 table → pas de bloc erDiagram vide.
cat > "$WORK/f6.yaml" <<'YAML'
app: svc
elements:
  - {id: svc, kind: service, name: svc}
YAML
"$PY" "$S/generate-erd.py" "$WORK/f6.yaml" --out "$WORK/f6.md" 2>/dev/null
grep -q 'erDiagram' "$WORK/f6.md" && ko "F6 : bloc erDiagram vide généré (rendu cassé)" || ok "F6 : 0 table → note, pas de diagramme vide"


echo "== F. Fidélité de la récolte (D-20260804-0006 — STD-031 §2.7.9 / I19) =="
# Chaque cas ci-dessous reproduit un défaut MESURÉ sur le corpus réel
# (actionprogex, constructiongauthier, print-template-hub, servicedesk-somtech).
# Tous étaient rouges avant ce correctif.

FID="$WORK/fid"; mkdir -p "$FID/supabase/migrations" "$FID/scripts/migrations"

# F7 — identifiants quotés PAR SEGMENT ("public"."x"), forme produite par pg_dump.
#      Mesuré sur Morasse : 25 tables de `supabase/_baseline_prod_public.sql` invisibles,
#      d'où un manifeste qui semblait sur-déclarer alors qu'il avait raison.
cat > "$FID/supabase/_baseline_prod.sql" <<'SQL'
CREATE TABLE IF NOT EXISTS "public"."archive_matrices" ( "id" uuid PRIMARY KEY );
CREATE TABLE IF NOT EXISTS "public"."clients" ( "id" uuid PRIMARY KEY );
SQL
# F8 — schéma non-public conservé : `audit.events` n'est pas `public.events`.
# F9 — DROP TABLE : une table supprimée ne survit pas dans le manifeste.
# F10 — RENAME TO : la table figure sous son nom FINAL, pas les deux.
# F11 — COMMENT ON TABLE : description récoltée au lieu d'un champ vide.
# F12 — bornage réel : un `;` et un `--` DANS un littéral ne coupent ni ne masquent rien.
cat > "$FID/supabase/migrations/0001.sql" <<'SQL'
CREATE TABLE public.events ( id uuid PRIMARY KEY );
CREATE TABLE audit.events ( id uuid PRIMARY KEY );
CREATE TABLE public.jetable ( id uuid PRIMARY KEY );
DROP TABLE IF EXISTS public.jetable;
CREATE TABLE public.ancien_nom ( id uuid PRIMARY KEY );
ALTER TABLE public.ancien_nom RENAME TO nouveau_nom;
COMMENT ON TABLE public.events IS 'Journal des évènements métier.';
INSERT INTO public.events (id) VALUES ('a; b -- pas un commentaire');
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.cible ( id uuid PRIMARY KEY );
SQL
# F13 — bloc DO conditionnel : motif de migration DÉFENSIVE, donc de projet discipliné.
cat > "$FID/supabase/migrations/0002.sql" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conditionnelle') THEN
    CREATE TABLE conditionnelle ( id uuid PRIMARY KEY, cible_id uuid REFERENCES cible(id) );
  END IF;
END $$;
SQL
# F14 — découverte des sources : le schéma ne vit pas toujours dans supabase/migrations.
cat > "$FID/scripts/migrations/2025-10-22_audit.sql" <<'SQL'
CREATE TABLE IF NOT EXISTS public.audit_logs ( id uuid PRIMARY KEY );
SQL
# Un jeu de données de test n'est PAS le schéma : il ne doit pas entrer dans le modèle.
cat > "$FID/supabase/seed_test_qa.sql" <<'SQL'
CREATE TABLE public.fixture_qa ( id uuid PRIMARY KEY );
SQL

"$PY" "$S/harvest-supabase.py" --discover "$FID" --app demo-app --out "$WORK/fid.yaml" 2>/dev/null
grep -q 'name: archive_matrices' "$WORK/fid.yaml" && ok "F7 : identifiant quoté par segment (\"public\".\"x\")" || ko "F7 : \"public\".\"x\" non récolté"
grep -q 'id: demo-app.audit.events' "$WORK/fid.yaml" && grep -q 'id: demo-app.events$' "$WORK/fid.yaml" \
  && ok "F8 : audit.events et public.events restent distinctes" || ko "F8 : schéma écrasé (collision de tables)"
grep -q 'jetable' "$WORK/fid.yaml" && ko "F13b : table supprimée encore déclarée" || ok "F9 : DROP TABLE retire la table"
grep -q 'name: nouveau_nom' "$WORK/fid.yaml" && ! grep -q 'name: ancien_nom' "$WORK/fid.yaml" \
  && ok "F10 : RENAME TO — nom final seul" || ko "F10 : renommage non suivi"
grep -q "description: Journal des évènements métier." "$WORK/fid.yaml" \
  && ok "F11 : description récoltée depuis COMMENT ON TABLE" || ko "F11 : description vide malgré un COMMENT ON TABLE"
grep -q 'name: cible' "$WORK/fid.yaml" \
  && ok "F12 : un ';' et un '--' dans un littéral ne cassent pas le découpage" || ko "F12 : littéral mal lu, instructions perdues"
grep -q 'name: conditionnelle' "$WORK/fid.yaml" \
  && ok "F13 : CREATE TABLE dans un DO \$\$ conditionnel récolté" || ko "F13 : migration défensive invisible"
grep -q 'name: audit_logs' "$WORK/fid.yaml" \
  && ok "F14 : --discover trouve le SQL hors supabase/migrations" || ko "F14 : source hors migrations ignorée"
grep -q 'fixture_qa' "$WORK/fid.yaml" && ko "F15 : table de jeu de test entrée dans le modèle" || ok "F15 : seed de test exclu de la découverte"

# F16 — Supabase Edge Functions : la surface HTTP majoritaire du parc Somtech.
# F17 — un fichier de test n'est pas une route (`route.test.ts`).
# F18 — monorepo : `app/` est le workspace, pas le routeur → pas de préfixe fantôme.
MONO="$WORK/mono"; mkdir -p "$MONO/supabase/functions/envoyer-courriel" \
  "$MONO/supabase/functions/_shared" "$MONO/app/src/app/api/sante"
printf '// Envoie un courriel transactionnel.\nDeno.serve(async (req) => { if (req.method !== "POST") return new Response(null,{status:405}); });\n' \
  > "$MONO/supabase/functions/envoyer-courriel/index.ts"
printf 'export const cors = {};\n' > "$MONO/supabase/functions/_shared/index.ts"
printf 'export async function GET(){}\n' > "$MONO/app/src/app/api/sante/route.ts"
printf 'import { GET } from "./route";\n' > "$MONO/app/src/app/api/sante/route.test.ts"
printf 'app = "mono"\n' > "$MONO/app/next.config.js"
"$PY" "$S/harvest-routes.py" "$MONO" --app demo-app --out "$WORK/mono.yaml" 2>/dev/null
grep -q 'name: POST /functions/v1/envoyer-courriel' "$WORK/mono.yaml" \
  && ok "F16 : Edge Function récoltée (méthode resserrée par le garde du code)" || ko "F16 : Edge Function invisible"
grep -q '_shared' "$WORK/mono.yaml" && ko "F16b : dossier de code partagé publié comme endpoint" || ok "F16b : _shared exclu"
grep -q "description: Envoie un courriel transactionnel." "$WORK/mono.yaml" \
  && ok "F17 : description d'endpoint tirée de l'en-tête du fichier" || ko "F17 : description d'endpoint vide"
grep -q 'name: GET /api/sante' "$WORK/mono.yaml" \
  && ok "F18 : monorepo — URL sans le préfixe du workspace" || ko "F18 : URL fantôme /src/app/…"
[ "$(grep -c 'name: ANY /api/sante' "$WORK/mono.yaml")" -eq 0 ] \
  && ok "F19 : route.test.ts n'est pas un endpoint" || ko "F19 : fichier de test publié comme endpoint"

# F20 — écrans React Router, wrapper de garde déballé.
# F21 — `src/pages/` d'une app Vite n'est PAS un routeur Next.js.
VITE="$WORK/vite"; mkdir -p "$VITE/src/pages"
printf '{"dependencies":{"react-router-dom":"^6","vite":"^5"}}\n' > "$VITE/package.json"
printf '/** Espace de travail des matrices. */\nexport default function MatrixWorkspace(){}\n' \
  > "$VITE/src/pages/MatrixWorkspace.tsx"
printf 'export default function AdminUsers(){}\n' > "$VITE/src/pages/AdminUsers.tsx"
cat > "$VITE/src/App.tsx" <<'TSX'
import MatrixWorkspace from './pages/MatrixWorkspace';
export default function App(){ return (
  <Routes>
    <Route path="/matrices" element={<RequireAuth><MatrixWorkspace /></RequireAuth>} />
    <Route path="/login" element={<Login />} />
  </Routes>
);}
TSX
"$PY" "$S/harvest-screens.py" "$VITE" --app demo-app --out "$WORK/screens.yaml" 2>/dev/null
grep -q 'name: MatrixWorkspace' "$WORK/screens.yaml" \
  && ok "F20 : écran nommé par le composant, pas par sa garde" || ko "F20 : garde d'authentification prise pour un écran"
grep -q "description: Espace de travail des matrices." "$WORK/screens.yaml" \
  && ok "F20b : description d'écran suivie jusqu'au composant importé" || ko "F20b : description d'écran vide"
grep -q '/AdminUsers' "$WORK/screens.yaml" \
  && ko "F21 : src/pages d'une app Vite lu comme un routeur Next.js" || ok "F21 : pas d'écran inventé depuis src/pages (Vite)"
grep -q 'name: Login' "$WORK/screens.yaml" && ok "F22 : écran sans wrapper récolté" || ko "F22 : écran simple manquant"

# ── Bilan ────────────────────────────────────────────────────────────────────
P=$(wc -l < "$PASS_FILE"); F=$(wc -l < "$FAIL_FILE")
echo; echo "== Bilan : ${P// /} réussis, ${F// /} échoués =="
[ "${F// /}" -eq 0 ] || exit 1
