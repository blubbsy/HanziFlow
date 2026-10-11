import { useMemo, useState } from 'react';
import { AlertTriangle, Table2 } from 'lucide-react';
import type { SessionRequest, ToneKey, UserState, VocabItem } from '../types';
import {
  TONE_KEYS,
  accuracyByLevel,
  accuracyByTopic,
  activity,
  frequentFailures,
  leeches,
  toneAccuracyList,
  type Ratio,
} from '../utils/analytics';
import { levelLabel } from '../data/vocab';
import { HanziText, PinyinText, TONE_BG_CLASS } from './ToneText';
import { trackOf } from '../data/courses';
import { useI18n } from '../i18n/react';

interface Props {
  vocab: VocabItem[];
  state: UserState;
  onStart: (req: SessionRequest) => void;
}

const card = 'rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/70';

export function Insights({ vocab, state, onStart }: Props) {
  const { t } = useI18n();
  const levels = useMemo(() => accuracyByLevel(state, vocab), [state, vocab]);
  const topics = useMemo(
    () => accuracyByTopic(state, vocab).sort((a, b) => (a.ratio.pct ?? 101) - (b.ratio.pct ?? 101)),
    [state, vocab],
  );
  const tones = toneAccuracyList(state);
  const days = activity(state, 14);
  const leechList = leeches(state, vocab);
  const failures = frequentFailures(state, vocab);
  const isEnglish = trackOf(state.settings.course) === 'english';
  const color = state.settings.colorTones;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className={card}>
          <h2 className="font-semibold">{t(isEnglish ? 'insights.accuracy.cefr' : 'insights.accuracy.hsk')}</h2>
          <div className="mt-4 space-y-3">
            {levels.map((l) => (
              <BarRow key={l.level} label={levelLabel(l.level, state.settings.course, t)} ratio={l.ratio} extra={t('insights.learnedOf', { learned: l.learned, total: l.words })} />
            ))}
          </div>
        </section>

        <section className={card}>
          <h2 className="font-semibold">{t('insights.last14')}</h2>
          <ActivityChart days={days} />
        </section>
      </div>

      {!isEnglish && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className={card}>
            <h2 className="font-semibold">{t('insights.toneAccuracy')}</h2>
            <div className="mt-4 space-y-3">
              {tones.map((tone) => (
                <BarRow key={tone.tone} label={t(`insights.tone.${tone.tone}`)} ratio={tone.ratio} barClass={TONE_BG_CLASS[tone.tone]} />
              ))}
            </div>
          </section>
          <section className={card}>
            <h2 className="font-semibold">{t('insights.toneConfusion')}</h2>
            <p className="text-xs text-slate-500">{t('insights.toneConfusionHint')}</p>
            <ConfusionMatrix matrix={state.stats.toneConfusion} />
          </section>
        </div>
      )}

      <section className={card}>
        <h2 className="font-semibold">{t('insights.topicsWeakest')}</h2>
        <div className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2">
          {topics.map((row) => (
            <div key={row.topic} className="flex items-center gap-2">
              <div className="flex-1">
                <BarRow label={row.topic} ratio={row.ratio} />
              </div>
              {row.ratio.total > 0 && (
                <button
                  onClick={() => onStart({ label: row.topic, mode: 'mixed', levels: [], topics: [row.topic], includeNotDue: true, ignoreCap: true, limit: 12 })}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                >
                  {t('insights.drill')}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> {t('insights.leechTitle')}
          </h2>
          {leechList.length > 0 && (
            <button
              onClick={() =>
                onStart({ label: t('insights.leechClinicLabel'), mode: 'hanzi', levels: [], topics: [], wordIds: leechList.map((l) => l.id), includeNotDue: true, ignoreCap: true, limit: 10 })
              }
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
            >
              {t('insights.leechClinic', { count: leechList.length })}
            </button>
          )}
        </div>
        {failures.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{t('insights.noFailures')}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">{t('insights.col.word')}</th>
                  <th className="py-2 pr-3 font-medium">{t('insights.col.meaning')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('insights.col.misses')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('insights.col.stability')}</th>
                  <th className="py-2 font-medium">{t('insights.col.status')}</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((item) => {
                  const p = state.progress[item.id];
                  const failCount = (p?.recognition?.failureCount ?? 0) + (p?.recall?.failureCount ?? 0);
                  const stability = p?.recognition?.stability ?? p?.recall?.stability ?? 0;
                  const isLeech = Boolean(p?.recognition?.isLeech || p?.recall?.isLeech);
                  const consecutive = Math.max(p?.recognition?.consecutiveCorrect ?? 0, p?.recall?.consecutiveCorrect ?? 0);

                  return (
                    <tr key={item.id} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="py-2 pr-3">
                        <HanziText item={item} color={color} className="text-lg" />{' '}
                        <PinyinText item={item} color={color} className="text-slate-500" />
                      </td>
                      <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{item.english[0]}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{failCount}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{t('common.interval.short', { days: stability.toFixed(1) })}</td>
                      <td className="py-2">
                        {isLeech ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">{t('study.leech')}</span>
                        ) : (
                          <span className="text-xs text-slate-500">{t('insights.inARow', { count: consecutive })}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function BarRow({ label, ratio, extra, barClass = 'bg-rose-500' }: { label: string; ratio: Ratio; extra?: string; barClass?: string }) {
  const { t } = useI18n();
  const tip = ratio.total ? t('insights.barTip', { label, correct: ratio.correct, total: ratio.total, pct: ratio.pct ?? 0 }) : t('insights.barTipNone', { label });
  return (
    <div title={tip}>
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-slate-500">
          {ratio.pct === null ? '—' : `${ratio.pct}%`}
          <span className="ml-1 text-xs">({ratio.total}){extra ? ` · ${extra}` : ''}</span>
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${ratio.pct ?? 0}%` }} />
      </div>
    </div>
  );
}

function ActivityChart({ days }: { days: { day: string; reviewed: number; correct: number }[] }) {
  const { t } = useI18n();
  const [table, setTable] = useState(false);
  const max = Math.max(5, ...days.map((d) => d.reviewed));
  const total = days.reduce((s, d) => s + d.reviewed, 0);
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{t('insights.reviewsTotal', { count: total })}</span>
        <button onClick={() => setTable((open) => !open)} className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200" aria-pressed={table}>
          <Table2 className="h-3.5 w-3.5" /> {table ? t('insights.viewChart') : t('insights.viewTable')}
        </button>
      </div>
      {table ? (
        <table className="mt-3 w-full text-sm">
          <tbody>
            {days.filter((d) => d.reviewed > 0).map((d) => (
              <tr key={d.day} className="border-t border-slate-100 dark:border-slate-700">
                <td className="py-1">{d.day}</td>
                <td className="py-1 text-right tabular-nums">{t('insights.dayReviews', { count: d.reviewed })}</td>
                <td className="py-1 text-right tabular-nums">{t('insights.dayCorrect', { pct: Math.round((d.correct / d.reviewed) * 100) })}</td>
              </tr>
            ))}
            {total === 0 && (
              <tr>
                <td className="py-2 text-slate-500">{t('insights.noReviews')}</td>
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        <div className="mt-3 flex h-36 items-end gap-[2px]">
          {days.map((d) => (
            <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
              <div
                className="rounded-t bg-rose-500 transition group-hover:bg-rose-600"
                style={{ height: d.reviewed ? `${Math.max(3, (d.reviewed / max) * 100)}%` : '0' }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white group-hover:block dark:bg-slate-100 dark:text-slate-900">
                {d.reviewed
                  ? t('insights.tipAccuracy', { day: d.day.slice(5), reviews: t('insights.dayReviews', { count: d.reviewed }), pct: Math.round((d.correct / d.reviewed) * 100) })
                  : t('insights.tip', { day: d.day.slice(5), reviews: t('insights.dayReviews', { count: 0 }) })}
              </div>
              <div className="mt-1 h-px bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      )}
      {!table && (
        <div className="mt-1 flex justify-between text-xs text-slate-500">
          <span>{days[0].day.slice(5)}</span>
          <span>{t('insights.today')}</span>
        </div>
      )}
    </div>
  );
}

function ConfusionMatrix({ matrix }: { matrix: UserState['stats']['toneConfusion'] }) {
  const { t } = useI18n();
  const max = Math.max(1, ...TONE_KEYS.flatMap((r) => TONE_KEYS.map((c) => matrix[r][c])));
  const short = (tone: ToneKey) => (tone === '0' ? 'N' : tone);
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="mx-auto text-center text-sm">
        <thead>
          <tr>
            <th className="p-1" />
            {TONE_KEYS.map((c) => (
              <th key={c} className="w-11 p-1 text-xs font-medium text-slate-500">{short(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TONE_KEYS.map((r) => (
            <tr key={r}>
              <th className="pr-2 text-right text-xs font-medium text-slate-500">{short(r)}</th>
              {TONE_KEYS.map((c) => {
                const v = matrix[r][c];
                const intensity = v / max;
                const diag = r === c;
                return (
                  <td key={c} className="p-[2px]">
                    <div
                      title={t('insights.confusionCell', { expected: t(`insights.tone.${r}`), answered: t(`insights.tone.${c}`), count: v })}
                      className={`flex h-10 w-10 items-center justify-center rounded-md text-xs tabular-nums ${
                        intensity > 0.55 ? 'text-white' : 'text-slate-700 dark:text-slate-200'
                      } ${v === 0 ? 'bg-slate-50 dark:bg-slate-900/50' : ''}`}
                      style={
                        v
                          ? { backgroundColor: diag ? `rgba(16,185,129,${0.15 + intensity * 0.8})` : `rgba(225,29,72,${0.15 + intensity * 0.8})` }
                          : undefined
                      }
                    >
                      {v || ''}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
