#!/usr/bin/env bash
# Démarre le canvas pour le projet courant, ouvre le navigateur, puis le pane miroir.
#
# Usage : open.sh [split|tab]
set -euo pipefail

PLACEMENT="${1:-split}"
HERDR="${HERDR_BIN_PATH:-herdr}"
PLUGIN_ROOT="${HERDR_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
PROJECT="$PWD"

# Rattachement si un serveur tourne déjà pour ce projet (pas de second serveur).
PORT="$(node "$PLUGIN_ROOT/server/bin.js" --project "$PROJECT" --print-port 2>/dev/null || true)"
if [ -z "$PORT" ]; then
  nohup node "$PLUGIN_ROOT/server/bin.js" --project "$PROJECT" >"$PROJECT/.herdr/excalidraw.log" 2>&1 &
  for _ in $(seq 1 50); do
    PORT="$(cat "$PROJECT/.herdr/excalidraw.port" 2>/dev/null || true)"
    [ -n "$PORT" ] && break
    sleep 0.2
  done
fi

if [ -z "$PORT" ]; then
  echo "Le serveur du canvas n'a pas démarré — voir .herdr/excalidraw.log" >&2
  exit 1
fi

open "http://127.0.0.1:$PORT/" 2>/dev/null || xdg-open "http://127.0.0.1:$PORT/" 2>/dev/null || true

exec "$HERDR" plugin pane open \
  --plugin somtech.excalidraw \
  --entrypoint canvas \
  --placement "$PLACEMENT" \
  --cwd "$PROJECT"
