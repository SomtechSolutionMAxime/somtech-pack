#!/usr/bin/env bash
# ============================================================
# attente-au-sas.sh — v2.0.0
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
#     ServiceDesk et suffit ; on lui ajoute la parole, rien dautre.
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
#   ATS_CHANTIER              code du chantier (D-…, P-…, J-…). Requis.
#   ATS_APPLICATION           nom lisible de lapplication — sert au MESSAGE seul,
#                             jamais à décider. Requis.
#   ATS_APPLICATION_ID        identifiant de lapplication du chantier, tel quil
#                             figure dans `.somtech/app.yaml` (servicedesk.app_id)
#                             — cest CE MÊME identifiant qui prend le verrou.
#                             Requis pour `attente`. Forme : [A-Za-z0-9._-]+.
#   ATS_APPLICATION_ID_VERROU identifiant de lapplication sur laquelle porte le
#                             verrou rencontré. ABSENT = le tien : cest le cas
#                             normal, puisquun refus de `lock_acquire` porte par
#                             construction sur ta propre application. À renseigner
#                             seulement quand tu regardes le verrou dune AUTRE
#                             application (via `lock_status`).
#   ATS_DETENTEUR_PR          livraison qui occupe la mise en ligne (facultatif).
#   ATS_DEPUIS                depuis quand elle loccupe (facultatif).
#   ATS_ATTENTE_DECLAREE      oui|non — pour `passage` seulement.
#
# SORTIE (lignes KEY=VALUE sur stdout) et CODE RETOUR
#   DECISION=DIRE  (rc 0) + MESSAGE= + COMMANDE=   → envoyer, puis le réinscrire
#   DECISION=RIEN  (rc 3) + MOTIF=                 → rien à dire, et cest juste
#   DECISION=FAIL  (rc 5) + MOTIF=                 → impossible de formuler sans
#                                                    inventer → corriger, pas se taire
#
#   Le rc 5 est délibérément BRUYANT. Quand un représentant attend une nouvelle,
#   se taire parce quune donnée manque est le défaut même que RA-AGT-007 nomme :
#   le silence nest jamais un repli, il nest légitime que sous DECISION=RIEN.
#
# Sourçable (ats_resoudre) ou exécution directe.
# ============================================================

# Les intervalles de motifs (`[A-Z]`, `[a-z0-9_-]`) dépendent de lordre de
# collation de la locale. En fr/en UTF-8 sur bash 3.2, `[A-Z]` matche AUSSI les
# minuscules : le repli de casse ci-dessous les décalait alors de 32 et rendait
# des octets invalides — « oui » devenait illisible, et le message de fin
# dattente ne partait jamais. En C, les intervalles sont strictement ASCII et
# les motifs redeviennent ce quils ont lair dêtre.
#
# Cest sans danger ici parce que ce fichier nappelle AUCUN outil externe : les
# expansions de bash travaillent sur les octets, donc les caractères accentués du
# message traversent intacts. Cétait linverse pour `sed`, qui les mutile en C.
export LC_ALL=C

# Rend une donnée transportable par le prompt inter-agents : celui-ci est passé
# entre apostrophes simples et se soumet au premier retour à la ligne. Une
# apostrophe, un saut de ligne ou un retour chariot y coupe le message, et la
# remise échoue sans que personne ne lapprenne (RA-REL-005).
#
# Écrit en bash pur, sans `sed` ni `tr` : le helper tourne dans des environnements
# dépouillés (pane minimal, chaîne dintégration) où la locale nest pas posée. En
# locale C, `sed` ne se contente pas déchouer sur un motif multi-octets — il
# MUTILE les caractères accentués du message et rend une chaîne tronquée, sans
# rien dire. Le découpage en mots ci-dessous travaille sur les octets et na pas
# cette dépendance ; il est aussi linéaire, là où une boucle de repli despaces
# successifs est quadratique sur une entrée longue.
ats_normaliser() {
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

# Un nom dagent tel que herdr limpose : minuscule initiale, puis minuscules,
# chiffres, tiret ou souligné, 1 à 32 caractères. Tout le reste est refusé — ce
# qui met hors de portée `;`, `$(…)`, `&&`, `|`, `\` et les espaces, donc toute
# tentative de faire exécuter autre chose que la remise du message.
ats_nom_dagent_valide() {
  case "$1" in
    ""|*[!a-z0-9_-]*) return 1 ;;
    [a-z]*) [ "${#1}" -le 32 ] ;;
    *) return 1 ;;
  esac
}

# Un identifiant dapplication : UUID ou slug. Volontairement restreint à lASCII
# — un identifiant accentué nen est pas un, et le repli de casse ci-dessous ne
# saurait pas le comparer honnêtement.
ats_identifiant_valide() {
  case "$1" in
    ""|*[!A-Za-z0-9._-]*) return 1 ;;
    *) return 0 ;;
  esac
}

ats_minuscules() {
  local s="$1" out="" i c
  for (( i=0; i<${#s}; i++ )); do
    c="${s:i:1}"
    case "$c" in
      [A-Z]) out+="$(printf "\\$(printf '%03o' "$(( $(printf '%d' "'$c") + 32 ))")")" ;;
      *) out+="$c" ;;
    esac
  done
  printf '%s' "$out"
}

# Deux identifiants désignent-ils la même application ? Égalité STRICTE après
# repli de casse — jamais un préfixe : `acme` et `acme-portail` sont deux
# applications distinctes, et les confondre ferait déclarer au client une attente
# qui nest pas la sienne.
ats_meme_application() {
  [ "$(ats_minuscules "$1")" = "$(ats_minuscules "$2")" ]
}

ats_resoudre() {
  local moment="${1:-}"
  local representant chantier application app_id app_id_verrou detenteur depuis message

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

  if [ -z "$chantier" ] || [ -z "$application" ]; then
    echo "DECISION=FAIL"
    echo "MOTIF=un representant attend une nouvelle mais le chantier ou son application est inconnu — impossible de formuler sans inventer (RA-AGT-007)"
    return 5
  fi

  detenteur="$(ats_normaliser "${ATS_DETENTEUR_PR:-}")"
  depuis="$(ats_normaliser "${ATS_DEPUIS:-}")"

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
      echo "MOTIF=identifiant dapplication du verrou mal forme (${app_id_verrou}) — on ne declare pas une attente sur une identite quon ne sait pas comparer"
      return 5
    fi

    # RA-AGT-006 — la portee du droit dacces exclusif est lapplication. Un verrou
    # tenu ailleurs ne nous retarde pas : le declarer serait une information
    # fausse, et elle voyagerait jusquau client.
    if ! ats_meme_application "$app_id" "$app_id_verrou"; then
      echo "DECISION=RIEN"
      echo "MOTIF=le verrou porte sur lapplication ${app_id_verrou}, pas sur ${app_id} — aucune attente a declarer (RA-AGT-006)"
      return 3
    fi

    local occupant
    if [ -n "$detenteur" ] && [ -n "$depuis" ]; then
      occupant="occupee par la livraison #${detenteur} depuis ${depuis}"
    elif [ -n "$detenteur" ]; then
      occupant="occupee par la livraison #${detenteur}"
    else
      occupant="occupee par une autre livraison"
    fi

    message="${chantier} : le travail est termine et pousse. Il attend son tour pour la mise en ligne de ${application}, ${occupant}. A dire au client comme une attente, jamais comme un travail qui avance. Je te previens des que le tour vient."
  else
    # On nannonce pas la fin de ce quon na jamais annonce : le canal du
    # representant ne porte que ce qui marque un jalon (RA-REL-008).
    if [ "$(ats_minuscules "$(ats_normaliser "${ATS_ATTENTE_DECLAREE:-non}")")" != "oui" ]; then
      echo "DECISION=RIEN"
      echo "MOTIF=aucune attente navait ete declaree pour ${chantier} — il ny a pas de fin dattente a annoncer"
      return 3
    fi

    message="${chantier} : le tour est venu. La mise en ligne de ${application} est engagee maintenant — ce qui attendait vient de partir. Tu peux le dire au client."
  fi

  message="$(ats_normaliser "$message")"

  echo "DECISION=DIRE"
  echo "MESSAGE=${message}"
  echo "COMMANDE=herdr agent prompt '${representant}' '${message}'"
  return 0
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  ats_resoudre "${1:-}"
fi
