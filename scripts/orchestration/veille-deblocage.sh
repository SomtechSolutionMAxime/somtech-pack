#!/bin/bash
# ============================================================
# veille-deblocage.sh
# Veille sur un agent herdr : le débloque dès qu'il attend une permission
# reconnue avec certitude. S'arrête quand il a terminé, ou devant un
# blocage qu'elle ne reconnaît pas.
#
# Généralisation du prototype éprouvé du chantier E-20260807-0006 :
#   /private/tmp/.../scratchpad/veiller-e0006.sh
# 14 déblocages, 0 blocage non reconnu à son premier usage réel. Pane et
# agent y étaient codés en dur (w26:p1T / d-20260807-0005) ; ce script les
# prend en paramètres et garde tout le reste de sa logique, littéralement.
#
# GARANTIES (apprises par les usages successifs du prototype — ce sont
# elles que scripts/tests/veille-deblocage.test.sh prouve) :
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
# Usage:
#   veille-deblocage.sh <pane> <agent> [tours] [--dry-run]
#
# --dry-run : journalise ce qu'elle aurait envoyé à `herdr pane send-keys`
# et n'envoie rien. C'est ce qui rend ce script testable.
#
# Variables d'environnement (valeurs par défaut = celles du prototype) :
#   VD_TOURS                  nombre de tours de veille max        (400)
#   VD_SLEEP                  attente entre deux tours              (10s)
#   VD_SLEEP_CONFIRM          attente avant confirmation done/idle  (20s)
#   VD_SLEEP_APRES_DEBLOCAGE  attente après un déblocage envoyé      (3s)
# Un argument positionnel (tours) prévaut sur VD_TOURS si fourni.
# ============================================================

PANE="${1:-}"
AGENT="${2:-}"

if [ -z "$PANE" ] || [ -z "$AGENT" ]; then
  echo "Usage: $0 <pane> <agent> [tours] [--dry-run]" >&2
  exit 1
fi

DRY_RUN=0
CLI_TOURS=""
for a in "${3:-}" "${4:-}"; do
  case "$a" in
    --dry-run) DRY_RUN=1 ;;
    ''|*[!0-9]*) ;;               # ignoré : ni --dry-run, ni un nombre
    *) CLI_TOURS="$a" ;;
  esac
done

VD_TOURS="${CLI_TOURS:-${VD_TOURS:-400}}"
VD_SLEEP="${VD_SLEEP:-10}"
VD_SLEEP_CONFIRM="${VD_SLEEP_CONFIRM:-20}"
VD_SLEEP_APRES_DEBLOCAGE="${VD_SLEEP_APRES_DEBLOCAGE:-3}"

DEBLOQUES=0
INCONNUES=0

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

for i in $(seq 1 "$VD_TOURS"); do
  ETAT=$(herdr agent get "$PANE" 2>/dev/null | python3 -c "import json,sys;print(json.load(sys.stdin)['result']['agent'].get('agent_status',''))" 2>/dev/null)

  case "$ETAT" in
    blocked)
      ECRAN=$(herdr pane read "$PANE" --lines 40 2>/dev/null)

      # Une demande de permission se reconnaît à son bloc d'options : un curseur
      # sur « 1. Yes » ET une sortie « No » numérotée. Les deux ensemble — un seul
      # des deux pourrait appartenir à autre chose qu'une permission.
      # (La question, elle, peut être repoussée hors écran par un long diff.)
      if printf '%s' "$ECRAN" | grep -qE "❯ 1\. (Yes|Oui)" \
         && printf '%s' "$ECRAN" | grep -qE "^\s+[23]\. (No|Non)"; then

        # La POSITION d'une option ne dit jamais son sens. On ne descend sur la
        # deuxième que si on a LU qu'elle autorise durablement — et jamais
        # « Yes, and tell Claude… », qui laisserait l'agent attendre une
        # instruction qui ne viendra pas.
        if printf '%s' "$ECRAN" | grep -qE "^\s+2\. (Yes, and don|Yes, and allow|Yes, allow|Oui, et)" \
           && ! printf '%s' "$ECRAN" | grep -qE "^\s+2\. Yes, and tell"; then
          envoyer "Down"
        fi
        envoyer "Enter"

        DEBLOQUES=$((DEBLOQUES+1))
        INCONNUES=0
        echo "[$i] debloque (#$DEBLOQUES)"
        sleep "$VD_SLEEP_APRES_DEBLOCAGE"
        continue
      fi

      INCONNUES=$((INCONNUES+1))
      echo "[$i] BLOQUE SANS DEMANDE RECONNUE — je ne reponds pas"
      printf '%s' "$ECRAN" | tail -8
      if [ "$INCONNUES" -ge 3 ]; then
        echo "ARRET : blocage non reconnu, intervention requise"
        break
      fi
      ;;
    done|idle)
      # done/idle peut être transitoire ; confirmer sur deux relevés
      sleep "$VD_SLEEP_CONFIRM"
      ETAT2=$(herdr agent get "$PANE" 2>/dev/null | python3 -c "import json,sys;print(json.load(sys.stdin)['result']['agent'].get('agent_status',''))" 2>/dev/null)
      if [ "$ETAT2" = "done" ] || [ "$ETAT2" = "idle" ]; then
        echo "TERMINE apres $DEBLOQUES deblocages"
        break
      fi
      ;;
  esac
  sleep "$VD_SLEEP"
done

echo "--- bilan : $DEBLOQUES deblocages, $INCONNUES blocages non reconnus ---"
