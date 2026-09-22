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
# Remplacement par expansion de parametres bash (${var//search/replace}), PAS
# par sed : le remplacement sed traite '&' comme "le motif entier trouve" et
# '\1' etc comme des groupes de capture — un DEPARTMENT_NAME/ORGANIZATION_NAME
# contenant '&' (ex. "Acme & Co") corromprait alors le fichier genere en
# silence (defaut trouve en revue portail, T-20260922-0062). L'expansion bash
# ne traite aucun caractere du remplacement comme special.
#
# MAIS l'expansion bash ne connait rien non plus de la SYNTAXE du fichier
# CIBLE. Dans config.example.yaml et agents.json.example, les placeholders
# sont a l'interieur de guillemets doubles ("{{ORGANIZATION_NAME}}") : un nom
# contenant lui-meme un guillemet ou un backslash (ex. 'Acme "Prod" Inc')
# casse alors le JSON/YAML genere tout aussi silencieusement que l'ancien bug
# sed (defaut trouve en revue de fond, T-20260922-0062). json_escape()
# echappe backslash PUIS guillemet (l'ordre compte : echapper les backslashes
# deja presents avant d'introduire ceux des guillemets, sinon on les
# re-echapperait) pour les fichiers ou le placeholder vit dans une chaine
# quotee. README.md/agent.md ne sont que de la prose affichee, pas parsee :
# aucun echappement n'y est necessaire.
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  printf '%s' "$s"
}

substitute() {
  local src="$1" dest="$2" mode="$3"
  local dept="$DEPARTMENT_NAME" org="$ORGANIZATION_NAME"
  if [ "$mode" = "quoted" ]; then
    dept="$(json_escape "$DEPARTMENT_NAME")"
    org="$(json_escape "$ORGANIZATION_NAME")"
  fi
  local content
  content="$(cat "$src")"
  content="${content//\{\{DEPARTMENT_NAME\}\}/$dept}"
  content="${content//\{\{ORGANIZATION_NAME\}\}/$org}"
  content="${content//\{\{AUTH_MODE\}\}/$AUTH_MODE}"
  content="${content//\{\{SCAFFOLDED_AT\}\}/$SCAFFOLDED_AT}"
  printf '%s\n' "$content" > "$dest"
}

substitute "$TEMPLATES_DIR/config.example.yaml" "$DEST_DIR/config.example.yaml" quoted
substitute "$TEMPLATES_DIR/well-known/agents.json.example" "$DEST_DIR/.well-known/agents.json.example" quoted
substitute "$TEMPLATES_DIR/README.md.template" "$DEST_DIR/README.md" plain
substitute "$TEMPLATES_DIR/agent.md.template" "$DEST_DIR/agent.md" plain

cat > "$DEST_DIR/VERSION" <<EOF
OPS_DISCOVERY_SCAFFOLD_VERSION=0.1.0
SCAFFOLDED_AT=$SCAFFOLDED_AT
STD=STD-032
EOF

echo "Scaffold genere dans $DEST_DIR"
echo "  department.name         = $DEPARTMENT_NAME"
echo "  department.organization = $ORGANIZATION_NAME"
echo "  auth.mode                = $AUTH_MODE"
