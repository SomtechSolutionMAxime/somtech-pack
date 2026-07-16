# shellcheck shell=bash
# ============================================================
# claude-swt.sh — v1.5.0
# Lanceur de session Claude Code en worktree (règle d'or n°11 amendée 2026-06-23).
#
# v1.5.0 (D-20260715-0001) : fraîcheur du somtech-pack à la NAISSANCE. Au launch :
#   (1) signal si le pack du projet est en retard (pf_nudge_launch) ; (2) MAJ auto
#   single-writer gardée, détachée (pf_auto_pr → PR chore/pack-vX, opt-out
#   CLAUDE_SWT_NO_AUTOPACK). + claude-swt-pack-sync : rebase opt-in des worktrees
#   propres et sans session active. Détection semver dans pack-freshness.sh.
#
# v1.4.0 (D-20260709-0003) : BD Supabase isolée et légère par worktree. Si le repo
#   est un projet Supabase, une stack élaguée est provisionnée au launch et arrêtée
#   au teardown. Profils : --db (défaut, Postgres seul ~65 Mo), --auth, --full,
#   --no-db. Logique dans swt-db.sh (sourcée depuis le même dossier).
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

# --- lib BD par worktree (swt-db.sh), sourcée depuis le même dossier (D-20260709-0003).
# Compatible bash (${BASH_SOURCE}) et zsh (${(%):-%x}). Sans effet si absente.
if [ -n "${BASH_SOURCE:-}" ]; then _swt_self="${BASH_SOURCE[0]}"
elif [ -n "${ZSH_VERSION:-}" ]; then _swt_self="${(%):-%x}"
else _swt_self="$0"; fi
_swt_dir="$(cd "$(dirname "$_swt_self")" 2>/dev/null && pwd)"
# shellcheck source=/dev/null
[ -r "$_swt_dir/swt-db.sh" ] && . "$_swt_dir/swt-db.sh"
# --- lib fraîcheur du pack (pack-freshness.sh), sourcée depuis le même dossier
#     (D-20260715-0001). Fonctions pf_* ; sans effet si absente.
# shellcheck source=/dev/null
[ -r "$_swt_dir/pack-freshness.sh" ] && . "$_swt_dir/pack-freshness.sh"
unset _swt_self _swt_dir

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

# --- Marqueur de session (D-20260715-0001, E4) ---------------------------------
# Atteste qu'une session claude-swt est VIVANTE dans un worktree donné, pour que
# claude-swt-pack-sync ne rebase JAMAIS une session active (drift). Le marqueur porte
# le PID du launcher : un marqueur orphelin (PID mort après crash) n'est pas « actif »
# → le worktree redevient éligible (pas de gel). Clé = hash du chemin absolu du worktree.
_swt_sessions_dir()   { printf '%s' "${SWT_SESSIONS_DIR:-$HOME/.somtech/swt-sessions}"; }
_swt_session_key()    { local p; p="$(cd "$1" 2>/dev/null && pwd -P)"; printf '%s' "${p:-$1}" | cksum | tr -d ' ' | cut -c1-16; }
_swt_session_marker() { printf '%s/%s' "$(_swt_sessions_dir)" "$(_swt_session_key "$1")"; }
_swt_session_lock()   { local m; m="$(_swt_session_marker "$1")"; mkdir -p "$(dirname "$m")" 2>/dev/null; printf '%s' "$$" > "$m" 2>/dev/null || true; }
_swt_session_unlock() { rm -f "$(_swt_session_marker "$1")" 2>/dev/null || true; }
# _swt_session_active <worktree> → 0 si marqueur présent ET PID vivant.
_swt_session_active() {
  local m pid; m="$(_swt_session_marker "$1")"; [ -f "$m" ] || return 1
  pid="$(cat "$m" 2>/dev/null)"; [ -n "$pid" ] || return 1
  kill -0 "$pid" 2>/dev/null
}

_claude-swt-launch() {  # interne — cœur partagé par claude-swt et claude-swt-danger.
                        #   arg1 = session-timestamp (défaut: auto) ; arg2 = path worktree
                        #   $_CLAUDE_SWT_DANGER=1 → lance `claude --dangerously-skip-permissions`
  local main wt repo sess wtpath="" profile="db" do_db=1 sb_pid=""
  main="$PWD"; repo=$(basename "$main")
  if ! git -C "$main" rev-parse --show-toplevel >/dev/null 2>&1; then
    echo "⛔ Pas dans un repo git. Place-toi à la racine d'un repo."; return 1
  fi
  sess=""
  while [ $# -gt 0 ]; do                        # flags BD + positionnels [timestamp] [path]
    case "$1" in
      --db)    profile=db ;;                    # défaut : Postgres seul (~65 Mo)
      --auth)  profile=auth ;;                  # + PostgREST + GoTrue + kong (RLS)
      --full)  profile=full ;;                  # stack complète
      --no-db) do_db=0 ;;                       # ne provisionne aucune BD
      --*) echo "⛔ Flag inconnu : $1 (attendus : --db|--auth|--full|--no-db)"; return 1 ;;
      *) if [ -z "$sess" ]; then sess="$1"; elif [ -z "$wtpath" ]; then wtpath="$1"; fi ;;
    esac
    shift
  done
  sess="${sess:-$(date +%Y%m%d-%H%M%S)}"        # identité du terminal = timestamp
  wt="${wtpath:-$HOME/worktrees/$repo/$sess}"
  case "$wt" in                                # garde anti-cloud (corruption .git)
    *CloudStorage*|*"Google Drive"*|*Dropbox*|*"Mobile Documents"*)
      echo "⛔ Chemin synchronisé cloud refusé ($wt). Choisis un disque local."; return 1 ;;
  esac
  git -C "$main" worktree prune
  git -C "$main" fetch origin || return 1

  # --- Fraîcheur du somtech-pack à la NAISSANCE (D-20260715-0001) ---
  # Signal AVANT le boot si le pack du projet est en retard (lecture pure, cache 24h,
  # jamais bloquant). No-op si à jour / hors-ligne / marqueur absent (repo pack lui-même).
  # NB : la MAJ auto (pf_auto_pr) est lancée PLUS BAS, APRÈS la création du worktree de
  # session — elle provisionne son propre worktree éphémère et ne doit pas courir contre
  # la création critique ci-dessous (contention du lock worktree de git).
  if command -v pf_nudge_launch >/dev/null 2>&1; then pf_nudge_launch "$main"; fi

  if [ -d "$wt" ]; then
    echo "↻ reprise de la session $sess"
  else
    git -C "$main" worktree add "$wt" -b "wt/$sess" origin/main || return 1
  fi

  # --- BD Supabase isolée du worktree (D-20260709-0003) ---
  # Provisionne une stack élaguée si le repo est un projet Supabase. swt_db_up est
  # tolérant (no-op si pas de supabase/config.toml, CLI absent, ou plage pleine) et
  # renvoie le project_id pour l'arrêter au teardown.
  if [ "$do_db" = 1 ] && command -v swt_db_up >/dev/null 2>&1; then
    sb_pid=$(swt_db_up "$main" "$wt" "$sess" "$profile")
  fi

  # MAJ auto single-writer gardée du pack, DÉTACHÉE (ne ralentit jamais le launch) : une
  # seule session ouvre une PR chore/pack-vX, les concurrentes skippent. Lancée ICI, une
  # fois le worktree de session créé, pour ne pas courir contre lui (pf_auto_pr provisionne
  # son propre worktree éphémère). Opt-out via CLAUDE_SWT_NO_AUTOPACK=1.
  if [ -z "${CLAUDE_SWT_NO_AUTOPACK:-}" ] && command -v pf_auto_pr >/dev/null 2>&1; then
    ( pf_auto_pr "$main" ) >/dev/null 2>&1 &
    disown 2>/dev/null || true
  fi

  _swt_session_lock "$wt"                        # marqueur « session vivante » (E4)

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

    # --- graphify : dossier de sortie partagé entre worktrees (D-20260716-0001) ---
    # (1) Pose/amorce le symlink graphify-out -> ~/graphify/<clé> DÈS la naissance du
    #     worktree (le hook SessionStart global le repose aussi, mais on l'a ici avant
    #     même que claude démarre). Idempotent, jamais fatal.
    # (2) Déclare le MCP graphify en scope LOCAL (jamais dans le .mcp.json versionné, M5),
    #     AVANT le lancement de claude → pas de `claude mcp add` imbriqué dans un hook.
    #     `claude mcp add` est idempotent (no-op si déjà présent, rc 0).
    if [ -x "$HOME/.somtech/graphify-share-out.sh" ]; then
      "$HOME/.somtech/graphify-share-out.sh" >/dev/null 2>&1 || true
    fi
    # MCP seulement si un graphe existe déjà (via le symlink partagé) → pas de MCP cassé
    # dans les repos qui n'utilisent pas graphify. Il s'ajoute au 1er claude-swt suivant
    # un `/graphify` (build), et est partagé par tous les worktrees du repo.
    if [ -e "graphify-out/graph.json" ] \
       && command -v claude >/dev/null 2>&1 && command -v graphify-mcp >/dev/null 2>&1; then
      claude mcp add --scope local graphify -- graphify-mcp graphify-out/graph.json >/dev/null 2>&1 || true
    fi

    if [ -n "${_CLAUDE_SWT_DANGER:-}" ]; then
      echo "⚠️  Mode DANGER : claude --dangerously-skip-permissions — toutes les"
      echo "    autorisations d'outils sont sautées pour cette session. À réserver à"
      echo "    un environnement de confiance (jamais sur du code non revu)."
      echo "    NB : le flag refuse de démarrer en root/sudo (garde-fou de Claude Code)."
      claude --dangerously-skip-permissions
    else
      claude
    fi )

  _swt_session_unlock "$wt"                      # session terminée → marqueur retiré (E4)

  # --- au quit : retire seulement si rien en suspens (sinon garde pour reprise) ---
  # La BD est TOUJOURS arrêtée (libère RAM/CPU) ; ses volumes ne sont purgés que si
  # la session est réellement terminée (destroy=1), conservés sinon (reprise rapide).
  git -C "$main" fetch origin -q
  if [ -n "$(git -C "$wt" status --porcelain)" ]; then
    [ -n "$sb_pid" ] && swt_db_down "$wt" "$sess" 0
    echo "📌 session $sess conservée : modifications non commitées."
  else
    local pending
    pending=$(_claude-swt-pending "$main" "$wt" "$sess")
    if [ -n "$pending" ]; then
      [ -n "$sb_pid" ] && swt_db_down "$wt" "$sess" 0
      echo "📌 session $sess conservée : branches non mergées → $(printf '%s' "$pending" | tr '\n' ' ')"
    else
      [ -n "$sb_pid" ] && swt_db_down "$wt" "$sess" 1
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

# claude-swt-db-orphans [--stop] — stacks Supabase dont le worktree n'existe plus.
# Elles continuent d'occuper des ports et empêchent les nouvelles sessions de
# provisionner leur BD (D-20260714-0008). Sans --stop : on liste, on ne touche à rien.
claude-swt-db-orphans() {
  local stop=0 pid found=0
  [ "${1:-}" = "--stop" ] && stop=1

  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    found=1
    if [ "$stop" -eq 1 ]; then
      printf '🛑 arrêt de %s…\n' "$pid"
      docker ps -a --format '{{.Names}}' 2>/dev/null | grep -F "_${pid}" \
        | xargs -r docker rm -f >/dev/null 2>&1
      printf '   arrêtée\n'
    else
      printf '  %s — ports : %s\n' "$pid" \
        "$(docker ps --filter "name=_${pid}" --format '{{.Ports}}' 2>/dev/null \
           | grep -oE '0\.0\.0\.0:[0-9]+' | cut -d: -f2 | sort -u | tr '\n' ' ')"
    fi
  done <<EOF
$(swt_db_orphan_stacks)
EOF

  if [ "$found" -eq 0 ]; then
    printf '✅ aucune stack orpheline.\n'
  elif [ "$stop" -eq 0 ]; then
    printf '\nCes stacks n%s ont plus de worktree. Les libérer : claude-swt-db-orphans --stop\n' "'"
  fi
}

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

# claude-swt-pack-sync — rattrape les worktrees après le merge d'une MAJ de pack
# (D-20260715-0001, E4). Rebase OPT-IN la branche de travail de chaque worktree PROPRE
# et SANS session active sur origin/main. Ne touche JAMAIS un worktree sale (modifs non
# commitées) ni une session vivante (drift) : il les liste sans y toucher. La commande
# elle-même est l'opt-in — un rebase reste une vraie opération. Un conflit → abort + liste.
claude-swt-pack-sync() {
  command -v git >/dev/null 2>&1 || { echo "⛔ git requis."; return 1; }
  local main
  main=$(git worktree list --porcelain 2>/dev/null | awk '/^worktree /{print $2; exit}')
  [ -n "$main" ] || { echo "⛔ Pas dans un repo git."; return 1; }
  git -C "$main" fetch origin -q || true

  local synced="" dirty="" active="" conflict="" wt
  while IFS= read -r wt; do
    [ -n "$wt" ] || continue
    [ "$wt" = "$main" ] && continue
    if [ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]; then
      dirty="${dirty} $(basename "$wt")"; continue
    fi
    if _swt_session_active "$wt"; then
      active="${active} $(basename "$wt")"; continue
    fi
    if git -C "$wt" rebase origin/main >/dev/null 2>&1; then
      synced="${synced} $(basename "$wt")"
    else
      git -C "$wt" rebase --abort >/dev/null 2>&1
      conflict="${conflict} $(basename "$wt")"
    fi
  done <<EOF
$(git -C "$main" worktree list --porcelain | awk '/^worktree /{print $2}')
EOF

  echo "🔄 claude-swt-pack-sync :"
  echo "  synchronisés (rebase sur origin/main) :${synced:-  (aucun)}"
  echo "  skippés — modifs non commitées :${dirty:-  (aucun)}"
  echo "  skippés — session active :${active:-  (aucun)}"
  [ -n "$conflict" ] && echo "  skippés — conflit de rebase (à traiter à la main) :$conflict"
  [ -n "$synced" ] && echo "  ⚠️  une branche synchronisée déjà poussée devra être force-pushée (git push --force-with-lease)."
  echo "  ↻ relance les sessions vivantes pour charger le nouveau pack (pas de hot-reload)."
}
