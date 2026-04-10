---
description: Inspecter l'état d'une instance SomCraft déployée (version, Fly.io, Supabase)
---

# /deploy-somcraft-status

Inspection en lecture seule d'une instance SomCraft déployée pour le projet courant.

## Ce que fait cette commande

1. Lit `.claude/skills/somcraft-{client}/SKILL.md` du projet courant pour détecter la config
2. Affiche : client, version installée, date dernier déploiement, URLs
3. Exécute `fly status -a {app-staging}` et `fly status -a {app-prod}`
4. Requête Supabase via MCP pour compter workspaces, documents, users
5. Affiche un résumé en tableau

## Aucune modification

Cette commande ne modifie rien. Elle sert au monitoring et au debugging.

## Exécution

**Invoke the `deploy-somcraft` skill with status mode.** The skill reads project files, runs read-only CLI commands, and reports.
