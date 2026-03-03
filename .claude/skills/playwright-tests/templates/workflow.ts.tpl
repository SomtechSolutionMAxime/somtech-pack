/**
 * Workflow Builder pour {{WORKFLOW_NAME}}
 * {{DESCRIPTION}}
 */

import { Page, Browser, BrowserContext } from '@playwright/test';
import { TEST_USERS, TestUser, TestUserKey } from '../utils/test-users';

// ============================================================================
// Types
// ============================================================================

export interface {{WORKFLOW_NAME}}Context {
  employeeUser: TestUser;
  managerUser: TestUser;
  // Ajouter d'autres données partagées ici
}

// ============================================================================
// Helpers
// ============================================================================

async function loginViaBypass(page: Page, user: TestUser): Promise<void> {
  await page.addInitScript((userId) => {
    window.localStorage.setItem('cg.devSelectedUser', userId);
    window.localStorage.removeItem('cg.devSignedOut');
  }, user.id);

  await page.goto('/ma-place-rh');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="app-layout"], nav, .sidebar', { timeout: 15000 });
}

// ============================================================================
// Workflow Builder
// ============================================================================

export class {{WORKFLOW_NAME}}Workflow {
  private context: {{WORKFLOW_NAME}}Context;
  private browser: Browser;
  private activeContexts: BrowserContext[] = [];

  constructor(browser: Browser) {
    this.browser = browser;
    this.context = {
      employeeUser: TEST_USERS.compagnon1,
      managerUser: TEST_USERS.contremaitre1,
    };
  }

  // ============================================================================
  // Configuration (Fluent API)
  // ============================================================================

  withEmployee(userKey: TestUserKey): this {
    const user = TEST_USERS[userKey];
    if (!user) throw new Error(`Unknown user key: ${userKey}`);
    this.context.employeeUser = user;
    return this;
  }

  withManager(userKey: TestUserKey): this {
    const user = TEST_USERS[userKey];
    if (!user) throw new Error(`Unknown user key: ${userKey}`);
    this.context.managerUser = user;
    return this;
  }

  // ============================================================================
  // Étapes du workflow
  // ============================================================================

  async step1_employeeAction(): Promise<this> {
    const context = await this.browser.newContext();
    this.activeContexts.push(context);
    const page = await context.newPage();

    await loginViaBypass(page, this.context.employeeUser);

    // TODO: Implémenter l'action employé

    await context.close();
    this.activeContexts = this.activeContexts.filter((c) => c !== context);
    return this;
  }

  async step2_managerAction(): Promise<this> {
    const context = await this.browser.newContext();
    this.activeContexts.push(context);
    const page = await context.newPage();

    await loginViaBypass(page, this.context.managerUser);

    // TODO: Implémenter l'action manager

    await context.close();
    this.activeContexts = this.activeContexts.filter((c) => c !== context);
    return this;
  }

  // ============================================================================
  // Scénarios pré-construits
  // ============================================================================

  async runFullScenario(): Promise<this> {
    await this.step1_employeeAction();
    await this.step2_managerAction();
    return this;
  }

  // ============================================================================
  // Accesseurs
  // ============================================================================

  getContext(): {{WORKFLOW_NAME}}Context {
    return this.context;
  }

  async cleanup(): Promise<void> {
    for (const ctx of this.activeContexts) {
      await ctx.close();
    }
    this.activeContexts = [];
  }
}
