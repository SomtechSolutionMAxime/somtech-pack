#!/bin/bash
# ============================================================
# veille-deblocage.sh
# Veille sur un agent herdr : le débloque dès qu'il attend une permission
# reconnue avec certitude. S'arrête quand il a terminé, ou devant un
# blocage qu'elle ne reconnaît pas — et elle DIT toujours pourquoi.
#
# Généralisation du prototype éprouvé du chantier E-20260807-0006 :
#   /private/tmp/.../scratchpad/veiller-e0006.sh
# 14 déblocages, 0 blocage non reconnu à son premier usage réel. Pane et
# agent y étaient codés en dur (w26:p1T / d-20260807-0005) ; ce script les
# prend en paramètres et garde tout le reste de sa logique, littéralement.
#
# GARANTIES (apprises par les usages successifs du prototype — ce sont
# elles que scripts/tests/test-veille-deblocage.sh prouve) :
#   1. Elle ne répond que devant une vraie demande de permission, reconnue
#      par DEUX signes concordants : un curseur sur « ❯ 1. Yes|Oui » ET une
#      sortie « No|Non » numérotée (2. ou 3.). Un seul des deux pourrait
#      appartenir à autre chose. (La question elle-même peut être repoussée
#      hors écran par un long diff : on ne s'appuie jamais sur elle.)
#   2. Devant un écran qu'elle ne reconnaît pas, elle ne répond pas — elle
#      le dit, l'affiche, et s'arrête après 3 relevés non reconnus
#      consécutifs. C'est le seul moyen que cet outil nuise.
#   3. La position d'une option ne dit jamais son sens. On ne descend sur
#      l'option 2 que si on a LU qu'elle autorise durablement (« Yes, and
#      don… », « Yes, and allow… », « Yes, allow… », « Oui, et… ») — et
#      jamais « Yes, and tell Claude… », qui laisserait l'agent attendre
#      une instruction qui ne viendra pas. Certaines invites n'ont que deux
#      options et la deuxième y est « No » : répondre « 2 » par habitude
#      refuserait.
#   4. done|idle n'est annoncé qu'après confirmation sur DEUX relevés
#      espacés — un état terminal peut être transitoire.
#
# ── E-20260818-0020 — trois défauts mesurés le 2026-08-18 (T-20260818-0109),
#    tous du même genre : elle promettait une protection qu'elle n'assurait
#    pas, sans jamais le dire. Ce que le correctif ajoute, SANS toucher aux
#    quatre garanties ci-dessus :
#
#   5. L'ATTENTE D'UN BRIEF N'EST PAS UNE FIN. Un agent qui vient de naître
#      est `idle` parce qu'il attend son premier message — pas parce qu'il a
#      fini. La détection de fin n'est donc ARMÉE qu'une fois l'agent vu au
#      travail au moins une fois (`working`, `blocked` ou `done` : un agent
#      bloqué a forcément commencé, et `done` est un état terminal explicite
#      qui ne survient jamais à la naissance). Seul `idle` est ambigu, et
#      c'est le seul état que ce discriminant retient. La garantie n°4 reste
#      entière : une fois armée, la fin exige toujours deux relevés.
#      → Le geste que le métier prescrit — poser la veille à la naissance —
#        cesse de produire systématiquement le défaut.
#
#   6. ELLE NE S'ARRÊTE JAMAIS EN SILENCE. Tout chemin d'arrêt écrit une
#      ligne « MOTIF: <code> — <phrase> » et sort sur un code propre :
#        agent-termine ......... 0   l'agent a travaillé puis fini
#        tours-epuises ......... 2   fin de sa durée (elle dit si l'agent
#                                    travaillait encore : il n'est plus protégé)
#        ecran-non-reconnu ..... 3   3 relevés non reconnus consécutifs
#        interrompue ........... 4   signal reçu — tuée par son environnement
#      Un bilan muet rendait « j'ai cru qu'il avait fini » et « j'ai épuisé
#      mes tours » indistinguables, alors qu'ils appellent des correctifs
#      opposés.
#
#   7. LA FORME PRESCRITE SURVIT PAR CONSTRUCTION. `… &` depuis une session
#      Claude Code en fait une tâche de fond du harnais, qui la tue (mesuré
#      deux fois). `--detach` fait que le script se relance LUI-MÊME détaché
#      (nohup + disown) et rend la main en annonçant son pid et son journal.
#      La survie ne dépend plus de la discipline de l'appelant.
#
#   8. ON SAIT SUR QUOI CHACUNE VEILLE. Chaque veille s'inscrit au registre
#      (pane, agent, pid, journal, début, tours) et y inscrit son motif en
#      s'arrêtant. `--list` rend le pane ET l'agent de chacune — un compte
#      global (« 3 veilles tournent ») ne dit pas si l'une est la tienne.
#
#   9. LES DEUX CHIFFRES SONT MESURABLES. Une garde se juge sur ce qu'elle
#      débloque à raison ET sur ce qu'elle débloque à tort. Chaque déblocage
#      consigne dans un journal l'écran qui l'a déclenché et la touche
#      envoyée, pour qu'un tiers relise et classe. Un compte sans sa méthode
#      est un fait invérifiable.
#
# Usage:
#   veille-deblocage.sh <pane> <agent> [tours] [--dry-run] [--detach]
#   veille-deblocage.sh --list          # les veilles du registre, une par ligne
#   veille-deblocage.sh --duree         # durée nominale couverte, en secondes
#
# --dry-run : journalise ce qu'elle aurait envoyé à `herdr pane send-keys`
# et n'envoie rien. C'est ce qui rend ce script testable.
# --detach : se relance détachée, rend son pid, et survit à la session.
#
# Variables d'environnement :
#   VD_TOURS                  nombre de tours de veille max       (2000)
#   VD_SLEEP                  attente entre deux tours              (10s)
#   VD_SLEEP_CONFIRM          attente avant confirmation done/idle  (20s)
#   VD_SLEEP_APRES_DEBLOCAGE  attente après un déblocage envoyé      (3s)
#   VD_REGISTRE_DIR           registre des veilles  ($HOME/.somtech/veilles)
#   VD_JOURNAL                journal des déblocages   (dans le registre)
#   VD_LOG                    journal du mode --detach (dans le registre)
# Un argument positionnel (tours) prévaut sur VD_TOURS si fourni.
#
# ⚠️ VD_TOURS vaut 2000 (~5 h 30 à 10 s le tour) et non plus 400 (~66 min) :
#    les lots mesurés le 2026-08-18 duraient de 1 h à 2 h 30, donc l'ancien
#    défaut éteignait la veille AU MILIEU de la plupart d'entre eux.
# ============================================================

VD_TOURS_DEFAUT=2000
VD_SLEEP_DEFAUT=10

VD_SLEEP="${VD_SLEEP:-$VD_SLEEP_DEFAUT}"
VD_SLEEP_CONFIRM="${VD_SLEEP_CONFIRM:-20}"
VD_SLEEP_APRES_DEBLOCAGE="${VD_SLEEP_APRES_DEBLOCAGE:-3}"
VD_REGISTRE_DIR="${VD_REGISTRE_DIR:-$HOME/.somtech/veilles}"

# Lit une clé d'un fichier de registre. Jamais `source` : un fichier de
# registre est une donnée, pas du code à exécuter.
registre_lire() {
  sed -n "s/^$2=//p" "$1" 2>/dev/null | head -1
}

# --list — le pane ET l'agent de chaque veille, jamais un simple compte.
if [ "${1:-}" = "--list" ]; then
  if [ ! -d "$VD_REGISTRE_DIR" ] || [ -z "$(ls -A "$VD_REGISTRE_DIR"/*.veille 2>/dev/null)" ]; then
    echo "Aucune veille inscrite au registre ($VD_REGISTRE_DIR)."
    exit 0
  fi
  for f in "$VD_REGISTRE_DIR"/*.veille; do
    [ -f "$f" ] || continue
    r_pane="$(registre_lire "$f" pane)"
    r_agent="$(registre_lire "$f" agent)"
    r_pid="$(registre_lire "$f" pid)"
    r_statut="$(registre_lire "$f" statut)"
    r_motif="$(registre_lire "$f" motif)"
    r_debut="$(registre_lire "$f" debut)"
    r_journal="$(registre_lire "$f" journal)"
    if [ "$r_statut" = "terminee" ]; then
      echo "○ terminée · pane=$r_pane agent=$r_agent pid=$r_pid motif=${r_motif:-?} journal=$r_journal"
    elif kill -0 "$r_pid" 2>/dev/null; then
      echo "● vivante  · pane=$r_pane agent=$r_agent pid=$r_pid depuis=$r_debut journal=$r_journal"
    else
      # Le registre ne prétend pas savoir ce qu'il ne sait pas : une veille
      # dont le pid est mort SANS avoir écrit son motif a été tuée sans
      # pouvoir le dire. La présenter comme vivante serait le mensonge que
      # ce lot corrige.
      echo "⚠ disparue · pane=$r_pane agent=$r_agent pid=$r_pid — disparue sans motif (tuée sans pouvoir l'écrire) · journal=$r_journal"
    fi
  done
  exit 0
fi

# --duree — la durée nominale couverte, en secondes. Rendue par le script
# lui-même : un `grep` sur le source prouverait qu'un nombre est écrit
# quelque part, pas qu'une durée est couverte.
if [ "${1:-}" = "--duree" ]; then
  echo "DUREE_NOMINALE_S=$(( ${VD_TOURS:-$VD_TOURS_DEFAUT} * VD_SLEEP ))"
  exit 0
fi

PANE="${1:-}"
AGENT="${2:-}"

if [ -z "$PANE" ] || [ -z "$AGENT" ]; then
  echo "Usage: $0 <pane> <agent> [tours] [--dry-run] [--detach]" >&2
  echo "       $0 --list | --duree" >&2
  exit 1
fi

DRY_RUN=0
DETACH=0
CLI_TOURS=""
for a in "${3:-}" "${4:-}" "${5:-}"; do
  case "$a" in
    --dry-run) DRY_RUN=1 ;;
    --detach)  DETACH=1 ;;
    ''|*[!0-9]*) ;;               # ignoré : ni drapeau connu, ni un nombre
    *) CLI_TOURS="$a" ;;
  esac
done

VD_TOURS="${CLI_TOURS:-${VD_TOURS:-$VD_TOURS_DEFAUT}}"

PANE_SLUG="$(printf '%s' "$PANE" | tr ':/ ' '---')"
mkdir -p "$VD_REGISTRE_DIR" 2>/dev/null

# ── --detach : la survie ne dépend plus de la discipline de l'appelant ──────
# Le `&` simple fait de la veille une tâche de fond du harnais, qui la tue
# (mesuré deux fois, T-20260818-0109). On se relance donc soi-même sous
# nohup, on se détache du tableau de jobs, et on rend la main tout de suite.
# La relance ne repasse PAS --detach : sans quoi elle se détacherait à
# l'infini sans jamais veiller.
if [ "$DETACH" = "1" ]; then
  SCRIPT_ABS="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
  LOG="${VD_LOG:-${VD_REGISTRE_DIR}/${PANE_SLUG}-$(date +%Y%m%d-%H%M%S).log}"
  ARGS_RELANCE="$VD_TOURS"
  if [ "$DRY_RUN" = "1" ]; then
    nohup bash "$SCRIPT_ABS" "$PANE" "$AGENT" "$ARGS_RELANCE" --dry-run > "$LOG" 2>&1 &
  else
    nohup bash "$SCRIPT_ABS" "$PANE" "$AGENT" "$ARGS_RELANCE" > "$LOG" 2>&1 &
  fi
  ENFANT=$!
  disown "$ENFANT" 2>/dev/null
  echo "veille détachée · pane=$PANE agent=$AGENT pid=$ENFANT"
  echo "journal : $LOG"
  echo "l'arrêter : kill $ENFANT   ·   les lister : $0 --list"
  exit 0
fi

DEBLOQUES=0
INCONNUES=0
# Discriminant du défaut ① : tant qu'il vaut 0, un `idle` veut dire « il
# attend qu'on lui parle », jamais « il a fini ».
VU_TRAVAILLER=0
PREAVIS_EMIS=0
DERNIER_ETAT=""

VD_JOURNAL="${VD_JOURNAL:-${VD_REGISTRE_DIR}/${PANE_SLUG}-$$-deblocages.log}"
REGISTRE_FICHIER="${VD_REGISTRE_DIR}/${PANE_SLUG}-$$.veille"

{
  echo "pane=$PANE"
  echo "agent=$AGENT"
  echo "pid=$$"
  echo "statut=active"
  echo "debut=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "journal=$VD_JOURNAL"
  echo "tours=$VD_TOURS"
} > "$REGISTRE_FICHIER" 2>/dev/null

# Codes de sortie : un appelant machine tranche sans lire du texte.
code_motif() {
  case "$1" in
    agent-termine)     echo 0 ;;
    tours-epuises)     echo 2 ;;
    ecran-non-reconnu) echo 3 ;;
    interrompue)       echo 4 ;;
    *)                 echo 5 ;;
  esac
}

# Le seul point de sortie du script. Aucun chemin d'arrêt ne s'en dispense —
# c'est ce qui garantit qu'elle ne s'arrête jamais en silence.
terminer() {
  motif="$1"; shift
  echo "MOTIF: $motif — $*"
  echo "--- bilan : $DEBLOQUES deblocages, $INCONNUES blocages non reconnus ---"
  if [ -f "$REGISTRE_FICHIER" ]; then
    sed -i.bak 's/^statut=active$/statut=terminee/' "$REGISTRE_FICHIER" 2>/dev/null
    rm -f "${REGISTRE_FICHIER}.bak" 2>/dev/null
    {
      echo "motif=$motif"
      echo "fin=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      echo "deblocages=$DEBLOQUES"
      echo "inconnues=$INCONNUES"
    } >> "$REGISTRE_FICHIER" 2>/dev/null
  fi
  exit "$(code_motif "$motif")"
}

# Tuée par son environnement, elle le dit avant de mourir. Sans ce trap, une
# veille tuée et une veille qui n'a jamais démarré laissent la même trace :
# rien.
trap 'terminer interrompue "signal reçu — tuée par son environnement, l'"'"'agent n'"'"'est plus protégé"' TERM HUP INT

# Envoie une touche au pane — ou, en --dry-run, journalise ce qu'elle aurait
# envoyé sans rien envoyer. C'est le seul point de sortie vers `herdr pane
# send-keys` : le garder unique est ce qui rend le --dry-run fiable.
envoyer() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY-RUN] aurait envoyé: $1"
  else
    herdr pane send-keys "$PANE" "$1" >/dev/null 2>&1
  fi
}

# Consigne un déblocage avec l'écran qui l'a déclenché et les touches
# envoyées. C'est ce qui rend le SECOND chiffre mesurable : sans l'écran, un
# « 14 déblocages » ne se distingue pas d'un « 14 devinettes ». Écrit aussi
# en --dry-run : le journal doit être relisable sans rien avoir envoyé.
journaliser_deblocage() {
  {
    echo "=== déblocage #$DEBLOQUES · tour $1 · $(date -u +%Y-%m-%dT%H:%M:%SZ) · pane=$PANE agent=$AGENT"
    echo "--- touches envoyées : $2"
    echo "--- écran déclencheur :"
    printf '%s\n' "$3"
    echo "=== fin déblocage #$DEBLOQUES"
    echo
  } >> "$VD_JOURNAL" 2>/dev/null
}

etat_courant() {
  herdr agent get "$PANE" 2>/dev/null | python3 -c "import json,sys;print(json.load(sys.stdin)['result']['agent'].get('agent_status',''))" 2>/dev/null
}

# Seuil de préavis : 90 % des tours. Elle prévient AVANT de s'éteindre, une
# seule fois — un orchestrateur qui lit son journal voit venir la fin de la
# protection au lieu de la découvrir après coup.
SEUIL_PREAVIS=$(( VD_TOURS * 9 / 10 ))

for i in $(seq 1 "$VD_TOURS"); do
  ETAT="$(etat_courant)"
  DERNIER_ETAT="$ETAT"

  if [ "$SEUIL_PREAVIS" -gt 0 ] && [ "$i" -eq "$SEUIL_PREAVIS" ] && [ "$PREAVIS_EMIS" = "0" ]; then
    PREAVIS_EMIS=1
    echo "PREAVIS : il reste $(( VD_TOURS - i )) tours de veille — au-delà, l'agent ne sera plus protégé."
  fi

  case "$ETAT" in
    working)
      VU_TRAVAILLER=1
      ;;
    blocked)
      # Un agent bloqué a forcément commencé à travailler.
      VU_TRAVAILLER=1
      ECRAN=$(herdr pane read "$PANE" --lines 40 2>/dev/null)

      # Une demande de permission se reconnaît à son bloc d'options : un curseur
      # sur « 1. Yes » ET une sortie « No » numérotée. Les deux ensemble — un seul
      # des deux pourrait appartenir à autre chose qu'une permission.
      # (La question, elle, peut être repoussée hors écran par un long diff.)
      if printf '%s' "$ECRAN" | grep -qE "❯ 1\. (Yes|Oui)" \
         && printf '%s' "$ECRAN" | grep -qE "^\s+[23]\. (No|Non)"; then

        TOUCHES=""
        # La POSITION d'une option ne dit jamais son sens. On ne descend sur la
        # deuxième que si on a LU qu'elle autorise durablement — et jamais
        # « Yes, and tell Claude… », qui laisserait l'agent attendre une
        # instruction qui ne viendra pas.
        if printf '%s' "$ECRAN" | grep -qE "^\s+2\. (Yes, and don|Yes, and allow|Yes, allow|Oui, et)" \
           && ! printf '%s' "$ECRAN" | grep -qE "^\s+2\. Yes, and tell"; then
          envoyer "Down"
          TOUCHES="Down"
        fi
        envoyer "Enter"
        TOUCHES="${TOUCHES:+$TOUCHES }Enter"

        DEBLOQUES=$((DEBLOQUES+1))
        INCONNUES=0
        echo "[$i] debloque (#$DEBLOQUES)"
        journaliser_deblocage "$i" "$TOUCHES" "$ECRAN"
        sleep "$VD_SLEEP_APRES_DEBLOCAGE"
        continue
      fi

      INCONNUES=$((INCONNUES+1))
      echo "[$i] BLOQUE SANS DEMANDE RECONNUE — je ne reponds pas"
      printf '%s' "$ECRAN" | tail -8
      if [ "$INCONNUES" -ge 3 ]; then
        echo "ARRET : blocage non reconnu, intervention requise"
        terminer ecran-non-reconnu "3 relevés non reconnus consécutifs — elle n'a pas répondu, une intervention humaine est requise"
      fi
      ;;
    done)
      # `done` est un état terminal EXPLICITE : il ne survient pas à la
      # naissance, contrairement à `idle`. Il arme donc la détection.
      VU_TRAVAILLER=1
      sleep "$VD_SLEEP_CONFIRM"
      ETAT2="$(etat_courant)"
      if [ "$ETAT2" = "done" ] || [ "$ETAT2" = "idle" ]; then
        echo "TERMINE apres $DEBLOQUES deblocages"
        terminer agent-termine "l'agent a fini (confirmé sur deux relevés)"
      fi
      ;;
    idle)
      # ⚠️ LE DÉFAUT ① EST ICI. Un agent qui vient de naître est `idle`
      # PARCE QU'IL ATTEND SON BRIEF. Les deux relevés de la garantie n°4
      # avaient raison sur l'état et tort sur le sens. Tant qu'on ne l'a
      # jamais vu au travail, `idle` n'est pas une fin — on veille.
      if [ "$VU_TRAVAILLER" = "0" ]; then
        if [ "$i" = "1" ]; then
          echo "[$i] agent idle sans avoir jamais travaillé — il attend son brief, je veille"
        fi
      else
        # done/idle peut être transitoire ; confirmer sur deux relevés
        sleep "$VD_SLEEP_CONFIRM"
        ETAT2="$(etat_courant)"
        if [ "$ETAT2" = "done" ] || [ "$ETAT2" = "idle" ]; then
          echo "TERMINE apres $DEBLOQUES deblocages"
          terminer agent-termine "l'agent a travaillé puis fini (confirmé sur deux relevés)"
        fi
      fi
      ;;
  esac
  sleep "$VD_SLEEP"
done

# Épuisement des tours. Le cas que l'ancien bilan muet rendait
# indistinguable d'une détection de fin erronée — et les deux appelaient des
# correctifs opposés.
if [ "$VU_TRAVAILLER" = "1" ] && [ "$DERNIER_ETAT" != "done" ] && [ "$DERNIER_ETAT" != "idle" ]; then
  terminer tours-epuises "$VD_TOURS tours épuisés alors que l'agent était encore « ${DERNIER_ETAT:-inconnu} » — il n'est plus protégé, reposer une veille"
elif [ "$VU_TRAVAILLER" = "0" ]; then
  terminer tours-epuises "$VD_TOURS tours épuisés sans que l'agent ait jamais travaillé — il n'a peut-être jamais reçu son brief, et il n'est plus protégé"
else
  terminer tours-epuises "$VD_TOURS tours épuisés — l'agent n'est plus protégé, reposer une veille"
fi
