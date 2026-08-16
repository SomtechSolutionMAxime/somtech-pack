#!/usr/bin/env bash
# ============================================================
# attente-au-sas.sh — v3.0.0
# Décide si un chantier doit dire qu'il attend son tour pour la mise en ligne,
# et à qui — puis formule ce qui sera dit.
#
# Epic E-20260806-0005. Réalise EF-AGT-003 (BRD Somtech Pack), encadrée par
# RA-AGT-005, RA-AGT-006 et RA-AGT-007.
#
# POURQUOI CE HELPER EXISTE
#   Le représentant du client peut voir que la mise en ligne est occupée — il a
#   `applications action lock_status`. Ce quil ne peut pas savoir, cest que le
#   chantier QUI ATTEND DERRIÈRE est le sien : le verrou nomme son détenteur, pas
#   ceux qui patientent. Toi seul le sais. Sans un mot de ta part, il dira « cest
#   en cours » — ce qui est faux, et se découvre quand le client relance.
#   RA-AGT-007 exige que lobligation de le dire vive dans le CHEMIN, pas dans la
#   discipline de celui qui attend : cest ce fichier, et le test qui le mesure.
#
# CE QUIL NE FAIT PAS
#   • Aucun mécanisme de file (HS-REL-005) : sans état, sans persistance, sans
#     sondage. Le droit dacces exclusif par application existe déjà côté
#     ServiceDesk ; on lui ajoute la parole, rien dautre. Cest le seul propos de
#     cette ligne : ne PAS bâtir une file par-dessus.
#     ATTENTION — ne la lis pas comme une garantie dexclusivité. Le 2026-08-14,
#     le feed a rapporte que le verrou a ete ACCORDE a une nouvelle PR alors que
#     staging etait occupe depuis trois jours, et quun lock_status peut repondre
#     « libre » sur un sas occupe : lacquisition comme la lecture ont failli.
#     Qui veut savoir SI le sas est libre mesure lecart git main..staging.
#     Ce fichier ne lit ni ne prend le verrou : il parle.
#   • Il ne parle ni au client ni au dirigeant : il sadresse au représentant du
#     client, et à lui seul. Lenvoi lui-même reste au chemin appelant.
#   • Il nappelle pas le MCP : comme `staging-lock-acquire.sh`, il fait la part
#     scriptable et testable, et rend une COMMANDE prête à exécuter.
#
# MOMENTS
#   attente   la mise en ligne vient dêtre refusée : cest le tour dun autre
#   passage   la mise en ligne vient dêtre obtenue après une attente déclarée
#
# ENTRÉES (variables denvironnement — points dinjection des tests)
#   ATS_REPRESENTANT          nom dagent du représentant du client. VIDE = le
#                             chantier nen a pas → comportement inchangé.
#                             Doit respecter la forme imposée par herdr :
#                             ^[a-z][a-z0-9_-]{0,31}$ — sinon FAIL. Cette
#                             validation nest pas cosmétique : la valeur part
#                             dans une COMMANDE que lappelant exécute, et elle
#                             est recopiée à la main depuis un commentaire du
#                             registre. Elle nest donc PAS de confiance.
#   ATS_CHANTIER              code du chantier (D-…, P-…, J-…). Requis, ≤ 64.
#   ATS_APPLICATION           nom lisible de lapplication — sert au MESSAGE seul,
#                             jamais à décider. Requis, ≤ 120.
#   ATS_APPLICATION_ID        identifiant de lapplication du chantier, tel quil
#                             figure dans `.somtech/app.yaml` (servicedesk.app_id)
#                             — cest CE MÊME identifiant qui prend le verrou.
#                             Requis pour `attente`. [A-Za-z0-9._-]+, ≤ 128.
#   ATS_APPLICATION_ID_VERROU identifiant de lapplication sur laquelle porte le
#                             verrou rencontré. ABSENT = le tien : cest le cas
#                             normal, puisquun refus de `lock_acquire` porte par
#                             construction sur ta propre application. À renseigner
#                             seulement quand tu regardes le verrou dune AUTRE
#                             application (via `lock_status`).
#   ATS_DETENTEUR_PR          n° de la livraison qui occupe (facultatif, chiffres).
#   ATS_DEPUIS                depuis quand elle loccupe (facultatif, ≤ 64).
#   ATS_ATTENTE_DECLAREE      oui|non — pour `passage` seulement.
#
# SORTIE (lignes KEY=VALUE sur stdout) et CODE RETOUR
#   DECISION=DIRE  (rc 0) + MESSAGE= + COMMANDE=   → envoyer, puis le réinscrire
#   DECISION=RIEN  (rc 3) + MOTIF=                 → rien à dire, et cest juste
#   DECISION=FAIL  (rc 5) + MOTIF=                 → impossible de formuler sans
#                                                    inventer → corriger, pas se taire
#   AVERTISSEMENT= (0..n, avant DECISION)          → une donnée reçue était
#                                                    illisible et na PAS été
#                                                    relayée. Jamais silencieux :
#                                                    relayer un chiffre auquel on
#                                                    ne croit pas est pire que de
#                                                    ne pas le donner, mais le
#                                                    taire lest tout autant.
#
#   Le rc 5 est délibérément BRUYANT. Quand un représentant attend une nouvelle,
#   se taire parce quune donnée manque est le défaut même que RA-AGT-007 nomme :
#   le silence nest jamais un repli, il nest légitime que sous DECISION=RIEN.
#
# Sourçable (ats_resoudre) ou exécution directe. Sourcer ce fichier ne modifie
# AUCUN réglage du shell appelant — voir la note sur la locale ci-dessous.
# ============================================================

# Les intervalles de motifs (`[A-Z]`, `[a-z0-9_-]`) dépendent de lordre de
# collation de la locale. En fr/en UTF-8 sur bash 3.2, `[A-Z]` matche AUSSI les
# minuscules : le repli de casse décalait alors chaque lettre de 32 et rendait
# des octets invalides — « oui » devenait illisible et le message de fin dattente
# ne partait jamais. En C, les intervalles redeviennent ce quils ont lair dêtre.
#
# La locale est donc forcée, mais TOUJOURS en `local` dans chaque fonction,
# jamais exportée au niveau du fichier : sourcer ce helper infligerait sinon à
# son appelant la mutilation des accents que cet en-tête décrit comme le défaut
# à éviter. La portée dynamique de bash suffit — la valeur posée dans
# `ats_resoudre` couvre tout ce quelle appelle.

# Rend une donnée transportable par le prompt inter-agents : celui-ci est passé
# entre apostrophes simples et se soumet au premier retour à la ligne. Une
# apostrophe, un saut de ligne ou un retour chariot y coupe le message, et la
# remise échoue sans que personne ne lapprenne (RA-REL-005).
#
# Sans `sed` ni `tr` : le helper tourne dans des environnements dépouillés où la
# locale nest pas posée, et en C ces outils MUTILENT les caractères accentués du
# message au lieu déchouer. Les expansions de bash travaillent sur les octets.
# Le découpage en mots est linéaire, là où une boucle de repli despaces
# successifs est quadratique.
ats_normaliser() {
  local LC_ALL=C
  local s="$1" out="" w
  s="${s//$'\n'/ }"; s="${s//$'\r'/ }"; s="${s//$'\t'/ }"
  s="${s//$'\v'/ }"; s="${s//$'\f'/ }"; s="${s//$'\e'/ }"
  s="${s//\'/}"; s="${s//\`/}"; s="${s//’/}"
  local reglob=0
  case "$-" in *f*) reglob=1 ;; esac
  set -f
  for w in $s; do out="${out:+$out }$w"; done
  [ "$reglob" = "1" ] || set +f
  printf '%s' "$out"
}

# Repli de casse ASCII, sans aucune substitution de commande : la version
# précédente en forkait trois par caractère et mettait 29 s sur une entrée de
# 16 000 lettres. Les caractères non-ASCII traversent octet par octet.
ats_minuscules() {
  local LC_ALL=C
  local s="$1" out="" i c
  for (( i=0; i<${#s}; i++ )); do
    c="${s:i:1}"
    case "$c" in
      A) c=a ;; B) c=b ;; C) c=c ;; D) c=d ;; E) c=e ;; F) c=f ;; G) c=g ;;
      H) c=h ;; I) c=i ;; J) c=j ;; K) c=k ;; L) c=l ;; M) c=m ;; N) c=n ;;
      O) c=o ;; P) c=p ;; Q) c=q ;; R) c=r ;; S) c=s ;; T) c=t ;; U) c=u ;;
      V) c=v ;; W) c=w ;; X) c=x ;; Y) c=y ;; Z) c=z ;;
    esac
    out="${out}${c}"
  done
  printf '%s' "$out"
}

# Un nom dagent tel que herdr limpose : minuscule initiale, puis minuscules,
# chiffres, tiret ou souligné, 1 à 32 caractères. Tout le reste est refusé — ce
# qui met hors de portée `;`, `$(…)`, `&&`, `|`, `\` et les espaces, donc toute
# tentative de faire exécuter autre chose que la remise du message.
ats_nom_dagent_valide() {
  local LC_ALL=C
  case "$1" in
    ""|*[!a-z0-9_-]*) return 1 ;;
    [a-z]*) [ "${#1}" -le 32 ] ;;
    *) return 1 ;;
  esac
}

# Un identifiant dapplication : UUID ou slug. Volontairement restreint à lASCII
# — un identifiant accentué nen est pas un, et le repli de casse ne saurait pas
# le comparer honnêtement. Borné, pour que le repli reste instantané.
ats_identifiant_valide() {
  local LC_ALL=C
  case "$1" in
    ""|*[!A-Za-z0-9._-]*) return 1 ;;
    *) [ "${#1}" -le 128 ] ;;
  esac
}

ats_entier_valide() {
  local LC_ALL=C
  case "$1" in
    ""|*[!0-9]*) return 1 ;;
    *) [ "${#1}" -le 12 ] ;;
  esac
}

# Deux identifiants désignent-ils la même application ? Égalité STRICTE après
# repli de casse — jamais un préfixe : `acme` et `acme-portail` sont deux
# applications distinctes, et les confondre ferait déclarer au client une attente
# qui nest pas la sienne.
ats_meme_application() {
  [ "$(ats_minuscules "$1")" = "$(ats_minuscules "$2")" ]
}

ats_resoudre() {
  local LC_ALL=C
  local moment="${1:-}"
  local representant chantier application app_id app_id_verrou detenteur depuis message
  local avertissements=""

  case "$moment" in
    attente|passage) ;;
    *)
      echo "DECISION=FAIL"
      echo "MOTIF=moment inconnu (${moment:-vide}) — attendu attente ou passage ; on ne se tait pas sur une erreur de chemin"
      return 5
      ;;
  esac

  representant="$(ats_normaliser "${ATS_REPRESENTANT:-}")"

  # Pas de représentant du client → le chantier rend compte au dirigeant comme
  # avant. EF-AGT-003 ne porte que sur les chantiers menés pour un représentant :
  # ailleurs, strictement rien ne change.
  if [ -z "$representant" ]; then
    echo "DECISION=RIEN"
    echo "MOTIF=ce chantier na pas de representant client — comportement inchange, rien nest declare a personne"
    return 3
  fi

  if ! ats_nom_dagent_valide "$representant"; then
    echo "DECISION=FAIL"
    echo "MOTIF=nom de representant invalide (${representant}) — attendu la forme imposee par herdr, minuscule initiale puis minuscules chiffres tiret ou souligne, 32 caracteres au plus"
    return 5
  fi

  chantier="$(ats_normaliser "${ATS_CHANTIER:-}")"
  application="$(ats_normaliser "${ATS_APPLICATION:-}")"

  # Les DEUX moments en ont besoin : un message de fin dattente qui ne nomme ni
  # le chantier ni lapplication ne dit rien à personne.
  if [ -z "$chantier" ] || [ -z "$application" ]; then
    echo "DECISION=FAIL"
    echo "MOTIF=un representant attend une nouvelle mais le chantier ou son application est inconnu — impossible de formuler sans inventer (RA-AGT-007)"
    return 5
  fi
  if [ "${#chantier}" -gt 64 ] || [ "${#application}" -gt 120 ]; then
    echo "DECISION=FAIL"
    echo "MOTIF=code de chantier ou nom dapplication demesure — ce nest pas un code de chantier, et un message illisible ne se relaie pas"
    return 5
  fi

  detenteur="$(ats_normaliser "${ATS_DETENTEUR_PR:-}")"
  depuis="$(ats_normaliser "${ATS_DEPUIS:-}")"

  if [ -n "$detenteur" ] && ! ats_entier_valide "$detenteur"; then
    avertissements="${avertissements}AVERTISSEMENT=le numero de livraison recu netait pas un numero (${detenteur}) — il na pas ete relaye au representant
"
    detenteur=""
  fi
  if [ -n "$depuis" ] && [ "${#depuis}" -gt 64 ]; then
    avertissements="${avertissements}AVERTISSEMENT=la date de debut doccupation recue etait demesuree — elle na pas ete relayee au representant
"
    depuis=""
  fi

  if [ "$moment" = "attente" ]; then
    app_id="$(ats_normaliser "${ATS_APPLICATION_ID:-}")"
    if ! ats_identifiant_valide "$app_id"; then
      echo "DECISION=FAIL"
      echo "MOTIF=identifiant dapplication absent ou mal forme (${app_id:-vide}) — il vient de servicedesk.app_id dans .somtech/app.yaml, celui-la meme qui prend le verrou ; sans lui on ne peut pas savoir si lattente est la notre"
      return 5
    fi

    # Absent OU blanc → le tien. Un refus de `lock_acquire` porte par
    # construction sur ta propre application : cest le cas normal, et les deux
    # facons de ne rien dire doivent donner le meme verdict.
    app_id_verrou="$(ats_normaliser "${ATS_APPLICATION_ID_VERROU:-}")"
    [ -z "$app_id_verrou" ] && app_id_verrou="$app_id"

    if ! ats_identifiant_valide "$app_id_verrou"; then
      echo "DECISION=FAIL"
      echo "MOTIF=identifiant dapplication du verrou mal forme (${app_id_verrou}) — on ne declare pas une attente sur une identite quon ne sait pas comparer, et on ne se tait pas non plus"
      return 5
    fi

    # RA-AGT-006 — la portee du droit dacces exclusif est lapplication. Un verrou
    # tenu ailleurs ne nous retarde pas : le declarer serait une information
    # fausse, et elle voyagerait jusquau client.
    if ! ats_meme_application "$app_id" "$app_id_verrou"; then
      printf '%s' "$avertissements"
      echo "DECISION=RIEN"
      echo "MOTIF=le verrou porte sur lapplication ${app_id_verrou}, pas sur ${app_id} — aucune attente a declarer (RA-AGT-006)"
      return 3
    fi

    local occupant
    if [ -n "$detenteur" ] && [ -n "$depuis" ]; then
      occupant="occupee par la livraison #${detenteur} depuis ${depuis}"
    elif [ -n "$detenteur" ]; then
      occupant="occupee par la livraison #${detenteur}"
    elif [ -n "$depuis" ]; then
      # « Depuis quand » est la seule question que le client posera : on ne la
      # jette pas parce quon ignore QUI occupe.
      occupant="occupee depuis ${depuis} par une autre livraison"
    else
      occupant="occupee par une autre livraison"
    fi

    message="${chantier} : le travail est termine et pousse. Il attend son tour pour la mise en ligne de ${application}, ${occupant}. A dire au client comme une attente, jamais comme un travail qui avance. Je te previens des que le tour vient."
  else
    # On nannonce pas la fin de ce quon na jamais annonce : le canal du
    # representant ne porte que ce qui marque un jalon (RA-REL-008).
    local declaree
    declaree="$(ats_normaliser "${ATS_ATTENTE_DECLAREE:-non}")"
    # Borne avant repli : on compare a « oui », pas a un roman.
    [ "${#declaree}" -gt 8 ] && declaree="${declaree:0:8}"
    if [ "$(ats_minuscules "$declaree")" != "oui" ]; then
      printf '%s' "$avertissements"
      echo "DECISION=RIEN"
      echo "MOTIF=aucune attente navait ete declaree pour ${chantier} — il ny a pas de fin dattente a annoncer"
      return 3
    fi

    message="${chantier} : le tour est venu. La mise en ligne de ${application} est engagee maintenant — ce qui attendait vient de partir. Tu peux le dire au client."
  fi

  # Pas de seconde normalisation du message composé : TOUTES les données qui y
  # entrent sont normalisées à leur arrivée, et le gabarit est littéral. Un
  # second passage serait du code quaucune entrée ne peut exercer — donc du code
  # non testé qui a lair dun garde-fou. Ce qui tient réellement la garantie, ce
  # sont les assertions de transport sur les DEUX messages, côté test.

  printf '%s' "$avertissements"
  echo "DECISION=DIRE"
  echo "MESSAGE=${message}"
  echo "COMMANDE=herdr agent prompt '${representant}' '${message}'"
  return 0
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  ats_resoudre "${1:-}"
fi
