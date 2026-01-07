---
description: Générer les tâches UI (pages, composants, validations, guards, Playwright) dans `06_ui_tasks.md` à partir du gap analysis.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline
1. **Setup**: exécuter `.mockmig/scripts/bash/setup-migration.sh --json` depuis la racine du repo et parser:
   - `MIGRATION_DIR`, `MODULE`
   - optionnel: `COMPONENT` (si `--component` est fourni)
2. **Gate check**: vérifier que `${MIGRATION_DIR}/02_validation_packet.md` est validé (sinon STOP).
3. Lire `${MIGRATION_DIR}/04_gap_analysis.md`.
4. Produire `${MIGRATION_DIR}/06_ui_tasks.md`:
   - pages + composants + états UI
   - validations client et erreurs claires
   - guards (`ProtectedRoute`, `ModuleAccessGuard`, `PermissionGuard`) si requis
   - validation UI obligatoire avec objectif 0 erreur console (Playwright)
5. Stop & report (compter tâches P0/P1/P2) + NEXT/READY (voir section ci-dessous).

## Référence workflow
Voir `.mockmig/templates/commands/ui_tasks.md`.

## Fin de commande (obligatoire) — NEXT/READY

### Artefacts
- `${MIGRATION_DIR}/06_ui_tasks.md`

### NEXT

```text
/mockmig.plan --module <slug> --mockupPath <path> [--component <component>]
```

### READY

- READY: YES|NO
- BLOCKERS (si NO):
  - ex: “05_backend_tasks.md manquant → exécuter /mockmig.backend.tasks …”


