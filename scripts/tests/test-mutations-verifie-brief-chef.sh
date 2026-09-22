#!/usr/bin/env bash
# ============================================================
# test-mutations-verifie-brief-chef.sh — v1.0.0
# La garde de `verifie-brief-chef.sh` — T-20260922-0098.
#
# `test-verifie-brief-chef.sh` est vert. Un banc vert ne dit rien tant
# qu'on ne l'a pas vu rougir : il peut tenir la bonne chose par accident de
# formulation. Même motif, même instrument que
# `test-mutations-merge-closes-stories.sh` — on ne l'invente pas une
# seconde fois (règle d'or n°15).
#
# Ce fichier réintroduit, dans une COPIE de la lib, chacun des défauts que
# la garde prétend fermer et EXIGE que le banc unitaire devienne rouge.
# Le dépôt n'est jamais modifié.
#
# RÈGLE DE L'INSTRUMENT (héritée) : une mutation qui ne mute rien rend zéro
# rouge — l'instrument REFUSE donc une mutation sans effet
# (MUTATION-INOPÉRANTE), distincte d'un mutant survivant.
#
# Usage : bash scripts/tests/test-mutations-verifie-brief-chef.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LIB_SRC="${ROOT}/.claude/skills/orchestrer-chantier/lib/verifie-brief-chef.sh"
SUITE_UNIT="${SCRIPT_DIR}/test-verifie-brief-chef.sh"

command -v python3 >/dev/null 2>&1 || { echo "⚠️  python3 indisponible — mutations sautées (skip)"; exit 0; }

WORK="$(mktemp -d)"; PASS=0; FAIL=0; N=0
trap 'rm -rf "$WORK"' EXIT
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

# applique <src> <dst> <fichier-python> — refuse une mutation sans effet (rc=2).
applique() {
  python3 - "$1" "$2" "$3" <<'PY'
import sys
src, dst, codefile = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(src, encoding="utf-8").read()
before = s
ns = {"s": s}
exec(open(codefile, encoding="utf-8").read(), ns)
s = ns["s"]
if s == before:
    print("MUTATION-INOPERANTE", file=sys.stderr)
    sys.exit(2)
open(dst, "w", encoding="utf-8").write(s)
PY
}

# essai <libellé>   (le code python de mutation est lu sur STDIN)
essai() {
  local label="$1" M C
  N=$((N+1)); M="${WORK}/m${N}.sh"; C="${WORK}/c${N}.py"
  cat > "$C"
  if ! applique "$LIB_SRC" "$M" "$C" 2>"${WORK}/err${N}"; then
    ko "MUTATION INOPÉRANTE — ${label} : le motif ne correspond à aucun texte de la lib (l'épreuve n'a PAS eu lieu)"
    return
  fi
  if ! bash -n "$M" 2>/dev/null; then
    ko "MUTATION INVALIDE — ${label} : la copie ne s'analyse plus, un rouge n'accuserait que la syntaxe"
    return
  fi

  if VBC_LIB="$M" bash "$SUITE_UNIT" >"${WORK}/uout${N}" 2>&1; then
    ko "MUTANT SURVIVANT — ${label} : le banc unitaire reste VERT, la garde ne tient pas ça"
  else
    ok "${label} → le banc unitaire rougit"
  fi
}

echo "== Contrôle préalable — le banc unitaire est VERT sur le code du dépôt =="
if VBC_LIB="$LIB_SRC" bash "$SUITE_UNIT" >"${WORK}/base.log" 2>&1; then
  ok "le banc unitaire est vert avant toute mutation"
else
  ko "le banc unitaire est DÉJÀ rouge — aucun mutant ne prouverait quoi que ce soit"
  tail -20 "${WORK}/base.log"
  echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"; exit 1
fi

echo "== [non établi] : le seuil de motif retiré (0 caractère suffit) =="
essai '[non établi] SANS motif passerait — VBC_SEUIL_MOTIF tombe à 0' <<'PY'
old = "VBC_SEUIL_MOTIF=15"
new = "VBC_SEUIL_MOTIF=0"
assert old in s
s = s.replace(old, new)
PY

echo "== [non établi] : la distinction avec/sans motif est retirée (toujours PASSE) =="
essai 'la branche [non établi] rend toujours PASSE, sans regarder le motif' <<'PY'
old = '''    if [ "$utiles_motif" -ge "$VBC_SEUIL_MOTIF" ]; then
      printf 'PASSE\\n%s' ""
    else
      printf 'REFUS\\n%s' "ADR applicable marque [non etabli] SANS motif — le marqueur seul ne suffit pas, il lui faut une explication"
    fi
    return'''
new = '''    printf 'PASSE\\n%s' ""
    return'''
assert old in s
s = s.replace(old, new)
PY

echo "== ADR : le numéro nu n'est plus signalé (SIGNALE devient PASSE) =="
essai 'une référence ADR par numéro nu seul rend PASSE au lieu de SIGNALE' <<'PY'
old = '''    if [ "$utiles_hors_numero" -ge "$VBC_SEUIL_MOTIF" ]; then
      printf 'PASSE\\n%s' ""
    else
      printf 'SIGNALE\\n%s' "l'ADR est citee par son seul numero, sans titre ni description — reference potentiellement ambigue (plusieurs numeros peuvent designer des textes differents)"
    fi
    return'''
new = '''    printf 'PASSE\\n%s' ""
    return'''
assert old in s
s = s.replace(old, new)
PY

echo "== ADR : la mention est cherchée n'importe où au lieu du marqueur « adr applicable » =="
essai 'le marqueur ADR applicable est retiré — vbc_champ_adr croit toujours trouver la section' <<'PY'
old = '''      case "$ligne" in
        *"adr applicable"*)
          trouve=1'''
new = '''      case "$ligne" in
        *)
          trouve=1'''
assert old in s
s = s.replace(old, new)
PY

echo "== ONTOLOGIE : NON_APPLIQUE retiré — touche=non redevient un REFUS =="
essai 'VBC_TOUCHE_ONTOLOGIE=non ne rend plus jamais NON_APPLIQUE' <<'PY'
old = '''  if [ "$touche" = "non" ]; then
    printf 'NON_APPLIQUE\\n%s' ""
    return
  fi

'''
new = ''
assert old in s
s = s.replace(old, new)
PY

echo "== ONTOLOGIE : le défaut conservatif « oui » bascule à « non » (silence par défaut) =="
essai 'VBC_TOUCHE_ONTOLOGIE non positionnée devient NON_APPLIQUE par défaut au lieu de oui' <<'PY'
old = '''  local touche_resolue="oui"
  if [ "$(vbc_minuscules "$(vbc_trim "${VBC_TOUCHE_ONTOLOGIE:-}")")" = "non" ]; then
    touche_resolue="non"
  fi'''
new = '''  local touche_resolue="non"
  if [ "$(vbc_minuscules "$(vbc_trim "${VBC_TOUCHE_ONTOLOGIE:-}")")" = "oui" ]; then
    touche_resolue="oui"
  fi'''
assert old in s
s = s.replace(old, new)
PY

echo "== BRD : l'exigence de grain module est retirée (toujours PASSE si module_id posé) =="
essai 'la vérification de proximité module/BRD est neutralisée' <<'PY'
old = '''  if [[ "$fenetre" == *"module"* ]] \\
     || { [ -n "$module_id_norm" ] && [[ "$fenetre" == *"$module_id_norm"* ]]; } \\
     || [[ "$fenetre" == *"/"*"/brd"* ]]; then
    printf 'PASSE\\n%s' ""
  else
    printf 'REFUS\\n%s' "BRD mentionne, mais rien n indique le grain MODULE (module_id=${module_id}) — le BRD du module est requis, pas celui de l application"
  fi'''
new = '''  printf 'PASSE\\n%s' ""'''
assert old in s
s = s.replace(old, new)
PY

echo "== BRD : la mention de BRD n'est plus exigée du tout (toujours PASSE) =="
essai 'BRD absent du brief rend quand même PASSE' <<'PY'
old = '''  if [[ "$texte_norm" != *"brd"* ]]; then
    printf 'REFUS\\n%s' "aucune mention de BRD dans le brief"
    return
  fi

'''
new = ''
assert old in s
s = s.replace(old, new)
PY

echo "== APPLICABLE : la section « ce qui s'applique ici » n'est plus exigée =="
essai '« ce qui s applique ici » absent rend quand même PASSE' <<'PY'
old = '''  if [[ "$texte_norm" == *"ce qui sapplique ici"* ]]; then
    printf 'PASSE\\n%s' ""
  else
    printf 'REFUS\\n%s' "aucune section ce qui s applique ici dans le brief"
  fi'''
new = '''  printf 'PASSE\\n%s' ""'''
assert old in s
s = s.replace(old, new)
PY

echo "== Normalisation : l'apostrophe typographique (’) n'est plus repliée =="
essai '’ (apostrophe courbe) traverse sans être retirée — une variante casse la détection' <<'PY'
# Construit par concaténation pour éviter tout imbroglio d'échappement entre
# apostrophe droite, accent grave et apostrophe courbe dans un seul littéral.
prefixe = '  s="${s//' + "\\'" + '/}"; s="${s//' + "\\`" + '/}"; s="${s//'
old = prefixe + '’' + '/}"'
new = '  s="${s//' + "\\'" + '/}"; s="${s//' + "\\`" + '/}"'
assert old in s, "motif de retrait apostrophe courbe introuvable"
s = s.replace(old, new)
PY

echo "== Normalisation : le repli accentué « é → e » est retiré (établi ≠ etabli) =="
essai 'é n est plus replié vers e — [non établi] cesse d être reconnu comme [non etabli]' <<'PY'
old = '  s="${s//é/e}"; s="${s//è/e}"; s="${s//ê/e}"; s="${s//ë/e}"'
new = ''
assert old in s, "motif de repli accentue introuvable"
s = s.replace(old, new)
PY

echo "== Source cassée : NON_MESURE devient PASSE (le pire résultat — une garde qui ne peut pas voir dit conforme) =="
essai 'VBC_SOURCE_CASSEE=oui ne court-circuite plus vers NON_MESURE' <<'PY'
old = '''  if [ "$sc_val" = "oui" ]; then
    vbc__rendre_non_mesure "VBC_SOURCE_CASSEE=oui — la source du controle est declaree cassee, aucun champ n est mesurable"
    return 4
  fi'''
new = ''
assert old in s
s = s.replace(old, new)
PY

echo "== Le discriminant NON_MESURE vs REFUS sur texte vide est effacé =="
essai 'un texte vide devient TOUJOURS NON_MESURE, même avec VBC_SOURCE_CASSEE=non explicite' <<'PY'
old = '''  if [ -z "$texte" ] && [ "$sc_explicite_non" -ne 1 ]; then'''
new = '''  if [ -z "$texte" ]; then'''
assert old in s
s = s.replace(old, new)
PY

echo "== MOTIF : seul le premier champ en REFUS est nommé (au lieu de TOUS) =="
essai 'l agrégation du motif s arrête au premier REFUS trouvé' <<'PY'
old = '''  local motifs=""
  [ "$v_adr" = "REFUS" ] && motifs="${motifs}${motifs:+ ; }ADR : ${m_adr}"
  [ "$v_brd" = "REFUS" ] && motifs="${motifs}${motifs:+ ; }BRD : ${m_brd}"
  [ "$v_onto" = "REFUS" ] && motifs="${motifs}${motifs:+ ; }ONTOLOGIE : ${m_onto}"
  [ "$v_app" = "REFUS" ] && motifs="${motifs}${motifs:+ ; }APPLICABLE : ${m_app}"'''
new = '''  local motifs=""
  if [ "$v_adr" = "REFUS" ]; then motifs="ADR : ${m_adr}"
  elif [ "$v_brd" = "REFUS" ]; then motifs="BRD : ${m_brd}"
  elif [ "$v_onto" = "REFUS" ]; then motifs="ONTOLOGIE : ${m_onto}"
  elif [ "$v_app" = "REFUS" ]; then motifs="APPLICABLE : ${m_app}"
  fi'''
assert old in s
s = s.replace(old, new)
PY

echo "== Verdict global : REFUS perd sa priorité sur SIGNALE =="
essai 'un champ REFUS et un champ SIGNALE ensemble rendent SIGNALE au lieu de REFUS' <<'PY'
old = '''  local verdict rc
  if [ -n "$motifs" ]; then
    verdict="REFUS"; rc=2
  elif [ "$v_adr" = "SIGNALE" ]; then'''
new = '''  local verdict rc
  if [ "$v_adr" = "SIGNALE" ]; then
    verdict="SIGNALE"; rc=1; motifs="ADR : ${m_adr}"
  elif [ -n "$motifs" ]; then'''
assert old in s
s = s.replace(old, new)
PY

echo "== Garde d'interpréteur : neutralisée — sourcé sous zsh, le REFUS silencieux (pire verdict) revient =="
if command -v zsh >/dev/null 2>&1; then
  essai 'la garde BASH_VERSION est neutralisée (ne se déclenche plus jamais)' <<'PY'
old = '''  if [ -z "${BASH_VERSION:-}" ]; then'''
new = '''  if false; then'''
assert old in s
s = s.replace(old, new)
PY
else
  echo "  ⚠️ zsh indisponible sur ce poste — cette mutation dépend du nouveau test zsh de test-verifie-brief-chef.sh (lui-même sauté sans zsh) : sautée pour rester cohérente avec l'instrument qu'elle mute."
fi

echo
echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
