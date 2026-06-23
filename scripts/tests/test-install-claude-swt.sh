#!/usr/bin/env bash
# ============================================================
# test-install-claude-swt.sh — v1.0.0
# Test de l'installateur idempotent du snippet claude-swt.
#
# Scénarios :
#   A. install frais  → bloc gardé ajouté 1×, fichier copié, ligne préexistante préservée
#   B. ré-install     → IDEMPOTENT (toujours 1 seul bloc)
#   C. update-in-place → changement de --dest met le bloc à jour sans doublon
#   D. dry-run        → n'écrit rien (ni rc ni dest)
#   E. sourcing       → le fichier installé définit bien les 4 fonctions claude-swt*
#   F. syntaxe        → claude-swt.sh et install-claude-swt.sh valides (bash -n)
#
# Usage : bash scripts/tests/test-install-claude-swt.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
INSTALLER="${SCRIPTS_DIR}/install-claude-swt.sh"
SRC="${SCRIPTS_DIR}/shell/claude-swt.sh"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
WORK="$(mktemp -d)"
trap 'rm -rf "$PASS_FILE" "$FAIL_FILE" "$WORK"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

marker_count() { local n; n="$(grep -cF "# >>> somtech claude-swt >>>" "$1" 2>/dev/null || true)"; echo "${n:-0}"; }

echo "== Scénario F — syntaxe =="
bash -n "$SRC" && ok "claude-swt.sh : bash -n OK" || ko "claude-swt.sh : erreur de syntaxe"
bash -n "$INSTALLER" && ok "install-claude-swt.sh : bash -n OK" || ko "install-claude-swt.sh : erreur de syntaxe"

echo "== Scénario A — install frais =="
RC="${WORK}/zshrc"; DEST="${WORK}/dest"
printf '# rc préexistant du dev\nexport FOO=bar\n' > "$RC"
bash "$INSTALLER" --rc "$RC" --dest "$DEST" --src "$SRC" >/dev/null 2>&1
[ "$(marker_count "$RC")" = "1" ] && ok "bloc gardé ajouté (1×)" || ko "attendu 1 bloc, obtenu $(marker_count "$RC")"
[ -f "${DEST}/claude-swt.sh" ] && ok "snippet copié dans dest" || ko "snippet non copié"
grep -qF "export FOO=bar" "$RC" && ok "ligne rc préexistante préservée" || ko "la ligne préexistante a été perdue"

echo "== Scénario B — ré-install idempotent =="
bash "$INSTALLER" --rc "$RC" --dest "$DEST" --src "$SRC" >/dev/null 2>&1
bash "$INSTALLER" --rc "$RC" --dest "$DEST" --src "$SRC" >/dev/null 2>&1
[ "$(marker_count "$RC")" = "1" ] && ok "toujours 1 seul bloc après 3 installs" || ko "DOUBLON : $(marker_count "$RC") blocs"

echo "== Scénario C — update-in-place (nouveau dest) =="
DEST2="${WORK}/dest2"
bash "$INSTALLER" --rc "$RC" --dest "$DEST2" --src "$SRC" >/dev/null 2>&1
[ "$(marker_count "$RC")" = "1" ] && ok "toujours 1 bloc après changement de dest" || ko "DOUBLON après update : $(marker_count "$RC")"
grep -qF "${DEST2}/claude-swt.sh" "$RC" && ok "le bloc pointe vers le nouveau dest" || ko "le bloc ne pointe pas vers le nouveau dest"
grep -qF "${DEST}/claude-swt.sh" "$RC" && ko "l'ancien chemin dest subsiste (doublon larvé)" || ok "ancien chemin dest retiré"

echo "== Scénario D — dry-run n'écrit rien =="
RC2="${WORK}/zshrc-dry"; DEST3="${WORK}/dest-dry"
printf '# vierge\n' > "$RC2"
bash "$INSTALLER" --rc "$RC2" --dest "$DEST3" --src "$SRC" --dry-run >/dev/null 2>&1
[ "$(marker_count "$RC2")" = "0" ] && ok "dry-run n'a pas touché le rc" || ko "dry-run a modifié le rc"
[ ! -d "$DEST3" ] && ok "dry-run n'a pas créé dest" || ko "dry-run a créé dest"

echo "== Scénario E — sourcing définit les fonctions =="
defined="$(bash -c 'source "$1" >/dev/null 2>&1; declare -F claude-swt claude-swt-ls claude-swt-done claude-swt-gc | wc -l' _ "${DEST}/claude-swt.sh" | tr -d ' ')"
[ "$defined" = "4" ] && ok "les 4 fonctions claude-swt* sont définies" || ko "attendu 4 fonctions, obtenu $defined"

echo "== Scénario H — bloc déséquilibré (BEGIN sans END) → refus, pas de troncature =="
RC3="${WORK}/zshrc-corrupt"
printf '# >>> somtech claude-swt >>>\n[ -f x ] && source x\n# (END manquant — corruption)\nexport KEEP_AFTER=2\n' > "$RC3"
if bash "$INSTALLER" --rc "$RC3" --dest "${WORK}/dh" --src "$SRC" >/dev/null 2>&1; then
  ko "l'installateur aurait dû REFUSER un bloc déséquilibré"
else
  ok "installateur refuse le bloc déséquilibré (exit ≠ 0)"
fi
grep -qF "export KEEP_AFTER=2" "$RC3" && ok "ligne après le bloc corrompu préservée (pas de troncature)" \
  || ko "PERTE DE DONNÉES : ligne après bloc corrompu mangée"

echo "== Scénario G — remote-install.sh --with-claude-swt SANS --dry-run sous /bin/bash (régression #1) =="
# Reproduit le one-liner nominal : tableau SWT_ARGS vide + set -u sous bash système (3.2 macOS).
FAKE_HOME="${WORK}/home"; mkdir -p "$FAKE_HOME"
PACK="${WORK}/fakepack"; mkdir -p "$PACK/scripts/shell"
cp "${SCRIPTS_DIR}/remote-install.sh" "$PACK/scripts/"
cp "$INSTALLER"                        "$PACK/scripts/"
cp "$SRC"                              "$PACK/scripts/shell/"
(
  cd "$PACK" && git init -q && git config user.email t@t.io && git config user.name t \
    && git config commit.gpgsign false && git add -A && git commit -qm pack && git branch -M main
) >/dev/null 2>&1
if HOME="$FAKE_HOME" /bin/bash "${SCRIPTS_DIR}/remote-install.sh" \
      --with-claude-swt --repo "file://$PACK" --ref main >/dev/null 2>&1; then
  [ "$(marker_count "$FAKE_HOME/.zshrc")" = "1" ] \
    && ok "remote-install --with-claude-swt (sans --dry-run) installe le bloc sous /bin/bash" \
    || ko "bloc non installé via remote-install (HOME=$FAKE_HOME)"
else
  ko "remote-install --with-claude-swt a échoué sous /bin/bash (régression array vide bash 3.2 ?)"
fi

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"
FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
