#!/usr/bin/env bash
# ============================================================
# test-mcp-env.sh — v1.0.0
# La lib du lieu unique des jetons MCP (E-20260807-0009).
#
# Ce que ces cas auraient attrapé, concrètement :
#   · un chargement qui laisse `set -a` actif → toute variable définie ensuite
#     par le rc du shell part dans l'environnement de tous les processus enfants ;
#   · une détection de variables manquantes qui ne regarde que l'en-tête
#     Authorization → le serveur dont le jeton est dans l'URL passe inaperçu
#     (c'est exactement le cas de Somcraft, et il a disparu sans un mot) ;
#   · une lib qui imprime la valeur d'un jeton dans un avertissement ;
#   · `${!v}` (extension bash) utilisé dans une lib que zsh source aussi.
#
# Usage : bash scripts/tests/test-mcp-env.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Injectable pour la campagne de mutation (test-mutations-registre.sh).
SRC="${MCP_ENV_SRC:-$(cd "${SCRIPT_DIR}/.." && pwd)/shell/mcp-env.sh}"

WORK="$(mktemp -d)"; PASS=0; FAIL=0
trap 'rm -rf "$WORK"' EXIT
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

# Jeton factice reconnaissable : s'il fuit quelque part, on le verra.
FAKE="jeton-factice-ne-doit-jamais-sortir-0001"

echo "== Syntaxe =="
bash -n "$SRC" && ok "mcp-env.sh : bash -n OK" || ko "mcp-env.sh : erreur de syntaxe"

echo "== Chargement du lieu unique =="
ENVF="${WORK}/mcp-env"
printf '# commentaire\nSOMTECH_DESK_API_KEY=%s\n\nSOMCRAFT_MCP_API_KEY=autre\n' "$FAKE" > "$ENVF"
chmod 600 "$ENVF"

GOT=$(SOMTECH_MCP_ENV_FILE="$ENVF" bash -c '. "$1"; printf "%s|%s" "${SOMTECH_DESK_API_KEY:-VIDE}" "${SOMCRAFT_MCP_API_KEY:-VIDE}"' _ "$SRC")
[ "$GOT" = "${FAKE}|autre" ] && ok "sourcer la lib exporte les jetons" || ko "attendu '${FAKE}|autre', obtenu '$GOT'"

# Les variables doivent être EXPORTÉES (visibles par un processus enfant), pas
# seulement définies dans le shell : c'est un processus enfant — `claude` — qui
# les lit. Une lib qui oublie `set -a` passe le test précédent et rate celui-ci.
GOT=$(SOMTECH_MCP_ENV_FILE="$ENVF" bash -c '. "$1"; env | grep -c "^SOMTECH_DESK_API_KEY="' _ "$SRC")
[ "$GOT" = "1" ] && ok "les jetons sont exportés, pas seulement définis" || ko "non exportés (env n'en voit aucun)"

echo "== \`set -a\` ne reste PAS actif après le chargement =="
# Sinon toute variable posée ensuite par le rc du shell fuite vers tous les enfants.
GOT=$(SOMTECH_MCP_ENV_FILE="$ENVF" bash -c '. "$1"; APRES=x; env | grep -c "^APRES=" || true' _ "$SRC")
[ "$GOT" = "0" ] && ok "une variable définie après le chargement n'est pas auto-exportée" \
                 || ko "set -a est resté actif — fuite d'environnement"

echo "== Absence du lieu unique : jamais fatal =="
RC=0; SOMTECH_MCP_ENV_FILE="${WORK}/inexistant" bash -c '. "$1"' _ "$SRC" >/dev/null 2>&1 || RC=$?
[ "$RC" = "0" ] && ok "sourcer sans lieu unique sort en 0" || ko "sortie $RC — une session ne s'ouvrirait plus"

echo "== Droits trop larges : averti, mais chargé quand même =="
LOOSE="${WORK}/loose"; cp "$ENVF" "$LOOSE"; chmod 644 "$LOOSE"
ERR=$(SOMTECH_MCP_ENV_FILE="$LOOSE" bash -c '. "$1"' _ "$SRC" 2>&1 >/dev/null)
case "$ERR" in *644*) ok "les droits trop larges sont signalés" ;; *) ko "aucun avertissement sur un fichier en 644" ;; esac
case "$ERR" in *"$FAKE"*) ko "🚨 l'avertissement contient la VALEUR du jeton" ;; *) ok "l'avertissement ne contient aucune valeur de jeton" ;; esac
GOT=$(SOMTECH_MCP_ENV_FILE="$LOOSE" bash -c '. "$1"; printf "%s" "${SOMTECH_DESK_API_KEY:-VIDE}"' _ "$SRC" 2>/dev/null)
[ "$GOT" = "$FAKE" ] && ok "malgré l'avertissement, le jeton est chargé (pas de session privée de registre)" \
                     || ko "le chargement a été refusé pour un défaut de droits"

echo "== Variables référencées par un .mcp.json =="
MCP="${WORK}/.mcp.json"
cat > "$MCP" <<'JSON'
{"mcpServers":{
  "servicedesk":{"type":"http","url":"https://x/y","headers":{"Authorization":"Bearer ${SOMTECH_DESK_API_KEY}"}},
  "somcraft":{"type":"http","url":"https://z/mcp?key=${SOMCRAFT_MCP_API_KEY}"},
  "local":{"command":"node","args":["s.js"]}
}}
JSON
REFS=$(SOMTECH_MCP_ENV_NOLOAD=1 bash -c '. "$1"; mcp_env_refs "$2"' _ "$SRC" "$MCP" | tr '\n' ' ')
[ "$REFS" = "SOMCRAFT_MCP_API_KEY SOMTECH_DESK_API_KEY " ] \
  && ok "les deux variables sont repérées, en-tête ET chaîne de requête" \
  || ko "attendu les deux variables, obtenu '$REFS'"

echo "== Variables manquantes =="
# Somcraft renseigné, ServiceDesk non → une seule doit remonter. Le cas piège :
# une lib qui ne lit que l'en-tête Authorization dirait « rien ne manque » ici.
MISS=$(SOMTECH_MCP_ENV_NOLOAD=1 SOMCRAFT_MCP_API_KEY=present bash -c \
        'unset SOMTECH_DESK_API_KEY; . "$1"; mcp_env_missing "$2"' _ "$SRC" "$MCP" | tr '\n' ' ')
[ "$MISS" = "SOMTECH_DESK_API_KEY " ] && ok "seule la variable réellement absente remonte" \
                                      || ko "attendu 'SOMTECH_DESK_API_KEY ', obtenu '$MISS'"

MISS=$(SOMTECH_MCP_ENV_NOLOAD=1 SOMCRAFT_MCP_API_KEY=a SOMTECH_DESK_API_KEY=b \
        bash -c '. "$1"; mcp_env_missing "$2"' _ "$SRC" "$MCP")
[ -z "$MISS" ] && ok "tout renseigné → aucune variable manquante" || ko "faux positif : '$MISS'"

# Une variable définie mais VIDE est aussi mortelle qu'une variable absente :
# l'en-tête devient « Bearer » tout court et le service répond 401.
MISS=$(SOMTECH_MCP_ENV_NOLOAD=1 SOMCRAFT_MCP_API_KEY=a SOMTECH_DESK_API_KEY= \
        bash -c '. "$1"; mcp_env_missing "$2"' _ "$SRC" "$MCP" | tr '\n' ' ')
[ "$MISS" = "SOMTECH_DESK_API_KEY " ] && ok "une variable VIDE compte comme manquante" \
                                      || ko "une variable vide est passée pour renseignée : '$MISS'"

echo "== Compatibilité zsh (la lib est sourcée par les deux shells) =="
if command -v zsh >/dev/null 2>&1; then
  GOT=$(SOMTECH_MCP_ENV_FILE="$ENVF" zsh -c '. "$1"; printf "%s" "${SOMTECH_DESK_API_KEY:-VIDE}"' _ "$SRC" 2>/dev/null)
  [ "$GOT" = "$FAKE" ] && ok "zsh : chargement OK" || ko "zsh : obtenu '$GOT'"
  MISS=$(SOMTECH_MCP_ENV_NOLOAD=1 zsh -c 'unset SOMTECH_DESK_API_KEY SOMCRAFT_MCP_API_KEY; . "$1"; mcp_env_missing "$2"' _ "$SRC" "$MCP" | tr '\n' ' ')
  [ "$MISS" = "SOMCRAFT_MCP_API_KEY SOMTECH_DESK_API_KEY " ] \
    && ok "zsh : détection des variables manquantes OK (pas de \${!v})" \
    || ko "zsh : obtenu '$MISS' — indirection incompatible ?"
else
  echo "  ⏭️  zsh absent — cas sautés"
fi

echo
echo "Résultat : ${PASS} réussis, ${FAIL} échoués"
[ "$FAIL" -eq 0 ]
