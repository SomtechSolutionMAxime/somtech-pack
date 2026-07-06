# shellcheck shell=bash
# ============================================================
# claude-swt.sh — v1.3.0
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
#   claude-swt-danger [ts] [path]  IDEM mais lance `claude --dangerously-skip-permissions`
#   claude-swt-ls                  liste les sessions (= git worktree list)
#   claude-swt-done <timestamp>    retire le worktree + branche d'une session
#   claude-swt-gc                  liste les sessions terminées (clean + mergées)
#   _claude-swt-launch <...>       (interne) cœur partagé par claude-swt[-danger]
#   _claude-swt-pending <m> <wt> <s>  (interne) branches de session non mergées
# ============================================================

# _claude-swt-pending — branches NON mergées qui bloquent le retrait d'un worktree.
# Echo une branche par ligne ; sortie vide = rien en suspens (worktree retirable).
#
# On ne valide QUE les branches de CETTE session — jamais l'ensemble du repo :
#   1. la branche actuellement checked out dans le worktree (le travail en cours) ;
#   2. la branche socle wt/<sess> (seule branche que le teardown supprime → on ne
#      doit jamais la perdre si elle porte des commits non mergés).
# Les branches feat/fix des AUTRES worktrees sont ignorées : elles ont leur propre
# session. Une feat/fix créée puis quittée (plus checked out) survit au teardown —
# le teardown ne supprime jamais une branche feat/fix —, donc rien n'est perdu.
_claude-swt-pending() {  # usage : _claude-swt-pending <main> <wt> <sess>
  local main="$1" wt="$2" sess="$3" head b
  head=$(git -C "$wt" symbolic-ref --quiet --short HEAD 2>/dev/null)
  for b in "$head" "wt/$sess"; do
    [ -n "$b" ] || continue
    git -C "$main" show-ref --verify --quiet "refs/heads/$b" || continue
    git -C "$main" merge-base --is-ancestor "$b" origin/main 2>/dev/null || printf '%s\n' "$b"
  done | sort -u
}

_claude-swt-launch() {  # interne — cœur partagé par claude-swt et claude-swt-danger.
                        #   arg1 = session-timestamp (défaut: auto) ; arg2 = path worktree
                        #   $_CLAUDE_SWT_DANGER=1 → lance `claude --dangerously-skip-permissions`
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

  ( cd "$wt"                                    # la session vit dans le worktree
    # Secrets hors .mcp.json (T-20260625-0013) : Claude expanse ${VAR} depuis
    # l'environnement du process, pas depuis un fichier. On source le .env du
    # repo PRINCIPAL (jamais commité, donc absent du worktree) pour que les MCP
    # référençant ${SOMCRAFT_MCP_API_KEY} & co fonctionnent. Source depuis $main
    # → pas de duplication du secret sur disque dans le worktree.
    # NB : `.` interprète le fichier comme du shell — les valeurs contenant des
    # espaces/caractères spéciaux doivent être quotées (KEY="a b"). Pour des
    # clés API (sans espaces) c'est sans risque ; le sous-shell ( … ) isole
    # `set -a` du shell appelant même si le source échoue.
    if [ -f "$main/.env" ]; then set -a; . "$main/.env"; set +a; fi
    if [ -n "${_CLAUDE_SWT_DANGER:-}" ]; then
      echo "⚠️  Mode DANGER : claude --dangerously-skip-permissions — toutes les"
      echo "    autorisations d'outils sont sautées pour cette session. À réserver à"
      echo "    un environnement de confiance (jamais sur du code non revu)."
      echo "    NB : le flag refuse de démarrer en root/sudo (garde-fou de Claude Code)."
      claude --dangerously-skip-permissions
    else
      claude
    fi )

  # --- au quit : retire seulement si rien en suspens (sinon garde pour reprise) ---
  git -C "$main" fetch origin -q
  if [ -n "$(git -C "$wt" status --porcelain)" ]; then
    echo "📌 session $sess conservée : modifications non commitées."
  else
    local pending
    pending=$(_claude-swt-pending "$main" "$wt" "$sess")
    if [ -n "$pending" ]; then
      echo "📌 session $sess conservée : branches non mergées → $(printf '%s' "$pending" | tr '\n' ' ')"
    else
      git -C "$main" worktree remove "$wt" && git -C "$main" branch -D "wt/$sess" 2>/dev/null
      echo "🧹 session $sess terminée (tout mergé, rien en suspens) → worktree retiré"
    fi
  fi
}

# claude-swt — session worktree isolée, permissions normales de Claude Code.
claude-swt() { _claude-swt-launch "$@"; }        # usage : claude-swt [timestamp] [path]

# claude-swt-danger — IDENTIQUE à claude-swt, mais lance Claude avec
# --dangerously-skip-permissions (aucun prompt d'autorisation d'outil). Réutilise
# tout le cœur (_claude-swt-launch) — zéro duplication. ⚠️ environnement de confiance
# uniquement ; un avertissement est affiché au lancement.
claude-swt-danger() { _CLAUDE_SWT_DANGER=1 _claude-swt-launch "$@"; }

claude-swt-ls() { git worktree list; }          # sessions + branche courante de chacune

claude-swt-done() {  # usage : claude-swt-done <timestamp> — depuis le repo OU un worktree
  [ -z "$1" ] && { echo "usage: claude-swt-done <timestamp>"; return 1; }
  # Résoudre le worktree via git (partagé entre tous les worktrees du repo) plutôt
  # que de reconstruire le chemin depuis $PWD : `basename "$PWD"` donne le
  # timestamp (pas le nom du repo) quand on lance la commande DEPUIS un worktree,
  # d'où un chemin faux et un « nettoyée » mensonger qui ne supprime rien.
  local wt
  wt=$(git worktree list --porcelain 2>/dev/null | awk '/^worktree /{print $2}' \
         | grep -E "/${1}/?$" | head -1)
  [ -z "$wt" ] && { echo "⛔ worktree pour la session $1 introuvable (git worktree list)."; return 1; }
  if ! git worktree remove "$wt"; then
    echo "⛔ retrait refusé (voir l'erreur git ci-dessus) — souvent : modifications ou fichiers non suivis dans $wt."
    echo "   Inspecte-le (git -C \"$wt\" status), nettoie, puis relance — ou force : git worktree remove --force \"$wt\"."
    return 1
  fi
  git branch -D "wt/$1" 2>/dev/null
  echo "✅ session $1 nettoyée ($wt)"
}

claude-swt-gc() {  # liste les sessions terminées (clean + mergées) — depuis le repo OU un worktree
  git fetch origin -q
  # Le repo principal est TOUJOURS le premier worktree listé — le dériver ainsi
  # rend gc correct peu importe d'où on l'invoque (et non « $PWD » qui peut être
  # un worktree lié).
  local main
  main=$(git worktree list --porcelain 2>/dev/null | awk '/^worktree /{print $2; exit}')
  git worktree list --porcelain | awk '/^worktree /{print $2}' | while read -r wt; do
    [ "$wt" = "$main" ] && continue
    [ -n "$(git -C "$wt" status --porcelain)" ] && continue
    [ -z "$(_claude-swt-pending "$main" "$wt" "$(basename "$wt")")" ] && \
      echo "🧹 session terminée → claude-swt-done $(basename "$wt")"
  done
}
