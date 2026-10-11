import { test, expect } from '@playwright/test';
import { openSwitcher, selectCourse } from './helpers';

test.use({ viewport: { width: 1280, height: 800 } });

test.describe('Specialty courses', () => {
  test('start a specialty course from the catalogue, study, and return to the language course untouched', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Syllabus progress')).toBeVisible();

    await selectCourse(page, 'chinese:emotor');

    // The specialty course has paths (no grammar), topics and a dictionary
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const nav = page.getByRole('navigation').first();
    await expect(nav.getByRole('button', { name: /Paths|学习路径|分级路径/ }).first()).toBeVisible();
    await page.goto('/#/learn');
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(page.getByText('Essentials').first()).toBeVisible();
    await page.goto('/#/home');
    await expect(page.getByText('Essentials').first()).toBeVisible();

    await page.getByRole('button', { name: /start today's session|开始今日/i }).first().click();
    await expect(page.getByRole('button', { name: /End session|结束/ })).toBeVisible();
    await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible();
    await page.getByRole('button', { name: /End session|结束/ }).click();

    // Unreachable language-course screens redirect
    await page.goto('/#/irregular');
    await expect(page).toHaveURL(/#\/learn$/);
    await expect(page.locator('text=Irregular')).toHaveCount(0);
    await page.goto('/#/home');

    // The banner names the specialty course and offers the way back to the language course
    await expect(page.getByRole('region', { name: /Specialty course/ })).toBeVisible();
    await page.getByTestId('back-to-language-course').click();
    await expect(page.getByRole('region', { name: /Specialty course/ })).toHaveCount(0);
    await expect(page.locator('text=Syllabus progress')).toBeVisible();
    await expect(page.getByText('Essentials')).toHaveCount(0);
  });

  test('English terms of a domain are studied with the English course machinery', async ({ page }) => {
    await page.goto('/');
    await selectCourse(page, 'english:power-electronics');
    await page.goto('/#/dictionary');
    await page.getByRole('searchbox').or(page.getByRole('textbox')).first().fill('IGBT');
    const hit = page.getByText(/insulated-gate bipolar transistor/i).first();
    await expect(hit).toBeVisible();
    await hit.click();
    // The answer side shows the definition and the abbreviation
    await expect(page.getByText(/Definition · Abbreviation: IGBT/).first()).toBeVisible();
  });
});

test.describe('Daily mix', () => {
  test('a field can be added to and removed from the daily mix', async ({ page }) => {
    await page.goto('/');
    await openSwitcher(page);
    const toggle = page.locator('[data-mix="english:power-electronics"]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByText(/from your daily mix/i).first()).toBeVisible();

    await page.getByRole('button', { name: 'Settings' }).first().click();
    await expect(page.getByRole('button', { name: /Remove Power electronics/i })).toBeVisible();
    await page.getByRole('button', { name: /Remove Power electronics/i }).click();
    await expect(page.getByRole('button', { name: /Remove Power electronics/i })).toHaveCount(0);
  });

  test('when the main course is done for today, the session consists of mix cards tagged with their course', async ({ page }) => {
    await page.addInitScript(() => {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      localStorage.setItem(
        'adilingo:state',
        JSON.stringify({
          version: 3,
          settings: { course: 'chinese', uiLanguage: 'en', rotation: { courses: ['english:power-electronics'], percent: 25 } },
          progress: {},
          stats: { dailyByCourse: { chinese: { [today]: { reviewed: 999, correct: 999, newCards: 999 } } } },
        }),
      );
    });
    await page.goto('/');
    await expect(page.getByText(/daily mix has/i)).toBeVisible();
    await page.getByRole('button', { name: /start today's session/i }).first().click();
    await expect(page.getByText(/From your daily mix:/).first()).toBeVisible();
    // The language course stays the active one
    await expect(page.getByTestId('back-to-language-course')).toHaveCount(0);
  });
});

test.describe('Topic vocabulary size', () => {
  test('topic packs are large in both courses', async ({ page }) => {
    await page.goto('/#/topics');
    await expect(page.locator('[data-pack-words]').first()).toBeVisible();
    // Every pack card shows its word count; none of the curated packs is tiny
    const counts = await page.locator('[data-pack-words]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-pack-words'))));
    expect(counts.length).toBeGreaterThanOrEqual(15);
    for (const c of counts) expect(c).toBeGreaterThanOrEqual(100);
  });
});

test.describe('Chinese grammar wiki', () => {
  test('search, open an article, jump to a lesson and back', async ({ page }) => {
    await page.goto('/#/learn');
    await page.getByRole('tab', { name: /Wiki|语法百科/ }).click();
    const search = page.getByRole('searchbox');
    await search.fill('了');
    const first = page.locator('[data-article]').first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page.locator('[data-wiki-article]')).toBeVisible();

    const lesson = page.locator('[data-lesson]').first();
    await lesson.click();
    await expect(page.locator('[data-wiki-article]')).toHaveCount(0);
    await page.getByRole('button', { name: /Back to the wiki article|返回百科文章/ }).click();
    await expect(page.locator('[data-wiki-article]')).toBeVisible();
  });

  test('the English course has the same Paths, Grammar and Wiki tabs and trainable lessons', async ({ page }) => {
    await page.goto('/');
    await selectCourse(page, 'english');
    await page.goto('/#/learn');
    await expect(page.getByRole('tab')).toHaveCount(3);
    await page.getByRole('tab').nth(1).click();
    await page.locator('ul li button').first().click(); // first English lesson
    await page.getByRole('button', { name: /Start practice|开始练习|Üben|Practice/i }).first().click();
    await expect(page.getByRole('button', { name: /^Check$|检查|Prüfen/ })).toBeVisible();
  });
});
