#!/usr/bin/env bash
# ============================================================
# test-attente-au-sas.sh — v2.0.0
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
# HISTORIQUE — pourquoi cette suite est écrite ainsi
#   Une revue indépendante a réfuté la v1 : SEPT mutations du code la laissaient
#   verte, et les quatre assertions qui prétendaient prouver « une attente muette
#   est rattrapée » étaient de simples `grep` sur un fichier Markdown. Le reviewer
#   a remplacé toute la section du SKILL.md par un commentaire HTML disant
#   « ne rien faire de spécial » — les quatre greps passaient encore.
#   D'où deux partis pris ici :
#     • on EXÉCUTE le bloc documenté au lieu d'y chercher des chaînes (§7) ;
#     • chaque garantie annoncée dans le message a son assertion, y compris les
#       clauses qu'on croit décoratives (elles portent la garantie n°1).
#
# Usage : bash scripts/tests/test-attente-au-sas.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
HELPER="${ROOT}/.claude/skills/orchestrer-chantier/lib/attente-au-sas.sh"
SKILL_ORCH="${ROOT}/.claude/skills/orchestrer-chantier/SKILL.md"
SKILL_GEST="${ROOT}/.claude/skills/gestionnaire-client/SKILL.md"

APP_ID="2098c2fd-5448-46a3-bd98-83778e7a064d"
AUTRE_APP_ID="7f3d1c90-1111-2222-3333-444455556666"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
TMPDIR_T="$(mktemp -d)"
trap 'rm -rf "$PASS_FILE" "$FAIL_FILE" "$TMPDIR_T"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

# `env -i` retire la locale : c'est la condition réelle d'un pane dépouillé et de
# la chaîne d'intégration, et c'est là qu'un outil externe manipulant des
# caractères accentués lâche — parfois en échouant, parfois en mutilant.
run() {
  local moment="$1"; shift
  OUT="$(env -i PATH="$PATH" HOME="$HOME" "$@" bash "$HELPER" "$moment" 2>&1)"
  RC=$?
  case "$OUT" in
    *"illegal byte sequence"*|*"sed:"*|*"tr:"*|*"command not found"*|*"syntax error"*)
      ko "outil en échec en environnement sans locale ($moment) : $(printf '%s' "$OUT" | head -1)" ;;
  esac
}

# La même chose, mais dans une locale RICHE. Ce n'est pas une redite : les deux
# environnements cassent le helper de façons OPPOSÉES, et chacun masque le défaut
# de l'autre. En C, un outil externe mutile les accents. En UTF-8, les intervalles
# de motifs (`[A-Z]`) matchent aussi les minuscules sur bash 3.2 — un défaut réel,
# trouvé parce que le bloc documenté, lui, tournait en locale normale : le message
# de fin d'attente ne partait jamais. Une suite qui n'exerce qu'un seul des deux
# ne prouve rien.
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
# 1. Entrée en attente : ON PARLE, et le message porte tout ce que le
#    représentant doit pouvoir relayer sans rien inventer.
#    T-20260806-0148 / -0149 · EF-AGT-003
# =================================================================
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
case "$MSG" in *"attend son tour"*) ok "le message nomme l'attente pour ce qu'elle est" ;;
  *) ko "le message ne nomme pas l'attente : $MSG" ;; esac
case "$MSG" in *"D-20260806-0042"*) ok "le message nomme le chantier" ;;
  *) ko "le message ne nomme pas le chantier" ;; esac
case "$MSG" in *"Portail Acme"*) ok "le message nomme l'application, sous son nom lisible" ;;
  *) ko "le message ne nomme pas l'application" ;; esac
case "$MSG" in *412*) ok "le message nomme la livraison qui occupe le sas" ;;
  *) ko "le message ne nomme pas la livraison qui occupe" ;; esac
# Sans « depuis quand », le représentant ne peut pas répondre à la seule question
# que le client posera. Cette donnée était supprimable sans échec en v1.
case "$MSG" in *"2026-08-06T11:20:00Z"*) ok "le message dit depuis quand le sas est occupé" ;;
  *) ko "le message tait depuis quand — le représentant devra inventer : $MSG" ;; esac
# La clause qui PORTE la garantie n°1. Elle était supprimable sans échec en v1 :
# le message restait « correct » et perdait la consigne qui empêche le
# représentant de le transformer en « c'est en cours ».
case "$MSG" in *"jamais comme un travail qui avance"*) ok "le message interdit explicitement de le présenter comme un travail qui avance" ;;
  *) ko "la consigne qui porte la garantie n°1 a disparu du message : $MSG" ;; esac
case "$MSG" in *"en cours"*) ko "le message présente l'attente comme un travail en cours" ;;
  *) ok "le message ne présente jamais l'attente comme un travail en cours" ;; esac

CMD="$(champ COMMANDE)"
case "$CMD" in *"acme-inc"*) ok "la commande vise le représentant du client" ;;
  *) ko "la commande ne vise pas le représentant : $CMD" ;; esac

# =================================================================
# 2. La valeur qui part dans une COMMANDE exécutée n'est pas de confiance.
#    Le nom du représentant est recopié à la main depuis le registre.
#    (défaut trouvé en revue : injection de commande)
# =================================================================
for HOSTILE in 'acme-inc; touch PWNED' 'acme$(touch PWNED)' 'acme && touch PWNED' \
               'acme|touch PWNED' 'acme inc' 'Acme-Inc' '-acme' \
               'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; do
  run attente \
    ATS_REPRESENTANT="$HOSTILE" \
    ATS_CHANTIER=D-20260806-0042 \
    "ATS_APPLICATION=Portail Acme" \
    ATS_APPLICATION_ID="$APP_ID"
  if [ "$RC" = "5" ] && [ "$(champ DECISION)" = "FAIL" ] && [ -z "$(champ COMMANDE)" ]; then
    :
  else
    ko "nom de représentant hostile accepté : '$HOSTILE' → '$(champ DECISION)'/rc $RC ; COMMANDE='$(champ COMMANDE)'"
    HOSTILE_KO=1
  fi
done
[ "${HOSTILE_KO:-0}" = "0" ] \
  && ok "tout nom de représentant hors de la forme imposée par herdr est refusé (rc 5), et aucune commande n'est rendue" \
  || true

# Et la preuve par l'exécution : la commande rendue pour un nom valide ne fait
# rien d'autre que la remise, même si les données sont hostiles.
run attente \
  ATS_REPRESENTANT=acme-inc \
  'ATS_CHANTIER=D-42; touch PWNED_CHANTIER' \
  'ATS_APPLICATION=Portail $(touch PWNED_APP) `touch PWNED_APP2`' \
  ATS_APPLICATION_ID="$APP_ID"
CMD="$(champ COMMANDE)"
(
  cd "$TMPDIR_T" || exit 1
  # On remplace la remise réelle par un leurre : ce qui compte est de vérifier
  # qu'AUCUN effet de bord ne survient à l'exécution de la ligne rendue.
  herdr() { :; }
  export -f herdr 2>/dev/null || true
  eval "$CMD" >/dev/null 2>&1
)
if [ -z "$(find "$TMPDIR_T" -name 'PWNED*' 2>/dev/null)" ]; then
  ok "exécuter la COMMANDE rendue ne produit aucun effet de bord, même sur données hostiles"
else
  ko "la COMMANDE rendue a exécuté autre chose que la remise : $(find "$TMPDIR_T" -name 'PWNED*')"
fi

# =================================================================
# 3. Aucun représentant → COMPORTEMENT INCHANGÉ (T-20260806-0148)
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
# 4. La portée est l'application — et elle se décide sur un IDENTIFIANT,
#    jamais sur un nom lisible. RA-AGT-006 · T-20260806-0148
# =================================================================
run attente \
  ATS_REPRESENTANT=acme-inc \
  ATS_CHANTIER=D-20260806-0042 \
  "ATS_APPLICATION=Portail Acme" \
  ATS_APPLICATION_ID="$APP_ID" \
  ATS_APPLICATION_ID_VERROU="$AUTRE_APP_ID" \
  ATS_DETENTEUR_PR=999
[ "$RC" = "3" ] && [ "$(champ DECISION)" = "RIEN" ] \
  && ok "verrou sur une autre application → RIEN (RA-AGT-006)" \
  || ko "verrou sur une autre application → attendu RIEN/rc 3, obtenu '$(champ DECISION)'/rc $RC"
case "$(champ MOTIF)" in *[Aa]pplication*) ok "le motif dit que la portée est l'application" ;;
  *) ko "le motif n'explique pas la portée : $(champ MOTIF)" ;; esac

# Égalité STRICTE, jamais un préfixe : `acme` et `acme-portail` sont deux
# applications, et les confondre déclare au client une attente qui n'est pas la
# sienne. (mutation « comparaison par préfixe » non rattrapée en v1)
for PAIRE in "acme:acme-portail" "acme-portail:acme" "acme:acmeportail"; do
  A="${PAIRE%%:*}"; B="${PAIRE##*:}"
  run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" \
    ATS_APPLICATION_ID="$A" ATS_APPLICATION_ID_VERROU="$B"
  [ "$(champ DECISION)" = "RIEN" ] || { ko "identifiants voisins confondus : '$A' vs '$B' → $(champ DECISION)"; PREFIXE_KO=1; }
done
[ "${PREFIXE_KO:-0}" = "0" ] \
  && ok "deux identifiants voisins ne sont jamais confondus (égalité stricte, pas un préfixe)" || true

# La casse ASCII ne doit pas décider — le même identifiant vient de deux sources.
run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" \
  ATS_APPLICATION_ID="2098C2FD-5448-46A3-BD98-83778E7A064D" ATS_APPLICATION_ID_VERROU="$APP_ID"
[ "$(champ DECISION)" = "DIRE" ] \
  && ok "comparaison d'identifiants insensible à la casse" \
  || ko "comparaison sensible à la casse → fausse absence d'attente"

# Absent ET blanc doivent donner le MÊME verdict : ce sont deux façons de ne rien
# dire, et un refus de lock_acquire porte par construction sur notre application.
run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" \
  ATS_APPLICATION_ID="$APP_ID"
D1="$(champ DECISION)"
run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" \
  ATS_APPLICATION_ID="$APP_ID" ATS_APPLICATION_ID_VERROU="   "
D2="$(champ DECISION)"
[ "$D1" = "DIRE" ] && [ "$D2" = "DIRE" ] \
  && ok "identifiant du verrou absent ou blanc → même verdict, aucune asymétrie" \
  || ko "asymétrie absent/blanc sur l'identifiant du verrou : '$D1' vs '$D2'"

# Le NOM LISIBLE ne décide de rien : accentué, il n'a jamais fait taire personne.
run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 \
  "ATS_APPLICATION=Portail Élève" ATS_APPLICATION_ID="$APP_ID"
[ "$(champ DECISION)" = "DIRE" ] \
  && ok "un nom d'application accentué ne fait pas taire l'orchestrateur" \
  || ko "un nom accentué fait taire l'orchestrateur — le silence exact qu'on interdit"

# Un identifiant qui n'en est pas un → FAIL bruyant, pas un silence.
for MAUVAIS in "Portail Élève" "app;rm" "app/../x"; do
  run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" \
    ATS_APPLICATION_ID="$MAUVAIS"
  [ "$RC" = "5" ] || { ko "identifiant mal formé accepté : '$MAUVAIS' → rc $RC"; ID_KO=1; }
done
[ "${ID_KO:-0}" = "0" ] && ok "un identifiant d'application mal formé échoue bruyamment (rc 5)" || true

# =================================================================
# 5. Le tour venu se dit aussi (T-20260806-0149 · EF-AGT-003)
# =================================================================
run passage \
  ATS_REPRESENTANT=acme-inc \
  ATS_CHANTIER=D-20260806-0042 \
  "ATS_APPLICATION=Portail Acme" \
  ATS_ATTENTE_DECLAREE=oui
[ "$RC" = "0" ] && [ "$(champ DECISION)" = "DIRE" ] \
  && ok "le tour venu après une attente déclarée → DIRE" \
  || ko "le tour venu → attendu DIRE/rc 0, obtenu '$(champ DECISION)'/rc $RC"
MSG="$(champ MESSAGE)"
case "$MSG" in *"le tour est venu"*) ok "le message annonce que le tour est venu" ;;
  *) ko "le message n'annonce pas la fin de l'attente : $MSG" ;; esac
case "$MSG" in *"Portail Acme"*) ok "le message de passage nomme l'application" ;;
  *) ko "le message de passage ne nomme pas l'application" ;; esac
case "$MSG" in *"vient de partir"*) ok "le message de passage arrive entier" ;;
  *) ko "le message de passage est tronqué : $MSG" ;; esac
if printf '%s' "$MSG" | LC_ALL=en_US.UTF-8 grep -q '—'; then
  ok "les caractères multi-octets du message survivent intacts"
else
  ko "un caractère multi-octets a été mutilé — le représentant relaierait du charabia"
fi

# La réponse « oui » vient d'un humain ou d'un autre agent : elle arrive avec des
# espaces et dans la casse qu'on lui donne. (mutation non rattrapée en v1)
for OUI in "oui" " oui " "OUI" "Oui"; do
  run passage ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" \
    ATS_ATTENTE_DECLAREE="$OUI"
  [ "$(champ DECISION)" = "DIRE" ] || { ko "attente déclarée non reconnue : '$OUI' → $(champ DECISION)"; OUI_KO=1; }
done
[ "${OUI_KO:-0}" = "0" ] \
  && ok "l'attente déclarée est reconnue quels que soient la casse et les espaces" || true

run passage ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" \
  ATS_ATTENTE_DECLAREE=non
[ "$RC" = "3" ] && [ "$(champ DECISION)" = "RIEN" ] \
  && ok "passage sans attente déclarée → RIEN (le canal reste silencieux)" \
  || ko "passage sans attente déclarée → attendu RIEN/rc 3, obtenu '$(champ DECISION)'/rc $RC"

# =================================================================
# 5-bis. LES MÊMES GARANTIES EN LOCALE RICHE.
#    Le helper tourne aussi bien dans un pane sans locale que dans un terminal
#    normal, et les deux le cassent de façons opposées.
# =================================================================
for OUI in "oui" "OUI" " oui "; do
  run_locale passage ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" \
    ATS_ATTENTE_DECLAREE="$OUI"
  [ "$(champ DECISION)" = "DIRE" ] || { ko "en locale riche, attente déclarée non reconnue : '$OUI' → $(champ DECISION) / $(champ MOTIF)"; LOC_KO=1; }
done
run_locale passage ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" \
  ATS_ATTENTE_DECLAREE=non
[ "$(champ DECISION)" = "RIEN" ] || { ko "en locale riche, « non » est pris pour « oui »"; LOC_KO=1; }

run_locale attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-20260806-0042 \
  "ATS_APPLICATION=Portail Élève" ATS_APPLICATION_ID="$APP_ID" ATS_DETENTEUR_PR=412
[ "$(champ DECISION)" = "DIRE" ] || { ko "en locale riche, l'entrée en attente ne se dit pas"; LOC_KO=1; }
case "$(champ MESSAGE)" in *"Portail Élève"*) : ;;
  *) ko "en locale riche, le nom accentué de l'application est mutilé : $(champ MESSAGE)"; LOC_KO=1 ;; esac
run_locale attente ATS_REPRESENTANT='acme-inc; touch PWNED' ATS_CHANTIER=D-1 \
  "ATS_APPLICATION=X" ATS_APPLICATION_ID="$APP_ID"
[ "$RC" = "5" ] || { ko "en locale riche, un nom de représentant hostile passe (rc $RC)"; LOC_KO=1; }

[ "${LOC_KO:-0}" = "0" ] \
  && ok "les mêmes garanties tiennent en locale riche (casse, accents, refus d'un nom hostile)" || true

# =================================================================
# 6. Le transport ne casse pas (RA-REL-005) — le prompt est passé entre
#    apostrophes simples et se soumet au premier saut de ligne.
# =================================================================
run attente \
  ATS_REPRESENTANT=acme-inc \
  ATS_CHANTIER=D-20260806-0042 \
  "ATS_APPLICATION=portail de l'Atelier ’ \` fin" \
  ATS_APPLICATION_ID="$APP_ID" \
  ATS_DETENTEUR_PR=412
MSG="$(champ MESSAGE)"; CMD="$(champ COMMANDE)"
[ "$(champ DECISION)" = "DIRE" ] \
  && ok "les caractères de transport dans une donnée n'empêchent pas de parler" \
  || ko "des caractères de transport font taire l'orchestrateur"
case "$MSG" in *"'"*) ko "apostrophe simple laissée dans le message — remise coupée" ;;
  *) ok "apostrophe simple retirée" ;; esac
case "$MSG" in *"’"*) ko "apostrophe typographique laissée — remise coupée" ;;
  *) ok "apostrophe typographique retirée" ;; esac
case "$MSG" in *'`'*) ko "accent grave laissé dans le message" ;;
  *) ok "accent grave retiré" ;; esac
case "$MSG" in *Atelier*) ok "le message survit entier à la normalisation" ;;
  *) ko "la normalisation a mutilé le message : '$MSG'" ;; esac
[ "$(printf '%s' "$CMD" | wc -l | tr -d ' ')" = "0" ] \
  && ok "la commande tient sur une seule ligne" \
  || ko "la commande tient sur plusieurs lignes — le prompt serait soumis en deux morceaux"

# Saut de ligne ET retour chariot : `wc -l` ne compte que le premier, et un CR
# seul suffit à couper la remise. (mutation non rattrapée en v1)
run attente ATS_REPRESENTANT=acme-inc \
  "ATS_CHANTIER=$(printf 'D-42\r\nsuite')" "ATS_APPLICATION=X" ATS_APPLICATION_ID="$APP_ID"
MSG="$(champ MESSAGE)"
case "$MSG" in *$'\r'*) ko "un retour chariot traverse le message — remise coupée" ;;
  *) ok "le retour chariot est neutralisé" ;; esac
case "$MSG" in *$'\n'*) ko "un saut de ligne traverse le message" ;;
  *) ok "le saut de ligne est neutralisé" ;; esac

# =================================================================
# 7. Le silence n'est jamais le repli (RA-AGT-007) — T-20260806-0150
# =================================================================
run attente ATS_REPRESENTANT=acme-inc "ATS_APPLICATION=X" ATS_APPLICATION_ID="$APP_ID"
[ "$RC" = "5" ] && [ "$(champ DECISION)" = "FAIL" ] \
  && ok "chantier inconnu + représentant → FAIL bruyant (rc 5), jamais un silence" \
  || ko "chantier inconnu → attendu FAIL/rc 5, obtenu '$(champ DECISION)'/rc $RC"

run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 ATS_APPLICATION_ID="$APP_ID"
[ "$RC" = "5" ] \
  && ok "application inconnue + représentant → FAIL bruyant" \
  || ko "application inconnue → rc $RC au lieu de 5"

run attente ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X" \
  ATS_APPLICATION_ID="$APP_ID" ATS_DETENTEUR_PR=""
[ "$(champ DECISION)" = "DIRE" ] \
  && ok "détenteur inconnu → on dit quand même l'attente" \
  || ko "détenteur inconnu → l'orchestrateur se tait, alors qu'il attend"
case "$(champ MESSAGE)" in *"attend son tour"*) ok "détenteur inconnu → l'attente reste nommée" ;;
  *) ko "détenteur inconnu → l'attente n'est plus nommée" ;; esac

run bidule ATS_REPRESENTANT=acme-inc ATS_CHANTIER=D-1 "ATS_APPLICATION=X"
[ "$RC" = "5" ] \
  && ok "moment inconnu → FAIL bruyant, jamais un silence" \
  || ko "moment inconnu → rc $RC au lieu de 5"

fi

# =================================================================
# 8. Le chemin documenté EST exécuté — pas relu (RA-AGT-007)
#    T-20260806-0150. C'est ici que la v1 était du théâtre : quatre `grep`
#    passaient encore sur un commentaire HTML disant « ne rien faire de spécial ».
#    On extrait le bloc de commandes de la section et on le fait tourner : si la
#    section disparaît, si le bloc part, ou si un nom de variable dérive du
#    helper, il n'y a plus rien à exécuter et ça rougit.
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
    SORTIE="$(cd "$ROOT" && bash "$BLOC" 2>&1)"
    NB_DIRE="$(printf '%s\n' "$SORTIE" | grep -c '^DECISION=DIRE' || true)"
    [ "$NB_DIRE" = "2" ] \
      && ok "le bloc documenté s'exécute et produit les DEUX paroles (entrée en attente + tour venu)" \
      || ko "le bloc documenté ne produit pas les deux paroles attendues (obtenu $NB_DIRE) : $SORTIE"
    case "$SORTIE" in *"attend son tour"*) ok "le bloc documenté fait bien dire l'attente" ;;
      *) ko "le bloc documenté ne fait pas dire l'attente" ;; esac
    case "$SORTIE" in *"le tour est venu"*) ok "le bloc documenté fait bien dire le tour venu" ;;
      *) ko "le bloc documenté ne fait pas dire le tour venu" ;; esac
    case "$SORTIE" in *FAIL*|*"MOTIF="*) ko "le bloc documenté échoue à l'exécution — la doc a dérivé du helper : $SORTIE" ;;
      *) ok "la doc n'a pas dérivé du helper (aucun FAIL à l'exécution)" ;; esac
  fi

  # Chronologie : le refus de poussée survient AVANT le merge. Une consigne lue
  # après le merge arrive trop tard.
  L_POUSSE="$(grep -n '^\*\*g\. Pousser' "$SKILL_ORCH" | head -1 | cut -d: -f1)"
  L_MERGE="$(grep -n '^\*\*h\. Merger' "$SKILL_ORCH" | head -1 | cut -d: -f1)"
  if [ -n "$L_POUSSE" ] && [ -n "$L_MERGE" ] && [ "$L_POUSSE" -lt "$L_MERGE" ]; then
    ok "la consigne d'attente vient avant le merge, là où le refus se produit"
  else
    ko "la consigne d'attente n'est pas placée avant le merge (pousser=$L_POUSSE, merger=$L_MERGE)"
  fi

  # Le chaînon : c'est l'exécutant qui VOIT le refus, le coordonnateur qui a la
  # parole. Sans consigne dans le brief, le déclencheur n'atteint jamais celui
  # qui doit parler — et l'attente reste muette malgré tout le reste.
  grep -qiE 'sas occup' "$SKILL_ORCH" \
    && ok "le gabarit de brief ou le suivi actif nomme le sas occupé" \
    || ko "rien ne demande à l'exécutant de remonter un sas occupé — le déclencheur n'arrive jamais"
  awk '/^\*\*a\. Écrire le brief/,/^\*\*b\. Faire naître/' "$SKILL_ORCH" | grep -qiE 'sas occup|pousse-staging refuse' \
    && ok "le brief de l'exécutant porte la consigne de sas occupé" \
    || ko "le brief de l'exécutant ne porte pas la consigne — l'exécutant se taira"
  awk '/^\*\*d\. Exiger le suivi actif/,/^\*\*e\. Faire reviewer/' "$SKILL_ORCH" | grep -qiE 'sas occup' \
    && ok "le suivi actif liste le sas occupé parmi les signaux à remonter" \
    || ko "le suivi actif ne liste pas le sas occupé"

  grep -qiE 'attend(re|rait)? (au sas )?(son tour )?sans le dire|attente (muette|non dite)' "$SKILL_ORCH" \
    && ok "orchestrer-chantier porte l'anti-pattern de l'attente muette" \
    || ko "orchestrer-chantier ne nomme pas l'attente muette comme un défaut"

  # HS-REL-005 : aucun mécanisme de file construit.
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
