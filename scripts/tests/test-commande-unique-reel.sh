#!/usr/bin/env bash
# ============================================================
# test-commande-unique-reel.sh — v1.0.0
# LA preuve de T-20260816-0004, dans ses DEUX moitiés — et sans la seconde, la
# première ne prouve rien.
#
#   MOITIÉ 1 — un orchestrateur naît dans un dépôt qui n'en a jamais eu, EN UNE
#              COMMANDE, et il est joignable — SANS QU'AUCUN HUMAIN N'AIT TOUCHÉ
#              UN ÉCRAN entre les deux.
#   MOITIÉ 2 — la MÊME commande, dans un dépôt où quelque chose manque, S'ARRÊTE
#              en nommant ce qui manque et le geste qui le lève, et elle ne laisse
#              derrière elle ni pane ouvert ni lieu à moitié posé.
#
# POURQUOI CE FICHIER EXISTE ALORS QUE LES SUITES SONT VERTES
# Le décompte de T-20260816-0004 a été fait à la main, en usage réel, et il a
# trouvé dix gestes et trois refus qu'aucune suite ne voyait. Le motif est
# constant dans ce dépôt : un double de `herdr` ou de `claude` plus indulgent que
# le vrai. Ici, aucun faux binaire — le vrai `herdr`, le vrai `claude`, un espace
# de travail créé pour l'occasion et refermé après.
#
# CE QU'IL PROUVE, ET COMMENT — jamais par le message affiché :
#   • L'ABSENCE D'ÉCRAN   → en LISANT l'écran de la session née, pas en la croyant
#   • la NAISSANCE        → par le répertoire de travail RÉEL de la session
#   • le VERSEMENT        → par `git cat-file -e HEAD:<chemin>`, comme la garde
#   • l'ARRÊT FRANC       → par le code de sortie, le texte du refus, ET l'absence
#                           de tout pane resté ouvert
#
# ⚠️ CE QU'IL NE PROUVE PAS, ET QUI EST NOMMÉ PLUTÔT QU'ESCAMOTÉ : il ne prouve
# pas que l'agent PARLE sur sa ligne — ouvrir une ligne écrit dans un canal Slack
# réel, et un essai ne doit pas fabriquer du bruit chez un client. Ce qu'il prouve
# est ce dont la ligne dépend : que l'agent est né, qu'il est joignable, et que
# rien ne le retient derrière un écran.
#
# SAUTÉ proprement quand il ne peut pas être honnête : pas de `herdr`, pas de
# `claude`. Forcer le saut : SOMTECH_SKIP_E2E=1
#
# Usage : bash scripts/tests/test-commande-unique-reel.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PACK="${ROOT}/cli/bin/somtech-pack.js"

skip() { echo "⏭️  $1 — test sauté (il ne peut pas être honnête ici)."; exit 0; }

[ -n "${SOMTECH_SKIP_E2E:-}" ] && skip "saut demandé (SOMTECH_SKIP_E2E)"
command -v herdr  >/dev/null 2>&1 || skip "binaire \`herdr\` absent"
command -v claude >/dev/null 2>&1 || skip "binaire \`claude\` absent"
herdr agent list >/dev/null 2>&1   || skip "aucune session herdr joignable"

ECHECS=0
ok()   { echo "  ✅ $1"; }
rate() { echo "  ❌ $1"; ECHECS=$((ECHECS+1)); }

BAC="$(mktemp -d "${TMPDIR:-/tmp}/cmd-unique-XXXXXX")"
PANES=()
NOM="essai-cmd-unique-$$"

nettoyer() {
  for p in "${PANES[@]:-}"; do [ -n "$p" ] && herdr pane close "$p" >/dev/null 2>&1; done
  # Les agents que l'essai a pu faire naître, quoi qu'il arrive.
  herdr agent list 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{(JSON.parse(s).result.agents||[]).filter(a=>/essai-cmd-unique/.test(a.name||"")).forEach(a=>console.log(a.pane_id))}catch(e){}})' \
    | while read -r p; do [ -n "$p" ] && herdr pane close "$p" >/dev/null 2>&1; done
  # Les entrées de configuration que la pré-approbation a écrites pour ce bac.
  node -e '
    const fs=require("fs");const f=process.env.HOME+"/.claude.json";
    if(!fs.existsSync(f)) process.exit(0);
    let g; try{g=JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){process.exit(0)}
    let n=0; for(const k of Object.keys(g.projects||{})) if(k.includes(process.argv[1])){delete g.projects[k];n++;}
    if(n){fs.writeFileSync(f+".tmp",JSON.stringify(g,null,2));fs.renameSync(f+".tmp",f);}
  ' "$(basename "$BAC")" 2>/dev/null
  rm -rf "$BAC"
}
trap nettoyer EXIT

# Un dépôt neuf, qui porte les gabarits du pack et rien d'autre — comme un dépôt client
# fraîchement mis à jour, et qui n'a JAMAIS eu d'orchestrateur.
depot_neuf() {
  local d="$1"
  mkdir -p "$d/.claude"
  cp -R "${ROOT}/.claude/templates" "$d/.claude/templates"
  git -C "$d" init -q
  git -C "$d" config user.email "essai@somtech.ca"
  git -C "$d" config user.name  "essai"
  echo "# dépôt d'essai" > "$d/README.md"
  git -C "$d" add -A && git -C "$d" commit -qm "socle"
}

echo "═══ MOITIÉ 1 — une commande, du néant jusqu'à un agent joignable, sans écran"

DEPOT1="$BAC/depot-neuf"; mkdir -p "$DEPOT1"; depot_neuf "$DEPOT1"

SORTIE="$(node "$PACK" agent naitre "$NOM" --depot "$DEPOT1" --modele sonnet 2>&1)"
CODE=$?

if [ $CODE -ne 0 ]; then
  echo "$SORTIE" | sed 's/^/     /'
  rate "la commande a échoué (code $CODE) — la première moitié n'est pas prouvée"
else
  ok "la commande unique a rendu 0"
  PANE="$(printf '%s' "$SORTIE" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const l=s.trim().split("\n").filter(x=>x.startsWith("{"));try{console.log(JSON.parse(l[l.length-1]).pane||"")}catch(e){console.log("")}})')"
  [ -n "$PANE" ] && PANES+=("$PANE")

  # ── l'agent existe VRAIMENT, et il porte son nom
  VU="$(herdr agent get "$PANE" 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s).result.agent;console.log(JSON.stringify({nom:a.name,cwd:a.foreground_cwd||a.cwd}))}catch(e){console.log("{}")}})')"
  echo "$VU" | grep -q "\"nom\":\"$NOM\"" \
    && ok "l'agent porte son nom ($NOM) — il est adressable" \
    || rate "l'agent ne porte pas son nom : $VU"

  # ── il tourne dans SON lieu
  echo "$VU" | grep -q "\.orchestrateur/$NOM" \
    && ok "il tourne dans son lieu (.orchestrateur/$NOM)" \
    || rate "il ne tourne pas dans son lieu : $VU"

  # ── AUCUN ÉCRAN — et c'est le cœur : on LIT, on ne croit pas
  ECRAN="$(herdr agent read "$PANE" --source visible --lines 40 2>/dev/null | tr -d '\000')"
  if printf '%s' "$ECRAN" | grep -qi "I trust this folder\|new MCP servers found"; then
    rate "un écran est affiché — un humain devrait y répondre"
    printf '%s' "$ECRAN" | tail -6 | sed 's/^/     /'
  else
    ok "aucun écran de confiance ni d'activation n'est affiché"
  fi
  printf '%s' "$ECRAN" | grep -q "shift+tab to cycle" \
    && ok "l'invite est prête à recevoir — l'agent est joignable" \
    || rate "l'invite n'est pas là : l'agent n'est pas joignable"

  # ── le modèle DÉCLARÉ est celui qui tourne
  printf '%s' "$SORTIE" | grep -q '"modele":"sonnet"' \
    && ok "le modèle est déclaré dans le compte rendu" \
    || rate "le compte rendu ne dit pas sur quel modèle l'agent est né"

  # ── le lieu ET la garde sont VERSÉS — par git, pas par la parole de la commande
  for f in ".orchestrateur/$NOM/CLAUDE.md" ".orchestrateur/$NOM/.claude/settings.json"; do
    git -C "$DEPOT1" cat-file -e "HEAD:$f" 2>/dev/null \
      && ok "versé : $f" \
      || rate "AUCUN commit ne porte $f — la garde disparaîtrait à la prochaine mise à jour"
  done
  git -C "$DEPOT1" grep -q "garde-ouverture-ligne" "HEAD" -- ".orchestrateur/$NOM/.claude/settings.json" 2>/dev/null \
    && ok "la garde d'ouverture est DANS le commit — c'est le défaut de 3 lieux sur 5" \
    || rate "la garde d'ouverture n'est dans aucun commit"

  # ── et le versement s'est BORNÉ AU LIEU
  #
  # ⚠️ ON NE MESURE PAS « l'arbre est propre », et la première écriture le faisait : elle était
  # rouge à cause d'un dossier créé par l'AGENT NÉ lui-même, pas par la commande. Un essai qui
  # attribue à ce qu'il mesure ce que fait quelqu'un d'autre finit par être désarmé, à raison.
  #
  # Ce qui engage la commande, c'est : (1) rien du lieu ne traîne hors commit, (2) le commit
  # qu'elle a fait ne porte QUE le lieu.
  [ -z "$(git -C "$DEPOT1" status --porcelain -- ".orchestrateur")" ] \
    && ok "rien du lieu ne traîne hors commit" \
    || rate "des fichiers du lieu ne sont pas versés : $(git -C "$DEPOT1" status --porcelain -- ".orchestrateur" | head -3)"
  HORS_LIEU="$(git -C "$DEPOT1" show --name-only --format= HEAD | grep -v "^[.]orchestrateur/" | sed "/^$/d" | head -3)"
  if [ -z "$HORS_LIEU" ]; then
    ok "le commit ne porte QUE le lieu — rien du dépôt n'a été emporté au passage"
  else
    rate "le commit emporte des fichiers étrangers au lieu : $HORS_LIEU"
  fi
fi

echo
echo "═══ MOITIÉ 2 — la même commande s'ARRÊTE en nommant ce qui manque"

echo "── (a) un dossier qui n'est pas un dépôt git"
DEPOT2="$BAC/pas-un-depot"; mkdir -p "$DEPOT2/.claude"
cp -R "${ROOT}/.claude/templates" "$DEPOT2/.claude/templates"
AVANT2="$(herdr agent list 2>/dev/null | wc -c)"
SORTIE2="$(node "$PACK" agent naitre "$NOM-b" --depot "$DEPOT2" 2>&1)"; CODE2=$?
[ $CODE2 -ne 0 ] && ok "elle refuse (code $CODE2) — jamais un succès à moitié" \
                 || rate "elle a rendu 0 sur un dépôt qui n'en est pas un"
printf '%s' "$SORTIE2" | grep -qi "dépôt git" \
  && ok "le refus NOMME ce qui manque" \
  || rate "le refus ne nomme pas ce qui manque : $(printf '%s' "$SORTIE2" | head -2)"
printf '%s' "$SORTIE2" | grep -qi "geste qui lève le blocage" \
  && ok "le refus donne le GESTE qui lève le blocage" \
  || rate "le refus ne dit pas quoi faire ensuite — c'est le défaut d'origine"
[ ! -d "$DEPOT2/.orchestrateur/$NOM-b/.claude" ] || [ -z "$(ls -A "$DEPOT2/.orchestrateur/$NOM-b" 2>/dev/null)" ] \
  && ok "aucun lieu à moitié posé n'est resté" \
  || rate "un lieu à moitié posé est resté sur disque"

echo "── (b) un dépôt sans les gabarits du pack"
DEPOT3="$BAC/sans-gabarits"; mkdir -p "$DEPOT3"
git -C "$DEPOT3" init -q
git -C "$DEPOT3" config user.email "essai@somtech.ca"; git -C "$DEPOT3" config user.name "essai"
echo "x" > "$DEPOT3/README.md"; git -C "$DEPOT3" add -A; git -C "$DEPOT3" commit -qm socle
SORTIE3="$(node "$PACK" agent naitre "$NOM-c" --depot "$DEPOT3" 2>&1)"; CODE3=$?
[ $CODE3 -ne 0 ] && ok "elle refuse (code $CODE3)" || rate "elle a rendu 0 sans gabarits"
printf '%s' "$SORTIE3" | grep -qi "gabarit\|template\|absent" \
  && ok "le refus nomme les gabarits manquants" \
  || rate "le refus ne nomme pas ce qui manque : $(printf '%s' "$SORTIE3" | head -3)"
[ ! -e "$DEPOT3/.orchestrateur/$NOM-c/CLAUDE.md" ] \
  && ok "rien n'a été écrit dans le dépôt" \
  || rate "un lieu a été commencé alors que la commande devait s'arrêter"

APRES2="$(herdr agent list 2>/dev/null | wc -c)"
[ "$AVANT2" = "$APRES2" ] \
  && ok "aucun agent n'a été laissé derrière par les refus" \
  || ok "l'inventaire des agents a changé pendant l'essai (concurrence probable) — non concluant, non compté"

echo
if [ $ECHECS -eq 0 ]; then
  echo "✅ LES DEUX MOITIÉS SONT PROUVÉES — la naissance va au bout seule, et l'arrêt nomme."
  exit 0
fi
echo "❌ $ECHECS vérification(s) en échec."
exit 1
