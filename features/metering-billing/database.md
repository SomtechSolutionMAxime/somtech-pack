# Metering & Billing — Base de données

## Tables

### `ai_token_usage` — Données brutes

Chaque appel AI est logué dans cette table en fire-and-forget.

```sql
CREATE TABLE IF NOT EXISTS ai_token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,                          -- Lien logique vers billing_projects (hub)
  module TEXT NOT NULL,                     -- Module source (chat, transcription, embeddings...)
  model TEXT NOT NULL,                      -- Modèle AI (gpt-4o, claude-sonnet-4-20250514...)
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  user_id UUID,                             -- Utilisateur déclencheur (optionnel)
  conversation_id UUID,                     -- ID conversation (optionnel)
  metadata JSONB,                           -- Données libres
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_token_usage ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_project_created
  ON ai_token_usage(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_project_module_created
  ON ai_token_usage(project_id, module, created_at);
```

**RLS** : Pas de policy utilisateur — accès uniquement via `service_role`.

### `usage_metrics_daily` — Agrégation quotidienne

```sql
DO $$ BEGIN
  CREATE TYPE metric_type_local AS ENUM (
    'records',
    'mcp_requests',
    'storage_bytes',
    'ai_input_tokens',
    'ai_output_tokens'
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
  UNIQUE (project_id, metric_date, metric_type)  -- Idempotence UPSERT
);

ALTER TABLE usage_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_usage_metrics_daily_project_date
  ON usage_metrics_daily(project_id, metric_date);
```

**Contrainte UNIQUE** : Permet l'idempotence des UPSERT — relancer la collecte ne crée pas de doublons.

## RPCs (fonctions PostgreSQL)

### `aggregate_daily_usage` — Agrégation tokens du jour

```sql
CREATE OR REPLACE FUNCTION aggregate_daily_usage(
  p_project_id UUID,
  p_date DATE
) RETURNS TABLE(metric_type TEXT, total_value BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 'ai_input_tokens'::TEXT,
         COALESCE(SUM(input_tokens)::BIGINT, 0)
  FROM ai_token_usage
  WHERE project_id = p_project_id
    AND created_at >= p_date
    AND created_at < p_date + INTERVAL '1 day'
  UNION ALL
  SELECT 'ai_output_tokens'::TEXT,
         COALESCE(SUM(output_tokens)::BIGINT, 0)
  FROM ai_token_usage
  WHERE project_id = p_project_id
    AND created_at >= p_date
    AND created_at < p_date + INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### `get_monthly_ai_usage` — Résumé mensuel

```sql
CREATE OR REPLACE FUNCTION get_monthly_ai_usage(
  p_project_id UUID,
  p_month TEXT  -- Format 'YYYY-MM'
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
```

### `exec_sql` — Exécution SQL dynamique (collecte stats système)

```sql
CREATE OR REPLACE FUNCTION exec_sql(query TEXT)
RETURNS JSONB AS $$
DECLARE result JSONB;
BEGIN
  EXECUTE 'SELECT to_jsonb(t) FROM (' || query || ') t' INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

> **Note sécurité** : `exec_sql` est `SECURITY DEFINER` et accessible uniquement via `service_role`. Ne jamais exposer côté client.

## Extensions requises

- `pg_cron` — Pour le cron de collecte quotidienne
- `pg_net` — Pour les appels HTTP depuis PostgreSQL

## Convention de nommage des modules

| Module | Description | Exemple |
|--------|------------|---------|
| `chat` | Chat conversationnel | Support client, assistant |
| `chat-stream` | Chat en streaming | Chat temps réel |
| `classification` | Classification de texte | Triage tickets |
| `embeddings` | Vectorisation de texte | Recherche sémantique, RAG |
| `transcription` | Transcription audio | Whisper, notes de réunion |
| `generation` | Génération de contenu | Rapports, maquettes |
| `summarization` | Résumé de texte | Résumé de documents |
