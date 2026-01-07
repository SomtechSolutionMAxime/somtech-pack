---
description: Initialiser les sous-dossiers `migration/{module}/components/*` à partir de `mockup/src/components/*` (scaffold uniquement).
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline
1. **Setup**: exécuter `.mockmig/scripts/bash/setup-components.sh --json` depuis la racine du repo avec:
   - `--module <slug>`
   - `--mockupPath <path>`
   - optionnel: `--force`
2. **Résultat attendu**:
   - `migration/{module}/00_component_map.md` (template à remplir lors de `/mockmig.inventory` module)
   - `migration/{module}/components/<component>/` avec les artefacts `00_context.md` + `01–07`.
3. **Stop & report**:
   - afficher le nombre de composants détectés
   - lister les dossiers créés sous `migration/{module}/components/`



