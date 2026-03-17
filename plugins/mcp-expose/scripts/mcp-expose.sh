#!/usr/bin/env bash
set -euo pipefail

# mcp-expose.sh — Genere un MCP server wrapper pour un module existant
# Usage: ./scripts/mcp-expose.sh <module-name> [--tables table1,table2,...]
# Exemple: ./scripts/mcp-expose.sh contacts
# Exemple: ./scripts/mcp-expose.sh devis --tables devis,ligne_devis,client

usage() {
  cat <<'EOF'
mcp-expose.sh — Genere un MCP server Edge Function pour exposer un module via MCP.

Usage:
  ./scripts/mcp-expose.sh <module-name> [--tables table1,table2,...]

Modes:
  Edge Function : si supabase/functions/<module>/index.ts existe, genere un wrapper
  PostgREST     : si --tables est fourni OU pas d'Edge Function, genere un CRUD direct

Exemples:
  ./scripts/mcp-expose.sh contacts                          # Mode Edge Function
  ./scripts/mcp-expose.sh devis --tables devis,ligne_devis  # Mode PostgREST
  ./scripts/mcp-expose.sh inventory                         # Auto-detect

Ce script :
  1. Detecte le mode (Edge Function ou PostgREST)
  2. Copie mcp-core/ dans _shared/ (si absent ou version inferieure)
  3. Cree supabase/functions/<module>-mcp/index.ts (squelette)
  4. Declare la fonction dans supabase/config.toml
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || $# -eq 0 ]]; then
  usage
  exit 0
fi

MODULE="$1"
shift
TABLES=""
MODE=""

# Parse optional --tables argument
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tables)
      TABLES="$2"
      MODE="postgrest"
      shift 2
      ;;
    *)
      echo "[mcp-expose][ERROR] Argument inconnu: $1" >&2
      exit 1
      ;;
  esac
done

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FUNCTIONS_DIR="$PROJECT_ROOT/supabase/functions"
MCP_CORE_SRC="$PROJECT_ROOT/.claude/skills/mcp-expose/lib/mcp-core"
MCP_CORE_DEST="$FUNCTIONS_DIR/_shared/mcp-core"
MCP_DIR="$FUNCTIONS_DIR/${MODULE}-mcp"
CONFIG_TOML="$PROJECT_ROOT/supabase/config.toml"

# 1. Detecter le mode
if [[ -z "$MODE" ]]; then
  if [[ -f "$FUNCTIONS_DIR/$MODULE/index.ts" ]]; then
    MODE="edge"
    echo "[mcp-expose] Mode: Edge Function (wrapper autour de $MODULE)"
  else
    MODE="postgrest"
    echo "[mcp-expose] Mode: PostgREST (CRUD direct sur tables)"
    if [[ -z "$TABLES" ]]; then
      echo "[mcp-expose] Pas d'Edge Function trouvee pour '$MODULE'."
      echo "[mcp-expose] Le skill mcp-expose va detecter les tables via le schema DB."
      echo "[mcp-expose] Vous pouvez aussi specifier: --tables table1,table2,..."
    fi
  fi
else
  echo "[mcp-expose] Mode: PostgREST (tables: $TABLES)"
fi

# 2. Copier mcp-core/ si absent ou version inferieure
if [[ ! -d "$MCP_CORE_DEST" ]]; then
  echo "[mcp-expose] Copie de mcp-core/ dans _shared/..."
  mkdir -p "$MCP_CORE_DEST"
  cp -r "$MCP_CORE_SRC/"* "$MCP_CORE_DEST/"
  echo "[mcp-expose] mcp-core/ copie (version $(cat "$MCP_CORE_DEST/VERSION"))"
elif [[ -f "$MCP_CORE_SRC/VERSION" && -f "$MCP_CORE_DEST/VERSION" ]]; then
  SRC_VERSION=$(cat "$MCP_CORE_SRC/VERSION" | tr -d '[:space:]')
  DEST_VERSION=$(cat "$MCP_CORE_DEST/VERSION" | tr -d '[:space:]')
  if [[ "$SRC_VERSION" != "$DEST_VERSION" ]]; then
    echo "[mcp-expose] mcp-core/ existant (v$DEST_VERSION) — version du pack: v$SRC_VERSION"
    read -p "[mcp-expose] Mettre a jour mcp-core/ ? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      cp -r "$MCP_CORE_SRC/"* "$MCP_CORE_DEST/"
      echo "[mcp-expose] mcp-core/ mis a jour vers v$SRC_VERSION"
    fi
  else
    echo "[mcp-expose] mcp-core/ deja a jour (v$DEST_VERSION)"
  fi
else
  echo "[mcp-expose][WARNING] mcp-core/ existant sans VERSION — fichiers non mis a jour."
  echo "[mcp-expose] Pour forcer la MAJ, ajoutez un fichier VERSION dans _shared/mcp-core/ ou supprimez le dossier."
fi

# 3. Creer le dossier MCP
if [[ -d "$MCP_DIR" ]]; then
  echo "[mcp-expose][WARNING] $MCP_DIR existe deja. Abandon." >&2
  exit 1
fi

mkdir -p "$MCP_DIR"

# 4. Generer le squelette index.ts selon le mode
if [[ "$MODE" == "edge" ]]; then
  cat > "$MCP_DIR/index.ts" <<'TEMPLATE'
import { createMcpEdgeHandler } from "../_shared/mcp-core/edgeMcpHandler.ts";

// MODE: Edge Function wrapper
// Le skill mcp-expose va analyser supabase/functions/MODULE_NAME/index.ts
// et remplir les tools automatiquement

const tools = [
  // TODO: Tools generes par le skill mcp-expose
];

const handler = createMcpEdgeHandler({
  info: { service: "MODULE_NAME-mcp", module: "MODULE_NAME" },
  tools,
  runTool: async (name, args, ctx) => {
    const { supabase, userId, clientId, accessToken } = ctx;

    switch (name) {
      // TODO: Cases generes par le skill mcp-expose
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
});

Deno.serve(handler);
TEMPLATE
else
  cat > "$MCP_DIR/index.ts" <<'TEMPLATE'
import { createMcpEdgeHandler } from "../_shared/mcp-core/edgeMcpHandler.ts";

// MODE: PostgREST (CRUD direct sur tables)
// Le skill mcp-expose va detecter le schema des tables via la DB
// et generer les tools CRUD automatiquement
//
// Tables: TABLES_PLACEHOLDER

const tools = [
  // TODO: Tools CRUD generes par le skill mcp-expose
  // Chaque table aura: list, get, create, update, delete
];

const handler = createMcpEdgeHandler({
  info: { service: "MODULE_NAME-mcp", module: "MODULE_NAME" },
  tools,
  runTool: async (name, args, ctx) => {
    const { supabase, userId, clientId, accessToken } = ctx;

    switch (name) {
      // TODO: Cases CRUD generes par le skill mcp-expose
      // Le supabase client respecte automatiquement le RLS:
      //   - OAuth: user-bound client (RLS actif)
      //   - API key: service-role (pas de RLS, filtrage applicatif)
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
});

Deno.serve(handler);
TEMPLATE

  # Injecter les tables si specifiees
  if [[ -n "$TABLES" ]]; then
    sed -i '' "s/TABLES_PLACEHOLDER/$TABLES/g" "$MCP_DIR/index.ts" 2>/dev/null || \
      sed -i "s/TABLES_PLACEHOLDER/$TABLES/g" "$MCP_DIR/index.ts"
  else
    sed -i '' "s/TABLES_PLACEHOLDER/(a detecter par le skill)/g" "$MCP_DIR/index.ts" 2>/dev/null || \
      sed -i "s/TABLES_PLACEHOLDER/(a detecter par le skill)/g" "$MCP_DIR/index.ts"
  fi
fi

# Remplacer MODULE_NAME par le vrai nom
sed -i '' "s/MODULE_NAME/$MODULE/g" "$MCP_DIR/index.ts" 2>/dev/null || \
  sed -i "s/MODULE_NAME/$MODULE/g" "$MCP_DIR/index.ts"

echo "[mcp-expose] Squelette cree: $MCP_DIR/index.ts"

# 5. Declarer dans config.toml (si pas deja present)
FUNC_BLOCK="[functions.${MODULE}-mcp]"
if grep -qF "$FUNC_BLOCK" "$CONFIG_TOML" 2>/dev/null; then
  echo "[mcp-expose] $FUNC_BLOCK deja present dans config.toml"
else
  echo "" >> "$CONFIG_TOML"
  echo "$FUNC_BLOCK" >> "$CONFIG_TOML"
  echo "verify_jwt = false" >> "$CONFIG_TOML"
  echo "[mcp-expose] Ajoute $FUNC_BLOCK a config.toml (verify_jwt = false)"
fi

echo ""
echo "[mcp-expose] Done! (mode: $MODE)"
if [[ "$MODE" == "edge" ]]; then
  echo "  Prochaine etape: le skill mcp-expose va analyser"
  echo "  $FUNCTIONS_DIR/$MODULE/index.ts et remplir les tools."
else
  echo "  Prochaine etape: le skill mcp-expose va detecter le schema"
  echo "  des tables via la DB et generer les tools CRUD."
fi
