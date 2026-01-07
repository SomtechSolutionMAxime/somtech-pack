---
description: Afficher l’état d’une migration mockmig (gates, artefacts présents, prochaine commande) et dire READY/NOT READY.
---

## User Input

```text
$ARGUMENTS
```

## Objectif

À n’importe quel moment, pouvoir demander :

```text
/mockmig.status --module <slug> --mockupPath <path>
```

et obtenir :
- ce qui est déjà présent dans `migration/{module}/...`
- quels **gates** bloquent (validation / sign-off / confirm)
- **NEXT** (commande suivante recommandée) + **READY** (oui/non)

## Entrées acceptées

- Mode standard:
  - `--module <slug> --mockupPath <path>`
- Mode runbook (recommandé si tu l’as):
  - `--plan migration/<module>/[components/<component>/]07_implementation_plan.md`
- Mode composant:
  - ajouter `--component <component>` (ou passer un `--plan` dans `components/<component>/`)

## Outline

1. **Setup**:
   - si `--plan` est fourni: exécuter `.mockmig/scripts/bash/setup-migration.sh --json --plan <path>` et parser `MIGRATION_DIR`, `MODULE`, `MOCKUP_DIR`, `COMPONENT`.
   - sinon: exécuter `.mockmig/scripts/bash/setup-migration.sh --json --module ... --mockupPath ... [--component ...]`.
2. **Déterminer le scope**:
   - scope = `module` si `COMPONENT` absent
   - scope = `component` si `COMPONENT` présent
3. **Inspecter les artefacts attendus** (presence + points bloquants):
   - `00_context.md`
   - `00_component_map.md` (module complexe)
   - `01_business_rules.md`
   - `02_validation_packet.md` (gate)
   - `03_existing_audit.md`
   - `04_gap_analysis.md`
   - `05_backend_tasks.md`
   - `06_ui_tasks.md`
   - `07_implementation_plan.md` (runbook)
4. **Gates**:
   - Gate A (validation) : si `02_validation_packet.md` absent → NOT READY pour audit/gap/tasks/plan/implementation
   - Gate B (sign-off runbook) : si `07_implementation_plan.md` absent ou sign-off non rempli → NOT READY pour `implementation`
   - Gate C (`--confirm`) : `implementation` ne doit jamais tourner sans `--confirm`
5. **Module complexe — exhaustivité inventaire**:
   - si `<MOCKUP_DIR>/src/components/*` existe:
     - l’inventaire module seul est **insuffisant**
     - vérifier qu’au moins un inventaire composant existe dans `migration/{module}/components/<component>/01_business_rules.md`
     - lister les composants “missing inventory”
6. **Choisir NEXT (règle)**:
   - si rien n’existe → NEXT = `/mockmig.start ...` (ou `/mockmig.inventory ...` si déjà démarré)
   - si `01_business_rules.md` manquant → NEXT = `/mockmig.inventory ...`
   - si `02_validation_packet.md` manquant → NEXT = `/mockmig.validate ...`
   - si module complexe et composants non inventoriés → NEXT = `/mockmig.inventory ... --component <first_missing>`
   - si validé mais pas de scaffold composants (module complexe) → NEXT = `/mockmig.components.init ...`
   - si validé et audit manquant → NEXT = `/mockmig.audit ...`
   - si audit ok et gap manquant → NEXT = `/mockmig.gap ...`
   - si gap ok et tasks manquantes → NEXT = backend.tasks puis ui.tasks
   - si tasks ok et plan manquant → NEXT = `/mockmig.plan ...`
   - si plan ok → NEXT = `/mockmig.implementation --plan <path> --confirm`
7. **Sortie**: afficher un tableau simple (artefact → statut) + gates + NEXT/READY.

## Fin de commande (obligatoire) — format de sortie

### NEXT

```text
<commande suivante>
```

### READY

- READY: YES|NO
- BLOCKERS (si NO):
  - <raison + action>

