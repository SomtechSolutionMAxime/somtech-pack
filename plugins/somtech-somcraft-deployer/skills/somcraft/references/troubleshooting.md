# SomCraft Troubleshooting Reference

## Workspace vide (aucun document visible)

**Symptômes :** Le file manager affiche "aucun document" alors qu'on sait qu'il y en a.

**Causes et solutions :**

1. **RLS bloque l'accès**
   - Vérifier que le user courant est membre du workspace :
     ```sql
     SELECT * FROM sc_workspace_members
     WHERE workspace_id = '{id}' AND user_id = auth.uid();
     ```
   - Si pas de résultat : ajouter le user comme membre

2. **Status filter**
   - Le FileManager filtre par `status = 'active'` par défaut
   - Vérifier qu'il n'y a pas que des documents en corbeille : `SELECT status, count(*) FROM sc_documents WHERE workspace_id = '{id}' GROUP BY status`

3. **Parent_id incorrect**
   - L'API `/api/sc/documents` filtre par `parent_id` si fourni
   - Pour voir les docs à la racine : passer `?parent_id=null`

## Studio génère des fichiers vides

**Symptômes :** Une génération Studio se complète mais le fichier dans `_studio/` ne contient que le frontmatter.

**Causes et solutions :**

1. **`ANTHROPIC_API_KEY` manquante ou invalide**
   - Vérifier les secrets Fly : `fly secrets list -a {app}`
   - La clé doit commencer par `sk-ant-api`
   - Tester directement : `curl https://api.anthropic.com/v1/messages -H "x-api-key: $KEY" -H "anthropic-version: 2023-06-01" -d '{"model":"claude-sonnet-4-6","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'`

2. **Sources vides ou inaccessibles**
   - Vérifier que les documents sources ont bien un `storage_key`
   - Essayer de télécharger une source : `supabase.storage.from(bucket).download(storage_key)`

3. **Streaming events non reçus**
   - Vérifier les logs Fly : `fly logs -a {app}` — chercher des erreurs dans la pipeline
   - Le format attendu est `content_block_delta` avec `delta.type === 'text_delta'`
   - Si le SDK retourne un format différent, c'est un bug de version du SDK

4. **Quota API atteint**
   - Vérifier le dashboard Anthropic pour les limites
   - Upgrade le plan si nécessaire

## MCP server retourne 401 Unauthorized

**Symptômes :** Les appels MCP externes retournent 401.

**Causes et solutions :**

1. **API key non trouvée dans la DB**
   ```sql
   SELECT id, name, api_key FROM sc_workspaces WHERE api_key = 'sk_live_...';
   ```
   Si vide, la clé est invalide. Régénérer avec `UPDATE sc_workspaces SET api_key = 'sk_live_...'`.

2. **Header mal formaté**
   - Doit être : `Authorization: Bearer sk_live_...`
   - Erreur commune : oublier `Bearer ` ou utiliser `X-API-Key`

3. **API key expirée ou révoquée**
   - SomCraft ne fait pas d'expiration automatique en v1
   - Mais si `api_key = NULL` dans la DB, toutes les requêtes avec cette clé échouent

## Export PDF échoue (500 Internal Server Error)

**Symptômes :** `GET /api/sc/documents/{id}/export?format=pdf` retourne 500.

**Causes et solutions :**

1. **Puppeteer non disponible sur Fly.io**
   - Le Dockerfile de SomCraft doit installer Chromium
   - Vérifier dans l'image : `fly ssh console -a {app} -C "ls /usr/bin/chromium*"`
   - Si absent, rebuild l'image avec les bonnes deps

2. **Memory limit**
   - Puppeteer consomme beaucoup de RAM
   - Passer le Fly VM à 2GB : `fly scale vm shared-cpu-1x --memory 2048 -a {app}`

3. **Timeout**
   - Le PDF generation peut prendre 10-30s sur des longs docs
   - Augmenter `maxDuration` dans la route Next.js

## Sync MCP ne fonctionne pas

**Symptômes :** Le MCP client (Claude Code) ne voit pas les workspaces.

**Causes et solutions :**

1. **`.mcp.json` mal configuré**
   ```json
   {
     "mcpServers": {
       "somcraft-client": {
         "type": "http",
         "url": "https://{instance}.fly.dev/api/mcp/http",
         "headers": {
           "Authorization": "Bearer sk_live_..."
         }
       }
     }
   }
   ```

2. **Endpoint incorrect**
   - Doit être `/api/mcp/http` (pas `/api/mcp/sse` ou `/api/mcp`)

3. **Restart du client MCP**
   - Claude Code doit redémarrer pour charger `.mcp.json`

## Migrations Supabase échouent

**Symptômes :** `/deploy-somcraft` échoue en Phase 2.

**Causes et solutions :**

1. **Extension manquante**
   - SomCraft utilise `uuid-ossp`, `pgcrypto`. Vérifier : `SELECT * FROM pg_extension`
   - Créer si manquante : `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`

2. **Table déjà existante**
   - Les migrations SomCraft utilisent `IF NOT EXISTS` mais pas toujours
   - Si conflit : DROP la table manuellement (attention : perte de données)

3. **RLS policy déjà existante**
   - Supabase ne supporte pas `CREATE POLICY IF NOT EXISTS`
   - Wrapper dans un `DO $$ BEGIN ... EXCEPTION ... END $$`

## Instance Fly.io ne répond pas

**Symptômes :** `curl https://{app}.fly.dev` retourne 502 ou timeout.

**Causes et solutions :**

1. **App pas encore déployée ou crashed**
   ```bash
   fly status -a {app}
   fly logs -a {app} | tail -30
   ```

2. **Secret manquant**
   - Vérifier : `fly secrets list -a {app}`
   - Tous les 6 secrets de Phase 4 doivent être présents

3. **Machine sleepé (scale-to-zero)**
   - Fly peut mettre en sleep après inactivité
   - Premier accès : peut prendre 5-10s pour wake up
