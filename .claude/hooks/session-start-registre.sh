#!/usr/bin/env bash
# ============================================================
# session-start-registre.sh — v1.0.0
# Un agent né sans registre le DIT À SA NAISSANCE (E-20260807-0009, livrable 4).
#
# POURQUOI
# Un serveur MCP déclaré `${VAR}` dont la variable manque est refusé par le
# service au premier échange, et disparaît de la session. L'agent ne s'en rend
# compte qu'au premier appel — souvent après avoir déjà travaillé. Le 2026-08-07,
# trois agents ont dû faire relayer leur mandat par fichier, quatorze stories ont
# été inscrites par quelqu'un d'autre que leur auteur, et l'un d'eux a attendu
# près d'une heure sur une demande de relais que personne n'a vue.
#
# CE HOOK NE RÉPARE RIEN, ET C'EST ASSUMÉ : quand il s'exécute, les serveurs MCP
# sont déjà initialisés. Il déplace le moment de la découverte — de « au milieu
# de la tâche » à « à la naissance » — et nomme le geste qui répare.
#
# CE QU'IL N'IMPRIME JAMAIS : une valeur de jeton. Il ne manipule que des NOMS
# de variables et des verdicts présent/absent.
#
# Silencieux quand tout va bien (pas de .mcp.json, ou toutes les variables
# résolues). Jamais bloquant : sort toujours en 0.
# ============================================================
set -uo pipefail

MCP_FILE="${CLAUDE_PROJECT_DIR:-$PWD}/.mcp.json"
[ -r "$MCP_FILE" ] || exit 0

# La lib du pack si elle est installée ; sinon on refait son extraction ici — le
# hook doit fonctionner sur un poste où le rc shell n'a pas encore été réaligné,
# ce qui est précisément le poste qu'on cherche à alerter.
MISSING=""
_LIB="${SOMTECH_MCP_ENV_LIB:-$HOME/.somtech/mcp-env.sh}"
if [ -r "$_LIB" ]; then
  # NOLOAD : le hook diagnostique l'environnement de la SESSION tel qu'il est.
  # S'il chargeait le lieu unique, il verrait des variables que les serveurs MCP,
  # eux, n'ont jamais eues — et il conclurait que tout va bien. Le double serait
  # plus indulgent que le vrai service.
  # shellcheck source=/dev/null
  SOMTECH_MCP_ENV_NOLOAD=1 . "$_LIB"
  MISSING=$(mcp_env_missing "$MCP_FILE")
else
  _REFS=$(grep -oE '\$\{[A-Za-z_][A-Za-z0-9_]*\}' "$MCP_FILE" 2>/dev/null \
          | sed -E 's/^\$\{//; s/\}$//' | sort -u)
  for _v in $_REFS; do
    eval "_val=\${$_v:-}"
    [ -n "${_val:-}" ] || MISSING="${MISSING}${_v}
"
  done
  MISSING=$(printf '%s' "$MISSING" | sed '/^$/d')
fi

[ -n "$MISSING" ] || exit 0

# Quels serveurs sont touchés — pour nommer le registre plutôt qu'une variable.
#
# C'est AUSSI le filtre qui évite la fausse alerte : une variable manquante qui
# n'appartient à aucun serveur déclaré (glissée ailleurs dans le fichier) ne rend
# aucun registre muet. On l'écarte. Une alarme qui crie pour rien est une alarme
# qu'on cesse de lire — et le jour où elle a raison, plus personne ne l'écoute.
SERVERS=""
RETENUES=""
for _v in $MISSING; do
  _s=$(python3 - "$MCP_FILE" "$_v" <<'PY' 2>/dev/null || true
import json, sys
try:
    conf = json.load(open(sys.argv[1])).get('mcpServers', {})
except Exception:
    sys.exit(0)
needle = '${%s}' % sys.argv[2]
print(' '.join(n for n, c in conf.items() if needle in json.dumps(c)))
PY
)
  [ -n "$_s" ] || continue          # variable hors mcpServers → aucun serveur muet
  SERVERS="${SERVERS} ${_s}"
  RETENUES="${RETENUES}${_v}
"
done
MISSING=$(printf '%s' "$RETENUES" | sed '/^$/d')
[ -n "$MISSING" ] || exit 0
SERVERS=$(printf '%s' "$SERVERS" | tr ' ' '\n' | sed '/^$/d' | sort -u | tr '\n' ' ')

cat >&2 <<MSG

═══════════════════════════════════════════════════════════════════════
⛔ REGISTRE INJOIGNABLE — dit à ta naissance, pas au premier appel
═══════════════════════════════════════════════════════════════════════

Serveur(s) muet(s) dans cette session : ${SERVERS:-(inconnus)}

Cause : leur jeton n'est pas dans l'environnement de cette session.
Variable(s) manquante(s) : $(printf '%s' "$MISSING" | tr '\n' ' ')

Ce que ça veut dire concrètement — tu ne peux ni lire ton mandat, ni
poser tes statuts, ni créer tes stories. Ne travaille pas une heure
avant de t'en apercevoir : dis-le maintenant à qui t'a ouvert.

Réparer, sur le poste :
  1. Vérifier que le lieu unique existe et porte les jetons :
       ls -l ~/.somtech/mcp-env         (attendu : -rw------- )
  2. S'il manque, l'installer :
       npx @somtech-solutions/pack setup
  3. Ouvrir une NOUVELLE session — les serveurs MCP se connectent au
     démarrage, une session déjà ouverte ne les récupérera pas.

Vérifier sans rien deviner :  claude mcp list
═══════════════════════════════════════════════════════════════════════

MSG
exit 0
