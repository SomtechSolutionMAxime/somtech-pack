#!/usr/bin/env bash
# ============================================================
# test-plan-servicedesk-branche.sh — v1.0.0
# Contrat git du skill plan-servicedesk : l'exercice (brainstorm + découpage)
# doit être consigné dans une branche dédiée plan/D-xxxx (D-20260630-0002).
#
# Anti-drift : vérifie les 3 invariants du design + la non-régression superplan.
#   (1) Ordre B.1 (Demande) AVANT la branche AVANT le brainstorm (Phase A).
#   (2) Le skill écrit lui-même un fichier de découpage (-decoupage.md).
#   (3) Garde-fou git adaptatif : working tree propre → isole ; sinon STOP + 3 options.
#   (4) superplan reste un alias (lit plan-servicedesk) et ne réimplémente PAS le git.
#
# Discriminant : ROUGE sur le SKILL.md d'avant ce chantier (aucune gestion git),
# VERT après. Re-échoue si une garantie disparaît.
#
# Usage : bash scripts/tests/test-plan-servicedesk-branche.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SKILL="${ROOT}/.claude/skills/plan-servicedesk/SKILL.md"
SUPERPLAN="${ROOT}/.claude/skills/superplan/SKILL.md"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

echo "== Contrat plan-servicedesk : consignation en branche dédiée =="
[ -f "$SKILL" ] || ko "SKILL.md introuvable: $SKILL"

if [ -f "$SKILL" ]; then
  # (1) Ordre B.1 (Demande) AVANT branche AVANT brainstorm.
  grep -qiE 'demande.*avant.*(brainstorm|phase a)|cr[ée]er la demande d.abord|B\.1.*(avant|→).*(branche|brainstorm)' "$SKILL" \
    && ok "ordre inversé documenté : Demande (B.1) avant le brainstorm" \
    || ko "ordre inversé non documenté (B.1 avant A)"

  # La branche doit être créée APRÈS la Demande et AVANT le brainstorm.
  grep -qiE 'avant (le |d.invoquer le |toute invocation de )?(brainstorm|superpowers)' "$SKILL" \
    && ok "création de branche ancrée avant le brainstorm" \
    || ko "création de branche pas ancrée avant le brainstorm"

  # (2) Le skill écrit le fichier de découpage lui-même.
  grep -qE '\-decoupage\.md' "$SKILL" \
    && ok "fichier de découpage dédié (-decoupage.md) documenté" \
    || ko "fichier de découpage dédié absent"

  # (3) Garde-fou git adaptatif : détection d'état + 3 options + STOP.
  grep -qE 'git status --porcelain' "$SKILL" \
    && ok "détection d'état du working tree (git status --porcelain)" \
    || ko "pas de détection d'état du working tree"

  grep -qiE 'plan/D-' "$SKILL" \
    && ok "nom de branche plan/D-xxxx documenté" \
    || ko "nom de branche plan/D-xxxx absent"

  # 3 options quand travail en cours : ranger / consigner sur branche courante / annuler.
  grep -qiE 'ranger' "$SKILL" && grep -qiE 'branche courante' "$SKILL" && grep -qiE 'annuler' "$SKILL" \
    && ok "garde-fou : 3 options (ranger / branche courante / annuler)" \
    || ko "garde-fou : les 3 options ne sont pas toutes documentées"

  grep -qiE 'JAMAIS git worktree add|jamais.*worktree add' "$SKILL" \
    && ok "interdiction git worktree add (règle d'or n°11) rappelée" \
    || ko "interdiction git worktree add non rappelée"

  # (R1) Rollback brainstorm interrompu après B.1 : laisser en l'état + message.
  grep -qiE 'brainstorm interrompu|interrompu.*reprendre|laisser en l.[ée]tat' "$SKILL" \
    && ok "rollback (R1) : brainstorm interrompu → laisser en l'état + message" \
    || ko "rollback (R1) non documenté"

  # Pas de merge automatique sur main.
  grep -qiE 'merge.*(humain|laiss[ée] à l)|jamais.*merge.*automati' "$SKILL" \
    && ok "sortie : PR sans merge automatique (merge humain)" \
    || ko "sortie : merge automatique non exclu"
fi

# (4) Non-régression superplan : alias qui LIT plan-servicedesk, sans git propre.
if [ -f "$SUPERPLAN" ]; then
  grep -qE 'plan-servicedesk/SKILL\.md|skills/plan-servicedesk' "$SUPERPLAN" \
    && ok "superplan lit bien la source plan-servicedesk" \
    || ko "superplan ne référence pas la source plan-servicedesk"

  if grep -qE 'git checkout -b|git commit|git push' "$SUPERPLAN"; then
    ko "superplan réimplémente du git (doit hériter par lecture, pas dupliquer)"
  else
    ok "superplan ne réimplémente PAS le git (hérite par lecture)"
  fi
else
  ko "superplan/SKILL.md introuvable: $SUPERPLAN"
fi

echo ""
P=$(wc -l < "$PASS_FILE" | tr -d ' '); F=$(wc -l < "$FAIL_FILE" | tr -d ' ')
echo "Résultat : ${P} OK, ${F} KO"
[ "$F" -eq 0 ] && { echo "✅ PASS"; exit 0; } || { echo "❌ FAIL"; exit 1; }
