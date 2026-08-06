#!/usr/bin/env bash
# ============================================================
# attente-au-sas.sh — v1.0.0
# Décide si un chantier doit dire qu'il attend son tour pour la mise en ligne,
# et à qui — puis formule ce qui sera dit.
#
# Epic E-20260806-0005. Réalise EF-AGT-003 (BRD Somtech Pack), encadrée par
# RA-AGT-005, RA-AGT-006 et RA-AGT-007.
#
# POURQUOI CE HELPER EXISTE
#   L'orchestrateur est le SEUL à savoir que sa mise en ligne attend son tour.
#   Rien ne le lui demandait, donc son représentant client annonçait « c'est en
#   cours » — ce qui n'était pas vrai, et se découvrait quand le client relance.
#   RA-AGT-007 exige que l'obligation de le dire vive dans le CHEMIN, pas dans la
#   discipline de celui qui attend : c'est ce fichier, et le test qui le mesure.
#
# CE QU'IL NE FAIT PAS
#   • Il ne construit AUCUN mécanisme de file (HS-REL-005). Le droit d'accès
#     exclusif par application existe déjà côté ServiceDesk (`applications`
#     actions `lock_acquire` / `lock_status`) et suffit : on lui ajoute la parole,
#     rien d'autre. Pas de registre, pas de numéro d'ordre, pas de sondage.
#   • Il ne parle jamais au client, ni au dirigeant : il s'adresse au représentant
#     du client, et à lui seul. L'envoi lui-même reste au chemin appelant.
#   • Il n'appelle pas le MCP : comme `staging-lock-acquire.sh`, il fait la part
#     scriptable et testable, et rend une COMMANDE prête à exécuter.
#
# MOMENTS
#   attente   la mise en ligne vient d'être refusée : le tour de quelqu'un d'autre
#   passage   la mise en ligne vient d'être obtenue après une attente déclarée
#
# ENTRÉES (variables d'environnement — ce sont les points d'injection des tests)
#   ATS_REPRESENTANT        nom d'agent (ou pane) du représentant du client.
#                           VIDE = le chantier n'en a pas → comportement inchangé.
#   ATS_CHANTIER            code du chantier (D-…, P-…, J-…). Requis.
#   ATS_APPLICATION         application du chantier. Requise.
#   ATS_APPLICATION_VERROU  application sur laquelle porte le verrou rencontré.
#                           Défaut : ATS_APPLICATION. Comparaison insensible à la
#                           casse (RA-AGT-004) — le nom vient de deux sources.
#   ATS_DETENTEUR_PR        livraison qui occupe la mise en ligne (facultatif).
#   ATS_DEPUIS              depuis quand elle l'occupe (facultatif).
#   ATS_ATTENTE_DECLAREE    oui|non — pour `passage` seulement.
#
# SORTIE (lignes KEY=VALUE sur stdout) et CODE RETOUR
#   DECISION=DIRE  (rc 0) + MESSAGE= + COMMANDE=   → envoyer, puis le dire au registre
#   DECISION=RIEN  (rc 3) + MOTIF=                 → il n'y a rien à dire, et c'est juste
#   DECISION=FAIL  (rc 5) + MOTIF=                 → on ne peut pas formuler honnêtement
#
#   Le rc 5 est délibérément BRUYANT : quand un représentant attend une nouvelle,
#   se taire parce qu'une donnée manque est le défaut même que RA-AGT-007 nomme.
#   Le silence n'est jamais un repli — il n'est légitime que sous DECISION=RIEN.
#
# Sourçable (ats_resoudre) ou exécution directe.
# ============================================================

# Rend une donnée transportable par le prompt inter-agents : celui-ci est passé
# entre apostrophes simples et se soumet au premier retour à la ligne. Une
# apostrophe ou un saut de ligne y coupe le message en deux, et la remise échoue
# sans que personne ne l'apprenne (RA-REL-005).
#
# Écrit en bash pur, sans `sed` ni `tr` : le helper tourne dans des environnements
# dépouillés (pane minimal, chaîne dintégration) où la locale nest pas posée. En
# locale C, `sed` refuse un motif contenant lapostrophe typographique — « illegal
# byte sequence » — et la normalisation lâchait alors en silence, laissant partir
# un message que le transport aurait coupé. Le remplacement par expansion bash
# travaille sur les octets et na pas cette dépendance.
ats_normaliser() {
  local s="$1"
  s="${s//$'\n'/ }"; s="${s//$'\r'/ }"; s="${s//$'\t'/ }"
  s="${s//\'/}"; s="${s//\`/}"; s="${s//’/}"
  while [ "${s}" != "${s//  / }" ]; do s="${s//  / }"; done
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

# Deux noms d'application désignent-ils la même ? Insensible à la casse : le nom
# du chantier vient du brief, celui du verrou vient du registre.
ats_meme_application() {
  local a b
  a="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  b="$(printf '%s' "$2" | tr '[:upper:]' '[:lower:]')"
  [ "$a" = "$b" ]
}

ats_resoudre() {
  local moment="${1:-}"
  local representant chantier application application_verrou detenteur depuis message

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

  chantier="$(ats_normaliser "${ATS_CHANTIER:-}")"
  application="$(ats_normaliser "${ATS_APPLICATION:-}")"

  if [ -z "$chantier" ] || [ -z "$application" ]; then
    echo "DECISION=FAIL"
    echo "MOTIF=un representant attend une nouvelle mais le chantier ou son application est inconnu — impossible de formuler sans inventer (RA-AGT-007)"
    return 5
  fi

  application_verrou="$(ats_normaliser "${ATS_APPLICATION_VERROU:-$application}")"
  detenteur="$(ats_normaliser "${ATS_DETENTEUR_PR:-}")"
  depuis="$(ats_normaliser "${ATS_DEPUIS:-}")"

  if [ "$moment" = "attente" ]; then
    # RA-AGT-006 — la portée du droit dacces exclusif est lapplication. Un verrou
    # tenu ailleurs ne nous retarde pas : le declarer serait une information
    # fausse, et elle voyagerait jusquau client.
    if ! ats_meme_application "$application" "$application_verrou"; then
      echo "DECISION=RIEN"
      echo "MOTIF=le verrou porte sur lapplication ${application_verrou}, pas sur ${application} — aucune attente a declarer (RA-AGT-006)"
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
    if [ "$(printf '%s' "${ATS_ATTENTE_DECLAREE:-non}" | tr '[:upper:]' '[:lower:]')" != "oui" ]; then
      echo "DECISION=RIEN"
      echo "MOTIF=aucune attente navait ete declaree pour ${chantier} — il ny a pas de fin dattente a annoncer"
      return 3
    fi

    message="${chantier} : le tour est venu. La mise en ligne de ${application} est engagee maintenant — ce qui attendait vient de partir. Tu peux le dire au client."
  fi

  message="$(ats_normaliser "$message")"

  echo "DECISION=DIRE"
  echo "MESSAGE=${message}"
  echo "COMMANDE=herdr agent prompt ${representant} '${message}'"
  return 0
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  ats_resoudre "${1:-}"
fi
