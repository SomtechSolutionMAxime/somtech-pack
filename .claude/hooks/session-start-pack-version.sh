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

# Trouver la lib partagée pack-freshness.sh. Deux emplacements possibles (D-20260715-0005) :
#  1. install PROJET — le module `core` pose .claude/ ET scripts/ côte à côte → ../../scripts/shell ;
#  2. install POSTE  — `npx pack setup` copie la lib dans ~/.somtech (à côté de claude-swt.sh).
# Le hook GLOBAL (~/.claude/hooks) n'a pas de ../../scripts/shell → sans le fallback ~/.somtech
# il reste muet (bug D-20260715-0005). On essaie les deux, fail-silent.
if [ -n "${BASH_SOURCE:-}" ]; then _spv_self="${BASH_SOURCE[0]}"; else _spv_self="$0"; fi
_spv_dir="$(cd "$(dirname "$_spv_self")" 2>/dev/null && pwd)"
for _spv_lib in "${_spv_dir}/../../scripts/shell/pack-freshness.sh" "${HOME:-/tmp}/.somtech/pack-freshness.sh"; do
  # shellcheck source=/dev/null
  [ -r "$_spv_lib" ] && { . "$_spv_lib"; break; }
done
unset _spv_self _spv_dir _spv_lib

# --- Programme principal (ignoré si le fichier est SOURCÉ, p.ex. par les tests) ---
# Sortie : JSON `{"systemMessage": "..."}`. Sur SessionStart, `systemMessage` est le SEUL
# canal documenté qui affiche une BANNIÈRE VISIBLE à l'utilisateur (le stdout brut n'est
# que du contexte pour le modèle → invisible). Réf : Claude Code hooks (D-20260715-0006).
spv_main() {
  command -v pf_check >/dev/null 2>&1 || return 0   # lib absente → silence total
  local res installed latest msg
  res="$(pf_check "$PWD")" || return 0              # pas en retard / rien à comparer → silence
  installed="${res%% *}"; latest="${res##* }"
  # Message sur UNE ligne, sans " ni \ → JSON sûr sans échappement complexe.
  msg="⚠️ somtech-pack en retard : ${installed} → ${latest}. Les sessions claude-swt ouvrent une PR chore/pack-v${latest} — vérifie/merge : gh pr list --head chore/pack-v${latest} puis /merge. Sinon MAJ manuelle : npx ${PKG}@latest update"
  printf '{"systemMessage":"%s"}\n' "$msg"
  return 0
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  spv_main
  exit 0
fi
