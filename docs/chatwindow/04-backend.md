# 04 — Backend (Edge Functions SSE pour ChatWindow)

## Objectif backend

Le backend ChatWindow doit :
- vérifier l’utilisateur (token Supabase)
- sélectionner un workflow (OpenAI Agent / n8n) via `context.workflow_id`
- retourner une réponse **streamée** (SSE)
- optionnellement, retourner un ou plusieurs **widgets** au format `ChatWidget`

Dans ce repo, le routeur SSE est une Edge Function Supabase :
- `supabase/functions/chatkit/index.ts`

> Le nom `chatkit` est historique. Dans le périmètre de cette doc, il s’agit du **routeur SSE de ChatWindow**.

## Endpoint

- URL : `${VITE_SUPABASE_URL}/functions/v1/chatkit`
- Méthode : `POST`
- Réponse : `text/event-stream` (SSE)

Headers attendus :
- `Authorization: Bearer <access_token>` (session Supabase)
- `apikey: <VITE_SUPABASE_ANON_KEY>` (quand on appelle `/functions/v1/...`)

## Requête (format)

Le frontend envoie une structure “JSON-RPC compatible ChatKit” :

- `type: "threads.add_user_message"`
- `params.thread_id` : **thread id** (UUID)
- `params.input.content[]` : contient le texte utilisateur
- `params.context.workflow_id` : UUID d’un workflow en DB (`workflow_configurations`)

Important :
- côté backend, `context.workflow_id` est **requis** et doit être un UUID (sinon erreur 400).

## Réponse (SSE)

Le frontend accepte plusieurs événements. Deux options :

### Option A — Événement simple (compat)

Envoyer un “message assistant” directement :

```json
{ "type": "assistant_message", "content": "..." }
```

et finir par `[DONE]`.

### Option B — Événements type ChatKit (deltas)

Envoyer des événements de type :
- `thread.item.updated` (deltas)
- `thread.item.done` (message complet)

Le frontend sait les parser.

### Widgets

Pour afficher un widget, envoyer :

```json
{ "type": "widget", "widget": { /* ChatWidget */ } }
```

## Gestion d’erreurs

Stratégie :
- erreurs de validation → réponse JSON 400/401/404 (non SSE)
- erreurs pendant le stream → événement SSE :
  - `{ "type": "error", "error": "..." }`
  - suivi de `[DONE]`

## Intégration workflows

Le routeur SSE récupère le workflow depuis :
- table `workflow_configurations`
- colonnes selon `type` :
  - `openai_agent` → `openai_workflow_id` (format `wf_...`)
  - `n8n` → `n8n_webhook_url`

Ensuite :
- `n8n` : POST vers `n8n_webhook_url`, puis conversion en SSE
- `openai_agent` : appel OpenAI (détails d’API volontairement minimaux ici)

## Ce que le backend ne fait pas (dans ce standard)

- Pas de “template name” de widget : toujours `widget: <ChatWidget>` directement.
- Pas de formats divergents par projet : on garde un transport SSE stable.
- Pas de dépendance à un serveur externe obligatoire : objectif = Edge Functions + workflows configurables.

