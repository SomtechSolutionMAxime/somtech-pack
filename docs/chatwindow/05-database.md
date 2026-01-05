# 05 — Base de données (tables + RLS)

## Source de vérité

- Migration tables chat : `supabase/migrations/20241124000000_create_chat_tables.sql`
- Migration workflows : `supabase/migrations/20251127165948_add_workflow_tables.sql`

## Tables ChatWindow

### `chat_threads`

But : stocker les conversations (threads).

Champs principaux :
- `id` (UUID, PK)
- `user_id` (UUID, FK `auth.users`)
- `title` (TEXT)
- `metadata` (JSONB)
- `created_at`, `updated_at` (TIMESTAMPTZ)

Index utiles :
- `idx_chat_threads_user_id`
- `idx_chat_threads_updated_at`

Trigger :
- `updated_at` mis à jour automatiquement via trigger.

### `chat_messages`

But : stocker les messages d’un thread.

Champs principaux :
- `id` (UUID, PK)
- `thread_id` (UUID, FK `chat_threads`)
- `role` (TEXT, contrainte `user|assistant|system`)
- `content` (TEXT)
- `metadata` (JSONB)
- `created_at`

Index utiles :
- `idx_chat_messages_thread_id`
- `idx_chat_messages_created_at`

### `chat_attachments` (optionnel)

But : pièces jointes par message.

Champs :
- `message_id` (FK `chat_messages`)
- `file_url`, `file_type`, `file_size`, `created_at`

## Table Workflows

### `workflow_configurations`

But : permettre à l’admin/dev de déclarer des workflows sans changer le code.

Champs principaux :
- `id` (UUID, PK)
- `name` (TEXT)
- `description` (TEXT)
- `type` (TEXT: `openai_agent|n8n`)
- `openai_workflow_id` (TEXT, unique, format `wf_...`)
- `n8n_webhook_url` (TEXT)
- `is_active` (BOOLEAN)
- `created_by` (UUID, FK `auth.users`)
- `created_at`, `updated_at`

Contraintes :
- si `type=openai_agent` → `openai_workflow_id` requis et match `^wf_[a-zA-Z0-9]+$`
- si `type=n8n` → `n8n_webhook_url` requis

## RLS (Row Level Security)

### Objectif

Garantir qu’un utilisateur ne voit que **ses** threads et messages.

Règles appliquées :
- `chat_threads` :
  - SELECT/INSERT/UPDATE/DELETE autorisés uniquement si `auth.uid() = user_id`
- `chat_messages` :
  - SELECT/INSERT autorisés uniquement si le message appartient à un thread dont `user_id = auth.uid()`
- `chat_attachments` :
  - SELECT/INSERT autorisés uniquement si l’attachement appartient à un message d’un thread de l’utilisateur

## Impacts côté frontend/backend

- Le frontend doit toujours utiliser la session Supabase (sinon 401).
- L’Edge Function utilise `supabase.auth.getUser()` avec le token `Authorization` pour valider l’utilisateur.
- Les écritures (messages) passent par Supabase JS côté frontend (avec RLS).

