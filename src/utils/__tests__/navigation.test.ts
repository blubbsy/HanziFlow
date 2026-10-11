import { beforeAll, describe, expect, it } from 'vitest';
import { COURSES, SECONDARY_VIEWS, fallbackView, isViewAvailable, languageCourses } from '../../data/courses';
import { mobileNavItemsFor, navItemsFor } from '../navigation';
import { loadLocale } from '../../i18n';

describe('navigation is derived from the course registry', () => {
  beforeAll(async () => {
    await Promise.all([loadLocale('zh'), loadLocale('de')]);
  });

  it('lists exactly the views each course declares, in order, with labels in all UI languages', () => {
    for (const course of Object.values(COURSES)) {
      for (const lang of ['en', 'zh', 'de'] as const) {
        const items = navItemsFor(course.id, lang);
        // Topics and irregular verbs live inside Learn, badges inside Progress
        expect(items.map((i) => i.id)).toEqual(course.views.filter((v) => !SECONDARY_VIEWS.includes(v)));
        const mobile = mobileNavItemsFor(course.id, lang);
        expect(mobile.map((i) => i.id)).toEqual(course.mobileViews);
        for (const item of [...items, ...mobile]) {
          expect(item.label.length, `${course.id}/${item.id}/${lang}`).toBeGreaterThan(0);
          expect(item.short.length).toBeGreaterThan(0);
          expect(item.label).not.toMatch(/^(nav|common)\./); // an untranslated key would show up as itself
          expect(item.short).not.toMatch(/^(nav|common)\./);
        }
      }
    }
  });

  it('keeps the existing navigation of both courses and translates to German', () => {
    expect(navItemsFor('chinese', 'en').map((i) => i.label)).toEqual([
      'Today', 'Learn', 'Words', 'Progress',
    ]);
    // both language courses have the same screens under the same names
    expect(navItemsFor('english', 'zh').map((i) => i.id)).toEqual(navItemsFor('chinese', 'zh').map((i) => i.id));
    expect(navItemsFor('english', 'en').map((i) => i.label)).toEqual(navItemsFor('chinese', 'en').map((i) => i.label));
    expect(navItemsFor('english', 'zh')[1].label).toBe('学习');
    expect(navItemsFor('chinese:emotor', 'en')[1].label).toBe('Learn');
    expect(mobileNavItemsFor('chinese', 'en').map((i) => i.short)).toEqual(['Today', 'Learn', 'Words', 'Progress']);
    expect(mobileNavItemsFor('english', 'zh').map((i) => i.short)).toEqual(mobileNavItemsFor('chinese', 'zh').map((i) => i.short));
    expect(mobileNavItemsFor('chinese', 'de').map((i) => i.short)).toEqual(['Heute', 'Lernen', 'Wörter', 'Fortschritt']);
    expect(mobileNavItemsFor('english', 'de').map((i) => i.short)).toEqual(['Heute', 'Lernen', 'Wörter', 'Fortschritt']);
  });

  it('redirects unavailable views to a view the course does have', () => {
    for (const course of Object.values(COURSES)) {
      expect(isViewAvailable(course.id, fallbackView(course.id))).toBe(true);
    }
    expect(fallbackView('chinese')).toBe('learn');
  });

  it('offers every language course in the quick switchers', () => {
    expect(languageCourses().map((c) => c.id)).toEqual(['chinese', 'english']);
    for (const c of languageCourses()) {
      expect(c.switcherKey && c.chipLabel && c.badge && c.cardTitleKey && c.cardSubtitleKey && c.nameKey && c.nativeKey && c.speechSample).toBeTruthy();
    }
  });
});
