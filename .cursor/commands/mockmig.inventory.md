---
description: Inventorier les règles métier d’une maquette (`modules/maquette/**`) et générer `00_context.md` + `01_business_rules.md`.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline
1. **Setup**: exécuter `.mockmig/scripts/bash/setup-migration.sh --json` depuis la racine du repo et parser:
   - `MIGRATION_DIR`, `MODULE`, `MOCKUP_DIR`
   - optionnel: `COMPONENT`, `MOCKUP_COMPONENT_DIR` (si `--component` est fourni)
2. **Load sources de vérité**: lire `memory/constitution.md`, `security/ARCHITECTURE_DE_SECURITÉ.md`, `ontologie/01_ontologie.md`, `ontologie/02_ontologie.yaml`.
3. **Inspecter la maquette**:
   - si `COMPONENT` est fourni: scoper l’inspection à `MOCKUP_COMPONENT_DIR`
   - sinon: lire le contenu de `MOCKUP_DIR` (captures, docs markdown, composants/prototype) et extraire écrans + comportements
4. **Écrire les artefacts**:
   - Mettre à jour `${MIGRATION_DIR}/00_context.md` si nécessaire
   - Remplir `${MIGRATION_DIR}/01_business_rules.md` (catalogue BR-xxx + mapping + sécurité).
   - Si `COMPONENT` est absent (run module): remplir aussi `migration/{module}/00_component_map.md` (cartographie composants).
5. **Stop & report**: afficher le chemin des fichiers générés + liste “NEEDS CLARIFICATION”.

## Référence workflow
Voir `.mockmig/templates/commands/inventory.md`.


