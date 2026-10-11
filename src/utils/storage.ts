import { createStore, get, set, type UseStore } from 'idb-keyval';
import type { CardProgress, CourseId, Curriculum, HskLevel, PromptKind, ThemePref, ToneKey, UserState } from '../types';
import legacyIds from '../data/legacyIds.json';
import { getCourseConfig, isCourseId } from '../data/courses';
import { detectUiLanguage, isUiLanguage } from '../i18n';
import { LocalizedError, type LocalizedMessage } from '../i18n/errors';

export const SCHEMA_VERSION = 3;
const CURRICULUM_IDS: Curriculum[] = ['hsk3_2026', 'hsk3_2021', 'hsk2', 'cefr', 'cet', 'domain'];
const THEMES: ThemePref[] = ['system', 'light', 'dark'];
const KEY = 'adilingo:state';
const LEGACY_KEY = 'hanzi-flow:state';
const TONES: ToneKey[] = ['1', '2', '3', '4', '0'];
const PROMPTS: PromptKind[] = ['hanzi', 'pinyin', 'english', 'audio', 'tone', 'cloze'];

export type StorageBackend = 'indexeddb' | 'localstorage' | 'memory';

export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}

export function createDefaultState(): UserState {
  const confusion = {} as UserState['stats']['toneConfusion'];
  const toneAccuracy = {} as UserState['stats']['toneAccuracy'];
  for (const t of TONES) {
    toneAccuracy[t] = { correct: 0, total: 0 };
    confusion[t] = { '1': 0, '2': 0, '3': 0, '4': 0, '0': 0 };
  }
  const modeCounts = Object.fromEntries(PROMPTS.map((p) => [p, 0])) as Record<PromptKind, number>;
  return {
    version: SCHEMA_VERSION,
    settings: {
      course: 'chinese',
      uiLanguage: 'en',
      speechRate: 1,
      colorTones: true,
      dailyCap: 30,
      defaultMode: 'mixed',
      newCardsPerDay: 10,
      sessionSize: 15,
      pinyinHelperMode: 'adaptive',
      pinyinAdaptiveThreshold: 2,
      curriculum: 'hsk3_2026',
      theme: 'system',
      soundEffects: true,
    },
    progress: {},
    stats: {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: '',
      totalReviewed: 0,
      toneAccuracy,
      totalCorrect: 0,
      totalLatencyMs: 0,
      latencySamples: 0,
      modeCounts,
      toneConfusion: confusion,
      daily: {},
    },
    unlockedBadges: [],
    starredWords: [],
    knownLevels: [],
  };
}

// ---------- Migrations ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

/**
 * migrations[n] upgrades a state of version n-1 to version n.
 */
const migrations: Record<number, (s: Raw) => Raw> = {
  1: (s) => {
    const progress: Raw = {};
    for (const [id, p] of Object.entries((s.progress ?? {}) as Raw)) {
      const history = Array.isArray(p?.history) ? p.history : [];
      progress[id] = {
        ...p,
        history,
        consecutiveCorrect: p?.consecutiveCorrect ?? 0,
        failureCount: p?.failureCount ?? history.filter((h: Raw) => h.grade === 1).length,
      };
    }
    return { ...s, progress, version: 1 };
  },
  /** v2: full HSK word list — word ids become "汉字|pinyin1"; settings gain curriculum + theme. */
  2: (s) => {
    const progress: Raw = {};
    for (const [id, p] of Object.entries((s.progress ?? {}) as Raw)) {
      progress[(legacyIds as Record<string, string>)[id] ?? id] = p;
    }
    return {
      ...s,
      progress,
      settings: { curriculum: 'hsk3_2026', theme: 'system', ...(s.settings ?? {}) },
      version: 2,
    };
  },
  /** v3: FSRS + Directional cards (recognition & recall) */
  3: (s) => {
    const progress: Raw = {};
    for (const [id, p] of Object.entries((s.progress ?? {}) as Raw)) {
      if (!p) continue;
      if (p.recognition || p.recall || p.manuallyMarkedKnown) {
        progress[id] = p;
      } else if (typeof p.dueDate === 'string') {
        // Upgrade legacy SM-2 card to FSRS recognition direction
        progress[id] = {
          recognition: {
            due: p.dueDate,
            stability: Math.max(1, p.interval ?? 1),
            difficulty: 5,
            elapsed_days: 0,
            scheduled_days: Math.max(1, p.interval ?? 1),
            reps: p.repetitions ?? 0,
            lapses: p.failureCount ?? 0,
            state: (p.repetitions ?? 0) > 0 ? 2 : 0,
            last_review: p.lastReviewed,
            history: Array.isArray(p.history) ? p.history : [],
            failureCount: p.failureCount ?? 0,
            consecutiveCorrect: p.consecutiveCorrect ?? 0,
            isLeech: Boolean(p.isLeech),
            curedLeech: p.curedLeech === true ? true : undefined,
          },
        };
      }
    }
    return {
      ...s,
      progress,
      version: 3,
    };
  },
};

function isObj(v: unknown): v is Raw {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function sanitizeDirection(d: Raw): any {
  if (!isObj(d) || typeof d.due !== 'string') return undefined;
  return {
    due: d.due,
    stability: num(d.stability, 1),
    difficulty: num(d.difficulty, 5),
    elapsed_days: num(d.elapsed_days, 0),
    scheduled_days: num(d.scheduled_days, 1),
    reps: num(d.reps, 0),
    lapses: num(d.lapses, 0),
    state: num(d.state, 0),
    last_review: typeof d.last_review === 'string' ? d.last_review : undefined,
    history: Array.isArray(d.history)
      ? d.history.filter((h: unknown) => isObj(h) && typeof h.date === 'string' && typeof h.grade === 'number')
      : [],
    failureCount: num(d.failureCount, 0),
    consecutiveCorrect: num(d.consecutiveCorrect, 0),
    isLeech: Boolean(d.isLeech),
    curedLeech: d.curedLeech === true ? true : undefined,
  };
}

/** Fills missing fields from defaults and drops malformed entries. */
function sanitize(s: Raw): UserState {
  const d = createDefaultState();
  const settings = isObj(s.settings) ? s.settings : {};
  const stats = isObj(s.stats) ? s.stats : {};

  const progress: Record<string, CardProgress> = {};
  if (isObj(s.progress)) {
    for (const [id, p] of Object.entries(s.progress)) {
      if (!isObj(p)) continue;
      const recog = isObj(p.recognition) ? sanitizeDirection(p.recognition) : undefined;
      const recall = isObj(p.recall) ? sanitizeDirection(p.recall) : undefined;
      const manuallyMarkedKnown = Boolean(p.manuallyMarkedKnown);

      if (recog || recall || manuallyMarkedKnown) {
        progress[id] = {
          recognition: recog,
          recall: recall,
          manuallyMarkedKnown: manuallyMarkedKnown || undefined,
        };
      } else if (typeof p.dueDate === 'string') {
        // Fallback upgrade for any loose SM-2 object
        progress[id] = {
          recognition: {
            due: p.dueDate,
            stability: Math.max(1, num(p.interval, 1)),
            difficulty: 5,
            elapsed_days: 0,
            scheduled_days: Math.max(1, num(p.interval, 1)),
            reps: num(p.repetitions, 0),
            lapses: num(p.failureCount, 0),
            state: num(p.repetitions, 0) > 0 ? 2 : 0,
            last_review: typeof p.lastReviewed === 'string' ? p.lastReviewed : undefined,
            history: Array.isArray(p.history) ? p.history : [],
            failureCount: num(p.failureCount, 0),
            consecutiveCorrect: num(p.consecutiveCorrect, 0),
            isLeech: Boolean(p.isLeech),
            curedLeech: p.curedLeech === true ? true : undefined,
          },
        };
      }
    }
  }

  const toneAccuracy = { ...d.stats.toneAccuracy };
  const toneConfusion = { ...d.stats.toneConfusion };
  for (const t of TONES) {
    const ta = isObj(stats.toneAccuracy) ? stats.toneAccuracy[t] : undefined;
    if (isObj(ta)) toneAccuracy[t] = { correct: num(ta.correct, 0), total: num(ta.total, 0) };
    const row = isObj(stats.toneConfusion) ? stats.toneConfusion[t] : undefined;
    if (isObj(row)) {
      toneConfusion[t] = { ...d.stats.toneConfusion[t] };
      for (const g of TONES) toneConfusion[t][g] = num(row[g], 0);
    }
  }
  const modeCounts = { ...d.stats.modeCounts };
  for (const p of PROMPTS) modeCounts[p] = num(isObj(stats.modeCounts) ? stats.modeCounts[p] : 0, 0);

  const modes = ['mixed', 'hanzi', 'pinyin', 'audio', 'tone', 'english', 'cloze'];
  // An unknown course id (e.g. one this build no longer ships) must neither reset the learner's data nor
  // pollute another course: its flat fields are filed under its own id and the default course becomes active.
  const rawCourse: unknown = settings.course;
  const course: CourseId = isCourseId(rawCourse) ? rawCourse : 'chinese';
  const unknownCourse = typeof rawCourse === 'string' && rawCourse.length > 0 && !isCourseId(rawCourse) ? rawCourse : undefined;
  const defaultUiLang = getCourseConfig(course).defaultUiLanguage;

  let courseProgress: Record<string, any> | undefined = isObj(s.courseProgress) ? { ...s.courseProgress } : undefined;
  let starredWordsByCourse: Record<string, any> | undefined = isObj(s.starredWordsByCourse) ? { ...s.starredWordsByCourse } : undefined;
  let knownLevelsByCourse: Record<string, any> | undefined = isObj(s.knownLevelsByCourse) ? { ...s.knownLevelsByCourse } : undefined;
  let activeProgress = progress;
  let activeStarred: string[] = Array.isArray(s.starredWords) ? s.starredWords.filter((w: unknown) => typeof w === 'string') : [];
  let activeKnown = Array.isArray(s.knownLevels)
    ? (s.knownLevels.filter((l: unknown) => typeof l === 'number' && l >= 1 && l <= 7) as HskLevel[])
    : [];
  if (unknownCourse) {
    courseProgress = { ...(courseProgress ?? {}), [unknownCourse]: progress };
    starredWordsByCourse = { ...(starredWordsByCourse ?? {}), [unknownCourse]: activeStarred };
    knownLevelsByCourse = { ...(knownLevelsByCourse ?? {}), [unknownCourse]: activeKnown };
    activeProgress = isObj(courseProgress[course]) ? (courseProgress[course] as Record<string, CardProgress>) : {};
    activeStarred = Array.isArray(starredWordsByCourse[course]) ? starredWordsByCourse[course] : [];
    activeKnown = Array.isArray(knownLevelsByCourse[course]) ? knownLevelsByCourse[course] : [];
  }
  const uiLanguage = isUiLanguage(settings.uiLanguage) ? settings.uiLanguage : defaultUiLang;
  return {
    version: SCHEMA_VERSION,
    settings: {
      course,
      uiLanguage,
      speechRate: Math.min(1.5, Math.max(0.5, num(settings.speechRate, d.settings.speechRate))),
      colorTones: typeof settings.colorTones === 'boolean' ? settings.colorTones : d.settings.colorTones,
      dailyCap: Math.min(500, Math.max(1, num(settings.dailyCap, d.settings.dailyCap))),
      defaultMode: modes.includes(settings.defaultMode) ? settings.defaultMode : d.settings.defaultMode,
      newCardsPerDay: Math.min(100, Math.max(0, num(settings.newCardsPerDay, d.settings.newCardsPerDay))),
      curriculum: CURRICULUM_IDS.includes(settings.curriculum) ? settings.curriculum : d.settings.curriculum,
      theme: THEMES.includes(settings.theme) ? settings.theme : d.settings.theme,
      soundEffects: typeof settings.soundEffects === 'boolean' ? settings.soundEffects : d.settings.soundEffects,
      sessionSize: Math.min(100, Math.max(5, num(settings.sessionSize, d.settings.sessionSize ?? 15))),
      pinyinHelperMode: ['adaptive', 'flip', 'always', 'never'].includes(settings.pinyinHelperMode)
        ? settings.pinyinHelperMode
        : (d.settings.pinyinHelperMode ?? 'adaptive'),
      pinyinAdaptiveThreshold: Math.min(10, Math.max(1, num(settings.pinyinAdaptiveThreshold, d.settings.pinyinAdaptiveThreshold ?? 2))),
      rotation: sanitizeRotation(settings.rotation),
    },
    progress: activeProgress,
    courseProgress,
    stats: {
      currentStreak: num(stats.currentStreak, 0),
      longestStreak: num(stats.longestStreak, 0),
      lastActiveDate: typeof stats.lastActiveDate === 'string' ? stats.lastActiveDate : '',
      totalReviewed: num(stats.totalReviewed, 0),
      toneAccuracy,
      totalCorrect: num(stats.totalCorrect, 0),
      totalLatencyMs: num(stats.totalLatencyMs, 0),
      latencySamples: num(stats.latencySamples, 0),
      modeCounts,
      toneConfusion,
      daily: sanitizeDaily(stats.daily),
      dailyByCourse: sanitizeDailyByCourse(stats.dailyByCourse),
    },
    unlockedBadges: Array.isArray(s.unlockedBadges) ? s.unlockedBadges.filter((b: unknown) => typeof b === 'string') : [],
    starredWords: activeStarred,
    starredWordsByCourse,
    knownLevels: activeKnown,
    knownLevelsByCourse,
    placementResult:
      isObj(s.placementResult) && typeof s.placementResult.date === 'string'
        ? {
            estimatedLevel: (num(s.placementResult.estimatedLevel, 1) as HskLevel),
            date: s.placementResult.date,
            score: num(s.placementResult.score, 0),
            total: num(s.placementResult.total, 0),
          }
        : undefined,
  };
}

function sanitizeDaily(raw: unknown): UserState['stats']['daily'] {
  const out: UserState['stats']['daily'] = {};
  if (!isObj(raw)) return out;
  for (const [day, log] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !isObj(log)) continue;
    out[day] = { reviewed: num(log.reviewed, 0), correct: num(log.correct, 0), newCards: num(log.newCards, 0) };
  }
  return out;
}

/** Course ids stay as written (a newer build may know courses this one does not); unusable ones are dropped when the session is built. */
function sanitizeRotation(raw: unknown): UserState['settings']['rotation'] {
  if (!isObj(raw) || !Array.isArray(raw.courses)) return undefined;
  const courses = [...new Set(raw.courses.filter((c): c is string => typeof c === 'string'))] as CourseId[];
  return { courses, percent: Math.min(50, Math.max(10, num(raw.percent, 25))) };
}

function sanitizeDailyByCourse(raw: unknown): UserState['stats']['dailyByCourse'] {
  if (!isObj(raw)) return undefined;
  const out: NonNullable<UserState['stats']['dailyByCourse']> = {};
  for (const [c, days] of Object.entries(raw)) {
    // Keep logs of any well-formed course id, including ones this build does not know.
    if (/^(chinese|english)(:[\w.-]+)?$/.test(c)) {
      out[c as CourseId] = sanitizeDaily(days);
    }
  }
  return out;
}

export function migrate(raw: unknown): UserState {
  if (!isObj(raw)) throw new LocalizedError('errors.storage.notObject');
  let s: Raw = raw;
  let v = num(s.version, 0);
  if (v > SCHEMA_VERSION) {
    throw new LocalizedError('errors.storage.newerVersion', { version: v });
  }
  while (v < SCHEMA_VERSION) {
    v += 1;
    s = migrations[v](s);
  }
  return sanitize(s);
}

// ---------- Persistence ----------

let idbStore: UseStore | null = null;
let backend: StorageBackend = 'memory';

function getIdbStore(): UseStore | null {
  if (idbStore) return idbStore;
  try {
    if (typeof indexedDB === 'undefined') return null;
    idbStore = createStore('adilingo', 'kv');
    return idbStore;
  } catch {
    return null;
  }
}

let legacyIdbStore: UseStore | null = null;
function getLegacyIdbStore(): UseStore | null {
  if (legacyIdbStore) return legacyIdbStore;
  try {
    if (typeof indexedDB === 'undefined') return null;
    legacyIdbStore = createStore('hanzi-flow', 'kv');
    return legacyIdbStore;
  } catch {
    return null;
  }
}

function readLocal(): unknown {
  try {
    const txt = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
    return txt ? JSON.parse(txt) : undefined;
  } catch {
    return undefined;
  }
}

export async function loadState(): Promise<{ state: UserState; backend: StorageBackend; warning?: LocalizedMessage }> {
  let raw: unknown;
  const store = getIdbStore();
  if (store) {
    try {
      raw = await get(KEY, store);
      if (raw === undefined) {
        const legacyStore = getLegacyIdbStore();
        if (legacyStore) {
          raw = await get(LEGACY_KEY, legacyStore);
        }
      }
      backend = 'indexeddb';
    } catch {
      idbStore = null;
    }
  }
  if (raw === undefined) {
    // Either IndexedDB is unavailable or empty — check the localStorage fallback.
    raw = readLocal();
    if (backend !== 'indexeddb') backend = typeof localStorage !== 'undefined' ? 'localstorage' : 'memory';
  }
  if (raw === undefined) {
    // First run: start in the browser's language when it is a supported non-English one.
    const fresh = createDefaultState();
    fresh.settings.uiLanguage = detectUiLanguage() ?? fresh.settings.uiLanguage;
    return { state: fresh, backend };
  }
  try {
    return { state: migrate(raw), backend };
  } catch (e) {
    // Never let the default state overwrite unreadable data: park a copy under its own key.
    const parkedKey = `${KEY}:unreadable-${Date.now()}`;
    try {
      if (store) await set(parkedKey, raw, store);
      else localStorage.setItem(parkedKey, JSON.stringify(raw));
    } catch {
      /* best effort */
    }
    return {
      state: createDefaultState(),
      backend,
      warning: { key: 'errors.storage.unreadable', vars: { storageKey: parkedKey }, cause: e },
    };
  }
}

// ---------- Cross-tab sync ----------

const channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('adilingo') : null;
const TAB_ID = Math.random().toString(36).slice(2);

/** Notifies other open tabs that the state changed so they reload instead of overwriting it. */
export function onRemoteSave(cb: () => void): () => void {
  if (!channel) return () => {};
  const handler = (e: MessageEvent) => {
    if (e.data?.type === 'saved' && e.data.from !== TAB_ID) cb();
  };
  channel.addEventListener('message', handler);
  return () => channel.removeEventListener('message', handler);
}

export async function saveState(state: UserState): Promise<StorageBackend> {
  const result = await persist(state);
  channel?.postMessage({ type: 'saved', from: TAB_ID });
  return result;
}

async function persist(state: UserState): Promise<StorageBackend> {
  const store = getIdbStore();
  if (store) {
    try {
      await set(KEY, state, store);
      backend = 'indexeddb';
      return backend;
    } catch {
      idbStore = null;
    }
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    backend = 'localstorage';
  } catch {
    backend = 'memory';
  }
  return backend;
}

// ---------- Backup ----------

export interface BackupFile {
  app: 'adilingo' | 'hanzi-flow';
  exportedAt: string;
  schemaVersion: number;
  state: UserState;
  /** Grammar & learning-path progress (validated by the grammar module on import). */
  grammar?: unknown;
}

export function exportBackup(state: UserState, grammar?: unknown): void {
  const payload: BackupFile = {
    app: 'adilingo',
    exportedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    state,
    grammar,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `adilingo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Accepts both the wrapped backup format and a bare UserState object. */
export async function parseBackup(file: File): Promise<{ state: UserState; grammar?: unknown }> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new LocalizedError('errors.backup.invalidJson');
  }
  if (isObj(data) && (data.app === 'adilingo' || data.app === 'hanzi-flow') && isObj(data.state)) return { state: migrate(data.state), grammar: data.grammar };
  if (isObj(data) && ('progress' in data || 'settings' in data)) return { state: migrate(data) };
  throw new LocalizedError('errors.backup.notBackup');
}
