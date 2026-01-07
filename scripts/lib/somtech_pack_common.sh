#!/usr/bin/env bash
set -euo pipefail

# Common helpers for somtech-pack scripts

log() { echo "[somtech-pack] $*"; }
err() { echo "[somtech-pack][ERROR] $*" >&2; }

die() {
  err "$*"
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Commande requise introuvable: $1"
}

_ts() { date +"%Y%m%d%H%M%S"; }

slugify() {
  # macOS ships bash 3.2 -> avoid bash 4+ expansions like ${var,,}
  # Lowercase, replace non-alnum by '-', squeeze, trim.
  local s="${1:-}"
  s="$(printf '%s' "$s" | tr '[:upper:]' '[:lower:]')"
  # Replace any run of non [a-z0-9] with '-', then trim '-' and squeeze.
  s="$(printf '%s' "$s" | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g')"
  printf '%s\n' "$s"
}

# Resolve an absolute path (best-effort, macOS compatible)
abs_path() {
  local p="$1"
  if [[ "$p" = /* ]]; then
    echo "$p"
  else
    echo "$(pwd)/$p"
  fi
}

mk_workdir() {
  local base="${1:-${HOME}/.cache}"
  mkdir -p "$base"
  local d="$base/somtech-pack-work-$(_ts)"
  mkdir -p "$d"
  echo "$d"
}

clone_pack() {
  # clone_pack <repo_url> <ref> <dest_dir>
  local repo_url="$1"
  local ref="$2"
  local dest="$3"

  require_cmd git

  log "Clonage pack: ${repo_url} -> ${dest}"
  git clone --quiet "$repo_url" "$dest"

  ( 
    cd "$dest"
    if [[ -n "$ref" ]]; then
      log "Checkout ref: ${ref}"
      git fetch --quiet --all --tags
      git checkout --quiet "$ref" || die "Impossible de checkout ref: $ref"
    fi
  )
}

# Basic secret/sensitive content detection on a list of files.
# You can extend this list over time.
check_no_secrets_in_files() {
  local files=("$@")
  local patterns=(
    'sbp_[A-Za-z0-9_]+'
    'gho_[A-Za-z0-9_]+'
    'github_pat_[A-Za-z0-9_]+'
    'SUPABASE_ACCESS_TOKEN'
    'N8N_MCP_ACCESS_TOKEN'
    'Authorization: Bearer [A-Za-z0-9._-]+'
  )

  local failed=0
  for f in "${files[@]}"; do
    [[ -f "$f" ]] || continue

    # Skip very large files
    local size
    size=$(wc -c <"$f" | tr -d ' ' || echo 0)
    if [[ "$size" -gt 2000000 ]]; then
      log "Skip secret scan (file too large): $f"
      continue
    fi

    for pat in "${patterns[@]}"; do
      if LC_ALL=C grep -nE "$pat" "$f" >/dev/null 2>&1; then
        err "Pattern sensible détecté dans $f (pattern: $pat)"
        failed=1
      fi
    done
  done

  [[ "$failed" -eq 0 ]] || die "Vérification secrets échouée: retire les valeurs sensibles ou remplace par des placeholders."
}
