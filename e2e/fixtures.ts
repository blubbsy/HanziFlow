import { test as base, expect } from '@playwright/test';

/**
 * Like Playwright's `test`, but the browser profile starts as a returning learner (first-run setup done),
 * so tests land on the dashboard. Tests of the first-run flow itself use `{ onboarded: false }`.
 */
export const test = base.extend<{ onboarded: boolean }>({
  onboarded: [true, { option: true }],
  page: async ({ page, onboarded }, use) => {
    if (onboarded) {
      await page.addInitScript(() => {
        if (!localStorage.getItem('adilingo:state')) {
          localStorage.setItem('adilingo:state', JSON.stringify({ version: 3, settings: { onboarded: true }, progress: {} }));
        }
      });
    }
    await use(page);
  },
});
export { expect };
