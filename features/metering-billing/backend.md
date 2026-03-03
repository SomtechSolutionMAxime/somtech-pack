# Metering & Billing — Back-end

## Helper `trackTokenUsage`

Fonction fire-and-forget qui insère un enregistrement dans `ai_token_usage` après chaque appel AI.

### Interface

```typescript
interface TokenUsageParams {
  module: string;        // Nom du module (chat, transcription, embeddings...)
  model: string;         // Modèle AI utilisé (gpt-4o, claude-sonnet-4-20250514...)
  inputTokens: number;
  outputTokens: number;
  userId?: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}
```

### Variante Deno (Edge Functions Supabase)

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function trackTokenUsage(params: TokenUsageParams): void {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const projectId = Deno.env.get("BILLING_PROJECT_ID") || null;

  supabase.from("ai_token_usage").insert({
    project_id: projectId,
    module: params.module,
    model: params.model,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    user_id: params.userId || null,
    conversation_id: params.conversationId || null,
    metadata: params.metadata || null,
  }).then(({ error }) => {
    if (error) console.error("[metering] Track failed:", error.message);
  });
}
```

### Variante Node.js

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const BILLING_PROJECT_ID = process.env.BILLING_PROJECT_ID || null;

export function trackTokenUsage(params: TokenUsageParams): void {
  supabase.from("ai_token_usage").insert({
    project_id: BILLING_PROJECT_ID,
    module: params.module,
    model: params.model,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    user_id: params.userId || null,
    conversation_id: params.conversationId || null,
    metadata: params.metadata || null,
  }).then(({ error }) => {
    if (error) console.error("[metering] Track failed:", error.message);
  });
}
```

**Règle d'or** : Ne JAMAIS `await` le `trackTokenUsage()`. C'est du fire-and-forget.

## Patterns d'instrumentation

### Pattern A — Chat Completion (OpenAI)

```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [...],
});

trackTokenUsage({
  module: "chat",
  model: response.model,
  inputTokens: response.usage?.prompt_tokens ?? 0,
  outputTokens: response.usage?.completion_tokens ?? 0,
  userId: currentUserId,
  conversationId: convId,
});
```

### Pattern B — Anthropic (Claude)

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  messages: [...],
});

trackTokenUsage({
  module: "classification",
  model: response.model,
  inputTokens: response.usage.input_tokens,
  outputTokens: response.usage.output_tokens,
  userId: currentUserId,
});
```

### Pattern C — Embeddings

```typescript
const response = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: texts,
});

trackTokenUsage({
  module: "embeddings",
  model: "text-embedding-3-small",
  inputTokens: response.usage.prompt_tokens,
  outputTokens: 0,
});
```

### Pattern D — Streaming (ATTENTION)

```typescript
const stream = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [...],
  stream: true,
  stream_options: { include_usage: true },  // OBLIGATOIRE
});

let inputTokens = 0;
let outputTokens = 0;

for await (const chunk of stream) {
  if (chunk.usage) {
    inputTokens = chunk.usage.prompt_tokens;
    outputTokens = chunk.usage.completion_tokens;
  }
}

trackTokenUsage({
  module: "chat-stream",
  model: "gpt-4o",
  inputTokens,
  outputTokens,
  userId: currentUserId,
});
```

> **Piège streaming** : Sans `stream_options: { include_usage: true }`, les tokens seront toujours à 0. L'usage arrive uniquement dans le dernier chunk.

## Edge Functions

### `collect-usage-metrics` — Agrégation quotidienne

Collecte 5 types de métriques et les UPSERT dans `usage_metrics_daily` :

1. **records** — `pg_stat_user_tables` (fallback: count d'une table principale)
2. **storage_bytes** — `pg_database_size(current_database())`
3. **ai_input_tokens** — via RPC `aggregate_daily_usage`
4. **ai_output_tokens** — via RPC `aggregate_daily_usage`
5. **mcp_requests** — count du jour dans `ai_token_usage`

Voir le code complet dans `implementation-guide.md`.

### `get-metering-data` — API exposée au hub

Deux actions disponibles :

- `?action=summary` — Résumé mensuel avec breakdown par module
- `?action=daily` — Métriques jour par jour

**Authentification** : Header `X-Metering-API-Key` comparé au secret `METERING_API_KEY`.

## Variables d'environnement

| Variable | Scope | Description |
|----------|-------|-------------|
| `SUPABASE_URL` | Auto (Edge Functions) | URL de l'instance Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto (Edge Functions) | Clé service_role |
| `BILLING_PROJECT_ID` | Secret Supabase | UUID du projet dans le hub de facturation |
| `METERING_API_KEY` | Secret Supabase | Clé API pour `get-metering-data` (format `mtr_*`) |

## Cron

Job `pg_cron` qui appelle `collect-usage-metrics` tous les jours à 2h UTC via `pg_net`.

Les secrets (`supabase_url`, `anon_key`) sont stockés dans le Vault Supabase pour éviter de les hardcoder dans le SQL du cron. On utilise l'`anon_key` (publishable key) plutôt que le `service_role_key` car l'Edge Function crée son propre client interne avec `SUPABASE_SERVICE_ROLE_KEY` (auto-injecté) — le JWT du header `Authorization` sert uniquement à passer la validation d'accès.
