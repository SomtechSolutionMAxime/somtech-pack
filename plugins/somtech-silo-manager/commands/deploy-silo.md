---
description: Déployer un silo généré — containers Docker, branche Git, Netlify, dev-env Fly.io
argument-hint: "<client_slug> <app_slug>"
---

# /deploy-silo

Déployer un silo préalablement généré par `/generate-silo`.

## Prérequis

- Les configs doivent exister dans `config/silos/{client}-{app}/`
- Les secrets doivent être disponibles : `SOMTECH_DESK_API_KEY`, `NETLIFY_AUTH_TOKEN`
- Accès Docker, Fly CLI (`flyctl`), Git

## Comportement

1. **Vérifier les configs** — Confirmer que `config/silos/{client}-{app}/` existe et contient tous les fichiers attendus (docker-compose, fly/*.toml, constitutions, .env.template, slack-channels.json).

2. **Relire la fiche** — Via MCP `applications.get(client_slug, app_slug)` pour avoir les infos à jour.

3. **Présenter le plan de déploiement** — Afficher ce qui va être fait et demander confirmation :
   - Containers Docker à démarrer
   - Services Fly.io à provisionner
   - Branche Git à créer
   - Configuration Netlify à appliquer
   - Estimation du coût Fly.io

4. **Déployer les containers Docker** (7 agents) :
   ```
   docker compose -f docker-compose.silo-{client}-{app}.yml up -d
   ```
   Vérifier que chaque container démarre correctement.

5. **Provisionner le dev-env Fly.io** (6 services) :
   Pour chaque service (pg, rest, auth, kong, storage, studio) :
   ```
   flyctl apps create devenv-{client}-{app}-{service} --org {fly_org}
   flyctl deploy --config fly/{service}.toml --app devenv-{client}-{app}-{service}
   ```
   Appliquer les migrations sur Postgres.
   Récupérer les connection_info (URLs, anon_key, service_role_key).

6. **Créer la branche Git silo** :
   ```
   git branch silo/{client}-{app} main
   git push origin silo/{client}-{app}
   ```

7. **Configurer Netlify (UNE SEULE FOIS)** via MCP Netlify :
   - `netlify-project-services` → activer le branch deploy sur `silo/{client}-{app}`
   - `netlify-project-services` → set env vars du deploy context de la branche silo :
     - `VITE_SUPABASE_URL` = `https://devenv-{client}-{app}-kong.fly.dev`
     - `VITE_SUPABASE_ANON_KEY` = `{anon_key du devenv}`
     - `VITE_APP_ENV` = `development`
   - `netlify-deploy-services` → trigger le premier build de la branche silo
   - Attendre et confirmer que le deploy réussit
   - Récupérer le `silo_preview_url`

8. **Mettre à jour le Service Desk** via MCP Desk :
   - `update_silo_status(client, app, "active", { containers })` → marquer le silo actif
   - `log_silo_event(client, app, "provisioned", "silo-manager", { configs, urls })` → logger l'événement
   - `applications.update(client, app, { metadata.silo.silo_preview_url, metadata.silo.silo_deployed_at })` → sauvegarder l'URL de preview et la date

9. **Rapport final** — Afficher un résumé complet :
   - URL de preview silo : `https://silo-{client}-{app}--{site-name}.netlify.app`
   - URL Studio devenv : `https://devenv-{client}-{app}-studio.fly.dev`
   - URL Kong (API) : `https://devenv-{client}-{app}-kong.fly.dev`
   - Branche Git : `silo/{client}-{app}`
   - 7 containers démarrés
   - 6 channels Slack à créer (lister les noms)

## Gestion d'erreurs

- Si un service Fly.io échoue → rollback les services déjà créés, log l'erreur
- Si la branche Git existe déjà → demander confirmation avant d'écraser
- Si le build Netlify échoue → ne PAS mettre le silo à "active", le mettre à "error" avec le log de build
- Si un container Docker ne démarre pas → log l'erreur, proposer de continuer sans ce container

## Règles

- **JAMAIS de commit sur main** — on crée la branche silo depuis main, on ne touche pas à main
- **Config Netlify = ONE-TIME** — les env vars de la branche silo pointent vers des URLs Fly.io stables qui ne changent pas entre start/stop du devenv
- **Les secrets ne vont que dans les secrets managers** — Fly Secrets, Docker Secrets, Netlify env vars — jamais dans les fichiers
- **Demander confirmation avant chaque étape destructive** (création de branche, provisioning Fly.io)
