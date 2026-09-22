#!/usr/bin/env bash
# Banc unitaire de classifier.sh — T-20260922-0135 (D-20260921-0016 Q2b).
#
# Le coeur du lot : distinguer TROIS etats, jamais deux.
#   1. textes-declares — au moins un pointeur (rc=0)
#   2. aucun-declare   — l'appel a reussi, la liste est vide, LEGITIME (rc=1)
#   3. non-mesure      — l'appel a echoue, ou sa reponse est illisible (rc=2)
#
# Confondre 1 et 2 fait passer une panne pour un etat normal.
# Confondre 2 et 3 fait disparaitre le travail de quelqu'un sans bruit.
#
# Usage : bash .claude/skills/textes-applicables/tests/test-classifier.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB="${TAP_LIB:-${SCRIPT_DIR}/../lib/classifier.sh}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# shellcheck source=/dev/null
source "$LIB"

PASS=0; FAIL=0
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

# ---- 1. appel echoue -> non-mesure, QUEL QUE SOIT LE CONTENU DU FICHIER ----
# Meme si le fichier residuel contient des pointeurs, un appel echoue ne peut
# jamais se lire comme "textes declares" : la panne prime toujours.
cat > "$WORK/perime.json" <<'JSON'
{"success":true,"count":2,"applicable_texts":[{"text_ref":"STD-001","title":"X","somcraft_uuid":"u1"}]}
JSON
sortie="$(tap_classifie "$WORK/perime.json" 1)"; rc=$?
if [ "$rc" -eq 2 ] && [[ "$sortie" == *"[non mesure]"* ]]; then
  ok "appel echoue (rc appelant=1) -> rc=2, [non mesure]"
else
  ko "appel echoue mal classe (rc=$rc, sortie='$sortie')"
fi

# ---- 2. appel reussi, fichier absent -> non-mesure (defensif) ----
sortie="$(tap_classifie "$WORK/absent.json" 0)"; rc=$?
if [ "$rc" -eq 2 ] && [[ "$sortie" == *"[non mesure]"* ]]; then
  ok "fichier reponse absent -> rc=2, [non mesure]"
else
  ko "fichier absent mal classe (rc=$rc, sortie='$sortie')"
fi

# ---- 3. appel reussi, json illisible -> non-mesure (jamais aucun-declare) ----
echo 'ceci nest pas du json' > "$WORK/illisible.json"
sortie="$(tap_classifie "$WORK/illisible.json" 0)"; rc=$?
if [ "$rc" -eq 2 ] && [[ "$sortie" == *"[non mesure]"* ]]; then
  ok "json illisible -> rc=2, [non mesure]"
else
  ko "json illisible mal classe (rc=$rc, sortie='$sortie')"
fi

# ---- 3bis. appel reussi, mais reponse success=false avec un count present quand meme ----
# (ex. erreur cote serveur qui renvoie un corps partiel) -> non-mesure, jamais
# lu comme un compte fiable, meme si le champ "count" existe et vaut > 0.
cat > "$WORK/succes-faux.json" <<'JSON'
{"success":false,"count":3,"applicable_texts":[{"text_ref":"STD-999","title":"Ne doit jamais sortir","somcraft_uuid":"x"}]}
JSON
sortie="$(tap_classifie "$WORK/succes-faux.json" 0)"; rc=$?
if [ "$rc" -eq 2 ] && [[ "$sortie" == *"[non mesure]"* ]]; then
  ok "success=false avec count present -> rc=2, [non mesure] (jamais un compte lu sur une reponse en echec)"
else
  ko "success=false mal classe (rc=$rc, sortie='$sortie')"
fi

# ---- 4. appel reussi, liste vide -> aucun-declare, LEGITIME, distinct de non-mesure ----
cat > "$WORK/vide.json" <<'JSON'
{"success":true,"count":0,"applicable_texts":[]}
JSON
sortie="$(tap_classifie "$WORK/vide.json" 0)"; rc=$?
if [ "$rc" -eq 1 ] && [[ "$sortie" == *"aucun texte declare"* ]] && [[ "$sortie" != *"[non mesure]"* ]]; then
  ok "liste vide -> rc=1, aucun texte declare (distinct de non mesure)"
else
  ko "liste vide mal classee (rc=$rc, sortie='$sortie')"
fi

# ---- 4bis. le champ "count" du serveur ne dirige plus RIEN : seul le tableau compte ----
# Defaut trouve en revue de fond (T-20260922-0135) : la v1 lisait `.count`
# pour decider et `.applicable_texts` pour rendre — deux lectures
# independantes. Un `count` truthy avec `applicable_texts` ABSENT tombait en
# "textes-declares" (SUCCES) avec un stdout VIDE, silencieusement — exactement
# la panne que cette garde pretend fermer. Desormais tout derive du meme
# champ : `.count` du serveur n'est jamais lu.
cat > "$WORK/count-menteur-absent.json" <<'JSON'
{"success":true,"count":3}
JSON
sortie="$(tap_classifie "$WORK/count-menteur-absent.json" 0)"; rc=$?
if [ "$rc" -eq 2 ] && [[ "$sortie" == *"[non mesure]"* ]]; then
  ok "count=3 mais applicable_texts absent -> rc=2, [non mesure] (jamais textes-declares silencieux)"
else
  ko "count menteur (applicable_texts absent) mal classe (rc=$rc, sortie='$sortie')"
fi

cat > "$WORK/count-menteur-vide.json" <<'JSON'
{"success":true,"count":3,"applicable_texts":[]}
JSON
sortie="$(tap_classifie "$WORK/count-menteur-vide.json" 0)"; rc=$?
if [ "$rc" -eq 1 ] && [[ "$sortie" == *"aucun texte declare"* ]]; then
  ok "count=3 mais applicable_texts=[] -> rc=1, aucun texte declare (le tableau reel decide, pas count)"
else
  ko "count menteur (applicable_texts vide) mal classe (rc=$rc, sortie='$sortie')"
fi

# ---- 4ter. applicable_texts n'est pas un tableau (type invalide) -> non-mesure ----
cat > "$WORK/type-invalide.json" <<'JSON'
{"success":true,"applicable_texts":"oups une chaine"}
JSON
sortie="$(tap_classifie "$WORK/type-invalide.json" 0)"; rc=$?
if [ "$rc" -eq 2 ] && [[ "$sortie" == *"[non mesure]"* ]]; then
  ok "applicable_texts n'est pas un tableau -> rc=2, [non mesure]"
else
  ko "type invalide mal classe (rc=$rc, sortie='$sortie')"
fi

# ---- 5. appel reussi, pointeurs presents -> textes-declares, rend les pointeurs ----
cat > "$WORK/peuple.json" <<'JSON'
{"success":true,"count":2,"applicable_texts":[
  {"text_ref":"ADR-036","title":"BD Supabase isolee par worktree","somcraft_uuid":"97918775-67f5-408a-b477-15de297cb70a"},
  {"text_ref":"STD-027","title":"Memoire externe d'etat d'application","somcraft_uuid":"a3371942-c97e-41c8-8d25-b586943a0165"}
]}
JSON
sortie="$(tap_classifie "$WORK/peuple.json" 0)"; rc=$?
if [ "$rc" -eq 0 ] && [[ "$sortie" == *"ADR-036"* ]] && [[ "$sortie" == *"STD-027"* ]]; then
  ok "textes declares -> rc=0, les DEUX pointeurs rendus"
else
  ko "textes declares mal rendus (rc=$rc, sortie='$sortie')"
fi

# ---- 6. jamais de contenu recopie : seuls text_ref/title/somcraft_uuid sortent ----
cat > "$WORK/avec-note.json" <<'JSON'
{"success":true,"count":1,"applicable_texts":[
  {"text_ref":"STD-009","title":"Creation de migration","somcraft_uuid":"c34f9655","application_note":"CONTENU-A-NE-JAMAIS-RECOPIER-INTEGRALEMENT"}
]}
JSON
sortie="$(tap_classifie "$WORK/avec-note.json" 0)"; rc=$?
if [ "$rc" -eq 0 ] && [[ "$sortie" == *"STD-009"* ]] && [[ "$sortie" != *"CONTENU-A-NE-JAMAIS-RECOPIER-INTEGRALEMENT"* ]]; then
  ok "le pointeur sort, le contenu/note libre ne sort pas"
else
  ko "fuite de contenu dans le rendu (rc=$rc, sortie='$sortie')"
fi

# ---- 7. le format exact de la ligne rendue, pas juste une sous-chaine ----
# Trouve en revue de fond : les assertions precedentes (substring + compte de
# lignes) ne detectent PAS une inversion text_ref/title dans le formatage —
# un bug reel qui melangerait l'identite de chaque pointeur passerait
# inapercu. Ici on compare la ligne ENTIERE, position par position.
cat > "$WORK/un-seul.json" <<'JSON'
{"success":true,"applicable_texts":[
  {"text_ref":"ADR-001","title":"Titre du texte","somcraft_uuid":"uuid-123"}
]}
JSON
sortie="$(tap_classifie "$WORK/un-seul.json" 0)"; rc=$?
attendu="ADR-001 — Titre du texte (uuid-123)"
if [ "$rc" -eq 0 ] && [ "$sortie" = "$attendu" ]; then
  ok "format exact respecte : '$attendu'"
else
  ko "format exact viole (attendu '$attendu', obtenu rc=$rc sortie='$sortie')"
fi

echo ""
echo "Assertions jouees : $((PASS+FAIL)) — ${PASS} OK, ${FAIL} KO"
[ "$FAIL" -eq 0 ]
