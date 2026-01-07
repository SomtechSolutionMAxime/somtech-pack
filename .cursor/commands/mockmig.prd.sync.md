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
1. **Setup**: résoudre le runbook cible via `.mockmig/scripts/bash/setup-migration.sh --json --plan <path>` et parser `MIGRATION_DIR`, `MODULE`, `MOCKUP_DIR`, `COMPONENT`.
2. **Load**:
   - lire `${MIGRATION_DIR}/00_context.md`
   - lire les artefacts `01–07` (le runbook `07_implementation_plan.md` est la source de vérité)
3. **Sync**:
   - créer/mettre à jour `modules/{module}/prd/components/{component}.md` (si scope composant)
   - mettre à jour `modules/{module}/prd/{module}.md` (index composants + mapping + changelog)
4. **Report**: lister les fichiers PRD modifiés + points d’attention + NEXT/READY (voir section ci-dessous).

## Référence workflow
Voir `.mockmig/templates/commands/prd.sync.md`.

## Fin de commande (obligatoire) — NEXT/READY

### Artefacts
- `modules/{module}/prd/{module}.md`
- `modules/{module}/prd/components/{component}.md` (si scope composant)

### NEXT

```text
/mockmig.status --plan migration/<module>/[components/<component>/]07_implementation_plan.md
```

### READY

- READY: YES|NO
- BLOCKERS (si NO):
  - ex: “--plan manquant → relancer /mockmig.prd.sync --plan …”


