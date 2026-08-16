#!/usr/bin/env bash
# ============================================================
# test-portes-ne-divulguent-rien.sh — v1.0.0
# UN ESSAI QUI AFFICHE UN SECRET EST UNE FUITE, PAS UN ESSAI (T-20260816-0046).
#
# CE QUE CE FICHIER GARDE, ET POURQUOI IL EXISTE SÉPARÉMENT
#
# `test-portes-naissance.sh` monte un faux `claude` qui écrit dans un témoin ce qu'il a reçu
# dans son environnement. Tant que ce témoin porte la valeur factice du harnais, l'afficher est
# sans conséquence. Mais quand une AUTRE valeur y arrive — ce qui est exactement le cas mesuré
# le 2026-08-16, où le shell du poste portait la vraie clé — l'ancien message la recopiait
# telle quelle dans sa sortie : `ko "reçu '<la vraie clé>'"`.
#
# La sortie brute de ce poste a porté la vraie valeur TROIS FOIS avant d'être effacée. Un
# terminal, un journal de CI, un rapport collé dans un ticket : tout ce qui lit la sortie d'un
# essai devient alors un endroit où le secret existe.
#
# ⚠️ ON NE GARDE PAS ÇA PAR UNE RELECTURE. Un message d'échec se réécrit un jour, et personne
# ne se souviendra que celui-ci ne devait rien recopier. On l'éprouve donc par le FAIT : on
# place dans l'environnement une valeur reconnaissable — factice, mais qui joue le rôle du
# secret — et on exige qu'elle n'apparaisse NULLE PART dans la sortie.
#
# Usage : bash scripts/tests/test-portes-ne-divulguent-rien.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIBLE="${SCRIPT_DIR}/test-portes-naissance.sh"
PASS=0; FAIL=0
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
SORTIE="${WORK}/sortie.txt"

# Une valeur qui ne peut appartenir à personne, et qu'on reconnaît sans ambiguïté. Elle joue le
# rôle qu'un vrai secret tiendrait : si l'essai la recopie, il recopierait aussi un vrai jeton.
LEURRE="valeur-temoin-qui-ne-doit-jamais-sortir-9f3c1a7e"

echo "== L'essai des portes ne recopie JAMAIS une valeur INATTENDUE =="
# ⚠️ CE CAS A DÛ ÊTRE RÉÉCRIT, ET LE PREMIER JET EST LA LEÇON. Il posait simplement le leurre
# dans l'environnement — mais depuis que l'isolation existe, cette valeur n'atteint JAMAIS le
# témoin : le cas restait vert même en remettant l'affichage fautif. Il prouvait l'isolation
# en croyant prouver la non-divulgation. Le motif de la nuit, appliqué à son propre gardien.
#
# On fait donc DÉLIVRER le leurre par la porte elle-même, via le point d'injection que le
# harnais prévoit pour ses mutations : le témoin reçoit alors une valeur qui n'est pas celle
# attendue, ce qui est exactement la situation où l'ancien message la recopiait.
LIB_LEURRE="${WORK}/mcp-env-leurre.sh"
printf 'export SOMTECH_DESK_API_KEY="%s"\n' "$LEURRE" > "$LIB_LEURRE"
MCP_ENV_SRC_OVERRIDE="$LIB_LEURRE" bash "$CIBLE" > "$SORTIE" 2>&1

if grep -qF "$LEURRE" "$SORTIE"; then
  ko "la valeur reçue se retrouve dans la sortie — c'est une fuite, pas un essai"
else
  ok "une valeur inattendue est qualifiée, jamais recopiée"
fi

echo "== Et l'environnement de l'appelant ne fuit pas non plus =="
SOMTECH_DESK_API_KEY="$LEURRE" bash "$CIBLE" > "${SORTIE}.env" 2>&1
if grep -qF "$LEURRE" "${SORTIE}.env"; then
  ko "ce que portait l'environnement apparaît dans la sortie"
else
  ok "rien de ce que portait l'environnement n'apparaît dans la sortie"
fi

echo "== Et l'isolation tient : les huit vérifications passent malgré cette valeur =="
# ⚠️ LA MOITIÉ QUI PROUVE. Se taire suffirait à passer le cas précédent — il suffirait que
# l'essai n'affiche plus rien du tout. Ce qu'on veut est qu'il rende un VERDICT JUSTE tout en
# se taisant : les portes délivrent, et le poste de celui qui lance n'y change rien.
# ⚠️ On lit la sortie de l'"'"'appel où le lieu unique est NORMAL — l'"'"'autre fait volontairement
# délivrer une valeur différente, donc son verdict ne peut pas être 8/8 par construction.
if grep -qE '^Résultat : 8 réussis, 0 échoués' "${SORTIE}.env"; then
  ok "8 réussis, 0 échoués — le verdict porte sur les portes, pas sur la machine"
else
  ko "le verdict a changé selon l'environnement de l'appelant : $(grep -E '^Résultat' "${SORTIE}.env" || echo 'aucun résultat rendu')"
fi

echo "== Le message d'échec qualifie sans recopier =="
# On force un échec : un faux `claude` qui n'écrit rien. Le message doit dire ce qui s'est
# passé — pas montrer ce qu'il a lu.
FAUX="${WORK}/bin"; mkdir -p "$FAUX"
printf '#!/usr/bin/env bash\nexit 0\n' > "${FAUX}/claude"; chmod +x "${FAUX}/claude"
PATH="${FAUX}:${PATH}" SOMTECH_DESK_API_KEY="$LEURRE" bash "$CIBLE" > "${SORTIE}.ko" 2>&1 || true
if grep -qF "$LEURRE" "${SORTIE}.ko"; then
  ko "en ÉCHEC, la valeur sort quand même — c'est là que le risque est le plus grand"
else
  ok "même en échec, aucune valeur n'est recopiée"
fi

echo
echo "Résultat : ${PASS} réussis, ${FAIL} échoués"
[ "$FAIL" -eq 0 ]
