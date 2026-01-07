---
description: Produire un gap analysis (maquette vs existant) et générer `04_gap_analysis.md`.
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
2. Lire `${MIGRATION_DIR}/01_business_rules.md` + `${MIGRATION_DIR}/03_existing_audit.md`.
3. Comparer et lister les écarts (DB/RLS/API/UI/tests/docs/ontologie/sécurité) avec priorités P0/P1/P2.
4. Écrire `${MIGRATION_DIR}/04_gap_analysis.md`.

## Référence workflow
Voir `.mockmig/templates/commands/gap.md`.


