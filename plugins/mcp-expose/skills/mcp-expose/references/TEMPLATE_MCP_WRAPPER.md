# Template MCP Wrapper

Template utilise par le skill `mcp-expose` pour generer `supabase/functions/{module}-mcp/index.ts`.

## Template

```typescript
import { createMcpEdgeHandler } from "../_shared/mcp-core/edgeMcpHandler.ts";

const tools = [
  {TOOLS_ARRAY}
];

const handler = createMcpEdgeHandler({
  info: { service: "{MODULE}-mcp", module: "{MODULE}" },
  tools,
  runTool: async (name, args, ctx) => {
    const { supabase, userId, clientId, accessToken } = ctx;

    switch (name) {
      {SWITCH_CASES}
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
});

Deno.serve(handler);
```

## Placeholders

| Placeholder | Description | Exemple |
|-------------|-------------|---------|
| `{MODULE}` | Nom du module (snake_case) | `contacts` |
| `{MODULE_SINGULAR}` | Nom singulier du module | `contact` |
| `{TOOLS_ARRAY}` | Definitions des tools (JSON) | Voir ci-dessous |
| `{SWITCH_CASES}` | Cases du switch pour chaque tool | Voir ci-dessous |

## Exemple de tool genere

```typescript
{
  name: "app_contacts_list",
  description: "Liste les contacts avec filtres optionnels",
  inputSchema: {
    type: "object",
    properties: {
      search: { type: "string", description: "Recherche textuelle" },
      limit: { type: "number", default: 50 },
      offset: { type: "number", default: 0 }
    }
  }
}
```

## Exemple de case genere

```typescript
case "app_contacts_list": {
  let query = supabase.from("contacts").select("*");
  if (args.search) query = query.or(`nom.ilike.%${args.search}%,email.ilike.%${args.search}%`);
  const { data, error } = await query.range(args.offset ?? 0, (args.offset ?? 0) + (args.limit ?? 50) - 1);
  if (error) throw error;
  return data;
}
```

## Convention de nommage des tools

- List (pluriel) : `app_{module_plural}_list`
- Get (singulier) : `app_{module_singular}_get`
- Create (singulier) : `app_{module_singular}_create`
- Update (singulier) : `app_{module_singular}_update`
- Delete (singulier) : `app_{module_singular}_delete`
- Custom : `app_{module}_{action_descriptive}`
