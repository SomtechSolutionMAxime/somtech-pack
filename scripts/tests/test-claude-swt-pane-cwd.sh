#!/usr/bin/env bash
# ============================================================
# test-claude-swt-pane-cwd.sh — v2.0.0
# Vérifie que claude-swt positionne le shell du PANE lui-même sur le
# worktree PENDANT la session, puis restaure le repo principal au quit
# (D-20260719-0001 / T-20260719-0002).
#
# Pourquoi : les outils tiers scopés sur le cwd du pane (ex. plugins
# herdr : `herdr pane list` expose `cwd` = shell du pane) résolvaient le
# repo PRINCIPAL au lieu du worktree, parce que `claude` tournait dans un
# sous-shell `( cd "$wt" … claude )` sans jamais déplacer le shell parent.
#
# Trois propriétés testées :
#   1. PENDANT la session (claude vivant), le shell du pane — un ANCÊTRE du
#      process `claude` — est dans le worktree : aucun ancêtre n'a pour cwd le
#      repo principal. Observé par un faux `claude` qui remonte la chaîne des
#      ancêtres (lsof/proc). RED avant le fix (le pane reste dans $main).
#   2. Au quit avec worktree SALE (conservé) : le pane est restauré sur $main —
#      sinon la reprise `claude-swt <sess>` depuis ce pane recapture le worktree
#      comme $main et casse (régression corrigée). RED si on laisse le pane dans $wt.
#   3. Au quit avec worktree PROPRE + mergé (retiré) : le pane est restauré sur
#      $main, jamais laissé dans un dossier supprimé.
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

realdir() { ( cd "$1" 2>/dev/null && pwd -P ) || printf '%s' "$1"; }

# --- faux `claude` n°1 : INTROSPECTION des ancêtres (propriété 1) --------------
# Pendant qu'il tourne, il remonte la chaîne des process parents et écrit 'in_main'
# si un ancêtre a pour cwd le repo principal ($SWT_TEST_MAIN), 'clean' sinon. Ne
# salit PAS le worktree (teardown → retiré). cwd résolu via /proc (linux) ou lsof (macOS).
FAKEBIN_INTRO="${WORK}/bin-intro"; mkdir -p "$FAKEBIN_INTRO"
cat > "${FAKEBIN_INTRO}/claude" <<'EOF'
#!/usr/bin/env bash
main_norm="$( cd "${SWT_TEST_MAIN:-/nonexistent}" 2>/dev/null && pwd -P )"
cwd_of() {
  local p="$1" c=""
  if [ -r "/proc/$p/cwd" ]; then c="$(readlink "/proc/$p/cwd" 2>/dev/null)"
  else c="$(lsof -a -p "$p" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"; fi
  [ -n "$c" ] && ( cd "$c" 2>/dev/null && pwd -P )
}
# Sonde : si l'introspection ne sait même pas lire NOTRE propre cwd (ni /proc ni
# lsof), tout ancêtre renverra vide → jamais de match → faux 'clean'. On rend le
# verdict 'inconclusive' (traité comme KO) plutôt que de passer en silence.
if [ -z "$(cwd_of "$$")" ]; then printf 'inconclusive' > "${SWT_TEST_WITNESS:-/dev/null}"; exit 0; fi
verdict=clean
pid="$PPID"; i=0
while [ "${pid:-0}" -gt 1 ] 2>/dev/null && [ "$i" -lt 8 ]; do
  c="$(cwd_of "$pid")"
  if [ -n "$main_norm" ] && [ "$c" = "$main_norm" ]; then verdict=in_main; break; fi
  pid="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
  i=$((i+1))
done
printf '%s' "$verdict" > "${SWT_TEST_WITNESS:-/dev/null}"
exit 0
EOF
chmod +x "${FAKEBIN_INTRO}/claude"

# --- faux `claude` n°2 : salit le worktree (propriété 2, worktree conservé) ----
FAKEBIN_DIRTY="${WORK}/bin-dirty"; mkdir -p "$FAKEBIN_DIRTY"
cat > "${FAKEBIN_DIRTY}/claude" <<'EOF'
#!/usr/bin/env bash
touch "./__swt_dirty__.$$" 2>/dev/null || true
exit 0
EOF
chmod +x "${FAKEBIN_DIRTY}/claude"

# --- faux `claude` n°3 : ne fait rien (propriété 3, worktree propre → retiré) --
FAKEBIN_CLEAN="${WORK}/bin-clean"; mkdir -p "$FAKEBIN_CLEAN"
cat > "${FAKEBIN_CLEAN}/claude" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "${FAKEBIN_CLEAN}/claude"

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

# Lance claude-swt dans un sous-shell isolé (analogue du shell du pane) et capture
# le $PWD du shell APPELANT après le retour. $1=repo $2=fakebin $3=session $4=wtpath
# $5=témoin PWD. Passe SWT_TEST_MAIN/SWT_TEST_WITNESS au faux claude (introspection).
run_swt_capture_pwd() {
  ( cd "$1" \
    && export PATH="${2}:${PATH}" SWT_TEST_MAIN="$1" SWT_TEST_WITNESS="${6:-/dev/null}" \
    && source "$SRC" \
    && claude-swt "$3" "$4" \
    ; pwd -P > "$5" ) >/dev/null 2>&1
}

echo "== Scénario S — syntaxe =="
bash -n "$SRC" && ok "claude-swt.sh : bash -n OK" || ko "claude-swt.sh : erreur de syntaxe"

echo "== Scénario 1 — PENDANT la session, le shell du pane est dans le worktree =="
R1="${WORK}/repo1"; make_repo "$R1"
WT1="${WORK}/wt1"; PWD1="${WORK}/pwd1"; INTRO1="${WORK}/intro1"
run_swt_capture_pwd "$R1" "$FAKEBIN_INTRO" "sess1" "$WT1" "$PWD1" "$INTRO1"
VERD1="$(cat "$INTRO1" 2>/dev/null || echo '__nores__')"
case "$VERD1" in
  clean)    ok "aucun ancêtre de \`claude\` n'est dans le repo principal → pane sur le worktree" ;;
  in_main)  ko "un ancêtre de \`claude\` est dans le repo principal → pane pointe \$main (bug herdr)" ;;
  *)        ko "introspection non concluante (verdict='${VERD1}' ; lsof/proc indisponible ?)" ;;
esac

echo "== Scénario 2 — quit avec worktree SALE (conservé) → pane restauré sur \$main =="
R2="${WORK}/repo2"; make_repo "$R2"
WT2="${WORK}/wt2"; PWD2="${WORK}/pwd2"
run_swt_capture_pwd "$R2" "$FAKEBIN_DIRTY" "sess2" "$WT2" "$PWD2"
GOT2="$(realdir "$(cat "$PWD2" 2>/dev/null || echo /nonexistent)")"; WANT2="$(realdir "$R2")"
[ "$GOT2" = "$WANT2" ] \
  && ok "pane restauré sur le repo principal (${WANT2}) — reprise claude-swt <sess> intacte" \
  || ko "attendu \$main '${WANT2}', obtenu '${GOT2}' (pane laissé dans le worktree → reprise cassée)"

echo "== Scénario 3 — quit avec worktree PROPRE + mergé (retiré) → pane restauré sur \$main =="
R3="${WORK}/repo3"; make_repo "$R3"
WT3="${WORK}/wt3"; PWD3="${WORK}/pwd3"
run_swt_capture_pwd "$R3" "$FAKEBIN_CLEAN" "sess3" "$WT3" "$PWD3"
GOT3="$(realdir "$(cat "$PWD3" 2>/dev/null || echo /nonexistent)")"; WANT3="$(realdir "$R3")"
[ "$GOT3" = "$WANT3" ] \
  && ok "pane restauré sur le repo principal (${WANT3}) — jamais un worktree supprimé" \
  || ko "attendu \$main '${WANT3}', obtenu '${GOT3}' (shell laissé dans un worktree retiré ?)"

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"
FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
