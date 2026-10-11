import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, CircleCheck, Dumbbell, Lightbulb, TriangleAlert } from 'lucide-react';
import { AudioButton } from '../components/AudioButton';
import { SpeedControl } from '../components/SpeedControl';
import { FreePinyin } from '../components/ToneText';
import type { SpeechApi } from '../utils/speech';
import { ExercisePlayer } from './ExercisePlayer';
import type { GrammarPointProgress } from './grammarStorage';
import type { GrammarPoint } from './types';
import { HskBadge, PatternFormula, RichText, card, focusRing, primaryBtn } from './ui';
import { useI18n } from '../i18n/react';

interface Props {
  point: GrammarPoint;
  pointProgress?: GrammarPointProgress;
  colorTones: boolean;
  speech: SpeechApi;
  speechRate: number;
  backLabel: string;
  onBack: () => void;
  onSessionDone: (correct: number, total: number) => void;
  /** English lessons: jumps to the wiki article the lesson practises. */
  onOpenWiki?: () => void;
}

export function GrammarLesson({ point, pointProgress, colorTones, speech, speechRate, backLabel, onBack, onSessionDone, onOpenWiki }: Props) {
  const { t } = useI18n();
  const [practicing, setPracticing] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const english = point.track === 'english';

  useEffect(() => {
    topRef.current?.scrollIntoView?.({ block: 'start' });
    // While practicing, the exercise player manages focus itself (its effect runs first).
    if (!practicing) topRef.current?.focus({ preventScroll: true });
  }, [practicing, point.id]);

  return (
    <div ref={topRef} tabIndex={-1} className="space-y-4 outline-none">
      <button type="button" onClick={practicing ? () => setPracticing(false) : onBack} className={`inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-sm font-medium text-slate-600 hover:text-rose-600 dark:text-slate-300 ${focusRing}`}>
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {practicing ? t('grammar.lesson.backToLesson') : backLabel}
      </button>

      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <HskBadge level={point.hskLevel} track={point.track} />
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {t('grammar.lesson.unreviewed')}
            </span>
            {pointProgress?.completed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <CircleCheck className="h-3 w-3" aria-hidden /> {t('grammar.lesson.completed')}
              </span>
            )}
            {onOpenWiki && (
              <button
                type="button"
                onClick={onOpenWiki}
                className={`rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 ${focusRing}`}
              >
                {t('grammar.lesson.readWiki')}
              </button>
            )}
            <a
              href={`https://github.com/blubbsy/Adilingo/issues/new?title=${encodeURIComponent(`[Grammar] ${point.id}: ${point.title}`)}&body=${encodeURIComponent(`### Grammar Point: ${point.id} - ${point.title}\n\n**Issue Description:**\n\n**Suggested Correction:**\n`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500 underline hover:text-rose-600 dark:hover:text-rose-400"
            >
              {t('grammar.lesson.report')}
            </a>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
            <RichText text={point.title} />
          </h2>
        </div>
      </header>

      {practicing ? (
        <ExercisePlayer
          key={point.id}
          point={point}
          speech={speech}
          speechRate={speechRate}
          onFinish={onSessionDone}
          onExit={() => setPracticing(false)}
        />
      ) : (
        <>
          <section className={`${card} p-4 sm:p-5`} aria-labelledby="gl-pattern">
            <h3 id="gl-pattern" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('grammar.lesson.pattern')}
            </h3>
            <PatternFormula pattern={point.pattern} track={point.track} />
          </section>

          <section className={`${card} space-y-3 p-4 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 sm:p-5`} aria-labelledby="gl-explain">
            <h3 id="gl-explain" className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden /> {t('grammar.lesson.howItWorks')}
            </h3>
            {point.explanation.map((p, i) => (
              <p key={i}>
                <RichText text={p} />
              </p>
            ))}
            {point.mistakes.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <h4 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                  <TriangleAlert className="h-4 w-4" aria-hidden /> {t('grammar.lesson.mistakes')}
                </h4>
                <ul className="space-y-1.5 text-sm text-amber-900 dark:text-amber-100">
                  {point.mistakes.map((m, i) => (
                    <li key={i}>
                      <RichText text={m} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section aria-labelledby="gl-examples">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <h3 id="gl-examples" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('grammar.lesson.examples')}
              </h3>
              <SpeedControl speech={speech} variant="compact" />
            </div>
            <ul className="space-y-2">
              {point.examples.map((ex, i) => (
                <li key={i} className={`${card} flex items-start gap-3 p-3 sm:p-4`}>
                  <div className="min-w-0 flex-1">
                    <p lang={english ? 'en' : 'zh-CN'} className={`${english ? '' : 'font-hanzi '}text-xl text-slate-900 dark:text-slate-100 sm:text-2xl`}>
                      {ex.hanzi}
                    </p>
                    {!english && (
                      <p className="mt-0.5 text-sm">
                        <FreePinyin text={ex.pinyin} color={colorTones} className="text-slate-600 dark:text-slate-300" />
                      </p>
                    )}
                    <p lang={english ? 'zh-CN' : undefined} className="mt-1 text-sm text-slate-500 dark:text-slate-400">{ex.english}</p>
                    {ex.note && (
                      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <RichText text={ex.note} />
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <AudioButton speech={speech} text={ex.hanzi} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className={`${card} flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5`}>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">{t('common.practice')}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {[
                  t('grammar.lesson.practiceInfo', { count: point.exercises.length, pct: 80 }),
                  pointProgress?.bestScore !== undefined ? t('grammar.lesson.best', { pct: Math.round(pointProgress.bestScore * 100) }) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <button type="button" className={`${primaryBtn} w-full sm:w-auto`} onClick={() => setPracticing(true)} disabled={!point.exercises.length}>
              <Dumbbell className="h-4 w-4" aria-hidden />
              {pointProgress?.completed ? t('grammar.lesson.practiceAgain') : t('grammar.lesson.startPractice')}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
