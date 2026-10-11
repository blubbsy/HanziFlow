import type { UiLanguage } from './i18n/types';

/** Language machinery a course builds on (TTS, pinyin, card directions). */
export type TrackId = 'chinese' | 'english';
/** A base language course (`chinese`, `english`) or a namespaced course on top of a track (`chinese:emotor-design`). */
export type CourseId = TrackId | `${TrackId}:${string}`;

/** 1–6, plus 7 = the HSK 3.0 advanced band (levels 7–9 share one word list) or CEFR 1–6 (A1 to C2). */
export type HskLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Curriculum = 'hsk3_2026' | 'hsk3_2021' | 'hsk2' | 'cefr' | 'cet' | 'domain';
export type ThemePref = 'system' | 'light' | 'dark';
export type ToneKey = '1' | '2' | '3' | '4' | '0';
export type StudyMode = 'mixed' | 'hanzi' | 'pinyin' | 'audio' | 'tone' | 'english' | 'cloze';
/** The concrete prompt shown on a single card. */
export type PromptKind = 'hanzi' | 'pinyin' | 'english' | 'audio' | 'tone' | 'cloze';
export type Grade = 1 | 2 | 3 | 4;

/** Direction of study: recognition (Target -> Meaning) vs recall (Meaning -> Target). */
export type CardDirection = 'recognition' | 'recall';

export interface VocabItem {
  id: string;
  hanzi: string;
  pinyin: string;
  pinyinNumbered: string;
  english: string[];
  /** Level in the active curriculum. */
  hskLevel: HskLevel;
  /** Level in every standard that lists the word. */
  levels: Partial<Record<Curriculum, HskLevel>>;
  /** Corpus frequency rank (lower = more common; 0 = hand-curated starter word). */
  frequency: number;
  topics: string[];
  measureWord?: { hanzi: string; pinyin: string };
  radical?: string;
  /** Specialty courses: one-sentence definition of the term, shown on the answer side. */
  definition?: string;
  /** Standard abbreviation of the term (IGBT, ECG …). */
  abbr?: string;
  /** Respelling for text-to-speech when the term is not pronounced as written ("eye gee bee tee"). */
  speakAs?: string;
  /** Specialty courses: the domain the term belongs to. */
  domain?: string;
  exampleSentence?: {
    hanzi: string;
    pinyin: string;
    english: string;
    /** Tatoeba sentence id (CC-BY 2.0 FR) when the example comes from Tatoeba. */
    source?: string;
  };
}

export interface HistoryEntry {
  date: string;
  grade: number;
  correct?: boolean;
  mode?: PromptKind;
  latencyMs?: number;
  learningStep?: boolean;
  stability?: number;
}

/** FSRS state for a single direction of a card. */
export interface DirectionProgress {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number; // 0: New, 1: Learning, 2: Review, 3: Relearning
  last_review?: string;
  history: HistoryEntry[];
  failureCount: number;
  consecutiveCorrect: number;
  isLeech: boolean;
  curedLeech?: boolean;
}

/** Word-level progress holding both directional schedules and bulk known flags. */
export interface CardProgress {
  recognition?: DirectionProgress;
  recall?: DirectionProgress;
  manuallyMarkedKnown?: boolean;
}

export type WordProgress = CardProgress;

export interface DailyLog {
  reviewed: number;
  correct: number;
  newCards: number;
}

export interface ToneTally {
  correct: number;
  total: number;
}

export type PinyinHelperMode = 'adaptive' | 'flip' | 'always' | 'never';

export interface Settings {
  course?: CourseId;
  uiLanguage?: UiLanguage;
  speechRate: number;
  colorTones: boolean;
  dailyCap: number;
  defaultMode: StudyMode;
  newCardsPerDay: number;
  curriculum: Curriculum;
  theme: ThemePref;
  soundEffects: boolean;
  /** Chinese character helper mode: adaptive (mistake-dependent), flip (click to peek), always, never */
  pinyinHelperMode?: PinyinHelperMode;
  /** Number of review failures before pinyin auto-reveals in adaptive mode (default: 2) */
  pinyinAdaptiveThreshold?: number;
  /** Number of cards per quick study session sprint (default: 15) */
  sessionSize?: number;
  /** Specialty courses mixed into the daily session, and how much of a session they take. */
  rotation?: RotationSettings;
}

export interface RotationSettings {
  courses: CourseId[];
  /** Share of a daily session (percent) that comes from the rotation courses. */
  percent: number;
}

export interface UserState {
  version: number;
  settings: Settings;
  progress: Record<string, CardProgress>;
  /** Course-namespaced progress cache for seamless switching */
  courseProgress?: Partial<Record<CourseId, Record<string, CardProgress>>>;
  stats: {
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string;
    totalReviewed: number;
    toneAccuracy: Record<ToneKey, ToneTally>;
    totalCorrect: number;
    totalLatencyMs: number;
    latencySamples: number;
    modeCounts: Record<PromptKind, number>;
    /** toneConfusion[expected][given] = count */
    toneConfusion: Record<ToneKey, Record<ToneKey, number>>;
    /** Keyed by local date YYYY-MM-DD. */
    daily: Record<string, DailyLog>;
    /** Isolated daily logs per course track. */
    dailyByCourse?: Partial<Record<CourseId, Record<string, DailyLog>>>;
  };
  unlockedBadges: string[];
  starredWords: string[];
  starredWordsByCourse?: Partial<Record<CourseId, string[]>>;
  /** Levels bulk marked as known by user */
  knownLevels?: HskLevel[];
  knownLevelsByCourse?: Partial<Record<CourseId, HskLevel[]>>;
  /** Outcome of placement test */
  placementResult?: {
    estimatedLevel: HskLevel;
    date: string;
    score: number;
    total: number;
  };
}

export interface SessionRequest {
  label: string;
  mode: StudyMode;
  levels: HskLevel[];
  topics: string[];
  wordIds?: string[];
  direction?: CardDirection;
  /** Fill up with not-yet-due words (targeted / extra practice). */
  includeNotDue?: boolean;
  /** Ignore the daily cap (explicit targeted reviews). */
  ignoreCap?: boolean;
  limit?: number;
  /**
   * Words that are not part of the course library (e.g. a topic pack's supplementary terms).
   * They are added to the session pool; without this `wordIds` could never match them.
   */
  extraItems?: VocabItem[];
  /** Daily session: also draw cards from the courses in `settings.rotation`. */
  rotation?: boolean;
}

export interface SessionCard {
  item: VocabItem;
  direction: CardDirection;
  prompt: PromptKind;
  isNew: boolean;
  /** In-session repeat of a card failed earlier in this session. */
  learningStep?: boolean;
  /** Set for rotation cards that belong to another course than the active one. */
  course?: CourseId;
}
