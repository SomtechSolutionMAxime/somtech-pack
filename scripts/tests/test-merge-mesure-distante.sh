#!/usr/bin/env bash
# ============================================================
# test-merge-mesure-distante.sh — v1.0.0
# Garde des mesures distantes de /merge — T-20260820-0097.
#
# Ce que cette garde ferme, nommément :
#   1. /merge propose un numéro de version calculé sur les tags LOCAUX alors
#      que le distant en porte un plus récent.
#   2. Distant injoignable → repli silencieux sur le local (un numéro est
#      quand même proposé).
#   3. L'étape 7.5 déclare « mergée » — donc supprimable — une branche dont
#      les changements ne sont QUE sur `main` local.
#   4. Une panne de mesure (ref absente, branche absente, git en échec) se lit
#      comme « mergée » parce que l'erreur est avalée.
#
# Chaque scénario est construit pour DIVERGER : un dépôt dont le local et le
# distant concordent ne peut pas révéler ce défaut — c'est exactement pourquoi
# personne ne l'avait vu mordre en deux ans.
#
# Les deux fichiers sous garde sont surchargeables — MERGE_MESURE_SRC pour la lib,
# MERGE_SKILL_SRC pour le texte du skill : c'est ce qui
# permet à `test-mutations-merge-mesure-distante.sh` de jouer cette même suite
# contre une COPIE mutée, et d'exiger qu'elle rougisse.
#
# Usage : bash scripts/tests/test-merge-mesure-distante.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LIB="${MERGE_MESURE_SRC:-${ROOT}/.claude/skills/merge/lib/mesure-distante.sh}"

if [ ! -f "$LIB" ]; then
  echo "❌ lib introuvable : $LIB"; exit 1
fi
# shellcheck source=../../.claude/skills/merge/lib/mesure-distante.sh
source "$LIB"

PASS=0; FAIL=0
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Un dépôt jetable, sans configuration de poste ni signature.
git_local() { git -C "$CLONE" -c user.email=t@t.io -c user.name=t -c commit.gpgsign=false "$@"; }

ORIGIN="${WORK}/origin.git"
CLONE="${WORK}/clone"
AUTRE="${WORK}/autre"

git init -q --bare "$ORIGIN"
git init -q "$CLONE"
git_local remote add origin "$ORIGIN"
echo un > "${CLONE}/f.txt"
git_local add -A
git_local commit -qm "socle"
git_local branch -M main
git_local push -q -u origin main
git_local tag v1.1.0
git_local push -q origin v1.1.0

# Un SECOND dépôt pousse un tag plus récent : le clone ne le connaît pas.
git clone -q "$ORIGIN" "$AUTRE"
git -C "$AUTRE" -c user.email=t@t.io -c user.name=t tag v1.2.0
git -C "$AUTRE" push -q origin v1.2.0
# ... et un tag dont le tri LEXICOGRAPHIQUE mentirait.
git -C "$AUTRE" -c user.email=t@t.io -c user.name=t tag v1.9.0
git -C "$AUTRE" push -q origin v1.9.0

cd "$CLONE" || exit 1

echo "== A — le local RETARDE, et la mesure distante le voit =="
loc="$(md_dernier_tag_local)"
dis="$(md_dernier_tag_distant)"
[ "$loc" = "v1.1.0" ] && ok "tags locaux : v1.1.0 (le clone n'a pas fetché)" \
  || ko "attendu v1.1.0 en local, obtenu '$loc'"
[ "$dis" = "v1.9.0" ] && ok "tags distants : v1.9.0 (lu sur le serveur)" \
  || ko "attendu v1.9.0 côté distant, obtenu '$dis'"
[ "$loc" != "$dis" ] \
  && ok "le scénario DIVERGE (${loc} ≠ ${dis}) — sans cet écart, rien n'est prouvable" \
  || ko "SCÉNARIO INOPÉRANT : local et distant concordent, la suite ne peut rien prouver"

echo "== B — l'écart est DIT =="
ecart="$(md_ecart_tags)"
case "$ecart" in
  "LOCAL-EN-RETARD v1.1.0 v1.9.0") ok "écart annoncé : $ecart" ;;
  *) ko "attendu 'LOCAL-EN-RETARD v1.1.0 v1.9.0', obtenu '$ecart'" ;;
esac

echo "== C — la prochaine version est calculée sur le DISTANT =="
out="$(md_prochaine_version patch)"; rc=$?
suggere="$(printf '%s' "$out" | awk '{print $2}')"
[ "$rc" -eq 0 ] && ok "calcul rendu (rc=0)" || ko "rc attendu 0, obtenu $rc"
[ "$suggere" = "v1.9.1" ] && ok "prochaine version v1.9.1 (depuis le distant)" \
  || ko "attendu v1.9.1, obtenu '$suggere' — calcul fait sur le LOCAL ?"
[ "$suggere" != "v1.1.1" ] && ok "ce n'est PAS v1.1.1, le numéro local" \
  || ko "v1.1.1 proposé : le défaut T-20260820-0097 est toujours là"

echo "== D — le tri est numérique, pas lexicographique =="
git -C "$AUTRE" -c user.email=t@t.io -c user.name=t tag v1.100.0
git -C "$AUTRE" push -q origin v1.100.0
dis="$(md_dernier_tag_distant)"
[ "$dis" = "v1.100.0" ] && ok "v1.100.0 > v1.9.0" \
  || ko "attendu v1.100.0, obtenu '$dis' — tri lexicographique ?"
out="$(md_prochaine_version minor)"
[ "$(printf '%s' "$out" | awk '{print $2}')" = "v1.101.0" ] && ok "bump minor : v1.101.0" \
  || ko "attendu v1.101.0, obtenu '$out'"

echo "== E — distant INJOIGNABLE : REFUS, jamais un repli sur le local =="
git_local remote set-url origin "${WORK}/nexiste-pas.git"
out="$(md_prochaine_version patch 2>/dev/null)"; rc=$?
[ "$rc" -eq 2 ] && ok "rc=2 (refus)" || ko "rc attendu 2, obtenu $rc"
case "$out" in
  REFUS*) ok "sortie : $out" ;;
  *) ko "attendu un REFUS, obtenu '$out'" ;;
esac
printf '%s' "$out" | grep -qE 'v[0-9]' \
  && ko "un numéro de version est proposé malgré le distant injoignable — repli silencieux" \
  || ok "aucun numéro proposé : pas de repli sur les tags locaux"
ecart="$(md_ecart_tags 2>/dev/null)"; rc=$?
{ [ "$rc" -eq 2 ] && [ "$ecart" = "DISTANT-INJOIGNABLE" ]; } \
  && ok "l'écart dit l'injoignabilité au lieu de se taire" \
  || ko "attendu 'DISTANT-INJOIGNABLE' rc=2, obtenu '$ecart' rc=$rc"
out="$(md_rafraichir_origine 2>/dev/null)"; rc=$?
[ "$rc" -eq 2 ] && ok "md_rafraichir_origine échoue franchement (rc=2)" \
  || ko "un fetch impossible doit rendre rc=2, obtenu $rc"
git_local remote set-url origin "$ORIGIN"

echo "== F — statut de branche : la ref de décision est le DISTANT =="
git_local checkout -q -b feat-locale
echo deux > "${CLONE}/g.txt"
git_local add -A
git_local commit -qm "travail jamais poussé"
git_local checkout -q main
git_local merge -q --ff-only feat-locale
# `main` LOCAL porte maintenant le commit ; `origin/main` non.
git_local fetch -q origin

st_local="$(md_statut_branche feat-locale main)"
st_distant="$(md_statut_branche feat-locale origin/main)"
[ "$st_local" = "MERGED" ] && ok "face à \`main\` local : MERGED (ce que faisait l'étape 7.5)" \
  || ko "attendu MERGED face à main local, obtenu '$st_local'"
[ "$st_distant" = "UNMERGED" ] && ok "face à \`origin/main\` : UNMERGED — la branche n'est PAS supprimable" \
  || ko "attendu UNMERGED face à origin/main, obtenu '$st_distant' — une branche non poussée serait SUPPRIMÉE"
[ "$st_local" != "$st_distant" ] \
  && ok "les deux refs DIVERGENT (${st_local} ≠ ${st_distant}) — c'est le discriminant" \
  || ko "SCÉNARIO INOPÉRANT : les deux refs rendent le même verdict"

# L'étape 7.5 appelle sans ref : c'est le DÉFAUT qui décide, et c'est donc lui
# qu'il faut garder. Une garde qui ne teste que la ref explicite laisse la
# valeur par défaut libre de retomber sur `main` local.
st_defaut="$(md_statut_branche feat-locale)"
[ "$st_defaut" = "UNMERGED" ] \
  && ok "SANS ref explicite : UNMERGED — le défaut porte bien sur le distant" \
  || ko "attendu UNMERGED sans ref explicite, obtenu '$st_defaut' — la ref par défaut est LOCALE"

echo "== G — une fois poussé, la branche EST mergée =="
git_local push -q origin main
git_local fetch -q origin
st="$(md_statut_branche feat-locale origin/main)"
[ "$st" = "MERGED" ] && ok "après push : MERGED" || ko "attendu MERGED, obtenu '$st'"

echo "== H — panne de mesure : INDETERMINE, jamais MERGED =="
st="$(md_statut_branche feat-locale origin/nexiste-pas)"; rc=$?
{ [ "$rc" -eq 3 ] && case "$st" in INDETERMINE\ ref-de-decision-absente*) true ;; *) false ;; esac; } \
  && ok "ref de décision absente → $st (rc=3)" \
  || ko "attendu INDETERMINE ref-de-decision-absente rc=3, obtenu '$st' rc=$rc"
[ "$st" != "MERGED" ] && ok "une ref absente ne vaut pas MERGED" || ko "ref absente lue comme MERGED"

st="$(md_statut_branche branche-fantome origin/main)"; rc=$?
{ [ "$rc" -eq 3 ] && case "$st" in INDETERMINE\ branche-absente*) true ;; *) false ;; esac; } \
  && ok "branche absente → $st (rc=3)" \
  || ko "attendu INDETERMINE branche-absente rc=3, obtenu '$st' rc=$rc"

st="$(md_statut_branche "" origin/main)"; rc=$?
[ "$rc" -eq 3 ] && ok "branche vide → INDETERMINE (rc=3)" \
  || ko "une branche vide doit rendre rc=3, obtenu '$st' rc=$rc"

echo "== K — une mesure qui PLANTE ne vaut pas MERGED =="
# Le `2>/dev/null` d'origine avalait l'échec de `git merge-base` sur un chemin
# qui fait `git branch -D` ET `git push origin --delete`. Ce chemin ne se
# produit pas spontanément : on le fabrique, en intercalant devant `git` un
# relais qui délègue TOUT au vrai git sauf la sous-commande visée.
GIT_REEL="$(command -v git)"
FAUX="${WORK}/faux-git"; mkdir -p "$FAUX"
faire_relais() {  # faire_relais <sous-commande-qui-echoue> <code>
  cat > "${FAUX}/git" <<RELAIS
#!/usr/bin/env bash
if [ "\${1:-}" = "$1" ]; then echo "panne fabriquée: $1" >&2; exit $2; fi
exec "${GIT_REEL}" "\$@"
RELAIS
  chmod +x "${FAUX}/git"
}

faire_relais merge-base 129
st="$(PATH="${FAUX}:$PATH" md_statut_branche feat-locale origin/main)"; rc=$?
{ [ "$rc" -eq 3 ] && case "$st" in INDETERMINE\ merge-base-echoue*) true ;; *) false ;; esac; } \
  && ok "merge-base en panne → $st (rc=3)" \
  || ko "attendu INDETERMINE merge-base-echoue rc=3, obtenu '$st' rc=$rc"
[ "$st" != "MERGED" ] && ok "merge-base en panne ne vaut pas MERGED" \
  || ko "merge-base en panne lu comme MERGED — la branche serait SUPPRIMÉE"

faire_relais diff 129
st="$(PATH="${FAUX}:$PATH" md_statut_branche feat-locale origin/main)"; rc=$?
{ [ "$rc" -eq 3 ] && case "$st" in INDETERMINE\ diff-echoue*) true ;; *) false ;; esac; } \
  && ok "git diff en panne → $st (rc=3)" \
  || ko "attendu INDETERMINE diff-echoue rc=3, obtenu '$st' rc=$rc"
[ "$st" != "MERGED" ] && ok "git diff en panne ne vaut pas MERGED" \
  || ko "git diff en panne lu comme MERGED — l'erreur est avalée"

rm -f "${FAUX}/git"

echo "== I — le dépôt à jour rend A-JOUR (et le dit quand même) =="
git_local fetch -q --tags origin
ecart="$(md_ecart_tags)"
case "$ecart" in
  "A-JOUR v1.100.0 v1.100.0") ok "écart annoncé même quand il est nul : $ecart" ;;
  *) ko "attendu 'A-JOUR v1.100.0 v1.100.0', obtenu '$ecart'" ;;
esac

echo "== L — la sortie DIT sur quel objet chaque mesure porte =="
# Deuxième G/W/T du ticket : « quand il prescrit une commande de mesure, il dit
# sur quel objet elle porte — local ou distant ». Une sortie qui ne rend que le
# numéro laisse l'agent qui la suit sans moyen de voir l'écart.
out="$(md_prochaine_version patch)"
for mot in PROCHAINE DISTANT LOCAL ECART; do
  case "$out" in
    *"$mot"*) ok "la sortie nomme ${mot}" ;;
    *) ko "la sortie ne nomme pas ${mot} : '$out'" ;;
  esac
done

echo "== M — les tags qui ne sont pas des versions sont écartés =="
git -C "$AUTRE" -c user.email=t@t.io -c user.name=t tag latest 2>/dev/null
git -C "$AUTRE" -c user.email=t@t.io -c user.name=t tag release-2026 2>/dev/null
# Une pré-version : celle-ci PASSERAIT devant si le filtre ne l'écartait pas,
# et /merge proposerait v9.9.10 en croyant publier un patch.
git -C "$AUTRE" -c user.email=t@t.io -c user.name=t tag v9.9.9-rc1 2>/dev/null
git -C "$AUTRE" push -q origin latest release-2026 v9.9.9-rc1
dis="$(md_dernier_tag_distant)"
[ "$dis" = "v1.100.0" ] && ok "\`latest\`, \`release-2026\` et \`v9.9.9-rc1\` écartés, v1.100.0 tient" \
  || ko "attendu v1.100.0, obtenu '$dis' — un tag non-versionné a été retenu"
out="$(md_prochaine_version patch)"
[ "$(printf '%s' "$out" | awk '{print $2}')" = "v1.100.1" ] \
  && ok "la prochaine version reste calculable" \
  || ko "attendu v1.100.1, obtenu '$out'"

# Un tag ANNOTÉ fait rendre DEUX lignes à `git ls-remote` : la ref et sa
# déréférence `^{}`. Sans le nettoyage et le dédoublonnage, le même tag
# apparaît deux fois dans la liste.
git -C "$AUTRE" -c user.email=t@t.io -c user.name=t tag -a v1.50.0 -m annote
git -C "$AUTRE" push -q origin v1.50.0
liste="$(md_tags_distants)"
n_total="$(printf '%s\n' "$liste" | grep -c .)"
n_uniq="$(printf '%s\n' "$liste" | sort -u | grep -c .)"
[ "$n_total" = "$n_uniq" ] && ok "liste distante sans doublon (${n_total} tags)" \
  || ko "doublons dans la liste distante : ${n_total} lignes pour ${n_uniq} tags — déréférence \`^{}\` non nettoyée ?"
printf '%s\n' "$liste" | grep -qx 'v1.50.0' && ok "le tag annoté v1.50.0 est bien vu" \
  || ko "le tag annoté v1.50.0 est absent de la liste distante"

echo "== N — les bumps remettent à zéro ce qu'ils doivent =="
git -C "$AUTRE" -c user.email=t@t.io -c user.name=t tag v2.3.4
git -C "$AUTRE" push -q origin v2.3.4
[ "$(md_prochaine_version patch | awk '{print $2}')" = "v2.3.5" ] && ok "patch : v2.3.4 → v2.3.5" \
  || ko "patch attendu v2.3.5, obtenu '$(md_prochaine_version patch)'"
[ "$(md_prochaine_version minor | awk '{print $2}')" = "v2.4.0" ] && ok "minor : v2.3.4 → v2.4.0 (patch remis à 0)" \
  || ko "minor attendu v2.4.0, obtenu '$(md_prochaine_version minor)'"
[ "$(md_prochaine_version major | awk '{print $2}')" = "v3.0.0" ] && ok "major : v2.3.4 → v3.0.0 (minor et patch remis à 0)" \
  || ko "major attendu v3.0.0, obtenu '$(md_prochaine_version major)'"

echo "== O — un distant SANS tag : v0.0.1, et l'écart le dit =="
VIERGE="${WORK}/vierge.git"
git init -q --bare "$VIERGE"
git_local remote add vierge "$VIERGE"
out="$(md_prochaine_version patch vierge)"; rc=$?
{ [ "$rc" -eq 0 ] && [ "$(printf '%s' "$out" | awk '{print $2}')" = "v0.0.1" ]; } \
  && ok "aucun tag distant → v0.0.1" \
  || ko "attendu v0.0.1, obtenu '$out' rc=$rc"

echo "== P — l'écart nomme aussi le LOCAL EN AVANCE et l'absence totale =="
# Un tag posé en local et jamais poussé : c'est le cas où deux lots parallèles
# croient chacun détenir le numéro. L'écart doit le NOMMER, pas dire A-JOUR.
git_local tag v9.9.9
ecart="$(md_ecart_tags)"
case "$ecart" in
  "LOCAL-EN-AVANCE v9.9.9 v2.3.4") ok "tag local jamais poussé → $ecart" ;;
  *) ko "attendu 'LOCAL-EN-AVANCE v9.9.9 v2.3.4', obtenu '$ecart'" ;;
esac
ecart="$(md_ecart_tags vierge)"
case "$ecart" in
  "LOCAL-EN-AVANCE v9.9.9 -") ok "distant sans tag → $ecart" ;;
  *) ko "attendu 'LOCAL-EN-AVANCE v9.9.9 -', obtenu '$ecart'" ;;
esac
git_local tag -d v9.9.9 >/dev/null
# Ni local ni distant : AUCUN-TAG, et surtout pas A-JOUR.
VIDE="${WORK}/vide"
git init -q "$VIDE"
git -C "$VIDE" remote add origin "$VIERGE"
ecart="$(cd "$VIDE" && md_ecart_tags)"
[ "$ecart" = "AUCUN-TAG - -" ] && ok "aucun tag nulle part → $ecart" \
  || ko "attendu 'AUCUN-TAG - -', obtenu '$ecart'"

echo "== Q — md_rafraichir_origine rapatrie bien les TAGS =="
NEUF="${WORK}/neuf"
git clone -q --no-tags "$ORIGIN" "$NEUF"
avant="$(cd "$NEUF" && md_dernier_tag_local)"
# C'est LE scénario du ticket : un dépôt frais, aucun tag en local, le distant
# en porte. L'écart doit le DIRE — pas annoncer « à jour ».
ecart="$(cd "$NEUF" && md_ecart_tags)"
[ "$ecart" = "LOCAL-EN-RETARD - v2.3.4" ] && ok "clone sans tag → $ecart" \
  || ko "attendu 'LOCAL-EN-RETARD - v2.3.4', obtenu '$ecart'"
(cd "$NEUF" && md_rafraichir_origine) && ok "fetch réussi (rc=0)" || ko "md_rafraichir_origine a échoué sur un distant joignable"
apres="$(cd "$NEUF" && md_dernier_tag_local)"
[ -z "$avant" ] && ok "clone --no-tags : aucun tag avant" || ko "SCÉNARIO INOPÉRANT : le clone portait déjà '$avant'"
[ "$apres" = "v2.3.4" ] && ok "après rafraîchissement : v2.3.4 en local" \
  || ko "attendu v2.3.4 après fetch, obtenu '$apres' — les tags ne sont pas rapatriés"

echo "== J — bump inconnu refusé =="
out="$(md_prochaine_version farfelu)"; rc=$?
{ [ "$rc" -eq 4 ] && case "$out" in REFUS\ bump-inconnu*) true ;; *) false ;; esac; } \
  && ok "bump inconnu → $out (rc=4)" \
  || ko "attendu REFUS bump-inconnu rc=4, obtenu '$out' rc=$rc"

echo "== R — le skill et la lib s'accordent =="
# Le fait « la mesure qui décide porte sur le distant » vit à DEUX endroits :
# la lib, et le texte du skill que les agents appliquent. Deux gardes bornées
# chacune à son côté ne gardent pas leur ACCORD — c'est lui qu'on mesure ici.
SKILL="${MERGE_SKILL_SRC:-${ROOT}/.claude/skills/merge/SKILL.md}"
LIB_REELLE="${ROOT}/.claude/skills/merge/lib/mesure-distante.sh"
[ -f "$SKILL" ] && ok "le skill /merge est là" || ko "SKILL.md introuvable : $SKILL"

# Toute fonction md_* citée par le skill doit exister dans la lib.
manquantes=""
for fn in $(grep -oE 'md_[a-z_]+' "$SKILL" | sort -u); do
  grep -qE "^${fn}\(\) \{" "$LIB_REELLE" || manquantes="${manquantes} ${fn}"
done
[ -z "$manquantes" ] && ok "toutes les fonctions citées par le skill existent dans la lib" \
  || ko "le skill appelle des fonctions absentes de la lib :${manquantes}"

# Le skill ne doit plus prescrire la mesure LOCALE comme source du numéro.
if grep -qE '^\s*git tag --sort=-v:refname \| head -1\s*$' "$SKILL"; then
  ko "le skill prescrit encore \`git tag --sort=-v:refname | head -1\` comme dernier tag"
else
  ok "le skill ne prescrit plus la lecture des tags LOCAUX pour le numéro"
fi

# Le chemin qui SUPPRIME ne compare plus à \`main\` local.
if grep -qE 'git merge-base main ' "$SKILL"; then
  ko "l'étape 7.5 compare encore à \`main\` LOCAL"
else
  ok "l'étape 7.5 ne compare plus à \`main\` local"
fi

echo "----------------------------------------"
echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"
# Un compte d'assertions qui BAISSE sans qu'un cas ait été retiré est une
# interruption, pas un succès (vague 2B). Le plancher est explicite.
PLANCHER=52
if [ "$((PASS + FAIL))" -lt "$PLANCHER" ]; then
  echo "❌ SUITE INTERROMPUE : $((PASS + FAIL)) assertions jouées, plancher ${PLANCHER}"
  exit 1
fi
[ "$FAIL" = "0" ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
