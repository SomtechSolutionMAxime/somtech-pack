---
name: mcp-expose
description: Plugin hybride (script + skill) pour exposer un module Somtech existant via MCP. Genere automatiquement un MCP server Edge Function wrapper avec auth dual (OAuth + API key).
version: "1.0.0"
author: somtech-pack
type: plugin
---

# Plugin mcp-expose

Expose un module existant via MCP en generant un MCP server Edge Function wrapper.

## Contenu

- `SKILL.md` — Skill Claude Code (detection endpoints, generation, validation)
- `references/` — Templates et patterns d'auth
- `lib/mcp-core/` — Lib runtime copiee dans les projets cibles
- `scripts/mcp-expose.sh` — Script de generation boilerplate (copie aussi a la racine `scripts/`)
