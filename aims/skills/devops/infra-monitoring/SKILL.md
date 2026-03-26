---
name: infra-monitoring
description: >
  Surveiller l'infrastructure en temps réel, collecter les métriques,
  définir les seuils d'alerte et réagir aux anomalies. Ce skill guide
  l'agent devops-silo dans le monitoring des containers Fly.io, des
  Edge Functions Supabase, des bases de données, et des endpoints réseau.
  Utiliser ce skill continuellement pour détecter les dégradations et
  escalader avant la panne critique.
---

# Infra Monitoring

Un service en panne en prod, c'est 5 minutes de silence radio avant qu'un client appelle. Un service dégradé (lent, avec erreurs sporadiques), c'est 30 minutes de frustration silencieuse. Le monitoring détecte les dégradations **avant** qu'elles deviennent des pannes. Ce skill définit quoi surveiller, à quel seuil alerter, et comment réagir.

## Philosophie

Le monitoring n'est pas juste "regarder les graphiques". C'est une alerte précoce qui donne à l'équipe 10 minutes pour fixer un problème au lieu de 10 minutes de réaction panique. Les métriques que tu ne regardes pas ne peuvent pas te sauver.

## Métriques à surveiller

### 1. Container Fly.io (Backend)

| Métrique | Type | Seuil WARNING | Seuil CRITICAL | Source |
|----------|------|--------------|----------------|--------|
| **CPU usage** | gauge | > 60% | > 85% | `fly metrics ...` |
| **Memory usage** | gauge | > 70% | > 90% | `fly metrics ...` |
| **Disk usage** (si applicable) | gauge | > 75% | > 90% | `df -h` via SSH |
| **Request latency p95** | histogram | > 500ms | > 2000ms | Fly.io logs + APM |
| **Error rate** | counter | > 1% | > 5% | HTTP 5xx / total requests |
| **Connection pool exhausted** | event | Any | Critical | PostgreSQL logs |
| **OOM killer invoked** | event | Any | Critical | Container logs |

**Dashboard à consulter** : Fly.io web UI → `aims-api` → Metrics

```bash
# Commande CLI pour vérifier manuellement
fly metrics --app aims-api --window 5m

# Exemple de réponse :
# Count of requests, distributed by status code:
#   2xx: 4532 requests  ← ✅ normal
#   4xx: 123 requests   ← ⚠️ à vérifier si spike
#   5xx: 8 requests     ← ⚠️ watch
# CPU: 34%             ← ✅ normal
# Memory: 412MB        ← ✅ normal
```

### 2. Supabase Edge Functions

| Métrique | Type | Seuil WARNING | Seuil CRITICAL | Source |
|----------|------|--------------|----------------|--------|
| **Invocation latency** | histogram | > 1000ms | > 5000ms | Supabase Studio Logs |
| **Invocation error rate** | counter | > 2% | > 10% | Supabase Studio Logs |
| **Duration (cold start vs warm)** | histogram | Cold: > 2000ms | Cold: > 10000ms | Supabase Studio Logs |
| **Timeout** | counter | Any | Critical | HTTP 504 / Function logs |

**Dashboard** : Supabase Studio → `functions` → Logs/Monitoring

```bash
# Vérifier une function déployée (endpoint public)
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/webhook_handler \
  -H "Authorization: Bearer $ANON_KEY" \
  -w "HTTP %{http_code} — %{time_total}s\n" \
  -d '{"test": true}'

# Réponse attendue :
# HTTP 200 — 0.234s  ← ✅ normal
# HTTP 200 — 3.421s  ← ⚠️ lent (cold start possible)
# HTTP 504 — 0.001s  ← 🔴 timeout
```

### 3. PostgreSQL Database (Supabase)

| Métrique | Type | Seuil WARNING | Seuil CRITICAL | Source |
|----------|------|--------------|----------------|--------|
| **Connection count** | gauge | > 80 | > 100 (max default) | `SELECT count(*) FROM pg_stat_activity;` |
| **Active queries** | gauge | > 50 | > 100 | `SELECT count(*) FROM pg_stat_activity WHERE state = 'active';` |
| **Long-running queries (> 1min)** | counter | > 1 | > 5 | `SELECT ... WHERE query_start < now() - '1 min'::interval;` |
| **Replication lag** (si réplica) | gauge | > 100ms | > 1000ms | `SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()));` |
| **Disk space usage** | gauge | > 75% | > 90% | Supabase Dashboard → Database → Usage |
| **Transaction wraparound** | gauge | > 80% | > 95% | `SELECT age(datfrozenxid) FROM pg_database WHERE datname = 'postgres';` |
| **Index bloat** | gauge | > 20% | > 50% | `SELECT ... FROM pg_stat_user_indexes;` |

**Dashboard** : Supabase Studio → Database → Usage/Connections

```sql
-- Requête de santé DB à exécuter régulièrement
SELECT
  (SELECT count(*) FROM pg_stat_activity) as active_connections,
  (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_queries,
  pg_database_size('postgres') / 1024.0 / 1024.0 as db_size_mb;

-- Résultat attendu :
-- active_connections: 15    ← ✅ normal (< 80)
-- active_queries: 3         ← ✅ normal (< 50)
-- db_size_mb: 2345.67       ← Vérifier tendance
```

### 4. Network / API Endpoints

| Métrique | Type | Seuil WARNING | Seuil CRITICAL | Source |
|----------|------|--------------|----------------|--------|
| **HTTP response time (p95)** | histogram | > 500ms | > 2000ms | Logs + APM |
| **HTTP error rate (5xx)** | counter | > 1% | > 5% | HTTP logs |
| **DNS resolution time** | gauge | > 100ms | > 500ms | `dig` / `nslookup` |
| **TLS certificate expiry** | days | < 30 | < 7 | `curl -I` ou monitoring natif |

**Vérification manuelle** :

```bash
# Tester l'endpoint principal (frontend)
curl -w "@curl-format.txt" -o /dev/null -s https://aims.netlify.app

# Exemple format.txt :
# time_namelookup:   %{time_namelookup}\n
# time_connect:      %{time_connect}\n
# time_appconnect:   %{time_appconnect}\n
# time_pretransfer:  %{time_pretransfer}\n
# time_starttransfer: %{time_starttransfer}\n
# time_total:        %{time_total}\n

# Tester API backend
curl -w "HTTP %{http_code} — %{time_total}s\n" https://api.aims.fly.dev/health

# Vérifier certificat TLS
openssl s_client -connect api.aims.fly.dev:443 | grep "notAfter"
# Résultat : notAfter=Mar  6 23:59:59 2027 GMT  ← reste ~1 an ✅
```

## Seuils d'alerte et escalade

### WARNING (niveau 1)

Alerte non-critique. Surveiller et éventuellement notifier dev-orchestrator pour investigation douce. Ne pas réveiller un opérateur humain en pleine nuit.

**Exemples** :
- CPU 60% pendant 5 minutes (montée progressive)
- Latence p95 à 600ms (légèrement dégradée)
- Error rate 1.5% (quelques erreurs sporadiques)

**Action** :
1. Logger avec level `warn` dans le monitoring
2. Créer une tâche Desk `alert.warning` pour dev-orchestrator
3. Continuer à surveiller chaque minute

### CRITICAL (niveau 2)

Alerte grave. Réaction immédiate nécessaire. Escalader vers opérateur humain.

**Exemples** :
- CPU > 85% (risque d'OOM)
- Mémoire > 90% (conteneur va crash)
- Error rate > 5% (beaucoup de requêtes échouent)
- Latence p95 > 2000ms (utilisateurs en frustration)
- Database connections exhausted (plus d'accès à la BD)

**Action** :
1. Logger avec level `error` et trace_id complet
2. Créer une tâche Desk `escalation.infra_failure` pour opérateur humain
3. Notifier dev-orchestrator via escalade
4. Notifier clientele que le service est dégradé (via escalade)
5. Préparer un rollback si la cause est un déploiement récent

### Matrice d'escalade

| Condition | Niveau | Escalade vers | Action immédiate |
|-----------|--------|---------------|------------------|
| WARNING (cpu, latency, errors) | 1 | dev-orchestrator | Créer tâche d'investigation |
| CRITICAL (multi-métrique) | 2 | opérateur humain + dev-orchestrator | Préparer rollback, notifier client |
| Panne complète (tous endpoints down) | 2 | opérateur humain + dev-orchestrator + clientele | Escalade HUMAINE immédiate |
| Data loss ou corruption | 3 | opérateur humain (manuel) | Restore depuis backup, forensics |

## Health Checks

Un health check est un endpoint simple que le monitoring appelle régulièrement. S'il ne répond pas 200, il y a un problème.

### Frontend Health Check (Netlify)

```
Endpoint : GET https://aims.netlify.app/api/health
Fréquence : Chaque 1 minute
Timeout : 5 secondes
Response attendue :
{
  "status": "ok",
  "timestamp": "2026-03-06T14:32:15Z",
  "version": "v1.2.3"
}
```

**Contenu du endpoint** (`pages/api/health.ts`) :

```typescript
export default async function handler(req, res) {
  // Vérifier que la base de données répond
  const db = await supabase.from('desk_tasks').select('count').limit(1);

  if (db.error) {
    return res.status(503).json({ status: "error", error: db.error.message });
  }

  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION
  });
}
```

### Backend Health Check (Fly.io)

```
Endpoint : GET https://api.aims.fly.dev/health
Fréquence : Chaque 1 minute (aussi utilisé par Fly.io pour rolling deploy)
Timeout : 5 secondes
Response attendue :
{
  "status": "ok",
  "uptime_ms": 123456,
  "db": "connected",
  "timestamp": "2026-03-06T14:32:15Z"
}
```

**Contenu du endpoint** (Node.js / Express) :

```javascript
app.get('/health', async (req, res) => {
  try {
    // Vérifier une requête de base
    const result = await db.query('SELECT 1');

    res.json({
      status: 'ok',
      uptime_ms: process.uptime() * 1000,
      db: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      error: err.message
    });
  }
});
```

### Edge Function Health (Supabase)

```
Endpoint : POST https://<PROJECT_REF>.supabase.co/functions/v1/webhook_handler
Fréquence : Chaque 5 minutes (moins critique que API principal)
Timeout : 10 secondes
Test payload :
{
  "test": true,
  "ping": "pong"
}
Response attendu :
{
  "success": true,
  "message": "Function OK"
}
```

## Dashboard opérationnel

Un dashboard est le "poste de contrôle" du devops-silo. Doit montrer la santé globale en un coup d'œil, sans nécessiter de cliquer 10 fois.

### Composants du dashboard

1. **Status Overview**
   - Frontend Netlify : 🟢 OK / 🟡 WARN / 🔴 DOWN
   - Backend Fly.io : 🟢 OK / 🟡 WARN / 🔴 DOWN
   - Database Supabase : 🟢 OK / 🟡 WARN / 🔴 DOWN
   - Edge Functions : 🟢 OK / 🟡 WARN / 🔴 DOWN

2. **Metrics Panel** (dernières 24h)
   - CPU Usage (Fly.io) : graphe ligne montrant la tendance
   - Memory Usage (Fly.io) : graphe ligne montrant la tendance
   - Error Rate (5xx / total) : graphe colonnaire
   - Latency p95 : graphe ligne

3. **Alerts Panel**
   - Alertes WARNING depuis 1h
   - Alertes CRITICAL depuis 7 jours
   - Nombre d'incidents résolus aujourd'hui

4. **Database Panel**
   - Connection count actuel
   - Nombre de queries actives
   - Taille DB (tendance)
   - Index bloat %

5. **Deployment History** (derniers 10 déploiements)
   - Date / Heure
   - Version déployée
   - Composant (frontend / backend)
   - Statut (success / rollback)

### Tools pour le dashboard

- **Fly.io** : Dashboard natif `fly.io/dashboard` (web UI)
- **Supabase** : Supabase Studio → Database → Usage (web UI)
- **Netlify** : Netlify UI → Analytics (web UI)
- **Prometheus + Grafana** (optionnel) : Scraper les metrics et les centraliser

## Intégration avec silo-logging

L'agent devops-silo ne "loggue" pas directement. Tous les logs vont via le silo-logging (via Desk ou API centralisée).

```json
{
  "task_type": "log.event",
  "resource_type": "infrastructure",
  "resource_id": "infra.cpu.warning",
  "level": "warn",
  "message": "CPU usage high on aims-api container",
  "payload": {
    "component": "fly.io",
    "app": "aims-api",
    "metric": "cpu_usage",
    "value": 72,
    "threshold_warning": 60,
    "duration_minutes": 5,
    "timestamp": "2026-03-06T14:32:15Z"
  }
}
```

## Escalation de monitoring vers Desk

Quand une alerte déclenche, créer une tâche Desk pour que d'autres agents en soient avertis.

### Alerte WARNING

```json
{
  "task_type": "alert.warning",
  "priority": "medium",
  "to_agent": "dev-orchestrator",
  "payload": {
    "alert_id": "alert_cpu_warning_20260306_1432",
    "component": "fly.io/aims-api",
    "metric": "cpu_usage",
    "value": 72,
    "threshold": 60,
    "duration_minutes": 5,
    "trend": "increasing",
    "suggested_action": "Check for long-running queries or scale up container",
    "created_at": "2026-03-06T14:32:15Z"
  }
}
```

### Alerte CRITICAL

```json
{
  "task_type": "escalation.infra_failure",
  "priority": "critical",
  "to_agents": ["dev-orchestrator", "operator"],
  "cc_agents": ["clientele"],
  "payload": {
    "alert_id": "alert_db_connections_critical_20260306_1432",
    "component": "supabase/database",
    "metric": "active_connections",
    "value": 105,
    "threshold": 100,
    "max_capacity": 120,
    "error_detail": "No more connections available",
    "impact": "API endpoints timing out, users getting 503 errors",
    "immediate_actions": [
      "Kill idle connections with age > 10 minutes",
      "Scale up database instance (if possible)",
      "Enable connection pooling on application side"
    ],
    "created_at": "2026-03-06T14:32:15Z"
  }
}
```

## Anti-patterns

### Ignorer les alertes WARNING
- **Risque** : Une métrique montante (CPU 60% → 70% → 80%) devient CRITICAL en 30 minutes
- **Prévention** : Regarder les WARNING, ne pas attendre que ça devienne grave

### Alert fatigue
- **Risque** : 100 alertes triviales par jour = les gens les ignorent toutes
- **Prévention** : Bien calibrer les seuils. Un WARNING doit vraiment nécessiter une investigation

### Dashboard non mis à jour
- **Risque** : Dashboard affiche "CPU: 10%" mais l'API est en train de crash
- **Prévention** : Vérifier que les métriques se mettent à jour en temps réel (délai max 1–2 minutes)

### Health check trop simple
- **Risque** : L'endpoint `/health` répond 200 mais l'API n'arrive pas à accéder la BD
- **Prévention** : Health check doit inclure au minimum une vraie requête à la BD

### Pas de test de rollback en cas d'alerte
- **Risque** : Une alerte CRITICAL arrive, on panique, on rollback et ça casse encore plus
- **Prévention** : Chaque semaine, simuler un rollback manuel + vérifier que ça marche

### Scaling réactif sans monitoring
- **Risque** : Doublier le nombre d'instances Fly.io, pas vérifier que ça résout le problème
- **Prévention** : Toujours checker les métriques APRÈS un scale. Si CPU passe de 80% à 45%, ça a marché. Si ça reste 80%, c'est pas le problème.
