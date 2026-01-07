---
description: Audit read-only de l’existant (DB/RLS/API/UI/docs) et génération de `03_existing_audit.md`.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline
1. **Setup**: exécuter `.mockmig/scripts/bash/setup-migration.sh --json` depuis la racine du repo et parser:
   - `MIGRATION_DIR`, `MODULE`
   - optionnel: `COMPONENT`, `MOCKUP_COMPONENT_DIR` (si `--component` est fourni)
2. **Gate check**: lire `${MIGRATION_DIR}/02_validation_packet.md` et vérifier qu’il est validé (sinon STOP).
3. **Inspecter** (read-only):
   - Supabase: `supabase/migrations/`, `supabase/functions/`
   - UI: `app/src/modules/`, `app/src/pages/`, `app/src/components/`
   - Docs: `modules/{module}/prd/{module}.md`
4. **Écrire**: `${MIGRATION_DIR}/03_existing_audit.md` (inclure posture sécurité: RLS + guards).
5. **Stop & report**: récap + liens vers fichiers trouvés.

## Référence workflow
Voir `.mockmig/templates/commands/audit.md`.

## Fin de commande (obligatoire) — NEXT/READY

### Artefacts
- `${MIGRATION_DIR}/03_existing_audit.md`

### NEXT

```text
/mockmig.gap --module <slug> --mockupPath <path> [--component <component>]
```

### READY

- READY: YES|NO
- BLOCKERS (si NO):
  - ex: “02_validation_packet.md non validé → exécuter /mockmig.validate …”


