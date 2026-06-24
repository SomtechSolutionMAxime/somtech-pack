#!/usr/bin/env bash
# ============================================================
# test-pack-version-check.sh — v1.0.0
# Teste le hook SessionStart de nudge de version du pack.
# Aucun réseau (SOMTECH_PACK_NPM=0, cache pré-seedé frais).
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="${SCRIPT_DIR}/../session-start-pack-version.sh"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

# Émet la sortie du hook pour un projet (installed) + cache (latest | NOCACHE | NOMARKER).
hook_out() {
  local installed="$1" latest="$2" d cache
  d="$(mktemp -d)"; cache="$d/cache.json"
  if [ "$latest" != "NOMARKER" ]; then
    mkdir -p "$d/.somtech-pack"
    printf '{"name":"@somtech-solutions/pack","version":"%s"}\n' "$installed" > "$d/.somtech-pack/version.json"
  fi
  if [ "$latest" != "NOCACHE" ] && [ "$latest" != "NOMARKER" ]; then
    printf '{"checkedAt":%s,"latest":"%s"}\n' "$(date +%s)" "$latest" > "$cache"
  fi
  ( cd "$d" && SOMTECH_PACK_CACHE="$cache" SOMTECH_PACK_NPM=0 bash "$HOOK" )
  rm -rf "$d"
}

echo "== A. Pas de marqueur → no-op silencieux =="
out="$(hook_out 0 NOMARKER)"
[ -z "$out" ] && ok "aucune sortie sans .somtech-pack/version.json" || ko "devrait être silencieux : $out"

echo "== B. Installé < dernière → nudge avec la commande =="
out="$(hook_out 1.3.0 1.3.1)"
echo "$out" | grep -q "disponible" && echo "$out" | grep -q "npx @somtech-solutions/pack@latest update" \
  && ok "nudge affiché avec la commande de MAJ" || ko "nudge attendu : $out"

echo "== C. À jour → silence =="
out="$(hook_out 1.3.1 1.3.1)"
[ -z "$out" ] && ok "aucune sortie quand à jour" || ko "devrait être silencieux : $out"

echo "== D. Installé > dernière → pas de nudge arrière =="
out="$(hook_out 1.3.1 1.3.0)"
[ -z "$out" ] && ok "pas de nudge si installé plus récent" || ko "ne devrait pas nudger : $out"

echo "== E. Comparaison NUMÉRIQUE (pas lexicale) : 1.9.0 < 1.10.0 → nudge =="
out="$(hook_out 1.9.0 1.10.0)"
echo "$out" | grep -q "disponible" && ok "1.10.0 > 1.9.0 détecté (numérique)" || ko "comparaison numérique ratée : $out"

echo "== F. Pas de cache (latest inconnu) → silence (rien à comparer) =="
out="$(hook_out 1.3.0 NOCACHE)"
[ -z "$out" ] && ok "silence sans cache (pas de faux nudge)" || ko "devrait être silencieux : $out"

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"; FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
