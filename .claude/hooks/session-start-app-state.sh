#!/usr/bin/env bash
# session-start-app-state.sh
# Hook SessionStart — lit la mémoire externe d'état d'app (STD-027) et l'injecte
# dans additionalContext de la session Claude Code courante.
#
# Convention : STD-027 (Architecture/standards/STD-027-memoire-externe-etat-app.md)
# Source de vérité : doc Somcraft /operations/<app-slug>/etat-app.md (workspace CLIENT)
# Cache local    : .somtech/app-state.md (gitignored)
# Mapping        : .somtech/app.yaml (versionné, créé par /lier-app)
#
# Comportement :
# - Si .somtech/app.yaml absent → no-op silencieux (exit 0)
# - Si .somtech/app-state.md absent → output un additionalContext indiquant /sync-app-state
# - Si .somtech/app-state.md > 7 jours → nudge demandant /sync-app-state
# - Sinon → output le contenu en additionalContext via tag <app-state-memory>
# - Plafond : ~1500 tokens (≈6000 chars). Si dépassement, tronquer la section
#   "Dernière session" en premier, puis "Pièges" si encore trop long.
# - Erreurs → no-op silencieux. Ne JAMAIS bloquer le démarrage de Claude Code.

set -uo pipefail
# pas de -e : on veut continuer en cas de petit problème (file system, etc.)

APP_YAML=".somtech/app.yaml"
CACHE_FILE=".somtech/app-state.md"
MAX_CHARS=6000
STALE_DAYS=7

# 1. Sortie silencieuse si pas lié
if [ ! -f "$APP_YAML" ]; then
  exit 0
fi

# 2. Si le cache n'existe pas, demander à Claude de le synchroniser
if [ ! -f "$CACHE_FILE" ]; then
  cat <<EOF
<app-state-memory>
🔗 App liée à Somtech (STD-027) mais le cache local .somtech/app-state.md est manquant.

Exécute le skill /sync-app-state pour récupérer l'état courant depuis Somcraft.

Mapping (.somtech/app.yaml) :
$(cat "$APP_YAML" 2>/dev/null | sed 's/^/  /')
</app-state-memory>
EOF
  exit 0
fi

# 3. Vérifier la fraîcheur du cache (mtime portable Linux/macOS)
NOW=$(date +%s)
if MTIME=$(stat -f %m "$CACHE_FILE" 2>/dev/null); then
  : # macOS
else
  MTIME=$(stat -c %Y "$CACHE_FILE" 2>/dev/null) || MTIME=$NOW
fi
CACHE_AGE_DAYS=$(( (NOW - MTIME) / 86400 ))

NUDGE=""
if [ "$CACHE_AGE_DAYS" -gt "$STALE_DAYS" ]; then
  NUDGE="
<system-note>
⚠️ Le cache .somtech/app-state.md a $CACHE_AGE_DAYS jours (seuil: $STALE_DAYS).
Exécute /sync-app-state pour rafraîchir depuis Somcraft, ou /end-session si tu sais que la session courante a apporté du changement opérationnel.
</system-note>
"
fi

# 4. Lire le cache
CONTENT=$(cat "$CACHE_FILE" 2>/dev/null) || CONTENT=""
CONTENT_LEN=${#CONTENT}

# 5. Plafond — tronquer si dépassement
# Stratégie : retirer "## Dernière session" en premier, puis "## Pièges & avertissements" si encore trop long.
if [ "$CONTENT_LEN" -gt "$MAX_CHARS" ]; then
  CONTENT=$(printf '%s' "$CONTENT" | awk '
    BEGIN { skip = 0 }
    /^## Dernière session/ { skip = 1; next }
    /^## Pièges/         { skip = 0 }
    /^## /                { skip = 0 }
    skip == 0 { print }
  ')
  CONTENT_LEN=${#CONTENT}

  if [ "$CONTENT_LEN" -gt "$MAX_CHARS" ]; then
    CONTENT=$(printf '%s' "$CONTENT" | awk '
      BEGIN { skip = 0 }
      /^## Pièges/ { skip = 1; next }
      /^## /        { skip = 0 }
      skip == 0 { print }
    ')
  fi

  NUDGE="$NUDGE
<system-note>
ℹ️ Sections 'Dernière session' et/ou 'Pièges' tronquées (cache > $MAX_CHARS chars). Consulte le doc Somcraft complet si besoin.
</system-note>
"
fi

# 6. Output dans additionalContext
cat <<EOF
<app-state-memory>
État opérationnel courant de l'app — lu depuis cache local .somtech/app-state.md
(source : Somcraft /operations/<app-slug>/etat-app.md dans le workspace CLIENT, convention STD-027).

À respecter : pièges, contraintes en cours, état des envs. Mettre à jour via /end-session en fin de session.

---

$CONTENT
$NUDGE
</app-state-memory>
EOF

exit 0
