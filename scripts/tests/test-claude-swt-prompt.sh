#!/usr/bin/env bash
# ============================================================
# test-claude-swt-prompt.sh — v1.0.0
# Contrat du flag --prompt (T-20260720-0004) : injecter une prompt initiale
# à l'agent au lancement, sans avoir à la retaper une fois la session ouverte.
#
# Invariants :
#   (1) --prompt <texte> est accepté par _claude-swt-launch (plus de « Flag inconnu »),
#       donc hérité par claude-swt ET claude-swt-danger.
#   (2) La prompt est passée à `claude` comme 1er argument positionnel, INTACTE
#       (quoting sûr : espaces, accents, apostrophes) — sur les deux chemins
#       (normal et --dangerously-skip-permissions).
#   (3) --prompt sans valeur → erreur claire + AUCUN lancement de claude (return != 0).
#   (4) Sans --prompt → claude est lancé SANS argument (aucune régression).
#   (5) --prompt cohabite avec les positionnels [timestamp] [path] sans décalage.
#
# Discriminant : ROUGE sur claude-swt.sh v1.5.1 (--prompt → « ⛔ Flag inconnu »),
#                VERT après l'ajout du flag.
#
# Le faux `claude` écrit TOUS ses arguments (un par ligne, préfixés) dans un
# fichier témoin ($SWT_TEST_ARGS) → on vérifie exactement ce que claude a reçu.
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

# --- faux `claude` : journalise ses arguments (propriétés 2, 4, 5) -------------
# Une ligne par argument reçu, préfixée « ARG| » (préserve les valeurs vides et
# évite toute ambiguïté de séparateur). N'écrit RIEN si jamais appelé → l'absence
# du fichier témoin prouve que claude n'a pas été lancé (propriété 3).
FAKEBIN="${WORK}/bin"; mkdir -p "$FAKEBIN"
cat > "${FAKEBIN}/claude" <<'EOF'
#!/usr/bin/env bash
: > "${SWT_TEST_ARGS:-/dev/null}"
for a in "$@"; do printf 'ARG|%s\n' "$a" >> "${SWT_TEST_ARGS:-/dev/null}"; done
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
# $1=repo $2=fichier-témoin-args $3=nom-fonction (claude-swt|claude-swt-danger)
# $@[4..] = arguments passés à la fonction. Renvoie le code retour de la fonction.
run_swt() {
  local repo="$1" argsfile="$2" fn="$3"; shift 3
  ( cd "$repo" \
    && export PATH="${FAKEBIN}:${PATH}" SWT_TEST_ARGS="$argsfile" \
    && source "$SRC" \
    && "$fn" "$@" ) >/dev/null 2>&1
}

# Extrait la valeur du 1er argument journalisé par le faux claude (ou vide).
first_arg() { sed -n 's/^ARG|//p' "$1" 2>/dev/null | head -1; }
n_args()    { grep -c '^ARG|' "$1" 2>/dev/null; }

echo "== Scénario S — syntaxe =="
bash -n "$SRC" && ok "claude-swt.sh : bash -n OK" || ko "claude-swt.sh : erreur de syntaxe"

PROMPT_TEXT="Corrige le bug d'accents : l'été où j'ai «testé» ça"

echo "== Scénario 1 — --prompt accepté, prompt passée INTACTE à claude (mode normal) =="
R1="${WORK}/repo1"; make_repo "$R1"; A1="${WORK}/args1"
run_swt "$R1" "$A1" claude-swt --prompt "$PROMPT_TEXT" sess1 "${WORK}/wt1"; RC1=$?
if [ "$RC1" -ne 0 ]; then
  ko "claude-swt --prompt a échoué (rc=$RC1) — flag refusé ? (ROUGE attendu sur v1.5.1)"
elif [ ! -f "$A1" ]; then
  ko "claude n'a pas été lancé alors que --prompt était fourni"
else
  GOT1="$(first_arg "$A1")"
  [ "$GOT1" = "$PROMPT_TEXT" ] \
    && ok "claude a reçu la prompt intacte en 1er argument" \
    || ko "prompt altérée — attendu '${PROMPT_TEXT}', obtenu '${GOT1}'"
fi

echo "== Scénario 2 — --prompt hérité par claude-swt-danger + coexiste avec --db =="
R2="${WORK}/repo2"; make_repo "$R2"; A2="${WORK}/args2"
run_swt "$R2" "$A2" claude-swt-danger --db --prompt "$PROMPT_TEXT" sess2 "${WORK}/wt2"; RC2=$?
if [ "$RC2" -ne 0 ]; then
  ko "claude-swt-danger --db --prompt a échoué (rc=$RC2)"
elif [ ! -f "$A2" ]; then
  ko "claude non lancé en mode danger avec --prompt"
else
  # danger → 1er arg = --dangerously-skip-permissions, la prompt vient APRÈS
  DANGER2="$(first_arg "$A2")"
  PROMPT2="$(sed -n 's/^ARG|//p' "$A2" | grep -Fx "$PROMPT_TEXT" | head -1)"
  { [ "$DANGER2" = "--dangerously-skip-permissions" ] && [ "$PROMPT2" = "$PROMPT_TEXT" ]; } \
    && ok "mode danger : --dangerously-skip-permissions + prompt intacte tous deux transmis" \
    || ko "danger+prompt mal transmis (1er='${DANGER2}', prompt trouvée='${PROMPT2}')"
fi

echo "== Scénario 3 — --prompt SANS valeur → erreur + claude jamais lancé =="
R3="${WORK}/repo3"; make_repo "$R3"; A3="${WORK}/args3"
run_swt "$R3" "$A3" claude-swt --prompt; RC3=$?
if [ "$RC3" -eq 0 ]; then
  ko "--prompt sans valeur a réussi (rc=0) — devrait échouer clairement"
elif [ -f "$A3" ]; then
  ko "claude a été lancé malgré --prompt sans valeur (lancement silencieux)"
else
  ok "--prompt sans valeur → return != 0 et claude jamais lancé"
fi

echo "== Scénario 4 — sans --prompt, claude lancé SANS argument (non-régression) =="
R4="${WORK}/repo4"; make_repo "$R4"; A4="${WORK}/args4"
run_swt "$R4" "$A4" claude-swt sess4 "${WORK}/wt4"; RC4=$?
if [ "$RC4" -ne 0 ]; then
  ko "claude-swt sans --prompt a échoué (rc=$RC4)"
elif [ ! -f "$A4" ]; then
  ko "claude non lancé sur invocation normale"
else
  N4="$(n_args "$A4")"
  [ "$N4" -eq 0 ] \
    && ok "claude lancé sans aucun argument (comportement historique préservé)" \
    || ko "claude a reçu ${N4} argument(s) inattendu(s) sans --prompt"
fi

echo "----------------------------------------"
PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"
FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
