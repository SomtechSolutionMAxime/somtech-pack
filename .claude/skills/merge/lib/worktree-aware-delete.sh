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
# ============================================================

# Echoe le chemin du worktree attaché à <branch>, vide si aucun.
mwt_branch_worktree() {
  local branch="$1"
  git worktree list --porcelain 2>/dev/null | awk -v b="refs/heads/${branch}" '
    /^worktree /  { wt = $2 }
    /^branch /    { if ($2 == b) { print wt; exit } }
  '
}

# Echoe le chemin du worktree PRINCIPAL (premier de la liste).
mwt_primary_worktree() {
  git worktree list --porcelain 2>/dev/null | awk '/^worktree /{ print $2; exit }'
}

# Echoe l'identifiant de teardown claude-swt (basename du worktree = timestamp).
mwt_timestamp() {
  basename "$1"
}

# Vrai (0) si la session courante tourne dans un worktree LIÉ (pas le principal).
mwt_in_linked_worktree() {
  local gd cd
  gd="$(git rev-parse --git-dir 2>/dev/null)"
  cd="$(git rev-parse --git-common-dir 2>/dev/null)"
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
