# shellcheck shell=bash
# ============================================================
# mcp-env.sh — v1.0.0
# Le lieu unique des jetons MCP du poste, et son chargement (E-20260807-0009).
#
# LE PROBLÈME QU'IL RÉSOUT
# Claude Code résout les `${VAR}` d'un `.mcp.json` depuis l'environnement du
# PROCESSUS qui lance la session — pas depuis un fichier. Un serveur déclaré
# `Bearer ${SOMTECH_DESK_API_KEY}` sans la variable est refusé au premier
# échange (HTTP 401) et disparaît de la session : l'agent n'a plus de registre.
#
# Jusqu'ici, une seule des quatre portes de naissance fournissait cet
# environnement — `claude-swt` lancé depuis le dépôt principal, qui source son
# `.env`. Or ce `.env` est ignoré par git, donc absent de tout plan de travail.
# Les trois autres portes (chef d'équipe ouvert par un orchestrateur, `claude`
# lancé dans un plan existant, reprise de session) naissaient sans jeton.
#
# LA CORRECTION
# Un fichier unique du poste — `~/.somtech/mcp-env`, hors de tout dépôt, en
# 0600 — tient les jetons. Ce fichier est chargé AU SOURCE de cette lib, et
# cette lib est sourcée par `claude-swt.sh`, lui-même sourcé par le rc du shell.
# Tout shell du poste exporte donc les jetons, et toute session `claude` qui en
# naît les hérite — quelle que soit la porte empruntée.
#
# CE QU'IL NE FAIT JAMAIS
# Imprimer une valeur de jeton. Les fonctions ne rapportent que des NOMS de
# variables et des verdicts présent/absent.
#
# Fonctions :
#   mcp_env_file                → chemin du lieu unique
#   mcp_env_load [fichier]      → charge (idempotent, jamais fatal)
#   mcp_env_refs <mcp.json>     → noms des variables référencées par un .mcp.json
#   mcp_env_missing <mcp.json>  → parmi elles, celles absentes de l'environnement
# ============================================================

# Chemin du lieu unique. Surchargeable pour les tests (jamais en usage courant).
mcp_env_file() { printf '%s' "${SOMTECH_MCP_ENV_FILE:-$HOME/.somtech/mcp-env}"; }

# mcp_env_load [fichier] — exporte les jetons du lieu unique dans l'environnement.
#
# Jamais fatal : un poste sans lieu unique doit continuer d'ouvrir des sessions
# (elles seront simplement sans registre, et le hook de naissance le dira).
# `set -a` est posé puis retiré autour du seul `.` — on ne laisse pas
# l'auto-export actif derrière soi, sans quoi toute variable définie ensuite par
# le rc du shell partirait dans l'environnement de tous les processus enfants.
mcp_env_load() {
  local f="${1:-$(mcp_env_file)}"
  [ -r "$f" ] || return 0

  # Droits trop larges = jeton lisible par un autre compte du poste. On le dit
  # une fois, sans bloquer : refuser le chargement priverait l'agent de registre
  # pour un défaut qui n'est pas le sien.
  local perms
  perms=$(stat -f '%Lp' "$f" 2>/dev/null || stat -c '%a' "$f" 2>/dev/null || echo '')
  case "$perms" in
    ''|600|400) : ;;
    *) printf '⚠️  %s est en %s — attendu 600. Corrige : chmod 600 %s\n' "$f" "$perms" "$f" >&2 ;;
  esac

  set -a
  # shellcheck source=/dev/null
  . "$f"
  set +a
}

# mcp_env_refs <mcp.json> — noms des variables d'environnement que ce fichier
# référence, une par ligne, dédoublonnés. Reconnaît `${VAR}` où qu'elle soit
# (en-tête Authorization, chaîne de requête d'une URL, argument de commande).
mcp_env_refs() {
  local f="$1"
  [ -r "$f" ] || return 0
  grep -oE '\$\{[A-Za-z_][A-Za-z0-9_]*\}' "$f" 2>/dev/null \
    | sed -E 's/^\$\{//; s/\}$//' | sort -u
}

# mcp_env_missing <mcp.json> — parmi les variables référencées, celles qui sont
# absentes ou vides dans l'environnement courant. Une par ligne ; sortie vide =
# le fichier est entièrement résolu.
#
# On lit la valeur par indirection (`eval`) plutôt que par `${!v}` : `${!v}` est
# une extension bash que zsh interprète autrement (il y traite `!` comme une
# négation), et cette lib est sourcée par les deux shells.
mcp_env_missing() {
  local f="$1" v val
  while IFS= read -r v; do
    [ -n "$v" ] || continue
    eval "val=\${$v:-}"
    [ -n "$val" ] || printf '%s\n' "$v"
  done <<EOF
$(mcp_env_refs "$f")
EOF
}

# --- Effet de bord VOULU au chargement -------------------------------------
# C'est la raison d'être du fichier : sourcer cette lib doit peupler
# l'environnement. `claude-swt.sh` la source depuis son dossier d'installation,
# et le rc du shell source `claude-swt.sh` — donc tout shell du poste, y compris
# celui d'un pane qui fait naître un chef d'équipe, exporte les jetons.
# Opt-out pour les tests qui veulent la lib sans son effet : SOMTECH_MCP_ENV_NOLOAD=1.
[ -n "${SOMTECH_MCP_ENV_NOLOAD:-}" ] || mcp_env_load
