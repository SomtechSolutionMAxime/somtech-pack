# shellcheck shell=bash
# ============================================================
# pack-freshness.sh — détection (pure, sourçable) de la fraîcheur du somtech-pack.
#
# Extrait de .claude/hooks/session-start-pack-version.sh (T-20260715-0002) pour être
# partagé SANS duplication entre le hook SessionStart et le launcher claude-swt.
#
# Contrats :
#  - Aucun effet de bord au sourcing (ne définit que des fonctions pf_*).
#  - Fonctions NAMESPACÉES pf_* (le launcher est sourcé dans le shell interactif du
#    dev → jamais polluer/écraser des fonctions génériques comme `ver_gt`).
#  - Fail-silent partout : pas d'auth/réseau/npm → no-op, jamais de bruit stderr.
#  - « latest » en cache GLOBAL machine (~/.somtech/pack-latest.json), rafraîchi en
#    ARRIÈRE-PLAN (détaché) au plus 1×/PF_TTL. Un fetch qui échoue NE clobbère PAS le
#    cache (un échec npm n'aveugle pas la détection).
#
# Points d'injection (tests) : SOMTECH_PACK_CACHE, SOMTECH_PACK_TTL,
#   SOMTECH_PACK_NPM (1=refresh autorisé, def 1), SOMTECH_PACK_FETCH (stub de fetch).
# ============================================================

PF_PKG="@somtech-solutions/pack"
PF_REGISTRY="https://npm.pkg.github.com"
PF_MARKER=".somtech-pack/version.json"

pf_cache()  { printf '%s' "${SOMTECH_PACK_CACHE:-${HOME:-/tmp}/.somtech/pack-latest.json}"; }
pf_ttl()    { printf '%s' "${SOMTECH_PACK_TTL:-86400}"; }

# pf_read_version <file> — 1er "version":"x.y.z[...]" du fichier (nouveau OU ancien format).
pf_read_version() {
  grep -oE '"version"[[:space:]]*:[[:space:]]*"[0-9][^"]*"' "$1" 2>/dev/null \
    | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+[A-Za-z0-9.+-]*' | head -1
}

# pf_fetch_latest — émet la dernière version publiée (ou rien). Stubbable en test.
pf_fetch_latest() {
  if [ -n "${SOMTECH_PACK_FETCH:-}" ]; then
    eval "${SOMTECH_PACK_FETCH}" 2>/dev/null
  else
    npm view "$PF_PKG" version --registry="$PF_REGISTRY" 2>/dev/null
  fi
}

# pf_refresh_cache — met à jour le cache UNIQUEMENT si on obtient un semver plausible
# (sinon on ne touche à rien → conserve l'ancien latest, pas de clobber offline).
pf_refresh_cache() {
  local l cache dir; l="$(pf_fetch_latest | tr -d '[:space:]')"
  printf '%s' "$l" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+' || return 0
  cache="$(pf_cache)"; dir="$(dirname "$cache")"; mkdir -p "$dir" 2>/dev/null || return 0
  printf '{"checkedAt":%s,"latest":"%s"}\n' "$(date +%s)" "$l" > "$cache" 2>/dev/null || return 0
}

# pf_cache_latest — émet le champ latest du cache (vide si absent).
pf_cache_latest() {
  local cache; cache="$(pf_cache)"; [ -f "$cache" ] || return 0
  grep -oE '"latest"[[:space:]]*:[[:space:]]*"[^"]*"' "$cache" 2>/dev/null \
    | head -1 | sed -E 's/.*"([^"]*)"$/\1/'
}

# pf_cache_checked_at — émet le champ checkedAt du cache (0 si absent).
pf_cache_checked_at() {
  local cache v; cache="$(pf_cache)"; [ -f "$cache" ] || { printf '0'; return 0; }
  v="$(grep -oE '"checkedAt"[[:space:]]*:[[:space:]]*[0-9]+' "$cache" 2>/dev/null | head -1 | grep -oE '[0-9]+$')"
  printf '%s' "${v:-0}"
}

# pf_ver_gt A B → 0 si A > B (semver numérique x.y.z ; segments non-numériques → 0).
pf_ver_gt() {
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

# pf_check <project_dir> — cœur de détection, LECTURE PURE + refresh détaché.
#   Émet "<installed> <latest>" et retourne 0 SI le pack du projet est en retard.
#   Retourne 1 (silencieux) sinon : pas de marqueur, pas de cache, à jour, ou plus récent.
#   Déclenche un refresh EN ARRIÈRE-PLAN (jamais bloquant) si le cache est périmé.
pf_check() {
  local dir="${1:-$PWD}" marker installed latest checked now ttl allow_npm
  marker="$dir/$PF_MARKER"
  [ -f "$marker" ] || return 1                       # projet non-pack → silence
  installed="$(pf_read_version "$marker")"
  [ -n "$installed" ] || return 1

  checked="$(pf_cache_checked_at)"; now="$(date +%s)"; ttl="$(pf_ttl)"
  allow_npm="${SOMTECH_PACK_NPM:-1}"
  if [ "$allow_npm" = "1" ] && [ $(( now - checked )) -ge "$ttl" ]; then
    if [ -n "${SOMTECH_PACK_FETCH:-}" ] || command -v npm >/dev/null 2>&1; then
      ( pf_refresh_cache ) >/dev/null 2>&1 &
      disown 2>/dev/null || true
    fi
  fi

  latest="$(pf_cache_latest)"
  [ -n "$latest" ] || return 1                       # rien à comparer → silence
  if pf_ver_gt "$latest" "$installed"; then
    printf '%s %s\n' "$installed" "$latest"; return 0
  fi
  return 1
}

# pf_nudge_launch <project_dir> — AFFICHAGE seul, destiné au launcher claude-swt
# (avant le boot de Claude). Avertit sur stderr si le pack est en retard, SILENCE
# sinon. Aucune écriture git, jamais bloquant, retour toujours 0 (ne casse pas le launch).
pf_nudge_launch() {
  local res installed latest
  res="$(pf_check "${1:-$PWD}")" || return 0         # à jour / pas de marqueur / offline → silence
  installed="${res%% *}"; latest="${res##* }"
  printf '⚠️  somtech-pack en retard : %s installée, %s disponible.\n' "$installed" "$latest" >&2
  printf '    MAJ du projet : npx %s@latest update\n' "$PF_PKG" >&2
  return 0
}
