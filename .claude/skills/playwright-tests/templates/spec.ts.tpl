/**
 * Tests pour {{FEATURE_NAME}}
 * {{DESCRIPTION}}
 */

import { test, expect, TEST_USERS } from '../../fixtures';
// import { {{PAGE_CLASS}}Page } from '../../page-objects/{{PAGE_PATH}}';
// import { {{WORKFLOW_CLASS}}Workflow } from '../../workflows/{{WORKFLOW_FILE}}';

test.describe('{{FEATURE_NAME}} - Tests basiques', () => {
  test('Page se charge correctement', async ({ employeePage }) => {
    await employeePage.goto('/ma-place-rh/{{PAGE_ROUTE}}');
    await employeePage.waitForLoadState('networkidle');

    // Vérifier que la page est chargée
    await expect(employeePage.locator('text=/{{PAGE_TITLE}}/i').first()).toBeVisible();
  });

  test('Actions principales fonctionnent', async ({ employeePage }) => {
    await employeePage.goto('/ma-place-rh/{{PAGE_ROUTE}}');
    await employeePage.waitForLoadState('networkidle');

    // TODO: Tester les actions principales
  });
});

test.describe('{{FEATURE_NAME}} - Workflow multi-rôles', () => {
  test.describe.configure({ mode: 'serial' });

  test('Workflow complet fonctionne', async ({ browser }) => {
    // TODO: Utiliser le workflow builder
    // const workflow = new {{WORKFLOW_CLASS}}Workflow(browser)
    //   .withEmployee('compagnon1')
    //   .withManager('contremaitre1');
    // await workflow.runFullScenario();
  });
});

test.describe('{{FEATURE_NAME}} - Permissions', () => {
  test('Employé a accès', async ({ employeePage }) => {
    await employeePage.goto('/ma-place-rh/{{PAGE_ROUTE}}');
    await employeePage.waitForLoadState('networkidle');

    await expect(employeePage.url()).toContain('/{{PAGE_ROUTE}}');
  });

  test('Manager a accès', async ({ managerPage }) => {
    await managerPage.goto('/ma-place-rh/{{PAGE_ROUTE}}');
    await managerPage.waitForLoadState('networkidle');

    await expect(managerPage.url()).toContain('/{{PAGE_ROUTE}}');
  });
});
