import { useState, type ReactNode } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Crown,
  Mountain,
  GraduationCap,
  Lock,
  Milestone,
  Music,
  Plane,
  Play,
  Sprout,
  type LucideIcon,
} from 'lucide-react';
import {
  isStepDone,
  isUnitDone,
  isUnitPendingVocabReview,
  isUnitUnlocked,
  isWordLearned,
  pathStats,
  stepRepetitionStats,
  stepWordIds,
  unitDoneCount,
  wordRepetitions,
  type PathContext,
} from './pathLogic';
import type { GrammarPoint, LearningPath, PathIcon, PathUnit, VocabStep } from './types';
import { PatternFormula, ProgressBar, RichText, card, focusRing, primaryBtn, secondaryBtn } from './ui';
import { useI18n } from '../i18n/react';

const ICONS: Record<PathIcon, LucideIcon> = { sprout: Sprout, plane: Plane, bridge: Milestone, music: Music, mountain: Mountain, crown: Crown };

/** Long syllabus paths (the 7–9 band has ~500 units) render in pages. */
const UNIT_PAGE = 15;

interface Props {
  paths: LearningPath[];
  /** Lessons of the active course, by id (names of the grammar steps). */
  lessons: ReadonlyMap<string, GrammarPoint>;
  ctx: PathContext;
  selectedPathId: string | null;
  /** Specialty courses: the paths only teach terms, so the hint does not mention grammar. */
  wordsOnly?: boolean;
  onSelectPath: (id: string | null) => void;
  onOpenGrammar: (grammarId: string) => void;
  onPracticeVocab: (path: LearningPath, unit: PathUnit, step: VocabStep) => void;
}

export function LearningPathsView({ paths, lessons, ctx, selectedPathId, wordsOnly = false, onSelectPath, onOpenGrammar, onPracticeVocab }: Props) {
  const path = paths.find((p) => p.id === selectedPathId);
  if (!path) {
    return <PathOverview paths={paths} ctx={ctx} wordsOnly={wordsOnly} onSelectPath={onSelectPath} />;
  }
  return <PathDetail key={path.id} path={path} lessons={lessons} ctx={ctx} onBack={() => onSelectPath(null)} onOpenGrammar={onOpenGrammar} onPracticeVocab={onPracticeVocab} />;
}

/** The path to carry on with (the one in progress, else the first syllabus path), then everything else on request. */
function PathOverview({ paths, ctx, wordsOnly, onSelectPath }: { paths: LearningPath[]; ctx: PathContext; wordsOnly: boolean; onSelectPath: (id: string | null) => void }) {
  const { t } = useI18n();
  const syllabus = paths.filter((p) => p.id.startsWith('level-'));
  const themed = paths.filter((p) => !p.id.startsWith('level-'));
  const inProgress = paths
    .map((p) => ({ p, ratio: pathStats(p, ctx).ratio }))
    .filter((x) => x.ratio > 0 && x.ratio < 1)
    .sort((x, y) => y.ratio - x.ratio)[0]?.p;
  const featured = inProgress ?? syllabus[0] ?? paths[0];
  const [browse, setBrowse] = useState(false);
  if (!featured) return null;
  const others = paths.filter((p) => p.id !== featured.id);

  return (
    <div className="space-y-5">
      <section aria-labelledby="featured-path">
        <h2 id="featured-path" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          {t(inProgress ? 'grammar.paths.continue' : 'grammar.paths.startHere')}
        </h2>
        <PathCard path={featured} ctx={ctx} onOpen={() => onSelectPath(featured.id)} />
      </section>

      {others.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setBrowse((v) => !v)}
            aria-expanded={browse}
            className={`inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white ${focusRing}`}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${browse ? 'rotate-180' : ''}`} aria-hidden />
            {t('grammar.paths.browseAll', { count: others.length })}
          </button>
          {browse && (
            <div className="mt-4 space-y-6">
              {[
                { id: 'syllabus', title: t('grammar.paths.syllabus'), hint: t(wordsOnly ? 'grammar.paths.syllabusHintWords' : 'grammar.paths.syllabusHint'), list: syllabus.filter((x) => x.id !== featured.id) },
                { id: 'themed', title: t('grammar.paths.themed'), hint: t('grammar.paths.themedHint'), list: themed.filter((x) => x.id !== featured.id) },
              ]
                .filter((g) => g.list.length)
                .map((g) => (
                  <section key={g.id}>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{g.title}</h2>
                    <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{g.hint}</p>
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {g.list.map((x) => (
                        <li key={x.id}>
                          <PathCard path={x} ctx={ctx} onOpen={() => onSelectPath(x.id)} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function PathCard({ path, ctx, onOpen }: { path: LearningPath; ctx: PathContext; onOpen: () => void }) {
  const { t, formatNumber } = useI18n();
  const Icon = ICONS[path.icon];
  const stats = pathStats(path, ctx);
  const pct = Math.round(stats.ratio * 100);
  const unitsDone = path.units.filter((u) => isUnitDone(path, u, ctx)).length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${card} group flex h-full w-full flex-col gap-3 p-4 text-left transition hover:border-rose-300 dark:hover:border-rose-800 sm:p-5 ${focusRing}`}
    >
      <span className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900 dark:text-slate-100">{path.title}</span>
          <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">{path.description}</span>
        </span>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 group-hover:text-rose-500" aria-hidden />
      </span>
      <span className="mt-auto block">
        {stats.ratio === 0 ? (
          <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            {t('grammar.paths.notStarted', { total: path.units.length })}
          </span>
        ) : (
          <>
            <span className="mb-1 flex justify-between text-xs text-slate-600 dark:text-slate-300">
              <span>{t('grammar.paths.unitsDone', { done: unitsDone, total: path.units.length })}</span>
              <span className="font-medium">{formatNumber(pct / 100, { style: 'percent' })}</span>
            </span>
            <ProgressBar value={stats.ratio} label={t('grammar.paths.progressLabel', { title: path.title })} />
          </>
        )}
      </span>
    </button>
  );
}

function PathDetail({
  lessons,
  path,
  ctx,
  onBack,
  onOpenGrammar,
  onPracticeVocab,
}: {
  path: LearningPath;
  ctx: PathContext;
  onBack: () => void;
  lessons: ReadonlyMap<string, GrammarPoint>;
  onOpenGrammar: (id: string) => void;
  onPracticeVocab: Props['onPracticeVocab'];
}) {
  const { t, formatNumber } = useI18n();
  const Icon = ICONS[path.icon];
  const stats = pathStats(path, ctx);
  const unlocked = path.units.map((_, i) => isUnitUnlocked(path, i, ctx));
  const currentIdx = path.units.findIndex((u, i) => unlocked[i] && !isUnitDone(path, u, ctx));
  const [open, setOpen] = useState<Set<string>>(() => new Set(currentIdx >= 0 ? [path.units[currentIdx].id] : []));
  // Show the finished units collapsed into a summary, then a page of units from the current one on.
  const [start, setStart] = useState(() => Math.max(0, currentIdx - 2));
  const [end, setEnd] = useState(() => Math.max(currentIdx, 0) + UNIT_PAGE);
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className={`inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-sm font-medium text-slate-600 hover:text-rose-600 dark:text-slate-300 ${focusRing}`}>
        <ChevronLeft className="h-4 w-4" aria-hidden /> {t('grammar.paths.allPaths')}
      </button>

      <header className={`${card} p-4 sm:p-5`}>
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
            <Icon className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{path.title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{path.description}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar value={stats.ratio} label={t('grammar.paths.progressLabel', { title: path.title })} />
          <span className="shrink-0 text-sm font-medium text-slate-600 dark:text-slate-300">{formatNumber(stats.ratio, { style: 'percent', maximumFractionDigits: 0 })}</span>
        </div>
      </header>

      {start > 0 && (
        <button type="button" onClick={() => setStart(Math.max(0, start - UNIT_PAGE))} className={`${secondaryBtn} w-full`}>
          {t('grammar.paths.showEarlier', { count: start })}
        </button>
      )}
      <ol className="space-y-3" start={start + 1}>
        {path.units.map((unit, i) => {
          if (i < start || i >= end) return null;
          const isOpen = unlocked[i] && open.has(unit.id);
          const done = isUnitDone(path, unit, ctx);
          const doneSteps = unitDoneCount(path, unit, ctx);
          const panelId = `unit-${path.id}-${unit.id}`;
          const isPendingReview = !unlocked[i] && isUnitPendingVocabReview(path, i, ctx);
          return (
            <li key={unit.id} className={`${card} overflow-hidden ${unlocked[i] ? '' : 'opacity-70'}`}>
              <button
                type="button"
                onClick={() => unlocked[i] && toggle(unit.id)}
                aria-expanded={unlocked[i] ? isOpen : undefined}
                aria-controls={unlocked[i] ? panelId : undefined}
                aria-disabled={!unlocked[i]}
                title={isPendingReview ? t('grammar.paths.pendingReview') : undefined}
                className={`flex w-full items-start gap-3 p-4 text-left ${unlocked[i] ? '' : 'cursor-not-allowed'} ${focusRing} focus-visible:ring-inset`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    done
                      ? 'bg-emerald-500 text-white'
                      : unlocked[i]
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                  aria-hidden
                >
                  {done ? <Check className="h-5 w-5" /> : unlocked[i] ? i + 1 : <Lock className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                    {t('grammar.paths.unitLabel', { n: i + 1 })}
                    <span className="sr-only">{done ? t('grammar.paths.status.done') : unlocked[i] ? t('grammar.paths.status.unlocked') : t('grammar.paths.status.locked')}</span>
                  </span>
                  <span className="block font-semibold text-slate-900 dark:text-slate-100">{unit.title}</span>
                  <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
                    <RichText text={unit.goal} />
                  </span>
                  <span className={`mt-1 block text-xs ${isPendingReview ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                    {unlocked[i]
                      ? t('grammar.paths.stepsDone', { done: doneSteps, total: unit.steps.length })
                      : isPendingReview
                        ? t('grammar.paths.pendingReview')
                        : t('grammar.paths.completePrevious')}
                  </span>
                </span>
                {unlocked[i] && (
                  <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                )}
              </button>
              {isOpen && (
                <ul id={panelId} className="space-y-2 border-t border-slate-100 p-3 dark:border-slate-800 sm:p-4">
                  {unit.steps.map((step) => (
                    <li key={step.id}>
                      {step.type === 'vocab' ? (
                        <VocabStepRow step={step} done={isStepDone(path, step, ctx)} ctx={ctx} onPractice={() => onPracticeVocab(path, unit, step)} />
                      ) : (
                        <GrammarStepRow lesson={lessons.get(step.grammarId)} done={isStepDone(path, step, ctx)} onOpen={() => onOpenGrammar(step.grammarId)} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      {end < path.units.length && (
        <button type="button" onClick={() => setEnd(end + UNIT_PAGE)} className={`${secondaryBtn} w-full`}>
          {t('grammar.paths.showMore', { count: path.units.length - end })}
        </button>
      )}
    </div>
  );
}

function StepShell({ icon: Icon, done, children }: { icon: LucideIcon; done: boolean; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center ${
        done ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            done ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {done ? <CircleCheck className="h-4 w-4" aria-label={t('common.done')} /> : <Icon className="h-4 w-4" aria-hidden />}
        </span>
        {children}
      </div>
    </div>
  );
}

function VocabStepRow({ step, done, ctx, onPractice }: { step: VocabStep; done: boolean; ctx: PathContext; onPractice: () => void }) {
  const { t } = useI18n();
  const ids = stepWordIds(step, ctx);
  const repStats = stepRepetitionStats(step, ctx);
  const learned = repStats.learned;
  const partiallyLearned = repStats.partiallyLearned;
  return (
    <StepShell icon={BookOpen} done={done}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
          <p className="font-medium text-slate-900 dark:text-slate-100">
            <span className="sr-only">{t('grammar.paths.vocabulary')} </span>
            {step.title}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {!done && partiallyLearned > 0 && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
                {t('grammar.paths.halfReviewed')}
              </span>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('grammar.paths.wordsLearned', { learned, total: ids.length })}
            </p>
          </div>
        </div>
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t('grammar.paths.wordsInStep')}>
          {ids.map((id) => {
            const w = ctx.vocabById.get(id);
            if (!w) return null;
            const reps = wordRepetitions(id, ctx.vocabProgress);
            const ok = isWordLearned(id, ctx.vocabProgress);
            const partial = !ok && reps > 0;
            return (
              <li
                key={id}
                title={t('grammar.paths.wordTitle', { pinyin: w.pinyin, meaning: w.english.join(', '), reps })}
                className={`rounded-lg border px-2 py-1 text-center leading-tight transition ${
                  ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : partial
                      ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200'
                      : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                }`}
              >
                <span lang="zh-CN" className="block font-hanzi text-base">
                  {w.hanzi}
                </span>
                <span className="block text-xs opacity-70">
                  {w.pinyin}
                  {partial && <span className="ml-1 text-xs font-semibold text-sky-600 dark:text-sky-400">({reps}/2)</span>}
                </span>
                <span className="sr-only">
                  {w.english[0]}
                  {ok ? ` ${t('grammar.paths.srLearned')}` : partial ? ` ${t('grammar.paths.srReps', { reps })}` : ''}
                </span>
              </li>
            );
          })}
        </ul>
        {ids.length === 0 && <p className="mt-1 text-xs text-slate-500">{t('grammar.paths.noWords')}</p>}
        <div className="mt-3">
          <button type="button" className={`${done ? secondaryBtn : primaryBtn} w-full sm:w-auto`} disabled={!ids.length} onClick={onPractice}>
            <Play className="h-4 w-4" aria-hidden />
            {done ? t('grammar.paths.reviewWords') : partiallyLearned > 0 ? t('grammar.paths.practiceAgain') : t('grammar.paths.practiceWords', { count: ids.length })}
            <span className="sr-only">: {step.title}</span>
          </button>
        </div>
      </div>
    </StepShell>
  );
}

function GrammarStepRow({ lesson: g, done, onOpen }: { lesson: GrammarPoint | undefined; done: boolean; onOpen: () => void }) {
  const { t } = useI18n();
  if (!g) return null;
  return (
    <StepShell icon={GraduationCap} done={done}>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900 dark:text-slate-100">
          <span className="sr-only">{t('grammar.paths.grammarLabel')} </span>
          <RichText text={g.title} />
        </p>
        <div className="mt-1.5">
          <PatternFormula pattern={g.pattern} size="sm" />
        </div>
        <div className="mt-3">
          <button type="button" className={`${done ? secondaryBtn : primaryBtn} w-full sm:w-auto`} onClick={onOpen}>
            <GraduationCap className="h-4 w-4" aria-hidden />
            {done ? t('grammar.paths.reviewLesson') : t('grammar.paths.startLesson')}
            <span className="sr-only">: {g.title}</span>
          </button>
        </div>
      </div>
    </StepShell>
  );
}
