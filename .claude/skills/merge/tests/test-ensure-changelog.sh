#!/usr/bin/env bash
# ============================================================
# test-ensure-changelog.sh — v1.0.0
# Test des helpers déterministes d'insertion d'entrée CHANGELOG dans /merge
# (D-20260710-0001, T-20260710-0014).
#
# Couvre :
#   A. cec_diff_touches_changelog — détection exacte du fichier dans un diff
#   B. cec_prepend_entry — insertion AVANT la 1re section "## [", préambule
#      Keep a Changelog et sections existantes préservés
#   C. cec_prepend_entry — CHANGELOG sans section versionnée (fichier minimal)
#      → l'entrée est ajoutée sans perte du préambule
#
# Usage : bash .claude/skills/merge/tests/test-ensure-changelog.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/ensure-changelog.sh
source "${SCRIPT_DIR}/../lib/ensure-changelog.sh"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK" "$PASS_FILE" "$FAIL_FILE"; }
trap cleanup EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

# --- A. Détection dans le diff (liste de fichiers sur stdin) ---
echo "A. cec_diff_touches_changelog"
printf 'src/a.ts\nCHANGELOG.md\nREADME.md\n' | cec_diff_touches_changelog CHANGELOG.md \
  && ok "détecte CHANGELOG.md présent dans le diff" \
  || ko "aurait dû détecter CHANGELOG.md"

printf 'src/a.ts\nREADME.md\n' | cec_diff_touches_changelog CHANGELOG.md \
  && ko "faux positif : CHANGELOG.md absent mais détecté" \
  || ok "n'invente pas CHANGELOG.md quand il est absent"

# match exact — un sous-chemin homonyme ne compte pas comme la racine
printf 'docs/CHANGELOG.md\n' | cec_diff_touches_changelog CHANGELOG.md \
  && ko "docs/CHANGELOG.md ne devrait pas matcher CHANGELOG.md (racine)" \
  || ok "match exact du chemin cible (pas de sous-chemin homonyme)"

# --- B. Insertion avant la 1re section versionnée ---
echo "B. cec_prepend_entry — insertion ordonnée"
CL="$WORK/CHANGELOG.md"
cat > "$CL" <<'EOF'
# Changelog

Format basé sur Keep a Changelog.

## [1.1.0] - 2026-07-01

### Ajouté
- feature B

## [1.0.0] - 2026-06-01

### Ajouté
- feature A
EOF

ENTRY="$WORK/entry.md"
cat > "$ENTRY" <<'EOF'
## [Non-versionné] - 2026-07-10

### Corrigé
- bug X
EOF

cec_prepend_entry "$CL" "$ENTRY" && ok "cec_prepend_entry retourne 0" || ko "cec_prepend_entry a échoué"

# La nouvelle entrée doit précéder l'ancienne 1re section 1.1.0
line_new=$(grep -n '\[Non-versionné\]' "$CL" | head -1 | cut -d: -f1)
line_110=$(grep -n '\[1.1.0\]' "$CL" | head -1 | cut -d: -f1)
line_100=$(grep -n '\[1.0.0\]' "$CL" | head -1 | cut -d: -f1)
line_head=$(grep -n '^# Changelog' "$CL" | head -1 | cut -d: -f1)

[ -n "$line_new" ] && [ -n "$line_110" ] && [ "$line_new" -lt "$line_110" ] \
  && ok "l'entrée est insérée AVANT la 1re section versionnée" \
  || ko "l'entrée n'est pas avant 1.1.0 (new=$line_new, 1.1.0=$line_110)"

[ -n "$line_head" ] && [ "$line_head" -lt "$line_new" ] \
  && ok "le préambule '# Changelog' reste en tête" \
  || ko "préambule déplacé ou perdu (head=$line_head, new=$line_new)"

[ -n "$line_100" ] && [ "$line_110" -lt "$line_100" ] \
  && ok "les sections existantes conservent leur ordre (1.1.0 avant 1.0.0)" \
  || ko "ordre des sections existantes cassé"

grep -q 'feature A' "$CL" && grep -q 'feature B' "$CL" && grep -q 'bug X' "$CL" \
  && ok "aucun contenu perdu (features A/B + bug X présents)" \
  || ko "contenu perdu après insertion"

# --- C. CHANGELOG sans section versionnée ---
echo "C. cec_prepend_entry — fichier sans section '## ['"
CL2="$WORK/CHANGELOG2.md"
printf '# Changelog\n\nPréambule seul.\n' > "$CL2"
cec_prepend_entry "$CL2" "$ENTRY" && ok "retourne 0 sur fichier minimal" || ko "échec sur fichier minimal"
grep -q '^# Changelog' "$CL2" && grep -q 'bug X' "$CL2" \
  && ok "préambule préservé + entrée ajoutée (fichier minimal)" \
  || ko "préambule ou entrée manquant (fichier minimal)"

# --- Bilan ---
P=$(wc -l < "$PASS_FILE" | tr -d ' '); F=$(wc -l < "$FAIL_FILE" | tr -d ' ')
echo "────────────────────────────────"
echo "  PASS=$P  FAIL=$F"
[ "$F" -eq 0 ] || exit 1
