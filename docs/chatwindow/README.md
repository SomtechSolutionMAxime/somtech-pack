# Documentation — ChatWindow

Cette documentation standardise **la création et l’intégration du chat basé sur `ChatWindow`** (conversation + widgets `ChatWidget`).

> Note : on **ne documente pas** la couche “ChatKit UI” (composant web OpenAI).  
> Ici, on documente **ChatWindow** et tout ce qui est nécessaire pour le faire fonctionner : widgets, stockage, workflows, routeur SSE, et pages de gestion.

## Objectifs

- Décrire l’architecture **réutilisable** pour refaire le même chatbot dans un autre projet.
- Standardiser le **contrat widget** (`ChatWidget`) et le transport en SSE.
- Documenter la **page de gestion / preview** des widgets (Playground).
- Documenter la **gestion des workflows** (OpenAI Agent / n8n) côté UI + Edge Functions.

## Entrées UI utiles (dev)

- **Playground widgets** : `/admin/widget-playground`
- **Bulle de test ChatWindow** : bouton flottant (composant `ChatWindowWidget`)
- **Gestion des workflows** : section “Gestion des Workflows” (composant `WorkflowList`, rendu dans `AdminWorkflows`)

## Index

- [01 — Architecture](./01-architecture.md)
- [02 — Frontend (types, hook, composants)](./02-frontend.md)
- [03 — Widgets (contrat, renderer, cookbook)](./03-widgets.md)
- [04 — Backend (Edge Functions SSE pour ChatWindow)](./04-backend.md)
- [05 — Base de données (tables + RLS)](./05-database.md)
- [06 — Workflows (UI + Edge Functions)](./06-workflows.md)
- [07 — Gestion des widgets (Playground + bulles)](./07-widget-management.md)
- [08 — Configuration & déploiement](./08-deployment.md)
- [09 — Guide pas-à-pas (refaire un chatbot)](./09-guide-creation.md)
- [10 — Références](./10-references.md)

