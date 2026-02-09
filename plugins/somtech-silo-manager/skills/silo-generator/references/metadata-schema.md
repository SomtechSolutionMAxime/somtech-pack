# Metadata Schema Reference
## SomTech Silo-Manager Plugin

This document defines the complete schema of the `metadata` JSONB field in the `applications` table. Claude Code reads this schema during silo generation to validate completeness and consistency.

---

## 1. Identity Section (REQUIRED)

**Purpose:** Uniquely identify the client and application within the silo ecosystem.

**Who Consumes It:** All agents, silo-generator skill, client-facing tools.

**Fields:**

| Field | Type | Required | Example | Validation |
|-------|------|----------|---------|-----------|
| `client_slug` | string | YES | "acme" | Lowercase alphanumeric, max 20 chars, no spaces |
| `app_slug` | string | YES | "erp" | Lowercase alphanumeric, max 20 chars, no spaces |
| `client_name` | string | YES | "ACME Corp" | Human-readable, 2-100 chars |

**Validation Rules:**
- `client_slug` + `app_slug` combination must be globally unique
- Both slugs must match `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`
- `client_name` must not contain leading/trailing whitespace

---

## 2. Repo Section (REQUIRED)

**Purpose:** Define repository location, structure, and branching conventions.

**Who Consumes It:** silo-generator, dev-orchestrator, security-validator.

**Fields:**

| Field | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| `repo_url` | string | YES | "github.com/somtech/acme-erp" | Full HTTPS URL, no protocol prefix |
| `repo_provider` | enum | YES | "github" \| "gitlab" \| "bitbucket" | Determines API client used |
| `default_branch` | string | YES | "main" | Must exist in remote repo |
| `silo_branch` | string | YES | "silo/acme-erp" | Created automatically, protected |
| `branch_convention` | string | YES | "{type}/{ticket-id}-{description}" | Enforced by pre-commit hooks |
| `is_monorepo` | boolean | NO | false | If true, `monorepo_path` is required |
| `monorepo_path` | string | CONDITIONAL | "packages/erp" | Required if `is_monorepo` is true |
| `pr_template` | string | NO | ".github/pull_request_template.md" | Relative path to template file |

**Validation Rules:**
- `repo_url` must be accessible and valid Git repository
- `default_branch` must exist and be the primary development branch
- `silo_branch` must follow convention: `silo/{client_slug}-{app_slug}` or similar
- `branch_convention` must contain at least one placeholder (`{type}`, `{ticket-id}`, etc.)
- If `is_monorepo` is true, `monorepo_path` must point to existing directory
- `pr_template` path, if specified, must exist in repository

---

## 3. Frontend Section (REQUIRED)

**Purpose:** Configure static site deployment and build settings.

**Who Consumes It:** silo-generator, devops, security-validator.

**Fields:**

| Field | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| `provider` | enum | YES | "netlify" \| "vercel" \| "cloudflare-pages" \| "fly" | Deployment platform |
| `site_id` | string | YES | "acme-erp-prod" | Provider-specific identifier |
| `team_slug` | string | YES | "somtech" | Netlify/Vercel team or Fly organization |
| `production_url` | string | YES | "https://erp.acmecorp.com" | Customer-facing production URL |
| `silo_preview_url` | string | NO | Auto-filled by `/deploy-silo` | Format: `https://silo-{c}-{a}--{site-name}.netlify.app` |
| `build_command` | string | YES | "npm run build" | Must exit 0 on success |
| `publish_dir` | string | YES | "dist" | Relative path to build output |
| `node_version` | string | NO | "20" | Semver or LTS version name |
| `env_vars_template` | object | YES | See section 9 | Pointer to env_vars_template section |

**Validation Rules:**
- `provider` must have valid API credentials configured
- `site_id` must match provider's naming conventions
- `production_url` must be valid HTTPS URL
- `build_command` must succeed when run from repo root
- `publish_dir` must exist after build completes
- `env_vars_template` must reference valid keys from section 9
- `silo_preview_url` is auto-filled by `/deploy-silo` skill; do not manually set

---

## 4. Database Section (REQUIRED)

**Purpose:** Configure database provider, version, and feature enablement.

**Who Consumes It:** silo-generator, devops, dev-worker agents.

**Fields:**

| Field | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| `provider` | enum | YES | "supabase-cloud" \| "supabase-selfhosted" \| "postgres-fly" \| "neon" \| "planetscale" | Database hosting platform |
| `project_ref` | string | YES | "xyzabcdef123" | Provider-specific project identifier |
| `project_url` | string | YES | "https://xyzabcdef123.supabase.co" | Base URL for API access |
| `region` | string | YES | "ca-central-1" | Geographic region for data residency |
| `pg_version` | string | NO | "15.1" | PostgreSQL version (Supabase-specific) |
| `has_migrations` | boolean | YES | true | Whether migrations are tracked |
| `migrations_path` | string | CONDITIONAL | "supabase/migrations" | Required if `has_migrations` is true |
| `features` | array | YES | `["auth", "storage", "realtime"]` | Enabled Supabase features |
| `db_plan` | string | NO | "pro" | Billing plan tier |

**Validation Rules:**
- `provider` must have valid connection credentials
- `project_ref` must match provider's format
- `region` must be supported by the provider
- `has_migrations` determines if version control is enabled
- If `has_migrations` is true, `migrations_path` must exist and contain `.sql` files
- `features` values must be from: `auth`, `storage`, `realtime`, `edge-functions`, `vectors`, `cron`
- `pg_version` is informational only; changing requires infrastructure update

---

## 5. Stack Section (REQUIRED)

**Purpose:** Document the application's technology stack for context injection into agent prompts.

**Who Consumes It:** dev-worker agents, security-auditor, claude-code IDE.

**Fields:**

| Field | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| `frontend_framework` | string | YES | "react" \| "vue" \| "svelte" \| "next" | Primary UI framework |
| `meta_framework` | string | NO | "vite" \| "next" \| "nuxt" | Meta-framework if applicable |
| `css_framework` | string | NO | "tailwindcss" \| "bootstrap" \| "material-ui" | CSS/styling library |
| `state_management` | string | NO | "zustand" \| "redux" \| "pinia" | Client-side state library |
| `auth_method` | string | YES | "supabase-auth" \| "clerk" \| "auth0" | Authentication provider |
| `api_pattern` | enum | YES | "supabase-js-direct" \| "rest-api" \| "graphql" \| "trpc" | Data fetching pattern |
| `language` | string | YES | "typescript" \| "javascript" | Primary language |
| `package_manager` | string | NO | "npm" \| "yarn" \| "pnpm" | Dependency manager |
| `test_framework` | string | NO | "vitest" \| "jest" \| "cypress" | Testing library |
| `lint_config` | string | NO | "eslint" \| "biome" | Linting configuration |

**Validation Rules:**
- All required fields must be non-empty strings
- Values should match known frameworks/tools (advisory, not enforced)
- `api_pattern` determines which supabase-js methods agents should recommend
- Stack information is used to customize code suggestions in agent prompts
- Mismatch between stack and code commits triggers security auditor warnings

---

## 6. Providers Section (OPTIONAL)

**Purpose:** Document third-party integrations (payment, CRM, email, etc.).

**Who Consumes It:** dev-worker agents, devops, security-auditor.

**Structure:**

```json
"providers": [
  {
    "name": "Stripe",
    "service": "stripe",
    "env_vars": ["STRIPE_PUBLISHABLE_KEY", "STRIPE_SECRET_KEY"],
    "docs_url": "https://docs.stripe.com/payments/quickstart",
    "notes": "PCI-DSS compliance required; keys rotated quarterly"
  },
  {
    "name": "SendGrid",
    "service": "sendgrid",
    "env_vars": ["SENDGRID_API_KEY"],
    "docs_url": "https://sendgrid.com/docs/",
    "notes": "Email delivery; unsubscribe list synced weekly"
  }
]
```

**Validation Rules:**
- Each provider must have unique `name` and `service`
- `env_vars` array must contain at least one variable
- `docs_url` must be valid HTTPS URL
- All env vars in this section must also be defined in `env_vars_template`

---

## 7. Client Section (REQUIRED)

**Purpose:** Store client contact information, SLA agreements, and communication preferences.

**Who Consumes It:** clientele agent, devops, silo-generator.

**Fields:**

| Field | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| `contacts` | array | YES | See below | Non-empty array of contact objects |
| `sla_response_hours` | integer | NO | 2 | Maximum hours to acknowledge issue |
| `sla_resolution_hours` | integer | NO | 24 | Maximum hours to resolve critical issue |
| `communication_language` | enum | YES | "en" \| "fr" | Default language for communications |
| `notification_preferences` | object | NO | See below | Slack/email/webhook preferences |
| `contract_notes` | string | NO | "Annual contract; renewal Feb 2025" | Internal notes about engagement |

**Contact Object Structure:**

```json
{
  "name": "John Doe",
  "role": "CTO",
  "email": "john@acmecorp.com",
  "slack_user_id": "U12345678",
  "is_primary": true
}
```

**Notification Preferences Object:**

```json
{
  "slack_channel": "#acme-dev",
  "slack_notify_critical": true,
  "email_notify_weekly_summary": false,
  "webhook_url": "https://hooks.slack.com/services/...",
  "quiet_hours": "18:00-08:00"
}
```

**Validation Rules:**
- `contacts` array must have at least one contact
- Exactly one contact must have `is_primary: true`
- Each contact email must be valid format
- `slack_user_id` must start with `U` (user) or `G` (group)
- `sla_response_hours` and `sla_resolution_hours` must be positive integers
- `communication_language` must be `en` or `fr`
- `webhook_url` must be valid HTTPS URL if provided
- `quiet_hours` must be in 24-hour format: `HH:MM-HH:MM`

---

## 8. Silo Section (AUTO-MANAGED)

**Purpose:** Runtime state of the silo. Managed automatically by silo-generator and deployment skills.

**Who Consumes It:** All agents (read-only for most), devops (write for status updates).

**Fields:**

| Field | Type | Auto-Set | Example | Notes |
|-------|------|----------|---------|-------|
| `silo_status` | enum | YES | "active" | Current operational status |
| `silo_deployed_at` | datetime | YES | "2024-02-09T10:30:00Z" | ISO 8601 timestamp |
| `containers` | object | YES | See below | Container health status |
| `slack_channels` | object | YES | See below | Silo-specific channels |
| `constitution_path` | string | YES | "agents/constitution-dev-worker.md" | Repo path to agent constitution |
| `conventions_overrides` | array | NO | `[{...}]` | Override standard conventions |

**Silo Status Values:**
- `not_provisioned` — Metadata created, no deployment yet
- `provisioning` — Deployment in progress
- `active` — Fully operational, ready for development
- `degraded` — Partial outage; some services unavailable
- `stopped` — Voluntarily halted; can restart
- `error` — Critical failure requiring intervention

**Containers Object:**

```json
{
  "postgres": {
    "enabled": true,
    "status": "running",
    "schedule": "always"
  },
  "postgrest": {
    "enabled": true,
    "status": "running",
    "schedule": "always"
  },
  "kong": {
    "enabled": true,
    "status": "running",
    "schedule": "always"
  }
}
```

**Slack Channels Object:**

```json
{
  "silo": "#acme-erp-silo",
  "deployments": "#acme-erp-deployments",
  "alerts": "#acme-erp-alerts",
  "standup": "#acme-erp-standup"
}
```

**Validation Rules:**
- `silo_status` must be one of the defined enum values
- `silo_deployed_at` must be valid ISO 8601 datetime
- `containers` keys must match available service names
- `constitution_path` must point to existing file in repository
- `slack_channels` values must start with `#` and be valid Slack channel names
- Do NOT manually modify `silo_status` or `silo_deployed_at`; use deployment skills

---

## 9. Env Vars Template Section (REQUIRED)

**Purpose:** Define all environment variables needed for the silo with their sources and sensitivity levels.

**Who Consumes It:** silo-generator, dev-orchestrator, devops, security-auditor.

**Structure:**

```json
"env_vars_template": {
  "supabase": {
    "SUPABASE_URL": {
      "source": "metadata.database.project_url",
      "description": "Supabase project URL",
      "sensitive": false
    },
    "SUPABASE_ANON_KEY": {
      "source": "devenv-connection-info",
      "description": "Supabase anonymous key for client-side requests",
      "sensitive": true
    },
    "SUPABASE_SERVICE_ROLE_KEY": {
      "source": "devenv-connection-info",
      "description": "Supabase service role key for server-side requests",
      "sensitive": true
    }
  },
  "providers": {
    "STRIPE_PUBLISHABLE_KEY": {
      "source": "stripe-dashboard",
      "description": "Stripe publishable key for client-side payments",
      "sensitive": false
    },
    "STRIPE_SECRET_KEY": {
      "source": "stripe-dashboard",
      "description": "Stripe secret key for server-side operations",
      "sensitive": true
    }
  },
  "app": {
    "VITE_APP_NAME": {
      "source": "metadata.identity.app_slug",
      "description": "Application name",
      "sensitive": false
    },
    "VITE_API_TIMEOUT": {
      "source": "config",
      "description": "API request timeout in milliseconds",
      "sensitive": false
    }
  }
}
```

**Validation Rules:**
- Each category (`supabase`, `providers`, `app`) must be an object
- Each variable must have `source`, `description`, and optional `sensitive` flag
- `source` must be one of:
  - `metadata.{path}` — Reference to metadata field
  - `devenv-connection-info` — Filled during devenv startup
  - `{provider}-dashboard` — Manual entry
  - `config` — Hardcoded or derived value
- `sensitive: true` variables must NEVER be logged or exposed in stack traces
- Variables with `source: "devenv-connection-info"` are auto-populated when devenv starts
- All variables referenced in `frontend.env_vars_template` must be defined here

---

## 10. Devenv Section (REQUIRED IF DEVENV ENABLED)

**Purpose:** Configure local development environment infrastructure on Fly.io.

**Who Consumes It:** dev-orchestrator, devops, dev-worker agents.

**Fields:**

| Field | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| `devenv_enabled` | boolean | YES | true | Enable/disable dev-env feature |
| `devenv_status` | enum | AUTO | "running" | Current runtime status |
| `fly_org` | string | CONDITIONAL | "somtech-dev" | Fly.io organization; required if enabled |
| `fly_region` | string | CONDITIONAL | "yul" | Fly.io region; required if enabled |
| `fly_app_prefix` | string | AUTO | "devenv-acme-erp" | Auto-generated prefix for service apps |
| `auto_stop_minutes` | integer | NO | 30 | Minutes of inactivity before auto-stop |
| `rls_mode` | enum | NO | "production" | Row-level security mode |
| `devenv_branch` | string | AUTO | "devenv/acme-erp" | Git branch for devenv configuration |
| `last_started_at` | datetime | AUTO | "2024-02-09T10:15:00Z" | ISO 8601 timestamp |
| `last_stopped_at` | datetime | AUTO | "2024-02-09T10:45:00Z" | ISO 8601 timestamp |

**Devenv Status Values:**
- `not_started` — Initialized but never started
- `running` — All services operational
- `starting` — Machines scaling up
- `stopping` — Machines scaling down
- `stopped` — Scaled to 0; waiting for restart
- `error` — Service failure requiring manual intervention

**RLS Mode Values:**
- `production` — RLS enforced; matches production security model
- `permissive` — RLS partially disabled for faster dev iteration
- `disabled` — RLS completely disabled (insecure; dev-only)

**Validation Rules:**
- `devenv_enabled` is independent; can be disabled even if other sections exist
- If `devenv_enabled: true`, then `fly_org` and `fly_region` are required
- `fly_org` must exist in Fly.io account
- `fly_region` must be valid Fly.io region (yul, sea, sfo, ams, etc.)
- `auto_stop_minutes` must be positive integer; 0 disables auto-stop
- `rls_mode` defaults to `production` for security
- Do NOT manually modify `devenv_status`, `fly_app_prefix`, `devenv_branch`, or timestamps
- Six Fly apps are automatically created: pg, rest, auth, kong, storage, studio

---

## Metadata Validation Checklist

Before deploying a silo, validate:

- [x] Identity: `client_slug`, `app_slug`, `client_name` present and valid
- [x] Repo: URL accessible, branches exist, convention defined
- [x] Frontend: Provider configured, site_id valid, build succeeds locally
- [x] Database: Provider credentials valid, migrations path exists (if applicable)
- [x] Stack: All required fields populated with sensible values
- [x] Client: At least one contact, exactly one is_primary, SLAs defined
- [x] Env Vars Template: All variables in `frontend.env_vars_template` match `env_vars_template`
- [x] Silo: constitution_path points to existing file
- [x] Devenv (if enabled): fly_org and fly_region valid, auto_stop_minutes positive

---

## Example Metadata (Minimal Valid)

```json
{
  "identity": {
    "client_slug": "acme",
    "app_slug": "erp",
    "client_name": "ACME Corp"
  },
  "repo": {
    "repo_url": "github.com/somtech/acme-erp",
    "repo_provider": "github",
    "default_branch": "main",
    "silo_branch": "silo/acme-erp",
    "branch_convention": "{type}/{ticket-id}-{description}",
    "is_monorepo": false
  },
  "frontend": {
    "provider": "netlify",
    "site_id": "acme-erp-prod",
    "team_slug": "somtech",
    "production_url": "https://erp.acmecorp.com",
    "build_command": "npm run build",
    "publish_dir": "dist",
    "env_vars_template": {}
  },
  "database": {
    "provider": "supabase-cloud",
    "project_ref": "xyzabcdef123",
    "project_url": "https://xyzabcdef123.supabase.co",
    "region": "ca-central-1",
    "has_migrations": true,
    "migrations_path": "supabase/migrations",
    "features": ["auth", "storage"]
  },
  "stack": {
    "frontend_framework": "react",
    "language": "typescript",
    "auth_method": "supabase-auth",
    "api_pattern": "supabase-js-direct"
  },
  "client": {
    "contacts": [
      {
        "name": "Jane Smith",
        "role": "Product Lead",
        "email": "jane@acmecorp.com",
        "slack_user_id": "U87654321",
        "is_primary": true
      }
    ],
    "communication_language": "en"
  },
  "env_vars_template": {
    "supabase": {
      "SUPABASE_URL": {
        "source": "metadata.database.project_url",
        "description": "Supabase project URL",
        "sensitive": false
      }
    },
    "providers": {},
    "app": {}
  },
  "silo": {
    "silo_status": "not_provisioned",
    "constitution_path": "agents/constitution-dev-worker.md"
  },
  "devenv": {
    "devenv_enabled": false
  }
}
```

---

## Notes for Claude Code Integration

1. **Lazy Validation:** Not all fields are validated at metadata creation; some checks happen at deployment time.
2. **Immutable Fields:** `client_slug`, `app_slug`, `repo_url`, and `repo_provider` should not change after initial setup.
3. **Auto-Fill Fields:** Silo status, timestamps, and devenv connection info are filled by automation; do not manually edit.
4. **Stack for Context Injection:** The `stack` section is used to customize code suggestions in agent prompts. Accuracy improves code quality.
5. **Env Vars for Security:** The `env_vars_template` is critical for the security auditor to detect hardcoded secrets. Keep it up-to-date.
