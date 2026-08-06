#!/usr/bin/env bash
# ============================================================
# test-attente-au-sas.sh — v3.0.0
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
# HISTORIQUE — deux revues indépendantes, et ce qu'elles ont appris
#   v1 : 7 mutations sur 7 laissaient la suite verte. Les 4 assertions censées
#        prouver « une attente muette est rattrapée » étaient des `grep` sur du
#        Markdown : le reviewer a remplacé la section par un commentaire HTML
#        disant « ne rien faire de spécial », suite verte.
#   v2 : on exécutait le bloc documenté au lieu de le lire — mais on ne vérifiait
#        que ses SORTIES. Le second reviewer a remplacé la section par quatre
#        `echo` imprimant les bonnes chaînes : suite verte. Le théâtre avait
#        simplement monté d'un cran. Il a aussi permuté chantier/application et
#        n°/date dans le message : verte aussi, parce que toutes les assertions
#        cherchaient des sous-chaînes, jamais une PLACE.
#   D'où les trois partis pris de cette version :
#     • le bloc documenté doit PROUVER qu'il appelle le helper (§8, témoin) ;
#     • les deux messages sont comparés en ENTIER, pas par morceaux (§1, §5).
#       La formulation EST le livrable : la changer doit être un acte délibéré ;
#     • le helper est exercé dans deux environnements de locale, qui le cassent
#       de façons opposées et masquent chacun le défaut de l'autre.
#
# Usage : bash scripts/tests/test-attente-au-sas.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REL_HELPER=".claude/skills/orchestrer-chantier/lib/attente-au-sas.sh"
HELPER="${ROOT}/${REL_HELPER}"
SKILL_ORCH="${ROOT}/.claude/skills/orchestrer-chantier/SKILL.md"
SKILL_GEST="${ROOT}/.claude/skills/gestionnaire-client/SKILL.md"

APP_ID="2098c2fd-5448-46a3-bd98-83778e7a064d"
AUTRE_APP_ID="7f3d1c90-1111-2222-3333-444455556666"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
TMPDIR_T="$(mktemp -d)"
trap 'rm -rf "$PASS_FILE" "$FAIL_FILE" "$TMPDIR_T"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

# `env -i` retire la locale : condition réelle d'un pane dépouillé et de la
# chaîne d'intégration. C'est là qu'un outil externe manipulant des caractères
# accentués lâche — parfois en échouant, souvent en mutilant sans rien dire.
run() {
  local moment="$1"; shift
  OUT="$(env -i PATH="$PATH" HOME="$HOME" "$@" bash "$HELPER" "$moment" 2>&1)"
  RC=$?
  case "$OUT" in
    *"illegal byte sequence"*|*"sed:"*|*"tr:"*|*"command not found"*|*"syntax error"*)
      ko "outil en échec en environnement sans locale ($moment) : $(printf '%s' "$OUT" | head -1)" ;;
  esac
}

# La même chose en locale RICHE. Ce n'est pas une redite : les intervalles de
# motifs (`[A-Z]`) matchent aussi les minuscules sur bash 3.2 en UTF-8 — défaut
# réel, qui empêchait le message de fin d'attente de partir, et que `env -i`
# masquait complètement.
run_locale() {
  local moment="$1"; shift
  local loc="fr_CA.UTF-8"
  locale -a 2>/dev/null | grep -qi '^fr_CA.UTF-8$' || loc="en_US.UTF-8"
  OUT="$(env -i PATH="$PATH" HOME="$HOME" LANG="$loc" LC_ALL="$loc" "$@" bash "$HELPER" "$moment" 2>&1)"
  RC=$?
}

champ() { printf '%s\n' "$OUT" | sed -n "s/^$1=//p"; }

echo "== L'attente au sas se dit (E-20260806-0005) =="

if [ ! -f "$HELPER" ]; then
  ko "helper introuvable : $HELPER"
else

# =================================================================
# 1. Entrée en attente : le message est comparé EN ENTIER.
#    Le second reviewer a permuté chantier/application, puis n°/date : la suite
#    restait verte parce qu'elle ne cherchait que des sous-chaînes. Le client
#    aurait reçu « Portail Acme attend son tour pour la mise en ligne de D-42 ».
#    T-20260806-0148 / -0149 · EF-AGT-003
# =================================================================
ATTENDU_ATTENTE="D-20260806-0042 : le travail est termine et pousse. Il attend son tour pour la mise en ligne de Portail Acme, occupee par la livraison #412 depuis 2026-08-06T11:20:00Z. A dire au client comme une attente, jamais comme un travail qui avance. Je te previens des que le tour vient."

run attente \
  ATS_REPRESENTANT=acme-inc \
  ATS_CHANTIER=D-20260806-0042 \
  "ATS_APPLICATION=Portail Acme" \
  ATS_APPLICATION_ID="$APP_ID" \
  ATS_DETENTEUR_PR=412 \
  ATS_DEPUIS=2026-08-06T11:20:00Z

[ "$RC" = "0" ] && [ "$(champ DECISION)" = "DIRE" ] \
  && ok "sas occupé + représentant → DIRE (rc 0)" \
  || ko "sas occupé + représentant → attendu DIRE/rc 0, obtenu '$(champ DECISION)'/rc $RC"

MSG="$(champ MESSAGE)"
[ "$MSG" = "$ATTENDU_ATTENTE" ] \
  && ok "le message d'attente est exactement celui attendu, mot pour mot et place pour place" \
  || ko "le message d'attente a dérivé.
     attendu : $ATTENDU_ATTENTE
     obtenu  : $MSG"

# Les assertions ci-dessous sont redondantes avec l'égalité — elles restent
# parce qu'elles DISENT ce que chaque morceau garantit, et pointent le bon
# coupable quand l'égalité tombe.
case "$MSG" in *"attend son tour"*) ok "le message nomme l'attente pour ce qu'elle est" ;;
  *) ko "le message ne nomme pas l'attente" ;; esac
case "$MSG" in *"jamais comme un travail qui avance"*) ok "le message interdit de le présenter comme un travail qui avance (garantie n°1)" ;;
  *) ko "la consigne qui porte la garantie n°1 a disparu du message" ;; esac
case "$MSG" in *"en cours"*) ko "le message présente l'attente comme un travail en cours" ;;
  *) ok "le message ne présente jamais l'attente comme un travail en cours" ;; esac
case "$MSG" in *"  "*) ko "double espace dans le message — la normalisation finale a sauté" ;;
  *) ok "le message est proprement normalisé (aucune double espace)" ;; esac

CMD="$(champ COMMANDE)"
[ "$CMD" = "herdr agent prompt 'acme-inc' '${ATTENDU_ATTENTE}'" ] \
  && ok "la commande rendue vise le représentant et quote ses deux arguments" \
  || ko "la commande rendue n'est pas celle attendue : $CMD"

# =================================================================
# 2. Le nom du représentant obéit à la FORME imposée par herdr, ou il est refusé.
#    Une liste d'exemples hostiles ne prouve que ce que son auteur a imaginé :
#    la version précédente n'essayait qu'un nom à majuscule INITIALE, si bien
#    qu'élargir la forme à `[A-Za-z]` laissait la suite verte — et `acme-Inc`
#    serait parti dans la commande. Ce qu'on mesure ici, c'est la forme
#    elle-même — ^[a-z][a-z0-9_-]{0,31}$ — règle par règle, chacune avec son
#    contre-exemple et son verdict attendu.
#    L'enjeu n'est pas que l'injection : `herdr agent prompt` ne trouve pas un
#    agent au nom mal formé, et l'attente n'est alors jamais dite — le défaut
#    même que RA-AGT-007 nomme.
# =================================================================
NOM_32="$(printf 'a%.0s' $(seq 1 32))"
NOM_33="$(printf 'a%.0s' $(seq 1 33))"
for CAS in \
    "acme-inc:DIRE" "a:DIRE" "a1:DIRE" "acme_inc-2:DIRE" "${NOM_32}:DIRE" \
    "${NOM_33}:FAIL" "acme-Inc:FAIL" "acmeInc:FAIL" "Acme-inc:FAIL" \
    "2acme:FAIL" "-acme:FAIL" "_acme:FAIL" "acme.inc:FAIL" "acme inc:FAIL" \
    "acmé-inc:FAIL" "acme/inc:FAIL" "acme-inc; touch PWNED:FAIL" \
    "acme\$(touch PWNED):FAIL" "acme && touch PWNED:FAIL" "acme|touch PWNED:FAIL"; do
  NOM="${CAS%:*}"; ATTENDU="${CAS##*:}"
  run attente \
    ATS_REPRESENTANT="$NOM" \
    ATS_CHANTIER=D-20260806-0042 \
    "ATS_APPLICATION=Portail Acme" \
    ATS_APPLICATION_ID="$APP_ID"
  if [ "$ATTENDU" = "FAIL" ]; then
    if [ "$RC" = "5" ] && [ "$(champ DECISION)" = "FAIL" ] && [ -z "$(champ COMMANDE)" ]; then
      :
    else
      ko "nom hors de la forme herdr accepté : '$NOM' → '$(champ DECISION)'/rc $RC ; COMMANDE='$(champ COMMANDE)'"
      FORME_KO=1
    fi
  else
    if [ "$RC" = "0" ] && [ "$(champ DECISION)" = "DIRE" ] \
       && [ "$(champ COMMANDE)" = "herdr agent prompt '${NOM}' '$(champ MESSAGE)'" ]; then
      :
    else
      ko "nom conforme à la forme herdr refusé ou mal adressé : '$NOM' → '$(champ DECISION)'/rc $RC ; COMMANDE='$(champ COMMANDE)'"
      FORME_KO=1
    fi
  fi
done
[ "${FORME_KO:-0}" = "0" ] \
  && ok "le nom du représentant suit la forme imposée par herdr, règle par règle — conforme accepté et adressé, hors forme refusé (rc 5) sans commande" || true

# Preuve par l'exécution : la ligne rendue ne fait rien d'autre que la remise,
# même quand les données sont hostiles. (garde-fou vérifié authentique en revue :
# rendre la COMMANDE réellement injectable fait rougir cette assertion)
run attente \
  ATS_REPRESENTANT=acme-inc \
  'ATS_CHANTIER=D-42; touch PWNED_CHANTIER' \
  'ATS_APPLICATION=Portail $(touch PWNED_APP) `touch PWNED_APP2`' \
  ATS_APPLICATION_ID="$APP_ID"
CMD="$(champ COMMANDE)"
(
  cd "$TMPDIR_T" || exit 1
  herdr() { :; }
  eval "$CMD" >/dev/null 2>&1
)
if [ -z "$(find "$TMPDIR_T" -name 'PWNED*' 2>/dev/null)" ]; then
  ok "exécuter la COMMANDE rendue ne produit aucun effet de bord, même sur données hostiles"
else
  ko "la COMMANDE rendue a exécuté autre chose que la remise : $(find "$TMPDIR_T" -name 'PWNED*')"
fi

# =================================================================
# 3. Aucun représentant → COMPORTEMENT INCHANGÉ
# =================================================================
run attente \
  ATS_CHANTIER=D-20260806-0042 \
  "ATS_APPLICATION=Portail Acme" \
  ATS_APPLICATION_ID="$APP_ID" \
  ATS_DETENTEUR_PR=412
[ "$RC" = "3" ] && [ "$(champ DECISION)" = "RIEN" ] && [ -z "$(champ MESSAGE)" ] \
  && ok "chantier sans représentant → RIEN (rc 3), aucun message, comportement inchangé" \
  || ko "chantier sans représentant → attendu RIEN/rc 3 sans message, obtenu '$(champ DECISION)'/rc $RC"

# =================================================================
# 4. La portée est l'application — décidée sur un IDENTIFIANT, jamais sur un
#    nom lisible. RA-AGT-006
# =================================================================
run attente \
  ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-20260806-0042 \
  "ATS_APPLICATION=Portail Acme" ATS_APPLICATION_ID="$APP_ID" \
  ATS_APPLICATION_ID_VERROU="$AUTRE_APP_ID" ATS_DETENTEUR_PR=999
[ "$RC" = "3" ] && [ "$(champ DECISION)" = "RIEN" ] \
  && ok "verrou sur une autre application → RIEN (RA-AGT-006)" \
  || ko "verrou sur une autre application → attendu RIEN/rc 3, obtenu '$(champ DECISION)'/rc $RC"
case "$(champ MOTIF)" in *[Aa]pplication*) ok "le motif dit que la portée est l'application" ;;
  *) ko "le motif n'explique pas la portée : $(champ MOTIF)" ;; esac

# Égalité STRICTE, jamais un préfixe.
for PAIRE in "acme:acme-portail" "acme-portail:acme" "acme:acmeportail"; do
  A="${PAIRE%%:*}"; B="${PAIRE##*:}"
  run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" \
    ATS_APPLICATION_ID="$A" ATS_APPLICATION_ID_VERROU="$B"
  [ "$(champ DECISION)" = "RIEN" ] || { ko "identifiants voisins confondus : '$A' vs '$B' → $(champ DECISION)"; PREFIXE_KO=1; }
done
[ "${PREFIXE_KO:-0}" = "0" ] \
  && ok "deux identifiants voisins ne sont jamais confondus (égalité stricte, pas un préfixe)" || true

run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" \
  ATS_APPLICATION_ID="2098C2FD-5448-46A3-BD98-83778E7A064D" ATS_APPLICATION_ID_VERROU="$APP_ID"
[ "$(champ DECISION)" = "DIRE" ] \
  && ok "comparaison d'identifiants insensible à la casse" \
  || ko "comparaison sensible à la casse → fausse absence d'attente"

run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" ATS_APPLICATION_ID="$APP_ID"
D1="$(champ DECISION)"
run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" \
  ATS_APPLICATION_ID="$APP_ID" ATS_APPLICATION_ID_VERROU="   "
D2="$(champ DECISION)"
[ "$D1" = "DIRE" ] && [ "$D2" = "DIRE" ] \
  && ok "identifiant du verrou absent ou blanc → même verdict, aucune asymétrie" \
  || ko "asymétrie absent/blanc sur l'identifiant du verrou : '$D1' vs '$D2'"

run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 \
  "ATS_APPLICATION=Portail Élève" ATS_APPLICATION_ID="$APP_ID"
[ "$(champ DECISION)" = "DIRE" ] \
  && ok "un nom d'application accentué ne fait pas taire l'orchestrateur" \
  || ko "un nom accentué fait taire l'orchestrateur — le silence exact qu'on interdit"

# Un identifiant mal formé, du chantier OU du verrou : FAIL bruyant. Basculer
# l'un des deux en RIEN (silence) est l'inversion exacte que RA-AGT-007 interdit.
for MAUVAIS in "Portail Élève" "app;rm" "app/../x"; do
  run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" \
    ATS_APPLICATION_ID="$MAUVAIS"
  [ "$RC" = "5" ] || { ko "identifiant de chantier mal formé accepté : '$MAUVAIS' → rc $RC"; ID_KO=1; }
  run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" \
    ATS_APPLICATION_ID="$APP_ID" ATS_APPLICATION_ID_VERROU="$MAUVAIS"
  [ "$RC" = "5" ] || { ko "identifiant de VERROU mal formé accepté : '$MAUVAIS' → rc $RC ($(champ DECISION))"; ID_KO=1; }
done
[ "${ID_KO:-0}" = "0" ] && ok "un identifiant d'application mal formé échoue bruyamment (rc 5), des deux côtés" || true

# =================================================================
# 5. Le tour venu se dit aussi — message comparé EN ENTIER lui aussi.
# =================================================================
ATTENDU_PASSAGE="D-20260806-0042 : le tour est venu. La mise en ligne de Portail Acme est engagee maintenant — ce qui attendait vient de partir. Tu peux le dire au client."

run passage \
  ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-20260806-0042 \
  "ATS_APPLICATION=Portail Acme" ATS_ATTENTE_DECLAREE=oui
[ "$RC" = "0" ] && [ "$(champ DECISION)" = "DIRE" ] \
  && ok "le tour venu après une attente déclarée → DIRE" \
  || ko "le tour venu → attendu DIRE/rc 0, obtenu '$(champ DECISION)'/rc $RC"
MSG="$(champ MESSAGE)"
[ "$MSG" = "$ATTENDU_PASSAGE" ] \
  && ok "le message de fin d'attente est exactement celui attendu" \
  || ko "le message de fin d'attente a dérivé.
     attendu : $ATTENDU_PASSAGE
     obtenu  : $MSG"
if printf '%s' "$MSG" | LC_ALL=en_US.UTF-8 grep -q '—'; then
  ok "les caractères multi-octets du message survivent intacts"
else
  ko "un caractère multi-octets a été mutilé — le représentant relaierait du charabia"
fi

for OUI in "oui" " oui " "OUI" "Oui"; do
  run passage ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" \
    ATS_ATTENTE_DECLAREE="$OUI"
  [ "$(champ DECISION)" = "DIRE" ] || { ko "attente déclarée non reconnue : '$OUI'"; OUI_KO=1; }
done
[ "${OUI_KO:-0}" = "0" ] \
  && ok "l'attente déclarée est reconnue quels que soient la casse et les espaces" || true

run passage ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" ATS_ATTENTE_DECLAREE=non
[ "$RC" = "3" ] && [ "$(champ DECISION)" = "RIEN" ] \
  && ok "passage sans attente déclarée → RIEN (le canal reste silencieux)" \
  || ko "passage sans attente déclarée → attendu RIEN/rc 3, obtenu '$(champ DECISION)'/rc $RC"

# Les DEUX moments exigent de quoi nommer le chantier. Sans ça le helper rendait
# « : le tour est venu. La mise en ligne de est engagee maintenant… » — un
# message qui ne nomme rien, envoyé au représentant.
run passage ATS_REPRESENTANT=acme-inc "ATS_APPLICATION=X" ATS_ATTENTE_DECLAREE=oui
[ "$RC" = "5" ] || { ko "passage sans chantier → rc $RC au lieu de 5 : '$(champ MESSAGE)'"; PASS_KO=1; }
run passage ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 ATS_ATTENTE_DECLAREE=oui
[ "$RC" = "5" ] || { ko "passage sans application → rc $RC au lieu de 5 : '$(champ MESSAGE)'"; PASS_KO=1; }
[ "${PASS_KO:-0}" = "0" ] \
  && ok "le message de fin d'attente exige lui aussi de quoi nommer le chantier et l'application" || true

# =================================================================
# 5-bis. LES MÊMES GARANTIES EN LOCALE RICHE.
# =================================================================
for OUI in "oui" "OUI" " oui "; do
  run_locale passage ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" \
    ATS_ATTENTE_DECLAREE="$OUI"
  [ "$(champ DECISION)" = "DIRE" ] || { ko "en locale riche, attente déclarée non reconnue : '$OUI' → $(champ MOTIF)"; LOC_KO=1; }
done
run_locale passage ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" ATS_ATTENTE_DECLAREE=non
[ "$(champ DECISION)" = "RIEN" ] || { ko "en locale riche, « non » est pris pour « oui »"; LOC_KO=1; }
run_locale attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-20260806-0042 \
  "ATS_APPLICATION=Portail Élève" ATS_APPLICATION_ID="$APP_ID" ATS_DETENTEUR_PR=412
[ "$(champ DECISION)" = "DIRE" ] || { ko "en locale riche, l'entrée en attente ne se dit pas"; LOC_KO=1; }
case "$(champ MESSAGE)" in *"Portail Élève"*) : ;;
  *) ko "en locale riche, le nom accentué est mutilé : $(champ MESSAGE)"; LOC_KO=1 ;; esac
run_locale attente ATS_REPRESENTANT='acme-inc; touch PWNED' ATS_CHANTIER=D-1 \
  "ATS_APPLICATION=X" ATS_APPLICATION_ID="$APP_ID"
[ "$RC" = "5" ] || { ko "en locale riche, un nom de représentant hostile passe (rc $RC)"; LOC_KO=1; }
[ "${LOC_KO:-0}" = "0" ] \
  && ok "les mêmes garanties tiennent en locale riche (casse, accents, refus d'un nom hostile)" || true

# Sourcer le helper ne doit RIEN changer chez l'appelant : le fichier se déclare
# sourçable, et imposer sa locale infligerait à son hôte la mutilation des
# accents que son propre en-tête décrit comme le défaut à éviter.
LOC_APRES="$(bash -c 'export LC_ALL=en_US.UTF-8; . "$1" >/dev/null 2>&1; printf "%s" "$LC_ALL"' _ "$HELPER" 2>/dev/null)"
[ "$LOC_APRES" = "en_US.UTF-8" ] \
  && ok "sourcer le helper ne modifie pas la locale de l'appelant" \
  || ko "sourcer le helper impose sa locale à l'appelant (obtenu '$LOC_APRES')"

# =================================================================
# 6. Le transport ne casse pas (RA-REL-005)
# =================================================================
run attente \
  ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-20260806-0042 \
  "ATS_APPLICATION=portail de l'Atelier ’ \` fin" \
  ATS_APPLICATION_ID="$APP_ID" ATS_DETENTEUR_PR=412
MSG="$(champ MESSAGE)"; CMD="$(champ COMMANDE)"
[ "$(champ DECISION)" = "DIRE" ] \
  && ok "les caractères de transport dans une donnée n'empêchent pas de parler" \
  || ko "des caractères de transport font taire l'orchestrateur"
case "$MSG" in *"'"*) ko "apostrophe simple laissée — remise coupée" ;; *) ok "apostrophe simple retirée" ;; esac
case "$MSG" in *"’"*) ko "apostrophe typographique laissée — remise coupée" ;; *) ok "apostrophe typographique retirée" ;; esac
case "$MSG" in *'`'*) ko "accent grave laissé dans le message" ;; *) ok "accent grave retiré" ;; esac
case "$MSG" in *Atelier*) ok "le message survit entier à la normalisation" ;;
  *) ko "la normalisation a mutilé le message : '$MSG'" ;; esac
[ "$(printf '%s' "$CMD" | wc -l | tr -d ' ')" = "0" ] \
  && ok "la commande tient sur une seule ligne" \
  || ko "la commande tient sur plusieurs lignes — le prompt serait soumis en deux morceaux"

run attente ATS_REPRESENTANT=acme-inc \
  "ATS_CHANTIER=$(printf 'D-42\r\nsuite')" "ATS_APPLICATION=X" ATS_APPLICATION_ID="$APP_ID"
MSG="$(champ MESSAGE)"
case "$MSG" in *$'\r'*) ko "un retour chariot traverse le message — remise coupée" ;;
  *) ok "le retour chariot est neutralisé" ;; esac
case "$MSG" in *$'\n'*) ko "un saut de ligne traverse le message" ;;
  *) ok "le saut de ligne est neutralisé" ;; esac

# La MÊME exigence sur le message de fin d'attente. Le helper ne repasse
# volontairement aucune normalisation sur le message composé — ce serait du code
# qu'aucune entrée ne peut exercer. Ce sont donc ces assertions-ci qui tiennent
# la garantie de transport, et elles doivent couvrir les DEUX moments.
run passage ATS_REPRESENTANT=acme-inc \
  "ATS_CHANTIER=$(printf 'D-42\r\nsuite')" \
  "ATS_APPLICATION=portail de l'Atelier ’ \` fin" ATS_ATTENTE_DECLAREE=oui
MSG="$(champ MESSAGE)"; CMD="$(champ COMMANDE)"
[ "$(champ DECISION)" = "DIRE" ] \
  && ok "le message de fin d'attente part malgré des données hostiles" \
  || ko "des caractères de transport font taire la fin d'attente"
TRANSPORT_KO=0
case "$MSG" in *"'"*|*"’"*|*'`'*|*$'\r'*|*$'\n'*|*"  "*) TRANSPORT_KO=1 ;; esac
[ "$TRANSPORT_KO" = "0" ] \
  && ok "le message de fin d'attente ne porte aucun caractère qui casse la remise" \
  || ko "le message de fin d'attente porte un caractère de transport : '$MSG'"
[ "$(printf '%s' "$CMD" | wc -l | tr -d ' ')" = "0" ] \
  && ok "la commande de fin d'attente tient sur une seule ligne" \
  || ko "la commande de fin d'attente tient sur plusieurs lignes"

# =================================================================
# 7. Le silence n'est jamais le repli (RA-AGT-007) — et une donnée jetée se dit.
# =================================================================
run attente ATS_REPRESENTANT=acme-inc "ATS_APPLICATION=X" ATS_APPLICATION_ID="$APP_ID"
[ "$RC" = "5" ] && [ "$(champ DECISION)" = "FAIL" ] \
  && ok "chantier inconnu + représentant → FAIL bruyant (rc 5), jamais un silence" \
  || ko "chantier inconnu → attendu FAIL/rc 5, obtenu '$(champ DECISION)'/rc $RC"

run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 ATS_APPLICATION_ID="$APP_ID"
[ "$RC" = "5" ] && ok "application inconnue + représentant → FAIL bruyant" \
  || ko "application inconnue → rc $RC au lieu de 5"

run bidule ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X"
[ "$RC" = "5" ] && ok "moment inconnu → FAIL bruyant, jamais un silence" \
  || ko "moment inconnu → rc $RC au lieu de 5"

# « Depuis quand » est la seule question que le client posera. Elle était jetée
# en silence dès que l'on ignorait QUI occupe le sas.
run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-42 "ATS_APPLICATION=Portail Acme" \
  ATS_APPLICATION_ID="$APP_ID" ATS_DETENTEUR_PR="" ATS_DEPUIS=2026-08-01T09:00:00Z
[ "$(champ DECISION)" = "DIRE" ] \
  && ok "détenteur inconnu → on dit quand même l'attente" \
  || ko "détenteur inconnu → l'orchestrateur se tait, alors qu'il attend"
case "$(champ MESSAGE)" in *"2026-08-01T09:00:00Z"*) ok "détenteur inconnu → « depuis quand » est conservé" ;;
  *) ko "« depuis quand » jeté en silence faute de connaître le détenteur : $(champ MESSAGE)" ;; esac

# Un n° de livraison illisible n'est pas relayé — mais son abandon est DIT.
run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-42 "ATS_APPLICATION=Portail Acme" \
  ATS_APPLICATION_ID="$APP_ID" ATS_DETENTEUR_PR="412 depuis mardi" ATS_DEPUIS=2026-08-01T09:00:00Z
[ "$(champ DECISION)" = "DIRE" ] && [ -n "$(champ AVERTISSEMENT)" ] \
  && ok "un n° de livraison illisible n'est pas relayé, et son abandon est signalé" \
  || ko "un n° de livraison illisible passe tel quel ou est jeté en silence : $(champ MESSAGE)"
case "$(champ MESSAGE)" in *"depuis mardi"*) ko "un n° de livraison absurde est relayé au client" ;;
  *) ok "le n° de livraison absurde ne part pas vers le client" ;; esac

# Le repli de casse forkait 3 sous-processus par caractère : 29 s sur 16 000
# lettres, sans plafond de longueur nulle part. Une entrée d'agent ne doit pas
# pouvoir immobiliser le chemin.
DEBUT=$SECONDS
LONG="$(printf 'A%.0s' $(seq 1 16000))"
run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" \
  ATS_APPLICATION_ID="$LONG" ATS_ATTENTE_DECLAREE="$LONG"
ECOULE=$(( SECONDS - DEBUT ))
[ "$ECOULE" -le 5 ] \
  && ok "une entrée démesurée est tranchée en ${ECOULE}s (bornée, pas quadratique)" \
  || ko "une entrée démesurée immobilise le chemin ${ECOULE}s"
[ "$RC" = "5" ] \
  && ok "un identifiant démesuré est refusé plutôt que traité" \
  || ko "un identifiant démesuré est accepté (rc $RC)"

fi

# =================================================================
# 8. Le chemin documenté APPELLE VRAIMENT le helper (RA-AGT-007)
#    v1 : quatre `grep` passaient sur un commentaire HTML.
#    v2 : quatre `echo` imprimant les bonnes chaînes passaient aussi.
#    Ici le bloc tourne contre un helper TÉMOIN, qui délègue au vrai et laisse
#    une empreinte que seule une invocation réelle peut produire. Un bloc qui
#    imite les sorties, ou qui appelle autre chose, ne la produit pas.
# =================================================================
if [ ! -f "$SKILL_ORCH" ]; then
  ko "SKILL.md orchestrer-chantier introuvable"
else
  BLOC="${TMPDIR_T}/bloc-documente.sh"
  awk '
    /^\*\*g\. Pousser/ { dans_section = 1 }
    dans_section && /^```bash/ { dans_bloc = 1; next }
    dans_bloc && /^```/ { exit }
    dans_bloc { print }
  ' "$SKILL_ORCH" > "$BLOC"

  if [ ! -s "$BLOC" ]; then
    ko "aucun bloc de commandes exécutable dans la section « g. Pousser » — le chemin a disparu du SKILL.md"
  else
    ok "la section « g. Pousser » porte un bloc de commandes extractible"

    FAUX_ROOT="${TMPDIR_T}/faux-depot"
    mkdir -p "${FAUX_ROOT}/$(dirname "$REL_HELPER")"
    NONCE="temoin-8f21c4"
    cat > "${FAUX_ROOT}/${REL_HELPER}" <<TEMOIN
#!/usr/bin/env bash
echo "PREUVE_APPEL=${NONCE} \$1"
exec bash "${HELPER}" "\$@"
TEMOIN

    SORTIE="$(cd "$FAUX_ROOT" && bash "$BLOC" 2>&1)"
    NB_PREUVE="$(printf '%s\n' "$SORTIE" | grep -c "^PREUVE_APPEL=${NONCE}" || true)"
    NB_DIRE="$(printf '%s\n' "$SORTIE" | grep -c '^DECISION=DIRE' || true)"

    [ "$NB_PREUVE" = "2" ] \
      && ok "le bloc documenté appelle réellement le helper, deux fois (témoin)" \
      || ko "le bloc documenté n'appelle pas le helper ($NB_PREUVE invocation(s) témoin) — il imite ses sorties ou appelle autre chose"
    printf '%s\n' "$SORTIE" | grep -q "^PREUVE_APPEL=${NONCE} attente$" \
      && ok "le bloc documenté invoque le moment « attente »" \
      || ko "le bloc documenté n'invoque jamais le moment « attente »"
    printf '%s\n' "$SORTIE" | grep -q "^PREUVE_APPEL=${NONCE} passage$" \
      && ok "le bloc documenté invoque le moment « passage »" \
      || ko "le bloc documenté n'invoque jamais le moment « passage »"
    [ "$NB_DIRE" = "2" ] \
      && ok "le bloc documenté produit les DEUX paroles (entrée en attente + tour venu)" \
      || ko "le bloc documenté ne produit pas les deux paroles (obtenu $NB_DIRE) : $SORTIE"
    case "$SORTIE" in *"DECISION=FAIL"*) ko "le bloc documenté échoue — la doc a dérivé du helper : $SORTIE" ;;
      *) ok "la doc n'a pas dérivé du helper (aucun FAIL à l'exécution)" ;; esac
  fi

  # Chronologie : le refus survient AVANT le merge.
  L_POUSSE="$(grep -n '^\*\*g\. Pousser' "$SKILL_ORCH" | head -1 | cut -d: -f1)"
  L_MERGE="$(grep -n '^\*\*h\. Merger' "$SKILL_ORCH" | head -1 | cut -d: -f1)"
  if [ -n "$L_POUSSE" ] && [ -n "$L_MERGE" ] && [ "$L_POUSSE" -lt "$L_MERGE" ]; then
    ok "la consigne d'attente vient avant le merge, là où le refus se produit"
  else
    ko "la consigne d'attente n'est pas placée avant le merge (pousser=$L_POUSSE, merger=$L_MERGE)"
  fi

  # Le chaînon, DANS LES DEUX SENS. C'est l'exécutant qui voit le refus ET la
  # reprise ; le coordonnateur a la parole. Sans consigne dans le brief, le
  # déclencheur ne l'atteint jamais — et le second manque plus souvent que le
  # premier, ce qui laisse une attente annoncée sans fin annoncée.
  BRIEF="$(awk '/^\*\*a\. Écrire le brief/,/^\*\*b\. Faire naître/' "$SKILL_ORCH")"
  SUIVI="$(awk '/^\*\*d\. Exiger le suivi actif/,/^\*\*e\. Faire reviewer/' "$SKILL_ORCH")"

  # On n'interroge PAS la section entière : la consigne est une phrase dictée à
  # l'exécutant, et c'est elle seule qui compte. Chercher « reprise » n'importe
  # où dans le paragraphe laissait passer la suppression de la seconde moitié de
  # la consigne — le commentaire qui l'entoure emploie le même mot, et la suite
  # restait verte. On extrait donc la consigne (le passage en italique) et on
  # exige que SES DEUX MOITIÉS y soient.
  CONSIGNE="$(printf '%s\n' "$BRIEF" | sed 's/\*\*//g' | grep -oE '\*[^*]+\*' \
              | grep -iE 'sas|pousse-staging' | head -1)"
  if [ -z "$CONSIGNE" ]; then
    ko "le brief de l'exécutant ne DICTE pas la consigne de sas occupé — l'exécutant se taira"
    ko "le brief ne demande pas de signaler la reprise : la moitié « le tour est venu » n'a aucun déclencheur"
  else
    ok "le brief dicte à l'exécutant la consigne de sas occupé"
    printf '%s' "$CONSIGNE" | grep -qiE 'quand ta pouss[ée]e (finit par )?pass|poussee pass' \
      && ok "la consigne dictée porte aussi sa seconde moitié : signaler la reprise" \
      || ko "la consigne dictée s'arrête au refus : la moitié « le tour est venu » n'a aucun déclencheur — $CONSIGNE"
  fi
  printf '%s' "$SUIVI" | grep -qiE 'sas occup' \
    && ok "le suivi actif liste le sas occupé parmi les signaux à remonter" \
    || ko "le suivi actif ne liste pas le sas occupé"
  printf '%s' "$SUIVI" | grep -qiE 'poussee pass|pouss[ée]e pass' \
    && ok "le suivi actif liste aussi la reprise" \
    || ko "le suivi actif ne liste pas la reprise"

  # La source de ATS_REPRESENTANT doit être nommée : c'est elle qui décide QUI
  # reçoit, et le helper refuse un nom mal recopié.
  # Le bloc d'exemple ne prouve rien ici : il contient déjà `ATS_REPRESENTANT=`,
  # si bien que retirer la ligne qui dit OÙ PRENDRE la valeur laissait la suite
  # verte. On lit donc la section HORS des blocs de code — la prose et le
  # tableau — et on exige qu'elle nomme la variable ET sa provenance.
  HORS_BLOC="$(awk '/^\*\*g\. Pousser/,/^\*\*h\. Merger/' "$SKILL_ORCH" \
               | awk '/^```/ { dans = !dans; next } !dans')"
  LIGNE_REP="$(printf '%s\n' "$HORS_BLOC" | grep 'ATS_REPRESENTANT' | head -1)"
  if [ -z "$LIGNE_REP" ]; then
    ko "hors des blocs de code, la section ne nomme jamais ATS_REPRESENTANT — l'agent devra deviner d'où vient le nom"
  else
    printf '%s' "$LIGNE_REP" | grep -qiE 'demande|brief|registre' \
      && ok "la section dit, en prose, où prendre le nom du représentant" \
      || ko "la section nomme ATS_REPRESENTANT sans dire d'où le prendre : $LIGNE_REP"
  fi

  grep -qiE 'attend(re|rait)? (au sas )?(son tour )?sans le dire|attente (muette|non dite)' "$SKILL_ORCH" \
    && ok "orchestrer-chantier porte l'anti-pattern de l'attente muette" \
    || ko "orchestrer-chantier ne nomme pas l'attente muette comme un défaut"

  # HS-REL-005 : aucun mécanisme de file.
  grep -qiE 'sonda(ge|nt) (p[ée]riodique|du verrou)|boucle d.attente sur le verrou|registre de file|num[ée]ro d.ordre dans la file' "$SKILL_ORCH" \
    && ko "orchestrer-chantier introduit un mécanisme de file (HS-REL-005)" \
    || ok "aucun mécanisme de file introduit dans le chemin (HS-REL-005)"
  grep -qE 'sleep|while .*lock_status|>> *[^ ]*\.(json|txt|log)' "$HELPER" \
    && ko "le helper garde un état ou sonde — mécanisme de file (HS-REL-005)" \
    || ok "le helper reste sans état : ni sondage, ni persistance (HS-REL-005)"
fi

# =================================================================
# 9. Non-régression : le relais côté représentant existe toujours (EF-REL-011)
# =================================================================
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
