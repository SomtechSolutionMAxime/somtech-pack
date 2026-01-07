---
description: Orchestrateur du workflow de migration de maquette (mode module: inventaire → validation → init composants; mode composant: pipeline complet via mockmig.component.run).
handoffs:
  - label: Inventaire règles métier
    agent: mockmig.inventory
    prompt: Génère l’inventaire des règles métier depuis la maquette (01_business_rules.md).
    send: true
  - label: Gate de validation
    agent: mockmig.validate
    prompt: Produit le paquet de validation (02_validation_packet.md) et demande un OK explicite.
    send: true
  - label: Init composants (scaffold)
    agent: mockmig.components.init
    prompt: Crée `migration/{module}/components/*` à partir de `mockup/src/components/*` (scaffold uniquement).
    send: true
  - label: Audit de l’existant
    agent: mockmig.audit
    prompt: Audit read-only de l’existant (03_existing_audit.md) après validation.
    send: true
  - label: Gap analysis
    agent: mockmig.gap
    prompt: Compare maquette vs existant et produit un gap analysis priorisé (04_gap_analysis.md).
    send: true
  - label: Tâches backend
    agent: mockmig.backend.tasks
    prompt: Génère les tâches backend (05_backend_tasks.md) conformes sécurité/RLS/ontologie.
    send: true
  - label: Tâches UI
    agent: mockmig.ui.tasks
    prompt: Génère les tâches UI (06_ui_tasks.md) + validation UI obligatoire (0 erreur console).
    send: true
  - label: Plan d’implémentation
    agent: mockmig.plan
    prompt: Génère un runbook d’exécution (07_implementation_plan.md) à partir des artefacts 03–06.
    send: true
  - label: Implémentation (avec --confirm)
    agent: mockmig.implementation
    prompt: Exécute réellement la migration (code + migrations Supabase). Requiert --confirm + sign-off dans le runbook.
    send: true
---

## User Input

```text
$ARGUMENTS
```

## Règle d’or
Ce workflow **doit s’arrêter** après `/mockmig.validate` tant que l’utilisateur n’a pas explicitement validé (oui/non).

## Outline
1. Démarrer par `/mockmig.inventory`.
2. Exécuter `/mockmig.validate` et attendre le sign-off.
3. Si validé:
   - exécuter `/mockmig.components.init` (scaffold des dossiers composants)
   - puis migrer **par composant** via `/mockmig.component.run --component <x>` (pipeline complet).
4. Si tu modifies des artefacts après coup (03–06), régénérer le runbook sans perdre l’avancement:
   - `/mockmig.plan.regen --plan migration/<module>/components/<component>/07_implementation_plan.md`


