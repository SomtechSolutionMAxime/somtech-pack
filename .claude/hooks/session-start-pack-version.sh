#!/usr/bin/env bash
# session-start-pack-version.sh
# Hook SessionStart — avertit (non-bloquant) si la version du somtech-pack installée
# dans le projet n'est pas la dernière publiée.
#
# Depuis T-20260715-0002, la DÉTECTION vit dans la lib partagée
# `scripts/shell/pack-freshness.sh` (fonctions pf_*), consommée AUSSI par le launcher
# claude-swt (D-20260715-0001) — zéro duplication de la logique semver/cache/réseau.
# Ce hook ne fait plus que : sourcer la lib (fail-silent si absente) + formater le nudge.
#
# Sûreté absolue : ne JAMAIS ralentir ni bloquer le démarrage de Claude Code, aucun
# bruit (stdout/stderr) hors le nudge volontaire. Skip silencieux si pas de marqueur,
# pas de cache, à jour, ou lib introuvable.
#
# Sourçable (les fonctions sont exposées sans lancer le main) pour les tests.

set -uo pipefail

PKG="@somtech-solutions/pack"

# Résoudre le dossier du hook (compatible sourcing) pour trouver la lib partagée.
# Le module `core` installe .claude/ ET scripts/ → la lib est à ../../scripts/shell/.
if [ -n "${BASH_SOURCE:-}" ]; then _spv_self="${BASH_SOURCE[0]}"; else _spv_self="$0"; fi
_spv_dir="$(cd "$(dirname "$_spv_self")" 2>/dev/null && pwd)"
_spv_lib="${_spv_dir}/../../scripts/shell/pack-freshness.sh"
# shellcheck source=/dev/null
[ -r "$_spv_lib" ] && . "$_spv_lib"
unset _spv_self _spv_dir _spv_lib

# --- Programme principal (ignoré si le fichier est SOURCÉ, p.ex. par les tests) ---
spv_main() {
  command -v pf_check >/dev/null 2>&1 || return 0   # lib absente → silence total
  local res installed latest
  res="$(pf_check "$PWD")" || return 0              # pas en retard / rien à comparer → silence
  installed="${res%% *}"; latest="${res##* }"
  cat <<EOF
<somtech-pack-update>
⚠️ somtech-pack : version **${installed}** installée dans ce projet, **${latest}** disponible.
Propose à l'utilisateur de mettre à jour (non-bloquant) :
   npx ${PKG}@latest update --dry-run   # aperçu, ne touche à rien
   npx ${PKG}@latest update             # appliquer (settings.json projet préservé)
</somtech-pack-update>
EOF
  return 0
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  spv_main
  exit 0
fi
