#!/usr/bin/env bash
# Genere localement le scaffold ops-discovery (STD-032 SS2.7, SS4) dans DEST_DIR.
# Ne touche AUCUN service distant : pas de git init/commit, pas de gh repo create.
# Ce script est la partie deterministe et testable du skill /scaffold-ops-discovery ;
# la publication GitHub est un geste separe (scripts/publish-github.sh), jamais
# invoque par ce script.
#
# Usage :
#   generate-scaffold.sh <DEST_DIR> <DEPARTMENT_NAME> <ORGANIZATION_NAME> <AUTH_MODE>
#
# AUTH_MODE : public | bearer | network (STD-032 SS2.5)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$SCRIPT_DIR/../templates"

DEST_DIR="${1:?Usage: generate-scaffold.sh <DEST_DIR> <DEPARTMENT_NAME> <ORGANIZATION_NAME> <AUTH_MODE>}"
DEPARTMENT_NAME="${2:?departement name requis}"
ORGANIZATION_NAME="${3:?organization name requis}"
AUTH_MODE="${4:?auth mode requis (public|bearer|network)}"

case "$AUTH_MODE" in
  public|bearer|network) ;;
  *)
    echo "ERREUR: auth mode invalide '$AUTH_MODE' (attendu: public|bearer|network — STD-032 SS2.5)" >&2
    exit 1
    ;;
esac

if [ -e "$DEST_DIR" ] && [ -n "$(ls -A "$DEST_DIR" 2>/dev/null)" ]; then
  echo "ERREUR: $DEST_DIR existe deja et n'est pas vide. Rien n'est ecrase — choisir une autre destination ou la vider d'abord." >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

SCAFFOLDED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# --- Fichiers copies tels quels ---
cp "$TEMPLATES_DIR/Dockerfile" "$DEST_DIR/Dockerfile"
cp "$TEMPLATES_DIR/.dockerignore" "$DEST_DIR/.dockerignore"
cp "$TEMPLATES_DIR/.gitignore" "$DEST_DIR/.gitignore"
cp "$TEMPLATES_DIR/package.json" "$DEST_DIR/package.json"
cp -r "$TEMPLATES_DIR/src" "$DEST_DIR/src"
cp -r "$TEMPLATES_DIR/tests" "$DEST_DIR/tests"

mkdir -p "$DEST_DIR/.well-known"

# --- Fichiers avec substitution de placeholders ---
substitute() {
  local src="$1" dest="$2"
  sed \
    -e "s/{{DEPARTMENT_NAME}}/$DEPARTMENT_NAME/g" \
    -e "s/{{ORGANIZATION_NAME}}/$ORGANIZATION_NAME/g" \
    -e "s/{{AUTH_MODE}}/$AUTH_MODE/g" \
    -e "s/{{SCAFFOLDED_AT}}/$SCAFFOLDED_AT/g" \
    "$src" > "$dest"
}

substitute "$TEMPLATES_DIR/config.example.yaml" "$DEST_DIR/config.example.yaml"
substitute "$TEMPLATES_DIR/well-known/agents.json.example" "$DEST_DIR/.well-known/agents.json.example"
substitute "$TEMPLATES_DIR/README.md.template" "$DEST_DIR/README.md"
substitute "$TEMPLATES_DIR/agent.md.template" "$DEST_DIR/agent.md"

cat > "$DEST_DIR/VERSION" <<EOF
OPS_DISCOVERY_SCAFFOLD_VERSION=0.1.0
SCAFFOLDED_AT=$SCAFFOLDED_AT
STD=STD-032
EOF

echo "Scaffold genere dans $DEST_DIR"
echo "  department.name         = $DEPARTMENT_NAME"
echo "  department.organization = $ORGANIZATION_NAME"
echo "  auth.mode                = $AUTH_MODE"
