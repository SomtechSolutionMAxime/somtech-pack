#!/usr/bin/env bash
# Installé par herdr au moment du `plugin link`/`plugin install`.
set -euo pipefail
cd "$(dirname "$0")/.."
npm install --omit=dev --no-audit --no-fund
npm --prefix web install --no-audit --no-fund
npm --prefix web run build
