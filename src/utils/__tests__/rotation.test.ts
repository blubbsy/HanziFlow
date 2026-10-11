import { describe, it, expect } from 'vitest';
import type { CourseId, UserState, VocabItem } from '../../types';
import { createDefaultState } from '../storage';
import { buildRotationCards, interleaveCards, rotationCourseIds, rotationQuota } from '../rotation';
import { dailyLogFor, recordReview } from '../srsEngine';

const MED: CourseId = 'english:medicine';
const EMO: CourseId = 'chinese:emotor';

function item(id: string, level = 1): VocabItem {
  return { id, hanzi: id, pinyin: '', english: [id], hskLevel: level as VocabItem['hskLevel'], levels: {}, frequency: 0, topics: [] } as unknown as VocabItem;
}
const words = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => item(`${prefix}${i}`));

function stateWith(courses: CourseId[], extra: Partial<UserState> = {}): UserState {
  const s = createDefaultState();
  return { ...s, settings: { ...s.settings, course: 'chinese', rotation: { courses, percent: 25 } }, ...extra };
}

describe('daily mix (rotation)', () => {
  it('only keeps known specialty courses other than the active one', () => {
    const s = stateWith([MED, 'chinese', 'english:does-not-exist' as CourseId]);
    expect(rotationCourseIds(s)).toEqual([MED]);
    expect(rotationCourseIds({ ...s, settings: { ...s.settings, course: MED } })).toEqual([]);
  });

  it('takes at least one card and the configured share of a session', () => {
    const s = stateWith([MED]);
    expect(rotationQuota(s, 15)).toBe(4);
    expect(rotationQuota(s, 2)).toBe(1);
  });

  it('offers new words within the course\'s own daily new-card limit and tags them with the course', () => {
    const s = stateWith([MED, EMO]);
    s.settings.newCardsPerDay = 2;
    const cards = buildRotationCards([{ course: MED, vocab: words('m', 10) }, { course: EMO, vocab: words('e', 10) }], s, 8);
    expect(cards.filter((c) => c.course === MED)).toHaveLength(2);
    expect(cards.filter((c) => c.course === EMO)).toHaveLength(2);
    expect(cards.every((c) => c.isNew)).toBe(true);
  });

  it('does not use cards the learner marked as known and ignores progress of other courses', () => {
    const s = stateWith([MED], { courseProgress: { [MED]: { m0: { manuallyMarkedKnown: true } } } });
    s.progress = { m1: { recognition: undefined } } as UserState['progress'];
    const ids = buildRotationCards([{ course: MED, vocab: words('m', 3) }], s, 5).map((c) => c.item.id);
    expect(ids).not.toContain('m0');
    expect(ids).toContain('m1');
  });

  it('spreads rotation cards through the main queue', () => {
    const main = words('a', 6).map((i) => ({ item: i, direction: 'recognition' as const, prompt: 'hanzi' as const, isNew: false }));
    const extra = words('x', 2).map((i) => ({ item: i, direction: 'recognition' as const, prompt: 'hanzi' as const, isNew: true, course: MED }));
    const merged = interleaveCards(main, extra).map((c) => c.item.id);
    expect(merged).toHaveLength(8);
    expect(merged.indexOf('x0')).toBeGreaterThan(0);
    expect(merged.indexOf('x1')).toBeLessThan(merged.length - 1);
  });

  it('saves a rotation review to its own course and leaves the active course untouched', () => {
    const s = stateWith([MED]);
    const after = recordReview(s, { item: item('m0'), course: MED, grade: 3, correct: true, prompt: 'hanzi', latencyMs: 900 });
    expect(after.progress.m0).toBeUndefined();
    expect(after.courseProgress?.[MED]?.m0?.recognition).toBeDefined();
    expect(dailyLogFor(after, new Date(), MED).newCards).toBe(1);
    expect(dailyLogFor(after, new Date(), 'chinese').reviewed).toBe(0);
    expect(after.stats.totalReviewed).toBe(1);
  });
});
