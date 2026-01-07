---
description: Exécuter l’implémentation (code + migrations Supabase) à partir des tâches mockmig. Requiert `--confirm`.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Safety rule (mandatory)
- If `$ARGUMENTS` does NOT contain `--confirm`, you MUST STOP and ask the user to rerun with:
  - `/mockmig.implementation --plan migration/<module>/[components/<component>/]07_implementation_plan.md --confirm`
  - (fallback) `/mockmig.implementation --module <slug> --mockupPath <path> [--component <slug>] --confirm`

## Outline
1. **Setup**: résoudre le runbook cible:
   - si `--plan` est fourni: exécuter `.mockmig/scripts/bash/setup-migration.sh --json --plan <path>` et parser `MIGRATION_DIR`, `MODULE`, `MOCKUP_DIR`, `COMPONENT`.
   - sinon: exécuter `.mockmig/scripts/bash/setup-migration.sh --json --module ... --mockupPath ... [--component ...]`.
2. **Gate check (runbook)**: lire `${MIGRATION_DIR}/07_implementation_plan.md` et vérifier que **Sign-off** est rempli (sinon STOP).
3. **Load**:
   - `${MIGRATION_DIR}/07_implementation_plan.md` (source de vérité)
   - `${MIGRATION_DIR}/04_gap_analysis.md`
   - `${MIGRATION_DIR}/05_backend_tasks.md`
   - `${MIGRATION_DIR}/06_ui_tasks.md`
4. **Execute (ordered, with writeback)**:
   - **Backend/DB**: créer/appliquer migrations dans `supabase/migrations/` (RLS, RPC, contraintes), via les outils MCP Supabase.
   - **UI**: appliquer les modifications sous `app/src/` (guards, routes/pages, hooks).
   - **Tests**: mettre à jour/ajouter tests (Playwright + unit) selon tâches.
   - **Docs**: mettre à jour PRD module **et PRD composant** (si scope composant). Recommandé: `/mockmig.prd.sync --plan <runbook>`.
   - Après chaque étape, **mettre à jour le runbook**:
     - cocher les items correspondants (`[x]`)
     - ajouter une entrée au **Journal** (timestamp, action, résultat)
5. **Validation**:
   - 0 erreur console sur parcours critiques (validation navigateur/Playwright si applicable).
   - vérifier que migrations appliquées et RLS effective.
6. **Report**: lister fichiers touchés + migrations appliquées + reste à faire.

## Référence workflow
Voir `.mockmig/templates/commands/implementation.md`.


