import { useState } from 'react';
import type { SessionRequest, UserState, VocabItem } from '../types';
import { useI18n } from '../i18n/react';
import { Achievements } from './Achievements';
import { Insights } from './Insights';
import { SyllabusProgress } from './SyllabusProgress';

type ProgressTab = 'stats' | 'badges';
let preset: ProgressTab | null = null;

/** Makes the next mount of the Progress screen open on `tab` (the old badges link). */
export function presetProgressTab(tab: ProgressTab) {
  preset = tab;
}

interface Props {
  vocab: VocabItem[];
  state: UserState;
  onStart: (request: SessionRequest) => void;
}

/** Statistics and badges in one place. */
export function ProgressScreen({ vocab, state, onStart }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<ProgressTab>(() => {
    const initial = preset ?? 'stats';
    preset = null;
    return initial;
  });
  const tabs: { id: ProgressTab; label: string }[] = [
    { id: 'stats', label: t('nav.short.insights') },
    { id: 'badges', label: t('nav.badges') },
  ];
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={t('nav.insights')} className="mx-auto grid max-w-sm grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/70">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
              tab === x.id ? 'bg-white text-rose-600 shadow-sm dark:bg-slate-900 dark:text-rose-300' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {tab === 'stats' ? (
        <>
          <SyllabusProgress vocab={vocab} state={state} onStart={onStart} />
          <Insights vocab={vocab} state={state} onStart={onStart} />
        </>
      ) : (
        <Achievements vocab={vocab} state={state} />
      )}
    </div>
  );
}
