---
name: somcraft-{{CLIENT_SLUG}}
description: |
  Instance SomCraft dédiée pour {{CLIENT_NAME}}.
  Opérations, administration, debug de cette instance précise.
  Pour la doc générale SomCraft, voir le skill `somcraft`.
  TRIGGERS : somcraft {{CLIENT_SLUG}}, instance somcraft, {{CLIENT_SLUG}} dms, {{CLIENT_NAME}} somcraft
---

# SomCraft — {{CLIENT_NAME}}

> Cette instance SomCraft est déployée dédiée pour {{CLIENT_NAME}}.
> Pour la documentation générale de SomCraft, voir le skill global `somcraft`.

## Environnements

| Env        | URL                | Statut              |
|------------|--------------------|---------------------|
| Staging    | {{STAGING_URL}}    | {{STAGING_STATUS}}  |
| Production | {{PROD_URL}}       | {{PROD_STATUS}}     |

## Supabase

- **Project ref (staging)** : `{{STAGING_SUPABASE_REF}}`
- **Project ref (production)** : `{{PROD_SUPABASE_REF}}`
- **Storage bucket** : `{{STORAGE_BUCKET}}`
- **Console** : https://supabase.com/dashboard/project/{{PROD_SUPABASE_REF}}

## Fly.io

- **Organization** : `{{FLY_ORG}}`
- **App staging** : `{{FLY_APP_STAGING}}`
- **App production** : `{{FLY_APP_PROD}}`
- **Voir les logs** : `fly logs -a {{FLY_APP_PROD}}`
- **SSH** : `fly ssh console -a {{FLY_APP_PROD}}`

## Workspace initial

- **ID** : `{{WORKSPACE_ID}}`
- **Nom** : `{{WORKSPACE_NAME}}`
- **Admin** : `{{ADMIN_EMAIL}}`

## API Key MCP

La clé API est stockée dans 1Password :
- **Entrée** : `somcraft-{{CLIENT_SLUG}}-mcp`

Configuration MCP client :

```json
{
  "mcpServers": {
    "somcraft-{{CLIENT_SLUG}}": {
      "type": "http",
      "url": "{{PROD_URL}}/api/mcp/http",
      "headers": {
        "Authorization": "Bearer <from-1password>"
      }
    }
  }
}
```

## Features activées

- AI Chat (Claude Sonnet/Opus)
- Studio (génération de documents via pipelines)
- Export PDF/DOCX
- MCP Server
- Full-text search

## Opérations courantes

### Voir les logs

```bash
fly logs -a {{FLY_APP_PROD}}
```

### Redéployer après changement

Utiliser la commande `/deploy-somcraft-upgrade` depuis ce projet. Ne JAMAIS faire `fly deploy` manuellement — cela casserait la synchronisation avec les migrations.

### Appliquer une nouvelle migration

Via MCP Supabase sur le project `{{PROD_SUPABASE_REF}}`.
**Ne JAMAIS utiliser `supabase db push --linked`.**

### Créer un nouveau workspace

Option 1 — Via l'interface web : se connecter comme admin, créer depuis la sidebar.

Option 2 — Via SQL :

```sql
INSERT INTO sc_workspaces (name, slug, storage_bucket, created_by)
VALUES ('Nouveau Workspace', 'nouveau-ws', '{{STORAGE_BUCKET}}', '<admin-user-id>');
```

Puis créer le bucket storage (ou réutiliser `{{STORAGE_BUCKET}}`) et ajouter les membres.

### Régénérer l'API key MCP

```sql
UPDATE sc_workspaces
SET api_key = 'sk_live_' || encode(gen_random_bytes(32), 'hex')
WHERE id = '{{WORKSPACE_ID}}'
RETURNING api_key;
```

Stocker la nouvelle clé dans 1Password et mettre à jour les `.mcp.json` qui l'utilisent.

### Voir l'état de l'instance

```bash
# Status Fly
fly status -a {{FLY_APP_PROD}}

# Santé de l'app
curl https://{{PROD_URL}}/api/health
```

Ou utiliser `/deploy-somcraft-status`.

## Historique de déploiement

- `{{DEPLOY_DATE}}` : Déploiement initial — SomCraft v{{SOMCRAFT_VERSION}}
