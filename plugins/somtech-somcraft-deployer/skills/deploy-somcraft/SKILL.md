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
| Image Docker      | ghcr.io/somtech-solutions/somcraft:{somcraft-version} |
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
# Résout la version. Si plugin.json contient "latest" (valeur par défaut),
# on récupère le dernier tag vX.Y.Z publié sur le repo SomCraft.
SOMCRAFT_VERSION_RAW=$(jq -r .somcraftVersion "$PLUGIN_ROOT/.claude-plugin/plugin.json")
if [ "$SOMCRAFT_VERSION_RAW" = "latest" ]; then
  SOMCRAFT_VERSION=$(git ls-remote --tags --refs https://github.com/Somtech-Solutions/somcraft.git \
    | awk -F/ '{print $NF}' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1 | sed 's/^v//')
else
  SOMCRAFT_VERSION="$SOMCRAFT_VERSION_RAW"
fi
[ -z "$SOMCRAFT_VERSION" ] && { echo "Erreur : impossible de résoudre la version SomCraft."; exit 1; }
echo "Version SomCraft cible : v$SOMCRAFT_VERSION"

TMP_DIR=$(mktemp -d)
git clone --depth 1 --branch "v$SOMCRAFT_VERSION" https://github.com/Somtech-Solutions/somcraft.git "$TMP_DIR"
```

**Note :** `--branch vlatest` n'existe pas — le bloc ci-dessus résout `"latest"` en tag réel avant le clone.

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

2. Crée le user admin. **Méthode recommandée — API Auth Admin de GoTrue** (gère automatiquement la ligne `auth.identities` requise pour le login email/password, contrairement à un INSERT SQL brut) :

```bash
ADMIN_PW=$(openssl rand -base64 18)
curl -fsS -X POST "https://${PROJECT_REF}.supabase.co/auth/v1/admin/users" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PW}\",\"email_confirm\":true,\"user_metadata\":{\"role\":\"admin\",\"name\":\"Admin\"}}"
# Récupérer l'`id` retourné comme ADMIN_USER_ID.
```

**Fallback SQL** (si le réseau ne permet pas d'atteindre l'endpoint Auth) : voir `references/seed-workflow.md` — l'INSERT dans `auth.users` **doit** être accompagné d'un INSERT dans `auth.identities`, sinon le login email/password échoue sur les versions récentes de GoTrue.

3. Crée le workspace initial :

```sql
INSERT INTO sc_workspaces (name, slug, storage_bucket, created_by)
VALUES ('{client-name} - Docs', '{client-slug}-docs', 'sc-{client-slug}', '{admin-user-id}')
RETURNING id;
```

4. Génère une API key MCP de workspace (format **canonique** `sk_` + 32 caractères `[a-z0-9]`, identique à `generateWorkspaceApiKey()` côté code SomCraft) :

```bash
API_KEY="sk_$(LC_ALL=C tr -dc 'a-z0-9' < /dev/urandom | head -c 32)"
```

> **Note auth (SomCraft ≥ v0.20)** : la clé de workspace (`sk_…`) reste supportée et résolue contre `sc_workspaces.api_key`. Le modèle **recommandé** pour faire opérer un agent IA est désormais la **clé agent** `sk_agent_…` (registre `sc_agents` + `sc_agent_api_keys`, accès workspace via `sc_agent_workspace_access`). Pour un seed initial mono-workspace, la clé de workspace suffit ; bascule vers une clé agent depuis `/settings/agents` quand plusieurs agents/clés scopées sont nécessaires.

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

5. **Provisioning du sidecar Gotenberg (export PDF) — requis pour SomCraft ≥ v0.31.0.**

   Depuis v0.31.0, l'export PDF n'embarque plus Puppeteer/Chromium dans l'image SomCraft : il délègue à un **sidecar Gotenberg** (app Fly.io séparée) appelé en HTTP. Si ce sidecar n'est pas provisionné et que le secret `GOTENBERG_URL` n'est pas posé sur l'app SomCraft, **l'export PDF échoue en runtime** (l'app démarre quand même, le reste fonctionne).

   **Ne pas réimplémenter la logique ici** : le repo SomCraft cloné en Phase 2 (`$TMP_DIR`) porte le script idempotent versionné, source de vérité. On le délègue + on lit le runbook de la version cible.

   ```bash
   # Gate de version : sidecar requis seulement pour >= 0.31.0.
   NEEDS_GOTENBERG=$(printf '%s\n%s\n' "0.31.0" "$SOMCRAFT_VERSION" \
     | sort -V | head -1)
   if [ "$NEEDS_GOTENBERG" = "0.31.0" ]; then
     echo "SomCraft v$SOMCRAFT_VERSION >= 0.31.0 → provisioning sidecar Gotenberg requis."

     # Lire les pré-requis spécifiques à la version cible (runbook versionné).
     # Contient la section « À LIRE AVANT TOUT UPGRADE >= v0.31.0 » + détails.
     [ -f "$TMP_DIR/docs/operations/upgrade.md" ] && \
       echo "→ Voir $TMP_DIR/docs/operations/upgrade.md pour le contexte."

     # Déléguer au script versionné du repo SomCraft cloné. Idempotent :
     # crée l'app gotenberg-<slug> always-on (auto_stop=off), la garde 6PN-only,
     # release les IP publiques, et STAGE le secret GOTENBERG_URL=...flycast
     # sur l'app SomCraft (repris au fly deploy de l'étape suivante).
     if [ -x "$TMP_DIR/tools/provision-gotenberg-sidecar.sh" ]; then
       (cd "$TMP_DIR" && ./tools/provision-gotenberg-sidecar.sh \
         --target-app "$FLY_APP" \
         --fly-org "{fly-org}")
     else
       echo "⚠️  $TMP_DIR/tools/provision-gotenberg-sidecar.sh introuvable ou non exécutable." >&2
       echo "    Provisionner le sidecar manuellement avant de poursuivre (cf. upgrade.md)." >&2
     fi
   else
     echo "SomCraft v$SOMCRAFT_VERSION < 0.31.0 → pas de sidecar Gotenberg (export PDF in-process)."
   fi
   ```

   **Important** : cette étape STAGE `GOTENBERG_URL` (`fly secrets set --stage`) sans redéployer. Le secret est pris en compte au `fly deploy` de l'étape 6.

6. Déploie l'image Docker :

```bash
fly deploy -a "$FLY_APP" \
  --image "ghcr.io/somtech-solutions/somcraft:$SOMCRAFT_VERSION" \
  --config /tmp/fly-somcraft-{client-slug}.toml
```

7. Attends que l'app soit healthy :

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

5. **Test 4 — Export PDF (sidecar Gotenberg) — seulement si SomCraft ≥ v0.31.0.**

   Valide que le sidecar provisionné en Phase 4 répond bien. Exporter un document existant en PDF via MCP et vérifier qu'on obtient un PDF (et non une erreur `PDF generation failed`).

   ```bash
   # Récupérer un document_id (ex : le welcome.md créé au Test 3, ou via list_documents),
   # puis appeler le tool MCP export_document. Vérifier la présence d'un download_url
   # et l'absence de "PDF generation failed" dans la réponse.
   curl -sS -X POST "https://$APP_URL/api/mcp/mcp" \
     -H "Authorization: Bearer $SOMCRAFT_MCP_API_KEY" \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"export_document\",\"arguments\":{\"document_id\":\"$DOC_ID\",\"format\":\"pdf\"}}}"
   ```

   Attendu : réponse contenant un `download_url` signé. Si `PDF generation failed` → le sidecar n'est pas joignable : vérifier `fly status -a gotenberg-{client-slug}-{env}` (1 machine `started`) et le secret `GOTENBERG_URL` sur l'app SomCraft.

6. Si un test échoue, afficher l'erreur mais continuer (warning non bloquant).

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
         "headers": { "Authorization": "Bearer ${SOMCRAFT_API_KEY}", "Accept": "application/json, text/event-stream" }
       }
     }

     ⚠ NE JAMAIS coller la clé en clair dans .mcp.json (fichier versionné →
       fuite dans git, cf. incident T-20260625-0012). Mettre la valeur dans
       .env (gitignored) :  SOMCRAFT_API_KEY=<from-1password>
       Claude Code expanse ${SOMCRAFT_API_KEY} depuis l'environnement du
       process — la variable doit y être présente. claude-swt source le .env
       du repo automatiquement ; en `claude` direct, exporter la variable
       (ou sourcer le .env) avant de lancer la session.

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

**⚠️ Sidecar Gotenberg lors d'un upgrade ≥ v0.31.0** : la Phase 4 inclut l'étape 5 (provisioning du sidecar Gotenberg). Elle est **idempotente** — sur une instance déjà provisionnée, elle réconcilie la config (sidecar always-on, IP publiques release, secret `GOTENBERG_URL` re-staged) sans perte de données. C'est **obligatoire** : un upgrade vers ≥ v0.31.0 qui saute cette étape laisse l'export PDF cassé (ancienne config Puppeteer in-process retirée de l'image). Ne jamais court-circuiter la Phase 4 étape 5 en mode upgrade.

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
