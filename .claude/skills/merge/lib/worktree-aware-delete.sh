#!/usr/bin/env bash
# ============================================================
# worktree-aware-delete.sh — v1.0.0
# Plan de suppression de branche worktree-aware pour /merge.
#
# Problème : une branche git ne peut pas être supprimée tant qu'un worktree
# y est attaché. Avec le workflow `claude-swt` (1 session = 1 worktree lié),
# `gh pr merge --delete-branch` échoue (il tente aussi de basculer sur `main`,
# possiblement détenu par un autre worktree).
#
# Ce helper décide, pour la branche cible d'un /merge, comment traiter sa
# suppression — sans jamais supprimer quoi que ce soit lui-même (pur calcul,
# testable). Le skill applique le plan.
#
# Conçu pour être SOURCÉ (fonctions à code retour, ne tue pas le shell).
#
# Codes/plans renvoyés par mwt_plan_delete sur stdout :
#   PROTECTED            branche `staging` — ne JAMAIS supprimer
#   DELETE               aucun worktree lié attaché — `--delete-branch` classique OK
#   DEFER <path> <ts>    branche attachée à un worktree LIÉ (claude-swt) :
#                        différer la suppression locale ; teardown via
#                        `claude-swt-done <ts>` après fermeture de session.
#                        Note : <ts> = basename(path). La ligne DEFER suppose un
#                        <path> sans espace (convention claude-swt :
#                        ~/worktrees/<repo>/<YYYYMMDD-HHMMSS>). Le <ts> reste
#                        le champ fiable (toujours le dernier).
# ============================================================

# Echoe le chemin du worktree attaché à <branch>, vide si aucun.
# substr() (et pas $2) pour préserver un chemin contenant des espaces.
mwt_branch_worktree() {
  local branch="$1"
  git worktree list --porcelain 2>/dev/null | awk -v b="refs/heads/${branch}" '
    /^worktree /  { wt = substr($0, 10) }
    /^branch /    { if (substr($0, 8) == b) { print wt; exit } }
  '
}

# Echoe le chemin du worktree PRINCIPAL (premier de la liste).
mwt_primary_worktree() {
  git worktree list --porcelain 2>/dev/null | awk '/^worktree /{ print substr($0, 10); exit }'
}

# Echoe l'identifiant de teardown claude-swt (basename du worktree = timestamp).
mwt_timestamp() {
  basename "$1"
}

# Vrai (0) si la session courante tourne dans un worktree LIÉ (pas le principal).
# IMPORTANT : comparer des chemins ABSOLUS canoniques. `--git-dir` peut être
# relatif/absolu selon le cwd (absolu depuis un sous-dossier du principal,
# relatif depuis la racine), et `--git-common-dir` est souvent relatif — une
# comparaison de chaînes brute donne un faux positif depuis un sous-répertoire.
mwt_in_linked_worktree() {
  local gd cd
  gd="$(git rev-parse --absolute-git-dir 2>/dev/null)" || return 1
  gd="$(cd "$gd" 2>/dev/null && pwd -P)" || return 1
  cd="$(cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd -P)" || return 1
  [ -n "$gd" ] && [ "$gd" != "$cd" ]
}

# Décide le plan de suppression pour la branche cible (mergée).
mwt_plan_delete() {
  local branch="$1"

  # Garde-fou : staging n'est jamais supprimée (règle de sécurité /merge).
  if [ "$branch" = "staging" ]; then
    echo "PROTECTED"
    return 0
  fi

  local wt primary
  wt="$(mwt_branch_worktree "$branch")"

  # Aucune worktree n'a cette branche en checkout → suppression classique OK.
  if [ -z "$wt" ]; then
    echo "DELETE"
    return 0
  fi

  primary="$(mwt_primary_worktree)"

  # Checkout dans le worktree PRINCIPAL → `gh --delete-branch` bascule sur main
  # et supprime : flux classique, pas de blocage worktree.
  if [ "$wt" = "$primary" ]; then
    echo "DELETE"
    return 0
  fi

  # Checkout dans un worktree LIÉ (session claude-swt) → différer.
  echo "DEFER ${wt} $(mwt_timestamp "$wt")"
  return 0
}
