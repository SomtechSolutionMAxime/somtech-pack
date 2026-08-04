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
# Une assertion NÉGATIVE (« X ne doit pas apparaître ») passe pour de mauvaises raisons quand
# le récolteur n'a rien produit : `grep` échoue faute de fichier, et la branche de succès est
# prise. Vérifié : à la version d'avant ce correctif, trois assertions négatives restaient
# vertes alors que le récolteur sortait en erreur. On exige donc le fichier d'abord.
# absent <fichier> <motif> <libellé si absent> <libellé si présent>
absent() {
  if [ ! -s "$1" ]; then ko "$4 (aucune sortie du récolteur — assertion non concluante)"; return; fi
  if grep -q "$2" "$1"; then ko "$4"; else ok "$3"; fi
}

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
absent "$WORK/fid.yaml" 'jetable' "F9 : DROP TABLE retire la table" "F9 : table supprimée encore déclarée"
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
absent "$WORK/fid.yaml" 'fixture_qa' "F15 : seed de test exclu de la découverte" "F15 : table de jeu de test entrée dans le modèle"

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
absent "$WORK/mono.yaml" '_shared' "F16b : _shared exclu" "F16b : dossier de code partagé publié comme endpoint"
grep -q "description: Envoie un courriel transactionnel." "$WORK/mono.yaml" \
  && ok "F17 : description d'endpoint tirée de l'en-tête du fichier" || ko "F17 : description d'endpoint vide"
grep -q 'name: GET /api/sante' "$WORK/mono.yaml" \
  && ok "F18 : monorepo — URL sans le préfixe du workspace" || ko "F18 : URL fantôme /src/app/…"
absent "$WORK/mono.yaml" 'name: ANY /api/sante' "F19 : route.test.ts n'est pas un endpoint" "F19 : fichier de test publié comme endpoint"

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
absent "$WORK/screens.yaml" '/AdminUsers' "F21 : pas d'écran inventé depuis src/pages (Vite)" "F21 : src/pages d'une app Vite lu comme un routeur Next.js"
grep -q 'name: Login' "$WORK/screens.yaml" && ok "F22 : écran sans wrapper récolté" || ko "F22 : écran simple manquant"


echo "== G. Défauts trouvés en revue de code (PR #159) =="
# Tous rouges avant la revue. Ils verrouillent des régressions dont la revue a montré
# qu'elles produisaient du FAUX — le seul défaut qu'I17/I19 ne pardonnent pas.

# G1 — sous-routeur monté : les chemins d'un module sont RELATIFS à son point de montage.
#      Mesuré sur Construction Gauthier : 76 URL sur 98 étaient publiées sans leur préfixe.
G="$WORK/nested"; mkdir -p "$G/src/modules/rh"
printf '{"dependencies":{"react-router-dom":"^6"}}\n' > "$G/package.json"
cat > "$G/src/App.tsx" <<'TSX'
import { RhRoutes } from './modules/rh/routes';
export default function App(){ return (
  <Routes>
    <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
      <Route index element={<Accueil />} />
      <Route path="profil" element={<Profil />} />
    </Route>
    <Route path="rh/*" element={<ProtectedRoute><RhRoutes /></ProtectedRoute>} />
    <Route path="/liste" element={<Liste />}>
      <Route path=":id" element={<Detail />} />
    </Route>
  </Routes>
);}
TSX
cat > "$G/src/modules/rh/routes.tsx" <<'TSX'
export function RhRoutes(){ return (
  <Routes>
    <Route path="tableau-de-bord" element={<Dashboard />} />
    <Route path="conges/:id" element={<CongeDetail />} />
  </Routes>
);}
TSX
"$PY" "$S/harvest-screens.py" "$G" --app demo --out "$WORK/g1.yaml" 2>/dev/null
grep -q 'route /rh/tableau-de-bord ' "$WORK/g1.yaml" \
  && ok "G1 : chemin d'un sous-routeur préfixé par son point de montage" \
  || ko "G1 : URL de module publiée sans son préfixe (404)"
absent "$WORK/g1.yaml" 'route /tableau-de-bord ' "G1b : le chemin relatif nu n'est pas publié" \
  "G1b : chemin relatif publié comme adresse absolue"
grep -q 'route /rh/conges/:id ' "$WORK/g1.yaml" && ok "G1c : segment dynamique préfixé" || ko "G1c : segment dynamique mal composé"
grep -q 'route /liste/:id ' "$WORK/g1.yaml" && ok "G1d : imbrication DANS un même fichier composée" || ko "G1d : imbrication interne ignorée"
# Une route de mise en page qui porte un `index` n'est pas un écran de plus à son adresse.
[ "$(grep -c 'technology: route / ' "$WORK/g1.yaml")" -eq 1 ] \
  && ok "G1e : mise en page + index → un seul écran à l'adresse" \
  || ko "G1e : le cadre et son contenu comptés comme deux écrans"
"$PY" "$S/validate-manifest.py" "$WORK/g1.yaml" >/dev/null 2>&1 \
  && ok "G1f : manifeste d'écrans valide (ids uniques)" || ko "G1f : ids dupliqués — manifeste rejeté"

# G2 — deux écrans DISTINCTS servis sur la même adresse (deux modules, un même /dashboard)
#      doivent recevoir deux ids. Dédupliquer sur l'URL seule les faisait s'écraser.
G2="$WORK/dup"; mkdir -p "$G2/src"
printf '{"dependencies":{"react-router-dom":"^6"}}\n' > "$G2/package.json"
cat > "$G2/src/App.tsx" <<'TSX'
<Routes>
  <Route path="/a/vue" element={<VueA />} />
  <Route path="/b/vue" element={<VueB />} />
</Routes>
TSX
"$PY" "$S/harvest-screens.py" "$G2" --app demo --out "$WORK/g2.yaml" 2>/dev/null
"$PY" "$S/validate-manifest.py" "$WORK/g2.yaml" >/dev/null 2>&1 && ok "G2 : ids d'écrans uniques" || ko "G2 : collision d'ids d'écrans"

# G3 — maquettes, instantanés de documentation et copies du dépôt ne sont PAS déployés.
G3="$WORK/junk"; mkdir -p "$G3/src" "$G3/src/maquette/v1" "$G3/DOC/snap/src" "$G3/modules/maquette"
printf '{"dependencies":{"react-router-dom":"^6"}}\n' > "$G3/package.json"
printf '<Routes><Route path="/reel" element={<Reel />} /></Routes>\n' > "$G3/src/App.tsx"
printf '<Routes><Route path="/maquette-only" element={<Faux />} /></Routes>\n' > "$G3/src/maquette/v1/App.tsx"
printf '<Routes><Route path="/doc-only" element={<Faux />} /></Routes>\n' > "$G3/DOC/snap/src/App.tsx"
printf '<Routes><Route path="/module-maquette" element={<Faux />} /></Routes>\n' > "$G3/modules/maquette/App.tsx"
"$PY" "$S/harvest-screens.py" "$G3" --app demo --out "$WORK/g3.yaml" 2>/dev/null
grep -q 'route /reel ' "$WORK/g3.yaml" && ok "G3 : l'écran réel est récolté" || ko "G3 : écran réel manquant"
for faux in maquette-only doc-only module-maquette; do
  absent "$WORK/g3.yaml" "route /$faux " "G3 : code non déployé exclu ($faux)" \
    "G3 : écran inventé depuis du code non déployé ($faux)"
done

# G4 — `'\'` est un littéral COMPLET (standard_conforming_strings). Le lire comme une chaîne
#      ouverte rouvre exactement la brèche D-20260731-0001 : une FK apparaît entre deux
#      tables qui n'en ont aucune.
G4="$WORK/backslash"; mkdir -p "$G4"
cat > "$G4/0001.sql" <<'SQL'
CREATE TABLE public.a (id uuid PRIMARY KEY);
CREATE TABLE public.b (id uuid PRIMARY KEY, c_id uuid);
CREATE TABLE public.c (id uuid PRIMARY KEY);
ALTER TABLE public.a ADD COLUMN sep text NOT NULL DEFAULT '\';
ALTER TABLE public.b ADD CONSTRAINT fk_b_c FOREIGN KEY (c_id) REFERENCES public.c(id);
CREATE TABLE public.d (slug text CHECK (slug NOT LIKE '%\_%' ESCAPE '\'));
CREATE TABLE public.e (id uuid, note text DEFAULT E'it\'s ok');
SQL
"$PY" "$S/harvest-supabase.py" "$G4" --app demo --out "$WORK/g4.yaml" 2>/dev/null
absent "$WORK/g4.yaml" 'from: demo.a' "G4 : aucune FK inventée depuis un littéral contre-barre" \
  "G4 : FK FABRIQUÉE — le littéral '\\' a fait déborder l'instruction"
grep -q 'from: demo.b' "$WORK/g4.yaml" && ok "G4b : la vraie FK b→c est récoltée" || ko "G4b : vraie FK perdue"
for t in d e; do
  grep -q "^    name: $t$" "$WORK/g4.yaml" && ok "G4c : table '$t' après un littéral contre-barre" \
    || ko "G4c : table '$t' perdue silencieusement"
done

# G5/G6/G7/G8 — lecture des attributs d'une balise Route.
G5="$WORK/attrs"; mkdir -p "$G5/src"
printf '{"dependencies":{"react-router-dom":"^6"}}\n' > "$G5/package.json"
printf 'export default function TableauDeBord(){}\n' > "$G5/src/TableauDeBord.tsx"
cat > "$G5/src/App.tsx" <<'TSX'
import TableauDeBord from './TableauDeBord';
<Routes>
  <Route path={ROUTES.HOME} element={<Calcule />} />
  {items.map((it, index) => (<Route key={index} path={it.path} element={<Item />} />))}
  <Route path="/tableau" element={<Cadre><TableauDeBord /><PiedDePage /></Cadre>} />
  <Route path="/auth/callback" element={<AuthCallbackPage />} />
</Routes>
TSX
"$PY" "$S/harvest-screens.py" "$G5" --app demo --out "$WORK/g5.yaml" 2>"$WORK/g5.err"
absent "$WORK/g5.yaml" 'ROUTES.HOME' "G5 : chemin calculé non récolté" "G5 : URL inventée depuis une expression"
grep -q 'chemin calculé' "$WORK/g5.err" && ok "G5b : chemin calculé SIGNALÉ sur stderr" || ko "G5b : chemin calculé tu en silence"
[ "$(grep -c 'technology: route / ' "$WORK/g5.yaml")" -eq 0 ] \
  && ok "G6 : key={index} n'est pas une route index" || ko "G6 : key={index} pris pour une route index"
grep -q 'name: TableauDeBord' "$WORK/g5.yaml" \
  && ok "G7 : écran le plus profond, pas le dernier tag" || ko "G7 : mauvais composant (dernier tag pris)"
grep -q 'name: AuthCallbackPage' "$WORK/g5.yaml" \
  && ok "G8 : un écran nommé Auth* n'est pas pris pour une garde" || ko "G8 : écran légitime avalé par la liste des cadres"

# G9 — PostgreSQL accepte des identifiants que le schéma du manifeste refuse. Émettre l'id
#      brut rendrait un gate strict INSATISFIABLE : impossible de le contenter sans écrire
#      un fait faux (I18).
G9="$WORK/idents"; mkdir -p "$G9"
cat > "$G9/0001.sql" <<'SQL'
CREATE TABLE réservations (id uuid PRIMARY KEY);
CREATE TABLE "Utilisateurs" (id uuid PRIMARY KEY);
CREATE TABLE "Audit-X"."Événements" (id uuid PRIMARY KEY);
CREATE TABLE reservations (id uuid PRIMARY KEY);
SQL
"$PY" "$S/harvest-supabase.py" "$G9" --app demo --out "$WORK/g9.yaml" 2>/dev/null
"$PY" "$S/validate-manifest.py" "$WORK/g9.yaml" >/dev/null 2>&1 \
  && ok "G9 : identifiants accentués/quotés → manifeste valide" || ko "G9 : id refusé par le schéma (gate insatisfiable)"
grep -q 'name: réservations' "$WORK/g9.yaml" && ok "G9b : le vrai nom est conservé dans name" || ko "G9b : nom réel perdu"

# G10 — un nom de racine contenant « : » ne doit pas casser le document.
"$PY" "$S/harvest-routes.py" "$REPO" --app demo-app --root-name "Morasse: hub" --out "$WORK/g10.yaml" 2>/dev/null
"$PY" "$S/validate-manifest.py" "$WORK/g10.yaml" >/dev/null 2>&1 \
  && ok "G10 : --root-name avec ':' → YAML valide" || ko "G10 : nom de racine non quoté, document cassé"

# ── Bilan ────────────────────────────────────────────────────────────────────
P=$(wc -l < "$PASS_FILE"); F=$(wc -l < "$FAIL_FILE")
echo; echo "== Bilan : ${P// /} réussis, ${F// /} échoués =="
[ "${F// /}" -eq 0 ] || exit 1
