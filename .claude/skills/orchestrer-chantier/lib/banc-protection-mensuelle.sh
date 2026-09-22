#!/usr/bin/env bash
# ============================================================
# banc-protection-mensuelle.sh — v1.0.0
# Garde 5/5 (dernière) du lot 4 (D-20260921-0017), T-20260922-0106.
# L'INSTRUMENT qui mesure si les gardes 1 à 4 tiennent, et si le reste du
# corpus ADR/STD est protégé ou non.
#
# POURQUOI CE FICHIER EXISTE
# Les 4 gardes précédentes du lot (STD-038, STD-030 §/merge, STD-029,
# GF-ORC-013) ont chacune transformé UNE règle de prose en mécanisme. Rien
# ne mesurait, avant ce fichier, si ces 4 mécanismes tiennent RÉELLEMENT
# dans le temps (un fichier peut être renommé, un test supprimé, sans que
# personne ne s'en aperçoive), ni où en est le reste du corpus (ADR/STD)
# resté en prose. Ce fichier ne répare rien — il classe :
#   protege | prose | contredit | non_etabli
#
# CE QUE CE FICHIER NE FAIT PAS
#   • Aucun appel réseau ni MCP. Le corpus (statuts ADR/STD, dates de
#     source, mécanismes connus) arrive déjà lu, dans un JSON fourni par
#     l'appelant (BPM_CORPUS_JSON) — même parti pris que
#     verifie-brief-chef.sh : ce fichier ne peut pas joindre Somcraft.
#   • Il ne rend JAMAIS `absent` — une recherche vide dans CE dépôt, sur CE
#     corpus, ne prouve pas que la règle n'existe nulle part ailleurs
#     (autre dépôt, poste, Somcraft) : le verdict honnête est `non_etabli`.
#   • Il ne bloque rien — hors-scope explicite du ticket (mesurer, pas
#     arbitrer).
#   • La classification RÉELLE (grep, git log, existence fichier) vit dans
#     le compagnon python (BPM_PY, défaut banc-protection-mensuelle.py à
#     côté de ce fichier) — même construction que
#     staging-secret-key-gate.sh / secret-key-scan.py (règle d'or n°15,
#     on ne réinvente pas une 3e forme).
#
# LIMITE CONNUE — seules 8 des ~67 règles du corpus ont un mécanisme connu
# ou une contradiction vérifiés à la main (voir corpus-adr-std.json,
# `verifie_a_la_main`) ; les autres sont classées par une heuristique
# générique (citation trouvée + type de fichier) qui n'a PAS été auditée
# une par une — documenté explicitement dans le banc corpus, jamais caché.
#
# ENTRÉES (variables d'environnement)
#   BPM_CORPUS_JSON     chemin du JSON du corpus (OBLIGATOIRE). Absent,
#                       illisible ou JSON invalide -> ÉCHEC BRUYANT (rc=3),
#                       message clair sur stderr, ZÉRO ligne de classement
#                       sur stdout (jamais un classement partiel qui
#                       ressemble à un classement complet).
#   BPM_RACINE_DEPOT    racine du dépôt à grep (def: .).
#   BPM_ETAT_PRECEDENT  chemin d'un état JSON d'un passage précédent
#                       (optionnel). Absent au premier passage -> le script
#                       le dit explicitement (PREMIER_PASSAGE), jamais une
#                       erreur.
#   BPM_ETAT_SORTIE     chemin où écrire le classement complet en JSON
#                       (optionnel), pour servir de BPM_ETAT_PRECEDENT au
#                       prochain appel.
#   BPM_SOURCE_CASSEE   oui|non (def: non). `oui` FORCE le mode source
#                       cassée même si BPM_CORPUS_JSON est lisible — c'est
#                       l'APPELANT qui sait que le corpus qu'il fournit est
#                       partiel/périmé (ex. Somcraft injoignable au moment
#                       où le corpus a été composé) ; ce script ne peut pas
#                       le savoir lui-même puisqu'il ne fait aucun appel
#                       réseau. `oui` -> AUCUN classement, seulement
#                       VERDICT_GLOBAL=SOURCE_CASSEE + MOTIF.
#   BPM_PY              chemin du compagnon python (def: à côté de ce
#                       fichier).
#
# SORTIE (CLE=VALEUR sur stdout, ordre stable) — voir aussi
# banc-protection-mensuelle.py pour le détail de la classification.
#   REGLE_<ID>_CLASSE=protege|prose|contredit|non_etabli   (pour chaque
#     entrée du corpus, <ID> = id sanitisé, non-alphanumériques -> `_`)
#   REGLE_<ID>_MECANISME=<chemin>          (seulement si CLASSE=protege)
#   REGLE_<ID>_DATE_A=... / _DATE_B=...    (seulement si CLASSE=contredit —
#     DATE_A = date_source du texte ADR/STD (JSON) ; DATE_B = date du
#     DERNIER COMMIT GIT touchant le fichier contredisant, mesurée EN
#     DIRECT à l'exécution — jamais une date figée dans le JSON)
#   TEMOIN_POSITIF=OK|ECHEC                (+ TEMOIN_POSITIF_DETAIL si ECHEC)
#   ECART_PRECEDENT=PREMIER_PASSAGE | AUCUN | <id>:<ancien>-><nouveau>,...
#   VERDICT_GLOBAL=OK|SOURCE_CASSEE        (jamais un classement si SOURCE_CASSEE)
#
# CODES DE RETOUR
#   0  classement produit (VERDICT_GLOBAL=OK) — voir TEMOIN_POSITIF pour un
#      signal séparé si l'auto-contrôle du lot 4 échoue.
#   3  BPM_CORPUS_JSON absent/illisible/invalide — ÉCHEC de configuration,
#      pas un verdict. Rien sur stdout.
#   4  BPM_SOURCE_CASSEE=oui — VERDICT_GLOBAL=SOURCE_CASSEE émis, rc=4.
#   2  python3 introuvable — FAIL-CLOSED, jamais un skip silencieux (même
#      parti pris que staging-secret-key-gate.sh).
# ============================================================
set -u

bpm_run() {
  local corpus="${BPM_CORPUS_JSON:-}"
  local racine="${BPM_RACINE_DEPOT:-.}"
  local etat_precedent="${BPM_ETAT_PRECEDENT:-}"
  local etat_sortie="${BPM_ETAT_SORTIE:-}"
  local source_cassee
  source_cassee="$(printf '%s' "${BPM_SOURCE_CASSEE:-non}" | tr '[:upper:]' '[:lower:]' | sed 's/^ *//; s/ *$//')"
  local py="${BPM_PY:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/banc-protection-mensuelle.py}"

  # ---- Gate 1 : source déclarée cassée par l'appelant — AVANT toute
  # lecture du corpus. Aucun classement ne doit sortir. ----
  if [ "$source_cassee" = "oui" ]; then
    echo "VERDICT_GLOBAL=SOURCE_CASSEE"
    echo "MOTIF=BPM_SOURCE_CASSEE=oui — la source du corpus est declaree cassee par l'appelant, aucune regle n'est mesurable"
    return 4
  fi

  # ---- Gate 2 : corpus obligatoire, lisible, JSON valide. Échec bruyant,
  # rien sur stdout, message clair sur stderr. ----
  if [ -z "$corpus" ]; then
    echo "bpm: ERREUR — BPM_CORPUS_JSON n'est pas positionnee. Aucun classement ne peut etre produit sans corpus." >&2
    return 3
  fi
  if [ ! -f "$corpus" ]; then
    echo "bpm: ERREUR — corpus introuvable: ${corpus}" >&2
    return 3
  fi
  if ! command -v python3 >/dev/null 2>&1; then
    echo "bpm: ERREUR — python3 introuvable, impossible de verifier le corpus (FAIL-CLOSED, jamais un skip silencieux)." >&2
    return 2
  fi
  local err_tmp
  err_tmp="$(mktemp 2>/dev/null || echo "/tmp/.bpm_json_err.$$")"
  if ! python3 -c "import json,sys; json.load(open(sys.argv[1], encoding='utf-8'))" "$corpus" 2>"$err_tmp"; then
    echo "bpm: ERREUR — corpus JSON invalide: ${corpus}" >&2
    cat "$err_tmp" >&2 2>/dev/null
    rm -f "$err_tmp" 2>/dev/null
    return 3
  fi
  rm -f "$err_tmp" 2>/dev/null

  if [ ! -f "$py" ]; then
    echo "bpm: ERREUR — compagnon python introuvable: ${py}" >&2
    return 3
  fi

  python3 "$py" "$corpus" "$racine" "${etat_precedent:--}" "${etat_sortie:--}"
  return $?
}

bpm__executee_directement() {
  if [ -n "${BASH_VERSION:-}" ]; then
    [ "${BASH_SOURCE[0]}" = "${0}" ]
    return
  fi
  ! (return 0 2>/dev/null)
}

if bpm__executee_directement; then
  bpm_run
  exit $?
fi
