#!/usr/bin/env bash
# ============================================================
# test-merge-closes-stories.sh — v1.0.0
# Banc unitaire de `merge-closes-stories.sh` (T-20260922-0084).
#
# Fixtures SYNTHÉTIQUES, une par cas observé (ou explicitement exclu) dans le
# motif écrit en tête de la lib. Le complément sur TRAFIC RÉEL est
# `test-merge-closes-stories-corpus.sh` (exigence G/W/T « sur du trafic réel
# du dépôt ») — les deux sont non-substituables l'un à l'autre.
#
# Usage : bash scripts/tests/test-merge-closes-stories.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LIB="${MFS_LIB:-${ROOT}/.claude/skills/merge/lib/merge-closes-stories.sh}"

[ -f "$LIB" ] || { echo "❌ lib absente: $LIB"; exit 1; }
# shellcheck source=/dev/null
source "$LIB"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
PASS=0; FAIL=0
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

# corps <texte> — écrit <texte> dans un fichier temporaire, imprime son chemin.
corps() {
  local f; f="$(mktemp "${WORK}/corps.XXXXXX")"
  printf '%s' "$1" > "$f"
  printf '%s' "$f"
}

# assert_egal <libellé> <fichier-corps> <attendu multi-ligne> <rc-attendu>
assert_cas() {
  local label="$1" fichier="$2" attendu="$3" rc_attendu="$4" rendu rc
  rendu="$(mfs_tickets_du_corps "$fichier" 2>/dev/null)"; rc=$?
  if [ "$rc" = "$rc_attendu" ] && [ "$rendu" = "$attendu" ]; then
    ok "$label"
  else
    ko "$label — rc=${rc} (attendu ${rc_attendu}) rendu=[$(printf '%s' "$rendu" | tr '\n' ',')] attendu=[$(printf '%s' "$attendu" | tr '\n' ',')]"
  fi
}

echo "== Formes réelles à un seul ticket =="

assert_cas "label brut sans ponctuation" \
  "$(corps 'Ticket T-20260922-0072 · Demande D-20260921-0017 (lot 4, garde 1/5)')" \
  "T-20260922-0072" 0

assert_cas "ID en gras markdown" \
  "$(corps 'Ticket **T-20260922-0062** · Demande **D-20260922-0002**')" \
  "T-20260922-0062" 0

assert_cas "label suivi de deux-points espacé" \
  "$(corps 'Ticket : T-20260921-0028 · Jalon : J-20260814-0002')" \
  "T-20260921-0028" 0

assert_cas "label lui-même en gras" \
  "$(corps '**Ticket** : T-20260824-0020 · **Coordonnateur** : batiscan')" \
  "T-20260824-0020" 0

assert_cas "label singulier Story" \
  "$(corps 'Story **T-20260825-0001** · Epic **E-20260824-0011**')" \
  "T-20260825-0001" 0

echo "== Formes réelles multi-tickets =="

assert_cas "Stories avec séparateur point médian" \
  "$(corps 'Stories : `T-20260821-0024` · `T-20260821-0025` · `T-20260821-0026`')" \
  "$(printf 'T-20260821-0024\nT-20260821-0025\nT-20260821-0026')" 0

assert_cas "Tickets avec virgule" \
  "$(corps 'Tickets : T-20260914-0004, T-20260818-0035')" \
  "$(printf 'T-20260914-0004\nT-20260818-0035')" 0

echo "== Le défaut PR #347 : troncature à la phrase ================================"
# 'Tickets : T-A, T-B. Trouvé en chemin, non corrige ici : T-C.'
# Sans troncature, T-C serait ferme A TORT — c'est exactement ce que la garde interdit.
assert_cas "un 3e ID APRÈS un point n'est PAS retenu (PR #347)" \
  "$(corps 'Tickets : T-20260914-0004, T-20260818-0035. Trouve en chemin, non corrige ici : T-20260921-0045.')" \
  "$(printf 'T-20260914-0004\nT-20260818-0035')" 0

echo "== Le défaut PR #338 : ancrage en tête de ligne ================================"
# Un ID cite en pleine phrase, sur une ligne qui NE COMMENCE PAS par le label,
# ne doit JAMAIS être retenu — même s'il partage le corps avec une ligne étiquetée.
assert_cas "ID en narration, ligne non étiquetée, exclu" \
  "$(corps "$(printf 'Ticket **T-20260827-0014** · epic **E-20260827-0002**\n\nT-20260826-0042 a ouvert la porte pour ce correctif.\n')")" \
  "T-20260827-0014" 0

echo "== Le défaut PR #329 : la casse du T- compte ==================================="
# Un nom d'agent en minuscules (convention pane herdr) ne doit jamais se faire
# passer pour une reference de ticket.
assert_cas "t-minuscule (nom d'agent) n'est PAS un ID" \
  "$(corps 'Stories : `T-20260825-0012` (recensement — mené par `t-20260825-0012`)')" \
  "T-20260825-0012" 0

echo "== Abstentions — INDETERMINE, jamais devine ===================================="

assert_cas "aucune ligne étiquetée du tout" \
  "$(corps 'Demande D-20260921-0003 · livraison J-20260814-0002 · WIP')" \
  "" 1

assert_cas "corps entièrement vide" \
  "$(corps '')" \
  "" 1

assert_cas "ligne étiquetée sans ID reconnaissable" \
  "$(corps 'Ticket : voir la demande, aucun numero pour le moment')" \
  "" 1

echo "== Dédoublonnage et ordre ========================================================"

assert_cas "même ID répété sur deux lignes étiquetées : une seule sortie" \
  "$(corps "$(printf 'Ticket T-20260922-0001\nStory T-20260922-0001')")" \
  "T-20260922-0001" 0

assert_cas "ordre de première apparition préservé" \
  "$(corps 'Stories : T-20260824-0034, T-20260824-0032, T-20260824-0033')" \
  "$(printf 'T-20260824-0034\nT-20260824-0032\nT-20260824-0033')" 0

echo "== Erreur d'appel ================================================================"

if mfs_tickets_du_corps "${WORK}/n-existe-pas.txt" >/dev/null 2>&1; then
  ko "fichier absent : devrait rendre rc=2"
else
  rc=$?
  if [ "$rc" -eq 2 ]; then
    ok "fichier absent → rc=2 (erreur d'appel, distincte d'INDETERMINE=1)"
  else
    ko "fichier absent : rc=${rc}, attendu 2"
  fi
fi

echo
echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
