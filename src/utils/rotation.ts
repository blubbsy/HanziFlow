import type { CardDirection, CourseId, DirectionProgress, SessionCard, UserState, VocabItem } from '../types';
import { getCourseConfig, isCourseId } from '../data/courses';
import { dailyLogFor, isDirectionDue, isWordStudied, promptForDirection } from './srsEngine';

/** A specialty course whose vocabulary is loaded and may feed the daily session. */
export interface RotationSource {
  course: CourseId;
  vocab: VocabItem[];
}

export const DEFAULT_ROTATION_PERCENT = 25;
export const ROTATION_PERCENTS = [10, 25, 50] as const;

/** Specialty courses the learner mixed into the daily session (unknown ids and the active course are ignored). */
export function rotationCourseIds(state: UserState): CourseId[] {
  const active = state.settings.course ?? 'chinese';
  return (state.settings.rotation?.courses ?? []).filter((id) => id !== active && isCourseId(id) && getCourseConfig(id).kind === 'specialty');
}

export function rotationPercent(state: UserState): number {
  return state.settings.rotation?.percent ?? DEFAULT_ROTATION_PERCENT;
}

/** Number of cards a session of `limit` cards takes from the rotation at most. */
export function rotationQuota(state: UserState, limit: number): number {
  return Math.max(1, Math.round((limit * rotationPercent(state)) / 100));
}

interface Candidate {
  item: VocabItem;
  direction: CardDirection;
  isNew: boolean;
  p?: DirectionProgress;
}

/** Due cards of one course (oldest first) followed by new words within that course's own daily new-card limit. */
function candidatesFor(source: RotationSource, state: UserState, now: Date): Candidate[] {
  const progress = state.courseProgress?.[source.course] ?? {};
  const newLeft = Math.max(0, state.settings.newCardsPerDay - dailyLogFor(state, now, source.course).newCards);

  const due: (Candidate & { dueTime: string })[] = [];
  for (const item of source.vocab) {
    const wp = progress[item.id];
    if (!wp || wp.manuallyMarkedKnown) continue;
    if (wp.recognition && isDirectionDue(wp.recognition, now)) due.push({ item, direction: 'recognition', isNew: false, p: wp.recognition, dueTime: wp.recognition.due });
    if (wp.recall && isDirectionDue(wp.recall, now)) due.push({ item, direction: 'recall', isNew: false, p: wp.recall, dueTime: wp.recall.due });
  }
  due.sort((a, b) => a.dueTime.localeCompare(b.dueTime));

  const fresh: Candidate[] = source.vocab
    .filter((v) => !progress[v.id]?.manuallyMarkedKnown && !isWordStudied(progress[v.id]))
    .slice(0, newLeft)
    .map((item) => ({ item, direction: 'recognition' as const, isNew: true }));

  // Two due cards, then one new word, like the main queue
  const out: Candidate[] = [];
  let di = 0;
  let ni = 0;
  while (di < due.length || ni < fresh.length) {
    for (let k = 0; k < 2 && di < due.length; k++) out.push(due[di++]);
    if (ni < fresh.length) out.push(fresh[ni++]);
  }
  return out;
}

/**
 * Up to `quota` cards from the rotation courses, shared evenly between them (a course with fewer cards
 * hands its unused share to the others). Cards carry their `course` so reviews are saved to the right place.
 */
export function buildRotationCards(sources: RotationSource[], state: UserState, quota: number, now = new Date()): SessionCard[] {
  const lists = sources.map((s) => ({ source: s, queue: candidatesFor(s, state, now) })).filter((l) => l.queue.length > 0);
  const picked: SessionCard[] = [];
  let progressed = true;
  while (picked.length < quota && progressed) {
    progressed = false;
    for (const l of lists) {
      const next = l.queue.shift();
      if (!next) continue;
      progressed = true;
      picked.push({
        item: next.item,
        direction: next.direction,
        isNew: next.isNew,
        course: l.source.course,
        prompt: promptForDirection(next.direction, next.p, undefined, next.item, l.source.course),
      });
      if (picked.length >= quota) break;
    }
  }
  return picked;
}

/** Spreads `extra` evenly through `main` so rotation cards do not arrive in one block. */
export function interleaveCards(main: SessionCard[], extra: SessionCard[]): SessionCard[] {
  if (extra.length === 0) return main;
  if (main.length === 0) return extra;
  const out: SessionCard[] = [];
  const step = main.length / (extra.length + 1);
  let mi = 0;
  extra.forEach((card, i) => {
    const until = Math.round(step * (i + 1));
    while (mi < until && mi < main.length) out.push(main[mi++]);
    out.push(card);
  });
  while (mi < main.length) out.push(main[mi++]);
  return out;
}
