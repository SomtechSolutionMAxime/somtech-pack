# Fly.io Dev-Environment Architecture
## SomTech Silo-Manager Plugin

This document describes the infrastructure and connection model for development environments deployed on Fly.io. Each silo can spin up an isolated Supabase instance with six microservices, all stable and reachable via permanent DNS names.

---

## Overview

A dev-env is a self-contained Supabase cluster running on Fly.io machines. It provides:

- Isolated PostgreSQL database per developer
- Auto-generated REST API (PostgREST)
- Authentication service (GoTrue)
- API gateway (Kong) as single entry point
- File storage service
- Optional Studio admin UI

**Key Principle:** Services have stable DNS names that persist across start/stop cycles. This eliminates the need to update environment variables when dev-envs restart.

---

## 6 Core Services Per Dev-Env

| Service | Fly App Name Pattern | Docker Image | Port | Protocol | Role |
|---------|---------------------|--------------|------|----------|------|
| **PostgreSQL** | `devenv-{c}-{a}-pg` | `supabase/postgres:15.1.1.78` | 5432 | TCP | Primary database; all data lives here |
| **PostgREST** | `devenv-{c}-{a}-rest` | `postgrest/postgrest:v12.0.1` | 3000 | HTTP | Auto-generated REST API; one endpoint per table |
| **GoTrue** | `devenv-{c}-{a}-auth` | `supabase/gotrue:v2.143.0` | 9999 | HTTP | Authentication; JWT token generation |
| **Kong** | `devenv-{c}-{a}-kong` | `kong:3.4` | 8000 | HTTP | API gateway; routes requests to PostgREST/GoTrue |
| **Storage** | `devenv-{c}-{a}-storage` | `supabase/storage-api:v0.43.11` | 5000 | HTTP | File upload/download via S3-compatible API |
| **Studio** | `devenv-{c}-{a}-studio` | `supabase/studio:20240101` | 3000 | HTTP | Admin UI (optional; can disable in config) |

**Legend:** `{c}` = client_slug, `{a}` = app_slug

### Service Interactions

```
supabase-js client (dev-worker)
            ↓
    Kong (gateway)
       ↙    ↓    ↘
  PostgREST  GoTrue  Storage
       ↓
   PostgreSQL
```

The dev-worker connects ONLY to Kong. Kong internally routes to other services.

---

## Stable DNS Names (Critical Design)

Each service has a permanent Fly DNS name:

```
https://devenv-{client}-{app}-pg.fly.dev          (PostgreSQL, port 5432)
https://devenv-{client}-{app}-rest.fly.dev        (PostgREST, port 3000)
https://devenv-{client}-{app}-auth.fly.dev        (GoTrue, port 9999)
https://devenv-{client}-{app}-kong.fly.dev        (Kong gateway, port 8000) ← PRIMARY
https://devenv-{client}-{app}-storage.fly.dev     (Storage, port 5000)
https://devenv-{client}-{app}-studio.fly.dev      (Studio, port 3000) ← ADMIN
```

### Why Stability Matters

1. **Netlify Environment Variables** are set once at silo creation:
   ```
   VITE_SUPABASE_URL=https://devenv-acme-erp-kong.fly.dev
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   These NEVER change, even when dev-env stops and restarts.

2. **Dev-Worker No-Reconfiguration:**
   - Worker agent receives `SUPABASE_URL` once from Service Desk
   - Uses it for entire work session
   - No need to poll for updated URLs on restart

3. **Persistent Internal State:**
   - Fly machines can scale to 0 (cost optimization)
   - DNS names remain valid
   - Data persists in PostgreSQL volume
   - When machines restart, same URLs work immediately

---

## Connection Information (Temporary, Runtime-Only)

When a dev-env is **running**, the following connection data is available in the Service Desk (secured MCP server):

```json
{
  "silo_id": "acme-erp-silo-001",
  "status": "running",
  "started_at": "2024-02-09T10:15:00Z",
  "connection_info": {
    "supabase_url": "https://devenv-acme-erp-kong.fly.dev",
    "supabase_anon_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "supabase_service_role_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "db_connection_string": "postgres://postgres:secretpassword@devenv-acme-erp-pg.fly.dev:5432/postgres",
    "db_password": "secretpassword",
    "studio_url": "https://devenv-acme-erp-studio.fly.dev",
    "silo_preview_url": "https://silo-acme-erp--prod.netlify.app"
  },
  "services": {
    "postgres": { "status": "running", "machine_id": "abc123def456" },
    "postgrest": { "status": "running", "machine_id": "abc123def457" },
    "gotrue": { "status": "running", "machine_id": "abc123def458" },
    "kong": { "status": "running", "machine_id": "abc123def459" },
    "storage": { "status": "running", "machine_id": "abc123def460" },
    "studio": { "status": "running", "machine_id": "abc123def461" }
  }
}
```

### Connection Info Lifecycle

| Phase | Status | Connection Data | Who Can Access |
|-------|--------|-----------------|-----------------|
| **Provisioning** | Creating machines | Partial (DNS names only) | DevOps agent |
| **Running** | All services healthy | Full (keys + URLs) | All agents via Service Desk |
| **Degraded** | One+ service down | Full but flagged as unsafe | DevOps + security auditor |
| **Stopping** | Scaling machines to 0 | DELETED from Service Desk | None (unavailable) |
| **Stopped** | All machines at 0 | EMPTY; stored in metadata | None (must restart to use) |

**Critical Rule:** When a dev-env **stops**, all connection info is deleted from the Service Desk to prevent dev-workers from attempting to use stale URLs.

---

## Security Model

### Anon Key vs. Service Role Key

**Anon Key (Public-Safe):**
- Readable by Netlify frontend builds
- Used by `supabase-js` client-side code
- Subject to Row-Level Security (RLS) policies
- Cannot bypass RLS even with elevated permissions
- Safe to expose in frontend code

**Service Role Key (Highly Sensitive):**
- ONLY accessible to DevOps agent via `get_app_context`
- NEVER exposed to dev-worker or frontend
- Bypasses RLS; full database access
- Used for admin operations, migrations, seeding
- If leaked, entire database compromised

### Access Control Matrix

| Agent | Anon Key | Service Role Key | DB Password | Connection String |
|-------|----------|------------------|-------------|-------------------|
| dev-worker | ✓ (via supabase-js) | ✗ | ✗ | ✗ |
| dev-orchestrator | ✓ (read-only) | ✗ | ✗ | ✗ |
| devops | ✓ | ✓ | ✓ | ✓ |
| security-auditor | ✗ | ✗ | ✗ | ✓ (logs only) |
| clientele | ✗ | ✗ | ✗ | ✗ |

---

## Auto-Stop Mechanism

Dev-envs are expensive to run continuously. They auto-stop after inactivity.

### Configuration

```json
{
  "devenv": {
    "devenv_enabled": true,
    "auto_stop_minutes": 30,
    "fly_region": "yul"
  }
}
```

### Behavior

1. **Activity Detection:** Fly.io monitors machine CPU and memory
2. **Inactivity Timer:** If no traffic for `auto_stop_minutes`, machines scale to 0
3. **Cost Savings:** Stopped machines incur no compute charges (only storage volume)
4. **Restart:** Dev-worker or devops can restart via `POST /start-silo`
5. **Warm-Up Time:** Restart takes 30-60 seconds (machines pull Docker images)

### Manual Control

```bash
# DevOps agent commands
POST /start-silo { silo_id: "acme-erp" }
POST /stop-silo { silo_id: "acme-erp" }
GET /silo-status { silo_id: "acme-erp" }
```

---

## Fly.toml Template

Each service gets its own Fly app with a `fly.toml` configuration. Below is a template for the **Kong gateway** service; other services follow the same pattern with appropriate image and port changes.

### Kong Service (devenv-{c}-{a}-kong)

```toml
app = "devenv-acme-erp-kong"
primary_region = "yul"

[build]
  image = "kong:3.4"

[env]
  KONG_PROXY_ACCESS_LOG = "/dev/stdout"
  KONG_ADMIN_ACCESS_LOG = "/dev/stdout"
  KONG_PROXY_ERROR_LOG = "/dev/stderr"
  KONG_ADMIN_ERROR_LOG = "/dev/stderr"
  KONG_LOG_LEVEL = "notice"

[services]
  [[services.ports]]
    handlers = ["http"]
    port = 80
    force_https = true

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

  [[services.tcp_checks]]
    interval = "10s"
    timeout = "5s"
    grace_period = "30s"

[processes]
  api = "kong start -c /etc/kong/kong.conf"

[mounts]
  source = "kong_data"
  destination = "/usr/local/kong/data"

[build.args]
  KONG_PLUGINS = "cors,key-auth,jwt,rate-limiting"

[autoscaling]
  max_machines = 3
  min_machines = 1
  policies = [
    {
      type = "cpu_percentage_avg"
      threshold = 80
      scale_down_threshold = 20
    }
  ]

[env]
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
```

### PostgreSQL Service (devenv-{c}-{a}-pg)

```toml
app = "devenv-acme-erp-pg"
primary_region = "yul"

[build]
  image = "supabase/postgres:15.1.1.78"

[services]
  [[services.ports]]
    internal_port = 5432
    external_port = 5432
    protocol = "tcp"

  [[services.tcp_checks]]
    interval = "10s"
    timeout = "5s"
    grace_period = "30s"

[mounts]
  source = "postgres_data"
  destination = "/var/lib/postgresql/data"

[env]
  POSTGRES_PASSWORD = "secure_password_here"
  POSTGRES_DB = "postgres"
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
```

### PostgREST Service (devenv-{c}-{a}-rest)

```toml
app = "devenv-acme-erp-rest"
primary_region = "yul"

[build]
  image = "postgrest/postgrest:v12.0.1"

[services]
  [[services.ports]]
    handlers = ["http"]
    port = 80
    force_https = true

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

[env]
  PGRST_DB_URI = "postgres://postgres:password@devenv-acme-erp-pg.fly.dev:5432/postgres"
  PGRST_DB_SCHEMA = "public"
  PGRST_DB_ANON_ROLE = "anon"
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
```

### GoTrue Service (devenv-{c}-{a}-auth)

```toml
app = "devenv-acme-erp-auth"
primary_region = "yul"

[build]
  image = "supabase/gotrue:v2.143.0"

[services]
  [[services.ports]]
    internal_port = 9999
    external_port = 9999
    protocol = "http"

[env]
  GOTRUE_JWT_SECRET = "super_secret_jwt_key_min_32_chars_long"
  GOTRUE_DB_DRIVER = "postgres"
  DATABASE_URL = "postgres://postgres:password@devenv-acme-erp-pg.fly.dev:5432/postgres"
  GOTRUE_SITE_URL = "https://silo-acme-erp--prod.netlify.app"
  GOTRUE_URI_ALLOW_LIST = "https://silo-acme-erp--prod.netlify.app,https://localhost:3000"
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
```

---

## Dev-Env Lifecycle

### Phase 1: Provisioning (silo-generator)

```
1. Create 6 Fly apps with unique names
2. Generate secrets (JWT, DB password, API keys)
3. Deploy services in order: postgres → postgrest → gotrue → kong → storage → studio
4. Wait for health checks to pass (typically 2-3 minutes)
5. Store connection_info in Service Desk
6. Update metadata.silo.silo_status = "active"
```

**Metadata Update:**
```json
{
  "devenv": {
    "devenv_status": "running",
    "fly_app_prefix": "devenv-acme-erp",
    "last_started_at": "2024-02-09T10:15:00Z"
  }
}
```

### Phase 2: Running (dev-worker / dev-orchestrator)

- Dev-worker requests connection info via `get_app_context()`
- Service Desk returns anon_key + supabase_url
- Dev-worker initializes supabase-js client
- Makes API calls to Kong gateway
- Dev-env auto-stops after `auto_stop_minutes` of inactivity

**Service Desk Response:**
```json
{
  "supabase_url": "https://devenv-acme-erp-kong.fly.dev",
  "supabase_anon_key": "eyJ...",
  "silo_preview_url": "https://silo-acme-erp--prod.netlify.app"
}
```

### Phase 3: Stopping (devops / auto-stop timer)

```
1. Fly.io scales machines to 0 (zero compute cost)
2. Storage volumes persist (small cost)
3. Connection info DELETED from Service Desk
4. Update metadata.devenv.silo_status = "stopped"
5. Update metadata.devenv.last_stopped_at
```

### Phase 4: Restart (devops / on-demand)

```
1. Receive POST /start-silo request
2. Scale machines from 0 to 1 (or configured count)
3. Wait for health checks (30-60 seconds)
4. Regenerate connection_info (same DNS names, possibly new keys)
5. Store in Service Desk
6. Update metadata.devenv.silo_status = "running"
```

**Note:** DNS names stay the same, but JWT keys may be rotated. Frontend env vars (which store JWT keys) are updated automatically by Netlify during deployment.

---

## Fly Region Selection

### Recommended Regions

| Region | Code | Location | Latency (from Toronto) | Use Case |
|--------|------|----------|------------------------|----------|
| Montreal | `yul` | Montréal, Canada | ~0ms | Primary (SomTech HQ) |
| Seattle | `sea` | Seattle, USA | ~40ms | US West Coast clients |
| San Francisco | `sfo` | San Francisco, USA | ~50ms | US West Coast (alt) |
| Ashburn | `iad` | Virginia, USA | ~10ms | US East Coast |
| Amsterdam | `ams` | Netherlands | ~80ms | European clients |
| Johannesburg | `jnb` | South Africa | ~150ms | African clients |

**Metadata Default:**
```json
{
  "devenv": {
    "fly_region": "yul"
  }
}
```

### Change Region

To move a dev-env to a different region:
1. Stop current dev-env
2. Create new dev-env in target region
3. Update metadata.devenv.fly_region
4. Migrate data (if needed)
5. Update client to use new URL

---

## RLS Mode Configuration

Row-Level Security can be tuned for different dev phases.

| Mode | RLS Enforced | Use Case |
|------|------------|----------|
| `production` | Yes, strict | Feature development with realistic security model |
| `permissive` | Partially | Fast iteration; some RLS policies disabled |
| `disabled` | No | Quick debugging; full database visibility |

**Metadata:**
```json
{
  "devenv": {
    "rls_mode": "production"
  }
}
```

**Implementation** (in PostgreSQL):
```sql
-- Production mode
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY projects_own ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

-- Permissive mode (some policies disabled)
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;

-- Disabled mode (no RLS checks)
-- All policies disabled; full access to all data
```

---

## Monitoring & Troubleshooting

### Service Desk Status Endpoint

```bash
GET /silo-status?silo_id=acme-erp-silo-001
```

**Response:**
```json
{
  "silo_id": "acme-erp-silo-001",
  "overall_status": "active",
  "services": {
    "postgres": {
      "status": "running",
      "cpu_percent": 15,
      "memory_mb": 320,
      "uptime_seconds": 3600
    },
    "kong": {
      "status": "running",
      "cpu_percent": 8,
      "memory_mb": 128,
      "uptime_seconds": 3600
    },
    "postgrest": {
      "status": "running",
      "cpu_percent": 5,
      "memory_mb": 96,
      "uptime_seconds": 3600
    },
    "gotrue": {
      "status": "running",
      "cpu_percent": 3,
      "memory_mb": 64,
      "uptime_seconds": 3600
    },
    "storage": {
      "status": "running",
      "cpu_percent": 2,
      "memory_mb": 48,
      "uptime_seconds": 3600
    },
    "studio": {
      "status": "running",
      "cpu_percent": 1,
      "memory_mb": 32,
      "uptime_seconds": 3600
    }
  },
  "inactivity_seconds": 300,
  "auto_stop_trigger_in_seconds": 1800,
  "last_request_at": "2024-02-09T10:45:00Z"
}
```

### Common Issues

**Issue:** Dev-worker gets 502 from Kong
- **Check:** Is Kong service running? `GET /silo-status`
- **Fix:** If stopped, restart: `POST /start-silo`

**Issue:** Connection string times out
- **Check:** Is PostgreSQL machine allocated? Check machine_id in status
- **Fix:** Scale PostgreSQL: `fly scale count postgres=1`

**Issue:** JWT token rejected
- **Check:** Was dev-env restarted? Keys may have rotated
- **Fix:** Get new `supabase_anon_key` from Service Desk

---

## Cost Estimation (Monthly)

Assuming **Montreal region** with **1 dev-env per app**, **8 hour/day active**:

| Service | Machine Size | Monthly Hours | Cost |
|---------|--------------|---------------|------|
| PostgreSQL | shared-cpu-1x | 240 | $10 |
| Kong | shared-cpu-1x | 240 | $10 |
| PostgREST | shared-cpu-1x | 240 | $10 |
| GoTrue | shared-cpu-1x | 240 | $10 |
| Storage | shared-cpu-1x | 240 | $10 |
| Studio | shared-cpu-1x | 240 | $10 |
| **Storage Volume (50GB)** | — | — | $30/month |
| **Egress (1TB)** | — | — | $30/month |
| **Total** | — | — | **~$130/month** |

**Savings with Auto-Stop:** If auto-stop is enabled (default 30 min), effective cost drops to ~$20/month per dev-env.

---

## Fly.io Account Requirements

Before deploying dev-envs:

1. **Fly.io Organization Created:** Must exist and be accessible to DevOps agent
2. **API Token:** Stored securely in environment; used by silo-generator
3. **Payment Method:** Valid credit card on file
4. **Resource Limits:** Default limits should be sufficient; request increase if needed
5. **Volumes:** At least 50GB quota per organization for dev-env storage

**Metadata Prerequisite:**
```json
{
  "devenv": {
    "fly_org": "acme-erp",
    "fly_region": "yul",
    "devenv_enabled": true
  }
}
```

DevOps validates these before provisioning.

---

## Integration with Netlify

When Netlify frontend is deployed for the silo:

1. **Build Time:** Netlify pulls `SUPABASE_URL` and `SUPABASE_ANON_KEY` from env vars
2. **Deploy:** Frontend is built and deployed to preview URL
3. **Runtime:** Frontend makes requests to Kong: `https://devenv-acme-erp-kong.fly.dev`
4. **Persistence:** URL never changes, so redeploys don't require env var updates

**Netlify Env Var Setup (One-Time):**
```
VITE_SUPABASE_URL=https://devenv-acme-erp-kong.fly.dev
VITE_SUPABASE_ANON_KEY=eyJ...
```

**Note:** Service role key is NOT exposed to Netlify (security best practice).

---

## Next Steps

For operational procedures, see:
- `silo-generator` skill documentation for provisioning
- `devops` agent constitution for manual operations
- Service Desk API reference for connection info retrieval
