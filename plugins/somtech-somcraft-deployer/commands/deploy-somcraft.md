---
description: Déployer SomCraft sur un client existant (migrations Supabase + Fly.io + skills)
---

# /deploy-somcraft

Déployer une instance SomCraft pour un client existant, avec son propre Supabase et son organisation Fly.io.

## Ce que fait cette commande

1. **Pré-flight** : Détecte la config du projet courant (`.somtech/app.yaml` via /lier-app, .mcp.json, fly.toml) et demande l'environnement cible (staging ou production)
2. **Plan** : Affiche un résumé complet et demande confirmation
3. **Migrations Supabase** : Applique les migrations SomCraft via MCP Supabase
4. **Seed initial** : Crée le workspace initial, un admin, et une API key MCP
5. **Déploiement Fly.io** : Configure les secrets et déploie l'image Docker `ghcr.io/somtech-solutions/somcraft`
6. **Smoke tests** : Vérifie que l'instance répond
7. **Installation des skills** : Installe le skill global `somcraft` et génère le skill spécifique `somcraft-{client}`
8. **Rapport final** : Affiche URLs, credentials, clé API, prochaines étapes

## Prérequis

- Le projet courant doit être lié via `/lier-app` (présence de `.somtech/app.yaml`), et contenir : `.mcp.json`, `fly.toml`
- Fly CLI authentifié sur la bonne organisation
- MCP Supabase configuré pour le project_ref du client
- Image Docker publiée à la version dans `plugin.json`

## Exécution

**Invoke the `deploy-somcraft` skill to execute all phases.** The skill handles detection, confirmation, MCP calls, Fly.io CLI, smoke tests, and skill installation.
