---
description: Générer les tâches backend (DB/RLS/API/tests/docs) dans `05_backend_tasks.md` à partir du gap analysis.
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
4. Produire `${MIGRATION_DIR}/05_backend_tasks.md`:
   - DB + migrations versionnées (Supabase)
   - RLS obligatoire (policies séparées SELECT/INSERT/UPDATE/DELETE)
   - conformité `auth.users` (pas de duplication d’identité)
   - tests pour fonctions SECURITY DEFINER / ABAC si utilisées
   - mise à jour PRD module si impact schéma/RLS/API
5. Stop & report (compter tâches P0/P1/P2).

## Référence workflow
Voir `.mockmig/templates/commands/backend_tasks.md`.


