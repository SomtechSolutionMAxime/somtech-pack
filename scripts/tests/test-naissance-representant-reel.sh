#!/usr/bin/env bash
# ============================================================
# test-naissance-representant-reel.sh — v1.0.0
# LA preuve de T-20260809-0023 : une session RÉELLEMENT née, dans un espace de
# travail RÉELLEMENT créé, dont on lit le répertoire de travail RÉEL — pas la
# commande qu'on a composée.
#
# POURQUOI CE TEST EXISTE ALORS QUE LES 52 AUTRES ÉTAIENT VERTS
# E-20260807-0003 déclarait 52 tests et une preuve en session réelle. Le tout
# premier geste de la chaîne a échoué au premier usage réel. La cause est le
# motif qui revient : le double de `herdr` répondait `{"result":{"ok":true}}` à
# TOUT, y compris à un `agent rename` sur un pane où aucun agent n'existait —
# alors que le vrai service répond `{"error":{"code":"agent_not_found"}}`. Le
# double était plus indulgent que le vrai service, septième occurrence.
#
# Ici : aucun faux binaire. Le vrai `herdr`, le vrai `claude`, un espace de
# travail créé pour l'occasion et fermé après.
#
# CE QU'IL PROUVE, ET C'EST LE POINT DU LOT ENTIER
# Que la session née tourne DANS `.gestionnaire/<client>/`. Née ailleurs, elle
# ne charge ni le métier ni le registre du représentant : ce n'est plus un
# représentant, c'est une session ordinaire dans un pane. La mesure ne vient pas
# de la commande composée — elle vient de `herdr agent get`, qui rapporte le
# répertoire du processus au premier plan.
#
# LES DEUX BRAS SONT OBLIGATOIRES : sans le bras négatif, ce test ne prouverait
# pas que c'est le correctif qui fait la différence. Le bras négatif rejoue la
# séquence d'ORIGINE (pane créé sans `--cwd`, renommage immédiat) et montre les
# deux défauts se produire pour de vrai.
#
# SAUTÉ proprement quand il ne peut pas être honnête : pas de `herdr` joignable,
# pas de `claude`. Forcer le saut : SOMTECH_SKIP_E2E=1
#
# Usage : bash scripts/tests/test-naissance-representant-reel.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BIN="${ROOT}/naissance-representant/bin/naitre.js"

skip() { echo "⏭️  $1 — test sauté (il ne peut pas être honnête ici)."; exit 0; }

[ -n "${SOMTECH_SKIP_E2E:-}" ] && skip "saut demandé (SOMTECH_SKIP_E2E)"
command -v herdr  >/dev/null 2>&1 || skip "binaire \`herdr\` absent"
command -v claude >/dev/null 2>&1 || skip "binaire \`claude\` absent"
command -v node   >/dev/null 2>&1 || skip "node absent"
command -v python3 >/dev/null 2>&1 || skip "python3 absent (lecture des réponses herdr)"
[ -f "$BIN" ] || skip "naissance-representant/bin/naitre.js absent"
# Un binaire présent ne veut pas dire un serveur joignable (chaîne d'intégration).
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

CLIENT="e2enaissance$$"                       # minuscules + chiffres : nommable par herdr
LIEU="${ROOT}/.gestionnaire/${CLIENT}"
WS=""
PANES=""

cleanup() {
  for p in $PANES; do herdr pane close "$p" >/dev/null 2>&1; done
  [ -n "$WS" ] && herdr workspace close "$WS" >/dev/null 2>&1
  rm -rf "$LIEU"
  rmdir "${ROOT}/.gestionnaire" 2>/dev/null   # seulement s'il ne reste rien dedans
}
trap cleanup EXIT

echo "== Un lieu de représentant, tel que \`ligne-directe representant\` le pose =="
mkdir -p "${LIEU}/.claude"
printf '# Tu es le représentant de ce client\n' > "${LIEU}/CLAUDE.md"
printf "# Ce qu'on sait de ce client\n"         > "${LIEU}/CONTEXTE.md"
printf '{"mcpServers":{}}\n'                    > "${LIEU}/.mcp.json"
printf '{"permissions":{"allow":[]}}\n'         > "${LIEU}/.claude/settings.json"
[ -f "${LIEU}/CLAUDE.md" ] && ok "lieu posé : .gestionnaire/${CLIENT}/" || { ko "lieu impossible"; exit 1; }

echo "== Un espace de travail herdr créé pour l'occasion (rien d'existant n'est touché) =="
WS=$(herdr workspace create --label "e2e naissance $$" --no-focus 2>/dev/null | champ result.workspace.workspace_id)
[ -z "$WS" ] && WS=$(herdr workspace list 2>/dev/null | python3 -c '
import json,sys
w=json.load(sys.stdin)["result"]["workspaces"]
print([x for x in w if x["label"].startswith("e2e naissance")][-1]["workspace_id"] if any(x["label"].startswith("e2e naissance") for x in w) else "")
' 2>/dev/null)
[ -n "$WS" ] || { ko "impossible de créer un espace de travail herdr"; echo; echo "Résultat : ${PASS} réussis, ${FAIL} échoués"; exit 1; }
ok "espace de travail créé : ${WS}"

# ─────────────────────────────────────────────────────────────────────────────
echo "== Bras négatif — la séquence d'ORIGINE, contre le vrai service =="
# tab create SANS --cwd, puis renommage IMMÉDIAT : exactement ce que faisait
# `bin/naitre.js` avant le correctif. On le rejoue à la main pour montrer que le
# vrai service refuse là où le double disait oui.
P0=$(herdr tab create --workspace "$WS" --label "$CLIENT origine" --no-focus 2>/dev/null | champ result.root_pane.pane_id)
if [ -n "$P0" ]; then
  PANES="$PANES $P0"
  REP0=$(herdr agent rename "$P0" "$CLIENT" 2>&1)
  case "$REP0" in
    *agent_not_found*) ok "renommage immédiat REFUSÉ par le vrai service (agent_not_found) — le défaut, reproduit" ;;
    *) ko "🚨 le renommage immédiat a réussi : le défaut ne se reproduit plus, ce test ne prouve rien" ;;
  esac
  CWD0=$(herdr pane get "$P0" 2>/dev/null | champ result.pane.cwd)
  [ -z "$CWD0" ] && CWD0=$(herdr pane list --workspace "$WS" 2>/dev/null | python3 -c '
import json,sys
d=json.load(sys.stdin)
print(next((p.get("cwd","") for p in d["result"]["panes"] if p["pane_id"]==sys.argv[1]), ""))
' "$P0" 2>/dev/null)
  if [ "$CWD0" = "$LIEU" ]; then
    ko "🚨 le pane sans --cwd naît quand même dans le lieu — ce bras ne prouve rien"
  else
    ok "sans --cwd, le pane naît AILLEURS que dans le lieu (${CWD0:-inconnu})"
  fi
  herdr pane close "$P0" >/dev/null 2>&1
else
  ko "création du pane du bras négatif impossible"
fi

# ─────────────────────────────────────────────────────────────────────────────
echo "== Bras positif — la commande complète, du début à la fin =="
SORTIE=$(node "$BIN" "$CLIENT" --workspace "$WS" 2>&1)
CODE=$?
PANE=$(printf '%s' "$SORTIE" | tail -1 | champ pane)
[ -n "$PANE" ] && PANES="$PANES $PANE"

if [ "$CODE" -eq 0 ]; then
  ok "la commande complète aboutit (code 0)"
else
  ko "la commande complète échoue (code ${CODE}) : $(printf '%s' "$SORTIE" | tr '\n' ' ' | cut -c1-240)"
fi

if [ -n "$PANE" ]; then
  ok "un pane est né : ${PANE}"
else
  ko "aucun pane rendu par la commande"
fi

echo "== La preuve : on lit la session, pas la commande =="
if [ -n "$PANE" ]; then
  ETAT=$(herdr agent get "$PANE" 2>/dev/null)
  NOM=$(printf '%s' "$ETAT"  | champ result.agent.name)
  FCWD=$(printf '%s' "$ETAT" | champ result.agent.foreground_cwd)
  PCWD=$(printf '%s' "$ETAT" | champ result.agent.cwd)

  [ -n "$NOM" ] && ok "un agent est RÉELLEMENT détecté dans le pane" \
                || ko "aucun agent détecté dans le pane né — la session ne s'est pas ouverte"

  # herdr impose les minuscules : la comparaison est insensible à la casse.
  if [ "$(printf '%s' "$NOM" | tr '[:upper:]' '[:lower:]')" = "$(printf '%s' "$CLIENT" | tr '[:upper:]' '[:lower:]')" ]; then
    ok "l'agent porte le nom du client (${NOM}) — il est adressable"
  else
    ko "l'agent porte « ${NOM:-—} » au lieu de « ${CLIENT} » — il resterait inadressable"
  fi

  # LE point du lot : le répertoire de travail RÉEL de la session née.
  REEL=$(cd "$LIEU" 2>/dev/null && pwd -P)
  VU=$(cd "${FCWD:-/nexistepas}" 2>/dev/null && pwd -P)
  if [ -n "$VU" ] && [ "$VU" = "$REEL" ]; then
    ok "la session tourne DANS le lieu du représentant (${FCWD})"
  else
    ko "la session tourne AILLEURS : ${FCWD:-—} au lieu de ${LIEU} — ce n'est pas un représentant"
  fi
  [ -n "$PCWD" ] && echo "     (répertoire du shell du pane : ${PCWD})"
else
  ko "pas de pane : le répertoire de travail réel ne peut pas être lu"
fi

echo "== Rien ne subsiste d'une naissance ratée =="
# Le lieu est retiré : la commande doit refuser, et ne laisser aucun pane derrière.
AVANT=$(herdr pane list --workspace "$WS" 2>/dev/null | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["result"]["panes"]))' 2>/dev/null)
rm -rf "$LIEU"
node "$BIN" "$CLIENT" --workspace "$WS" >/dev/null 2>&1
CODE2=$?
APRES=$(herdr pane list --workspace "$WS" 2>/dev/null | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["result"]["panes"]))' 2>/dev/null)
[ "$CODE2" -ne 0 ] && ok "un lieu absent fait échouer la commande (code ${CODE2}, jamais 0)" \
                   || ko "🚨 la commande rend 0 alors que le lieu n'existe pas"
[ "${AVANT:-0}" = "${APRES:-1}" ] && ok "aucun pane orphelin laissé derrière (${APRES} avant comme après)" \
                                  || ko "un pane a été laissé derrière (${AVANT} → ${APRES})"

echo
echo "Résultat : ${PASS} réussis, ${FAIL} échoués"
[ "$FAIL" -eq 0 ]
