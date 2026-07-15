#!/usr/bin/env bash
# ============================================================
# test-pack-version-check.sh — v1.1.0
# Teste le hook SessionStart de nudge de version du pack.
# Aucun réseau (SOMTECH_PACK_NPM=0 ou SOMTECH_PACK_FETCH stub).
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="${SCRIPT_DIR}/../session-start-pack-version.sh"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

# Crée un projet jetable. $3 = NEW (nouveau format) | OLD (ancien format) | NOMARKER.
mkproj() {
  local installed="$1" latest="$2" fmt="${3:-NEW}" d cache
  d="$(mktemp -d)"; cache="$d/cache.json"
  if [ "$fmt" = "OLD" ]; then
    mkdir -p "$d/.somtech-pack"
    printf '{"pack":{"version":"%s","modules":"core"}}\n' "$installed" > "$d/.somtech-pack/version.json"
  elif [ "$fmt" != "NOMARKER" ]; then
    mkdir -p "$d/.somtech-pack"
    printf '{"name":"@somtech-solutions/pack","version":"%s"}\n' "$installed" > "$d/.somtech-pack/version.json"
  fi
  [ "$latest" != "NOCACHE" ] && [ "$fmt" != "NOMARKER" ] \
    && printf '{"checkedAt":%s,"latest":"%s"}\n' "$(date +%s)" "$latest" > "$cache"
  echo "$d|$cache"
}

run_hook() {  # run_hook <installed> <latest|NOCACHE> [fmt] → stdout du hook
  local spec d cache; spec="$(mkproj "$1" "$2" "${3:-NEW}")"; d="${spec%%|*}"; cache="${spec##*|}"
  ( cd "$d" && SOMTECH_PACK_CACHE="$cache" SOMTECH_PACK_NPM=0 bash "$HOOK" ); rm -rf "$d"
}
run_hook_err() {  # → stderr seulement (doit être vide)
  local spec d cache; spec="$(mkproj "$1" "$2" "${3:-NEW}")"; d="${spec%%|*}"; cache="${spec##*|}"
  ( cd "$d" && SOMTECH_PACK_CACHE="$cache" SOMTECH_PACK_NPM=0 bash "$HOOK" 2>&1 1>/dev/null ); rm -rf "$d"
}

echo "== A. Pas de marqueur → no-op silencieux =="
[ -z "$(run_hook 0 x NOMARKER)" ] && ok "silence sans .somtech-pack/version.json" || ko "devrait être silencieux"

echo "== B. Installé < dernière → nudge systemMessage JSON VISIBLE (D-20260715-0006) =="
out="$(run_hook 1.3.0 1.3.1)"
# La sortie DOIT être du JSON avec la clé systemMessage (seul canal visible utilisateur).
echo "$out" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert "systemMessage" in d and "en retard" in d["systemMessage"]' 2>/dev/null \
  && ok "sortie = JSON {systemMessage} visible utilisateur" || ko "attendu JSON systemMessage : $out"
echo "$out" | grep -q "en retard" && echo "$out" | grep -q "npx @somtech-solutions/pack@latest update" \
  && ok "message : retard + commande MAJ" || ko "message incomplet : $out"

echo "== C. À jour → silence =="
[ -z "$(run_hook 1.3.1 1.3.1)" ] && ok "silence quand à jour" || ko "devrait être silencieux"

echo "== D. Installé > dernière → pas de nudge arrière =="
[ -z "$(run_hook 1.3.1 1.3.0)" ] && ok "pas de nudge si plus récent" || ko "ne devrait pas nudger"

echo "== E. Comparaison NUMÉRIQUE : 1.9.0 < 1.10.0 → nudge =="
echo "$(run_hook 1.9.0 1.10.0)" | grep -q "en retard" && ok "1.10.0 > 1.9.0 (numérique)" || ko "comparaison numérique ratée"

echo "== F. Pas de cache → silence (rien à comparer) =="
[ -z "$(run_hook 1.3.0 NOCACHE)" ] && ok "silence sans cache" || ko "devrait être silencieux"

echo "== G. ANCIEN format {\"pack\":{\"version\"}} lu correctement → nudge =="
echo "$(run_hook 1.0.0 1.3.1 OLD)" | grep -q "en retard" && ok "ancien format lu (1.0.0 < 1.3.1)" || ko "ancien format mal lu"

echo "== H. Versions malformées → pas de crash ET stderr VIDE (pas de bruit) =="
[ -z "$(run_hook_err abc 1.3.1)" ] && ok "installed='abc' : stderr vide" || ko "bruit stderr sur installed malformé"
[ -z "$(run_hook_err 1.3.0 abc)" ] && ok "latest='abc' : stderr vide" || ko "bruit stderr sur latest malformé"
[ -z "$(run_hook_err 1.2.3.4 1.3.1)" ] && ok "version 4-part : stderr vide" || ko "bruit stderr sur version 4-part"
[ -z "$(run_hook 1.3.0 abc)" ] && ok "latest='abc' → pas de faux nudge" || ko "faux nudge sur latest malformé"

echo "== I. pf_refresh_cache : pas de clobber si npm échoue (sourcing) =="
C="$(mktemp -d)/cache.json"; printf '{"checkedAt":1,"latest":"1.3.1"}\n' > "$C"
( export SOMTECH_PACK_CACHE="$C" SOMTECH_PACK_FETCH='printf ""'; source "$HOOK"; pf_refresh_cache )
grep -q '"latest":"1.3.1"' "$C" && ok "npm vide → cache NON écrasé (latest 1.3.1 conservé)" || ko "DANGER: cache clobberé à vide"
( export SOMTECH_PACK_CACHE="$C" SOMTECH_PACK_FETCH='printf "1.4.0\n"'; source "$HOOK"; pf_refresh_cache )
grep -q '"latest":"1.4.0"' "$C" && ok "npm OK → cache mis à jour (1.4.0)" || ko "cache non mis à jour sur succès"
rm -rf "$(dirname "$C")"

echo "== J. Message ferme la boucle : mentionne la PR chore/pack-vY + comment la merger (D-20260715-0005) =="
out="$(run_hook 1.3.0 1.3.1)"
{ echo "$out" | grep -q "chore/pack-v1.3.1" && echo "$out" | grep -qi "merge"; } \
  && ok "message mentionne la PR + le merge" || ko "message ne ferme pas la boucle : $out"

echo "== K. Fallback ~/.somtech : hook isolé (sans ../../scripts/shell) trouve la lib (D-20260715-0005) =="
ISO="$(mktemp -d)"; mkdir -p "$ISO/hooks" "$ISO/home/.somtech" "$ISO/proj/.somtech-pack"
cp "$SCRIPT_DIR/../session-start-pack-version.sh" "$ISO/hooks/"
cp "$SCRIPT_DIR/../../../scripts/shell/pack-freshness.sh" "$ISO/home/.somtech/"
printf '{"name":"@somtech-solutions/pack","version":"1.0.0"}\n' > "$ISO/proj/.somtech-pack/version.json"
printf '{"checkedAt":%s,"latest":"1.3.0"}\n' "$(date +%s)" > "$ISO/cache.json"
out="$( cd "$ISO/proj" && HOME="$ISO/home" SOMTECH_PACK_CACHE="$ISO/cache.json" SOMTECH_PACK_NPM=0 bash "$ISO/hooks/session-start-pack-version.sh" )"
echo "$out" | grep -q "en retard" && ok "hook isolé → lib trouvée via ~/.somtech (nudge produit)" || ko "fallback ~/.somtech KO (hook muet) : $out"
# contre-preuve : sans la lib nulle part → silence (pas de crash)
rm -f "$ISO/home/.somtech/pack-freshness.sh"
out2="$( cd "$ISO/proj" && HOME="$ISO/home" SOMTECH_PACK_CACHE="$ISO/cache.json" SOMTECH_PACK_NPM=0 bash "$ISO/hooks/session-start-pack-version.sh" 2>&1 )"
[ -z "$out2" ] && ok "lib introuvable partout → silence total (pas de crash)" || ko "devrait être muet sans lib : $out2"
rm -rf "$ISO"

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"; FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
