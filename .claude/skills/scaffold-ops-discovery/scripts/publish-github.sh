#!/usr/bin/env bash
# 🔴 PUBLIE UN DEPOT REEL DANS somtech-departement-ia. Action IRREVERSIBLE,
# visible a des tiers, hors du depot somtech-pack (regle d'or 7).
#
# CE SCRIPT N'EST JAMAIS INVOQUE PAR generate-scaffold.sh NI PAR AUCUN TEST DE
# CE SKILL. Il est ecrit ici pour completer le skill (STD-032 SS2.7 : le repo
# `somtech-departement-ia/ops-discovery` fait partie de ce que /scaffold-ops-discovery
# doit produire) mais son EXECUTION reste un geste separe, demande explicitement
# par le dirigeant — cf. T-20260922-0062, borne de perimetre.
#
# Usage :
#   publish-github.sh <LOCAL_SCAFFOLD_DIR> <ORG>/<REPO>
#
# Prerequis : gh CLI authentifie (gh auth status), LOCAL_SCAFFOLD_DIR deja
# genere par generate-scaffold.sh.

set -euo pipefail

LOCAL_DIR="${1:?Usage: publish-github.sh <LOCAL_SCAFFOLD_DIR> <ORG>/<REPO>}"
TARGET_REPO="${2:?Usage: publish-github.sh <LOCAL_SCAFFOLD_DIR> <ORG>/<REPO>}"

if [ ! -d "$LOCAL_DIR" ]; then
  echo "ERREUR: $LOCAL_DIR n'existe pas — lancer generate-scaffold.sh d'abord." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "ERREUR: gh CLI non authentifie (gh auth status). Lancer 'gh auth login' d'abord." >&2
  exit 1
fi

cd "$LOCAL_DIR"

if [ ! -d .git ]; then
  git init -q
  git add -A
  git commit -q -m "chore: scaffold initial ops-discovery (STD-032, somtech-pack /scaffold-ops-discovery)"
fi

# --private par defaut : le repo devient public-read au niveau HTTP applicatif
# (auth.mode, STD-032 SS2.5) independamment de la visibilite GitHub du CODE
# SOURCE, qui elle reste privee tant que non decidee autrement.
gh repo create "$TARGET_REPO" --private --source=. --remote=origin --push

echo "Depot publie : https://github.com/$TARGET_REPO"
