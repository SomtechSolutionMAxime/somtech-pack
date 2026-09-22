#!/usr/bin/env bash
# ============================================================
# test-verifie-brief-chef-corpus.sh — v1.0.0
# Banc « corpus réel » de `verifie-brief-chef.sh` — T-20260922-0098,
# garde 4/5 du lot 4 (D-20260921-0017).
#
# POURQUOI CE FICHIER EXISTE
# Le ticket exige « les deux chiffres, sur les briefs RÉELS de ce dépôt,
# pas sur des cas fabriqués » : combien de briefs non conformes sont
# attrapés, ET combien de briefs conformes sont refusés à tort. Ce banc
# REJOUE ce calcul à chaque exécution — les deux chiffres ne sont pas
# gelés dans un commentaire de ticket, ils sont PRODUITS par ce fichier.
#
# LE CORPUS
# 6 fixtures sous fixtures/briefs-reels-concat/, chacune la CONCATÉNATION
# de la description du ticket ServiceDesk + le contenu intégral de son
# commentaire « # BRIEF... » (le vrai brief de naissance, pas un compte
# rendu de clôture) — copie exacte, aucune paraphrase. C'est la TOTALITÉ
# des briefs de naissance de chef d'équipe qui existent dans ce dépôt au
# 2026-09-22 (mesuré par recherche exhaustive sur l'application Somtech
# Pack, cf. rapport d'extraction — la pratique « ticket ouvert AVANT la
# naissance du chef, avec un commentaire # BRIEF » est née le jour même
# dans le lot 4 ; 6 échantillons est la population réelle, pas un
# échantillonnage).
#
# DÉCISION DE CONCEPTION — « le brief » = description + commentaire
# Le commentaire de brief seul omet souvent la section « ce qui
# s'applique ici » (portée par la DESCRIPTION du ticket dans ce dépôt) et
# ne répète jamais le mot « BRD ». Vérifier le commentaire SEUL aurait
# refusé à tort des briefs dont le chef reçoit bel et bien la référence
# par écrit — juste dans un champ différent du même ticket. C'est
# exactement ce que ce chef d'équipe a lu lui-même à sa propre naissance
# (« lis le ticket EN ENTIER, description ET ses G/W/T, PUIS le
# commentaire de brief ») : la description et le commentaire sont, dans
# ce dépôt, les DEUX moitiés d'un seul document reçu par le chef.
#
# GROUND TRUTH — jugée à la main, PUIS comparée au verdict du script
# (jamais l'inverse — la vérité ne se déduit pas du programme qu'on
# éprouve). Contexte partagé par les 6 : aucun des 6 lots ne porte de
# `module_id` (vérifié sur le JSON brut de chaque ticket, tous `null`),
# et aucun ne touche une entité/relation/attribut applicatif — ce sont
# tous des lots d'infrastructure/gouvernance du pack lui-même (gates
# shell, statuts ServiceDesk, préflight, persona d'orchestrateur), donc
# `VBC_TOUCHE_ONTOLOGIE=non` pour les 6 (fait sur le PÉRIMÈTRE, jugé par
# lecture, jamais déduit du texte).
#
#   T-20260922-0010 (lot 2a annuaire) — NON CONFORME. Aucune mention
#     d'ADR, de BRD, ni de section applicable, nulle part (description ET
#     commentaire) — absence totale, pas une omission de forme.
#   T-20260922-0059 (lot 3, métier orchestrateur) — NON CONFORME.
#     Aucune mention d'ADR nulle part. (BRD et « applicable » y
#     apparaissent, mais comme SUJET du travail — « le workflow BRD »,
#     « le chapitre ce-qui-s-applique-ici » — pas comme référence
#     appliquée à CE lot ; le script les compte PASSE par simple
#     présence, conforme au contrat écrit du ticket — hors-scope :
#     « vérifie qu'elles sont citées, pas qu'elles sont justes ». Mais
#     l'ADR absent suffit seul à rendre ce brief non conforme.)
#   T-20260922-0072 (garde 1/5) — NON CONFORME. ADR `[non établi]` avec
#     motif réel (conforme) ; BRD et section applicable absentes des
#     deux champs, sans ambiguïté.
#   T-20260922-0084 (garde 2/5) — NON CONFORME. Même profil que 0072 :
#     ADR conforme, BRD et applicable absents.
#   T-20260922-0093 (garde 3/5) — NON CONFORME. ADR conforme, section
#     applicable présente (portée par la description). BRD absent des
#     deux champs — un vrai trou, y compris dans ce qui est par ailleurs
#     le brief le mieux structuré du lot avant celui-ci.
#   T-20260922-0098 (garde 4/5, CE ticket) — CONFORME. ADR `[non établi]`
#     motivé, section applicable présente, ET « STD-033 (BRD au bon
#     grain, règle d'or 10) » cité dans la description — la seule
#     citation réelle de BRD des 6 échantillons.
#
# Usage : bash scripts/tests/test-verifie-brief-chef-corpus.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LIB="${VBC_LIB:-${ROOT}/.claude/skills/orchestrer-chantier/lib/verifie-brief-chef.sh}"
FIXTURES="${SCRIPT_DIR}/fixtures/briefs-reels-concat"

[ -f "$LIB" ] || { echo "❌ lib absente: $LIB"; exit 1; }
[ -d "$FIXTURES" ] || { echo "❌ fixtures absentes: $FIXTURES"; exit 1; }
# shellcheck source=/dev/null
source "$LIB"

PASS=0; FAIL=0

# ticket_id -> "CONFORME" | "NON_CONFORME"  (ground truth, jugée à la main — voir en-tête)
verite_attendue() {
  case "$1" in
    T-20260922-0010) echo "NON_CONFORME" ;;
    T-20260922-0059) echo "NON_CONFORME" ;;
    T-20260922-0072) echo "NON_CONFORME" ;;
    T-20260922-0084) echo "NON_CONFORME" ;;
    T-20260922-0093) echo "NON_CONFORME" ;;
    T-20260922-0098) echo "CONFORME" ;;
    *) echo "" ;;
  esac
}

echo "== Corpus réel — 6/6 briefs de naissance de chef d'équipe existants dans ce dépôt =="

N_CONFORMES=0
N_NON_CONFORMES=0
N_ATTRAPES=0
N_REFUSES_A_TORT=0

for f in "$FIXTURES"/T-*.md; do
  ticket="$(basename "$f" .md)"
  attendu="$(verite_attendue "$ticket")"
  if [ -z "$attendu" ]; then
    FAIL=$((FAIL+1))
    echo "  ❌ ${ticket} : aucune vérité attendue déclarée dans ce banc — fixture orpheline, ground truth manquante"
    continue
  fi

  OUT="$(VBC_BRIEF_TEXTE="$(cat "$f")" VBC_SOURCE_CASSEE=non VBC_TOUCHE_ONTOLOGIE=non VBC_MODULE_ID= vbc_verifier)"
  verdict="$(printf '%s\n' "$OUT" | sed -n 's/^VERDICT=//p')"

  # Un NON_MESURE ici serait déjà une anomalie du banc lui-même (la
  # lecture de fixture ne devrait jamais casser la source) — traité comme
  # un échec de l'assertion, pas comme un des deux chiffres.
  case "$verdict" in
    NON_MESURE)
      FAIL=$((FAIL+1))
      echo "  ❌ ${ticket} : NON_MESURE inattendu sur une fixture lisible — $(printf '%s\n' "$OUT" | sed -n 's/^MOTIF=//p')"
      continue
      ;;
  esac

  if [ "$attendu" = "CONFORME" ]; then
    N_CONFORMES=$((N_CONFORMES+1))
    if [ "$verdict" = "PASSE" ]; then
      PASS=$((PASS+1))
      echo "  ✅ ${ticket} : conforme (jugé à la main), et le script le laisse PASSER — pas de refus à tort"
    else
      FAIL=$((FAIL+1))
      N_REFUSES_A_TORT=$((N_REFUSES_A_TORT+1))
      echo "  ❌ ${ticket} : REFUS À TORT — jugé conforme à la main, mais le script rend ${verdict} : $(printf '%s\n' "$OUT" | sed -n 's/^MOTIF=//p')"
    fi
  else
    N_NON_CONFORMES=$((N_NON_CONFORMES+1))
    if [ "$verdict" = "REFUS" ] || [ "$verdict" = "SIGNALE" ]; then
      PASS=$((PASS+1))
      N_ATTRAPES=$((N_ATTRAPES+1))
      echo "  ✅ ${ticket} : non conforme (jugé à la main), attrapé (${verdict}) — $(printf '%s\n' "$OUT" | sed -n 's/^MOTIF=//p')"
    else
      FAIL=$((FAIL+1))
      echo "  ❌ ${ticket} : NON ATTRAPÉ — jugé non conforme à la main, mais le script rend PASSE"
    fi
  fi
done

echo
echo "== Les deux chiffres, sur le corpus réel (${N_NON_CONFORMES} non conformes + ${N_CONFORMES} conforme(s), 6 au total) =="
echo "Non conformes attrapés   : ${N_ATTRAPES} / ${N_NON_CONFORMES}"
echo "Conformes refusés à tort : ${N_REFUSES_A_TORT} / ${N_CONFORMES}"
echo
echo "Assertions JOUÉES : $((PASS + FAIL))  —  ${PASS} OK, ${FAIL} KO"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
