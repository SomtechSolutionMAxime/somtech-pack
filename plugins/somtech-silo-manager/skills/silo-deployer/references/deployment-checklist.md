# SomTech Silo-Manager Deployment Checklist

Operational step-by-step guide for the silo-deployer skill to execute deployment.

## Pre-flight
- [ ] config/silos/{client}-{app}/ exists and contains all files
- [ ] SOMTECH_DESK_API_KEY is set and valid (test with applications.list)
- [ ] NETLIFY_AUTH_TOKEN is set and valid (test with netlify-user-services)
- [ ] Docker daemon is running
- [ ] flyctl is installed and authenticated (flyctl auth whoami)
- [ ] Git remote origin is accessible
- [ ] Current branch is main (for branch creation)

## Step 1: Docker Deployment

```bash
# Deploy containers
docker compose -f config/silos/{client}-{app}/docker-compose.silo-{client}-{app}.yml up -d

# Verify all 7 containers are running
docker compose -f config/silos/{client}-{app}/docker-compose.silo-{client}-{app}.yml ps

# Expected: 7 containers with status "Up"
# - silo-{c}-{a}-clientele
# - silo-{c}-{a}-dev-orchestrator
# - silo-{c}-{a}-dev-worker-1
# - silo-{c}-{a}-dev-worker-2
# - silo-{c}-{a}-security-auditor
# - silo-{c}-{a}-security-validator
# - silo-{c}-{a}-devops
```

## Step 2: Fly.io Dev-Env

Order matters! Postgres first, then dependent services:

```bash
# 1. Postgres (must be first)
flyctl apps create devenv-{c}-{a}-pg --org {fly_org}
flyctl deploy --config config/silos/{c}-{a}/fly/fly.pg.toml --app devenv-{c}-{a}-pg

# 2. PostgREST (depends on Postgres)
flyctl apps create devenv-{c}-{a}-rest --org {fly_org}
flyctl deploy --config config/silos/{c}-{a}/fly/fly.rest.toml --app devenv-{c}-{a}-rest

# 3. GoTrue (depends on Postgres)
flyctl apps create devenv-{c}-{a}-auth --org {fly_org}
flyctl deploy --config config/silos/{c}-{a}/fly/fly.auth.toml --app devenv-{c}-{a}-auth

# 4. Kong (depends on PostgREST, GoTrue)
flyctl apps create devenv-{c}-{a}-kong --org {fly_org}
flyctl deploy --config config/silos/{c}-{a}/fly/fly.kong.toml --app devenv-{c}-{a}-kong

# 5. Storage (depends on Postgres, Kong)
flyctl apps create devenv-{c}-{a}-storage --org {fly_org}
flyctl deploy --config config/silos/{c}-{a}/fly/fly.storage.toml --app devenv-{c}-{a}-storage

# 6. Studio (depends on all — optional)
flyctl apps create devenv-{c}-{a}-studio --org {fly_org}
flyctl deploy --config config/silos/{c}-{a}/fly/fly.studio.toml --app devenv-{c}-{a}-studio
```

After deployment:
- Apply migrations: connect to pg and run migration SQL
- Generate JWT keys (anon_key, service_role_key)
- Verify Kong is accessible: curl https://devenv-{c}-{a}-kong.fly.dev/rest/v1/

## Step 3: Git Branch

```bash
git checkout main
git pull origin main
git branch silo/{client}-{app}
git push origin silo/{client}-{app}
```

If branch already exists, confirm with user before:

```bash
git checkout silo/{client}-{app}
git reset --hard main
git push origin silo/{client}-{app} --force
```

## Step 4: Netlify Configuration (ONE-TIME)

Via MCP netlify-project-services:
1. Get site info by site_id from metadata.frontend.site_id
2. Enable branch deploys for pattern "silo/*"
3. Set env vars for deploy context "branch:silo/{client}-{app}":
   - VITE_SUPABASE_URL = https://devenv-{c}-{a}-kong.fly.dev
   - VITE_SUPABASE_ANON_KEY = {anon_key}
   - VITE_APP_ENV = development

Via MCP netlify-deploy-services:
4. Trigger build for branch silo/{client}-{app}
5. Wait for build to complete (poll status)
6. Verify deploy is live: curl the silo preview URL

## Step 5: Update Service Desk

Via MCP somtech-desk:

```
1. update_silo_status(client, app, "active", containers_config)
2. log_silo_event(client, app, "provisioned", "silo-manager", { all_urls, branch, containers })
3. applications.update(client, app, {
     "metadata.silo.silo_status": "active",
     "metadata.silo.silo_deployed_at": "2026-02-09T...",
     "metadata.silo.silo_preview_url": "https://silo-{c}-{a}--{site}.netlify.app",
     "metadata.silo.containers": { ...7 containers with status "running" },
     "metadata.silo.slack_channels": { ...6 channels }
   })
```

## Post-deployment Verification

- [ ] All 7 Docker containers are running
- [ ] Kong responds at https://devenv-{c}-{a}-kong.fly.dev
- [ ] Netlify preview URL is live
- [ ] Service Desk shows silo_status = "active"
- [ ] silo_events has a "provisioned" entry
