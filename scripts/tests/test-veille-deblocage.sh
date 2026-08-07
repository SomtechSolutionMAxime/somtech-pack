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

# ── Bilan ────────────────────────────────────────────────────────────────────
P=$(wc -l < "$PASS_FILE"); F=$(wc -l < "$FAIL_FILE")
echo; echo "== Bilan : ${P// /} réussis, ${F// /} échoués =="
[ "${F// /}" -eq 0 ] || exit 1
