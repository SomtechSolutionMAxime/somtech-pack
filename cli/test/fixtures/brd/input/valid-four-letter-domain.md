# BRD Test — Domaine à 4 lettres (GRPH) et références D-/P- dans Réalisé par

## 4. Exigences d'affaires (EA)

| ID | Énoncé | Statut | Priorité | Owner |
|----|--------|--------|----------|-------|
| EA-GBL-001 | Enjeu global unique | in_force | M | Sponsor |

## 5. Exigences fonctionnelles et règles d'affaires par domaine

### 5.1 Domaine — Clients (code: CLI)

#### Exigences fonctionnelles

| ID | Description | Statut | Priorité | Couvre | Réalisé par | Testé par | Owner |
|----|-------------|--------|----------|--------|-------------|-----------|-------|
| EF-CLI-001 | Fonction du domaine Clients (code 3 lettres) | in_force | M | EA-GBL-001 | T-20260601-0009 | app/tests/cli.spec.ts | PO |

#### Règles d'affaires

| ID | Énoncé | Justification | Statut | Encadre | Testé par | Owner |
|----|--------|---------------|--------|---------|-----------|-------|
| RA-CLI-001 | Règle du domaine Clients | Justif CLI | in_force | EF-CLI-001 |  | Sponsor |

### 5.2 Domaine — Graphe relationnel (code: GRPH)

#### Exigences fonctionnelles

| ID | Description | Statut | Priorité | Couvre | Réalisé par | Testé par | Owner |
|----|-------------|--------|----------|--------|-------------|-----------|-------|
| EF-GRPH-001 | Fonction réalisée par une demande entière | in_force | M | EA-GBL-001 | D-20260711-0001 | app/tests/grph.spec.ts | PO |
| EF-GRPH-002 | Fonction réalisée par un projet et une story | proposed | S | EA-GBL-001 | P-20260711-0001, T-20260713-0004 | app/tests/grph.spec.ts | PO |

#### Règles d'affaires

| ID | Énoncé | Justification | Statut | Encadre | Testé par | Owner |
|----|--------|---------------|--------|---------|-----------|-------|
| RA-GRPH-001 | Règle du domaine Graphe | Justif GRPH | accepted | EF-GRPH-001 |  | Sponsor |

## 6. Hors-scope (HS)

### 6.1 Domaine — Graphe relationnel (code: GRPH)

| ID | Énoncé | Justification | Statut | Re-considéré quand |
|----|--------|---------------|--------|---------------------|
| HS-GRPH-001 | Pas de rendu 3D du graphe | Scope v1 | accepted | v2.0 |

## 7. Changelog

| Version | Date       | Demande / Projet | Sponsor validant | Mode   | Résumé du changement |
|---------|------------|------------------|------------------|--------|----------------------|
| 1.0.0   | 2026-07-26 | D-20260726-0001  | Somtech          | manuel | Fixture domaine 4 lettres |
