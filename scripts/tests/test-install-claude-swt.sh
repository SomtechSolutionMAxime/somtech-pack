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

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"
FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
