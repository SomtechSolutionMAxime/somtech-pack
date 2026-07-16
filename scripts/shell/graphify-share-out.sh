#!/usr/bin/env bash
# graphify — partage du dossier de sortie entre worktrees d'un même repo.
#
# Principe : au lieu d'un graphify-out/ par worktree (chacun rebuild → ~800k tokens),
# un dossier partagé unique ~/graphify/<clé>/ vu par tous les worktrees via un symlink
# graphify-out -> ~/graphify/<clé>. Le skill /graphify, le CLI et le MCP y lisent/écrivent
# tous de façon transparente (chemin relatif "graphify-out/graph.json").
#
# La <clé> = <nom-repo>-<hash8 du chemin absolu du dépôt principal>. Le hash évite que
# deux repos homonymes (ex. deux « web » d'orgs différentes) partagent le même graphe (B1).
#
# NOTE multi-poste : ~/graphify est LOCAL au poste (contient .graphify_python = chemin
# d'interpréteur machine-local). Ne jamais le synchroniser (Drive/iCloud) — comme les worktrees.
#
# Usage :
#   share-out.sh          # pose le symlink + amorce le dossier partagé si besoin (idempotent)
#   share-out.sh --init    # identique (conservé pour lisibilité d'appel explicite)
#
# Sortie : jamais fatale (ne casse aucune session). set -e neutralisé par des || exit 0 volontaires.
set -euo pipefail

# --- résoudre la racine du dépôt et le NOM canonique du repo (robuste worktree) ---
TOP=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0   # pas un repo git → rien à faire
COMMON=$(git -C "$TOP" rev-parse --git-common-dir 2>/dev/null) || exit 0
case "$COMMON" in
  /*) : ;;                       # déjà absolu
  *)  COMMON="$TOP/$COMMON" ;;   # relatif (".git" dans le checkout principal)
esac
COMMON_ABS=$(cd "$COMMON" 2>/dev/null && pwd) || exit 0        # chemin absolu du .git principal
REPO_DIR=$(dirname "$COMMON_ABS")                              # dossier du dépôt principal
REPO=$(basename "$REPO_DIR")

# Sous-module : git-common-dir = …/.git/modules/<nom> → REPO="modules". On garde le nom réel.
case "$COMMON_ABS" in
  */.git/modules/*) REPO=$(basename "$(dirname "$COMMON_ABS")") ;;
esac
# Garde-fous : jamais de clé vide ou "." (sinon SHARED=~/graphify tout court).
[ -n "$REPO" ] && [ "$REPO" != "." ] && [ "$REPO" != "/" ] || exit 0

# Clé unique = nom + hash court du chemin absolu → pas de collision entre repos homonymes (B1).
HASH=$(printf '%s' "$COMMON_ABS" | shasum 2>/dev/null | cut -c1-8)
[ -n "$HASH" ] || HASH=$(printf '%s' "$COMMON_ABS" | cksum | cut -d' ' -f1)   # fallback
KEY="${REPO}-${HASH}"

SHARED="$HOME/graphify/$KEY"
LINK="$TOP/graphify-out"

# --- ne jamais écraser un vrai dossier graphify-out déjà présent (legacy) ----------
if [ -e "$LINK" ] && [ ! -L "$LINK" ]; then
  exit 0
fi

# --- amorcer le dossier partagé (résout B2 : le partage démarre sans étape manuelle) -
mkdir -p "$SHARED"

# --- (re)poser le symlink si absent ou mal aligné ---------------------------------
if [ -L "$LINK" ]; then
  cur=$(readlink "$LINK" || true)
  [ "$cur" = "$SHARED" ] || ln -sfn "$SHARED" "$LINK"
else
  ln -s "$SHARED" "$LINK"
fi

# --- pointer le scan-root sur le worktree COURANT (vivant), pas un worktree mort (M4) -
# graphify --update sans argument relit .graphify_root ; on le garde toujours valide.
printf '%s\n' "$TOP" > "$SHARED/.graphify_root" 2>/dev/null || true

exit 0
