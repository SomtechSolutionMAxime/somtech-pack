# Découpage — `/plan-servicedesk` dans une branche dédiée (D-20260630-0002)

> Trace écrite du découpage (Phase C). Source : workflow `analyse-decoupage-demande` (lecture seule) + arbitrages humains. Apparié au design doc `2026-06-30-plan-servicedesk-branche-dediee-design.md`.

## Grain BRD
- **Grain** : `application` (module_id NULL).
- **Résolu depuis** : `application` (grain app pur).
- **EF tracées / manquantes** : **N/A** — Somtech Pack est de l'outillage interne sans BRD (`brd_document_id` null/null + déclaration explicite de la demande). Aucune EF à créer (forcer une EF artificielle violerait la règle d'or n°10 à l'inverse).

## Demande
**D-20260630-0002** — Consigner l'exercice de `/plan-servicedesk` dans une branche git dédiée.

## Découpage Epic → Story (G/W/T résumé)

### Epic A — `[FEAT]` Isoler l'exercice dans `plan/D-xxxx` (E-20260630-0015)
1. **T-20260630-0044** `[FEAT]` Inverser l'ordre B↔A : Demande avant brainstorm (+ R1 rollback « laisser en l'état »).
2. **T-20260630-0045** `[FEAT]` Créer/basculer `plan/D-xxxx` + garde-fou git adaptatif (+ R4 DoD validation e2e manuelle).
3. **T-20260630-0046** `[FEAT]` Écrire le fichier de découpage dédié en Phase C (+ R5 règle de slug).
4. **T-20260630-0047** `[FEAT]` Sortie : commit + push + PR après Phase D, merge humain (+ R6 déclencheur figé).
5. **T-20260630-0048** `[TEST]` Test anti-régression du contrat git + assertion non-régression `superplan` (R3).

### Epic B — `[STD]` Gouvernance (E-20260630-0016)
6. **T-20260630-0049** `[STD]` Formaliser le préfixe `plan/` dans la convention (côté repo Architecture, règle d'or n°7) (R2).

## Ordre recommandé
T-0044 → T-0045 → T-0046 → T-0047 → T-0048, puis (ou en parallèle, côté Architecture) T-0049.

## Verdict de la critique adversariale
- **`pret_a_creer` initial : `false`** — 1 bloquant + 3 majeurs + 2 mineurs (tous des trous de spécification).
- **Défauts résolus** (R1–R6, cf. design doc §Résolution). Création de la hiérarchie validée par **dépassement de gate explicite** (Maxime, GO du 2026-06-30) après résolution.

## Défauts traités
- **R1 (bloquant)** rollback brainstorm-échoué-après-B.1 → laisser en l'état + message clair.
- **R2 (majeur)** préfixe `plan/` hors liste blanche → gardé, formalisation côté Architecture (E-20260630-0016).
- **R3 (majeur)** non-régression `superplan` non testée → assertion ajoutée au test (T-0048).
- **R4 (majeur)** sûreté garde-fou git non vérifiée → validation e2e manuelle en DoD (T-0045).
- **R5 (mineur)** règle de slug sans brainstorm → dérivé du titre de la Demande.
- **R6 (mineur)** déclencheur de la PR → figé après Phase D.
