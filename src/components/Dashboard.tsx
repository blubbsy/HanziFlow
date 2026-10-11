import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCheck,
  ChevronDown,
  Compass,
  Flame,
  Layers,
  Music,
  Play,
  SlidersHorizontal,
  Sparkles,
  Target,
  Volume2,
} from 'lucide-react';
import type { CourseId, HskLevel, SessionRequest, UserState, VocabItem } from '../types';
import { recommendations, type Recommendation } from '../utils/analytics';
import { bulkMarkLevelKnown, effectiveStreak, queueSummary } from '../utils/srsEngine';
import { addDays, dayKey } from '../utils/dates';
import { useI18n } from '../i18n/react';
import { ModeSelector } from './ModeSelector';
import { PlacementTestModal } from './PlacementTestModal';
import { BulkMarkModal } from './BulkMarkModal';
import { courseVars, getCourseConfig } from '../data/courses';
import { buildRotationCards, rotationQuota, type RotationSource } from '../utils/rotation';

interface Props {
  vocab: VocabItem[];
  state: UserState;
  onStart: (req: SessionRequest) => void;
  onNavigate: (view: 'learn' | 'irregular' | 'topics' | 'dictionary' | 'insights' | 'achievements') => void;
  onUpdateState: (newState: UserState) => void;
  /** Opens the course list, where fields are added to the daily mix. */
  onOpenCourses: () => void;
  /** Loaded vocabulary of the courses in the daily mix. */
  rotationSources: RotationSource[];
  /** The daily mix could not be loaded. */
  rotationFailed: boolean;
}

const REC_ICON: Record<Recommendation['kind'], typeof Flame> = {
  tone: Music,
  leech: AlertTriangle,
  topic: Target,
  due: Layers,
  listening: Volume2,
  new: Sparkles,
  streak: Flame,
};

/** These only repeat what the main button already offers. */
const REDUNDANT_RECS: Recommendation['kind'][] = ['due', 'new'];

const panel = 'rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/70';
const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400';
const extraButton = `inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 ${focusRing}`;

export function Dashboard({ vocab, state, onStart, onNavigate, onUpdateState, onOpenCourses, rotationSources, rotationFailed }: Props) {
  const [showPlacementTest, setShowPlacementTest] = useState(false);
  const [showBulkMark, setShowBulkMark] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showCustomPractice, setShowCustomPractice] = useState(false);

  const courseConfig = getCourseConfig(state.settings.course);
  const i18n = useI18n();
  const { t, rich, lang, formatDate } = i18n;

  const recs = useMemo(
    () => recommendations(state, vocab, new Date(), i18n).filter((r) => !REDUNDANT_RECS.includes(r.kind)).slice(0, 2),
    [state, vocab, i18n],
  );
  const streak = effectiveStreak(state);
  const summary = useMemo(() => queueSummary(vocab, state), [vocab, state]);
  const hasHistory = state.stats.totalReviewed > 0;

  const sessionBatch = state.settings.sessionSize ?? 15;
  const activeDailyCount = Math.min(summary.dueCount + summary.newAvailable, summary.remainingToday);
  const mixCards = useMemo(
    () => buildRotationCards(rotationSources, state, rotationQuota(state, sessionBatch)),
    [rotationSources, state, sessionBatch],
  );
  const mixCount = mixCards.length;
  const hasDailyWork = activeDailyCount > 0 || mixCount > 0;
  const plannedMain = Math.max(0, Math.min(activeDailyCount, sessionBatch - mixCount));
  const mixByCourse = useMemo(() => {
    const counts = new Map<CourseId, number>();
    for (const c of mixCards) if (c.course) counts.set(c.course, (counts.get(c.course) ?? 0) + 1);
    return [...counts.entries()];
  }, [mixCards]);

  const week = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(now, i - 6);
      return { date: d, done: (state.stats.daily[dayKey(d)]?.reviewed ?? 0) > 0 };
    });
  }, [state.stats.daily]);

  const mixConfigured = (state.settings.rotation?.courses.length ?? 0) > 0;
  const courseName = (id: CourseId) => {
    const c = getCourseConfig(id);
    return t(c.cardTitleKey, courseVars(c, lang));
  };

  function handleStartDailySession() {
    if (hasDailyWork) {
      onStart({
        label: t('dashboard.startSession'),
        mode: state.settings.defaultMode,
        levels: [],
        topics: [],
        rotation: true,
        limit: Math.min(activeDailyCount + mixCount, sessionBatch),
      });
    } else {
      // Extra practice
      onStart({
        label: t('dashboard.extraPractice', { count: sessionBatch }),
        mode: 'mixed',
        levels: [],
        topics: [],
        includeNotDue: true,
        ignoreCap: true,
        limit: sessionBatch,
      });
    }
  }

  function handlePlacementComplete(estimatedLevel: HskLevel, markLevelsKnown: HskLevel[]) {
    let nextState: UserState = {
      ...state,
      placementResult: { estimatedLevel, date: new Date().toISOString(), score: 12, total: 15 },
    };
    for (const lvl of markLevelsKnown) nextState = bulkMarkLevelKnown(nextState, vocab, lvl, true);
    onUpdateState(nextState);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{t('nav.dashboard')}</h1>
          <p className="truncate text-sm text-slate-600 dark:text-slate-300">{courseName(courseConfig.id)}</p>
        </div>
        {hasHistory && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
            <Flame className="h-4 w-4" aria-hidden /> {t('app.streak', { count: streak })}
          </span>
        )}
      </header>

      {/* The one main action */}
      <section className={`${panel} bg-gradient-to-br from-white via-white to-rose-50/40 p-5 shadow-sm sm:p-7 dark:from-slate-800 dark:via-slate-800 dark:to-rose-950/20`} aria-labelledby="plan-title">
        <h2 id="plan-title" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
          {activeDailyCount > 0
            ? rich(
                'dashboard.todayCounts',
                { due: summary.dueCount, new: summary.newAvailable },
                {
                  due: (text) => <span className="text-rose-600 dark:text-rose-400">{text}</span>,
                  new: (text) => <span className="text-slate-900 dark:text-slate-100">{text}</span>,
                },
              )
            : mixCount > 0
              ? t('rotation.dashboardOnly', { count: mixCount })
              : t('dashboard.allCaughtUp')}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {hasDailyWork
            ? t('dashboard.estimatedTime', {
                min: activeDailyCount > 0 ? summary.estimatedMinutes : Math.max(1, Math.round(mixCount * 0.4)),
                reviewed: summary.reviewedToday,
                cap: state.settings.dailyCap,
              })
            : t('dashboard.restMessage')}
        </p>

        {mixCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2" aria-label={t('rotation.dashboard', { count: mixCount })}>
            {plannedMain > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                {t('today.chip', { name: courseName(courseConfig.id), count: plannedMain })}
              </span>
            )}
            {mixByCourse.map(([id, count]) => (
              <span key={id} className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-200">
                {t('today.chip', { name: courseName(id), count })}
              </span>
            ))}
          </div>
        )}
        {rotationFailed && (
          <p role="alert" className="mt-2 text-sm text-amber-700 dark:text-amber-300">{t('rotation.loadError')}</p>
        )}

        <button
          onClick={handleStartDailySession}
          className={`mt-5 inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-rose-600 px-7 py-4 text-lg font-bold text-white shadow-xl shadow-rose-600/25 transition hover:bg-rose-700 active:scale-[0.98] sm:w-auto ${focusRing}`}
        >
          <Play className="h-5 w-5 fill-current" aria-hidden />
          {hasDailyWork ? t('dashboard.startSession') : t('dashboard.extraPractice', { count: sessionBatch })}
        </button>

        <div className="mt-4">
          <button
            type="button"
            onClick={onOpenCourses}
            className={`rounded-lg px-1 py-1 text-sm font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-300 ${focusRing}`}
          >
            {mixConfigured ? t('today.mixAdjust') : t('today.mixAdd')}
          </button>
        </div>
      </section>

      {/* Last seven days */}
      {hasHistory && (
        <section className={`${panel} flex items-center justify-between gap-3 px-5 py-3`} aria-label={t('today.week')}>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('today.week')}</span>
          <ul className="flex gap-2">
            {week.map(({ date, done }) => (
              <li key={dayKey(date)} className="flex flex-col items-center gap-1">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}
                  role="img"
                  aria-label={t(done ? 'today.studied' : 'today.notStudied', { date: formatDate(date, { weekday: 'long' }) })}
                >
                  {done ? '✓' : ''}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-300" aria-hidden>{formatDate(date, { weekday: 'narrow' })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Where to go next */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {courseConfig.views.includes('learn') && (
          <button onClick={() => onNavigate('learn')} className={`${panel} flex items-center gap-3 p-4 text-left transition hover:border-slate-300 ${focusRing}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              <Compass className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{t('dashboard.exploreLearn')}</span>
              <span className="block text-xs text-slate-600 dark:text-slate-300">
                {t(courseConfig.features.grammar ? 'dashboard.exploreLearnDesc' : 'dashboard.explorePathsDesc')}
              </span>
            </span>
          </button>
        )}
        <button onClick={() => onNavigate('topics')} className={`${panel} flex items-center gap-3 p-4 text-left transition hover:border-slate-300 ${focusRing}`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            <Layers className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold">{t('dashboard.exploreTopics')}</span>
            <span className="block text-xs text-slate-600 dark:text-slate-300">{t('dashboard.exploreTopicsDesc')}</span>
          </span>
        </button>
      </section>

      {recs.length > 0 && (
        <section aria-labelledby="recs-title">
          <h2 id="recs-title" className="mb-2 text-base font-semibold">{t('dashboard.recommended')}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {recs.map((r) => {
              const Icon = REC_ICON[r.kind];
              return (
                <article key={r.id} className={`${panel} flex gap-3 p-4`}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{r.title}</h3>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{r.body}</p>
                    {r.action && (
                      <button
                        onClick={() => onStart(r.action!.request)}
                        className={`mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white ${focusRing}`}
                      >
                        {r.action.label}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Optional extras stay out of the way until asked for */}
      <section>
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          className={`inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white ${focusRing}`}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? 'rotate-180' : ''}`} aria-hidden />
          {showMore ? t('dashboard.moreHide') : t('dashboard.more')}
        </button>
        {showMore && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <button onClick={() => setShowCustomPractice((prev) => !prev)} aria-pressed={showCustomPractice} className={extraButton}>
              <SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden />
              {showCustomPractice ? t('dashboard.hideCustomPractice') : t('dashboard.customPractice')}
            </button>
            {courseConfig.features.placement && (
              <button onClick={() => setShowPlacementTest(true)} className={extraButton}>
                <Award className="h-4 w-4 text-amber-500" aria-hidden />
                {t('dashboard.placementTest')}
              </button>
            )}
            <button onClick={() => setShowBulkMark(true)} className={extraButton}>
              <CheckCheck className="h-4 w-4 text-emerald-500" aria-hidden />
              {t('dashboard.bulkMark')}
            </button>
          </div>
        )}
        {showMore && showCustomPractice && (
          <div className="mt-4 animate-fade-in">
            <ModeSelector vocab={vocab} state={state} onStart={onStart} />
          </div>
        )}
      </section>

      <PlacementTestModal
        vocab={vocab}
        isOpen={showPlacementTest}
        course={state.settings.course}
        onClose={() => setShowPlacementTest(false)}
        onComplete={handlePlacementComplete}
      />

      <BulkMarkModal
        vocab={vocab}
        state={state}
        isOpen={showBulkMark}
        course={state.settings.course}
        onClose={() => setShowBulkMark(false)}
        onUpdateState={onUpdateState}
      />
    </div>
  );
}
