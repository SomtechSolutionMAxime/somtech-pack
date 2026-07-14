#!/usr/bin/env bash
# Démarre le canvas pour le projet courant, ouvre le navigateur, puis le pane miroir.
#
# Usage : open.sh [split|tab]
set -euo pipefail

PLACEMENT="${1:-split}"
HERDR="${HERDR_BIN_PATH:-herdr}"
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

open "http://127.0.0.1:$PORT/" 2>/dev/null || xdg-open "http://127.0.0.1:$PORT/" 2>/dev/null || true

# Le miroir doit connaître SON projet : on le lui passe en argument, et on le
# lance par chemin absolu (`plugin pane open` démarrerait le pane dans le home).
CMD="node '$PLUGIN_ROOT/pane/bin.js' --project '$PROJECT'"

if [ "$PLACEMENT" = "tab" ]; then
  PANE=$("$HERDR" tab create --label "Canvas" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["root_pane"]["pane_id"])')
else
  FOCUSED=$("$HERDR" pane list \
    | python3 -c 'import sys,json; print(next(p["pane_id"] for p in json.load(sys.stdin)["result"]["panes"] if p["focused"]))')
  PANE=$("$HERDR" pane split "$FOCUSED" --direction right --no-focus \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["pane"]["pane_id"])')
fi

exec "$HERDR" pane run "$PANE" "$CMD"
