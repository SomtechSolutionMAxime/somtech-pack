#!/usr/bin/env bash
# ============================================================
# test-mutations-merge-closes-stories.sh — v1.0.0
# La garde du correctif — T-20260922-0084.
#
# POURQUOI CE FICHIER EXISTE
# `test-merge-closes-stories.sh` et `test-merge-closes-stories-corpus.sh` sont
# verts. Un banc vert ne dit rien tant qu'on ne l'a pas vu rougir : une garde
# peut être verte par ACCIDENT DE FORMULATION — elle tient la bonne chose sans
# que personne l'ait choisi, et le jour où elle cesse de garder, elle reste
# verte avec le même visage. Même motif, même instrument que
# `test-mutations-merge-mesure-distante.sh` — on ne l'invente pas une seconde
# fois (règle d'or n°15).
#
# Ce fichier réintroduit, dans une COPIE de la lib, chacun des défauts RÉELS
# que la garde prétend fermer (PR #347 troncature, PR #338 ancrage, PR #329
# casse, dédoublonnage, abstention, fichier absent) et EXIGE que les DEUX
# suites (unitaire ET corpus) deviennent rouges. Le dépôt n'est jamais
# modifié.
#
# DEUX RÈGLES DE L'INSTRUMENT (héritées, payées les 19-20 septembre par
# `mesure-distante.sh`) :
#   · Une mutation qui ne mute rien rend zéro rouge — l'instrument REFUSE donc
#     une mutation sans effet (MUTATION-INOPERANTE).
#   · On déplace la VALEUR que la garde prétend tenir, on n'abîme pas le
#     chemin : une copie qui ne s'analyse plus rougirait toujours, et
#     n'accuserait que la mutation, pas le défaut visé.
#
# Usage : bash scripts/tests/test-mutations-merge-closes-stories.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LIB_SRC="${ROOT}/.claude/skills/merge/lib/merge-closes-stories.sh"
SUITE_UNIT="${SCRIPT_DIR}/test-merge-closes-stories.sh"
SUITE_CORPUS="${SCRIPT_DIR}/test-merge-closes-stories-corpus.sh"

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
# Joue les DEUX suites contre la copie mutée. La mutation doit faire rougir
# AU MOINS UNE des deux — c'est la garde qui ferait défaut en pratique.
essai() {
  local label="$1" M C rouge=0
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

  if ! MFS_LIB="$M" bash "$SUITE_UNIT" >"${WORK}/uout${N}" 2>&1; then rouge=1; fi
  if ! MFS_LIB="$M" bash "$SUITE_CORPUS" >"${WORK}/cout${N}" 2>&1; then rouge=1; fi

  if [ "$rouge" -eq 1 ]; then
    ok "${label} → au moins une suite rouge"
  else
    ko "MUTANT SURVIVANT — ${label} : les DEUX suites restent VERTES, la garde ne tient pas ça"
  fi
}

echo "== Contrôle préalable — les deux suites sont VERTES sur le code du dépôt =="
if bash "$SUITE_UNIT" >"${WORK}/base_u.log" 2>&1 && bash "$SUITE_CORPUS" >"${WORK}/base_c.log" 2>&1; then
  ok "les deux suites vertes avant toute mutation"
else
  ko "au moins une suite est DÉJÀ rouge — aucun mutant ne prouverait quoi que ce soit"
  echo "--- unitaire ---"; tail -15 "${WORK}/base_u.log"
  echo "--- corpus   ---"; tail -15 "${WORK}/base_c.log"
  echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"; exit 1
fi

echo "== Le défaut PR #347 : retirer la troncature à la phrase =="
essai 'mfs_tronquer_a_la_phrase ne tronque plus (rend le texte tel quel)' <<'PY'
old = '''mfs_tronquer_a_la_phrase() {
  local texte="$1"
  printf '%s' "${texte%%.*}"
}'''
new = '''mfs_tronquer_a_la_phrase() {
  local texte="$1"
  printf '%s' "$texte"
}'''
assert old in s
s = s.replace(old, new)
PY

echo "== Le défaut PR #338 : lire TOUTE ligne, pas seulement les lignes étiquetées =="
essai 'mfs_tickets_du_corps extrait des IDs de chaque ligne, étiquetée ou non' <<'PY'
old = '    reste="$(mfs_ligne_label "$ligne")" || continue'
new = '    reste="$ligne"'
assert old in s, "boucle de filtrage par label introuvable"
s = s.replace(old, new)
PY

echo "== Le défaut PR #329 : accepter le t- minuscule comme un ID =="
essai 'MFS_ID_MOTIF devient insensible à la casse du T-' <<'PY'
old = "MFS_ID_MOTIF='T-[0-9]{8}-[0-9]{4}'"
new = "MFS_ID_MOTIF='[Tt]-[0-9]{8}-[0-9]{4}'"
assert old in s
s = s.replace(old, new)
PY

echo "== Dédoublonnage retiré =="
essai 'la boucle de dédoublonnage est neutralisée (vu forcé à 0)' <<'PY'
old = '''      vu=0
      for existant in "${resultat[@]+"${resultat[@]}"}"; do
        [ "$existant" = "$id" ] && { vu=1; break; }
      done
      [ "$vu" -eq 0 ] && resultat+=("$id")'''
new = '''      vu=0
      resultat+=("$id")'''
assert old in s
s = s.replace(old, new)
PY

echo "== Abstention (INDETERMINE) retirée — devine plutôt que de s'arrêter =="
essai 'mfs_tickets_du_corps rend rc=0 même sans aucun ticket trouvé' <<'PY'
old = '''  if [ "${#resultat[@]}" -eq 0 ]; then
    return 1
  fi
  printf '%s\\n' "${resultat[@]}"
  return 0'''
new = '''  if [ "${#resultat[@]}" -eq 0 ]; then
    return 0
  fi
  printf '%s\\n' "${resultat[@]}"
  return 0'''
assert old in s
s = s.replace(old, new)
PY

echo "== Garde-fou fichier absent retiré (rc=2 devient un no-op silencieux) =="
essai 'mfs_tickets_du_corps ne vérifie plus que le fichier existe' <<'PY'
old = '''  if [ ! -f "$fichier" ]; then
    echo "mfs_tickets_du_corps: fichier absent: $fichier" >&2
    return 2
  fi

'''
new = ''
assert old in s
s = s.replace(old, new)
PY

echo
echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
