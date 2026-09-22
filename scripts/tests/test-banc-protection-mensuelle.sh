#!/usr/bin/env bash
# ============================================================
# test-banc-protection-mensuelle.sh — v1.0.0
# Banc unitaire de `banc-protection-mensuelle.sh` — T-20260922-0106,
# garde 5/5 (dernière) du lot 4, D-20260921-0017.
#
# Fixtures synthétiques MINCES (pas le corpus réel — voir
# test-banc-protection-mensuelle-corpus.sh pour ça) : un mini-dépôt jetable
# construit dans un tmpdir, un corpus JSON minimal par cas, chaque critère
# du ticket isolé.
#
# Usage : bash scripts/tests/test-banc-protection-mensuelle.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LIB="${BPM_LIB:-${ROOT}/.claude/skills/orchestrer-chantier/lib/banc-protection-mensuelle.sh}"

[ -f "$LIB" ] || { echo "❌ lib absente: $LIB"; exit 1; }

PASS=0; FAIL=0
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# ---- mini-dépôt jetable ----
DEPOT="${WORK}/depot"
mkdir -p "${DEPOT}/.claude/skills/x/lib" "${DEPOT}/.claude/skills/x/tests" "${DEPOT}/.claude/docs" "${DEPOT}/scripts/tests"

echo '# mecanisme fictif — porte la citation MARQUEUR_MECHA' > "${DEPOT}/.claude/skills/x/lib/mecha.sh"
echo '# banc fictif — porte la citation MARQUEUR_MECHA aussi' > "${DEPOT}/.claude/skills/x/tests/test-mecha.sh"
echo '# doc de prose — porte la citation MARQUEUR_PROSE, jamais dans un lib/ ni un test' > "${DEPOT}/.claude/docs/note.md"
echo '# genere par heuristique generique — citation MARQUEUR_GENERIQUE ici' > "${DEPOT}/.claude/skills/x/lib/generique.sh"
echo '# test associe au mecanisme generique — MARQUEUR_GENERIQUE aussi' > "${DEPOT}/scripts/tests/test-generique.sh"
echo '# texte qui contredit une regle — porte MARQUEUR_CONTREDIT' > "${DEPOT}/.claude/docs/contredisant.md"

# corpus JSON générique — un paramètre swapé par cas (voir sed ci-dessous)
corpus_json() {
  cat > "${WORK}/corpus.json" <<JSON
{
  "entries": [ $1 ]
}
JSON
}

executer() {
  # executer <corpus-json-fragment> [env supplementaire...]
  local fragment="$1"; shift
  corpus_json "$fragment"
  unset BPM_SOURCE_CASSEE BPM_ETAT_PRECEDENT BPM_ETAT_SORTIE BPM_CORPUS_JSON BPM_RACINE_DEPOT
  export BPM_CORPUS_JSON="${WORK}/corpus.json"
  export BPM_RACINE_DEPOT="$DEPOT"
  local a
  for a in "$@"; do
    export "${a%%=*}=${a#*=}"
  done
  OUT="$(bash "$LIB" 2>"${WORK}/stderr")"
  RC=$?
  ERR="$(cat "${WORK}/stderr")"
}

champ() { printf '%s\n' "$OUT" | sed -n "s/^$1=//p"; }

echo "== Discriminant 1 : protege (mecanisme+banc existent, citation trouvee) =="
executer '{
  "id": "R-PROTEGE",
  "citations_attendues": ["MARQUEUR_MECHA"],
  "mecanisme_connu": {"chemin": ".claude/skills/x/lib/mecha.sh", "banc": ".claude/skills/x/tests/test-mecha.sh"}
}'
[ "$(champ REGLE_R_PROTEGE_CLASSE)" = "protege" ] && ok "mecanisme+banc+citation -> protege" || ko "attendu protege, obtenu $(champ REGLE_R_PROTEGE_CLASSE)"
[ "$(champ REGLE_R_PROTEGE_MECANISME)" = ".claude/skills/x/lib/mecha.sh" ] && ok "REGLE_..._MECANISME cite le bon chemin" || ko "MECANISME manquant ou faux: $(champ REGLE_R_PROTEGE_MECANISME)"
[ "$(champ REGLE_R_PROTEGE_AUDITE)" = "oui" ] && ok "AUDITE=oui pour un protege issu de mecanisme_connu (verifie, pas une coincidence)" || ko "attendu AUDITE=oui, obtenu $(champ REGLE_R_PROTEGE_AUDITE)"

echo "== Discriminant 2 : prose (citation trouvee mais mecanisme incomplet — banc absent) =="
executer '{
  "id": "R-PROSE",
  "citations_attendues": ["MARQUEUR_MECHA"],
  "mecanisme_connu": {"chemin": ".claude/skills/x/lib/mecha.sh", "banc": ".claude/skills/x/tests/inexistant.sh"}
}'
[ "$(champ REGLE_R_PROSE_CLASSE)" = "prose" ] && ok "banc absent -> prose (pas protege a tort)" || ko "attendu prose, obtenu $(champ REGLE_R_PROSE_CLASSE)"

echo "== Discriminant 2-bis : prose (citation trouvee mais mecanisme incomplet — CHEMIN absent, banc present) =="
executer '{
  "id": "R-PROSE-CHEMIN",
  "citations_attendues": ["MARQUEUR_MECHA"],
  "mecanisme_connu": {"chemin": ".claude/skills/x/lib/inexistant.sh", "banc": ".claude/skills/x/tests/test-mecha.sh"}
}'
[ "$(champ REGLE_R_PROSE_CHEMIN_CLASSE)" = "prose" ] && ok "chemin mecanisme absent -> prose (pas protege a tort)" || ko "attendu prose, obtenu $(champ REGLE_R_PROSE_CHEMIN_CLASSE)"

echo "== Discriminant 3 : non_etabli — jamais 'absent' (aucune citation trouvee nulle part) =="
executer '{
  "id": "R-NONETABLI",
  "citations_attendues": ["CECI_NEXISTE_NULLE_PART_XYZ"],
  "mecanisme_connu": {"chemin": ".claude/skills/x/lib/mecha.sh", "banc": ".claude/skills/x/tests/test-mecha.sh"}
}'
[ "$(champ REGLE_R_NONETABLI_CLASSE)" = "non_etabli" ] && ok "rien trouve -> non_etabli" || ko "attendu non_etabli, obtenu $(champ REGLE_R_NONETABLI_CLASSE)"
[ "$(champ REGLE_R_NONETABLI_CLASSE)" != "absent" ] && ok "jamais la valeur 'absent' (critere #3 du ticket)" || ko "a rendu 'absent' — interdit"

echo "== Discriminant 1-bis — RÉGRESSION (revue de fond) : citation trouvée AILLEURS dans le dépôt, PAS dans le mécanisme/banc déclaré -> jamais protege =="
echo "   (défaut réel trouvé en revue avant fusion : la citation était cherchée n'importe où dans le dépôt scanné,"
echo "    pas dans les fichiers 'chemin'/'banc' déclarés — un mécanisme VIDÉ DE SON CONTENU aurait quand même rendu"
echo "    'protege' tant que la chaîne cherchée traînait ailleurs, ex. dans un SKILL.md sans rapport)"
executer '{
  "id": "R-MECANISME-VIDE",
  "citations_attendues": ["MARQUEUR_PROSE"],
  "mecanisme_connu": {"chemin": ".claude/skills/x/lib/mecha.sh", "banc": ".claude/skills/x/tests/test-mecha.sh"}
}'
[ "$(champ REGLE_R_MECANISME_VIDE_CLASSE)" = "prose" ] \
  && ok "citation ailleurs (docs/note.md), absente du mecanisme/banc déclaré -> prose, PAS protege" \
  || ko "attendu prose, obtenu $(champ REGLE_R_MECANISME_VIDE_CLASSE) (BUG : le mecanisme_connu a été crédité d'une citation qu'il ne porte pas)"
[ -z "$(champ REGLE_R_MECANISME_VIDE_MECANISME)" ] \
  && ok "aucun REGLE_..._MECANISME émis (cohérent avec prose, pas protege)" \
  || ko "REGLE_..._MECANISME émis alors que la classe n'est pas protege : $(champ REGLE_R_MECANISME_VIDE_MECANISME)"

echo "== Discriminant 1-ter — RÉGRESSION (2e tour de revue de fond) : mécanisme VIDÉ (chemin sans citation), banc intact qui cite -> jamais protege =="
echo "   (défaut réel, reproduit sur STD-038 réel du corpus : staging-secret-key-gate.sh vidé à 0 octet restait"
echo "    'protege' parce que test-staging-secret-key-gate.sh, normalement nommé d'après ce qu'il teste, cite encore"
echo "    la même chaîne — un fichier de test ne prouve RIEN sur l'état du mécanisme qu'il est censé éprouver)"
: > "${DEPOT}/.claude/skills/x/lib/vide.sh"
executer '{
  "id": "R-MECANISME-GUTTED",
  "citations_attendues": ["MARQUEUR_MECHA"],
  "mecanisme_connu": {"chemin": ".claude/skills/x/lib/vide.sh", "banc": ".claude/skills/x/tests/test-mecha.sh"}
}'
[ "$(champ REGLE_R_MECANISME_GUTTED_CLASSE)" = "prose" ] \
  && ok "chemin vidé (0 octet) mais banc intact qui cite -> prose, PAS protege" \
  || ko "attendu prose, obtenu $(champ REGLE_R_MECANISME_GUTTED_CLASSE) (BUG : le banc de test crédite le mécanisme d'une citation qu'il ne porte plus lui-même)"

echo "== Discriminant 4 : contredit (fichier contredisant existe, citation trouvee dedans) =="
executer '{
  "id": "R-CONTREDIT",
  "date_source": "2026-01-01",
  "citations_attendues": ["MARQUEUR_CONTREDIT"],
  "contredit_par": {"fichier": ".claude/docs/contredisant.md"}
}'
[ "$(champ REGLE_R_CONTREDIT_CLASSE)" = "contredit" ] && ok "contredit_par verifie -> contredit" || ko "attendu contredit, obtenu $(champ REGLE_R_CONTREDIT_CLASSE)"
[ "$(champ REGLE_R_CONTREDIT_DATE_A)" = "2026-01-01" ] && ok "DATE_A = date_source du JSON" || ko "DATE_A faux: $(champ REGLE_R_CONTREDIT_DATE_A)"
DATE_B="$(champ REGLE_R_CONTREDIT_DATE_B)"
if [ -n "$DATE_B" ] && [ "$DATE_B" != "[non mesure]" ]; then
  ok "DATE_B renseignee (mesuree en direct, pas figee) : ${DATE_B}"
else
  ko "DATE_B absente ou non mesuree: '${DATE_B}'"
fi

echo "== Discriminant 5 : contredit_par dont le fichier n'existe pas dans CE depot -> non_etabli (jamais invente) =="
executer '{
  "id": "R-CONTREDIT-ABSENT",
  "citations_attendues": ["MARQUEUR_CONTREDIT"],
  "contredit_par": {"fichier": ".claude/docs/nexiste-pas-ici.md"}
}'
[ "$(champ REGLE_R_CONTREDIT_ABSENT_CLASSE)" = "non_etabli" ] && ok "fichier contredisant absent du depot -> non_etabli" || ko "attendu non_etabli, obtenu $(champ REGLE_R_CONTREDIT_ABSENT_CLASSE)"

echo "== Discriminant 6 : heuristique generique (pas de mecanisme_connu ni contredit_par) — protege si code+test =="
executer '{
  "id": "R-GENERIQUE-PROTEGE",
  "citations_attendues": ["MARQUEUR_GENERIQUE"]
}'
[ "$(champ REGLE_R_GENERIQUE_PROTEGE_CLASSE)" = "protege" ] && ok "citation dans lib/ ET dans un test -> protege (heuristique generique)" || ko "attendu protege, obtenu $(champ REGLE_R_GENERIQUE_PROTEGE_CLASSE)"
echo "   RÉGRESSION (3e tour de revue de fond) — un protege de l'heuristique generique peut etre une COINCIDENCE (repro reel : STD-030 du corpus)"
[ "$(champ REGLE_R_GENERIQUE_PROTEGE_AUDITE)" = "non" ] \
  && ok "AUDITE=non pour un protege de l'heuristique generique — jamais confondu avec un protege verifie" \
  || ko "attendu AUDITE=non, obtenu $(champ REGLE_R_GENERIQUE_PROTEGE_AUDITE) (BUG : un protege par coincidence se ferait passer pour un protege prouve)"

echo "== Discriminant 7 : heuristique generique — prose si citation seulement en prose =="
executer '{
  "id": "R-GENERIQUE-PROSE",
  "citations_attendues": ["MARQUEUR_PROSE"]
}'
[ "$(champ REGLE_R_GENERIQUE_PROSE_CLASSE)" = "prose" ] && ok "citation en prose seule -> prose" || ko "attendu prose, obtenu $(champ REGLE_R_GENERIQUE_PROSE_CLASSE)"

echo "== Source cassee : BPM_SOURCE_CASSEE=oui -> AUCUN classement, VERDICT_GLOBAL=SOURCE_CASSEE, rc=4 =="
executer '{"id": "R-PROTEGE", "citations_attendues": ["MARQUEUR_MECHA"], "mecanisme_connu": {"chemin": ".claude/skills/x/lib/mecha.sh", "banc": ".claude/skills/x/tests/test-mecha.sh"}}' BPM_SOURCE_CASSEE=oui
[ "$RC" -eq 4 ] && ok "rc=4 sur source cassee" || ko "rc attendu 4, obtenu ${RC}"
[ "$(champ VERDICT_GLOBAL)" = "SOURCE_CASSEE" ] && ok "VERDICT_GLOBAL=SOURCE_CASSEE" || ko "VERDICT_GLOBAL faux: $(champ VERDICT_GLOBAL)"
if printf '%s\n' "$OUT" | grep -q '^REGLE_'; then
  ko "une ligne REGLE_ est sortie malgre BPM_SOURCE_CASSEE=oui — JAMAIS un classement"
else
  ok "aucune ligne REGLE_ produite (source cassee = zero classement)"
fi

echo "== Corpus absent : echec bruyant, rc!=0, RIEN sur stdout =="
unset BPM_SOURCE_CASSEE BPM_CORPUS_JSON BPM_RACINE_DEPOT BPM_ETAT_PRECEDENT BPM_ETAT_SORTIE
export BPM_CORPUS_JSON="${WORK}/n-existe-pas.json"
export BPM_RACINE_DEPOT="$DEPOT"
OUT="$(bash "$LIB" 2>"${WORK}/stderr")"; RC=$?
[ "$RC" -ne 0 ] && ok "rc != 0 (corpus absent)" || ko "rc devrait etre != 0"
[ -z "$OUT" ] && ok "stdout vide (aucune sortie de classement)" || ko "stdout non vide malgre corpus absent: ${OUT}"
[ -s "${WORK}/stderr" ] && ok "message clair sur stderr" || ko "stderr vide — message manquant"

echo "== Corpus JSON invalide : echec bruyant, rc!=0, RIEN sur stdout =="
printf '{ceci nest pas du json' > "${WORK}/invalide.json"
unset BPM_CORPUS_JSON; export BPM_CORPUS_JSON="${WORK}/invalide.json"
OUT="$(bash "$LIB" 2>"${WORK}/stderr")"; RC=$?
[ "$RC" -ne 0 ] && ok "rc != 0 (JSON invalide)" || ko "rc devrait etre != 0"
[ -z "$OUT" ] && ok "stdout vide (JSON invalide)" || ko "stdout non vide malgre JSON invalide"

echo "== Corpus JSON valide mais SANS cle 'entries' : echec bruyant propre, rc=3, RIEN sur stdout (pas un KeyError non attrape) =="
echo "   (trouvé en revue de fond : {} est un JSON valide mais fait planter le script — hors du contrat rc du .sh)"
printf '{}' > "${WORK}/sans-entries.json"
unset BPM_CORPUS_JSON; export BPM_CORPUS_JSON="${WORK}/sans-entries.json"
OUT="$(bash "$LIB" 2>"${WORK}/stderr")"; RC=$?
[ "$RC" -eq 3 ] && ok "rc=3 (corpus sans 'entries', echec propre)" || ko "attendu rc=3, obtenu rc=${RC}"
[ -z "$OUT" ] && ok "stdout vide" || ko "stdout non vide malgre corpus sans 'entries'"
[ -n "$(cat "${WORK}/stderr")" ] && ok "message clair sur stderr" || ko "stderr vide"

echo "== RÉGRESSION (5e tour de revue de fond) — une entree de corpus malformee : echec bruyant propre, rc=3, RIEN sur stdout (pas un traceback non attrape) =="
printf '{"entries": [{"id": "R-OK", "citations_attendues": ["MARQUEUR_MECHA"]}, {"id": "R-MAUVAIS", "mecanisme_connu": "ceci-nest-pas-un-dict"}]}' > "${WORK}/entree-malformee.json"
unset BPM_CORPUS_JSON; export BPM_CORPUS_JSON="${WORK}/entree-malformee.json"
OUT="$(bash "$LIB" 2>"${WORK}/stderr")"; RC=$?
[ "$RC" -eq 3 ] && ok "rc=3 (entree malformee, echec propre)" || ko "attendu rc=3, obtenu rc=${RC}"
[ -z "$OUT" ] && ok "stdout vide (aucun classement partiel malgre R-OK valide avant R-MAUVAIS)" || ko "stdout non vide malgre entree malformee"
[ -n "$(cat "${WORK}/stderr")" ] && ok "message clair sur stderr" || ko "stderr vide"

echo "== RÉGRESSION (6e tour de revue de fond) — un id present mais D'UN MAUVAIS TYPE (nombre) : echec bruyant propre, rc=3, pas un TypeError sur sanitiser_cle =="
printf '{"entries": [{"id": 12345, "citations_attendues": ["MARQUEUR_MECHA"]}]}' > "${WORK}/id-mauvais-type.json"
unset BPM_CORPUS_JSON; export BPM_CORPUS_JSON="${WORK}/id-mauvais-type.json"
OUT="$(bash "$LIB" 2>"${WORK}/stderr")"; RC=$?
[ "$RC" -eq 3 ] && ok "rc=3 (id de type non-str, echec propre)" || ko "attendu rc=3, obtenu rc=${RC} (BUG : sanitiser_cle() plante par TypeError, rc=1, sur un id non-string)"
[ -z "$OUT" ] && ok "stdout vide" || ko "stdout non vide malgre id de mauvais type"

echo "== RÉGRESSION (6e tour de revue de fond) — un id 'null' (JSON) : meme echec bruyant propre =="
printf '{"entries": [{"id": null, "citations_attendues": ["MARQUEUR_MECHA"]}]}' > "${WORK}/id-null.json"
unset BPM_CORPUS_JSON; export BPM_CORPUS_JSON="${WORK}/id-null.json"
OUT="$(bash "$LIB" 2>"${WORK}/stderr")"; RC=$?
[ "$RC" -eq 3 ] && ok "rc=3 (id null, echec propre)" || ko "attendu rc=3, obtenu rc=${RC}"
[ -z "$OUT" ] && ok "stdout vide" || ko "stdout non vide malgre id null"

echo "== BPM_CORPUS_JSON non positionnee : echec bruyant =="
unset BPM_CORPUS_JSON
OUT="$(bash "$LIB" 2>"${WORK}/stderr")"; RC=$?
[ "$RC" -ne 0 ] && ok "rc != 0 (BPM_CORPUS_JSON absente)" || ko "rc devrait etre != 0"
[ -z "$OUT" ] && ok "stdout vide" || ko "stdout non vide"

echo "== Premier passage : BPM_ETAT_PRECEDENT non fourni -> PREMIER_PASSAGE, jamais une erreur =="
executer '{"id": "R-X", "citations_attendues": ["MARQUEUR_MECHA"]}'
[ "$(champ ECART_PRECEDENT)" = "PREMIER_PASSAGE" ] && ok "ECART_PRECEDENT=PREMIER_PASSAGE sans etat precedent" || ko "attendu PREMIER_PASSAGE, obtenu $(champ ECART_PRECEDENT)"
[ "$RC" -eq 0 ] && ok "rc=0 (pas une erreur)" || ko "rc devrait etre 0"

echo "== Ecart detecte : une regle change de classe entre deux etats =="
echo '{"R-X": "contredit"}' > "${WORK}/etat_precedent.json"
executer '{"id": "R-X", "citations_attendues": ["MARQUEUR_MECHA"]}' BPM_ETAT_PRECEDENT="${WORK}/etat_precedent.json"
case "$(champ ECART_PRECEDENT)" in
  *"R-X:contredit->"*) ok "ecart detecte et nomme: $(champ ECART_PRECEDENT)" ;;
  *) ko "ecart non detecte: $(champ ECART_PRECEDENT)" ;;
esac

echo "== RÉGRESSION (5e tour de revue de fond) — un id qui DISPARAÎT du corpus doit être nommé DISPARU, pas rendu AUCUN =="
echo '{"R-X": "contredit", "R-Y-DISPARUE": "protege"}' > "${WORK}/etat_avec_disparue.json"
executer '{"id": "R-X", "citations_attendues": ["MARQUEUR_MECHA"]}' BPM_ETAT_PRECEDENT="${WORK}/etat_avec_disparue.json"
case "$(champ ECART_PRECEDENT)" in
  *"R-Y-DISPARUE:protege->DISPARU"*) ok "disparition detectee et nommee: $(champ ECART_PRECEDENT)" ;;
  *) ko "disparition NON detectee (BUG : un ADR/STD retire du corpus, meme sil etait contredit, rendrait AUCUN ecart) : $(champ ECART_PRECEDENT)" ;;
esac

echo "== RÉGRESSION (5e tour de revue de fond) — un id qui APPARAÎT dans le corpus doit être nommé NOUVEAU, pas ignoré silencieusement =="
echo '{}' > "${WORK}/etat_vide.json"
executer '{"id": "R-Z-NOUVELLE", "citations_attendues": ["MARQUEUR_MECHA"]}' BPM_ETAT_PRECEDENT="${WORK}/etat_vide.json"
case "$(champ ECART_PRECEDENT)" in
  *"R-Z-NOUVELLE:NOUVEAU->"*) ok "apparition detectee et nommee: $(champ ECART_PRECEDENT)" ;;
  *) ko "apparition NON detectee (BUG : ancien is not None excluait explicitement ce cas) : $(champ ECART_PRECEDENT)" ;;
esac

echo "== Aucun ecart : meme etat precedent que le classement courant =="
executer '{"id": "R-X", "citations_attendues": ["MARQUEUR_MECHA"]}' BPM_ETAT_SORTIE="${WORK}/etat1.json"
CLASSE_X="$(champ REGLE_R_X_CLASSE)"
printf '{"R-X": "%s"}' "$CLASSE_X" > "${WORK}/etat_meme.json"
executer '{"id": "R-X", "citations_attendues": ["MARQUEUR_MECHA"]}' BPM_ETAT_PRECEDENT="${WORK}/etat_meme.json"
[ "$(champ ECART_PRECEDENT)" = "AUCUN" ] && ok "ECART_PRECEDENT=AUCUN quand rien n'a change" || ko "attendu AUCUN, obtenu $(champ ECART_PRECEDENT)"

echo "== Idempotence : deux appels sur le meme corpus et le meme depot -> sortie identique =="
corpus_json '{"id": "R-PROTEGE", "citations_attendues": ["MARQUEUR_MECHA"], "mecanisme_connu": {"chemin": ".claude/skills/x/lib/mecha.sh", "banc": ".claude/skills/x/tests/test-mecha.sh"}}'
unset BPM_SOURCE_CASSEE BPM_ETAT_PRECEDENT BPM_ETAT_SORTIE
export BPM_CORPUS_JSON="${WORK}/corpus.json" BPM_RACINE_DEPOT="$DEPOT"
OUT1="$(bash "$LIB")"
OUT2="$(bash "$LIB")"
[ "$OUT1" = "$OUT2" ] && ok "sortie identique sur deux appels (idempotence)" || ko "sortie DIFFERENTE entre deux appels identiques"

echo "== Temoin positif : OK quand les 4 gardes du lot 4 sont trouvees protegees =="
mkdir -p "${DEPOT}/.claude/hooks" "${DEPOT}/.claude/hooks/tests" "${DEPOT}/.claude/skills/merge/lib" "${DEPOT}/.claude/skills/pousse-staging/lib" "${DEPOT}/.claude/skills/pousse-staging/tests" "${DEPOT}/scripts/tests" "${DEPOT}/.claude/skills/orchestrer-chantier/lib"
echo '# STD-029 service_role sb_secret_ staging-secret-key-gate merge-closes-stories GF-ORC-013 verifie-brief-chef' > "${DEPOT}/.claude/hooks/preflight.sh"
cp "${DEPOT}/.claude/hooks/preflight.sh" "${DEPOT}/.claude/hooks/tests/test-preflight.sh"
cp "${DEPOT}/.claude/hooks/preflight.sh" "${DEPOT}/.claude/skills/merge/lib/merge-closes-stories.sh"
cp "${DEPOT}/.claude/hooks/preflight.sh" "${DEPOT}/scripts/tests/test-merge.sh"
cp "${DEPOT}/.claude/hooks/preflight.sh" "${DEPOT}/.claude/skills/pousse-staging/lib/staging-secret-key-gate.sh"
cp "${DEPOT}/.claude/hooks/preflight.sh" "${DEPOT}/.claude/skills/pousse-staging/tests/test-gate.sh"
cp "${DEPOT}/.claude/hooks/preflight.sh" "${DEPOT}/.claude/skills/orchestrer-chantier/lib/verifie-brief-chef.sh"
cp "${DEPOT}/.claude/hooks/preflight.sh" "${DEPOT}/scripts/tests/test-verifie.sh"
executer '
{"id": "STD-038", "citations_attendues": ["service_role"], "mecanisme_connu": {"chemin": ".claude/skills/pousse-staging/lib/staging-secret-key-gate.sh", "banc": ".claude/skills/pousse-staging/tests/test-gate.sh"}},
{"id": "STD-030-MERGE", "citations_attendues": ["merge-closes-stories"], "mecanisme_connu": {"chemin": ".claude/skills/merge/lib/merge-closes-stories.sh", "banc": "scripts/tests/test-merge.sh"}},
{"id": "STD-029", "citations_attendues": ["STD-029"], "mecanisme_connu": {"chemin": ".claude/hooks/preflight.sh", "banc": ".claude/hooks/tests/test-preflight.sh"}},
{"id": "GF-ORC-013", "citations_attendues": ["GF-ORC-013"], "mecanisme_connu": {"chemin": ".claude/skills/orchestrer-chantier/lib/verifie-brief-chef.sh", "banc": "scripts/tests/test-verifie.sh"}}
'
[ "$(champ TEMOIN_POSITIF)" = "OK" ] && ok "TEMOIN_POSITIF=OK quand les 4 gardes sont protegees" || ko "attendu OK, obtenu $(champ TEMOIN_POSITIF): $(champ TEMOIN_POSITIF_DETAIL)"

echo "== Temoin positif : ECHEC quand une des 4 gardes n'est PAS protegee (bug du banc, pas un resultat normal) =="
executer '
{"id": "STD-038", "citations_attendues": ["CECI_NE_MATCHE_RIEN"], "mecanisme_connu": {"chemin": ".claude/skills/pousse-staging/lib/staging-secret-key-gate.sh", "banc": ".claude/skills/pousse-staging/tests/test-gate.sh"}},
{"id": "STD-030-MERGE", "citations_attendues": ["merge-closes-stories"], "mecanisme_connu": {"chemin": ".claude/skills/merge/lib/merge-closes-stories.sh", "banc": "scripts/tests/test-merge.sh"}},
{"id": "STD-029", "citations_attendues": ["STD-029"], "mecanisme_connu": {"chemin": ".claude/hooks/preflight.sh", "banc": ".claude/hooks/tests/test-preflight.sh"}},
{"id": "GF-ORC-013", "citations_attendues": ["GF-ORC-013"], "mecanisme_connu": {"chemin": ".claude/skills/orchestrer-chantier/lib/verifie-brief-chef.sh", "banc": "scripts/tests/test-verifie.sh"}}
'
[ "$(champ TEMOIN_POSITIF)" = "ECHEC" ] && ok "TEMOIN_POSITIF=ECHEC detecte quand une garde ne tient plus" || ko "attendu ECHEC, obtenu $(champ TEMOIN_POSITIF)"
[ -n "$(champ TEMOIN_POSITIF_DETAIL)" ] && ok "TEMOIN_POSITIF_DETAIL nomme ce qui manque" || ko "TEMOIN_POSITIF_DETAIL vide alors que TEMOIN_POSITIF=ECHEC"

echo "== Temoin positif : ECHEC quand un id du temoin est absent du corpus fourni =="
executer '{"id": "STD-038", "citations_attendues": ["service_role"], "mecanisme_connu": {"chemin": ".claude/skills/pousse-staging/lib/staging-secret-key-gate.sh", "banc": ".claude/skills/pousse-staging/tests/test-gate.sh"}}'
[ "$(champ TEMOIN_POSITIF)" = "ECHEC" ] && ok "TEMOIN_POSITIF=ECHEC quand 3 des 4 gardes sont absentes du corpus" || ko "attendu ECHEC"

echo "== Régression — auto-référence : un corpus/état vivant DANS l'arbre scanné ne doit jamais compter comme citation =="
echo "   (défaut réel trouvé par le chef d'équipe avant fusion : 58/67 'prose' au premier passage sur le corpus réel,"
echo "    contre 44 'absent' à l'analyse du 21 sept sur le même périmètre — le corpus figé et l'état vivent sous"
echo "    scripts/ et .claude/, les dossiers scannés, et énumèrent chaque id en clair)"

# Le corpus JSON lui-même vit DANS l'arbre scanné du dépôt jetable — c'est
# exactement la configuration réelle (scripts/tests/fixtures/.../corpus-adr-std.json).
mkdir -p "${DEPOT}/scripts/tests/fixtures/auto-ref"
CORPUS_DANS_ARBRE="${DEPOT}/scripts/tests/fixtures/auto-ref/corpus.json"
cat > "$CORPUS_DANS_ARBRE" <<JSON
{"entries": [{"id": "R-AUTOREF", "citations_attendues": ["R-AUTOREF"]}]}
JSON
unset BPM_SOURCE_CASSEE BPM_ETAT_PRECEDENT BPM_ETAT_SORTIE
BPM_CORPUS_JSON="$CORPUS_DANS_ARBRE" BPM_RACINE_DEPOT="$DEPOT" OUT="$(bash "$LIB" 2>"${WORK}/stderr")"; RC=$?
[ "$(champ REGLE_R_AUTOREF_CLASSE)" = "non_etabli" ] \
  && ok "id cite seulement dans le corpus figé (dans l'arbre scanné) -> non_etabli, pas prose/protege" \
  || ko "auto-référence NON exclue : attendu non_etabli, obtenu $(champ REGLE_R_AUTOREF_CLASSE)"

# Un fichier d'état LAISSÉ SUR DISQUE d'un passage antérieur (jamais
# référencé par BPM_ETAT_PRECEDENT/_SORTIE de l'appel courant) doit rester
# exclu — c'est le second volet du même défaut réel : exclure seulement le
# chemin passé en argv ne suffit pas, il faut exclure le DOSSIER entier.
# ⚠️ Le dossier exclu (`dossiers_exclus`) est ancré sur `ici` (le dossier du
# script RÉEL), pas sur BPM_RACINE_DEPOT : ce test doit donc pointer
# BPM_RACINE_DEPOT sur le DÉPÔT RÉEL (racine du projet, $ROOT) pour que
# l'état périmé soit réellement DANS l'arbre scanné — sur un dépôt jetable
# ($DEPOT), le test serait vide de sens (le dossier périmé n'y serait jamais
# scanné, et passerait "à tort" même sans le correctif).
LIB_DIR="$(cd "$(dirname "$LIB")" && pwd)"
ETAT_DIR_REEL="${LIB_DIR}/etat"
ETAT_TMP_CREE=0
if [ ! -e "$ETAT_DIR_REEL" ]; then mkdir -p "$ETAT_DIR_REEL"; ETAT_TMP_CREE=1; fi
ETAT_PERIME="${ETAT_DIR_REEL}/test-regression-auto-ref-$$.json"
MARQUEUR_UNIQUE="MARQUEUR_ETAT_PERIME_$$_REGRESSION_XYZ"
printf '{"%s": "protege"}' "$MARQUEUR_UNIQUE" > "$ETAT_PERIME"
cleanup_etat_perime() {
  rm -f "$ETAT_PERIME"
  [ "$ETAT_TMP_CREE" -eq 1 ] && rmdir "$ETAT_DIR_REEL" 2>/dev/null
}
trap 'cleanup_etat_perime; rm -rf "$WORK"' EXIT

# Corpus placé HORS du dépôt réel ($WORK, un tmpdir jetable) — seul l'état
# périmé laissé dans $ROOT doit être en jeu ici, pas le corpus lui-même.
printf '{"entries": [{"id": "%s", "citations_attendues": ["%s"]}]}' "$MARQUEUR_UNIQUE" "$MARQUEUR_UNIQUE" > "${WORK}/corpus_etat_perime.json"
unset BPM_SOURCE_CASSEE BPM_ETAT_PRECEDENT BPM_ETAT_SORTIE
BPM_CORPUS_JSON="${WORK}/corpus_etat_perime.json" BPM_RACINE_DEPOT="$ROOT" OUT="$(bash "$LIB" 2>"${WORK}/stderr")"; RC=$?
CLE_MARQUEUR="$(sanitiser_pour_champ() { printf '%s' "$1" | tr -c 'A-Za-z0-9' '_' | tr '[:lower:]' '[:upper:]'; }; sanitiser_pour_champ "$MARQUEUR_UNIQUE")"
[ "$(champ "REGLE_${CLE_MARQUEUR}_CLASSE")" = "non_etabli" ] \
  && ok "un état PÉRIMÉ laissé sur disque dans le VRAI dépôt (non référencé par cet appel) reste exclu -> non_etabli" \
  || ko "état périmé NON exclu : attendu non_etabli, obtenu $(champ "REGLE_${CLE_MARQUEUR}_CLASSE")"
cleanup_etat_perime

echo
echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
