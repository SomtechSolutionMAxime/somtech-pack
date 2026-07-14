#!/usr/bin/env bash
# Démarre le canvas du projet courant (s'il ne tourne pas déjà) et l'ouvre dans le navigateur.
set -euo pipefail

PLUGIN_ROOT="${HERDR_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
PROJECT="$PWD"

mkdir -p "$PROJECT/.herdr"

# Rattachement si un serveur répond déjà pour ce projet (pas de second serveur).
# `--check` sonde et rend la main ; le démarrage se fait détaché, sinon ce script
# resterait attaché à un serveur qui ne se termine jamais.
PORT="$(node "$PLUGIN_ROOT/server/bin.js" --project "$PROJECT" --check 2>/dev/null || true)"
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

echo "Canvas : http://127.0.0.1:$PORT/  (fichier : $PROJECT/.herdr/canvas.excalidraw)"
open "http://127.0.0.1:$PORT/" 2>/dev/null || xdg-open "http://127.0.0.1:$PORT/" 2>/dev/null || true
