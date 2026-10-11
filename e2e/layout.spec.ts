import { test, expect, type Page } from '@playwright/test';

/**
 * Layout robustness across languages. German is ~30 % longer than English and the pseudo-locale (`xa`) is
 * ~35 % longer with accents, so anything that only fits in English shows up here:
 *   - the page scrolls sideways,
 *   - a button / link / input sticks out of the viewport,
 *   - a label is cut off by its own box (without an intentional ellipsis).
 * Containers that scroll on purpose (chip rows, wide tables) are exempt.
 */

const LANGUAGES = ['en', 'de', 'zh', 'xa'] as const;
const VIEWPORTS = [
  { name: 'phone', width: 360, height: 740 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];
const SPECIALTY_ROUTES = ['home', 'learn', 'topics', 'dictionary', 'insights', 'achievements'];
const ROUTES = {
  chinese: ['home', 'learn', 'topics', 'dictionary', 'insights', 'achievements'],
  english: ['home', 'learn', 'irregular', 'topics', 'dictionary', 'insights', 'achievements'],
  'chinese:emotor': SPECIALTY_ROUTES,
  'english:power-electronics': SPECIALTY_ROUTES,
} as const;

async function layoutIssues(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const issues: string[] = [];
    const viewport = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > viewport + 1) {
      issues.push(`page scrolls sideways (content ${document.documentElement.scrollWidth}px wide, viewport ${viewport}px)`);
    }
    const inScrollContainer = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const overflow = getComputedStyle(p).overflowX;
        if (overflow === 'auto' || overflow === 'scroll') return true;
      }
      return false;
    };
    const label = (el: Element) => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48);

    for (const el of document.querySelectorAll('button, a[href], input, select, [role="tab"], [role="radio"], [role="menuitemradio"]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || inScrollContainer(el)) continue;
      if (r.right > viewport + 1 || r.left < -1) {
        issues.push(`<${el.tagName.toLowerCase()}> "${label(el)}" sticks out of the viewport (${Math.round(r.left)}…${Math.round(r.right)} of ${viewport}px)`);
      }
    }

    for (const el of document.querySelectorAll('button, a[href], label, [role="tab"], [role="radio"], h1, h2, h3')) {
      const style = getComputedStyle(el);
      if (inScrollContainer(el) || style.overflowX === 'visible' || style.textOverflow === 'ellipsis') continue;
      if (style.display === 'inline') continue;
      if ((el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 2) {
        issues.push(`<${el.tagName.toLowerCase()}> "${label(el)}" is clipped (needs ${(el as HTMLElement).scrollWidth}px, has ${(el as HTMLElement).clientWidth}px)`);
      }
    }
    return [...new Set(issues)];
  });
}

for (const course of ['chinese', 'english', 'chinese:emotor', 'english:power-electronics'] as const) {
  for (const lang of LANGUAGES) {
    for (const vp of VIEWPORTS) {
      test(`${course} course · ${lang} · ${vp.name} (${vp.width}px) has no layout overflow`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.addInitScript((c) => {
          // Start directly in the wanted course (state falls back to localStorage when IndexedDB is empty)
          localStorage.setItem('adilingo:state', JSON.stringify({ version: 3, settings: { course: c, uiLanguage: 'en', onboarded: true }, progress: {} }));
        }, course);

        const problems: string[] = [];
        for (const route of ROUTES[course]) {
          await page.goto(`/?lang=${lang}#/${route}`);
          await page.waitForSelector('main', { timeout: 15000 });
          await page.waitForTimeout(250);
          for (const issue of await layoutIssues(page)) problems.push(`#/${route}: ${issue}`);
        }
        if (course === 'chinese') {
          // The wiki tab: list and an opened article
          await page.goto(`/?lang=${lang}#/learn`);
          await page.waitForSelector('main', { timeout: 15000 });
          await page.getByRole('tab').nth(2).click();
          await page.waitForSelector('[data-article]');
          for (const issue of await layoutIssues(page)) problems.push(`wiki list: ${issue}`);
          await page.locator('[data-article]').first().click();
          await page.waitForSelector('[data-wiki-article]');
          await page.waitForTimeout(200);
          for (const issue of await layoutIssues(page)) problems.push(`wiki article: ${issue}`);
        }
        // The course catalogue lists every field with two buttons each
        await page.goto(`/?lang=${lang}#/home`);
        await page.waitForSelector('main', { timeout: 15000 });
        await page.getByRole('button', { name: /settings|einstellungen|设置|Šéţţ/i }).first().click();
        await page.getByTestId('settings-open-catalogue').click();
        await page.waitForSelector('[data-domain]');
        for (const issue of await layoutIssues(page)) problems.push(`catalogue: ${issue}`);
        await page.getByRole('dialog').getByRole('button').first().click();
        await page.waitForTimeout(150);
        // The settings dialog is the densest screen
        await page.getByRole('button', { name: /settings|einstellungen|设置|Šéţţ/i }).first().click();
        await page.waitForTimeout(200);
        for (const issue of await layoutIssues(page)) problems.push(`settings: ${issue}`);

        expect(problems, problems.join('\n')).toEqual([]);
      });
    }
  }
}
