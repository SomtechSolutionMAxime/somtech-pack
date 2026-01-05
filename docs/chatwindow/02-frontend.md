# 02 — Frontend (ChatWindow)

## Fichiers clés

- Types : `src/types/chat.ts`
- Hook : `src/hooks/useChatKit.ts`
- UI conversation : `src/components/chat/ChatWindow.tsx`
- UI messages : `src/components/chat/ChatMessage.tsx`, `src/components/chat/ChatInput.tsx`
- UI widgets : `src/components/chat/ChatWidget.tsx`
- Bulle de test : `src/components/chat/ChatWindowWidget.tsx`

## Types TypeScript

Le frontend s’appuie sur les interfaces suivantes (extrait) :

- `ChatMessage` : `role`, `content`, `timestamp`
- `ChatThread` : `id`, `title`, `created_at`, `updated_at`
- `ChatWidget` : `id`, `type`, `data`, `actions`
- `ChatWidgetAction` : `id`, `label`, `action`, `payload`

À retenir :
- `ChatWidget.type` a une liste **large** dans les types, mais seuls certains types sont réellement rendus par `ChatWidget.tsx`.
- Le champ `metadata` existe côté types et DB pour permettre l’évolution sans casser.

## Le hook `useChatKit` (utilisé par ChatWindow)

> Le nom est historique : dans `useChatKit` est utilisé pour **ChatWindow**.

Responsabilités :
- Charger les messages d’un thread (`chat_messages`) quand `threadId` est fourni.
- Créer un thread (`chat_threads`) au premier message.
- Sauver les messages user/assistant en base.
- Envoyer un message au backend **en SSE** et parser les événements.
- Stocker les widgets reçus et les exposer à l’UI.

### Routage backend

Le hook décide de l’URL cible selon `context.workflow_id` :
- si `workflow_id` est un UUID → `POST ${VITE_SUPABASE_URL}/functions/v1/chatkit`
- sinon → fallback dev (`VITE_CHATKIT_API_URL` ou `http://localhost:8000`)

Pour standardiser “ChatWindow-only”, on part du principe que :
- **`context.workflow_id` est toujours présent et UUID** (workflow en DB)
- le backend utilisé est **l’Edge Function** `chatkit`

### Parsing SSE (côté client)

Le parseur accepte plusieurs formes (pour compatibilité) :
- événements “compat” : `assistant_message`, `message`
- événements “style ChatKit” : `thread.item.done`, `thread.item.updated`, `thread.item.added`
- widgets : `{"type":"widget","widget":<ChatWidget>}`
- fin : `[DONE]`

## Composant `ChatWindow`

`ChatWindow` orchestre l’écran :
- affiche l’état vide
- rend la liste des messages
- rend les widgets sous le dernier message
- gère la saisie (composant `ChatInput`)

### Envoi d’un message

`ChatInput` appelle `onSend`, qui appelle `sendMessage(content, context)` du hook.

### Déclenchement d’une action widget

`ChatWidget` appelle `onAction(action, formData?)`.  
`ChatWindow` transforme cela en appel `triggerAction(action.action, {...action.payload, ...formData})`.

Consequence :
- une action est traitée “comme un message” et repasse par le même routeur SSE
- le backend doit lire `context.action_id` et `context.payload` (si nécessaire)

## Bulle de test `ChatWindowWidget`

Objectif : fournir une boucle rapide d’itération.

Fonctionnement :
- ouvre un `Sheet` latéral
- liste les workflows (via `useWorkflows`)
- stocke le workflow sélectionné dans `localStorage` (ex: `chatwindow.selected_workflow_config_id`)
- injecte `context={ workflow_id: selectedWorkflowConfigId }` dans `ChatWindow`

## Bonnes pratiques UI

- **IDs stables** : pour les widgets, utiliser des `id` déterministes (ex: `w-ticket-form-001`).
- **Actions stables** : `action` doit être stable (ex: `navigate`, `open_url`, `create_ticket`).
- **Données minimales** : éviter de renvoyer un `widget.data` énorme côté backend (préférer `payload` + champs saisis).
- **Accessibilité** : labels associés, focus correct (les composants shadcn/radix aident).

