import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type OAuthProtectedResourceMetadata = {
  resource: string;
  authorization_servers: string[];
  scopes_supported?: string[];
  bearer_methods_supported?: string[];
};

export type McpAuthContext = {
  accessToken: string;
  userId: string;
  clientId?: string;
};

export type McpAuthMode = "oauth" | "api_key";

export type McpRequestAuthContext = McpAuthContext & {
  mode: McpAuthMode;
};

type ExternalApiKeyRow = {
  id: string;
  scopes: string[];
  allowed_mcp_servers: string[] | null;
  allowed_api_routes: string[] | null;
  revoked_at: string | null;
};

function safeJsonParseBase64Url(input: string): any | null {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const json = atob(normalized + pad);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function extractBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

export function extractApiKey(req: Request): string | null {
  // Standard internal header for service-to-service calls (n8n, scripts)
  const rawHeader = req.headers.get("x-api-key");
  if (rawHeader) {
    const trimmed = rawHeader.trim();
    if (trimmed) return trimmed;
  }

  // Compat: some tools put the opaque key in Authorization header (still an API key, not a JWT)
  const bearer = extractBearerToken(req);
  if (bearer && /^sk_orbit_/i.test(bearer.trim())) {
    return bearer.trim();
  }

  return null;
}

function getPepper(): string {
  const pepper = (Deno.env.get("API_KEY_PEPPER") || "").trim();
  if (!pepper) throw new Error("missing_api_key_pepper");
  return pepper;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return hex(new Uint8Array(digest));
}

export function buildProtectedResourceMetadata(resource: string): OAuthProtectedResourceMetadata {
  const projectRef = (Deno.env.get("SUPABASE_URL") || "").replace(/^https?:\/\//, "").split(".")[0] || "";
  const authServer = projectRef ? `https://${projectRef}.supabase.co/auth/v1` : (Deno.env.get("SUPABASE_URL") || "") + "/auth/v1";

  return {
    resource,
    authorization_servers: [authServer],
    // Supabase OAuth 2.1 Server ne supporte actuellement que les scopes standards.
    // https://supabase.com/docs/guides/auth/oauth-server/oauth-flows
    scopes_supported: ["openid", "email", "profile", "phone"],
    bearer_methods_supported: ["header"],
  };
}

export function buildWwwAuthenticate(resourceMetadataUrl: string, scope?: string): string {
  // RFC6750 / RFC9728: inclure resource_metadata pour discovery.
  // Exemple: Bearer resource_metadata="...", scope="..."
  const parts = [`Bearer resource_metadata="${resourceMetadataUrl}"`];
  if (scope) parts.push(`scope="${scope}"`);
  return parts.join(", ");
}

export async function requireOAuthUser(req: Request): Promise<McpAuthContext> {
  const accessToken = extractBearerToken(req);
  if (!accessToken) {
    throw new Error("missing_authorization");
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Note: Supabase Edge Functions peuvent nécessiter apikey même avec Bearer token.
  // On utilise anon_key comme apikey pour les appels internes Supabase.
  const supabase = createClient(url, anon, {
    auth: { persistSession: false },
    global: { 
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        apikey: anon, // Requis par Supabase Edge Functions gateway
      } 
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error("invalid_token");
  }

  // Supabase OAuth 2.1 ajoute `client_id` dans le payload JWT.
  // On le récupère si présent (utile pour audit/RLS “par client”),
  // mais on accepte aussi les JWT session “first-party” (ex: Orbit admin) qui n'ont pas `client_id`.
  const payload = accessToken.split(".")[1] ? safeJsonParseBase64Url(accessToken.split(".")[1]) : null;
  const clientId = typeof payload?.client_id === "string" ? payload.client_id : undefined;

  return { accessToken, userId: data.user.id, clientId };
}

function getServiceJwt(): string | null {
  // Supabase keys are JWTs. Prefer service role for server-side access.
  const key =
    (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim() ||
    (Deno.env.get("SUPABASE_SECRET_KEY") || "").trim() ||
    (Deno.env.get("SUPABASE_ANON_KEY") || "").trim();
  return key ? key : null;
}

async function lookupExternalApiKey(args: { key: string }): Promise<ExternalApiKeyRow | null> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
  if (!service) throw new Error("missing_service_role_key");
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const pepper = getPepper();
  const keyHash = await sha256Hex(`${pepper}:${args.key}`);

  const { data, error } = await admin
    .from("external_api_keys")
    .select("id, scopes, allowed_mcp_servers, allowed_api_routes, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if ((data as any).revoked_at) return null;
  return data as unknown as ExternalApiKeyRow;
}

function hasScope(scopes: string[], wanted: string) {
  return scopes.includes(wanted) || scopes.includes(`${wanted.split(":")[0]}:*`);
}

async function markExternalApiKeyUsed(args: { id: string; meta: Record<string, unknown> }) {
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
    if (!service) return;
    const admin = createClient(url, service, { auth: { persistSession: false } });
    await admin.from("external_api_keys").update({ last_used_at: new Date().toISOString(), last_used_meta: args.meta }).eq("id", args.id);
  } catch {
    // best-effort
  }
}

export async function requireMcpAuth(
  req: Request,
  opts?: { mcpService?: string; apiRoute?: string }
): Promise<McpRequestAuthContext> {
  // 1) Service-to-service API key mode (n8n, scripts) — opaque key validated in DB
  const apiKey = extractApiKey(req);
  if (apiKey) {
    const row = await lookupExternalApiKey({ key: apiKey });
    if (!row) throw new Error("invalid_api_key");

    // Scope checks
    if (!hasScope(row.scopes ?? [], "mcp")) {
      throw new Error("forbidden_scope");
    }

    // Optional server restriction
    if (opts?.mcpService && row.allowed_mcp_servers && !row.allowed_mcp_servers.includes(opts.mcpService)) {
      throw new Error("forbidden_server");
    }

    void markExternalApiKeyUsed({
      id: row.id,
      meta: { kind: "mcp", service: opts?.mcpService ?? null, url: req.url },
    });

    return {
      mode: "api_key",
      accessToken: "api_key",
      userId: `api_key:${row.id}`,
      clientId: `api_key:${row.id}`,
    };
  }

  // 2) OAuth mode (Supabase Auth access token)
  const oauth = await requireOAuthUser(req);
  return { mode: "oauth", ...oauth };
}

export function createUserSupabaseClient(accessToken: string) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export function createServiceSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = getServiceJwt() || Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}


