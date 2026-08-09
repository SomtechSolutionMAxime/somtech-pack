#!/usr/bin/env bash
# ============================================================
# test-garde-apres-disparition-du-plan.sh — v1.0.0
# LA preuve de T-20260809-0032 : le garde d'ouverture MORD depuis le lieu du
# représentant APRÈS que le plan de travail qui l'a posé a disparu.
#
# CE QUI SE MESURE ICI, ET CE QUI NE SE MESURE PAS
# Lire le chemin écrit dans `.claude/settings.json` ne prouve rien : c'est
# exactement ce qu'on faisait quand le chemin absolu est passé. Ici, le fichier
# posé est confié à un AUTRE dépôt, le plan de travail qui l'a posé est EFFACÉ,
# puis une VRAIE session Claude Code est ouverte dans le lieu et on lui demande
# un appel d'outil. Le verdict vient de ce que Claude Code fait de la commande
# du hook — pas de ce que nous croyons qu'il en ferait.
#
# LES DEUX BRAS SONT OBLIGATOIRES. Sans le bras négatif, ce test ne prouverait
# pas que c'est le correctif qui fait la différence : il rejoue la commande
# d'ORIGINE (chemin absolu vers le plan effacé) et montre le garde devenir
# INERTE — l'appel d'outil passe, et rien ne dit qu'il n'est plus gardé. C'est
# le motif « fonction inerte derrière des tests verts », rendu visible.
#
# LE GARDE EXERCÉ EST CELUI DU POSTE, pas une copie du plan : c'est
# `~/.somtech/naissance-representant`, l'installation réelle, celle que la
# commande posée désigne. Le test refuse de tourner si les fichiers dont le hook
# dépend n'y sont pas identiques à ceux de ce dépôt — sinon il mesurerait autre
# chose que ce qu'on vient d'écrire.
#
# CE QU'IL NE TOUCHE PAS. Le seul geste du garde vers le monde est une LECTURE
# (`herdr pane current`, puis `etat` de la ligne) ; rien n'est ouvert, rien n'est
# écrit, le vrai espace de conversation n'est jamais approché (RA-REL-012). Le
# `.mcp.json` du lieu d'essai est vide : aucun registre joignable. Et le test se
# saute si une ligne est DÉJÀ ouverte pour le pane courant — le garde laisserait
# alors tout passer, et ce serait un vert qui ne prouve rien.
#
# SAUTÉ proprement quand il ne peut pas être honnête : pas de `claude`, garde du
# poste absent ou divergent, ligne déjà ouverte pour ce pane.
# Forcer le saut : SOMTECH_SKIP_E2E=1
#
# Usage : bash scripts/tests/test-garde-apres-disparition-du-plan.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

skip() { echo "⏭️  $1 — test sauté (il ne peut pas être honnête ici)."; exit 0; }

[ -n "${SOMTECH_SKIP_E2E:-}" ] && skip "saut demandé (SOMTECH_SKIP_E2E)"
command -v claude >/dev/null 2>&1 || skip "binaire \`claude\` absent"
command -v node   >/dev/null 2>&1 || skip "node absent"
command -v git    >/dev/null 2>&1 || skip "git absent"
[ -d "${ROOT}/naissance-representant" ] || skip "naissance-representant absent de ce dépôt"
command -v python3 >/dev/null 2>&1 || skip "python3 absent (lecture des transcriptions)"

# Le garde du POSTE est celui qui sera exercé. S'il diverge de ce dépôt sur l'un
# des fichiers dont il dépend, ce test mesurerait du code qu'on n'a pas écrit.
GARDE_POSTE="${HOME}/.somtech/naissance-representant"
[ -d "$GARDE_POSTE" ] || skip "garde absent du poste (npx @somtech-solutions/pack setup)"
for f in hooks/garde-ouverture-ligne.js src/hook.js src/lieu.js src/garde.js; do
  cmp -s "${GARDE_POSTE}/${f}" "${ROOT}/naissance-representant/${f}" \
    || skip "le garde du poste diverge de ce dépôt sur ${f}"
done

# Une ligne déjà ouverte pour CE pane ferait tout passer : le vert ne prouverait rien.
PANE_ICI="$(herdr pane current 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["pane"]["pane_id"])' 2>/dev/null)"
if [ -n "$PANE_ICI" ] && node "${HOME}/.somtech/ligne-directe/bin/ligne-directe.js" etat 2>/dev/null \
     | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if sys.argv[1] in [l["pane"] for l in d.get("ouvertes",[])] else 1)' "$PANE_ICI"; then
  skip "une ligne est déjà ouverte pour ${PANE_ICI} — le garde laisserait tout passer"
fi

PASS=0; FAIL=0
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

CLIENT="e2egarde$$"
BAC="$(mktemp -d "${TMPDIR:-/tmp}/smtk-garde-XXXXXX")"
PLAN="${BAC}/plan-de-travail-20260809-999999"   # le plan horodaté, voué à disparaître
DEPOT="${BAC}/depot-client"                     # l'autre dépôt : il reçoit le fichier VERSIONNÉ
LIEU="${DEPOT}/.gestionnaire/${CLIENT}"

# `SOMTECH_GARDE_GARDER=1` conserve le bac à sable — indispensable pour lire les
# transcriptions quand un bras est non concluant.
cleanup() { [ -n "${SOMTECH_GARDE_GARDER:-}" ] && { echo "bac conservé : $BAC"; return; }; rm -rf "$BAC"; }
trap cleanup EXIT

# La commande du hook TELLE QUE LA VERSION FAUTIVE L'ÉCRIVAIT — citée depuis le
# ticket, pas réinventée : `node <racine du plan de travail>/naissance-.../garde….js`.
COMMANDE_ANCIENNE="node ${PLAN}/naissance-representant/hooks/garde-ouverture-ligne.js"

# ─────────────────────────────────────────────────────────────────────────────
echo "== Un plan de travail horodaté, avec de quoi poser (il disparaîtra) =="
mkdir -p "$PLAN"
cp -R "${ROOT}/naissance-representant" "${PLAN}/naissance-representant"
cp -R "${ROOT}/ligne-directe"          "${PLAN}/ligne-directe"
mkdir -p "${PLAN}/.gestionnaire/${CLIENT}/.claude"
printf '# Tu es le représentant de ce client\n' > "${PLAN}/.gestionnaire/${CLIENT}/CLAUDE.md"
printf "# Ce qu'on sait de ce client\n"         > "${PLAN}/.gestionnaire/${CLIENT}/CONTEXTE.md"
printf '{"mcpServers":{}}\n'                    > "${PLAN}/.gestionnaire/${CLIENT}/.mcp.json"
printf '%s\n' '{"permissions":{"allow":["Bash(git status*)"],"deny":["Edit","Write"]}}' \
  > "${PLAN}/.gestionnaire/${CLIENT}/.claude/settings.json"
ok "plan de travail monté : $(basename "$PLAN")"

echo "== La pose, par la VRAIE fonction de production =="
node --input-type=module -e "
import { poserGarde } from '${PLAN}/naissance-representant/src/naissance.js';
console.log(poserGarde('${PLAN}', '${CLIENT}'));
" >/dev/null 2>&1 || { ko "poserGarde a échoué"; echo; echo "Résultat : ${PASS} réussis, ${FAIL} échoués"; exit 1; }
POSE="$(cat "${PLAN}/.gestionnaire/${CLIENT}/.claude/settings.json")"
if printf '%s' "$POSE" | grep -q "$PLAN"; then
  ko "🚨 la pose porte encore le chemin du plan de travail — le correctif n'est pas là"
else
  ok "la pose ne porte aucun chemin de plan de travail"
fi

# ─────────────────────────────────────────────────────────────────────────────
echo "== Le fichier versionné voyage vers un AUTRE dépôt (ce que fait git) =="
mkdir -p "${LIEU}/.claude"
cp "${PLAN}/.gestionnaire/${CLIENT}/CLAUDE.md"   "${LIEU}/CLAUDE.md"
cp "${PLAN}/.gestionnaire/${CLIENT}/CONTEXTE.md" "${LIEU}/CONTEXTE.md"
cp "${PLAN}/.gestionnaire/${CLIENT}/.mcp.json"   "${LIEU}/.mcp.json"
cp "${PLAN}/.gestionnaire/${CLIENT}/.claude/settings.json" "${LIEU}/.claude/settings.json"
git -C "$DEPOT" init -q 2>/dev/null   # `git status` doit avoir un dépôt sous les pieds
ok "lieu recopié dans un dépôt qui ne contient PAS naissance-representant"

ok "le garde exercé sera celui du poste : ${GARDE_POSTE}"

echo "== LE PLAN DE TRAVAIL DISPARAÎT =="
rm -rf "$PLAN"
[ -d "$PLAN" ] && { ko "le plan n'a pas disparu"; exit 1; }
ok "$(basename "$PLAN") effacé — comme au \`claude-swt-done\`"

# ─────────────────────────────────────────────────────────────────────────────
# Une vraie session Claude Code dans le lieu, avec chien de garde.
interroger_claude() {
  local sortie="$1"
  ( cd "$LIEU" && claude -p \
      "Exécute la commande bash suivante, exactement : git status. Rapporte ce que tu obtiens." \
      --output-format stream-json --verbose >"$sortie" 2>&1 ) &
  local pid=$!
  ( sleep 240; kill -9 "$pid" 2>/dev/null ) & local chien=$!
  wait "$pid"; local rc=$?
  kill "$chien" 2>/dev/null
  return $rc
}

REFUS="ouvre pas la ligne"

echo
echo "== Bras négatif — la commande d'ORIGINE, vers le plan effacé =="
python3 - "$LIEU/.claude/settings.json" "$COMMANDE_ANCIENNE" <<'PY'
import json, sys
p, cmd = sys.argv[1], sys.argv[2]
d = json.load(open(p))
d["hooks"] = {"PreToolUse": [{"hooks": [{"type": "command", "command": cmd}]}]}
json.dump(d, open(p, "w"), indent=2, ensure_ascii=False)
PY
interroger_claude "${BAC}/negatif.jsonl"
if grep -q "$REFUS" "${BAC}/negatif.jsonl"; then
  ko "🚨 la commande d'origine mord encore — ce bras ne prouve rien, le défaut ne se reproduit pas"
elif grep -qi "on branch\|sur la branche\|nothing to commit\|rien à valider\|working tree clean" "${BAC}/negatif.jsonl"; then
  ok "garde INERTE : \`git status\` s'est exécuté, et RIEN n'a dit que le garde ne gardait plus"
else
  ko "bras négatif non concluant — ni refus, ni exécution lisible (voir ${BAC}/negatif.jsonl)"
fi

echo
echo "== Bras positif — la commande CORRIGÉE, le plan toujours effacé =="
printf '%s' "$POSE" > "${LIEU}/.claude/settings.json"
interroger_claude "${BAC}/positif.jsonl"
if grep -q "$REFUS" "${BAC}/positif.jsonl"; then
  ok "le garde MORD depuis le lieu, après la disparition du plan de travail"
else
  ko "🚨 le garde n'a pas mordu (voir ${BAC}/positif.jsonl)"
fi

echo
echo "Résultat : ${PASS} réussis, ${FAIL} échoués"
[ "$FAIL" -eq 0 ] || exit 1
