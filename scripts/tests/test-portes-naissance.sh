#!/usr/bin/env bash
# ============================================================
# test-portes-naissance.sh — v1.0.0
# LES CINQ PORTES par lesquelles un agent peut naître — toutes couvertes, et
# le compte déclaré (E-20260807-0009, critère 6).
#
# POURQUOI LE COMPTE EST UNE ASSERTION ET PAS UN COMMENTAIRE
# Le motif « une porte sur deux » s'est produit trois fois sur ce dépôt cette
# semaine : on corrige le chemin qu'on avait sous les yeux, l'autre reste ouvert,
# et personne n'en parle. Avant ce lot, UNE SEULE des quatre portes fournissait
# les jetons — et ce n'était pas celle qu'emprunte un orchestrateur pour ouvrir
# un chef d'équipe. Si quelqu'un ajoute une porte sans la couvrir, le compte
# devient faux et ce test rougit. La cinquième — la naissance d'un représentant
# client — a justement été trouvée par la revue de fond, pas par nous.
#
# CE QU'ON MESURE ICI, ET CE QU'ON NE MESURE PAS
# Ici : la PLOMBERIE — la variable arrive-t-elle jusqu'au processus lancé ? Un
# faux `claude` en tête de PATH écrit ce qu'il a reçu, ce qui est la mesure
# exacte de la question posée. On ne lit aucune configuration : on observe ce que
# l'enfant a réellement dans son environnement. Et on vérifie AUSSI que le shell
# appelant, lui, n'en garde rien.
# Pas ici : la réponse du VRAI service. Elle est prouvée séparément, sur un vrai
# plan de travail et une vraie session, par test-naissance-registre-reel.sh —
# parce qu'un double serait plus indulgent que le vrai registre.
#
# Usage : bash scripts/tests/test-portes-naissance.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
# Injectables pour la campagne de mutation (test-mutations-registre.sh).
SWT="${SWT_SRC_OVERRIDE:-${SCRIPTS_DIR}/shell/claude-swt.sh}"
LIB="${MCP_ENV_SRC_OVERRIDE:-${SCRIPTS_DIR}/shell/mcp-env.sh}"

# ============================================================
# ⚠️ DEUX DÉFAUTS DE CE HARNAIS, CORRIGÉS LE 2026-08-16 (T-20260816-0046)
#
# 1. IL N'ISOLAIT PAS SON ENVIRONNEMENT, DONC IL MESURAIT LE POSTE.
#    Les sous-shells héritaient de `SOMTECH_DESK_API_KEY` du shell appelant. Le faux `claude`
#    recevait donc la VRAIE valeur du poste au lieu de celle que les portes délivrent, et cinq
#    des huit vérifications échouaient — y compris « le jeton persiste dans le shell », qui
#    constatait simplement qu'il y était AVANT.
#
#    MESURÉ : 3 réussis / 5 échoués tel quel ; **8 / 0** avec la seule variable retirée de
#    l'environnement parent. **Les portes n'avaient rien.** C'est le harnais qui rendait un
#    verdict sur la machine de celui qui le lançait.
#
#    C'est le motif nommé cette nuit : *un double d'essai qui ne peut pas reproduire la
#    condition ne prouve rien de ce qu'il annonce.* Ici il ne CONTRÔLAIT pas la condition qu'il
#    prétendait mesurer — donc son verdict portait sur autre chose que sur le code.
#
# 2. IL IMPRIMAIT LA VALEUR REÇUE — et sur un poste garni, cette valeur est un SECRET VIVANT.
#    `ko "$(qualifier "$(recu)")"` recopiait le contenu du témoin dans la sortie ; sur ce poste, la
#    sortie brute portait la vraie clé trois fois. Un essai qui affiche un secret l'expose à
#    tout ce qui lit sa sortie — terminal, journal de CI, rapport collé dans un ticket.
#    **Ce défaut-là est le premier : il transforme un essai en fuite.**
# ============================================================

# ⚠️ L'ISOLATION D'ABORD, AVANT TOUT LE RESTE. On retire la variable de NOTRE environnement :
# tous les sous-shells en héritent, donc c'est ici, une fois, que la condition se contrôle.
# Sans ça, ce script mesure le poste et non les portes.
unset SOMTECH_DESK_API_KEY

WORK="$(mktemp -d)"; PASS=0; FAIL=0
trap 'rm -rf "$WORK"' EXIT
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

# ⚠️ CE QUE LE TÉMOIN CONTIENT NE SORT JAMAIS. On qualifie, on ne recopie pas : la valeur
# attendue est factice, mais une valeur INATTENDUE peut être un secret vivant — c'est
# précisément ce qui est arrivé. Un verdict doit dire ce qui s'est passé, pas ce qu'il a lu.
qualifier() {
  case "$1" in
    "$ATTENDU")   printf 'la valeur attendue' ;;
    __ABSENT__)   printf 'rien — la variable n’est pas arrivée' ;;
    __RIEN__|'')  printf 'aucun témoin écrit — le faux « claude » n’a pas été lancé' ;;
    *)            printf 'une AUTRE valeur, non affichée : elle peut être un secret vivant' ;;
  esac
}

ATTENDU="jeton-factice-porte-de-naissance-0005"
PORTES_COUVERTES=0

# --- faux `claude` : écrit dans un témoin ce qu'il a reçu dans son environnement.
FAKEBIN="${WORK}/bin"; mkdir -p "$FAKEBIN"
WITNESS="${WORK}/witness"
cat > "${FAKEBIN}/claude" <<EOF
#!/usr/bin/env bash
printf '%s' "\${SOMTECH_DESK_API_KEY:-__ABSENT__}" > "${WITNESS}"
exit 0
EOF
chmod +x "${FAKEBIN}/claude"

# --- lieu unique du poste, garni.
ENVF="${WORK}/mcp-env"
printf 'SOMTECH_DESK_API_KEY=%s\n' "$ATTENDU" > "$ENVF"; chmod 600 "$ENVF"

# --- un vrai dépôt avec origin bare (claude-swt fait fetch + worktree add origin/main).
MAIN="${WORK}/depot"; ORIGIN="${MAIN}.origin.git"
git init -q --bare "$ORIGIN"
git init -q "$MAIN"
git -C "$MAIN" config user.email t@t.io
git -C "$MAIN" config user.name t
git -C "$MAIN" config commit.gpgsign false
printf '# seed\n' > "${MAIN}/README.md"
git -C "$MAIN" add -A && git -C "$MAIN" commit -qm seed
git -C "$MAIN" branch -M main
git -C "$MAIN" remote add origin "$ORIGIN"
git -C "$MAIN" push -q origin main

# Le dépôt n'a AUCUN .env : c'est la situation d'un plan de travail, et c'est ce
# qui rendait trois portes sur quatre inopérantes. Si on en posait un ici, le
# test se mentirait à lui-même.
[ -f "${MAIN}/.env" ] && { echo "⛔ harnais invalide : le dépôt de test porte un .env"; exit 1; }

# On reproduit la DISPOSITION RÉELLE de l'installation (~/.somtech) : claude-swt.sh
# et ses libs côte à côte, car claude-swt.sh source mcp-env.sh depuis SON PROPRE
# dossier. Sourcer le fichier du dépôt directement ferait charger la vraie lib même
# quand on en injecte une autre — et la campagne de mutation ne mordrait plus.
INSTALL="${WORK}/somtech"; mkdir -p "$INSTALL"
cp "$SWT" "${INSTALL}/claude-swt.sh"
cp "$LIB" "${INSTALL}/mcp-env.sh"
for lib in swt-db.sh pack-freshness.sh; do
  [ -f "${SCRIPTS_DIR}/shell/${lib}" ] && cp "${SCRIPTS_DIR}/shell/${lib}" "${INSTALL}/${lib}"
done

# rc du shell tel que l'installeur le pose : il source claude-swt.sh, qui source
# mcp-env.sh, qui exporte les jetons. C'est ce chaînage qu'on met à l'épreuve.
RC="${WORK}/rc.sh"
cat > "$RC" <<EOF
export SOMTECH_MCP_ENV_FILE="${ENVF}"
export CLAUDE_SWT_NO_AUTOPACK=1
. "${INSTALL}/claude-swt.sh"
EOF

recu() { cat "$WITNESS" 2>/dev/null || printf '__RIEN__'; }

echo "== Porte 1 — \`claude-swt\` depuis le dépôt principal =="
: > "$WITNESS"
( cd "$MAIN" && PATH="${FAKEBIN}:${PATH}" bash -c ". \"$RC\"; claude-swt p1 \"${WORK}/wt1\"" ) >/dev/null 2>&1
[ "$(recu)" = "$ATTENDU" ] && { ok "le jeton atteint la session"; PORTES_COUVERTES=$((PORTES_COUVERTES+1)); } \
                          || ko "$(qualifier "$(recu)")"

echo "== Porte 2 — un orchestrateur ouvre un chef d'équipe =="
# `herdr pane run … && git worktree add … && cd … && claude` : la commande que
# porte /orchestrer-chantier. Elle ne passe JAMAIS par le lanceur — c'est
# exactement la porte qui a cassé le 2026-08-07.
: > "$WITNESS"
( PATH="${FAKEBIN}:${PATH}" bash -c \
    ". \"$RC\"; git -C \"$MAIN\" worktree add -q \"${WORK}/wt2\" -b wt/p2 origin/main && cd \"${WORK}/wt2\" && claude" ) >/dev/null 2>&1
[ "$(recu)" = "$ATTENDU" ] && { ok "le jeton atteint la session"; PORTES_COUVERTES=$((PORTES_COUVERTES+1)); } \
                          || ko "$(qualifier "$(recu)") — c'est la porte qui a produit la panne"

echo "== Porte 3 — \`claude\` lancé directement dans un plan existant =="
: > "$WITNESS"
( PATH="${FAKEBIN}:${PATH}" bash -c ". \"$RC\"; cd \"${WORK}/wt2\" && claude" ) >/dev/null 2>&1
[ "$(recu)" = "$ATTENDU" ] && { ok "le jeton atteint la session"; PORTES_COUVERTES=$((PORTES_COUVERTES+1)); } \
                          || ko "$(qualifier "$(recu)")"

echo "== Porte 4 — reprise \`claude-swt <horodatage>\` DEPUIS un plan de travail =="
# Lancé depuis un plan, le lanceur prend ce plan pour le dépôt principal — donc
# il n'y trouve aucun .env à sourcer. Sans le lieu unique, cette porte est morte.
: > "$WITNESS"
( cd "${WORK}/wt2" && PATH="${FAKEBIN}:${PATH}" bash -c ". \"$RC\"; claude-swt p4 \"${WORK}/wt4\"" ) >/dev/null 2>&1
[ "$(recu)" = "$ATTENDU" ] && { ok "le jeton atteint la session"; PORTES_COUVERTES=$((PORTES_COUVERTES+1)); } \
                          || ko "$(qualifier "$(recu)")"

echo "== Porte 5 — naissance d'un représentant client =="
# `herdr pane run <pane> "cd <lieu> && claude"` — la forme exacte que produit
# naissance-representant/src/naissance.js. Le lieu du représentant porte son
# propre .mcp.json qui référence ${SOMTECH_DESK_API_KEY} : sans jeton, le
# représentant naît muet lui aussi. Porte trouvée par la revue de fond.
LIEU="${WORK}/lieu-representant"; mkdir -p "$LIEU"
: > "$WITNESS"
( PATH="${FAKEBIN}:${PATH}" bash -c ". \"$RC\"; cd ${LIEU} && claude" ) >/dev/null 2>&1
[ "$(recu)" = "$ATTENDU" ] && { ok "le jeton atteint la session"; PORTES_COUVERTES=$((PORTES_COUVERTES+1)); } \
                          || ko "$(qualifier "$(recu)")"

echo "== Le compte des portes est déclaré =="
if [ "$PORTES_COUVERTES" -eq 5 ]; then
  ok "5 portes de naissance recensées, 5 couvertes"
else
  ko "seulement ${PORTES_COUVERTES} porte(s) sur 5 délivrent le jeton — le correctif est partiel"
fi

echo "== Aucune porte ne laisse le jeton dans le shell appelant =="
# L'enveloppe borne l'exposition au seul processus \`claude\`. Si un jour quelqu'un
# la remplaçait par un export global, ce cas rougirait — et c'est bien ce qu'on veut.
RESTE=$( PATH="${FAKEBIN}:${PATH}" bash -c \
  ". \"$RC\"; cd \"${WORK}/wt2\" && claude >/dev/null 2>&1; env | grep -c '^SOMTECH_DESK_API_KEY=' || true" )
[ "$RESTE" = "0" ] && ok "le shell qui a fait naître l'agent ne porte aucun jeton" \
                   || ko "le jeton persiste dans le shell — exposé à tout ce qui tourne ensuite dans ce terminal"

echo "== Sans le lieu unique, ces portes SONT mortes (le correctif est bien ce qui les ouvre) =="
RC_NU="${WORK}/rc-nu.sh"
printf 'export SOMTECH_MCP_ENV_FILE="%s/inexistant"\nexport CLAUDE_SWT_NO_AUTOPACK=1\n. "%s"\n' "$WORK" "${INSTALL}/claude-swt.sh" > "$RC_NU"
: > "$WITNESS"
( PATH="${FAKEBIN}:${PATH}" bash -c \
    ". \"$RC_NU\"; unset SOMTECH_DESK_API_KEY; cd \"${WORK}/wt2\" && claude" ) >/dev/null 2>&1
[ "$(recu)" = "__ABSENT__" ] && ok "sans lieu unique, la porte 3 ne délivre rien (défaut reproduit)" \
                             || ko "le jeton arrive SANS le correctif — ce test ne prouverait rien : $(qualifier "$(recu)")"

echo
echo "Résultat : ${PASS} réussis, ${FAIL} échoués"
[ "$FAIL" -eq 0 ]
