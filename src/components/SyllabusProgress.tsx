import { useMemo } from 'react';
import type { SessionRequest, UserState, VocabItem } from '../types';
import { accuracyByLevel } from '../utils/analytics';
import { isWordStudied } from '../utils/srsEngine';
import { levelLabel } from '../data/vocab';
import { effectiveCurriculum } from '../data/courses';
import { useI18n } from '../i18n/react';

interface Props {
  vocab: VocabItem[];
  state: UserState;
  onStart: (req: SessionRequest) => void;
}

/** Progress through the levels of the active syllabus, with a practice shortcut per level. */
export function SyllabusProgress({ vocab, state, onStart }: Props) {
  const { t, formatNumber } = useI18n();
  const levels = useMemo(() => accuracyByLevel(state, vocab), [state, vocab]);
  const seen = useMemo(() => vocab.filter((v) => isWordStudied(state.progress[v.id])).length, [vocab, state.progress]);
  const currentLevel = levels.find((l) => l.learned < l.words) ?? levels[levels.length - 1];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/70" aria-labelledby="syllabus-title">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="syllabus-title" className="font-semibold">{t('dashboard.syllabusProgress')}</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">{t(`curriculum.${effectiveCurriculum(state.settings.course, state.settings.curriculum)}.short`)}</span>
      </div>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        {t('dashboard.wordsLearned', { seen: formatNumber(seen), total: formatNumber(vocab.length) })}
      </p>

      <ul className="mt-4 space-y-3">
        {levels.map((l) => {
          const pct = l.words ? Math.round((l.learned / l.words) * 100) : 0;
          const isCurrent = l.level === currentLevel?.level;
          const lvlName = levelLabel(l.level, state.settings.course, t);
          return (
            <li key={l.level} className="group rounded-xl p-1 transition hover:bg-slate-50 dark:hover:bg-slate-800/50" title={t('dashboard.levelWordsLearned', { learned: l.learned, total: l.words, level: lvlName })}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className={isCurrent ? 'font-semibold' : ''}>
                  {lvlName}{' '}
                  {isCurrent && (
                    <span className="ml-1 rounded bg-rose-100 px-1.5 text-xs font-semibold uppercase text-rose-700 dark:bg-rose-900/50 dark:text-rose-200">
                      {t('dashboard.currentLevel')}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-xs text-slate-600 dark:text-slate-300">
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
                    className="rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700 transition hover:bg-rose-600 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-600 dark:hover:text-white"
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
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.max(pct, l.learned ? 1 : 0)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
