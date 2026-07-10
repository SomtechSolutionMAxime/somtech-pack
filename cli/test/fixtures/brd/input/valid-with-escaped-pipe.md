# BRD Test — Pipe échappé \| dans une cellule (parser doit accepter)

## 4. Exigences d'affaires (EA)

| ID | Énoncé | Statut | Priorité | Owner |
|----|--------|--------|----------|-------|
| EA-GBL-001 | EA avec un pipe \| échappé dans l'énoncé | in_force | M | Sponsor |

## 5. Exigences fonctionnelles et règles d'affaires par domaine

### 5.1 Domaine — Clients (code: CLI)

#### Exigences fonctionnelles

| ID | Description | Statut | Priorité | Couvre | Réalisé par | Testé par | Owner |
|----|-------------|--------|----------|--------|-------------|-----------|-------|
| EF-CLI-001 | EF mentionnant flag --output\|stdout | in_force | M | EA-GBL-001 |  | app/tests/e2e/cli-output.spec.ts | PO Somtech |

#### Règles d'affaires

| ID | Énoncé | Justification | Statut | Encadre | Testé par | Owner |
|----|--------|---------------|--------|---------|-----------|-------|
| RA-CLI-001 | Règle stub | Justification stub | in_force | EF-CLI-001 | app/tests/e2e/L2-stub.spec.ts | Sponsor |

## 7. Changelog

| Version | Date       | Demande / Projet | Sponsor validant | Mode   | Résumé du changement |
|---------|------------|------------------|------------------|--------|----------------------|
| 1.0.0   | 2026-05-30 | D-20260530-0001  | Action Progex    | manuel | Test pipe échappé |
