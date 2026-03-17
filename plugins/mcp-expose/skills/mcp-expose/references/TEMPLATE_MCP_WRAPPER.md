# Template MCP Wrapper

Templates utilises par le skill `mcp-expose` pour generer `supabase/functions/{module}-mcp/index.ts`.

## Template de base (commun aux deux modes)

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

---

## Mode Edge Function — Exemples

Pour les modules qui ont une Edge Function existante dans `supabase/functions/{module}/`.

### Tool definition

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

### Case implementation

```typescript
case "app_contacts_list": {
  let query = supabase.from("contacts").select("*");
  if (args.search) query = query.or(`nom.ilike.%${args.search}%,email.ilike.%${args.search}%`);
  const { data, error } = await query.range(args.offset ?? 0, (args.offset ?? 0) + (args.limit ?? 50) - 1);
  if (error) throw error;
  return data;
}
```

---

## Mode PostgREST — Exemples

Pour les modules sans Edge Function, avec CRUD direct sur les tables via le client Supabase.

### Tool definitions CRUD pour une table

```typescript
// LIST
{
  name: "app_devis_list",
  description: "Liste les devis avec filtres optionnels",
  inputSchema: {
    type: "object",
    properties: {
      client_id: { type: "string", format: "uuid", description: "Filtrer par client" },
      statut: { type: "string", description: "Filtrer par statut" },
      search: { type: "string", description: "Recherche dans le titre" },
      limit: { type: "number", default: 50 },
      offset: { type: "number", default: 0 }
    }
  }
},
// GET
{
  name: "app_devis_get",
  description: "Recupere un devis par ID avec ses lignes et client",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid", description: "ID du devis" }
    },
    required: ["id"]
  }
},
// CREATE
{
  name: "app_devis_create",
  description: "Cree un nouveau devis",
  inputSchema: {
    type: "object",
    properties: {
      titre: { type: "string", description: "Titre du devis" },
      client_id: { type: "string", format: "uuid", description: "ID du client" },
      montant: { type: "number", description: "Montant total" }
    },
    required: ["titre", "client_id"]
  }
},
// UPDATE
{
  name: "app_devis_update",
  description: "Met a jour un devis existant",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid", description: "ID du devis" },
      titre: { type: "string" },
      montant: { type: "number" },
      statut: { type: "string" }
    },
    required: ["id"]
  }
},
// DELETE
{
  name: "app_devis_delete",
  description: "Supprime un devis par ID",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid", description: "ID du devis" }
    },
    required: ["id"]
  }
}
```

### Cases implementation CRUD

```typescript
case "app_devis_list": {
  let query = supabase.from("devis").select("*, client:entreprises(nom)");
  if (args.client_id) query = query.eq("client_id", args.client_id);
  if (args.statut) query = query.eq("statut", args.statut);
  if (args.search) query = query.ilike("titre", `%${args.search}%`);
  query = query.order("created_at", { ascending: false });
  const { data, error } = await query.range(args.offset ?? 0, (args.offset ?? 0) + (args.limit ?? 50) - 1);
  if (error) throw error;
  return data;
}

case "app_devis_get": {
  const { data, error } = await supabase
    .from("devis")
    .select("*, lignes:ligne_devis(*), client:entreprises(nom, email)")
    .eq("id", args.id)
    .single();
  if (error) throw error;
  return data;
}

case "app_devis_create": {
  const { data, error } = await supabase
    .from("devis")
    .insert({
      titre: args.titre,
      client_id: args.client_id,
      montant: args.montant,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

case "app_devis_update": {
  const updates: Record<string, unknown> = {};
  if (args.titre !== undefined) updates.titre = args.titre;
  if (args.montant !== undefined) updates.montant = args.montant;
  if (args.statut !== undefined) updates.statut = args.statut;
  const { data, error } = await supabase
    .from("devis")
    .update(updates)
    .eq("id", args.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

case "app_devis_delete": {
  const { error } = await supabase
    .from("devis")
    .delete()
    .eq("id", args.id);
  if (error) throw error;
  return { deleted: true, id: args.id };
}
```

### Pattern pour les relations (FK / joins)

Pour le `select` dans list et get, inclure les relations via la syntaxe PostgREST :

```typescript
// Relation simple (FK)
supabase.from("devis").select("*, client:entreprises(nom, email)")

// Relation inverse (enfants)
supabase.from("devis").select("*, lignes:ligne_devis(*)")

// Relations multiples
supabase.from("devis").select("*, client:entreprises(nom), lignes:ligne_devis(*, produit:produits(nom, prix))")
```

### Colonnes a exclure du create/update

Ne pas inclure dans le `inputSchema` du create :
- `id` — auto-genere (uuid)
- `created_at`, `updated_at` — auto-generes
- `created_by`, `updated_by` — auto-generes si trigger RLS

---

## Convention de nommage des tools

- List (pluriel) : `app_{table_plural}_list`
- Get (singulier) : `app_{table_singular}_get`
- Create (singulier) : `app_{table_singular}_create`
- Update (singulier) : `app_{table_singular}_update`
- Delete (singulier) : `app_{table_singular}_delete`
- Custom : `app_{module}_{action_descriptive}`

## Detection du schema DB (mode PostgREST)

Query SQL pour recuperer le schema des tables :

```sql
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default,
  tc.constraint_type,
  ccu.table_name AS foreign_table
FROM information_schema.columns c
LEFT JOIN information_schema.key_column_usage kcu
  ON c.table_name = kcu.table_name
  AND c.column_name = kcu.column_name
  AND kcu.table_schema = 'public'
LEFT JOIN information_schema.table_constraints tc
  ON kcu.constraint_name = tc.constraint_name
  AND tc.constraint_type = 'FOREIGN KEY'
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE c.table_schema = 'public'
  AND c.table_name IN ({TABLES})
ORDER BY c.table_name, c.ordinal_position;
```

Mapping des types PostgreSQL vers JSON Schema :

| PostgreSQL | JSON Schema |
|------------|-------------|
| `uuid` | `{ type: "string", format: "uuid" }` |
| `text`, `varchar` | `{ type: "string" }` |
| `int4`, `int8` | `{ type: "integer" }` |
| `float4`, `float8`, `numeric` | `{ type: "number" }` |
| `bool` | `{ type: "boolean" }` |
| `timestamptz`, `timestamp` | `{ type: "string", format: "date-time" }` |
| `date` | `{ type: "string", format: "date" }` |
| `jsonb`, `json` | `{ type: "object" }` |
| `_text` (array) | `{ type: "array", items: { type: "string" } }` |
| `USER-DEFINED` (enum) | `{ type: "string", enum: [...] }` |
