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
  Timer,
  Volume2,
} from 'lucide-react';
import type { HskLevel, SessionRequest, UserState, VocabItem } from '../types';
import { accuracyByLevel, averageLatencySec, calculateTrueRetention, recommendations, type Recommendation } from '../utils/analytics';
import { bulkMarkLevelKnown, dailyLogFor, effectiveStreak, isWordStudied, queueSummary } from '../utils/srsEngine';
import { levelLabel } from '../data/vocab';
import { useI18n } from '../i18n/react';
import { ModeSelector } from './ModeSelector';
import { PlacementTestModal } from './PlacementTestModal';
import { BulkMarkModal } from './BulkMarkModal';
import { courseVars, effectiveCurriculum, getCourseConfig } from '../data/courses';
import { buildRotationCards, rotationQuota, type RotationSource } from '../utils/rotation';

interface Props {
  vocab: VocabItem[];
  state: UserState;
  onStart: (req: SessionRequest) => void;
  onNavigate: (view: 'learn' | 'irregular' | 'topics' | 'dictionary' | 'insights' | 'achievements') => void;
  onUpdateState: (newState: UserState) => void;
  /** Opens the course switcher (shown in the first-run welcome). */
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

const panel = 'rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/70';

export function Dashboard({
  vocab,
  state,
  onStart,
  onNavigate,
  onUpdateState,
  onOpenCourses,
  rotationSources,
  rotationFailed,
}: Props) {
  const [showPlacementTest, setShowPlacementTest] = useState(false);
  const [showBulkMark, setShowBulkMark] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showCustomPractice, setShowCustomPractice] = useState(false);

  const courseConfig = getCourseConfig(state.settings.course);
  const i18n = useI18n();
  const { t, rich, formatNumber, lang } = i18n;

  const recs = useMemo(() => recommendations(state, vocab, new Date(), i18n), [state, vocab, i18n]);
  const levels = useMemo(() => accuracyByLevel(state, vocab), [state, vocab]);
  const streak = effectiveStreak(state);
  const latency = averageLatencySec(state);
  const today = dailyLogFor(state).reviewed;
  const seen = useMemo(() => vocab.filter((v) => isWordStudied(state.progress[v.id])).length, [vocab, state.progress]);
  const isNewLearner = state.stats.totalReviewed === 0 && seen === 0;
  const currentLevel = levels.find((l) => l.learned < l.words) ?? levels[levels.length - 1];

  const summary = useMemo(() => queueSummary(vocab, state), [vocab, state]);
  const trueRet = useMemo(() => calculateTrueRetention(state), [state]);

  const activeDailyCount = Math.min(summary.dueCount + summary.newAvailable, summary.remainingToday);
  const sessionBatchForMix = state.settings.sessionSize ?? 15;
  const mixCount = useMemo(
    () => buildRotationCards(rotationSources, state, rotationQuota(state, sessionBatchForMix)).length,
    [rotationSources, state, sessionBatchForMix],
  );
  const hasDailyWork = activeDailyCount > 0 || mixCount > 0;

  const sessionBatch = state.settings.sessionSize ?? 15;

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
      placementResult: {
        estimatedLevel,
        date: new Date().toISOString(),
        score: 12,
        total: 15,
      },
    };
    for (const lvl of markLevelsKnown) {
      nextState = bulkMarkLevelKnown(nextState, vocab, lvl, true);
    }
    onUpdateState(nextState);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        {/* Metric tiles on mobile */}
        <section className="grid grid-cols-2 gap-3 xl:hidden">
          <Tiles
            compact
            streak={streak}
            best={state.stats.longestStreak}
            today={today}
            cap={state.settings.dailyCap}
            trueRetentionRate={trueRet.rate}
            matureTotal={trueRet.matureTotal}
            latency={latency}
          />
        </section>

        {/* First run: say where the learner is and what to do next */}
        {isNewLearner && (
          <section className={`${panel} border-sky-200 bg-sky-50/70 p-5 dark:border-sky-900/60 dark:bg-sky-950/30`} aria-labelledby="welcome-title">
            <h2 id="welcome-title" className="text-lg font-bold">{t('welcome.title')}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('welcome.intro')}</p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-200">
              <li>{t('welcome.step1', { name: t(courseConfig.cardTitleKey, courseVars(courseConfig, lang)) })}</li>
              <li>{t('welcome.step2')}</li>
              <li>{t('welcome.step3')}</li>
            </ol>
            <button
              type="button"
              onClick={onOpenCourses}
              className="mt-4 rounded-xl border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:border-sky-800 dark:bg-slate-800 dark:text-sky-200"
            >
              {t('welcome.changeCourse')}
            </button>
          </section>
        )}

        {/* HERO: One Main Action - Today's Daily Plan */}
        <section className={`${panel} relative overflow-hidden p-6 sm:p-8 bg-gradient-to-br from-white via-white to-rose-50/40 dark:from-slate-800 dark:via-slate-800 dark:to-rose-950/20 shadow-sm`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                <Sparkles className="h-3.5 w-3.5" /> {t('dashboard.dailySchedule')}
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                {activeDailyCount > 0 ? (
                  rich(
                    'dashboard.todayCounts',
                    { due: summary.dueCount, new: summary.newAvailable },
                    {
                      due: (text) => <span className="text-rose-600 dark:text-rose-400">{text}</span>,
                      new: (text) => <span className="text-slate-900 dark:text-slate-100">{text}</span>,
                    },
                  )
                ) : mixCount > 0 ? (
                  t('rotation.dashboardOnly', { count: mixCount })
                ) : (
                  t('dashboard.allCaughtUp')
                )}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {activeDailyCount > 0
                  ? t('dashboard.estimatedTime', {
                      min: summary.estimatedMinutes,
                      reviewed: summary.reviewedToday,
                      cap: state.settings.dailyCap,
                    })
                  : mixCount > 0
                    ? t('dashboard.estimatedTime', { min: Math.max(1, Math.round(mixCount * 0.4)), reviewed: summary.reviewedToday, cap: state.settings.dailyCap })
                    : t('dashboard.restMessage')}
              </p>
              {activeDailyCount > 0 && mixCount > 0 && (
                <p className="mt-1 text-sm text-sky-700 dark:text-sky-300">{t('rotation.dashboard', { count: mixCount })}</p>
              )}
              {rotationFailed && (
                <p role="alert" className="mt-1 text-sm text-amber-700 dark:text-amber-300">{t('rotation.loadError')}</p>
              )}
            </div>

            <button
              onClick={handleStartDailySession}
              className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-rose-600 px-7 py-4 text-lg font-bold text-white shadow-xl shadow-rose-600/25 transition active:scale-[0.98] hover:bg-rose-700"
            >
              <Play className="h-5 w-5 fill-current" />
              {hasDailyWork
                ? t('dashboard.startSession')
                : t('dashboard.extraPractice', { count: sessionBatch })}
            </button>
          </div>

          {/* Optional extras stay out of the way until asked for */}
          <div className="mt-5 border-t border-slate-100 pt-3 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
              className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:text-slate-300 dark:hover:text-white"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? 'rotate-180' : ''}`} aria-hidden />
              {showMore ? t('dashboard.moreHide') : t('dashboard.more')}
            </button>
            {showMore && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <button
                  onClick={() => setShowCustomPractice((prev) => !prev)}
                  aria-pressed={showCustomPractice}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
                >
                  <SlidersHorizontal className="h-4 w-4 text-slate-400" aria-hidden />
                  {showCustomPractice ? t('dashboard.hideCustomPractice') : t('dashboard.customPractice')}
                </button>
                {courseConfig.features.placement && (
                  <button
                    onClick={() => setShowPlacementTest(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
                  >
                    <Award className="h-4 w-4 text-amber-500" aria-hidden />
                    {t('dashboard.placementTest')}
                  </button>
                )}
                <button
                  onClick={() => setShowBulkMark(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
                >
                  <CheckCheck className="h-4 w-4 text-emerald-500" aria-hidden />
                  {t('dashboard.bulkMark')}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Two clear next places to go */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {courseConfig.views.includes('learn') && (
            <button
              onClick={() => onNavigate('learn')}
              className={`${panel} flex items-center gap-3 p-4 text-left transition hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                <Compass className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{t('dashboard.exploreLearn')}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {t(courseConfig.features.grammar ? 'dashboard.exploreLearnDesc' : 'dashboard.explorePathsDesc')}
                </span>
              </span>
            </button>
          )}
          <button
            onClick={() => onNavigate('topics')}
            className={`${panel} flex items-center gap-3 p-4 text-left transition hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              <Layers className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{t('dashboard.exploreTopics')}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{t('dashboard.exploreTopicsDesc')}</span>
            </span>
          </button>
        </section>

        {/* Collapsible Custom Practice Panel */}
        {showCustomPractice && (
          <section className="animate-fade-in">
            <ModeSelector vocab={vocab} state={state} onStart={onStart} />
          </section>
        )}

        {/* Recommendations */}
        {recs.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">{t('dashboard.recommended')}</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {recs.slice(0, 2).map((r) => {
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
                          className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
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
      </div>

      {/* Sidebar on desktop */}
      <aside className="space-y-6">
        <section className="hidden grid-cols-2 gap-3 xl:grid">
          <Tiles
            streak={streak}
            best={state.stats.longestStreak}
            today={today}
            cap={state.settings.dailyCap}
            trueRetentionRate={trueRet.rate}
            matureTotal={trueRet.matureTotal}
            latency={latency}
          />
        </section>

        <section className={`${panel} p-5`}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">{t('dashboard.syllabusProgress')}</h2>
            <span className="text-xs text-slate-500">{t(`curriculum.${effectiveCurriculum(state.settings.course, state.settings.curriculum)}.short`)}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {t('dashboard.wordsLearned', {
              seen: formatNumber(seen),
              total: formatNumber(vocab.length),
            })}
          </p>

          <ul className="mt-4 space-y-3">
            {levels.map((l) => {
              const pct = l.words ? Math.round((l.learned / l.words) * 100) : 0;
              const isCurrent = l.level === currentLevel?.level;
              const lvlName = levelLabel(l.level, state.settings.course, t);
              return (
                <li key={l.level} className="group rounded-xl p-1 transition hover:bg-slate-50 dark:hover:bg-slate-800/50" title={t('dashboard.levelWordsLearned', { learned: l.learned, total: l.words, level: lvlName })}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className={isCurrent ? 'font-semibold' : ''}>
                      {lvlName}{' '}
                      {isCurrent && (
                        <span className="ml-1 rounded bg-rose-100 px-1.5 text-[10px] font-semibold uppercase text-rose-700 dark:bg-rose-900/50 dark:text-rose-200">
                          {t('dashboard.currentLevel')}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-slate-500 text-xs">
                        {formatNumber(l.learned)}/{formatNumber(l.words)}
                      </span>
                      <button
                        onClick={() =>
                          onStart({
                            label: t('dashboard.levelPracticeLabel', { level: lvlName }),
                            mode: 'mixed',
                            levels: [l.level],
                            topics: [],
                            ignoreCap: true,
                            includeNotDue: true,
                            limit: 15,
                          })
                        }
                        className="rounded-lg bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700 opacity-80 transition hover:bg-rose-600 hover:text-white group-hover:opacity-100 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-600 dark:hover:text-white"
                        title={t('dashboard.practiceLevel', { level: lvlName })}
                      >
                        {t('common.practice')}
                      </button>
                    </div>
                  </div>
                  <div
                    className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t('dashboard.levelProgress', { level: lvlName })}
                  >
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.max(pct, l.learned ? 1 : 0)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </aside>

      {/* Modals */}
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

function Tiles({
  compact = false,
  streak,
  best,
  today,
  cap,
  trueRetentionRate,
  matureTotal,
  latency,
}: {
  /** Only the two tiles that matter every day (streak, today's progress). */
  compact?: boolean;
  streak: number;
  best: number;
  today: number;
  cap: number;
  trueRetentionRate: number | null;
  matureTotal: number;
  latency: number | null;
}) {
  const { t } = useI18n();
  return (
    <>
      <Tile
        icon={Flame}
        label={t('dashboard.streak')}
        value={String(streak)}
        sub={t('dashboard.bestDays', { best })}
        accent="text-orange-500"
        highlight={streak > 0}
      />
      <RadialTile
        label={t('dashboard.today')}
        value={today}
        max={cap}
        sub={t('dashboard.ofGoal', { cap })}
        accent="text-rose-500"
      />
      {!compact && <Tile
        icon={Target}
        label={t('dashboard.trueRetention')}
        value={trueRetentionRate === null ? '—' : `${trueRetentionRate}%`}
        sub={
          matureTotal > 0
            ? t('dashboard.matureCards', { count: matureTotal })
            : t('dashboard.needsMatureCards')
        }
        accent="text-emerald-500"
        title={t('dashboard.retentionTooltip')}
      />}
      {!compact && <Tile
        icon={Timer}
        label={t('dashboard.speed')}
        value={latency === null ? '—' : t('study.summary.seconds', { value: latency.toFixed(1) })}
        sub={t('dashboard.perCard')}
        accent="text-sky-500"
      />}
    </>
  );
}

function RadialTile({
  label,
  value,
  max,
  sub,
  accent,
}: {
  label: string;
  value: number;
  max: number;
  sub: string;
  accent: string;
}) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  const radius = 17;
  const stroke = 3.5;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className={`${panel} flex items-center justify-between p-4`}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          <Layers className={`h-4 w-4 ${accent}`} aria-hidden /> {label}
        </div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
        <div className="truncate text-xs text-slate-500">{sub}</div>
      </div>
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
        <svg className="h-12 w-12 -rotate-90 transform" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={radius} className="stroke-slate-100 dark:stroke-slate-700" strokeWidth={stroke} fill="transparent" />
          <circle
            cx="22"
            cy="22"
            r={radius}
            className="stroke-rose-500 transition-all duration-700 ease-out"
            strokeWidth={stroke}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <span className="absolute text-[10px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{pct}%</span>
      </div>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  highlight,
  title,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  sub: string;
  accent: string;
  highlight?: boolean;
  title?: string;
}) {
  return (
    <div
      title={title}
      className={`${panel} p-4 transition-colors ${
        highlight ? 'bg-gradient-to-br from-white to-orange-50/50 dark:from-slate-800/70 dark:to-orange-950/20' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Icon className={`h-4 w-4 ${accent} ${highlight ? 'animate-pulse' : ''}`} aria-hidden /> {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      <div className="truncate text-xs text-slate-500">{sub}</div>
    </div>
  );
}
