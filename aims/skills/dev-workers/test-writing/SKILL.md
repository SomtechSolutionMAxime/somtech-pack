---
name: test-writing
description: >
  Écrire des tests unitaires, d'intégration et e2e pour assurer la qualité du code.
  Ce skill guide l'agent dev-worker dans la sélection du bon type de test, la structure
  des tests (describe/it/expect), les patterns Playwright pour e2e, les tests RLS,
  et la mesure de coverage. Utiliser ce skill après code-implementation ou quand une
  feature a besoin d'une couverture de test.
---

# Test Writing

Des tests, c'est de la documentation qui crie si tu casses quelque chose. Ce skill définit quoi tester, quand, comment, et quelles métriques regarder.

## Quand ce skill s'active

- Une feature vient d'être implémentée (code-implementation complétée)
- Un bug a été fixé et il faut s'assurer qu'il ne revient pas
- Une PR demande une couverture minimum (`pr.review_request` avec action "add_tests")
- Un composant critique (auth, paiement, RLS) doit être testé

## Types de tests

### 1. Tests unitaires (Vitest/Jest)

**Scope** : Une seule fonction, composant ou module.

**Outil** : Vitest ou Jest + React Testing Library pour composants React.

**Quand** :
- Logique métier complexe (calcul de prix, validation formules)
- Composant avec états multiples
- Utilitaire importé par plusieurs fichiers

**Format** :

```typescript
// __tests__/invoice-calculator.test.ts
import { describe, it, expect } from 'vitest';
import { calculateInvoiceTotal } from '@/lib/invoice-calculator';

describe('calculateInvoiceTotal', () => {
  it('should sum line items correctly', () => {
    const items = [
      { amount_ht: 100, tva_rate: 0.20 },
      { amount_ht: 200, tva_rate: 0.20 }
    ];
    const result = calculateInvoiceTotal(items);
    expect(result.total_ht).toBe(300);
    expect(result.total_tva).toBe(60);
    expect(result.total_ttc).toBe(360);
  });

  it('should handle 0% TVA rate', () => {
    const items = [{ amount_ht: 100, tva_rate: 0 }];
    const result = calculateInvoiceTotal(items);
    expect(result.total_ttc).toBe(100);
  });

  it('should throw on negative amounts', () => {
    const items = [{ amount_ht: -50, tva_rate: 0.20 }];
    expect(() => calculateInvoiceTotal(items)).toThrow('Invalid amount');
  });
});
```

### 2. Tests d'intégration (Vitest + Supabase)

**Scope** : Interaction entre composant + API + DB.

**Outil** : Vitest + `@supabase/supabase-js` (ou Supabase local pour tests).

**Quand** :
- Créer un enregistrement en DB et vérifier qu'il apparaît dans l'UI
- Tester une mutation Supabase (INSERT, UPDATE, DELETE)
- Vérifier qu'une policy RLS fonctionne
- Tester un Edge Function

**Format** :

```typescript
// __tests__/invoice-export.integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Pour tests, utiliser service role
);

describe('Invoice Export Integration', () => {
  let userId: string;

  beforeEach(async () => {
    // Créer un user de test
    const { data } = await supabase.auth.admin.createUser({
      email: 'test@example.com',
      password: 'TestPass123!'
    });
    userId = data.user!.id;
  });

  afterEach(async () => {
    // Nettoyer
    await supabase.from('invoices').delete().eq('user_id', userId);
  });

  it('should create export_log when exporting', async () => {
    // Créer une facture
    const { error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id: userId,
        amount_ttc: 1000,
        status: 'sent'
      });
    expect(invoiceError).toBeNull();

    // Appeler la Edge Function
    const { data, error } = await supabase.functions.invoke('export-to-excel', {
      body: { startDate: '2026-01-01', endDate: '2026-12-31' },
      headers: { 'Authorization': `Bearer ${token}` }
    });

    expect(error).toBeNull();
    expect(data.file_url).toBeDefined();
  });

  it('should respect RLS — user cannot see other user exports', async () => {
    const otherUserId = '...';
    // Insérer un export pour l'autre user avec service role
    await supabase
      .from('export_logs')
      .insert({ user_id: otherUserId, export_type: 'invoices' });

    // Tenter de lire avec le premier user (client auth)
    const clientSupabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    // Authentifier le client avec userId
    const { data } = await clientSupabase
      .from('export_logs')
      .select('*');

    expect(data).toEqual([]); // Doit être vide grâce à RLS
  });
});
```

### 3. Tests e2e (Playwright)

**Scope** : Flux utilisateur complet (UI → API → DB).

**Outil** : Playwright avec page objects.

**Quand** :
- Feature critique end-to-end (export, achat, auth)
- Flux multi-écran (naviguer → remplir formulaire → télécharger)
- Vérifier l'affichage correct de données du serveur
- Tester une intégration externe (paiement, export)

**Format avec page objects** :

```typescript
// e2e/pages/invoice-page.ts
import { Page, expect } from '@playwright/test';

export class InvoicePage {
  constructor(private page: Page) {}

  async goToInvoicing() {
    await this.page.goto('/invoicing');
    await this.page.waitForSelector('[data-testid="invoice-list"]');
  }

  async clickExportButton() {
    await this.page.click('[data-testid="invoice-export-btn"]');
  }

  async selectDateRange(startDate: string, endDate: string) {
    await this.page.fill('[data-testid="export-start-date"]', startDate);
    await this.page.fill('[data-testid="export-end-date"]', endDate);
  }

  async submitExport() {
    // Écouter le téléchargement
    const downloadPromise = this.page.waitForEvent('download');
    await this.page.click('[data-testid="export-submit"]');
    const download = await downloadPromise;
    return download;
  }

  async expectErrorMessage(message: string) {
    await expect(
      this.page.locator(`text=${message}`)
    ).toBeVisible();
  }
}

// e2e/invoice-export.spec.ts
import { test, expect } from '@playwright/test';
import { InvoicePage } from './pages/invoice-page';

test.describe('Invoice Export Flow', () => {
  let invoicePage: InvoicePage;

  test.beforeEach(async ({ page }) => {
    invoicePage = new InvoicePage(page);
    // Login setup
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should export invoices successfully', async () => {
    await invoicePage.goToInvoicing();
    await invoicePage.clickExportButton();
    await invoicePage.selectDateRange('2026-01-01', '2026-12-31');

    const download = await invoicePage.submitExport();
    expect(download.suggestedFilename()).toContain('invoices');
    expect(download.suggestedFilename()).toContain('.xlsx');
  });

  test('should show error with invalid date range', async () => {
    await invoicePage.goToInvoicing();
    await invoicePage.clickExportButton();
    await invoicePage.selectDateRange('2026-12-31', '2026-01-01'); // End < Start

    await invoicePage.expectErrorMessage('La date de fin doit être après la date de début');
  });
});
```

## Patterns de test

### Tests RLS

Chaque table avec `user_id` doit avoir au minimum 2 tests RLS :

```typescript
describe('RLS — invoices table', () => {
  it('user can select own invoices', async () => {
    const { data, error } = await clientSupabase
      .from('invoices')
      .select('*')
      .eq('user_id', userId);

    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });

  it('user cannot select other user invoices', async () => {
    const { data, error } = await clientSupabase
      .from('invoices')
      .select('*')
      .eq('user_id', otherUserId);

    // RLS refuse la requête silencieusement (empty result)
    expect(data).toEqual([]);
  });

  it('user cannot insert invoice with different user_id', async () => {
    const { error } = await clientSupabase
      .from('invoices')
      .insert({
        user_id: otherUserId,  // Utilisateur essaie de falsifier
        amount_ttc: 1000
      });

    expect(error?.code).toBe('42501'); // row_security_violation
  });
});
```

### Mocking & Fixtures

Pour les tests unitaires avec dépendances externes :

```typescript
import { vi } from 'vitest';

describe('Export Service', () => {
  it('should call storage.upload', async () => {
    const mockUpload = vi.fn().mockResolvedValue({ path: 'exports/file.xlsx' });

    const exportService = new ExportService({
      storage: { upload: mockUpload }
    });

    await exportService.export({ startDate: '2026-01-01' });

    expect(mockUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'exports',
        key: expect.stringMatching(/\.xlsx$/)
      })
    );
  });
});
```

## Coverage targets

Viser ces minima selon le type de code :

| Type | Minimum |
|------|---------|
| Logique métier critique | 90% |
| Composants React | 80% |
| Edge Functions | 85% |
| Utilitaires | 75% |
| Pages (e2e suffit) | 50% |

Générer un rapport :

```bash
npm run test -- --coverage
```

Exemple output :

```
Statements   : 84.5% ( 185/219 )
Branches     : 78.2% ( 142/182 )
Functions    : 81.3% ( 130/160 )
Lines        : 85.1% ( 166/195 )
```

## Structure de base

### Pour un nouveau test file

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentOrFunction } from '@/path';

describe('ComponentOrFunction', () => {
  // Setup / Teardown
  beforeEach(() => {
    // Avant chaque test
  });

  afterEach(() => {
    // Après chaque test
  });

  // Scénario nominal
  it('should do X when Y', () => {
    // Arrange
    const input = { ... };

    // Act
    const result = ComponentOrFunction(input);

    // Assert
    expect(result).toBe(expected);
  });

  // Cas d'erreur
  it('should throw when Z', () => {
    expect(() => ComponentOrFunction(badInput)).toThrow('Error message');
  });

  // Edge cases
  it('should handle empty input', () => {
    // ...
  });
});
```

## Nommage et conventions

- **Fichier test** : Même nom que le module + `.test.ts` ou `.spec.ts`
  ```
  lib/invoice-calculator.ts
  __tests__/invoice-calculator.test.ts
  ```

- **Describe blocks** : Nommer après la fonction/composant
  ```typescript
  describe('calculateInvoiceTotal', () => { ... })
  describe('InvoiceExportButton', () => { ... })
  ```

- **Tests** : Décrire le comportement avec "should..."
  ```typescript
  it('should sum line items correctly', () => { ... })
  it('should throw on negative amounts', () => { ... })
  ```

## CI/CD Integration

Ajouter à la PR checklist :

```json
{
  "test_results": {
    "unit_tests": "passed (42 tests)",
    "coverage": "85.1%",
    "e2e_tests": "passed (8 scenarios)",
    "rls_tests": "passed (6 policies verified)"
  }
}
```

Aucune PR ne doit merger sans tests verts.

## Anti-patterns

- **Tests qui testent le test** : Un test trop simple ne sert à rien (`expect(1).toBe(1)`).
- **Too brittle** : Test qui casse au moindre refactoring cosmétique. Tester le comportement, pas les détails d'implémentation.
- **No async/await** : Les tests Supabase/e2e doivent être async. Oublier `await` = race conditions.
- **Shared state** : Tests qui dépendent d'un ordre d'exécution ou partagent des données. Utiliser `beforeEach`/`afterEach`.
- **Mocks partout** : Trop de mocks = test qui passe mais le code réel ne marche pas. Mélanger tests unitaires (mocks OK) et intégration (pas de mocks).
- **RLS tests oubliés** : Si tu ajoutes une table user, tu dois tester les policies RLS. Pas de RLS test = fuite potentielle.
- **E2E for everything** : Les tests e2e sont lents. Favoriser unit/intégration pour la couverture, e2e pour les flux critiques seulement.
- **No cleanup** : Laisser des données de test en base. Toujours nettoyer dans `afterEach`.
