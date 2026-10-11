import { expect, type Page } from '@playwright/test';

/** Opens the course switcher (the same button exists in the sidebar and the top bar; only one is visible). */
export async function openSwitcher(page: Page) {
  await page.locator('[data-testid="open-switcher"]:visible').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

/** Switches course through the switcher dialog, exactly as a learner would. */
export async function selectCourse(page: Page, courseId: string) {
  await openSwitcher(page);
  await page.getByRole('dialog').locator(`[data-course="${courseId}"]`).first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
