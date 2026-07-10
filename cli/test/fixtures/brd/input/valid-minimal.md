# BRD Test — Minimal valide

## 4. Exigences d'affaires (EA)

| ID | Énoncé | Statut | Priorité | Owner |
|----|--------|--------|----------|-------|
| EA-GBL-001 | Le client peut consulter l'historique complet de ses interactions | in_force | M | Sponsor |
| EA-GBL-002 | La solution synchronise les données en temps réel | in_force | S | Sponsor |

## 5. Exigences fonctionnelles et règles d'affaires par domaine

### 5.1 Domaine — Clients (code: CLI)

#### Exigences fonctionnelles

| ID | Description | Statut | Priorité | Couvre | Réalisé par | Testé par | Owner |
|----|-------------|--------|----------|--------|-------------|-----------|-------|
| EF-CLI-001 | Afficher la fiche client avec son historique | in_force | M | EA-GBL-001 |  | app/tests/e2e/clients-history.spec.ts | PO Somtech |
| EF-CLI-002 | Synchroniser la fiche avec le CRM tiers | in_force | S | EA-GBL-002 | T-20260601-0001 | app/tests/e2e/clients-sync.spec.ts, app/src/modules/crm/hooks/useSync.test.ts | PO Somtech |

#### Règles d'affaires

| ID | Énoncé | Justification | Statut | Encadre | Testé par | Owner |
|----|--------|---------------|--------|---------|-----------|-------|
| RA-CLI-001 | Un client a un seul propriétaire commercial actif | Évite conflits de relance | in_force | EF-CLI-001 | app/tests/e2e/L2-clients-owner-unique.spec.ts | Sponsor |
| RA-CLI-002 | La synchronisation tolère un délai de 30 secondes | Trade-off perf/cohérence | in_force | EF-CLI-001, EF-CLI-002 |  | Lead Tech |

## 6. Hors-scope (HS)

### 6.1 Domaine — Clients (code: CLI)

| ID | Énoncé | Justification | Statut | Re-considéré quand |
|----|--------|---------------|--------|---------------------|
| HS-CLI-001 | La solution ne gère pas la facturation | Phase v1, scope volontairement restreint | in_force | v2.0 |

## 7. Changelog

| Version | Date       | Demande / Projet | Sponsor validant | Mode   | Résumé du changement |
|---------|------------|------------------|------------------|--------|----------------------|
| 1.0.0   | 2026-05-30 | D-20260530-0001  | Action Progex    | manuel | Première version in_force après phase Validation |
