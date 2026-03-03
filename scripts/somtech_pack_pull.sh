#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# somtech_pack_pull.sh — v1.0.0
# Met à jour un projet local depuis somtech-pack (avec diff).
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=lib/somtech_pack_common.sh
source "${SCRIPT_DIR}/lib/somtech_pack_common.sh"

usage() {
  cat <<'USAGE'
somtech_pack_pull.sh — Met à jour un projet depuis le somtech-pack distant.

Usage:
  ./scripts/somtech_pack_pull.sh --target . [options]

Options:
  --repo       Repo git du pack (default: GitHub Somtech)
  --ref        Ref git (tag, branche, hash). Default: main
  --target     Projet cible (obligatoire)
  --modules    Modules à installer, séparés par virgule (ex: core,features)
  --workdir    Dossier de travail (default: ~/.cache)
  --force      Applique sans confirmation interactive
  --dry-run    Affiche les opérations sans écrire

Exemples:
  ./scripts/somtech_pack_pull.sh --target .
  ./scripts/somtech_pack_pull.sh --target . --ref v1.0.0 --modules core,features
  ./scripts/somtech_pack_pull.sh --target . --force
USAGE
}

REPO_URL="https://github.com/SomtechSolutionMAxime/somtech-pack.git"
REF="main"
TARGET=""
MODULES_CSV=""
WORKBASE="${HOME}/.cache"
DRY_RUN=0
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)     REPO_URL="${2:-}"; shift 2 ;;
    --ref)      REF="${2:-}"; shift 2 ;;
    --target)   TARGET="${2:-}"; shift 2 ;;
    --modules)  MODULES_CSV="${2:-}"; shift 2 ;;
    --workdir)  WORKBASE="${2:-}"; shift 2 ;;
    --force)    FORCE=1; shift ;;
    --dry-run)  DRY_RUN=1; shift ;;
    -h|--help)  usage; exit 0 ;;
    *)          err "Argument inconnu: $1"; usage; exit 2 ;;
  esac
done

[[ -n "$TARGET" ]] || die "--target est requis"
require_cmd git

TARGET_ABS="$(abs_path "$TARGET")"

# ── Détection de version ──────────────────────────────────────

installed_version="$(get_installed_version "$TARGET_ABS")"
log "Version installée : ${installed_version}"

# ── Clone du pack ─────────────────────────────────────────────

WORKDIR="$(mk_workdir "$WORKBASE")"
PACK_CLONE="${WORKDIR}/somtech-pack"
trap 'rm -rf "$WORKDIR"' EXIT

log "Repo   : ${REPO_URL}"
log "Ref    : ${REF}"

clone_pack "$REPO_URL" "$REF" "$PACK_CLONE"

pack_version="$(get_pack_version "$PACK_CLONE")"
log "Version disponible : ${pack_version}"

# ── Comparaison de versions ───────────────────────────────────

if [[ "$installed_version" == "$pack_version" ]] && [[ "$FORCE" == "0" ]]; then
  log "Le projet est déjà à jour (v${pack_version})."
  log "Utilise --force pour réinstaller."
  exit 0
fi

if [[ "$installed_version" != "not-installed" ]] && [[ "$installed_version" != "unknown" ]]; then
  if version_is_older "$installed_version" "$pack_version"; then
    log "Mise à jour disponible : v${installed_version} → v${pack_version}"
  else
    log "Version locale (${installed_version}) >= pack (${pack_version})"
    if [[ "$FORCE" == "0" ]]; then
      log "Utilise --force pour forcer la réinstallation."
      exit 0
    fi
  fi
fi

# ── Résumé des changements ────────────────────────────────────

echo ""
log "Résumé des changements :"
echo ""

# Compter les fichiers nouveaux, modifiés, identiques
new_count=0
modified_count=0
identical_count=0

# Résoudre les modules à comparer
if [[ -n "$MODULES_CSV" ]]; then
  modules_to_check="$MODULES_CSV"
else
  modules_to_check="$(get_default_modules "$PACK_CLONE" | tr '\n' ',' | sed 's/,$//')"
  modules_to_check="${modules_to_check:-core,features}"
fi

IFS=',' read -ra mod_array <<< "$modules_to_check"
for mod in "${mod_array[@]}"; do
  mod="$(echo "$mod" | tr -d '[:space:]')"
  while IFS= read -r mod_path; do
    [[ -z "$mod_path" ]] && continue
    mod_path="${mod_path%/}"

    src_dir="${PACK_CLONE}/${mod_path}"
    tgt_dir="${TARGET_ABS}/${mod_path}"

    [[ -d "$src_dir" ]] || continue

    while IFS= read -r src_file; do
      local_rel="${src_file#${PACK_CLONE}/}"
      tgt_file="${TARGET_ABS}/${local_rel}"

      if [[ ! -f "$tgt_file" ]]; then
        new_count=$((new_count + 1))
        [[ "$new_count" -le 20 ]] && echo "  + ${local_rel}"
      elif ! diff -q "$src_file" "$tgt_file" >/dev/null 2>&1; then
        modified_count=$((modified_count + 1))
        [[ "$modified_count" -le 20 ]] && echo "  ~ ${local_rel}"
      else
        identical_count=$((identical_count + 1))
      fi
    done < <(find "$src_dir" -type f \
      ! -name '*.bak-*' \
      ! -name '.DS_Store' \
      ! -name '*.zip' \
      -print 2>/dev/null)
  done < <(get_module_paths "$PACK_CLONE" "$mod")
done

echo ""
log "Résultat : ${new_count} nouveau(x), ${modified_count} modifié(s), ${identical_count} identique(s)"

if [[ "$new_count" -eq 0 ]] && [[ "$modified_count" -eq 0 ]]; then
  log "Aucun changement à appliquer."
  exit 0
fi

# ── Confirmation ──────────────────────────────────────────────

if [[ "$FORCE" == "0" ]] && [[ "$DRY_RUN" == "0" ]]; then
  echo ""
  printf "[somtech-pack] Appliquer la mise à jour ? [y/N] "
  read -r confirm
  if [[ ! "$confirm" =~ ^[yYoO] ]]; then
    log "Annulé."
    exit 0
  fi
fi

# ── Installation ──────────────────────────────────────────────

INSTALL_SCRIPT="${PACK_CLONE}/scripts/install_somtech_pack.sh"
[[ -x "$INSTALL_SCRIPT" ]] || chmod +x "$INSTALL_SCRIPT"

INSTALL_ARGS=("--target" "$TARGET_ABS")
[[ -n "$MODULES_CSV" ]] && INSTALL_ARGS+=("--modules" "$MODULES_CSV")
[[ "$DRY_RUN" == "1" ]] && INSTALL_ARGS+=("--dry-run")

"$INSTALL_SCRIPT" "${INSTALL_ARGS[@]}"

echo ""
log "Mise à jour terminée (v${pack_version})."
log "Pense à commiter : git add -A && git commit -m 'chore: update somtech-pack v${pack_version}'"
