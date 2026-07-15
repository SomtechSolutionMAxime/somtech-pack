#!/usr/bin/env bash
# ============================================================
# test-pack-freshness.sh — lib de détection de fraîcheur du pack (T-20260715-0002)
# Teste les fonctions pf_* extraites, sourçables, namespacées. Aucun réseau.
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

echo "== A. pf_ver_gt : comparaison sémantique numérique =="
pf_ver_gt 1.3.1 1.3.0 && ok "1.3.1 > 1.3.0" || ko "1.3.1 devrait être > 1.3.0"
pf_ver_gt 1.10.0 1.9.0 && ok "1.10.0 > 1.9.0 (numérique, pas lexical)" || ko "comparaison numérique ratée"
pf_ver_gt 1.3.0 1.3.1 && ko "1.3.0 ne devrait PAS être > 1.3.1" || ok "1.3.0 < 1.3.1"
pf_ver_gt 1.3.1 1.3.1 && ko "égalité ne devrait PAS être >" || ok "1.3.1 == 1.3.1 (pas >)"

echo "== B. pf_read_version : nouveau + ancien format =="
d="$(mktemp -d)"; mkdir -p "$d/.somtech-pack"
printf '{"name":"@somtech-solutions/pack","version":"1.5.0"}\n' > "$d/.somtech-pack/version.json"
[ "$(pf_read_version "$d/.somtech-pack/version.json")" = "1.5.0" ] && ok "nouveau format → 1.5.0" || ko "nouveau format mal lu"
printf '{"pack":{"version":"1.2.0","modules":"core"}}\n' > "$d/.somtech-pack/version.json"
[ "$(pf_read_version "$d/.somtech-pack/version.json")" = "1.2.0" ] && ok "ancien format → 1.2.0" || ko "ancien format mal lu"
rm -rf "$d"

echo "== C. pf_check <dir> : en retard → echo 'installed latest', rc 0 =="
mkproj() { # <installed> <latest|NOCACHE> <fmt: NEW|NOMARKER> → echo "dir|cache"
  local inst="$1" lat="$2" fmt="${3:-NEW}" d cache; d="$(mktemp -d)"; cache="$d/cache.json"
  if [ "$fmt" != "NOMARKER" ]; then mkdir -p "$d/.somtech-pack"
    printf '{"name":"@somtech-solutions/pack","version":"%s"}\n' "$inst" > "$d/.somtech-pack/version.json"; fi
  [ "$lat" != "NOCACHE" ] && printf '{"checkedAt":%s,"latest":"%s"}\n' "$(date +%s)" "$lat" > "$cache"
  echo "$d|$cache"
}
run_check() { local s d c; s="$(mkproj "$1" "$2" "${3:-NEW}")"; d="${s%%|*}"; c="${s##*|}"
  ( SOMTECH_PACK_CACHE="$c" SOMTECH_PACK_NPM=0 pf_check "$d" ); local rc=$?; rm -rf "$d"; return $rc; }
out="$(run_check 1.3.0 1.3.1)"; rc=$?
{ [ $rc -eq 0 ] && echo "$out" | grep -q "1.3.0" && echo "$out" | grep -q "1.3.1"; } \
  && ok "en retard → rc 0 + 'installed latest'" || ko "attendu rc0+versions, eu rc=$rc out='$out'"

echo "== D. pf_check : à jour → silence, rc≠0 =="
out="$(run_check 1.3.1 1.3.1)"; rc=$?
{ [ $rc -ne 0 ] && [ -z "$out" ]; } && ok "à jour → silence + rc≠0" || ko "devrait être silencieux (rc=$rc out='$out')"

echo "== E. pf_check : pas de marqueur → silence, rc≠0 =="
out="$(run_check 0 x NOMARKER)"; rc=$?
{ [ $rc -ne 0 ] && [ -z "$out" ]; } && ok "sans marqueur → silence" || ko "devrait être silencieux (rc=$rc out='$out')"

echo "== F. pf_check : pas de cache → silence (rien à comparer) =="
out="$(run_check 1.3.0 NOCACHE)"; rc=$?
{ [ $rc -ne 0 ] && [ -z "$out" ]; } && ok "sans cache → silence" || ko "devrait être silencieux (rc=$rc out='$out')"

echo "== G. pf_refresh_cache : pas de clobber si fetch vide =="
C="$(mktemp -d)/cache.json"; printf '{"checkedAt":1,"latest":"1.3.1"}\n' > "$C"
( export SOMTECH_PACK_CACHE="$C" SOMTECH_PACK_FETCH='printf ""'; pf_refresh_cache )
grep -q '"latest":"1.3.1"' "$C" && ok "fetch vide → cache conservé" || ko "DANGER cache clobberé"
( export SOMTECH_PACK_CACHE="$C" SOMTECH_PACK_FETCH='printf "1.4.0\n"'; pf_refresh_cache )
grep -q '"latest":"1.4.0"' "$C" && ok "fetch OK → cache 1.4.0" || ko "cache non mis à jour"
rm -rf "$(dirname "$C")"

echo "== H. Malformé → pas de crash, stderr vide =="
err="$(run_check abc 1.3.1 2>&1 1>/dev/null)"; [ -z "$err" ] && ok "installed malformé → stderr vide" || ko "bruit: $err"
err="$(run_check 1.3.0 abc 2>&1 1>/dev/null)"; [ -z "$err" ] && ok "latest malformé → stderr vide" || ko "bruit: $err"

echo "== I. pf_nudge_launch : avertit si en retard, silence sinon =="
run_nudge() { local s d c; s="$(mkproj "$1" "$2" "${3:-NEW}")"; d="${s%%|*}"; c="${s##*|}"
  ( SOMTECH_PACK_CACHE="$c" SOMTECH_PACK_NPM=0 pf_nudge_launch "$d" 2>&1 ); local rc=$?; rm -rf "$d"; return $rc; }
out="$(run_nudge 1.3.0 1.3.1)"; rc=$?
{ [ $rc -eq 0 ] && echo "$out" | grep -q "en retard" && echo "$out" | grep -q "npx @somtech-solutions/pack@latest update"; } \
  && ok "en retard → avertissement + commande, rc 0" || ko "attendu avertissement (rc=$rc out='$out')"
out="$(run_nudge 1.3.1 1.3.1)"; rc=$?
{ [ $rc -eq 0 ] && [ -z "$out" ]; } && ok "à jour → silence total" || ko "devrait être silencieux (out='$out')"
out="$(run_nudge 0 x NOMARKER)"; rc=$?
{ [ $rc -eq 0 ] && [ -z "$out" ]; } && ok "sans marqueur → silence" || ko "devrait être silencieux (out='$out')"

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"; FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
