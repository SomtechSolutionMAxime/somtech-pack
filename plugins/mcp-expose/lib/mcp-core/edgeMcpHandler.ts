import type { Tool } from "./types.ts";
import {
  buildProtectedResourceMetadata,
  buildWwwAuthenticate,
  createServiceSupabaseClient,
  createUserSupabaseClient,
  requireMcpAuth,
} from "./oauth.ts";

export type McpEdgeServiceInfo = {
  service: string; // ex: "contacts-mcp"
  module: string;  // ex: "contacts"
  serverName?: string; // affichage (optionnel)
  serverVersion?: string; // optionnel
};

export type RunToolFn = (
  name: string,
  args: Record<string, unknown>,
  ctx: { accessToken: string; userId: string; clientId?: string; supabase: ReturnType<typeof createUserSupabaseClient> }
) => Promise<unknown>;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-api-key, x-client-info, apikey, content-type, openai-conversation-id, openai-ephemeral-user-id",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  // Important: expose challenge headers for OAuth discovery flows (WWW-Authenticate)
  "Access-Control-Expose-Headers": "WWW-Authenticate",
};

function json(body: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, ...extraHeaders, "Content-Type": "application/json" },
  });
}

function text(body: string, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(body, { status, headers: { ...CORS_HEADERS, ...extraHeaders } });
}

function splitFunctionPath(pathname: string): { functionBase: string; routeParts: string[] } {
  const parts = pathname.split("/").filter(Boolean);
  const v1Index = parts.indexOf("v1");
  // /functions/v1/<fn>/<...>
  if (v1Index !== -1 && parts[v1Index - 1] === "functions" && parts.length > v1Index + 1) {
    const fnName = parts[v1Index + 1];
    return {
      functionBase: `/${parts.slice(0, v1Index + 2).join("/")}`,
      routeParts: parts.slice(v1Index + 2),
    };
  }
  // Fallback local runtime: /<fn>/<...>
  if (parts.length >= 1) {
    return { functionBase: `/${parts[0]}`, routeParts: parts.slice(1) };
  }
  return { functionBase: "/", routeParts: [] };
}

function isMcpRoute(last: string) {
  return last === "mcp" || last === "sse";
}

export function createMcpEdgeHandler(args: {
  info: McpEdgeServiceInfo;
  tools: Tool[];
  runTool: RunToolFn;
}) {
  const { info, tools, runTool } = args;

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const { functionBase, routeParts } = splitFunctionPath(url.pathname);
    const last = routeParts[routeParts.length - 1] ?? "";
    const last2 = routeParts.slice(-2).join("/");

    // Preflight
    if (req.method === "OPTIONS") return text("ok", 200);

    // Canonical URLs (utilisées par OAuth discovery)
    // NOTE: pour Streamable HTTP, on supporte aussi POST sur la base URL (sans /mcp),
    // mais on garde /mcp comme URL "canonique" annoncée en SSE pour compat.
    // Use SUPABASE_URL for correct external-facing URLs (Edge Runtime rewrites origin to http://)
    const externalOrigin = Deno.env.get("SUPABASE_URL") || url.origin;
    const externalBase = functionBase.startsWith("/functions") ? functionBase : `/functions/v1/${info.service}`;
    const mcpUrl = `${externalOrigin}${externalBase}/mcp`;
    const resourceMetadataUrl = `${externalOrigin}${externalBase}/.well-known/oauth-protected-resource`;

    // Expose resource metadata (public) — RFC 9728 path + legacy path
    if (req.method === "GET" && (last2 === ".well-known/oauth-protected-resource" || last2 === "oauth/protected-resource")) {
      return json(buildProtectedResourceMetadata(mcpUrl));
    }

    // Health checks (public)
    if (req.method === "GET" && (last === "" || last === info.service || last === "health" || last === "elf" || last === "check")) {
      return json({ ok: true, service: info.service, module: info.module });
    }

    // Tools listing (auth required)
    if (req.method === "GET" && last === "tools") {
      try {
        await requireMcpAuth(req, { mcpService: info.service });
        return json({ tools });
      } catch {
        return json(
          { error: "Unauthorized" },
          401,
          { "WWW-Authenticate": buildWwwAuthenticate(resourceMetadataUrl) }
        );
      }
    }

    // HTTP bridge (auth required)
    if (req.method === "POST" && last2 === "tools/call") {
      try {
        const auth = await requireMcpAuth(req, { mcpService: info.service });
        const supabase = auth.mode === "api_key" ? createServiceSupabaseClient() : createUserSupabaseClient(auth.accessToken);
        const body = await req.json();
        const data = await runTool(String(body.name), (body.arguments ?? {}) as Record<string, unknown>, {
          accessToken: auth.accessToken,
          userId: auth.userId,
          clientId: auth.clientId,
          supabase,
        });
        return json({ data });
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        const status = msg === "missing_authorization" || msg === "invalid_token" ? 401 : 500;
        const headers = status === 401 ? { "WWW-Authenticate": buildWwwAuthenticate(resourceMetadataUrl) } : undefined;
        return json({ error: msg }, status, headers);
      }
    }

    if (req.method === "POST" && routeParts[routeParts.length - 2] === "tools" && last !== "call") {
      try {
        const auth = await requireMcpAuth(req, { mcpService: info.service });
        const supabase = auth.mode === "api_key" ? createServiceSupabaseClient() : createUserSupabaseClient(auth.accessToken);
        const name = decodeURIComponent(last);
        const body = await req.json().catch(() => ({}));
        const data = await runTool(String(name), (body ?? {}) as Record<string, unknown>, {
          accessToken: auth.accessToken,
          userId: auth.userId,
          clientId: auth.clientId,
          supabase,
        });
        return json({ data });
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        const status = msg === "missing_authorization" || msg === "invalid_token" ? 401 : 400;
        const headers = status === 401 ? { "WWW-Authenticate": buildWwwAuthenticate(resourceMetadataUrl) } : undefined;
        return json({ error: msg }, status, headers);
      }
    }

    // MCP endpoint (Streamable HTTP / JSON-RPC minimal)
    // - POST /<fn>            (base URL) ✅ (compat Cursor/n8n)
    // - POST /<fn>/mcp        (alias)
    // - GET  /<fn>/sse        (SSE bootstrap Agent Builder)
    // - POST /<fn>/sse        (JSON-RPC over HTTP)
    const isBaseMcpPost = req.method === "POST" && last === "";
    if (isMcpRoute(last) || isBaseMcpPost) {
      let auth: Awaited<ReturnType<typeof requireMcpAuth>>;
      try {
        auth = await requireMcpAuth(req, { mcpService: info.service });
      } catch {
        return json(
          { error: "Unauthorized" },
          401,
          { "WWW-Authenticate": buildWwwAuthenticate(resourceMetadataUrl) }
        );
      }

      if (req.method === "GET") {
        const accept = (req.headers.get("accept") || "").toLowerCase();
        const wantsSse = last === "sse" || accept.includes("text/event-stream");
        if (!wantsSse) {
          return json({
            ok: true,
            service: info.service,
            hint: "Use POST (JSON-RPC Streamable HTTP).",
            oauth: {
              resource_metadata: resourceMetadataUrl,
              authorization_server: buildProtectedResourceMetadata(mcpUrl).authorization_servers[0],
            },
          });
        }

        // SSE minimal (compat clients type Agent Builder) : open + keepalive
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode("retry: 1000\n\n"));
            // Legacy compat (HTTP+SSE): annoncer l’endpoint POST à utiliser
            controller.enqueue(encoder.encode(`event: endpoint\ndata: ${mcpUrl}\n\n`));
            controller.enqueue(
              encoder.encode(`event: open\ndata: ${JSON.stringify({ ok: true, service: info.service })}\n\n`)
            );

            const interval = setInterval(() => {
              try {
                controller.enqueue(encoder.encode(`: keepalive\n\n`));
              } catch {
                clearInterval(interval);
              }
            }, 30000);
          },
        });

        return new Response(stream, {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      }

      if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

      try {
        // Valider token (OAuth) et obtenir contexte user
        const supabase = auth.mode === "api_key" ? createServiceSupabaseClient() : createUserSupabaseClient(auth.accessToken);

        const body = await req.json().catch(() => null);
        if (!body || body.jsonrpc !== "2.0" || !body.method) {
          return json({ jsonrpc: "2.0", error: { code: -32600, message: "Invalid Request" }, id: null }, 400);
        }

        // Handlers minimal MCP JSON-RPC
        if (body.method === "initialize") {
          return json({
            jsonrpc: "2.0",
            id: body.id ?? null,
            result: {
              protocolVersion: body.params?.protocolVersion ?? "2025-11-25",
              capabilities: { tools: {} },
              serverInfo: { name: info.serverName ?? info.service, version: info.serverVersion ?? "0.1.0" },
            },
          });
        }

        if (body.method === "notifications/initialized") {
          // Notification -> pas de réponse JSON-RPC obligatoire; on ack en 202.
          return new Response(null, { status: 202, headers: CORS_HEADERS });
        }

        if (body.method === "tools/list") {
          return json({ jsonrpc: "2.0", id: body.id ?? null, result: { tools } });
        }

        if (body.method === "tools/call") {
          const toolName = body.params?.name;
          const toolArgs = (body.params?.arguments ?? {}) as Record<string, unknown>;
          const data = await runTool(String(toolName), toolArgs, {
            accessToken: auth.accessToken,
            userId: auth.userId,
            clientId: auth.clientId,
            supabase,
          });
          return json({
            jsonrpc: "2.0",
            id: body.id ?? null,
            result: { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] },
          });
        }

        return json({ jsonrpc: "2.0", id: body.id ?? null, error: { code: -32601, message: "Method not found" } }, 404);
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        const status = msg === "missing_authorization" || msg === "invalid_token" ? 401 : 500;
        const headers = status === 401 ? { "WWW-Authenticate": buildWwwAuthenticate(resourceMetadataUrl) } : undefined;
        return json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: msg } }, status, headers);
      }
    }

    return json({ error: "Not Found" }, 404);
  };
}


