---
description: Orchestrateur du workflow mockmig pour un composant (inventory → validate → audit → gap → tâches backend/UI → plan → implementation).
handoffs:
  - label: Inventaire (composant)
    agent: mockmig.inventory
    prompt: Génère l’inventaire des règles métier depuis la maquette, scoped au composant (--component) et écrit dans migration/{module}/components/{component}/01_business_rules.md.
    send: true
  - label: Gate de validation (composant)
    agent: mockmig.validate
    prompt: Produit le paquet de validation du composant (02_validation_packet.md) et demande un OK explicite.
    send: true
  - label: Audit de l’existant (composant)
    agent: mockmig.audit
    prompt: Audit read-only de l’existant (03_existing_audit.md) pour le composant, après validation.
    send: true
  - label: Gap analysis (composant)
    agent: mockmig.gap
    prompt: Compare maquette vs existant et produit un gap analysis priorisé (04_gap_analysis.md) pour le composant.
    send: true
  - label: Tâches backend (composant)
    agent: mockmig.backend.tasks
    prompt: Génère les tâches backend (05_backend_tasks.md) du composant, conformes sécurité/RLS/ontologie.
    send: true
  - label: Tâches UI (composant)
    agent: mockmig.ui.tasks
    prompt: Génère les tâches UI (06_ui_tasks.md) du composant + validation UI obligatoire (0 erreur console).
    send: true
  - label: Plan d’implémentation (composant)
    agent: mockmig.plan
    prompt: Génère un plan d’exécution (07_implementation_plan.md) pour le composant à partir des artefacts 03–06.
    send: true
  - label: Implémentation (composant) (avec --confirm)
    agent: mockmig.implementation
    prompt: Exécute réellement la migration du composant (code + migrations Supabase). Requiert --confirm.
    send: true
---

## User Input

```text
$ARGUMENTS
```

## Pré-requis
- Le user input DOIT contenir:
  - `--module <slug>`
  - `--mockupPath <path>`
  - `--component <component>`
  - (ou) `--plan migration/<module>/components/<component>/07_implementation_plan.md`

## Règle d’or
Ce workflow **doit s’arrêter** après `/mockmig.validate` tant que l’utilisateur n’a pas explicitement validé (oui/non).

## Outline
1. Démarrer par `/mockmig.inventory` en fournissant `--component`.
2. Exécuter `/mockmig.validate` et attendre le sign-off.
3. Si validé: `/mockmig.audit` → `/mockmig.gap` → `/mockmig.backend.tasks` → `/mockmig.ui.tasks` → `/mockmig.plan`.
4. Implémenter uniquement avec confirmation explicite: `/mockmig.implementation --plan <path> --confirm` (recommandé) ou avec `--module/--mockupPath/--component` (rétro-compat).


