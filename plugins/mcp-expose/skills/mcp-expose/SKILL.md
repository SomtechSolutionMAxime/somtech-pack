---
name: mcp-expose
description: Expose un module existant via MCP en generant automatiquement un MCP server Edge Function wrapper avec auth dual (OAuth + API key). Utiliser quand on dit "expose le module X par MCP", "creer un MCP pour le module Y", "mcp-expose", ou quand on veut rendre un module accessible aux agents.
license: MIT
metadata:
  author: somtech-pack
  version: "1.0.0"
  project: generic
---

# MCP Expose — Generer un MCP Server pour un Module

Ce skill genere un **MCP server Edge Function** qui wrappe les API existantes d'un module Somtech. Le MCP server supporte l'auth dual (OAuth prefere, API key en fallback) et est consommable par Claude Code, Claude Cowork, et les agents SDK Anthropic.

## Pre-requis

- Un projet avec Supabase Edge Functions configure
- Un module avec une Edge Function existante dans `supabase/functions/{module}/index.ts`
- (Optionnel) Table `external_api_keys` pour le support API key — voir `references/AUTH_PATTERNS.md`

## Workflow

### Etape 1 : Identifier le module

Demander a l'utilisateur quel module exposer. Verifier que `supabase/functions/{module}/index.ts` existe.

```bash
# Verifier l'existence
ls supabase/functions/{module}/index.ts
```

Si le fichier n'existe pas, informer l'utilisateur et arreter.

### Etape 2 : Analyser les endpoints

Lire le code source de `supabase/functions/{module}/index.ts` et detecter les routes/operations :

**Patterns a chercher :**

1. **Routing par methode HTTP** :
   - `req.method === "GET"` / `"POST"` / `"PATCH"` / `"PUT"` / `"DELETE"`
   - `switch` / `if` sur la methode ou le path

2. **Operations Supabase** :
   - `.from("table").select(...)` → operation list ou get
   - `.from("table").insert(...)` → operation create
   - `.from("table").update(...)` → operation update
   - `.from("table").delete()` → operation delete
   - `.eq("id", ...)` → operation sur un element (get/update/delete)

3. **Parametres** :
   - `url.searchParams.get("...")` → parametres de filtre (list)
   - `await req.json()` → body (create/update)
   - Path segments → id (get/update/delete)

**Mapping :**

| Pattern | Tool MCP | Schema |
|---------|----------|--------|
| select() sans .eq('id') | `app_{module_plural}_list` | filtres optionnels + limit/offset |
| select().eq('id') | `app_{module_singular}_get` | id requis |
| insert() | `app_{module_singular}_create` | champs du body |
| update().eq('id') | `app_{module_singular}_update` | id requis + champs |
| delete().eq('id') | `app_{module_singular}_delete` | id requis |
| autre logique | `app_{module}_{action}` | a determiner |

**Fallback** : si la detection automatique ne trouve rien (code non standard, logique repartie), demander a l'utilisateur de lister les operations a exposer manuellement.

### Etape 3 : Generer le MCP server

1. **Executer le script de generation** :

```bash
./scripts/mcp-expose.sh {module}
```

Ce script :
- Copie `mcp-core/` dans `_shared/` si absent (avec gestion de version)
- Cree `supabase/functions/{module}-mcp/index.ts` (squelette)
- Declare dans `supabase/config.toml`

2. **Remplir le squelette** avec les tools detectes :

Utiliser le template dans `references/TEMPLATE_MCP_WRAPPER.md` comme guide. Remplacer les placeholders :
- `{MODULE}` → nom du module
- `{MODULE_SINGULAR}` → nom singulier
- `{TOOLS_ARRAY}` → definitions des tools detectes
- `{SWITCH_CASES}` → implementation de chaque tool

**Convention de nommage** :
- List : pluriel (`app_contacts_list`)
- CRUD unitaire : singulier (`app_contact_get`, `app_contact_create`)
- Custom : descriptif (`app_devis_generate_pdf`)

**Contexte disponible dans runTool** :
```typescript
ctx: {
  accessToken: string;   // JWT OAuth ou "api_key"
  userId: string;        // UUID user ou "api_key:{id}"
  clientId?: string;     // OAuth client_id ou "api_key:{id}"
  supabase: SupabaseClient; // User-bound (OAuth) ou service-role (API key)
}
```

Le `supabase` client est automatiquement configure selon le mode d'auth :
- **OAuth** : `createUserSupabaseClient(accessToken)` — RLS actif
- **API key** : `createServiceSupabaseClient()` — service-role, pas de RLS

**Important** : le `runTool` doit retourner les donnees brutes (pas de wrapping `{ content: [...] }`). Le handler `edgeMcpHandler.ts` wrappe automatiquement en format MCP.

### Etape 4 : Valider

1. **Verification syntaxique** : s'assurer que le code genere est du TypeScript valide

2. **Tester localement** (si Supabase local tourne) :

```bash
# Health check
curl http://127.0.0.1:54321/functions/v1/{module}-mcp/health

# Tools listing (avec auth)
curl -X POST http://127.0.0.1:54321/functions/v1/{module}-mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

3. **Verifier config.toml** : s'assurer que le bloc `[functions.{module}-mcp]` est present avec `verify_jwt = false`

### Etape 5 : Informer l'utilisateur

Afficher un resume :
- Fichiers generes
- Tools MCP crees
- Prochaines etapes (deploiement, configuration client via `configure-mcp-server`)

## References

- Template : `references/TEMPLATE_MCP_WRAPPER.md`
- Auth : `references/AUTH_PATTERNS.md`
- Lib : `lib/mcp-core/` (source de verite pour les fichiers runtime)
