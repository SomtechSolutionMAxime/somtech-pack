#!/usr/bin/env bash
set -euo pipefail

# setup-components.sh — scaffold migration/<module>/components/<component>/ à partir de <mockupPath>/src/components/*
#
# Usage:
#   .mockmig/scripts/bash/setup-components.sh --json --module <slug> --mockupPath <path> [--force]
#
# Output (JSON):
#   MIGRATION_COMPONENTS_DIR, MODULE, MOCKUP_DIR, COMPONENTS (array)

usage() {
  cat <<'EOF'
setup-components.sh — scaffold migration/<module>/components/<component>/ à partir de <mockupPath>/src/components/*

Usage:
  setup-components.sh --json --module <slug> --mockupPath <path> [--force]

Options:
  --json        Requis (sortie JSON)
  --module      Slug module (kebab-case)
  --mockupPath  Chemin relatif repo vers la maquette
  --force       Réinitialise migration/<module>/components/*
EOF
}

JSON=0
MODULE=""
MOCKUP_PATH=""
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --json) JSON=1; shift ;;
    --module) MODULE="${2:-}"; shift 2 ;;
    --mockupPath) MOCKUP_PATH="${2:-}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Argument inconnu: $1" >&2; usage; exit 2 ;;
  esac
done

[[ "$JSON" == "1" ]] || { echo "Erreur: --json est requis" >&2; exit 2; }
[[ -n "$MODULE" ]] || { echo "Erreur: --module est requis" >&2; exit 2; }
[[ -n "$MOCKUP_PATH" ]] || { echo "Erreur: --mockupPath est requis" >&2; exit 2; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

die() { echo "ERROR: $*" >&2; exit 2; }

[[ "$MODULE" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || die "--module invalide (kebab-case): $MODULE"
MOCKUP_DIR="${MOCKUP_PATH#./}"
[[ -d "$MOCKUP_DIR" ]] || die "MOCKUP_DIR introuvable: $MOCKUP_DIR"

COMPONENTS_SRC="${MOCKUP_DIR%/}/src/components"
[[ -d "$COMPONENTS_SRC" ]] || die "Aucun dossier composants détecté: $COMPONENTS_SRC"

MIGRATION_ROOT="migration/${MODULE}"
MIGRATION_COMPONENTS_DIR="${MIGRATION_ROOT}/components"

mkdir -p "$MIGRATION_COMPONENTS_DIR"

if [[ "$FORCE" == "1" ]]; then
  rm -rf "$MIGRATION_COMPONENTS_DIR"
  mkdir -p "$MIGRATION_COMPONENTS_DIR"
fi

# Create/ensure component map exists
COMPONENT_MAP="${MIGRATION_ROOT}/00_component_map.md"
mkdir -p "$MIGRATION_ROOT"
if [[ ! -f "$COMPONENT_MAP" ]]; then
  cat > "$COMPONENT_MAP" <<EOF2
# Cartographie composants — ${MODULE}

> Remplir ce fichier pendant `/mockmig.inventory` (scope module).

## Liste

- (à compléter)
EOF2
fi

scaffold_component() {
  local c="$1"
  local dir="${MIGRATION_COMPONENTS_DIR}/${c}"
  mkdir -p "$dir"

  # Minimal scaffold (00 + 01..07). Do not overwrite existing files.
  [[ -f "${dir}/00_context.md" ]] || cat > "${dir}/00_context.md" <<EOF2
# Contexte — ${MODULE} / ${c}

- module: ${MODULE}
- component: ${c}
- mockupPath: ${MOCKUP_DIR}
EOF2

  for f in 01_business_rules 02_validation_packet 03_existing_audit 04_gap_analysis 05_backend_tasks 06_ui_tasks 07_implementation_plan; do
    local path="${dir}/${f}.md"
    [[ -f "$path" ]] && continue
    cat > "$path" <<EOF2
# ${f} — ${MODULE} / ${c}

(à compléter via `mockmig.*`)
EOF2
  done
}

components_json_items=()
while IFS= read -r -d '' d; do
  c="$(basename "$d")"
  # Only directories with a valid slug-ish name
  [[ "$c" =~ ^[A-Za-z0-9_-]+$ ]] || continue
  scaffold_component "$c"
  components_json_items+=("\"$c\"")
done < <(find "$COMPONENTS_SRC" -mindepth 1 -maxdepth 1 -type d -print0 | sort -z)

printf '{'
printf '"MIGRATION_COMPONENTS_DIR":"%s",' "$MIGRATION_COMPONENTS_DIR"
printf '"MODULE":"%s",' "$MODULE"
printf '"MOCKUP_DIR":"%s",' "$MOCKUP_DIR"
printf '"COMPONENTS":[%s]' "$(IFS=,; echo "${components_json_items[*]-}")"
printf '}\n'

