#!/usr/bin/env bash
# ============================================================
# session-start-preflight-std029.sh — v1.0.0
# Hook SessionStart — joue les checks MUST de STD-029 (préflight de session,
# Somcraft 8dfa4686-d3c6-4412-9490-99ecac496499) À LA NAISSANCE d'une session,
# et rend un verdict lisible par check. T-20260922-0093 (garde 3/5, lot 4,
# D-20260921-0017).
#
# CIBLE : la naissance d'un chef d'équipe (worktree neuf, branche-socle) —
# c'est là qu'aucun des quatre checks MUST n'était joué avant ce hook.
#
# CE QU'IL FAIT : joue et rapporte. HORS-SCOPE (explicite, ticket) : rendre les
# checks bloquants — bloquer est un arbitrage du dirigeant, pas une décision de
# mise en œuvre. Ce hook sort TOUJOURS en 0, même quand un check rend ECHEC ou
# BLOQUANT — ces mots sont des VERDICTS dans le rapport, jamais un exit code.
#
# LA CONTRAINTE QUI FAIT CE LOT : distinguer la SONDE CASSÉE du CHECK QUI PASSE.
# Un `[non mesuré]` (git indisponible, commande de mesure en échec) est un
# verdict DISTINCT d'un `OK` — mesure du 2026-08-19 : sur quatre gardes
# défaillantes, trois étaient testées, et leurs tests couvraient seulement
# « il n'y a rien à signaler », jamais « la sonde est aveugle ». Les deux
# rendent la même valeur si on ne les distingue pas.
#
# Checks 1/2/5 dépendent de `git` : un seul gate (GIT_OK) les fait tous
# basculer en [non mesuré] ensemble si `git` est indisponible ou hors dépôt.
# Checks 3/4 sont des existences fichier/dossier : jamais un échec, seulement
# OK/[non applicable] (c'est ce que STD-029 §2.4-2.5 et le G/W/T du ticket
# prescrivent explicitement pour ces deux-là).
#
# Sortie : stdout, tagué <preflight-std029>, pour devenir du contexte agent
# (même convention que session-start-app-state.sh). Toujours produit, même
# quand tout est OK — c'est la preuve que le hook a joué.
# ============================================================
set -uo pipefail

FRESHNESS_THRESHOLD_DAYS=3

# ---- gate git : un seul sondage, réutilisé par les checks 1/2/5 ----
GIT_OK=1
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  GIT_OK=0
fi

now_epoch() {
  date +%s
}

# ---- Check 1 — Branche courante ----
check_branche() {
  if [ "$GIT_OK" -eq 0 ]; then
    echo "[non mesuré] — sonde git indisponible (binaire absent, ou hors dépôt git)"
    return
  fi
  local branch
  branch="$(git branch --show-current 2>/dev/null)"
  if [ $? -ne 0 ]; then
    echo "[non mesuré] — \`git branch --show-current\` a échoué"
    return
  fi
  if [ -z "$branch" ]; then
    echo "[non mesuré] — HEAD détaché, impossible de déterminer la branche"
    return
  fi
  case "$branch" in
    main|staging)
      echo "ECHEC — branche \`${branch}\` réservée à l'intégration (main/staging), jamais au développement direct. Créer une branche dédiée : git checkout -b feat/<description>"
      ;;
    *)
      echo "OK — \`${branch}\`"
      ;;
  esac
}

# ---- Check 2 — Fraîcheur de la branche ----
check_fraicheur() {
  if [ "$GIT_OK" -eq 0 ]; then
    echo "[non mesuré] — sonde git indisponible"
    return
  fi
  local out rc epoch
  # Une SEULE invocation de git, stdout+stderr capturés ensemble : la
  # désambiguïsation « dépôt vide » vs « sonde cassée » se fait sur le message
  # de CET appel, jamais par un second appel git — un second appel échouerait
  # lui aussi si la sonde est cassée, et retomberait à tort sur [non applicable]
  # (bug trouvé par mutation : neutraliser le gate GIT_OK ne faisait alors
  # plus rougir ce check, alors que la sonde était bel et bien coupée).
  out="$(git log -1 --format=%ct HEAD 2>&1)"
  rc=$?
  if [ $rc -ne 0 ]; then
    case "$out" in
      *"does not have any commits yet"*|*"bad default revision"*|*"unknown revision"*)
        echo "[non applicable] — aucun commit dans ce dépôt"
        ;;
      *)
        echo "[non mesuré] — \`git log\` a échoué : ${out:0:120}"
        ;;
    esac
    return
  fi
  epoch="$out"
  if [ -z "$epoch" ]; then
    echo "[non mesuré] — sortie vide de \`git log -1 --format=%ct HEAD\`"
    return
  fi
  local age_days=$(( ( $(now_epoch) - epoch ) / 86400 ))
  if [ "$age_days" -gt "$FRESHNESS_THRESHOLD_DAYS" ]; then
    echo "ECHEC — fraîcheur : dernier commit vieux de ${age_days}j (seuil ${FRESHNESS_THRESHOLD_DAYS}j). Rebase sur main (git fetch origin && git rebase origin/main) ou nouvelle branche si le travail est périmé."
  else
    echo "OK — dernier commit vieux de ${age_days}j"
  fi
}

# ---- Check 3 — CLAUDE.md du projet ----
check_claude_md() {
  if [ ! -e "CLAUDE.md" ]; then
    echo "[non applicable] — pas de CLAUDE.md à la racine de ce dépôt"
    return
  fi
  if [ ! -r "CLAUDE.md" ]; then
    echo "[non mesuré] — CLAUDE.md présent mais illisible (permissions)"
    return
  fi
  echo "OK — CLAUDE.md présent à la racine (autoloadé par Claude Code ; ce check vérifie sa présence, pas sa lecture effective — cf. STD-029 §2.5 note)"
}

# ---- Check 4 — Ontologie pour les entités touchées ----
check_ontologie() {
  if [ ! -d "ontologie" ]; then
    echo "[non applicable] — pas de /ontologie/ dans ce dépôt"
    return
  fi
  echo "s'applique — /ontologie/ présent. Lire les entités touchées avant de coder (règle d'or n°1) ; ce hook ne vérifie pas le drift ontologie-vs-code, hors-scope."
}

# ---- Check 5 — Drift schéma prod/staging, conditionnel (STD-029 §2.7) ----
resolve_base_ref() {
  local current="$1" ref
  for ref in origin/main origin/staging main staging; do
    if git rev-parse --verify -q "$ref" >/dev/null 2>&1 && [ "$ref" != "$current" ]; then
      echo "$ref"
      return
    fi
  done
  echo ""
}

check_drift_schema() {
  if [ "$GIT_OK" -eq 0 ]; then
    echo "[non mesuré] — sonde git indisponible, impossible de détecter une migration planifiée"
    return
  fi
  if [ ! -d "supabase/migrations" ]; then
    echo "ne s'exécute pas — pas de supabase/migrations dans ce dépôt (rien à comparer)"
    return
  fi

  # Ce check ne se contente PAS du gate GIT_OK partagé (revue de fond,
  # T-20260922-0093 : le gate ne sonde que `rev-parse --is-inside-work-tree` —
  # un git présent mais brisé pour `diff`/`status` spécifiquement (index
  # corrompu, permissions, etc.) passerait le gate et retomberait ici sur
  # « ne s'exécute pas », un verdict qui se lit comme un OK implicite alors
  # qu'une migration existe peut-être bel et bien. Chaque appel de MESURE
  # (diff, status) vérifie donc son PROPRE $?, comme les checks 1 et 2.
  local current base new_committed uncommitted status_out signal="" probe_failed=0
  current="$(git branch --show-current 2>/dev/null)" || probe_failed=1
  base="$(resolve_base_ref "$current")"

  if [ -n "$base" ]; then
    new_committed="$(git diff --name-only --diff-filter=A "${base}...HEAD" -- supabase/migrations 2>/dev/null)"
    [ $? -ne 0 ] && probe_failed=1
    [ -n "$new_committed" ] && signal="$new_committed"
  fi

  status_out="$(git status --porcelain -- supabase/migrations 2>/dev/null)"
  if [ $? -ne 0 ]; then
    probe_failed=1
  else
    uncommitted="$(printf '%s\n' "$status_out" | awk '{print $2}')"
  fi

  if [ "$probe_failed" -eq 1 ]; then
    echo "[non mesuré] — un appel git (branche/diff/status) a échoué pendant la détection de migration ; supabase/migrations existe mais le hook ne peut pas conclure"
    return
  fi

  if [ -n "$uncommitted" ]; then
    if [ -n "$signal" ]; then
      signal="${signal}
${uncommitted}"
    else
      signal="$uncommitted"
    fi
  fi

  if [ -n "$signal" ]; then
    local files
    files="$(printf '%s\n' "$signal" | sort -u | tr '\n' ' ')"
    echo "BLOQUANT — migration détectée sur cette branche (${files}). STD-029 §2.7 : comparer le schéma staging ET prod (\\d <table> via MCP Supabase) AVANT d'écrire/pousser la migration. Ce hook ne peut PAS exécuter ce comparatif (accès MCP hors de portée d'un hook bash) — à faire par l'agent."
  else
    echo "ne s'exécute pas — aucune migration détectée sur cette branche"
  fi
}

# ---- Assemblage du rapport ----
V1="$(check_branche)"
V2="$(check_fraicheur)"
V3="$(check_claude_md)"
V4="$(check_ontologie)"
V5="$(check_drift_schema)"

cat <<EOF
<preflight-std029>
STD-029 — préflight de session (checks MUST, joué à la naissance — T-20260922-0093)
Ce hook joue et rapporte ; il ne bloque rien (hors-scope). Un [non mesuré] est
DISTINCT d'un OK : la sonde elle-même n'a pas pu répondre, ce n'est pas un feu vert.

1. Branche          : ${V1}
2. Fraîcheur        : ${V2}
3. CLAUDE.md projet  : ${V3}
4. Ontologie         : ${V4}
5. Drift schéma (conditionnel, STD-029 §2.7) : ${V5}
</preflight-std029>
EOF

exit 0
