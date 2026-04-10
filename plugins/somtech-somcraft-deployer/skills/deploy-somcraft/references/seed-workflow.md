# Seed Initial Workflow Reference

Comment créer le workspace initial, l'admin, et l'API key lors d'un nouveau déploiement.

## 1. Admin user

Via MCP Supabase, créer un user dans `auth.users` :

```sql
-- Générer un mot de passe aléatoire
-- (utiliser openssl rand -base64 16 côté skill, passer comme param)

WITH new_user AS (
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    '{admin-email}',
    crypt('{random-password}', gen_salt('bf')),
    now(),
    '{"role": "admin", "name": "Admin"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  RETURNING id
)
SELECT id FROM new_user;
```

Stocker le `id` retourné comme `ADMIN_USER_ID`.

## 2. Workspace initial

```sql
INSERT INTO sc_workspaces (name, slug, storage_bucket, created_by)
VALUES (
  '{client-name} - Docs',
  '{client-slug}-docs',
  'sc-{client-slug}',
  '{admin-user-id}'
)
RETURNING id;
```

Stocker le `id` retourné comme `WORKSPACE_ID`.

## 3. API key MCP

Générer côté skill :

```bash
API_KEY="sk_live_$(openssl rand -hex 32)"
```

Puis :

```sql
UPDATE sc_workspaces
SET api_key = '{api-key}'
WHERE id = '{workspace-id}';
```

## 4. Workspace member (admin)

```sql
INSERT INTO sc_workspace_members (workspace_id, user_id, role)
VALUES ('{workspace-id}', '{admin-user-id}', 'admin');
```

## 5. Stockage temporaire des credentials

Écrire les valeurs dans un fichier temp pour le rapport final :

```bash
cat > /tmp/somcraft-deploy-{client-slug}-credentials.txt <<EOF
Client           : {client-name}
Environnement    : {env}
Workspace ID     : {workspace-id}
Admin email      : {admin-email}
Admin password   : {random-password}
API Key MCP      : {api-key}
Deploy date      : $(date +%Y-%m-%d)
EOF

chmod 600 /tmp/somcraft-deploy-{client-slug}-credentials.txt
```

**Important :** Ce fichier contient des secrets. Il est en mode 600 (lecture seule propriétaire). L'utilisateur doit le supprimer après avoir stocké les credentials dans 1Password.

## 6. Document de bienvenue

Créer un document de bienvenue dans le workspace initial :

```sql
INSERT INTO sc_documents (workspace_id, parent_id, type, filename, path, mime_type, size_bytes, status, tags, metadata)
VALUES (
  '{workspace-id}',
  NULL,
  'file',
  'README.md',
  '/README.md',
  'text/markdown',
  0,
  'active',
  ARRAY['welcome'],
  '{"generated_by": "deploy-somcraft"}'::jsonb
);
```

Upload du contenu via Supabase Storage (fichier statique de bienvenue) est optionnel en v1.
