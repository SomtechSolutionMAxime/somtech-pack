# BRD Test — `in_force` sans `Testé par` → validator warning (pas erreur)

> Cas qui doit produire un warning « dette de couverture » mais rester valide
> (exit 0). Documente le comportement défini par STD-033 §2.6.bis : pas d'erreur
> automatique (laisse place à une décision sponsor explicite « j'oppose même
> sans test ») mais signal explicite de dette.
>
> Le runner ne distingue pas les warnings — ce cas est `valid-*` (both exit 0).
> Lancer manuellement `python3 scripts/validate-brd.py …` pour voir le warning.

## 4. Exigences d'affaires (EA)

| ID | Énoncé | Statut | Priorité | Owner |
|----|--------|--------|----------|-------|
| EA-GBL-001 | EA stub | in_force | M | Sponsor |

## 5. Exigences fonctionnelles et règles d'affaires par domaine

### 5.1 Domaine — Clients (code: CLI)

#### Exigences fonctionnelles

| ID | Description | Statut | Priorité | Couvre | Réalisé par | Testé par | Owner |
|----|-------------|--------|----------|--------|-------------|-----------|-------|
| EF-CLI-001 | EF in_force sans test (warning attendu) | in_force | M | EA-GBL-001 |  |  | PO Somtech |
| EF-CLI-002 | EF in_force avec test (pas de warning) | in_force | S | EA-GBL-001 |  | app/tests/e2e/cli-002.spec.ts | PO Somtech |

#### Règles d'affaires

| ID | Énoncé | Justification | Statut | Encadre | Testé par | Owner |
|----|--------|---------------|--------|---------|-----------|-------|
| RA-CLI-001 | RA in_force sans test (warning attendu) | Justification stub | in_force | EF-CLI-001 |  | Sponsor |

## 7. Changelog

| Version | Date       | Demande / Projet | Sponsor validant | Mode   | Résumé du changement |
|---------|------------|------------------|------------------|--------|----------------------|
| 1.0.0   | 2026-06-01 | D-20260601-0004  | Action Progex    | manuel | Test gabarit v2.1.0 |
