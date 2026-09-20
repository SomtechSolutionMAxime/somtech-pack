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
s = s.replace("""      M = $2 + 0; m = $3 + 0; p = $4 + 0
      if (tag == "" || M > bM || (M == bM && (m > bm || (m == bm && p > bp)))) {
        bM = M; bm = m; bp = p; tag = $0
      }""",
"""      if (tag == "" || $0 > tag) { tag = $0 }""")
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
s = s.replace('  grep -E "$MD_SEMVER_MOTIF" || true', "  cat")
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

essai_skill "l'étape 8 n'appelle plus la mesure distante mais un numéro en dur" <<'PY'
s = s.replace("   md_prochaine_version patch          # ou minor / major",
              '   echo "v1.0.0"')
PY

essai_skill "l'étape 7.5 n'appelle plus md_statut_branche" <<'PY'
s = s.replace('STATUS="$(md_statut_branche "$branch")"', 'STATUS="merged"')
PY

essai_skill 'les appels du skill deviennent des COMMENTAIRES' <<'PY'
s = s.replace("   md_prochaine_version patch          # ou minor / major",
              '   # md_prochaine_version patch\n   echo "v1.0.0"')
s = s.replace('   STATUS="$(md_statut_branche "$branch")"',
              '   # md_statut_branche\n   STATUS="merged"')
s = s.replace('   md_rafraichir_origine || { echo "Fetch impossible — NE RIEN SUPPRIMER"; exit 1; }',
              '   # md_rafraichir_origine')
PY

essai_skill 'les blocs bash du skill disparaissent' <<'PY'
s = s.replace("```bash", "```text")
PY

essai_claude 'le CLAUDE.md represcrit le geste sous une AUTRE formulation' <<'PY'
s = s.replace("La commande juste est `git ls-remote --tags origin`, qui interroge le serveur à chaque appel,",
              "La commande juste est `git tag | head -1`, qui interroge le serveur à chaque appel,")
PY

echo "== Les trois survivantes de la revue de fond =="

essai 'DISTANT et LOCAL portent la valeur de l_autre (étiquettes permutées)' <<'PY'
s = s.replace('"$maj" "$min" "$pat" "${d:--}" "${l:--}" "$ecart"',
              '"$maj" "$min" "$pat" "${l:--}" "${d:--}" "$ecart"')
PY

# ⚠️ L'interdiction est écrite à DEUX endroits du skill (l'avertissement de
# l'étape 3 et la consigne de l'étape 8). Retirer l'un des deux laisse la règle
# énoncée — ce n'est pas un défaut. Le défaut, c'est qu'elle ne soit plus
# écrite NULLE PART : c'est donc les deux qu'on retire.
essai_skill "le skill ne dit plus NULLE PART qu'INDETERMINE interdit la suppression" <<'PY'
s = s.replace("""   **Pour les branches `INDETERMINE`** : idem, et **dire la raison**. Une mesure qui
   n'a pas pu se faire n'autorise aucune suppression.""", "")
s = s.replace("`INDETERMINE` **ne se supprime jamais**", "`INDETERMINE` se traite comme les autres")
PY

essai_skill 'le geste destructif porte sur TOUTE branche listée, plus seulement `merged`' <<'PY'
s = s.replace("   - **`oui`** : pour chaque branche `merged` **(jamais une branche `worktree`)**, executer :",
              "   - **`oui`** : pour chaque branche listee **(jamais une branche `worktree`)**, executer :")
PY

essai_skill 'le skill ne nomme plus du tout INDETERMINE' <<'PY'
import re
s = s.replace("INDETERMINE", "INDETERMINÉ_AUTRE_CHOSE")
PY

echo "== Le chiffre annoncé rouille-t-il en silence ? =="
N=$((N+1))
FAUX_CHLOG="${WORK}/changelog-rouille.md"
python3 - "${ROOT}/CHANGELOG.md" "$FAUX_CHLOG" <<'PY'
import sys, re
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()
before = s
s = re.sub(r'(test-merge-mesure-distante\.sh` — )\d+( assertions)', r'\g<1>7\g<2>', s, count=1)
if s == before:
    print("MUTATION-INOPERANTE", file=sys.stderr); sys.exit(2)
open(dst, "w", encoding="utf-8").write(s)
PY
if [ $? -ne 0 ]; then
  ko "MUTATION INOPÉRANTE — le chiffre annoncé n'a pas pu être déplacé dans le CHANGELOG"
else
  # La suite lit le CHANGELOG du dépôt : on la joue depuis une COPIE du dépôt
  # dont seul le CHANGELOG diffère, pour ne rien écrire ici.
  FAUX_ROOT="${WORK}/faux-root"
  mkdir -p "${FAUX_ROOT}/scripts/tests" "${FAUX_ROOT}/.claude/skills/merge/lib"
  cp "${ROOT}/CHANGELOG.md" "${FAUX_ROOT}/CHANGELOG.md.orig" 2>/dev/null || true
  cp "$FAUX_CHLOG" "${FAUX_ROOT}/CHANGELOG.md"
  cp "${ROOT}/scripts/tests/test-merge-mesure-distante.sh" "${FAUX_ROOT}/scripts/tests/"
  cp "${ROOT}/scripts/tests/test-mutations-merge-mesure-distante.sh" "${FAUX_ROOT}/scripts/tests/"
  cp "${ROOT}/CLAUDE.md" "${FAUX_ROOT}/CLAUDE.md"
  cp -R "${ROOT}/.claude/skills/merge" "${FAUX_ROOT}/.claude/skills/"
  (cd "${FAUX_ROOT}" && git init -q . && git add -A >/dev/null 2>&1 && git -c user.email=t@t.io -c user.name=t commit -qm x >/dev/null 2>&1)
  if bash "${FAUX_ROOT}/scripts/tests/test-merge-mesure-distante.sh" >"${WORK}/chlog.log" 2>&1; then
    ko "MUTANT SURVIVANT — un chiffre de couverture rouillé dans le CHANGELOG ne fait rien rougir"
  else
    ok "un chiffre de couverture rouillé → suite rouge"
  fi
fi

echo "== La garde de famille mord-elle ? =="
# Prouve que le balayage du dépôt accuse un fichier qui prescrirait la lecture
# locale. Aucun fichier n'est écrit : on ajoute un nom à la liste examinée.
N=$((N+1))
if MERGE_FAUX_INTRUS="docs/un-fichier-qui-prescrirait-la-lecture-locale.md" bash "$SUITE" >"${WORK}/intrus.log" 2>&1; then
  ko "MUTANT SURVIVANT — un fichier hors liste portant le motif ne fait pas rougir le balayage"
else
  ok "un fichier hors liste portant le motif → suite rouge"
fi

echo "== Les défauts de la seconde revue de fond =="

essai 'md_max_semver revient à une clé pondérée qui déborde' <<'PY'
s = s.replace("""      M = $2 + 0; m = $3 + 0; p = $4 + 0
      if (tag == "" || M > bM || (M == bM && (m > bm || (m == bm && p > bp)))) {
        bM = M; bm = m; bp = p; tag = $0
      }""",
"""      k = $2 * 1000000 + $3 * 1000 + $4
      if (tag == "" || k > best) { best = k; tag = $0 }""")
PY

essai_skill 'une phrase-leurre porte `merged` pendant que la vraie puce ne le porte plus' <<'PY'
s = s.replace("7. **Selon la reponse** :",
              "7. **Selon la reponse** — rappel : on ne supprime que ce qui est `merged` :")
s = s.replace("   - **`oui`** : pour chaque branche `merged` **(jamais une branche `worktree`)**, executer :",
              "   - **`oui`** : pour chaque branche listee **(jamais une branche `worktree`)**, executer :")
PY

essai_skill 'la puce qui gouverne le geste destructif ne le borne plus' <<'PY'
s = s.replace("   - **`oui`** : pour chaque branche `merged` **(jamais une branche `worktree`)**, executer :",
              "   - **`oui`** : pour chaque branche listee **(jamais une branche `worktree`)**, executer :")
PY

essai_skill 'la liste est numérotée ET la puce réelle est débridée, avec un leurre plus haut' <<'PY'
# Le bypass exact relevé par la revue de fond : changer la FORME de la liste
# faisait sortir le scan de la section, et il retombait sur une puce sans
# rapport — qu'il suffisait de faire mentionner `merged` pour tout valider.
s = s.replace("   - **`non`** : skipper et passer a l'Etape 8.",
              "   - **`non`** : skipper (rappel : seules les branches `merged` de 7.5 sont visees) et passer a l'Etape 8.")
s = s.replace("   - **`oui`** : pour chaque branche `merged` **(jamais une branche `worktree`)**, executer :",
              "   1. **`oui`** : pour chaque branche listee **(jamais une branche `worktree`)**, executer :")
PY

echo "== Une liste NUMÉROTÉE au sens inchangé ne doit PAS faire rougir =="
# L'autre moitié du même défaut : la garde rougissait à tort dès que la forme
# de la liste changeait, sur un texte dont le fond était intact.
N=$((N+1))
NUMEROTE="${WORK}/skill-numerote.md"
python3 - "$SKILL_SRC" "$NUMEROTE" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read(); before = s
s = s.replace("   - **`oui`** : pour chaque branche `merged` **(jamais une branche `worktree`)**, executer :",
              "   1. **`oui`** : pour chaque branche `merged` **(jamais une branche `worktree`)**, executer :", 1)
if s == before:
    print("MUTATION-INOPERANTE", file=sys.stderr); sys.exit(2)
open(dst, "w", encoding="utf-8").write(s)
PY
if [ $? -ne 0 ]; then
  ko "MUTATION INOPÉRANTE — la liste n'a pas pu être numérotée"
elif MERGE_SKILL_SRC="$NUMEROTE" bash "$SUITE" >"${WORK}/numerote.log" 2>&1; then
  ok "liste numérotée, fond inchangé → suite VERTE (aucun faux positif)"
else
  ko "FAUX POSITIF — changer la forme de la liste fait rougir la garde : $(grep -m1 '❌' "${WORK}/numerote.log")"
fi

echo "== T-20260815-0013 — le refus d'un numéro déjà pris =="

essai 'un serveur injoignable est annoncé LIBRE' <<'PY'
s = s.replace("""    echo "REFUS serveur-injoignable"
    return 2""",
"""    echo "LIBRE ${version}"
    return 0""")
PY

essai 'un numéro PRIS est annoncé libre' <<'PY'
s = s.replace("""  if [ -n "$ligne" ]; then
    echo "PRIS ${version} ${ligne}"
    return 1
  fi""", "")
PY

essai 'le refus ne nomme plus le tag en cause' <<'PY'
s = s.replace('echo "PRIS ${version} ${ligne}"', 'echo "PRIS"')
PY

essai 'le refus ne donne plus le sha du tag existant' <<'PY'
s = s.replace('echo "PRIS ${version} ${ligne}"', 'echo "PRIS ${version}"')
PY

# ⚠️ Une mutation « recherche par préfixe » a été écrite ici, puis RETIRÉE :
# elle survivait, parce que le refspec exact de `ls-remote` écarte déjà les
# préfixes et les déréférences. Le second filtre qu'elle abîmait était une
# ligne que rien ne pouvait faire rougir — on l'a retirée de la lib plutôt que
# de garder une mutation qui ne prouvait rien. Le fait est mesuré dans le banc
# (scénarios V-ter et V-quater), pas supposé.

essai 'la version malformée est acceptée au lieu d_être refusée' <<'PY'
s = s.replace("""  if ! md_semver_valide "$version"; then
    echo "REFUS version-malformee ${version}"; return 3
  fi""", "")
PY

essai 'la disponibilité se lit sur les tags LOCAUX' <<'PY'
s = s.replace("""  out="$(git ls-remote --tags "$remote" "refs/tags/${version}" 2>&1)"; rc=$?""",
              """  out="$(git tag --list "${version}" 2>&1 | sed 's#^#sha\\trefs/tags/#')"; rc=$?""")
PY

echo "== Les trois défauts de la revue de fond sur 0013 =="

essai 'la validation du format redevient un GLOB permissif' <<'PY'
s = s.replace("""  if ! md_semver_valide "$version"; then
    echo "REFUS version-malformee ${version}"; return 3
  fi""",
"""  case "$version" in
    v[0-9]*.[0-9]*.[0-9]*) : ;;
    *) echo "REFUS version-malformee ${version}"; return 3 ;;
  esac""")
PY

essai 'le motif de version accepte les zéros de tête' <<'PY'
s = s.replace("MD_SEMVER_MOTIF='^v(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$'",
              "MD_SEMVER_MOTIF='^v[0-9]+\\.[0-9]+\\.[0-9]+$'")
PY

# ⚠️ Une mutation « stderr refusionné sur le chemin de succès » a été écrite
# ici, puis RETIRÉE avec la séparation qu'elle éprouvait : elle SURVIVAIT,
# parce que le filtre sur la ref exacte écarte déjà toute ligne qui n'est pas
# la ref demandée. Les deux protections se recouvraient ; on garde celle qui
# peut rougir, et le scénario W-ter l'éprouve avec un relais qui écrit sur
# stderr en réussissant.

essai 'la première ligne venue est prise pour un sha' <<'PY'
s = s.replace("""  ligne="$(printf '%s\\n' "$out" | awk -v r="refs/tags/${version}" '$2 == r { print $1; exit }')\"""",
              """  ligne="$(printf '%s\\n' "$out" | awk 'NF { print $1; exit }')\"""")
PY

essai_skill "le bloc qui pose le tag ne rejoue plus la vérification" <<'PY'
s = s.replace("""md_version_libre "<version>" || { echo "Numero indisponible ou non verifiable — on ne tague pas"; exit 1; }
git tag <version>""", "git tag <version>")
PY

essai_skill "l_appel devient NU : présent, mais il n_arrête plus rien" <<'PY'
# Retrait CHIRURGICAL du seul enforcement : l'appel reste, son code de retour
# part à la poubelle, et `git tag` s'exécute quand même. Une garde qui cherche
# la PRÉSENCE du nom reste verte sur ce code — c'est ce qu'a trouvé la revue.
s = s.replace(
    'md_version_libre "<version>" || { echo "Numero indisponible ou non verifiable — on ne tague pas"; exit 1; }',
    'md_version_libre "<version>"')
PY

echo "== Une extension LÉGITIME du texte ne doit PAS faire rougir =="
# Symétrique d'une garde positionnelle : elle se contourne ET elle refuse à
# tort. Ici on éloigne la puce du bloc sans rien changer au fond — la suite
# doit rester VERTE. Un faux positif coûte une correction inutile et use la
# confiance dans le banc.
N=$((N+1))
LEGITIME="${WORK}/skill-legitime.md"
python3 - "$SKILL_SRC" "$LEGITIME" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()
before = s
ancre = "   - **`oui`** : pour chaque branche `merged` **(jamais une branche `worktree`)**, executer :\n"
ajout = ancre + "".join("     > Precision %d : ceci est une explication legitime, sans effet sur le fond.\n" % i for i in range(1, 8))
s = s.replace(ancre, ajout, 1)
if s == before:
    print("MUTATION-INOPERANTE", file=sys.stderr); sys.exit(2)
open(dst, "w", encoding="utf-8").write(s)
PY
if [ $? -ne 0 ]; then
  ko "MUTATION INOPÉRANTE — l'extension légitime n'a pas pu être insérée"
elif MERGE_SKILL_SRC="$LEGITIME" bash "$SUITE" >"${WORK}/legitime.log" 2>&1; then
  ok "sept lignes d'explication entre la puce et le bloc → suite VERTE (aucun faux positif)"
else
  ko "FAUX POSITIF — une extension légitime du texte fait rougir la garde : $(grep -m1 '❌' "${WORK}/legitime.log")"
fi

echo "== Le plancher peut-il mentir avec le CHANGELOG ? =="
# Le défaut relevé : baisser PLANCHER **et** le chiffre du CHANGELOG ensemble
# ne retire aucune assertion et rendait la garde verte sur un CHANGELOG faux.
N=$((N+1))
MENTEUR="${WORK}/menteur"
mkdir -p "${MENTEUR}/scripts/tests" "${MENTEUR}/.claude/skills"
cp "${ROOT}/CLAUDE.md" "${MENTEUR}/CLAUDE.md"
cp -R "${ROOT}/.claude/skills/merge" "${MENTEUR}/.claude/skills/"
cp "${ROOT}/scripts/tests/test-mutations-merge-mesure-distante.sh" "${MENTEUR}/scripts/tests/"
sed 's/^PLANCHER=[0-9]*$/PLANCHER=50/' "$SUITE" > "${MENTEUR}/scripts/tests/test-merge-mesure-distante.sh"
sed -E 's/(test-merge-mesure-distante\.sh` — )[0-9]+( assertions)/\150\2/' "${ROOT}/CHANGELOG.md" > "${MENTEUR}/CHANGELOG.md"
(cd "$MENTEUR" && git init -q . && git add -A >/dev/null 2>&1 && git -c user.email=t@t.io -c user.name=t commit -qm x >/dev/null 2>&1)
if bash "${MENTEUR}/scripts/tests/test-merge-mesure-distante.sh" >"${WORK}/menteur.log" 2>&1; then
  ko "MUTANT SURVIVANT — plancher et CHANGELOG abaissés ENSEMBLE restent verts : la garde interroge le plancher, pas le compte joué"
else
  ok "plancher et CHANGELOG abaissés ensemble → suite rouge (la garde mesure le compte JOUÉ)"
fi

# La vérification est écrite à DEUX endroits du skill — le récapitulatif et le
# bloc qui tague. En retirer un seul laisse l'autre : c'est les deux qu'on
# retire, sinon la mutation survit sans qu'aucune garde soit en défaut.
essai_skill "l'étape 8 ne vérifie plus NULLE PART la disponibilité du numéro" <<'PY'
s = s.replace("   md_version_libre v1.100.1", "   echo 'on suppose que le numero est libre'")
s = s.replace("""md_version_libre "<version>" || { echo "Numero indisponible ou non verifiable — on ne tague pas"; exit 1; }
""", "")
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

echo "== Le chiffre annoncé pour CETTE contre-épreuve =="
# Chaque banc garde SON propre chiffre, contre SON compte réellement joué —
# jamais contre son plancher, qui est une valeur entretenue à la main et donc
# un voisin de la chose à mesurer.
total=$(( PASS + FAIL + 1 ))
if grep -qF "test-mutations-merge-mesure-distante.sh\` — ${total} assertions" "${ROOT}/CHANGELOG.md"; then
  ok "le CHANGELOG annonce ${total} assertions pour la contre-épreuve, soit le compte réellement joué"
else
  annonce="$(grep -oE 'test-mutations-merge-mesure-distante\.sh` — [0-9]+ assertions' "${ROOT}/CHANGELOG.md" | grep -oE '[0-9]+' | head -1)"
  ko "le CHANGELOG annonce « ${annonce:-aucun} » assertions pour la contre-épreuve ; ${total} sont jouées — chiffre rouillé"
fi

echo "----------------------------------------"
echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"
PLANCHER=61
if [ "$((PASS + FAIL))" -lt "$PLANCHER" ]; then
  echo "❌ SUITE INTERROMPUE : $((PASS + FAIL)) assertions jouées, plancher ${PLANCHER}"
  exit 1
fi
[ "$FAIL" = "0" ] && { echo "✅ CHAQUE DÉFAUT RÉINTRODUIT FAIT ROUGIR LA GARDE"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
