#!/usr/bin/env bash
# session-start-pack-version.sh
# Hook SessionStart — avertit (non-bloquant) si la version du somtech-pack
# installée dans le projet n'est pas la dernière publiée.
#
# Sûreté absolue : ne JAMAIS ralentir ni bloquer le démarrage de Claude Code.
# - Skip silencieux si pas de `.somtech-pack/version.json` (projet non-pack).
# - La « dernière version » est mise en cache GLOBAL machine (~/.somtech/pack-latest.json) —
#   elle est identique pour tous les projets. Rafraîchie en ARRIÈRE-PLAN (détaché)
#   au plus 1×/24h → zéro attente réseau au démarrage.
# - Comparaison vs le cache : si plus vieux, nudge avec la commande de MAJ.
# - Pas d'auth/réseau/npm → no-op silencieux.
#
# Points d'injection (tests) : SOMTECH_PACK_CACHE, SOMTECH_PACK_TTL,
# SOMTECH_PACK_NPM (1=autoriser le refresh réseau, def 1 ; 0 = jamais).

set -uo pipefail

MARKER=".somtech-pack/version.json"
[ -f "$MARKER" ] || exit 0   # pas un projet pack → silence

PKG="@somtech-solutions/pack"
REGISTRY="https://npm.pkg.github.com"
CACHE="${SOMTECH_PACK_CACHE:-${HOME}/.somtech/pack-latest.json}"
TTL="${SOMTECH_PACK_TTL:-86400}"   # 24h
ALLOW_NPM="${SOMTECH_PACK_NPM:-1}"

# Extrait un numéro x.y.z d'un fichier (1ère occurrence d'une clé "version").
read_version() {
  grep -oE '"version"[[:space:]]*:[[:space:]]*"[0-9][^"]*"' "$1" 2>/dev/null \
    | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+[A-Za-z0-9.+-]*' | head -1
}

installed="$(read_version "$MARKER")"
[ -n "$installed" ] || exit 0

# Lire le cache global (latest + checkedAt).
latest=""; checked_at=0
if [ -f "$CACHE" ]; then
  latest="$(grep -oE '"latest"[[:space:]]*:[[:space:]]*"[^"]*"' "$CACHE" 2>/dev/null | head -1 | sed -E 's/.*"([^"]*)"$/\1/')"
  checked_at="$(grep -oE '"checkedAt"[[:space:]]*:[[:space:]]*[0-9]+' "$CACHE" 2>/dev/null | head -1 | grep -oE '[0-9]+$')"
  checked_at="${checked_at:-0}"
fi
now="$(date +%s)"

# Rafraîchir le cache EN ARRIÈRE-PLAN si périmé (jamais bloquant, détaché).
if [ "$ALLOW_NPM" = "1" ] && [ $(( now - checked_at )) -ge "$TTL" ] && command -v npm >/dev/null 2>&1; then
  (
    l="$(npm view "$PKG" version --registry="$REGISTRY" 2>/dev/null | tr -d '[:space:]')"
    dir="$(dirname "$CACHE")"; mkdir -p "$dir" 2>/dev/null
    printf '{"checkedAt":%s,"latest":"%s"}\n' "$now" "$l" > "$CACHE" 2>/dev/null
  ) >/dev/null 2>&1 &
  disown 2>/dev/null || true
fi

# Comparer avec ce qu'on a déjà en cache (le refresh ne sert qu'aux sessions suivantes).
[ -n "$latest" ] || exit 0

# ver_gt A B → 0 si A > B (semver numérique x.y.z, pré-release ignorée).
ver_gt() {
  local a="${1%%-*}" b="${2%%-*}" a1 a2 a3 b1 b2 b3
  IFS=. read -r a1 a2 a3 <<<"$a"; IFS=. read -r b1 b2 b3 <<<"$b"
  a1=${a1:-0}; a2=${a2:-0}; a3=${a3:-0}; b1=${b1:-0}; b2=${b2:-0}; b3=${b3:-0}
  if [ "$a1" -ne "$b1" ]; then [ "$a1" -gt "$b1" ]; return; fi
  if [ "$a2" -ne "$b2" ]; then [ "$a2" -gt "$b2" ]; return; fi
  [ "$a3" -gt "$b3" ]
}

if ver_gt "$latest" "$installed"; then
  cat <<EOF
<somtech-pack-update>
⚠️ somtech-pack : version **${installed}** installée dans ce projet, **${latest}** disponible.
Propose à l'utilisateur de mettre à jour (non-bloquant) :
   npx ${PKG}@latest update --dry-run   # aperçu, ne touche à rien
   npx ${PKG}@latest update             # appliquer (settings.json projet préservé)
</somtech-pack-update>
EOF
fi

exit 0
