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
   - `MIGRATION_DIR`, `MODULE`
   - optionnel: `COMPONENT` (si `--component` est fourni)
2. **Load**: lire `${MIGRATION_DIR}/01_business_rules.md`.
3. **Générer le gate**: produire `${MIGRATION_DIR}/02_validation_packet.md` en imposant:
   - conformité `memory/constitution.md`
   - conformité `security/ARCHITECTURE_DE_SECURITÉ.md`
   - conformité ontologie
4. **STOP**: poser la question: “Valides-tu ce paquet (oui/non) ?” et ne pas enchaîner automatiquement.

## Référence workflow
Voir `.mockmig/templates/commands/validate.md`.


