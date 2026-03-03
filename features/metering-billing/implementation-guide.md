# Metering & Billing — Guide d'implémentation

Guide pas-à-pas pour déployer le système de métriques sur une application Supabase existante.

## Prérequis

- Instance Supabase active (locale ou production)
- Accès admin au projet Supabase (CLI ou dashboard)
- Au moins un appel AI dans le code de l'application

## Étape 1 — Créer les tables de métriques

### 1.1 Créer la migration

Fichier : `supabase/migrations/YYYYMMDDHHMMSS_create_metering_tables.sql`

```sql
-- =============================================
-- TABLES DE MÉTRIQUES — Système de facturation
-- =============================================

CREATE TABLE IF NOT EXISTS ai_token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  module TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  user_id UUID,
  conversation_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_token_usage ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_project_created
  ON ai_token_usage(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_project_module_created
  ON ai_token_usage(project_id, module, created_at);

DO $$ BEGIN
  CREATE TYPE metric_type_local AS ENUM (
    'records', 'mcp_requests', 'storage_bytes',
    'ai_input_tokens', 'ai_output_tokens'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS usage_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  metric_date DATE NOT NULL,
  metric_type metric_type_local NOT NULL,
  value BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, metric_date, metric_type)
);

ALTER TABLE usage_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_usage_metrics_daily_project_date
  ON usage_metrics_daily(project_id, metric_date);

-- RPC : agrégation quotidienne des tokens
CREATE OR REPLACE FUNCTION aggregate_daily_usage(
  p_project_id UUID, p_date DATE
) RETURNS TABLE(metric_type TEXT, total_value BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 'ai_input_tokens'::TEXT, COALESCE(SUM(input_tokens)::BIGINT, 0)
  FROM ai_token_usage
  WHERE project_id = p_project_id
    AND created_at >= p_date AND created_at < p_date + INTERVAL '1 day'
  UNION ALL
  SELECT 'ai_output_tokens'::TEXT, COALESCE(SUM(output_tokens)::BIGINT, 0)
  FROM ai_token_usage
  WHERE project_id = p_project_id
    AND created_at >= p_date AND created_at < p_date + INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC : résumé mensuel
CREATE OR REPLACE FUNCTION get_monthly_ai_usage(
  p_project_id UUID, p_month TEXT
) RETURNS TABLE(metric_type TEXT, total_value BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT umd.metric_type::TEXT, SUM(umd.value)::BIGINT
  FROM usage_metrics_daily umd
  WHERE umd.project_id = p_project_id
    AND to_char(umd.metric_date, 'YYYY-MM') = p_month
  GROUP BY umd.metric_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC : exec_sql pour collecte stats système
CREATE OR REPLACE FUNCTION exec_sql(query TEXT)
RETURNS JSONB AS $$
DECLARE result JSONB;
BEGIN
  EXECUTE 'SELECT to_jsonb(t) FROM (' || query || ') t' INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 1.2 Appliquer

```bash
# Local
supabase db reset

# Production (via MCP ou SQL Editor)
# Exécuter le SQL dans le dashboard Supabase
```

### 1.3 Activer les extensions

Dans le dashboard Supabase → Database → Extensions :
- `pg_cron`
- `pg_net`

### 1.4 Valider

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('ai_token_usage', 'usage_metrics_daily');

SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('aggregate_daily_usage', 'get_monthly_ai_usage', 'exec_sql');
```

---

## Étape 2 — Instrumenter les appels AI

### 2.1 Créer le helper `trackTokenUsage`

Créer `lib/track-token-usage.ts` adapté à la stack de l'app (voir `backend.md` pour les variantes Deno et Node.js).

### 2.2 Identifier tous les points d'appel AI

```bash
grep -rn "completions.create\|messages.create\|embeddings.create\|chat\.create\|anthropic\.\|openai\." src/ supabase/functions/ lib/ app/ --include="*.ts" --include="*.tsx" --include="*.js"
```

### 2.3 Instrumenter chaque point

Ajouter `trackTokenUsage()` (sans await) après chaque appel. Voir les patterns A/B/C/D dans `backend.md`.

### 2.4 Valider

```sql
SELECT module, model, input_tokens, output_tokens, created_at
FROM ai_token_usage ORDER BY created_at DESC LIMIT 5;
```

---

## Étape 3 — Déployer les Edge Functions

### 3.1 Générer la clé API

```bash
METERING_KEY="mtr_$(openssl rand -hex 32)"
echo "Clé : ${METERING_KEY}"
```

### 3.2 Configurer les secrets

```bash
supabase secrets set METERING_API_KEY="${METERING_KEY}"
supabase secrets set BILLING_PROJECT_ID="00000000-0000-0000-0000-000000000000"
```

> Le `BILLING_PROJECT_ID` sera mis à jour après configuration côté hub.

### 3.3 Créer `collect-usage-metrics`

Fichier : `supabase/functions/collect-usage-metrics/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const projectId = Deno.env.get("BILLING_PROJECT_ID") || null;
    const today = new Date().toISOString().split("T")[0];
    const metrics: { type: string; value: number }[] = [];

    // 1. Records
    try {
      const { data } = await supabase.rpc("exec_sql", {
        query: "SELECT COALESCE(SUM(n_live_tup), 0)::bigint as total FROM pg_stat_user_tables WHERE schemaname = 'public'"
      });
      metrics.push({ type: "records", value: data?.total || 0 });
    } catch {
      const { count } = await supabase
        .from("ai_token_usage")
        .select("*", { count: "exact", head: true });
      metrics.push({ type: "records", value: count || 0 });
    }

    // 2. Storage
    try {
      const { data } = await supabase.rpc("exec_sql", {
        query: "SELECT pg_database_size(current_database())::bigint as size"
      });
      metrics.push({ type: "storage_bytes", value: data?.size || 0 });
    } catch {
      metrics.push({ type: "storage_bytes", value: 0 });
    }

    // 3-4. AI Tokens
    const { data: tokenData } = await supabase.rpc("aggregate_daily_usage", {
      p_project_id: projectId,
      p_date: today,
    });

    if (tokenData) {
      for (const row of tokenData) {
        metrics.push({ type: row.metric_type, value: Number(row.total_value) });
      }
    } else {
      metrics.push({ type: "ai_input_tokens", value: 0 });
      metrics.push({ type: "ai_output_tokens", value: 0 });
    }

    // 5. API Requests
    const { count: apiCount } = await supabase
      .from("ai_token_usage")
      .select("*", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00Z`)
      .lt("created_at", `${today}T23:59:59Z`);

    metrics.push({ type: "mcp_requests", value: apiCount || 0 });

    // UPSERT
    for (const m of metrics) {
      const { error } = await supabase.from("usage_metrics_daily").upsert(
        { project_id: projectId, metric_date: today, metric_type: m.type, value: m.value },
        { onConflict: "project_id,metric_date,metric_type" }
      );
      if (error) console.error(`[metering] Upsert failed for ${m.type}:`, error.message);
    }

    return new Response(
      JSON.stringify({ success: true, date: today, metrics }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

### 3.4 Créer `get-metering-data`

Fichier : `supabase/functions/get-metering-data/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-metering-api-key, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = req.headers.get("X-Metering-API-Key");
  const expectedKey = Deno.env.get("METERING_API_KEY");

  if (!apiKey || apiKey !== expectedKey) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "summary";
  const month = url.searchParams.get("month");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const projectId = Deno.env.get("BILLING_PROJECT_ID") || null;
  const targetMonth = month || new Date().toISOString().slice(0, 7);

  try {
    if (action === "summary") {
      const { data: snapshots } = await supabase
        .from("usage_metrics_daily")
        .select("metric_type, value")
        .eq("project_id", projectId)
        .gte("metric_date", `${targetMonth}-01`)
        .lt("metric_date", `${targetMonth}-32`)
        .in("metric_type", ["records", "storage_bytes"])
        .order("value", { ascending: false });

      const { data: cumulatives } = await supabase
        .from("usage_metrics_daily")
        .select("metric_type, value")
        .eq("project_id", projectId)
        .gte("metric_date", `${targetMonth}-01`)
        .lt("metric_date", `${targetMonth}-32`)
        .in("metric_type", ["ai_input_tokens", "ai_output_tokens", "mcp_requests"]);

      const result: Record<string, number> = {};
      for (const row of snapshots || []) {
        result[row.metric_type] = Math.max(result[row.metric_type] || 0, Number(row.value));
      }
      for (const row of cumulatives || []) {
        result[row.metric_type] = (result[row.metric_type] || 0) + Number(row.value);
      }

      const { data: moduleData } = await supabase
        .from("ai_token_usage")
        .select("module, input_tokens, output_tokens")
        .eq("project_id", projectId)
        .gte("created_at", `${targetMonth}-01T00:00:00Z`)
        .lt("created_at", `${targetMonth}-32T00:00:00Z`);

      const modules: Record<string, { input: number; output: number; calls: number }> = {};
      for (const row of moduleData || []) {
        if (!modules[row.module]) modules[row.module] = { input: 0, output: 0, calls: 0 };
        modules[row.module].input += row.input_tokens;
        modules[row.module].output += row.output_tokens;
        modules[row.module].calls += 1;
      }

      return new Response(
        JSON.stringify({ project_id: projectId, period: targetMonth, metrics: result, modules_breakdown: modules }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "daily") {
      const { data } = await supabase
        .from("usage_metrics_daily")
        .select("*")
        .eq("project_id", projectId)
        .gte("metric_date", `${targetMonth}-01`)
        .lt("metric_date", `${targetMonth}-32`)
        .order("metric_date", { ascending: true });

      return new Response(
        JSON.stringify({ project_id: projectId, period: targetMonth, daily: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'summary' or 'daily'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### 3.5 Déployer

```bash
supabase functions deploy collect-usage-metrics
supabase functions deploy get-metering-data
```

---

## Étape 4 — Configurer le cron

### 4.1 Stocker les secrets dans le Vault

```sql
SELECT vault.create_secret('<SUPABASE_URL>', 'supabase_url');
SELECT vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
```

### 4.2 Créer le cron job

```sql
SELECT cron.schedule(
  'collect-usage-metrics-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
           || '/functions/v1/collect-usage-metrics',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' ||
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### 4.3 Valider

```sql
SELECT jobid, jobname, schedule, active FROM cron.job
WHERE jobname = 'collect-usage-metrics-daily';
```

---

## Étape 5 — Validation complète

### Checklist

- [ ] Tables `ai_token_usage` et `usage_metrics_daily` créées avec RLS
- [ ] 3 RPCs créées (`aggregate_daily_usage`, `get_monthly_ai_usage`, `exec_sql`)
- [ ] Extensions `pg_cron` et `pg_net` activées
- [ ] Helper `trackTokenUsage` créé et importable
- [ ] Tous les points d'appel AI instrumentés
- [ ] Appels streaming avec `stream_options: { include_usage: true }`
- [ ] Edge Functions déployées et fonctionnelles
- [ ] Clé API `mtr_*` générée
- [ ] Cron `collect-usage-metrics-daily` actif à 2h UTC
- [ ] Vault configuré avec `supabase_url` et `service_role_key`
- [ ] Test API `get-metering-data` retourne 200 avec données
- [ ] Test avec mauvaise clé retourne 401

### Informations à transmettre à l'équipe hub

```
Nom de l'app      : <Nom de l'application>
Client            : <Nom de l'entreprise>
URL metering      : https://<projet>.supabase.co/functions/v1/get-metering-data
Clé API metering  : mtr_<clé>
```

## Troubleshooting

| Symptôme | Cause | Solution |
|----------|-------|---------|
| `cron.schedule` échoue | `pg_cron` non activé | Dashboard → Extensions |
| `net.http_post` échoue | `pg_net` non activé | Dashboard → Extensions |
| 0 résultats dans les secrets | Vault mal configuré | Re-exécuter `vault.create_secret` |
| Edge Function retourne 500 | Variable d'env manquante | `supabase secrets list` |
| Métriques à 0 | Pas de données dans `ai_token_usage` | L'instrumentation n'est pas encore active |
| Tokens streaming à 0 | Manque `stream_options` | Ajouter `stream_options: { include_usage: true }` |
