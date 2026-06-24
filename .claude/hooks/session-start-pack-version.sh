#!/usr/bin/env bash
# session-start-pack-version.sh
# Hook SessionStart — avertit (non-bloquant) si la version du somtech-pack
# installée dans le projet n'est pas la dernière publiée.
#
# Sûreté absolue : ne JAMAIS ralentir ni bloquer le démarrage de Claude Code,
# et ne produire AUCUN bruit (stdout/stderr) hors le nudge volontaire.
# - Skip silencieux si pas de `.somtech-pack/version.json` (projet non-pack).
# - « latest » en cache GLOBAL machine (~/.somtech/pack-latest.json) — identique
#   pour tous les projets. Rafraîchi en ARRIÈRE-PLAN (détaché) au plus 1×/24h.
# - Le refresh n'écrase le cache QUE s'il obtient une version plausible (sinon
#   l'ancien `latest` est conservé → un échec npm n'aveugle pas le nudge).
# - Comparaison semver NUMÉRIQUE (pur bash, segments sanitizés → pas de stderr).
# - Fail-silent partout (pas d'auth/réseau/npm → no-op).
#
# Sourçable (les fonctions sont exposées sans lancer le main) pour les tests.
# Points d'injection (tests) : SOMTECH_PACK_CACHE, SOMTECH_PACK_TTL,
# SOMTECH_PACK_NPM (1=refresh autorisé, def 1), SOMTECH_PACK_FETCH (commande
# alternative pour obtenir la dernière version — stub de test).

set -uo pipefail

MARKER=".somtech-pack/version.json"
PKG="@somtech-solutions/pack"
REGISTRY="https://npm.pkg.github.com"
CACHE="${SOMTECH_PACK_CACHE:-${HOME:-/tmp}/.somtech/pack-latest.json}"
TTL="${SOMTECH_PACK_TTL:-86400}"   # 24h
ALLOW_NPM="${SOMTECH_PACK_NPM:-1}"

# Extrait un numéro x.y.z d'un fichier (1ère occurrence d'une clé "version").
read_version() {
  grep -oE '"version"[[:space:]]*:[[:space:]]*"[0-9][^"]*"' "$1" 2>/dev/null \
    | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+[A-Za-z0-9.+-]*' | head -1
}

# fetch_latest : émet la dernière version publiée (ou rien). Stubbable en test.
fetch_latest() {
  if [ -n "${SOMTECH_PACK_FETCH:-}" ]; then
    eval "${SOMTECH_PACK_FETCH}" 2>/dev/null
  else
    npm view "$PKG" version --registry="$REGISTRY" 2>/dev/null
  fi
}

# refresh_cache : met à jour le cache UNIQUEMENT si on obtient un semver plausible
# (sinon : ne touche à rien → conserve l'ancien latest, pas de clobber offline).
refresh_cache() {
  local l; l="$(fetch_latest | tr -d '[:space:]')"
  printf '%s' "$l" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+' || return 0
  local dir; dir="$(dirname "$CACHE")"; mkdir -p "$dir" 2>/dev/null || return 0
  printf '{"checkedAt":%s,"latest":"%s"}\n' "$(date +%s)" "$l" > "$CACHE" 2>/dev/null || return 0
}

# ver_gt A B → 0 si A > B (semver numérique x.y.z ; segments non-numériques → 0).
ver_gt() {
  local a="${1%%-*}" b="${2%%-*}" a1 a2 a3 b1 b2 b3 _
  IFS=. read -r a1 a2 a3 _ <<<"$a"
  IFS=. read -r b1 b2 b3 _ <<<"$b"
  a1="${a1//[!0-9]/}"; a2="${a2//[!0-9]/}"; a3="${a3//[!0-9]/}"
  b1="${b1//[!0-9]/}"; b2="${b2//[!0-9]/}"; b3="${b3//[!0-9]/}"
  a1="${a1:-0}"; a2="${a2:-0}"; a3="${a3:-0}"; b1="${b1:-0}"; b2="${b2:-0}"; b3="${b3:-0}"
  if [ "$a1" -ne "$b1" ]; then [ "$a1" -gt "$b1" ]; return; fi
  if [ "$a2" -ne "$b2" ]; then [ "$a2" -gt "$b2" ]; return; fi
  [ "$a3" -gt "$b3" ]
}

# --- Programme principal (ignoré si le fichier est SOURCÉ, p.ex. par les tests) ---
spv_main() {
  [ -f "$MARKER" ] || return 0   # pas un projet pack → silence

  local installed latest checked_at now
  installed="$(read_version "$MARKER")"
  [ -n "$installed" ] || return 0

  latest=""; checked_at=0
  if [ -f "$CACHE" ]; then
    latest="$(grep -oE '"latest"[[:space:]]*:[[:space:]]*"[^"]*"' "$CACHE" 2>/dev/null | head -1 | sed -E 's/.*"([^"]*)"$/\1/')"
    checked_at="$(grep -oE '"checkedAt"[[:space:]]*:[[:space:]]*[0-9]+' "$CACHE" 2>/dev/null | head -1 | grep -oE '[0-9]+$')"
    checked_at="${checked_at:-0}"
  fi
  now="$(date +%s)"

  # Rafraîchir le cache EN ARRIÈRE-PLAN si périmé (jamais bloquant, détaché).
  if [ "$ALLOW_NPM" = "1" ] && [ $(( now - checked_at )) -ge "$TTL" ]; then
    if [ -n "${SOMTECH_PACK_FETCH:-}" ] || command -v npm >/dev/null 2>&1; then
      ( refresh_cache ) >/dev/null 2>&1 &
      disown 2>/dev/null || true
    fi
  fi

  [ -n "$latest" ] || return 0   # rien à comparer
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
  return 0
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  spv_main
  exit 0
fi
