---
name: deploy-pipeline
description: >
  Orchestrer les déploiements sur Netlify (frontend Next.js), Fly.io (containers
  Docker), et Supabase (Edge Functions). Ce skill guide l'agent devops-silo dans
  la validation pré-déploiement, l'exécution du déploiement, la vérification,
  la stratégie de rollback et le blue-green deployment. Utiliser ce skill chaque
  fois qu'une demande de déploiement arrive via Desk, d'une PR mergée sur main
  ou d'une demande manuelle de dev-orchestrator.
---

# Deploy Pipeline

L'objectif est d'avoir un déploiement rapide, fiable et prévisible. Une erreur de déploiement peut bloquer toute une équipe ou impacter les utilisateurs. Ce skill définit le workflow complet : réception de la demande, validation, déploiement, vérification, escalade ou confirmation.

## Philosophie

Un déploiement réussi n'est pas juste "le code qui s'exécute en prod". C'est un code testé, une base de données au bon état, une infrastructure saine, et une équipe capable de réagir en 5 minutes si quelque chose casse. Aller vite, c'est bien. Aller vite ET pouvoir rollback en 30 secondes, c'est mieux.

## Types de déploiement

### 1. Netlify auto-deploy (Frontend Next.js)

**Déclenché par** : Push sur `main` ou déploiement manuel via Netlify UI

**Processus** :
- GitHub webhook déclenche le build Netlify
- Build : `npm run build` (next build + lint zéro erreur)
- Deploy : Les fichiers générés sont servis globalement via CDN Netlify
- Rollback : Reverser le commit sur GitHub + GitHub push redéclenche un build des sources précédentes

**Fichiers clés** : `next.config.ts`, `tsconfig.json`, `.env.production`

**Durée estimée** : 3–5 minutes

### 2. Fly.io containers (Backend / Workers Docker)

**Déclenché par** : Tag Git (ex: `release/api-v1.2.3`) ou déploiement manuel via Fly CLI

**Processus** :
- Build Docker localement ou en CI (GitHub Actions)
- Push image vers Fly Registry
- Déploiement rolling : new instances lancées, anciennes arrêtées quand les nouvelles sont ready
- Health checks passent ? Trafic basculé progressivement
- Rollback : `fly scale count 0` (arrêter), relancer la version précédente avec `fly deploy --image <prev-tag>`

**Fichiers clés** : `Dockerfile`, `fly.toml`, `.dockerignore`

**Durée estimée** : 2–4 minutes

### 3. Supabase Edge Functions

**Déclenché par** : Déploiement manuel via `supabase functions deploy` ou depuis CI

**Processus** :
- Lister les Edge Functions à déployer (dans `supabase/functions/`)
- Compiler les TypeScript en JavaScript
- Déployer vers Supabase (fonction par fonction)
- Tester chaque fonction avec son endpoint public

**Fichiers clés** : `supabase/functions/`, `deno.json`

**Durée estimée** : 1–2 minutes

## Workflow de déploiement complet

```
Réception de deploy.request (Desk)
         │
         ├─→ Valider la source (main mergée, tag valide)
         │
         ├─→ Pre-deploy checklist
         │   ├─→ Tests verts sur la branche ?
         │   ├─→ Security gate passé ?
         │   ├─→ Migrations appliquées localement ?
         │   └─→ Env vars et secrets à jour ?
         │
         ├─→ Lancer le déploiement
         │   ├─→ Netlify build + deploy (si frontend changé)
         │   ├─→ Fly.io image build + rolling deploy (si backend changé)
         │   ├─→ Supabase Edge Functions (si functions changées)
         │   └─→ Attendre que tous les déploiements passent
         │
         ├─→ Post-deploy verification
         │   ├─→ Netlify : Vérifier que les endpoints /api/* répondent
         │   ├─→ Fly.io : Vérifier /health endpoint + métriques CPU/mémoire
         │   ├─→ Supabase : Tester un appel de fonction Edge
         │   └─→ Sanity checks : Aucune erreur 5xx, pas d'escalade d'erreurs en logs
         │
         ├─→ Publier les deploy.result et notifications client (via clientele)
         │
         └─→ [Succès] Déploiement complété
            [Échec] Rollback + escalade vers dev-orchestrator + opérateur humain
```

## Pre-deploy Checklist

Avant de lancer un déploiement, valider **tous** les points suivants. Aucune exception.

| Checklist | Vérification | Responsabilité |
|-----------|-------------|-----------------|
| **Tests** | `npm run test:ci` passé 100% sur la branche | CI/CD + devops-silo valide |
| **Lint** | `npm run lint` = zéro erreur, zéro warning en strict | CI/CD |
| **Security gate** | Audit de dépendances OK (pas de vulnérabilités `critical`) | security-validator a approuvé |
| **Migrations** | `supabase db reset` passé en local = migrations appliquées clean | dev-worker a exécuté |
| **Env vars** | Toutes les variables prod sont dans Netlify/Fly.io secrets manager | devops-silo valide |
| **Database backup** | Backup Supabase du jour précédent existe et est testable | infrastructure-team |
| **Rollback plan** | Avant déploiement, identifier la version précédente et son rollback | devops-silo prépare |

### Format de validation Desk

```json
{
  "task_type": "deploy.validation",
  "resource_id": "deploy_request_uuid",
  "payload": {
    "deployment_type": "full|frontend_only|backend_only",
    "source": "main|tag:release/v1.2.3",
    "checklist_results": {
      "tests_passed": true,
      "lint_clean": true,
      "security_gate_approved": true,
      "migrations_validated": true,
      "env_vars_complete": true,
      "backup_available": true,
      "rollback_plan_ready": true
    },
    "ready_to_deploy": true,
    "validated_by": "devops-silo",
    "validated_at": "2026-03-06T14:32:00Z"
  }
}
```

## Exécution du déploiement

### Netlify (Frontend)

**Condition** : Frontend changé depuis le dernier déploiement prod

```bash
# Déclencher un build Netlify pour le commit main
curl -X POST https://api.netlify.com/build_hooks/{BUILD_HOOK_ID} \
  -H "Content-Length: 0"

# OU via l'UI Netlify : Deploy site (manual)

# Suivre les logs en temps réel via Netlify UI
```

### Fly.io (Backend)

**Condition** : Code backend ou Dockerfile changé

```bash
# Préparer l'image Docker
docker build -t registry.fly.io/aims-api:$(git rev-parse --short HEAD) .

# Pousser vers Fly Registry
docker push registry.fly.io/aims-api:$(git rev-parse --short HEAD)

# Déployer à partir du nouveau tag
fly deploy --image registry.fly.io/aims-api:$(git rev-parse --short HEAD) --app aims-api

# Suivre le rolling deployment
fly status --app aims-api
```

### Supabase Edge Functions

**Condition** : Fichiers dans `supabase/functions/` changés

```bash
# Lister les fonctions modifiées
ls -la supabase/functions/

# Déployer une fonction spécifique
supabase functions deploy webhook_handler --project-ref <PROJECT_REF>

# OU déployer toutes les fonctions
supabase functions deploy --project-ref <PROJECT_REF>

# Vérifier le déploiement
curl https://<PROJECT_REF>.supabase.co/functions/v1/webhook_handler
```

## Post-deploy Verification

Après le déploiement, valider que tout fonctionne. Ne **jamais** sauter cette étape.

### Netlify Frontend

```
Vérification :
1. Charger https://aims.netlify.app
2. Vérifier que le favicon charge
3. Ouvrir la console (F12) → aucune erreur JavaScript
4. Appeler /api/health → réponse 200 OK avec timestamp
5. Ouvrir Network tab → pas de requête en 5xx
6. Valider 1–2 user flows clés (login, créer une tâche, etc.)
```

### Fly.io Backend

```
Vérification :
1. curl https://api.aims.fly.dev/health
   Réponse attendue : { "status": "ok", "uptime_ms": 1234 }
2. Vérifier les logs : fly logs --app aims-api (dernière minute)
   Rechercher les patterns : ERROR, PANIC, exception
3. Vérifier le CPU/mémoire dans Fly UI → pas de spike anormale
4. Tester un endpoint métier clé (ex: POST /api/tickets)
5. Vérifier la latence p95 < 500ms
```

### Supabase Edge Functions

```
Vérification :
1. Tester chaque fonction déployée :
   curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/webhook_handler \
     -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
     -d '{"test": true}'
2. Vérifier les logs Supabase Studio → pas d'erreur
3. Appeler depuis l'app frontend pour valider l'intégration bout en bout
```

### Sanity checks transversaux

```
À faire après TOUS les déploiements :

1. Requête base de données (test simple)
   SELECT COUNT(*) FROM desk_tasks WHERE updated_at > NOW() - INTERVAL '5 min';
   (Voir que les nouvelles tâches arrivent)

2. Monitoring
   Vérifier que les dashboards infra ne montrent pas d'anomalies

3. Pas d'erreur en cascade
   Aucune escalade d'erreur n'apparaît dans error-escalation
```

## Blue-Green Deployment (Pattern)

Pour les déploiements critiques (API prod, base de données), utiliser le pattern blue-green :

```
État BLUE (Courant)
  ├─→ 100% du trafic
  └─→ version v1.0.0

Préparation GREEN
  ├─→ Déployer la nouvelle version (v1.1.0) en parallèle
  ├─→ 0% du trafic initialement
  └─→ Runbooks sanity checks sur GREEN

Basculement
  ├─→ Une fois GREEN validée : basculer progressivement
  │   (ex: 10% trafic, puis 50%, puis 100% sur 5 minutes)
  └─→ Monitorer les erreurs à chaque étape

Rollback (Si GREEN échoue)
  ├─→ Basculer immédiatement 100% du trafic vers BLUE
  ├─→ Arrêter les instances GREEN
  └─→ Escalader vers dev-orchestrator + opérateur

Vieille version (BLUE) peut être arrêtée 1 heure après succès
```

### Implementation Fly.io blue-green

```bash
# État BLUE : version actuelle en prod
fly scale count 2 --app aims-api
# → 2 instances de v1.0.0 active

# État GREEN : déployer la nouvelle version
fly deploy --image registry.fly.io/aims-api:v1.1.0 \
  --strategy rolling \
  --app aims-api

# Pendant le rolling deployment : observer la transition
fly logs --app aims-api -f

# Si des erreurs → basculer immédiatement vers la version précédente
fly deploy --image registry.fly.io/aims-api:v1.0.0 --app aims-api --strategy immediate

# Si succès → la version précédente (BLUE) peut être purgée
```

## Rollback Strategy

Un rollback efficace, c'est :
1. Décision en moins de 5 minutes
2. Exécution en moins de 2 minutes
3. Zéro perte de données

### Rollback Frontend (Netlify)

```bash
# Option 1 : Reverser le commit précédent et re-pusher sur main
git revert HEAD
git push origin main
# → Netlify redéploie automatiquement

# Option 2 : Utiliser la version précédente déjà déployée via Netlify UI
# Netlify garde l'historique des déploiements → cliquer "Deploy preview"
```

### Rollback Backend (Fly.io)

```bash
# Identifier la version stable (généralement le tag git précédent)
# Exemple : dernière version en prod était registry.fly.io/aims-api:v1.0.0

# Redéployer immédiatement la version précédente
fly deploy --image registry.fly.io/aims-api:v1.0.0 --app aims-api --strategy immediate

# Vérifier que le trafic revient à la normale
fly status --app aims-api
fly logs --app aims-api -f

# Pousser un rollback commit sur main pour documenter
git revert HEAD
git push origin main
```

### Rollback Edge Functions

```bash
# Supabase n'a pas de versioning natif des Edge Functions
# Solution : rollback via source control

git revert HEAD  # Reverser les changements des functions
git push origin main
supabase functions deploy --project-ref <PROJECT_REF>  # Redéployer l'ancienne version
```

### Rollback Base de données

**CRITÈRE STRICTE** : Ne rollbacker une migration que si elle casse l'intégrité des données ET qu'on a une sauvegarde testée.

```bash
# Accès Supabase CLI
supabase db pull  # Récupérer le state actuel

# Créer une migration corrective (JAMAIS modifier l'existante)
cat > supabase/migrations/20260306180000_revert_broken_migration.sql << 'EOF'
-- Revert 20260306120000_add_invoices.sql
DROP TABLE IF EXISTS invoices CASCADE;
EOF

# Appliquer localement d'abord
supabase db reset

# Si succès → appliquer en prod
supabase db push  # ATTENTION : Cette commande est interdite en normal workflow
# → Escalader vers opérateur humain avec une migration corrective à la place
```

## Format de déploiement dans Desk

### Demande entrante (deploy.request)

```json
{
  "task_type": "deploy.request",
  "priority": "high",
  "from_agent": "dev-orchestrator",
  "to_agent": "devops-silo",
  "payload": {
    "deployment_id": "depl_uuid_xyz",
    "source": {
      "type": "branch|tag",
      "ref": "main|release/v1.2.3",
      "commit_sha": "abc123def456",
      "pr_number": 47
    },
    "components": ["frontend", "backend"],
    "requested_at": "2026-03-06T14:00:00Z",
    "requested_by": "dev-orchestrator"
  }
}
```

### Réponse de succès (deploy.result success)

```json
{
  "task_type": "deploy.result",
  "resource_id": "depl_uuid_xyz",
  "priority": "high",
  "payload": {
    "deployment_id": "depl_uuid_xyz",
    "status": "success",
    "deployed_at": "2026-03-06T14:15:00Z",
    "components_deployed": {
      "frontend": {
        "status": "deployed",
        "version": "abc123def456",
        "url": "https://aims.netlify.app",
        "verification": {
          "health_check": "200 OK",
          "console_errors": 0
        }
      },
      "backend": {
        "status": "deployed",
        "version": "registry.fly.io/aims-api:abc123",
        "url": "https://api.aims.fly.dev",
        "verification": {
          "health_check": "200 OK",
          "cpu": "18%",
          "memory": "256MB",
          "errors_1min": 0
        }
      }
    },
    "duration_seconds": 420,
    "rollback_available": true,
    "rollback_version": "previous_stable_tag"
  }
}
```

### Réponse d'échec (deploy.result failure)

```json
{
  "task_type": "deploy.result",
  "resource_id": "depl_uuid_xyz",
  "priority": "critical",
  "payload": {
    "deployment_id": "depl_uuid_xyz",
    "status": "failed",
    "component_failed": "backend",
    "failed_at": "2026-03-06T14:08:00Z",
    "error_detail": "Fly.io deployment timeout — health check failed after 300s",
    "rollback_executed": true,
    "rollback_version": "registry.fly.io/aims-api:v1.0.0",
    "escalation_triggered": true,
    "escalation_to": ["dev-orchestrator", "operator"],
    "recovery_steps": [
      "Rollback vers v1.0.0 complété",
      "Service en ligne avec ancienne version",
      "Vérifier les logs Fly pour la cause du failure",
      "Escalade humaine pour diagnostic"
    ]
  }
}
```

## Anti-patterns

### Déployer sans validation
- **Risque** : Code cassé, tests en échec ou données corrompues en prod
- **Prévention** : Toujours faire la pre-deploy checklist, jamais de shortcut

### Rollback incomplet
- **Risque** : Frontend en v1.1, backend en v1.0 = incompatibilité API
- **Prévention** : Toujours coordonner frontend + backend. En doute, tout rollback

### Migrations non testées
- **Risque** : Migration passe sur une DB vierge mais échoue sur une BD en prod avec données anciennes
- **Prévention** : JAMAIS `supabase db push --linked`. Toujours `supabase db reset` localement d'abord

### Secrets hardcodés ou manquants
- **Risque** : Déploiement échoue silencieusement au runtime (env var undefined)
- **Prévention** : Vérifier dans Netlify/Fly.io que toutes les env vars existent avant de lancer

### Ignorer les alertes post-deploy
- **Risque** : Un bug n'apparaît qu'après 10 minutes en prod, trop tard pour rollback rapide
- **Prévention** : Rester attentif 10 minutes après chaque déploiement. Monitor, logs, sanity checks

### Rollback sans communication client
- **Risque** : Client voie que le service "est revenu à la version ancienne" sans explication
- **Prévention** : Notifier clientele IMMÉDIATEMENT après un rollback. Via escalade Desk → clientele → client
