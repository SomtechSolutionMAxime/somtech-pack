---
description: Pré-vol du workflow mockmig. Vérifie la présence des dépendances (scripts/templates + sources de vérité) et renvoie READY/NO + BLOCKERS actionnables.
---

## User Input

```text
$ARGUMENTS
```

## Objectif

Avant de démarrer une migration, vérifier que le projet contient tout ce qu’il faut pour exécuter `mockmig.*` :
- runtime `.mockmig/` (scripts bash + templates)
- sources de vérité (constitution / sécurité / ontologie)

## Outline

1. Vérifier les fichiers requis (existence) :
   - `.mockmig/scripts/bash/setup-migration.sh`
   - `.mockmig/scripts/bash/setup-components.sh`
   - `.mockmig/templates/commands/inventory.md`
   - `.mockmig/templates/commands/validate.md`
   - `.mockmig/templates/commands/implementation.md`
2. Vérifier les sources de vérité (existence) :
   - `memory/constitution.md`
   - `security/ARCHITECTURE_DE_SECURITÉ.md`
   - `ontologie/01_ontologie.md`
   - `ontologie/02_ontologie.yaml`
3. Si des éléments manquent : READY=NO + blockers actionnables.
4. Sinon : READY=YES + NEXT = `/mockmig.start --module <slug> --mockupPath <path>`.

## Fin de commande (obligatoire) — NEXT/READY

### NEXT

```text
/mockmig.start --module <slug> --mockupPath <path>
```

### READY

- READY: YES|NO
- BLOCKERS (si NO):
  - <fichier manquant + action recommandée>

