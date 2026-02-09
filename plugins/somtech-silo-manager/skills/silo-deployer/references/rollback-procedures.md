# SomTech Silo-Manager Rollback Procedures

Recovery procedures for each deployment step in the silo-deployer skill.

## Docker Rollback

```bash
docker compose -f config/silos/{c}-{a}/docker-compose.silo-{c}-{a}.yml down -v
```

## Fly.io Rollback

Destroy apps in REVERSE order:

```bash
flyctl apps destroy devenv-{c}-{a}-studio --yes
flyctl apps destroy devenv-{c}-{a}-storage --yes
flyctl apps destroy devenv-{c}-{a}-kong --yes
flyctl apps destroy devenv-{c}-{a}-auth --yes
flyctl apps destroy devenv-{c}-{a}-rest --yes
flyctl apps destroy devenv-{c}-{a}-pg --yes
```

## Git Rollback

```bash
git push origin --delete silo/{client}-{app}
```

## Netlify Rollback

Via MCP netlify-project-services:
- Remove branch deploy env vars
- Disable branch deploy pattern

## Service Desk Rollback

```
update_silo_status(client, app, "not_provisioned")
log_silo_event(client, app, "error", "silo-manager", { reason, step_failed })
applications.update(client, app, {
  "metadata.silo.silo_status": "not_provisioned",
  "metadata.silo.silo_preview_url": null
})
```

## Partial Failure Rules

- If Docker fails: stop deployment, rollback Docker, log error. Don't proceed.
- If Fly.io fails at service N: destroy services 1..N, rollback Docker, log error.
- If Git fails: rollback Fly.io, Docker. Log error.
- If Netlify fails: set silo to "error" (not "not_provisioned" since containers are running), log the Netlify build error for manual investigation.
- NEVER leave Service Desk in inconsistent state — always update silo_status to reflect reality.
