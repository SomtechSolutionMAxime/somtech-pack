#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# install_somtech_pack.sh — v1.0.0
# Installe le somtech-pack (modulaire) dans un projet cible.
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_SOURCE="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=lib/somtech_pack_common.sh
source "${SCRIPT_DIR}/lib/somtech_pack_common.sh"

usage() {
  cat <<'EOF'
install_somtech_pack.sh — Installe le somtech-pack dans un projet cible.

Usage:
  ./scripts/install_somtech_pack.sh --target /path/to/project [options]

Options:
  --source       Répertoire source (racine somtech-pack). Défaut: racine du repo.
  --target       Chemin du projet cible (obligatoire).
  --modules      Modules à installer, séparés par virgule. Défaut: modules par défaut.
                 Ex: --modules core,features,mockmig
  --list-modules Affiche les modules disponibles et quitte.
  --dry-run      Affiche ce qui serait fait, sans écrire.

Modules disponibles:
  core       Config Claude Code + Cursor + scripts + docs + sécurité (défaut)
  features   Blueprints de features réutilisables (défaut)
  mockmig    Workflow migration maquette → production
  plugins    Plugins Cowork (audit-loi25, somtech-proposals, somtech-silo-manager)

Exemples:
  ./scripts/install_somtech_pack.sh --target . --dry-run
  ./scripts/install_somtech_pack.sh --target . --modules core,features,mockmig
  ./scripts/install_somtech_pack.sh --list-modules
EOF
}

# ── Arguments ─────────────────────────────────────────────────

TARGET=""
SOURCE=""
MODULES_CSV=""
DRY_RUN=0
LIST_MODULES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)       SOURCE="${2:-}"; shift 2 ;;
    --target)       TARGET="${2:-}"; shift 2 ;;
    --modules)      MODULES_CSV="${2:-}"; shift 2 ;;
    --list-modules) LIST_MODULES=1; shift ;;
    --dry-run)      DRY_RUN=1; shift ;;
    -h|--help)      usage; exit 0 ;;
    *) echo "Argument inconnu: $1" >&2; usage; exit 2 ;;
  esac
done

SOURCE="${SOURCE:-$DEFAULT_SOURCE}"

if [[ "$LIST_MODULES" == "1" ]]; then
  list_modules "$SOURCE"
  exit 0
fi

if [[ -z "$TARGET" ]]; then
  echo "Erreur: --target est requis." >&2
  usage
  exit 2
fi

# ── Fonctions utilitaires ─────────────────────────────────────

ts() { date +"%Y%m%d%H%M%S"; }

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
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
  [[ -f "$f" ]] || return 0

  local rel="${f#${TARGET}/}"
  local category=""

  if [[ "$rel" == ".cursor/rules/"* ]]; then
    category="rules"
  elif [[ "$rel" == ".cursor/commands/"* ]]; then
    category="commands"
  fi

  if [[ -n "$category" ]]; then
    local rel_under="${rel#".cursor/${category}/"}"
    local backup_dir="${TARGET}/.cursor/_backups/${category}/$(dirname "$rel_under")"
    ensure_dir "$backup_dir"
    local b="${backup_dir}/$(basename "$f").bak-$(ts)"
    run "cp \"${f}\" \"${b}\""
  else
    local b="${f}.bak-$(ts)"
    run "cp \"${f}\" \"${b}\""
  fi
}

copy_file_with_backup() {
  local src="$1"
  local dst="$2"
  ensure_dir "$(dirname "$dst")"
  backup_if_exists "$dst"
  if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: cp \"${src}\" \"${dst}\""
  else
    cp "$src" "$dst"
  fi
}

copy_tree() {
  # copy_tree <relative_source_dir> <absolute_target_dir>
  local from_rel="$1"
  local to_abs="$2"

  local src_root="${SOURCE}/${from_rel}"
  [[ -d "$src_root" ]] || return 0

  while IFS= read -r f; do
    local rel="${f#${src_root}/}"
    copy_file_with_backup "$f" "${to_abs}/${rel}"
  done < <(find "$src_root" -type f \
    ! -name '*.bak-*' \
    ! -name '* 2.md' \
    ! -name '.DS_Store' \
    ! -name '*.zip' \
    -print)
}

# ── Résolution des modules ────────────────────────────────────

resolve_modules() {
  if [[ -n "$MODULES_CSV" ]]; then
    echo "$MODULES_CSV"
  else
    # Modules par défaut depuis pack.json (ou fallback hardcodé)
    local defaults
    defaults="$(get_default_modules "$SOURCE" | tr '\n' ',' | sed 's/,$//')"
    echo "${defaults:-core,features}"
  fi
}

path_in_modules() {
  # Vérifie si un chemin relatif fait partie des modules sélectionnés
  local path="$1"
  local modules="$2"

  local IFS=','
  for mod in $modules; do
    mod="$(echo "$mod" | tr -d '[:space:]')"
    while IFS= read -r mod_path; do
      [[ -z "$mod_path" ]] && continue
      # Match si le chemin commence par le path du module
      if [[ "$path/" == "$mod_path"* ]] || [[ "$path" == "$mod_path"* ]]; then
        return 0
      fi
    done < <(get_module_paths "$SOURCE" "$mod")
  done
  return 1
}

# ── Installation ──────────────────────────────────────────────

install_pack() {
  local modules
  modules="$(resolve_modules)"
  local version
  version="$(get_pack_version "$SOURCE")"

  log "somtech-pack v${version}"
  log "Source  : ${SOURCE}"
  log "Cible   : ${TARGET}"
  log "Modules : ${modules}"
  [[ "$DRY_RUN" == "1" ]] && log "Mode DRY-RUN activé"
  echo ""

  # Structure modulaire minimale si absente
  if ! [[ -d "${TARGET}/modules/_template" ]]; then
    log "Création structure modulaire minimale…"
    ensure_dir "${TARGET}/modules/_template/prd"
    ensure_dir "${TARGET}/modules/_template/tests"
    ensure_dir "${TARGET}/modules/_shared"
  fi

  # Copier chaque path de chaque module sélectionné
  local IFS=','
  for mod in $modules; do
    mod="$(echo "$mod" | tr -d '[:space:]')"
    log "── Module: ${mod} ──"

    while IFS= read -r mod_path; do
      [[ -z "$mod_path" ]] && continue

      # Retirer le trailing slash pour uniformiser
      mod_path="${mod_path%/}"

      if [[ -d "${SOURCE}/${mod_path}" ]]; then
        # C'est un dossier → copier l'arbre
        log "  📁 ${mod_path}/"
        copy_tree "$mod_path" "${TARGET}/${mod_path}"
      elif [[ -f "${SOURCE}/${mod_path}" ]]; then
        # C'est un fichier unique
        log "  📄 ${mod_path}"
        copy_file_with_backup "${SOURCE}/${mod_path}" "${TARGET}/${mod_path}"
      else
        log "  ⚠️  ${mod_path} introuvable dans la source"
      fi
    done < <(get_module_paths "$SOURCE" "$mod")
  done

  # Préparer le dossier backups Cursor
  ensure_dir "${TARGET}/.cursor/_backups"

  # Écrire la version installée
  if [[ "$DRY_RUN" == "0" ]]; then
    write_version_json "$TARGET" "$version" "$modules" "$(
      if command -v jq &>/dev/null && [[ -f "$SOURCE/pack.json" ]]; then
        jq -r '.repository // "unknown"' "$SOURCE/pack.json"
      else
        echo "https://github.com/SomtechSolutionMAxime/somtech-pack.git"
      fi
    )"
  else
    log "DRY-RUN: écriture .somtech-pack/version.json (v${version})"
  fi

  echo ""
  log "Installation terminée."

  # Rappel post-install
  echo ""
  echo "  📝 Prochaines étapes :"
  echo "     1. Personnaliser .claude/CLAUDE.md (sources de vérité, stack)"
  echo "     2. Remplacer les placeholders {{...}} dans .cursor/rules/"
  echo "     3. git add .claude/ .cursor/ features/ scripts/ && git commit -m 'chore: bootstrap somtech-pack'"
}

install_pack
