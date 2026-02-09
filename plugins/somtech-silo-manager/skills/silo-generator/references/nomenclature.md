# SomTech Silo Nomenclature Reference

## Slugs

- **client_slug**: lowercase, hyphens only, no accents
  - Example: `acme`, `globex`, `newco`
- **app_slug**: lowercase, hyphens only
  - Example: `erp`, `crm`, `saas-portal`
- **Combined**: `{client_slug}-{app_slug}`
  - Example: `acme-erp`

## Docker Containers

- **Pattern**: `silo-{client}-{app}-{role}`
- **Examples**:
  - `silo-acme-erp-clientele`
  - `silo-acme-erp-dev-worker-1`
  - `silo-acme-erp-dev-orchestrator`
- **Network**: `silo-{client}-{app}-net`

## Git Branches

- **Silo branch (permanent)**: `silo/{client}-{app}`
  - Example: `silo/acme-erp`
- **Feature branches**: `{type}/{ticket-id}-{description}`
  - Example: `feature/TKT-001-add-login`
- **Types**: `feature`, `fix`, `hotfix`, `chore`
  - NEVER use `silo` as a type — the `silo/` prefix is RESERVED for silo branches only

## Fly.io Dev-Env

- **Pattern**: `devenv-{client}-{app}-{service}`
- **Services**: `pg`, `rest`, `auth`, `kong`, `storage`, `studio`
- **Examples**:
  - `devenv-acme-erp-pg`
  - `devenv-acme-erp-kong`
- **URLs**: `https://devenv-{client}-{app}-{service}.fly.dev`
- **Kong URL (main API)**: `https://devenv-{client}-{app}-kong.fly.dev`

## Netlify

- **Branch deploy URL**: `https://silo-{client}-{app}--{site-name}.netlify.app`
- **Note**: Netlify replaces `/` with `-` in branch names and `--` separates branch from site name

## Slack Channels

- **Pattern**: `#{client}-{app}-{suffix}`
- **Suffixes**:
  - `demandes` (client requests)
  - `dev-branches` (development activity)
  - `validations` (PR validations)
  - `securite-alertes` (security alerts)
  - `securite-rapports` (security reports)
  - `devops-monitoring` (infrastructure updates)
- **Examples**:
  - `#acme-erp-demandes`
  - `#acme-erp-dev-branches`
  - `#acme-erp-securite-alertes`

## API Keys

- One API key per silo, scoped to the application
- **Pattern**: descriptive name like `silo-acme-erp`

## Constitution Files

- **Pattern**: `constitutions/{role}.md`
- **Roles**:
  - `clientele`
  - `dev-orchestrator`
  - `dev-worker`
  - `security-auditor`
  - `security-validator`
  - `devops`
