#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
somtech_pack_add.sh — stage + commit des fichiers, puis push diff-based vers somtech-pack.

Usage:
  ./scripts/somtech_pack_add.sh <paths-or-globs...>

Exemples:
  ./scripts/somtech_pack_add.sh .cursor/commands/mockmig*.md
  ./scripts/somtech_pack_add.sh .cursor/commands/foo.md scripts/bar.sh

Env:
  SOMTECH_PACK_DIR   Chemin vers le repo somtech-pack (sinon auto-détection: ../somtech-pack)
  SOMTECH_PACK_SCOPE Scope par défaut (sinon: .cursor,docs,scripts,README.md,.specify)
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || $# -eq 0 ]]; then
  usage
  exit 0
fi

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "[somtech.pack.add][ERROR] commande requise introuvable: $1" >&2; exit 1; }
}

slugify() {
  # bash 3.2 compatible
  local s="${1:-}"
  s="$(printf '%s' "$s" | tr '[:upper:]' '[:lower:]')"
  s="$(printf '%s' "$s" | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g')"
  printf '%s\n' "$s"
}

require_cmd git

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "[somtech.pack.add][ERROR] exécute ce script dans un repo git (projet)." >&2; exit 1; }
cd "$PROJECT_ROOT"

DEFAULT_SCOPE=".cursor,docs,scripts,README.md,.specify"
SCOPE="${SOMTECH_PACK_SCOPE:-$DEFAULT_SCOPE}"

# Detect pack dir (sibling ../somtech-pack) unless overridden
PACK_DIR="${SOMTECH_PACK_DIR:-"$(cd "$PROJECT_ROOT/.." && pwd)/somtech-pack"}"
PACK_SCRIPT="${PACK_DIR}/scripts/somtech_pack_push.sh"

if [[ ! -x "$PACK_SCRIPT" ]]; then
  echo "[somtech.pack.add][ERROR] script pack introuvable ou non exécutable: $PACK_SCRIPT" >&2
  echo "[somtech.pack.add] Astuce: clone somtech-pack à côté du projet (../somtech-pack) ou exporte SOMTECH_PACK_DIR." >&2
  exit 1
fi

# Expand globs safely (for each arg, if it looks like a glob, expand using compgen -G)
FILES=()
for a in "$@"; do
  if [[ "$a" == *"*"* || "$a" == *"?"* || "$a" == *"["*"]"* ]]; then
    mapfile_like=0
    # bash 3.2: no mapfile, so use while-read
    found_any=0
    while IFS= read -r match; do
      found_any=1
      FILES+=("$match")
    done < <(compgen -G "$a" || true)
    if [[ "$found_any" == "0" ]]; then
      echo "[somtech.pack.add][ERROR] aucun fichier ne matche: $a" >&2
      exit 1
    fi
  else
    FILES+=("$a")
  fi
done

# Verify files exist
for f in "${FILES[@]}"; do
  if [[ ! -e "$f" ]]; then
    echo "[somtech.pack.add][ERROR] fichier introuvable: $f" >&2
    exit 1
  fi
done

echo "[somtech.pack.add] Projet: $PROJECT_ROOT"
echo "[somtech.pack.add] Pack: $PACK_DIR"
echo "[somtech.pack.add] Scope pack: $SCOPE"

git add -- "${FILES[@]}"

if git diff --cached --quiet; then
  echo "[somtech.pack.add][ERROR] rien à committer (index vide). Vérifie tes chemins." >&2
  exit 1
fi

first="${FILES[0]}"
msg="chore(pack): add $(slugify "$(basename "$first")")"

git commit -m "$msg"

require_cmd gh

echo "[somtech.pack.add] Push vers somtech-pack via somtech_pack_push.sh…"
"$PACK_SCRIPT" --message "$msg" --title "$msg" --scope "$SCOPE"

echo "[somtech.pack.add] Terminé."

