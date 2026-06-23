#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# remote-install.sh — Installation one-liner du somtech-pack
#
# Installe / met à jour les modules Somtech (skills/agents/commands/hooks
# Claude Code, plugins Cowork, features réutilisables) dans un projet
# cible. Délègue le travail à `somtech_pack_pull.sh` qui sait gérer la
# détection de version, les diffs, et la sélection de modules.
#
# Usage :
#   curl -fsSL https://raw.githubusercontent.com/SomtechSolutionMAxime/somtech-pack/main/scripts/remote-install.sh | bash -s -- --target .
#   curl -fsSL .../remote-install.sh | bash -s -- --target . --modules core,features
#   curl -fsSL .../remote-install.sh | bash -s -- --target . --ref v1.2.0 --force
#   curl -fsSL .../remote-install.sh | bash -s -- --target . --dry-run
# ============================================================

REPO="${REPO:-https://github.com/SomtechSolutionMAxime/somtech-pack.git}"
REF="${REF:-main}"
TARGET=""
MODULES=""
DRY_RUN=""
FORCE=""
WITH_SWT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)   TARGET="${2:-}"; shift 2 ;;
    --modules)  MODULES="${2:-}"; shift 2 ;;
    --repo)     REPO="${2:-}"; shift 2 ;;
    --ref)      REF="${2:-}"; shift 2 ;;
    --dry-run)  DRY_RUN="--dry-run"; shift ;;
    --force)    FORCE="--force"; shift ;;
    --with-claude-swt) WITH_SWT="1"; shift ;;
    -h|--help)
      cat <<EOF
Usage:
  curl -fsSL https://raw.githubusercontent.com/SomtechSolutionMAxime/somtech-pack/main/scripts/remote-install.sh | bash -s -- --target /path/to/project [options]

Options:
  --target PATH       Projet cible (requis sauf si --with-claude-swt seul)
  --modules CSV       Modules à installer (default: core,features). Voir somtech_pack_pull.sh --help.
  --ref REF           Ref git du pack (tag, branche, hash). Default: main.
  --repo URL          URL du repo (default: GitHub Somtech).
  --force             Applique sans confirmation interactive.
  --dry-run           Affiche les opérations sans écrire.
  --with-claude-swt   Installe aussi le lanceur shell claude-swt dans ton ~/.zshrc.
                      Peut être utilisé seul (sans --target) pour une install shell only :
                        curl -fsSL .../remote-install.sh | bash -s -- --with-claude-swt
EOF
      exit 0
      ;;
    *) shift ;;
  esac
done

if [[ -z "$TARGET" && -z "$WITH_SWT" ]]; then
  echo "Erreur: --target est requis (ou --with-claude-swt pour une install shell seule)." >&2
  echo "Usage: curl -fsSL .../remote-install.sh | bash -s -- --target /path/to/project" >&2
  exit 1
fi

command -v git >/dev/null 2>&1 || { echo "Erreur: git est requis."; exit 1; }

# Clone éphémère du pack pour récupérer le script de pull à jour
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "[somtech-pack] Téléchargement du pack (ref: ${REF})…"
git clone --quiet --depth 1 --branch "$REF" "$REPO" "$TMPDIR/somtech-pack"

# --- Installation projet (modules du pack) — seulement si --target fourni ---
if [[ -n "$TARGET" ]]; then
  PULL_SCRIPT="$TMPDIR/somtech-pack/scripts/somtech_pack_pull.sh"
  if [[ ! -f "$PULL_SCRIPT" ]]; then
    echo "Erreur: scripts/somtech_pack_pull.sh introuvable dans le pack." >&2
    exit 1
  fi
  chmod +x "$PULL_SCRIPT" 2>/dev/null || true

  # Construire les arguments à passer au pull
  ARGS=("--target" "$TARGET" "--repo" "$REPO" "--ref" "$REF")
  [[ -n "$MODULES" ]] && ARGS+=("--modules" "$MODULES")
  [[ -n "$DRY_RUN" ]] && ARGS+=("$DRY_RUN")
  [[ -n "$FORCE" ]]   && ARGS+=("$FORCE")

  # Expansion gardée : "${ARR[@]}" sur tableau vide casse sous bash 3.2 + set -u
  # (bash système macOS). ARGS est toujours non-vide ici, mais on reste défensif.
  bash "$PULL_SCRIPT" ${ARGS[@]+"${ARGS[@]}"}
fi

# --- Installation shell claude-swt — si --with-claude-swt ---
if [[ -n "$WITH_SWT" ]]; then
  SWT_SCRIPT="$TMPDIR/somtech-pack/scripts/install-claude-swt.sh"
  if [[ ! -f "$SWT_SCRIPT" ]]; then
    echo "Erreur: scripts/install-claude-swt.sh introuvable dans le pack." >&2
    exit 1
  fi
  echo "[somtech-pack] Installation du lanceur shell claude-swt…"
  SWT_ARGS=()
  [[ -n "$DRY_RUN" ]] && SWT_ARGS+=("--dry-run")
  # Expansion gardée : sans --dry-run, SWT_ARGS est VIDE, et "${SWT_ARGS[@]}"
  # plante sous bash 3.2 + set -u (le cas nominal `curl | bash -- --with-claude-swt`).
  bash "$SWT_SCRIPT" ${SWT_ARGS[@]+"${SWT_ARGS[@]}"}
fi
