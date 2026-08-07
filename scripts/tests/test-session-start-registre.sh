#!/usr/bin/env bash
# ============================================================
# test-session-start-registre.sh — v1.0.0
# Le hook qui fait dire à un agent, À SA NAISSANCE, que son registre est muet
# (E-20260807-0009, livrable 4).
#
# Ce que ces cas auraient attrapé :
#   · un hook qui charge lui-même le lieu unique avant de diagnostiquer → il voit
#     des variables que les serveurs MCP n'ont jamais eues, conclut que tout va
#     bien, et l'agent repart travailler une heure avant de découvrir le contraire.
#     C'est LE piège de ce lot : le double plus indulgent que le vrai service ;
#   · un hook bavard quand tout va bien → on cesse de le lire, donc il ne sert plus ;
#   · un hook qui imprime la valeur d'un jeton dans son message ;
#   · un hook qui sort en ≠0 et empêche la session de s'ouvrir.
#
# Usage : bash scripts/tests/test-session-start-registre.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
HOOK="${REGISTRE_HOOK_SRC:-${ROOT}/.claude/hooks/session-start-registre.sh}"
LIB="${MCP_ENV_SRC:-${ROOT}/scripts/shell/mcp-env.sh}"

WORK="$(mktemp -d)"; PASS=0; FAIL=0
trap 'rm -rf "$WORK"' EXIT
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

FAKE="jeton-factice-ne-doit-jamais-sortir-0002"

PROJ="${WORK}/projet"; mkdir -p "$PROJ"
cat > "${PROJ}/.mcp.json" <<'JSON'
{"mcpServers":{
  "servicedesk":{"type":"http","url":"https://x/y","headers":{"Authorization":"Bearer ${SOMTECH_DESK_API_KEY}"}},
  "somcraft":{"type":"http","url":"https://z/mcp?key=${SOMCRAFT_MCP_API_KEY}"}
}}
JSON

# Lieu unique GARNI : le hook ne doit surtout pas s'en servir pour se rassurer.
ENVF="${WORK}/mcp-env"
printf 'SOMTECH_DESK_API_KEY=%s\nSOMCRAFT_MCP_API_KEY=%s\n' "$FAKE" "$FAKE" > "$ENVF"
chmod 600 "$ENVF"

run_hook() {  # $1 = with-vars | no-vars ; $2 = with-lib | no-lib
  local libarg="" ; [ "$2" = "with-lib" ] && libarg="$LIB"
  if [ "$1" = "with-vars" ]; then
    env CLAUDE_PROJECT_DIR="$PROJ" SOMTECH_MCP_ENV_LIB="$libarg" SOMTECH_MCP_ENV_FILE="$ENVF" \
        SOMTECH_DESK_API_KEY=x SOMCRAFT_MCP_API_KEY=y bash "$HOOK" 2>&1
  else
    env -u SOMTECH_DESK_API_KEY -u SOMCRAFT_MCP_API_KEY \
        CLAUDE_PROJECT_DIR="$PROJ" SOMTECH_MCP_ENV_LIB="$libarg" SOMTECH_MCP_ENV_FILE="$ENVF" \
        bash "$HOOK" 2>&1
  fi
}

echo "== Syntaxe =="
bash -n "$HOOK" && ok "hook : bash -n OK" || ko "hook : erreur de syntaxe"

echo "== Registre muet : le hook le dit =="
for LIBMODE in with-lib no-lib; do
  OUT=$(run_hook no-vars "$LIBMODE")
  case "$OUT" in *"REGISTRE INJOIGNABLE"*) ok "[$LIBMODE] l'alerte est levée" ;;
                 *) ko "[$LIBMODE] aucune alerte alors que les deux jetons manquent" ;; esac
  case "$OUT" in *servicedesk*) ok "[$LIBMODE] le serveur muet est nommé" ;;
                 *) ko "[$LIBMODE] le message ne nomme pas le serveur" ;; esac
  case "$OUT" in *somcraft*) ok "[$LIBMODE] le serveur dont le jeton est dans l'URL est nommé aussi" ;;
                 *) ko "[$LIBMODE] somcraft manquant — la détection ignore la chaîne de requête" ;; esac
  case "$OUT" in *"$FAKE"*) ko "[$LIBMODE] 🚨 le message contient une VALEUR de jeton" ;;
                 *) ok "[$LIBMODE] aucune valeur de jeton dans le message" ;; esac
done

echo "== Le hook ne se rassure PAS avec le lieu unique =="
# Le lieu unique est garni, mais la SESSION n'a pas les variables. Un hook qui
# chargerait le fichier verrait tout en ordre et se tairait : c'est le double
# plus indulgent que le vrai service, et c'est le défaut à ne pas reproduire.
OUT=$(run_hook no-vars with-lib)
case "$OUT" in *"REGISTRE INJOIGNABLE"*) ok "lieu unique garni mais session vide → l'alerte est quand même levée" ;;
               *) ko "🚨 le hook s'est rassuré avec le lieu unique au lieu de lire la session" ;; esac

echo "== Registre joignable : silence =="
for LIBMODE in with-lib no-lib; do
  OUT=$(run_hook with-vars "$LIBMODE")
  [ -z "$OUT" ] && ok "[$LIBMODE] silencieux quand tout va bien" || ko "[$LIBMODE] bavard : '$OUT'"
done

echo "== Jamais bloquant =="
RC=0; run_hook no-vars with-lib >/dev/null 2>&1 || RC=$?
[ "$RC" = "0" ] && ok "sort en 0 même quand il alerte" || ko "sortie $RC — la session serait empêchée"

NOMCP="${WORK}/sans-mcp"; mkdir -p "$NOMCP"
RC=0; OUT=$(CLAUDE_PROJECT_DIR="$NOMCP" bash "$HOOK" 2>&1) || RC=$?
[ "$RC" = "0" ] && [ -z "$OUT" ] && ok "projet sans .mcp.json : silencieux et sortie 0" \
                                 || ko "projet sans .mcp.json : rc=$RC out='$OUT'"

echo "== Un .mcp.json sans variable du tout ne déclenche rien =="
LIT="${WORK}/litteral"; mkdir -p "$LIT"
printf '{"mcpServers":{"local":{"command":"node","args":["s.js"]}}}\n' > "${LIT}/.mcp.json"
OUT=$(CLAUDE_PROJECT_DIR="$LIT" SOMTECH_MCP_ENV_LIB="$LIB" bash "$HOOK" 2>&1)
[ -z "$OUT" ] && ok "serveur local sans variable : silencieux" || ko "faux positif : '$OUT'"

echo
echo "Résultat : ${PASS} réussis, ${FAIL} échoués"
[ "$FAIL" -eq 0 ]
