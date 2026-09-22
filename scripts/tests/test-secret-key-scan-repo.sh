#!/usr/bin/env bash
# ============================================================
# test-secret-key-scan-repo.sh — v1.0.0
# Garde CI cle a droits elevees (T-20260922-0072, D-20260921-0017 lot 4,
# garde 1/5) — regle d'or n12, STD-038.
#
# Ce fichier EST la moitie CI de la garde (T-20260922-0072) : auto-decouvert
# par le job `shell-tests` de .github/workflows/tests.yml (glob
# scripts/tests/*.sh), il tient MEME quand personne ne passe par
# /pousse-staging (push direct, autre outil, humain).
#
# Deux parties, dans cet ordre — la premiere avant la seconde, jamais l'une
# sans l'autre :
#   1. AUTO-CONTROLE : le detecteur trouve-t-il un vrai secret INJECTE dans
#      un repo jetable ? Sans cette partie, un CI qui ne trouve rien dans LE
#      DEPOT LUI-MEME (repo actuellement propre) resterait vert meme si le
#      gate etait casse/vide — exactement le "faux temoin" que la regle
#      d'or n6 interdit (un vert qui ne touche pas ce qu'il eprouve).
#   2. SCAN REEL : le meme detecteur, sur le VRAI tracked tree de ce depot
#      (mode "tree", filet CI). Doit rendre RAS.
#
# Usage : bash scripts/tests/test-secret-key-scan-repo.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LIB="${ROOT}/.claude/skills/pousse-staging/lib/staging-secret-key-gate.sh"
PY="${ROOT}/.claude/skills/pousse-staging/lib/secret-key-scan.py"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

command -v python3 >/dev/null 2>&1 || { echo "❌ python3 introuvable — la garde ne peut pas s'executer (fail-closed)"; exit 1; }
[ -r "$LIB" ] || { echo "❌ lib introuvable: $LIB"; exit 1; }
[ -r "$PY" ] || { echo "❌ scanner python introuvable: $PY"; exit 1; }
# shellcheck source=/dev/null
source "$LIB"

echo "== 1. Auto-controle — le detecteur trouve-t-il un VRAI secret injecte ? =="

FAKE_SB_SECRET="sb_secret_$(python3 -c 'import secrets;print(secrets.token_urlsafe(32))')"
JWT_SERVICE_ROLE="$(python3 - <<'PY'
import base64, json
def b64(obj):
    raw = json.dumps(obj, separators=(',', ':')).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode()
print(f"{b64({'alg':'HS256','typ':'JWT'})}.{b64({'role':'service_role','iat':1700000000})}.sig-jetable")
PY
)"

REPO="$(mktemp -d)"
(
  cd "$REPO"
  git init -q; git config user.email t@t.io; git config user.name t; git config commit.gpgsign false
  printf 'export const KEY = "%s"\n' "$FAKE_SB_SECRET" > fautif-sb-secret.ts
  printf 'SUPABASE_SERVICE_KEY=%s\n' "$JWT_SERVICE_ROLE" > fautif-jwt.env
  printf 'On verifie ici service_role et sb_secret_ dans la prose — sans cle reelle.\n' > prose-legitime.md
  git add -A && git commit -qm "fixtures jetables — auto-controle CI"
)
rc="$(cd "$REPO" && SKG_MODE=tree SKG_PY="$PY" skg_run_gate >/dev/null 2>&1; echo $?)"
[ "$rc" = "1" ] && ok "le detecteur trouve les 2 fixtures fautives injectees (rc=1)" \
  || ko "🚨 le detecteur ne trouve RIEN sur des fixtures fautives (rc=$rc) — garde INOPERANTE"

REPO_CLEAN="$(mktemp -d)"
(
  cd "$REPO_CLEAN"
  git init -q; git config user.email t@t.io; git config user.name t; git config commit.gpgsign false
  printf 'aucun secret ici, juste du code ordinaire\n' > propre.ts
  git add -A && git commit -qm "fixture propre"
)
rc_clean="$(cd "$REPO_CLEAN" && SKG_MODE=tree SKG_PY="$PY" skg_run_gate >/dev/null 2>&1; echo $?)"
[ "$rc_clean" = "0" ] && ok "le detecteur ne crie pas sur une fixture propre (rc=0)" \
  || ko "faux positif sur une fixture propre (rc=$rc_clean)"
rm -rf "$REPO" "$REPO_CLEAN"

echo "== 2. Scan reel du depot — trafic REEL, pas des cas fabriques =="

cd "$ROOT"
out="$(SKG_MODE=tree SKG_PY="$PY" skg_run_gate 2>&1)"
rc=$?
n_files="$(git ls-files | wc -l | tr -d ' ')"
if [ "$rc" = "0" ]; then
  ok "ZERO cle a droits elevees detectee sur les ${n_files} fichiers tracked du depot"
else
  ko "🚨 cle(s) a droits elevees DETECTEE(S) dans le depot reel :"
  printf '%s\n' "$out" | sed 's/^/       /'
fi

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"
FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Resultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCENARIOS PASSENT"; exit 0; } || { echo "❌ ECHEC"; exit 1; }
