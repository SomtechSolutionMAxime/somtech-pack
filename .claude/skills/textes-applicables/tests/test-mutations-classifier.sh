#!/usr/bin/env bash
# ============================================================
# test-mutations-classifier.sh — v1.1.0
# La garde du classifier — T-20260922-0135 (D-20260921-0016 Q2b).
#
# Un banc vert ne dit rien tant qu'on ne l'a pas vu rougir (regle d'or
# heritee de test-mutations-merge-closes-stories.sh, meme motif, meme
# instrument — on ne l'invente pas une seconde fois).
#
# v1.1.0 : mutations reecrites contre la version corrigee de classifier.sh
# (revue de fond a trouve un defaut reel en v1.0.0 — decision et rendu
# lisaient deux champs independants — et un trou de couverture : aucune
# mutation ne testait une inversion text_ref/title dans le format de rendu).
# La mutation "inversion de champs" ci-dessous reproduit exactement l'epreuve
# manuelle de la revue de fond, desormais reproductible en CI.
#
# Ce fichier reintroduit, dans une COPIE de la lib, chacun des defauts reels
# que la garde pretend fermer et EXIGE que le banc unitaire devienne rouge.
# Le depot n'est jamais modifie.
#
# Usage : bash .claude/skills/textes-applicables/tests/test-mutations-classifier.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_SRC="${SCRIPT_DIR}/../lib/classifier.sh"
SUITE="${SCRIPT_DIR}/test-classifier.sh"

command -v python3 >/dev/null 2>&1 || { echo "⚠️  python3 indisponible — mutations sautees (skip)"; exit 0; }

WORK="$(mktemp -d)"; PASS=0; FAIL=0; N=0
trap 'rm -rf "$WORK"' EXIT
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

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
  if TAP_LIB="$M" bash "$SUITE" >"${WORK}/out${N}" 2>&1; then
    ko "MUTANT SURVIVANT — ${label} : le banc reste VERT, la garde ne tient pas ça"
  else
    ok "${label} → banc rouge"
  fi
}

echo "== Controle prealable — le banc est VERT sur le code du depot =="
if bash "$SUITE" >"${WORK}/base.log" 2>&1; then
  ok "banc vert avant toute mutation"
else
  ko "le banc est DEJA rouge — aucun mutant ne prouverait quoi que ce soit"
  tail -20 "${WORK}/base.log"
  echo "Assertions jouees : $((PASS + FAIL)) — ${PASS} OK, ${FAIL} KO"; exit 1
fi

echo "== Collapse etats 1&3 : un appel echoue calcule quand meme la validite =="
essai 'tap_classifie ignore rc_appel (calcule "valide" meme en echec)' <<'PY'
old = '''  local valide=""
  if [ "$rc_appel" -eq 0 ]; then
    valide="$(jq -r \'if .success == true and (.applicable_texts | type) == "array" then "ok" else empty end\' "$fichier" 2>/dev/null)"
  fi
'''
new = '''  local valide=""
  valide="$(jq -r \'if .success == true and (.applicable_texts | type) == "array" then "ok" else empty end\' "$fichier" 2>/dev/null)"
'''
assert old in s
s = s.replace(old, new)
PY

echo "== Collapse etats 2&3 : success=false (mais tableau present) traite comme valide =="
essai 'tap_classifie ne verifie plus .success == true' <<'PY'
old = 'if .success == true and (.applicable_texts | type) == "array" then "ok" else empty end'
new = 'if (.applicable_texts | type) == "array" then "ok" else empty end'
assert old in s
s = s.replace(old, new)
PY

echo "== Collapse etats 2&3 : le type de applicable_texts n'est plus verifie =="
essai 'tap_classifie accepte applicable_texts non-tableau (null, chaine, etc.)' <<'PY'
old = 'if .success == true and (.applicable_texts | type) == "array" then "ok" else empty end'
new = 'if .success == true then "ok" else empty end'
assert old in s
s = s.replace(old, new)
PY

echo "== Collapse etats 1&2 : une liste vide se rend comme textes-declares =="
essai 'tap_classifie ne distingue plus count=0 de count>0' <<'PY'
old = '''  if [ "$count" -eq 0 ]; then
    printf \'aucun texte declare\\n\'
    return 1
  fi

'''
assert old in s
s = s.replace(old, "")
PY

echo "== Inversion de champs : text_ref et title echangent leur position dans le rendu =="
# Reproduit l'epreuve MANUELLE de la revue de fond (T-20260922-0135) : un
# bug de formatage qui melangerait l'identite de chaque pointeur.
essai 'tap_classifie rend "<title> — <text_ref> (...)" au lieu de "<text_ref> — <title> (...)"' <<'PY'
old = 'jq -r \'.applicable_texts[] | "\\(.text_ref) — \\(.title) (\\(.somcraft_uuid))"\' "$fichier"'
new = 'jq -r \'.applicable_texts[] | "\\(.title) — \\(.text_ref) (\\(.somcraft_uuid))"\' "$fichier"'
assert old in s
s = s.replace(old, new)
PY

echo "== Fuite de contenu : application_note (non-pointeur) se glisse dans le rendu =="
essai 'tap_classifie rend application_note en plus du pointeur (fuite de contenu recopie)' <<'PY'
old = 'jq -r \'.applicable_texts[] | "\\(.text_ref) — \\(.title) (\\(.somcraft_uuid))"\' "$fichier"'
new = 'jq -r \'.applicable_texts[] | "\\(.text_ref) — \\(.title) (\\(.somcraft_uuid)) NOTE=\\(.application_note // "")"\' "$fichier"'
assert old in s
s = s.replace(old, new)
PY

echo ""
echo "Assertions jouees : $((PASS + FAIL)) — ${PASS} OK, ${FAIL} KO"
[ "$FAIL" -eq 0 ]
