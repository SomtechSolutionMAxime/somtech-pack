#!/usr/bin/env bash
# ============================================================
# close-merged-branches.sh — v1.2.0
# Ferme les branches déjà intégrées, laisse ouvertes celles avec du travail non
# mergé. Utilisé par /end-session. SÛRETÉ D'ABORD (l'outil supprime des branches).
#
# Deux niveaux de certitude :
#   • "contenu dans la base" (cmb_merged_into) : merger la branche dans la base ne
#     produit aucun changement → son contenu y est déjà.
#       git merge-tree --write-tree <base> <branche> == arbre de <base>
#     ATTENTION : vrai pour un squash-merge MAIS aussi pour une branche net-zéro
#     (add+revert) ou un sous-ensemble jamais mergé → faux positif possible.
#   • "merge corroboré" (cmb_confirmed) : preuve d'autorité que la branche a bien
#     été intégrée — vraie ancêtre git, OU PR mergée (gh), OU liste CMB_CONFIRMED.
#
# Décision :
#   MERGED   = contenu dans base ET corroboré → suppression local + distant OK
#              (le push --delete distant n'est tenté QUE si le branch -D local a réussi)
#   REVIEW   = contenu dans base MAIS non corroboré → suppression DISTANTE refusée
#              (faux positif possible : net-zéro/backup). Conservée + signalée.
#   WORKTREE = branche checked-out dans un AUTRE worktree vivant → jamais supprimée,
#              ni localement ni à distance (sinon décapite la session vivante). D-20260709-0009.
#   KEEP     = travail non mergé → conservée
#   CURRENT/PROTECTED = jamais supprimées (main/master/staging/develop/wt-*/courante)
#
# git ≥ 2.38 requis (--write-tree) ; sinon tout retombe en KEEP/REVIEW (conservateur).
# Sourçable (fonctions à code retour). Exécution directe = cmb_close.
#
# Env : CMB_BASE (def origin/main), CMB_REMOTE (def origin), CMB_DRY_RUN (def 0),
#       CMB_NO_REMOTE (1 = ne jamais toucher au distant), CMB_CONFIRMED (liste de
#       branches connues-mergées, séparées par espaces — override/tests/CI).
# ============================================================

# Vrai (0) si <branch> est entièrement contenue dans <base> (squash inclus).
cmb_merged_into() {
  local branch="$1" base="$2"
  git rev-parse --verify --quiet "$base" >/dev/null 2>&1 || return 1
  git rev-parse --verify --quiet "$branch" >/dev/null 2>&1 || return 1
  local mt bt
  mt="$(git merge-tree --write-tree "$base" "$branch" 2>/dev/null)" || return 1  # conflit ⇒ non mergée proprement
  bt="$(git rev-parse "${base}^{tree}" 2>/dev/null)" || return 1
  [ -n "$mt" ] && [ "$mt" = "$bt" ]
}

# Vrai (0) si l'intégration de <branch> dans <base> est CORROBORÉE (preuve d'autorité).
# Évite de supprimer (surtout à distance) une branche net-zéro / backup jamais mergée.
cmb_confirmed() {
  local branch="$1" base="$2"
  # 1. vraie ancêtre = vrai merge git (ff / --no-ff)
  git merge-base --is-ancestor "$branch" "$base" 2>/dev/null && return 0
  # 2. liste explicite (override manuel / tests / CI)
  case " ${CMB_CONFIRMED:-} " in *" ${branch} "*) return 0 ;; esac
  # 3. PR mergée pour cette branche (signal faisant autorité)
  if command -v gh >/dev/null 2>&1; then
    gh pr list --state merged --head "$branch" --json number -q '.[0].number' 2>/dev/null | grep -q '[0-9]' && return 0
  fi
  return 1
}

# Vrai (0) si la branche est protégée (jamais supprimée).
cmb_is_protected() {
  case "$1" in
    main|master|staging|develop) return 0 ;;
    wt/*) return 0 ;;
    *) return 1 ;;
  esac
}

# Liste (une par ligne) les branches actuellement checked-out dans un worktree — le
# worktree courant INCLUS. Une branche verrouillée par un worktree ne peut pas être
# supprimée localement par git ; la supprimer À DISTANCE décapite la session vivante
# (elle perd son upstream, sa PR se ferme). D-20260709-0009.
# NB : un worktree stale (répertoire supprimé sans `git worktree prune`) apparaît encore
# ici → sa branche reste conservée (faux négatif conservateur, jamais dangereux). Lancer
# `git worktree prune` en amont si l'on veut nettoyer ces branches.
cmb_worktree_branches() {
  git worktree list --porcelain 2>/dev/null \
    | sed -n 's#^branch refs/heads/##p'
}

# Classe chaque branche locale : "MERGED b" / "REVIEW b" / "KEEP b" / "WORKTREE b" / "CURRENT b" / "PROTECTED b".
cmb_classify() {
  local base="${1:-${CMB_BASE:-origin/main}}"
  local current b wt_list
  current="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
  # Set des branches attachées à un worktree (courant inclus). Espace-délimité pour un test O(1).
  wt_list=" $(cmb_worktree_branches | tr '\n' ' ') "
  while IFS= read -r b; do
    [ -z "$b" ] && continue
    if cmb_is_protected "$b"; then echo "PROTECTED $b"; continue; fi
    if [ -n "$current" ] && [ "$b" = "$current" ]; then echo "CURRENT $b"; continue; fi
    # Attachée à un AUTRE worktree (courant déjà écarté ci-dessus) → jamais supprimée, ici ou à distance.
    case "$wt_list" in *" $b "*) echo "WORKTREE $b"; continue ;; esac
    if cmb_merged_into "$b" "$base"; then
      if cmb_confirmed "$b" "$base"; then echo "MERGED $b"; else echo "REVIEW $b"; fi
    else
      echo "KEEP $b"
    fi
  done < <(git for-each-ref --format='%(refname:short)' refs/heads/)
}

# Supprime les branches MERGED (local + distant), conserve REVIEW/KEEP.
cmb_close() {
  local base="${1:-${CMB_BASE:-origin/main}}"
  local remote="${CMB_REMOTE:-origin}"
  local dry="${CMB_DRY_RUN:-0}"
  local no_remote="${CMB_NO_REMOTE:-0}"
  local deleted=0 review=0 kept=0 worktree=0 verb b

  while IFS=' ' read -r verb b; do
    case "$verb" in
      MERGED)
        if [ "$dry" = "1" ]; then
          echo "  [dry-run] supprimerait (mergée corroborée) : $b"
          deleted=$((deleted + 1))
        # Le distant n'est supprimé QUE si la suppression locale a réussi. Si git refuse
        # (branche verrouillée par un worktree, etc.), on ne touche PAS au distant — sinon on
        # décapiterait une branche vivante. Filet de sécurité doublant le statut WORKTREE. D-20260709-0009.
        elif git branch -D "$b" >/dev/null 2>&1; then
          echo "  🗑️  supprimée (mergée) : $b"
          deleted=$((deleted + 1))
          if [ "$no_remote" != "1" ] && git ls-remote --exit-code --heads "$remote" "$b" >/dev/null 2>&1; then
            git push "$remote" --delete "$b" >/dev/null 2>&1 && echo "       + distante supprimée"
          fi
        else
          echo "  ⚠️  suppression locale refusée (branche verrouillée ? worktree ?) : $b — distant PRÉSERVÉ"
          kept=$((kept + 1))
        fi
        ;;
      WORKTREE)
        echo "  🌳 conservée (attachée à un worktree actif — jamais supprimée ici ni à distance) : $b"
        worktree=$((worktree + 1))
        ;;
      REVIEW)
        echo "  🔎 à vérifier (contenu déjà dans la base mais merge NON confirmé — net-zéro/backup ?) : $b"
        echo "       → conservée. Vérifie manuellement, puis 'git branch -D $b' si OK."
        review=$((review + 1))
        ;;
      KEEP)
        echo "  ⏳ conservée (travail non mergé) : $b"
        kept=$((kept + 1))
        ;;
      CURRENT)
        echo "  • branche courante (non supprimée) : $b"
        ;;
    esac
  done < <(cmb_classify "$base")

  echo "  → ${deleted} mergée(s) traitée(s)$([ "$dry" = "1" ] && echo ' [dry-run]'), ${review} à vérifier, ${worktree} worktree(s) actif(s), ${kept} conservée(s)."
}

# Exécution directe (non sourcé) : ferme les branches mergées.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  cmb_close "$@"
fi
