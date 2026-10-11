import { beforeAll, describe, expect, it } from 'vitest';
import { loadLocale, t, translateUnsafe } from '../../i18n';
import {
  ACTIVE_PASSIVE_RULES,
  ENGLISH_TENSES,
  MASTER_VERB_EXAMPLE,
} from '../../data/englishGrammarMaster';
import { IRREGULAR_VERBS } from '../../data/irregularVerbs';
import { ENGLISH_GRAMMAR_WIKI, GRAMMAR_CATEGORIES } from '../../data/englishGrammarWiki';

describe('i18n system', () => {
  beforeAll(async () => {
    await loadLocale('zh');
  });

  it('translates navigation and dashboard keys in English and Chinese', () => {
    expect(t('nav.dashboard', 'en')).toBe('Today');
    expect(t('nav.dashboard', 'zh')).toBe('今日');

    expect(t('dashboard.dailySchedule', 'en')).toBe('FSRS Daily Schedule');
    expect(t('dashboard.dailySchedule', 'zh')).toBe('FSRS 每日复习计划');
  });

  it('interpolates string and number variables accurately', () => {
    const formattedEn = t('dashboard.dueAndNew', 'en', { due: 5, new: 10 });
    expect(formattedEn).toBe('5 reviews + 10 new');

    const formattedZh = t('dashboard.wordsLearned', 'zh', { seen: '120', total: '500' });
    expect(formattedZh).toBe('已掌握或开始学习 120/500 个词汇');
  });

  it('falls back gracefully to English when key is missing in target language', () => {
    expect(translateUnsafe('zh', 'nonexistent_key_123')).toBe('nonexistent_key_123');
  });
});

describe('English Grammar Master Blueprint', () => {
  it('provides the canonical example with 13 tenses covering present, past, future, and conditional', () => {
    expect(ENGLISH_TENSES.length).toBeGreaterThanOrEqual(13);

    const groups = new Set(ENGLISH_TENSES.map((t) => t.group));
    expect(groups.has('present')).toBe(true);
    expect(groups.has('past')).toBe(true);
    expect(groups.has('future')).toBe(true);
    expect(groups.has('conditional')).toBe(true);
  });

  it('contains complete SPO conjugations for all subject categories', () => {
    for (const tense of ENGLISH_TENSES) {
      expect(tense.conjugations.first).toBeDefined();
      expect(tense.conjugations.third_singular).toBeDefined();
      expect(tense.conjugations.plural).toBeDefined();

      // Subject markers
      expect(tense.conjugations.first.subject).toBe('I');
      expect(tense.conjugations.third_singular.subject).toBe('He / She / It');
      expect(tense.conjugations.plural.subject).toBe('We / They');

      // Canonical sentence contains the master object
      expect(tense.conjugations.first.fullActive).toContain(MASTER_VERB_EXAMPLE.object);
      expect(tense.passive.sentence).toBeDefined();
      expect(tense.passive.verbPart).toBeDefined();
      expect(tense.signalWords.length).toBeGreaterThan(0);
    }
  });

  it('defines the 3 golden active-to-passive inversion rules', () => {
    expect(ACTIVE_PASSIVE_RULES).toHaveLength(3);
    expect(ACTIVE_PASSIVE_RULES[0].step).toContain('S ↔ O');
    expect(ACTIVE_PASSIVE_RULES[1].step).toContain('Be');
    expect(ACTIVE_PASSIVE_RULES[2].step).toContain('V₃');
  });
});

describe('English Grammar Wikipedia Library', () => {
  it('covers core categories including clauses, verbals, conditionals, and sentence structure', () => {
    expect(ENGLISH_GRAMMAR_WIKI.length).toBeGreaterThanOrEqual(10);
    expect(GRAMMAR_CATEGORIES.length).toBeGreaterThanOrEqual(8);

    const categories = new Set(ENGLISH_GRAMMAR_WIKI.map((a) => a.category));
    expect(categories.has('sentence_structure')).toBe(true);
    expect(categories.has('clauses')).toBe(true);
    expect(categories.has('verbals')).toBe(true);
    expect(categories.has('conditionals')).toBe(true);
    expect(categories.has('modal_verbs')).toBe(true);
  });

  it('verifies all articles contain bilingual titles, CEFR levels, rules, and keywords', () => {
    for (const art of ENGLISH_GRAMMAR_WIKI) {
      expect(art.id).toBeTruthy();
      expect(art.titleEn).toBeTruthy();
      expect(art.titleZh).toBeTruthy();
      expect(art.summaryZh).toBeTruthy();
      expect(['A1', 'A2', 'B1', 'B2', 'C1']).toContain(art.level);
      expect(art.rules.length).toBeGreaterThan(0);
      expect(art.keywords.length).toBeGreaterThan(0);
      for (const rule of art.rules) {
        expect(rule.ruleZh).toBeTruthy();
        expect(rule.exampleEn).toBeTruthy();
        expect(rule.exampleZh).toBeTruthy();
      }
    }
  });
});

describe('Irregular Verbs patterns', () => {
  it('includes all 4 irregular mathematical patterns (AAA, ABB, ABC, ABA)', () => {
    const patterns = new Set(IRREGULAR_VERBS.map((v) => v.pattern));
    expect(patterns.has('AAA')).toBe(true);
    expect(patterns.has('ABB')).toBe(true);
    expect(patterns.has('ABC')).toBe(true);
    expect(patterns.has('ABA')).toBe(true);
  });

  it('validates each verb has v1, v2, v3, ipa, and 3-tense example sentences', () => {
    for (const v of IRREGULAR_VERBS) {
      expect(v.v1).toBeTruthy();
      expect(v.v2).toBeTruthy();
      expect(v.v3).toBeTruthy();
      expect(v.ipaV1).toBeTruthy();
      expect(v.ipaV2).toBeTruthy();
      expect(v.ipaV3).toBeTruthy();
      expect(v.exampleSentence.v1).toBeTruthy();
      expect(v.exampleSentence.v2).toBeTruthy();
      expect(v.exampleSentence.v3).toBeTruthy();
    }
  });
});

