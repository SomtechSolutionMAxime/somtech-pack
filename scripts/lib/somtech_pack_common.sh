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

# ── Version & Module helpers ──────────────────────────────────────────

# Read pack version from VERSION file
get_pack_version() {
  local source="${1:-.}"
  if [[ -f "$source/VERSION" ]]; then
    tr -d '[:space:]' < "$source/VERSION"
  else
    echo "0.0.0"
  fi
}

# Read installed version from a project's .somtech-pack/version.json
get_installed_version() {
  local target="${1:-.}"
  local vfile="$target/.somtech-pack/version.json"
  if [[ -f "$vfile" ]]; then
    if command -v jq &>/dev/null; then
      jq -r '.pack.version // "unknown"' "$vfile" 2>/dev/null || echo "unknown"
    else
      # Fallback: grep the version field (no jq)
      sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$vfile" | head -1
    fi
  else
    echo "not-installed"
  fi
}

# Write version.json to a project after installation
write_version_json() {
  local target="$1"
  local version="$2"
  local modules="$3"  # comma-separated
  local source_url="${4:-https://github.com/SomtechSolutionMAxime/somtech-pack.git}"

  local vdir="$target/.somtech-pack"
  mkdir -p "$vdir"

  local now
  now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  cat > "$vdir/version.json" <<VEOF
{
  "pack": {
    "version": "$version",
    "installedAt": "$now",
    "modules": [$(echo "$modules" | sed 's/[^,]*/\"&\"/g; s/,/, /g')],
    "source": "$source_url"
  }
}
VEOF
  log "Version $version enregistrée dans $vdir/version.json"
}

# Compare two semver strings. Returns 0 (true) if v1 < v2.
version_is_older() {
  local v1="$1" v2="$2"
  if [[ "$v1" == "$v2" ]]; then
    return 1
  fi
  local oldest
  oldest="$(printf '%s\n' "$v1" "$v2" | sort -V | head -n1)"
  [[ "$oldest" == "$v1" ]]
}

# List available modules from pack.json (human-readable)
list_modules() {
  local source="${1:-.}"
  local pjson="$source/pack.json"

  if ! [[ -f "$pjson" ]]; then
    die "pack.json introuvable dans $source"
  fi

  log "Modules disponibles (v$(get_pack_version "$source")) :"
  echo ""

  if command -v jq &>/dev/null; then
    jq -r '.modules | to_entries[] | "  \(if .value.default then "✓" else "○" end)  \(.key)\t\(.value.description)"' "$pjson"
  else
    # Fallback sans jq
    log "(installe jq pour un affichage enrichi)"
    sed -n '/"modules"/,/^}/p' "$pjson"
  fi
  echo ""
  echo "  ✓ = installé par défaut    ○ = optionnel (--modules nom)"
}

# Get paths for a specific module from pack.json
get_module_paths() {
  local source="$1"
  local module_name="$2"
  local pjson="$source/pack.json"

  if command -v jq &>/dev/null && [[ -f "$pjson" ]]; then
    jq -r ".modules[\"$module_name\"].paths[]?" "$pjson" 2>/dev/null
  fi
}

# Get default module names from pack.json
get_default_modules() {
  local source="${1:-.}"
  local pjson="$source/pack.json"

  if command -v jq &>/dev/null && [[ -f "$pjson" ]]; then
    jq -r '.modules | to_entries[] | select(.value.default == true) | .key' "$pjson" 2>/dev/null
  else
    # Fallback: core,features (hardcoded defaults)
    echo "core"
    echo "features"
  fi
}

# Collect all paths for a comma-separated list of module names
resolve_module_paths() {
  local source="$1"
  local modules_csv="$2"  # e.g. "core,features,mockmig"

  local IFS=','
  local paths=()
  for mod in $modules_csv; do
    mod="$(echo "$mod" | tr -d '[:space:]')"
    while IFS= read -r p; do
      [[ -n "$p" ]] && paths+=("$p")
    done < <(get_module_paths "$source" "$mod")
  done

  printf '%s\n' "${paths[@]}" | sort -u
}
