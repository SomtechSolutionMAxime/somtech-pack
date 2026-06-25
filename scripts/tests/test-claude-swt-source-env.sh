#!/usr/bin/env bash
# ============================================================
# test-claude-swt-source-env.sh — v1.0.0
# Vérifie que claude-swt SOURCE le .env du repo principal ($main)
# avant de lancer `claude` dans le worktree (ticket T-20260625-0013).
#
# Pourquoi : Claude Code expanse ${VAR} dans .mcp.json depuis
# l'environnement du PROCESS, pas depuis un fichier. Sans source,
# les MCP référençant ${SOMCRAFT_MCP_API_KEY} sont cassés en worktree.
#
# Stratégie : faux binaire `claude` placé en tête de PATH qui écrit
# la valeur de SOMCRAFT_MCP_API_KEY dans un fichier témoin. Vrai harnais
# git (origin bare + worktree). Le .env vit dans $main (non commité),
# donc absent du worktree → seul le `source` peut peupler la variable.
#
# Scénarios :
#   1. .env présent au $main → la var est visible par `claude`
#   2. .env absent           → la session démarre quand même (pas d'erreur)
#
# Usage : bash scripts/tests/test-claude-swt-source-env.sh
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

# --- faux `claude` : capture la valeur de SOMCRAFT_MCP_API_KEY ---
FAKEBIN="${WORK}/bin"; mkdir -p "$FAKEBIN"
WITNESS="${WORK}/witness"
cat > "${FAKEBIN}/claude" <<EOF
#!/usr/bin/env bash
printf '%s' "\${SOMCRAFT_MCP_API_KEY:-__UNSET__}" > "${WITNESS}"
exit 0
EOF
chmod +x "${FAKEBIN}/claude"

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

run_swt() {  # lance claude-swt dans un sous-shell isolé ; $1=repo $2=session $3=wtpath
  ( cd "$1" \
    && PATH="${FAKEBIN}:${PATH}" \
    && export SOMCRAFT_MCP_API_KEY \
    && source "$SRC" \
    && claude-swt "$2" "$3" ) >/dev/null 2>&1
}

echo "== Scénario F — syntaxe =="
bash -n "$SRC" && ok "claude-swt.sh : bash -n OK" || ko "claude-swt.sh : erreur de syntaxe"

echo "== Scénario 1 — .env présent au \$main est sourcé avant claude =="
R1="${WORK}/repo1"; make_repo "$R1"
printf 'SOMCRAFT_MCP_API_KEY=secret-from-env\n' > "${R1}/.env"
: > "$WITNESS"
run_swt "$R1" "sess1" "${WORK}/wt1"
GOT="$(cat "$WITNESS" 2>/dev/null || true)"
[ "$GOT" = "secret-from-env" ] \
  && ok "claude voit SOMCRAFT_MCP_API_KEY=secret-from-env (provenant du .env)" \
  || ko "attendu 'secret-from-env', obtenu '${GOT}' (le .env n'a pas été sourcé)"

echo "== Scénario 2 — .env absent → la session démarre quand même =="
R2="${WORK}/repo2"; make_repo "$R2"   # pas de .env
: > "$WITNESS"
if run_swt "$R2" "sess2" "${WORK}/wt2"; then
  [ -s "$WITNESS" ] && ok "session lancée sans .env (claude exécuté)" \
    || ko "claude n'a pas été lancé alors qu'il n'y a pas de .env"
else
  ko "claude-swt a échoué quand .env est absent (le source doit être conditionnel)"
fi

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"
FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Résultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
