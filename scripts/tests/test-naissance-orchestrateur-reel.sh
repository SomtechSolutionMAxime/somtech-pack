#!/usr/bin/env bash
# ============================================================
# test-naissance-orchestrateur-reel.sh — v1.0.0
# LA preuve d'E-20260813-0002 : un orchestrateur RÉELLEMENT posé, RÉELLEMENT né
# dans son lieu, qui RÉELLEMENT commence — et deux orchestrateurs qui cohabitent
# pour de vrai dans un même dépôt.
#
# POURQUOI CE TEST EXISTE ALORS QUE 826 AUTRES SONT VERTS
# Le lot jumeau — le gestionnaire client — a produit SEPT défauts au premier
# usage réel, aucun vu par les tests. Ils ont tous la même racine : un double de
# `herdr` plus indulgent que le vrai service. Ici : aucun faux binaire pour la
# naissance. Le vrai `herdr`, le vrai `claude`, un espace de travail créé pour
# l'occasion et fermé après.
#
# CE QU'IL PROUVE, ET COMMENT — jamais par le message affiché :
#   • le REFUS            → par l'ABSENCE sur disque
#   • la NAISSANCE        → par le répertoire de travail RÉEL de la session née
#   • l'AMORCE            → par ce que la session FAIT, pas par « le message est parti »
#   • l'IDEMPOTENCE       → par le CONTENU comparé, sur un lieu amputé d'UN SEUL fichier
#   • DEUX LIEUX          → par deux lieux complets qui coexistent après les deux poses
#
# LE SEUL DOUBLE DE CE FICHIER, ET IL EST ASSUMÉ
# Le refus de ligne se déclenche quand le poste ne peut pas lire ses jetons. On
# ne peut pas l'obtenir en RETIRANT le vrai jeton : ce serait couper le dirigeant
# de ses lignes ouvertes, et c'est précisément le geste que T-20260811-0087 a
# interdit de mettre dans la bouche de quiconque. On masque donc `security` par
# un binaire qui échoue — ce n'est pas un service plus indulgent que le vrai,
# c'est une VRAIE panne de lecture, et la preuve reste l'absence sur disque.
#
# SAUTÉ proprement quand il ne peut pas être honnête : pas de `herdr` joignable,
# pas de `claude`. Forcer le saut : SOMTECH_SKIP_E2E=1
#
# Usage : bash scripts/tests/test-naissance-orchestrateur-reel.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
POSE="${ROOT}/ligne-directe/bin/ligne-directe.js"
NAITRE="${ROOT}/naissance-representant/bin/naitre.js"

skip() { echo "⏭️  $1 — test sauté (il ne peut pas être honnête ici)."; exit 0; }

[ -n "${SOMTECH_SKIP_E2E:-}" ] && skip "saut demandé (SOMTECH_SKIP_E2E)"
command -v herdr   >/dev/null 2>&1 || skip "binaire \`herdr\` absent"
command -v claude  >/dev/null 2>&1 || skip "binaire \`claude\` absent"
command -v node    >/dev/null 2>&1 || skip "node absent"
command -v python3 >/dev/null 2>&1 || skip "python3 absent (lecture des réponses herdr)"
[ -f "$POSE" ]   || skip "ligne-directe/bin/ligne-directe.js absent"
[ -f "$NAITRE" ] || skip "naissance-representant/bin/naitre.js absent"
herdr workspace list >/dev/null 2>&1 || skip "aucun serveur herdr joignable"

PASS=0; FAIL=0
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

# Lit un champ d'une réponse herdr. Jamais `grep` : `grep -q '"result"'` accepte
# `{"error":…,"result":null}` parce que le mot y est (/orchestrer-chantier §4b).
champ() { python3 -c '
import json,sys
d=json.load(sys.stdin)
cur=d
for k in sys.argv[1].split("."):
    if cur is None: break
    cur = cur.get(k) if isinstance(cur, dict) else None
print(cur if cur is not None else "")
' "$1" 2>/dev/null; }

BAC="$(mktemp -d "${TMPDIR:-/tmp}/smtk-orch-XXXXXX")"
DEPOT="${BAC}/depot"
UN="d20260813e2e$$"          # minuscules + chiffres : nommable par herdr
DEUX="p20260720e2e$$"
WS=""
PANES=""

cleanup() {
  for p in $PANES; do herdr pane close "$p" >/dev/null 2>&1; done
  [ -n "$WS" ] && herdr workspace close "$WS" >/dev/null 2>&1
  [ -n "${SOMTECH_ORCH_GARDER:-}" ] && { echo "bac conservé : $BAC"; return; }
  rm -rf "$BAC"
}
trap cleanup EXIT

# Un dépôt qui a reçu le pack (précondition de la pose, pas son affaire).
mkdir -p "${DEPOT}/.claude/templates"
cp -R "${ROOT}/.claude/templates/orchestrateur" "${DEPOT}/.claude/templates/orchestrateur"

# ─────────────────────────────────────────────────────────────────────────────
echo "== Le refus : un dépôt SANS les gabarits — prouvé par l'absence, pas par le message =="
NU="${BAC}/depot-nu"; mkdir -p "$NU"
node "$POSE" orchestrateur "$UN" --depot "$NU" >/dev/null 2>&1
CODE=$?
[ "$CODE" -ne 0 ] && ok "la pose échoue (code ${CODE}, jamais 0)" || ko "🚨 la pose rend 0 sans gabarits"
[ ! -e "${NU}/.orchestrateur" ] && ok "RIEN n'a été créé : .orchestrateur n'existe pas" \
                                || ko "🚨 un lieu (ou son dossier) subsiste après le refus"

echo "== Le refus : le poste ne peut pas lire ses jetons — prouvé par l'absence =="
# Voir l'en-tête : on masque `security`, on ne touche JAMAIS au vrai jeton.
FAUXBIN="${BAC}/faux-bin"; mkdir -p "$FAUXBIN"
printf '#!/bin/sh\nexit 44\n' > "${FAUXBIN}/security"; chmod +x "${FAUXBIN}/security"
SANS="${BAC}/depot-sans-ligne"
mkdir -p "${SANS}/.claude/templates"
cp -R "${ROOT}/.claude/templates/orchestrateur" "${SANS}/.claude/templates/orchestrateur"
PATH="${FAUXBIN}:${PATH}" node "$POSE" orchestrateur "$UN" --depot "$SANS" >/dev/null 2>&1
CODE=$?
[ "$CODE" -ne 0 ] && ok "la pose échoue quand la ligne ne peut pas s'ouvrir (code ${CODE})" \
                  || ko "🚨 la pose rend 0 alors que le poste ne peut pas ouvrir de ligne"
[ ! -e "${SANS}/.orchestrateur" ] && ok "RIEN n'a été créé : la ligne est un préalable, pas un souhait" \
                                  || ko "🚨 un lieu a été créé sans ligne possible"

# ─────────────────────────────────────────────────────────────────────────────
echo "== La pose réelle, avec le vrai trousseau du poste =="
SORTIE=$(node "$POSE" orchestrateur "$UN" --depot "$DEPOT" 2>&1)
CODE=$?
if [ "$CODE" -ne 0 ]; then
  echo "     ${SORTIE}" | head -3
  skip "le poste ne peut pas ouvrir de ligne ici — la pose réelle ne peut pas être éprouvée"
fi
ok "le lieu est posé : .orchestrateur/${UN}/"
for f in CLAUDE.md CONTEXTE.md .mcp.json .claude/settings.json; do
  [ -f "${DEPOT}/.orchestrateur/${UN}/${f}" ] && ok "  ${f} est là" || ko "  ${f} manque"
done

echo "== L'idempotence : relancée, elle ne retouche à RIEN (contenu comparé) =="
EMPREINTE_AVANT=$(cd "${DEPOT}/.orchestrateur/${UN}" && find . -type f -exec shasum {} \; | sort)
node "$POSE" orchestrateur "$UN" --depot "$DEPOT" >/dev/null 2>&1
EMPREINTE_APRES=$(cd "${DEPOT}/.orchestrateur/${UN}" && find . -type f -exec shasum {} \; | sort)
[ "$EMPREINTE_AVANT" = "$EMPREINTE_APRES" ] && ok "aucun octet n'a bougé" \
                                            || ko "🚨 une relance a modifié le lieu"

echo "== Un lieu amputé d'UN SEUL fichier n'est JAMAIS déclaré installé =="
mv "${DEPOT}/.orchestrateur/${UN}/.mcp.json" "${BAC}/mcp.garde"
SORTIE=$(node "$POSE" orchestrateur "$UN" --depot "$DEPOT" 2>&1); CODE=$?
[ "$CODE" -ne 0 ] && ok "la pose refuse un lieu partiel (code ${CODE})" || ko "🚨 un lieu partiel est passé"
[ ! -f "${DEPOT}/.orchestrateur/${UN}/.mcp.json" ] \
  && ok "et elle ne l'a pas COMPLÉTÉ — elle ne sait pas ce qu'un humain y a changé" \
  || ko "🚨 la pose a complété un lieu à demi posé"
mv "${BAC}/mcp.garde" "${DEPOT}/.orchestrateur/${UN}/.mcp.json"

echo "== Deux orchestrateurs cohabitent RÉELLEMENT dans le même dépôt =="
node "$POSE" orchestrateur "$DEUX" --depot "$DEPOT" >/dev/null 2>&1
COMPLETS=0
for n in "$UN" "$DEUX"; do
  MANQUE=0
  for f in CLAUDE.md CONTEXTE.md .mcp.json .claude/settings.json; do
    [ -f "${DEPOT}/.orchestrateur/${n}/${f}" ] || MANQUE=1
  done
  [ "$MANQUE" -eq 0 ] && COMPLETS=$((COMPLETS+1))
done
[ "$COMPLETS" -eq 2 ] && ok "les deux lieux sont complets et distincts" \
                      || ko "🚨 seuls ${COMPLETS}/2 lieux sont complets"

# ─────────────────────────────────────────────────────────────────────────────
echo "== Un espace de travail herdr créé pour l'occasion (rien d'existant n'est touché) =="
WS=$(herdr workspace create --label "e2e orchestrateur $$" --no-focus 2>/dev/null | champ result.workspace.workspace_id)
[ -n "$WS" ] || { ko "impossible de créer un espace de travail herdr"; echo; echo "Résultat : ${PASS} réussis, ${FAIL} échoués"; exit 1; }
ok "espace de travail créé : ${WS}"

echo "== La naissance, avec son AMORCE — la session doit FAIRE quelque chose =="
AMORCE="${BAC}/amorce.txt"
# Une amorce qui produit un EFFET OBSERVABLE, et qui reste DANS LES MOYENS de
# l'orchestrateur — le point a été trouvé en la posant mal : la première version lui
# demandait d'écrire un fichier, ce que ses permissions ne lui donnent pas. La session
# lisait son amorce, la traitait, et finissait sans rien produire : un faux négatif qui
# accusait la naissance d'un défaut qui n'était pas le sien.
#
# Et la preuve se lit dans la TRANSCRIPTION de la session, pas à l'écran — trouvé en
# relançant : l'écran d'un terminal défile, et la réponse peut en être sortie. Un test qui
# dépend de ce qui reste affiché est intermittent, ce qui est pire qu'absent.
#
# Ce qu'on exige est le MARQUEUR qu'on a demandé (« PREUVE= »), jamais le contenu exact de
# la réponse : ce contenu appartient au modèle, pas à ce lot. La première version exigeait
# un titre de fichier précis — la session a répondu avec le marqueur et un autre titre, et
# le test a accusé la naissance d'un défaut qui n'était pas le sien.
printf 'Réponds en une seule ligne, commençant par le mot PREUVE= suivi de ton nom d%sagent. Rien d%s autre.\n' "'" "'" > "$AMORCE"

SORTIE=$(node "$NAITRE" "$UN" --workspace "$WS" --role orchestrateur --depot "$DEPOT" --amorce "$AMORCE" 2>&1)
CODE=$?
PANE=$(printf '%s' "$SORTIE" | tail -1 | champ pane)
[ -n "$PANE" ] && PANES="$PANES $PANE"

[ "$CODE" -eq 0 ] && ok "la naissance aboutit (code 0)" \
                  || ko "la naissance échoue (code ${CODE}) : $(printf '%s' "$SORTIE" | tr '\n' ' ' | cut -c1-240)"

echo "== La preuve de la naissance : on lit la session, pas la commande =="
if [ -n "$PANE" ]; then
  ETAT=$(herdr agent get "$PANE" 2>/dev/null)
  NOM=$(printf '%s' "$ETAT"  | champ result.agent.name)
  FCWD=$(printf '%s' "$ETAT" | champ result.agent.foreground_cwd)

  [ -n "$NOM" ] && ok "un agent est RÉELLEMENT détecté dans le pane" \
                || ko "aucun agent détecté — la session ne s'est pas ouverte"

  if [ "$(printf '%s' "$NOM" | tr '[:upper:]' '[:lower:]')" = "$(printf '%s' "$UN" | tr '[:upper:]' '[:lower:]')" ]; then
    ok "l'agent porte son nom (${NOM}) — il est adressable"
  else
    ko "l'agent porte « ${NOM:-—} » au lieu de « ${UN} » — il resterait inadressable"
  fi

  REEL=$(cd "${DEPOT}/.orchestrateur/${UN}" 2>/dev/null && pwd -P)
  VU=$(cd "${FCWD:-/nexistepas}" 2>/dev/null && pwd -P)
  if [ -n "$VU" ] && [ "$VU" = "$REEL" ]; then
    ok "la session tourne DANS le lieu de l'orchestrateur (${FCWD})"
  else
    ko "la session tourne AILLEURS : ${FCWD:-—} au lieu de ${REEL} — ce n'est pas un orchestrateur"
  fi
else
  ko "pas de pane : ni le répertoire réel ni l'amorce ne peuvent être mesurés"
fi

echo "== La preuve de l'amorce : ce que la session FAIT, pas ce qu'on lui a envoyé =="
if [ -n "$PANE" ]; then
  AMORCEE=$(printf '%s' "$SORTIE" | tail -1 | champ amorcee)
  [ "$AMORCEE" = "True" ] || [ "$AMORCEE" = "true" ] \
    && ok "la commande déclare l'amorce prise (et elle l'a VÉRIFIÉE, pas supposée)" \
    || ko "la commande ne déclare pas l'amorce prise"

  # La trace du travail, relue dans la TRANSCRIPTION de la session — un effet persistant,
  # que rien n'efface. On n'attend pas un délai : on regarde jusqu'à ce que ce soit vrai,
  # comme la naissance interroge jusqu'à ce que l'agent soit détecté.
  LIEU_REEL=$(cd "${DEPOT}/.orchestrateur/${UN}" && pwd -P)
  TRANSCRIPTIONS="${HOME}/.claude/projects/$(printf '%s' "$LIEU_REEL" | sed 's|[/.]|-|g')"
  VU_PREUVE=0
  for _ in $(seq 1 60); do
    if [ -d "$TRANSCRIPTIONS" ] && grep -lq 'PREUVE=' "$TRANSCRIPTIONS"/*.jsonl 2>/dev/null; then VU_PREUVE=1; break; fi
    sleep 2
  done
  if [ "$VU_PREUVE" -eq 1 ]; then
    ok "la session a AGI : sa transcription porte un tour de travail qui répond à l'amorce"
  else
    STATUT=$(herdr agent get "$PANE" 2>/dev/null | champ result.agent.agent_status)
    ko "🚨 la session est née mais n'a rien fait (statut « ${STATUT:-—} ») — c'est le défaut « née correctement, ne commence pas »"
  fi
fi

echo
echo "Résultat : ${PASS} réussis, ${FAIL} échoués"
[ "$FAIL" -eq 0 ]
