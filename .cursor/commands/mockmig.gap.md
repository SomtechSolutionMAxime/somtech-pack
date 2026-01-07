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
5. **Stop & report**: afficher le chemin du gap analysis + NEXT/READY (voir section ci-dessous).

## Référence workflow
Voir `.mockmig/templates/commands/gap.md`.

## Fin de commande (obligatoire) — NEXT/READY

### Artefacts
- `${MIGRATION_DIR}/04_gap_analysis.md`

### NEXT

```text
/mockmig.backend.tasks --module <slug> --mockupPath <path> [--component <component>]
```

### READY

- READY: YES|NO
- BLOCKERS (si NO):
  - ex: “03_existing_audit.md manquant → exécuter /mockmig.audit …”


