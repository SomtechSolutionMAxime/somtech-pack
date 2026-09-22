#!/usr/bin/env bash
# ============================================================
# test-merge-closes-stories-corpus.sh — v1.0.0
# La garde SUR TRAFIC RÉEL de `merge-closes-stories.sh` (T-20260922-0084).
#
# POURQUOI CE FICHIER EXISTE
# G/W/T de T-20260922-0084 : « les DEUX chiffres sont écrits : ferme
# correctement, ET ferme à tort — zéro à tort exige, un `completed` faux
# étant terminal en cascade — sur du trafic réel du dépôt. »
#
# `test-merge-closes-stories.sh` prouve le comportement unitaire sur des
# fixtures synthétiques ; ça ne suffit PAS à l'exigence : il faut du texte
# réel, jamais construit pour l'occasion. Ce fichier rejoue la lib sur les
# 60 dernières PR mergées de CE dépôt (`scripts/tests/fixtures/
# merge-closes-stories-corpus.json`, provenance et date de capture dans le
# fixture lui-même) et compare, PR par PR, à un résultat ATTENDU vérifié à la
# main contre le texte réel (voir le motif écrit en tête de la lib pour le
# détail des cas piégeux : PR #347, #338, #329, #314).
#
# CORPUS FIGÉ, PAS `gh pr list` EN DIRECT : un appel réseau en CI est flaky
# (auth, rate-limit, indisponibilité), et l'historique des PR change — un
# corpus qui bouge sous les pieds du test rendrait le résultat non
# reproductible. Le fixture porte sa date de capture ; le rejouer sur un
# corpus plus large est une amélioration future, pas une exigence de ce lot.
#
# Usage : bash scripts/tests/test-merge-closes-stories-corpus.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LIB="${MFS_LIB:-${ROOT}/.claude/skills/merge/lib/merge-closes-stories.sh}"
FIXTURE="${SCRIPT_DIR}/fixtures/merge-closes-stories-corpus.json"

command -v python3 >/dev/null 2>&1 || { echo "⚠️  python3 indisponible — corpus sauté (skip)"; exit 0; }
[ -f "$FIXTURE" ] || { echo "❌ fixture absente: $FIXTURE"; exit 1; }
[ -f "$LIB" ] || { echo "❌ lib absente: $LIB"; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

PASS=0; FAIL=0
FERME_CORRECTEMENT=0   # IDs attendus ET rendus, exactement — mesure d'exactitude
FERME_A_TORT=0         # IDs rendus mais PAS attendus — le chiffre qui doit rester à 0
ids_absents=0           # IDs attendus mais PAS rendus (sous-détection : jamais fermé à tort, mais compté à part)

ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

# Explose le fixture en un fichier par PR : $WORK/<n>.body et $WORK/<n>.attendu
python3 - "$FIXTURE" "$WORK" <<'PY'
import json, sys, os
fixture, work = sys.argv[1], sys.argv[2]
data = json.load(open(fixture, encoding="utf-8"))
for e in data["prs"]:
    n = e["pr"]
    with open(os.path.join(work, f"{n}.body"), "w", encoding="utf-8") as f:
        f.write(e["body"])
    with open(os.path.join(work, f"{n}.attendu"), "w", encoding="utf-8") as f:
        f.write("\n".join(e["attendu"]) + ("\n" if e["attendu"] else ""))
print(len(data["prs"]))
PY

N_PRS="$(python3 -c "import json; print(len(json.load(open('${FIXTURE}'))['prs']))")"
echo "== Corpus : ${N_PRS} PR mergées réelles (somtech-pack, #306 à #369) =="

for f in "${WORK}"/*.body; do
  n="$(basename "$f" .body)"
  attendu_file="${WORK}/${n}.attendu"

  rendu="$(bash -c "source '$LIB'; mfs_tickets_du_corps '$f'" 2>/dev/null)"
  rc=$?
  attendu="$(cat "$attendu_file")"

  if [ -z "$attendu" ]; then
    # Ce PR doit s'ABSTENIR (aucune ligne étiquetée exploitable) — rc doit être
    # 1 (INDETERMINE) et rien sur stdout. Un rc=0 ici serait une invention.
    if [ "$rc" -eq 1 ] && [ -z "$rendu" ]; then
      ok "PR #${n} — abstention attendue, INDETERMINE (rc=1) confirmé"
    else
      ko "PR #${n} — devait s'ABSTENIR, a rendu rc=${rc} : ${rendu:-<vide>}"
      FERME_A_TORT=$((FERME_A_TORT + $(printf '%s\n' "$rendu" | grep -c '^T-' || true)))
    fi
    continue
  fi

  if [ "$rendu" = "$attendu" ]; then
    ok "PR #${n} — $(printf '%s' "$attendu" | grep -c '^T-') ticket(s) déterminé(s) exactement"
    FERME_CORRECTEMENT=$((FERME_CORRECTEMENT + $(printf '%s\n' "$attendu" | grep -c '^T-')))
  else
    ko "PR #${n} — attendu [$(tr '\n' ',' < "$attendu_file")] rendu [$(printf '%s' "$rendu" | tr '\n' ',')]"
    # Compte précis de l'écart, pour que les deux chiffres restent honnêtes
    # même sur un désaccord partiel (pas tout-ou-rien).
    while IFS= read -r id; do
      [ -z "$id" ] && continue
      if ! grep -qxF "$id" "$attendu_file"; then
        FERME_A_TORT=$((FERME_A_TORT + 1))
      fi
    done <<< "$rendu"
    while IFS= read -r id; do
      [ -z "$id" ] && continue
      if ! printf '%s\n' "$rendu" | grep -qxF "$id"; then
        ids_absents=$((ids_absents + 1))
      fi
    done < "$attendu_file"
  fi
done

echo
echo "== Les deux chiffres, sur ${N_PRS} PR mergées réelles =="
echo "   Ferme CORRECTEMENT : ${FERME_CORRECTEMENT} ticket(s)"
echo "   Ferme À TORT        : ${FERME_A_TORT} ticket(s)   ← doit être 0"
echo "   Non détectés (sous-fermeture, jamais à tort) : ${ids_absents}"
echo
echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"

if [ "$FERME_A_TORT" -ne 0 ]; then
  echo "❌ ÉCHEC — au moins une fermeture À TORT sur trafic réel. Voir ci-dessus."
  exit 1
fi
if [ "$FAIL" -ne 0 ]; then
  echo "❌ ÉCHEC — désaccord(s) avec le corpus vérifié (voir KO ci-dessus)."
  exit 1
fi

echo "✅ Corpus réel : 0 fermeture à tort sur ${N_PRS} PR (${FERME_CORRECTEMENT} tickets fermés correctement)."
exit 0
