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

# ⚠️ L'ISOLATION D'ABORD (T-20260816-0046). Sans elle, les sous-shells héritent des jetons du
# poste : le faux « claude » rapporte alors la VRAIE valeur, les comparaisons échouent, et les
# messages ci-dessous la recopiaient en clair. C'est arrivé — une revue a exposé une vraie clé
# Somcraft dans sa transcription en lançant ce fichier. Un essai qui mesure l'environnement de
# celui qui le lance ne mesure pas le code ; et quand il le raconte, il le divulgue.
for cle in SOMTECH_DESK_API_KEY SOMCRAFT_MCP_API_KEY; do unset "$cle"; done

# Jeton factice reconnaissable : s'il fuit quelque part, on le verra.
FAKE="jeton-factice-ne-doit-jamais-sortir-0001"

# ⚠️ ON QUALIFIE, ON NE RECOPIE PAS. La valeur attendue est factice ; une valeur INATTENDUE peut
# être un secret vivant, et c'est précisément celle que les messages d'échec montraient.
qualifier() {
  case "$1" in
    "$FAKE")     printf 'la valeur attendue' ;;
    autre)       printf 'la seconde valeur du lieu unique' ;;
    __ABSENT__)  printf 'rien — la variable n’est pas arrivée' ;;
    '')          printf 'aucun témoin écrit' ;;
    *)           printf 'une AUTRE valeur, non affichée : elle peut être un secret vivant' ;;
  esac
}

echo "== Syntaxe =="
bash -n "$SRC" && ok "mcp-env.sh : bash -n OK" || ko "mcp-env.sh : erreur de syntaxe"

echo "== L'enveloppe fournit les jetons au processus lancé =="
ENVF="${WORK}/mcp-env"
printf '# commentaire\nSOMTECH_DESK_API_KEY=%s\n\nSOMCRAFT_MCP_API_KEY=autre\n' "$FAKE" > "$ENVF"
chmod 600 "$ENVF"

# Faux `claude` : rapporte ce qu'il a REÇU dans son environnement.
FAKEBIN="${WORK}/bin"; mkdir -p "$FAKEBIN"
cat > "${FAKEBIN}/claude" <<'FAKE_EOF'
#!/usr/bin/env bash
printf '%s|%s' "${SOMTECH_DESK_API_KEY:-VIDE}" "${SOMCRAFT_MCP_API_KEY:-VIDE}"
FAKE_EOF
chmod +x "${FAKEBIN}/claude"

GOT=$(SOMTECH_MCP_ENV_FILE="$ENVF" PATH="${FAKEBIN}:${PATH}" bash -c '. "$1"; claude' _ "$SRC")
[ "$GOT" = "${FAKE}|autre" ] && ok "le processus lancé par l'\''enveloppe reçoit les jetons" \
                             || ko "obtenu $(qualifier "$GOT")"

# Les variables doivent être EXPORTÉES (visibles par un processus enfant), pas
# seulement définies dans le shell : c'est un processus enfant — `claude` — qui
# les lit. Une lib qui oublie `set -a` passe le test précédent et rate celui-ci.
echo "== …mais le SHELL de l'utilisateur, lui, n'en porte aucun =="
# C'est tout l'intérêt de l'enveloppe : un \`npm install\`, un outil tiers qui vide
# \`env\`, un rapport de plantage lancé depuis ce même terminal ne doivent pas voir
# les jetons. Un export global passerait le cas précédent et raterait celui-ci.
GOT=$(SOMTECH_MCP_ENV_FILE="$ENVF" PATH="${FAKEBIN}:${PATH}" \
       bash -c '. "$1"; claude >/dev/null; env | grep -c "^SOMTECH_DESK_API_KEY=" || true' _ "$SRC")
[ "$GOT" = "0" ] && ok "après l'\''appel, le shell ne porte aucun jeton" \
                 || ko "le jeton a fui dans le shell (exposition élargie à tout le terminal)"

echo "== Le code de sortie de \`claude\` est propagé =="
cat > "${FAKEBIN}/claude" <<'FAKE_EOF'
#!/usr/bin/env bash
printf '%s|%s' "${SOMTECH_DESK_API_KEY:-VIDE}" "${SOMCRAFT_MCP_API_KEY:-VIDE}"
exit 42
FAKE_EOF
chmod +x "${FAKEBIN}/claude"
RC=0; SOMTECH_MCP_ENV_FILE="$ENVF" PATH="${FAKEBIN}:${PATH}" bash -c '. "$1"; claude' _ "$SRC" >/dev/null 2>&1 || RC=$?
[ "$RC" = "42" ] && ok "sortie 42 propagée telle quelle" || ko "sortie $RC — l'enveloppe change le comportement de la chaîne d'appel"
cat > "${FAKEBIN}/claude" <<'FAKE_EOF'
#!/usr/bin/env bash
printf '%s|%s' "${SOMTECH_DESK_API_KEY:-VIDE}" "${SOMCRAFT_MCP_API_KEY:-VIDE}"
FAKE_EOF
chmod +x "${FAKEBIN}/claude"

echo "== Préséance : une valeur déjà fournie l'emporte sur le lieu unique =="
# Le lieu unique est un FILET, pas une autorité. Un dépôt qui déclare son propre
# jeton doit garder le sien — sinon on bascule silencieusement tout un projet sur
# la clé du poste, et personne ne le voit avant un refus d'accès en production.
GOT=$(SOMTECH_MCP_ENV_FILE="$ENVF" PATH="${FAKEBIN}:${PATH}" \
       SOMTECH_DESK_API_KEY=valeur-du-depot bash -c '. "$1"; claude' _ "$SRC")
case "$GOT" in
  valeur-du-depot\|*) ok "la valeur déjà fournie est conservée" ;;
  *) ko "le lieu unique a écrasé la valeur du dépôt : $(qualifier "$GOT")" ;;
esac
case "$GOT" in
  *\|autre) ok "la variable absente est bien comblée par le lieu unique" ;;
  *) ko "la variable manquante n'a pas été comblée : $(qualifier "$GOT")" ;;
esac

echo "== Sans lieu unique, l'enveloppe lance quand même \`claude\` =="
GOT=$(SOMTECH_MCP_ENV_FILE="${WORK}/inexistant" PATH="${FAKEBIN}:${PATH}" bash -c '. "$1"; claude' _ "$SRC")
[ "$GOT" = "VIDE|VIDE" ] && ok "session ouverte sans jeton (le hook de naissance prendra le relais)" \
                         || ko "obtenu $(qualifier "$GOT") — l'enveloppe a empêché le lancement"

echo "== Un chargement explicite EXPORTE vraiment (le lanceur s'en sert en ceinture) =="
# claude-swt appelle mcp_env_load explicitement dans son sous-shell, en plus de
# l'enveloppe. Si cette fonction cessait d'EXPORTER, elle définirait des variables
# que le processus enfant ne verrait jamais — panne silencieuse sur cette voie-là.
GOT=$(SOMTECH_MCP_ENV_FILE="$ENVF" bash -c '. "$1"; mcp_env_load; env | grep -c "^SOMTECH_DESK_API_KEY="' _ "$SRC")
[ "$GOT" = "1" ] && ok "les jetons chargés sont exportés, pas seulement définis" \
                 || ko "non exportés (un processus enfant n'en verrait aucun)"

echo "== \`set -a\` ne reste PAS actif après un chargement explicite =="
# Sinon toute variable posée ensuite fuite vers tous les processus enfants.
GOT=$(SOMTECH_MCP_ENV_FILE="$ENVF" bash -c '. "$1"; mcp_env_load; APRES=x; env | grep -c "^APRES=" || true' _ "$SRC")
[ "$GOT" = "0" ] && ok "une variable définie après le chargement n'est pas auto-exportée" \
                 || ko "set -a est resté actif — fuite d'environnement"

echo "== Absence du lieu unique : jamais fatal =="
RC=0; SOMTECH_MCP_ENV_FILE="${WORK}/inexistant" bash -c '. "$1"; mcp_env_load' _ "$SRC" >/dev/null 2>&1 || RC=$?
[ "$RC" = "0" ] && ok "sourcer sans lieu unique sort en 0" || ko "sortie $RC — une session ne s'ouvrirait plus"

echo "== Droits trop larges : averti, mais chargé quand même =="
LOOSE="${WORK}/loose"; cp "$ENVF" "$LOOSE"; chmod 644 "$LOOSE"
ERR=$(SOMTECH_MCP_ENV_FILE="$LOOSE" bash -c '. "$1"; mcp_env_load' _ "$SRC" 2>&1 >/dev/null)
case "$ERR" in *644*) ok "les droits trop larges sont signalés" ;; *) ko "aucun avertissement sur un fichier en 644" ;; esac
case "$ERR" in *"$FAKE"*) ko "🚨 l'avertissement contient la VALEUR du jeton" ;; *) ok "l'avertissement ne contient aucune valeur de jeton" ;; esac
GOT=$(SOMTECH_MCP_ENV_FILE="$LOOSE" bash -c '. "$1"; mcp_env_load; printf "%s" "${SOMTECH_DESK_API_KEY:-VIDE}"' _ "$SRC" 2>/dev/null)
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
REFS=$(SOMTECH_MCP_ENV_NOWRAP=1 bash -c '. "$1"; mcp_env_refs "$2"' _ "$SRC" "$MCP" | tr '\n' ' ')
[ "$REFS" = "SOMCRAFT_MCP_API_KEY SOMTECH_DESK_API_KEY " ] \
  && ok "les deux variables sont repérées, en-tête ET chaîne de requête" \
  || ko "attendu les deux variables, obtenu '$REFS'"

echo "== Variables manquantes =="
# Somcraft renseigné, ServiceDesk non → une seule doit remonter. Le cas piège :
# une lib qui ne lit que l'en-tête Authorization dirait « rien ne manque » ici.
MISS=$(SOMTECH_MCP_ENV_NOWRAP=1 SOMCRAFT_MCP_API_KEY=present bash -c \
        'unset SOMTECH_DESK_API_KEY; . "$1"; mcp_env_missing "$2"' _ "$SRC" "$MCP" | tr '\n' ' ')
[ "$MISS" = "SOMTECH_DESK_API_KEY " ] && ok "seule la variable réellement absente remonte" \
                                      || ko "attendu 'SOMTECH_DESK_API_KEY ', obtenu '$MISS'"

MISS=$(SOMTECH_MCP_ENV_NOWRAP=1 SOMCRAFT_MCP_API_KEY=a SOMTECH_DESK_API_KEY=b \
        bash -c '. "$1"; mcp_env_missing "$2"' _ "$SRC" "$MCP")
[ -z "$MISS" ] && ok "tout renseigné → aucune variable manquante" || ko "faux positif : '$MISS'"

# Une variable définie mais VIDE est aussi mortelle qu'une variable absente :
# l'en-tête devient « Bearer » tout court et le service répond 401.
MISS=$(SOMTECH_MCP_ENV_NOWRAP=1 SOMCRAFT_MCP_API_KEY=a SOMTECH_DESK_API_KEY= \
        bash -c '. "$1"; mcp_env_missing "$2"' _ "$SRC" "$MCP" | tr '\n' ' ')
[ "$MISS" = "SOMTECH_DESK_API_KEY " ] && ok "une variable VIDE compte comme manquante" \
                                      || ko "une variable vide est passée pour renseignée : '$MISS'"

echo "== Compatibilité zsh (la lib est sourcée par les deux shells) =="
if command -v zsh >/dev/null 2>&1; then
  GOT=$(SOMTECH_MCP_ENV_FILE="$ENVF" PATH="${FAKEBIN}:${PATH}" zsh -c '. "$1"; claude' _ "$SRC" 2>/dev/null)
  [ "$GOT" = "${FAKE}|autre" ] && ok "zsh : l'enveloppe fournit les jetons" || ko "zsh : obtenu '$GOT'"
  GOT=$(SOMTECH_MCP_ENV_FILE="$ENVF" PATH="${FAKEBIN}:${PATH}" \
         zsh -c '. "$1"; claude >/dev/null; env | grep -c "^SOMTECH_DESK_API_KEY=" || true' _ "$SRC" 2>/dev/null)
  [ "$GOT" = "0" ] && ok "zsh : aucun jeton ne reste dans le shell" || ko "zsh : fuite dans le shell"
  MISS=$(SOMTECH_MCP_ENV_NOWRAP=1 zsh -c 'unset SOMTECH_DESK_API_KEY SOMCRAFT_MCP_API_KEY; . "$1"; mcp_env_missing "$2"' _ "$SRC" "$MCP" | tr '\n' ' ')
  [ "$MISS" = "SOMCRAFT_MCP_API_KEY SOMTECH_DESK_API_KEY " ] \
    && ok "zsh : détection des variables manquantes OK (pas de \${!v})" \
    || ko "zsh : obtenu '$MISS' — indirection incompatible ?"
else
  echo "  ⏭️  zsh absent — cas sautés"
fi

echo "== Aucun test ne peut approcher le lieu unique RÉEL du poste =="
# Ce cas existe parce que c'est arrivé : un test qui sourçait le lanceur sans
# borner le lieu unique a fait imprimer un VRAI jeton dans une sortie de test.
# Corriger les fichiers un à un n'empêche pas le prochain d'oublier — la règle
# est donc vérifiée mécaniquement, pour tous les tests, à chaque exécution.
NON_BORNES=""
for f in "${SCRIPT_DIR}"/*.sh; do
  case "$(basename "$f")" in test-mcp-env.sh) continue ;; esac
  grep -qE 'claude-swt\.sh|mcp-env\.sh' "$f" || continue
  grep -q 'SOMTECH_MCP_ENV_FILE' "$f" || NON_BORNES="${NON_BORNES} $(basename "$f")"
done
[ -z "$NON_BORNES" ] && ok "tous les tests qui touchent la lib bornent le lieu unique" \
                     || ko "🚨 test(s) sans borne — un vrai jeton peut atteindre leur sortie :${NON_BORNES}"

echo
echo "Résultat : ${PASS} réussis, ${FAIL} échoués"
[ "$FAIL" -eq 0 ]
