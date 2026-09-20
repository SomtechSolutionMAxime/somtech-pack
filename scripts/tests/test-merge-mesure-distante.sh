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

# Un montage de banc qui avale ses erreurs a exactement le défaut que ce banc
# garde : une commande en échec passerait pour un succès, et les assertions
# suivantes accuseraient la lib. `must` fait échouer le banc là où ça se casse.
must() {
  local out rc
  out="$("$@" 2>&1)"; rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "❌ MONTAGE DU BANC EN ÉCHEC (rc=${rc}) : $*"
    echo "   $out"
    echo "Assertions JOUÉES : 0 — le banc n'a pas pu être monté"
    exit 1
  fi
}

# Un dépôt jetable, sans configuration de poste ni signature.
git_local() { git -C "$CLONE" -c user.email=t@t.io -c user.name=t -c commit.gpgsign=false "$@"; }
git_autre() { git -C "$AUTRE" -c user.email=t@t.io -c user.name=t -c commit.gpgsign=false "$@"; }

ORIGIN="${WORK}/origin.git"
CLONE="${WORK}/clone"
AUTRE="${WORK}/autre"

must git init -q --bare "$ORIGIN"
must git init -q "$CLONE"
must git_local remote add origin "$ORIGIN"
echo un > "${CLONE}/f.txt"
must git_local add -A
must git_local commit -qm "socle"
must git_local branch -M main
must git_local push -q -u origin main
# Le HEAD du dépôt nu suit `init.defaultBranch`, qui vaut `master` quand rien
# ne le configure — le poste de l'auteur le met à `main`, le runner CI non.
# Sans ce recalage, le clone ci-dessous atterrit sur une branche non née et
# `git tag` échoue sur « Failed to resolve HEAD ». Mesuré : vert en local,
# rouge en CI.
must git -C "$ORIGIN" symbolic-ref HEAD refs/heads/main
must git_local tag v1.1.0
must git_local push -q origin v1.1.0

# Un SECOND dépôt pousse des tags plus récents : le clone ne les connaît pas.
must git clone -q -b main "$ORIGIN" "$AUTRE"
must git_autre tag v1.2.0
must git_autre tag v1.9.0
must git_autre push -q origin v1.2.0 v1.9.0

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

# ⚠️ Nommer n'est pas dire. Une sortie qui porte les quatre étiquettes peut les
# porter dans le DÉSORDRE — DISTANT annonçant la valeur LOCALE et l'inverse —
# et le récapitulatif du skill (« DISTANT fait foi, LOCAL montre l'écart »)
# serait inversé sans qu'aucune assertion ne bouge. C'est ici, et nulle part
# ailleurs, que la ligne discrimine : le local et le distant DIFFÈRENT.
attendu="PROCHAINE v1.9.1 DISTANT v1.9.0 LOCAL v1.1.0 ECART LOCAL-EN-RETARD"
[ "$out" = "$attendu" ] && ok "chaque étiquette porte SA valeur : $out" \
  || ko "ligne attendue « ${attendu} », obtenue « ${out} » — étiquettes et valeurs désaccordées ?"

echo "== D — le tri est numérique, pas lexicographique =="
must git_autre tag v1.100.0
must git_autre push -q origin v1.100.0
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
must git_autre tag latest
must git_autre tag release-2026
# Une pré-version : celle-ci PASSERAIT devant si le filtre ne l'écartait pas,
# et /merge proposerait v9.9.10 en croyant publier un patch.
must git_autre tag v9.9.9-rc1
must git_autre push -q origin latest release-2026 v9.9.9-rc1
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
must git_autre tag -a v1.50.0 -m annote
must git_autre push -q origin v1.50.0
liste="$(md_tags_distants)"
n_total="$(printf '%s\n' "$liste" | grep -c .)"
n_uniq="$(printf '%s\n' "$liste" | sort -u | grep -c .)"
[ "$n_total" = "$n_uniq" ] && ok "liste distante sans doublon (${n_total} tags)" \
  || ko "doublons dans la liste distante : ${n_total} lignes pour ${n_uniq} tags — déréférence \`^{}\` non nettoyée ?"
printf '%s\n' "$liste" | grep -qx 'v1.50.0' && ok "le tag annoté v1.50.0 est bien vu" \
  || ko "le tag annoté v1.50.0 est absent de la liste distante"

echo "== N — les bumps remettent à zéro ce qu'ils doivent =="
must git_autre tag v2.3.4
must git_autre push -q origin v2.3.4
[ "$(md_prochaine_version patch | awk '{print $2}')" = "v2.3.5" ] && ok "patch : v2.3.4 → v2.3.5" \
  || ko "patch attendu v2.3.5, obtenu '$(md_prochaine_version patch)'"
[ "$(md_prochaine_version minor | awk '{print $2}')" = "v2.4.0" ] && ok "minor : v2.3.4 → v2.4.0 (patch remis à 0)" \
  || ko "minor attendu v2.4.0, obtenu '$(md_prochaine_version minor)'"
[ "$(md_prochaine_version major | awk '{print $2}')" = "v3.0.0" ] && ok "major : v2.3.4 → v3.0.0 (minor et patch remis à 0)" \
  || ko "major attendu v3.0.0, obtenu '$(md_prochaine_version major)'"

echo "== O — un distant SANS tag : v0.0.1, et l'écart le dit =="
VIERGE="${WORK}/vierge.git"
must git init -q --bare "$VIERGE"
must git_local remote add vierge "$VIERGE"
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
# Un tag posé sur un commit HORS de `main` : un `git fetch` nu ne le rapatrie
# pas (il ne suit que les tags atteignables depuis ce qu'il fetche), `--tags`
# si. C'est ce qui rend cette assertion discriminante au lieu de verte par
# accident.
NEUF="${WORK}/neuf"
must git clone -q -b main "$ORIGIN" "$NEUF"
# `--no-tags` ne se comporte pas pareil selon la version de git : on retire les
# tags nous-mêmes, pour que « le clone n'a aucun tag » soit un FAIT du banc et
# non une propriété de la machine.
for t in $(git -C "$NEUF" tag -l); do must git -C "$NEUF" tag -d "$t"; done
avant="$(cd "$NEUF" && md_dernier_tag_local)"
# C'est LE scénario du ticket : un dépôt frais, aucun tag en local, le distant
# en porte. L'écart doit le DIRE — pas annoncer « à jour ».
ecart="$(cd "$NEUF" && md_ecart_tags)"
[ "$ecart" = "LOCAL-EN-RETARD - v2.3.4" ] && ok "clone sans tag → $ecart" \
  || ko "attendu 'LOCAL-EN-RETARD - v2.3.4', obtenu '$ecart'"

# Un tag posé APRÈS ce clone, sur un commit HORS de `main` : un `git fetch` nu
# ne le rapatrie pas — il ne suit que les tags atteignables depuis ce qu'il
# télécharge, et rien ne l'amène ici. `--tags` si. C'est ce qui rend
# l'assertion suivante discriminante au lieu de verte par accident.
must git_autre checkout -q -b cote
echo hors > "${AUTRE}/h.txt"
must git_autre add -A
must git_autre commit -qm "commit hors main"
must git_autre tag v5.0.0
must git_autre push -q origin v5.0.0
must git_autre checkout -q main
(cd "$NEUF" && md_rafraichir_origine) && ok "fetch réussi (rc=0)" || ko "md_rafraichir_origine a échoué sur un distant joignable"
apres="$(cd "$NEUF" && md_dernier_tag_local)"
[ -z "$avant" ] && ok "clone sans tag : aucun tag avant" || ko "SCÉNARIO INOPÉRANT : le clone portait déjà '$avant'"
[ "$apres" = "v5.0.0" ] && ok "après rafraîchissement : v5.0.0 en local (tag HORS main)" \
  || ko "attendu v5.0.0 après fetch, obtenu '$apres' — un tag hors \`main\` n'est pas rapatrié"

echo "== J — bump inconnu refusé =="
out="$(md_prochaine_version farfelu)"; rc=$?
{ [ "$rc" -eq 4 ] && case "$out" in REFUS\ bump-inconnu*) true ;; *) false ;; esac; } \
  && ok "bump inconnu → $out (rc=4)" \
  || ko "attendu REFUS bump-inconnu rc=4, obtenu '$out' rc=$rc"

echo "== U — le comparateur de versions ne déborde pas sur le champ voisin =="
# Une clé pondérée (`maj*1000000 + min*1000 + pat`) rend le BON résultat sur
# tous les tags usuels et un résultat FAUX dès qu'un composant atteint sa base.
# Aucun scénario de ce banc n'approchait cette borne — le défaut y dormait.
comparer() { printf '%s\n%s\n' "$1" "$2" | md_max_semver; }
verifier_max() {  # verifier_max <a> <b> <attendu>
  local got; got="$(comparer "$1" "$2")"
  [ "$got" = "$3" ] && ok "max($1, $2) = $3" \
    || ko "max($1, $2) attendu $3, obtenu '$got' — la comparaison déborde sur le champ voisin ?"
}
verifier_max v1.0.1000 v1.1.0   v1.1.0
verifier_max v1.1000.0 v2.0.0   v2.0.0
verifier_max v0.999.999 v1.0.0  v1.0.0
verifier_max v1.9.0    v1.100.0 v1.100.0
verifier_max v2.3.4    v2.3.5   v2.3.5
verifier_max v10.0.0   v9.99.99 v10.0.0

echo "== V — un numéro déjà pris est REFUSÉ, en le nommant =="
# T-20260815-0013 : le 2026-08-15, deux lots parallèles ont préparé `v1.53.0`.
# Calculer sur le distant ne suffit pas — entre le calcul et la pose du tag, un
# autre lot peut prendre le numéro. Ce qui manquait est un REFUS au moment de
# poser. On rejoue ici le scénario du ticket : deux préparations visant le même
# numéro, la seconde doit refuser en NOMMANT le tag qui existe déjà.
git_local fetch -q --tags origin

pris="$(md_dernier_tag_distant)"
sha_attendu="$(git ls-remote --tags origin "refs/tags/${pris}" | awk '{print $1; exit}')"
sortie="$(md_version_libre "$pris")"; rc=$?
lu_verbe="$(printf '%s' "$sortie" | awk '{print $1}')"
lu_version="$(printf '%s' "$sortie" | awk '{print $2}')"
lu_sha="$(printf '%s' "$sortie" | awk '{print $3}')"
[ "$rc" -eq 1 ] && ok "numéro pris → rc=1" || ko "rc attendu 1 pour un numéro pris, obtenu $rc"
[ "$lu_verbe" = "PRIS" ] && ok "le refus se nomme PRIS" || ko "attendu PRIS, obtenu '$sortie'"
[ "$lu_version" = "$pris" ] && ok "le refus NOMME le tag en cause : ${lu_version}" \
  || ko "le refus ne nomme pas le tag : '$sortie'"
{ [ -n "$sha_attendu" ] && [ "$lu_sha" = "$sha_attendu" ]; } \
  && ok "et il donne le sha réel du tag existant" \
  || ko "sha attendu '${sha_attendu}', obtenu '${lu_sha}'"

echo "== V-bis — le cas nominal passe sans bruit =="
sortie="$(md_version_libre v98.76.54)"; rc=$?
{ [ "$rc" -eq 0 ] && [ "$sortie" = "LIBRE v98.76.54" ]; } \
  && ok "numéro libre → $sortie (rc=0)" \
  || ko "attendu 'LIBRE v98.76.54' rc=0, obtenu '$sortie' rc=$rc"

echo "== V-ter — LIBRE ne se confond pas avec un PRÉFIXE =="
# `v7.7.70` existe ; demander `v7.7.7` doit rendre LIBRE. Une recherche par
# préfixe ou par sous-chaîne dirait PRIS, et ferait sauter un numéro valide.
must git_autre tag v7.7.70
must git_autre push -q origin v7.7.70
sortie="$(md_version_libre v7.7.7)"; rc=$?
{ [ "$rc" -eq 0 ] && [ "$sortie" = "LIBRE v7.7.7" ]; } \
  && ok "v7.7.70 existe, v7.7.7 reste LIBRE — pas de correspondance par préfixe" \
  || ko "attendu 'LIBRE v7.7.7' rc=0, obtenu '$sortie' rc=$rc — correspondance par préfixe ?"
sortie="$(md_version_libre v7.7.70)"
[ "$(printf '%s' "$sortie" | awk '{print $1}')" = "PRIS" ] \
  && ok "et v7.7.70 est bien vu comme pris" || ko "attendu PRIS pour v7.7.70, obtenu '$sortie'"

echo "== V-quater — un tag ANNOTÉ pris est vu comme pris =="
must git_autre tag -a v6.5.4 -m annote
must git_autre push -q origin v6.5.4
sortie="$(md_version_libre v6.5.4)"; rc=$?
{ [ "$rc" -eq 1 ] && [ "$(printf '%s' "$sortie" | awk '{print $1, $2}')" = "PRIS v6.5.4" ]; } \
  && ok "tag annoté → $sortie" \
  || ko "attendu 'PRIS v6.5.4 <sha>' rc=1, obtenu '$sortie' rc=$rc"

# ⚠️ Ce que ce cas établit, et qui n'était pas évident : avec un refspec EXACT,
# `ls-remote` ne rend PAS la déréférence `^{}` de l'objet-tag. C'est mesuré ici
# plutôt que supposé — c'est ce qui autorise la lib à prendre la première ligne
# sans second filtre.
lignes="$(git ls-remote --tags origin 'refs/tags/v6.5.4' | grep -c .)"
[ "$lignes" = "1" ] && ok "un refspec exact rend UNE ligne, même pour un tag annoté" \
  || ko "attendu 1 ligne pour 'refs/tags/v6.5.4', obtenu ${lignes} — la déréférence remonte"
lu="$(printf '%s' "$sortie" | awk '{print $3}')"
attendu_sha="$(git ls-remote --tags origin 'refs/tags/v6.5.4' | awk '{print $1; exit}')"
[ "$lu" = "$attendu_sha" ] && ok "et le sha rendu est celui que le serveur donne" \
  || ko "sha attendu ${attendu_sha}, obtenu ${lu}"

echo "== W — serveur injoignable : REFUS, JAMAIS « libre » =="
# ⚠️ Le discriminant de tout ce scénario. « Libre » et « je n'ai pas pu
# regarder » se ressemblent — et c'est la ressemblance qui republie un numéro.
git_local remote set-url origin "${WORK}/nexiste-pas.git"
sortie="$(md_version_libre v1.2.3 2>/dev/null)"; rc=$?
[ "$rc" -eq 2 ] && ok "serveur injoignable → rc=2" || ko "rc attendu 2, obtenu $rc"
[ "$sortie" = "REFUS serveur-injoignable" ] && ok "sortie : $sortie" \
  || ko "attendu 'REFUS serveur-injoignable', obtenu '$sortie'"
case "$sortie" in
  *LIBRE*) ko "un serveur injoignable est annoncé LIBRE — c'est le défaut de T-20260815-0013" ;;
  *) ok "aucune trace de « LIBRE » quand on n'a pas pu regarder" ;;
esac
sortie="$(md_prochaine_version patch 2>/dev/null)"; rc=$?
{ [ "$rc" -eq 2 ] && case "$sortie" in REFUS*injoignable*) true ;; *) false ;; esac; } \
  && ok "le calcul de version refuse aussi, et nomme l'injoignabilité (rc=2)" \
  || ko "attendu un REFUS nommant l'injoignabilité rc=2, obtenu '$sortie' rc=$rc"
git_local remote set-url origin "$ORIGIN"

echo "== W-bis — une version malformée est refusée, pas devinée =="
# ⚠️ `case "$v" in v[0-9]*.[0-9]*.[0-9]*)` n'est PAS une expression régulière :
# en shell, `[0-9]*` veut dire « un chiffre puis n'importe quoi ». La liste
# ci-dessous contient donc les formes qui passaient sous ce glob — dont la plus
# coûteuse, `v1.9*.0`, dont l'étoile est un motif que `ls-remote` interprète :
# le refus nommait un tag INEXISTANT avec le sha d'un autre.
for mauvaise in "" "1.2.3" "v1.2" "vX.Y.Z" "latest" "v1.2.3.4" "v1.2.3abc" "v1a.2.3" "v01.02.03" "refs/tags/v1.2.3" "v1.2.3-rc1"; do
  sortie="$(md_version_libre "$mauvaise")"; rc=$?
  { [ "$rc" -eq 3 ] && case "$sortie" in REFUS*) true ;; *) false ;; esac; } \
    && ok "« ${mauvaise:-<vide>} » → $sortie (rc=3)" \
    || ko "attendu un REFUS rc=3 pour « ${mauvaise:-<vide>} », obtenu '$sortie' rc=$rc"
done

# Le cas qui coûte le plus : un GLOB. Il ne doit jamais rendre PRIS — un refus
# qui nomme un tag inexistant est pire qu'une absence de refus.
must git_autre tag v3.95.0
must git_autre tag v3.99.0
must git_autre push -q origin v3.95.0 v3.99.0
sortie="$(md_version_libre 'v3.9*.0')"; rc=$?
[ "$rc" -eq 3 ] && ok "un numéro contenant un glob → rc=3" \
  || ko "rc attendu 3 pour 'v3.9*.0', obtenu $rc"
case "$sortie" in
  PRIS*) ko "le glob rend « $sortie » — le refus NOMME un tag qui n'existe pas, avec le sha d'un autre" ;;
  *) ok "le glob ne rend pas PRIS : $sortie" ;;
esac
# Et les deux vrais tags, eux, sont bien vus comme pris chacun pour soi.
[ "$(md_version_libre v3.95.0 | awk '{print $1, $2}')" = "PRIS v3.95.0" ] \
  && ok "v3.95.0 est vu comme pris" || ko "v3.95.0 devrait être pris"
[ "$(md_version_libre v3.96.0)" = "LIBRE v3.96.0" ] \
  && ok "et v3.96.0, voisin des deux, reste libre" || ko "v3.96.0 devrait être libre"

echo "== W-ter — une sortie inattendue du serveur ne devient pas un sha =="
# Deux pannes fabriquées par un relais placé devant le vrai `git` : l'une écrit
# sur stderr en réussissant, l'autre rend une ligne qui n'est pas une ref. Ni
# l'une ni l'autre ne doit être lue comme un sha — c'est ce que la fusion
# `2>&1` et « prendre la première ligne » produisaient.
GIT_REEL2="$(command -v git)"
FAUX2="${WORK}/faux-git-2"; mkdir -p "$FAUX2"

cat > "${FAUX2}/git" <<RELAIS
#!/usr/bin/env bash
if [ "\${1:-}" = "ls-remote" ]; then
  echo "Warning: Permanently added the host to the list of known hosts." >&2
  exec "${GIT_REEL2}" "\$@"
fi
exec "${GIT_REEL2}" "\$@"
RELAIS
chmod +x "${FAUX2}/git"
sortie="$(PATH="${FAUX2}:$PATH" md_version_libre v88.88.88 2>/dev/null)"; rc=$?
{ [ "$rc" -eq 0 ] && [ "$sortie" = "LIBRE v88.88.88" ]; } \
  && ok "un avertissement sur stderr ne pollue pas la réponse : $sortie" \
  || ko "attendu 'LIBRE v88.88.88' rc=0, obtenu '$sortie' rc=$rc — stderr fusionné dans la sortie ?"

cat > "${FAUX2}/git" <<RELAIS
#!/usr/bin/env bash
if [ "\${1:-}" = "ls-remote" ]; then
  echo "bruit-inattendu du serveur"
  exit 0
fi
exec "${GIT_REEL2}" "\$@"
RELAIS
chmod +x "${FAUX2}/git"
sortie="$(PATH="${FAUX2}:$PATH" md_version_libre v88.88.88 2>/dev/null)"; rc=$?
{ [ "$rc" -eq 0 ] && [ "$sortie" = "LIBRE v88.88.88" ]; } \
  && ok "une ligne qui n'est pas une ref est ignorée : $sortie" \
  || ko "attendu 'LIBRE v88.88.88' rc=0, obtenu '$sortie' rc=$rc — une ligne quelconque lue comme un sha ?"
case "$sortie" in
  *bruit-inattendu*) ko "le bruit du serveur ressort dans la réponse" ;;
  *) ok "et le bruit ne ressort nulle part dans la réponse" ;;
esac
rm -f "${FAUX2}/git"

echo "== X — la COURSE : le numéro calculé est pris entre-temps =="
# Le scénario exact de T-20260815-0013, joué dans l'ordre où il s'est produit :
#   ① un lot calcule son numéro sur le serveur — il est libre à cet instant ;
#   ② un AUTRE lot pose ce numéro ;
#   ③ le premier s'apprête à taguer.
# Sans refus, il tague un numéro pris. Avec, il refuse en le NOMMANT — et c'est
# exactement le geste qu'un humain a fait à la main le 2026-08-15.
propose="$(md_prochaine_version patch | awk '{print $2}')"
sortie="$(md_version_libre "$propose")"; rc=$?
{ [ "$rc" -eq 0 ] && [ "$sortie" = "LIBRE ${propose}" ]; } \
  && ok "① ${propose} est libre au moment du calcul" \
  || ko "SCÉNARIO INOPÉRANT : ${propose} n'est pas libre au départ ('$sortie')"

must git_autre tag "$propose"
must git_autre push -q origin "$propose"
ok "② un autre lot vient de poser ${propose}"

sortie="$(md_version_libre "$propose")"; rc=$?
[ "$rc" -eq 1 ] && ok "③ le même appel rend maintenant rc=1" \
  || ko "rc attendu 1 après que l'autre lot a pris le numéro, obtenu $rc"
case "$sortie" in
  "PRIS ${propose} "*) ok "③ et il REFUSE en nommant le tag : $sortie" ;;
  *) ko "attendu 'PRIS ${propose} <sha>', obtenu '$sortie'" ;;
esac
case "$sortie" in
  *LIBRE*) ko "le numéro pris est encore annoncé libre — le défaut est intact" ;;
  *) ok "aucune trace de « LIBRE » sur un numéro pris" ;;
esac

# Et le recalcul enjambe le numéro perdu, sans verrou ni boucle.
suivant="$(md_prochaine_version patch | awk '{print $2}')"
[ "$suivant" != "$propose" ] && ok "le recalcul propose ${suivant}, pas ${propose}" \
  || ko "le recalcul repropose ${propose} — le perdant rejouerait la collision"
{ [ "$(md_version_libre "$suivant")" = "LIBRE ${suivant}" ]; } \
  && ok "et ${suivant} est libre" || ko "${suivant} n'est pas libre"

echo "== R — le skill et la lib s'accordent =="
# Le fait « la mesure qui décide porte sur le distant » vit à DEUX endroits :
# la lib, et le texte du skill que les agents appliquent. Deux gardes bornées
# chacune à son côté ne gardent pas leur ACCORD — c'est lui qu'on mesure ici.
SKILL="${MERGE_SKILL_SRC:-${ROOT}/.claude/skills/merge/SKILL.md}"
LIB_REELLE="${ROOT}/.claude/skills/merge/lib/mesure-distante.sh"
[ -f "$SKILL" ] && ok "le skill /merge est là" || ko "SKILL.md introuvable : $SKILL"

# Toute fonction md_* citée par le skill doit exister dans la lib.
# ⚠️ Cette assertion seule est VACUE : un skill qui ne cite plus AUCUNE
# fonction la satisfait (ensemble vide). Elle est donc précédée d'une
# assertion POSITIVE : le skill doit appeler nommément chacune des trois
# fonctions qui décident. « Présence n'est pas absence du contraire. »
# ⚠️ Et « nommée » ne suffit pas : un nom en COMMENTAIRE, ou en prose hors
# d'un bloc de code, satisfait un grep et n'exécute rien. On ne cherche donc
# que dans les blocs ```bash du skill, commentaires retirés.
corps_executable() {
  awk '
    /^[ \t]*```bash[ \t]*$/ { dedans = 1; next }
    /^[ \t]*```/            { dedans = 0; next }
    dedans                   { sub(/#.*/, ""); print }
  ' "$1"
}
EXEC="${WORK}/skill-executable.sh"
corps_executable "$SKILL" > "$EXEC"
[ -s "$EXEC" ] && ok "le skill porte des blocs bash exécutables ($(grep -c . "$EXEC") lignes)" \
  || ko "aucun bloc bash exécutable dans le skill — l'accord ne porte plus sur rien"

for fn in md_prochaine_version md_statut_branche md_rafraichir_origine md_version_libre; do
  if grep -qE "(^|[^a-z_])${fn}([^a-z_]|$)" "$EXEC"; then
    ok "le skill APPELLE ${fn} (hors commentaire, dans un bloc bash)"
  else
    ko "le skill n'appelle plus ${fn} dans un bloc exécutable — nommé en commentaire ou en prose ne compte pas"
  fi
done

manquantes=""
citees=0
for fn in $(grep -oE 'md_[a-z_]+' "$SKILL" | sort -u); do
  citees=$((citees + 1))
  grep -qE "^${fn}\(\) \{" "$LIB_REELLE" || manquantes="${manquantes} ${fn}"
done
[ "$citees" -ge 4 ] && ok "le skill cite ${citees} fonctions de la lib" \
  || ko "le skill ne cite que ${citees} fonction(s) — l'accord skill/lib ne porte plus sur rien"
[ -z "$manquantes" ] && ok "toutes les fonctions citées par le skill existent dans la lib" \
  || ko "le skill appelle des fonctions absentes de la lib :${manquantes}"

# Le skill ne doit plus prescrire la mesure LOCALE comme source du numéro.
if grep -qE '^\s*git tag --sort=-v:refname \| head -1\s*$' "$SKILL"; then
  ko "le skill prescrit encore \`git tag --sort=-v:refname | head -1\` comme dernier tag"
else
  ok "le skill ne prescrit plus la lecture des tags LOCAUX pour le numéro"
fi

# Le même fait vit AUSSI dans le CLAUDE.md du dépôt, que toute session lit.
# Une garde bornée au skill le laisserait prescrire l'ancien geste.
CLAUDE_MD="${MERGE_CLAUDE_MD_SRC:-${ROOT}/CLAUDE.md}"
if grep -qE 'git tag --sort=-v:refname \| head -1' "$CLAUDE_MD"; then
  ko "CLAUDE.md prescrit encore la lecture des tags LOCAUX comme source de la version"
else
  ok "CLAUDE.md ne prescrit plus la lecture des tags LOCAUX"
fi
if grep -q 'ls-remote' "$CLAUDE_MD"; then
  ok "CLAUDE.md nomme la mesure distante"
else
  ko "CLAUDE.md ne dit pas où se lit le tag qui fait foi"
fi

# Ce que le skill prescrit de FAIRE du statut est le cœur du correctif : la lib
# peut rendre INDETERMINE à la perfection, si le texte autorise à supprimer
# quand même, le défaut est intact. Ces assertions portent sur la prescription.
if grep -q 'INDETERMINE' "$SKILL"; then
  ok "le skill nomme le statut INDETERMINE"
else
  ko "le skill ne nomme pas INDETERMINE — le texte ignore le statut que la lib rend"
fi
if grep -qE 'INDETERMINE.{0,200}(ne se supprime jamais|n.autorise aucune suppression)' "$SKILL" \
   || grep -qE '(ne se supprime jamais|n.autorise aucune suppression)' "$SKILL"; then
  ok "le skill interdit explicitement de supprimer une branche INDETERMINE"
else
  ko "le skill ne dit nulle part qu'une mesure impossible n'autorise aucune suppression"
fi

# Le geste destructif ne doit porter QUE sur les branches mergées. La
# reformulation « pour chaque branche listée » rouvre le défaut d'origine.
#
# ⚠️ La première occurrence de `git branch -D` est dans un AVERTISSEMENT en
# prose ; celle qui compte est la ligne INDENTÉE d'un bloc bash, celle qui
# s'exécute. Et on ne cherche PAS la mention `merged` dans un VOISINAGE de N
# lignes : un voisinage se satisfait d'une phrase-leurre placée n'importe où, et
# rougit à tort dès qu'on insère une explication légitime entre la puce et le
# bloc. On remonte à la PUCE qui gouverne ce bloc — la dernière puce `- **…**`
# avant lui — et c'est ELLE qui doit borner le geste.
# ⚠️ Deux pièges déjà payés ici, et c'est le MÊME : la recherche ne doit pas
# s'échapper de la section. Une version antérieure retenait « la dernière puce
# `- **` vue, où qu'elle soit » : réécrire la liste en liste NUMÉROTÉE la
# faisait retomber sur une puce sans rapport, plus haut dans le document —
# rouge à tort sur un texte sûr, et verte à tort sur un texte débridé si cette
# puce lointaine disait `merged` par hasard.
#   · on accepte TOUTE forme d'item de liste : `-`, `*`, ou `1.` ;
#   · on OUBLIE l'item courant à chaque titre — la recherche ne traverse pas
#     une frontière de section.
# ⚠️ Ce que cette garde ne couvre PAS, et on le dit plutôt que de le taire.
# Un item-leurre inséré ENTRE l'item réel et le bloc devient l'item le plus
# proche. Mesuré — le trou est réel DANS LES DEUX SENS :
#   · un sous-item anodin ajouté juste avant le bloc fait rougir À TORT ;
#   · un sous-item qui mentionne `merged` pendant que l'item réel est débridé
#     rend la garde VERTE sur un geste réellement non borné.
# Il reste ouvert par arbitrage, pas par oubli : l'exploiter demande DEUX
# conditions simultanées et non naturelles, là où le trou fermé ce tour
# s'ouvrait par une seule reformulation ordinaire. Le fermer demanderait de
# lire la PROFONDEUR d'indentation — un vrai parseur de structure — pour un
# document interne que personne n'a intérêt à contourner. Prochain incrément
# si le motif revient sur un autre document.
puce_gouvernante="$(awk '
  /^[[:space:]]*#/                              { puce = "" }
  /^[[:space:]]*([-*]|[0-9]+\.)[[:space:]]/    { puce = $0 }
  /^[[:space:]]+git branch -D/ {
    print (puce == "" ? "__AUCUNE_PUCE__" : puce); trouve = 1; exit
  }
  END { if (!trouve) print "__AUCUN_GESTE__" }
' "$SKILL")"

if [ "$puce_gouvernante" = "__AUCUN_GESTE__" ]; then
  ko "aucun \`git branch -D\` exécutable dans le skill — l'étape 7.5 a changé de forme, cette garde ne porte plus"
elif [ "$puce_gouvernante" = "__AUCUNE_PUCE__" ] || [ -z "$puce_gouvernante" ]; then
  ko "le geste destructif n'est gouverné par AUCUN item de liste dans sa section — rien ne dit sur quelles branches il porte"
else
  ok "le geste destructif est gouverné par un item de liste de sa section"
  if printf '%s' "$puce_gouvernante" | grep -qE '`merged`'; then
    ok "cette puce le borne aux branches \`merged\`"
  else
    ko "la puce qui gouverne le geste destructif ne le borne pas aux \`merged\` : « $(printf '%s' "$puce_gouvernante" | cut -c1-90) » — unmerged et INDETERMINE deviendraient supprimables"
  fi
fi

# ⚠️ La vérification de disponibilité doit vivre DANS le bloc qui tague, pas
# seulement dans le récapitulatif : entre les deux il y a une attente humaine
# de durée non bornée, et c'est exactement la fenêtre de T-20260815-0013.
bloc_du_tag="$(awk '
  /^[ \t]*```bash[ \t]*$/ { dedans = 1; bloc = ""; next }
  /^[ \t]*```/             { if (dedans && bloc ~ /git tag /) { print bloc; trouve = 1; exit }
                              dedans = 0; next }
  dedans                    { sub(/#.*/, ""); bloc = bloc $0 "\n" }
  END { if (!trouve) print "__AUCUN_BLOC_DE_TAG__" }
' "$SKILL")"

if [ "$bloc_du_tag" = "__AUCUN_BLOC_DE_TAG__" ]; then
  ko "aucun bloc bash du skill ne pose de tag — cette garde ne porte plus"
else
  ok "le skill porte un bloc bash qui pose le tag"
  printf '%s' "$bloc_du_tag" | grep -q 'md_version_libre' \
    && ok "et ce bloc rejoue md_version_libre AVANT de taguer" \
    || ko "le bloc qui pose le tag ne vérifie pas la disponibilité — la fenêtre de T-20260815-0013 reste ouverte"

  # ⚠️ PRÉSENT n'est pas GOUVERNANT. Un appel NU — `md_version_libre "<v>"`
  # suivi de `git tag` sans rien qui arrête l'exécution — satisfait un `grep`
  # et ne protège rien : le code de retour part à la poubelle et le tag se pose
  # quand même. C'est le motif 1 du brief, appliqué à cette garde-ci.
  ligne_gate="$(printf '%s\n' "$bloc_du_tag" \
    | grep -nE 'md_version_libre[^#]*(\|\||&&|; *then)|^[[:space:]]*if[[:space:]].*md_version_libre' \
    | head -1 | cut -d: -f1)"
  ligne_tag="$(printf '%s\n' "$bloc_du_tag" | grep -nE '^[[:space:]]*git tag ' | head -1 | cut -d: -f1)"

  if [ -z "$ligne_tag" ]; then
    ko "le bloc retenu ne contient pas de ligne \`git tag\` exécutable"
  elif [ -z "$ligne_gate" ]; then
    ko "md_version_libre est APPELÉ mais son code de retour n'arrête rien — un appel nu laisse le tag se poser sur un numéro pris"
  else
    ok "l'appel est GOUVERNANT (son code de retour arrête l'exécution)"
    [ "$ligne_gate" -lt "$ligne_tag" ] \
      && ok "et il gouverne AVANT la pose du tag (ligne ${ligne_gate} < ${ligne_tag})" \
      || ko "la vérification gouvernante vient APRÈS \`git tag\` (ligne ${ligne_gate} > ${ligne_tag}) — elle ne protège rien"
  fi
fi

# Le chemin qui SUPPRIME ne compare plus à \`main\` local.
if grep -qE 'git merge-base main ' "$SKILL"; then
  ko "l'étape 7.5 compare encore à \`main\` LOCAL"
else
  ok "l'étape 7.5 ne compare plus à \`main\` local"
fi

echo "== S — plus aucun fichier du dépôt ne PRESCRIT la lecture locale =="
# Garder chaque document un à un fait une liste d'exceptions qui se désarme
# elle-même. On garde la FAMILLE : aucun fichier suivi ne porte le motif, sauf
# les quelques-uns qui le CITENT pour le dénoncer — et chaque exception doit
# encore porter le motif, sinon elle a rouillé et on le dit.
# Le motif est une FAMILLE, pas une chaîne : `git tag | head -1`,
# `git tag --sort=… | head`, `git describe --tags` font le même geste faux.
# Une garde qui ne connaît qu'une formulation se contourne en la réécrivant.
MOTIF='git describe --tags|git tag[^`]{0,60}\| *(head|tail|sort)'
TOLERES="CHANGELOG.md
.claude/skills/merge/lib/mesure-distante.sh
.claude/skills/merge/SKILL.md
scripts/tests/test-merge-mesure-distante.sh
scripts/tests/test-mutations-merge-mesure-distante.sh"

# MERGE_FAUX_INTRUS n'AJOUTE qu'un nom à la liste examinée : le chemin par
# défaut reste celui que jouent tous les lancements normaux. Il sert à prouver
# que cette assertion mord, sans écrire dans le dépôt.
intrus=""
for f in $(cd "$ROOT" && git grep -lE "$MOTIF" -- . 2>/dev/null; printf '%s\n' "${MERGE_FAUX_INTRUS:-}"); do
  [ -n "$f" ] || continue
  printf '%s\n' "$TOLERES" | grep -qxF "$f" || intrus="${intrus} ${f}"
done
[ -z "$intrus" ] && ok "aucun fichier hors liste ne porte le motif de lecture locale" \
  || ko "ces fichiers prescrivent encore la lecture LOCALE :${intrus}"

# Une tolérance qui ne porte plus le motif est une exception rouillée : elle
# élargit la porte sans que rien ne le dise.
rouillees=""
for f in $(printf '%s\n' "$TOLERES"); do
  (cd "$ROOT" && grep -qE "$MOTIF" "$f" 2>/dev/null) || rouillees="${rouillees} ${f}"
done
[ -z "$rouillees" ] && ok "chaque tolérance porte encore le motif qu'elle dénonce" \
  || ko "tolérances rouillées (le motif n'y est plus) :${rouillees}"

echo "== T — le chiffre annoncé est celui qui est JOUÉ =="
# Un chiffre de couverture se lit comme frais alors qu'il date d'avant six
# scénarios. Le CHANGELOG sert de preuve de couverture : il doit porter les
# planchers réels, et c'est vérifiable.
# ⚠️ On compare au compte RÉELLEMENT JOUÉ, pas au `PLANCHER` : le plancher est
# une valeur entretenue À LA MAIN, donc un voisin de la chose à mesurer.
# Baisser le plancher ET le chiffre du CHANGELOG ensemble ne retire aucune
# assertion et rend cette garde verte sur un CHANGELOG qui ment. C'est
# exactement « le contrôle interroge l'étiquette au lieu de l'objet ».
# `total` inclut l'assertion qui suit, pour que le compte annoncé soit celui
# que la dernière ligne du banc imprimera.
CHLOG="${ROOT}/CHANGELOG.md"
total=$(( PASS + FAIL + 1 ))
# ⚠️ TOUTES les mentions, pas la première qui concorde : un `grep -q` trouve
# celle qui tombe juste et laisse rouiller les autres. Le fait vit à chaque
# endroit où il est écrit.
annonces="$(grep -oE 'test-merge-mesure-distante\.sh` — [0-9]+ assertions' "$CHLOG" | grep -oE '[0-9]+ assertions' | grep -oE '[0-9]+')"
if [ -z "$annonces" ]; then
  ko "le CHANGELOG n'annonce aucun compte d'assertions pour la suite"
else
  fausses=""
  for n in $annonces; do [ "$n" = "$total" ] || fausses="${fausses} ${n}"; done
  [ -z "$fausses" ] && ok "les $(printf '%s\n' "$annonces" | grep -c .) mention(s) du CHANGELOG annoncent ${total} assertions, soit le compte réellement joué" \
    || ko "le CHANGELOG annonce${fausses} assertion(s) pour la suite ; ${total} sont jouées — chiffre rouillé"
fi

echo "----------------------------------------"
echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"
# Un compte d'assertions qui BAISSE sans qu'un cas ait été retiré est une
# interruption, pas un succès (vague 2B). Le plancher est explicite.
PLANCHER=117
if [ "$((PASS + FAIL))" -lt "$PLANCHER" ]; then
  echo "❌ SUITE INTERROMPUE : $((PASS + FAIL)) assertions jouées, plancher ${PLANCHER}"
  exit 1
fi
[ "$FAIL" = "0" ] && { echo "✅ TOUS LES SCÉNARIOS PASSENT"; exit 0; } || { echo "❌ ÉCHEC"; exit 1; }
