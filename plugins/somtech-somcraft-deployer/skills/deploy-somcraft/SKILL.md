---
name: deploy-somcraft
description: |
  Déployer une instance SomCraft pour un client existant (migrations Supabase + Fly.io + skills).
  Orchestre 7 phases : pré-flight, plan, migrations, seed, déploiement, smoke tests, installation des skills.
  TRIGGERS : deploy-somcraft, déployer somcraft, installer somcraft, somcraft client, setup somcraft, upgrade somcraft, status somcraft
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task
---

# deploy-somcraft

Déployer une instance SomCraft dédiée pour un client existant. Ce skill orchestre l'ensemble du processus en 7 phases.

## Modes d'exécution

Ce skill supporte 3 modes selon la commande qui l'invoque :

- **`install`** (défaut, depuis `/deploy-somcraft`) — Déploiement initial complet, toutes les phases
- **`upgrade`** (depuis `/deploy-somcraft-upgrade`) — Saute pré-flight configuration, ne fait que migrations + redéploiement
- **`status`** (depuis `/deploy-somcraft-status`) — Lecture seule, rapporte l'état sans modifier

Détecter le mode en lisant le prompt de l'utilisateur.

## Phase 0 — Pré-flight

**Référence détaillée :** `references/preflight-checks.md`

1. Lis `.somtech/app.yaml` du projet courant (créé par `/lier-app`, voir STD-027). Extrais :
   - `servicedesk.client_name` → `{client-name}`
   - `servicedesk.app_slug` → utilisé pour dériver `{client-slug}` (généralement `{client-slug} = servicedesk.app_slug` ou un slug stable du client)
   - `servicedesk.client_id` (UUID) — pour traçabilité et vérification

   **Si `.somtech/app.yaml` n'existe pas** : arrêter avec le message exact suivant et ne PAS deviner le nom client depuis CLAUDE.md ou autre source :

   ```
   Erreur : .somtech/app.yaml absent. Ce repo n'est pas lié à une application Somtech.
   Lancez /lier-app pour créer .somtech/app.yaml avant de relancer /deploy-somcraft.
   ```

2. Lis `.mcp.json`. Vérifie qu'il contient une entrée pour Supabase MCP avec un `project_ref` valide.
3. Lis `fly.toml`. Extrais :
   - `app` (nom de l'app Fly.io actuelle)
   - `primary_region`
   - L'organization Fly.io (via `fly apps list` si pas dans le toml)
4. Vérifie que `package.json` existe (pas une validation stricte, juste confirmer qu'on est dans un repo Node).
5. Exécute `fly auth whoami`. Si erreur, arrête et affiche : "Fly CLI non authentifié. Exécutez `fly auth login`."
6. **Utilise `AskUserQuestion` pour demander l'environnement cible :**

```
Question: "Sur quel environnement déployer SomCraft ?"
Options:
  - staging : Environnement de développement/test
  - production : Environnement de production client
```

7. Affiche le client détecté et demande confirmation : "Déployer SomCraft pour `{client}` sur `{env}` ? (oui/non)"

Si l'une de ces étapes échoue, arrête et affiche l'erreur clairement.

## Phase 1 — Plan

**Avant de procéder, affiche un tableau récapitulatif :**

```
| Item              | Valeur                                   |
|-------------------|------------------------------------------|
| Client            | {client-name}                            |
| Slug              | {client-slug}                            |
| Environnement     | {env}                                    |
| Supabase project  | {project-ref}                            |
| Fly app           | somcraft-{client-slug}-{env}             |
| Fly org           | {fly-org}                                |
| Image Docker      | ghcr.io/somtech-solutions/somcraft:0.4.2 |
| Workspace initial | {client-name} - Docs                     |
| Admin email       | (demandé à la prochaine étape)           |
| Migrations        | (détecté après clone)                    |
```

Demande confirmation finale avec `AskUserQuestion` :

```
Question: "Procéder au déploiement ?"
Options:
  - oui, procéder : Lance toutes les phases
  - annuler       : Arrête ici
```

## Phase 2 — Migrations Supabase

**Référence détaillée :** `references/migrations-workflow.md`

1. Clone le repo SomCraft dans un dossier temp à la version spécifiée dans `plugin.json` :

```bash
SOMCRAFT_VERSION=$(cat $PLUGIN_ROOT/.claude-plugin/plugin.json | jq -r .somcraftVersion)
TMP_DIR=$(mktemp -d)
git clone --depth 1 --branch v$SOMCRAFT_VERSION https://github.com/somtech-solutions/somcraft.git $TMP_DIR
```

2. Liste les migrations disponibles : `ls $TMP_DIR/supabase/migrations/*.sql | sort`
3. Via MCP Supabase (`mcp__supabase__execute_sql`), lis `supabase_migrations.schema_migrations` pour détecter les migrations déjà appliquées.
4. Détermine les migrations à appliquer (non présentes dans `schema_migrations`).
5. Affiche la liste : "Migrations à appliquer : N"
6. Pour chaque migration dans l'ordre chronologique :
   - Lis le contenu du fichier SQL
   - Applique via `mcp__supabase__apply_migration` (OU `mcp__supabase__execute_sql` si apply_migration n'est pas disponible) en mode transactionnel
   - Enregistre la migration dans `schema_migrations` avec son `version` (timestamp du nom de fichier)
7. Crée le bucket storage `sc-{client-slug}` via MCP Supabase :

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('sc-{client-slug}', 'sc-{client-slug}', false)
ON CONFLICT DO NOTHING;
```

8. Vérifie que les RLS policies sur `sc_workspaces` et `sc_documents` sont actives :

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'sc_%';
```

Toutes les tables doivent avoir `rowsecurity = true`. Sinon, afficher un warning.

**IMPORTANT :** Ne JAMAIS utiliser `supabase db push --linked`.

## Phase 3 — Seed initial

**Référence détaillée :** `references/seed-workflow.md`

1. **Demande l'email de l'admin** via `AskUserQuestion` :

```
Question: "Quel email pour l'utilisateur admin de cette instance ?"
Options:
  - admin@{client-slug}.com : Email générique par défaut
  - Autre email             : Saisir un email personnalisé
```

2. Crée le user admin via MCP Supabase (en utilisant l'API auth) :

```sql
-- Via la table auth.users directement
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (gen_random_uuid(), '{admin-email}', crypt('{random-password}', gen_salt('bf')), now(), '{"role": "admin"}')
RETURNING id;
```

(Alternative : utiliser `supabase.auth.admin.createUser()` via un appel SDK si disponible.)

3. Crée le workspace initial :

```sql
INSERT INTO sc_workspaces (name, slug, storage_bucket, created_by)
VALUES ('{client-name} - Docs', '{client-slug}-docs', 'sc-{client-slug}', '{admin-user-id}')
RETURNING id;
```

4. Génère une API key MCP (format `sk_live_<64-hex-chars>`) :

```bash
API_KEY="sk_live_$(openssl rand -hex 32)"
```

5. Stocke l'API key dans la table `sc_workspaces` :

```sql
UPDATE sc_workspaces SET api_key = '{api-key}' WHERE id = '{workspace-id}';
```

6. Ajoute l'admin comme membre du workspace :

```sql
INSERT INTO sc_workspace_members (workspace_id, user_id, role)
VALUES ('{workspace-id}', '{admin-user-id}', 'admin');
```

7. Génère un mot de passe admin aléatoire et le stocke dans un fichier temporaire `/tmp/somcraft-deploy-{client-slug}-credentials.txt` pour l'afficher dans le rapport final.

## Phase 4 — Déploiement Fly.io

**Référence détaillée :** `references/fly-deployment.md`

1. Détermine le nom de l'app :

```bash
FLY_APP="somcraft-{client-slug}-{env}"
```

2. Vérifie si l'app existe :

```bash
fly apps list | grep "$FLY_APP"
```

Si elle n'existe pas, la créer :

```bash
fly apps create "$FLY_APP" --org "{fly-org}"
```

3. Génère un `fly.toml` temporaire depuis `templates/fly-toml.tpl` en remplaçant les variables.
4. Configure les secrets via `fly secrets set` :

```bash
fly secrets set \
  ANTHROPIC_API_KEY="{anthropic-key}" \
  NEXT_PUBLIC_SUPABASE_URL="https://{project-ref}.supabase.co" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="{anon-key}" \
  SUPABASE_SERVICE_ROLE_KEY="{service-role-key}" \
  NEXTAUTH_SECRET="$(openssl rand -base64 32)" \
  SOMCRAFT_MCP_API_KEY="{api-key-from-phase-3}" \
  -a "$FLY_APP"
```

**Note :** Les secrets `ANTHROPIC_API_KEY`, les clés Supabase, etc., doivent être lus depuis le `.env.local` du projet client OU demandés interactivement via `AskUserQuestion`.

5. Déploie l'image Docker :

```bash
fly deploy -a "$FLY_APP" \
  --image "ghcr.io/somtech-solutions/somcraft:$SOMCRAFT_VERSION" \
  --config /tmp/fly-somcraft-{client-slug}.toml
```

6. Attends que l'app soit healthy :

```bash
fly status -a "$FLY_APP"
```

Retry jusqu'à 2 minutes (polling toutes les 10s).

## Phase 5 — Smoke tests

**Référence détaillée :** `references/smoke-tests.md`

1. Récupère l'URL : `APP_URL=$(fly info -a "$FLY_APP" --json | jq -r .Hostname)`
2. Test 1 — Health check :

```bash
curl -f "https://$APP_URL/api/health"
```

Attendu : 200 OK avec `{"status":"ok"}`

3. Test 2 — MCP server :

```bash
curl -X POST "https://$APP_URL/api/mcp/mcp" \
  -H "Authorization: Bearer $SOMCRAFT_MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Attendu : JSON avec la liste des tools MCP (doit inclure `list_workspaces`).

4. Test 3 — Créer un document de test via l'API :

```bash
curl -X POST "https://$APP_URL/api/sc/documents" \
  -H "Authorization: Bearer $SOMCRAFT_MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"workspace_id\":\"$WORKSPACE_ID\",\"filename\":\"welcome.md\",\"type\":\"file\"}"
```

Attendu : 201 Created.

5. Si un test échoue, afficher l'erreur mais continuer (warning non bloquant).

## Phase 6 — Installation des skills

1. **Skill global `somcraft` :**
   - Vérifier si `~/.claude/skills/somcraft/SKILL.md` existe
   - Si absent, copier tout le dossier `skills/somcraft/` du plugin vers `~/.claude/skills/somcraft/`
   - Si présent, comparer les versions (lire frontmatter `version:` si présent, sinon comparer la date de modification)
   - Si le plugin a une version plus récente, écraser les fichiers

```bash
PLUGIN_SOMCRAFT_SKILL="$PLUGIN_ROOT/skills/somcraft"
TARGET_SOMCRAFT_SKILL="$HOME/.claude/skills/somcraft"
mkdir -p "$TARGET_SOMCRAFT_SKILL"
cp -r "$PLUGIN_SOMCRAFT_SKILL"/* "$TARGET_SOMCRAFT_SKILL/"
```

2. **Skill projet `somcraft-{client-slug}` :**
   - Lire le template `$PLUGIN_ROOT/templates/project-skill.md.tpl`
   - Remplacer toutes les variables avec les valeurs collectées (utilise `sed` ou équivalent)
   - Écrire dans `.claude/skills/somcraft-{client-slug}/SKILL.md` du projet courant

```bash
TARGET_DIR=".claude/skills/somcraft-{client-slug}"
mkdir -p "$TARGET_DIR"

sed \
  -e "s|{{CLIENT_SLUG}}|{client-slug}|g" \
  -e "s|{{CLIENT_NAME}}|{client-name}|g" \
  -e "s|{{STAGING_URL}}|$STAGING_URL|g" \
  -e "s|{{PROD_URL}}|$PROD_URL|g" \
  -e "s|{{STAGING_SUPABASE_REF}}|$STAGING_REF|g" \
  -e "s|{{PROD_SUPABASE_REF}}|$PROD_REF|g" \
  -e "s|{{STORAGE_BUCKET}}|sc-{client-slug}|g" \
  -e "s|{{FLY_ORG}}|$FLY_ORG|g" \
  -e "s|{{FLY_APP_STAGING}}|somcraft-{client-slug}-staging|g" \
  -e "s|{{FLY_APP_PROD}}|somcraft-{client-slug}|g" \
  -e "s|{{WORKSPACE_ID}}|$WORKSPACE_ID|g" \
  -e "s|{{WORKSPACE_NAME}}|{client-name} - Docs|g" \
  -e "s|{{ADMIN_EMAIL}}|$ADMIN_EMAIL|g" \
  -e "s|{{DEPLOY_DATE}}|$(date +%Y-%m-%d)|g" \
  -e "s|{{SOMCRAFT_VERSION}}|$SOMCRAFT_VERSION|g" \
  "$PLUGIN_ROOT/templates/project-skill.md.tpl" > "$TARGET_DIR/SKILL.md"
```

3. Si le skill projet existait déjà (re-déploiement), préserver l'historique en ajoutant une ligne dans la section "Historique de déploiement" plutôt que de réécrire entièrement.

## Phase 7 — Rapport final

Afficher le rapport suivant :

```
════════════════════════════════════════════════════════
✓ SomCraft déployé pour {client-name}
════════════════════════════════════════════════════════

Environnement : {env}
Version       : {somcraft-version}
URL           : https://{app-url}

Workspace initial :
  ID   : {workspace-id}
  Nom  : {client-name} - Docs

Admin :
  Email    : {admin-email}
  Password : {random-password}
  ⚠ Stocker dans 1Password : somcraft-{client-slug}-admin

API Key MCP :
  {api-key}
  ⚠ Stocker dans 1Password : somcraft-{client-slug}-mcp

Skills installés :
  ✓ ~/.claude/skills/somcraft/                       (global, v{plugin-version})
  ✓ .claude/skills/somcraft-{client-slug}/           (projet, v{plugin-version})

Prochaines étapes :
  1. Stocker les credentials dans 1Password
  2. Configurer votre .mcp.json local pour accéder à cette instance :

     {
       "somcraft-{client-slug}": {
         "type": "http",
         "url": "https://{app-url}/api/mcp/mcp",
         "headers": { "Authorization": "Bearer <from-1password>", "Accept": "application/json, text/event-stream" }
       }
     }

  3. Tester l'instance en ouvrant https://{app-url} dans un navigateur
  4. Invoquer le skill 'somcraft-{client-slug}' pour toute opération future
════════════════════════════════════════════════════════
```

## Mode upgrade

Si le mode est `upgrade` :

- Saute Phase 0 (pré-flight) — lit les valeurs depuis `.claude/skills/somcraft-{client-slug}/SKILL.md`
- Saute Phase 1 (plan) — affiche juste un diff de versions
- Saute Phase 3 (seed) — l'instance est déjà seedée
- Exécute Phase 2 (migrations — seulement les nouvelles), Phase 4 (redéploiement), Phase 5 (smoke tests), Phase 6 (met à jour le skill projet avec la nouvelle version et l'historique)

## Mode status

Si le mode est `status` :

- Lit `.claude/skills/somcraft-{client-slug}/SKILL.md`
- Extrait : version, URLs, Fly apps, Supabase refs, workspace ID
- Exécute `fly status -a {app-staging}` et `fly status -a {app-prod}`
- Exécute des requêtes read-only via MCP Supabase pour compter workspaces, documents, users
- Affiche un tableau récapitulatif
- **Ne modifie rien**

## Gestion des erreurs

- Si Phase 2 (migrations) échoue : afficher l'erreur, ne pas continuer, ne pas rollback
- Si Phase 4 (Fly deploy) échoue : afficher l'erreur, Fly.io garde la version précédente automatiquement
- Si Phase 5 (smoke tests) échoue : afficher les erreurs comme warnings, continuer vers Phase 6
- Si Phase 6 (installation skills) échoue : erreur non fatale, afficher et continuer vers Phase 7
