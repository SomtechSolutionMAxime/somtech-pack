---
description: Mettre à jour une instance SomCraft existante vers la version courante du plugin
---

# /deploy-somcraft-upgrade

Mettre à jour une instance SomCraft déployée vers la version courante du plugin.

## Ce que fait cette commande

1. Lit `.claude/skills/somcraft-{client}/SKILL.md` pour détecter la version installée
2. Compare avec la `somcraftVersion` du plugin courant
3. Si déjà à jour, affiche un message et sort
4. Si plus ancienne :
   - Demande confirmation (migration DB + redéploiement)
   - Clone SomCraft à la nouvelle version
   - Détecte les migrations non appliquées (diff avec `schema_migrations`)
   - Applique les nouvelles migrations via MCP Supabase
   - **Provisionne / réconcilie le sidecar Gotenberg (export PDF) si version cible ≥ v0.31.0** — délègue à `tools/provision-gotenberg-sidecar.sh` du repo cloné (idempotent). Stage le secret `GOTENBERG_URL`.
   - `fly deploy` avec la nouvelle image Docker
   - Smoke test post-upgrade (dont export PDF si ≥ v0.31.0)
   - Met à jour l'historique dans le skill projet

## Important

- **Aucun rollback automatique.** En cas d'erreur, la commande affiche des instructions manuelles.
- L'image Docker de la nouvelle version doit être publiée sur `ghcr.io/somtech-solutions/somcraft`.
- Les migrations sont appliquées en ordre chronologique.
- **Upgrade vers ≥ v0.31.0** : le sidecar Gotenberg est **obligatoire** (l'export PDF y est délégué). L'étape de provisioning est intégrée à la Phase 4 du skill `deploy-somcraft` et est idempotente. Référence : `docs/operations/upgrade.md` du repo SomCraft, section « À LIRE AVANT TOUT UPGRADE ≥ v0.31.0 ».

## Exécution

**Invoke the `deploy-somcraft` skill with upgrade mode.** Pass `mode=upgrade` to skip the skeleton installation and only run migrations + redeploy.
