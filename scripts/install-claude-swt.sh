#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# install-claude-swt.sh — v1.0.0
# Installe le snippet shell `claude-swt` (worktree par session) dans le
# rc shell du dev, de façon IDEMPOTENTE.
#
# - Copie `scripts/shell/claude-swt.sh` vers <dest> (def: ~/.somtech).
# - Ajoute au rc shell (def: ~/.zshrc) un bloc gardé qui source ce fichier.
#   Le bloc est délimité par des marqueurs → ré-exécuter l'install ne crée
#   PAS de doublon (mise à jour en place du chemin si besoin).
#
# Usage :
#   scripts/install-claude-swt.sh [--rc <fichier>] [--dest <dir>]
#                                 [--src <fichier>] [--dry-run]
#
# Points d'injection (tests / cas spéciaux) :
#   --rc     fichier rc shell cible        (def: $HOME/.zshrc)
#   --dest   dossier d'installation        (def: $HOME/.somtech)
#   --src    source claude-swt.sh          (def: <script_dir>/shell/claude-swt.sh)
#   --dry-run  n'écrit rien, affiche le plan
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RC_FILE="${HOME}/.zshrc"
DEST_DIR="${HOME}/.somtech"
SRC_FILE="${SCRIPT_DIR}/shell/claude-swt.sh"
DRY_RUN=""

MARKER_BEGIN="# >>> somtech claude-swt >>>"
MARKER_END="# <<< somtech claude-swt <<<"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rc)      RC_FILE="${2:-}"; shift 2 ;;
    --dest)    DEST_DIR="${2:-}"; shift 2 ;;
    --src)     SRC_FILE="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN="1"; shift ;;
    -h|--help) sed -n '3,30p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "Option inconnue: $1" >&2; exit 1 ;;
  esac
done

[[ -f "$SRC_FILE" ]] || { echo "Erreur: source introuvable: $SRC_FILE" >&2; exit 1; }

DEST_FILE="${DEST_DIR}/claude-swt.sh"

# Le bloc gardé à insérer dans le rc shell.
read -r -d '' BLOCK <<EOF || true
${MARKER_BEGIN}
# claude-swt — worktree par session (somtech-pack). Ne pas éditer à la main.
[ -f "${DEST_FILE}" ] && source "${DEST_FILE}"
${MARKER_END}
EOF

if [[ -n "$DRY_RUN" ]]; then
  echo "[dry-run] copierait : $SRC_FILE → $DEST_FILE"
  echo "[dry-run] copierait : $(dirname "$SRC_FILE")/swt-db.sh → ${DEST_DIR}/swt-db.sh (si présent)"
  echo "[dry-run] copierait : $(dirname "$SRC_FILE")/pack-freshness.sh → ${DEST_DIR}/pack-freshness.sh (si présent)"
  if [[ -f "$RC_FILE" ]] && grep -qF "$MARKER_BEGIN" "$RC_FILE"; then
    echo "[dry-run] bloc déjà présent dans $RC_FILE → mise à jour en place"
  else
    echo "[dry-run] ajouterait le bloc gardé à $RC_FILE"
  fi
  exit 0
fi

# 1. Installer le fichier source (+ les libs swt-db.sh et pack-freshness.sh à côté,
#    sourcées par claude-swt.sh).
mkdir -p "$DEST_DIR"
cp "$SRC_FILE" "$DEST_FILE"
LIB_FILE="$(dirname "$SRC_FILE")/swt-db.sh"
[[ -f "$LIB_FILE" ]] && cp "$LIB_FILE" "${DEST_DIR}/swt-db.sh"
PF_LIB_FILE="$(dirname "$SRC_FILE")/pack-freshness.sh"
[[ -f "$PF_LIB_FILE" ]] && cp "$PF_LIB_FILE" "${DEST_DIR}/pack-freshness.sh"

# 2. Mettre à jour le rc shell de façon idempotente.
touch "$RC_FILE"

# Garde anti-perte de données : un bloc déséquilibré (BEGIN sans END, ou
# l'inverse) ferait manger des lignes légitimes par l'awk de strip. On refuse
# plutôt que de tronquer.
n_begin="$(grep -cF "$MARKER_BEGIN" "$RC_FILE" 2>/dev/null || true)"; n_begin="${n_begin:-0}"
n_end="$(grep -cF "$MARKER_END" "$RC_FILE" 2>/dev/null || true)"; n_end="${n_end:-0}"
if [[ "$n_begin" != "$n_end" ]]; then
  echo "⚠️  Bloc claude-swt déséquilibré dans $RC_FILE (BEGIN=$n_begin, END=$n_end)." >&2
  echo "    Édition automatique refusée pour éviter une perte de données." >&2
  echo "    Corrige/supprime le bloc à la main puis relance l'install." >&2
  exit 1
fi

# Backup du rc avant toute réécriture (fichier sensible).
if [[ -s "$RC_FILE" ]]; then
  cp "$RC_FILE" "${RC_FILE}.somtech.bak"
fi

if grep -qF "$MARKER_BEGIN" "$RC_FILE"; then
  # Remplacer le bloc existant (entre marqueurs) — évite tout doublon.
  tmp="$(mktemp)"
  awk -v b="$MARKER_BEGIN" -v e="$MARKER_END" '
    $0==b {skip=1}
    skip==1 {if ($0==e) skip=0; next}
    {print}
  ' "$RC_FILE" > "$tmp"
  printf '%s\n' "$BLOCK" >> "$tmp"
  mv "$tmp" "$RC_FILE"
  echo "✅ claude-swt : bloc mis à jour dans $RC_FILE"
else
  {
    printf '\n%s\n' "$BLOCK"
  } >> "$RC_FILE"
  echo "✅ claude-swt : bloc ajouté à $RC_FILE"
fi

echo "→ Ouvre un nouveau terminal (ou \`source $RC_FILE\`) puis : claude-swt"
echo "   (variante : claude-swt-danger → claude --dangerously-skip-permissions, environnement de confiance uniquement)"
