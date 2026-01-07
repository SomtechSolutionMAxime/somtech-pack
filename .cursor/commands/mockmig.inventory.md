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
5. **Stop & report**:
   - afficher le chemin des fichiers générés + liste “NEEDS CLARIFICATION”.
   - si `COMPONENT` est absent et que des composants existent sous `<MOCKUP_DIR>/src/components/*`:
     - lister les composants détectés
     - indiquer explicitement que l’inventaire module est **nécessaire mais insuffisant** (inventaire composant requis pour éviter toute perte de règles métier).
   - fournir **NEXT/READY** (voir section ci-dessous).

## Référence workflow
Voir `.mockmig/templates/commands/inventory.md`.

## Fin de commande (obligatoire) — NEXT/READY

À la fin de la réponse, inclure :

### Artefacts
- `${MIGRATION_DIR}/00_context.md`
- `${MIGRATION_DIR}/01_business_rules.md`
- `${MIGRATION_DIR}/00_component_map.md` (si scope module + composants)

### NEXT

```text
/mockmig.validate --module <slug> --mockupPath <path> [--component <component>]
```

### READY

- READY: YES|NO
- BLOCKERS (si NO): <raisons actionnables>


