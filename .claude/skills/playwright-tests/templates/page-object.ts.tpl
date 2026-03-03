/**
 * Page Object pour {{PAGE_NAME}}
 * {{DESCRIPTION}}
 */

import { Page, expect } from '@playwright/test';
import { BasePage } from '../base.page';

export class {{CLASS_NAME}}Page extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ============================================================================
  // Sélecteurs
  // ============================================================================

  private get mainContainer() {
    return this.page.locator('[data-testid="{{PAGE_ID}}-container"]');
  }

  private get primaryButton() {
    return this.page.getByRole('button', { name: /{{PRIMARY_ACTION}}/i });
  }

  // ============================================================================
  // Navigation
  // ============================================================================

  async navigate(): Promise<void> {
    await this.goto('{{PAGE_PATH}}');
  }

  // ============================================================================
  // Actions
  // ============================================================================

  async performPrimaryAction(): Promise<void> {
    await this.primaryButton.click();
    await this.waitForPageLoad();
  }

  // ============================================================================
  // Assertions
  // ============================================================================

  async expectPageLoaded(): Promise<void> {
    await expect(this.mainContainer).toBeVisible();
  }

  async expectActionSuccess(): Promise<void> {
    await this.expectSuccessToast();
  }
}
