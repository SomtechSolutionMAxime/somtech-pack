# Auth Patterns — MCP Servers Somtech

Reference des patterns d'authentification pour les serveurs MCP generes.

## Architecture auth dual

L'auth est geree par `requireMcpAuth()` dans `oauth.ts`. Un seul fichier gere les deux modes.

### Dispatch

```
Request → extractApiKey(req)
  ├─ sk_orbit_* detecte → lookupExternalApiKey() → McpRequestAuthContext { mode: "api_key" }
  └─ pas d'API key → requireOAuthUser(req) → McpRequestAuthContext { mode: "oauth" }
```

### Mode OAuth (prefere)

- Token : JWT Supabase Auth dans `Authorization: Bearer eyJ...`
- Validation : `supabase.auth.getUser()`
- Client Supabase : user-bound via `createUserSupabaseClient(accessToken)` — RLS actif
- Contexte : `{ accessToken, userId, clientId? }`
- `clientId` est extrait du JWT claim `client_id` (present si OAuth 2.1, absent si session first-party)

### Mode API key (fallback)

- Token : cle opaque dans `x-api-key` ou `Authorization: Bearer sk_orbit_...`
- Validation : hash SHA-256 avec pepper contre table `external_api_keys`
- Verifications : `scopes` contient `"mcp"`, `revoked_at IS NULL`
- Restriction optionnelle : `allowed_mcp_servers` peut limiter a certains services
- Client Supabase : service-role via `createServiceSupabaseClient()` — pas de RLS
- Contexte : `{ accessToken: "api_key", userId: "api_key:{id}", clientId: "api_key:{id}" }`

### Table `external_api_keys` requise

```sql
CREATE TABLE IF NOT EXISTS external_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  key_prefix TEXT NOT NULL,        -- ex: "sk_orbit_abc"
  key_hash TEXT NOT NULL UNIQUE,   -- SHA-256(pepper + ":" + key)
  hash_version INT DEFAULT 1,
  scopes TEXT[] DEFAULT '{}',      -- ex: {"mcp", "api:read"}
  allowed_mcp_servers TEXT[],      -- NULL = tous, sinon liste
  allowed_api_routes TEXT[],       -- NULL = toutes
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  last_used_meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);
```

### Variable d'environnement requise

```
API_KEY_PEPPER=<random-secret-string>
```

Doit etre configuree dans les secrets du projet Supabase.

### Pourquoi verify_jwt = false ?

Le gateway Supabase Edge Functions valide par defaut le JWT dans `Authorization`. Les tokens `sk_orbit_*` ne sont pas des JWT valides et seraient rejetes. Le handler MCP gere sa propre auth, donc on desactive la validation gateway.

```toml
[functions.contacts-mcp]
verify_jwt = false
```
