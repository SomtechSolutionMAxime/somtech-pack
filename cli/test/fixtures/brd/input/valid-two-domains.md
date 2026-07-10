# BRD Test — Deux domaines (accumulation extend + domaine par row)

## 4. Exigences d'affaires (EA)

| ID | Énoncé | Statut | Priorité | Owner |
|----|--------|--------|----------|-------|
| EA-GBL-001 | Enjeu global unique | in_force | M | Sponsor |

## 5. Exigences fonctionnelles et règles d'affaires par domaine

### 5.1 Domaine — Clients (code: CLI)

#### Exigences fonctionnelles

| ID | Description | Statut | Priorité | Couvre | Réalisé par | Testé par | Owner |
|----|-------------|--------|----------|--------|-------------|-----------|-------|
| EF-CLI-001 | Fonction du domaine Clients | in_force | M | EA-GBL-001 |  | app/tests/cli.spec.ts | PO |

#### Règles d'affaires

| ID | Énoncé | Justification | Statut | Encadre | Testé par | Owner |
|----|--------|---------------|--------|---------|-----------|-------|
| RA-CLI-001 | Règle du domaine Clients | Justif CLI | in_force | EF-CLI-001 |  | Sponsor |

### 5.2 Domaine — Facturation (code: FAC)

#### Exigences fonctionnelles

| ID | Description | Statut | Priorité | Couvre | Réalisé par | Testé par | Owner |
|----|-------------|--------|----------|--------|-------------|-----------|-------|
| EF-FAC-001 | Fonction du domaine Facturation | proposed | S | EA-GBL-001 | T-20260601-0009 | app/tests/fac.spec.ts | PO |

#### Règles d'affaires

| ID | Énoncé | Justification | Statut | Encadre | Testé par | Owner |
|----|--------|---------------|--------|---------|-----------|-------|
| RA-FAC-001 | Règle du domaine Facturation | Justif FAC | accepted | EF-FAC-001 |  | Sponsor |

## 6. Hors-scope (HS)

### 6.1 Domaine — Facturation (code: FAC)

| ID | Énoncé | Justification | Statut | Re-considéré quand |
|----|--------|---------------|--------|---------------------|
| HS-FAC-001 | Pas de multi-devises | Scope v1 | accepted | v2.0 |

## 7. Changelog

| Version | Date       | Demande / Projet | Sponsor validant | Mode   | Résumé du changement |
|---------|------------|------------------|------------------|--------|----------------------|
| 1.0.0   | 2026-07-10 | D-20260710-0009  | Somtech          | manuel | Fixture deux domaines |
