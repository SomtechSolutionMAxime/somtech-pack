#!/usr/bin/env bash
# ============================================================
# test-portes-naissance.sh — v1.0.0
# LES QUATRE PORTES par lesquelles un agent peut naître — toutes couvertes, et
# le compte déclaré (E-20260807-0009, critère 6).
#
# POURQUOI LE COMPTE EST UNE ASSERTION ET PAS UN COMMENTAIRE
# Le motif « une porte sur deux » s'est produit trois fois sur ce dépôt cette
# semaine : on corrige le chemin qu'on avait sous les yeux, l'autre reste ouvert,
# et personne n'en parle. Avant ce lot, UNE SEULE des quatre portes fournissait
# les jetons — et ce n'était pas celle qu'emprunte un orchestrateur pour ouvrir
# un chef d'équipe. Si quelqu'un ajoute une porte sans la couvrir, le compte
# devient faux et ce test rougit.
#
# CE QU'ON MESURE ICI, ET CE QU'ON NE MESURE PAS
# Ici : la PLOMBERIE — la variable arrive-t-elle jusqu'au processus lancé ? Un
# faux `claude` en tête de PATH écrit ce qu'il a reçu, ce qui est la mesure
# exacte de la question posée. On ne lit aucune configuration : on observe ce que
# l'enfant a réellement dans son environnement.
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

WORK="$(mktemp -d)"; PASS=0; FAIL=0
trap 'rm -rf "$WORK"' EXIT
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

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
                          || ko "reçu '$(recu)'"

echo "== Porte 2 — un orchestrateur ouvre un chef d'équipe =="
# `herdr pane run … && git worktree add … && cd … && claude` : la commande que
# porte /orchestrer-chantier. Elle ne passe JAMAIS par le lanceur — c'est
# exactement la porte qui a cassé le 2026-08-07.
: > "$WITNESS"
( PATH="${FAKEBIN}:${PATH}" bash -c \
    ". \"$RC\"; git -C \"$MAIN\" worktree add -q \"${WORK}/wt2\" -b wt/p2 origin/main && cd \"${WORK}/wt2\" && claude" ) >/dev/null 2>&1
[ "$(recu)" = "$ATTENDU" ] && { ok "le jeton atteint la session"; PORTES_COUVERTES=$((PORTES_COUVERTES+1)); } \
                          || ko "reçu '$(recu)' — c'est la porte qui a produit la panne"

echo "== Porte 3 — \`claude\` lancé directement dans un plan existant =="
: > "$WITNESS"
( PATH="${FAKEBIN}:${PATH}" bash -c ". \"$RC\"; cd \"${WORK}/wt2\" && claude" ) >/dev/null 2>&1
[ "$(recu)" = "$ATTENDU" ] && { ok "le jeton atteint la session"; PORTES_COUVERTES=$((PORTES_COUVERTES+1)); } \
                          || ko "reçu '$(recu)'"

echo "== Porte 4 — reprise \`claude-swt <horodatage>\` DEPUIS un plan de travail =="
# Lancé depuis un plan, le lanceur prend ce plan pour le dépôt principal — donc
# il n'y trouve aucun .env à sourcer. Sans le lieu unique, cette porte est morte.
: > "$WITNESS"
( cd "${WORK}/wt2" && PATH="${FAKEBIN}:${PATH}" bash -c ". \"$RC\"; claude-swt p4 \"${WORK}/wt4\"" ) >/dev/null 2>&1
[ "$(recu)" = "$ATTENDU" ] && { ok "le jeton atteint la session"; PORTES_COUVERTES=$((PORTES_COUVERTES+1)); } \
                          || ko "reçu '$(recu)'"

echo "== Le compte des portes est déclaré =="
if [ "$PORTES_COUVERTES" -eq 4 ]; then
  ok "4 portes de naissance recensées, 4 couvertes"
else
  ko "seulement ${PORTES_COUVERTES} porte(s) sur 4 délivrent le jeton — le correctif est partiel"
fi

echo "== Sans le lieu unique, ces portes SONT mortes (le correctif est bien ce qui les ouvre) =="
RC_NU="${WORK}/rc-nu.sh"
printf 'export SOMTECH_MCP_ENV_FILE="%s/inexistant"\nexport CLAUDE_SWT_NO_AUTOPACK=1\n. "%s"\n' "$WORK" "${INSTALL}/claude-swt.sh" > "$RC_NU"
: > "$WITNESS"
( PATH="${FAKEBIN}:${PATH}" bash -c \
    ". \"$RC_NU\"; unset SOMTECH_DESK_API_KEY; cd \"${WORK}/wt2\" && claude" ) >/dev/null 2>&1
[ "$(recu)" = "__ABSENT__" ] && ok "sans lieu unique, la porte 3 ne délivre rien (défaut reproduit)" \
                             || ko "le jeton arrive SANS le correctif — ce test ne prouverait rien : '$(recu)'"

echo
echo "Résultat : ${PASS} réussis, ${FAIL} échoués"
[ "$FAIL" -eq 0 ]
