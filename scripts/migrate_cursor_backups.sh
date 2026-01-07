#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
migrate_cursor_backups.sh — Déplace les anciens backups `.bak-*` depuis `.cursor/{rules,commands}/`
vers `.cursor/_backups/{rules,commands}/` (sans suppression).

Usage:
  ./scripts/migrate_cursor_backups.sh --target /path/to/target_repo [--dry-run]

Options:
  --dry-run   Affiche ce qui serait fait, sans écrire.
EOF
}

TARGET=""
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Argument inconnu: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ -z "${TARGET}" ]]; then
  echo "Erreur: --target est requis." >&2
  usage
  exit 2
fi

log() { echo "[migrate_cursor_backups] $*"; }

run() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    log "DRY-RUN: $*"
  else
    eval "$@"
  fi
}

ensure_dir() {
  local d="$1"
  [[ -d "$d" ]] && return 0
  run "mkdir -p \"${d}\""
}

migrate_dir() {
  local category="$1" # rules|commands
  local src_dir="${TARGET}/.cursor/${category}"
  local dst_dir="${TARGET}/.cursor/_backups/${category}"

  [[ -d "$src_dir" ]] || return 0
  ensure_dir "$dst_dir"

  # Find all backups created next to files: *.bak-*
  # Only top-level files are expected in these directories.
  while IFS= read -r f; do
    local base
    base="$(basename "$f")"
    run "mv \"${f}\" \"${dst_dir}/${base}\""
  done < <(find "$src_dir" -maxdepth 1 -type f -name '*.bak-*' -print 2>/dev/null || true)
}

main() {
  migrate_dir "rules"
  migrate_dir "commands"
  log "Terminé."
}

main

