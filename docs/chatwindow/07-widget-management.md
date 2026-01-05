# 07 — Gestion des widgets (Playground + bulles)

## Objectif

Standardiser une boucle de dev rapide pour :
- concevoir des widgets (`ChatWidget`)
- vérifier le rendu
- copier/coller le JSON “canonique”
- tester l’intégration “en situation” via une bulle ChatWindow

## 1) Widget Playground (admin)

### Route

- `/admin/widget-playground`

### Implémentation

- Page : `src/pages/WidgetPlayground.tsx`
- Route déclarée : `src/App.tsx` (route protégée)
- Accès :
  - depuis `/admin` : bouton “Ouvrir Widget Playground” (`src/pages/Admin.tsx`)
  - depuis la sidebar : entrée “Widget Playground” (`src/components/layout/AppSidebar.tsx`)

### Fonctionnalités

- **Exemples** : liste d’exemples (button/form/select/checkbox/radio/summary_confirm)
- **Rendu** : affiche le rendu via `ChatWidget`
- **JSON widget** : affiche le widget seul (copiable)
- **JSON event SSE** : affiche l’enveloppe `{ type:"widget", widget: ... }` (copiable)
- **Actions** : lorsqu’on clique une action, on a :
  - un toast “Action déclenchée”
  - un log console `"[WidgetPlayground] action"`

Ce Playground sert de **contrôle qualité** pour le contrat widget.

## 2) Bulle de test ChatWindow (exemple)

### Rôle

Tester un widget **dans un flux de conversation réel** (messages + SSE + widget + action).

### Implémentation

- `src/components/chat/ChatWindowWidget.tsx`

Fonctionnement :
- bouton flottant (ouvre un `Sheet`)
- sélection d’un workflow (`useWorkflows`)
- injection de `context.workflow_id` dans `ChatWindow`

## 3) À quoi sert “la page de gestion des widgets” dans une standardisation ?

Quand on “refait un chatbot” pour un autre projet, la partie qui change le plus est :
- la logique métier du workflow
- les widgets renvoyés (forme, wording, actions)

Le standard consiste à :
- garder `ChatWindow` + `ChatWidget` identiques
- faire évoluer le contrat widget de manière contrôlée
- maintenir **Playground** comme preuve de rendu + debug

## Checklist validation (dev)

- Le widget s’affiche dans `/admin/widget-playground` et les actions répondent (toast/log).
- La bulle ChatWindow peut déclencher un widget depuis un workflow réel.
- Aucune erreur console (TypeError) pendant la navigation et les interactions.

