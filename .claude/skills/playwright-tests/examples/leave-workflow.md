# Exemple: Workflow de Demande de Congé

Cet exemple montre comment utiliser l'architecture de tests pour tester un workflow complet de demande de congé.

## Scénario

1. **Employé** crée une demande de congé
2. **Manager** approuve la demande
3. **Employé** vérifie que le statut est "approuvé"

## Code

```typescript
import { test } from '../../fixtures';
import { LeaveRequestWorkflow } from '../../workflows/leave-request.workflow';

test('Workflow complet de demande de congé', async ({ browser }) => {
  const workflow = new LeaveRequestWorkflow(browser)
    .withEmployee('compagnon1')       // Martin Roy
    .withManager('contremaitre1')      // Luc Bergeron
    .withLeaveData({
      type: 'paid',
      comment: 'Vacances familiales',
    })
    .withDateRange(7, 10);             // Dans 7 à 10 jours

  // Étape 1: L'employé crée sa demande
  await workflow.employeeCreatesRequest();

  // Étape 2: Le manager approuve
  await workflow.managerApproves();

  // Étape 3: L'employé vérifie le statut
  await workflow.employeeVerifiesStatus('approved');
});
```

## Exécution

```bash
# Lancer ce test spécifique
npx playwright test specs/leave/full-workflow.spec.ts

# Lancer tous les workflows
npx playwright test --project=ma-place-rh:workflows

# Mode debug
npx playwright test specs/leave/full-workflow.spec.ts --debug
```

## Points Clés

1. **Multi-contexte**: Chaque rôle (employé, manager) a son propre contexte browser isolé
2. **Auth Bypass**: Utilise le localStorage pour simuler l'authentification
3. **Fluent API**: Configuration chainable pour une meilleure lisibilité
4. **Cleanup automatique**: Les contextes sont fermés après chaque étape

## Variantes

### Scénario de refus
```typescript
await workflow.employeeCreatesRequest();
await workflow.managerRejects('Période de haute activité');
await workflow.employeeVerifiesStatus('rejected');
```

### Approbation par le directeur
```typescript
const workflow = new LeaveRequestWorkflow(browser)
  .withEmployee('apprenti1')
  .withManager('directeur');  // Le directeur peut tout approuver

await workflow.runApprovalScenario();
```

### Plusieurs employés simultanés
```typescript
const [ctx1, ctx2] = await Promise.all([
  browser.newContext(),
  browser.newContext(),
]);

// Créer des demandes en parallèle
```
