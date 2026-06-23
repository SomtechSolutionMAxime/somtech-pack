# shellcheck shell=bash
# ============================================================
# claude-swt.sh — v1.0.0
# Lanceur de session Claude Code en worktree (règle d'or n°11 amendée 2026-06-23).
#
# Snippet shell VERSIONNÉ et distribué par somtech-pack. À SOURCER depuis le
# rc shell du dev (~/.zshrc), via l'installateur `scripts/install-claude-swt.sh`
# (ou `remote-install.sh --with-claude-swt`).
#
# Ne définit que des fonctions — aucun effet de bord au chargement.
# Compatible zsh (shell par défaut macOS) et bash.
#
# Design (→ futur STD) :
#   Architecture/docs/superpowers/specs/2026-06-23-worktree-par-terminal-parallelisme-design.md
#
# Fonctions :
#   claude-swt [timestamp] [path]  ouvre/reprend une session worktree isolée
#   claude-swt-ls                  liste les sessions (= git worktree list)
#   claude-swt-done <timestamp>    retire le worktree + branche d'une session
#   claude-swt-gc                  liste les sessions terminées (clean + mergées)
# ============================================================

claude-swt() {  # usage : claude-swt [session-timestamp] [path]
                #   sans arg     → nouvelle session, timestamp auto
                #   <timestamp>  → REPREND une session existante (réentrant)
  local main wt repo sess
  main="$PWD"; repo=$(basename "$main")
  if ! git -C "$main" rev-parse --show-toplevel >/dev/null 2>&1; then
    echo "⛔ Pas dans un repo git. Place-toi à la racine d'un repo."; return 1
  fi
  sess="${1:-$(date +%Y%m%d-%H%M%S)}"          # identité du terminal = timestamp
  wt="${2:-$HOME/worktrees/$repo/$sess}"
  case "$wt" in                                # garde anti-cloud (corruption .git)
    *CloudStorage*|*"Google Drive"*|*Dropbox*|*"Mobile Documents"*)
      echo "⛔ Chemin synchronisé cloud refusé ($wt). Choisis un disque local."; return 1 ;;
  esac
  git -C "$main" worktree prune
  git -C "$main" fetch origin || return 1
  if [ -d "$wt" ]; then
    echo "↻ reprise de la session $sess"
  else
    git -C "$main" worktree add "$wt" -b "wt/$sess" origin/main || return 1
  fi

  ( cd "$wt" && claude )                        # la session vit dans le worktree

  # --- au quit : retire seulement si rien en suspens (sinon garde pour reprise) ---
  git -C "$main" fetch origin -q
  if [ -n "$(git -C "$wt" status --porcelain)" ]; then
    echo "📌 session $sess conservée : modifications non commitées."
  else
    local pending
    pending=$(git -C "$wt" for-each-ref --format='%(refname:short)' refs/heads/feat refs/heads/fix 2>/dev/null \
      | while read -r b; do git -C "$main" merge-base --is-ancestor "$b" origin/main 2>/dev/null || echo "$b"; done)
    if [ -n "$pending" ]; then
      echo "📌 session $sess conservée : branches non mergées → $pending"
    else
      git -C "$main" worktree remove "$wt" && git -C "$main" branch -D "wt/$sess" 2>/dev/null
      echo "🧹 session $sess terminée (tout mergé, rien en suspens) → worktree retiré"
    fi
  fi
}

claude-swt-ls() { git worktree list; }          # sessions + branche courante de chacune

claude-swt-done() {  # usage : claude-swt-done <timestamp> — depuis le repo principal
  [ -z "$1" ] && { echo "usage: claude-swt-done <timestamp>"; return 1; }
  local repo wt; repo=$(basename "$PWD"); wt="$HOME/worktrees/$repo/$1"
  git worktree remove "$wt" && git branch -D "wt/$1" 2>/dev/null
  echo "✅ session $1 nettoyée"
}

claude-swt-gc() {  # depuis le repo principal : liste les sessions terminées (clean + mergées)
  git fetch origin -q
  git worktree list --porcelain | awk '/^worktree /{print $2}' | while read -r wt; do
    [ "$wt" = "$PWD" ] && continue
    [ -n "$(git -C "$wt" status --porcelain)" ] && continue
    local pending
    pending=$(git -C "$wt" for-each-ref --format='%(refname:short)' refs/heads/feat refs/heads/fix 2>/dev/null \
      | while read -r b; do git merge-base --is-ancestor "$b" origin/main 2>/dev/null || echo "$b"; done)
    [ -z "$pending" ] && echo "🧹 session terminée → claude-swt-done $(basename "$wt")"
  done
}
