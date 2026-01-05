# 09 — Guide pas-à-pas : refaire un chatbot ChatWindow

Ce guide décrit la procédure **réutilisable** pour remettre en place ChatWindow + widgets dans un autre projet.

## Prérequis

- Supabase (Auth + Postgres + Edge Functions)
- Frontend React (Vite) avec Supabase JS
- Un mécanisme de workflow au choix :
  - `openai_agent` (workflow id `wf_...`)
  - `n8n` (webhook URL)

## Étape 1 — Base de données

1. Appliquer les migrations pour :
   - `chat_threads`, `chat_messages` (optionnel `chat_attachments`)
   - `workflow_configurations`
2. Vérifier RLS :
   - l’utilisateur ne doit voir que ses threads/messages

Références :
- `supabase/migrations/20241124000000_create_chat_tables.sql`
- `supabase/migrations/20251127165948_add_workflow_tables.sql`

## Étape 2 — Edge Functions

Déployer :
- `chatkit` (routeur SSE pour ChatWindow)
- `workflows` (CRUD workflows pour l’UI)

Références :
- `supabase/functions/chatkit/index.ts`
- `supabase/functions/workflows/index.ts`

## Étape 3 — Frontend (UI)

Réutiliser les composants :
- `src/components/chat/ChatWindow.tsx`
- `src/components/chat/ChatWidget.tsx`
- `src/hooks/useChatKit.ts`
- `src/components/chat/ChatWindowWidget.tsx` (bulle de test)

Ajouter l’outil de gestion :
- `src/pages/WidgetPlayground.tsx` (route `/admin/widget-playground`)

## Étape 4 — Configurer un workflow

Via l’UI “Gestion des Workflows” :
- créer un workflow `openai_agent` (avec `openai_workflow_id`) ou `n8n` (avec webhook)
- vérifier qu’il est **actif**

Notes :
- `ChatWindowWidget` injecte le workflow sélectionné dans `context.workflow_id`.
- Le routeur SSE refuse si `workflow_id` n’est pas un UUID valide.

## Étape 5 — Produire un widget depuis un workflow

Standard :
- retourner un événement widget au format :
  - `{ "type": "widget", "widget": <ChatWidget> }`

Pour `n8n`, le webhook peut renvoyer :
- `content/message` (texte)
- `widget` (objet `ChatWidget`) — optionnel

## Étape 6 — Validation

### Validation UI (obligatoire)

- `/admin/widget-playground` :
  - chaque exemple s’affiche
  - les actions déclenchent un toast + log
- Bulle ChatWindow :
  - sélectionner un workflow actif
  - envoyer un message
  - vérifier le rendu du texte + widgets

### Checklist

- [ ] Les messages user/assistant sont persistés en base
- [ ] Le streaming SSE fonctionne (réponse progressive ou au moins “DONE” propre)
- [ ] Les widgets se rendent sans erreur
- [ ] Les actions renvoient un événement observable (message/action)
- [ ] Console navigateur : 0 erreur (TypeError)

## Étape 7 — Documentation projet

Quand vous dupliquez ChatWindow dans un autre projet :
- recopier cette documentation dans un dossier `docs/chatbot-<projet>/`
- documenter les widgets spécifiques (cookbook)
- documenter les actions attendues (contrat backend)

