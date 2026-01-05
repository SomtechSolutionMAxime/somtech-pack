# 06 — Workflows (configuration + exécution)

## Objectif

Un **workflow** définit “où” et “comment” le message ChatWindow est traité.

Exemple (structure type) :
- la liste des workflows est stockée en base (`workflow_configurations`)
- l’UI permet de créer/éditer/supprimer ces workflows
- le routeur SSE (`chatkit`) lit `context.workflow_id` et exécute le workflow correspondant

## Types de workflows

- `openai_agent` : workflow OpenAI (identifiant `wf_...`)
- `n8n` : webhook n8n (URL)

## Gestion UI

### Liste + CRUD

- Vue : `src/components/documents/WorkflowList.tsx`
- Wrapper admin : `src/components/admin/AdminWorkflows.tsx`

Fonctionnalités :
- filtrer par type (OpenAI / n8n)
- afficher/masquer les inactifs
- créer / éditer / supprimer

### Hook `useWorkflows`

Fichier : `src/hooks/useWorkflows.ts`

Responsabilités :
- appeler les Edge Functions Supabase :
  - `GET workflows?include_inactive=true&type=openai_agent|n8n`
  - `POST workflows`
  - `PUT workflows/{id}`
  - `DELETE workflows/{id}`
  - `POST validate-workflow` (si utilisé)

## API Workflows (Edge Function)

Fichier : `supabase/functions/workflows/index.ts`

Résumé des endpoints :

- `GET /workflows`
  - query params :
    - `include_inactive=true|false`
    - `type=openai_agent|n8n`
- `POST /workflows`
  - body : `{ name, description?, type, openai_workflow_id?, n8n_webhook_url? }`
- `PUT /workflows/{id}`
  - autorisé uniquement si `created_by` = utilisateur courant
- `DELETE /workflows/{id}`
  - autorisé uniquement si `created_by` = utilisateur courant

Validation côté Edge Function :
- `openai_workflow_id` doit respecter `wf_...`
- `n8n_webhook_url` doit être une URL valide

## Routage côté ChatWindow

### Injection du workflow dans `context`

`ChatWindowWidget` permet de sélectionner un workflow et injecte :

```ts
context={ selectedWorkflowConfigId ? { workflow_id: selectedWorkflowConfigId } : undefined }
```

Le `workflow_id` est l’UUID d’un enregistrement dans `workflow_configurations`.

### Résolution côté backend

Le routeur SSE (Edge Function `chatkit`) :
- refuse si `context.workflow_id` absent ou non UUID
- charge le workflow en DB
- refuse si `workflow.is_active = false`
- exécute la branche correspondant au type

## Standard de réponse attendu (n8n)

Pour `type=n8n`, le routeur appelle le webhook et s’attend à :

- soit un JSON contenant :
  - `content` ou `message` (texte)
  - optionnel : `widget` (au format `ChatWidget`)
- soit un texte brut (fallback)

Le routeur convertit ensuite en SSE :
- `assistant_message` pour le texte
- `widget` si présent
- `[DONE]`

