---
description: Générer le paquet de validation (gate) `02_validation_packet.md` et demander un OK explicite avant de continuer.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline
1. **Setup**: exécuter `.mockmig/scripts/bash/setup-migration.sh --json` depuis la racine du repo et parser:
   - `MIGRATION_DIR`, `MODULE`, `MOCKUP_DIR`
   - optionnel: `COMPONENT` (si `--component` est fourni)
2. **Load**: lire `${MIGRATION_DIR}/01_business_rules.md`.
3. **Générer le gate**: produire `${MIGRATION_DIR}/02_validation_packet.md` en imposant:
   - conformité `memory/constitution.md`
   - conformité `security/ARCHITECTURE_DE_SECURITÉ.md`
   - conformité ontologie
4. **Module complexe (exhaustivité)**:
   - si `COMPONENT` est absent et que `<MOCKUP_DIR>/src/components/*` existe:
     - inclure dans le paquet une checklist “Inventaire composant” (un item par composant)
     - lister clairement les composants dont l’inventaire n’a pas été fait (risque de perte de règles métier)
5. **STOP**: poser la question: “Valides-tu ce paquet (oui/non) ?” et ne pas enchaîner automatiquement.
6. **Fin de commande**: afficher NEXT/READY (voir section ci-dessous).

## Référence workflow
Voir `.mockmig/templates/commands/validate.md`.

## Fin de commande (obligatoire) — NEXT/READY

### Artefacts
- `${MIGRATION_DIR}/02_validation_packet.md`

### NEXT (si validation = OUI)

```text
/mockmig.components.init --module <slug> --mockupPath <path>
```

> Si scope composant (ou après init composants): NEXT peut être `/mockmig.audit ...` ou `/mockmig.component.run ...` selon le cas.

### READY

- READY: YES|NO
- BLOCKERS (si NO):
  - ex: “01_business_rules.md manquant → exécuter /mockmig.inventory …”
  - ex: “inventaires composants manquants (module complexe) → exécuter /mockmig.inventory … --component <x>”


