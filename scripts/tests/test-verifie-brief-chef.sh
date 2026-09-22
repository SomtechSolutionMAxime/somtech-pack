#!/usr/bin/env bash
# ============================================================
# test-verifie-brief-chef.sh — v1.0.0
# Banc unitaire de `verifie-brief-chef.sh` (T-20260922-0098, garde 4/5 du
# lot 4, D-20260921-0017).
#
# Couvre les 7 G/W/T du ticket, PLUS le discriminant central du lot — écrit
# noir sur blanc dans le ticket lui-même : « [non établi] SANS motif » doit
# rester un REFUS, alors que « [non établi] AVEC motif » doit PASSER. Une
# garde qui confond les deux fabrique exactement la fausseté qu'elle
# prétend empêcher (un orchestrateur pousserait à écrire un ADR inventé
# pour faire taire une garde trop stricte).
#
# Usage : bash scripts/tests/test-verifie-brief-chef.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LIB="${VBC_LIB:-${ROOT}/.claude/skills/orchestrer-chantier/lib/verifie-brief-chef.sh}"

[ -f "$LIB" ] || { echo "❌ lib absente: $LIB"; exit 1; }
# shellcheck source=/dev/null
source "$LIB"

PASS=0; FAIL=0
ok() { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

champ() { printf '%s\n' "$OUT" | sed -n "s/^$1=//p"; }

# executer <NAME=VALUE>... — repart d'un environnement propre (les 4
# variables du contrat désarmées), applique les affectations données, puis
# appelle vbc_verifier. OUT = stdout entier, RC = code de retour.
executer() {
  unset VBC_BRIEF_TEXTE VBC_SOURCE_CASSEE VBC_MODULE_ID VBC_TOUCHE_ONTOLOGIE
  local a
  for a in "$@"; do
    export "${a%%=*}=${a#*=}"
  done
  OUT="$(vbc_verifier)"
  RC=$?
}

echo "== Le contrôle du brief de chef (T-20260922-0098) =="

# =================================================================
# Fixtures — un brief conforme complet, puis chaque défaut isolé.
# =================================================================
FIX_ADR_TITRE='ADR-038 — Gestion des secrets Supabase a droits eleves (STD-038)'
FIX_ADR_NON_ETABLI_MOTIF='[non établi] — le miroir des ADR est incomplet pour ce sujet, aucune reference ne peut etre etablie pour ce lot'
FIX_ADR_NON_ETABLI_SEUL='[non établi]'
FIX_ADR_NUM_NU='ADR-038'
FIX_ADR_NUM_TITRE='ADR-038 — Gestion des secrets Supabase a droits eleves'

FIX_BRD_APPLI='Le BRD est a jour et couvre ce lot (grain application).'
FIX_BRD_SANS_GRAIN='Le BRD est a jour et verifie avant ce lot.'
FIX_BRD_AVEC_GRAIN='Le BRD du module facturation est a jour, voir /facturation/BRD.md.'

# Sections COMPLÈTES (avec leur propre titre) — indispensable pour le test
# d'absence : si le titre lui-même était fixe (« ## Ontologie »), le mot
# « ontologie » serait TOUJOURS présent via le titre, quel que soit le
# contenu, et le cas « absente » ne testerait jamais rien.
FIX_ONTO_PRESENTE="## Ontologie

Ce lot touche l'entite Ticket et son attribut module_id dans l'ontologie."
FIX_ONTO_ABSENTE="## Perimetre

Ce lot ne touche aucune entite ni relation du modele de donnees, uniquement du texte et des references."

# « ontologie » est volontairement ABSENT d'ici : cette section est
# réutilisée dans les briefs où le champ ONTOLOGIE doit rester déterminé
# par la SEULE section 3 (FIX_ONTO_PRESENTE/ABSENTE) — une fuite du mot ici
# masquerait le cas « absente » quel que soit le contenu réel de section 3.
FIX_APPLICABLE_PRESENTE="## Ce qui s'applique ici

- Regle d'or n 1
- STD-030 (hierarchie des tickets)"
FIX_APPLICABLE_PRESENTE_ACCENT="## Ce qui s’applique ici

- Regle d'or n 1"
FIX_APPLICABLE_ABSENTE="## Hors-scope

- rien de plus"

brief() {
  # brief <contenu-adr> <contenu-brd> <section-onto-complete> <section-applicable-complete>
  # Les sections 3 et 4 portent DÉJÀ leur propre titre — voir le
  # commentaire au-dessus de FIX_ONTO_PRESENTE/ABSENTE.
  printf '## ADR applicable\n\n%s\n\n## BRD\n\n%s\n\n%s\n\n%s\n' \
    "$1" "$2" "$3" "$4"
}

# =================================================================
# 1. G/W/T #1 — ADR totalement absent → REFUS, champ nommé.
# =================================================================
BRIEF_SANS_ADR="$(printf '## BRD\n\n%s\n\n%s\n\n%s\n' \
  "$FIX_BRD_APPLI" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_PRESENTE")"
executer "VBC_BRIEF_TEXTE=${BRIEF_SANS_ADR}"
[ "$(champ ADR)" = "REFUS" ] \
  && ok "ADR totalement absent → REFUS" \
  || ko "ADR absent → attendu REFUS, obtenu '$(champ ADR)'"
case "$(champ MOTIF)" in *ADR*) ok "le motif global nomme le champ ADR manquant" ;;
  *) ko "le motif ne nomme pas ADR : $(champ MOTIF)" ;; esac
[ "$RC" = "2" ] && ok "verdict REFUS → rc=2" || ko "rc attendu 2, obtenu $RC"

# L'absence doit rester un REFUS même quand le TEXTE lui-même est dense —
# ce n'est pas la LONGUEUR du brief qui doit décider, c'est la présence
# RÉELLE du marqueur « ADR applicable ». Un contrôle qui ancre mal sa
# recherche (par ex. « la première ligne du brief » au lieu du marqueur
# exact) laisserait passer ce cas : la première ligne, dense, dépasse à
# elle seule le seuil de motif.
BRIEF_SANS_ADR_LIGNE_DENSE="$(printf 'Ce brief ne mentionne aucune reference d architecture nommee pour ce lot de travail.\n\n## BRD\n\n%s\n\n%s\n\n%s\n' \
  "$FIX_BRD_APPLI" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_PRESENTE")"
executer "VBC_BRIEF_TEXTE=${BRIEF_SANS_ADR_LIGNE_DENSE}"
[ "$(champ ADR)" = "REFUS" ] \
  && ok "ADR absent même quand la première ligne du brief est dense — l'ancrage est le marqueur, pas la densité" \
  || ko "ADR absent, première ligne dense → attendu REFUS, obtenu '$(champ ADR)'"

# =================================================================
# 2. G/W/T #2 — `[non établi]` AVEC motif → PASSE, rien de plus demandé.
# =================================================================
executer "VBC_BRIEF_TEXTE=$(brief "$FIX_ADR_NON_ETABLI_MOTIF" "$FIX_BRD_APPLI" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_PRESENTE")"
[ "$(champ ADR)" = "PASSE" ] \
  && ok "[non établi] AVEC motif → PASSE" \
  || ko "[non établi] avec motif → attendu PASSE, obtenu '$(champ ADR)'"

# =================================================================
# 2-bis. LE DISCRIMINANT CENTRAL DU LOT — `[non établi]` SANS motif → REFUS.
#    Ce cas n'est pas dans les 7 G/W/T littéraux, mais c'est exactement ce
#    que le ticket désigne comme « le discriminant à construire » : sans ce
#    test, un mutant qui accepte tout `[non établi]` sans exiger de motif
#    passerait — et fabriquerait la fausseté que le lot doit empêcher.
# =================================================================
executer "VBC_BRIEF_TEXTE=$(brief "$FIX_ADR_NON_ETABLI_SEUL" "$FIX_BRD_APPLI" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_PRESENTE")"
[ "$(champ ADR)" = "REFUS" ] \
  && ok "[non établi] SEUL, SANS motif → REFUS (le marqueur seul ne suffit pas)" \
  || ko "[non établi] sans motif → attendu REFUS, obtenu '$(champ ADR)'"

# Variante qui isole VRAIMENT la reconnaissance du marqueur accentué : un
# texte TOTAL de 16 caractères utiles (au-dessus du seuil de 15), mais dont
# 9 appartiennent au marqueur lui-même (« non établi » → « nonetabli »),
# laissant seulement 7 caractères de motif réel (« pas assez ») — SOUS le
# seuil. Sans le repli accentué é→e, « établi » n'est jamais reconnu comme
# le marqueur : le champ retombe alors sur le compte TOTAL (16, au-dessus
# du seuil) et rend PASSE à tort. Avec le repli, le compte HORS marqueur
# (7) est sous le seuil et le champ rend REFUS. Les deux fixtures
# précédentes ne distinguaient pas ce cas (leur texte total dépassait 15
# caractères utiles QUEL QUE SOIT le sort du marqueur).
executer "VBC_BRIEF_TEXTE=$(brief '[non établi] pas assez' "$FIX_BRD_APPLI" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_PRESENTE")"
[ "$(champ ADR)" = "REFUS" ] \
  && ok "[non établi] + reliquat trop court (7 car. utiles hors marqueur) → REFUS, même si le total (16) dépasse le seuil" \
  || ko "reliquat insuffisant hors marqueur → attendu REFUS, obtenu '$(champ ADR)'"

# =================================================================
# 3. G/W/T #3 — ADR citée par numéro nu, sans titre → SIGNALE.
# =================================================================
executer "VBC_BRIEF_TEXTE=$(brief "$FIX_ADR_NUM_NU" "$FIX_BRD_APPLI" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_PRESENTE")"
[ "$(champ ADR)" = "SIGNALE" ] \
  && ok "ADR citée par son seul numéro → SIGNALE" \
  || ko "numéro nu → attendu SIGNALE, obtenu '$(champ ADR)'"
[ "$(champ VERDICT)" = "SIGNALE" ] && [ "$RC" = "1" ] \
  && ok "verdict global SIGNALE → rc=1 quand rien n'est en REFUS" \
  || ko "verdict global attendu SIGNALE/rc1, obtenu '$(champ VERDICT)'/rc $RC"

# ADR citée par numéro AVEC titre → PASSE (contraste direct avec le cas ci-dessus)
executer "VBC_BRIEF_TEXTE=$(brief "$FIX_ADR_NUM_TITRE" "$FIX_BRD_APPLI" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_PRESENTE")"
[ "$(champ ADR)" = "PASSE" ] \
  && ok "ADR citée par numéro AVEC titre → PASSE" \
  || ko "numéro avec titre → attendu PASSE, obtenu '$(champ ADR)'"

# =================================================================
# 4. G/W/T #4 — lot qui ne touche aucune entité → ontologie NON_APPLIQUE,
#    jamais un refus, même si le mot « ontologie » n'apparaît nulle part.
# =================================================================
executer "VBC_BRIEF_TEXTE=$(brief "$FIX_ADR_TITRE" "$FIX_BRD_APPLI" "$FIX_ONTO_ABSENTE" "$FIX_APPLICABLE_PRESENTE")" \
  "VBC_TOUCHE_ONTOLOGIE=non"
[ "$(champ ONTOLOGIE)" = "NON_APPLIQUE" ] \
  && ok "VBC_TOUCHE_ONTOLOGIE=non, ontologie absente → NON_APPLIQUE, jamais REFUS" \
  || ko "touche=non → attendu NON_APPLIQUE, obtenu '$(champ ONTOLOGIE)'"
[ "$(champ VERDICT)" = "PASSE" ] \
  && ok "NON_APPLIQUE n'entraîne aucun REFUS global" \
  || ko "NON_APPLIQUE a fait basculer le verdict global : $(champ VERDICT)"

executer "VBC_BRIEF_TEXTE=$(brief "$FIX_ADR_TITRE" "$FIX_BRD_APPLI" "$FIX_ONTO_ABSENTE" "$FIX_APPLICABLE_PRESENTE")" \
  "VBC_TOUCHE_ONTOLOGIE=oui"
[ "$(champ ONTOLOGIE)" = "REFUS" ] \
  && ok "VBC_TOUCHE_ONTOLOGIE=oui, ontologie absente → REFUS" \
  || ko "touche=oui, absente → attendu REFUS, obtenu '$(champ ONTOLOGIE)'"

executer "VBC_BRIEF_TEXTE=$(brief "$FIX_ADR_TITRE" "$FIX_BRD_APPLI" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_PRESENTE")" \
  "VBC_TOUCHE_ONTOLOGIE=oui"
[ "$(champ ONTOLOGIE)" = "PASSE" ] \
  && ok "VBC_TOUCHE_ONTOLOGIE=oui, ontologie présente → PASSE" \
  || ko "touche=oui, présente → attendu PASSE, obtenu '$(champ ONTOLOGIE)'"

# Le défaut (vide/inconnu) ne doit JAMAIS être un [non applicable] silencieux :
# sans VBC_TOUCHE_ONTOLOGIE positionnée du tout, le check s'applique (défaut
# conservatif « oui »), pas NON_APPLIQUE.
executer "VBC_BRIEF_TEXTE=$(brief "$FIX_ADR_TITRE" "$FIX_BRD_APPLI" "$FIX_ONTO_ABSENTE" "$FIX_APPLICABLE_PRESENTE")"
[ "$(champ ONTOLOGIE)" = "REFUS" ] \
  && ok "VBC_TOUCHE_ONTOLOGIE non positionnée → défaut conservatif oui (REFUS si absente), jamais NON_APPLIQUE silencieux" \
  || ko "défaut non positionné → attendu REFUS (conservatif), obtenu '$(champ ONTOLOGIE)'"

# =================================================================
# 5. G/W/T #5 — module_id → BRD DU MODULE exigé, pas celui de l'application.
# =================================================================
executer "VBC_BRIEF_TEXTE=$(brief "$FIX_ADR_TITRE" "$FIX_BRD_APPLI" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_PRESENTE")"
[ "$(champ BRD)" = "PASSE" ] \
  && ok "sans module_id (grain application), BRD mentionné → PASSE" \
  || ko "grain application → attendu PASSE, obtenu '$(champ BRD)'"

executer "VBC_BRIEF_TEXTE=$(brief "$FIX_ADR_TITRE" "$FIX_BRD_SANS_GRAIN" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_PRESENTE")" \
  "VBC_MODULE_ID=facturation"
[ "$(champ BRD)" = "REFUS" ] \
  && ok "module_id posé, BRD présent mais SANS indication de grain module → REFUS" \
  || ko "grain module manquant → attendu REFUS, obtenu '$(champ BRD)'"
case "$(champ MOTIF)" in *BRD*) ok "le motif nomme le champ BRD en cause" ;;
  *) ko "le motif ne nomme pas BRD : $(champ MOTIF)" ;; esac

executer "VBC_BRIEF_TEXTE=$(brief "$FIX_ADR_TITRE" "$FIX_BRD_AVEC_GRAIN" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_PRESENTE")" \
  "VBC_MODULE_ID=facturation"
[ "$(champ BRD)" = "PASSE" ] \
  && ok "module_id posé, BRD avec indication de grain module → PASSE" \
  || ko "grain module présent → attendu PASSE, obtenu '$(champ BRD)'"

# =================================================================
# 5-bis. Contre-exemples réels du champ BRD (revue indépendante,
#    2026-09-22) — le mot NU « module » ne suffit plus, une PHRASE plus
#    spécifique (ou l'association grain+module) est exigée.
# =================================================================

# FAUX POSITIF corrigé : « module » y désigne un module FONCTIONNEL
# (notification) sans aucun rapport avec le grain du BRD — le bare-word
# « module » dans la fenêtre autour de « brd » ne doit plus suffire.
executer "VBC_BRIEF_TEXTE=Ce lot ajoute un nouveau module de notification pour les utilisateurs actifs. Le BRD est a jour et couvre ce lot." \
  "VBC_MODULE_ID=facturation"
[ "$(champ BRD)" = "REFUS" ] \
  && ok "« module » cite comme module FONCTIONNEL sans rapport avec le grain du BRD → REFUS (faux positif corrige)" \
  || ko "faux positif module fonctionnel → attendu REFUS, obtenu '$(champ BRD)'"

# FAUX REFUS corrigé : le grain module est bel et bien cité (« le grain
# retenu ici est celui du module facturation »), mais dans une phrase
# distincte, à ~210 caractères de « brd » — au-delà de VBC_FENETRE_PROXIMITE.
executer "VBC_BRIEF_TEXTE=Le BRD applicable a ce lot est a jour et a ete verifie en detail, avec relecture complete section par section pour confirmer que rien ne manque a ce jour. Le grain retenu ici est celui du module facturation." \
  "VBC_MODULE_ID=facturation"
[ "$(champ BRD)" = "PASSE" ] \
  && ok "grain module cite loin de « brd » dans le texte (~210 car.) → PASSE (faux refus corrige)" \
  || ko "faux refus grain eloigne → attendu PASSE, obtenu '$(champ BRD)'"

# FAUX POSITIF (second tour, revue de fond 2026-09-22) : un « grain » SANS
# rapport avec le BRD (grain de découpage du TICKET, vocabulaire PM
# courant) apparaît loin de toute mention « brd » (> VBC_FENETRE_PROXIMITE_GRAIN,
# 300 car.) — l'ancrage doit l'exclure sur un document de longueur réaliste.
PADDING_LONG="$(printf 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod. %.0s' $(seq 1 6))"
executer "VBC_BRIEF_TEXTE=Le grain de decoupage retenu pour ce ticket est le module technique, pas le module metier. ${PADDING_LONG} Le BRD est a jour et couvre ce lot." \
  "VBC_MODULE_ID=facturation"
[ "$(champ BRD)" = "REFUS" ] \
  && ok "« grain » sans rapport avec le BRD, loin de « brd » (document long) → REFUS (second faux positif corrige)" \
  || ko "grain sans rapport mais loin de brd → attendu REFUS, obtenu '$(champ BRD)' (fenetre trop large ?)"

# =================================================================
# « Ce qui s'applique ici » — absente/présente, variante d'apostrophe.
# =================================================================
executer "VBC_BRIEF_TEXTE=$(brief "$FIX_ADR_TITRE" "$FIX_BRD_APPLI" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_ABSENTE")"
[ "$(champ APPLICABLE)" = "REFUS" ] \
  && ok "section « ce qui s'applique ici » absente → REFUS" \
  || ko "section absente → attendu REFUS, obtenu '$(champ APPLICABLE)'"

executer "VBC_BRIEF_TEXTE=$(brief "$FIX_ADR_TITRE" "$FIX_BRD_APPLI" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_PRESENTE")"
[ "$(champ APPLICABLE)" = "PASSE" ] \
  && ok "section présente (apostrophe droite) → PASSE" \
  || ko "section présente → attendu PASSE, obtenu '$(champ APPLICABLE)'"

# Variante d'apostrophe/accent DIFFÉRENTE : apostrophe typographique courbe.
executer "VBC_BRIEF_TEXTE=$(brief "$FIX_ADR_TITRE" "$FIX_BRD_APPLI" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_PRESENTE_ACCENT")"
[ "$(champ APPLICABLE)" = "PASSE" ] \
  && ok "section présente avec apostrophe typographique (’) → PASSE" \
  || ko "variante d'apostrophe non reconnue → obtenu '$(champ APPLICABLE)'"

# =================================================================
# 6. G/W/T #6 — la source est cassée → NON_MESURE, DISTINCT de PASSE et REFUS.
# =================================================================
executer "VBC_BRIEF_TEXTE=$(brief "$FIX_ADR_TITRE" "$FIX_BRD_APPLI" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_PRESENTE")" \
  "VBC_SOURCE_CASSEE=oui"
for CHAMP in ADR BRD ONTOLOGIE APPLICABLE; do
  V="$(champ "$CHAMP")"
  if [ "$V" = "NON_MESURE" ]; then :; else ko "VBC_SOURCE_CASSEE=oui → $CHAMP attendu NON_MESURE, obtenu '$V'"; CASSEE_KO=1; fi
  [ "$V" = "PASSE" ] && { ko "$CHAMP=NON_MESURE est confondu avec PASSE"; CASSEE_KO=1; }
  [ "$V" = "REFUS" ] && { ko "$CHAMP=NON_MESURE est confondu avec REFUS"; CASSEE_KO=1; }
done
[ "${CASSEE_KO:-0}" = "0" ] \
  && ok "source cassée → les 4 champs sont NON_MESURE, littéralement distinct de PASSE et REFUS" || true
[ "$(champ VERDICT)" = "NON_MESURE" ] && [ "$RC" = "4" ] \
  && ok "verdict global NON_MESURE, rc=4" \
  || ko "verdict global attendu NON_MESURE/rc4, obtenu '$(champ VERDICT)'/rc $RC"

# =================================================================
# LE POINT SENSIBLE DU LOT : texte vide + VBC_SOURCE_CASSEE=non EXPLICITE
# → REFUS sur les 4 champs (on A LU, et c'est vide), PAS NON_MESURE.
# C'est le discriminant « on n'a pas pu lire » (NON_MESURE) vs « on a lu,
# et c'est vide/absent » (REFUS) — le G/W/T #6 ne couvre QUE le premier
# cas ; sans ce test explicite, un mutant qui traite toujours un texte vide
# comme NON_MESURE (même avec source_cassee=non explicite) passerait.
# =================================================================
executer "VBC_BRIEF_TEXTE=" "VBC_SOURCE_CASSEE=non"
for CHAMP in ADR BRD APPLICABLE; do
  V="$(champ "$CHAMP")"
  [ "$V" = "REFUS" ] || { ko "texte vide + source_cassee=non explicite → $CHAMP attendu REFUS, obtenu '$V'"; VIDE_KO=1; }
done
[ "${VIDE_KO:-0}" = "0" ] \
  && ok "texte vide + VBC_SOURCE_CASSEE=non EXPLICITE → REFUS sur les champs (jamais NON_MESURE : on a lu, et c'est vide)" || true
[ "$(champ VERDICT)" = "REFUS" ] && [ "$RC" = "2" ] \
  && ok "verdict global REFUS (pas NON_MESURE) quand le vide est confirmé explicitement" \
  || ko "attendu REFUS/rc2 sur texte vide confirmé, obtenu '$(champ VERDICT)'/rc $RC"

# Par contraste : texte vide SANS VBC_SOURCE_CASSEE positionnée du tout →
# prudence, NON_MESURE (on ne sait pas si le brief a vraiment pu être lu).
executer "VBC_BRIEF_TEXTE="
[ "$(champ VERDICT)" = "NON_MESURE" ] && [ "$RC" = "4" ] \
  && ok "texte vide SANS VBC_SOURCE_CASSEE positionnée → NON_MESURE par prudence (distinct du cas explicite ci-dessus)" \
  || ko "texte vide, source_cassee non positionnée → attendu NON_MESURE/rc4, obtenu '$(champ VERDICT)'/rc $RC"

# =================================================================
# 7. G/W/T #7 (mesure hors-banc, non applicable ici — voir corpus réel).
#    Ici : un brief CONFORME COMPLET → VERDICT=PASSE, MOTIF vide.
# =================================================================
executer "VBC_BRIEF_TEXTE=$(brief "$FIX_ADR_TITRE" "$FIX_BRD_APPLI" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_PRESENTE")"
[ "$(champ VERDICT)" = "PASSE" ] \
  && ok "brief conforme complet (les 4 présents et bien formés) → VERDICT=PASSE" \
  || ko "brief conforme → attendu PASSE, obtenu '$(champ VERDICT)'"
[ "$RC" = "0" ] && ok "verdict PASSE → rc=0" || ko "rc attendu 0, obtenu $RC"
[ -z "$(champ MOTIF)" ] \
  && ok "aucun motif quand tout PASSE" \
  || ko "un motif est rendu alors que tout PASSE : $(champ MOTIF)"

# =================================================================
# Le motif énumère TOUS les champs en REFUS, pas seulement le premier.
# =================================================================
BRIEF_DEUX_REFUS="$(printf '## BRD\n\n%s\n\n%s\n\n%s\n' \
  "$FIX_BRD_APPLI" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_ABSENTE")"
executer "VBC_BRIEF_TEXTE=${BRIEF_DEUX_REFUS}"
[ "$(champ VERDICT)" = "REFUS" ] && [ "$RC" = "2" ] \
  && ok "deux champs en REFUS → verdict global REFUS, rc=2" \
  || ko "attendu REFUS/rc2, obtenu '$(champ VERDICT)'/rc $RC"
case "$(champ MOTIF)" in *ADR*APPLICABLE*|*APPLICABLE*ADR*) ok "le motif nomme les DEUX champs en REFUS (ADR et APPLICABLE), pas seulement le premier" ;;
  *) ko "le motif ne nomme pas les deux champs en REFUS : $(champ MOTIF)" ;; esac

# =================================================================
# Exécution directe : lecture de VBC_BRIEF_TEXTE depuis stdin quand la
# variable n'est pas positionnée.
# =================================================================
BRIEF_STDIN="$(brief "$FIX_ADR_TITRE" "$FIX_BRD_APPLI" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_PRESENTE")"
SORTIE_STDIN="$(printf '%s' "$BRIEF_STDIN" | env -u VBC_BRIEF_TEXTE bash "$LIB")"
RC_STDIN=$?
printf '%s\n' "$SORTIE_STDIN" | grep -q '^VERDICT=PASSE$' \
  && ok "exécution directe : le texte est lu sur stdin quand VBC_BRIEF_TEXTE n'est pas positionnée" \
  || ko "lecture stdin en échec : $SORTIE_STDIN"
[ "$RC_STDIN" = "0" ] && ok "le code de retour de l'exécution directe reflète le verdict (0=PASSE)" \
  || ko "rc de l'exécution directe attendu 0, obtenu $RC_STDIN"

# =================================================================
# Garde d'interpréteur — sourcé depuis ZSH (pas bash), un brief pourtant
# CONFORME doit rendre NON_MESURE, jamais un REFUS silencieux.
#
# Défaut réel trouvé par une mesure indépendante sur le corpus réel de ce
# dépôt (2026-09-22) : sourcé nativement dans un shell zsh (le shell par
# défaut de ce poste), `${s:i:1}` échoue avec « unrecognized modifier 'i'' »
# — une erreur que zsh avale sans jamais la remonter — et
# `vbc_minuscules`/`vbc_normaliser_recherche` rendent alors un texte
# cassé, ce qui faisait tomber LES 4 CHAMPS en REFUS, y compris sur un
# brief conforme. C'est le pire résultat que ce fichier existe pour
# empêcher : une garde aveugle rendant son verdict le plus sévère sans le
# signaler.
# =================================================================
if command -v zsh >/dev/null 2>&1; then
  BRIEF_CONFORME_ZSH="$(brief "$FIX_ADR_TITRE" "$FIX_BRD_APPLI" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_PRESENTE")"
  SORTIE_ZSH="$(VBC_BRIEF_TEXTE="$BRIEF_CONFORME_ZSH" VBC_SOURCE_CASSEE=non VBC_TOUCHE_ONTOLOGIE=oui \
    zsh -c "source '$LIB'; vbc_verifier" 2>&1)"
  RC_ZSH=$?
  printf '%s\n' "$SORTIE_ZSH" | grep -q '^VERDICT=NON_MESURE$' \
    && ok "sourcé depuis zsh (brief pourtant CONFORME) → VERDICT=NON_MESURE, jamais un REFUS silencieux" \
    || ko "sous zsh, attendu NON_MESURE, obtenu : $SORTIE_ZSH"
  [ "$RC_ZSH" = "4" ] \
    && ok "code de retour sous zsh = 4 (même famille que VBC_SOURCE_CASSEE=oui)" \
    || ko "rc sous zsh attendu 4, obtenu $RC_ZSH"
  printf '%s\n' "$SORTIE_ZSH" | grep -qi "n est pas bash" \
    && ok "le motif nomme explicitement l'interpréteur en cause" \
    || ko "motif zsh peu clair ou absent : $SORTIE_ZSH"
else
  echo "  ⚠️ zsh indisponible sur ce poste d'exécution — le mécanisme de la garde d'interpréteur n'a PAS pu être éprouvé en conditions réelles ici (couvert autrement par la mutation ci-dessous, qui simule l'absence de BASH_VERSION sous bash)."
fi

# =================================================================
# EXÉCUTION DIRECTE sous ZSH (pas un `source` — repro EXACTE du défaut
# réel trouvé par une revue indépendante, adversariale, 2026-09-22) :
# `zsh verifie-brief-chef.sh < entree`. Le cas ci-dessus (sourcé) ne
# couvre PAS ce chemin : `BASH_SOURCE` est un tableau bash-only, TOUJOURS
# vide sous zsh, donc `[ "${BASH_SOURCE[0]}" = "${0}" ]` était
# PERPÉTUELLEMENT faux sous zsh — y compris en exécution DIRECTE — et le
# bloc du bas du fichier restait sauté : `vbc_verifier` n'était JAMAIS
# appelée, sa propre garde BASH_VERSION n'était donc jamais atteinte.
# Résultat mesuré AVANT correctif : rc=0, ZÉRO ligne de sortie — un succès
# silencieux et totalement faux, pire que le cas sourcé ci-dessus (qui
# rendait au moins un REFUS visible).
# =================================================================
if command -v zsh >/dev/null 2>&1; then
  BRIEF_CONFORME_EXEC_DIRECT="$(brief "$FIX_ADR_TITRE" "$FIX_BRD_APPLI" "$FIX_ONTO_PRESENTE" "$FIX_APPLICABLE_PRESENTE")"
  SORTIE_EXEC_DIRECT_ZSH="$(printf '%s' "$BRIEF_CONFORME_EXEC_DIRECT" | zsh "$LIB" 2>&1)"
  RC_EXEC_DIRECT_ZSH=$?
  printf '%s\n' "$SORTIE_EXEC_DIRECT_ZSH" | grep -q '^VERDICT=NON_MESURE$' \
    && ok "exécution DIRECTE sous zsh (zsh fichier.sh < entree, brief pourtant CONFORME) → VERDICT=NON_MESURE, jamais rc=0 silencieux" \
    || ko "exécution directe zsh : attendu NON_MESURE, obtenu : $SORTIE_EXEC_DIRECT_ZSH (rc=$RC_EXEC_DIRECT_ZSH)"
  [ "$RC_EXEC_DIRECT_ZSH" = "4" ] \
    && ok "code de retour de l'exécution directe sous zsh = 4 (jamais 0 — le défaut réel produisait rc=0)" \
    || ko "rc de l'exécution directe sous zsh attendu 4, obtenu $RC_EXEC_DIRECT_ZSH"
  [ -n "$SORTIE_EXEC_DIRECT_ZSH" ] \
    && ok "au moins une ligne de sortie (le défaut réel produisait ZÉRO ligne)" \
    || ko "aucune ligne de sortie — le défaut du dispatch bas de fichier n'est pas corrigé"
else
  echo "  ⚠️ zsh indisponible sur ce poste d'exécution — le test d'exécution directe sous zsh n'a PAS pu être éprouvé en conditions réelles ici."
fi

echo
echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
