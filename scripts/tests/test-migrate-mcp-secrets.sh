#!/usr/bin/env bash
# ============================================================
# test-migrate-mcp-secrets.sh — v1.0.0
# La sortie des jetons en clair du fichier de configuration du poste
# (E-20260807-0009, livrable 3).
#
# CE FICHIER EST PARTAGÉ ET VIVANT — plus de cent projets, et toute session
# ouverte peut le réécrire pendant qu'on le modifie. Ces cas existent pour
# attraper ce qui, sinon, se voit trop tard :
#   · une réécriture qui perd des projets ou des réglages voisins ;
#   · un lieu unique écrit en 0644 (jeton lisible par un autre compte) ;
#   · une configuration réécrite alors que le lieu unique n'a pas pu l'être →
#     référence vers une variable qui n'existe nulle part = registre mort partout ;
#   · une valeur de jeton imprimée en sortie ;
#   · une seconde exécution qui « re-migre » une valeur déjà sous forme ${VAR}.
#
# Aucun test ne touche au vrai ~/.claude.json : tout passe par --config.
#
# Usage : bash scripts/tests/test-migrate-mcp-secrets.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG="${MIGRATE_SRC:-$(cd "${SCRIPT_DIR}/.." && pwd)/migrate-mcp-secrets.py}"

command -v python3 >/dev/null 2>&1 || { echo "⏭️  python3 absent — tests sautés"; exit 0; }

WORK="$(mktemp -d)"; PASS=0; FAIL=0
trap 'rm -rf "$WORK"' EXIT
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

FAKE="jeton-factice-ne-doit-jamais-sortir-0003"
FAKE2="jeton-factice-url-0004"

# Une configuration réaliste : des serveurs MCP ET beaucoup d'autres choses,
# parce que c'est ce voisinage qu'une réécriture maladroite emporte.
make_conf() {
  python3 - "$1" "$FAKE" "$FAKE2" <<'PY'
import json, sys
path, tok, tok2 = sys.argv[1], sys.argv[2], sys.argv[3]
conf = {
  "numStartups": 412,
  "userID": "abc123",
  "mcpServers": {
    "servicedesk": {"type": "http", "url": "https://svc/functions/v1/mcp",
                    "headers": {"Authorization": f"Bearer {tok}"}},
    "somcraft":    {"type": "http", "url": f"https://docs/api/mcp?key={tok2}"},
    "deja-propre": {"type": "http", "url": "https://x/y",
                    "headers": {"Authorization": "Bearer ${DEJA_VARIABLE}"}},
    "local":       {"command": "node", "args": ["serveur.js"]},
  },
  "projects": {f"/chemin/projet-{i}": {"allowedTools": [], "lastCost": i * 0.01,
                                       "hasTrustDialogAccepted": True} for i in range(102)},
}
json.dump(conf, open(path, "w"), ensure_ascii=False, indent=2)
PY
}

CONF="${WORK}/claude.json"; ENVF="${WORK}/somtech/mcp-env"
make_conf "$CONF"
BEFORE_PROJECTS=$(python3 -c "import json,sys;print(len(json.load(open(sys.argv[1]))['projects']))" "$CONF")

echo "== Inspection seule : n'écrit rien =="
SUM=$(python3 "$MIG" --config "$CONF" --env-file "$ENVF" 2>&1)
[ ! -e "$ENVF" ] && ok "sans --apply, aucun lieu unique créé" || ko "le lieu unique a été écrit sans --apply"
grep -q "$FAKE" "$CONF" && ok "sans --apply, la configuration est intacte" || ko "la configuration a été modifiée sans --apply"
case "$SUM" in *"$FAKE"*|*"$FAKE2"*) ko "🚨 l'inspection imprime une VALEUR de jeton" ;;
               *) ok "l'inspection n'imprime aucune valeur de jeton" ;; esac
case "$SUM" in *servicedesk*) ok "l'inspection nomme les serveurs concernés" ;;
               *) ko "l'inspection ne nomme pas les serveurs" ;; esac

echo "== Application =="
OUT=$(python3 "$MIG" --config "$CONF" --env-file "$ENVF" --apply 2>&1); RC=$?
[ "$RC" = "0" ] && ok "l'application sort en 0" || ko "sortie $RC : $OUT"
case "$OUT" in *"$FAKE"*|*"$FAKE2"*) ko "🚨 le compte rendu imprime une VALEUR de jeton" ;;
               *) ok "le compte rendu n'imprime aucune valeur de jeton" ;; esac

echo "== Le jeton a quitté la configuration =="
grep -q "$FAKE" "$CONF"  && ko "🚨 le jeton de l'en-tête est encore en clair" || ok "le jeton de l'en-tête a disparu de la configuration"
grep -q "$FAKE2" "$CONF" && ko "🚨 le jeton de l'URL est encore en clair"     || ok "le jeton de l'URL a disparu de la configuration"
python3 - "$CONF" <<'PY' && echo >/dev/null
import json, sys
c = json.load(open(sys.argv[1]))["mcpServers"]
assert c["servicedesk"]["headers"]["Authorization"] == "Bearer ${SOMTECH_DESK_API_KEY}", c["servicedesk"]
assert c["somcraft"]["url"].endswith("?key=${SOMCRAFT_MCP_API_KEY}"), c["somcraft"]
assert c["deja-propre"]["headers"]["Authorization"] == "Bearer ${DEJA_VARIABLE}"
assert c["local"] == {"command": "node", "args": ["serveur.js"]}
PY
[ $? -eq 0 ] && ok "chaque emplacement porte la bonne variable, les autres serveurs sont intacts" \
             || ko "les emplacements réécrits sont faux"

echo "== Le voisinage n'a pas bougé =="
AFTER_PROJECTS=$(python3 -c "import json,sys;print(len(json.load(open(sys.argv[1]))['projects']))" "$CONF")
[ "$AFTER_PROJECTS" = "$BEFORE_PROJECTS" ] && ok "les $BEFORE_PROJECTS projets sont tous là" \
                                           || ko "projets : $BEFORE_PROJECTS → $AFTER_PROJECTS (perte)"
python3 -c "
import json,sys
c=json.load(open(sys.argv[1]))
assert c['numStartups']==412 and c['userID']=='abc123'
assert c['projects']['/chemin/projet-7']['lastCost']==0.07
" "$CONF" && ok "les réglages voisins sont identiques au bit près" || ko "un réglage voisin a été altéré"

echo "== Le lieu unique =="
[ -f "$ENVF" ] && ok "le lieu unique existe" || ko "le lieu unique n'a pas été créé"
PERMS=$(stat -f '%Lp' "$ENVF" 2>/dev/null || stat -c '%a' "$ENVF" 2>/dev/null)
[ "$PERMS" = "600" ] && ok "droits 600" || ko "droits $PERMS — le jeton est lisible par d'autres"
grep -qx "SOMTECH_DESK_API_KEY=${FAKE}" "$ENVF"  && ok "le jeton de l'en-tête est déposé sans le préfixe Bearer" \
                                                 || ko "jeton d'en-tête mal déposé"
grep -qx "SOMCRAFT_MCP_API_KEY=${FAKE2}" "$ENVF" && ok "le jeton de l'URL est déposé" || ko "jeton d'URL mal déposé"

echo "== Sauvegarde =="
[ -f "${CONF}.somtech.bak" ] && ok "une sauvegarde a été prise avant réécriture" || ko "aucune sauvegarde"
grep -q "$FAKE" "${CONF}.somtech.bak" && ok "la sauvegarde porte bien l'état d'avant" || ko "la sauvegarde ne contient pas l'état d'avant"

echo "== Idempotence =="
OUT=$(python3 "$MIG" --config "$CONF" --env-file "$ENVF" --apply 2>&1); RC=$?
[ "$RC" = "0" ] && ok "seconde exécution : sortie 0" || ko "seconde exécution : sortie $RC"
case "$OUT" in *"aucun jeton en clair"*) ok "seconde exécution : rien à faire (pas de re-migration d'un \${VAR})" ;;
               *) ko "seconde exécution a retrouvé du travail : $OUT" ;; esac

echo "== JSON invalide : édition refusée, fichier intact =="
BADC="${WORK}/bad.json"; printf '{"mcpServers": {oops\n' > "$BADC"
BEFORE=$(cksum < "$BADC")
OUT=$(python3 "$MIG" --config "$BADC" --env-file "${WORK}/e2" --apply 2>&1); RC=$?
[ "$RC" != "0" ] && ok "JSON invalide : sortie non nulle" || ko "JSON invalide accepté"
[ "$(cksum < "$BADC")" = "$BEFORE" ] && ok "JSON invalide : fichier laissé strictement intact" || ko "le fichier invalide a été réécrit"

echo "== Collision de variable : refus plutôt qu'écrasement =="
CONF2="${WORK}/c2.json"; ENV2="${WORK}/e3/mcp-env"
make_conf "$CONF2"; mkdir -p "$(dirname "$ENV2")"
printf 'SOMTECH_DESK_API_KEY=un-AUTRE-jeton-deja-la\n' > "$ENV2"; chmod 600 "$ENV2"
OUT=$(python3 "$MIG" --config "$CONF2" --env-file "$ENV2" --apply 2>&1); RC=$?
[ "$RC" != "0" ] && ok "collision : sortie non nulle" || ko "collision : la valeur existante a été écrasée"
grep -qx "SOMTECH_DESK_API_KEY=un-AUTRE-jeton-deja-la" "$ENV2" && ok "collision : la valeur existante est préservée" \
                                                              || ko "collision : la valeur existante a été perdue"
grep -q "$FAKE" "$CONF2" && ok "collision : la configuration n'a pas été touchée" \
                         || ko "collision : la configuration a été réécrite malgré l'échec"
case "$OUT" in *"$FAKE"*|*"un-AUTRE-jeton-deja-la"*) ko "🚨 le message de collision imprime une valeur" ;;
               *) ok "le message de collision n'imprime aucune valeur" ;; esac

echo "== Une réécriture qui abîmerait le voisinage est REFUSÉE avant d'écrire =="
# La garde que la revue de fond a retirée sans qu'un seul test bronche. Elle
# protège contre NOTRE propre erreur : si une évolution future de la réécriture
# emportait des projets, rien ne doit atteindre le disque. On vérifie avant
# d'écrire, précisément pour n'avoir jamais à restaurer par-dessus une session tierce.
CONF7="${WORK}/c7.json"; ENV7="${WORK}/e8/mcp-env"
make_conf "$CONF7"
BEFORE7=$(cksum < "$CONF7")
OUT=$(SOMTECH_MIGRATE_TEST_ABIME=1 python3 "$MIG" --config "$CONF7" --env-file "$ENV7" --apply 2>&1); RC=$?
[ "$RC" != "0" ] && ok "réécriture abîmée : sortie non nulle" || ko "une réécriture qui perd les projets est passée"
case "$OUT" in *"rien n'a été écrit"*) ok "l'abandon dit explicitement que rien n'a été écrit" ;;
               *) ko "message inattendu : $OUT" ;; esac
[ "$(cksum < "$CONF7")" = "$BEFORE7" ] && ok "le fichier partagé est intact au bit près" \
                                       || ko "🚨 le fichier a été touché malgré le refus"
[ ! -f "${CONF7}.somtech.bak" ] && ok "aucune sauvegarde inutile : on n'a jamais commencé à écrire" \
                               || ko "une sauvegarde a été prise alors que rien ne devait être écrit"

echo "== Une session tierce écrit pendant l'opération : on ABANDONNE, on n'écrase pas =="
# Le cas que le docstring du script dit vouloir couvrir, et que rien n'éprouvait :
# la revue de fond a retiré la garde et la suite est restée verte. Elle ne le
# restera plus. Le point d'injection simule une autre session qui réécrit le
# fichier juste avant notre bascule.
CONF5="${WORK}/c5.json"; ENV5="${WORK}/e6/mcp-env"
make_conf "$CONF5"
TIERS="${WORK}/tiers.py"
cat > "$TIERS" <<PYEOF
import json, sys
c = json.load(open("${CONF5}"))
c["projects"]["/chemin/ajoute-par-une-autre-session"] = {"allowedTools": [], "lastCost": 9.99}
json.dump(c, open("${CONF5}", "w"), ensure_ascii=False, indent=2)
PYEOF
OUT=$(SOMTECH_MIGRATE_TEST_HOOK="python3 '$TIERS'" \
      python3 "$MIG" --config "$CONF5" --env-file "$ENV5" --apply 2>&1); RC=$?
[ "$RC" != "0" ] && ok "écriture concurrente : sortie non nulle" || ko "l'écriture concurrente est passée inaperçue"
case "$OUT" in *"autre session"*) ok "l'abandon nomme la cause" ;; *) ko "cause non nommée : $OUT" ;; esac
python3 -c "
import json,sys
c=json.load(open(sys.argv[1]))
assert '/chemin/ajoute-par-une-autre-session' in c['projects'], 'travail de la session tierce PERDU'
" "$CONF5" && ok "le travail de la session tierce est intact" || ko "🚨 le travail de la session tierce a été effacé"
grep -q "$FAKE" "$CONF5" && ok "notre écriture n'a pas eu lieu (relançable)" || ko "la configuration a été réécrite malgré l'abandon"

echo "== Sans écriture concurrente, la migration passe normalement =="
CONF6="${WORK}/c6.json"; ENV6="${WORK}/e7/mcp-env"
make_conf "$CONF6"
OUT=$(SOMTECH_MIGRATE_TEST_HOOK="true" python3 "$MIG" --config "$CONF6" --env-file "$ENV6" --apply 2>&1); RC=$?
[ "$RC" = "0" ] && ok "point d'injection inoffensif : la migration aboutit" || ko "sortie $RC : $OUT"
grep -q "$FAKE" "$CONF6" && ko "le jeton est resté en clair" || ok "le jeton a bien été sorti"

echo "== Import depuis un .env de dépôt (--from-env) =="
# Un serveur déclaré au SEUL niveau projet n'a jamais eu de jeton au poste : sans
# import, il reste muet sur les trois portes de naissance qui ne passent pas par
# le lanceur. C'est le cas de Somcraft, et il disparaissait sans un mot.
CONF3="${WORK}/c3.json"; ENV3="${WORK}/e4/mcp-env"; REPOENV="${WORK}/depot.env"
make_conf "$CONF3"
printf 'SOMCRAFT_MCP_API_KEY=%s\nAUTRE_JETON=xyz\n' "$FAKE2" > "$REPOENV"
OUT=$(python3 "$MIG" --config "$CONF3" --env-file "$ENV3" --from-env "$REPOENV" --apply 2>&1); RC=$?
[ "$RC" = "0" ] && ok "import sans conflit : sortie 0" || ko "import sans conflit : sortie $RC — $OUT"
grep -qx "SOMCRAFT_MCP_API_KEY=${FAKE2}" "$ENV3" && ok "le jeton du dépôt a rejoint le lieu unique" \
                                                 || ko "le jeton du dépôt n'a pas été importé"
grep -qx "AUTRE_JETON=xyz" "$ENV3" && ok "les autres variables du .env suivent aussi" || ko "variable voisine perdue"
grep -q "$FAKE2" "$REPOENV" && ok "le .env du dépôt n'est pas modifié" || ko "🚨 le .env du dépôt a été touché"
case "$OUT" in *"$FAKE2"*) ko "🚨 le compte rendu d'import imprime une valeur" ;;
               *) ok "le compte rendu d'import n'imprime aucune valeur" ;; esac

echo "== Conflit à l'import : signalé, non écrasé, et sans dommage collatéral =="
# Deux déclarations vivantes pour la même variable. Choisir à la place de l'humain
# risquerait de basculer le poste sur une clé qu'il s'apprête à révoquer. Mais
# bloquer l'import des AUTRES variables serait le demi-fix qu'on refuse.
CONF4="${WORK}/c4.json"; ENV4="${WORK}/e5/mcp-env"; REPOENV2="${WORK}/depot2.env"
make_conf "$CONF4"; mkdir -p "$(dirname "$ENV4")"
printf 'SOMCRAFT_MCP_API_KEY=valeur-deja-en-place\n' > "$ENV4"; chmod 600 "$ENV4"
printf 'SOMCRAFT_MCP_API_KEY=valeur-differente\nNOUVELLE_VAR=ok\n' > "$REPOENV2"
OUT=$(python3 "$MIG" --config "$CONF4" --env-file "$ENV4" --from-env "$REPOENV2" --apply 2>&1); RC=$?
[ "$RC" != "0" ] && ok "conflit : sortie non nulle (la décision ne doit pas se perdre)" \
                 || ko "conflit passé sous silence"
case "$OUT" in *"À TRANCHER"*) ok "conflit : nommé explicitement" ;; *) ko "conflit non nommé : $OUT" ;; esac
grep -qx "SOMCRAFT_MCP_API_KEY=valeur-deja-en-place" "$ENV4" && ok "conflit : la valeur en place est conservée" \
                                                             || ko "🚨 la valeur en place a été écrasée"
grep -qx "NOUVELLE_VAR=ok" "$ENV4" && ok "conflit : les variables SANS conflit sont quand même importées" \
                                   || ko "un conflit a bloqué l'import des autres variables (demi-fix)"
case "$OUT" in *valeur-deja-en-place*|*valeur-differente*) ko "🚨 le message de conflit imprime une valeur" ;;
               *) ok "le message de conflit n'imprime aucune valeur" ;; esac

echo
echo "Résultat : ${PASS} réussis, ${FAIL} échoués"
[ "$FAIL" -eq 0 ]
