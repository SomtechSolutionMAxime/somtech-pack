# BRD Test — Couvre référence une EA inexistante (parser OK, validator FAIL)

## 4. Exigences d'affaires (EA)

| ID | Énoncé | Statut | Priorité | Owner |
|----|--------|--------|----------|-------|
| EA-GBL-001 | EA réellement déclarée | in_force | M | Sponsor |

## 5. Exigences fonctionnelles et règles d'affaires par domaine

### 5.1 Domaine — Global (code: GBL)

#### Exigences fonctionnelles

| ID | Description | Statut | Priorité | Couvre | Réalisé par | Testé par | Owner |
|----|-------------|--------|----------|--------|-------------|-----------|-------|
| EF-GBL-001 | EF qui pointe vers EA-GBL-999 inexistante | in_force | M | EA-GBL-999 |  |  | PO Somtech |

#### Règles d'affaires

| ID | Énoncé | Justification | Statut | Encadre | Testé par | Owner |
|----|--------|---------------|--------|---------|-----------|-------|
| RA-GBL-001 | Règle stub | Justification stub | in_force | EF-GBL-001 |  | Sponsor |

## 7. Changelog

| Version | Date       | Demande / Projet | Sponsor validant | Mode   | Résumé du changement |
|---------|------------|------------------|------------------|--------|----------------------|
| 1.0.0   | 2026-05-30 | D-20260530-0001  | Action Progex    | manuel | Test couvre broken |
