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
      printf '{"result":{"agent":{"agent_status":"%s"}}}' "$status"
      exit 0
    fi
    ;;
  pane)
    case "${2:-}" in
      read)
        if [ -n "${FAKE_HERDR_SCREEN_FILE:-}" ] && [ -f "${FAKE_HERDR_SCREEN_FILE:-}" ]; then
          cat "$FAKE_HERDR_SCREEN_FILE"
        fi
        exit 0
        ;;
      send-keys) exit 0 ;;
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
  OUT="$(PATH="${BINDIR}:${PATH}" \
         FAKE_HERDR_STATUS="${FAKE_HERDR_STATUS:-blocked}" \
         FAKE_HERDR_SCREEN_FILE="$SCREEN_FILE" \
         FAKE_HERDR_STATUS_SEQ_FILE="$SEQ_FILE" \
         FAKE_HERDR_WITNESS="$WITNESS" \
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
# 9. Un agent vu WORKING puis idle confirmé → elle s'arrête. Le correctif du
#    défaut ① ne supprime PAS la détection de fin : un agent réellement
#    terminé libère toujours sa veille.
# =================================================================
echo "→ 9. working puis idle confirmé → elle s'arrête (motif agent-termine)"
: > "$SCREEN_FILE"
printf 'working\nidle\nidle\n' > "$SEQ_FILE"
run 4

case "$OUT" in *"TERMINE"*) ok "un agent qui a travaillé puis fini libère sa veille" ;; *) ko "elle ne s'arrête pas sur un agent réellement terminé : $OUT" ;; esac
case "$OUT" in *"MOTIF: agent-termine"*) ok "motif « agent-termine » nommé" ;; *) ko "motif attendu « agent-termine », obtenu : $OUT" ;; esac
[ "$RC" -eq 0 ] && ok "code de sortie 0 pour un agent terminé (rc=$RC)" || ko "code de sortie attendu 0, obtenu $RC"

# =================================================================
# 10. BLOCKED arme la détection au même titre que WORKING : un agent bloqué
#     a forcément commencé à travailler.
# =================================================================
echo "→ 10. blocked (donc au travail) puis idle confirmé → elle s'arrête"
printf '%s\n' "$ECRAN_PERMISSION" > "$SCREEN_FILE"
printf 'blocked\nidle\nidle\n' > "$SEQ_FILE"
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
[ ! -s "$J23" ] && ok "aucun déblocage consigné (rien n'a été débloqué)" || ko "un déblocage a été consigné alors qu'aucun n'a eu lieu : $(cat "$J23")"

# ── Bilan ────────────────────────────────────────────────────────────────────
P=$(wc -l < "$PASS_FILE"); F=$(wc -l < "$FAIL_FILE")
echo; echo "== Bilan : ${P// /} réussis, ${F// /} échoués =="
[ "${F// /}" -eq 0 ] || exit 1
