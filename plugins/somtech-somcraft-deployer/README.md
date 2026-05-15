# somtech-somcraft-deployer

Claude Code plugin pour déployer SomCraft sur des clients existants.

## Commandes

- `/deploy-somcraft` — Déploiement initial d'une instance SomCraft pour un client
- `/deploy-somcraft-upgrade` — Mettre à jour une instance existante
- `/deploy-somcraft-status` — Inspection d'une instance déployée

## Skills installés

- **`somcraft`** (global, dans `~/.claude/skills/`) — Documentation de référence SomCraft
- **`somcraft-{client}`** (par projet, dans `.claude/skills/`) — Doc spécifique à l'instance du client

## Prérequis

- Projet client lié via `/lier-app` (présence de `.somtech/app.yaml`), `.mcp.json` (avec MCP Supabase), `fly.toml`
- Fly CLI authentifié (`fly auth whoami`)
- Image Docker SomCraft publiée (`ghcr.io/somtech-solutions/somcraft:X.Y.Z`)
- Accès Supabase du client via MCP

## Usage

Depuis le projet client :

```bash
/deploy-somcraft
```

Le CLI détecte la config, demande l'environnement cible (staging/production), présente un plan, puis exécute :

1. Pré-flight (vérifications)
2. Migrations Supabase via MCP
3. Seed initial (workspace + admin + API key)
4. Déploiement Fly.io (image Docker)
5. Smoke tests
6. Installation des skills de documentation
7. Rapport final

## Version

Ce plugin déploie SomCraft v0.4.2 (voir plugin.json → somcraftVersion).

Pour mettre à jour un client vers une nouvelle version :

```bash
/deploy-somcraft-upgrade
```
