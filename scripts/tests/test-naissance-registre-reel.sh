#!/usr/bin/env bash
# ============================================================
# test-naissance-registre-reel.sh — v1.0.0
# LA preuve du lot E-20260807-0009 : un plan de travail RÉELLEMENT créé, une
# session RÉELLEMENT ouverte dedans, un appel au registre RÉELLEMENT passé
# depuis elle.
#
# POURQUOI CE TEST EXISTE ALORS QUE LES AUTRES SONT VERTS
# Vérifier une configuration ne prouve rien — c'est exactement l'erreur qui a
# produit ce défaut. Et `claude mcp list` ne prouve rien non plus : il rapporte
# une connectivité sans ouvrir de session. Le motif « le double est plus
# indulgent que le vrai service » s'est produit six fois sur les chantiers
# précédents, dont une fois en laissant passer une fonction inerte en
# production derrière 97 tests verts et deux revues.
#
# Ici : aucun faux binaire, aucun serveur simulé. Le vrai `claude`, le vrai
# registre, un vrai plan de travail créé pour l'occasion et détruit après.
#
# CE QU'IL COUVRE — la porte de naissance qui a effectivement cassé :
#   un shell qui a chargé le pack → `git worktree add` → `cd` → `claude`.
#   C'est la commande que porte /orchestrer-chantier pour ouvrir un chef
#   d'équipe, et elle ne passe jamais par le lanceur claude-swt.
#
# LES DEUX BRAS SONT OBLIGATOIRES : sans le bras négatif, ce test ne prouverait
# pas que c'est le correctif qui fait la différence.
#
# SAUTÉ proprement quand il ne peut pas être honnête : pas de `claude`, ou aucun
# jeton disponible sur la machine (cas de la chaîne d'intégration).
# Forcer le saut : SOMTECH_SKIP_E2E=1
#
# Usage : bash scripts/tests/test-naissance-registre-reel.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LIB="${ROOT}/scripts/shell/mcp-env.sh"

skip() { echo "⏭️  $1 — test sauté (il ne peut pas être honnête ici)."; exit 0; }

[ -n "${SOMTECH_SKIP_E2E:-}" ] && skip "saut demandé (SOMTECH_SKIP_E2E)"
command -v claude >/dev/null 2>&1 || skip "binaire \`claude\` absent"
command -v git    >/dev/null 2>&1 || skip "git absent"

# Le dépôt principal (premier worktree listé), d'où qu'on invoque le test.
MAIN=$(git -C "$ROOT" worktree list --porcelain 2>/dev/null | awk '/^worktree /{print $2; exit}')
[ -n "$MAIN" ] || skip "pas dans un dépôt git"

# Une source de jetons doit exister sur la machine. On n'en imprime jamais la
# valeur — on ne fait que constater qu'il y en a une.
ENVF="${SOMTECH_MCP_ENV_FILE:-$HOME/.somtech/mcp-env}"
SRC_ENV=""
[ -r "$ENVF" ]        && SRC_ENV="$ENVF"
[ -z "$SRC_ENV" ] && [ -r "${MAIN}/.env" ] && SRC_ENV="${MAIN}/.env"
[ -n "$SRC_ENV" ] || skip "aucun lieu unique ni .env sur cette machine"
grep -q '^SOMTECH_DESK_API_KEY=' "$SRC_ENV" || skip "aucun jeton de registre disponible"

PASS=0; FAIL=0
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

STAMP="e2e-registre-$$"
WT="${TMPDIR:-/tmp}/${STAMP}"
BR="probe/${STAMP}"
cleanup() {
  git -C "$MAIN" worktree remove --force "$WT" >/dev/null 2>&1
  git -C "$MAIN" branch -D "$BR" >/dev/null 2>&1
  git -C "$MAIN" worktree prune >/dev/null 2>&1
}
trap cleanup EXIT

echo "== Un plan de travail RÉELLEMENT créé =="
git -C "$MAIN" fetch origin -q 2>/dev/null
BASE=$(git -C "$MAIN" rev-parse --verify -q origin/main || git -C "$MAIN" rev-parse HEAD)
if git -C "$MAIN" worktree add -q "$WT" -b "$BR" "$BASE" 2>/dev/null; then
  ok "plan de travail créé : $(basename "$WT")"
else
  ko "création du plan de travail impossible"; echo; echo "Résultat : ${PASS} réussis, ${FAIL} échoués"; exit 1
fi
[ -f "${WT}/.mcp.json" ] || skip "ce dépôt ne déclare aucun serveur MCP"

# Le plan de travail neuf ne doit PAS porter de .env : c'est toute la raison
# pour laquelle les jetons n'y arrivaient pas. Si celui-ci en avait un, le test
# se mentirait à lui-même.
[ -f "${WT}/.env" ] && ko "le plan de travail porte un .env — la preuve serait faussée" \
                    || ok "le plan de travail neuf n'a aucun .env (comme en vrai)"

# Un appel dont la réponse ne peut venir QUE du registre.
PROMPT="Appelle réellement l'outil mcp__servicedesk__applications avec action=list.
Si l'appel RÉUSSIT, réponds exactement: REGISTRE-OK
Si l'outil est absent, refusé, ou renvoie une erreur, réponds exactement: REGISTRE-KO
Aucune autre phrase, aucun préambule."

# ouvre_session <with-fix|no-fix> — ouvre une VRAIE session dans le plan neuf,
# par la porte qui a cassé : shell → cd → claude.
#
# Les DEUX bras partent d'un environnement d'où les jetons ont été explicitement
# retirés (`env -u`) : sans ça, le bras négatif hériterait de ceux du shell de
# test et « réussirait » sans rien prouver. Le chargement de la lib est alors la
# SEULE différence entre les deux bras — c'est ce qui rend la comparaison valide.
#
# On ne repart pas d'un environnement entièrement nu (`env -i`) : Claude Code y
# perd l'accès à ses propres identifiants et échoue à s'authentifier avant même
# d'avoir vu un serveur MCP. On mesurerait alors un tout autre défaut.
ouvre_session() {
  local mode="$1" charge=""
  [ "$mode" = "with-fix" ] && charge=". \"$LIB\";"
  env -u SOMTECH_DESK_API_KEY -u SOMCRAFT_MCP_API_KEY \
      SOMTECH_MCP_ENV_FILE="$SRC_ENV" PROMPT="$PROMPT" \
      bash -c "${charge} cd \"$WT\" && printf '%s' \"\$PROMPT\" | claude -p --allowedTools mcp__servicedesk" \
      2>&1 | tail -3
}

echo "== Bras négatif — la porte telle qu'elle est aujourd'hui =="
OUT=$(ouvre_session no-fix)
case "$OUT" in
  *REGISTRE-OK*) ko "🚨 le registre répond SANS le correctif — le test ne prouve rien (jeton hérité ?)" ;;
  *) ok "sans le correctif, le registre est injoignable (c'est le défaut, reproduit)" ;;
esac

echo "== Bras positif — la même porte, avec le correctif =="
# Ce bras parle à un service VIVANT, par le réseau. Un incident ponctuel ne doit
# pas faire passer un correctif sain pour cassé — d'où une seconde tentative.
# Elle ne masque rien : un correctif réellement cassé échoue les deux fois. Le
# bras NÉGATIF, lui, n'est jamais rejoué — une réussite y serait un vrai signal.
OUT=$(ouvre_session with-fix)
case "$OUT" in *REGISTRE-OK*) : ;; *) echo "  ↻ seconde tentative (service vivant)"; OUT=$(ouvre_session with-fix) ;; esac
case "$OUT" in
  *REGISTRE-OK*) ok "session réelle dans un plan neuf → appel réel au registre RÉUSSI" ;;
  *) ko "le registre reste injoignable AVEC le correctif : $(printf '%s' "$OUT" | tr '\n' ' ' | cut -c1-160)" ;;
esac

echo "== L'autre serveur du projet répond aussi (pas seulement exposé) =="
# Somcraft est déclaré au SEUL niveau projet, et son jeton vit dans la chaîne de
# requête. C'est le serveur qui disparaissait le plus silencieusement : il se
# connecte sans jeton et n'échoue qu'à l'appel. Être exposé ne suffit donc pas —
# on exige une réponse.
if grep -q '"somcraft"' "${WT}/.mcp.json" 2>/dev/null; then
  PROMPT="Appelle réellement l'outil mcp__somcraft__list_workspaces.
Si l'appel RÉUSSIT, réponds exactement: SOMCRAFT-OK
Si l'outil est absent, refusé, ou renvoie une erreur, réponds exactement: SOMCRAFT-KO
Aucune autre phrase."
  OUT2=$(env -u SOMTECH_DESK_API_KEY -u SOMCRAFT_MCP_API_KEY \
           SOMTECH_MCP_ENV_FILE="$SRC_ENV" PROMPT="$PROMPT" \
           bash -c ". \"$LIB\"; cd \"$WT\" && printf '%s' \"\$PROMPT\" | claude -p --allowedTools mcp__somcraft" 2>&1 | tail -3)
  case "$OUT2" in
    *SOMCRAFT-OK*) ok "l'autre serveur du projet répond réellement" ;;
    *) ko "l'autre serveur ne répond pas : $(printf '%s' "$OUT2" | tr '\n' ' ' | cut -c1-160)" ;;
  esac
else
  echo "  ⏭️  ce dépôt ne déclare pas somcraft — cas sauté"
fi

echo "== Aucun jeton dans la sortie =="
OUT="${OUT}${OUT2:-}"     # les deux sessions sont inspectées, pas seulement la dernière
TOK_PRESENT=0
while IFS= read -r line; do
  case "$line" in SOMTECH_DESK_API_KEY=*|SOMCRAFT_MCP_API_KEY=*)
    val="${line#*=}"; val="${val%\"}"; val="${val#\"}"
    [ ${#val} -ge 12 ] && case "$OUT" in *"$val"*) TOK_PRESENT=1 ;; esac ;;
  esac
done < "$SRC_ENV"
[ "$TOK_PRESENT" = "0" ] && ok "aucune valeur de jeton dans la sortie de la session" \
                         || ko "🚨 une valeur de jeton apparaît dans la sortie"

echo
echo "Résultat : ${PASS} réussis, ${FAIL} échoués"
[ "$FAIL" -eq 0 ]
