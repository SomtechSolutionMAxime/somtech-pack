#!/usr/bin/env bash
# ============================================================
# test-attente-au-sas.sh — v1.0.0
# L'attente au sas se dit — de l'orchestrateur au représentant du client.
# Epic E-20260806-0005 · stories T-20260806-0148 / -0149 / -0150.
#
# Ce que ce test protège (BRD Somtech Pack v0.7.0, domaine AGT) :
#   EF-AGT-003  Un chantier mené pour le compte du représentant d'un client dit
#               à ce représentant, et à lui seul, que sa mise en ligne attend son
#               tour — et lui dit aussi quand le tour vient.
#   RA-AGT-006  Une attente ne se déclare qu'entre chantiers d'une MÊME application.
#   RA-AGT-007  Une attente qui n'est pas dite est un défaut, porté par le chemin
#               qui découvre le sas occupé — jamais par la vigilance de qui attend.
#   EF-REL-011  (non-régression) Le représentant dispose déjà de quoi le dire au
#               client sans inventer.
#   HS-REL-005  Aucun mécanisme de file n'est construit.
#
# Discriminant — ce test aurait attrapé quoi ?
#   • Un orchestrateur qui découvre le sas occupé et n'en dit rien (le défaut
#     d'origine : le représentant annonce « c'est en cours » alors que ça attend).
#   • Une attente empruntée à une AUTRE application, donc fausse, relayée au client.
#   • Une entrée en attente annoncée dont la fin ne l'est jamais.
#   • Un message contenant une apostrophe ou un retour à la ligne : le transport
#     entre agents le coupe en deux, et la remise échoue en silence (RA-REL-005).
#   • Le silence comme mode de repli quand une donnée manque (fail-closed exigé).
#
# Usage : bash scripts/tests/test-attente-au-sas.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
HELPER="${ROOT}/.claude/skills/orchestrer-chantier/lib/attente-au-sas.sh"
SKILL_ORCH="${ROOT}/.claude/skills/orchestrer-chantier/SKILL.md"
SKILL_GEST="${ROOT}/.claude/skills/gestionnaire-client/SKILL.md"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
trap 'rm -f "$PASS_FILE" "$FAIL_FILE"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

# Lance le helper dans un environnement propre. Usage : run <moment> [VAR=val ...]
# Renseigne les globales RC et OUT.
run() {
  local moment="$1"; shift
  # `env -i` retire la locale : c'est la condition réelle d'un pane dépouillé et
  # de la chaîne d'intégration, et c'est là qu'un outil externe manipulant des
  # caractères accentués lâche. Toute plainte d'outil, où qu'elle survienne, est
  # un échec : elle signifie que la normalisation n'a pas eu lieu et qu'un message
  # est parti mutilé — ou pas parti du tout, en silence.
  OUT="$(env -i PATH="$PATH" HOME="$HOME" "$@" bash "$HELPER" "$moment" 2>&1)"
  RC=$?
  case "$OUT" in
    *"illegal byte sequence"*|*"sed:"*|*"tr:"*|*"command not found"*)
      ko "le helper fait échouer un outil en environnement sans locale ($moment) : $(printf '%s' "$OUT" | head -1)" ;;
  esac
}

champ() { printf '%s\n' "$OUT" | sed -n "s/^$1=//p"; }

echo "== L'attente au sas se dit (E-20260806-0005) =="

if [ ! -f "$HELPER" ]; then
  ko "helper introuvable : $HELPER"
else

  # ---------------------------------------------------------------
  # 1. Entrée en attente, avec représentant, même application → ON PARLE
  #    (T-20260806-0148 · EF-AGT-003)
  # ---------------------------------------------------------------
  run attente \
    ATS_REPRESENTANT=acme-inc \
    ATS_CHANTIER=D-20260806-0042 \
    ATS_APPLICATION=acme-portail \
    ATS_APPLICATION_VERROU=acme-portail \
    ATS_DETENTEUR_PR=412 \
    ATS_DEPUIS=2026-08-06T11:20:00Z

  [ "$RC" = "0" ] && [ "$(champ DECISION)" = "DIRE" ] \
    && ok "sas occupé + représentant → DIRE (rc 0)" \
    || ko "sas occupé + représentant → attendu DIRE/rc 0, obtenu '$(champ DECISION)'/rc $RC"

  MSG="$(champ MESSAGE)"
  case "$MSG" in *"attend son tour"*) ok "le message nomme l'attente pour ce qu'elle est" ;;
    *) ko "le message ne nomme pas l'attente (« attend son tour » absent) : $MSG" ;; esac
  case "$MSG" in *"D-20260806-0042"*) ok "le message nomme le chantier" ;;
    *) ko "le message ne nomme pas le chantier" ;; esac
  case "$MSG" in *"acme-portail"*) ok "le message nomme l'application concernée" ;;
    *) ko "le message ne nomme pas l'application" ;; esac
  case "$MSG" in *412*) ok "le message nomme la livraison qui occupe le sas" ;;
    *) ko "le message ne nomme pas la livraison qui occupe" ;; esac

  # Le défaut d'origine : présenter une attente comme un travail qui avance.
  case "$MSG" in *"en cours"*) ko "le message présente l'attente comme un travail en cours" ;;
    *) ok "le message ne présente jamais l'attente comme un travail en cours" ;; esac

  # Le représentant doit pouvoir le relayer, pas l'orchestrateur : la commande
  # émise vise le représentant, et personne d'autre.
  CMD="$(champ COMMANDE)"
  case "$CMD" in *"acme-inc"*) ok "la commande vise le représentant du client" ;;
    *) ko "la commande ne vise pas le représentant : $CMD" ;; esac

  # ---------------------------------------------------------------
  # 2. Aucun représentant → COMPORTEMENT INCHANGÉ (T-20260806-0148)
  # ---------------------------------------------------------------
  run attente \
    ATS_CHANTIER=D-20260806-0042 \
    ATS_APPLICATION=acme-portail \
    ATS_APPLICATION_VERROU=acme-portail \
    ATS_DETENTEUR_PR=412

  [ "$RC" = "3" ] && [ "$(champ DECISION)" = "RIEN" ] \
    && ok "chantier sans représentant → RIEN (rc 3), comportement inchangé" \
    || ko "chantier sans représentant → attendu RIEN/rc 3, obtenu '$(champ DECISION)'/rc $RC"
  [ -z "$(champ MESSAGE)" ] \
    && ok "chantier sans représentant → aucun message produit" \
    || ko "chantier sans représentant → un message a été produit malgré tout"

  # ---------------------------------------------------------------
  # 3. Verrou tenu sur une AUTRE application → AUCUNE ATTENTE (RA-AGT-006)
  #    (T-20260806-0148)
  # ---------------------------------------------------------------
  run attente \
    ATS_REPRESENTANT=acme-inc \
    ATS_CHANTIER=D-20260806-0042 \
    ATS_APPLICATION=acme-portail \
    ATS_APPLICATION_VERROU=beta-portail \
    ATS_DETENTEUR_PR=999

  [ "$RC" = "3" ] && [ "$(champ DECISION)" = "RIEN" ] \
    && ok "verrou sur une autre application → RIEN (RA-AGT-006)" \
    || ko "verrou sur une autre application → attendu RIEN/rc 3, obtenu '$(champ DECISION)'/rc $RC"
  case "$(champ MOTIF)" in *[Aa]pplication*) ok "le motif dit que la portée est l'application" ;;
    *) ko "le motif n'explique pas la portée par application : $(champ MOTIF)" ;; esac

  # 3-bis. La comparaison d'applications est insensible à la casse : le nom vient
  # de deux sources différentes (brief vs registre), et une casse divergente
  # ferait déclarer une fausse attente.
  run attente \
    ATS_REPRESENTANT=acme-inc \
    ATS_CHANTIER=D-20260806-0042 \
    ATS_APPLICATION=Acme-Portail \
    ATS_APPLICATION_VERROU=acme-portail \
    ATS_DETENTEUR_PR=412
  [ "$(champ DECISION)" = "DIRE" ] \
    && ok "comparaison d'applications insensible à la casse" \
    || ko "comparaison d'applications sensible à la casse → fausse absence d'attente"

  # ---------------------------------------------------------------
  # 4. Le tour venu se dit aussi (T-20260806-0149 · EF-AGT-003)
  # ---------------------------------------------------------------
  run passage \
    ATS_REPRESENTANT=acme-inc \
    ATS_CHANTIER=D-20260806-0042 \
    ATS_APPLICATION=acme-portail \
    ATS_ATTENTE_DECLAREE=oui

  [ "$RC" = "0" ] && [ "$(champ DECISION)" = "DIRE" ] \
    && ok "le tour venu après une attente déclarée → DIRE" \
    || ko "le tour venu → attendu DIRE/rc 0, obtenu '$(champ DECISION)'/rc $RC"
  MSG="$(champ MESSAGE)"
  case "$MSG" in *"le tour est venu"*) ok "le message annonce que le tour est venu" ;;
    *) ko "le message n'annonce pas la fin de l'attente : $MSG" ;; esac
  case "$MSG" in *"acme-portail"*) ok "le message de passage nomme l'application" ;;
    *) ko "le message de passage ne nomme pas l'application" ;; esac

  # Le message contient un tiret cadratin. Un outil externe qui manipule des
  # octets sans locale ne se contente pas d'échouer : il MUTILE le caractère et
  # rend une chaîne tronquée, sans rien dire. Ce que le représentant relaierait
  # alors au client serait du charabia — et rien ne l'aurait signalé.
  case "$MSG" in *"vient de partir"*) ok "le message de passage arrive entier" ;;
    *) ko "le message de passage est tronqué : $MSG" ;; esac
  if printf '%s' "$MSG" | LC_ALL=en_US.UTF-8 grep -q '—'; then
    ok "les caractères accentués du message survivent intacts (aucune mutilation)"
  else
    ko "un caractère multi-octets du message a été mutilé — remise illisible"
  fi

  # 4-bis. On n'annonce pas la fin de ce qu'on n'a jamais annoncé.
  run passage \
    ATS_REPRESENTANT=acme-inc \
    ATS_CHANTIER=D-20260806-0042 \
    ATS_APPLICATION=acme-portail \
    ATS_ATTENTE_DECLAREE=non
  [ "$RC" = "3" ] && [ "$(champ DECISION)" = "RIEN" ] \
    && ok "passage sans attente déclarée → RIEN (le canal reste silencieux)" \
    || ko "passage sans attente déclarée → attendu RIEN/rc 3, obtenu '$(champ DECISION)'/rc $RC"

  # ---------------------------------------------------------------
  # 5. Le transport ne casse pas (T-20260806-0149 · RA-REL-005)
  #    Le message voyage dans un prompt entre apostrophes simples : une apostrophe
  #    ou un retour à la ligne dans une donnée coupe la remise, en silence.
  # ---------------------------------------------------------------
  run attente \
    ATS_REPRESENTANT=acme-inc \
    ATS_CHANTIER=D-20260806-0042 \
    "ATS_APPLICATION=portail de l'Atelier" \
    "ATS_APPLICATION_VERROU=portail de l'Atelier" \
    ATS_DETENTEUR_PR=412

  MSG="$(champ MESSAGE)"; CMD="$(champ COMMANDE)"
  [ "$(champ DECISION)" = "DIRE" ] \
    && ok "une apostrophe dans le nom de l'application n'empêche pas de parler" \
    || ko "une apostrophe dans le nom de l'application fait taire l'orchestrateur"
  case "$MSG" in *"'"*|*"’"*) ko "le message contient une apostrophe — la remise sera coupée" ;;
    *) ok "le message ne contient aucune apostrophe" ;; esac
  case "$CMD" in *"'"*) : ;; *) ko "la commande n'est pas quotée comme attendu" ;; esac
  [ "$(printf '%s' "$CMD" | wc -l | tr -d ' ')" = "0" ] \
    && ok "la commande tient sur une seule ligne" \
    || ko "la commande tient sur plusieurs lignes — le prompt serait soumis en deux morceaux"

  # 5-bis. L'apostrophe typographique (’) est celle que produisent les traitements
  # de texte et les copier-coller — c'est donc elle qu'on rencontre en vrai. Le
  # helper tourne ici en environnement dépouillé, sans locale : c'est exactement
  # la condition où une normalisation à base de sed échoue en silence.
  run attente \
    ATS_REPRESENTANT=acme-inc \
    ATS_CHANTIER=D-20260806-0042 \
    "ATS_APPLICATION=portail de l’Atelier" \
    "ATS_APPLICATION_VERROU=portail de l’Atelier" \
    ATS_DETENTEUR_PR=412
  MSG="$(champ MESSAGE)"
  [ "$(champ DECISION)" = "DIRE" ] \
    && ok "apostrophe typographique → on parle quand même" \
    || ko "apostrophe typographique → l'orchestrateur se tait"
  case "$MSG" in *"’"*) ko "le message garde une apostrophe typographique — remise coupée" ;;
    *) ok "l'apostrophe typographique est retirée du message" ;; esac
  # Le piège : une normalisation qui échoue rend une chaîne VIDE, et « pas
  # d'apostrophe » devient vrai pour la pire des raisons. On exige donc que le
  # message porte encore ce qu'il doit porter.
  case "$MSG" in *Atelier*) ok "le message survit entier à la normalisation" ;;
    *) ko "la normalisation a mutilé le message : '$MSG'" ;; esac
  case "$MSG" in *"D-20260806-0042"*) ok "le message normalisé nomme encore le chantier" ;;
    *) ko "le message normalisé a perdu le chantier" ;; esac

  run attente \
    ATS_REPRESENTANT=acme-inc \
    "ATS_CHANTIER=D-20260806-0042
injection" \
    ATS_APPLICATION=acme-portail \
    ATS_APPLICATION_VERROU=acme-portail \
    ATS_DETENTEUR_PR=412
  [ "$(printf '%s' "$(champ MESSAGE)" | wc -l | tr -d ' ')" = "0" ] \
    && ok "un retour à la ligne dans une donnée ne casse pas le message" \
    || ko "un retour à la ligne dans une donnée coupe le message en deux"

  # ---------------------------------------------------------------
  # 6. Le silence n'est jamais le repli (RA-AGT-007) — T-20260806-0150
  # ---------------------------------------------------------------
  # a) Une donnée manquante alors qu'il y a un représentant : on échoue
  #    bruyamment, on ne se tait pas.
  run attente \
    ATS_REPRESENTANT=acme-inc \
    ATS_APPLICATION=acme-portail \
    ATS_APPLICATION_VERROU=acme-portail \
    ATS_DETENTEUR_PR=412
  [ "$RC" = "5" ] && [ "$(champ DECISION)" = "FAIL" ] \
    && ok "chantier inconnu + représentant → FAIL bruyant (rc 5), jamais un silence" \
    || ko "chantier inconnu → attendu FAIL/rc 5, obtenu '$(champ DECISION)'/rc $RC"

  # b) Détenteur inconnu : on parle quand même — l'attente est le fait qui compte,
  #    l'identité de celui qui occupe n'est qu'un détail.
  run attente \
    ATS_REPRESENTANT=acme-inc \
    ATS_CHANTIER=D-20260806-0042 \
    ATS_APPLICATION=acme-portail \
    ATS_APPLICATION_VERROU=acme-portail
  [ "$(champ DECISION)" = "DIRE" ] \
    && ok "détenteur inconnu → on dit quand même l'attente" \
    || ko "détenteur inconnu → l'orchestrateur se tait, alors qu'il attend"
  case "$(champ MESSAGE)" in *"attend son tour"*) ok "détenteur inconnu → l'attente reste nommée" ;;
    *) ko "détenteur inconnu → l'attente n'est plus nommée" ;; esac

  # c) Un moment inconnu ne produit pas un silence non plus.
  run bidule ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 ATS_APPLICATION=a
  [ "$RC" = "5" ] \
    && ok "moment inconnu → FAIL bruyant, jamais un silence" \
    || ko "moment inconnu → rc $RC au lieu de 5"
fi

# ---------------------------------------------------------------
# 7. L'obligation vit dans le chemin d'/orchestrer-chantier (RA-AGT-007)
#    T-20260806-0150 — c'est ce qui rattrape une attente muette.
# ---------------------------------------------------------------
if [ ! -f "$SKILL_ORCH" ]; then
  ko "SKILL.md orchestrer-chantier introuvable"
else
  grep -q 'attente-au-sas.sh' "$SKILL_ORCH" \
    && ok "le chemin d'orchestrer-chantier appelle le helper d'attente" \
    || ko "orchestrer-chantier ne cite pas attente-au-sas.sh — l'attente peut être muette"

  grep -qiE 'sas (est )?occup|mise en ligne .*occup|acquired.*false' "$SKILL_ORCH" \
    && ok "orchestrer-chantier décrit le moment où le sas est trouvé occupé" \
    || ko "orchestrer-chantier ne décrit pas la découverte du sas occupé"

  grep -qiE 'repr[ée]sentant' "$SKILL_ORCH" \
    && ok "orchestrer-chantier nomme le représentant du client comme destinataire" \
    || ko "orchestrer-chantier ne nomme pas le destinataire de l'attente"

  grep -qiE 'attend(re|rait)? (au sas )?(son tour )?sans le dire|attente (muette|non dite)' "$SKILL_ORCH" \
    && ok "orchestrer-chantier porte l'anti-pattern de l'attente muette" \
    || ko "orchestrer-chantier ne nomme pas l'attente muette comme un défaut"

  # HS-REL-005 : aucun mécanisme de file construit. Un sondage périodique du
  # verrou ou un registre d'ordre serait exactement le second mécanisme interdit.
  grep -qiE 'sonda(ge|nt) (p[ée]riodique|du verrou)|boucle d.attente sur le verrou|registre de file|num[ée]ro d.ordre dans la file' "$SKILL_ORCH" \
    && ko "orchestrer-chantier introduit un mécanisme de file (HS-REL-005)" \
    || ok "aucun mécanisme de file introduit (HS-REL-005)"
fi

# ---------------------------------------------------------------
# 8. Non-régression : le relais côté représentant existe toujours (EF-REL-011)
#    T-20260806-0150
# ---------------------------------------------------------------
if [ ! -f "$SKILL_GEST" ]; then
  ko "SKILL.md gestionnaire-client introuvable"
else
  grep -q 'attend son tour' "$SKILL_GEST" \
    && ok "le représentant sait dire au client que ça attend son tour (EF-REL-011)" \
    || ko "le relais vers le client a disparu de gestionnaire-client"

  grep -qi "c.est en cours" "$SKILL_GEST" \
    && ok "le contre-exemple « c'est en cours » reste énoncé côté représentant" \
    || ko "le contre-exemple « c'est en cours » a disparu de gestionnaire-client"
fi

echo
NB_OK="$(wc -l < "$PASS_FILE" | tr -d ' ')"
NB_KO="$(wc -l < "$FAIL_FILE" | tr -d ' ')"
echo "== $NB_OK réussite(s), $NB_KO échec(s) =="
[ "$NB_KO" = "0" ]
