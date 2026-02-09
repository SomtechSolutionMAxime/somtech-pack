# SomTech Silo Architecture Reference

## 7 Agent Containers per Silo

Each client/app gets a dedicated silo of 7 Docker containers:

| Container | Role | MCP Access | Responsibilities |
|-----------|------|------------|-----------------|
| clientele | Client relations | somtech-desk | Receives tickets, triages, routes to dev-orchestrator, communicates with client via Slack |
| dev-orchestrator | Work distribution | somtech-desk | Reads repo config, checks devenv status, requests devenv start, creates feature branches from silo branch, assigns work to dev-workers |
| dev-worker-1 | Development | somtech-desk, supabase (read-only) | Reads app context, codes features, writes tests, pushes to feature branch, merges into silo branch |
| dev-worker-2 | Development | somtech-desk, supabase (read-only) | Same as dev-worker-1 (parallel capacity) |
| security-auditor | Planned security audits | somtech-desk, supabase (read-only) | Scheduled scans (cron), vulnerability detection, creates security tickets |
| security-validator | Real-time PR validation | somtech-desk, supabase (read-only) | Validates every PR before merge, checks for security issues |
| devops | Infrastructure | somtech-desk, netlify (debug only), supabase | Starts/stops devenv Fly.io, applies migrations, monitors deploys, manages merge to main |

## Container Communication

- Agents communicate via the Service Desk MCP (tickets, comments, events)
- No direct container-to-container communication
- Each agent has its own API key scoped to the silo's application

## Docker Network

- Dedicated network per silo: `silo-{client}-{app}-net`
- Containers are isolated per silo (no cross-silo communication)

## Silo Lifecycle

States: `not_provisioned` → `provisioning` → `active` → `degraded` → `stopped` → `error`

## Core + Team + Silo Architecture

- **Core**: shared services (Service Desk, monitoring)
- **Team**: cross-silo coordination (core-comm, team-maquettes)
- **Silo**: per-client isolated agent group (THIS is what we generate)
