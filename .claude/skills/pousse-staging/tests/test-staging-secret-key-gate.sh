#!/usr/bin/env bash
# ============================================================
# test-staging-secret-key-gate.sh — v1.0.0
# Test reproductible du gate cle a droits elevees de /pousse-staging.
#
# Prouve :
#   A. Fichier propre                                  -> rc=0, RAS.
#   B. Vraie cle sb_secret_ (20+ car.)                  -> rc=1, detectee.
#   C. Vrai JWT legacy role=service_role                -> rc=1, detectee
#      (payload DECODE, pas un grep sur le mot).
#   D. JWT role=anon (PAS service_role)                 -> rc=0, ignore
#      (ne bloque pas un anon key ni un JWT de session utilisateur).
#   E. Prose "service_role" / "sb_secret_" SANS cle reelle
#      (reproduit les prompts d'audit du depot)          -> rc=0, ZERO refus a tort.
#   F. Mode "diff" : seul le fichier TOUCHE par la branche
#      est scanne — un secret dans un fichier NON touche  -> rc=0 (hors perimetre,
#      par la branche n'est pas vu.                          "code livre" = diff).
#   G. Mode "tree" : scanne tout le tracked tree, y compris
#      un fichier fautif jamais touche par une branche     -> rc=1, detecte
#      (c'est le filet qui proteg meme sans /pousse-staging).
#   H. python3 introuvable (simule)                     -> rc=2, FAIL-CLOSED
#      (jamais un skip silencieux sur un gate de securite).
#   I. Vraie cle sb_secret_ COUPEE par un retour a la    -> rc=1, detectee
#      ligne litteral (collage/wrap d'editeur — trouve      (2 passes : ligne
#      en revue independante, pas dans le premier jet).      seule + paires).
#
# Usage : bash .claude/skills/pousse-staging/tests/test-staging-secret-key-gate.sh
# Sortie : exit 0 si tous les scenarios passent, 1 sinon.
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${SCRIPT_DIR}/../lib"
# shellcheck source=../lib/staging-secret-key-gate.sh
source "${LIB_DIR}/staging-secret-key-gate.sh"

command -v python3 >/dev/null 2>&1 || { echo "⏭️  python3 absent — tests sautes"; exit 0; }

PASS_FILE="$(mktemp)"
FAIL_FILE="$(mktemp)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

# Genere un JWT (forme reelle, base64url, DECODABLE) avec le role donne.
# Signature volontairement factice : ni le gate ni ce test ne verifient de
# signature, seul le payload decode compte (STD-038 SS3.2).
make_jwt() {
  local role="$1"
  python3 - "$role" <<'PY'
import base64, json, sys
role = sys.argv[1]
def b64(obj):
    raw = json.dumps(obj, separators=(',', ':')).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode()
header = b64({"alg": "HS256", "typ": "JWT"})
payload = b64({"role": role, "iss": "supabase-demo-jetable", "iat": 1700000000})
print(f"{header}.{payload}.signature-non-verifiee-par-le-gate")
PY
}

FAKE_SB_SECRET="sb_secret_$(python3 -c 'import secrets;print(secrets.token_urlsafe(32))')"
JWT_SERVICE_ROLE="$(make_jwt service_role)"
JWT_ANON="$(make_jwt anon)"

echo "== Scenario A — fichier propre (rc=0) =="
F="$(mktemp)"; printf 'ceci est un fichier de code tout a fait ordinaire\n' > "$F"
python3 "${LIB_DIR}/secret-key-scan.py" "$F" >/tmp/skg_out_a 2>&1; rc=$?
[ "$rc" = "0" ] && ok "aucune detection sur un fichier propre" || ko "faux positif sur un fichier propre (rc=$rc)"
rm -f "$F"

echo "== Scenario B — vraie cle sb_secret_ (rc=1, detectee) =="
F="$(mktemp)"; printf 'const key = "%s"\n' "$FAKE_SB_SECRET" > "$F"
out="$(python3 "${LIB_DIR}/secret-key-scan.py" "$F")"; rc=$?
[ "$rc" = "1" ] && ok "sb_secret_ reelle detectee (rc=1)" || ko "sb_secret_ reelle NON detectee (rc=$rc)"
case "$out" in *"$FAKE_SB_SECRET"*) ko "🚨 la VALEUR complete de la cle est imprimee (interdit STD-038 SS2.4)" ;;
               *) ok "la valeur de la cle n'est pas imprimee en clair (extrait tronque)" ;; esac
rm -f "$F"

echo "== Scenario C — vrai JWT role=service_role (rc=1, payload DECODE) =="
F="$(mktemp)"; printf 'SUPABASE_SERVICE_KEY=%s\n' "$JWT_SERVICE_ROLE" > "$F"
python3 "${LIB_DIR}/secret-key-scan.py" "$F" >/dev/null 2>&1; rc=$?
[ "$rc" = "1" ] && ok "JWT role=service_role detecte par decodage du payload" || ko "JWT service_role NON detecte (rc=$rc)"
rm -f "$F"

echo "== Scenario D — JWT role=anon (PAS service_role) — rc=0, ignore =="
F="$(mktemp)"; printf 'SUPABASE_ANON_KEY=%s\n' "$JWT_ANON" > "$F"
python3 "${LIB_DIR}/secret-key-scan.py" "$F" >/dev/null 2>&1; rc=$?
[ "$rc" = "0" ] && ok "JWT role=anon n'est PAS bloque (pas une cle a droits eleves)" || ko "faux positif sur un JWT anon (rc=$rc)"
rm -f "$F"

echo "== Scenario E — prose 'service_role'/'sb_secret_' SANS cle reelle (rc=0) =="
F="$(mktemp)"
cat > "$F" <<'PROSE'
Verifier qu'aucune cle a droits eleves (service_role/sb_secret_...) ne fuite.
Motif a rechercher : service_role, sb_secret_, hors supabase/migrations.
Masquer la preuve : sb_secret_••••
PROSE
python3 "${LIB_DIR}/secret-key-scan.py" "$F" >/dev/null 2>&1; rc=$?
[ "$rc" = "0" ] && ok "prose d'audit (mots nus, sans cle) ne declenche AUCUN refus a tort" \
  || ko "🚨 FAUX POSITIF sur de la prose d'audit legitime (rc=$rc) — le gate serait retire"
rm -f "$F"

echo "== Scenario F — mode diff : fichier NON touche par la branche -> hors perimetre =="
REPO="$(mktemp -d)"
(
  cd "$REPO"
  git init -q; git config user.email t@t.io; git config user.name t; git config commit.gpgsign false
  echo "v0" > propre.txt
  printf 'const key = "%s"\n' "$FAKE_SB_SECRET" > deja-la-avant.txt   # existe AVANT la branche
  git add -A && git commit -qm "init"
  git checkout -qb feat/x
  echo "v1" >> propre.txt                                             # seul fichier TOUCHE par la branche
  git add -A && git commit -qm "feat: touche seulement propre.txt"
)
rc="$(cd "$REPO" && SKG_MODE=diff SKG_BASE_REF=main SKG_PY="${LIB_DIR}/secret-key-scan.py" skg_run_gate >/dev/null 2>&1; echo $?)"
[ "$rc" = "0" ] && ok "mode diff : le secret PRE-EXISTANT hors diff n'est pas vu (perimetre = code livre)" \
  || ko "mode diff aurait du rendre 0 (secret hors diff), a rendu $rc"
rm -rf "$REPO"

echo "== Scenario G — mode tree : filet CI, meme fichier jamais touche par une branche =="
REPO="$(mktemp -d)"
(
  cd "$REPO"
  git init -q; git config user.email t@t.io; git config user.name t; git config commit.gpgsign false
  printf 'const key = "%s"\n' "$FAKE_SB_SECRET" > fautif.txt
  git add -A && git commit -qm "push direct sans passer par le skill"
)
rc="$(cd "$REPO" && SKG_MODE=tree SKG_PY="${LIB_DIR}/secret-key-scan.py" skg_run_gate >/dev/null 2>&1; echo $?)"
[ "$rc" = "1" ] && ok "mode tree (CI) detecte le fautif meme sans passer par /pousse-staging" \
  || ko "mode tree aurait du rendre 1 (filet CI), a rendu $rc"
rm -rf "$REPO"

echo "== Scenario H — python3 introuvable (simule) -> rc=2, FAIL-CLOSED =="
REPO="$(mktemp -d)"
(
  cd "$REPO"
  git init -q; git config user.email t@t.io; git config user.name t; git config commit.gpgsign false
  echo v0 > a.txt; git add -A && git commit -qm init
)
# `bash -c` (processus NEUF, pas un sous-shell `( )`) : une table de hachage
# des commandes deja resolues par CE script (python3 appele dans les
# scenarios precedents) survivrait dans un sous-shell fork() et masquerait
# le PATH vide — un processus bash neuf n'en herite pas.
# /bin/bash en dur (jamais juste "bash") : une fois PATH vide, meme le
# lancement du sous-interprete doit se resoudre sans recherche PATH.
rc="$(cd "$REPO" && PATH="$(mktemp -d)" /bin/bash -c "source '${LIB_DIR}/staging-secret-key-gate.sh'; SKG_MODE=tree skg_run_gate" >/dev/null 2>&1; echo $?)"
[ "$rc" = "2" ] && ok "python3 absent -> FAIL-CLOSED (rc=2), pas un skip silencieux" \
  || ko "python3 absent aurait du rendre 2 (fail-closed), a rendu $rc"
rm -rf "$REPO"

echo "== Scenario I — cle sb_secret_ COUPEE par un retour a la ligne litteral (rc=1) =="
F="$(mktemp)"
HALF1="${FAKE_SB_SECRET:0:20}"
HALF2="${FAKE_SB_SECRET:20}"
printf '%s\n%s\n' "$HALF1" "$HALF2" > "$F"   # la cle coupee EXACTEMENT sur une frontiere de ligne
python3 "${LIB_DIR}/secret-key-scan.py" "$F" >/tmp/skg_out_i 2>&1; rc=$?
[ "$rc" = "1" ] && ok "cle coupee sur 2 lignes detectee (passe 2 — paires de lignes)" \
  || ko "🚨 cle coupee sur 2 lignes NON detectee (rc=$rc) — defaut confirme par la revue portail"
case "$(cat /tmp/skg_out_i)" in *"$FAKE_SB_SECRET"*) ko "🚨 la VALEUR complete de la cle coupee est imprimee" ;;
               *) ok "la valeur de la cle coupee n'est pas imprimee en clair" ;; esac
rm -f "$F" /tmp/skg_out_i

PASS="$(wc -l < "$PASS_FILE" | tr -d ' ')"
FAIL="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "----------------------------------------"
echo "Resultat : ${PASS} OK, ${FAIL} KO"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ] && { echo "✅ TOUS LES SCENARIOS PASSENT"; exit 0; } || { echo "❌ ECHEC"; exit 1; }
