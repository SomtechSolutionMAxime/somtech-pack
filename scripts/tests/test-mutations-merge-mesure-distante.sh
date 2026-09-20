#!/usr/bin/env bash
# ============================================================
# test-mutations-merge-mesure-distante.sh — v1.0.0
# La garde du correctif — T-20260820-0097.
#
# POURQUOI CE FICHIER EXISTE
# `test-merge-mesure-distante.sh` est vert. Un banc vert ne dit rien tant qu'on
# ne l'a pas vu rougir : une garde peut être verte par ACCIDENT DE FORMULATION
# — elle tient la bonne chose sans que personne l'ait choisi, et le jour où
# elle cesse de garder, elle reste verte avec le même visage.
#
# Ce fichier réintroduit, dans une COPIE de la lib, chacun des défauts que la
# garde prétend fermer, et EXIGE que la suite devienne rouge. Le dépôt n'est
# jamais modifié.
#
# DEUX RÈGLES DE L'INSTRUMENT, payées les 19 et 20 septembre :
#   · Une mutation qui ne mute rien rend zéro rouge — exactement comme une
#     garde qui tient. L'instrument REFUSE donc une mutation sans effet
#     (MUTATION-INOPERANTE), et le scénario Z le prouve sur lui-même.
#   · On déplace la VALEUR que la garde prétend tenir, on n'abîme pas le
#     chemin : une copie qui ne s'analyse plus rougirait toujours, et
#     n'accuserait que la mutation. `essai` le vérifie avant de conclure.
#
# Usage : bash scripts/tests/test-mutations-merge-mesure-distante.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LIB_SRC="${ROOT}/.claude/skills/merge/lib/mesure-distante.sh"
SUITE="${SCRIPT_DIR}/test-merge-mesure-distante.sh"
SKILL_SRC="${ROOT}/.claude/skills/merge/SKILL.md"
CLAUDE_SRC="${ROOT}/CLAUDE.md"

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
  if MERGE_MESURE_SRC="$M" bash "$SUITE" >"${WORK}/out${N}" 2>&1; then
    ko "MUTANT SURVIVANT — ${label} : la suite reste VERTE, la garde ne tient pas ça"
  else
    ok "${label} → suite rouge"
  fi
}

# essai_skill <libellé> — même instrument, appliqué au TEXTE du skill.
essai_skill() {
  local label="$1" M C
  N=$((N+1)); M="${WORK}/s${N}.md"; C="${WORK}/sc${N}.py"
  cat > "$C"
  if ! applique "$SKILL_SRC" "$M" "$C" 2>"${WORK}/serr${N}"; then
    ko "MUTATION INOPÉRANTE — ${label} : le motif ne correspond à aucun texte du skill (l'épreuve n'a PAS eu lieu)"
    return
  fi
  if MERGE_SKILL_SRC="$M" bash "$SUITE" >"${WORK}/sout${N}" 2>&1; then
    ko "MUTANT SURVIVANT — ${label} : la suite reste VERTE, la garde ne tient pas ça"
  else
    ok "${label} → suite rouge"
  fi
}

# essai_claude <libellé> — même instrument, appliqué au CLAUDE.md du dépôt.
essai_claude() {
  local label="$1" M C
  N=$((N+1)); M="${WORK}/c${N}.md"; C="${WORK}/cc${N}.py"
  cat > "$C"
  if ! applique "$CLAUDE_SRC" "$M" "$C" 2>"${WORK}/cerr${N}"; then
    ko "MUTATION INOPÉRANTE — ${label} : le motif ne correspond à aucun texte du CLAUDE.md (l'épreuve n'a PAS eu lieu)"
    return
  fi
  if MERGE_CLAUDE_MD_SRC="$M" bash "$SUITE" >"${WORK}/cout${N}" 2>&1; then
    ko "MUTANT SURVIVANT — ${label} : la suite reste VERTE, la garde ne tient pas ça"
  else
    ok "${label} → suite rouge"
  fi
}

echo "== Contrôle préalable — la suite est VERTE sur le code du dépôt =="
if bash "$SUITE" >"${WORK}/base.log" 2>&1; then
  ok "suite verte avant toute mutation"
else
  ko "la suite est DÉJÀ rouge — aucun mutant ne prouverait quoi que ce soit"
  echo "--- sortie ---"; tail -20 "${WORK}/base.log"
  echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"; exit 1
fi

echo "== Le défaut d'origine : mesurer les tags EN LOCAL =="

essai 'md_tags_distants lit `git tag` au lieu de `git ls-remote`' <<'PY'
s = s.replace('out="$(git ls-remote --tags "$remote" 2>&1)"; rc=$?',
              'out="$(git tag --list 2>&1)"; rc=$?')
PY

essai 'md_dernier_tag_distant retombe sur les tags locaux quand le distant échoue' <<'PY'
s = s.replace('  [ "$rc" -ne 0 ] && return "$rc"\n  printf \'%s\\n\' "$liste" | md_max_semver',
              '  [ "$rc" -ne 0 ] && liste="$(git tag --list)"\n  printf \'%s\\n\' "$liste" | md_max_semver')
PY

echo "== Le repli silencieux quand le distant est injoignable =="

essai 'md_prochaine_version replie sur le dernier tag LOCAL au lieu de REFUSER' <<'PY'
s = s.replace('    echo "REFUS distant-injoignable"\n    return 2',
              '    d="$(md_dernier_tag_local)"; rc=0')
PY

essai "md_ecart_tags tait l'injoignabilité et annonce A-JOUR" <<'PY'
s = s.replace('if [ "$rc" -ne 0 ]; then echo "DISTANT-INJOIGNABLE"; return 2; fi',
              'if [ "$rc" -ne 0 ]; then echo "A-JOUR - -"; return 0; fi')
PY

essai "md_rafraichir_origine avale l'échec du fetch" <<'PY'
s = s.replace("""    printf 'md_rafraichir_origine: échec du fetch %s — %s\\n' "$remote" "$out" >&2
    return 2""", "    : ")
PY

echo "== Le tri qui ment =="

essai 'md_max_semver compare les tags comme du TEXTE (v1.9.0 > v1.100.0)' <<'PY'
s = s.replace('{ k = $2 * 1000000 + $3 * 1000 + $4; if (tag == "" || k > best) { best = k; tag = $0 } }',
              '{ if (tag == "" || $0 > tag) { tag = $0 } }')
PY

echo "== L'étape 7.5 : décider sur la ref LOCALE =="

essai 'md_statut_branche décide sur `main` local par défaut' <<'PY'
s = s.replace('local branch="${1:-}" ref="${2:-origin/main}"',
              'local branch="${1:-}" ref="${2:-main}"')
PY

echo "== L'erreur avalée sur un chemin qui SUPPRIME =="

essai 'une ref de décision absente est lue comme MERGED' <<'PY'
s = s.replace('    echo "INDETERMINE ref-de-decision-absente ${ref}"; return 3',
              '    echo "MERGED"; return 0')
PY

essai 'une branche absente est lue comme MERGED' <<'PY'
s = s.replace('    echo "INDETERMINE branche-absente ${branch}"; return 3',
              '    echo "MERGED"; return 0')
PY

essai 'une branche vide est lue comme MERGED' <<'PY'
s = s.replace('if [ -z "$branch" ]; then echo "INDETERMINE branche-non-fournie"; return 3; fi',
              'if [ -z "$branch" ]; then echo "MERGED"; return 0; fi')
PY

essai "un \`git diff\` en échec (rc>1) est lu comme MERGED — le 2>/dev/null d'origine" <<'PY'
s = s.replace('    *) echo "INDETERMINE diff-echoue rc=${rc} ${out}"; return 3 ;;',
              '    *) echo "MERGED"; return 0 ;;')
PY

essai 'md_merge_base en échec est lu comme MERGED' <<'PY'
s = s.replace('if [ "$rc" -ne 0 ]; then echo "INDETERMINE merge-base-echoue ${out}"; return 3; fi',
              'if [ "$rc" -ne 0 ]; then echo "MERGED"; return 0; fi')
PY

echo "== Le calcul lui-même =="

essai 'le bump patch saute un numéro' <<'PY'
s = s.replace('    patch) pat=$((pat + 1)) ;;', '    patch) pat=$((pat + 2)) ;;')
PY

essai 'un bump inconnu retombe sur patch au lieu de REFUSER' <<'PY'
s = s.replace('    *) echo "REFUS bump-inconnu ${bump}"; return 4 ;;',
              '    *) pat=$((pat + 1)) ;;')
PY

echo "== Seconde ronde — ce que la première n'atteignait pas =="
# Les treize premières mutations tuaient toutes. « Zéro survivante sur un
# SOUS-ENSEMBLE ne dit rien de la population » : un compte fixé d'avance est
# choisi par celui-là même dont on éprouve les angles morts. Cette ronde a
# d'abord rendu DIX survivantes. Neuf sont closes et gardées ici. La dixième a
# révélé l'inverse : deux nettoyages de la liste distante (`^{}`, `sort -u`) que
# RIEN ne pouvait faire rougir, parce que le filtre semver les rendait inutiles.
# On ne les a pas gardés — on les a retirés.

essai 'le filtre semver est retiré : une pré-version passe devant' <<'PY'
s = s.replace("  grep -E '^v[0-9]+\\.[0-9]+\\.[0-9]+$' || true", "  cat")
PY

essai 'le cas « aucun tag nulle part » disparaît' <<'PY'
s = s.replace('if [ -z "$d" ] && [ -z "$l" ]; then echo "AUCUN-TAG - -"; return 0; fi', '')
PY

essai 'un tag local jamais poussé est annoncé A-JOUR' <<'PY'
s = s.replace('    echo "LOCAL-EN-AVANCE ${l} ${d}"', '    echo "A-JOUR ${l} ${d}"')
PY

essai 'un clone SANS tag est annoncé A-JOUR au lieu de EN-RETARD' <<'PY'
s = s.replace('if [ -z "$l" ]; then echo "LOCAL-EN-RETARD - ${d}"; return 0; fi',
              'if [ -z "$l" ]; then echo "A-JOUR - ${d}"; return 0; fi')
PY

essai 'le bump major ne remet pas minor et patch à zéro' <<'PY'
s = s.replace("    major) maj=$((maj + 1)); min=0; pat=0 ;;", "    major) maj=$((maj + 1)) ;;")
PY

essai 'le bump minor ne remet pas patch à zéro' <<'PY'
s = s.replace("    minor) min=$((min + 1)); pat=0 ;;", "    minor) min=$((min + 1)) ;;")
PY

essai 'la base part d ailleurs que v0.0.0 quand le distant n a aucun tag' <<'PY'
s = s.replace('  if [ -z "$d" ]; then maj=0; min=0; pat=0; else',
              '  if [ -z "$d" ]; then maj=9; min=9; pat=9; else')
PY

essai 'md_rafraichir_origine ne rapatrie plus les TAGS' <<'PY'
s = s.replace('out="$(git fetch --tags --prune "$remote" 2>&1)"',
              'out="$(git fetch --prune "$remote" 2>&1)"')
PY

essai 'la sortie ne nomme plus DISTANT, LOCAL ni ECART' <<'PY'
s = s.replace("""printf 'PROCHAINE v%s.%s.%s DISTANT %s LOCAL %s ECART %s\\n' \\
    "$maj" "$min" "$pat" "${d:--}" "${l:--}" "$ecart\"""",
              """printf 'PROCHAINE v%s.%s.%s\\n' "$maj" "$min" "$pat\"""")
PY

echo "== L'accord entre le skill et la lib =="
# Le fait vit à deux endroits. Une garde bornée à la lib laisserait le texte du
# skill prescrire l'ancien geste — et c'est le texte que les agents appliquent.

essai_skill 'le skill represcrit la lecture des tags LOCAUX' <<'PY'
s = s.replace("   md_prochaine_version patch          # ou minor / major",
              "   git tag --sort=-v:refname | head -1")
PY

essai_skill "l'étape 7.5 recompare à \`main\` local" <<'PY'
s = s.replace('STATUS="$(md_statut_branche "$branch")"',
              'git merge-base main "$branch"')
PY

essai_skill 'le skill appelle une fonction qui n_existe pas dans la lib' <<'PY'
s = s.replace('md_prochaine_version patch          # ou minor / major',
              'md_prochaine_version_inventee patch')
PY

essai_claude 'le CLAUDE.md du dépôt represcrit la lecture des tags LOCAUX' <<'PY'
s = s.replace("**La version du pack se lit sur le tag git** — qui en est la source unique.",
              "**La version du pack se lit sur le tag git** — `git tag --sort=-v:refname | head -1` — qui en est la source unique.")
PY

essai_claude 'le CLAUDE.md ne dit plus où se lit le tag qui fait foi' <<'PY'
s = s.replace("La commande juste est `git ls-remote --tags origin`, qui interroge le serveur à chaque appel, ou à défaut un `git fetch --tags` **explicite** avant de lire.",
              "Fetche avant de lire.")
PY

echo "== Z — l'instrument refuse une épreuve VIDE =="
# Un motif qui ne correspond à rien : une mutation sans effet rend zéro rouge,
# exactement comme une garde qui tient. Si `applique` l'acceptait, tout ce
# fichier pourrait être un mensonge vert.
cat > "${WORK}/vide.py" <<'PY'
s = s.replace("CE-TEXTE-N-EXISTE-NULLE-PART-DANS-LA-LIB", "x")
PY
if applique "$LIB_SRC" "${WORK}/vide.sh" "${WORK}/vide.py" 2>"${WORK}/vide.err"; then
  ko "l'instrument a ACCEPTÉ une mutation sans effet — une épreuve vide se lirait comme une garde qui tient"
elif grep -q "MUTATION-INOPERANTE" "${WORK}/vide.err"; then
  ok "mutation sans effet REFUSÉE, et nommée (MUTATION-INOPERANTE)"
else
  ko "mutation sans effet rejetée, mais sans le dire : '$(cat "${WORK}/vide.err")'"
fi

echo "----------------------------------------"
echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"
PLANCHER=30
if [ "$((PASS + FAIL))" -lt "$PLANCHER" ]; then
  echo "❌ SUITE INTERROMPUE : $((PASS + FAIL)) assertions jouées, plancher ${PLANCHER}"
  exit 1
fi
[ "$FAIL" = "0" ] && { echo "✅ CHAQUE DÉFAUT RÉINTRODUIT FAIT ROUGIR LA GARDE"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
