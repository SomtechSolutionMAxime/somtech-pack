# SomCraft Security Reference

## Row-Level Security (RLS)

Toutes les tables `sc_*` ont RLS activé. Les policies sont basées sur la membership dans `sc_workspace_members`.

### Policies `sc_workspaces`

```sql
-- SELECT : tous les users peuvent voir leurs workspaces
CREATE POLICY "Users can view their workspaces"
  ON sc_workspaces FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM sc_workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- INSERT : tout user authentifié peut créer un workspace
CREATE POLICY "Authenticated users can create workspaces"
  ON sc_workspaces FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- UPDATE : seuls les admins du workspace
CREATE POLICY "Admins can update workspaces"
  ON sc_workspaces FOR UPDATE
  USING (
    id IN (
      SELECT workspace_id FROM sc_workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- DELETE : seuls les admins
CREATE POLICY "Admins can delete workspaces"
  ON sc_workspaces FOR DELETE
  USING (
    id IN (
      SELECT workspace_id FROM sc_workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

### Policies `sc_documents`

```sql
-- SELECT : members du workspace
CREATE POLICY "Members can view workspace documents"
  ON sc_documents FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM sc_workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE : editors et admins
CREATE POLICY "Editors can modify documents"
  ON sc_documents FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM sc_workspace_members
      WHERE user_id = auth.uid() AND role IN ('editor', 'admin')
    )
  );
```

### Vérifier les policies

```sql
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename LIKE 'sc_%';
```

## API Keys MCP

Format : `sk_live_<64-hex-chars>` (générées par `openssl rand -hex 32`).

Stockées dans `sc_workspaces.api_key`.

**Résolution côté serveur :**

```typescript
// apps/web/lib/api-helpers.ts (pattern)
async function resolveApiKey(apiKey: string): Promise<{ workspace: ScWorkspace | null }> {
  const { data } = await serviceSupabase
    .from('sc_workspaces')
    .select('*')
    .eq('api_key', apiKey)
    .single()

  return { workspace: data }
}
```

**Important :**
- Une API key est scopée à **UN workspace**
- Pour régénérer : `UPDATE sc_workspaces SET api_key = 'sk_live_...' WHERE id = ?`
- Pour révoquer : `UPDATE sc_workspaces SET api_key = NULL WHERE id = ?`

## Storage Policies

Chaque workspace a son propre bucket (`sc-{client-slug}`). Le bucket est **privé**.

```sql
-- Lecture : members du workspace
CREATE POLICY "Members can read files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id IN (
      SELECT storage_bucket FROM sc_workspaces w
      JOIN sc_workspace_members m ON m.workspace_id = w.id
      WHERE m.user_id = auth.uid()
    )
  );

-- Upload : editors et admins
CREATE POLICY "Editors can upload files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN (
      SELECT storage_bucket FROM sc_workspaces w
      JOIN sc_workspace_members m ON m.workspace_id = w.id
      WHERE m.user_id = auth.uid() AND m.role IN ('editor', 'admin')
    )
  );
```

## Clés Supabase

- **Anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) — Utilisée côté client. Ne donne accès qu'à travers les RLS.
- **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`) — Utilisée côté serveur uniquement. **Bypass les RLS.** JAMAIS exposée au client.

**Où est utilisée chaque clé :**
- Anon key : `apps/web/middleware.ts`, composants client, sessions user
- Service role key : `createServiceSupabase()` dans `lib/supabase-server.ts`, utilisée pour :
  - MCP server (résolution API key, accès cross-workspace)
  - Export PDF (download des storage objects)
  - Studio (création du dossier `_studio`, sauvegarde des générations)

## Bonnes pratiques

1. **Ne jamais passer la service role key au client** (pas de `NEXT_PUBLIC_*`)
2. **Toujours vérifier les RLS** après une migration : `SELECT rowsecurity FROM pg_tables WHERE tablename LIKE 'sc_%'`
3. **Scope les API keys MCP** : une par workspace, une par usage (ex: `client-mobile-app`, `agent-claude-code`)
4. **Rotation des API keys** : recommandé tous les 6 mois ou après un incident
5. **Logs d'accès** : considérer l'activation du logging Supabase pour audit
