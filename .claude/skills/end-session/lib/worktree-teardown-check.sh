#!/usr/bin/env bash
# ============================================================
# worktree-teardown-check.sh — v1.0.0
# Diagnostique si le worktree courant (session claude-swt) pourra être retiré
# proprement. Utilisé par /end-session. LECTURE PURE — n'écrit rien, ne supprime
# rien : il rapporte, Claude agit ensuite avec la validation de l'utilisateur.
#
# Réplique EXACTEMENT les 2 conditions du teardown auto de claude-swt
# (_claude-swt-launch) — un worktree n'est retiré que si LES DEUX sont vraies :
#   1. `git status --porcelain` est vide (aucun fichier modifié/untracked) ;
#   2. la branche courante ET la socle `wt/<sess>` sont ancêtres de origin/main
#      (aucun commit non mergé).
#
# Objectif : au lieu de laisser le worktree « sale » sans explication, exposer
# CE qui bloque et POURQUOI, classé pour une remédiation actionnable :
#   • fichiers non commités → TRACKED (à committer) / ARTIFACT (jetable →
#     .gitignore ou rm) / ORPHAN (inconnu → décision requise, jamais supprimé
#     en silence) ;
#   • commits non mergés → branche + nombre de commits absents de la base.
#
# Sourçable (fonctions à code retour). Exécution directe = wtc_report.
# Env : WTC_BASE (déf origin/main).
# ============================================================

# Vrai (0) si le cwd est un worktree LIÉ (pas le repo principal).
# Les worktrees liés ont leur git-dir sous `.git/worktrees/<name>`.
wtc_is_worktree() {
  case "$(git rev-parse --git-dir 2>/dev/null)" in
    *"/worktrees/"*) return 0 ;;
    *) return 1 ;;
  esac
}

# Echo l'identifiant de session (= basename du worktree = suffixe de la socle wt/<sess>).
# Même dérivation que `claude-swt-gc` (basename du worktree). Fidèle au nommage
# par défaut `~/worktrees/<repo>/<sess>` ; un worktree créé à un CHEMIN CUSTOM
# (`claude-swt <sess> <path>` où basename(path) ≠ <sess>) peut faire diverger le
# nom de la socle inspectée — cas rare, lecture pure, aucune perte de données.
wtc_session() {
  basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null
}

# Classe `git status --porcelain` : une ligne "TYPE\t<fichier>" par entrée.
#   TRACKED  = suivi et modifié/ajouté/supprimé (dont les docs de fin de session)
#   ARTIFACT = untracked manifestement jetable (.DS_Store, *.log, *.tmp, *.swp…)
#   ORPHAN   = untracked inconnu → décision humaine requise
wtc_dirty() {
  local line x f
  git status --porcelain 2>/dev/null | while IFS= read -r line; do
    [ -n "$line" ] || continue
    x="${line:0:2}"             # 2 premiers caractères (code de statut porcelain)
    f="${line:3}"               # chemin (après "XY ")
    if [ "$x" = "??" ]; then
      case "$f" in
        *.DS_Store|Thumbs.db|*.log|*.tmp|*.swp|*.orig|*~)
          printf 'ARTIFACT\t%s\n' "$f" ;;
        *)
          printf 'ORPHAN\t%s\n' "$f" ;;
      esac
    else
      printf 'TRACKED\t%s\n' "$f"
    fi
  done
}

# Echo les branches de la session (HEAD + socle wt/<sess>) NON mergées dans la base.
# Sortie vide = aucun commit en suspens. Même sémantique que _claude-swt-pending.
wtc_pending() {
  local base="${1:-${WTC_BASE:-origin/main}}" sess head b
  sess="$(wtc_session)"
  head="$(git symbolic-ref --quiet --short HEAD 2>/dev/null)"
  for b in "$head" "wt/$sess"; do
    [ -n "$b" ] || continue
    git show-ref --verify --quiet "refs/heads/$b" || continue
    git merge-base --is-ancestor "$b" "$base" 2>/dev/null || printf '%s\n' "$b"
  done | sort -u
}

# Nombre de commits de <branch> absents de <base>.
wtc_ahead() {
  local branch="$1" base="${2:-${WTC_BASE:-origin/main}}"
  git rev-list --count "${base}..${branch}" 2>/dev/null || echo 0
}

# Affiche une liste (une entrée par ligne) en puces indentées. Passe par une
# boucle read (pas de word-splitting non quoté) → correct sous bash ET zsh, et
# préserve les noms de fichiers contenant des espaces.
wtc__bullets() {
  printf '%s\n' "$1" | while IFS= read -r _f; do
    [ -n "$_f" ] && printf '     - %s\n' "$_f"
  done
}

# Rapport lisible + code retour : 0 = teardown-ready, 1 = bloqué.
wtc_report() {
  local base="${1:-${WTC_BASE:-origin/main}}"
  if ! wtc_is_worktree; then
    echo "ℹ️  Pas dans un worktree lié (claude-swt) — étape teardown non applicable."
    return 0
  fi

  local sess dirty pending tracked artifact orphan b n
  sess="$(wtc_session)"
  dirty="$(wtc_dirty)"
  pending="$(wtc_pending "$base")"
  tracked="$(printf '%s\n' "$dirty" | awk -F'\t' '$1=="TRACKED"{print $2}')"
  artifact="$(printf '%s\n' "$dirty" | awk -F'\t' '$1=="ARTIFACT"{print $2}')"
  orphan="$(printf '%s\n' "$dirty" | awk -F'\t' '$1=="ORPHAN"{print $2}')"

  echo "🔎 Diagnostic teardown du worktree — session ${sess} (base : ${base})"
  echo

  if [ -n "$dirty" ]; then
    echo "🧹 Fichiers non commités (bloquent \`git worktree remove\`) :"
    [ -n "$tracked" ]  && { echo "  📝 suivis, à committer (dont docs de fin de session) :"; wtc__bullets "$tracked"; }
    [ -n "$artifact" ] && { echo "  🗑️  artefacts jetables (→ .gitignore ou supprimer) :";    wtc__bullets "$artifact"; }
    [ -n "$orphan" ]   && { echo "  ❓ orphelins inconnus (décision requise — JAMAIS supprimés sans ton GO) :"; wtc__bullets "$orphan"; }
    echo
  fi

  if [ -n "$pending" ]; then
    echo "🌿 Commits non mergés (bloquent le retrait de la session) :"
    while IFS= read -r b; do
      [ -n "$b" ] || continue
      n="$(wtc_ahead "$b" "$base")"
      echo "  - ${b} : ${n} commit(s) absent(s) de ${base}"
      git log --oneline "${base}..${b}" 2>/dev/null | sed 's/^/       /'
    done <<EOF
$pending
EOF
    echo
  fi

  if [ -z "$dirty" ] && [ -z "$pending" ]; then
    echo "Verdict : ✅ teardown-ready — le worktree s'auto-nettoiera au quit,"
    echo "          ou manuellement : claude-swt-done ${sess}"
    return 0
  fi

  echo "Verdict : 🚧 CE WORKTREE NE POURRA PAS ÊTRE SUPPRIMÉ en l'état."
  echo "          Traite les points ci-dessus, puis relance le diagnostic."
  return 1
}

# Exécution directe (non sourcé) : rapport.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  wtc_report "$@"
fi
