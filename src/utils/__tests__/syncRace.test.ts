import { describe, it, expect } from 'vitest';
import type { CardProgress, UserState } from '../../types';
import { createDefaultState } from '../storage';
import { mergeUserStates } from '../syncMerge';
import { recordReview } from '../srsEngine';

const item = { id: 'w1', hanzi: 'w1', pinyin: '', english: ['w1'], hskLevel: 1, levels: {}, frequency: 0, topics: [] } as unknown as Parameters<typeof recordReview>[1]['item'];

describe('applying a sync result while the learner kept working', () => {
  it('keeps the course, settings and reviews made while the sync was in flight', () => {
    // Snapshot the sync started from: Chinese course
    const snapshot: UserState = createDefaultState();
    // A sync round trip returns a state derived from that snapshot
    const fromSync = mergeUserStates(snapshot, createDefaultState());

    // Meanwhile the learner switched to English and reviewed a card
    let live: UserState = { ...snapshot, settings: { ...snapshot.settings, course: 'english', curriculum: 'cefr' }, progress: {}, courseProgress: { chinese: snapshot.progress } };
    live = recordReview(live, { item, grade: 3, correct: true, prompt: 'hanzi', latencyMs: 800 });

    // Replacing the live state with the sync result would undo both (the old bug) ...
    expect(fromSync.settings.course).toBe('chinese');
    // ... merging it into the live state does not
    const adopted = mergeUserStates(live, fromSync);
    expect(adopted.settings.course).toBe('english');
    expect(adopted.settings.curriculum).toBe('cefr');
    expect((adopted.progress as Record<string, CardProgress>).w1?.recognition).toBeDefined();
  });
});
