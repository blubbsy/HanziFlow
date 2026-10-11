import { test, expect } from '@playwright/test';
import { selectCourse } from './helpers';

test.describe('Adilingo App Smoke', () => {
  test('loads home dashboard and navigation successfully', async ({ page }) => {
    await page.goto('/');
    // Check that title or brand exists
    await expect(page).toHaveTitle(/Adilingo/i);
    // Wait for vocab to load and dashboard content to appear
    await expect(page.locator('text=Adilingo').first()).toBeVisible();
    await expect(page.locator('text=Syllabus progress')).toBeVisible();
  });
});

test.describe('Audio speed control', () => {
  for (const course of ['chinese', 'english'] as const) {
    test(`speed can be changed inside a study session (${course})`, async ({ page }) => {
      await page.goto('/');
      if (course === 'english') {
        await selectCourse(page, 'english');
      }
      await page.getByRole('button', { name: /start today's session|开始今日/i }).first().click();

      const speed = page.getByRole('button', { name: /^(Speed|速度) [\d.]+×/ });
      await expect(speed).toBeVisible();
      await expect(speed).toContainText('1×');

      await speed.click(); // 1 -> 1.5
      await expect(speed).toContainText('1.5×');

      await page.keyboard.press('s'); // 1.5 -> wraps to 0.5
      await expect(speed).toContainText('0.5×');

      // Settings are saved with a 400 ms debounce; wait for it, then confirm the speed survives a reload.
      await page.waitForTimeout(900);
      await page.reload();
      await page.getByRole('button', { name: /start today's session|开始今日/i }).first().click();
      await expect(page.getByRole('button', { name: /^(Speed|速度) [\d.]+×/ })).toContainText('0.5×');
    });
  }
});

test.describe('Topic training', () => {
  for (const course of ['chinese', 'english'] as const) {
    test(`a topic practice session always has cards (${course})`, async ({ page }) => {
      await page.goto('/');
      if (course === 'english') {
        await selectCourse(page, 'english');
      }
      await page.goto('/#/topics');
      await page.getByRole('button', { name: 'Practice', exact: true }).first().click();
      await expect(page.getByText('Nothing to study here right now.')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'End session' })).toBeVisible();
      await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible();
    });
  }
});

test.describe('Course routing', () => {
  test('screens of another course redirect instead of rendering', async ({ page }) => {
    // Chinese course: the English-only verb trainer must not open; the old grammar bookmark opens the learning screen
    await page.goto('/#/grammar');
    await expect(page.getByRole('tab', { name: 'Learning Paths' })).toBeVisible();
    await expect(page).toHaveURL(/#\/learn$/);
    await page.goto('/#/irregular');
    await expect(page).toHaveURL(/#\/learn$/);

    // English course: both screens exist
    await selectCourse(page, 'english');
    await page.goto('/#/irregular');
    await expect(page).toHaveURL(/#\/irregular$/);
    await expect(page.getByRole('navigation', { name: 'Main' }).first()).toBeVisible();
  });

  test('switching to Chinese while on an English-only screen lands on the learn screen', async ({ page }) => {
    await page.goto('/');
    await selectCourse(page, 'english');
    await page.goto('/#/irregular');
    await expect(page).toHaveURL(/#\/irregular$/);
    await selectCourse(page, 'chinese');
    await expect(page).toHaveURL(/#\/learn$/);
    await expect(page.getByRole('tab', { name: 'Learning Paths' })).toBeVisible();
  });
});

test('an English-only deep link survives a reload (guard waits for the saved course)', async ({ page }) => {
  await page.goto('/');
  await selectCourse(page, 'english');
  await page.goto('/#/irregular');
  await page.waitForTimeout(900); // settings are saved with a 400 ms debounce
  await page.reload();
  await expect(page).toHaveURL(/#\/irregular$/);
});

test.describe('Interface language', () => {
  test('can be switched to German, updates <html lang> and survives a reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Interface language' }).first().click();
    await page.getByRole('menuitemradio', { name: /Deutsch/ }).click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Übersicht' }).first()).toBeVisible();

    await page.waitForTimeout(900); // settings are saved with a 400 ms debounce
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.getByRole('button', { name: 'Übersicht' }).first()).toBeVisible();
  });

  test('switches to Chinese and back to English without a blank screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Interface language' }).first().click();
    await page.getByRole('menuitemradio', { name: /简体中文/ }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.getByRole('button', { name: '控制面板' }).first()).toBeVisible();

    await page.getByRole('button', { name: '界面语言' }).first().click();
    await page.getByRole('menuitemradio', { name: /English/ }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('button', { name: 'Dashboard' }).first()).toBeVisible();
  });

  test('the Settings modal offers every language and the choice applies immediately', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).first().click();
    const group = page.getByRole('radiogroup', { name: 'Interface language' });
    // The three real languages are always offered; the pseudo-locale only exists in development builds
    for (const name of [/English/, /简体中文/, /Deutsch/]) await expect(group.getByRole('radio', { name })).toBeVisible();
    await group.getByRole('radio', { name: /Deutsch/ }).click();
    await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();
  });
});

test.describe('No untranslated keys on screen', () => {
  // A raw message key such as "study.leech" or "dashboard.todayCounts" means a string was never translated.
  const RAW_KEY = /\b(?:achievements|app|badge|bulk|card|common|dashboard|dictionary|grammar|header|insights|lang|modes|nav|placement|recs|settings|speed|study|sync|topics)\.[a-zA-Z][\w.]*\b/;

  for (const lang of ['English', 'Deutsch', '简体中文']) {
    for (const course of ['chinese', 'english'] as const) {
      test(`${course} course in ${lang}`, async ({ page }) => {
        await page.goto('/');
        if (course === 'english') await selectCourse(page, 'english');
        await page.getByRole('button', { name: /^(Interface language|Oberflächensprache|界面语言)$/ }).first().click();
        await page.getByRole('menuitemradio', { name: new RegExp(lang) }).click();
        await page.waitForTimeout(300);

        const routes = ['home', 'learn', 'topics', 'dictionary', 'insights', 'achievements', ...(course === 'english' ? ['irregular'] : [])];
        for (const route of routes) {
          await page.goto(`/#/${route}`);
          await page.waitForTimeout(150);
          const text = await page.locator('body').innerText();
          const raw = text.match(RAW_KEY);
          expect(raw, `${course}/${lang}/#/${route} shows an untranslated key`).toBeNull();
        }
        await page.getByRole('button', { name: /(Settings|Einstellungen|设置)$/ }).first().click();
        expect((await page.locator('body').innerText()).match(RAW_KEY), `${course}/${lang} settings`).toBeNull();
      });
    }
  }
});

test('grammar lesson and practice show no untranslated keys (German)', async ({ page }) => {
  const RAW_KEY = /\b(?:grammar|common|study|topics|dictionary)\.[a-zA-Z][\w.]*\b/;
  await page.goto('/');
  await page.getByRole('button', { name: 'Interface language' }).first().click();
  await page.getByRole('menuitemradio', { name: /Deutsch/ }).click();
  await page.goto('/#/learn');
  await page.getByRole('tab', { name: 'Grammatik' }).click();
  await page.locator('ul li button').first().click(); // first grammar lesson
  await expect(page.getByRole('button', { name: /Übung starten|Noch einmal üben/ })).toBeVisible();
  expect((await page.locator('body').innerText()).match(RAW_KEY)).toBeNull();
  await page.getByRole('button', { name: /Übung starten|Noch einmal üben/ }).click();
  await expect(page.getByRole('button', { name: 'Prüfen' })).toBeVisible();
  expect((await page.locator('body').innerText()).match(RAW_KEY)).toBeNull();
});
