#!/usr/bin/env bash
# ============================================================
# verifie-brief-chef.sh — v1.0.0
# Contrôle du brief de naissance d'un chef d'équipe — garde 4/5 du lot 4
# (D-20260921-0017), T-20260922-0098. Réalise GF-ORC-013 (« couche à
# construire », métier de l'orchestrateur).
#
# POURQUOI CE FICHIER EXISTE
# Rien ne refuse aujourd'hui un brief de chef d'équipe qui part sans son
# cadre. La violation d'architecture la plus fréquente est celle par
# ignorance : un chef qui n'a pas reçu l'ADR applicable ne la viole pas par
# choix, il ne sait pas qu'elle existe.
#
# 🔴 LA DIFFICULTÉ QUE CE FICHIER RÉSOUT, ET CE N'EST PAS LA DÉTECTION ELLE-MÊME
# `[non établi]` est une réponse VALIDE — le miroir des ADR est incomplet.
# Un contrôle qui refuse `[non établi]` pousse les orchestrateurs à INVENTER
# une référence pour passer la garde : le pire résultat possible, une garde
# qui fabrique la fausseté qu'elle prétend empêcher. Le discriminant construit
# ici distingue « le champ est absent » (REFUS) de « le champ dit
# explicitement que la chose n'a pas pu être établie, AVEC un motif » (PASSE) —
# `[non établi]` seul, sans motif, reste un REFUS : le marqueur n'excuse pas
# l'absence d'explication.
#
# CE QUE CE FICHIER NE FAIT PAS
#   • Aucun appel réseau/MCP. Tout arrive par variable d'environnement — le
#     ServiceDesk, seul l'appelant peut le joindre (même parti pris que
#     `attente-au-sas.sh`).
#   • Il ne rend RIEN bloquant : ce lot SIGNALE, bloquer la naissance d'un
#     chef est un arbitrage du dirigeant (hors-scope explicite du ticket).
#   • Il ne vérifie pas le CONTENU des listes « ce qui s'applique ici » —
#     seulement qu'elles sont citées.
#
# ENTRÉES (variables d'environnement — points d'injection des tests)
#   VBC_BRIEF_TEXTE      texte intégral du brief (peut être multi-lignes).
#                        Non positionnée à l'exécution directe → lue sur
#                        stdin. Positionnée mais vide = un texte réellement
#                        vide (pas la même chose que « non positionnée »).
#   VBC_SOURCE_CASSEE    oui|non — défaut non. `oui` court-circuite tout :
#                        les 4 champs et le verdict global valent NON_MESURE.
#                        Un texte vide/absent alors que cette variable n'est
#                        PAS explicitement `non` est traité par PRUDENCE
#                        comme une source cassée (NON_MESURE) — on ne sait
#                        pas si l'absence vient d'une vraie lecture ou d'un
#                        appel qui n'a jamais abouti. Si VBC_SOURCE_CASSEE=non
#                        est EXPLICITE et le texte est vide, c'est un texte
#                        réellement vide : REFUS sur les 4 champs (rien n'y
#                        est), jamais NON_MESURE.
#   VBC_MODULE_ID        optionnel. Vide = ticket au grain application.
#   VBC_TOUCHE_ONTOLOGIE oui|non|inconnu (défaut inconnu/vide). C'est un FAIT
#                        sur le périmètre du lot, jamais déduit du texte —
#                        seul l'appelant le connaît. Vide/inconnu est traité
#                        CONSERVATIVEMENT comme `oui` (le check s'applique) :
#                        un `[non applicable]` ne doit jamais être un défaut
#                        silencieux.
#
# SORTIE (lignes CLE=VALEUR sur stdout, DANS CET ORDRE) et CODE RETOUR
#   ADR=PASSE|REFUS|SIGNALE|NON_MESURE
#   BRD=PASSE|REFUS|NON_MESURE
#   ONTOLOGIE=PASSE|REFUS|NON_APPLIQUE|NON_MESURE
#   APPLICABLE=PASSE|REFUS|NON_MESURE
#   VERDICT=PASSE|SIGNALE|REFUS|NON_MESURE
#   MOTIF=<nomme les champs en cause — TOUS les REFUS, pas seulement le
#          premier — vide si VERDICT=PASSE>
#
#   rc=0 PASSE · rc=1 SIGNALE · rc=2 REFUS (au moins un champ REFUS,
#   priorité sur SIGNALE) · rc=4 NON_MESURE (source cassée OU interpréteur
#   non-bash détecté — voir note ci-dessous).
#
# ⚠️ BASH REQUIS — GARDE D'INTERPRÉTEUR
# Ce fichier utilise des constructions bash-only. Sourcé depuis un AUTRE
# interpréteur (zsh notamment, shell par défaut sur macOS), ces
# constructions échouent SILENCIEUSEMENT et produisaient, avant cette
# garde, un REFUS sur les 4 champs même pour un brief conforme — le pire
# verdict, rendu sans le signaler. `vbc_verifier` détecte l'absence de
# `BASH_VERSION` (positionnée uniquement par bash) en tout premier geste et
# rend NON_MESURE plutôt qu'un verdict de confiance. Un appelant qui source
# ce fichier doit le faire depuis bash (`bash -c '...'`, ou un script dont
# le shebang est `#!/usr/bin/env bash`), jamais depuis un `source`/`.` fait
# nativement dans un shell zsh.
#
# Sourçable (vbc_verifier) ou exécution directe, lisant VBC_BRIEF_TEXTE
# depuis l'environnement OU depuis stdin si elle n'est pas positionnée.
# ============================================================

# Seuil, en caractères utiles (lettres/chiffres, ASCII une fois les accents
# repliés), qu'un motif doit porter AU-DELÀ du seul marqueur/numéro pour
# compter comme une explication réelle plutôt qu'un ornement. Constante
# nommée — pas de magie inline — pour rester un point de mutation isolé.
VBC_SEUIL_MOTIF=15

# Fenêtre de proximité (en caractères, de part et d'autre de « brd ») dans
# laquelle une indication de grain module est recherchée. Volontairement
# borné : un « module » cité à l'autre bout d'un long brief ne prouve rien
# sur LE BRD qui y est mentionné.
VBC_FENETRE_PROXIMITE=80

# Motif d'une référence ADR par numéro nu : « ADR », 0 à 2 séparateurs
# (tiret, souligné, espace), puis 2 à 4 chiffres. Volontairement simple —
# ce contrôle est un révélateur heuristique, pas un analyseur strict du
# registre d'architecture.
VBC_ADR_NUM_REGEX='adr[-_[:space:]]*[0-9]{2,4}'

# --------------------------------------------------------------
# Aides bas niveau — mêmes partis pris que attente-au-sas.sh (`ats_*`) :
# LC_ALL=C en `local` dans chaque fonction, jamais exporté au fichier ; pas
# de sed/tr/dépendance externe.
# --------------------------------------------------------------

# vbc_trim <texte> — retire les espaces de tête ET de queue.
vbc_trim() {
  local LC_ALL=C
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

# vbc_minuscules <texte> — repli de casse ASCII, octet par octet. Les octets
# non-ASCII (accents déjà repliés en amont, ou non) traversent inchangés.
vbc_minuscules() {
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

# vbc_normaliser_recherche <texte> — la seule fonction que ce fichier utilise
# pour COMPARER du texte : replie casse et accents français courants vers
# l'ASCII, retire les variantes d'apostrophe/accent grave (même parti pris
# que `ats_normaliser` — « s'applique »/« s’applique »/« s`applique »
# deviennent tous « sapplique »). Les sauts de ligne sont PRÉSERVÉS : les
# vérifications ADR en dépendent pour borner une section.
# Substitutions littérales (${s//X/Y}), jamais une classe de caractères —
# une classe dépend de la locale, une substitution littérale non.
vbc_normaliser_recherche() {
  local LC_ALL=C
  local s="$1"
  s="${s//\'/}"; s="${s//\`/}"; s="${s//’/}"
  s="${s//é/e}"; s="${s//è/e}"; s="${s//ê/e}"; s="${s//ë/e}"
  s="${s//à/a}"; s="${s//â/a}"; s="${s//ä/a}"
  s="${s//î/i}"; s="${s//ï/i}"
  s="${s//ô/o}"; s="${s//ö/o}"
  s="${s//û/u}"; s="${s//ü/u}"
  s="${s//ç/c}"
  s="${s//É/E}"; s="${s//È/E}"; s="${s//Ê/E}"; s="${s//Ë/E}"
  s="${s//À/A}"; s="${s//Â/A}"; s="${s//Ä/A}"
  s="${s//Î/I}"; s="${s//Ï/I}"
  s="${s//Ô/O}"; s="${s//Ö/O}"
  s="${s//Û/U}"; s="${s//Ü/U}"
  s="${s//Ç/C}"
  vbc_minuscules "$s"
}

# vbc_compter_utiles <texte-normalisé> — nombre d'octets [a-z0-9], ponctuation
# et markdown exclus. Sert de mesure de « contenu réel » indépendante de la
# mise en forme (gras, puces, deux-points…).
vbc_compter_utiles() {
  local LC_ALL=C
  local s="$1" n=0 i c
  for (( i=0; i<${#s}; i++ )); do
    c="${s:i:1}"
    case "$c" in
      [a-z0-9]) n=$((n+1)) ;;
    esac
  done
  printf '%s' "$n"
}

# vbc_a_reference_numerique <texte-normalisé> — vrai si un motif « ADR-NNN »
# (2 à 4 chiffres) y apparaît.
vbc_a_reference_numerique() {
  local LC_ALL=C
  local texte="$1"
  [[ "$texte" =~ $VBC_ADR_NUM_REGEX ]]
}

# vbc_retirer_references_numeriques <texte-normalisé> — retire chaque
# occurrence du motif « ADR-NNN », pour isoler ce qui RESTE (le titre/motif
# éventuel) et juger s'il y a autre chose qu'un numéro nu.
vbc_retirer_references_numeriques() {
  local LC_ALL=C
  local texte="$1" m
  while [[ "$texte" =~ $VBC_ADR_NUM_REGEX ]]; do
    m="${BASH_REMATCH[0]}"
    texte="${texte/"$m"/}"
  done
  printf '%s' "$texte"
}

# --------------------------------------------------------------
# Les 4 champs — chacun imprime deux lignes sur stdout :
#   ligne 1 = verdict du champ
#   ligne 2 = motif (peut être vide)
# --------------------------------------------------------------

# vbc_champ_adr <texte-normalisé>
vbc_champ_adr() {
  local LC_ALL=C
  local texte_norm="$1" ligne trouve=0 capture="" commence=0

  while IFS= read -r ligne; do
    if [ "$trouve" -eq 0 ]; then
      case "$ligne" in
        *"adr applicable"*)
          trouve=1
          capture="${ligne#*"adr applicable"}"
          # Si du texte suit déjà sur la ligne du marqueur (forme en ligne,
          # ex « ADR applicable : ... »), le contenu est déjà entamé.
          [ -n "$(vbc_trim "$capture")" ] && commence=1
          ;;
      esac
      continue
    fi
    if [ -z "$ligne" ]; then
      # Une ligne vide juste APRÈS le titre (convention markdown : titre,
      # ligne vide, paragraphe) ne termine PAS la section — seule une ligne
      # vide qui suit du contenu DÉJÀ commencé marque une fin de paragraphe.
      if [ "$commence" -eq 1 ]; then
        break
      fi
      continue
    fi
    case "$ligne" in
      "#"*) break ;;
      *) capture="${capture} ${ligne}"; commence=1 ;;
    esac
  done < <(printf '%s\n' "$texte_norm")

  if [ "$trouve" -eq 0 ]; then
    printf 'REFUS\n%s' "la mention ADR applicable est totalement absente du brief"
    return
  fi

  # Bordure markdown de tête (":", "*", "-", "#", espaces) retirée avant de
  # juger le contenu — elle n'est jamais elle-même un motif.
  local nettoye="$capture"
  while :; do
    case "$nettoye" in
      " "*) nettoye="${nettoye# }" ;;
      ":"*) nettoye="${nettoye#:}" ;;
      "*"*) nettoye="${nettoye#\*}" ;;
      "-"*) nettoye="${nettoye#-}" ;;
      "#"*) nettoye="${nettoye#\#}" ;;
      *) break ;;
    esac
  done

  local utiles_total
  utiles_total="$(vbc_compter_utiles "$nettoye")"
  if [ "$utiles_total" -eq 0 ]; then
    printf 'REFUS\n%s' "la section ADR applicable est presente mais vide (rien apres le marqueur)"
    return
  fi

  if [[ "$nettoye" == *"non etabli"* ]]; then
    local sans_marqueur utiles_motif
    sans_marqueur="${nettoye//non etabli/}"
    utiles_motif="$(vbc_compter_utiles "$sans_marqueur")"
    if [ "$utiles_motif" -ge "$VBC_SEUIL_MOTIF" ]; then
      printf 'PASSE\n%s' ""
    else
      printf 'REFUS\n%s' "ADR applicable marque [non etabli] SANS motif — le marqueur seul ne suffit pas, il lui faut une explication"
    fi
    return
  fi

  if vbc_a_reference_numerique "$nettoye"; then
    local sans_numero utiles_hors_numero
    sans_numero="$(vbc_retirer_references_numeriques "$nettoye")"
    utiles_hors_numero="$(vbc_compter_utiles "$sans_numero")"
    if [ "$utiles_hors_numero" -ge "$VBC_SEUIL_MOTIF" ]; then
      printf 'PASSE\n%s' ""
    else
      printf 'SIGNALE\n%s' "l'ADR est citee par son seul numero, sans titre ni description — reference potentiellement ambigue (plusieurs numeros peuvent designer des textes differents)"
    fi
    return
  fi

  if [ "$utiles_total" -ge "$VBC_SEUIL_MOTIF" ]; then
    printf 'PASSE\n%s' ""
  else
    printf 'REFUS\n%s' "la section ADR applicable ne porte pas assez de contenu exploitable"
  fi
}

# vbc_champ_brd <texte-normalisé> <module_id-brut>
vbc_champ_brd() {
  local LC_ALL=C
  local texte_norm="$1" module_id="$2"

  if [[ "$texte_norm" != *"brd"* ]]; then
    printf 'REFUS\n%s' "aucune mention de BRD dans le brief"
    return
  fi

  if [ -z "$module_id" ]; then
    printf 'PASSE\n%s' ""
    return
  fi

  # Grain module requis : fenêtre de proximité autour de la PREMIÈRE
  # occurrence de « brd », où l'on cherche soit le mot « module », soit la
  # valeur de module_id elle-même, soit un chemin « /…/brd ».
  local avant debut longueur fenetre
  avant="${texte_norm%%brd*}"
  debut=$(( ${#avant} - VBC_FENETRE_PROXIMITE ))
  [ "$debut" -lt 0 ] && debut=0
  longueur=$(( VBC_FENETRE_PROXIMITE * 2 + 3 ))
  fenetre="${texte_norm:debut:longueur}"

  local module_id_norm
  module_id_norm="$(vbc_normaliser_recherche "$module_id")"

  if [[ "$fenetre" == *"module"* ]] \
     || { [ -n "$module_id_norm" ] && [[ "$fenetre" == *"$module_id_norm"* ]]; } \
     || [[ "$fenetre" == *"/"*"/brd"* ]]; then
    printf 'PASSE\n%s' ""
  else
    printf 'REFUS\n%s' "BRD mentionne, mais rien n indique le grain MODULE (module_id=${module_id}) — le BRD du module est requis, pas celui de l application"
  fi
}

# vbc_champ_ontologie <texte-normalisé> <touche-résolue: oui|non>
vbc_champ_ontologie() {
  local LC_ALL=C
  local texte_norm="$1" touche="$2"

  if [ "$touche" = "non" ]; then
    printf 'NON_APPLIQUE\n%s' ""
    return
  fi

  if [[ "$texte_norm" == *"ontologie"* ]]; then
    printf 'PASSE\n%s' ""
  else
    printf 'REFUS\n%s' "le lot touche l ontologie mais aucune mention d ontologie dans le brief"
  fi
}

# vbc_champ_applicable <texte-normalisé>
vbc_champ_applicable() {
  local LC_ALL=C
  local texte_norm="$1"

  if [[ "$texte_norm" == *"ce qui sapplique ici"* ]]; then
    printf 'PASSE\n%s' ""
  else
    printf 'REFUS\n%s' "aucune section ce qui s applique ici dans le brief"
  fi
}

# vbc__rendre_non_mesure <motif> — les 4 champs + le verdict global à
# NON_MESURE, distinct d'un PASSE et d'un REFUS.
vbc__rendre_non_mesure() {
  local motif="$1"
  echo "ADR=NON_MESURE"
  echo "BRD=NON_MESURE"
  echo "ONTOLOGIE=NON_MESURE"
  echo "APPLICABLE=NON_MESURE"
  echo "VERDICT=NON_MESURE"
  echo "MOTIF=${motif}"
}

# --------------------------------------------------------------
# vbc_verifier — point d'entrée. Lit VBC_BRIEF_TEXTE / VBC_SOURCE_CASSEE /
# VBC_MODULE_ID / VBC_TOUCHE_ONTOLOGIE dans l'environnement, imprime les 6
# lignes CLE=VALEUR, rend le code de retour du verdict global.
# --------------------------------------------------------------
vbc_verifier() {
  local LC_ALL=C

  # 🔴 GARDE D'INTERPRÉTEUR — EN PREMIER, AVANT TOUT APPEL AUX AIDES BAS
  # NIVEAU. Ce fichier utilise des substitutions bash-only (${s:i:1} en
  # boucle, entre autres) qui échouent SOUS ZSH avec une erreur avalée en
  # silence (« unrecognized modifier 'i'' ») : vbc_minuscules rend alors un
  # texte cassé/vide, et CHAQUE champ retombe en REFUS — y compris sur un
  # brief parfaitement conforme. C'est le pire résultat que ce fichier
  # existe pour empêcher : une garde qui ne peut pas voir correctement ne
  # doit JAMAIS rendre un verdict, encore moins le plus sévère, sans le
  # signaler. BASH_VERSION n'est positionnée que par bash — c'est le signal
  # le plus fiable pour détecter l'interpréteur réel, indépendamment de
  # $0/$SHELL (qui décrivent le shell de LOGIN, pas celui qui exécute CE
  # code). Traité exactement comme VBC_SOURCE_CASSEE=oui : NON_MESURE
  # partout, jamais un REFUS silencieux.
  if [ -z "${BASH_VERSION:-}" ]; then
    vbc__rendre_non_mesure "ce script exige bash, l interpreteur courant n est pas bash — verdict impossible a etablir en toute confiance"
    return 4
  fi

  local texte="${VBC_BRIEF_TEXTE:-}"
  local module_id="${VBC_MODULE_ID:-}"

  # « explicitement non » se distingue de « absente » (défaut) et de
  # « positionnée à une valeur qui n'est pas non » — SEULE la forme
  # explicite non désamorce la prudence sur un texte vide.
  local sc_explicite_non=0
  if [ -n "${VBC_SOURCE_CASSEE+x}" ] \
     && [ "$(vbc_minuscules "$(vbc_trim "${VBC_SOURCE_CASSEE}")")" = "non" ]; then
    sc_explicite_non=1
  fi
  local sc_val
  sc_val="$(vbc_minuscules "$(vbc_trim "${VBC_SOURCE_CASSEE:-non}")")"

  if [ "$sc_val" = "oui" ]; then
    vbc__rendre_non_mesure "VBC_SOURCE_CASSEE=oui — la source du controle est declaree cassee, aucun champ n est mesurable"
    return 4
  fi

  if [ -z "$texte" ] && [ "$sc_explicite_non" -ne 1 ]; then
    vbc__rendre_non_mesure "le texte du brief est absent et VBC_SOURCE_CASSEE n est pas explicitement non — traite par prudence comme une source cassee (on ne sait pas si le brief a vraiment pu etre lu)"
    return 4
  fi

  # VBC_TOUCHE_ONTOLOGIE : fait sur le PÉRIMÈTRE du lot, jamais déduit du
  # texte. Vide/inconnu = defaut conservatif « oui » (le check s'applique) —
  # un [non applicable] ne doit jamais etre un choix silencieux.
  local touche_resolue="oui"
  if [ "$(vbc_minuscules "$(vbc_trim "${VBC_TOUCHE_ONTOLOGIE:-}")")" = "non" ]; then
    touche_resolue="non"
  fi

  local texte_norm
  texte_norm="$(vbc_normaliser_recherche "$texte")"

  local r_adr r_brd r_onto r_app
  r_adr="$(vbc_champ_adr "$texte_norm")"
  r_brd="$(vbc_champ_brd "$texte_norm" "$module_id")"
  r_onto="$(vbc_champ_ontologie "$texte_norm" "$touche_resolue")"
  r_app="$(vbc_champ_applicable "$texte_norm")"

  local v_adr v_brd v_onto v_app m_adr m_brd m_onto m_app
  v_adr="${r_adr%%$'\n'*}"; m_adr="${r_adr#*$'\n'}"
  v_brd="${r_brd%%$'\n'*}"; m_brd="${r_brd#*$'\n'}"
  v_onto="${r_onto%%$'\n'*}"; m_onto="${r_onto#*$'\n'}"
  v_app="${r_app%%$'\n'*}"; m_app="${r_app#*$'\n'}"

  echo "ADR=${v_adr}"
  echo "BRD=${v_brd}"
  echo "ONTOLOGIE=${v_onto}"
  echo "APPLICABLE=${v_app}"

  # Le motif ÉNUMÈRE tous les champs en REFUS — pas seulement le premier
  # trouvé (un chef qui n'a NI ADR NI section « ce qui s'applique ici » doit
  # être informé des DEUX, pas d'un seul).
  local motifs=""
  [ "$v_adr" = "REFUS" ] && motifs="${motifs}${motifs:+ ; }ADR : ${m_adr}"
  [ "$v_brd" = "REFUS" ] && motifs="${motifs}${motifs:+ ; }BRD : ${m_brd}"
  [ "$v_onto" = "REFUS" ] && motifs="${motifs}${motifs:+ ; }ONTOLOGIE : ${m_onto}"
  [ "$v_app" = "REFUS" ] && motifs="${motifs}${motifs:+ ; }APPLICABLE : ${m_app}"

  local verdict rc
  if [ -n "$motifs" ]; then
    verdict="REFUS"; rc=2
  elif [ "$v_adr" = "SIGNALE" ]; then
    verdict="SIGNALE"; rc=1
    motifs="ADR : ${m_adr}"
  else
    verdict="PASSE"; rc=0
    motifs=""
  fi

  echo "VERDICT=${verdict}"
  echo "MOTIF=${motifs}"
  return "$rc"
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  if [ -z "${VBC_BRIEF_TEXTE+x}" ]; then
    VBC_BRIEF_TEXTE="$(cat)"
    export VBC_BRIEF_TEXTE
  fi
  vbc_verifier
  exit $?
fi
