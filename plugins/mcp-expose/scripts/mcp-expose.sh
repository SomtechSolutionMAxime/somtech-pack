#!/usr/bin/env bash
set -euo pipefail

# mcp-expose.sh — Genere un MCP server wrapper pour un module existant
# Usage: ./scripts/mcp-expose.sh <module-name>
# Exemple: ./scripts/mcp-expose.sh contacts

usage() {
  cat <<'EOF'
mcp-expose.sh — Genere un MCP server Edge Function wrapper pour un module existant.

Usage:
  ./scripts/mcp-expose.sh <module-name>

Exemples:
  ./scripts/mcp-expose.sh contacts
  ./scripts/mcp-expose.sh projets

Ce script :
  1. Verifie que supabase/functions/<module>/index.ts existe
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
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FUNCTIONS_DIR="$PROJECT_ROOT/supabase/functions"
MCP_CORE_SRC="$PROJECT_ROOT/.claude/skills/mcp-expose/lib/mcp-core"
MCP_CORE_DEST="$FUNCTIONS_DIR/_shared/mcp-core"
MCP_DIR="$FUNCTIONS_DIR/${MODULE}-mcp"
CONFIG_TOML="$PROJECT_ROOT/supabase/config.toml"

# 1. Verifier que le module existe
if [[ ! -f "$FUNCTIONS_DIR/$MODULE/index.ts" ]]; then
  echo "[mcp-expose][ERROR] Module introuvable: $FUNCTIONS_DIR/$MODULE/index.ts" >&2
  echo "[mcp-expose] Assurez-vous que l'Edge Function du module existe avant d'exposer par MCP." >&2
  exit 1
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

# 4. Generer le squelette index.ts
cat > "$MCP_DIR/index.ts" <<'TEMPLATE'
import { createMcpEdgeHandler } from "../_shared/mcp-core/edgeMcpHandler.ts";

// TODO: Definir les tools MCP pour ce module
// Le skill mcp-expose va remplir cette section automatiquement
const tools = [
  // {
  //   name: "app_{module}_list",
  //   description: "Liste les {module}",
  //   inputSchema: { type: "object", properties: {} }
  // },
];

const handler = createMcpEdgeHandler({
  info: { service: "MODULE_NAME-mcp", module: "MODULE_NAME" },
  tools,
  runTool: async (name, args, ctx) => {
    const { supabase, userId, clientId, accessToken } = ctx;

    switch (name) {
      // TODO: Implementer les tools
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
});

Deno.serve(handler);
TEMPLATE

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
echo "[mcp-expose] Done! Prochaine etape:"
echo "  Le skill mcp-expose va analyser $FUNCTIONS_DIR/$MODULE/index.ts"
echo "  et remplir les tools dans $MCP_DIR/index.ts"
