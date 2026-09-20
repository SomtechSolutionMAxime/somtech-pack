#!/usr/bin/env bash
# ============================================================
# mesure-distante.sh — v1.0.0
# Les mesures de /merge qui DÉCIDENT portent sur le distant — T-20260820-0097.
#
# POURQUOI CE FICHIER EXISTE
# Deux étapes de /merge décidaient sur des références LOCALES, sans jamais
# interroger le serveur et sans jamais le dire :
#
#   · étape 8   — `git tag --sort=-v:refname | head -1` : le dernier tag que CE
#                 dépôt connaît. Un dépôt qui n'a pas fetché rend le tag d'il y
#                 a une heure, et /merge propose un numéro DÉJÀ PRIS.
#   · étape 7.5 — `git diff --quiet "$(git merge-base main "$branch")" ... 2>/dev/null`
#                 la référence de décision est `main` LOCAL, et l'erreur est
#                 avalée — sur un chemin qui fait `git branch -D` et
#                 `git push origin --delete`.
#
# Les deux sont des SILENCES QUI SE LISENT COMME DES SUCCÈS : le résultat est
# plausible, aucune erreur n'apparaît, et l'écart ne se voit que le jour où il
# existe. Le correctif n'est donc pas « fetcher par précaution » — c'est de
# rendre la mesure IMPOSSIBLE à faire en local sans le dire.
#
# TROIS INVARIANTS, et chacun a sa garde dans
# `scripts/tests/test-merge-mesure-distante.sh` :
#   1. Aucun repli silencieux sur le local. Distant injoignable ⇒ REFUS (rc=2),
#      jamais un numéro calculé sur les tags locaux.
#   2. Aucune erreur avalée sur un chemin qui supprime. Toute panne de mesure
#      rend INDETERMINE (rc=3) — qui n'est PAS « mergée ».
#   3. L'écart local/distant est DIT, même quand il est nul.
#
# Conçu pour être SOURCÉ (fonctions à code retour, ne tue pas le shell).
# ============================================================

# --- Sélection du plus grand tag vX.Y.Z lu sur stdin (vide si aucun) --------
# Comparaison CHAMP PAR CHAMP, et non lexicographique : `sort` mettrait v1.9.0
# après v1.100.0, et `sort -V` n'est pas garanti sur le BSD sort de macOS.
#
# ⚠️ Et surtout PAS une clé pondérée du type `maj*1000000 + min*1000 + pat` :
# elle déborde sur le champ voisin dès qu'un composant atteint sa base. Mesuré
# le 2026-09-20 : `v1.0.1000` battait `v1.1.0`, et `v1.1000.0` battait `v2.0.0`
# — les deux clés valaient exactement le même nombre. Une borne de ce genre est
# un silence qui se lit comme un succès : elle rend un tag plausible, jamais une
# erreur, et aucun dépôt n'en approche… jusqu'au jour où l'un le fait.
md_max_semver() {
  awk -F'[v.]' '
    {
      M = $2 + 0; m = $3 + 0; p = $4 + 0
      if (tag == "" || M > bM || (M == bM && (m > bm || (m == bm && p > bp)))) {
        bM = M; bm = m; bp = p; tag = $0
      }
    }
    END { if (tag != "") print tag }
  '
}

# LA définition d'un numéro de version, écrite UNE fois. `md_semver_filtre`
# filtre un flux, `md_semver_valide` juge une valeur — les deux s'appuient sur
# le même motif ancré. Une seconde écriture de la règle serait un second
# endroit où elle peut diverger.
# ⚠️ Zéros de tête INTERDITS. `v01.02.03` et `v1.2.3` se lisent comme le même
# numéro et sont deux refs DIFFÉRENTES : l'une pourrait être libre pendant que
# l'autre est prise — deux lots réclamant le même numéro sous deux
# orthographes, c'est-à-dire T-20260815-0013 par une autre porte. Mesuré avant
# de resserrer : aucun des 144 tags du serveur ne porte de zéro de tête.
MD_SEMVER_MOTIF='^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'

md_semver_filtre() {
  grep -E "$MD_SEMVER_MOTIF" || true
}

# Vrai (0) si <valeur> est un numéro de version. Ancré des DEUX côtés.
# ⚠️ Surtout pas un `case … in v[0-9]*.[0-9]*.[0-9]*)` : en shell, `[0-9]*`
# veut dire « un chiffre puis N'IMPORTE QUOI ». Mesuré le 2026-09-20 :
# `v1.2.3.4`, `v1.2.3abc`, `v01.02.03`, `v1a.2.3` passaient tous — et surtout
# `v1.9*.0`, dont l'étoile est un GLOB que `ls-remote` interprète : le refus
# nommait alors un tag inexistant avec le sha d'un autre.
md_semver_valide() {
  printf '%s\n' "${1:-}" | grep -qE "$MD_SEMVER_MOTIF"
}

# --- Tags DISTANTS — interroge le serveur, ne lit rien du dépôt local -------
# `git ls-remote` parle au serveur à chaque appel : pas de fetch préalable
# nécessaire, et pas de cache qui puisse retarder.
# rc=0 : liste (possiblement vide) sur stdout · rc=2 : serveur injoignable.
md_tags_distants() {
  local remote="${1:-origin}" out rc
  out="$(git ls-remote --tags "$remote" 2>&1)"; rc=$?
  if [ "$rc" -ne 0 ]; then
    printf 'md_tags_distants: %s injoignable — %s\n' "$remote" "$out" >&2
    return 2
  fi
  # Un tag ANNOTÉ rend deux lignes : `refs/tags/vX.Y.Z` et sa déréférence
  # `refs/tags/vX.Y.Z^{}`. On ne la retire PAS à part : le filtre semver
  # l'écarte déjà, parce qu'elle ne finit pas par un chiffre. Un second
  # nettoyage serait une ligne que rien ne peut faire rougir.
  printf '%s\n' "$out" \
    | awk '{ print $2 }' \
    | sed -e 's#^refs/tags/##' \
    | md_semver_filtre
}

# Dernier tag DISTANT. rc=2 si le serveur est injoignable (sortie vide).
md_dernier_tag_distant() {
  local liste rc
  liste="$(md_tags_distants "${1:-origin}")"; rc=$?
  [ "$rc" -ne 0 ] && return "$rc"
  printf '%s\n' "$liste" | md_max_semver
}

# Dernier tag LOCAL. Existe pour être COMPARÉ au distant, jamais pour décider.
md_dernier_tag_local() {
  git tag --list 2>/dev/null | md_semver_filtre | md_max_semver
}

# --- Écart local/distant, toujours dit ------------------------------------
# Échos possibles :
#   DISTANT-INJOIGNABLE                       (rc=2)
#   AUCUN-TAG <local|-> <->
#   A-JOUR <local|-> <distant>
#   LOCAL-EN-RETARD <local|-> <distant>       ← le défaut de T-20260820-0097
#   LOCAL-EN-AVANCE <local> <distant|->       ← tag posé mais jamais poussé
md_ecart_tags() {
  local remote="${1:-origin}" d l rc
  d="$(md_dernier_tag_distant "$remote")"; rc=$?
  if [ "$rc" -ne 0 ]; then echo "DISTANT-INJOIGNABLE"; return 2; fi
  l="$(md_dernier_tag_local)"

  if [ -z "$d" ] && [ -z "$l" ]; then echo "AUCUN-TAG - -"; return 0; fi
  if [ -z "$d" ]; then echo "LOCAL-EN-AVANCE ${l} -"; return 0; fi
  if [ -z "$l" ]; then echo "LOCAL-EN-RETARD - ${d}"; return 0; fi
  if [ "$l" = "$d" ]; then echo "A-JOUR ${l} ${d}"; return 0; fi

  local plus_grand
  plus_grand="$(printf '%s\n%s\n' "$l" "$d" | md_max_semver)"
  if [ "$plus_grand" = "$d" ]; then
    echo "LOCAL-EN-RETARD ${l} ${d}"
  else
    echo "LOCAL-EN-AVANCE ${l} ${d}"
  fi
  return 0
}

# --- Prochaine version, calculée sur le DISTANT uniquement -----------------
# Usage : md_prochaine_version [patch|minor|major] [remote]
# Écho : PROCHAINE <vX.Y.Z> DISTANT <tag|-> LOCAL <tag|-> ECART <état>
# rc=2 : distant injoignable → REFUS, aucun numéro proposé. Pas de repli local :
#        c'est précisément le repli qui republierait un numéro déjà pris.
md_prochaine_version() {
  local bump="${1:-patch}" remote="${2:-origin}" d l ecart rc maj min pat
  d="$(md_dernier_tag_distant "$remote")"; rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "REFUS distant-injoignable"
    return 2
  fi
  l="$(md_dernier_tag_local)"
  ecart="$(md_ecart_tags "$remote")"
  ecart="${ecart%% *}"

  if [ -z "$d" ]; then maj=0; min=0; pat=0; else
    maj="$(printf '%s' "${d#v}" | cut -d. -f1)"
    min="$(printf '%s' "${d#v}" | cut -d. -f2)"
    pat="$(printf '%s' "${d#v}" | cut -d. -f3)"
  fi

  case "$bump" in
    major) maj=$((maj + 1)); min=0; pat=0 ;;
    minor) min=$((min + 1)); pat=0 ;;
    patch) pat=$((pat + 1)) ;;
    *) echo "REFUS bump-inconnu ${bump}"; return 4 ;;
  esac

  printf 'PROCHAINE v%s.%s.%s DISTANT %s LOCAL %s ECART %s\n' \
    "$maj" "$min" "$pat" "${d:--}" "${l:--}" "$ecart"
}

# --- Le numéro visé est-il encore LIBRE sur le serveur ? -------------------
# T-20260815-0013 : le 2026-08-15, deux lots parallèles ont préparé `v1.53.0`.
# Le second a mergé avec le même numéro. Calculer la prochaine version sur le
# distant ne suffit PAS à l'empêcher : entre le calcul et la pose du tag, un
# autre lot peut avoir pris le numéro. Ce qu'il faut est un REFUS au moment de
# poser, qui NOMME le tag déjà là.
#
# ⚠️ QUATRE états, et il est vital de ne pas les confondre — un « libre » rendu
# par erreur est précisément ce qui republie un numéro pris :
#   LIBRE <version>            rc=0  le serveur ne porte pas ce tag
#   PRIS <version> <sha>       rc=1  il le porte — REFUSER, recalculer
#   REFUS serveur-injoignable  rc=2  on NE SAIT PAS → traiter comme un refus,
#                                    jamais comme un libre. « Libre » et « je
#                                    n'ai pas pu regarder » se ressemblent, et
#                                    c'est la ressemblance qui coûte.
#   REFUS version-malformee    rc=3  la question elle-même est invalide — on ne
#   REFUS version-non-fournie        devine pas ce qui était voulu.
md_version_libre() {
  local version="${1:-}" remote="${2:-origin}" out rc ligne

  if [ -z "$version" ]; then
    echo "REFUS version-non-fournie"; return 3
  fi
  if ! md_semver_valide "$version"; then
    echo "REFUS version-malformee ${version}"; return 3
  fi

  # `ls-remote` interroge le SERVEUR : un dépôt local qui n'a pas fetché dirait
  # « libre » d'un tag qui existe depuis une heure.
  #
  # ⚠️ `2>&1` est VOULU : sur le chemin d'échec, c'est ce qui donne un
  # diagnostic utile. Sur le chemin de succès, il fait entrer des lignes qui ne
  # sont pas des refs — un « Warning: Permanently added… » de ssh, un message de
  # credential helper. Ce qui protège n'est donc PAS la séparation des flux,
  # c'est le filtre sur la ref exacte, plus bas. *Une séparation de stderr a été
  # écrite ici puis retirée : les deux se recouvraient, et celle-ci ne pouvait
  # plus rougir — une protection qu'aucune épreuve ne peut juger n'en est pas
  # une.*
  out="$(git ls-remote --tags "$remote" "refs/tags/${version}" 2>&1)"; rc=$?
  if [ "$rc" -ne 0 ]; then
    printf 'md_version_libre: %s injoignable — %s\n' "$remote" "$out" >&2
    echo "REFUS serveur-injoignable"
    return 2
  fi

  # Avec un refspec EXACT, `ls-remote` ne rend ni la déréférence `^{}` d'un tag
  # annoté, ni les refs dont le nom commence pareil (`refs/tags/v7.7.7` ne
  # ramène pas `v7.7.70`) — mesuré, pas supposé (scénarios V-ter, V-quater).
  # On n'en déduit PAS qu'on peut prendre la première ligne venue : on retient
  # la ligne qui porte EXACTEMENT la ref demandée. Une sortie inattendue du
  # serveur ne doit pas pouvoir se faire passer pour un sha.
  ligne="$(printf '%s\n' "$out" | awk -v r="refs/tags/${version}" '$2 == r { print $1; exit }')"
  if [ -n "$ligne" ]; then
    echo "PRIS ${version} ${ligne}"
    return 1
  fi

  echo "LIBRE ${version}"
  return 0
}

# ⚠️ PAS de boucle qui chercherait « le prochain numéro libre ». Le calcul part
# du plus grand tag du serveur : un numéro pris est, par construction, le plus
# grand — donc le calcul suivant l'enjambe déjà. Une boucle de repli aurait un
# corps que rien ne pourrait atteindre, donc que rien ne pourrait faire rougir.
# Ce que le ticket demande est un REFUS, pas un verrou : « celui qui perd la
# course recalcule et repart ».

# --- Rafraîchir origin, explicitement et bruyamment ------------------------
# `md_statut_branche` décide sur `origin/main`, une ref de SUIVI : elle ne vaut
# que ce que vaut le dernier fetch. Cette fonction est le « fetch d'abord,
# explicitement » — et elle échoue franchement plutôt que de laisser la suite
# décider sur une ref périmée.
md_rafraichir_origine() {
  local remote="${1:-origin}" out rc
  out="$(git fetch --tags --prune "$remote" 2>&1)"; rc=$?
  if [ "$rc" -ne 0 ]; then
    printf 'md_rafraichir_origine: échec du fetch %s — %s\n' "$remote" "$out" >&2
    return 2
  fi
  return 0
}

# --- Statut d'une branche face à la ref de décision ------------------------
# Usage : md_statut_branche <branche> [ref=origin/main]
# Écho : MERGED (rc=0) · UNMERGED (rc=0) · INDETERMINE <raison> (rc=3)
#
# INDETERMINE n'est PAS « mergée ». C'est le point de tout l'exercice : la
# version d'origine avalait l'échec de `git merge-base` avec `2>/dev/null`, et
# une sortie vide se lit « aucune différence » — donc « safe à supprimer », sur
# un chemin qui fait `git branch -D` ET `git push origin --delete`.
md_statut_branche() {
  local branch="${1:-}" ref="${2:-origin/main}" base out rc

  if [ -z "$branch" ]; then echo "INDETERMINE branche-non-fournie"; return 3; fi
  if ! git rev-parse --verify --quiet "${ref}^{commit}" >/dev/null 2>&1; then
    echo "INDETERMINE ref-de-decision-absente ${ref}"; return 3
  fi
  if ! git rev-parse --verify --quiet "${branch}^{commit}" >/dev/null 2>&1; then
    echo "INDETERMINE branche-absente ${branch}"; return 3
  fi

  out="$(git merge-base "$ref" "$branch" 2>&1)"; rc=$?
  if [ "$rc" -ne 0 ]; then echo "INDETERMINE merge-base-echoue ${out}"; return 3; fi
  base="$out"

  out="$(git diff --quiet "$base" "$branch" -- 2>&1)"; rc=$?
  case "$rc" in
    0) echo "MERGED";   return 0 ;;
    1) echo "UNMERGED"; return 0 ;;
    *) echo "INDETERMINE diff-echoue rc=${rc} ${out}"; return 3 ;;
  esac
}
