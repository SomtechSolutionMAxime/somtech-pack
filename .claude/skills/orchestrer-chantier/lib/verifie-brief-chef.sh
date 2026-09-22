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
#   • LIMITE CONNUE (VBC_SEUIL_MOTIF) — un compte de caractères ne peut
#     structurellement pas distinguer une explication réelle d'un
#     remplissage sans substance : un motif de 15 caractères utiles
#     grammaticalement creux (« texte texte texte ») passe la garde au même
#     titre qu'une vraie explication. Volontairement laissé tel quel — un
#     correctif naïf sur ce seuil risquerait d'introduire d'autres faux
#     négatifs ; documenté ici plutôt que « corrigé » à la légère.
#   • LIMITE CONNUE (vbc_champ_brd, grain module) — le signal ajouté pour
#     détecter le grain module (§ vbc_grain_module_associes) associe les
#     mots « grain » et « module » par simple proximité de caractères, sans
#     analyse sémantique, dans une fenêtre LARGE (300 car.) autour de la
#     mention « brd » (VBC_FENETRE_PROXIMITE_GRAIN — corrigé en un second
#     tour de revue pour ne plus scanner le document entier). Sur un brief
#     COURT (moins de ~600 car. au total), cette fenêtre couvre encore la
#     totalité du texte : un « grain » sans rapport avec le BRD (ex. le
#     grain de découpage du TICKET, pas du BRD) ailleurs dans un brief très
#     court peut encore faire PASSER ce champ à tort — reproduit et confirmé
#     en revue (2026-09-22, second tour). Sur un brief de longueur réaliste
#     (les 6 briefs réels de ce dépôt en comptent tous plusieurs milliers de
#     caractères), l'ancrage exclut correctement un « grain » éloigné —
#     vérifié. Compromis documenté, pas une garantie de précision parfaite
#     (voir commentaire de la fonction) : resserrer davantage sans un
#     découpage par paragraphe/section risquerait de réintroduire le premier
#     faux-REFUS corrigé plus haut.
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

# Fenêtre de proximité (en caractères, de part et d'autre de « grain ») dans
# laquelle le mot « module » est recherché par vbc_grain_module_associes.
# Choisie à 40 : assez large pour couvrir une même phrase complète (repro
# réelle mesurée : 25 caractères entre « grain » et « module » dans « le
# grain retenu ici est celui du module facturation »), assez étroite pour
# rester une association de PHRASE plutôt qu'une coïncidence de paragraphe.
VBC_FENETRE_GRAIN_MODULE=40

# Fenêtre LARGE (en caractères, de part et d'autre de « brd ») dans
# laquelle vbc_grain_module_associes est autorisée à chercher — DISTINCTE
# de VBC_FENETRE_PROXIMITE (plus étroite, pour les signaux exacts type
# module_id/chemin). 🔴 Ancrage ajouté en second correctif (revue de fond,
# 2026-09-22) : une première version cherchait sur le DOCUMENT ENTIER, ce
# qui laissait passer un « grain » sans rapport (ex. « grain de découpage
# du ticket ») ailleurs dans le brief. 300 couvre confortablement le cas
# réel qui a motivé ce signal (~210 caractères entre « brd » et « module »)
# sans dégénérer en une recherche document-entier.
VBC_FENETRE_PROXIMITE_GRAIN=300

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

# vbc_grain_module_associes <fenetre-large-autour-de-brd> — vrai si
# « grain » et « module » apparaissent l'un près de l'autre (≤
# VBC_FENETRE_GRAIN_MODULE caractères) DANS la fenêtre déjà bornée autour
# de « brd » que l'appelant lui passe (voir vbc_champ_brd). 🔴 CORRIGÉ
# (revue de fond, 2026-09-22, second tour) : une première version
# cherchait « grain »+« module » sur le DOCUMENT ENTIER, sans aucun
# ancrage sur « brd » — repro qui a fait tomber ça : un brief peut
# légitimement parler du « grain de découpage » du TICKET (vocabulaire PM
# courant, sans rapport avec le grain du BRD) n'importe où dans le texte,
# et cette occurrence isolée suffisait à faire PASSER le champ BRD même
# quand la section BRD elle-même ne dit RIEN sur le grain module — exactement
# le trou que ce signal existe pour fermer, rouvert par une portée trop
# large. Ancré maintenant sur une fenêtre large autour de « brd »
# (VBC_FENETRE_PROXIMITE_GRAIN, 300 car. de chaque côté — assez pour
# couvrir le cas réel qui a motivé ce signal : ~210 car. entre « brd » et
# « module » — sans couvrir un document entier).
# LIMITE RÉSIDUELLE : heuristique de PROXIMITÉ, pas d'analyse sémantique —
# un brief pourrait encore, dans de rares cas, associer fortuitement
# « grain » et « module » à proximité d'une mention BRD sans rapport avec
# son grain. Voir la note dans « CE QUE CE FICHIER NE FAIT PAS » en tête
# de fichier.
vbc_grain_module_associes() {
  local LC_ALL=C
  local fenetre_brd="$1"
  [[ "$fenetre_brd" == *"grain"* ]] || return 1
  [[ "$fenetre_brd" == *"module"* ]] || return 1

  local avant pos_grain debut longueur fenetre
  avant="${fenetre_brd%%grain*}"
  pos_grain=${#avant}
  debut=$(( pos_grain - VBC_FENETRE_GRAIN_MODULE ))
  [ "$debut" -lt 0 ] && debut=0
  longueur=$(( VBC_FENETRE_GRAIN_MODULE * 2 + 5 ))
  fenetre="${fenetre_brd:debut:longueur}"

  [[ "$fenetre" == *"module"* ]]
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

  # Grain module requis : le mot NU « module » seul n'est plus un signal
  # suffisant (faux positif reproduit sur repro réelle, revue 2026-09-22 :
  # « Ce lot ajoute un nouveau MODULE de notification [...] Le BRD est a
  # jour et couvre ce lot. » avec module_id=facturation — « module » y
  # désigne un module FONCTIONNEL sans rapport avec le grain du BRD, à 49
  # caractères de « brd », dans la fenêtre). Le signal exigé est désormais
  # PLUS SPÉCIFIQUE qu'un mot isolé :
  #   1. la valeur EXACTE de module_id, à proximité de « brd »
  #      (VBC_FENETRE_PROXIMITE) — signal le plus fiable, inchangé ;
  #   2. un chemin « /…/brd », à proximité de « brd » — inchangé ;
  #   3. la phrase « brd du module » / « brd au module », où qu'elle
  #      apparaisse — brd et module directement reliés par un article ;
  #   4. « grain » et « module » associés (vbc_grain_module_associes),
  #      cherché dans une fenêtre LARGE autour de « brd »
  #      (VBC_FENETRE_PROXIMITE_GRAIN) — PAS le document entier (🔴 second
  #      correctif, revue de fond 2026-09-22 : la version « document
  #      entier » laissait passer un « grain » sans rapport avec le BRD,
  #      ailleurs dans le brief — voir la note de vbc_grain_module_associes).
  local avant debut longueur fenetre debut_large longueur_large fenetre_large
  avant="${texte_norm%%brd*}"
  debut=$(( ${#avant} - VBC_FENETRE_PROXIMITE ))
  [ "$debut" -lt 0 ] && debut=0
  longueur=$(( VBC_FENETRE_PROXIMITE * 2 + 3 ))
  fenetre="${texte_norm:debut:longueur}"

  debut_large=$(( ${#avant} - VBC_FENETRE_PROXIMITE_GRAIN ))
  [ "$debut_large" -lt 0 ] && debut_large=0
  longueur_large=$(( VBC_FENETRE_PROXIMITE_GRAIN * 2 + 3 ))
  fenetre_large="${texte_norm:debut_large:longueur_large}"

  local module_id_norm
  module_id_norm="$(vbc_normaliser_recherche "$module_id")"

  if { [ -n "$module_id_norm" ] && [[ "$fenetre" == *"$module_id_norm"* ]]; } \
     || [[ "$fenetre" == *"/"*"/brd"* ]] \
     || [[ "$texte_norm" == *"brd du module"* ]] \
     || [[ "$texte_norm" == *"brd au module"* ]] \
     || vbc_grain_module_associes "$fenetre_large"; then
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

# vbc__executee_directement — vrai (rc 0) si CE fichier est exécuté
# DIRECTEMENT (pas sourcé) — portable bash/zsh/sh, contrairement au seul
# `[ "${BASH_SOURCE[0]}" = "${0}" ]` (bash-only) qui précédait ce bloc :
# BASH_SOURCE est un tableau bash-only, TOUJOURS vide sous zsh, donc cette
# comparaison était perpétuellement FAUSSE sous zsh — y compris en
# exécution DIRECTE (`zsh verifie-brief-chef.sh < entree`) — et ce bloc
# entier restait sauté : `vbc_verifier` n'était jamais appelée, sa propre
# garde BASH_VERSION interne (ci-dessus) n'était donc jamais atteinte.
# Résultat mesuré (repro, revue 2026-09-22) : rc=0, ZÉRO ligne de sortie —
# un succès silencieux et totalement faux, pire que le REFUS visible que
# corrige la garde BASH_VERSION de vbc_verifier.
#
# ⚠️ L'idiome `! (return 0 2>/dev/null)` seul (suggéré comme portable
# bash/zsh/sh) a été ÉPROUVÉ et ÉCARTÉ : sous zsh, `return` À L'INTÉRIEUR
# D'UN SOUS-SHELL réussit TOUJOURS (rc=0), qu'on soit sourcé ou exécuté
# directement — vérifié empiriquement (`zsh script.sh` ET
# `zsh -c 'source script.sh'` rendent tous les deux rc=0 pour ce test). Cet
# idiome ne distingue donc RIEN sous zsh ; s'y fier aurait remplacé un bug
# par un autre. zsh expose ZSH_EVAL_CONTEXT (positionnée UNIQUEMENT par
# zsh) : chaque niveau (script top-level, source, fonction) y AJOUTE un
# segment séparé par « : » — vérifié empiriquement que la valeur DANS
# CETTE FONCTION est « toplevel:shfunc » en exécution directe (pas
# « toplevel » seul, comme une première version de ce correctif l'avait
# supposé à tort — un `case "toplevel")` exact aurait donc manqué CE cas
# précis, puisqu'on teste la variable DEPUIS l'intérieur d'une fonction).
# Le signal fiable est la PRÉSENCE du segment « file » n'importe où dans la
# chaîne (il apparaît dès qu'un `source`/`.` a eu lieu, à n'importe quel
# niveau) — son ABSENCE signifie qu'aucun `source` n'est dans la pile
# d'appel, donc exécution directe, même depuis l'intérieur d'une fonction.
vbc__executee_directement() {
  if [ -n "${BASH_VERSION:-}" ]; then
    [ "${BASH_SOURCE[0]}" = "${0}" ]
    return
  fi
  if [ -n "${ZSH_EVAL_CONTEXT:-}" ]; then
    case "$ZSH_EVAL_CONTEXT" in
      *file*) return 1 ;;
      *) return 0 ;;
    esac
  fi
  # sh/dash/autres — l'idiome return-in-subshell, fiable HORS zsh (voir
  # avertissement ci-dessus : sous zsh spécifiquement, ce même idiome
  # réussit toujours et NE distingue rien — d'où le branchement explicite
  # sur ZSH_EVAL_CONTEXT au-dessus plutôt que de s'y fier partout).
  ! (return 0 2>/dev/null)
}

if vbc__executee_directement; then
  if [ -z "${VBC_BRIEF_TEXTE+x}" ]; then
    VBC_BRIEF_TEXTE="$(cat)"
    export VBC_BRIEF_TEXTE
  fi
  vbc_verifier
  exit $?
fi
