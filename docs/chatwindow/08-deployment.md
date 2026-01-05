# 08 — Configuration & déploiement

## Variables d’environnement (frontend)

Requis pour ChatWindow (Vite) :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Notes :
- Le hook `useChatKit` vérifie que ces variables sont présentes si `context.workflow_id` est un UUID.

## Variables d’environnement (Edge Functions)

Pour les Edge Functions Supabase :
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Pour exécuter des workflows `openai_agent` (si utilisé côté routeur) :
- `OPENAI_API_KEY`

## Edge Functions à connaître

Pour ChatWindow :
- `supabase/functions/chatkit/` : routeur SSE + widgets
- `supabase/functions/workflows/` : CRUD workflows (UI admin)
- `supabase/functions/validate-workflow/` : validation (si présent/actif)

## Déploiement (Edge Functions)

Standard projet : utiliser l’outillage MCP Supabase (recommandé).

Sinon, en fallback (local) :
- `supabase functions deploy chatkit`
- `supabase functions deploy workflows`

## Migrations DB

Tables requises :
- `chat_threads`, `chat_messages` (+ optionnel `chat_attachments`)
- `workflow_configurations`

Les migrations sont dans `supabase/migrations/`.

Checklist DB :
- RLS activé sur tables chat (voir migration)
- index en place (`thread_id`, `created_at`, etc.)

## Post-déploiement — Smoke check rapide

- Accéder à `/admin/widget-playground`
- Ouvrir la bulle ChatWindow (sélectionner un workflow actif)
- Envoyer un message, vérifier :
  - réponse s’affiche
  - widgets éventuels s’affichent
  - actions fonctionnent (nouveau message/action ou comportement attendu)

