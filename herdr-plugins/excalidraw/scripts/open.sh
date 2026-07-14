#!/usr/bin/env bash
# Ouvre un canvas Excalidraw NOMMÉ du projet courant dans le navigateur.
#
#   open.sh              → docs/diagrams/canvas.excalidraw
#   open.sh archi        → docs/diagrams/archi.excalidraw
#   open.sh docs/x.excalidraw → ce fichier précis
#
# Chaque canvas a son propre serveur : ouvrir un second schéma n'écrase pas le premier.
set -euo pipefail

PLUGIN_ROOT="${HERDR_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
PROJECT="$PWD"
NAME="${1:-canvas}"
SLUG="$(basename "$NAME" .excalidraw)"
PORT_FILE="$PROJECT/.herdr/excalidraw-$SLUG.port"

mkdir -p "$PROJECT/.herdr"

# Rattachement si ce canvas est déjà servi (pas de second serveur pour le même fichier).
# `--check` sonde et rend la main ; le démarrage se fait détaché, sinon ce script
# resterait attaché à un serveur qui ne se termine jamais.
PORT="$(node "$PLUGIN_ROOT/server/bin.js" --project "$PROJECT" --name "$NAME" --check 2>/dev/null || true)"
if [ -z "$PORT" ]; then
  nohup node "$PLUGIN_ROOT/server/bin.js" --project "$PROJECT" --name "$NAME" \
    >"$PROJECT/.herdr/excalidraw-$SLUG.log" 2>&1 &
  for _ in $(seq 1 50); do
    PORT="$(cat "$PORT_FILE" 2>/dev/null || true)"
    [ -n "$PORT" ] && break
    sleep 0.2
  done
fi

if [ -z "$PORT" ]; then
  echo "Le canvas « $SLUG » n'a pas démarré — voir .herdr/excalidraw-$SLUG.log" >&2
  exit 1
fi

echo "Canvas « $SLUG » : http://127.0.0.1:$PORT/"
open "http://127.0.0.1:$PORT/" 2>/dev/null || xdg-open "http://127.0.0.1:$PORT/" 2>/dev/null || true
