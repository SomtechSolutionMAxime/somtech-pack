#!/usr/bin/env bash
# ============================================================
# test-corpus-reel.sh — v1.0.0
# La garde SUR DONNEES REELLES de classifier.sh — T-20260922-0135.
#
# POURQUOI CE FICHIER EXISTE
# test-classifier.sh prouve le comportement unitaire sur des fixtures
# construites pour l'occasion ; ca ne suffit pas a l'exigence du lot : « les
# DEUX chiffres sont rendus AVEC leur denominateur, sur les 11 applications
# reellement chargees ». Ce fichier rejoue la lib sur une capture REELLE de
# `applications get_applicable_texts` (les 11 applications ServiceDesk qui
# declarent au moins un texte au 2026-09-22, plus un echantillon de 3 sans
# texte declare) et rend les deux chiffres avec leur denominateur.
#
# CORPUS FIGE, PAS D'APPEL RESEAU EN TEST : meme motif que
# scripts/tests/test-merge-closes-stories-corpus.sh dans ce depot — un appel
# MCP en CI serait flaky et le corpus bougerait sous les pieds du test. La
# fixture porte sa date de capture.
#
# Usage : bash .claude/skills/textes-applicables/tests/test-corpus-reel.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB="${TAP_LIB:-${SCRIPT_DIR}/../lib/classifier.sh}"
FIXTURE="${SCRIPT_DIR}/fixtures/corpus-reel-2026-09-22.json"

command -v jq >/dev/null 2>&1 || { echo "⚠️  jq indisponible — corpus saute (skip)"; exit 0; }
[ -f "$FIXTURE" ] || { echo "❌ fixture absente: $FIXTURE"; exit 1; }
[ -f "$LIB" ] || { echo "❌ lib absente: $LIB"; exit 1; }

# shellcheck source=/dev/null
source "$LIB"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

n_cas=$(jq '.cas | length' "$FIXTURE")
ok_declares=0; total_declares=0
ok_vides=0; total_vides=0
total_pointeurs=0
echecs=0

for i in $(seq 0 $((n_cas - 1))); do
  app=$(jq -r ".cas[$i].application" "$FIXTURE")
  etat_attendu=$(jq -r ".cas[$i].attendu_etat" "$FIXTURE")
  count_attendu=$(jq -r ".cas[$i].attendu_count" "$FIXTURE")
  jq -c ".cas[$i].reponse" "$FIXTURE" > "$WORK/rep.json"

  sortie="$(tap_classifie "$WORK/rep.json" 0)"; rc=$?

  case "$etat_attendu" in
    textes-declares)
      total_declares=$((total_declares+1))
      n_rendu=$(printf '%s\n' "$sortie" | grep -c . || true)
      if [ "$rc" -eq 0 ] && [ "$n_rendu" -eq "$count_attendu" ]; then
        ok_declares=$((ok_declares+1))
        total_pointeurs=$((total_pointeurs + n_rendu))
      else
        echecs=$((echecs+1))
        echo "  ❌ ${app} : attendu rc=0 et ${count_attendu} pointeurs, obtenu rc=${rc} et ${n_rendu} pointeurs"
      fi
      ;;
    aucun-declare)
      total_vides=$((total_vides+1))
      if [ "$rc" -eq 1 ] && [ "$sortie" = "aucun texte declare" ]; then
        ok_vides=$((ok_vides+1))
      else
        echecs=$((echecs+1))
        echo "  ❌ ${app} : attendu rc=1 'aucun texte declare', obtenu rc=${rc} '${sortie}'"
      fi
      ;;
    *)
      echecs=$((echecs+1))
      echo "  ❌ ${app} : etat_attendu inconnu dans la fixture: ${etat_attendu}"
      ;;
  esac
done

echo ""
echo "== Les DEUX chiffres, AVEC leur denominateur (corpus reel, capture 2026-09-22) =="
echo "Applications AVEC textes declares, correctement classees ET au bon compte de pointeurs : ${ok_declares}/${total_declares}"
echo "Applications SANS texte declare, correctement classees 'aucun texte declare' (echantillon) : ${ok_vides}/${total_vides}"
echo "Total pointeurs rendus sur les ${total_declares} applications chargees : ${total_pointeurs}"
echo ""
echo "Assertions jouees : $((total_declares + total_vides)) — $((ok_declares + ok_vides)) OK, ${echecs} KO"
[ "$echecs" -eq 0 ]
