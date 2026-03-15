/**
 * Utilitaires HTTP et helpers partagés pour les serveurs MCP (Deno)
 * Adapté pour Supabase Edge Functions
 */

/**
 * Effectue une requête HTTP vers les Supabase Edge Functions
 */
export async function http(
  method: string,
  path: string,
  body?: unknown,
  opts?: { bearerToken?: string; apiKey?: string }
): Promise<unknown> {
  const baseUrl = Deno.env.get("SUPABASE_URL") || "https://kedosjwbfzpfqchvgpny.supabase.co";
  const tokenFromEnv =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SECRET_KEY") ||
    Deno.env.get("SUPABASE_ANON_KEY");
  
  const url = `${baseUrl}/functions/v1${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  
  const bearerToken = opts?.bearerToken || (tokenFromEnv ? `Bearer ${tokenFromEnv}` : undefined);
  const apiKey = opts?.apiKey || tokenFromEnv;
  if (bearerToken) headers["Authorization"] = bearerToken.startsWith("Bearer ") ? bearerToken : `Bearer ${bearerToken}`;
  if (apiKey) headers["apikey"] = apiKey;
  
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  
  return json;
}

/**
 * Construit une query string depuis un objet (filtre valeurs vides/null/undefined)
 */
export function qs(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && String(v) !== ""
  );
  if (entries.length === 0) return "";
  const search = new URLSearchParams();
  for (const [k, v] of entries) {
    search.set(k, String(v));
  }
  return `?${search.toString()}`;
}

