#!/usr/bin/env bash
# ============================================================
# close-merged-branches.sh — v1.0.0
# Ferme (supprime) les branches déjà intégrées dans la base, laisse ouvertes
# celles qui portent du travail non mergé. Utilisé par /end-session.
#
# Détection robuste des SQUASH-MERGES : `git branch --merged` ne les voit pas
# (le squash ne rend pas la branche ancêtre de main). On teste plutôt si merger
# la branche dans la base ne produit AUCUN changement → son contenu y est déjà.
#   git merge-tree --write-tree <base> <branche>  == arbre de <base>  ⇒ mergée
# (git ≥ 2.38 requis pour --write-tree).
#
# Protège toujours : main / master / staging / develop / wt/* / branche courante.
#
# Sourçable (fonctions à code retour, ne tue pas le shell). Exécution directe =
# `cmb_close`.
#
# Points d'injection (env) :
#   CMB_BASE      ref de base       (def: origin/main)
#   CMB_REMOTE    remote            (def: origin)
#   CMB_DRY_RUN   1 = n'écrit rien  (def: 0)
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

# Vrai (0) si la branche est protégée (jamais supprimée).
cmb_is_protected() {
  case "$1" in
    main|master|staging|develop) return 0 ;;
    wt/*) return 0 ;;
    *) return 1 ;;
  esac
}

# Classe chaque branche locale : "MERGED b" / "KEEP b" / "CURRENT b" / "PROTECTED b".
cmb_classify() {
  local base="${1:-${CMB_BASE:-origin/main}}"
  local current b
  current="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
  while IFS= read -r b; do
    [ -z "$b" ] && continue
    if cmb_is_protected "$b"; then echo "PROTECTED $b"; continue; fi
    if [ -n "$current" ] && [ "$b" = "$current" ]; then echo "CURRENT $b"; continue; fi
    if cmb_merged_into "$b" "$base"; then echo "MERGED $b"; else echo "KEEP $b"; fi
  done < <(git for-each-ref --format='%(refname:short)' refs/heads/)
}

# Supprime les branches MERGED (local + distant), conserve les KEEP.
cmb_close() {
  local base="${1:-${CMB_BASE:-origin/main}}"
  local remote="${CMB_REMOTE:-origin}"
  local dry="${CMB_DRY_RUN:-0}"
  local deleted=0 kept=0 verb b

  while IFS=' ' read -r verb b; do
    case "$verb" in
      MERGED)
        if [ "$dry" = "1" ]; then
          echo "  [dry-run] supprimerait (mergée) : $b"
        else
          git branch -D "$b" >/dev/null 2>&1 && echo "  🗑️  supprimée (mergée) : $b"
          if git ls-remote --exit-code --heads "$remote" "$b" >/dev/null 2>&1; then
            git push "$remote" --delete "$b" >/dev/null 2>&1 && echo "       + distante supprimée"
          fi
        fi
        deleted=$((deleted + 1))
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

  echo "  → ${deleted} mergée(s) traitée(s)$([ "$dry" = "1" ] && echo ' [dry-run]'), ${kept} conservée(s)."
}

# Exécution directe (non sourcé) : ferme les branches mergées.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  cmb_close "$@"
fi
