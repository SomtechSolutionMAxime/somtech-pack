#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# remote-install.sh — Installation one-liner du somtech-pack
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/SomtechSolutionMAxime/somtech-pack/main/scripts/remote-install.sh | bash -s -- --target .
#   curl -fsSL https://raw.githubusercontent.com/SomtechSolutionMAxime/somtech-pack/main/scripts/remote-install.sh | bash -s -- --target . --modules core,features,mockmig
# ============================================================

REPO="${REPO:-https://github.com/SomtechSolutionMAxime/somtech-pack.git}"
REF="${REF:-main}"
TARGET=""
MODULES=""
DRY_RUN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)   TARGET="${2:-}"; shift 2 ;;
    --modules)  MODULES="${2:-}"; shift 2 ;;
    --repo)     REPO="${2:-}"; shift 2 ;;
    --ref)      REF="${2:-}"; shift 2 ;;
    --dry-run)  DRY_RUN="--dry-run"; shift ;;
    --list-modules) LIST_MODULES=1; shift ;;
    -h|--help)
      echo "Usage: curl -fsSL .../remote-install.sh | bash -s -- --target /path/to/project [--modules core,features] [--dry-run]"
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -z "$TARGET" ]] && [[ "${LIST_MODULES:-0}" != "1" ]]; then
  echo "Erreur: --target est requis."
  echo "Usage: curl -fsSL .../remote-install.sh | bash -s -- --target /path/to/project"
  exit 1
fi

# Vérifier git
command -v git >/dev/null 2>&1 || { echo "Erreur: git est requis."; exit 1; }

# Dossier temporaire avec cleanup automatique
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "[somtech-pack] Téléchargement du pack (ref: ${REF})…"
git clone --quiet --depth 1 --branch "$REF" "$REPO" "$TMPDIR/somtech-pack"

INSTALL_SCRIPT="$TMPDIR/somtech-pack/scripts/install_somtech_pack.sh"
chmod +x "$INSTALL_SCRIPT"

# Construire les arguments
ARGS=()
[[ -n "$TARGET" ]] && ARGS+=("--target" "$TARGET")
[[ -n "$MODULES" ]] && ARGS+=("--modules" "$MODULES")
[[ -n "$DRY_RUN" ]] && ARGS+=("$DRY_RUN")
[[ "${LIST_MODULES:-0}" == "1" ]] && ARGS+=("--list-modules")

"$INSTALL_SCRIPT" "${ARGS[@]}"
