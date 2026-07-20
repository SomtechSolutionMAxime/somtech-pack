#!/usr/bin/env bash
# ============================================================
# test-claude-swt-prompt.sh — v1.1.0
# Contrat du flag --prompt (T-20260720-0004) : injecter une prompt initiale
# à l'agent au lancement, sans avoir à la retaper une fois la session ouverte.
#
# Invariants :
#   (1) --prompt <texte> est accepté par _claude-swt-launch (plus de « Flag inconnu »),
#       donc hérité par claude-swt ET claude-swt-danger.
#   (2) La prompt est passée à `claude` comme 1er argument positionnel, INTACTE —
#       quoting sûr : espaces, accents, apostrophes ET retours de ligne — sur les
#       deux chemins (normal et --dangerously-skip-permissions).
#   (3) --prompt sans valeur → message d'erreur SPÉCIFIQUE (« requiert une valeur »)
#       + AUCUN lancement de claude (return != 0). Discriminant : le message diffère
#       de « Flag inconnu » de v1.5.1 → prouve le NOUVEAU garde, pas l'ancien.
#   (4) --prompt "" (valeur vide explicite) → même rejet spécifique, claude jamais lancé.
#   (5) Sans --prompt → claude est lancé SANS argument (aucune régression).
#   (6) --prompt <valeur> cohabite avec les positionnels [timestamp] [path] sans décalage.
#   (7) Contrat getopt figé : --prompt consomme le token suivant TEL QUEL, même s'il
#       ressemble à un flag (--prompt --db → « --db » EST la prompt). Une prompt peut
#       légitimement commencer par « -- » ; ce test documente/verrouille ce choix.
#
# Discriminant : ROUGE sur claude-swt.sh v1.5.1 (--prompt → « ⛔ Flag inconnu ») pour
#                les scénarios 1/2/3/4 ; VERT après l'ajout du flag.
#
# Le faux `claude` journalise ses arguments (un par ligne, préfixés « ARG| ») ET
# capture son 1er argument INTÉGRALEMENT (multiligne compris) dans un fichier dédié.
#
# Usage : bash scripts/tests/test-claude-swt-prompt.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SRC="${SCRIPTS_DIR}/shell/claude-swt.sh"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
WORK="$(mktemp -d)"
trap 'rm -rf "$PASS_FILE" "$FAIL_FILE" "$WORK"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

# --- faux `claude` : journalise ses arguments (comptage + coexistence) et capture
# son 1er argument INTÉGRALEMENT (préserve les retours de ligne, que le journal
# ligne-à-ligne ne peut pas vérifier). N'écrit RIEN si jamais appelé → l'absence du
# journal prouve que claude n'a pas été lancé.
FAKEBIN="${WORK}/bin"; mkdir -p "$FAKEBIN"
cat > "${FAKEBIN}/claude" <<'EOF'
#!/usr/bin/env bash
: > "${SWT_TEST_ARGS:-/dev/null}"
for a in "$@"; do printf 'ARG|%s\n' "$a" >> "${SWT_TEST_ARGS:-/dev/null}"; done
[ "$#" -ge 1 ] && printf '%s' "$1" > "${SWT_TEST_ARG1:-/dev/null}"   # 1er arg complet, multiligne inclus
exit 0
EOF
chmod +x "${FAKEBIN}/claude"

make_repo() {  # $1 = chemin du repo principal
  local main="$1" origin="${1}.origin.git"
  git init -q --bare "$origin"
  git init -q "$main"
  git -C "$main" config user.email t@t.io
  git -C "$main" config user.name t
  git -C "$main" config commit.gpgsign false
  printf '# seed\n' > "${main}/README.md"
  git -C "$main" add -A
  git -C "$main" commit -qm seed
  git -C "$main" branch -M main
  git -C "$main" remote add origin "$origin"
  git -C "$main" push -q origin main
}

# Source le snippet et lance une commande claude-swt* dans un sous-shell isolé.
# $1=repo $2=journal-args $3=fichier-sortie(stdout+stderr) $4=nom-fonction $@[5..]=args de la fonction.
# SWT_TEST_ARG1 (1er arg complet) est pris de l'environnement s'il est exporté.
# CLAUDE_SWT_NO_AUTOPACK=1 : coupe le pf_auto_pr détaché (hygiène de test).
run_swt() {
  local repo="$1" argsfile="$2" outfile="$3" fn="$4"; shift 4
  ( cd "$repo" \
    && export PATH="${FAKEBIN}:${PATH}" SWT_TEST_ARGS="$argsfile" CLAUDE_SWT_NO_AUTOPACK=1 \
    && source "$SRC" \
    && "$fn" "$@" ) > "$outfile" 2>&1
}

first_arg() { sed -n 's/^ARG|//p' "$1" 2>/dev/null | head -1; }
n_args()    { grep -c '^ARG|' "$1" 2>/dev/null; }

echo "== Scénario S — syntaxe =="
bash -n "$SRC" && ok "claude-swt.sh : bash -n OK" || ko "claude-swt.sh : erreur de syntaxe"

# Prompt volontairement piégeuse : espaces, accents, apostrophe, guillemets ET
# un retour de ligne (le point que le journal ligne-à-ligne ne sait pas vérifier).
PROMPT_TEXT="$(printf 'Corrige le bug : l'\''été où j'\''ai «testé» ça\navec une 2e ligne')"
# Variante mono-ligne (accents/apostrophe/guillemets) pour les scénarios qui lisent
# la prompt via le journal ligne-à-ligne (où un retour de ligne fausserait tail -1).
PROMPT_ONELINE="$(printf "l'été «testé» d'accord")"

echo "== Scénario 1 — --prompt accepté, prompt MULTILIGNE passée INTACTE (mode normal) =="
R1="${WORK}/repo1"; make_repo "$R1"; A1="${WORK}/args1"; O1="${WORK}/out1"; G1="${WORK}/arg1"
SWT_TEST_ARG1="$G1" run_swt "$R1" "$A1" "$O1" claude-swt --prompt "$PROMPT_TEXT" sess1 "${WORK}/wt1"; RC1=$?
if [ "$RC1" -ne 0 ]; then
  ko "claude-swt --prompt a échoué (rc=$RC1) — flag refusé ? (ROUGE attendu sur v1.5.1)"
elif [ ! -f "$A1" ]; then
  ko "claude n'a pas été lancé alors que --prompt était fourni"
else
  GOT1="$(cat "$G1" 2>/dev/null)"
  [ "$GOT1" = "$PROMPT_TEXT" ] \
    && ok "claude a reçu la prompt intacte en 1er arg (accents + apostrophe + guillemets + retour de ligne)" \
    || ko "prompt altérée — attendu '${PROMPT_TEXT}', obtenu '${GOT1}'"
fi

echo "== Scénario 2 — --prompt hérité par claude-swt-danger + coexiste avec --db =="
R2="${WORK}/repo2"; make_repo "$R2"; A2="${WORK}/args2"; O2="${WORK}/out2"; G2="${WORK}/arg2"
SWT_TEST_ARG1="$G2" run_swt "$R2" "$A2" "$O2" claude-swt-danger --db --prompt "$PROMPT_ONELINE" sess2 "${WORK}/wt2"; RC2=$?
if [ "$RC2" -ne 0 ]; then
  ko "claude-swt-danger --db --prompt a échoué (rc=$RC2)"
elif [ ! -f "$A2" ]; then
  ko "claude non lancé en mode danger avec --prompt"
else
  DANGER2="$(first_arg "$A2")"
  PROMPT2="$(sed -n 's/^ARG|//p' "$A2" | tail -1)"   # en danger, la prompt est le DERNIER arg
  { [ "$DANGER2" = "--dangerously-skip-permissions" ] && [ "$PROMPT2" = "$PROMPT_ONELINE" ]; } \
    && ok "mode danger : --dangerously-skip-permissions + prompt intacte tous deux transmis" \
    || ko "danger+prompt mal transmis (1er='${DANGER2}', prompt='${PROMPT2}')"
fi

echo "== Scénario 3 — --prompt SANS valeur → message SPÉCIFIQUE + claude jamais lancé =="
R3="${WORK}/repo3"; make_repo "$R3"; A3="${WORK}/args3"; O3="${WORK}/out3"
run_swt "$R3" "$A3" "$O3" claude-swt --prompt; RC3=$?
if [ "$RC3" -eq 0 ]; then
  ko "--prompt sans valeur a réussi (rc=0) — devrait échouer clairement"
elif [ -f "$A3" ]; then
  ko "claude a été lancé malgré --prompt sans valeur (lancement silencieux)"
elif ! grep -q "requiert une valeur" "$O3"; then
  ko "message d'erreur non spécifique (attendu « requiert une valeur ») — sur v1.5.1 c'était « Flag inconnu »"
else
  ok "--prompt sans valeur → message « requiert une valeur », rc != 0, claude jamais lancé"
fi

echo "== Scénario 4 — --prompt \"\" (valeur vide) → même rejet spécifique =="
R4="${WORK}/repo4"; make_repo "$R4"; A4="${WORK}/args4"; O4="${WORK}/out4"
run_swt "$R4" "$A4" "$O4" claude-swt --prompt "" sess4 "${WORK}/wt4"; RC4=$?
if [ "$RC4" -eq 0 ]; then
  ko "--prompt \"\" a réussi (rc=0) — une valeur vide n'a pas de sens, devrait échouer"
elif [ -f "$A4" ]; then
  ko "claude lancé malgré --prompt vide"
elif ! grep -q "requiert une valeur" "$O4"; then
  ko "--prompt vide : message d'erreur non spécifique"
else
  ok "--prompt \"\" → rejeté avec le même message, claude jamais lancé"
fi

echo "== Scénario 5 — sans --prompt, claude lancé SANS argument (non-régression) =="
R5="${WORK}/repo5"; make_repo "$R5"; A5="${WORK}/args5"; O5="${WORK}/out5"
run_swt "$R5" "$A5" "$O5" claude-swt sess5 "${WORK}/wt5"; RC5=$?
if [ "$RC5" -ne 0 ]; then
  ko "claude-swt sans --prompt a échoué (rc=$RC5)"
elif [ ! -f "$A5" ]; then
  ko "claude non lancé sur invocation normale"
else
  N5="$(n_args "$A5")"
  [ "$N5" -eq 0 ] \
    && ok "claude lancé sans aucun argument (comportement historique préservé)" \
    || ko "claude a reçu ${N5} argument(s) inattendu(s) sans --prompt"
fi

echo "== Scénario 6 — contrat getopt : --prompt --db → « --db » EST la prompt (figé) =="
R6="${WORK}/repo6"; make_repo "$R6"; A6="${WORK}/args6"; O6="${WORK}/out6"; G6="${WORK}/arg6"
SWT_TEST_ARG1="$G6" run_swt "$R6" "$A6" "$O6" claude-swt --prompt --db sess6 "${WORK}/wt6"; RC6=$?
if [ "$RC6" -ne 0 ]; then
  ko "claude-swt --prompt --db a échoué (rc=$RC6) — le token suivant devrait être pris comme prompt"
elif [ ! -f "$G6" ]; then
  ko "claude non lancé — --db aurait dû être consommé comme valeur de --prompt"
else
  GOT6="$(cat "$G6" 2>/dev/null)"
  [ "$GOT6" = "--db" ] \
    && ok "--db consommé comme texte de prompt (getopt standard : une prompt peut commencer par --)" \
    || ko "attendu prompt='--db', obtenu '${GOT6}'"
fi

echo "----------------------------------------"
PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"
FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
