#!/usr/bin/env bash
# ============================================================
# test-archi-ci-corpus.sh — validation des récolteurs sur CORPUS RÉEL (D-20260804-0006).
#
# STD-031 §2.7.9 / I19 : « un récolteur n'est opposable aux repos qu'après avoir été validé
# contre des sources réelles ». Trois critères, tous éliminatoires :
#   1. ZÉRO FAUX POSITIF sur au moins un dépôt discipliné réel — pas sur des fixtures.
#   2. INVARIANT D'ÉCHELLE — le nombre de faux positifs ne croît pas avec la taille du dépôt.
#   3. MOTIFS MAJORITAIRES des projets disciplinés couverts.
#
# La suite de fixtures (test-archi-ci-toolkit.sh) prouve le comportement unitaire ; ELLE NE
# SUFFIT PAS à I19, qui exige explicitement des sources réelles. Ce fichier est donc le
# complément non-substituable, pas un doublon.
#
# Les dépôts du corpus sont lus en LECTURE SEULE. Aucune écriture, jamais (règle d'or n°7).
# Absents du poste (CI, autre machine) → le test se SAUTE : I19 se prouve là où le corpus
# existe, il ne se simule pas.
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
S="${SOMTECH_ARCHI_CI:-${SCRIPT_DIR}/../archi-ci}"
CORPUS_ROOT="${SOMTECH_CORPUS_ROOT:-$HOME/GitRepo.nosync}"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
WORK="$(mktemp -d)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"; rm -rf "$WORK"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

PY="${SOMTECH_PYTHON:-python3}"
command -v "$PY" >/dev/null 2>&1 || { echo "⚠️  python3 indisponible — corpus sauté (skip)"; exit 0; }

CORPUS="actionprogex constructiongauthier print-template-hub servicedesk-somtech"
missing=""
for r in $CORPUS; do [ -d "$CORPUS_ROOT/$r" ] || missing="$missing $r"; done
if [ -n "$missing" ]; then
  echo "⚠️  Corpus absent de ce poste ($CORPUS_ROOT) :$missing"
  echo "    Validation I19 SAUTÉE — elle exige les dépôts réels, on ne la simule pas."
  exit 0
fi

harvest() {  # $1 = dépôt
  "$PY" "$S/harvest-supabase.py" --discover "$CORPUS_ROOT/$1" --app "$1" \
        --out "$WORK/$1-tables.yaml" 2>"$WORK/$1-tables.err"
  "$PY" "$S/harvest-routes.py"  "$CORPUS_ROOT/$1" --app "$1" --out "$WORK/$1-routes.yaml"  2>/dev/null
  "$PY" "$S/harvest-screens.py" "$CORPUS_ROOT/$1" --app "$1" --out "$WORK/$1-screens.yaml" 2>/dev/null
}
count_kind() { grep -c "^    kind: $2$" "$1" 2>/dev/null || true; }

for r in $CORPUS; do harvest "$r"; done

# ── Critère 1 — ZÉRO FAUX POSITIF, prouvé sur le dépôt entièrement vérifiable ─────────────
# Morasse (print-template-hub) est le dépôt discipliné de référence : assez petit pour que
# la liste de ses tables soit vérifiable à la main, assez retors pour être représentatif
# (schéma éclaté entre un dump `pg_dump` à identifiants quotés, un second dossier de
# migrations hors `supabase/`, et un jeu de données de test à NE PAS confondre avec le schéma).
echo "== 1. Zéro faux positif — print-template-hub (Morasse), vérité terrain complète =="
M="$WORK/print-template-hub-tables.yaml"
# Liste vérifiée à la main contre les CREATE TABLE des trois emplacements de schéma du
# dépôt (supabase/_baseline_prod_public.sql, supabase/migrations/, scripts/migrations/).
EXPECTED_TABLES="archive_import_logs archive_line_items archive_matrices archive_rows \
archive_sources audit_logs central_marks clients comptes csv_reference \
demande_activity_log demande_attachments demande_messages demande_watchers demandes \
matrices matrix_assets matrix_import_logs matrix_lines matrix_sources \
matrix_type_central_marks matrix_type_openings matrix_types matrix_versions \
openings profiles"
manquantes=""
for t in $EXPECTED_TABLES; do
  grep -q "^    name: $t$" "$M" || manquantes="$manquantes $t"
done
[ -z "$manquantes" ] && ok "toutes les tables attendues sont récoltées" \
  || ko "tables réelles MANQUANTES :$manquantes"

# Le jeu de données de test et les brouillons ne sont pas le schéma déployé.
for interdit in fixture_qa _test_branching; do
  grep -q "name: $interdit" "$M" && ko "table de test/brouillon entrée dans le modèle : $interdit" \
    || ok "hors-schéma exclu : $interdit"
done
NB_M=$(count_kind "$M" table)
[ "$NB_M" -ge 21 ] && [ "$NB_M" -le 30 ] \
  && ok "volumétrie plausible ($NB_M tables ; le manifeste tenu à la main en déclare 25)" \
  || ko "volumétrie suspecte : $NB_M tables"

# Les écrans récoltés doivent correspondre aux routes réelles, sans garde ni composant hors-route.
MS="$WORK/print-template-hub-screens.yaml"
for ecran in MatrixWorkspace MatrixEditor Login ResetPassword DemandeDetail; do
  grep -q "name: $ecran" "$MS" || ko "écran réel manquant : $ecran"
done
grep -q "name: RequireAuth" "$MS" && ko "garde d'authentification publiée comme écran" \
  || ok "écrans nommés par leur composant, jamais par leur garde"
grep -qE "technology: route /(AdminUsers|ClientCreator|HomeWip) " "$MS" \
  && ko "écran inventé depuis src/pages (app Vite lue comme du Next.js)" \
  || ok "aucun écran inventé depuis la convention d'un autre framework"

# ── Critère 2 — INVARIANT D'ÉCHELLE ───────────────────────────────────────────────────────
# Le dépôt le plus gros du corpus (constructiongauthier : 462 fichiers SQL, 178 activations
# de RLS) ne doit pas produire PLUS d'erreurs que le plus petit. C'est ce que le défaut
# D-20260731-0001 faisait : son appariement non borné fabriquait une relation de plus à
# chaque fichier ajouté. On vérifie ici que la précision ne dépend plus de la taille.
echo "== 2. Invariant d'échelle — constructiongauthier (le plus gros dépôt) =="
CG="$WORK/constructiongauthier-tables.yaml"

# Toute relation récoltée doit relier deux tables DÉCLARÉES dans le même manifeste :
# une arête qui pointe dans le vide est le signe d'un appariement qui a débordé.
"$PY" - "$CG" > "$WORK/cg-orphans.txt" <<'PYEOF'
import re, sys
text = open(sys.argv[1]).read()
ids = set(re.findall(r"^  - id: (\S+)$", text, re.M))
bad = [f"{f}→{t}" for f, t in re.findall(r"^  - from: (\S+)\n    to: (\S+)", text, re.M)
       if f not in ids]
sys.stdout.write("\n".join(bad))
PYEOF
[ ! -s "$WORK/cg-orphans.txt" ] && ok "aucune relation dont la source n'existe pas (arête fabriquée)" \
  || ko "relations orphelines : $(head -c 200 "$WORK/cg-orphans.txt")"

# Une table supprimée par une migration ultérieure ne doit plus figurer au manifeste.
for droppee in notifications team_members; do
  grep -q "^    name: $droppee$" "$CG" && ko "table DROP TABLE encore déclarée : $droppee" \
    || ok "table supprimée absente du manifeste : $droppee"
done
# Une table renommée figure sous son nom FINAL, jamais sous les deux.
grep -q "name: user_profiles" "$CG" && ! grep -q "^    name: app_users$" "$CG" \
  && ok "renommage suivi (app_users → user_profiles)" || ko "renommage non suivi"

# ── Critère 3 — MOTIFS MAJORITAIRES DES PROJETS DISCIPLINÉS ───────────────────────────────
# §2.7.9 nomme l'effet pervers à éviter : un outil dont la sortie se dégrade quand la
# discipline du projet augmente rend la conformité coûteuse. On teste donc explicitement
# les marques de rigueur — schémas dédiés, commentaires SQL, migrations défensives,
# fichiers de test — et on exige qu'elles AIDENT la récolte au lieu de la casser.
echo "== 3. Motifs des projets disciplinés — la rigueur ne doit jamais nuire =="

# Isolation par schéma dédié (posture Loi 25) : le schéma doit survivre à la récolte.
grep -q "id: constructiongauthier.audit.audit_log" "$CG" \
  && ok "schéma dédié conservé (audit.audit_log)" || ko "schéma dédié écrasé"
grep -q "id: constructiongauthier.maestro.entities" "$CG" \
  && ok "schéma dédié conservé (maestro.entities)" || ko "schéma dédié écrasé"

# Documentation du schéma : COMMENT ON TABLE est LA source de description traçable.
for r in actionprogex constructiongauthier; do
  T="$WORK/$r-tables.yaml"
  total=$(count_kind "$T" table); decrites=$(grep -c "^    description: " "$T" || true)
  if [ "$total" -gt 0 ] && [ "$decrites" -gt $(( total / 2 )) ]; then
    ok "$r : $decrites/$total tables décrites depuis COMMENT ON TABLE"
  else
    ko "$r : seulement $decrites/$total tables décrites"
  fi
done

# Migration défensive (DO $$ … IF NOT EXISTS … CREATE TABLE) : motif de projet prudent.
grep -q "name: news_rsvp" "$CG" \
  && ok "table créée dans un DO \$\$ conditionnel récoltée" || ko "migration défensive invisible"

# Tests colocalisés avec le code : `route.test.ts` ne doit jamais devenir un endpoint.
AR="$WORK/actionprogex-routes.yaml"
grep -qE "name: ANY /api/(assistant|health|outlook-sync|voice-agent)$" "$AR" \
  && ko "fichier de test publié comme endpoint (méthode ANY fantôme)" \
  || ok "les fichiers de test ne produisent pas d'endpoint"
# Monorepo : le chemin publié est l'URL servie, pas l'arborescence du dépôt.
# On inspecte les NOMS d'endpoints : un chemin de dépôt cité dans une description récoltée
# est du texte de commentaire, pas une URL — le confondre ferait échouer sur du bruit.
grep -q "name: POST /api/assistant" "$AR" && ! grep -qE "^    name: \S+ /src/" "$AR" \
  && ok "monorepo : URL réelle, sans préfixe de workspace" || ko "URL fantôme préfixée par le workspace"

# Surface Supabase : sans elle, la doc affirme qu'une app n'a pas d'API alors qu'elle en a.
for r in actionprogex constructiongauthier servicedesk-somtech; do
  n=$(grep -c "technology: supabase-edge" "$WORK/$r-routes.yaml" || true)
  [ "$n" -ge 20 ] && ok "$r : $n Edge Functions récoltées" || ko "$r : seulement $n Edge Functions"
done

# ── Bout en bout — le manifeste produit doit être un document VALIDE ──────────────────────
# Un grain juste qui ne survit pas à la fusion ne vaut rien : c'est le manifeste fusionné
# qui est comparé au fichier committé par le gate. Ce contrôle a débusqué deux défauts que
# les récolteurs pris isolément ne montraient pas — une description contenant « : » réécrite
# sans quote (document YAML invalide) et une collision d'id entre la table `matrices` et
# l'écran de la route `/matrices`, qui faisait disparaître un élément à la fusion.
echo "== 4. Bout en bout — fusion, validation et ERD sur chaque dépôt du corpus =="
"$PY" -c 'import yaml' 2>/dev/null || echo "  (PyYAML absent — fusion/validation sautées)"
if "$PY" -c 'import yaml' 2>/dev/null; then
  for r in $CORPUS; do
    "$PY" "$S/harvest-config.py" "$CORPUS_ROOT/$r" --app "$r" --out "$WORK/$r-config.yaml" 2>/dev/null
    "$PY" "$S/merge-manifests.py" "$WORK/$r-tables.yaml" "$WORK/$r-config.yaml" \
          "$WORK/$r-routes.yaml" "$WORK/$r-screens.yaml" \
          --app "$r" --out "$WORK/$r-full.yaml" 2>"$WORK/$r-merge.err"
    if [ -s "$WORK/$r-merge.err" ] && grep -q "Conflit de kind" "$WORK/$r-merge.err"; then
      ko "$r : collision d'id entre grains à la fusion — $(grep -m1 'Conflit' "$WORK/$r-merge.err")"
    else
      ok "$r : grains fusionnés sans collision d'id"
    fi
    "$PY" "$S/validate-manifest.py" "$WORK/$r-full.yaml" >/dev/null 2>&1 \
      && ok "$r : manifeste fusionné valide (schéma)" \
      || ko "$r : manifeste fusionné INVALIDE — $("$PY" "$S/validate-manifest.py" "$WORK/$r-full.yaml" 2>&1 | sed -n '2p')"
  done
fi

# ── Bilan ────────────────────────────────────────────────────────────────────
P=$(wc -l < "$PASS_FILE"); F=$(wc -l < "$FAIL_FILE")
echo; echo "== Bilan corpus : ${P// /} réussis, ${F// /} échoués =="
[ "${F// /}" -eq 0 ] || exit 1
