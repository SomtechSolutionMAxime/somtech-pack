#!/usr/bin/env bash
# ============================================================
# test-livraison-brief-reel.sh — v1.0.0
# LA preuve de T-20260809-0033 : un brief RÉELLEMENT livré à une session RÉELLEMENT née,
# et l'on vérifie qu'elle l'a EXÉCUTÉ — pas qu'on le lui a envoyé.
#
# CE QUE LA MESURE A TROUVÉ, ET QUI EST PIRE QUE LE TICKET
# Le ticket rapportait un brief resté dans la boîte de saisie. Mesuré contre le vrai service,
# le cas grave est ailleurs et il est DÉTERMINISTE : écrire dans une boîte qui contient déjà
# quelque chose ne livre pas deux messages, il en livre UN — les deux textes collés. L'agent
# se met alors à travailler sur un texte que personne n'a écrit, et `herdr agent prompt` rend
# un succès. Un brief fusionné est pire qu'un brief absent : l'absent se voit, le fusionné
# produit un travail plausible et faux.
#
# LES DEUX BRAS SONT OBLIGATOIRES. Le bras négatif rejoue le geste nu et fait apparaître la
# fusion pour de vrai ; sans lui, rien ne prouve que c'est la commande qui fait la différence.
#
# POURQUOI IL EST DÉTERMINISTE ALORS QUE LE DÉFAUT D'ORIGINE EST UNE COURSE
# On ne cherche pas à faire caler la soumission — ça, c'est une course dans herdr, et un test
# qui en dépend serait instable. On installe le reste dans la boîte par un geste sûr
# (`agent send-keys`, qui tape sans soumettre), et c'est la FUSION qu'on mesure. Elle, elle se
# reproduit à tous les coups.
#
# SAUTÉ proprement quand il ne peut pas être honnête : pas de herdr joignable, pas de claude.
# Forcer le saut : SOMTECH_SKIP_E2E=1
#
# Usage : bash scripts/tests/test-livraison-brief-reel.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
NAITRE="${ROOT}/naissance-representant/bin/naitre.js"
LIVRER="${ROOT}/naissance-representant/bin/livrer.js"

skip() { echo "⏭️  $1 — test sauté (il ne peut pas être honnête ici)."; exit 0; }

[ -n "${SOMTECH_SKIP_E2E:-}" ] && skip "saut demandé (SOMTECH_SKIP_E2E)"
command -v herdr   >/dev/null 2>&1 || skip "binaire \`herdr\` absent"
command -v claude  >/dev/null 2>&1 || skip "binaire \`claude\` absent"
command -v node    >/dev/null 2>&1 || skip "node absent"
command -v python3 >/dev/null 2>&1 || skip "python3 absent"
[ -f "$NAITRE" ] && [ -f "$LIVRER" ] || skip "naissance-representant/bin absent"
herdr workspace list >/dev/null 2>&1 || skip "aucun serveur herdr joignable"

PASS=0; FAIL=0
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

champ() { python3 -c '
import json,sys
d=json.load(sys.stdin); cur=d
for k in sys.argv[1].split("."):
    if cur is None: break
    cur = cur.get(k) if isinstance(cur,dict) else None
print(cur if cur is not None else "")' "$1" 2>/dev/null; }

statut() { herdr agent get "$1" 2>/dev/null | champ result.agent.agent_status; }
ecran()  { herdr agent read "$1" 2>/dev/null; }
boite()  { ecran "$1" | grep '❯' | tail -1; }
# poser <pane> [essais] — attendre que la session cesse de travailler.
poser() { local n="${2:-45}"; for _ in $(seq 1 "$n"); do [ "$(statut "$1")" != "working" ] && return 0; sleep 2; done; return 1; }
# bouge <pane> — la session a-t-elle quitté l'attente dans les 25 s ?
bouge() { for _ in $(seq 1 25); do [ "$(statut "$1")" = "working" ] && { echo oui; return; }; sleep 1; done; echo non; }

CLIENT="e2ebrief$$"
LIEU="${ROOT}/.gestionnaire/${CLIENT}"
WS=""
cleanup() {
  [ -n "$WS" ] && herdr workspace close "$WS" >/dev/null 2>&1
  rm -rf "$LIEU"
  rmdir "${ROOT}/.gestionnaire" 2>/dev/null
}
trap cleanup EXIT

echo "== Une session de représentant, réellement née =="
mkdir -p "${LIEU}/.claude"
printf '# Tu es le représentant de ce client\n' > "${LIEU}/CLAUDE.md"
printf "# Ce qu'on sait de ce client\n"         > "${LIEU}/CONTEXTE.md"
printf '{"mcpServers":{}}\n'                    > "${LIEU}/.mcp.json"
printf '{"permissions":{"allow":[]}}\n'         > "${LIEU}/.claude/settings.json"
WS=$(herdr workspace create --label "e2e brief $$" --no-focus 2>/dev/null | champ result.workspace.workspace_id)
[ -n "$WS" ] || { ko "impossible de créer un espace de travail herdr"; echo; echo "Résultat : ${PASS} réussis, ${FAIL} échoués"; exit 1; }
P=$(node "$NAITRE" "$CLIENT" --workspace "$WS" 2>&1 | tail -1 | champ pane)
[ -n "$P" ] || { ko "la naissance a échoué"; echo; echo "Résultat : ${PASS} réussis, ${FAIL} échoués"; exit 1; }
ok "session née dans son lieu : ${P}"
poser "$P" 15

# ─────────────────────────────────────────────────────────────────────────────
echo "== Bras négatif — le geste nu, sur une boîte qui n'est pas vide =="
# On installe un reste par un geste SÛR : `send-keys` tape sans soumettre.
herdr agent send-keys "$P" z z r e s t e >/dev/null 2>&1
sleep 3
case "$(boite "$P")" in
  *zzreste*) ok "un reste est bien en attente dans la boîte (« zzreste »)" ;;
  *) ko "impossible d'installer un reste dans la boîte — ce bras ne prouverait rien" ;;
esac

# Le geste nu, exactement celui du ticket.
NU=$(herdr agent prompt "$P" 'BRIEFDEUX' 2>&1)
case "$NU" in
  *agent_prompted*|*'"result"'*) ok "le geste nu rend un SUCCÈS (c'est ce que l'appelant lit)" ;;
  *) ko "le geste nu a refusé — le défaut ne se reproduit pas ainsi" ;;
esac
sleep 6
FUSION=$(ecran "$P" | grep -i 'zzresteBRIEFDEUX' | head -1)
if [ -n "$FUSION" ]; then
  ok "…et la session a reçu les DEUX TEXTES COLLÉS : « zzresteBRIEFDEUX »"
else
  ko "🚨 pas de fusion observée — le bras négatif ne démontre plus le défaut"
fi
poser "$P" 45

# ─────────────────────────────────────────────────────────────────────────────
echo "== Bras positif 1 — la commande REFUSE d'écrire dans une boîte non vide =="
herdr agent send-keys "$P" z z r e s t e >/dev/null 2>&1
sleep 3
SORTIE=$(node "$LIVRER" "$P" --texte 'BRIEFTROIS' 2>&1); CODE=$?
[ "$CODE" -ne 0 ] && ok "elle refuse et sort en ${CODE} (jamais 0)" \
                  || ko "🚨 elle a livré par-dessus un reste"
case "$SORTIE" in *"pas vide"*) ok "et elle dit pourquoi : la boîte n'est pas vide" ;; *) ko "message peu clair : $(printf '%s' "$SORTIE" | head -c 120)" ;; esac
case "$(boite "$P")" in
  *BRIEFTROIS*) ko "🚨 elle a quand même écrit dans la boîte" ;;
  *zzreste*) ok "rien n'a été écrit — la boîte contient toujours le seul reste" ;;
  *) ko "la boîte a changé sans qu'on sache pourquoi : $(boite "$P")" ;;
esac

# On vide la boîte pour la suite : soumettre le reste, puis laisser la session finir.
herdr agent send-keys "$P" Enter >/dev/null 2>&1
poser "$P" 45

# ─────────────────────────────────────────────────────────────────────────────
echo "== Bras positif 2 — un vrai brief, et la preuve qu'il a été EXÉCUTÉ =="
# Le brief demande un calcul : sa RÉPONSE (383) n'apparaît nulle part dans le brief. Trouver
# « 383 » à l'écran ne peut donc venir que de la session qui a réellement traité le message —
# pas de l'écho du texte qu'on lui a envoyé.
BRIEF="${TMPDIR:-/tmp}/brief-$$.md"
printf 'Reponds exactement par le resultat de 137 plus 246, et rien dautre. Aucun preambule.\n' > "$BRIEF"
SORTIE=$(node "$LIVRER" "$P" --brief "$BRIEF" 2>&1); CODE=$?
rm -f "$BRIEF"
if [ "$CODE" -eq 0 ]; then
  ok "la livraison aboutit (code 0)"
else
  ko "la livraison échoue (code ${CODE}) : $(printf '%s' "$SORTIE" | tr '\n' ' ' | cut -c1-200)"
fi
case "$SORTIE" in *'"ok":true'*) ok "elle rend un compte rendu de livraison" ;; *) ko "aucun compte rendu rendu" ;; esac

poser "$P" 45
if ecran "$P" | grep -q '383'; then
  ok "la session a EXÉCUTÉ le brief — sa réponse (383) est à l'écran, et le brief ne la contenait pas"
else
  ko "aucune réponse de la session : le brief a été envoyé, pas exécuté"
  ecran "$P" | grep -v '^ *$' | tail -6
fi
case "$(boite "$P")" in
  *137*|*383*) ko "🚨 du texte est resté dans la boîte après la livraison" ;;
  *) ok "la boîte est retombée vide après la prise du brief" ;;
esac

echo
echo "Résultat : ${PASS} réussis, ${FAIL} échoués"
[ "$FAIL" -eq 0 ]
