import { useMemo, useState, type ReactNode } from 'react';
import { BookOpen, Ear, Languages, Layers, Music, Play, Shuffle, Type } from 'lucide-react';
import type { HskLevel, SessionRequest, StudyMode, UserState, VocabItem } from '../types';
import { allTopics } from '../utils/analytics';
import { levelLabel } from '../data/vocab';
import { queueSummary } from '../utils/srsEngine';
import { trackOf } from '../data/courses';
import type { MessageKey } from '../i18n';
import { useI18n } from '../i18n/react';

export interface ModeOption {
  id: StudyMode;
  titleKey: MessageKey;
  descKey: MessageKey;
  icon: typeof Type;
}

export const CHINESE_MODES: ModeOption[] = [
  { id: 'mixed', titleKey: 'modes.mixed.title', descKey: 'modes.mixed.desc', icon: Shuffle },
  { id: 'cloze', titleKey: 'modes.cloze.title', descKey: 'modes.cloze.desc', icon: Layers },
  { id: 'hanzi', titleKey: 'modes.chinese.hanzi.title', descKey: 'modes.chinese.hanzi.desc', icon: BookOpen },
  { id: 'pinyin', titleKey: 'modes.chinese.pinyin.title', descKey: 'modes.chinese.pinyin.desc', icon: Type },
  { id: 'english', titleKey: 'modes.chinese.english.title', descKey: 'modes.chinese.english.desc', icon: Languages },
  { id: 'audio', titleKey: 'modes.chinese.audio.title', descKey: 'modes.chinese.audio.desc', icon: Ear },
  { id: 'tone', titleKey: 'modes.chinese.tone.title', descKey: 'modes.chinese.tone.desc', icon: Music },
];

export const ENGLISH_MODES: ModeOption[] = [
  { id: 'mixed', titleKey: 'modes.mixed.title', descKey: 'modes.mixed.desc', icon: Shuffle },
  { id: 'cloze', titleKey: 'modes.cloze.title', descKey: 'modes.cloze.desc', icon: Layers },
  { id: 'hanzi', titleKey: 'modes.english.hanzi.title', descKey: 'modes.english.hanzi.desc', icon: BookOpen },
  { id: 'english', titleKey: 'modes.english.english.title', descKey: 'modes.english.english.desc', icon: Languages },
  { id: 'audio', titleKey: 'modes.english.audio.title', descKey: 'modes.english.audio.desc', icon: Ear },
];

export const MODES = CHINESE_MODES;

interface Props {
  vocab: VocabItem[];
  state: UserState;
  onStart: (req: SessionRequest) => void;
}

export function ModeSelector({ vocab, state, onStart }: Props) {
  const { t, rich } = useI18n();
  const isEnglishCourse = trackOf(state.settings.course) === 'english';
  const availableModes = isEnglishCourse ? ENGLISH_MODES : CHINESE_MODES;

  const [mode, setMode] = useState<StudyMode>(() => {
    const cur = state.settings.defaultMode;
    // Fall back to mixed if the defaultMode is not available in English course (e.g. tone or pinyin)
    if (isEnglishCourse && (cur === 'tone' || cur === 'pinyin')) {
      return 'mixed';
    }
    return cur;
  });

  const [levels, setLevels] = useState<HskLevel[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const levelOptions = useMemo(() => [...new Set(vocab.map((v) => v.hskLevel))].sort((a, b) => a - b), [vocab]);
  const topicOptions = useMemo(() => allTopics(vocab), [vocab]);

  const base: SessionRequest = { label: '', mode, levels, topics };
  const summary = queueSummary(vocab, state, base);
  const available = Math.min(summary.dueCount + summary.newAvailable, summary.remainingToday);
  const activeModeItem = availableModes.find((m) => m.id === mode) ?? availableModes[0];
  const label = [
    t(activeModeItem.titleKey),
    levels.length ? levels.map((l) => levelLabel(l, state.settings.course, t)).join(', ') : '',
    topics.join(', '),
  ]
    .filter(Boolean)
    .join(' · ');

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-700 dark:bg-slate-800/70">
      <h2 className="text-lg font-semibold">{t('common.practice')}</h2>

      <div
        className={`mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 ${isEnglishCourse ? 'lg:grid-cols-5' : 'lg:grid-cols-7'}`}
        role="radiogroup"
        aria-label={t('modes.aria')}
      >
        {availableModes.map((m) => {
          const Icon = m.icon;
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              role="radio"
              aria-checked={active}
              onClick={() => setMode(m.id)}
              className={`rounded-2xl border-2 p-3 text-left transition ${
                active
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40'
                  : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`} />
              <div className="mt-1.5 font-semibold text-sm">{t(m.titleKey)}</div>
              <div className="text-xs leading-snug text-slate-500 dark:text-slate-400">{t(m.descKey)}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-3">
        <FilterRow label={t('modes.filter.level')}>
          {levelOptions.map((l) => (
            <Chip key={l} active={levels.includes(l)} onClick={() => setLevels((ls) => toggle(ls, l))}>
              {levelLabel(l, state.settings.course, t)}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label={t('modes.filter.topic')}>
          {topicOptions.map((topic) => (
            <Chip key={topic} active={topics.includes(topic)} onClick={() => setTopics((ts) => toggle(ts, topic))}>
              {topic}
            </Chip>
          ))}
        </FilterRow>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {rich(
            'modes.summary',
            { due: summary.dueCount, new: summary.newAvailable, reviewed: summary.reviewedToday, cap: state.settings.dailyCap },
            { b: (text) => <b className="text-slate-800 dark:text-slate-100">{text}</b> },
          )}
        </p>
        <div className="flex gap-2">
          {available === 0 && (
            <button
              onClick={() => onStart({ ...base, label: t('modes.extraLabel', { name: label || t('common.practice') }), includeNotDue: true, ignoreCap: true, limit: 10 })}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
            >
              {t('modes.extra', { count: 10 })}
            </button>
          )}
          <button
            onClick={() => onStart({
              ...base,
              label: label || t('common.practice'),
              ...(available === 0 ? { includeNotDue: true, ignoreCap: true, limit: 15 } : {}),
            })}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 font-semibold text-white transition hover:bg-rose-700"
          >
            <Play className="h-4 w-4" /> {t('modes.start', { count: available > 0 ? available : 15 })}
          </button>
        </div>
      </div>
      {summary.remainingToday === 0 && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          {t('modes.capReached', { cap: state.settings.dailyCap })}
        </p>
      )}
    </section>
  );
}

/** One scrollable row on phones (no wall of chips), wrapping from sm up. */
function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="min-w-[3rem] shrink-0 pt-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <div className="-mr-5 flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 pr-5 sm:mr-0 sm:flex-wrap sm:overflow-visible sm:pr-0">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-sm transition ${
        active
          ? 'border-rose-500 bg-rose-500 text-white'
          : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}
