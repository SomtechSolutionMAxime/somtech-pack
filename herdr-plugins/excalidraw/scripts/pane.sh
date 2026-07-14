#!/usr/bin/env bash
# Le pane miroir. Son cwd est le projet (herdr passe --cwd), pas le plugin.
set -euo pipefail
PLUGIN_ROOT="${HERDR_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
exec node "$PLUGIN_ROOT/pane/bin.js" --project "$PWD"
