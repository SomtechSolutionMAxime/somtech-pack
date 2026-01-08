---
description: Point d’entrée unique du workflow mockmig. Valide `--module/--mockupPath`, détecte “module simple vs complexe (composants)”, et annonce NEXT/READY.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Objectif

Permettre à l’utilisateur de dire seulement :

```text
/mockmig.start --module <slug> --mockupPath <path>
```

…et d’obtenir immédiatement :
- où seront générés les artefacts (`migration/{module}/...`)
- si c’est un **module simple** ou un **module complexe** (composants)
- **la prochaine commande** à exécuter (**NEXT**) + si on est **prêt** (**READY**) + raisons si non

> Recommandé (pré-vol) : exécuter d’abord `/mockmig.doctor` pour vérifier que le runtime `.mockmig/` et les sources de vérité sont présents.

## Chemins `mockupPath` acceptés (important)

- **Par défaut** : `modules/maquette/<module>/...`
  - ex: `modules/maquette/devis/v1`
- **Alternative (maquette dans le module)** : `modules/<module>/maquette/...`
  - ex: `modules/ma-place-rh/maquette/v1` ou `modules/ma-place-rh/maquette`

## Outline

1. **Setup**: exécuter `.mockmig/scripts/bash/setup-migration.sh --json` depuis la racine du repo et parser:
   - `MIGRATION_DIR`, `MODULE`, `MOCKUP_DIR`
   - optionnel: `COMPONENT` (normalement absent pour `start`)
2. **Valider les inputs**:
   - `--module <slug>` présent et conforme (minuscules/chiffres/tirets)
   - `MOCKUP_DIR` existe
   - `MOCKUP_DIR` matche un des patterns de chemins acceptés (sinon STOP avec exemples corrigés)
3. **Détecter la complexité**:
   - si `<MOCKUP_DIR>/src/components/` existe et contient au moins un sous-dossier → **module complexe**
   - sinon → **module simple**
4. **Afficher un résumé** (à inclure dans la réponse):
   - module, mockupPath, MIGRATION_DIR
   - nombre de composants détectés + liste (si complexe)
5. **NE PAS générer tous les artefacts ici**: cette commande sert à “démarrer + orienter”. La génération se fait via les commandes dédiées.
6. **Fin de commande (obligatoire)**: afficher **NEXT/READY** :
   - NEXT recommandé:
     - `/mockmig.inventory --module <slug> --mockupPath <path>`
   - READY:
     - YES si mockupPath OK + dossier existe
     - NO sinon (avec “blockers” actionnables)

## Fin de commande (obligatoire) — format de sortie

À la fin de la réponse, inclure exactement ces sections:

### NEXT

```text
/mockmig.inventory --module <slug> --mockupPath <path>
```

### READY

- READY: YES|NO
- BLOCKERS (si NO):
  - <raison + action>
  - <raison + action>

