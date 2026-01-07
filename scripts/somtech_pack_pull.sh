#!/usr/bin/env bash
set -euo pipefail

# somtech_pack_pull.sh — Met à jour un projet local depuis somtech-pack.
# Par défaut: full-pack (scripts + docs + .cursor + README).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACK_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=lib/somtech_pack_common.sh
source "${SCRIPT_DIR}/lib/somtech_pack_common.sh"

usage() {
  cat <<'USAGE'
somtech_pack_pull.sh — Met à jour un projet local depuis somtech-pack.

Usage:
  ./scripts/somtech_pack_pull.sh --target . [options]

Options:
  --repo       Repo git du pack (default: https://github.com/SomtechSolutionMAxime/somtech-pack.git)
  --ref        Ref git du pack (default: main)
  --target     Repo cible (obligatoire)
  --workdir    Dossier de travail (default: ~/.cache)
  --dry-run    N'écrit rien, affiche les opérations

Pass-through vers install_somtech_pack.sh:
  --no-rules | --no-commands | --no-skills | --no-docs | --somtech-only

Exemples:
  ./scripts/somtech_pack_pull.sh --target .
  ./scripts/somtech_pack_pull.sh --target . --ref v0.2.0 --dry-run
USAGE
}

REPO_URL="https://github.com/SomtechSolutionMAxime/somtech-pack.git"
REF="main"
TARGET=""
WORKBASE="${HOME}/.cache"
DRY_RUN=0

# Collect pass-through args for install_somtech_pack.sh
INSTALL_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO_URL="${2:-}"; shift 2 ;;
    --ref) REF="${2:-}"; shift 2 ;;
    --target) TARGET="${2:-}"; shift 2 ;;
    --workdir) WORKBASE="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; INSTALL_ARGS+=("--dry-run"); shift ;;
    --no-rules|--no-commands|--no-skills|--no-docs|--somtech-only)
      INSTALL_ARGS+=("$1"); shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      err "Argument inconnu: $1"
      usage
      exit 2
      ;;
  esac
done

[[ -n "$TARGET" ]] || die "--target est requis"

require_cmd git

TARGET_ABS="$(abs_path "$TARGET")"
WORKDIR="$(mk_workdir "$WORKBASE")"
PACK_CLONE="${WORKDIR}/somtech-pack"

log "Target: ${TARGET_ABS}"
log "Repo: ${REPO_URL}"
log "Ref: ${REF}"
log "Workdir: ${WORKDIR}"

clone_pack "$REPO_URL" "$REF" "$PACK_CLONE"

# Installer dans le target
INSTALL_SCRIPT="${PACK_CLONE}/scripts/install_somtech_pack.sh"
[[ -x "$INSTALL_SCRIPT" ]] || die "Script install introuvable: $INSTALL_SCRIPT"

log "Installation pack -> target (full-pack par défaut)"
"$INSTALL_SCRIPT" --target "$TARGET_ABS" "${INSTALL_ARGS[@]+"${INSTALL_ARGS[@]}"}"

log "OK (pull)"
