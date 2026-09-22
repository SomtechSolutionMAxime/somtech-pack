#!/usr/bin/env bash
# ============================================================
# test-banc-protection-mensuelle-corpus.sh — v1.0.0
# Banc « corpus réel » de `banc-protection-mensuelle.sh` — T-20260922-0106,
# garde 5/5 (dernière) du lot 4, D-20260921-0017.
#
# POURQUOI CE FICHIER EXISTE
# Rejoue le banc sur le corpus RÉEL des règles ADR/STD de Somtech
# (scripts/tests/fixtures/corpus-protection-lot4/corpus-adr-std.json,
# 67 entrées : 41 ADR + 24 STD + 2 entrées invitées — STD-030-MERGE et
# GF-ORC-013, sous-thème/garde-fou sans ligne propre dans l'analyse
# d'origine du 21 sept 2026, Somcraft cb411d97-f40c-4ff6-9c7d-6f4f3713d9b6).
#
# LES DEUX CHIFFRES — sur les 8 entrées `verifie_a_la_main: true` UNIQUEMENT
# (les 59 autres sont classées par le banc mais NE COMPTENT PAS dans ce
# calcul — leur classement n'a jamais été vérifié à la main, voir la note
# de méthode dans le corpus JSON lui-même). Ground truth dérivée du
# corpus : mecanisme_connu -> attendu "protege" ; contredit_par -> attendu
# "contredit".
#
# TÉMOIN POSITIF — dur, doit passer : les 4 gardes du lot 4
# (STD-038, STD-030-MERGE, STD-029, GF-ORC-013) doivent être vues protegees
# par le banc lui-même, en CITANT le mécanisme.
#
# Usage : bash scripts/tests/test-banc-protection-mensuelle-corpus.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LIB="${BPM_LIB:-${ROOT}/.claude/skills/orchestrer-chantier/lib/banc-protection-mensuelle.sh}"
CORPUS="${SCRIPT_DIR}/fixtures/corpus-protection-lot4/corpus-adr-std.json"

[ -f "$LIB" ] || { echo "❌ lib absente: $LIB"; exit 1; }
[ -f "$CORPUS" ] || { echo "❌ corpus absent: $CORPUS"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "⚠️  python3 indisponible — corpus saute (skip)"; exit 0; }

PASS=0; FAIL=0
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

unset BPM_SOURCE_CASSEE BPM_ETAT_PRECEDENT BPM_ETAT_SORTIE
export BPM_CORPUS_JSON="$CORPUS"
export BPM_RACINE_DEPOT="$ROOT"

echo "== Exécution du banc sur le corpus réel =="
OUT="$(bash "$LIB")"
RC=$?
if [ "$RC" -ne 0 ]; then
  echo "❌ ÉCHEC — le banc a rendu rc=${RC} sur un corpus pourtant valide :"
  echo "$OUT"
  exit 1
fi
ok "le banc s'exécute sans erreur sur le corpus réel (rc=0)"

champ() { printf '%s\n' "$OUT" | sed -n "s/^$1=//p"; }

echo
echo "== Témoin positif — les 4 gardes du lot 4 doivent être vues protegees =="
if [ "$(champ TEMOIN_POSITIF)" = "OK" ]; then
  ok "TEMOIN_POSITIF=OK — les 4 gardes du lot 4 tiennent, citées par le banc lui-même"
else
  ko "TEMOIN_POSITIF=$(champ TEMOIN_POSITIF) — $(champ TEMOIN_POSITIF_DETAIL) — CECI EST UN BUG DU BANC, pas un résultat normal"
fi

for wid_key in STD_038 STD_030_MERGE STD_029 GF_ORC_013; do
  classe="$(champ "REGLE_${wid_key}_CLASSE")"
  mecanisme="$(champ "REGLE_${wid_key}_MECANISME")"
  if [ "$classe" = "protege" ] && [ -n "$mecanisme" ]; then
    ok "${wid_key} : protege, mécanisme cité = ${mecanisme}"
  else
    ko "${wid_key} : attendu protege avec mécanisme cité, obtenu classe=${classe} mecanisme='${mecanisme}'"
  fi
done

echo
echo "== Les deux chiffres — sur les entrées vérifiées à la main du corpus =="

# Extrait, via python3, la liste "id attendu" pour les entrées verifie_a_la_main=true.
GROUND_TRUTH="$(python3 - "$CORPUS" <<'PY'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
for e in d["entries"]:
    if not e.get("verifie_a_la_main"):
        continue
    if e.get("mecanisme_connu"):
        attendu = "protege"
    elif e.get("contredit_par"):
        attendu = "contredit"
    else:
        attendu = "non_etabli"
    print(f"{e['id']}\t{attendu}")
PY
)"

M_TOTAL=0
N_CORRECTES=0
N_A_TORT=0

while IFS=$'\t' read -r id attendu; do
  [ -z "$id" ] && continue
  M_TOTAL=$((M_TOTAL+1))
  cle="$(printf '%s' "$id" | sed 's/[^A-Za-z0-9]/_/g' | tr '[:lower:]' '[:upper:]')"
  obtenu="$(champ "REGLE_${cle}_CLASSE")"
  if [ "$obtenu" = "$attendu" ]; then
    N_CORRECTES=$((N_CORRECTES+1))
    ok "${id} : attendu ${attendu}, obtenu ${obtenu} — correct"
  else
    N_A_TORT=$((N_A_TORT+1))
    ko "${id} : attendu ${attendu}, obtenu ${obtenu} — CLASSÉ À TORT"
  fi
done <<< "$GROUND_TRUTH"

N_TOTAL_CORPUS="$(python3 -c "import json; print(len(json.load(open('${CORPUS}'))['entries']))")"
N_NON_AUDITEES=$((N_TOTAL_CORPUS - M_TOTAL))

echo
echo "== Sur ${N_TOTAL_CORPUS} règles du corpus, ${M_TOTAL} vérifiées à la main (les ${N_NON_AUDITEES} autres sont classées mais NON auditées) =="
echo "Classées correctement : ${N_CORRECTES} / ${M_TOTAL}"
echo "Classées À TORT        : ${N_A_TORT} / ${M_TOTAL}"

echo
echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
