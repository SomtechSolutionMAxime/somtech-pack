#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
install_somtech_pack.sh — Installe rules Cursor + commandes + skills + docs (optionnel) depuis le repo somtech-pack (source) vers un repo cible.

Usage:
  ./scripts/install_somtech_pack.sh --target /path/to/target_repo [options]
  ./scripts/install_somtech_pack.sh --source /path/to/somtech-pack --target /path/to/target_repo [options]

Options:
  --source         Chemin du repo pack. Par défaut: racine du repo contenant ce script.
  --target         Chemin du repo cible (obligatoire).
  --dry-run        Affiche ce qui serait fait, sans écrire.
  --no-rules       N'installe pas .cursor/rules.
  --no-commands    N'installe pas .cursor/commands.
  --no-skills      N'installe pas .cursor/skills.
  --no-docs        N'installe pas docs/chatwindow.
  --somtech-only   Installe uniquement les commandes somtech.*.md (par défaut: installe toutes les commandes).

Comportement:
  - modules/: crée uniquement le minimum si absent (modules/_template/* + modules/_shared)
  - .cursor/rules : copie tout (backup + overwrite si existant)
  - .cursor/commands :
      - par défaut: copie toutes les commandes
      - si --somtech-only: copie seulement somtech.*.md
  - .cursor/skills : copie tout (backup + overwrite si existant)
  - docs/chatwindow : copie le dossier de doc générique ChatWindow (backup si existant)
  - .cursor/generic/PLACEHOLDERS.md : copié depuis la source si présent, sinon généré.

Backups:
  - Tout fichier déjà présent est sauvegardé en *.bak-YYYYMMDDHHMMSS avant écriture.
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_SOURCE="$(cd "${SCRIPT_DIR}/.." && pwd)"

SOURCE="${DEFAULT_SOURCE}"
TARGET=""
DRY_RUN=0
DO_RULES=1
DO_COMMANDS=1
DO_SKILLS=1
DO_DOCS=1
SOMTECH_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source) SOURCE="${2:-}"; shift 2 ;;
    --target) TARGET="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --no-rules) DO_RULES=0; shift ;;
    --no-commands) DO_COMMANDS=0; shift ;;
    --no-skills) DO_SKILLS=0; shift ;;
    --no-docs) DO_DOCS=0; shift ;;
    --somtech-only) SOMTECH_ONLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Argument inconnu: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ -z "${TARGET}" ]]; then
  echo "Erreur: --target est requis." >&2
  usage
  exit 2
fi

if [[ ! -d "${SOURCE}/.cursor/rules" ]]; then
  echo "Erreur: source invalide: ${SOURCE}/.cursor/rules introuvable" >&2
  exit 2
fi
if [[ ! -d "${SOURCE}/.cursor/commands" ]]; then
  echo "Erreur: source invalide: ${SOURCE}/.cursor/commands introuvable" >&2
  exit 2
fi

# Skills/docs sont optionnels: on avertit seulement si absents.
if [[ "${DO_SKILLS}" == "1" ]] && [[ ! -d "${SOURCE}/.cursor/skills" ]]; then
  echo "Avertissement: ${SOURCE}/.cursor/skills introuvable (skills ignorés)" >&2
fi
if [[ "${DO_DOCS}" == "1" ]] && [[ ! -d "${SOURCE}/docs/chatwindow" ]]; then
  echo "Avertissement: ${SOURCE}/docs/chatwindow introuvable (docs ignorés)" >&2
fi

_ts() { date +"%Y%m%d%H%M%S"; }
log() { echo "[install_somtech_pack] $*"; }

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

backup_if_exists() {
  local f="$1"
  if [[ -f "$f" ]]; then
    local b="${f}.bak-$(_ts)"
    run "cp \"${f}\" \"${b}\""
  fi
}

copy_with_backup() {
  local src="$1"
  local dst="$2"
  ensure_dir "$(dirname "$dst")"
  backup_if_exists "$dst"
  run "cp \"${src}\" \"${dst}\""
}

write_default_placeholders_if_missing() {
  local dst="${TARGET}/.cursor/generic/PLACEHOLDERS.md"
  ensure_dir "$(dirname "$dst")"
  backup_if_exists "$dst"
  if [[ "${DRY_RUN}" == "1" ]]; then
    log "DRY-RUN: write ${dst}"
    return 0
  fi
  cat > "${dst}" <<'EOF2'
# Placeholders — somtech-pack

- `{{PROJECT_NAME}}`
- `{{DEV_SERVER_URL}}`
- `{{MCP_SUPABASE_TOOL_PREFIX}}`
- `{{MCP_SUPABASE_DEPLOY_EDGE_FUNCTION_TOOL}}`
- `{{MCP_RAILWAY_TOOL_PREFIX}}`
EOF2
}

create_min_module_structure_if_missing() {
  if [[ -d "${TARGET}/modules/_template" ]]; then
    log "modules/_template existe déjà -> pas de création de structure modulaire."
    return 0
  fi
  log "Création structure modulaire minimale (template)…"
  ensure_dir "${TARGET}/modules/_template/mcp"
  ensure_dir "${TARGET}/modules/_template/prd"
  ensure_dir "${TARGET}/modules/_template/tests"
  ensure_dir "${TARGET}/modules/_shared"
}

install_placeholders() {
  ensure_dir "${TARGET}/.cursor/generic"
  if [[ -f "${SOURCE}/.cursor/generic/PLACEHOLDERS.md" ]]; then
    log "Install PLACEHOLDERS.md depuis la source"
    copy_with_backup "${SOURCE}/.cursor/generic/PLACEHOLDERS.md" "${TARGET}/.cursor/generic/PLACEHOLDERS.md"
  else
    log "PLACEHOLDERS.md absent côté source -> génération d’un défaut"
    write_default_placeholders_if_missing
  fi
}

install_rules() {
  ensure_dir "${TARGET}/.cursor/rules"
  log "Installation .cursor/rules (backup + overwrite)"

  while IFS= read -r src; do
    local_name="$(basename "$src")"
    copy_with_backup "$src" "${TARGET}/.cursor/rules/${local_name}"
  done < <(find "${SOURCE}/.cursor/rules" -maxdepth 1 -type f \( -name "*.mdc" -o -name "*.md" \) | sort)
}

install_commands() {
  ensure_dir "${TARGET}/.cursor/commands"

  if [[ "${SOMTECH_ONLY}" == "1" ]]; then
    log "Installation .cursor/commands (somtech.* uniquement)"
    while IFS= read -r src; do
      local_name="$(basename "$src")"
      copy_with_backup "$src" "${TARGET}/.cursor/commands/${local_name}"
    done < <(find "${SOURCE}/.cursor/commands" -maxdepth 1 -type f -name "somtech.*.md" | sort)
    return 0
  fi

  log "Installation .cursor/commands (toutes les commandes)"
  while IFS= read -r src; do
    local_name="$(basename "$src")"
    copy_with_backup "$src" "${TARGET}/.cursor/commands/${local_name}"
  done < <(find "${SOURCE}/.cursor/commands" -maxdepth 1 -type f -name "*.md" | sort)
}

install_skills() {
  if [[ ! -d "${SOURCE}/.cursor/skills" ]]; then
    log "Avertissement: .cursor/skills absent côté source -> ignoré"
    return 0
  fi

  ensure_dir "${TARGET}/.cursor/skills"
  log "Installation .cursor/skills (backup + overwrite)"

  # Copier chaque skill (répertoire complet)
  while IFS= read -r skill_dir; do
    skill_name="$(basename "${skill_dir}")"
    if [[ -d "${TARGET}/.cursor/skills/${skill_name}" ]]; then
      run "mv \"${TARGET}/.cursor/skills/${skill_name}\" \"${TARGET}/.cursor/skills/${skill_name}.bak-$(_ts)\""
    fi
    run "cp -R \"${skill_dir}\" \"${TARGET}/.cursor/skills/\""
  done < <(find "${SOURCE}/.cursor/skills" -maxdepth 1 -type d ! -path "${SOURCE}/.cursor/skills" | sort)

  # Copier README.md à la racine des skills si présent
  if [[ -f "${SOURCE}/.cursor/skills/README.md" ]]; then
    copy_with_backup "${SOURCE}/.cursor/skills/README.md" "${TARGET}/.cursor/skills/README.md"
  fi
}

install_docs() {
  if [[ ! -d "${SOURCE}/docs/chatwindow" ]]; then
    log "Avertissement: docs/chatwindow absent côté source -> ignoré"
    return 0
  fi

  ensure_dir "${TARGET}/docs"
  log "Installation docs/chatwindow (backup + overwrite)"

  if [[ -d "${TARGET}/docs/chatwindow" ]]; then
    run "mv \"${TARGET}/docs/chatwindow\" \"${TARGET}/docs/chatwindow.bak-$(_ts)\""
  fi
  run "cp -R \"${SOURCE}/docs/chatwindow\" \"${TARGET}/docs/\""
}

main() {
  create_min_module_structure_if_missing

  ensure_dir "${TARGET}/.cursor/rules"
  ensure_dir "${TARGET}/.cursor/commands"
  ensure_dir "${TARGET}/.cursor/skills"
  ensure_dir "${TARGET}/docs"
  ensure_dir "${TARGET}/.cursor/generic"

  install_placeholders
  if [[ "${DO_RULES}" == "1" ]]; then install_rules; fi
  if [[ "${DO_COMMANDS}" == "1" ]]; then install_commands; fi
  if [[ "${DO_SKILLS}" == "1" ]]; then install_skills; fi
  if [[ "${DO_DOCS}" == "1" ]]; then install_docs; fi

  log "Terminé."
}

main
