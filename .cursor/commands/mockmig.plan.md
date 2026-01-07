---
description: Générer un runbook d’implémentation (checklist + sign-off + journal) dans `07_implementation_plan.md` à partir des artefacts 03–06.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline
1. **Setup**: exécuter `.mockmig/scripts/bash/setup-migration.sh --json` depuis la racine du repo et parser:
   - `MIGRATION_DIR`, `MODULE`, `MOCKUP_DIR`
   - optionnel: `COMPONENT` (si `--component` est fourni)
2. **Load inputs**:
   - `${MIGRATION_DIR}/03_existing_audit.md`
   - `${MIGRATION_DIR}/04_gap_analysis.md`
   - `${MIGRATION_DIR}/05_backend_tasks.md`
   - `${MIGRATION_DIR}/06_ui_tasks.md`
3. **Write runbook**: produire `${MIGRATION_DIR}/07_implementation_plan.md` :
   - Contexte (module, composant, mockup path, MIGRATION_DIR)
   - Décisions D1/D2/D3 (scope lock)
   - **Sign-off (gate)** intégré dans ce plan (laissé à `TBD` tant que non validé)
   - Checklist par phases (DB/RLS/RPC → UI → Tests → Docs) avec **IDs stables** (préférer `B-...` / `U-...` des tâches existantes)
   - Journal initial (append-only)
4. **Stop & report**: afficher le chemin du fichier et la prochaine action:
   - remplir le sign-off dans `07_implementation_plan.md`
   - exécuter ensuite: `/mockmig.implementation --plan <path> --confirm`

## Référence workflow
Voir `.mockmig/templates/commands/plan.md`.

## Fin de commande (obligatoire) — NEXT/READY

### Artefacts
- `${MIGRATION_DIR}/07_implementation_plan.md`

### NEXT

```text
/mockmig.implementation --plan migration/<module>/[components/<component>/]07_implementation_plan.md --confirm
```

### READY

- READY: YES|NO
- BLOCKERS (si NO):
  - ex: “03–06 incomplets → exécuter audit/gap/tasks manquants puis relancer /mockmig.plan”


