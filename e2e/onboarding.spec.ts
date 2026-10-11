import { test, expect } from './fixtures';

test.describe('First run', () => {
  test.use({ onboarded: false });

  test('a new learner is guided through language, level and goal into a short first session', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'What do you want to learn?' })).toBeVisible();
    // Nothing else competes for attention
    await expect(page.getByText('Syllabus progress')).toHaveCount(0);

    await page.getByRole('radio', { name: /English/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'How much do you already know?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await page.getByRole('radio', { name: /Complete beginner/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'How much time per day?' })).toBeVisible();
    await page.getByTestId('onboarding-start').click();
    // Focus mode: five cards and no app header
    await expect(page.getByText(/^1 \/ 5$/)).toBeVisible();
    await expect(page.getByTestId('open-switcher').locator('visible=true')).toHaveCount(0);
  });

  test('skipping lands on the normal dashboard and is remembered', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page.getByText('Syllabus progress')).toBeVisible();
    await page.waitForTimeout(900); // settings are saved with a 400 ms debounce
    await page.reload();
    await expect(page.getByText('Syllabus progress')).toBeVisible();
  });
});
