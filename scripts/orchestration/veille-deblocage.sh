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
#        (arguments invalides) . 1   option `--…` inconnue, ou pane/agent
#                                    manquant — refusé tout de suite, jamais
#                                    interprété comme positionnel
#        tours-epuises ......... 2   fin de sa durée (elle dit si l'agent
#                                    travaillait encore : il n'est plus protégé)
#        ecran-non-reconnu ..... 3   3 relevés non reconnus consécutifs
#        interrompue ........... 4   signal reçu — tuée par son environnement
#        pane-disparu .......... 6   le pane n'existe plus (confirmé 2 relevés) —
#                                    À LA POSE (avant tout tour) ou en boucle
#        etat-instable ......... 11  l'agent est absent à chaque relevé, mais le
#                                    PANE alterne présent/absent d'un relevé à
#                                    l'autre : aucun état stable, donc aucun des
#                                    deux motifs ci-dessus n'est établi — et la
#                                    veille ne garde personne pendant ce temps
#        agent-invisible ....... 10  le pane EXISTE mais aucun agent n'y est
#                                    rattaché au registre (confirmé 2 relevés) :
#                                    elle ne peut rien y lire, donc elle ne garde
#                                    personne — et elle le DIT, au lieu de
#                                    déclarer mort un pane vivant (T-20260819-0064)
#        (refus au démarrage) .. 7   une veille garde déjà ce pane
#        releve-illisible ...... 8   herdr ne rend plus rien d'exploitable
#        (détachement raté) .... 9   la veille détachée n'a pas pris son poste
#      Un bilan muet rendait « j'ai cru qu'il avait fini » et « j'ai épuisé
#      mes tours » indistinguables, alors qu'ils appellent des correctifs
#      opposés.
#
#   7. LA FORME PRESCRITE SURVIT PAR CONSTRUCTION. `… &` depuis une session
#      Claude Code en fait une tâche de fond du harnais, qui la tue (mesuré
#      deux fois). `--detach` fait que le script se relance LUI-MÊME détaché
#      (nohup + disown) et rend la main en annonçant son pid et son journal
#      — mais SEULEMENT après avoir vérifié qu'elle a pris son poste :
#      déclenché n'est pas posé, et un pid annoncé pour une veille déjà
#      morte est le faux succès que ce lot corrige.
#      La survie ne dépend plus de la discipline de l'appelant.
#
#   8. ON SAIT SUR QUOI CHACUNE VEILLE. Chaque veille s'inscrit au registre
#      (pane, agent, pid, journal, début, tours) et y inscrit son motif en
#      s'arrêtant. `--list` rend le pane ET l'agent de chacune — un compte
#      global (« 3 veilles tournent ») ne dit pas si l'une est la tienne.
#
#  10. ELLE NE VEILLE PAS SUR UN PANE QUI N'EXISTE PLUS. Un pane fermé sous
#      la veille la laissait tourner jusqu'à épuisement de ses tours, en
#      s'annonçant « vivante » au registre alors qu'elle ne gardait plus
#      rien — trouvé en posant une veille réelle, pas en test. Elle s'arrête
#      désormais sur `pane-disparu` (code 6), confirmé sur DEUX relevés :
#      un hoquet de herdr abandonnerait un agent bien vivant. Cette mesure
#      s'applique maintenant AUSSI à la pose elle-même (point 11 ci-dessous),
#      pas seulement en boucle.
#
# ── T-20260819-0023 / E-20260819-0003 — deux défauts mesurés le 2026-08-19
#    (`--detach <pane> <agent>` accepté en silence, pane inexistant détecté
#    trop tard) :
#
#  11. AUCUNE OPTION N'EST JAMAIS AVALÉE COMME UN POSITIONNEL. Le parsing ne
#      cherchait les drapeaux (`--dry-run`, `--detach`) que dans $3/$4/$5 :
#      `--detach` posé AVANT le pane et l'agent devenait lui-même le pane, et
#      le vrai pane devenait l'agent — la veille s'inscrivait au registre sur
#      un pane inexistant, rendait un pid, tous les signes d'une pose
#      réussie, sans jamais garder personne (trace réelle du registre du
#      poste : « pane=--detach agent=w0:p1T … motif=pane-disparu »). Les
#      drapeaux connus (`--dry-run`, `--detach`, `--list`, `--duree`) sont
#      désormais reconnus PARTOUT dans la ligne de commande ; tout jeton
#      `--…` inconnu est REFUSÉ tout de suite (jamais pris pour un pane, un
#      agent ou un nombre de tours).
#
#  12. LE PANE EST VÉRIFIÉ À LA POSE, PAS SEULEMENT EN BOUCLE. Un pane
#      inexistant n'était détecté qu'au premier tour de ronde — après avoir
#      déjà pris le verrou et écrit le registre. Il est désormais vérifié
#      AVANT toute prise (même garantie que le point 10 : DEUX relevés
#      concordants, rapprochés plutôt qu'espacés d'un tour entier), au même
#      titre que le nom de l'agent (bloc Usage, refusé tout de suite).
#
#   9. LES DEUX CHIFFRES SONT MESURABLES. Une garde se juge sur ce qu'elle
#      débloque à raison ET sur ce qu'elle refuse à tort. Le journal porte
#      donc les DEUX populations : chaque déblocage avec l'écran qui l'a
#      déclenché et la touche envoyée, et chaque REFUS avec l'écran qu'elle
#      n'a pas reconnu. Un tiers relit et classe les deux ; un compte sans
#      sa méthode est un fait invérifiable.
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
# ⚠️ --dry-run, --detach, --list et --duree sont reconnus OÙ QU'ILS SOIENT
#    dans la ligne de commande (T-20260819-0027) — jamais avalés comme un
#    pane, un agent ou un nombre de tours. Toute autre option `--…` est
#    REFUSÉE explicitement (code 1), jamais interprétée en silence.
#
# Variables d'environnement :
#   VD_TOURS                  nombre de tours de veille max       (2000)
#   VD_SLEEP                  attente entre deux tours              (10s)
#   VD_SLEEP_CONFIRM          attente avant confirmation done/idle  (20s)
#   VD_SLEEP_APRES_DEBLOCAGE  attente après un déblocage envoyé      (3s)
#   VD_SLEEP_POSE             attente entre les 2 relevés du contrôle
#                              de pane À LA POSE (avant tout tour)   (0.3s)
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

# Ce pid est-il RÉELLEMENT une veille sur ce pane ? `kill -0` ne répond qu'à
# « un processus porte ce pid en ce moment » : un pid recyclé par un
# processus sans rapport ferait passer une veille morte pour vivante —
# l'inverse exact de ce que le registre promet.
veille_vivante() {
  pid_test="$1"; pane_test="$2"
  case "$pid_test" in ''|*[!0-9]*) return 1 ;; esac
  kill -0 "$pid_test" 2>/dev/null || return 1
  cmd="$(ps -p "$pid_test" -o command= 2>/dev/null)"
  case "$cmd" in
    *veille-deblocage.sh*"$pane_test"*) return 0 ;;
    *) return 1 ;;
  esac
}

# Rend le statut de l'agent — ou __ABSENT__ quand herdr répond que le pane ou
# l'agent n'existe plus. Un silence de herdr (sortie vide) reste distinct de
# cette absence explicite : le premier est un hoquet, la seconde un fait.
# Définie ici (avant tout parsing) : elle sert désormais AUSSI à vérifier le
# pane À LA POSE (T-20260819-0027, voir plus bas), pas seulement en boucle.
etat_courant() {
  # 2>&1 et non 2>/dev/null : herdr écrit son « agent_not_found » sur STDERR
  # avec rc=1 (mesuré). Le jeter rendait l'absence indétectable — la veille
  # tournait alors sur un pane fermé sans jamais pouvoir le dire.
  herdr agent get "$PANE" 2>&1 | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print('')
    raise SystemExit
err = d.get('error') or {}
if 'not_found' in str(err.get('code', '')):
    print('__ABSENT__')
else:
    res = d.get('result') or {}
    print((res.get('agent') or {}).get('agent_status', ''))
" 2>/dev/null
}

# Le PANE existe-t-il ? — et c'est une question DIFFÉRENTE de « un agent y
# tourne-t-il ». `herdr agent get` rend `agent_not_found` dans les DEUX cas :
# pane fermé, ou pane bien vivant qui n'héberge pas (encore) d'agent. Passer
# le contrôle de pose par cette sonde-là refusait donc des poses parfaitement
# légitimes — **mesuré sur les panes réels du poste : 141 sur 231**, c'est-à-dire
# six poses sur dix. Une garde qui refuse à ce rythme ne survit pas : le premier
# qui la rencontre la retire, et elle emporte la protection qu'elle apportait.
#
# `herdr pane get` distingue : `pane_not_found` (rc=1, sur STDERR) pour un pane
# qui n'existe pas, une réponse normale pour un pane vivant même sans agent.
pane_existe() {
  # 2>&1 comme pour `etat_courant`, et pour la même raison mesurée : herdr écrit
  # son erreur sur STDERR. La jeter rendrait l'absence indétectable.
  herdr pane get "$PANE" 2>&1 | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print('__ILLISIBLE__')          # un hoquet de herdr n'est pas une absence
    raise SystemExit
err = d.get('error') or {}
print('__ABSENT__' if 'not_found' in str(err.get('code', '')) else '__PRESENT__')
" 2>/dev/null
}

# ── T-20260819-0023 / T-20260819-0027 — AUCUNE OPTION N'EST JAMAIS AVALÉE
#    COMME UN POSITIONNEL. `veille-deblocage.sh --detach <pane> <agent>` était
#    accepté EN SILENCE : le parsing ne cherchait les drapeaux que dans
#    $3/$4/$5, donc `--detach` devenait le pane et le pane devenait l'agent —
#    la veille s'inscrivait au registre sur un pane inexistant, rendait un
#    pid, tous les signes d'une pose réussie, sans jamais garder personne
#    (trace réelle : « pane=--detach agent=w0:p1T … motif=pane-disparu »).
#    CHOIX DE CONCEPTION (à écrire, pas à deviner) : RECONNAÎTRE PARTOUT les
#    drapeaux connus plutôt que refuser selon leur position, et REFUSER tout
#    jeton `--…` inconnu — jamais le prendre pour un pane/agent/tours. Un
#    pane ou un agent herdr ne commence jamais par `--` (format `wN:pM` /
#    noms d'agents) : la distinction drapeau/positionnel est donc sans
#    ambiguïté, et « reconnaître partout » répare l'appel fautif du ticket
#    au lieu de se contenter de le rejeter.
MODE_LIST=0
MODE_DUREE=0
DRY_RUN=0
DETACH=0
PANE=""
AGENT=""
CLI_TOURS_BRUT=""
for a in "$@"; do
  case "$a" in
    --dry-run) DRY_RUN=1 ;;
    --detach)  DETACH=1 ;;
    --list)    MODE_LIST=1 ;;
    --duree)   MODE_DUREE=1 ;;
    --*)
      echo "REFUS : option inconnue « $a »." >&2
      echo "Usage: $0 <pane> <agent> [tours] [--dry-run] [--detach]" >&2
      echo "       $0 --list | --duree" >&2
      exit 1
      ;;
    *)
      # Positionnels affectés DANS L'ORDRE D'APPARITION, jamais par position
      # fixe $1/$2/$3 — c'est ce qui permet aux drapeaux de précéder le pane
      # et l'agent sans les avaler. Un positionnel excédentaire est ignoré,
      # comme avant ce correctif.
      if [ -z "$PANE" ]; then
        PANE="$a"
      elif [ -z "$AGENT" ]; then
        AGENT="$a"
      elif [ -z "$CLI_TOURS_BRUT" ]; then
        CLI_TOURS_BRUT="$a"
      fi
      ;;
  esac
done

# --list — le pane ET l'agent de chaque veille, jamais un simple compte.
# Reconnu où qu'il apparaisse dans la ligne de commande (voir motif ci-dessus).
if [ "$MODE_LIST" = "1" ]; then
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
    elif veille_vivante "$r_pid" "$r_pane"; then
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
# Reconnu où qu'il apparaisse dans la ligne de commande (voir motif ci-dessus).
if [ "$MODE_DUREE" = "1" ]; then
  echo "DUREE_NOMINALE_S=$(( ${VD_TOURS:-$VD_TOURS_DEFAUT} * VD_SLEEP ))"
  exit 0
fi

if [ -z "$PANE" ] || [ -z "$AGENT" ]; then
  echo "Usage: $0 <pane> <agent> [tours] [--dry-run] [--detach]" >&2
  echo "       $0 --list | --duree" >&2
  exit 1
fi

case "$CLI_TOURS_BRUT" in
  ''|*[!0-9]*) CLI_TOURS="" ;;                # ignoré : n'est pas un nombre
  *)           CLI_TOURS="$CLI_TOURS_BRUT" ;;
esac

VD_TOURS="${CLI_TOURS:-${VD_TOURS:-$VD_TOURS_DEFAUT}}"

# ── LE PANE EST VÉRIFIÉ À LA POSE, PAS SEULEMENT EN BOUCLE (T-20260819-0027).
#    Même exigence que la garantie n°10 (motif `pane-disparu`, code 6) : DEUX
#    relevés concordants avant de conclure. Mais ici RAPPROCHÉS (VD_SLEEP_POSE,
#    pas VD_SLEEP) puisqu'il s'agit de refuser AVANT tout tour de ronde — le
#    nom de l'agent est déjà refusé tout de suite (bloc Usage ci-dessus), le
#    pane mérite la même franchise. Ni verrou ni registre ne sont encore pris
#    à ce point : un simple message + exit suffit, comme pour l'usage invalide.
#    ⚠️ ET IL INTERROGE LE PANE, PAS L'AGENT — `herdr agent get` rend
#    `agent_not_found` aussi bien pour un pane fermé que pour un pane vivant
#    sans agent : mesuré sur les panes réels du poste, **141 sur 231** auraient
#    été refusés à tort. `herdr pane get` distingue les deux.
#    Ce contrôle coûte donc UN relevé herdr de plus par pose : il pose une autre
#    question que la boucle, sa réponse ne peut pas lui servir de premier tour.
VD_SLEEP_POSE="${VD_SLEEP_POSE:-0.3}"
if [ "$(pane_existe)" = "__ABSENT__" ]; then
  # DEUX relevés concordants avant de conclure — même exigence que la garantie
  # n°10 en boucle, mais rapprochés : il s'agit de refuser AVANT tout tour de
  # ronde, pas de survivre à un hoquet pendant des heures. Un pane qui apparaît
  # entre les deux relevés n'est PAS refusé (éprouvé par le banc).
  sleep "$VD_SLEEP_POSE"
  if [ "$(pane_existe)" = "__ABSENT__" ]; then
    echo "MOTIF: pane-disparu — le pane $PANE n'existe pas au moment de la pose (confirmé sur deux relevés rapprochés) — rien à garder" >&2
    exit 6
  fi
fi

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

  # ⚠️ DÉCLENCHÉ N'EST PAS POSÉ. La veille détachée peut mourir aussitôt —
  # le pane est déjà gardé, le registre est en lecture seule, herdr est
  # absent. Annoncer « veille détachée · pid=… » et rendre 0 dans ce cas
  # rend à l'orchestrateur exactement le faux succès que ce lot corrige : il
  # croirait son agent protégé. On attend donc qu'elle ait pris son poste —
  # sur un SIGNE (son inscription au registre), jamais sur un délai.
  PRISE=0
  for _ in $(seq 1 40); do
    if [ -f "${VD_REGISTRE_DIR}/${PANE_SLUG}-${ENFANT}.veille" ]; then
      PRISE=1
      break
    fi
    kill -0 "$ENFANT" 2>/dev/null || break
    sleep 0.25
  done

  if [ "$PRISE" != "1" ]; then
    echo "ÉCHEC : la veille détachée ne veille pas — elle s'est arrêtée au démarrage." >&2
    [ -f "$LOG" ] && cat "$LOG" >&2
    if [ -f "$LOG" ] && grep -q "REFUS" "$LOG" 2>/dev/null; then
      exit 7
    fi
    exit 9
  fi

  echo "veille détachée · pane=$PANE agent=$AGENT pid=$ENFANT"
  echo "journal : $LOG"
  echo "l'arrêter : kill $ENFANT   ·   les lister : $0 --list"
  exit 0
fi

VERROU="${VD_REGISTRE_DIR}/.verrou-${PANE_SLUG}"

# `mkdir` réussit pour un seul appelant, même simultané — c'est ce qui rend
# la prise atomique là où un « lire le registre puis s'y inscrire » laissait
# passer deux veilles.
prendre_le_pane() {
  if mkdir "$VERROU" 2>/dev/null; then
    echo "$$" > "${VERROU}/pid" 2>/dev/null
    return 0
  fi
  # Le verrou existe. Le tenant est-il une veille vivante sur ce pane ?
  # Son pid peut ne pas être encore écrit : on patiente brièvement plutôt
  # que de conclure à l'orphelin et de lui voler le pane.
  tenant=""
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    tenant="$(cat "${VERROU}/pid" 2>/dev/null)"
    [ -n "$tenant" ] && break
    sleep 0.1
  done
  if veille_vivante "$tenant" "$PANE"; then
    return 1
  fi
  # Verrou orphelin (veille tuée sans pouvoir le rendre) : on le reprend,
  # sinon un pane resterait condamné après le premier arrêt brutal.
  rm -rf "$VERROU" 2>/dev/null
  if mkdir "$VERROU" 2>/dev/null; then
    echo "$$" > "${VERROU}/pid" 2>/dev/null
    return 0
  fi
  return 1
}

rendre_le_pane() {
  [ "$(cat "${VERROU}/pid" 2>/dev/null)" = "$$" ] && rm -rf "$VERROU" 2>/dev/null
}

if ! prendre_le_pane; then
  autre_pid="$(cat "${VERROU}/pid" 2>/dev/null)"
  echo "REFUS : une veille garde déjà le pane $PANE (pid=${autre_pid:-?})." >&2
  echo "        L'arrêter d'abord (kill ${autre_pid:-<pid>}), ou la laisser faire — deux veilles se marcheraient dessus." >&2
  exit 7
fi

DEBLOQUES=0
INCONNUES=0
# Un relevé illisible — herdr muet, sortie tronquée, ligne de diagnostic sur
# le flux — n'était ni une absence ni un écran non reconnu : c'était un tour
# TOTALEMENT silencieux. La veille pouvait devenir aveugle sans le dire.
ILLISIBLES=0
# Discriminant du défaut ① : tant qu'il vaut 0, un `idle` veut dire « il
# attend qu'on lui parle », jamais « il a fini ».
VU_TRAVAILLER=0
PREAVIS_EMIS=0
DERNIER_ETAT=""
# Un pane peut être fermé SOUS la veille. Sans ce compteur, elle continue de
# tourner sur un pane qui n'existe plus — mesuré sur un agent d'essai réel :
# elle s'annonçait « vivante » au registre en ne gardant plus rien.
ABSENCES=0
# Et le cas que « pane disparu » avalait : un pane VIVANT dont aucun agent n'est
# rattaché au registre. `agent get` rend `agent_not_found` pour les DEUX, et les
# confondre faisait déclarer mort un pane bien vivant (T-20260819-0064).
INVISIBLES=0
# ⚠️ ET LE COMPTEUR QUE NI L'UN NI L'AUTRE NE REMET À ZÉRO — trouvé par une revue
# de fond. `ABSENCES` et `INVISIBLES` s'annulent mutuellement, ce qui est juste
# tant que le pane répond de façon STABLE. Si `pane get` alterne présent/absent à
# chaque relevé, aucun des deux n'atteint jamais 2 : ils se cannibalisent, la
# veille épuise ses 2000 tours sans jamais conclure, et rend « tours-epuises —
# il n'a peut-être jamais reçu son brief » sur un agent absent à CHAQUE relevé.
# Un message qui minimise, là où ce lot promet un diagnostic.
#
# Celui-ci compte les relevés SANS ÉTAT LISIBLE, quel que soit ce que dit le
# pane. Les deux autres choisissent le MOTIF ; ils ne décident pas à eux seuls
# s'il faut conclure. Seul un état réel (working/blocked/done/idle) le remet à
# zéro — c'est-à-dire la seule chose qui prouve qu'on voit de nouveau l'agent.
ABSENT_TOTAL=0
# Au-delà, on cesse d'attendre deux relevés concordants qui ne viendront pas.
# Quatre laisse passer un hoquet ISOLÉ (une seule alternance) sans crier, et
# attrape l'oscillation soutenue dès son deuxième aller-retour.
SEUIL_INSTABLE=4

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
if [ ! -f "$REGISTRE_FICHIER" ]; then
  # Les écritures suivantes restent silencieuses par choix (une veille ne
  # doit pas mourir d'un problème de registre), mais l'orchestrateur doit
  # savoir UNE FOIS que ni le registre ni le journal ne le renseigneront.
  echo "AVERTISSEMENT : registre non écrivable ($VD_REGISTRE_DIR) — cette veille ne sera ni inventoriable ni relisable." >&2
fi

# Codes de sortie : un appelant machine tranche sans lire du texte.
code_motif() {
  case "$1" in
    agent-termine)     echo 0 ;;
    tours-epuises)     echo 2 ;;
    ecran-non-reconnu) echo 3 ;;
    interrompue)       echo 4 ;;
    pane-disparu)      echo 6 ;;
    releve-illisible)  echo 8 ;;
    # ⚠️ 10, ET SURTOUT PAS 5 : `5` est le FOURRE-TOUT de cette table (le `*)`
    # juste dessous). Un motif inconnu — une faute de frappe dans un appel à
    # `terminer` — rend déjà 5. Y placer `agent-invisible` le rendrait
    # indistinguable d'une erreur de programmation : exactement le défaut que ce
    # lot ferme, deux choses différentes qui rendent le même signal.
    agent-invisible)   echo 10 ;;
    etat-instable)     echo 11 ;;
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
  rendre_le_pane
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

# Consigne un REFUS — un écran qu'elle n'a pas reconnu et auquel elle n'a
# donc pas répondu. Sans cette moitié, le journal ne portait qu'une des deux
# populations : « ce qu'elle débloque à tort » était relisable, « ce qu'elle
# refuse à tort » ne l'était pas. Une garde se juge sur les DEUX.
journaliser_refus() {
  {
    echo "=== REFUS #$INCONNUES · tour $1 · $(date -u +%Y-%m-%dT%H:%M:%SZ) · pane=$PANE agent=$AGENT"
    echo "--- aucune touche envoyée (écran non reconnu)"
    echo "--- écran refusé :"
    printf '%s\n' "$2"
    echo "=== fin refus #$INCONNUES"
    echo
  } >> "$VD_JOURNAL" 2>/dev/null
}

# Seuil de préavis : 90 % des tours. Elle prévient AVANT de s'éteindre, une
# seule fois — un orchestrateur qui lit son journal voit venir la fin de la
# protection au lieu de la découvrir après coup.
SEUIL_PREAVIS=$(( VD_TOURS * 9 / 10 ))

for i in $(seq 1 "$VD_TOURS"); do
  # ⚠️ PAS DE RÉUTILISATION DU RELEVÉ DE POSE, ET C'EST VOULU. Le contrôle de
  # pose interroge LE PANE (`pane get`), la boucle interroge L'AGENT
  # (`agent get`) : deux questions différentes, deux réponses différentes.
  # Une version intermédiaire recyclait le relevé de pose comme premier tour ;
  # elle est tombée dès que le contrôle a changé d'objet, et la boucle lisait
  # alors un état VIDE qu'elle prenait pour un relevé illisible — 14 tests
  # rouges d'un coup. Le coût du relevé supplémentaire est d'un appel herdr par
  # pose ; le prix d'une garde qui lit le mauvais objet est plus élevé.
  ETAT="$(etat_courant)"
  DERNIER_ETAT="$ETAT"

  if [ "$SEUIL_PREAVIS" -gt 0 ] && [ "$i" -eq "$SEUIL_PREAVIS" ] && [ "$PREAVIS_EMIS" = "0" ]; then
    PREAVIS_EMIS=1
    echo "PREAVIS : il reste $(( VD_TOURS - i )) tours de veille — au-delà, l'agent ne sera plus protégé."
  fi

  case "$ETAT" in
    '')
      # Ni un statut, ni une absence explicite : herdr n'a rien rendu
      # d'exploitable. Trois de suite et la veille est aveugle — elle le dit
      # au lieu de tourner en croyant veiller.
      ILLISIBLES=$((ILLISIBLES+1))
      echo "[$i] relevé illisible ($ILLISIBLES/3) — herdr n'a rien rendu d'exploitable"
      if [ "$ILLISIBLES" -ge 3 ]; then
        terminer releve-illisible "3 relevés illisibles consécutifs — la veille ne voit plus l'agent, elle ne le garde donc plus"
      fi
      ;;
    __ABSENT__)
      # ⚠️ `agent get` NE DIT PAS QUE LE PANE EST MORT — il dit qu'aucun agent ne
      # lui est rattaché, ce qui arrive AUSSI sur un pane parfaitement vivant.
      # Mesuré sur ce poste : un pane hébergeant un agent Claude visible à
      # l'écran, mais absent du registre, faisait rendre à cette branche « le
      # pane n'existe plus — il n'y a plus rien à garder ». TROIS affirmations
      # fausses : le pane existe, l'agent est vivant, et il y a précisément
      # quelqu'un à garder que plus personne ne garde.
      #
      # **Un silence laisse la question ouverte ; un mensonge la ferme du mauvais
      # côté** — l'orchestrateur qui lit ce motif ferme un pane vivant en croyant
      # nettoyer. C'était en outre une contradiction INTERNE : le contrôle à la
      # pose interroge `pane get` et laisse passer, la boucle interrogeait
      # `agent get` et concluait l'inverse sur le même pane (T-20260819-0064).
      #
      # On demande donc au PANE, qui est la question réellement posée. Les DEUX
      # branches gardent l'exigence de deux relevés concordants (garantie n°4),
      # et chaque compteur remet l'autre à zéro — deux relevés « concordants »
      # qui ne portent pas sur le même fait ne concordent pas.
      #
      # ⚠️ ET CE COMMENTAIRE A MENTI PENDANT UN COMMIT, RELEVÉ PAR UNE REVUE DE
      # FOND. Il affirmait qu'« un hoquet de herdr ne doit abandonner personne,
      # dans un sens ni dans l'autre ». **C'était faux dès que le hoquet change
      # de sens à chaque tour** : les deux compteurs se cannibalisent, aucun
      # n'atteint 2, et la veille brûlait ses 2000 tours sans jamais conclure —
      # pour finir sur « tours-epuises — il n'a peut-être jamais reçu son
      # brief », un message qui MINIMISE une absence totale et continue.
      # C'est `ABSENT_TOTAL` qui ferme ce trou : il compte les relevés sans état
      # lisible et ne se laisse remettre à zéro que par un état réel.
      ABSENT_TOTAL=$((ABSENT_TOTAL+1))
      if [ "$(pane_existe)" = "__PRESENT__" ]; then
        INVISIBLES=$((INVISIBLES+1))
        ABSENCES=0
        echo "[$i] pane VIVANT mais aucun agent rattaché au registre ($INVISIBLES/2)"
        if [ "$INVISIBLES" -ge 2 ]; then
          terminer agent-invisible "le pane $PANE existe, mais aucun agent n'y est rattaché au registre (confirmé sur deux relevés) — elle ne peut rien y lire, donc elle ne garde personne. Le pane et son agent sont peut-être bien vivants : va le voir AVANT de le fermer, et repose une veille une fois l'agent rattaché"
        fi
      else
        ABSENCES=$((ABSENCES+1))
        INVISIBLES=0
        echo "[$i] pane introuvable ($ABSENCES/2)"
        if [ "$ABSENCES" -ge 2 ]; then
          terminer pane-disparu "le pane $PANE n'existe plus (confirmé sur deux relevés) — il n'y a plus rien à garder"
        fi
      fi
      # Ni l'un ni l'autre n'a pu se confirmer, et pourtant l'agent n'a pas été
      # lu une seule fois depuis $ABSENT_TOTAL relevés : c'est le pane qui
      # oscille. On le dit, plutôt que d'attendre des relevés concordants qui ne
      # viendront pas — attendre, ici, c'est brûler la veille en silence.
      if [ "$ABSENT_TOTAL" -ge "$SEUIL_INSTABLE" ]; then
        terminer etat-instable "l'agent n'a pas été lu une seule fois en $ABSENT_TOTAL relevés, et le pane $PANE alterne présent/absent d'un relevé à l'autre — aucun des deux diagnostics ne peut se confirmer, et pendant ce temps la veille ne garde personne. Va voir le pane : herdr ne rend pas un état stable"
      fi
      ;;
    working)
      ABSENCES=0
      ILLISIBLES=0
      INVISIBLES=0
      ABSENT_TOTAL=0
      # « 3 relevés CONSÉCUTIFS » : un tour de travail rompt la série. Sans
      # ce reset, trois écrans bizarres espacés dans le temps coupaient la
      # veille sur un agent vivant — d'autant plus probable que ce lot
      # étend la durée à 2000 tours.
      INCONNUES=0
      VU_TRAVAILLER=1
      ;;
    blocked)
      ABSENCES=0
      ILLISIBLES=0
      INVISIBLES=0
      ABSENT_TOTAL=0
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
      journaliser_refus "$i" "$ECRAN"
      if [ "$INCONNUES" -ge 3 ]; then
        echo "ARRET : blocage non reconnu, intervention requise"
        terminer ecran-non-reconnu "3 relevés non reconnus consécutifs — elle n'a pas répondu, une intervention humaine est requise"
      fi
      ;;
    done)
      ABSENCES=0
      ILLISIBLES=0
      INVISIBLES=0
      ABSENT_TOTAL=0
      INCONNUES=0
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
      ABSENCES=0
      ILLISIBLES=0
      INVISIBLES=0
      ABSENT_TOTAL=0
      INCONNUES=0
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
