# Metering & Billing — Vue d'ensemble

## Description

Système de métriques de consommation déployé sur chaque application cliente Supabase. Collecte automatiquement les données d'utilisation (tokens AI, records, storage, requêtes API) et les expose via une API HTTP sécurisée pour centralisation et facturation par le hub Orbit.

## Architecture

```
[Appel AI dans l'app]
       │
       ▼ fire-and-forget
[ai_token_usage]  ←── trackTokenUsage()
       │
       ▼ cron quotidien (2h UTC)
[usage_metrics_daily]  ←── collect-usage-metrics (Edge Function)
       │
       ▼ API HTTP authentifiée
[get-metering-data]  ←── appelé par Orbit (cron 4h UTC)
       │
       ▼ dans le hub Orbit
[billing_usage_cache]  →  Dashboard  →  Stripe
```

## Composantes

| Composante | Type | Rôle |
|-----------|------|------|
| `ai_token_usage` | Table PostgreSQL | Stockage brut de chaque appel AI (fire-and-forget) |
| `usage_metrics_daily` | Table PostgreSQL | Agrégation quotidienne par type de métrique |
| `trackTokenUsage()` | Helper TypeScript | Fonction appelée après chaque appel AI dans l'app |
| `collect-usage-metrics` | Edge Function Supabase | Agrège les métriques du jour (records, storage, tokens, requêtes) |
| `get-metering-data` | Edge Function Supabase | API HTTP exposée au hub — authentifiée par clé API |
| Cron `pg_cron` | Job PostgreSQL | Déclenche `collect-usage-metrics` tous les jours à 2h UTC |

## Métriques collectées

| Type | Méthode d'agrégation | Description |
|------|---------------------|-------------|
| `records` | Snapshot (MAX) | Nombre total de lignes dans les tables publiques |
| `storage_bytes` | Snapshot (MAX) | Taille de la base de données |
| `ai_input_tokens` | Cumulatif (SUM) | Tokens d'entrée consommés par les appels AI |
| `ai_output_tokens` | Cumulatif (SUM) | Tokens de sortie produits par les appels AI |
| `mcp_requests` | Cumulatif (SUM) | Nombre d'appels AI effectués |

## Prérequis

- Instance Supabase active (local ou production)
- Extensions PostgreSQL : `pg_cron`, `pg_net`
- Au moins un point d'appel AI dans le code de l'application
- Accès admin au projet Supabase (CLI ou dashboard)

## Stack technique

- **Base de données** : PostgreSQL (Supabase) — tables, RPC, enum, indexes
- **Edge Functions** : Deno (Supabase Edge Functions)
- **Cron** : `pg_cron` + `pg_net` (appel HTTP interne via `anon_key`)
- **Sécurité** : RLS (service_role only pour les tables), clé API custom (`X-Metering-API-Key`), Vault Supabase (URL + anon_key)
- **Helper** : TypeScript (variantes Deno et Node.js)

## Décisions techniques

### Fire-and-forget pour le tracking
Le `trackTokenUsage()` n'est **jamais** `await`. L'échec du metering ne doit jamais impacter l'expérience utilisateur. Le coût d'un token perdu est négligeable comparé à un timeout visible.

### Agrégation locale vs collecte directe
Plutôt que de faire lire les données brutes par Orbit, chaque app pré-agrège ses métriques dans `usage_metrics_daily`. Cela réduit le volume de données transférées et évite les requêtes lourdes cross-project.

### Clé API custom vs JWT Supabase
Une clé API dédiée (`mtr_*`) plutôt qu'un JWT Supabase car : indépendante du cycle de vie des users, révocable sans impact sur l'app, et plus simple à gérer côté Orbit.

### Enum `metric_type_local` vs string libre
Un enum PostgreSQL garantit la cohérence des types de métriques et empêche les typos qui fausseraient les agrégations.

## Durée d'implémentation estimée

~3 heures (dont ~1h d'instrumentation des appels AI, variable selon le nombre de points d'appel dans l'app).
