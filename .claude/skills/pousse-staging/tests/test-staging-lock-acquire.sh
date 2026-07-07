#!/usr/bin/env bash
# ============================================================
# test-staging-lock-acquire.sh
# Teste la résolution du contexte d'acquisition du verrou de sas (staging-lock-
# acquire.sh) : décisions SKIP / FAIL / READY selon l'état du repo.
#
# Ce que le helper garantit (partie scriptable de la story T-20260706-0007) :
#   • opt-in : app.yaml absent → SKIP (on ne casse pas les repos non liés) ;
#   • fail-CLOSED : app.yaml présent mais app_id vide → FAIL ;
#   • fail-CLOSED : pas de PR détentrice → FAIL (identité de livraison requise) ;
#   • nominal : app liée + PR → READY avec application_id/env/holder_pr/holder_label.
#
# RED : sans le helper, /pousse-staging n'avait AUCUN gate atomique — la décision
# reposait sur la discipline (Étape 1.5 best-effort). Chaque cas ci-dessous
# échouerait si la logique de décision était absente ou inversée.
# ============================================================
set -u

HERE="$(cd "$(dirname "$0")/../lib" && pwd)"
# shellcheck source=/dev/null
. "$HERE/staging-lock-acquire.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail=0
ok()  { printf '  ✅ %s\n' "$1"; }
ko()  { printf '  ❌ %s\n' "$1"; fail=1; }
eq()  { [ "$2" = "$3" ] && ok "$1" || { ko "$1"; printf '     attendu=[%s] obtenu=[%s]\n' "$3" "$2"; }; }
has() { printf '%s' "$2" | grep -q -- "$3" && ok "$1" || { ko "$1"; printf '     [%s] ne contient pas [%s]\n' "$2" "$3"; }; }
field() { printf '%s\n' "$1" | awk -F= -v k="$2" '$1==k{sub(/^[^=]*=/,"");print;exit}'; }

APP_ID="065c9288-8754-46c1-9090-ad235ed971a3"

mk_yaml() { # $1=dossier, $2=app_id (vide => champ omis)
  mkdir -p "$1/.somtech"
  {
    echo "servicedesk:"
    [ -n "$2" ] && echo "  app_id: $2"
    echo "  app_name: ConstructionGauthier"
    echo "  app_slug: cg-chatbot"
    echo "somcraft:"
    echo "  workspace_id: ws-xyz"
  } > "$1/.somtech/app.yaml"
}

echo "→ Cas 1 : app.yaml ABSENT → SKIP (opt-in, on continue sans verrou), rc=0"
out="$( SLA_APP_YAML="$TMP/none/.somtech/app.yaml" SLA_HOLDER_PR="123" sla_resolve feat/A )"; rc=$?
eq  "rc=0" "$rc" "0"
eq  "DECISION=SKIP" "$(field "$out" DECISION)" "SKIP"

echo "→ Cas 2 : app.yaml présent + app_id VIDE → FAIL fail-closed, rc=5"
mk_yaml "$TMP/noid" ""
out="$( SLA_APP_YAML="$TMP/noid/.somtech/app.yaml" SLA_HOLDER_PR="123" sla_resolve feat/A )"; rc=$?
eq  "rc=5" "$rc" "5"
eq  "DECISION=FAIL" "$(field "$out" DECISION)" "FAIL"

echo "→ Cas 3 : app liée mais AUCUNE PR (SLA_HOLDER_PR vide) → FAIL fail-closed, rc=6"
mk_yaml "$TMP/nopr" "$APP_ID"
out="$( SLA_APP_YAML="$TMP/nopr/.somtech/app.yaml" SLA_HOLDER_PR="" sla_resolve feat/A )"; rc=$?
eq  "rc=6" "$rc" "6"
eq  "DECISION=FAIL" "$(field "$out" DECISION)" "FAIL"
has "message oriente PR-tôt" "$out" "PR-tôt"

echo "→ Cas 4 : app liée + PR détentrice → READY avec params complets, rc=0"
mk_yaml "$TMP/ok" "$APP_ID"
out="$( SLA_APP_YAML="$TMP/ok/.somtech/app.yaml" SLA_ENV="staging" SLA_HOLDER_PR="456" sla_resolve feat/export-pdf )"; rc=$?
eq  "rc=0" "$rc" "0"
eq  "DECISION=READY"                "$(field "$out" DECISION)"       "READY"
eq  "application_id résolu"         "$(field "$out" application_id)" "$APP_ID"
eq  "env=staging"                   "$(field "$out" env)"            "staging"
eq  "holder_pr=456"                 "$(field "$out" holder_pr)"      "456"
eq  "holder_label=branche courante" "$(field "$out" holder_label)"   "feat/export-pdf"

echo "→ Cas 5 : sla_read_app_id ne confond pas app_id avec un autre *_id (client_id, workspace_id)"
mkdir -p "$TMP/multi/.somtech"
{
  echo "servicedesk:"
  echo "  client_id: CLIENT-NE-PAS-PRENDRE"
  echo "  app_id: $APP_ID"
  echo "somcraft:"
  echo "  workspace_id: WS-NE-PAS-PRENDRE"
} > "$TMP/multi/.somtech/app.yaml"
eq  "app_id correctement extrait" "$(sla_read_app_id "$TMP/multi/.somtech/app.yaml")" "$APP_ID"

echo "→ Cas 6 : SLA_ENV override respecté (env par défaut = staging)"
mk_yaml "$TMP/env" "$APP_ID"
out="$( SLA_APP_YAML="$TMP/env/.somtech/app.yaml" SLA_HOLDER_PR="1" sla_resolve feat/A )"
eq  "env défaut=staging" "$(field "$out" env)" "staging"

echo
[ "$fail" -eq 0 ] && { echo "✅ TOUS LES TESTS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
