---
description: Synchroniser les PRD (module + composant) à partir du runbook mockmig. Utiliser `--plan`.
---

## User Input

```text
$ARGUMENTS
```

## Usage

```text
/mockmig.prd.sync --plan migration/<module>/components/<component>/07_implementation_plan.md
```

## Outline
1. **Setup**: résoudre le runbook cible via `.mockmig/scripts/bash/setup-migration.sh --json --plan <path>`.\n+2. **Load**: lire `${MIGRATION_DIR}/00_context.md` + artefacts `01–07` (runbook = source de vérité).\n+3. **Sync**:\n+   - Créer/mettre à jour `modules/{module}/prd/components/{component}.md`.\n+   - Mettre à jour `modules/{module}/prd/{module}.md` (index composants + mapping + changelog).\n+4. **Report**: lister les fichiers PRD modifiés + points d’attention.\n+\n+## Référence workflow\n+Voir `.mockmig/templates/commands/prd.sync.md`.\n+


