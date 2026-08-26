#!/usr/bin/env bash
# ============================================================
# veille-deblocage.test.sh
# Preuve exécutée en CI des garanties de veille-deblocage.sh (E-20260807-0007).
#
# ⚠️ Ce fichier vit délibérément sous scripts/tests/ — c'est le seul dossier
# que .github/workflows/tests.yml (job shell-tests) ramasse. Un test posé
# ailleurs ne s'exécute nulle part, et une preuve que personne n'exécute
# n'est pas une preuve.
#
# Ce qui est prouvé (dérivé du prototype éprouvé, E-20260807-0006, 14
# déblocages réels, 0 blocage non reconnu à son premier usage) :
#   G1. Une demande de permission n'est reconnue que par DEUX signes
#       concordants — « ❯ 1. Yes|Oui » ET une sortie « No|Non » numérotée.
#   G2. La position d'une option ne dit jamais son sens : on ne descend sur
#       l'option 2 que si elle autorise durablement, jamais si elle est
#       « Yes, and tell Claude what to do differently » (le piège nommé).
#   G3. Devant un écran non reconnu, elle ne répond pas, le dit, et
#       s'arrête après 3 relevés non reconnus consécutifs.
#   G4. done|idle n'est annoncé qu'après confirmation sur deux relevés.
#
# Un faux `herdr` est posé en tête de PATH ; il rend des réponses scriptées
# via FAKE_HERDR_STATUS / FAKE_HERDR_SCREEN_FILE et journalise chaque appel
# dans FAKE_HERDR_WITNESS. La veille est toujours lancée en --dry-run : elle
# journalise ce qu'elle aurait envoyé au lieu de l'envoyer, ce qui est ce
# qui rend ce script testable sans pane réel.
#
# Usage : bash scripts/tests/veille-deblocage.test.sh (depuis n'importe quel cwd)
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VEILLE="${ROOT}/orchestration/veille-deblocage.sh"

PASS_FILE="$(mktemp)"; FAIL_FILE="$(mktemp)"
WORK="$(mktemp -d)"
trap 'rm -rf "$PASS_FILE" "$FAIL_FILE" "$WORK"' EXIT
ok() { echo "  ✅ $1"; echo x >> "$PASS_FILE"; }
ko() { echo "  ❌ $1"; echo x >> "$FAIL_FILE"; }

echo "== Veille de déblocage — preuve exécutée (E-20260807-0007) =="

if [ ! -f "$VEILLE" ]; then
  ko "script introuvable : $VEILLE"
  echo; echo "== Bilan : 0 réussis, 1 échoués =="
  exit 1
fi

# --- faux `herdr` : rend des réponses scriptées, journalise chaque appel ------
BINDIR="${WORK}/bin"; mkdir -p "$BINDIR"
cat > "${BINDIR}/herdr" <<'EOF'
#!/usr/bin/env bash
# Faux herdr pour les tests de veille-deblocage.sh.
[ -n "${FAKE_HERDR_WITNESS:-}" ] && printf '%s\n' "herdr $*" >> "$FAKE_HERDR_WITNESS"

case "${1:-}" in
  agent)
    if [ "${2:-}" = "get" ]; then
      # Séquence de statuts (un par ligne) : le n-ième appel lit la n-ième
      # ligne, plafonné à la dernière une fois épuisée. Sans array (bash 3.2
      # compatible) — c'est ce qui permet de simuler un statut TRANSITOIRE
      # (ex. « done » à l'appel 1, autre chose à l'appel 2, la confirmation).
      if [ -n "${FAKE_HERDR_STATUS_SEQ_FILE:-}" ] && [ -f "${FAKE_HERDR_STATUS_SEQ_FILE:-}" ]; then
        idx_file="${FAKE_HERDR_STATUS_SEQ_FILE}.idx"
        idx=1
        [ -f "$idx_file" ] && idx=$(( $(cat "$idx_file") + 1 ))
        echo "$idx" > "$idx_file"
        total=$(wc -l < "$FAKE_HERDR_STATUS_SEQ_FILE" | tr -d ' ')
        use="$idx"
        [ "$use" -gt "$total" ] && use="$total"
        status="$(sed -n "${use}p" "$FAKE_HERDR_STATUS_SEQ_FILE")"
      else
        status="${FAKE_HERDR_STATUS:-blocked}"
      fi
      if [ "$status" = "illisible" ]; then
        # Sortie non-JSON sur le flux combiné : ni un statut, ni une absence.
        printf 'herdr: warning: reconnecting to daemon
'
        exit 0
      fi
      if [ "$status" = "absent" ]; then
        # Ce que le VRAI herdr rend quand le pane a été fermé sous la veille :
        # l'erreur part sur STDERR et le code de retour vaut 1 — mesuré. Un
        # double qui la mettrait sur stdout serait plus complaisant que le
        # service, et le test passerait sur un correctif qui ne mord pas.
        printf '{"error":{"code":"agent_not_found","message":"agent target %s not found"},"id":"cli:agent:get"}' "${3:-}" >&2
        exit 1
      fi
      printf '{"result":{"agent":{"agent_status":"%s"}}}' "$status"
      exit 0
    fi
    ;;
  pane)
    case "${2:-}" in
      read)
        # ⚠️ CE DOUBLE HONORE `--lines`, COMME LE SERVICE. Il rendait l'écran
        # ENTIER quel que soit le nombre demandé : la fenêtre de lecture des
        # sondes n'était donc éprouvée par rien, et `--lines 40` → `--lines 1`
        # SURVIVAIT à toute la suite (mesuré par mutation). Un double plus
        # complaisant que le service ne rate pas seulement un défaut : il rend
        # invérifiable tout ce qui dépend de ce qu'il simplifie.
        # L'écran peut CHANGER en cours de veille — une marque qui disparaît
        # puis revient, un dialogue qui s'ouvre. On le simule par une SÉQUENCE
        # DE RELEVÉS (un chemin de fichier par ligne, le n-ième relevé lit la
        # n-ième ligne, clampé à la dernière), même mécanique que la séquence de
        # statuts d'`agent get`. JAMAIS par une horloge : un test qui bascule
        # sur `sleep 0.4` mesure la charge du poste, pas le comportement du
        # script — vert chez l'auteur, rouge en CI un jour de charge.
        f_ecran="${FAKE_HERDR_SCREEN_FILE:-}"
        if [ -n "${FAKE_HERDR_SCREEN_SEQ_FILE:-}" ] && [ -f "${FAKE_HERDR_SCREEN_SEQ_FILE:-}" ]; then
          ridx_file="${FAKE_HERDR_SCREEN_SEQ_FILE}.ridx"
          ridx=1
          [ -f "$ridx_file" ] && ridx=$(( $(cat "$ridx_file") + 1 ))
          echo "$ridx" > "$ridx_file"
          rtotal=$(wc -l < "$FAKE_HERDR_SCREEN_SEQ_FILE" | tr -d ' ')
          ruse="$ridx"
          [ "$ruse" -gt "$rtotal" ] && ruse="$rtotal"
          f_ecran="$(sed -n "${ruse}p" "$FAKE_HERDR_SCREEN_SEQ_FILE")"
        fi
        if [ -n "$f_ecran" ] && [ -f "$f_ecran" ]; then
          n_lignes=""
          prec=""
          for arg in "$@"; do
            [ "$prec" = "--lines" ] && n_lignes="$arg"
            prec="$arg"
          done
          case "$n_lignes" in
            ''|*[!0-9]*) cat "$f_ecran" ;;
            *) tail -n "$n_lignes" "$f_ecran" ;;
          esac
        fi
        exit 0
        ;;
      send-keys) exit 0 ;;
      get)
        # ⚠️ CE DOUBLE DOIT ÊTRE AUSSI SÉVÈRE QUE LE SERVICE, JAMAIS PLUS COMPLAISANT.
        # Mesuré sur le vrai herdr : `pane get` d'un pane inexistant écrit son
        # `pane_not_found` sur STDERR et sort en rc=1 ; un pane qui EXISTE mais
        # n'héberge aucun agent répond normalement, avec `agent_status: unknown`.
        # C'est précisément la distinction qu'`agent get` ne fait PAS — lui rend
        # `agent_not_found` dans les DEUX cas.
        # Séquence de présences (un mot par ligne : `absent` ou `present`),
        # même mécanique que la séquence de statuts d'`agent get` : elle est ce
        # qui permet d'éprouver la CONFIRMATION SUR DEUX RELEVÉS à la pose —
        # un pane absent au premier relevé et présent au second ne doit pas
        # être refusé.
        if [ -n "${FAKE_HERDR_PANE_SEQ_FILE:-}" ] && [ -f "${FAKE_HERDR_PANE_SEQ_FILE:-}" ]; then
          pidx_file="${FAKE_HERDR_PANE_SEQ_FILE}.idx"
          pidx=1
          [ -f "$pidx_file" ] && pidx=$(( $(cat "$pidx_file") + 1 ))
          echo "$pidx" > "$pidx_file"
          ptotal=$(wc -l < "$FAKE_HERDR_PANE_SEQ_FILE" | tr -d ' ')
          puse="$pidx"
          [ "$puse" -gt "$ptotal" ] && puse="$ptotal"
          pval="$(sed -n "${puse}p" "$FAKE_HERDR_PANE_SEQ_FILE")"
          if [ "$pval" = "absent" ]; then
            printf '{"error":{"code":"pane_not_found","message":"pane %s not found"},"id":"cli:pane:get"}' "${3:-}" >&2
            exit 1
          fi
          printf '{"result":{"pane":{"pane_id":"%s","agent_status":"unknown"}}}' "${3:-}"
          exit 0
        fi
        if [ "${FAKE_HERDR_PANE_ABSENT:-0}" = "1" ]; then
          printf '{"error":{"code":"pane_not_found","message":"pane %s not found"},"id":"cli:pane:get"}' "${3:-}" >&2
          exit 1
        fi
        printf '{"result":{"pane":{"pane_id":"%s","agent_status":"unknown"}}}' "${3:-}"
        exit 0
        ;;
    esac
    ;;
esac
exit 0
EOF
chmod +x "${BINDIR}/herdr"

SCREEN_FILE="${WORK}/screen.txt"
WITNESS="${WORK}/witness.txt"
SEQ_FILE="${WORK}/status_seq.txt"
rm -f "$SEQ_FILE" "${SEQ_FILE}.idx"

# Lance la veille en --dry-run avec le faux herdr en tête de PATH. Ne touche
# QUE l'index de la séquence de statuts (jamais le fichier SEQ_FILE lui-même :
# un scénario qui vient de l'écrire juste avant l'appel le perdrait sinon).
# Les scénarios qui n'utilisent pas de séquence n'en créent pas — le faux
# herdr retombe alors sur FAKE_HERDR_STATUS.
run() {
  local tours="$1"
  : > "$WITNESS"
  rm -f "${SEQ_FILE}.idx"
  # VD_REGISTRE_DIR est OBLIGATOIRE ici : sans lui la veille s'inscrit dans le
  # registre RÉEL du poste ($HOME/.somtech/veilles) et une vraie veille se
  # retrouve noyée sous les entrées de test. Mesuré en posant une veille réelle
  # et en devant la chercher parmi 32 lignes « test-pane ».
  OUT="$(PATH="${BINDIR}:${PATH}" \
         FAKE_HERDR_STATUS="${FAKE_HERDR_STATUS:-blocked}" \
         FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
         FAKE_HERDR_STATUS_SEQ_FILE="$SEQ_FILE" \
         FAKE_HERDR_WITNESS="$WITNESS" \
         VD_REGISTRE_DIR="${WORK}/registre" \
         VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 \
         bash "$VEILLE" test-pane test-agent "$tours" --dry-run 2>&1)"
  RC=$?
}

# =================================================================
# 0. Usage : pane ou agent manquant → refus explicite (rc≠0), message d'usage.
# =================================================================
echo "→ 0. usage"
OUT0="$(bash "$VEILLE" 2>&1)"; RC0=$?
[ "$RC0" -ne 0 ] && ok "aucun argument → rc≠0 ($RC0)" || ko "aucun argument devrait refuser, rc=$RC0"
case "$OUT0" in *"Usage:"*) ok "message d'usage affiché" ;; *) ko "pas de message d'usage : $OUT0" ;; esac

OUT0B="$(bash "$VEILLE" seul-pane 2>&1)"; RC0B=$?
[ "$RC0B" -ne 0 ] && ok "agent manquant → rc≠0 ($RC0B)" || ko "agent manquant devrait refuser, rc=$RC0B"

# =================================================================
# 1. Écran complet à 2 options (2. No) → elle répond, elle NE DESCEND PAS.
#    G1 + G2 : répondre « 2 » par habitude sur un écran à 2 options refuserait.
# =================================================================
echo "→ 1. écran complet 2 options (2. No)"
cat > "$SCREEN_FILE" <<'EOF'
Some tool output above the prompt.
❯ 1. Yes
  2. No
EOF
FAKE_HERDR_STATUS=blocked run 1

case "$OUT" in *"aurait envoyé: Enter"*) ok "elle valide (Enter envoyé)" ;; *) ko "Enter jamais envoyé : $OUT" ;; esac
case "$OUT" in *"aurait envoyé: Down"*) ko "elle descend alors que l'option 2 est « No » !" ;; *) ok "elle NE descend PAS (option 2 = No)" ;; esac
case "$OUT" in *"debloque (#1)"*) ok "1 déblocage comptabilisé" ;; *) ko "aucun déblocage comptabilisé : $OUT" ;; esac
case "$OUT" in *"0 blocages non reconnus"*) ok "0 blocage non reconnu dans le bilan" ;; *) ko "bilan inattendu : $OUT" ;; esac
grep -q "pane send-keys" "$WITNESS" && ko "herdr pane send-keys a été RÉELLEMENT appelé en --dry-run" \
  || ok "aucun appel réel à herdr pane send-keys en --dry-run"

# =================================================================
# 2. Écran à 3 options, option 2 = « Yes, and don't ask again » (autorise
#    durablement) → elle descend PUIS valide, dans cet ordre.
# =================================================================
echo "→ 2. écran 3 options, option 2 autorise durablement"
cat > "$SCREEN_FILE" <<'EOF'
❯ 1. Yes
  2. Yes, and don't ask again
  3. No
EOF
run 1

case "$OUT" in *"aurait envoyé: Down"*) ok "elle descend (option 2 autorise durablement)" ;; *) ko "elle ne descend pas alors qu'elle le devrait : $OUT" ;; esac
case "$OUT" in *"aurait envoyé: Enter"*) ok "elle valide après avoir descendu" ;; *) ko "Enter jamais envoyé : $OUT" ;; esac
ligne_down=$(printf '%s\n' "$OUT" | grep -n "aurait envoyé: Down" | head -1 | cut -d: -f1)
ligne_enter=$(printf '%s\n' "$OUT" | grep -n "aurait envoyé: Enter" | head -1 | cut -d: -f1)
if [ -n "$ligne_down" ] && [ -n "$ligne_enter" ] && [ "$ligne_down" -lt "$ligne_enter" ]; then
  ok "Down précède Enter (elle descend AVANT de valider)"
else
  ko "ordre Down/Enter incorrect (down=$ligne_down enter=$ligne_enter)"
fi
case "$OUT" in *"debloque (#1)"*) ok "1 déblocage comptabilisé" ;; *) ko "aucun déblocage comptabilisé : $OUT" ;; esac

# =================================================================
# 3. LE PIÈGE NOMMÉ : option 2 = « Yes, and tell Claude what to do
#    differently » → elle NE DESCEND PAS (répondre laisserait l'agent
#    attendre une instruction qui ne viendra jamais).
# =================================================================
echo "→ 3. piège : option 2 = « Yes, and tell Claude… »"
cat > "$SCREEN_FILE" <<'EOF'
❯ 1. Yes
  2. Yes, and tell Claude what to do differently
  3. No
EOF
run 1

case "$OUT" in *"aurait envoyé: Down"*) ko "PIÈGE : elle descend sur « tell Claude » — l'agent attendrait une instruction qui ne viendra jamais" ;; *) ok "elle NE descend PAS sur « Yes, and tell Claude… »" ;; esac
case "$OUT" in *"aurait envoyé: Enter"*) ok "elle valide quand même l'option par défaut (Yes)" ;; *) ko "Enter jamais envoyé : $OUT" ;; esac

# =================================================================
# 4. Écran ne portant qu'UN SEUL des deux signes (curseur sur Yes, mais
#    aucune sortie « No » numérotée) → elle ne répond PAS.
# =================================================================
echo "→ 4. un seul signe (pas de « No » numéroté)"
cat > "$SCREEN_FILE" <<'EOF'
❯ 1. Yes
Some unrelated trailing output, no numbered No option here.
EOF
run 1

case "$OUT" in *"aurait envoyé:"*) ko "elle répond alors qu'un seul des deux signes est présent : $OUT" ;; *) ok "elle ne répond PAS (un seul signe présent)" ;; esac
case "$OUT" in *"BLOQUE SANS DEMANDE RECONNUE"*) ok "elle dit qu'elle ne reconnaît pas l'écran" ;; *) ko "silence sur l'écran non reconnu : $OUT" ;; esac

# =================================================================
# 5. Écran non reconnu, agent bloqué en continu → elle ne répond jamais,
#    s'arrête après exactement 3 relevés non reconnus consécutifs.
# =================================================================
echo "→ 5. écran non reconnu répété → arrêt après 3"
cat > "$SCREEN_FILE" <<'EOF'
This is not a permission prompt at all. Nothing to recognize here.
EOF
run 5

n_bloque=$(printf '%s\n' "$OUT" | grep -c "BLOQUE SANS DEMANDE RECONNUE")
[ "$n_bloque" -eq 3 ] && ok "exactement 3 relevés non reconnus avant arrêt (obtenu $n_bloque)" \
  || ko "attendu 3 relevés non reconnus, obtenu $n_bloque"
case "$OUT" in *"ARRET : blocage non reconnu"*) ok "elle annonce l'arrêt explicitement" ;; *) ko "pas d'annonce d'arrêt : $OUT" ;; esac
case "$OUT" in *"aurait envoyé:"*) ko "elle a répondu alors que l'écran n'était jamais reconnu" ;; *) ok "jamais de réponse envoyée sur 5 tours d'écran non reconnu" ;; esac
case "$OUT" in *"3 blocages non reconnus"*) ok "le bilan final compte 3 blocages non reconnus" ;; *) ko "bilan final incorrect : $OUT" ;; esac

# =================================================================
# 6. Agent done confirmé sur DEUX relevés → elle sort en annonçant son bilan.
# =================================================================
echo "→ 6. done confirmé sur deux relevés"
: > "$SCREEN_FILE"
FAKE_HERDR_STATUS=done run 1

case "$OUT" in *"TERMINE apres 0 deblocages"*) ok "elle annonce la fin après confirmation" ;; *) ko "pas d'annonce de fin : $OUT" ;; esac
case "$OUT" in *"bilan : 0 deblocages, 0 blocages non reconnus"*) ok "bilan final cohérent (0/0)" ;; *) ko "bilan final incorrect : $OUT" ;; esac

# =================================================================
# 7. Agent « done » TRANSITOIRE : le premier relevé dit done, le second
#    (celui qui confirme) dit autre chose → elle n'annonce PAS la fin et
#    continue de veiller. Distingue « confirmé sur deux relevés » d'un
#    simple aller au premier relevé — un état terminal peut être transitoire.
# =================================================================
echo "→ 7. done TRANSITOIRE (non confirmé au second relevé) → ne sort pas"
: > "$SCREEN_FILE"
printf 'done\nworking\n' > "$SEQ_FILE"
run 2

case "$OUT" in *"TERMINE"*) ko "elle annonce la fin alors que le second relevé ne confirme pas done/idle : $OUT" ;; *) ok "elle n'annonce PAS la fin sur un done non confirmé" ;; esac
case "$OUT" in *"bilan : 0 deblocages, 0 blocages non reconnus"*) ok "elle continue de veiller (bilan final atteint par épuisement des tours, pas par arrêt anticipé)" ;; *) ko "bilan final incorrect : $OUT" ;; esac


# =================================================================
# ===== E-20260818-0020 — la veille tient sa promesse, ou elle dit
# ===== qu'elle ne la tient plus. Les scénarios ci-dessous prouvent les
# ===== correctifs des trois défauts mesurés dans T-20260818-0109.
# =================================================================

REG="${WORK}/registre"

# `run` ci-dessus fige le pane à test-pane et n'expose pas le registre. Pour
# les scénarios de registre/journal/détachement il faut choisir le pane, le
# répertoire de registre et lire le code de sortie — d'où cette seconde forme.
# Elle NE partage PAS l'index de séquence entre deux appels (rm de .idx), au
# même titre que `run`.
run_ex() {
  local pane="$1" agent="$2" tours="$3"; shift 3
  : > "$WITNESS"
  rm -f "${SEQ_FILE}.idx"
  OUT="$(PATH="${BINDIR}:${PATH}" \
         FAKE_HERDR_STATUS="${FAKE_HERDR_STATUS:-blocked}" \
         FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
         FAKE_HERDR_STATUS_SEQ_FILE="$SEQ_FILE" \
         FAKE_HERDR_WITNESS="$WITNESS" \
         VD_REGISTRE_DIR="$REG" \
         VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 \
         bash "$VEILLE" "$pane" "$agent" "$tours" "$@" 2>&1)"
  RC=$?
}

ECRAN_PERMISSION='❯ 1. Yes
  2. No'

# =================================================================
# 8. T-20260818-0154 — LE DÉFAUT ①. Un agent qui vient de naître est idle
#    PARCE QU'IL ATTEND SON BRIEF. La veille ne doit pas lire cette attente
#    comme un travail fini : c'est le geste même que le métier prescrit.
# =================================================================
echo "→ 8. naissance : idle constant (agent qui attend son brief) → elle VEILLE"
: > "$SCREEN_FILE"
rm -f "$SEQ_FILE"
FAKE_HERDR_STATUS=idle run 3

case "$OUT" in *"TERMINE"*) ko "DÉFAUT ① : elle conclut que l'agent a fini alors qu'il attend son brief : $OUT" ;; *) ok "elle n'annonce PAS la fin sur un agent jamais vu au travail" ;; esac
case "$OUT" in *"MOTIF: agent-termine"*) ko "DÉFAUT ① : motif « agent-termine » sur un agent qui n'a jamais travaillé" ;; *) ok "le motif n'est pas « agent-termine »" ;; esac
case "$OUT" in *"MOTIF: tours-epuises"*) ok "elle a veillé jusqu'à épuisement de ses tours" ;; *) ko "motif attendu « tours-epuises », obtenu : $OUT" ;; esac

# =================================================================
# 9. Un agent vu WORKING puis `done` confirmé → elle s'arrête, motif
#    `agent-termine`, code 0. Un agent réellement terminé libère sa veille.
#
# ⚠️ CE SCÉNARIO A CHANGÉ DE SÉQUENCE, ET C'EST DÉLIBÉRÉ. Il éprouvait
#    `working → idle → idle` ⇒ `agent-termine` : il ENCODAIT le défaut ①.
#    Deux relevés `idle` séparés de 20 s ne distinguent pas « il a fini » de
#    « il se repose entre deux gestes » — mesuré sur les 85 agents réels du
#    poste le 2026-08-25, `idle` est l'état de 75 d'entre eux. Le mettre au
#    vert en gardant sa séquence aurait exigé de rouvrir le défaut. La fin
#    légitime se dit désormais par l'état terminal EXPLICITE `done` — qui,
#    lui, SURVIENT vraiment (3 agents sur 85 le portaient au même relevé).
#    Le cas `idle` prolongé a son propre scénario : 47c.
# =================================================================
echo "→ 9. working puis done confirmé → elle s'arrête (motif agent-termine)"
: > "$SCREEN_FILE"
printf 'working\ndone\ndone\n' > "$SEQ_FILE"
run 4

case "$OUT" in *"TERMINE"*) ok "un agent qui a travaillé puis fini libère sa veille" ;; *) ko "elle ne s'arrête pas sur un agent réellement terminé : $OUT" ;; esac
case "$OUT" in *"MOTIF: agent-termine"*) ok "motif « agent-termine » nommé" ;; *) ko "motif attendu « agent-termine », obtenu : $OUT" ;; esac
[ "$RC" -eq 0 ] && ok "code de sortie 0 pour un agent terminé (rc=$RC)" || ko "code de sortie attendu 0, obtenu $RC"

echo "→ 9b. LA CONTRE-ÉPREUVE : la même séquence avec idle au lieu de done ne conclut RIEN"
# C'est l'assertion qui empêche le défaut ① de revenir par cette porte-ci.
: > "$SCREEN_FILE"
printf 'working\nidle\nidle\n' > "$SEQ_FILE"
run 4
case "$OUT" in
  *"MOTIF: agent-termine"*) ko "DÉFAUT ① REVENU : deux relevés idle suffisent de nouveau à déclarer l'agent fini : $OUT" ;;
  *) ok "deux relevés idle ne déclarent plus la fin — seul done le fait" ;;
esac

# =================================================================
# 10. BLOCKED arme la détection au même titre que WORKING : un agent bloqué
#     a forcément commencé à travailler.
# =================================================================
# ⚠️ SÉQUENCE CHANGÉE POUR LA MÊME RAISON QUE LE SCÉNARIO 9 : la fin se dit
#    par `done`, jamais par deux `idle`. Ce qu'il éprouve — que `blocked`
#    arme la détection de fin au même titre que `working` — est intact.
echo "→ 10. blocked (donc au travail) puis done confirmé → elle s'arrête"
printf '%s\n' "$ECRAN_PERMISSION" > "$SCREEN_FILE"
printf 'blocked\ndone\ndone\n' > "$SEQ_FILE"
run 4

case "$OUT" in *"MOTIF: agent-termine"*) ok "blocked arme la détection de fin" ;; *) ko "blocked n'arme pas la détection : $OUT" ;; esac
case "$OUT" in *"debloque (#1)"*) ok "le déblocage a bien eu lieu au tour blocked" ;; *) ko "aucun déblocage au tour blocked : $OUT" ;; esac

# =================================================================
# 11. T-20260818-0155 — LE DÉFAUT ②. Elle s'éteint alors que l'agent
#     travaille encore : elle le NOMME, et elle dit qu'il n'est plus protégé.
# =================================================================
echo "→ 11. tours épuisés alors que l'agent travaille encore"
: > "$SCREEN_FILE"
rm -f "$SEQ_FILE"
FAKE_HERDR_STATUS=working run 2

case "$OUT" in *"MOTIF: tours-epuises"*) ok "motif « tours-epuises » nommé" ;; *) ko "DÉFAUT ② : bilan muet, motif attendu « tours-epuises » : $OUT" ;; esac
case "$OUT" in *"plus protégé"*|*"plus protege"*) ok "elle dit que l'agent n'est plus protégé" ;; *) ko "elle s'éteint sur un agent au travail sans le dire : $OUT" ;; esac
[ "$RC" -eq 2 ] && ok "code de sortie propre aux tours épuisés (rc=$RC)" || ko "code de sortie attendu 2, obtenu $RC"

# =================================================================
# 12. Écran non reconnu répété → motif nommé ET code de sortie propre.
#     G3 reste intacte : elle ne répond toujours pas.
# =================================================================
echo "→ 12. écran non reconnu → motif nommé + code propre"
cat > "$SCREEN_FILE" <<'EOF'
This is not a permission prompt at all. Nothing to recognize here.
EOF
rm -f "$SEQ_FILE"
FAKE_HERDR_STATUS=blocked run 5

case "$OUT" in *"MOTIF: ecran-non-reconnu"*) ok "motif « ecran-non-reconnu » nommé" ;; *) ko "motif attendu « ecran-non-reconnu », obtenu : $OUT" ;; esac
[ "$RC" -eq 3 ] && ok "code de sortie propre à l'écran non reconnu (rc=$RC)" || ko "code de sortie attendu 3, obtenu $RC"
case "$OUT" in *"aurait envoyé:"*) ko "G3 AFFAIBLIE : elle a répondu à un écran non reconnu" ;; *) ok "G3 intacte : jamais de réponse sur écran non reconnu" ;; esac

# =================================================================
# 13. Aucune sortie n'est muette : quel que soit le chemin d'arrêt, la ligne
#     de motif est là. C'est l'invariant du défaut ②.
# =================================================================
echo "→ 13. aucun chemin d'arrêt n'est muet"
for cas in idle working done; do
  : > "$SCREEN_FILE"; rm -f "$SEQ_FILE"
  FAKE_HERDR_STATUS="$cas" run 2
  case "$OUT" in *"MOTIF: "*) ok "chemin « $cas » : motif nommé" ;; *) ko "chemin « $cas » : bilan muet — $OUT" ;; esac
done

# =================================================================
# 14. T-20260818-0157 — un compte ne dit pas SUR QUOI on veille. Le registre
#     rend le pane ET l'agent de chaque veille.
# =================================================================
echo "→ 14. registre : pane et agent de chaque veille, pas un compte"
rm -rf "$REG"
: > "$SCREEN_FILE"; rm -f "$SEQ_FILE"
FAKE_HERDR_STATUS=working run_ex "w9:pAA" "agent-alpha" 1
FAKE_HERDR_STATUS=working run_ex "w9:pBB" "agent-beta" 1

LISTE="$(PATH="${BINDIR}:${PATH}" VD_REGISTRE_DIR="$REG" bash "$VEILLE" --list 2>&1)"
case "$LISTE" in *"w9:pAA"*) ok "le pane de la 1re veille est listé" ;; *) ko "pane w9:pAA absent de la liste : $LISTE" ;; esac
case "$LISTE" in *"agent-alpha"*) ok "l'agent de la 1re veille est listé" ;; *) ko "agent-alpha absent de la liste : $LISTE" ;; esac
case "$LISTE" in *"w9:pBB"*) ok "le pane de la 2e veille est listé" ;; *) ko "pane w9:pBB absent de la liste : $LISTE" ;; esac
case "$LISTE" in *"agent-beta"*) ok "l'agent de la 2e veille est listé" ;; *) ko "agent-beta absent de la liste : $LISTE" ;; esac

# =================================================================
# 15. Une veille arrêtée porte son motif DANS le registre — l'orchestrateur
#     qui liste apprend pourquoi elle n'est plus là.
# =================================================================
echo "→ 15. registre : une veille arrêtée porte son motif"
case "$LISTE" in *"tours-epuises"*) ok "le motif d'arrêt figure dans la liste" ;; *) ko "motif absent du registre : $LISTE" ;; esac

# =================================================================
# 16. Une veille TUÉE sans avoir pu écrire son motif ne doit pas passer pour
#     vivante. Le registre ne ment pas sur ce qu'il ne sait pas.
# =================================================================
echo "→ 16. registre : veille disparue sans motif ≠ veille vivante"
mkdir -p "$REG"
cat > "${REG}/w9-pZZ-4294967000.veille" <<'EOF'
pane=w9:pZZ
agent=agent-fantome
pid=4294967000
statut=active
debut=2026-08-18T00:00:00
journal=/dev/null
tours=400
EOF
LISTE2="$(PATH="${BINDIR}:${PATH}" VD_REGISTRE_DIR="$REG" bash "$VEILLE" --list 2>&1)"
case "$LISTE2" in *"agent-fantome"*) ok "la veille fantôme est listée" ;; *) ko "veille fantôme absente : $LISTE2" ;; esac
case "$LISTE2" in *"disparue"*) ok "elle est signalée disparue (pid mort, aucun motif écrit)" ;; *) ko "une veille morte sans motif est présentée comme vivante : $LISTE2" ;; esac

# =================================================================
# 17. Un registre vide le dit. Une liste vide muette laisserait croire à une
#     erreur d'affichage.
# =================================================================
echo "→ 17. registre vide → il le dit"
VIDE_DIR="${WORK}/registre-vide"
LISTE3="$(PATH="${BINDIR}:${PATH}" VD_REGISTRE_DIR="$VIDE_DIR" bash "$VEILLE" --list 2>&1)"
case "$LISTE3" in *[Aa]"ucune veille"*) ok "un registre vide est annoncé explicitement" ;; *) ko "registre vide muet : $LISTE3" ;; esac

# =================================================================
# 18. T-20260818-0159 — LES DEUX CHIFFRES. Un compte de déblocages est
#     invérifiable : le journal consigne l'écran déclencheur et la touche
#     envoyée, pour qu'un tiers classe chaque déblocage à raison / à tort.
# =================================================================
echo "→ 18. journal des déblocages : écran déclencheur + touche envoyée"
rm -rf "$REG"
cat > "$SCREEN_FILE" <<'EOF'
❯ 1. Yes
  2. Yes, and don't ask again
  3. No
EOF
rm -f "$SEQ_FILE"
JOURNAL="${WORK}/deblocages.log"
rm -f "$JOURNAL"
OUT="$(PATH="${BINDIR}:${PATH}" \
       FAKE_HERDR_STATUS=blocked FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
       FAKE_HERDR_STATUS_SEQ_FILE="$SEQ_FILE" FAKE_HERDR_WITNESS="$WITNESS" \
       VD_REGISTRE_DIR="$REG" VD_JOURNAL="$JOURNAL" \
       VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 \
       bash "$VEILLE" test-pane test-agent 1 --dry-run 2>&1)"

if [ -f "$JOURNAL" ]; then
  ok "le journal de déblocages est écrit (y compris en --dry-run)"
  grep -q "Yes, and don't ask again" "$JOURNAL" && ok "l'écran déclencheur est consigné" || ko "l'écran déclencheur manque au journal"
  grep -q "Down" "$JOURNAL" && ok "la touche Down envoyée est consignée" || ko "la touche envoyée manque au journal"
  grep -q "Enter" "$JOURNAL" && ok "la touche Enter envoyée est consignée" || ko "Enter manque au journal"
else
  ko "aucun journal de déblocages écrit — les deux chiffres restent invérifiables"
  ko "l'écran déclencheur manque au journal"
  ko "la touche envoyée manque au journal"
  ko "Enter manque au journal"
fi

# =================================================================
# 19. T-20260818-0158 — la durée par défaut doit couvrir un lot réel.
#     Mesuré dans T-20260818-0109 : les lots durent 1 h à 2 h 30, l'ancien
#     défaut couvrait ~66 min. La veille rend elle-même sa durée nominale —
#     un `grep` sur le source prouverait qu'un mot est là, pas qu'une durée
#     est couverte.
# =================================================================
echo "→ 19. durée par défaut ≥ 2 h 30"
DUREE="$(PATH="${BINDIR}:${PATH}" bash "$VEILLE" --duree 2>&1)"
# Ancré sur un format NOMMÉ : un grep de chiffres nus attrape la date dans le
# chemin du worktree et rend un vert qui n'a rien mesuré.
DUREE_S="$(printf '%s\n' "$DUREE" | sed -n 's/^DUREE_NOMINALE_S=\([0-9][0-9]*\)$/\1/p' | head -1)"
if [ -n "$DUREE_S" ] && [ "$DUREE_S" -ge 9000 ] 2>/dev/null; then
  ok "la durée nominale par défaut couvre un lot réel (${DUREE_S}s ≥ 9000s)"
else
  ko "durée par défaut insuffisante ou non rendue : « $DUREE »"
fi

# =================================================================
# 20. Elle prévient AVANT de s'éteindre — une fois, pas à chaque tour.
# =================================================================
echo "→ 20. préavis d'épuisement, une seule fois"
: > "$SCREEN_FILE"; rm -f "$SEQ_FILE"
FAKE_HERDR_STATUS=working run 10

n_preavis=$(printf '%s\n' "$OUT" | grep -ci "PREAVIS")
[ "$n_preavis" -eq 1 ] && ok "préavis émis exactement une fois (obtenu $n_preavis)" \
  || ko "préavis attendu 1 fois, obtenu $n_preavis : $OUT"

# =================================================================
# 21. T-20260818-0156 — le geste prescrit SURVIT. --detach relance la veille
#     détachée, rend la main tout de suite, et ne se relance pas à l'infini.
# =================================================================
echo "→ 21. --detach : elle se détache, rend son pid et son journal"
rm -rf "$REG"
: > "$SCREEN_FILE"; rm -f "$SEQ_FILE"
DETACH_LOG="${WORK}/detach.log"
OUTD="$(PATH="${BINDIR}:${PATH}" \
        FAKE_HERDR_STATUS=working FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
        FAKE_HERDR_WITNESS="$WITNESS" \
        VD_REGISTRE_DIR="$REG" VD_LOG="$DETACH_LOG" \
        VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 \
        bash "$VEILLE" w9:pDD agent-detache 3 --detach 2>&1)"
RCD=$?

[ "$RCD" -eq 0 ] && ok "--detach rend la main sans erreur (rc=$RCD)" || ko "--detach rc=$RCD"
case "$OUTD" in *"--- bilan :"*) ko "--detach a veillé en AVANT-PLAN (il rend un bilan) — il n'a rien détaché" ;; *) ok "le détacheur ne veille pas lui-même (aucun bilan rendu)" ;; esac
case "$OUTD" in *"pid="*) ok "elle annonce le pid de la veille détachée" ;; *) ko "aucun pid annoncé : $OUTD" ;; esac
case "$OUTD" in *"$DETACH_LOG"*) ok "elle annonce le chemin de son journal" ;; *) ko "aucun journal annoncé : $OUTD" ;; esac

# La veille détachée doit RÉELLEMENT veiller (pas se re-détacher en boucle) :
# on l'attend, bornée, puis on lit son journal.
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  [ -f "$DETACH_LOG" ] && grep -q "MOTIF: " "$DETACH_LOG" 2>/dev/null && break
  sleep 0.5
done
if [ -f "$DETACH_LOG" ] && grep -q "MOTIF: " "$DETACH_LOG"; then
  ok "la veille détachée a réellement veillé puis nommé son motif dans son journal"
  # Le signe d'une récursion est l'ANNONCE de détachement dans le journal de
  # la veille détachée : elle se serait re-détachée au lieu de veiller.
  # (Compter avec `grep -c` sans match rend « 0 » ET un rc≠0 — un `|| echo 0`
  # empile alors deux valeurs et le test rougit sur son propre outil.)
  if grep -q "veille détachée" "$DETACH_LOG"; then
    ko "récursion de détachement : la veille détachée s'est re-détachée au lieu de veiller"
  else
    ok "elle ne s'est PAS re-détachée (pas de récursion)"
  fi
else
  ko "la veille détachée n'a rien veillé (journal vide ou sans motif)"
  ko "récursion de détachement non vérifiable"
fi

# =================================================================
# 22. Tuée par son environnement, elle le DIT avant de mourir — c'est ce qui
#     distingue « tuée » de « disparue sans qu'on sache ».
# =================================================================
echo "→ 22. signal reçu → motif « interrompue » avant de mourir"
: > "$SCREEN_FILE"; rm -f "$SEQ_FILE"
KILL_LOG="${WORK}/kill.log"; : > "$KILL_LOG"
PATH="${BINDIR}:${PATH}" \
  FAKE_HERDR_STATUS=working FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
  VD_REGISTRE_DIR="${WORK}/registre-kill" \
  VD_SLEEP=1 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 \
  bash "$VEILLE" w9:pKK agent-tue 600 > "$KILL_LOG" 2>&1 &
KILL_PID=$!

# Attendre qu'elle ait démarré — bornée, et sur un SIGNE de démarrage (le
# registre écrit), jamais sur un délai fixe : un délai fixe mesurerait la
# charge du poste, pas la veille.
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  [ -d "${WORK}/registre-kill" ] && [ -n "$(ls -A "${WORK}/registre-kill" 2>/dev/null)" ] && break
  sleep 0.5
done
kill -TERM "$KILL_PID" 2>/dev/null
wait "$KILL_PID" 2>/dev/null
RCK=$?

case "$(cat "$KILL_LOG")" in
  *"MOTIF: interrompue"*) ok "tuée par un signal, elle nomme « interrompue » avant de mourir" ;;
  *) ko "tuée en silence — aucun motif écrit : $(cat "$KILL_LOG")" ;;
esac

# =================================================================
# 23. LES TROIS GARANTIES D'ORIGINE, RE-PROUVÉES APRÈS CORRECTIF. Elles sont
#     déjà prouvées aux scénarios 1-7 ; ce scénario vérifie qu'aucun des
#     nouveaux chemins (registre, journal, détachement) ne les contourne :
#     un écran à un seul signe reste sans réponse même journal actif.
# =================================================================
echo "→ 23. garanties d'origine intactes sur les nouveaux chemins"
cat > "$SCREEN_FILE" <<'EOF'
❯ 1. Yes
Some unrelated trailing output, no numbered No option here.
EOF
rm -f "$SEQ_FILE"
J23="${WORK}/j23.log"; rm -f "$J23"
OUT23="$(PATH="${BINDIR}:${PATH}" \
         FAKE_HERDR_STATUS=blocked FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
         FAKE_HERDR_WITNESS="$WITNESS" \
         VD_REGISTRE_DIR="$REG" VD_JOURNAL="$J23" \
         VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 \
         bash "$VEILLE" test-pane test-agent 3 --dry-run 2>&1)"

case "$OUT23" in *"aurait envoyé:"*) ko "G1 AFFAIBLIE : elle répond sur un seul signe, journal actif" ;; *) ok "G1 intacte : un seul signe → aucune réponse" ;; esac
# Le journal porte désormais les DEUX populations : il n'est plus vide quand
# elle refuse. Ce qu'il ne doit pas contenir, c'est un DÉBLOCAGE.
if grep -q "=== déblocage" "$J23" 2>/dev/null; then
  ko "un déblocage a été consigné alors qu'aucun n'a eu lieu : $(cat "$J23")"
else
  ok "aucun déblocage consigné (rien n'a été débloqué)"
fi
grep -q "=== REFUS" "$J23" 2>/dev/null && ok "les refus, eux, sont bien consignés" || ko "le refus n'a pas été consigné"


# =================================================================
# 24. LA SUITE ELLE-MÊME NE TOUCHE PAS AU REGISTRE DU POSTE. Sans cette
#     garde, un scénario qui oublie VD_REGISTRE_DIR inscrit ses veilles de
#     test dans $HOME/.somtech/veilles et noie les vraies — mesuré : 32
#     entrées « test-pane » y ont masqué une veille réelle.
# =================================================================
echo "→ 24. la suite n'écrit pas dans le registre du poste"
REG_POSTE="${HOME}/.somtech/veilles"
if [ -d "$REG_POSTE" ]; then
  n_pollution=$(ls "$REG_POSTE"/test-pane-*.veille 2>/dev/null | wc -l | tr -d ' ')
else
  n_pollution=0
fi
[ "${n_pollution:-0}" -eq 0 ] && ok "aucune veille de test dans le registre du poste" \
  || ko "la suite a écrit $n_pollution veille(s) de test dans $REG_POSTE"


# =================================================================
# 25. LE QUATRIÈME DÉFAUT, trouvé en posant une VRAIE veille : le pane a été
#     fermé sous elle, et elle a continué de tourner — 400 tours à veiller
#     sur rien, en s'annonçant « vivante » au registre. C'est exactement le
#     mal que ce lot corrige : promettre une protection qu'on n'assure plus.
# =================================================================
echo "→ 25. le pane disparaît sous la veille → elle le dit et s'arrête"
: > "$SCREEN_FILE"; rm -f "$SEQ_FILE"
# ⚠️ LE PANE EST ARMÉ MORT, PAS SEULEMENT L'AGENT — ce test décrit « le pane a été
#    FERMÉ sous elle », et `FAKE_HERDR_STATUS=absent` ne rend absent que l'AGENT.
#    Tant qu'il ne pilotait que celui-là, il passait sur un cas qui n'est pas le
#    sien : un pane VIVANT dont l'agent est invisible (T-20260819-0064), lequel
#    appelle un tout autre motif. Un test qui éprouve autre chose que son titre
#    rend un vert qui ne prouve pas ce qu'on lui prête.
FAKE_HERDR_PANE_ABSENT=1 FAKE_HERDR_STATUS=absent run 6

case "$OUT" in *"MOTIF: pane-disparu"*) ok "motif « pane-disparu » nommé" ;; *) ko "elle veille sur un pane disparu sans le dire : $OUT" ;; esac
[ "$RC" -eq 6 ] && ok "code de sortie propre au pane disparu (rc=$RC)" || ko "code de sortie attendu 6, obtenu $RC"

# =================================================================
# 26. Mais une absence TRANSITOIRE ne doit pas tuer la veille : un hoquet de
#     herdr abandonnerait un agent bien vivant. Même exigence que la
#     garantie n°4 — deux relevés concordants avant de conclure.
# =================================================================
echo "→ 26. absence transitoire (1 relevé) → elle continue de veiller"
: > "$SCREEN_FILE"
printf 'working\nabsent\nworking\nworking\n' > "$SEQ_FILE"
run 4

case "$OUT" in *"MOTIF: pane-disparu"*) ko "un seul relevé absent suffit à l'arrêter — un hoquet de herdr abandonnerait un agent vivant" ;; *) ok "une absence isolée ne l'arrête pas" ;; esac
case "$OUT" in *"MOTIF: tours-epuises"*) ok "elle a veillé jusqu'au bout malgré l'absence transitoire" ;; *) ko "arrêt inattendu : $OUT" ;; esac


# =================================================================
# 27. « 3 relevés non reconnus CONSÉCUTIFS » doit vouloir dire consécutifs.
#     Le compteur n'était remis à zéro que par un déblocage réussi : trois
#     écrans bizarres SÉPARÉS par des tours de travail légitimes coupaient
#     la veille sur un agent parfaitement vivant. Le risque grandit avec la
#     durée étendue de ce lot (2000 tours) : plus de tours, plus de hoquets.
# =================================================================
echo "→ 27. écrans non reconnus NON consécutifs → elle ne s'arrête pas"
cat > "$SCREEN_FILE" <<'EOF'
This is not a permission prompt at all. Nothing to recognize here.
EOF
printf 'blocked\nworking\nblocked\nworking\nblocked\nworking\n' > "$SEQ_FILE"
run 6

case "$OUT" in *"ARRET : blocage non reconnu"*) ko "elle s'arrête sur 3 relevés NON consécutifs — un agent vivant est abandonné sur des hoquets espacés" ;; *) ok "trois écrans non reconnus séparés par du travail ne l'arrêtent pas" ;; esac
case "$OUT" in *"MOTIF: ecran-non-reconnu"*) ko "motif « ecran-non-reconnu » sur des relevés non consécutifs" ;; *) ok "elle a continué de veiller" ;; esac

# Et le cas VRAIMENT consécutif reste couvert (scénario 5) — vérifié ici sur
# la même séquence, sans tour de travail intercalé.
printf 'blocked\nblocked\nblocked\nblocked\n' > "$SEQ_FILE"
run 6
case "$OUT" in *"ARRET : blocage non reconnu"*) ok "trois relevés RÉELLEMENT consécutifs l'arrêtent toujours" ;; *) ko "G3 AFFAIBLIE : elle ne s'arrête plus sur 3 relevés consécutifs : $OUT" ;; esac

# =================================================================
# 28. `kill -0` ne prouve pas que le pid est LA veille : un pid recyclé par
#     un processus sans rapport ferait passer une veille morte pour vivante
#     — l'inverse exact de ce que le registre promet.
# =================================================================
echo "→ 28. pid recyclé → pas annoncée vivante"
REG_PID="${WORK}/registre-pid"; rm -rf "$REG_PID"; mkdir -p "$REG_PID"
# Un processus bien vivant qui n'est PAS une veille : le shell de ce test.
cat > "${REG_PID}/w9-pRR-$$.veille" <<EOF
pane=w9:pRR
agent=agent-recycle
pid=$$
statut=active
debut=2026-08-18T00:00:00
journal=/dev/null
tours=400
EOF
LISTE4="$(PATH="${BINDIR}:${PATH}" VD_REGISTRE_DIR="$REG_PID" bash "$VEILLE" --list 2>&1)"
case "$LISTE4" in
  *"vivante"*) ko "un pid recyclé est annoncé « vivante » — l'orchestrateur croit à une protection qui n'existe pas : $LISTE4" ;;
  *) ok "un pid qui n'est pas une veille n'est pas annoncé vivante" ;;
esac
case "$LISTE4" in *"agent-recycle"*) ok "l'entrée reste listée (on ne la cache pas, on la qualifie)" ;; *) ko "l'entrée a disparu de la liste : $LISTE4" ;; esac

# =================================================================
# 29. Deux veilles sur le MÊME pane s'enverraient chacune leurs touches sur
#     le même écran — un Enter en double peut valider la mauvaise option de
#     l'écran suivant. Mesuré vécu : deux veilles ont réellement tourné en
#     parallèle sur le même pane d'essai pendant ce lot.
# =================================================================
echo "→ 29. une seconde veille sur le même pane est refusée"
REG_DUP="${WORK}/registre-dup"; rm -rf "$REG_DUP"; mkdir -p "$REG_DUP"
: > "$SCREEN_FILE"; rm -f "$SEQ_FILE"
# Une VRAIE veille vivante sur ce pane — un fichier de registre fabriqué avec
# un pid quelconque ne suffit plus : la liste vérifie désormais que le pid est
# bien une veille sur CE pane (scénario 28). Le test doit donc être aussi
# exigeant que le code qu'il éprouve.
PATH="${BINDIR}:${PATH}" \
  FAKE_HERDR_STATUS=working FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
  VD_REGISTRE_DIR="$REG_DUP" VD_SLEEP=2 VD_SLEEP_CONFIRM=0 \
  bash "$VEILLE" w9:pDUP deja-la 60 > "${WORK}/dup1.log" 2>&1 &
DUP_PID=$!
# Attendre son inscription au registre — sur un SIGNE, jamais sur un délai
# fixe : un délai fixe mesurerait la charge du poste.
for _ in $(seq 1 30); do
  ls "${REG_DUP}"/*.veille >/dev/null 2>&1 && break
  sleep 0.5
done
OUT29="$(PATH="${BINDIR}:${PATH}" \
         FAKE_HERDR_STATUS=working FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
         VD_REGISTRE_DIR="$REG_DUP" \
         VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 \
         bash "$VEILLE" w9:pDUP autre-agent 2 2>&1)"
RC29=$?
case "$OUT29" in *"veille"*"déjà"*) ok "elle refuse et dit qu'une veille garde déjà ce pane" ;; *) ko "une seconde veille démarre sur un pane déjà gardé : $OUT29" ;; esac
# Le code EXACT, et l'absence de bilan : sans ça, un refus qui laisserait la
# veille continuer quand même passerait (elle finirait sur tours-epuises=2,
# lui aussi non nul). Mesuré par mutation — la garde survivait à sa propre
# suppression.
[ "$RC29" -eq 7 ] && ok "le refus porte son code propre (rc=$RC29)" || ko "code de refus attendu 7, obtenu $RC29"
case "$OUT29" in *"--- bilan :"*) ko "elle a VEILLÉ malgré le refus — le refus n'a rien empêché" ;; *) ok "elle n'a pas veillé : le refus l'a réellement arrêtée" ;; esac

kill -TERM "$DUP_PID" 2>/dev/null; wait "$DUP_PID" 2>/dev/null

# Et le pane d'une veille MORTE reste reposable — sinon un pane serait
# condamné après le premier arrêt.
rm -f "${REG_DUP}"/*.veille
cat > "${REG_DUP}/w9-pDUP-4294967000.veille" <<'EOF'
pane=w9:pDUP
agent=morte
pid=4294967000
statut=active
debut=2026-08-18T00:00:00
journal=/dev/null
tours=400
EOF
OUT29B="$(PATH="${BINDIR}:${PATH}" \
          FAKE_HERDR_STATUS=working FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
          VD_REGISTRE_DIR="$REG_DUP" \
          VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 \
          bash "$VEILLE" w9:pDUP autre-agent 2 2>&1)"
case "$OUT29B" in *"MOTIF: "*) ok "un pane dont la veille est morte se laisse re-garder" ;; *) ko "le pane reste condamné après la mort de sa veille : $OUT29B" ;; esac


# =================================================================
# 30. GARANTIE N°4 SUR LE CHEMIN `idle` — celui que ce lot rend central.
#     Le scénario 7 ne couvre que le chemin `done` : la confirmation sur
#     deux relevés pouvait être supprimée du chemin `idle` sans qu'un seul
#     test rougisse (mesuré par mutation). Un agent vu travailler, puis idle
#     UNE fois, puis de nouveau au travail, ne doit pas être abandonné.
# =================================================================
echo "→ 30. idle TRANSITOIRE après du travail → elle ne conclut pas la fin"
: > "$SCREEN_FILE"
printf 'working\nidle\nworking\nworking\n' > "$SEQ_FILE"
run 4

case "$OUT" in *"TERMINE"*) ko "G4 AFFAIBLIE sur le chemin idle : un idle isolé suffit à l'abandonner : $OUT" ;; *) ok "un idle non confirmé ne l'arrête pas (garantie n°4, chemin idle)" ;; esac
case "$OUT" in *"MOTIF: agent-termine"*) ko "motif « agent-termine » sur un idle transitoire" ;; *) ok "elle a continué de veiller" ;; esac


# =================================================================
# 31. « CONFIRMÉ SUR DEUX RELEVÉS » doit valoir pour l'absence aussi : deux
#     absences SÉPARÉES par un tour vivant ne sont pas une confirmation.
#     Sans cette garde, chaque reset ABSENCES=0 pouvait être supprimé sans
#     qu'un test rougisse — deux hoquets de herdr à une heure d'intervalle
#     auraient tué un agent bien vivant.
# =================================================================
echo "→ 31. deux absences SÉPARÉES → elle ne conclut pas au pane disparu"
: > "$SCREEN_FILE"
printf 'absent\nworking\nabsent\nworking\nworking\nworking\n' > "$SEQ_FILE"
run 6

case "$OUT" in *"MOTIF: pane-disparu"*) ko "deux absences séparées par du travail suffisent à conclure — un hoquet de herdr tue un agent vivant : $OUT" ;; *) ok "deux absences séparées ne concluent pas au pane disparu" ;; esac

# =================================================================
# 32. …et le seuil vaut EXACTEMENT deux. Le scénario 25 tourne sur une
#     absence constante : n'importe quel seuil ≤ 6 y passait, donc « DEUX
#     relevés » n'était prouvé qu'à ±4 près.
# =================================================================
echo "→ 32. le seuil de confirmation vaut exactement deux"
: > "$SCREEN_FILE"
printf 'working\nabsent\nabsent\nworking\nworking\nworking\n' > "$SEQ_FILE"
# ⚠️ Même correction que le test 25 : ce seuil est celui du PANE disparu, il faut
#    donc que le pane le soit. Sinon on mesure le seuil de l'agent invisible en
#    croyant mesurer celui du pane mort — deux compteurs distincts depuis
#    T-20260819-0064, et rien ne dit qu'ils bougeront ensemble.
FAKE_HERDR_PANE_ABSENT=1 run 6

case "$OUT" in *"MOTIF: pane-disparu"*) ok "deux absences consécutives suffisent (seuil ≤ 2)" ;; *) ko "seuil trop haut : deux absences consécutives ne concluent pas : $OUT" ;; esac

# =================================================================
# 33. Un relevé ILLISIBLE (herdr muet, sortie tronquée, ligne de bruit) ne
#     doit pas être un tour totalement silencieux : il ne comptait ni comme
#     absence ni comme écran non reconnu. La veille pouvait devenir aveugle
#     sans jamais le dire — le mal exact que ce lot corrige.
# =================================================================
echo "→ 33. relevés illisibles → elle le dit, elle ne devient pas aveugle en silence"
: > "$SCREEN_FILE"
printf 'illisible\nillisible\nillisible\nillisible\nillisible\nillisible\n' > "$SEQ_FILE"
run 6

case "$OUT" in *[Ii]"llisible"*) ok "elle signale les relevés illisibles" ;; *) ko "six relevés illisibles passés en silence : $OUT" ;; esac
case "$OUT" in *"MOTIF: releve-illisible"*) ok "elle finit par s'arrêter sur un motif nommé" ;; *) ko "aucun motif d'arrêt pour des relevés illisibles répétés : $OUT" ;; esac

# Mais un relevé illisible ISOLÉ ne l'arrête pas — sinon un hoquet suffirait.
: > "$SCREEN_FILE"
printf 'working\nillisible\nworking\nworking\n' > "$SEQ_FILE"
run 4
case "$OUT" in *"MOTIF: releve-illisible"*) ko "un seul relevé illisible l'arrête — un hoquet suffirait" ;; *) ok "un relevé illisible isolé ne l'arrête pas" ;; esac

# =================================================================
# 34. Le refus de double veille est un check-then-act : deux lancements
#     quasi simultanés passaient tous deux le contrôle et veillaient en
#     parallèle. Reproduit par la passe de fond en élargissant la fenêtre.
#     La prise doit être ATOMIQUE.
# =================================================================
echo "→ 34. deux lancements simultanés : une seule veille prend le pane"
REG_RACE="${WORK}/registre-race"; rm -rf "$REG_RACE"; mkdir -p "$REG_RACE"
: > "$SCREEN_FILE"; rm -f "$SEQ_FILE"
RC_A_F="${WORK}/rc_a"; RC_B_F="${WORK}/rc_b"
lancer_race() {
  PATH="${BINDIR}:${PATH}" \
    FAKE_HERDR_STATUS=working FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
    VD_REGISTRE_DIR="$REG_RACE" \
    VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 \
    bash "$VEILLE" w9:pRACE "$1" 30 > "${WORK}/race-$1.log" 2>&1
  echo $? > "$2"
}
lancer_race concurrent-a "$RC_A_F" &
PA=$!
lancer_race concurrent-b "$RC_B_F" &
PB=$!
wait "$PA" 2>/dev/null; wait "$PB" 2>/dev/null
RA="$(cat "$RC_A_F" 2>/dev/null)"; RB="$(cat "$RC_B_F" 2>/dev/null)"
n_refus=0
[ "$RA" = "7" ] && n_refus=$((n_refus+1))
[ "$RB" = "7" ] && n_refus=$((n_refus+1))
[ "$n_refus" -eq 1 ] && ok "exactement une des deux est refusée (rc=7) — l'autre veille (a=$RA b=$RB)" \
  || ko "les deux lancements ont passé le contrôle et veillent en parallèle (a=$RA b=$RB)"


# =================================================================
# 35. « 3 relevés illisibles CONSÉCUTIFS » — même exigence que pour les
#     écrans non reconnus et les absences : trois hoquets de herdr espacés
#     dans le temps ne sont pas une cécité.
# =================================================================
echo "→ 35. relevés illisibles NON consécutifs → elle continue de veiller"
: > "$SCREEN_FILE"
printf 'illisible\nworking\nillisible\nworking\nillisible\nworking\n' > "$SEQ_FILE"
run 6

case "$OUT" in *"MOTIF: releve-illisible"*) ko "trois relevés illisibles ESPACÉS l'arrêtent — un agent vivant est abandonné sur des hoquets : $OUT" ;; *) ok "trois relevés illisibles séparés par du travail ne l'arrêtent pas" ;; esac

# =================================================================
# 36. Une veille qui s'arrête REND son pane. Sans ça, le pane suivant n'est
#     repris que par le chemin « verrou orphelin » — un rm suivi d'un mkdir,
#     donc non atomique, exactement ce que la prise atomique évite.
# =================================================================
echo "→ 36. une veille qui s'arrête rend son pane"
REG_V="${WORK}/registre-verrou"; rm -rf "$REG_V"; mkdir -p "$REG_V"
: > "$SCREEN_FILE"; rm -f "$SEQ_FILE"
PATH="${BINDIR}:${PATH}" \
  FAKE_HERDR_STATUS=working FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
  VD_REGISTRE_DIR="$REG_V" \
  VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 \
  bash "$VEILLE" w9:pVER agent-verrou 2 >/dev/null 2>&1

if ls -d "${REG_V}"/.verrou-* >/dev/null 2>&1; then
  ko "le verrou survit à l'arrêt — le pane n'est repris que par le chemin orphelin, non atomique"
else
  ok "le verrou est rendu à l'arrêt (le pane est libre, sans passer par la reprise d'orphelin)"
fi


# =================================================================
# 37. LES DEUX CHIFFRES EXIGENT LES DEUX POPULATIONS. Le journal ne portait
#     que les déblocages : « ce qu'elle débloque à tort » était relisable,
#     « ce qu'elle REFUSE à tort » ne l'était pas. Un tiers ne pouvait donc
#     juger que la moitié de la garde.
# =================================================================
echo "→ 37. le journal consigne aussi les REFUS, avec leur écran"
cat > "$SCREEN_FILE" <<'EOF'
Do you want to proceed with this unusual thing?
  [y/n] type your answer freely
EOF
rm -f "$SEQ_FILE"
J37="${WORK}/j37.log"; rm -f "$J37"
OUT37="$(PATH="${BINDIR}:${PATH}" \
         FAKE_HERDR_STATUS=blocked FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
         VD_REGISTRE_DIR="${WORK}/registre-j37" VD_JOURNAL="$J37" \
         VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 \
         bash "$VEILLE" w9:pJ37 agent-j37 5 --dry-run 2>&1)"

if [ -f "$J37" ]; then
  ok "le journal existe après des refus"
  grep -qi "refus" "$J37" && ok "les refus y sont nommés comme tels" || ko "les refus ne sont pas distingués dans le journal"
  grep -q "type your answer freely" "$J37" && ok "l'écran refusé est consigné en entier" || ko "l'écran refusé n'est pas consigné"
  grep -qi "aucune touche" "$J37" && ok "le journal dit qu'aucune touche n'a été envoyée" || ko "le journal ne dit pas qu'elle n'a rien envoyé"
else
  ko "aucun journal écrit alors qu'il y a eu des refus — le second chiffre reste invérifiable"
  ko "les refus ne sont pas distingués dans le journal"
  ko "l'écran refusé n'est pas consigné"
  ko "le journal ne dit pas qu'elle n'a rien envoyé"
fi
case "$OUT37" in *"aurait envoyé:"*) ko "G1 AFFAIBLIE : elle a répondu à cet écran" ;; *) ok "G1 intacte : elle n'a pas répondu (écran non reconnu)" ;; esac


# =================================================================
# 38. --detach NE DOIT PAS ANNONCER UN SUCCÈS POUR UNE VEILLE MORTE.
#     Mesuré sur du réel : la seconde veille d'un même pane était bien
#     refusée par l'enfant — mais le détacheur avait déjà annoncé « veille
#     détachée · pid=… » et rendu 0. Un orchestrateur lit ce succès et croit
#     son agent protégé : le mal exact que ce lot corrige, réintroduit par
#     la porte du détachement.
# =================================================================
echo "→ 38. --detach sur un pane déjà gardé → échec annoncé, pas un faux succès"
REG_D="${WORK}/registre-detach2"; rm -rf "$REG_D"; mkdir -p "$REG_D"
: > "$SCREEN_FILE"; rm -f "$SEQ_FILE"
# Une vraie veille vivante prend le pane.
PATH="${BINDIR}:${PATH}" \
  FAKE_HERDR_STATUS=working FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
  VD_REGISTRE_DIR="$REG_D" VD_SLEEP=2 VD_SLEEP_CONFIRM=0 \
  bash "$VEILLE" w9:pD2 premiere 60 > "${WORK}/d2-premiere.log" 2>&1 &
D2_PID=$!
for _ in $(seq 1 30); do
  ls "${REG_D}"/*.veille >/dev/null 2>&1 && break
  sleep 0.5
done

OUT38="$(PATH="${BINDIR}:${PATH}" \
         FAKE_HERDR_STATUS=working FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
         VD_REGISTRE_DIR="$REG_D" VD_LOG="${WORK}/d2-seconde.log" \
         VD_SLEEP=2 VD_SLEEP_CONFIRM=0 \
         bash "$VEILLE" w9:pD2 seconde 60 --detach 2>&1)"
RC38=$?

# Ancré sur le motif d'ANNONCE DE SUCCÈS (« veille détachée · pane= ») : la
# sous-chaîne « veille détachée » seule matche aussi la phrase d'ÉCHEC (« la
# veille détachée ne veille pas ») — un test qui rougirait sur le correctif.
case "$OUT38" in *"veille détachée · pane="*) ko "elle annonce un succès pour une veille qui meurt aussitôt : $OUT38" ;; *) ok "aucun faux succès annoncé" ;; esac
[ "$RC38" -ne 0 ] && ok "le détachement raté rend un code non nul (rc=$RC38)" || ko "le détachement raté rend 0 — indistinguable d'un succès"
case "$OUT38" in *"REFUS"*|*"déjà"*) ok "elle relaie le motif de l'échec (le pane est déjà gardé)" ;; *) ko "l'échec est annoncé sans son motif : $OUT38" ;; esac

kill -TERM "$D2_PID" 2>/dev/null; wait "$D2_PID" 2>/dev/null

# Et le cas nominal reste un succès annoncé — sinon on aurait corrigé en
# cassant le geste prescrit.
REG_D3="${WORK}/registre-detach3"; rm -rf "$REG_D3"; mkdir -p "$REG_D3"
OUT38B="$(PATH="${BINDIR}:${PATH}" \
          FAKE_HERDR_STATUS=working FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
          VD_REGISTRE_DIR="$REG_D3" VD_LOG="${WORK}/d3.log" \
          VD_SLEEP=2 VD_SLEEP_CONFIRM=0 \
          bash "$VEILLE" w9:pD3 nominale 60 --detach 2>&1)"
RC38B=$?
case "$OUT38B" in *"veille détachée · pane="*) ok "le cas nominal annonce toujours le succès" ;; *) ko "le geste prescrit ne rend plus de succès : $OUT38B" ;; esac
[ "$RC38B" -eq 0 ] && ok "le cas nominal rend 0" || ko "le cas nominal rend $RC38B"
D3_PID="$(printf '%s' "$OUT38B" | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)"
[ -n "$D3_PID" ] && kill -TERM "$D3_PID" 2>/dev/null

# =================================================================
# ===== T-20260819-0023 / T-20260819-0027 — deux défauts mesurés le
# ===== 2026-08-19 : une option AVANT le pane/agent était avalée comme
# ===== positionnel, et un pane inexistant n'était détecté qu'en boucle.
# =================================================================

# =================================================================
# 39. LE DÉFAUT MESURÉ, reproduit exactement : `--detach <pane> <agent>`.
#     Avant correctif, `--detach` n'était cherché que dans $3/$4/$5 : posé en
#     $1, il devenait le pane, et le vrai pane devenait l'agent. La trace
#     réelle du registre du poste était : « pane=--detach agent=w0:p1T … ».
#     --detach est reconnu ici (fork réel) car c'est l'INVOCATION EXACTE du
#     ticket — un simple --dry-run ne suffirait pas à prouver que le drapeau
#     de tête est reconnu ET déclenche le bon chemin (fork + attente de
#     prise de poste), pas seulement que le pane/agent sont bien nommés.
# =================================================================
echo "→ 39. --detach AVANT pane/agent : plus jamais avalé comme positionnel"
REG39="${WORK}/registre-39"; rm -rf "$REG39"; mkdir -p "$REG39"
: > "$SCREEN_FILE"; rm -f "$SEQ_FILE"
OUT39="$(PATH="${BINDIR}:${PATH}" \
         FAKE_HERDR_STATUS=working FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
         VD_REGISTRE_DIR="$REG39" VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 \
         bash "$VEILLE" --detach w9:pREORD agent-reord 3 2>&1)"
RC39=$?
case "$OUT39" in
  *"veille détachée · pane=w9:pREORD agent=agent-reord"*)
    ok "--detach reconnu même placé AVANT le pane/agent, pane et agent correctement affectés" ;;
  *)
    ko "DÉFAUT REPRODUIT : --detach non reconnu en tête, pane/agent mal affectés : $OUT39" ;;
esac
case "$OUT39" in
  *"pane=--detach"*) ko "DÉFAUT REPRODUIT : « --detach » a été avalé comme un pane : $OUT39" ;;
  *) ok "« --detach » n'a jamais été pris pour un pane" ;;
esac
[ "$RC39" -eq 0 ] && ok "code de sortie 0 (succès du geste détaché)" || ko "code de sortie attendu 0, obtenu $RC39"
LISTE39="$(PATH="${BINDIR}:${PATH}" VD_REGISTRE_DIR="$REG39" bash "$VEILLE" --list 2>&1)"
case "$LISTE39" in
  *"pane=w9:pREORD"*"agent=agent-reord"*) ok "le registre porte le VRAI pane et le vrai agent" ;;
  *) ko "le registre ne porte pas le bon pane/agent : $LISTE39" ;;
esac
DPID39="$(printf '%s' "$OUT39" | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)"
[ -n "$DPID39" ] && kill -TERM "$DPID39" 2>/dev/null

# =================================================================
# 40. Tout jeton `--…` inconnu est REFUSÉ tout de suite — jamais pris pour
#     un pane ou un agent (choix de conception : refuser, pas deviner).
# =================================================================
echo "→ 40. option inconnue → refusée, jamais prise pour un positionnel"
# PATH pointé sur le faux herdr : sans ça, un pane inexistant appelle le VRAI
# herdr du poste et le test devient dépendant de ce qui tourne réellement.
# VD_SLEEP=0 + un nombre de tours borné (2) : filet de sécurité pour le cas
# RÉGRESSÉ où l'option ne serait PAS refusée — sans quoi elle veillerait pour
# de vrai (VD_TOURS par défaut = 2000, VD_SLEEP par défaut = 10s).
OUT40="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_STATUS=working \
         VD_REGISTRE_DIR="${WORK}/registre-40" VD_SLEEP=0 VD_SLEEP_CONFIRM=0 \
         bash "$VEILLE" --nimporte-quoi some-pane some-agent 2 2>&1)"; RC40=$?
[ "$RC40" -ne 0 ] && ok "option inconnue → rc≠0 ($RC40)" \
  || ko "option inconnue acceptée silencieusement, rc=$RC40"
case "$OUT40" in
  *"option inconnue"*) ok "le refus nomme l'option en cause" ;;
  *) ko "refus sans message explicite : $OUT40" ;;
esac
case "$OUT40" in
  *"--- bilan :"*) ko "elle a VEILLÉ malgré l'option inconnue" ;;
  *) ok "elle n'a pas veillé sur une option inconnue" ;;
esac

# =================================================================
# 41. --list et --duree sont reconnus où qu'ils apparaissent dans la ligne
#     de commande — pas seulement en $1. Avant ce correctif, `--list` posé
#     en 2e position était avalé comme AGENT (même défaut que --detach).
# =================================================================
echo "→ 41. --list reconnu même s'il n'est pas en \$1"
REG41="${WORK}/registre-41"; rm -rf "$REG41"; mkdir -p "$REG41"
OUT41="$(VD_REGISTRE_DIR="$REG41" bash "$VEILLE" un-pane --list 2>&1)"
case "$OUT41" in
  *"Aucune veille inscrite"*) ok "--list en 2e position déclenche bien le mode liste" ;;
  *) ko "--list en 2e position n'a pas déclenché le mode liste : $OUT41" ;;
esac

echo "→ 41b. --duree reconnu même s'il n'est pas en \$1"
OUT41B="$(bash "$VEILLE" un-pane --duree 2>&1)"
case "$OUT41B" in
  *"DUREE_NOMINALE_S="*) ok "--duree en 2e position déclenche bien le mode durée" ;;
  *) ko "--duree en 2e position n'a pas déclenché le mode durée : $OUT41B" ;;
esac

# =================================================================
# 42. LE PANE EST VÉRIFIÉ À LA POSE (garantie n°10 posée à la seconde zéro) :
#     un pane inexistant est refusé AVANT toute prise de verrou/registre —
#     jamais après un tour de ronde entier (jusqu'à VD_SLEEP secondes,
#     10 s par défaut, plus tôt).
# =================================================================
echo "→ 42. pane inexistant à la pose → refus immédiat, avant toute prise"
REG42="${WORK}/registre-42"; rm -rf "$REG42"; mkdir -p "$REG42"
: > "$SCREEN_FILE"; rm -f "$SEQ_FILE"
DEBUT42=$(date +%s%N)
# ⚠️ LE PANE EST ARMÉ ABSENT, PAS SEULEMENT L'AGENT — et la distinction est le
#    sujet même du correctif. `FAKE_HERDR_STATUS=absent` ne rend absent que
#    l'AGENT ; un pane vivant sans agent est un cas LÉGITIME (test 44). Ce test
#    décrit « le pane n'existe pas » : son double doit donc le dire, sinon il
#    éprouve autre chose que son titre.
OUT42="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_STATUS=absent FAKE_HERDR_PANE_ABSENT=1 \
         VD_REGISTRE_DIR="$REG42" VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_POSE=0.05 \
         bash "$VEILLE" pane-fantome agent-x 5 --dry-run 2>&1)"
RC42=$?
FIN42=$(date +%s%N)
MS42=$(( (FIN42 - DEBUT42) / 1000000 ))
case "$OUT42" in
  *"MOTIF: pane-disparu"*) ok "motif « pane-disparu » nommé à la pose" ;;
  *) ko "pas de refus à la pose : $OUT42" ;;
esac
[ "$RC42" -eq 6 ] && ok "code de sortie propre au pane disparu (rc=$RC42)" \
  || ko "code de sortie attendu 6, obtenu $RC42"
if [ -z "$(ls -A "$REG42" 2>/dev/null)" ]; then
  ok "AUCUN registre écrit — rien n'a été pris pour un pane qui n'existe pas (mesuré : ${MS42}ms)"
else
  ko "un registre a été écrit malgré un pane inexistant : $(ls -A "$REG42")"
fi
[ "$MS42" -lt 5000 ] && ok "refus mesuré en ${MS42}ms — bien avant le premier VD_SLEEP par défaut (10000ms)" \
  || ko "refus trop lent : ${MS42}ms"

# =================================================================
# 43. UN FAUX POSITIF ÉVITÉ : un pane légitime qui apparaît tardivement —
#     absent au premier relevé, présent au second (rapproché) — n'est PAS
#     refusé. Sinon la garde à la pose créerait le défaut inverse.
# =================================================================
echo "→ 43. pane apparu tardivement (absent puis présent, rapproché) → pas de faux refus"
REG43="${WORK}/registre-43"; rm -rf "$REG43"; mkdir -p "$REG43"
: > "$SCREEN_FILE"
printf 'working\nworking\nworking\n' > "$SEQ_FILE"
rm -f "${SEQ_FILE}.idx"
# ⚠️ LA SÉQUENCE PORTE SUR LE PANE, PAS SUR L'AGENT — et ce test l'a appris à ses
#    dépens. Tant qu'il armait la séquence d'`agent get`, il est resté VERT sur un
#    correctif qui avait SUPPRIMÉ la confirmation sur deux relevés : le contrôle de
#    pose interroge `pane get`, que ce test ne pilotait pas. **Une mutation devenue
#    muette est le seul signal d'une garde désarmée** — c'est le motif du lot G,
#    commis dans son propre banc.
PANE_SEQ43="${WORK}/pane-seq-43"
printf 'absent\npresent\npresent\n' > "$PANE_SEQ43"
rm -f "${PANE_SEQ43}.idx"
OUT43="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
         FAKE_HERDR_STATUS_SEQ_FILE="$SEQ_FILE" FAKE_HERDR_PANE_SEQ_FILE="$PANE_SEQ43" \
         VD_REGISTRE_DIR="$REG43" VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 \
         VD_SLEEP_POSE=0.05 \
         bash "$VEILLE" pane-tardif agent-tardif 2 --dry-run 2>&1)"
case "$OUT43" in
  *"MOTIF: pane-disparu"*) ko "FAUX POSITIF : un pane apparu au 2e relevé rapproché est quand même refusé : $OUT43" ;;
  *) ok "un pane apparu au 2e relevé rapproché n'est PAS refusé (faux positif évité)" ;;
esac
if [ -n "$(ls -A "$REG43" 2>/dev/null)" ]; then
  ok "la veille a bien été posée (registre non vide) — la pose légitime n'a pas été bloquée"
else
  ko "aucun registre écrit alors que le pane est légitime (apparu au 2e relevé) : $OUT43"
fi


# =================================================================
# 44. LE FAUX REFUS MESURÉ SUR LE POSTE RÉEL : un pane qui EXISTE mais
#     n'héberge pas (encore) d'agent ne doit PAS être pris pour un pane
#     disparu.
#
#     ⚠️ CE TEST VIENT D'UNE MESURE, PAS D'UNE INTUITION. La première version
#     du contrôle à la pose interrogeait `herdr agent get` — qui rend
#     `agent_not_found` AUSSI BIEN pour un pane fermé que pour un pane vivant
#     sans agent. Passée sur les panes réels du poste : **141 panes vivants
#     sur 231 auraient été refusés à tort**. Une garde qui refuse six poses
#     légitimes sur dix ne survit pas — le premier qui la rencontre la retire,
#     et elle emporte la protection qu'elle apportait.
#
#     Le contrôle interroge donc `herdr pane get`, qui distingue les deux.
# =================================================================
echo "→ 44. pane vivant SANS agent → n'est PAS pris pour un pane disparu"
REG44="${WORK}/registre-44"; rm -rf "$REG44"; mkdir -p "$REG44"
: > "$SCREEN_FILE"
printf 'absent\nabsent\nabsent\n' > "$SEQ_FILE"
rm -f "${SEQ_FILE}.idx"
OUT44="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
         FAKE_HERDR_STATUS_SEQ_FILE="$SEQ_FILE" FAKE_HERDR_PANE_ABSENT=0 \
         VD_REGISTRE_DIR="$REG44" VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 \
         VD_SLEEP_POSE=0.05 \
         bash "$VEILLE" pane-sans-agent agent-pas-encore-ne 2 --dry-run 2>&1)"
case "$OUT44" in
  *"pane-disparu — le pane pane-sans-agent n'existe pas au moment de la pose"*)
    ko "FAUX REFUS : un pane VIVANT sans agent est pris pour un pane disparu à la pose — c'est le cas mesuré 141 fois sur 231 sur le poste réel : $OUT44" ;;
  *) ok "un pane vivant sans agent n'est PAS refusé à la pose (141/231 faux refus évités)" ;;
esac

echo "→ 44b. pane RÉELLEMENT inexistant → toujours refusé (la contre-épreuve)"
REG44B="${WORK}/registre-44b"; rm -rf "$REG44B"; mkdir -p "$REG44B"
rm -f "${SEQ_FILE}.idx"
OUT44B="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
          FAKE_HERDR_STATUS_SEQ_FILE="$SEQ_FILE" FAKE_HERDR_PANE_ABSENT=1 \
          VD_REGISTRE_DIR="$REG44B" VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 \
          VD_SLEEP_POSE=0.05 \
          bash "$VEILLE" pane-fantome-44 agent-fantome 2 --dry-run 2>&1)"
case "$OUT44B" in
  *"MOTIF: pane-disparu"*) ok "un pane réellement inexistant est toujours refusé — le correctif du faux refus n'a pas désarmé la garde" ;;
  *) ko "GARDE DÉSARMÉE : un pane inexistant n'est plus refusé à la pose — corriger le faux refus a emporté la garantie : $OUT44B" ;;
esac
if [ -n "$(ls -A "$REG44B" 2>/dev/null)" ]; then
  ko "un registre a été écrit pour un pane réellement inexistant"
else
  ok "aucun registre écrit pour un pane réellement inexistant"
fi


# =================================================================
# 45. UN PANE VIVANT DONT L'AGENT EST INVISIBLE N'EST PAS UN PANE MORT.
#
#     ⚠️ CE TEST VIENT D'UNE MESURE SUR LE POSTE, PAS D'UNE HYPOTHÈSE. Un pane
#     vivant hébergeant un agent Claude visible à l'écran, mais que le registre
#     d'agents ne connaît pas (`pane get` OK · `agent get` → agent_not_found ·
#     `agent list` l'ignore), faisait rendre à la veille :
#
#       MOTIF: pane-disparu — le pane w87:p2 n'existe plus (confirmé sur deux
#       relevés) — il n'y a plus rien à garder            (rc=6)
#
#     TROIS AFFIRMATIONS FAUSSES DANS UNE PHRASE : le pane existe, il héberge un
#     agent vivant, et il y a précisément quelqu'un à garder — que plus personne
#     ne garde. **Un silence laisse la question ouverte ; un mensonge la ferme du
#     mauvais côté** : l'orchestrateur qui lit ce motif ferme un pane vivant en
#     croyant nettoyer.
#
#     ⚠️ ET C'ÉTAIT UNE INCOHÉRENCE INTERNE : le contrôle À LA POSE interroge
#     `pane get` et laisse passer, la BOUCLE interroge `agent get` et conclut que
#     le pane a disparu. Deux sondes du même script, deux verdicts opposés sur le
#     même pane.
# =================================================================
echo "→ 45. pane VIVANT, agent invisible → motif VRAI, jamais « le pane n'existe plus »"
REG45="${WORK}/registre-45"; rm -rf "$REG45"; mkdir -p "$REG45"
: > "$SCREEN_FILE"; rm -f "$SEQ_FILE"
OUT45="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
         FAKE_HERDR_STATUS=absent FAKE_HERDR_PANE_ABSENT=0 \
         VD_REGISTRE_DIR="$REG45" VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_POSE=0.05 \
         bash "$VEILLE" pane-vivant-agent-invisible agent-hors-registre 6 --dry-run 2>&1)"
RC45=$?
case "$OUT45" in
  *"n'existe plus"*|*"plus rien à garder"*)
    ko "MENSONGE : la veille déclare le pane disparu alors qu'il EXISTE et héberge un agent — c'est le cas mesuré sur le poste : $OUT45" ;;
  *) ok "elle ne prétend plus que le pane a disparu" ;;
esac
case "$OUT45" in
  *"MOTIF: agent-invisible"*) ok "elle nomme le vrai motif — l'agent est invisible, pas le pane mort" ;;
  *) ko "aucun motif « agent-invisible » : elle doit DIRE ce qu'elle voit, pas se taire ni mentir : $OUT45" ;;
esac
# ⚠️ 10, ET PAS 5 : `code_motif` rend déjà 5 pour tout motif INCONNU (son `*)`).
#    Exiger 5 ici rendrait ce test vert sur une faute de frappe dans le nom du
#    motif — un test qui accepte l'erreur qu'il est censé exclure.
[ "$RC45" -eq 10 ] && ok "code de sortie propre, DISTINCT de pane-disparu (6) ET du fourre-tout (5) — rc=$RC45" \
  || ko "code de sortie $RC45 — un agent invisible et un pane mort doivent être distinguables au code, pas seulement au texte"

echo "→ 45b. la contre-épreuve : un pane RÉELLEMENT mort rend toujours pane-disparu"
REG45B="${WORK}/registre-45b"; rm -rf "$REG45B"; mkdir -p "$REG45B"
OUT45B="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
          FAKE_HERDR_STATUS=absent FAKE_HERDR_PANE_ABSENT=1 \
          VD_REGISTRE_DIR="$REG45B" VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_POSE=0.05 \
          bash "$VEILLE" pane-vraiment-mort agent-x 6 --dry-run 2>&1)"
RC45B=$?
case "$OUT45B" in
  *"MOTIF: pane-disparu"*) ok "un pane réellement mort rend toujours pane-disparu — le correctif du mensonge n'a pas emporté la garantie" ;;
  *) ko "GARDE EMPORTÉE : un pane réellement mort ne rend plus pane-disparu : $OUT45B" ;;
esac
[ "$RC45B" -eq 6 ] && ok "et son code reste 6" || ko "le code de pane-disparu a changé (rc=$RC45B)"

echo "→ 45c. les deux sondes du script ne se contredisent plus sur le même pane"
# La pose laisse passer (le pane existe) ET la boucle ne dit pas le contraire :
# c'est l'incohérence interne que ce lot referme.
case "$OUT45" in
  *"pane-disparu"*) ko "la pose accepte le pane et la boucle le déclare disparu — les deux sondes se contredisent" ;;
  *) ok "pose et boucle rendent un verdict cohérent sur le même pane" ;;
esac


# =================================================================
# 46. UN HOQUET QUI CHANGE DE SENS À CHAQUE TOUR NE DOIT PAS DÉFAIRE LA
#     CONFIRMATION « À DEUX » — ni faire brûler toute la veille en silence.
#
#     ⚠️ CE TEST VIENT D'UN REJET DE REVUE DE FOND, ET LE COMMENTAIRE DU CODE
#     AFFIRMAIT LE CONTRAIRE. `ABSENCES` et `INVISIBLES` se remettent l'un
#     l'autre à zéro — c'est juste tant que le pane répond de façon stable. Mais
#     si `pane get` alterne présent/absent à chaque relevé, AUCUN des deux
#     n'atteint jamais 2 : ils se cannibalisent, et la veille épuise ses 2000
#     tours sans jamais conclure. Elle rend alors `tours-epuises — il n'a
#     peut-être jamais reçu son brief`, un message qui MINIMISE ce qui était une
#     absence totale et continue.
#
#     L'agent était absent 10 relevés sur 10 : le motif rendu doit le DIRE.
#     Un compteur qui ne se laisse pas remettre à zéro par l'autre est ce qui
#     manquait — les deux compteurs choisissent le MOTIF, ils ne décident pas
#     à eux seuls s'il faut conclure.
# =================================================================
echo "→ 46. pane qui oscille à chaque relevé → elle conclut quand même, et dit VRAI"
REG46="${WORK}/registre-46"; rm -rf "$REG46"; mkdir -p "$REG46"
: > "$SCREEN_FILE"; rm -f "$SEQ_FILE"
PANE_SEQ46="${WORK}/pane-seq-46"
printf 'present\nabsent\npresent\nabsent\npresent\nabsent\npresent\nabsent\npresent\nabsent\npresent\n' > "$PANE_SEQ46"
rm -f "${PANE_SEQ46}.idx"
OUT46="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
         FAKE_HERDR_STATUS=absent FAKE_HERDR_PANE_SEQ_FILE="$PANE_SEQ46" \
         VD_REGISTRE_DIR="$REG46" VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_POSE=0 \
         bash "$VEILLE" pane-qui-oscille agent-x 10 --dry-run 2>&1)"
RC46=$?
case "$OUT46" in
  *"MOTIF: tours-epuises"*)
    ko "ELLE BRÛLE TOUTE SA VEILLE SANS CONCLURE : l'agent était absent à CHAQUE relevé et elle rend « tours-epuises », un motif qui minimise. Les deux compteurs se cannibalisent : $OUT46" ;;
  *"MOTIF: etat-instable"*) ok "elle conclut sur l'instabilité et la NOMME, au lieu d'épuiser ses tours" ;;
  *) ko "motif inattendu — elle doit dire ce qu'elle voit : $OUT46" ;;
esac
case "$OUT46" in
  *"jamais reçu son brief"*) ko "le message MINIMISE une absence totale et continue" ;;
  *) ok "le message ne minimise pas l'absence" ;;
esac
[ "$RC46" -eq 11 ] && ok "code de sortie propre à l'instabilité (rc=$RC46), distinct du fourre-tout (5)" \
  || ko "code de sortie $RC46 — l'instabilité doit être distinguable au code"

echo "→ 46b. la contre-épreuve : un hoquet ISOLÉ ne fait pas crier"
REG46B="${WORK}/registre-46b"; rm -rf "$REG46B"; mkdir -p "$REG46B"
PANE_SEQ46B="${WORK}/pane-seq-46b"
# absent, absent, PRÉSENT (le hoquet), puis l'agent revient au travail.
printf 'absent\nabsent\npresent\npresent\npresent\n' > "$PANE_SEQ46B"
rm -f "${PANE_SEQ46B}.idx"
SEQ46B="${WORK}/seq-46b"
printf 'absent\nworking\nworking\nworking\nworking\nworking\n' > "$SEQ46B"
rm -f "${SEQ46B}.idx"
OUT46B="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
          FAKE_HERDR_STATUS_SEQ_FILE="$SEQ46B" FAKE_HERDR_PANE_SEQ_FILE="$PANE_SEQ46B" \
          VD_REGISTRE_DIR="$REG46B" VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_POSE=0 \
          bash "$VEILLE" pane-hoquet-isole agent-x 5 --dry-run 2>&1)"
case "$OUT46B" in
  *"MOTIF: etat-instable"*) ko "FAUX CRI : un hoquet isolé suivi d'un agent au travail fait crier à l'instabilité : $OUT46B" ;;
  *) ok "un hoquet isolé suivi d'un agent au travail ne fait pas crier" ;;
esac


# =================================================================
# 47. LE DÉFAUT ① DU RAPPORT DE PHASE 0 (T-20260825-0067 / T-20260819-0094),
#     reproduit mot pour mot : un agent qui a travaillé PUIS SE REPOSE entre
#     deux gestes était déclaré fini. La veille rendait « TERMINE apres 0
#     deblocages », motif « agent-termine », et l'agent qui se bloquait
#     ensuite n'avait plus personne pour le voir.
#
# ⚠️ CE QU'ON ÉPROUVE EST L'EFFET EMPÊCHÉ, PAS LE MESSAGE. Un test qui se
#    contenterait de vérifier l'absence du mot « agent-termine » survivrait à
#    un correctif qui renomme le motif sans rien réparer. Ici la veille doit
#    être ENCORE LÀ quand le blocage arrive, et le débloquer.
#
# ⚠️ « au repos » ≠ « a fini ». Mesuré sur les 85 agents réels du poste le
#    2026-08-25 : `idle` 75, `working` 7, `done` 3. `done` est l'état terminal
#    EXPLICITE de herdr et il SURVIENT vraiment ; `idle` est l'état de trois
#    agents sur quatre, dont la plupart sont au milieu de leur mandat.
# =================================================================
echo "→ 47. DÉFAUT ① : l'agent travaille, SE REPOSE, puis se bloque → elle est encore là"
: > "$SCREEN_FILE"
cat > "$SCREEN_FILE" <<'ECRAN47'
 Bash command

   git status

 Do you want to proceed?
 ❯ 1. Yes
   2. Yes, and always allow access
   3. No

 Esc to cancel
ECRAN47
# working (il travaille) → idle, idle (il se repose entre deux gestes) →
# blocked (il demande une permission). Avec le défaut, elle meurt au 2ᵉ relevé
# et ne voit JAMAIS le blocage.
printf 'working\nidle\nidle\nblocked\nblocked\nblocked\n' > "$SEQ_FILE"
run 6
case "$OUT" in
  *"debloque (#1)"*) ok "elle a survécu au repos et débloqué l'agent — le défaut ① est fermé" ;;
  *) ko "DÉFAUT ① VIVANT : elle n'était plus là quand l'agent s'est bloqué. Sortie : $OUT" ;;
esac
case "$OUT" in
  *"MOTIF: agent-termine"*) ko "DÉFAUT ① : elle affirme que l'agent a FINI alors qu'il se reposait entre deux gestes : $OUT" ;;
  *) ok "elle n'affirme pas que l'agent a fini" ;;
esac

echo "→ 47b. LA CONTRE-ÉPREUVE : l'état terminal EXPLICITE done conclut toujours"
: > "$SCREEN_FILE"
printf 'working\ndone\ndone\n' > "$SEQ_FILE"
run 6
case "$OUT" in
  *"MOTIF: agent-termine"*) ok "un done confirmé conclut toujours agent-termine — le correctif n'a pas emporté la fin légitime" ;;
  *) ko "LE CORRECTIF A TROP PRIS : un done explicite et confirmé ne conclut plus : $OUT" ;;
esac
[ "$RC" -eq 0 ] && ok "et son code de sortie reste 0" || ko "code de sortie $RC sur une fin légitime"

echo "→ 47c. Le repos PROLONGÉ s'arrête — mais en nommant ce qu'elle a vu, jamais « il a fini »"
: > "$SCREEN_FILE"
printf 'working\nidle\n' > "$SEQ_FILE"; rm -f "${SEQ_FILE}.idx"
OUT47C="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
          FAKE_HERDR_STATUS_SEQ_FILE="$SEQ_FILE" FAKE_HERDR_WITNESS="$WITNESS" \
          VD_REGISTRE_DIR="${WORK}/registre-47c" VD_REPOS_TOURS=3 \
          VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 VD_SLEEP_POSE=0 \
          bash "$VEILLE" test-pane test-agent 50 --dry-run 2>&1)"
RC47C=$?
case "$OUT47C" in
  *"MOTIF: agent-termine"*) ko "elle AFFIRME une fin qu'elle n'a pas mesurée — un repos n'est pas une fin : $OUT47C" ;;
  *"MOTIF: repos-prolonge"*) ok "elle nomme ce qu'elle a réellement observé : un repos prolongé" ;;
  *) ko "motif inattendu sur un repos prolongé : $OUT47C" ;;
esac
case "$OUT47C" in
  *"MOTIF: tours-epuises"*) ko "elle brûle 50 tours sur un agent immobile au lieu de conclure" ;;
  *) ok "elle conclut sans brûler toute sa veille" ;;
esac
[ "$RC47C" -ne 0 ] && ok "code de sortie DISTINCT de la fin légitime (rc=$RC47C) — un appelant machine les sépare" \
  || ko "le repos prolongé rend le même code que « l'agent a fini » : les deux deviennent indistinguables"

echo "→ 47d. Un agent au repos AVEC DU TRAVAIL EN VOL n'est jamais déclaré au repos prolongé"
# ⚠️ Le cas le plus dangereux : `idle` alors qu'un sous-agent tourne. L'agent
#    n'a pas fini, il ATTEND — et c'est précisément quand il redemandera une
#    permission qu'il aura besoin d'elle.
cat > "$SCREEN_FILE" <<'ECRAN47D'
  Analyse en cours

  · 2 shells · /tasks to see subagents
ECRAN47D
printf 'working\nidle\n' > "$SEQ_FILE"; rm -f "${SEQ_FILE}.idx"
OUT47D="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
          FAKE_HERDR_STATUS_SEQ_FILE="$SEQ_FILE" FAKE_HERDR_WITNESS="$WITNESS" \
          VD_REGISTRE_DIR="${WORK}/registre-47d" VD_REPOS_TOURS=3 \
          VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 VD_SLEEP_POSE=0 \
          bash "$VEILLE" test-pane test-agent 12 --dry-run 2>&1)"
case "$OUT47D" in
  *"MOTIF: repos-prolonge"*) ko "elle ABANDONNE un agent qui a un sous-agent et deux shells en vol : $OUT47D" ;;
  *"MOTIF: agent-termine"*) ko "elle déclare FINI un agent qui a du travail en vol : $OUT47D" ;;
  *) ok "elle veille tant qu'il y a du travail en vol" ;;
esac

echo "→ 47e. La borne de repos par DÉFAUT couvre la repro du rapport (11 min de repos)"
# ⚠️ UNE BORNE SE POSE AVANT LE RÉSULTAT, ET ELLE SE MESURE. La veille du
#    rapport est morte vers la 11ᵉ minute de repos. Une borne par défaut plus
#    courte que ça laisserait le défaut passer sous un correctif « vert ».
#    VD_REPOS_TOURS est réglable pour que ce banc l'éprouve — c'est donc la
#    VALEUR PAR DÉFAUT elle-même qu'on épingle ici, sinon le banc réglerait ce
#    qu'il éprouve.
DEFAUT_REPOS="$(grep -E '^VD_REPOS_TOURS_DEFAUT=' "$VEILLE" | head -1 | cut -d= -f2)"
DEFAUT_SLEEP="$(grep -E '^VD_SLEEP_DEFAUT=' "$VEILLE" | head -1 | cut -d= -f2)"
if [ -n "$DEFAUT_REPOS" ] && [ -n "$DEFAUT_SLEEP" ]; then
  MINUTES=$(( DEFAUT_REPOS * DEFAUT_SLEEP / 60 ))
  [ "$MINUTES" -ge 20 ] \
    && ok "la borne par défaut couvre ${MINUTES} min de repos — au-delà des 11 min de la repro" \
    || ko "la borne par défaut ne couvre que ${MINUTES} min : la repro du rapport (11 min) repasserait"
else
  ko "VD_REPOS_TOURS_DEFAUT introuvable dans le script — la borne n'est pas épinglable"
fi



# =================================================================
# 48. LE DÉFAUT ② DU 2026-08-26 (T-20260826-0064), mesuré sur l'agent réel
#     `e-20260826-0007` (pane w31:pA, 10h12 EDT) : la limite de session
#     claude.ai a coupé l'agent EN PLEIN TRAVAIL. Son écran portait
#     « ⎿ Login successful » puis une boîte vide, et la marque « ◎ /goal
#     active (2h) ». herdr rendait `done`, puis `idle` à la confirmation.
#     La veille a conclu « ○ terminée · motif=agent-termine » — alors que
#     l'agent n'avait rendu AUCUN compte rendu et que son but n'était pas
#     atteint. Preuve que ce n'était pas fini : un message l'a fait repasser
#     `working` en 8 secondes et il a repris son lot.
#
# ⚠️ CE QUE LA VEILLE LISAIT NE SUFFISAIT PAS. Elle lisait un ÉTAT (`done`,
#    `idle`) ; l'état d'un agent coupé par la limite de session est
#    exactement celui d'un agent qui a fini. Ce qui les sépare est le BUT :
#    un but encore actif à l'écran dit que le mandat n'est PAS clos, quelle
#    que soit l'apparence de repos.
#
# ⚠️ LA MARQUE EST CELLE QU'ON A MESURÉE, pas une convention inventée.
#    Relevée sur les 119 panes réels du poste le 2026-08-26 (lecture seule,
#    `herdr pane read <id> --lines 40`), quatre écrans la portaient, sous
#    quatre durées différentes et deux mises en page :
#      « ◎ /goal active (9m) »   (seule sur sa ligne, alignée à droite)
#      « ◎ /goal active (5h) »   (idem)
#      « … /clear to save 598.7k tokens · ◎ /goal active (4d) »
#      « ✔ Update installed · Restart to update◎ /goal active (1d) »  ← COLLÉE
#    La dernière interdit toute ancre de début de ligne. Le même relevé a
#    aussi trouvé des lignes qui parlent de `goal` SANS être la marque
#    (« ◯ Goal not yet met… continuing », « En attente : A, C, ou /goal
#    clear. ») : c'est pourquoi la sonde cherche `/goal active`, pas `goal`.
# =================================================================
echo "→ 48. DÉFAUT ② : coupé par la limite de session (but ACTIF) → elle ne conclut PAS la fin"
cat > "$SCREEN_FILE" <<'ECRAN48'
  ⎿  Login successful

                                               ◎ /goal active (2h)
────────────────────────────────────────────────────────────────────
❯
────────────────────────────────────────────────────────────────────
  ⏵⏵ auto mode on (shift+tab to cycle)
ECRAN48
# La signature EXACTE du ticket : l'état terminal `done`, confirmé par un
# `idle` au second relevé — la porte que la branche `done)` laissait ouverte.
printf 'working\ndone\nidle\nidle\nidle\nidle\n' > "$SEQ_FILE"
run 6

case "$OUT" in
  *"MOTIF: agent-termine"*) ko "DÉFAUT ② VIVANT : elle déclare FINI un agent dont le but est encore actif — il n'a rendu aucun compte rendu : $OUT" ;;
  *) ok "un but encore actif empêche de conclure la fin" ;;
esac
case "$OUT" in
  *"TERMINE apres"*) ko "DÉFAUT ② VIVANT : « TERMINE » annoncé sur un agent coupé par la limite de session : $OUT" ;;
  *) ok "elle n'annonce pas « TERMINE »" ;;
esac

echo "→ 48b. LA CONTRE-ÉPREUVE : le MÊME écran SANS la marque du but conclut toujours"
# Sans elle, un correctif qui cesserait purement et simplement de conclure
# passerait le scénario 48. C'est l'assertion qui mesure ce que le correctif
# a PRIS en plus de ce qu'il a fermé.
cat > "$SCREEN_FILE" <<'ECRAN48B'
  ⎿  Login successful

────────────────────────────────────────────────────────────────────
❯
────────────────────────────────────────────────────────────────────
  ⏵⏵ auto mode on (shift+tab to cycle)
ECRAN48B
printf 'working\ndone\nidle\nidle\nidle\nidle\n' > "$SEQ_FILE"
run 6
case "$OUT" in
  *"MOTIF: agent-termine"*) ok "sans but actif, done+idle conclut toujours la fin — le correctif n'a pas emporté la fin légitime" ;;
  *) ko "LE CORRECTIF A TROP PRIS : plus aucune fin n'est conclue, même sans but actif : $OUT" ;;
esac
[ "$RC" -eq 0 ] && ok "et son code de sortie reste 0" || ko "code de sortie $RC sur une fin légitime"

echo "→ 48c. L'EFFET EMPÊCHÉ : elle est ENCORE LÀ quand l'agent reprend et se bloque"
# ⚠️ On éprouve l'effet, pas le message. Un correctif qui renommerait le motif
#    sans rien réparer survivrait à 48 et 48b ; il ne survit pas à celui-ci.
#    C'est la reprise réelle du ticket : un message a fait repasser l'agent
#    `working` en 8 s, et il a repris son lot. Avec le défaut, la veille était
#    déjà morte à ce moment-là.
cat > "$SCREEN_FILE" <<'ECRAN48C'
 Bash command

   git status

 Do you want to proceed?
 ❯ 1. Yes
   2. Yes, and always allow access
   3. No

                                               ◎ /goal active (2h)
ECRAN48C
printf 'working\ndone\nidle\nblocked\nblocked\nblocked\n' > "$SEQ_FILE"
run 6
case "$OUT" in
  *"debloque (#1)"*) ok "elle a survécu à l'état terminal trompeur et débloqué l'agent qui reprenait" ;;
  *) ko "DÉFAUT ② VIVANT : elle n'était plus là quand l'agent a repris et s'est bloqué. Sortie : $OUT" ;;
esac

echo "→ 48d. Elle ne veille pas indéfiniment : un but actif immobile s'arrête sur un motif NOMMÉ"
# ⚠️ Elle ne s'arrête jamais en silence (garantie n°6) et elle NOMME ce qu'elle
#    a vu (leçon du défaut ①). « Son but est actif et il ne bouge plus » n'est
#    ni « il a fini » ni « il s'est reposé » : c'est un troisième fait, avec son
#    propre code de sortie, pour que l'appelant machine ne les confonde pas.
cat > "$SCREEN_FILE" <<'ECRAN48D'
  ⎿  Login successful

                                               ◎ /goal active (2h)
ECRAN48D
printf 'working\ndone\n' > "$SEQ_FILE"; rm -f "${SEQ_FILE}.idx"
OUT48D="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
          FAKE_HERDR_STATUS_SEQ_FILE="$SEQ_FILE" FAKE_HERDR_WITNESS="$WITNESS" \
          VD_REGISTRE_DIR="${WORK}/registre-48d" VD_BUT_TOURS=3 \
          VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 VD_SLEEP_POSE=0 \
          bash "$VEILLE" test-pane test-agent 50 --dry-run 2>&1)"
RC48D=$?
case "$OUT48D" in
  *"MOTIF: agent-termine"*) ko "elle AFFIRME une fin qu'elle n'a pas mesurée — le but était encore actif : $OUT48D" ;;
  *"MOTIF: but-inacheve"*) ok "elle nomme ce qu'elle a réellement observé : un but encore actif, et un agent qui ne bouge plus" ;;
  *) ko "motif inattendu sur un but actif immobile : $OUT48D" ;;
esac
case "$OUT48D" in
  *"MOTIF: tours-epuises"*) ko "elle brûle 50 tours sur un agent immobile au lieu de conclure" ;;
  *) ok "elle conclut sans brûler toute sa veille" ;;
esac
[ "$RC48D" -ne 0 ] && ok "code de sortie DISTINCT de la fin légitime (rc=$RC48D) — un appelant machine les sépare" \
  || ko "un but inachevé rend le même code que « l'agent a fini » : les deux deviennent indistinguables"
[ "$RC48D" -ne 12 ] && ok "…et DISTINCT du repos prolongé (rc=$RC48D ≠ 12) — trois faits, trois signaux" \
  || ko "un but inachevé rend le code du repos prolongé : deux faits différents confondus"

# ⚠️ ET LA BORNE VAUT EXACTEMENT CE NOMBRE-LÀ. Sans cette assertion, `-ge`
#    remplacé par `-gt` SURVIVAIT (mesuré par mutation) : la veille concluait au
#    4ᵉ relevé au lieu du 3ᵉ et tous les tests restaient verts. « Elle finit par
#    conclure » n'est pas « elle conclut où on l'a posée » — une borne qui glisse
#    sans qu'un test rougisse n'est plus une borne, c'est une tendance.
N48D=$(printf '%s\n' "$OUT48D" | grep -c "son BUT est encore actif")
[ "$N48D" -eq 3 ] && ok "elle conclut au relevé EXACT où la borne est posée (3 relevés, obtenu $N48D)" \
  || ko "borne décalée : attendu 3 relevés avant de conclure, obtenu $N48D"
case "$OUT48D" in
  *"(3/3)"*) ok "le dernier relevé annoncé est bien le 3ᵉ sur 3" ;;
  *) ko "le compte annoncé ne finit pas sur (3/3) : $OUT48D" ;;
esac

echo "→ 48f. PARLER du but n'est PAS avoir un but actif — la sonde cherche la MARQUE, pas le mot"
# ⚠️ MESURÉ, PAS IMAGINÉ. Le relevé du 2026-08-26 sur les 119 panes réels a
#    trouvé des lignes qui contiennent « goal » SANS être la marque du but :
#    « ◯ Goal not yet met… continuing » (6 occurrences) et « ⏺ En attente : A,
#    C, ou /goal clear. ». Une sonde qui chercherait le mot refuserait de
#    conclure sur un agent réellement fini qui a simplement écrit le mot — et
#    cette faute-là SURVIVAIT à tous les autres scénarios (mesuré par mutation :
#    `grep -qF '/goal active'` → `grep -qF 'goal'`, 150 verts).
cat > "$SCREEN_FILE" <<'ECRAN48F'
  ⏺ En attente : A, C, ou /goal clear.
  ◯ Goal not yet met… continuing
  ⏺ Rapport rendu. Terminé.
────────────────────────────────────────────────────────────────────
❯
ECRAN48F
printf 'working\ndone\ndone\ndone\n' > "$SEQ_FILE"
run 4
case "$OUT" in
  *"MOTIF: agent-termine"*) ok "un écran qui PARLE de goal sans porter la marque conclut toujours la fin" ;;
  *) ko "SONDE TROP LARGE : elle refuse de conclure sur un agent fini qui a seulement écrit le mot « goal » : $OUT" ;;
esac
[ "$RC" -eq 0 ] && ok "et son code de sortie reste 0" || ko "code de sortie $RC sur une fin légitime"

echo "→ 48g. La FENÊTRE de lecture est assez large pour atteindre la marque"
# ⚠️ LA MARQUE N'EST PAS LA DERNIÈRE LIGNE DE L'ÉCRAN. Mesuré le 2026-08-26 sur
#    les panes réels : sous la marque viennent la boîte de saisie, la barre
#    « auto mode », puis autant de lignes que l'agent a de sous-agents en vol —
#    onze lignes sous la marque sur w31:pD, huit sur w8X:pC. Une sonde qui ne
#    lirait que les dernières lignes rendrait « pas de but » sur un agent qui en
#    a, c'est-à-dire rouvrirait le défaut. Sans ce scénario, `--lines 40` →
#    `--lines 1` SURVIVAIT à toute la suite (mesuré par mutation).
cat > "$SCREEN_FILE" <<'ECRAN48G'
  ⎿  Login successful

                                               ◎ /goal active (2h)
────────────────────────────────────────────────────────────────────
❯
────────────────────────────────────────────────────────────────────
  ⏵⏵ auto mode on (shift+tab to cycle) · PR #336
                                                               /rc

  ⏺ main
  ◯ backend  Measuring lsof and connect o… 2m 40s · ↓ 86.1k tokens
  ◯ backend  Grepping across pane output … 1m 59s · ↓ 94.5k tokens
  ◯ backend  Reading test-naissance-orche… 1m 15s · ↓ 97.9k tokens
  ◯ backend  Writing the report ………………………… 0m 41s · ↓ 12.2k tokens
  ◯ general-purpose  Backing up the tree … 3m 13s · ↓ 109.9k tokens
ECRAN48G
printf 'working\ndone\nidle\nidle\nidle\nidle\n' > "$SEQ_FILE"
run 6
case "$OUT" in
  *"MOTIF: agent-termine"*) ko "FENÊTRE TROP COURTE : la marque du but était à l'écran, la sonde ne l'a pas atteinte : $OUT" ;;
  *) ok "elle atteint la marque même quand douze lignes la surmontent" ;;
esac

echo "→ 48h. UNE REPRISE REMET LE COMPTEUR À ZÉRO — sinon un agent vivant est lâché"
# ⚠️ C'EST LA REPRO ELLE-MÊME QUI L'EXIGE : l'agent coupé est reparti `working`
#    en 8 secondes. Un agent qui alterne « état terminal trompeur » et « travail
#    réel » ne doit JAMAIS accumuler vers la borne : sans le reset, trois faux
#    départs espacés d'une heure suffiraient à l'abandonner alors qu'il travaille.
cat > "$SCREEN_FILE" <<'ECRAN48H'
  ⎿  Login successful

                                               ◎ /goal active (2h)
ECRAN48H
# working / done→idle / working / done→idle / working / done→idle : trois états
# terminaux trompeurs, mais séparés par du travail RÉEL à chaque fois.
printf 'working\ndone\nidle\nworking\ndone\nidle\nworking\ndone\nidle\nworking\nworking\nworking\n' > "$SEQ_FILE"; rm -f "${SEQ_FILE}.idx"
OUT48H="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
          FAKE_HERDR_STATUS_SEQ_FILE="$SEQ_FILE" FAKE_HERDR_WITNESS="$WITNESS" \
          VD_REGISTRE_DIR="${WORK}/registre-48h" VD_BUT_TOURS=3 \
          VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 VD_SLEEP_POSE=0 \
          bash "$VEILLE" test-pane test-agent 8 --dry-run 2>&1)"
case "$OUT48H" in
  *"MOTIF: but-inacheve"*) ko "elle LÂCHE un agent qui a repris le travail entre chaque état terminal : $OUT48H" ;;
  *"MOTIF: agent-termine"*) ko "elle déclare fini un agent dont le but est actif : $OUT48H" ;;
  *) ok "une reprise réelle remet le compteur à zéro — elle veille toujours" ;;
esac
N48H=$(printf '%s\n' "$OUT48H" | grep -c "(1/3)")
[ "$N48H" -eq 3 ] && ok "le compteur repart de 1 à chaque reprise (3 fois « (1/3) »)" \
  || ko "le compteur n'est pas remis à zéro par la reprise : « (1/3) » vu $N48H fois au lieu de 3"

echo "→ 48e. La borne du but est ÉPINGLÉE dans le script, et elle est VISIBLE"
# ⚠️ VD_BUT_TOURS est réglable pour que 48d soit éprouvable en un instant ; sans
#    cette assertion, le banc réglerait ce qu'il éprouve et la valeur RÉELLE du
#    poste ne serait garantie par rien. Deux réglages voisins (repos / but) qui
#    ne se voient jamais ensemble sont le vrai défaut : ils sont documentés et
#    épinglés tous les deux.
DEFAUT_BUT="$(grep -E '^VD_BUT_TOURS_DEFAUT=' "$VEILLE" | head -1 | cut -d= -f2)"
DEFAUT_SLEEP2="$(grep -E '^VD_SLEEP_DEFAUT=' "$VEILLE" | head -1 | cut -d= -f2)"
if [ -n "$DEFAUT_BUT" ] && [ -n "$DEFAUT_SLEEP2" ]; then
  MIN_BUT=$(( DEFAUT_BUT * DEFAUT_SLEEP2 / 60 ))
  [ "$MIN_BUT" -ge 20 ] \
    && ok "la borne du but par défaut couvre ${MIN_BUT} min d'immobilité avant de lâcher l'agent" \
    || ko "la borne du but par défaut ne couvre que ${MIN_BUT} min : trop courte pour une coupure de session"
else
  ko "VD_BUT_TOURS_DEFAUT introuvable dans le script — la borne n'est pas épinglable"
fi
grep -qE 'VD_BUT_TOURS' "$VEILLE" && ok "VD_BUT_TOURS est un réglage nommé du script" || ko "VD_BUT_TOURS n'existe pas"


# =================================================================
# 49. LE SYMÉTRIQUE DU CORRECTIF 48, trouvé par la revue du chef d'équipe.
#     Le scénario 48 ferme la porte par laquelle le défaut ② est passé le
#     2026-08-26 : `done` puis `idle`. Mais un agent coupé par la limite de
#     session peut rester `idle` SANS JAMAIS PASSER `done` — et c'est
#     LITTÉRALEMENT l'écran du ticket : « ⎿ Login successful », boîte vide,
#     statut herdr `idle`, marque « ◎ /goal active ». Ce chemin-là ne
#     consultait pas le but : il lâchait l'agent au bout de la borne de repos
#     avec le motif `repos-prolonge`, qui dit « il ne bouge plus » sans jamais
#     dire que son MANDAT était resté ouvert.
#
# ⚠️ DEUX MOTIFS QUI DISENT DEUX CHOSES VRAIMENT DIFFÉRENTES — c'est le sens
#    de les avoir séparés. `repos-prolonge` (12) = immobilité ORDINAIRE, sans
#    but actif ; `but-inacheve` (13) = immobilité avec un mandat resté ouvert
#    (session coupée ? limite atteinte ?). Le premier dit « va peut-être le
#    voir » ; le second dit « un message suffit peut-être à le faire repartir ».
# =================================================================
echo "→ 49. Agent IDLE (jamais done) + but ACTIF → mandat ouvert, jamais « repos ordinaire »"
cat > "$SCREEN_FILE" <<'ECRAN49'
  ⎿  Login successful

                                               ◎ /goal active (2h)
────────────────────────────────────────────────────────────────────
❯
────────────────────────────────────────────────────────────────────
  ⏵⏵ auto mode on (shift+tab to cycle)
ECRAN49
# L'agent travaille, puis reste `idle` — SANS jamais passer `done`. C'est la
# porte d'à côté de celle du scénario 48, et elle donne sur la même pièce.
printf 'working\nidle\n' > "$SEQ_FILE"; rm -f "${SEQ_FILE}.idx"
OUT49="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
         FAKE_HERDR_STATUS_SEQ_FILE="$SEQ_FILE" FAKE_HERDR_WITNESS="$WITNESS" \
         VD_REGISTRE_DIR="${WORK}/registre-49" VD_REPOS_TOURS=3 VD_BUT_TOURS=3 \
         VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 VD_SLEEP_POSE=0 \
         bash "$VEILLE" test-pane test-agent 50 --dry-run 2>&1)"
RC49=$?
case "$OUT49" in
  *"MOTIF: repos-prolonge"*) ko "SYMÉTRIQUE OUVERT : elle lâche comme une immobilité ORDINAIRE un agent dont le but est encore actif — c'est l'écran exact du ticket : $OUT49" ;;
  *"MOTIF: but-inacheve"*) ok "le chemin idle nomme lui aussi le mandat resté ouvert" ;;
  *"MOTIF: agent-termine"*) ko "elle déclare FINI un agent idle au but actif : $OUT49" ;;
  *) ko "motif inattendu sur un idle au but actif : $OUT49" ;;
esac
[ "$RC49" -eq 13 ] && ok "et il porte le MÊME code que le chemin done (rc=$RC49)" \
  || ko "code attendu 13 (but-inacheve) sur le chemin idle, obtenu $RC49"
case "$OUT49" in
  *"MOTIF: tours-epuises"*) ko "elle brûle 50 tours au lieu de conclure" ;;
  *) ok "elle conclut sans brûler toute sa veille" ;;
esac

# ⚠️ ET LA BORNE DE CE CHEMIN-CI VAUT EXACTEMENT CE NOMBRE-LÀ, comme celle du
#    chemin `done` (scénario 48d). Les deux gardes portent le même compteur mais
#    passent par DEUX comparaisons distinctes dans le fichier : épingler l'une
#    ne dit rien de l'autre. Mesuré par mutation — `-ge` → `-gt` sur la seule
#    comparaison du chemin idle SURVIVAIT à toute la suite.
N49=$(printf '%s\n' "$OUT49" | grep -c "au repos, mais son BUT est encore actif")
[ "$N49" -eq 3 ] && ok "elle conclut au relevé EXACT où la borne est posée (3 relevés, obtenu $N49)" \
  || ko "borne décalée sur le chemin idle : attendu 3 relevés avant de conclure, obtenu $N49"
case "$OUT49" in
  *"(3/3)"*) ok "le dernier relevé annoncé est bien le 3ᵉ sur 3" ;;
  *) ko "le compte annoncé ne finit pas sur (3/3) : $OUT49" ;;
esac

echo "→ 49b. LA CONTRE-ÉPREUVE : le MÊME repos SANS but actif reste « repos-prolonge »"
# ⚠️ C'est l'assertion qui mesure ce que le correctif a PRIS. Sans elle, faire
#    porter `but-inacheve` à TOUT repos passerait le scénario 49 — et le motif
#    `repos-prolonge` deviendrait inatteignable, c'est-à-dire que les deux faits
#    redeviendraient un seul, ce que ce lot cherche précisément à éviter.
cat > "$SCREEN_FILE" <<'ECRAN49B'
  ⎿  Login successful

────────────────────────────────────────────────────────────────────
❯
────────────────────────────────────────────────────────────────────
  ⏵⏵ auto mode on (shift+tab to cycle)
ECRAN49B
printf 'working\nidle\n' > "$SEQ_FILE"; rm -f "${SEQ_FILE}.idx"
OUT49B="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
          FAKE_HERDR_STATUS_SEQ_FILE="$SEQ_FILE" FAKE_HERDR_WITNESS="$WITNESS" \
          VD_REGISTRE_DIR="${WORK}/registre-49b" VD_REPOS_TOURS=3 VD_BUT_TOURS=3 \
          VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 VD_SLEEP_POSE=0 \
          bash "$VEILLE" test-pane test-agent 50 --dry-run 2>&1)"
RC49B=$?
case "$OUT49B" in
  *"MOTIF: repos-prolonge"*) ok "une immobilité ORDINAIRE garde son motif — les deux faits restent distincts" ;;
  *"MOTIF: but-inacheve"*) ko "LE CORRECTIF A TROP PRIS : tout repos devient un « mandat ouvert », repos-prolonge est inatteignable : $OUT49B" ;;
  *) ko "motif inattendu sur un repos ordinaire : $OUT49B" ;;
esac
[ "$RC49B" -eq 12 ] && ok "et son code reste 12, distinct de 13 (rc=$RC49B)" \
  || ko "code attendu 12 sur un repos ordinaire, obtenu $RC49B"

echo "→ 49c. Le but qui DISPARAÎT en cours de repos rebascule vers « repos-prolonge »"
# ⚠️ La symétrie complète : si la marque s'en va (l'agent a clos son but), on
#    n'est plus devant un mandat ouvert. Sans ce reset, un agent qui a rangé son
#    but resterait éternellement compté comme « inachevé » et ne recevrait
#    jamais le motif qui décrit sa vraie situation.
ECRAN_BUT_ON="${WORK}/49-but-actif.txt"
ECRAN_BUT_OFF="${WORK}/49-but-clos.txt"
SEQ_ECRAN="${WORK}/49-seq-ecrans.txt"
cat > "$ECRAN_BUT_ON" <<'ECRAN49CA'
  ⎿  Login successful

                                               ◎ /goal active (2h)
ECRAN49CA
cat > "$ECRAN_BUT_OFF" <<'ECRAN49CB'
  ⎿  Login successful

  ⏺ But atteint, rapport rendu.
ECRAN49CB
# 2 relevés d'écran par tour idle (travail_en_vol, puis but_actif) : la marque
# est là aux tours 2-3, puis disparaît pour de bon.
printf '%s\n%s\n%s\n%s\n%s\n' "$ECRAN_BUT_ON" "$ECRAN_BUT_ON" "$ECRAN_BUT_ON" "$ECRAN_BUT_ON" "$ECRAN_BUT_OFF" > "$SEQ_ECRAN"
printf 'working\nidle\n' > "$SEQ_FILE"; rm -f "${SEQ_FILE}.idx" "${SEQ_ECRAN}.ridx"
# VD_BUT_TOURS=99 : si le compteur du mandat n'était PAS remis à zéro, elle
# n'atteindrait jamais sa borne. Le seul chemin vers `repos-prolonge` passe par
# le reset ET par le retour au comptage de repos ordinaire.
OUT49C="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_SCREEN_FILE="$ECRAN_BUT_ON" \
          FAKE_HERDR_SCREEN_SEQ_FILE="$SEQ_ECRAN" \
          FAKE_HERDR_STATUS_SEQ_FILE="$SEQ_FILE" FAKE_HERDR_WITNESS="$WITNESS" \
          VD_REGISTRE_DIR="${WORK}/registre-49c" VD_REPOS_TOURS=3 VD_BUT_TOURS=99 \
          VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 VD_SLEEP_POSE=0 \
          bash "$VEILLE" test-pane test-agent 12 --dry-run 2>&1)"
RC49C=$?
case "$OUT49C" in
  *"MOTIF: repos-prolonge"*) ok "la disparition de la marque rebascule vers l'immobilité ordinaire" ;;
  *"MOTIF: but-inacheve"*) ko "le but a disparu de l'écran et elle le compte encore comme inachevé : $OUT49C" ;;
  *) ko "motif inattendu après disparition de la marque : $OUT49C" ;;
esac
[ "$RC49C" -eq 12 ] && ok "et son code redevient 12 (rc=$RC49C)" || ko "code attendu 12, obtenu $RC49C"

echo "→ 49e. Une marque qui S'INTERROMPT puis revient REPART DE ZÉRO"
# ⚠️ C'EST LE SEUL SCÉNARIO QUI ÉPROUVE LE RESET LUI-MÊME. Le 49c ne le
#    discriminait pas : avec ou sans reset, il finissait pareil (mesuré par
#    mutation — « BUT_INACHEVE=0 » supprimé du repos ordinaire SURVIVAIT). Ce
#    qui distingue les deux est le MOMENT de la conclusion : sans reset, deux
#    passages de la marque séparés par une accalmie s'ADDITIONNENT, et la veille
#    lâche l'agent une accalmie trop tôt.
#    On l'éprouve en comptant les « (1/3) » : le compteur doit repartir de 1
#    APRÈS l'accalmie, donc l'annoncer DEUX fois.
printf '%s\n%s\n%s\n%s\n%s\n%s\n%s\n' \
  "$ECRAN_BUT_ON" "$ECRAN_BUT_ON" "$ECRAN_BUT_ON" "$ECRAN_BUT_ON" \
  "$ECRAN_BUT_OFF" "$ECRAN_BUT_OFF" "$ECRAN_BUT_ON" > "$SEQ_ECRAN"
printf 'working\nidle\n' > "$SEQ_FILE"; rm -f "${SEQ_FILE}.idx" "${SEQ_ECRAN}.ridx"
# VD_REPOS_TOURS=99 : le repos ordinaire ne doit jamais conclure ici, sinon on
# mesurerait l'autre borne en croyant mesurer celle-ci.
OUT49E="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_SCREEN_FILE="$ECRAN_BUT_ON" \
          FAKE_HERDR_SCREEN_SEQ_FILE="$SEQ_ECRAN" \
          FAKE_HERDR_STATUS_SEQ_FILE="$SEQ_FILE" FAKE_HERDR_WITNESS="$WITNESS" \
          VD_REGISTRE_DIR="${WORK}/registre-49e" VD_REPOS_TOURS=99 VD_BUT_TOURS=3 \
          VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 VD_SLEEP_POSE=0 \
          bash "$VEILLE" test-pane test-agent 12 --dry-run 2>&1)"
N49E=$(printf '%s\n' "$OUT49E" | grep -c "son BUT est encore actif à l'écran (1/3)")
[ "$N49E" -eq 2 ] && ok "le compteur du mandat repart de 1 après l'accalmie (« (1/3) » annoncé $N49E fois)" \
  || ko "le compteur ADDITIONNE deux passages séparés de la marque : « (1/3) » vu $N49E fois au lieu de 2 — elle lâchera l'agent une accalmie trop tôt"
case "$OUT49E" in
  *"MOTIF: but-inacheve"*) ok "et elle finit tout de même par nommer le mandat resté ouvert" ;;
  *) ko "elle ne conclut jamais sur le mandat ouvert : $OUT49E" ;;
esac

echo "→ 49f. Un repos INTERROMPU par une phase de mandat actif ne s'additionne pas"
# ⚠️ SYMÉTRIQUE DU 49e, ET MÊME PRINCIPE QUE LE SCÉNARIO 31 : « 180 relevés de
#    repos CONTINU » doit vouloir dire continu. Sans le reset du repos, deux
#    plages d'immobilité SÉPARÉES par une phase où le but était actif
#    s'additionnent — et le motif `repos-prolonge` affirme alors une continuité
#    qui n'a pas eu lieu. Mesuré par mutation : « REPOS=0 » supprimé du chemin
#    du mandat SURVIVAIT à toute la suite.
#    Ici : 2 relevés de repos, une phase de mandat actif, puis 2 relevés de
#    repos. Avec le reset, la borne de 3 n'est pas atteinte en 6 tours ; sans
#    lui, elle l'est au 5ᵉ et la veille lâche l'agent.
printf '%s\n%s\n%s\n%s\n%s\n%s\n%s\n' \
  "$ECRAN_BUT_OFF" "$ECRAN_BUT_OFF" "$ECRAN_BUT_OFF" "$ECRAN_BUT_OFF" \
  "$ECRAN_BUT_ON" "$ECRAN_BUT_ON" "$ECRAN_BUT_OFF" > "$SEQ_ECRAN"
printf 'working\nidle\n' > "$SEQ_FILE"; rm -f "${SEQ_FILE}.idx" "${SEQ_ECRAN}.ridx"
OUT49F="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_SCREEN_FILE="$ECRAN_BUT_OFF" \
          FAKE_HERDR_SCREEN_SEQ_FILE="$SEQ_ECRAN" \
          FAKE_HERDR_STATUS_SEQ_FILE="$SEQ_FILE" FAKE_HERDR_WITNESS="$WITNESS" \
          VD_REGISTRE_DIR="${WORK}/registre-49f" VD_REPOS_TOURS=3 VD_BUT_TOURS=99 \
          VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 VD_SLEEP_POSE=0 \
          bash "$VEILLE" test-pane test-agent 6 --dry-run 2>&1)"
# La phase de mandat actif a bien eu lieu — sans cette assertion, le scénario
# passerait aussi si la séquence d'écrans ne marchait pas du tout.
case "$OUT49F" in
  *"au repos, mais son BUT est encore actif"*) ok "la phase de mandat actif a bien été vue (le scénario n'est pas creux)" ;;
  *) ko "la phase de mandat actif n'a jamais été observée — ce scénario ne mesure rien : $OUT49F" ;;
esac
case "$OUT49F" in
  *"MOTIF: repos-prolonge"*) ko "elle ADDITIONNE deux plages de repos séparées par une phase de mandat actif — « repos continu » est alors un mensonge : $OUT49F" ;;
  *) ok "une plage de repos interrompue par un mandat actif repart de zéro" ;;
esac

echo "→ 49d. Un agent au repos avec un but actif ET du travail en vol n'est jamais lâché"
# ⚠️ L'ordre des deux sondes compte : `travail_en_vol` prime. Un sous-agent qui
#    tourne suffit à ne rien conclure du tout — ni repos, ni mandat ouvert.
cat > "$SCREEN_FILE" <<'ECRAN49D'
  Analyse en cours

  · 2 shells · /tasks to see subagents
                                               ◎ /goal active (2h)
ECRAN49D
printf 'working\nidle\n' > "$SEQ_FILE"; rm -f "${SEQ_FILE}.idx"
OUT49D="$(PATH="${BINDIR}:${PATH}" FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
          FAKE_HERDR_STATUS_SEQ_FILE="$SEQ_FILE" FAKE_HERDR_WITNESS="$WITNESS" \
          VD_REGISTRE_DIR="${WORK}/registre-49d" VD_REPOS_TOURS=3 VD_BUT_TOURS=3 \
          VD_SLEEP=0 VD_SLEEP_CONFIRM=0 VD_SLEEP_APRES_DEBLOCAGE=0 VD_SLEEP_POSE=0 \
          bash "$VEILLE" test-pane test-agent 12 --dry-run 2>&1)"
case "$OUT49D" in
  *"MOTIF: repos-prolonge"*) ko "elle abandonne un agent qui a du travail en vol : $OUT49D" ;;
  *"MOTIF: but-inacheve"*) ko "elle abandonne un agent qui a du travail en vol : $OUT49D" ;;
  *) ok "le travail en vol prime : elle ne conclut rien du tout" ;;
esac

# ── Bilan ────────────────────────────────────────────────────────────────────
P=$(wc -l < "$PASS_FILE"); F=$(wc -l < "$FAIL_FILE")
echo; echo "== Bilan : ${P// /} réussis, ${F// /} échoués =="
[ "${F// /}" -eq 0 ] || exit 1
