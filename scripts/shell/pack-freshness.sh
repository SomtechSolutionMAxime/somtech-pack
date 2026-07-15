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

# ============================================================
# Auto-PR single-writer gardé (E3, D-20260715-0001).
# Sur retard détecté, UNE session construit chore/pack-v<latest> dans un worktree
# ÉPHÉMÈRE, ouvre une PR draft, et rollback si la PR échoue. Les concurrentes skippent.
# Injections de test : PF_GH (def gh), PF_NPX (def npx), SOMTECH_PACK_LOCKDIR, PF_LOCK_TTL.
# ============================================================

PF_LOCK_TTL="${PF_LOCK_TTL:-600}"                    # lock réputé mort au-delà (s)

pf_gh()  { "${PF_GH:-gh}"   "$@"; }
pf_npx() { "${PF_NPX:-npx}" "$@"; }

pf_mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null; }  # macOS | Linux

# pf_lock_key <main> — clé UNIQUE dérivée du chemin absolu + remote (jamais le basename :
# deux repos homonymes ne doivent pas partager un lock).
pf_lock_key() {
  local abs remote; abs="$(cd "$1" 2>/dev/null && pwd -P)"; abs="${abs:-$1}"
  remote="$(git -C "$1" remote get-url origin 2>/dev/null)"
  printf '%s\n%s' "$abs" "$remote" | cksum | tr -d ' ' | cut -c1-16
}
pf_lock_path() { printf '%s/pack-update-%s.lock' "${SOMTECH_PACK_LOCKDIR:-${HOME:-/tmp}/.somtech}" "$(pf_lock_key "$1")"; }

# pf_lock_is_stale <lockpath> → 0 si le lock existe et dépasse PF_LOCK_TTL.
pf_lock_is_stale() {
  local lp="$1" now mt; [ -d "$lp" ] || return 1
  now="$(date +%s)"; mt="$(pf_mtime "$lp")"; [ -n "$mt" ] || return 1
  [ $(( now - mt )) -ge "$PF_LOCK_TTL" ]
}
# pf_acquire_lock <lockpath> → 0 si acquis (récupère d'abord un lock périmé).
pf_acquire_lock() {
  local lp="$1"
  pf_lock_is_stale "$lp" && rmdir "$lp" 2>/dev/null
  mkdir -p "$(dirname "$lp")" 2>/dev/null
  mkdir "$lp" 2>/dev/null
}
pf_release_lock() { rmdir "$1" 2>/dev/null || true; }

# Garde d'idempotence RÉSEAU (source de vérité, vaut cross-machine).
pf_remote_branch_exists() { git -C "$1" ls-remote --heads origin "$2" 2>/dev/null | grep -q .; }
# --state all (M1) : bloque aussi une PR déjà MERGÉE ou FERMÉE (rejetée) pour cette
# version — sinon, branche distante supprimée au merge + working tree local encore ancien
# → les deux gardes tombent et on recrée indéfiniment le même bump.
pf_pr_exists() {
  command -v "${PF_GH:-gh}" >/dev/null 2>&1 || return 1
  ( cd "$1" && pf_gh pr list --head "$2" --state all 2>/dev/null ) | grep -q .
}

# pf_main_version <main> — version du pack COMMITTÉE sur origin/main (vide si absente).
# Ancre la garde sur l'état intégré de main, pas sur le working tree local (qui peut
# rester en retard après un merge tant que le dev n'a pas sync son $main).
pf_main_version() {
  git -C "$1" show "origin/main:$PF_MARKER" 2>/dev/null \
    | grep -oE '"version"[[:space:]]*:[[:space:]]*"[0-9][^"]*"' | head -1 \
    | grep -oE '[0-9]+\.[0-9]+\.[0-9]+[A-Za-z0-9.+-]*' | head -1
}

# pf_build_and_pr <main> <installed> <latest> — construit le bump dans un worktree
# éphémère, push, ouvre la PR draft ; rollback (delete remote branch) si la PR échoue.
# Retour 0 si PR ouverte ; ≠0 (avec cleanup) sinon. Ne touche JAMAIS $main ni un worktree de travail.
pf_build_and_pr() {
  local main="$1" installed="$2" latest="$3" branch="chore/pack-v${latest}" tmp rc=0
  tmp="$(mktemp -d)"
  git -C "$main" worktree add -q "$tmp" -b "$branch" origin/main 2>/dev/null \
    || { rm -rf "$tmp" 2>/dev/null; git -C "$main" branch -D "$branch" 2>/dev/null; return 1; }
  (
    cd "$tmp" || exit 1
    pf_npx "${PF_PKG}@latest" update --yes >/dev/null 2>&1 || exit 2
    git add -A
    git diff --cached --quiet && exit 3            # aucun changement → pas de bump
    git commit -q -m "chore(pack): bump ${installed} → ${latest} (maintenance transversale)" || exit 4
    git push -q -u origin "$branch" 2>/dev/null || exit 5
  ); rc=$?
  git -C "$main" worktree remove --force "$tmp" 2>/dev/null; rm -rf "$tmp" 2>/dev/null
  if [ "$rc" -ne 0 ]; then
    git -C "$main" branch -D "$branch" 2>/dev/null  # jamais poussé (ou échec avant push) → nettoyer local
    return "$rc"
  fi
  # PR draft ; rollback de la branche poussée si gh échoue (pas de branche orpheline).
  if ! ( cd "$main" && pf_gh pr create --draft --head "$branch" \
           --title "chore(pack): bump ${installed} → ${latest}" \
           --body "MAJ automatique du somtech-pack (branche de maintenance transversale, exemptée d'ID)." \
           >/dev/null 2>&1 ); then
    git -C "$main" push -q origin --delete "$branch" 2>/dev/null
    git -C "$main" branch -D "$branch" 2>/dev/null
    return 6
  fi
  git -C "$main" branch -D "$branch" 2>/dev/null    # branche locale inutile (vit sur le remote)
  return 0
}

# pf_auto_pr <main> — orchestrateur non-bloquant (à lancer DÉTACHÉ par le launcher).
# No-op silencieux si : pas en retard, PR/branche déjà là, git/gh/npx absents, lock pris.
pf_auto_pr() {
  local main="${1:-$PWD}" res installed latest branch lp
  res="$(pf_check "$main")" || return 0
  installed="${res%% *}"; latest="${res##* }"
  branch="chore/pack-v${latest}"
  command -v git >/dev/null 2>&1 || return 0
  command -v "${PF_GH:-gh}"  >/dev/null 2>&1 || return 0   # pas de gh → pas de PR → no-op
  command -v "${PF_NPX:-npx}" >/dev/null 2>&1 || return 0  # pas de npx → pas de bump → no-op
  # (M1) origin/main déjà à ≥ latest → le bump est DÉJÀ intégré : le working tree local
  # est juste en retard (le dev doit sync son $main), surtout pas rouvrir une PR.
  local mainver; mainver="$(pf_main_version "$main")"
  [ -n "$mainver" ] && ! pf_ver_gt "$latest" "$mainver" && return 0
  # Garde réseau AVANT le lock (source de vérité).
  pf_remote_branch_exists "$main" "$branch" && return 0
  pf_pr_exists "$main" "$branch" && return 0
  lp="$(pf_lock_path "$main")"
  pf_acquire_lock "$lp" || return 0                        # une autre session s'en charge
  # Re-check sous lock (course fine entre garde et acquisition).
  if pf_remote_branch_exists "$main" "$branch" || pf_pr_exists "$main" "$branch"; then
    pf_release_lock "$lp"; return 0
  fi
  pf_build_and_pr "$main" "$installed" "$latest"
  pf_release_lock "$lp"
  return 0
}
