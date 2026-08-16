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

# ⚠️ ON BORNE LE LIEU UNIQUE, ET C'EST UNE GARDE EXISTANTE QUI ME L'A APPRIS. `test-mcp-env.sh`
# exige que tout essai de ce dossier désigne son propre `SOMTECH_MCP_ENV_FILE` — sinon un essai
# peut lire le lieu unique RÉEL du poste et un vrai jeton atteindre sa sortie. Le premier jet de
# ce fichier ne le faisait pas et s'est fait refuser : « test(s) sans borne — un vrai jeton peut
# atteindre leur sortie ». La garde avait raison, et c'est exactement ce que ce lot répare
# ailleurs. On la respecte plutôt que de l'assouplir.
export SOMTECH_MCP_ENV_FILE="${WORK}/lieu-unique-factice"
printf 'SOMTECH_DESK_API_KEY=lieu-factice-du-garde-fou\n' > "$SOMTECH_MCP_ENV_FILE"

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

echo "== AUCUN essai du dépôt ne recopie une valeur d'environnement =="
# ⚠️ « UNE PORTE SUR DEUX », ET ELLE A COÛTÉ UNE VRAIE CLÉ. Corriger le seul essai des portes
# laissait `test-mcp-env.sh` avec le MÊME défaut : une revue de fond l'a lancé sur ce poste et
# a exposé une vraie valeur de `SOMCRAFT_MCP_API_KEY` dans sa transcription. La clé a dû être
# régénérée.
#
# On ne garde donc pas UN fichier : on garde LA FAMILLE. Tout essai qui parle des jetons du
# lieu unique est lancé avec une valeur reconnaissable dans l'environnement, et sa sortie ne
# doit la contenir nulle part. Un essai qui naîtra demain avec le même défaut rougira ici.
CIBLES=$(grep -rlE 'SOMTECH_DESK_API_KEY|SOMCRAFT_MCP_API_KEY' "${SCRIPT_DIR}"/*.sh 2>/dev/null \
         | grep -v 'test-portes-ne-divulguent-rien\.sh' || true)
FUITES=""
for essai in $CIBLES; do
  # Le lieu unique reste borné pour CHAQUE essai lancé : on éprouve leur non-divulgation,
  # on ne les laisse pas approcher le vrai lieu du poste pour autant.
  SOMTECH_DESK_API_KEY="$LEURRE" SOMCRAFT_MCP_API_KEY="$LEURRE" \
    SOMTECH_MCP_ENV_FILE="${WORK}/lieu-unique-factice" \
    timeout 300 bash "$essai" > "${WORK}/balayage.txt" 2>&1 || true
  grep -qF "$LEURRE" "${WORK}/balayage.txt" && FUITES="${FUITES} $(basename "$essai")"
done
if [ -n "$FUITES" ]; then
  ko "ces essais recopient ce que porte l'environnement :${FUITES}"
else
  ok "aucun essai de la famille ne recopie une valeur d'environnement ($(echo "$CIBLES" | wc -w | tr -d ' ') éprouvés)"
fi

echo "== Et ce balayage SAIT reconnaître une fuite — sinon il rassurerait sans rien voir =="
# ⚠️ CE CAS EXISTE PARCE QUE LE BALAYAGE CI-DESSUS NE PROUVE QUE L'ÉTAT ACTUEL. Un balayage qui
# ne trouve rien peut être un balayage qui ne sait rien trouver : les deux se ressemblent
# exactement, et c'est le motif que ce dépôt paie le plus cher.
#
# J'ai tenté de le prouver en remettant le défaut dans un essai réel — sans y parvenir : la
# fuite y demande une combinaison précise que je n'ai pas su reproduire. Je le dis plutôt que
# de l'affirmer. Ce qu'on éprouve ici est donc le DÉTECTEUR : un essai fabriqué qui recopie
# franchement son environnement doit être vu. Si le détecteur est aveugle, le balayage entier
# ne vaut rien, quel que soit son verdict.
ESSAI_FUYANT="${WORK}/essai-qui-fuit.sh"
printf '#!/usr/bin/env bash\necho "obtenu ${SOMTECH_DESK_API_KEY:-rien}"\n' > "$ESSAI_FUYANT"
SOMTECH_DESK_API_KEY="$LEURRE" bash "$ESSAI_FUYANT" > "${WORK}/fuite.txt" 2>&1 || true
if grep -qF "$LEURRE" "${WORK}/fuite.txt"; then
  ok "un essai qui recopie son environnement est bien détecté"
else
  ko "le balayage ne reconnaît PAS une fuite franche — son verdict ne vaut rien"
fi

echo
echo "Résultat : ${PASS} réussis, ${FAIL} échoués"
[ "$FAIL" -eq 0 ]
