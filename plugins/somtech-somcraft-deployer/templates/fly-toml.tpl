# fly.toml — généré par somtech-somcraft-deployer
# Client : {{CLIENT_NAME}}
# Environnement : {{ENV}}

app = "{{APP_NAME}}"
primary_region = "{{PRIMARY_REGION}}"

[build]
  image = "ghcr.io/somtech-solutions/somcraft:{{SOMCRAFT_VERSION}}"

[env]
  NODE_ENV = "production"
  NEXT_TELEMETRY_DISABLED = "1"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]

  [[http_service.checks]]
    grace_period = "30s"
    interval = "30s"
    method = "GET"
    timeout = "10s"
    path = "/api/health"

[[vm]]
  memory = "2gb"
  cpu_kind = "shared"
  cpus = 1

[deploy]
  strategy = "immediate"
