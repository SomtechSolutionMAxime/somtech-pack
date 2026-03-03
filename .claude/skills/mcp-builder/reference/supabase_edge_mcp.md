# Supabase Edge Functions MCP Server Guide

## Overview

Deploy MCP servers as Supabase Edge Functions using Deno, Hono, and the MCP TypeScript SDK. This pattern provides serverless, globally distributed MCP endpoints with built-in authentication.

---

## Critical Learnings (Production-Tested)

> **IMPORTANT**: These patterns were discovered through real-world debugging with Claude Code CLI.

### 1. zod-to-json-schema Does NOT Work in Deno
The `zod-to-json-schema` npm package fails silently in Deno, returning empty schemas. **You MUST implement manual Zod to JSON Schema conversion.**

### 2. Use Pure JSON Responses (NOT SSE)
Claude Code CLI expects pure JSON with `Content-Type: application/json`, not SSE format (`event: message\ndata: {...}`).

### 3. Discovery Endpoints Must Be PUBLIC
Claude Code CLI has a known bug where it doesn't transmit Authorization headers correctly for HTTP MCP servers. Make these endpoints public (no auth):
- `initialize`
- `notifications/initialized`
- `tools/list`

Only `tools/call` should require authentication.

### 4. Deploy with `--no-verify-jwt`
Supabase Gateway verifies JWT by default and will block MCP requests. Always deploy with:
```bash
supabase functions deploy mcp-service --no-verify-jwt
```

---

## Quick Reference

### Key Imports
```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from "npm:hono@4.9.2";
import { McpServer } from "npm:@modelcontextprotocol/sdk@1.24.3/server/mcp.js";
import { z } from "npm:zod@3.23.8";
// NOTE: Do NOT use zod-to-json-schema - it doesn't work in Deno
```

### Server Initialization
```typescript
const server = new McpServer({
  name: "mcp-{service}",
  version: "1.0.0"
});
```

### Tool Registration with Annotations
```typescript
server.registerTool(
  "service_action",
  {
    title: "service_action",
    description: "Detailed description with parameter explanations",
    inputSchema: z.object({
      param: z.string().describe("Parameter description"),
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (args) => {
    const result = await executeAction(args);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Supabase Edge Function                  │
├─────────────────────────────────────────────────────────┤
│  Hono Router                                             │
│  ├── /health, /elf, /check  → Health endpoints (public) │
│  ├── /mcp (POST)            → Streamable HTTP transport  │
│  ├── /sse (GET/POST)        → SSE transport (legacy)    │
│  ├── /tools (GET)           → List tools (convenience)   │
│  └── /tools/call (POST)     → Direct tool call          │
├─────────────────────────────────────────────────────────┤
│  Authentication: requireMcpApiKey()                      │
│  Token format: Authorization: Bearer sk_live_...         │
└─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
supabase/functions/mcp-{service}/
├── index.ts              # Main entry point with Hono router
├── tools.ts              # Tool definitions with Zod schemas
├── _shared/
│   ├── admin.ts          # Auth helpers (requireMcpApiKey, corsHeaders)
│   └── mcp.ts            # MCP utilities (jsonRpcResult, createSseStream)
└── deno.json             # Deno configuration
```

---

## Authentication Pattern

### API Key Middleware
```typescript
// _shared/admin.ts
export async function requireMcpApiKey(req: Request): Promise<AuthContext | Response> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer sk_live_")) {
    return jsonResponse({ error: "Invalid API key" }, 401);
  }

  const apiKey = authHeader.replace("Bearer ", "");

  // Validate against database
  const { data: keyData, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key", apiKey)
    .single();

  if (error || !keyData) {
    return jsonResponse({ error: "Invalid API key" }, 401);
  }

  return { user_id: keyData.user_id, org_id: keyData.org_id };
}
```

### Protected Route Pattern
```typescript
subApp.post("/mcp", async (c) => {
  const ctx = await requireMcpApiKey(c.req.raw);
  if (ctx instanceof Response) return ctx;  // Auth failed

  // ctx contains authenticated user context
  const server = buildMcpServer(c.req.header("authorization"));
  const transport = new StreamableHTTPTransport();
  await server.connect(transport);
  return transport.handleRequest(c);
});
```

---

## Transport Support

### Streamable HTTP with Public Discovery (Recommended for Claude Code CLI)

> **CRITICAL**: Claude Code CLI doesn't transmit headers correctly for HTTP MCP servers.
> Discovery endpoints (initialize, tools/list) must be PUBLIC. Only tools/call requires auth.

```typescript
/**
 * Returns a JSON-RPC response with correct headers
 * Format: Pure JSON (NOT SSE) for Claude CLI compatibility
 */
function jsonRpcResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",  // IMPORTANT: Not text/event-stream
    },
  });
}

async function handleStreamableMcp(c: any): Promise<Response> {
  const body = await c.req.json().catch(() => null);

  if (!body || !body.method) {
    return jsonRpcResponse({
      error: { code: -32600, message: "Invalid Request" },
      jsonrpc: "2.0",
      id: null,
    });
  }

  const id = body.id ?? null;

  // ============================================================
  // DISCOVERY METHODS - PUBLIC (No authentication)
  // Required because Claude Code CLI doesn't transmit headers correctly
  // ============================================================

  if (body.method === "initialize") {
    return jsonRpcResponse({
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: MCP_NAME, version: MCP_VERSION },
        capabilities: { tools: {} },
      },
      jsonrpc: "2.0",
      id,
    });
  }

  if (body.method === "notifications/initialized") {
    return jsonRpcResponse({
      result: {},
      jsonrpc: "2.0",
      id,
    });
  }

  if (body.method === "tools/list") {
    return jsonRpcResponse({
      result: { tools: getMcpToolset() },
      jsonrpc: "2.0",
      id,
    });
  }

  // ============================================================
  // ACTION METHODS - PROTECTED (Authentication required)
  // ============================================================

  if (body.method === "tools/call") {
    const params = body.params || {};
    const toolName = params.name;
    const args = params.arguments || {};
    const authHeader = c.req.header("authorization") ?? null;

    // Verify authentication for tool calls
    const ctx = await requireMcpApiKey(c.req.raw);
    if (ctx instanceof Response) {
      return jsonRpcResponse({
        error: { code: -32603, message: "Authentication required. Provide Authorization header with API key." },
        jsonrpc: "2.0",
        id,
      });
    }

    try {
      const result = await executeTool(toolName, args, authHeader);
      return jsonRpcResponse({
        result: { content: [{ type: "text", text: JSON.stringify(result) }] },
        jsonrpc: "2.0",
        id,
      });
    } catch (e) {
      return jsonRpcResponse({
        error: { code: -32603, message: e instanceof Error ? e.message : "Internal error" },
        jsonrpc: "2.0",
        id,
      });
    }
  }

  return jsonRpcResponse({
    error: { code: -32601, message: "Method not found" },
    jsonrpc: "2.0",
    id,
  });
}

// Mount handler on multiple paths for compatibility
subApp.post("/", handleStreamableMcp);
subApp.post("/mcp", handleStreamableMcp);
```

### SSE Fallback (Legacy Clients)
```typescript
// GET /sse - Initialize SSE stream
subApp.get("/sse", async (c) => {
  const ctx = await requireMcpApiKey(c.req.raw);
  if (ctx instanceof Response) return ctx;

  const base = basePathForFunction(c.req.url, "mcp-service");
  const stream = createSseStream(`${base}`);
  return new Response(stream, { headers: sseHeaders() });
});

// POST /sse - Handle JSON-RPC over SSE
subApp.post("/sse", async (c) => {
  const ctx = await requireMcpApiKey(c.req.raw);
  if (ctx instanceof Response) return ctx;

  const payload = await c.req.json();
  if (payload.method === "tools/list") {
    return jsonResponse(jsonRpcResult(payload.id, { tools: TOOLSET }));
  }
  if (payload.method === "tools/call") {
    const result = await executeTool(payload.params.name, payload.params.arguments);
    return jsonResponse(jsonRpcResult(payload.id, { content: [{ type: "text", text: JSON.stringify(result) }] }));
  }
});
```

---

## Tool Definition Pattern

### Unified Tool Definitions
```typescript
// tools.ts
import { z } from "npm:zod@4.1.13";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  annotations: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

export const TOOLS: McpToolDefinition[] = [
  {
    name: "items_list",
    description: `Liste les items avec filtres optionnels.

Paramètres:
- status: Filtre par statut (active, archived)
- limit: Nombre max de résultats (défaut: 50, max: 100)
- offset: Pagination offset

Retourne: Liste paginée avec metadata (total, has_more)`,
    inputSchema: z.object({
      status: z.enum(["active", "archived"]).optional(),
      limit: z.number().min(1).max(100).default(50).optional(),
      offset: z.number().min(0).default(0).optional(),
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "item_delete",
    description: "Supprime définitivement un item. Action irréversible.",
    inputSchema: z.object({
      id: z.string().uuid().describe("UUID de l'item à supprimer"),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,  // Important for delete operations
      idempotentHint: true,
      openWorldHint: true,
    },
  },
];
```

### Register Tools from Definitions
```typescript
function buildMcpServer(authHeader: string | null) {
  const server = new McpServer({ name: "mcp-service", version: "1.0.0" });

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      async (args) => {
        const result = await executeTool(tool.name, args, authHeader);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );
  }

  return server;
}
```

### Manual Zod to JSON Schema Conversion (Required for Deno)

> **WARNING**: `zod-to-json-schema` package does NOT work in Deno. Use this manual implementation:

```typescript
/**
 * Converts a primitive Zod type to JSON Schema type
 */
function zodTypeToJsonType(zodType: z.ZodTypeAny): Record<string, unknown> {
  const def = zodType._def;
  const typeName = def?.typeName;

  // Handle wrapper types
  if (typeName === "ZodOptional") return zodTypeToJsonType(def.innerType);
  if (typeName === "ZodNullable") {
    const inner = zodTypeToJsonType(def.innerType);
    return { ...inner, nullable: true };
  }
  if (typeName === "ZodDefault") return zodTypeToJsonType(def.innerType);

  switch (typeName) {
    case "ZodString": return { type: "string" };
    case "ZodNumber": return { type: "number" };
    case "ZodBoolean": return { type: "boolean" };
    case "ZodEnum": return { type: "string", enum: def.values };
    case "ZodArray": return { type: "array", items: zodTypeToJsonType(def.type) };
    case "ZodRecord": return { type: "object", additionalProperties: zodTypeToJsonType(def.valueType) };
    case "ZodAny": return {};
    case "ZodObject": return zodObjectToJsonSchema(zodType as z.ZodObject<any>);
    default: return { type: "string" };
  }
}

/**
 * Converts a z.object() to full JSON Schema
 */
function zodObjectToJsonSchema(schema: z.ZodObject<any>): Record<string, unknown> {
  const def = schema._def;

  // In Zod 3.x, shape can be a function or an object
  let shape: Record<string, z.ZodTypeAny>;
  if (typeof def.shape === "function") {
    shape = def.shape();
  } else {
    shape = def.shape;
  }

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodField = value as z.ZodTypeAny;
    const fieldDef = zodField._def;
    const fieldTypeName = fieldDef?.typeName;
    const description = fieldDef?.description;

    const jsonType = zodTypeToJsonType(zodField);
    properties[key] = description ? { ...jsonType, description } : jsonType;

    // Field is required if not optional and not default
    if (fieldTypeName !== "ZodOptional" && fieldTypeName !== "ZodDefault") {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/**
 * Main conversion function
 */
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = schema._def;
  if (def?.typeName === "ZodObject") {
    return zodObjectToJsonSchema(schema as z.ZodObject<any>);
  }
  return zodTypeToJsonType(schema);
}

/**
 * Generate TOOLSET JSON Schema from Zod definitions
 */
function generateToolset(tools: McpToolDefinition[]): McpTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.inputSchema),
  }));
}

// Usage
const TOOLSET = generateToolset(TOOLS);
```

---

## Pagination Response Pattern

```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    count: number;
    offset: number;
    limit: number;
    has_more: boolean;
  };
}

// In tool execution
async function listItems(args: { limit?: number; offset?: number }) {
  const limit = Math.min(args.limit ?? 50, 100);
  const offset = args.offset ?? 0;

  const { data, count } = await supabase
    .from("items")
    .select("*", { count: "exact" })
    .range(offset, offset + limit - 1);

  return {
    data,
    pagination: {
      total: count ?? 0,
      count: data?.length ?? 0,
      offset,
      limit,
      has_more: (offset + limit) < (count ?? 0),
    },
  };
}
```

---

## CORS Configuration

```typescript
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

// Apply to all responses
function withCors(res: Response) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders)) {
    headers.set(k, v);
  }
  return new Response(res.body, { status: res.status, headers });
}

// Handle preflight
subApp.options("*", (c) => c.text("ok", 200, corsHeaders));
```

---

## Routing Pattern

Edge Functions receive URLs with different prefixes in prod vs local:
- **Prod**: `/functions/v1/mcp-service/...`
- **Local**: `/mcp-service/...`

Mount the same sub-app on both:
```typescript
const app = new Hono();
const subApp = new Hono();

// Define all routes on subApp
subApp.get("/health", () => healthResponse());
subApp.post("/mcp", handleMcp);
// ...

// Mount on both paths
app.route("/functions/v1/mcp-service", subApp);
app.route("/mcp-service", subApp);

Deno.serve(app.fetch);
```

---

## Health Endpoints

Always provide public health endpoints for monitoring:
```typescript
subApp.get("/health", () => jsonResponse({ status: "ok", name: "mcp-service", version: "1.0.0" }));
subApp.get("/elf", () => jsonResponse({ status: "ok" }));
subApp.get("/check", () => jsonResponse({ status: "ok" }));
```

---

## Deployment

> **CRITICAL**: Always use `--no-verify-jwt` flag. Supabase Gateway verifies JWT by default and will block MCP requests that use API keys instead of JWTs.

```bash
# Deploy single function (ALWAYS use --no-verify-jwt)
supabase functions deploy mcp-service --no-verify-jwt

# Deploy with specific project
supabase functions deploy mcp-service --project-ref your-project-ref --no-verify-jwt

# Test locally
supabase functions serve mcp-service --no-verify-jwt
```

### Common Deployment Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Invalid JWT` | Missing `--no-verify-jwt` flag | Redeploy with `--no-verify-jwt` |
| Empty `inputSchema: {}` | Using `zod-to-json-schema` package | Use manual conversion (see above) |
| Tools not visible in Claude CLI | Auth required on `tools/list` | Make discovery endpoints public |
| `text/event-stream` errors | Using SSE format | Return pure JSON with `application/json` |

---

## MCP Client Configuration

Add to `.mcp.json`:
```json
{
  "mcpServers": {
    "mcp-service": {
      "type": "http",
      "url": "https://<project-ref>.supabase.co/functions/v1/mcp-service/mcp",
      "headers": {
        "Authorization": "Bearer sk_live_your_api_key"
      }
    }
  }
}
```

---

## Quality Checklist

### Critical (Must Have)
- [ ] **Manual Zod to JSON Schema conversion** (NOT zod-to-json-schema package)
- [ ] **Discovery endpoints PUBLIC** (initialize, notifications/initialized, tools/list)
- [ ] **tools/call PROTECTED** with API key auth
- [ ] **Pure JSON responses** with `Content-Type: application/json` (NOT SSE)
- [ ] **Deployed with `--no-verify-jwt`** flag

### Standard
- [ ] All tools have descriptive names with service prefix
- [ ] Descriptions include parameter explanations and return types
- [ ] Annotations set for all tools (readOnlyHint, destructiveHint, etc.)
- [ ] Pagination implemented with has_more metadata
- [ ] CORS headers on all responses
- [ ] Health endpoints public and working
- [ ] Error messages are actionable
- [ ] No duplicate tool definitions

### Testing
- [ ] `curl POST /mcp` with `tools/list` returns tools with full inputSchema (no auth)
- [ ] `curl POST /mcp` with `tools/call` without auth returns 401
- [ ] `curl POST /mcp` with `tools/call` with auth executes correctly
- [ ] Claude Code CLI can discover and list all tools
