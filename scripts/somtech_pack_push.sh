#!/usr/bin/env bash
set -euo pipefail

# somtech_pack_push.sh — Publie des changements (diff-based) d’un projet vers somtech-pack.
# Crée une branche, commit, push, ouvre une PR, puis génère une release note.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}" )" && pwd)"

# shellcheck source=lib/somtech_pack_common.sh
source "${SCRIPT_DIR}/lib/somtech_pack_common.sh"

usage() {
  cat <<'USAGE'
somtech_pack_push.sh — Publie des changements d’un projet vers somtech-pack (diff-based).

Usage:
  ./scripts/somtech_pack_push.sh --message "chore(rules): ..." [options]

Options:
  --repo        Repo git du pack (default: https://github.com/SomtechSolutionMAxime/somtech-pack.git)
  --base-ref    Base ref git dans le projet pour le diff (default: origin/main)
  --ref         Ref du pack à cibler (default: main)
  --workdir     Dossier de travail (default: ~/.cache)
  --project     Slug projet (default: basename du repo courant)
  --scope       Scope sync (default: .cursor,docs,scripts,README.md)
  --message     Message commit (obligatoire)
  --title       Titre PR (default: <message>)
  --body-file   Fichier markdown pour body PR (optionnel)
  --dry-run     Affiche les actions sans écrire dans le pack
  --allow-project-example   Assouplit certains checks (ex: fichiers d’exemples sanitisés)

Pré-requis:
  - git
  - gh (GitHub CLI) authentifié (gh auth login)

Notes:
  - Le diff est calculé depuis le repo courant (projet). Les chemins copiés sont relatifs à sa racine.
USAGE
}

REPO_URL="https://github.com/SomtechSolutionMAxime/somtech-pack.git"
REPO_GH="SomtechSolutionMAxime/somtech-pack"
PACK_REF="main"
BASE_REF="origin/main"
WORKBASE="${HOME}/.cache"
PROJECT_SLUG=""
SCOPE=".cursor,docs,scripts,README.md"
MESSAGE=""
TITLE=""
BODY_FILE=""
DRY_RUN=0
ALLOW_PROJECT_EXAMPLE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO_URL="${2:-}"; shift 2 ;;
    --ref) PACK_REF="${2:-}"; shift 2 ;;
    --base-ref) BASE_REF="${2:-}"; shift 2 ;;
    --workdir) WORKBASE="${2:-}"; shift 2 ;;
    --project) PROJECT_SLUG="${2:-}"; shift 2 ;;
    --scope) SCOPE="${2:-}"; shift 2 ;;
    --message) MESSAGE="${2:-}"; shift 2 ;;
    --title) TITLE="${2:-}"; shift 2 ;;
    --body-file) BODY_FILE="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --allow-project-example) ALLOW_PROJECT_EXAMPLE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) err "Argument inconnu: $1"; usage; exit 2 ;;
  esac
done

[[ -n "$MESSAGE" ]] || die "--message est requis"
[[ -n "$TITLE" ]] || TITLE="$MESSAGE"

# Derive gh repo slug from URL/SSH (gh expects OWNER/REPO)
# Supports:
# - https://github.com/OWNER/REPO.git
# - git@github.com:OWNER/REPO.git
REPO_GH="$REPO_URL"
REPO_GH="${REPO_GH#https://github.com/}"
REPO_GH="${REPO_GH#git@github.com:}"
REPO_GH="${REPO_GH%.git}"

require_cmd git
require_cmd gh

# Ensure we're inside a git repo (project)
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || die "Ce script doit être exécuté dans un repo git (projet)."
cd "$PROJECT_ROOT"

if [[ -z "$PROJECT_SLUG" ]]; then
  PROJECT_SLUG="$(basename "$PROJECT_ROOT")"
fi
PROJECT_SLUG="$(slugify "$PROJECT_SLUG")"

# Validate base ref exists
if ! git rev-parse --verify --quiet "$BASE_REF" >/dev/null; then
  die "Base ref introuvable dans le projet: $BASE_REF (utilise --base-ref pour ajuster)"
fi

# Determine scope allowlist
IFS=',' read -r -a SCOPES <<<"$SCOPE"

in_scope() {
  local path="$1"

  for s in "${SCOPES[@]}"; do
    case "$s" in
      .cursor) [[ "$path" == .cursor/* ]] && return 0 ;;
      docs) [[ "$path" == docs/* ]] && return 0 ;;
      scripts) [[ "$path" == scripts/* ]] && return 0 ;;
      README.md) [[ "$path" == README.md ]] && return 0 ;;
      *)
        # allow raw prefix
        [[ "$path" == "$s"* ]] && return 0
        ;;
    esac
  done
  return 1
}

log "Projet: $PROJECT_ROOT"
log "Base diff: $BASE_REF...HEAD"
log "Pack repo: $REPO_URL (ref: $PACK_REF)"
log "Scope: $SCOPE"
log "Dry-run: $DRY_RUN"

# Collect changed files (name-status with renames)
DIFF_LINES=()
while IFS= read -r _line; do
  DIFF_LINES+=("$_line")
done < <(git diff --name-status -M "$BASE_REF...HEAD")

if [[ ${#DIFF_LINES[@]} -eq 0 ]]; then
  die "Aucun changement détecté entre $BASE_REF et HEAD."
fi

# Build operation list
# Each item: STATUS\tSRC\tDST
OPS=()

for line in "${DIFF_LINES[@]}"; do
  # statuses: A\tpath, M\tpath, D\tpath, R100\told\tnew
  IFS=$'\t' read -r st p1 p2 <<<"$line"

  if [[ "$st" == R* ]]; then
    # rename old->new
    [[ -n "$p1" && -n "$p2" ]] || continue
    in_scope "$p1" && OPS+=("D\t$p1\t")
    in_scope "$p2" && OPS+=("A\t$p2\t")
    continue
  fi

  [[ -n "$p1" ]] || continue
  in_scope "$p1" || continue

  case "$st" in
    A|M) OPS+=("$st\t$p1\t") ;;
    D) OPS+=("D\t$p1\t") ;;
    *)
      # ignore others
      ;;
  esac
done

if [[ ${#OPS[@]} -eq 0 ]]; then
  die "Aucun fichier dans le scope ($SCOPE) n’a changé."
fi

# Clone pack
WORKDIR="$(mk_workdir "$WORKBASE")"
PACK_CLONE="${WORKDIR}/somtech-pack"

log "Workdir: $WORKDIR"
clone_pack "$REPO_URL" "$PACK_REF" "$PACK_CLONE"

# Create a branch in pack
DATE_SLUG=$(date +"%Y-%m-%d")
SHORT_SLUG=$(slugify "${MESSAGE:0:40}")
BRANCH="sync/${PROJECT_SLUG}/${DATE_SLUG}-${SHORT_SLUG}"

(
  cd "$PACK_CLONE"
  git checkout -b "$BRANCH" >/dev/null
)

# Apply changes
CHANGED_DEST_FILES=()

apply_copy() {
  local rel="$1"
  local src="$PROJECT_ROOT/$rel"
  local dst="$PACK_CLONE/$rel"

  [[ -f "$src" ]] || die "Fichier source introuvable: $src"

  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  CHANGED_DEST_FILES+=("$dst")
}

apply_delete() {
  local rel="$1"
  local dst="$PACK_CLONE/$rel"
  if [[ -e "$dst" ]]; then
    rm -rf "$dst"
  fi
}

log "Application des changements vers le pack (branch: $BRANCH)"

if [[ "$DRY_RUN" == "1" ]]; then
  for op in "${OPS[@]}"; do
    printf '[DRY-RUN] %b\n' "$op"
  done
  log "Fin DRY-RUN."
  exit 0
fi

for op in "${OPS[@]}"; do
  IFS=$'\t' read -r st rel _ <<<"$op"
  case "$st" in
    A|M) apply_copy "$rel" ;;
    D) apply_delete "$rel" ;;
  esac
done

# Secret checks on copied files
# (deletes don't need scanning)
if [[ ${#CHANGED_DEST_FILES[@]} -gt 0 ]]; then
  check_no_secrets_in_files "${CHANGED_DEST_FILES[@]}"
fi

# Additional project-specific ID deny list (example)
# NOTE: ne scanner que les fichiers copiés, sinon le script s'auto-bloque (la valeur est présente dans ce script).
if [[ "$ALLOW_PROJECT_EXAMPLE" != "1" && ${#CHANGED_DEST_FILES[@]} -gt 0 ]]; then
  # deny common supabase project-ref patterns (non-placeholder)
  if grep -nE 'kedosjwbfzpfqchvgpny' "${CHANGED_DEST_FILES[@]}" >/dev/null 2>&1; then
    die "Détection d’un ID projet connu (kedosjwbfzpfqchvgpny). Remplace par des placeholders."
  fi
fi

# Commit + push + PR
(
  cd "$PACK_CLONE"
  git add -A
  if git diff --cached --quiet; then
    die "Aucun changement effectif à committer dans le pack (après sync)."
  fi

  git commit -m "$MESSAGE" >/dev/null

  log "Push branche: $BRANCH"
  git push -u origin "$BRANCH" >/dev/null

  # Create PR
  log "Création PR…"
  PR_URL=""
  if [[ -n "$BODY_FILE" ]]; then
    PR_URL=$(gh pr create --repo "$REPO_GH" --base main --head "$BRANCH" --title "$TITLE" --body-file "$BODY_FILE")
  else
    PR_URL=$(gh pr create --repo "$REPO_GH" --base main --head "$BRANCH" --title "$TITLE" --body "")
  fi

  log "PR: $PR_URL"

  PR_NUMBER=$(gh pr view --repo "$REPO_GH" "$BRANCH" --json number --jq .number)
  [[ -n "$PR_NUMBER" ]] || die "Impossible de récupérer le numéro de PR"

  # Release note path (module = .cursor)
  mkdir -p .cursor/releasenotes
  RN_SLUG=$(slugify "$SHORT_SLUG")
  RN_FILE=".cursor/releasenotes/${PR_NUMBER}.${RN_SLUG}.releasenotes.md"

  if [[ -f "$RN_FILE" ]]; then
    die "Release note existe déjà: $RN_FILE"
  fi

  cat > "$RN_FILE" <<EOF2
# Release Notes — ${TITLE}

**Version** : Pack  
**Date** : $(date +"%Y-%m-%d")  
**PR** : #${PR_NUMBER} — ${TITLE}  
**Module** : .cursor

---

## 🎯 Résumé

- (à compléter)

---

## ✨ Changements

- (à compléter)

---

## 🧪 Tests et validation

- N/A (pack)

---

## 📁 Fichiers impactés

- (à compléter)

---

## 🔗 Références

- PR : #${PR_NUMBER}
EOF2

  git add "$RN_FILE"
  git commit -m "docs(releasenotes): add PR-${PR_NUMBER} release note" >/dev/null
  git push >/dev/null

  log "OK (push). Release note: $RN_FILE"
)
