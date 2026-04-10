# Migrations Workflow Reference

Comment appliquer les migrations SomCraft sur le Supabase d'un client via MCP.

## Source des migrations

Le plugin ne contient PAS les migrations. Elles sont clonées depuis le repo SomCraft à la version spécifiée dans `plugin.json` → `somcraftVersion`.

```bash
SOMCRAFT_VERSION=$(jq -r .somcraftVersion $PLUGIN_ROOT/.claude-plugin/plugin.json)
TMP_DIR=$(mktemp -d /tmp/somcraft-migrations-XXXXXX)
git clone --depth 1 --branch "v$SOMCRAFT_VERSION" https://github.com/somtech-solutions/somcraft.git "$TMP_DIR"
MIGRATIONS_DIR="$TMP_DIR/supabase/migrations"
```

## Détecter les migrations déjà appliquées

Via MCP Supabase, exécuter :

```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
```

Stocker le résultat dans une variable. Format : liste de tuples `(version, name)`.

## Détecter les migrations à appliquer

Lister les fichiers dans `$MIGRATIONS_DIR` :

```bash
ls "$MIGRATIONS_DIR"/*.sql | sort
```

Nom de fichier typique : `20260407000000_init.sql`. La partie avant le `_` est le `version`.

Pour chaque fichier :

1. Extraire le `version` (timestamp) et le `name` (reste du nom sans `.sql`)
2. Comparer avec la liste `schema_migrations`
3. Si non présent, ajouter à la liste des migrations à appliquer

## Appliquer une migration

Pour chaque migration à appliquer (dans l'ordre chronologique) :

```typescript
// Lire le SQL
const sql = readFileSync(migrationPath, 'utf-8');

// Via MCP : mcp__supabase__apply_migration
// OU si non disponible : mcp__supabase__execute_sql wrapped in transaction
await mcp.callTool('apply_migration', {
  project_ref: projectRef,
  name: migrationName,
  query: sql
});

// Enregistrer dans schema_migrations (si pas fait automatiquement)
await mcp.callTool('execute_sql', {
  project_ref: projectRef,
  query: `INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
          VALUES ('${version}', '${migrationName}', ARRAY['${sql.replace(/'/g, "''")}'])
          ON CONFLICT DO NOTHING;`
});
```

## Créer le bucket storage

Après les migrations :

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('sc-{client-slug}', 'sc-{client-slug}', false)
ON CONFLICT (id) DO NOTHING;

-- Policies pour le bucket
CREATE POLICY "Authenticated users can read from {client-slug} bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sc-{client-slug}' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload to {client-slug} bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'sc-{client-slug}' AND auth.role() = 'authenticated');
```

## Vérifier les RLS

Après les migrations, vérifier que toutes les tables `sc_*` ont RLS activé :

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'sc_%';
```

Toutes doivent avoir `rowsecurity = true`. Sinon, afficher un warning avec la liste des tables non protégées.

## Gestion d'erreur

- Si une migration échoue, **arrêter immédiatement**. Ne pas essayer de continuer avec les suivantes.
- Afficher le SQL qui a échoué et le message d'erreur Supabase.
- Instructions manuelles : "Pour réessayer, corrigez le problème dans le repo SomCraft, publiez une nouvelle version, et relancez /deploy-somcraft-upgrade."
- **JAMAIS de rollback automatique.** Les migrations SomCraft sont `IF NOT EXISTS` friendly mais on ne garantit rien.
