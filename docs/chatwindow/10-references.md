# 10 — Références

## Code (frontend)

- Types chat : `src/types/chat.ts`
- Hook ChatWindow : `src/hooks/useChatKit.ts`
- UI conversation : `src/components/chat/ChatWindow.tsx`
- UI widgets : `src/components/chat/ChatWidget.tsx`
- Bulle de test : `src/components/chat/ChatWindowWidget.tsx`
- Playground : `src/pages/WidgetPlayground.tsx`
- Admin entrypoint : `src/pages/Admin.tsx`
- Sidebar entry : `src/components/layout/AppSidebar.tsx`

## Code (backend / Supabase Edge Functions)

- Routeur SSE ChatWindow : `supabase/functions/chatkit/index.ts`
- CRUD workflows : `supabase/functions/workflows/index.ts`

## DB (migrations)

- Tables chat + RLS : `supabase/migrations/20241124000000_create_chat_tables.sql`
- Workflows : `supabase/migrations/20251127165948_add_workflow_tables.sql`

## Contrat widgets

- Contrat canonique + cookbook : `agentbuilder/WIDGETS_CONTRACT.md`

## Glossaire

- **SSE (Server-Sent Events)** : flux HTTP unidirectionnel du serveur vers le client (type `text/event-stream`).
- **Thread** : conversation (table `chat_threads`).
- **Message** : entrée user/assistant/system (table `chat_messages`).
- **Widget** : composant interactif rendu sous le chat, conforme au type `ChatWidget`.
- **Workflow** : configuration DB qui route un message vers un backend (OpenAI Agent ou n8n).

