---
description: Régénérer le runbook `07_implementation_plan.md` en conservant l’avancement (cases cochées + journal). Requiert `--plan`.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Safety rule (mandatory)
- If `$ARGUMENTS` does NOT contain `--plan`, you MUST STOP and ask the user to rerun with:
  - `/mockmig.plan.regen --plan migration/<module>/[components/<component>/]07_implementation_plan.md`

## Outline
1. **Setup**: exécuter `.mockmig/scripts/bash/setup-migration.sh --json` depuis la racine du repo avec `--plan <path>` et parser:
   - `MIGRATION_DIR`, `MODULE`, `MOCKUP_DIR`
   - optionnel: `COMPONENT`
2. **Load current runbook**: lire `${MIGRATION_DIR}/07_implementation_plan.md` et extraire:
   - la liste des items checklist `- [ ] <ID>` / `- [x] <ID>` (map ID -> status)
   - la section **Sign-off** (à conserver)
   - la section **Journal** (à conserver)
   - la section **Archived** (à conserver)
3. **Recompute runbook source**: relire les artefacts `${MIGRATION_DIR}/03–06` et reconstruire une checklist à jour.
   - **Règle**: réutiliser les IDs existants des tâches (`B-...` et `U-...`) autant que possible pour stabilité.
4. **Merge (preserve progress)**:
   - si un item a le même ID qu’avant → conserver `[x]`/`[ ]`
   - items nouveaux → `[ ]`
   - items disparus → déplacer sous **Archived** (en gardant leur dernier statut)
5. **Write**: réécrire `${MIGRATION_DIR}/07_implementation_plan.md` (format runbook) et ajouter au journal une entrée `regen` avec timestamp.
6. **Report**: afficher les IDs ajoutés/supprimés + le chemin du runbook + prochaine action:
   - `/mockmig.implementation --plan <path> --confirm`

## Référence workflow
Voir `.mockmig/templates/commands/plan.regen.md`.

## Fin de commande (obligatoire) — NEXT/READY

### Artefacts
- `${MIGRATION_DIR}/07_implementation_plan.md` (mis à jour, avancement conservé)

### NEXT

```text
/mockmig.implementation --plan <path> --confirm
```

### READY

- READY: YES|NO
- BLOCKERS (si NO):
  - ex: “--plan manquant → relancer /mockmig.plan.regen --plan …”



