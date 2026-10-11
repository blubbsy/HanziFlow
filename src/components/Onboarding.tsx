import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import type { CourseId, HskLevel, SessionRequest, UserState, VocabItem } from '../types';
import { courseVars, getCourseConfig, languageCourses } from '../data/courses';
import { bulkMarkLevelKnown } from '../utils/srsEngine';
import { useI18n } from '../i18n/react';
import { PlacementTestModal } from './PlacementTestModal';

interface Props {
  state: UserState;
  vocab: VocabItem[];
  onSwitchCourse: (course: CourseId) => void;
  onUpdateState: (next: UserState) => void;
  onStart: (request: SessionRequest) => void;
}

const GOALS = [
  { id: 'light', sessionSize: 10, newCardsPerDay: 5 },
  { id: 'regular', sessionSize: 15, newCardsPerDay: 10 },
  { id: 'intense', sessionSize: 30, newCardsPerDay: 15 },
] as const;
type GoalId = (typeof GOALS)[number]['id'];

const FIRST_SESSION_CARDS = 5;
const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400';
const choice = (selected: boolean) =>
  `flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${focusRing} ${
    selected ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50'
  }`;

/**
 * First run: language, level and daily goal in three short steps, ending in a five-card first session.
 * Nothing else is shown on the home screen until the learner has finished (or skipped) it.
 */
export function Onboarding({ state, vocab, onSwitchCourse, onUpdateState, onStart }: Props) {
  const { t, lang } = useI18n();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<GoalId>('regular');
  const [level, setLevel] = useState<'beginner' | 'some' | null>(null);
  const [showPlacement, setShowPlacement] = useState(false);
  const course = getCourseConfig(state.settings.course);
  const total = 3;

  const finish = (start: boolean) => {
    const g = GOALS.find((x) => x.id === goal) ?? GOALS[1];
    onUpdateState({
      ...state,
      settings: { ...state.settings, onboarded: true, sessionSize: g.sessionSize, newCardsPerDay: g.newCardsPerDay },
    });
    if (start) {
      onStart({ label: t('dashboard.startSession'), mode: state.settings.defaultMode, levels: [], topics: [], limit: FIRST_SESSION_CARDS });
    }
  };

  const handlePlacementComplete = (estimated: HskLevel, markKnown: HskLevel[]) => {
    let next: UserState = { ...state, placementResult: { estimatedLevel: estimated, date: new Date().toISOString(), score: 12, total: 15 } };
    for (const lvl of markKnown) next = bulkMarkLevelKnown(next, vocab, lvl, true);
    onUpdateState(next);
    setStep(2);
  };

  return (
    <section className="mx-auto max-w-xl" aria-labelledby="onboarding-title">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 dark:border-slate-700 dark:bg-slate-800/70">
        <div className="flex items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
          <span>{t('onboarding.stepOf', { n: step + 1, total })}</span>
          <button type="button" onClick={() => finish(false)} className={`rounded-lg px-2 py-1 font-medium hover:text-slate-800 dark:hover:text-white ${focusRing}`}>
            {t('onboarding.skip')}
          </button>
        </div>
        <div className="mt-2 flex gap-1.5" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-rose-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="mt-6">
            <h1 id="onboarding-title" className="text-2xl font-bold tracking-tight">{t('onboarding.language.title')}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('onboarding.language.desc')}</p>
            <div className="mt-5 space-y-3" role="radiogroup" aria-label={t('onboarding.language.title')}>
              {languageCourses().map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={course.id === c.id}
                  data-course={c.id}
                  onClick={() => onSwitchCourse(c.id)}
                  className={choice(course.id === c.id)}
                >
                  <span className="text-3xl" aria-hidden>{c.flag}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{t(c.cardTitleKey, courseVars(c, lang))}</span>
                    <span className="block text-sm text-slate-500 dark:text-slate-400">{t(c.cardSubtitleKey, courseVars(c, lang))}</span>
                  </span>
                  {course.id === c.id && <Check className="mt-1 h-5 w-5 shrink-0 text-rose-600" aria-hidden />}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mt-6">
            <h1 id="onboarding-title" className="text-2xl font-bold tracking-tight">{t('onboarding.level.title')}</h1>
            <div className="mt-5 space-y-3" role="radiogroup" aria-label={t('onboarding.level.title')}>
              <button type="button" role="radio" aria-checked={level === 'beginner'} onClick={() => setLevel('beginner')} className={choice(level === 'beginner')}>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{t('onboarding.level.beginner')}</span>
                  <span className="block text-sm text-slate-500 dark:text-slate-400">{t('onboarding.level.beginnerDesc')}</span>
                </span>
              </button>
              {course.features.placement && (
                <button
                  type="button"
                  role="radio"
                  aria-checked={level === 'some'}
                  onClick={() => {
                    setLevel('some');
                    setShowPlacement(true);
                  }}
                  className={choice(level === 'some')}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{t('onboarding.level.some')}</span>
                    <span className="block text-sm text-slate-500 dark:text-slate-400">{t('onboarding.level.someDesc')}</span>
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-6">
            <h1 id="onboarding-title" className="text-2xl font-bold tracking-tight">{t('onboarding.goal.title')}</h1>
            <div className="mt-5 space-y-3" role="radiogroup" aria-label={t('onboarding.goal.title')}>
              {GOALS.map((g) => (
                <button key={g.id} type="button" role="radio" aria-checked={goal === g.id} onClick={() => setGoal(g.id)} className={choice(goal === g.id)}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{t(`onboarding.goal.${g.id}`)}</span>
                    <span className="block text-sm text-slate-500 dark:text-slate-400">
                      {t('onboarding.goal.desc', { min: Math.max(1, Math.round(g.sessionSize * 0.4)), count: g.sessionSize })}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{t('onboarding.startNote', { count: FIRST_SESSION_CARDS })}</p>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 ${focusRing}`}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> {t('onboarding.back')}
            </button>
          ) : (
            <span />
          )}
          {step < total - 1 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && level === null}
              className={`rounded-2xl bg-rose-600 px-6 py-3 font-bold text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 disabled:opacity-40 ${focusRing}`}
            >
              {t('onboarding.next')}
            </button>
          ) : (
            <button type="button" onClick={() => finish(true)} data-testid="onboarding-start" className={`rounded-2xl bg-rose-600 px-6 py-3 font-bold text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 ${focusRing}`}>
              {t('onboarding.start')}
            </button>
          )}
        </div>
      </div>

      <PlacementTestModal
        vocab={vocab}
        isOpen={showPlacement}
        course={state.settings.course}
        onClose={() => setShowPlacement(false)}
        onComplete={handlePlacementComplete}
      />
    </section>
  );
}
