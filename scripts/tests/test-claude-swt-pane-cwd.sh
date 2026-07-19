#!/usr/bin/env bash
# ============================================================
# test-claude-swt-pane-cwd.sh — v1.0.0
# Vérifie que claude-swt positionne le shell du PANE lui-même sur le
# worktree — pas seulement le sous-shell de lancement de `claude`
# (D-20260719-0001 / T-20260719-0002).
#
# Pourquoi : les outils tiers scopés sur le cwd du pane (ex. plugins
# herdr : `herdr pane list` expose `cwd` = shell du pane) résolvaient le
# repo PRINCIPAL au lieu du worktree, parce que `claude` tournait dans un
# sous-shell `( cd "$wt" … claude )` sans jamais déplacer le shell parent.
#
# Stratégie : le shell appelant (analogue du shell du pane) écrit son
# $PWD APRÈS le retour de claude-swt. On force les deux terminaisons :
#   1. worktree laissé SALE → conservé au teardown → le shell DOIT rester
#      dans le worktree (cwd == worktree). RED avant le fix (cwd == $main).
#   2. worktree PROPRE + mergé → retiré au teardown → le shell DOIT être
#      restauré sur le repo principal ($main), jamais laissé dans un
#      dossier supprimé.
#
# Usage : bash scripts/tests/test-claude-swt-pane-cwd.sh
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

# Résout un chemin absolu (symlinks compris) pour comparer sans faux négatif
# (/tmp -> /private/tmp sur macOS, worktree add résout les liens, etc.).
realdir() { ( cd "$1" 2>/dev/null && pwd -P ) || printf '%s' "$1"; }

# --- deux faux `claude` : l'un salit le worktree, l'autre non ------------------
FAKEBIN_DIRTY="${WORK}/bin-dirty"; mkdir -p "$FAKEBIN_DIRTY"
cat > "${FAKEBIN_DIRTY}/claude" <<'EOF'
#!/usr/bin/env bash
# tourne dans le worktree (sous-shell) → y crée un fichier non suivi = worktree SALE
touch "./__swt_dirty__.$$" 2>/dev/null || true
exit 0
EOF
chmod +x "${FAKEBIN_DIRTY}/claude"

FAKEBIN_CLEAN="${WORK}/bin-clean"; mkdir -p "$FAKEBIN_CLEAN"
cat > "${FAKEBIN_CLEAN}/claude" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "${FAKEBIN_CLEAN}/claude"

# --- monte un repo avec origin bare (claude-swt fait fetch + worktree add origin/main) ---
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

# Lance claude-swt dans un sous-shell isolé (analogue du shell du pane) et
# capture le $PWD du shell APPELANT après le retour. $1=repo $2=fakebin
# $3=session $4=wtpath $5=fichier témoin pour le PWD.
run_swt_capture_pwd() {
  ( cd "$1" \
    && PATH="${2}:${PATH}" \
    && source "$SRC" \
    && claude-swt "$3" "$4" \
    ; pwd -P > "$5" ) >/dev/null 2>&1
}

echo "== Scénario S — syntaxe =="
bash -n "$SRC" && ok "claude-swt.sh : bash -n OK" || ko "claude-swt.sh : erreur de syntaxe"

echo "== Scénario 1 — worktree SALE → le shell du pane reste sur le worktree =="
R1="${WORK}/repo1"; make_repo "$R1"
WT1="${WORK}/wt1"; PWD_WITNESS1="${WORK}/pwd1"
run_swt_capture_pwd "$R1" "$FAKEBIN_DIRTY" "sess1" "$WT1" "$PWD_WITNESS1"
GOT1="$(realdir "$(cat "$PWD_WITNESS1" 2>/dev/null || echo /nonexistent)")"
WANT1="$(realdir "$WT1")"
[ "$GOT1" = "$WANT1" ] \
  && ok "cwd du shell appelant == worktree (${WANT1})" \
  || ko "attendu worktree '${WANT1}', obtenu '${GOT1}' (le pane pointe le repo principal → herdr résout le mauvais repo)"

echo "== Scénario 2 — worktree PROPRE + mergé → shell restauré sur \$main =="
R2="${WORK}/repo2"; make_repo "$R2"
WT2="${WORK}/wt2"; PWD_WITNESS2="${WORK}/pwd2"
run_swt_capture_pwd "$R2" "$FAKEBIN_CLEAN" "sess2" "$WT2" "$PWD_WITNESS2"
GOT2="$(realdir "$(cat "$PWD_WITNESS2" 2>/dev/null || echo /nonexistent)")"
WANT2="$(realdir "$R2")"
[ "$GOT2" = "$WANT2" ] \
  && ok "cwd du shell appelant restauré sur le repo principal (${WANT2}) — jamais un worktree supprimé" \
  || ko "attendu repo principal '${WANT2}', obtenu '${GOT2}' (shell laissé dans un worktree retiré ?)"

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"
FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
