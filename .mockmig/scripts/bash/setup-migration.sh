#!/usr/bin/env bash
set -euo pipefail

# setup-migration.sh — résout les chemins/paramètres du workflow mockmig et renvoie du JSON.
#
# Usage:
#   .mockmig/scripts/bash/setup-migration.sh --json --module <slug> --mockupPath <path> [--component <c>] [--force]
#   .mockmig/scripts/bash/setup-migration.sh --json --plan migration/<module>/[components/<c>/]07_implementation_plan.md
#
# JSON output keys (stable):
#   MIGRATION_DIR, MODULE, MOCKUP_DIR, COMPONENT, MOCKUP_COMPONENT_DIR, RUNBOOK_PATH

usage() {
  cat <<'EOF'
setup-migration.sh — résout les chemins/paramètres du workflow mockmig et renvoie du JSON.

Usage:
  setup-migration.sh --json --module <slug> --mockupPath <path> [--component <c>] [--force]
  setup-migration.sh --json --plan migration/<module>/[components/<c>/]07_implementation_plan.md

Options:
  --json        Requis (sortie JSON)
  --module      Slug module (kebab-case)
  --mockupPath  Chemin relatif repo vers la maquette
  --component   Slug composant (optionnel)
  --plan        Chemin runbook (optionnel, alternatif à module/mockupPath)
  --force       Réinitialise le dossier migration/<module>/[components/<c>] (dangereux)
EOF
}

JSON=0
MODULE=""
MOCKUP_PATH=""
COMPONENT=""
PLAN=""
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --json) JSON=1; shift ;;
    --module) MODULE="${2:-}"; shift 2 ;;
    --mockupPath) MOCKUP_PATH="${2:-}"; shift 2 ;;
    --component) COMPONENT="${2:-}"; shift 2 ;;
    --plan) PLAN="${2:-}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Argument inconnu: $1" >&2; usage; exit 2 ;;
  esac
done

[[ "$JSON" == "1" ]] || { echo "Erreur: --json est requis" >&2; exit 2; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

is_valid_slug() {
  local s="$1"
  [[ "$s" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]
}

die() { echo "ERROR: $*" >&2; exit 2; }

if [[ -n "$PLAN" ]]; then
  # Derive module/component from plan path
  # Expected:
  #   migration/<module>/07_implementation_plan.md
  #   migration/<module>/components/<component>/07_implementation_plan.md
  if [[ "$PLAN" != migration/*/07_implementation_plan.md && "$PLAN" != migration/*/components/*/07_implementation_plan.md ]]; then
    die "--plan invalide: $PLAN"
  fi
  RUNBOOK_PATH="$PLAN"
  # shellcheck disable=SC2206
  PARTS=(${PLAN//\// })
  MODULE="${PARTS[1]}"
  if [[ "${#PARTS[@]}" -ge 5 && "${PARTS[2]}" == "components" ]]; then
    COMPONENT="${PARTS[3]}"
  fi
else
  [[ -n "$MODULE" ]] || die "--module est requis (ou --plan)"
  [[ -n "$MOCKUP_PATH" ]] || die "--mockupPath est requis (ou --plan)"
  RUNBOOK_PATH="migration/${MODULE}/07_implementation_plan.md"
  [[ -z "$COMPONENT" ]] || RUNBOOK_PATH="migration/${MODULE}/components/${COMPONENT}/07_implementation_plan.md"
fi

is_valid_slug "$MODULE" || die "--module invalide (kebab-case): $MODULE"
if [[ -n "$COMPONENT" ]]; then
  is_valid_slug "$COMPONENT" || die "--component invalide (kebab-case): $COMPONENT"
fi

MIGRATION_DIR="migration/${MODULE}"
[[ -z "$COMPONENT" ]] || MIGRATION_DIR="migration/${MODULE}/components/${COMPONENT}"

MOCKUP_DIR=""
MOCKUP_COMPONENT_DIR=""

if [[ -n "$MOCKUP_PATH" ]]; then
  # Normalize (strip leading ./)
  MOCKUP_PATH="${MOCKUP_PATH#./}"
  MOCKUP_DIR="$MOCKUP_PATH"
fi

# Best-effort: if plan was provided, try to infer mockupPath from existing context file
if [[ -z "$MOCKUP_DIR" && -f "${MIGRATION_DIR}/00_context.md" ]]; then
  # Look for a line like: mockupPath: <path> (very permissive)
  inferred="$(grep -E 'mockupPath\s*:' -m 1 "${MIGRATION_DIR}/00_context.md" 2>/dev/null | sed -E 's/.*mockupPath\s*:\s*//')"
  [[ -n "$inferred" ]] && MOCKUP_DIR="$inferred"
fi

# Validate mockupPath if we have it
if [[ -n "$MOCKUP_DIR" ]]; then
  [[ -d "$MOCKUP_DIR" ]] || die "MOCKUP_DIR introuvable: $MOCKUP_DIR"
  # Accepted patterns (doc):
  #  - modules/maquette/<module>/...
  #  - modules/<module>/maquette/...
  if [[ "$MOCKUP_DIR" != modules/maquette/* && "$MOCKUP_DIR" != modules/*/maquette* ]]; then
    die "mockupPath ne matche pas les patterns acceptés: modules/maquette/<module>/... ou modules/<module>/maquette/..."
  fi
fi

if [[ -n "$COMPONENT" && -n "$MOCKUP_DIR" ]]; then
  MOCKUP_COMPONENT_DIR="${MOCKUP_DIR%/}/src/components/${COMPONENT}"
  [[ -d "$MOCKUP_COMPONENT_DIR" ]] || die "MOCKUP_COMPONENT_DIR introuvable: $MOCKUP_COMPONENT_DIR"
fi

if [[ "$FORCE" == "1" ]]; then
  # Safe-ish: only delete inside migration/
  [[ "$MIGRATION_DIR" == migration/* ]] || die "Refuse de supprimer hors migration/: $MIGRATION_DIR"
  rm -rf "$MIGRATION_DIR"
fi

mkdir -p "$MIGRATION_DIR"

json_escape() {
  python3 - <<'PY'
import json,sys
print(json.dumps(sys.stdin.read().rstrip("\n")))
PY
}

emit_kv() {
  local k="$1"; local v="$2"
  printf '"%s":%s' "$k" "$(printf "%s" "$v" | json_escape)"
}

printf '{'
emit_kv "MIGRATION_DIR" "$MIGRATION_DIR"
printf ','
emit_kv "MODULE" "$MODULE"
printf ','
emit_kv "MOCKUP_DIR" "$MOCKUP_DIR"
printf ','
emit_kv "COMPONENT" "$COMPONENT"
printf ','
emit_kv "MOCKUP_COMPONENT_DIR" "$MOCKUP_COMPONENT_DIR"
printf ','
emit_kv "RUNBOOK_PATH" "$RUNBOOK_PATH"
printf '}\n'

