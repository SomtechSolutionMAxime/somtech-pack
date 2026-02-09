# SomTech Silo Manager

Plugin Claude Code pour générer et déployer les silos d'agents IA. Transforme une fiche Application du Service Desk en silo opérationnel complet.

## Prérequis

| Secret | Source | Description |
|--------|--------|-------------|
| `SOMTECH_DESK_API_KEY` | Service Desk → API Keys | Clé API avec accès aux applications et silos |
| `NETLIFY_AUTH_TOKEN` | Netlify → User settings → Personal access tokens | Token d'équipe avec accès aux sites |

## Commandes

| Commande | Description |
|----------|-------------|
| `/generate-silo` | Générer toutes les configs d'un silo à partir de la fiche Application |
| `/deploy-silo` | Déployer un silo généré : containers, Git, Netlify, dev-env Fly.io |

## Workflow

```
/generate-silo acme erp
  1. Lit la fiche Application via MCP Desk
  2. Valide la complétude du metadata
  3. Génère : docker-compose, fly.toml, .env.template, constitutions, Slack channels
  4. Présente pour review humaine

/deploy-silo acme erp
  5. Lit les configs générées
  6. Déploie les containers Docker (7 agents)
  7. Provisionne le dev-env Fly.io (6 services)
  8. Crée la branche Git silo/{client}-{app}
  9. Configure Netlify (branch deploy + env vars) — UNE SEULE FOIS
  10. Met à jour le Service Desk (silo_status, silo_preview_url)
```

## Skills

| Skill | Description |
|-------|-------------|
| `silo-generator` | Génération des configs de silo à partir d'une fiche Application |
| `silo-deployer` | Déploiement d'un silo généré et configuration des plateformes |

## Fichiers générés par /generate-silo

```
config/silos/{client}-{app}/
├── docker-compose.silo-{client}-{app}.yml
├── fly/
│   ├── fly.pg.toml
│   ├── fly.rest.toml
│   ├── fly.auth.toml
│   ├── fly.kong.toml
│   ├── fly.storage.toml
│   └── fly.studio.toml
├── .env.template
├── constitutions/
│   ├── clientele.md
│   ├── dev-orchestrator.md
│   ├── dev-worker.md
│   ├── security-auditor.md
│   ├── security-validator.md
│   └── devops.md
└── slack-channels.json
```
