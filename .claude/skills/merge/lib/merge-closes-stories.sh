# shellcheck shell=bash
# ============================================================
# merge-closes-stories.sh — v1.0.0
# Détermine QUELLES stories un merge ferme (T-20260922-0084, D-20260921-0017 lot 4 garde 2/5).
#
# POURQUOI CE FICHIER EXISTE
# `.claude/skills/merge/` ne portait ni "completed" ni "STD-030" (zéro occurrence,
# vérifié par batiscan avant l'ouverture du ticket) : /merge ne fermait JAMAIS les
# stories qu'il merge — un statut différé qui fait mentir le ServiceDesk (règle
# d'or n°13, STD-030 réalité-miroir), sans fin garantie à l'intervalle.
#
# LA QUESTION DE CONCEPTION, TRANCHÉE ICI : comment savoir quelles stories un
# merge ferme ? Titre de PR, commits, `demand_id`, liste à la main — chaque
# réponse a un mode de panne (deviner ferme la mauvaise ; la main ne ferme rien
# quand on oublie).
#
# MOTIF RETENU, sur MESURE RÉELLE — 60 PR mergées de ce dépôt (#306 à #369,
# `gh pr list --state merged`), voir scripts/tests/fixtures/merge-closes-stories-corpus.json :
#
#   Une ligne DU CORPS DE LA PR, dont le texte (après avoir retiré les espaces
#   de tête) COMMENCE par un label reconnu — `Ticket`, `Tickets`, `Story` ou
#   `Stories`, avec 0 à 2 `*` de chaque côté (gras markdown), puis un `:`
#   optionnel — porte la liste des IDs `T-YYYYMMDD-NNNN` à fermer. Les IDs sont
#   lus jusqu'au premier `.` DE CETTE LIGNE (fin de phrase) — jamais au-delà.
#   Aucune autre ligne du corps n'est lue.
#
# CE QUE CE MOTIF NE COUVRE PAS (assumé, mesuré, pas deviné) :
#   · Le TITRE de la PR n'est PAS une source — 60 PR réelles montrent qu'il peut
#     DIVERGER du corps (PR #314 : titre suffixé `T-20260821-0032`, corps ne
#     nomme JAMAIS cet ID). Se fier au titre aurait fermé la story qu'AUCUN
#     texte de la PR ne confirme.
#   · Un ID mentionné en PROSE, hors ligne étiquetée, n'est jamais retenu (PR
#     #338 : `T-20260826-0042` cité en narration — « a ouvert la porte » — sur
#     une ligne qui ne commence pas par le label ; retenu à tort, ce serait une
#     fermeture d'une story qui n'est PAS celle de cette PR).
#   · Un ID mentionné APRÈS un `.` sur la ligne étiquetée elle-même n'est pas
#     retenu (PR #347 : « Tickets : T-A, T-B. Trouvé en chemin, non corrigé
#     ici : T-C. » — sans la troncature à la phrase, T-C serait fermé à tort).
#   · Un tableau markdown (`| Ticket | Correctif |`, PR #346) ou une liste sans
#     label en tête de ligne (PR #336, sous-titres `## T-ID — texte`) ne sont
#     PAS reconnus — le mécanisme s'ABSTIENT plutôt que d'inventer un second
#     motif de lecture pour un format qu'aucune règle n'oblige.
#   · Une liste qui utiliserait le `.` comme séparateur entre IDs (jamais
#     observée sur ce dépôt) serait tronquée après le premier — sous-fermeture,
#     jamais sur-fermeture : l'asymétrie est voulue (fermer à tort est PIRE que
#     ne pas fermer).
#
# Sur les 60 PR mesurées : 28 déterminent >=1 ticket (37 IDs au total, TOUS
# vérifiés à la main contre le texte réel — 0 faux positif) ; 32 s'abstiennent
# (aucune ligne étiquetée) — l'abstention est le comportement voulu sur du
# texte ambigu, pas un échec de la mesure.
#
# Lib PURE : ne définit que des fonctions, aucun effet de bord au sourcing.
# Ne fait AUCUN appel MCP — l'extraction est déterministe et testable en
# isolation. La validation sémantique (le ticket existe, appartient à CETTE
# application, n'est pas déjà en état terminal) et l'écriture du statut
# `completed` sont faites par /merge lui-même (SKILL.md, étape 6.5), via MCP —
# hors de portée d'une lib shell pure.
#
# Fonctions publiques :
#   mfs_tickets_du_corps <fichier-corps>
#     stdout : IDs T-YYYYMMDD-NNNN dédupliqués, dans l'ordre de première
#              apparition, un par ligne.
#     rc=0 : au moins un ID déterminé.
#     rc=1 : INDÉTERMINÉ — aucune ligne étiquetée, ou étiquetée sans ID
#            reconnaissable. /merge DOIT le dire et s'arrêter sur ce point
#            (G/W/T #2) — jamais deviner, jamais fermer en silence.
#     rc=2 : fichier absent — erreur d'appel, pas une mesure.
# ============================================================

# Motif d'un ID de ticket ServiceDesk. Écrit UNE fois — toute autre fonction
# de ce fichier s'appuie dessus plutôt que de le répéter.
MFS_ID_MOTIF='T-[0-9]{8}-[0-9]{4}'

# mfs_ligne_label <ligne> — si <ligne> (après retrait des espaces de tête)
# commence par un label reconnu (`Ticket(s)`/`Story`/`Stories`, 0-2 `*` de
# chaque côté, `:` optionnel), imprime le RESTE de la ligne sur stdout et rend
# rc=0. Sinon rc=1, rien sur stdout.
#
# ⚠️ Label ANCRÉ EN TÊTE DE LIGNE (après trim), jamais recherché n'importe où
# dans le texte — c'est ce qui exclut PR #338 (T-20260826-0042 cité en pleine
# phrase, sur une ligne qui ne COMMENCE pas par le label).
#
# 🔴 FRONTIÈRE DE MOT APRÈS LE LABEL, OBLIGATOIRE — trouvé en revue de fond
# (T-20260922-0084) : sans elle, `Tickets?`/`Stor(y|ies)` matchent le PRÉFIXE
# d'un mot plus long («Ticketing system updated: ... T-20260921-0099»,
# «Storyboard revu, voir T-20260921-0088» — les deux vérifiés en rejouant la
# fonction), ce qui fait exactement rentrer par la bande le défaut PR #338 que
# l'ancrage en tête de ligne prétend exclure. Le caractère qui suit
# immédiatement le label (avant les `*`/espaces/`:` de bordure) ne doit JAMAIS
# être une lettre.
mfs_ligne_label() {
  local ligne="$1" trim label_match apres
  trim="${ligne#"${ligne%%[![:space:]]*}"}"
  [ -z "$trim" ] && return 1
  if [[ "$trim" =~ ^\*{0,2}(Tickets?|Stor(y|ies))\*{0,2} ]]; then
    label_match="${BASH_REMATCH[0]}"
    apres="${trim:${#label_match}}"
    if [[ "$apres" =~ ^[A-Za-z] ]]; then
      return 1
    fi
    [[ "$apres" =~ ^[[:space:]]*:?[[:space:]]* ]]
    printf '%s\n' "${apres:${#BASH_REMATCH[0]}}"
    return 0
  fi
  return 1
}

# mfs_tronquer_a_la_phrase <texte> — imprime <texte> jusqu'au premier `.`
# EXCLU (fin de phrase). Aucun `.` : imprime <texte> tel quel.
# C'est le correctif du défaut PR #347 : sans cette troncature, un ID cité
# APRÈS la phrase de liste (« … non corrigé ici : T-X. ») serait retenu.
mfs_tronquer_a_la_phrase() {
  local texte="$1"
  printf '%s' "${texte%%.*}"
}

# mfs_extraire_ids <texte> — imprime chaque ID T-YYYYMMDD-NNNN trouvé dans
# <texte>, un par ligne, dans l'ordre d'apparition. Insensible à la casse
# JAMAIS activée : un nom d'agent en minuscules (`t-20260825-0012`, convention
# des panes herdr) ne matche pas `T-` majuscule — exclusion voulue, pas un
# angle mort (mesuré sur PR #329, qui cite les deux formes cote à cote).
#
# 🔴 TOKEN ENTIER, JAMAIS UNE SOUS-CHAÎNE — trouvé en revue de fond
# (T-20260922-0084) : `grep -oE "$MFS_ID_MOTIF"` sans frontière trouve le
# motif N'IMPORTE OÙ, y compris À L'INTÉRIEUR d'un token plus long — un ID mal
# formé `T-20260921-00171` (un chiffre de trop) se faisait TRONQUER,
# SILENCIEUSEMENT, en `T-20260921-0017` — un ID VALIDE mais DIFFÉRENT, que
# l'Étape 6.5 pourrait alors fermer à tort si ce numéro existe réellement.
# `tr -c 'A-Za-z0-9-' '\n'` découpe <texte> en tokens faits uniquement de
# lettres/chiffres/tirets (toute ponctuation, espace, ou octet multi-octet
# UTF-8 devient un séparateur) ; seul un token qui correspond EXACTEMENT
# (ancré des DEUX côtés) au motif est retenu — un token trop long, trop court,
# ou suffixé (`T-20260914-0004a`) est rejeté EN ENTIER, jamais tronqué.
mfs_extraire_ids() {
  local token motif_ancre="^${MFS_ID_MOTIF}\$"
  # `|| [ -n "$token" ]` : sans ce filet, le DERNIER token est perdu quand le
  # flux de `tr` ne se termine pas par un saut de ligne (`read` échoue sur la
  # dernière ligne partielle et la boucle s'arrête avant de la traiter) — un
  # ID valide en fin de ligne étiquetée disparaîtrait silencieusement.
  while IFS= read -r token || [ -n "$token" ]; do
    [ -z "$token" ] && continue
    if [[ "$token" =~ $motif_ancre ]]; then
      printf '%s\n' "$token"
    fi
  done < <(printf '%s' "$1" | tr -c 'A-Za-z0-9-' '\n')
}

# mfs_tickets_du_corps <fichier-corps> — voir contrat en tête de fichier.
mfs_tickets_du_corps() {
  local fichier="${1:?fichier corps requis}"
  if [ ! -f "$fichier" ]; then
    echo "mfs_tickets_du_corps: fichier absent: $fichier" >&2
    return 2
  fi

  local ligne reste tronque id vu
  # Pas de `local -A` (associatif) : le bash 3.2 livré par défaut sur macOS
  # n'en a pas, et aucune autre lib de ce skill n'en dépend (mesure-distante.sh,
  # worktree-aware-delete.sh). Déduplication par recherche linéaire dans
  # `resultat` — N reste petit (quelques IDs par corps de PR), pas un coût.
  local resultat=()

  while IFS= read -r ligne || [ -n "$ligne" ]; do
    reste="$(mfs_ligne_label "$ligne")" || continue
    tronque="$(mfs_tronquer_a_la_phrase "$reste")"
    while IFS= read -r id; do
      [ -z "$id" ] && continue
      vu=0
      for existant in "${resultat[@]+"${resultat[@]}"}"; do
        [ "$existant" = "$id" ] && { vu=1; break; }
      done
      [ "$vu" -eq 0 ] && resultat+=("$id")
    done < <(mfs_extraire_ids "$tronque")
  done < "$fichier"

  if [ "${#resultat[@]}" -eq 0 ]; then
    return 1
  fi
  printf '%s\n' "${resultat[@]}"
  return 0
}
