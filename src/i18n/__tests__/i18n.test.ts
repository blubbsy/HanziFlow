import { beforeAll, describe, expect, it } from 'vitest';
import {
  LOCALE_META,
  UI_LANGUAGES,
  createT,
  detectUiLanguage,
  formatDate,
  formatMessage,
  formatNumber,
  isLocaleLoaded,
  isUiLanguage,
  loadLocale,
  matchUiLanguage,
  messageArguments,
  messageTags,
  splitRich,
  translate,
  translateUnsafe,
} from '../index';
import { en } from '../locales/en';
import { zh } from '../locales/zh';
import { de } from '../locales/de';
import { pseudoLocalize, pseudoLocalizeAll } from '../pseudo';

describe('message format', () => {
  it('fills variables and leaves unknown ones visible', () => {
    expect(formatMessage('Hello {name}!', { name: 'Ada' }, 'en')).toBe('Hello Ada!');
    expect(formatMessage('{a} + {b}', { a: 1 }, 'en')).toBe('1 + {b}');
    expect(formatMessage('No variables', { a: 1 }, 'en')).toBe('No variables');
  });

  it('picks plural forms with each language\'s own rules', () => {
    const msg = '{count, plural, one {# card} other {# cards}}';
    expect(formatMessage(msg, { count: 1 }, 'en')).toBe('1 card');
    expect(formatMessage(msg, { count: 2 }, 'en')).toBe('2 cards');
    expect(formatMessage(msg, { count: 0 }, 'en')).toBe('0 cards');
    // Chinese has a single plural category: `other` is used for 1 as well
    expect(formatMessage('{count, plural, one {# X} other {# 张}}', { count: 1 }, 'zh')).toBe('1 张');
    expect(formatMessage('{count, plural, one {# Karte} other {# Karten}}', { count: 1 }, 'de')).toBe('1 Karte');
  });

  it('supports exact matches and formats the number per language', () => {
    const msg = '{n, plural, =0 {nothing} one {# item} other {# items}}';
    expect(formatMessage(msg, { n: 0 }, 'en')).toBe('nothing');
    expect(formatMessage(msg, { n: 1234 }, 'en')).toBe('1,234 items');
    expect(formatMessage(msg, { n: 1234 }, 'de')).toBe('1.234 items');
  });

  it('allows variables and text around and inside plurals', () => {
    const msg = '{due, plural, one {# review} other {# reviews}} + {new} new';
    expect(formatMessage(msg, { due: 5, new: 10 }, 'en')).toBe('5 reviews + 10 new');
    expect(formatMessage('{n, plural, one {# of {total}} other {# of {total}}}', { n: 2, total: 9 }, 'en')).toBe('2 of 9');
  });

  it('never throws on malformed templates', () => {
    expect(() => formatMessage('Broken {open', { open: 1 }, 'en')).not.toThrow();
    expect(() => formatMessage('{n, plural, one {x}', { n: 1 }, 'en')).not.toThrow();
    expect(formatMessage('{n, plural, one {# x}}', { n: 5 }, 'en')).toBe('{n, plural, one {# x}}'); // no matching branch: visible, not blank
    expect(formatMessage('{n, select, a {x}}', { n: 'a' }, 'en')).toContain('select');
  });

  it('reports the arguments a template uses, including those inside plural branches', () => {
    expect(messageArguments('{due, plural, one {# review} other {# reviews}} + {new} new')).toEqual(['due', 'new']);
    expect(messageArguments('{n, plural, one {# of {total}} other {# of {total}}}')).toEqual(['n', 'total']);
    expect(messageArguments('plain')).toEqual([]);
  });
});

describe('rich text', () => {
  it('splits tags from plain text and keeps unknown text intact', () => {
    expect(splitRich('<b>3</b> due · <i>5</i> new')).toEqual([{ tag: 'b', text: '3' }, ' due · ', { tag: 'i', text: '5' }, ' new']);
    expect(splitRich('no tags & a < b')).toEqual(['no tags & a < b']);
    expect(messageTags('<b>x</b> <b>y</b> <em>z</em>')).toEqual(['b', 'em']);
  });
});

describe('translation lookup', () => {
  beforeAll(async () => {
    await Promise.all([loadLocale('zh'), loadLocale('de')]);
  });

  it('translates in every language that has the string and interpolates', () => {
    expect(translate('en', 'nav.dashboard')).toBe('Today');
    expect(translate('zh', 'nav.dashboard')).toBe('今日');
    expect(translate('en', 'dashboard.dueAndNew', { due: 1, new: 3 })).toBe('1 review + 3 new');
    expect(translate('en', 'dashboard.dueAndNew', { due: 5, new: 10 })).toBe('5 reviews + 10 new');
  });

  it('falls back to English for strings a language does not have, and shows unknown keys', async () => {
    await loadLocale('de');
    expect(translate('de', 'nav.dashboard')).toBe(de['nav.dashboard']);
    const partial = { ...de } as Record<string, string | undefined>;
    delete partial['nav.dashboard'];
    // A language pack may lack a key: the lookup chain must end in English, not in the raw key
    expect(translateUnsafe('en', 'nav.dashboard')).toBe('Today');
    expect(translateUnsafe('de', 'no.such.key')).toBe('no.such.key');
  });

  it('binds a language with createT', () => {
    const tZh = createT('zh');
    expect(tZh('common.back')).toBe('返回');
    expect(createT('en')('common.back')).toBe('Back');
  });
});

describe('locale tables', () => {
  const enKeys = Object.keys(en).sort();

  it('the Chinese table is complete (no key missing, none left over)', () => {
    expect(Object.keys(zh).sort()).toEqual(enKeys);
  });

  it('the German table only contains known keys', () => {
    const unknown = Object.keys(de).filter((k) => !(k in en));
    expect(unknown).toEqual([]);
  });

  it('every translation uses exactly the rich-text tags of the English source', () => {
    for (const [lang, table] of Object.entries({ zh, de }) as [string, Record<string, string | undefined>][]) {
      for (const [key, value] of Object.entries(table)) {
        if (value === undefined) continue;
        expect(messageTags(value), `${lang}:${key}`).toEqual(messageTags((en as Record<string, string>)[key]));
      }
    }
  });

  it('no string is empty or has stray whitespace', () => {
    for (const [lang, table] of Object.entries({ en, zh, de }) as [string, Record<string, string | undefined>][]) {
      for (const [key, value] of Object.entries(table)) {
        expect(value, `${lang}:${key}`).toBeTruthy();
        expect(value, `${lang}:${key}`).toBe(value!.trim());
      }
    }
  });

  it('every translation uses exactly the arguments of the English source', () => {
    for (const [lang, table] of Object.entries({ zh, de }) as [string, Record<string, string | undefined>][]) {
      for (const [key, value] of Object.entries(table)) {
        if (value === undefined) continue;
        expect(messageArguments(value), `${lang}:${key}`).toEqual(messageArguments((en as Record<string, string>)[key]));
      }
    }
  });
});

describe('language packs and selection', () => {
  it('every declared language can be loaded', async () => {
    for (const lang of UI_LANGUAGES) {
      expect(await loadLocale(lang), lang).toBe(true);
      expect(isLocaleLoaded(lang)).toBe(true);
    }
  });

  it('describes every language in its own name', () => {
    for (const lang of UI_LANGUAGES) {
      expect(LOCALE_META[lang].nativeName.length).toBeGreaterThan(0);
      expect(LOCALE_META[lang].htmlLang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
    }
    expect(isUiLanguage('de')).toBe(true);
    expect(isUiLanguage('fr')).toBe(false);
    expect(isUiLanguage('constructor')).toBe(false);
  });

  it('detects the browser language, leaving English to the course default', () => {
    expect(matchUiLanguage(['de-AT', 'en'])).toBe('de');
    expect(matchUiLanguage(['zh-TW'])).toBe('zh');
    expect(matchUiLanguage(['fr-FR', 'de'])).toBe('de');
    expect(matchUiLanguage(['fr'])).toBeUndefined();
    expect(matchUiLanguage([])).toBeUndefined();
    expect(detectUiLanguage(['de-DE'])).toBe('de');
    expect(detectUiLanguage(['en-US'])).toBeUndefined();
    expect(detectUiLanguage(null)).toBeUndefined();
  });

  it('formats numbers and dates for the language', () => {
    expect(formatNumber('en', 1234567.5)).toBe('1,234,567.5');
    expect(formatNumber('de', 1234567.5)).toBe('1.234.567,5');
    expect(formatNumber('en', 0.25, { style: 'percent' })).toBe('25%');
    const date = new Date(Date.UTC(2026, 9, 8, 12));
    expect(formatDate('en', date, { dateStyle: 'medium', timeZone: 'UTC' })).toBe('Oct 8, 2026');
    expect(formatDate('de', date, { dateStyle: 'medium', timeZone: 'UTC' })).toBe('08.10.2026');
  });
});

describe('pseudo-locale (layout stress test)', () => {
  it('accents and expands text but leaves placeholders, plurals and tags alone', () => {
    const out = pseudoLocalize('Save {count, plural, one {# card} other {# cards}} <b>now</b>');
    expect(out.startsWith('[') && out.endsWith(']')).toBe(true);
    expect(out).toContain('{count, plural, one {# card} other {# cards}}');
    expect(out).toContain('<b>');
    expect(out).toContain('</b>');
    expect(out).not.toContain('Save');
    expect(out.length).toBeGreaterThan('Save {count, plural, one {# card} other {# cards}} <b>now</b>'.length);
  });

  it('keeps every English message valid: same arguments and tags, still formattable', () => {
    const pseudo = pseudoLocalizeAll(en as Record<string, string>);
    for (const [key, value] of Object.entries(pseudo)) {
      expect(messageArguments(value), key).toEqual(messageArguments((en as Record<string, string>)[key]));
      expect(messageTags(value), key).toEqual(messageTags((en as Record<string, string>)[key]));
    }
    expect(formatMessage(pseudo['dashboard.dueAndNew'], { due: 3, new: 2 }, 'en')).toMatch(/3/);
  });

  it('is only a selectable language in development builds', () => {
    expect(UI_LANGUAGES).toContain('xa'); // vitest runs with import.meta.env.DEV
    expect(isUiLanguage('xa')).toBe(true);
    expect(LOCALE_META.xa.pseudo).toBe(true);
  });
});
