#!/usr/bin/env bash
# Installé par herdr au moment du `plugin link`/`plugin install`.
set -euo pipefail
cd "$(dirname "$0")/.."
# `npm ci` et non `npm install` : seul `ci` respecte le fichier de verrouillage, donc
# seule la page qu'il produit est identique d'une construction à l'autre (RA-DIS-002).
npm ci --omit=dev --no-audit --no-fund
npm --prefix web ci --no-audit --no-fund
npm --prefix web run build
