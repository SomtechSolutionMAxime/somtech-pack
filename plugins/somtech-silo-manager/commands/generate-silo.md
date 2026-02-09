---
description: Générer toutes les configs d'un silo d'agents IA à partir de la fiche Application du Service Desk
argument-hint: "<client_slug> <app_slug>"
---

# /generate-silo

Lancer la génération complète des configs d'un silo à partir de la fiche Application.

## Comportement

1. **Récupérer les slugs** — Si les arguments `client_slug` et `app_slug` sont fournis, les utiliser. Sinon, lister les applications via MCP `applications.list` et demander laquelle configurer.

2. **Lire la fiche Application** — Via MCP `applications.get(client_slug, app_slug)`. Extraire le `metadata` JSONB complet.

3. **Valider la complétude** — Vérifier que les 10 sections metadata sont renseignées. Lister les champs manquants et demander à l'humain de les compléter ou de fournir les valeurs manquantes.

4. **Lire les références** — Charger les fichiers `references/` du skill `silo-generator` :
   - `architecture-silos.md` — Architecture des 7 agents et leurs rôles
   - `nomenclature.md` — Conventions de nommage SomTech
   - `metadata-schema.md` — Structure complète du metadata JSONB
   - `constitution-template.md` — Template de constitution d'agent
   - `devenv-flyio.md` — Architecture dev-env Fly.io (6 services)

5. **Générer les fichiers** dans `config/silos/{client}-{app}/` :

   a. `docker-compose.silo-{client}-{app}.yml` — 7 containers :
      - clientele, dev-orchestrator, dev-worker-1, dev-worker-2
      - security-auditor, security-validator, devops
      - Chaque container a ses env vars (SOMTECH_DESK_API_KEY, rôle, slugs)

   b. `fly/*.toml` — 6 fichiers Fly.io pour le dev-env :
      - pg, rest, auth, kong, storage, studio
      - Nommage : `devenv-{client}-{app}-{service}`
      - Région : depuis `metadata.devenv.fly_region`

   c. `.env.template` — Variables d'environnement requises (noms seulement, PAS les valeurs) extraites de `metadata.env_vars_template`

   d. `constitutions/` — 6 fichiers Markdown (un par rôle d'agent) :
      - Générés à partir du template + données de la fiche
      - Chaque constitution contient : rôle, outils MCP autorisés, conventions, stack technique
      - Respecter la matrice d'accès MCP (section 4.1 du plan)

   e. `slack-channels.json` — Liste des channels Slack à créer :
      - Format : `#{client}-{app}-{suffixe}` pour chaque channel
      - Suffixes : demandes, dev-branches, validations, securite-alertes, securite-rapports, devops-monitoring

6. **Présenter le résultat** — Afficher un résumé des fichiers générés et demander validation humaine avant de passer à `/deploy-silo`.

## Règles

- **Ne JAMAIS inclure de valeurs de secrets** dans les fichiers générés — uniquement des placeholders `${VARIABLE_NAME}`
- **Respecter la nomenclature** SomTech pour tous les noms (voir `references/nomenclature.md`)
- **Adapter les constitutions** à la stack technique de l'app (React vs Vue, Supabase vs Postgres direct, etc.)
- **Ne PAS déployer** — `/generate-silo` génère uniquement, `/deploy-silo` déploie
