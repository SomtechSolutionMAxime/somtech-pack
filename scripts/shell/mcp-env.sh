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
# 0600 — tient les jetons. Cette lib définit une enveloppe `claude` qui les
# charge DANS UN SOUS-SHELL, le temps de cet appel seulement. Elle est sourcée
# par `claude-swt.sh`, lui-même sourcé par le rc du shell : toute porte de
# naissance finit par taper `claude`, donc toutes sont couvertes.
#
# POURQUOI UNE ENVELOPPE PLUTÔT QU'UN EXPORT GLOBAL
# Exporter les jetons dans le shell lui-même les donnerait à TOUT ce qui tourne
# ensuite dans ce terminal, pour toute sa durée de vie : un `npm install` et ses
# scripts de post-installation, un outil tiers qui vide `env`, un rapport de
# plantage qui capture l'environnement. L'enveloppe donne exactement la même
# couverture pour une surface d'exposition réduite au seul processus qui en a
# besoin — c'est le même principe que le sous-shell de `claude-swt` (l.195),
# qu'un export global aurait contredit.
#
# CE QU'IL NE FAIT JAMAIS
# Imprimer une valeur de jeton. Les fonctions ne rapportent que des NOMS de
# variables et des verdicts présent/absent.
#
# PRÉSÉANCE — le lieu unique est un FILET, pas une autorité
# Une variable déjà fournie par un rang supérieur (le `.env` du dépôt, un export
# explicite de l'utilisateur, une valeur passée par le lanceur) l'emporte
# toujours. Le lieu unique ne comble que ce qui manque. L'inverse ferait basculer
# silencieusement un dépôt sur le jeton du poste alors qu'il déclare le sien.
#
# Fonctions :
#   claude …                    → enveloppe : jetons chargés pour CE seul appel
#   mcp_env_file                → chemin du lieu unique
#   mcp_env_load [fichier]      → charge (idempotent, jamais fatal)
#   mcp_env_refs <mcp.json>     → noms des variables référencées par un .mcp.json
#   mcp_env_missing <mcp.json>  → parmi elles, celles absentes de l'environnement
# ============================================================

# Chemin du lieu unique. Surchargeable pour les tests (jamais en usage courant).
mcp_env_file() { printf '%s' "${SOMTECH_MCP_ENV_FILE:-$HOME/.somtech/mcp-env}"; }

# mcp_env_perms <fichier> — droits trop larges = jeton lisible par un autre compte
# du poste. On le dit, sans bloquer : refuser le chargement priverait l'agent de
# registre pour un défaut qui n'est pas le sien.
mcp_env_perms() {
  local perms
  perms=$(stat -f '%Lp' "$1" 2>/dev/null || stat -c '%a' "$1" 2>/dev/null || echo '')
  case "$perms" in
    ''|600|400) : ;;
    *) printf '⚠️  %s est en %s — attendu 600. Corrige : chmod 600 %s\n' "$1" "$perms" "$1" >&2 ;;
  esac
}

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

  mcp_env_perms "$f"

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

# mcp_env_fill [fichier] — comble les variables MANQUANTES depuis le lieu unique.
#
# Différence avec `mcp_env_load`, et elle est essentielle : `fill` ne remplace
# jamais une valeur déjà présente. C'est ce qui rend le lieu unique inoffensif —
# un dépôt qui déclare son propre jeton garde le sien, et un test qui pose une
# valeur voit la sienne, pas celle du poste.
#
# `eval` sur la ligne plutôt que `.` sur le fichier : il faut décider variable par
# variable. Le fichier est en 0600 et appartient à l'utilisateur — même niveau de
# confiance qu'un `.` — mais, comme pour un `.env`, une valeur contenant des
# espaces doit être quotée dans le fichier (les jetons d'API n'en contiennent pas).
mcp_env_fill() {
  local f="${1:-$(mcp_env_file)}" line k cur
  [ -r "$f" ] || return 0
  mcp_env_perms "$f"
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|'#'*) continue ;; esac
    case "$line" in *=*) : ;; *) continue ;; esac
    k="${line%%=*}"
    case "$k" in [A-Za-z_]*) : ;; *) continue ;; esac
    eval "cur=\${$k:-}"
    [ -n "$cur" ] && continue                 # déjà fourni par un rang supérieur
    set -a; eval "$line"; set +a
  done < "$f"
}

# --- L'enveloppe : LA raison d'être de ce fichier ---------------------------
# Toute porte de naissance d'un agent finit par la même commande — `claude`.
# L'enveloppe s'y insère et fournit les jetons au seul processus qui en a besoin.
#
# Le sous-shell `( … )` est ce qui borne l'exposition : les variables meurent
# avec l'appel, le shell de l'utilisateur n'en porte aucune. `command claude`
# appelle le VRAI binaire, jamais cette fonction — sans quoi la récursion serait
# infinie. Le code de sortie de `claude` est propagé tel quel : rien dans la
# chaîne d'appel ne doit se comporter différemment à cause de l'enveloppe.
#
# Un poste sans lieu unique garde le comportement d'origine : on lance `claude`
# nu. La session s'ouvrira sans registre — et le hook de naissance le dira.
#
# Opt-out (tests qui veulent les fonctions sans l'enveloppe) : SOMTECH_MCP_ENV_NOWRAP=1.
if [ -z "${SOMTECH_MCP_ENV_NOWRAP:-}" ]; then
  claude() {
    local _f; _f="$(mcp_env_file)"
    if [ -r "$_f" ]; then
      ( mcp_env_fill "$_f"; command claude "$@" )
    else
      command claude "$@"
    fi
  }
fi
