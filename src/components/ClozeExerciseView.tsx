import { useEffect, useRef } from 'react';
import { Check, Volume2, X } from 'lucide-react';
import type { ClozeExerciseData } from '../exercises/types';
import type { SpeechApi } from '../utils/speech';
import { SpeedControl } from './SpeedControl';
import { useI18n } from '../i18n/react';

interface Props {
  data: ClozeExerciseData;
  revealed: boolean;
  selectedIdx: number | null;
  isCorrect: boolean | null;
  speech: SpeechApi;
  speechRate?: number;
  onSelect: (index: number) => void;
}

export function ClozeExerciseView({
  data,
  revealed,
  selectedIdx,
  isCorrect,
  speech,
  onSelect,
}: Props) {
  const { t } = useI18n();

  // Play the complete sentence once when answered correctly. `speech` changes identity whenever playback
  // state or speed changes, so it is read through a ref to avoid replaying the sentence in a loop.
  const speechRef = useRef(speech);
  speechRef.current = speech;
  useEffect(() => {
    if (revealed && isCorrect) {
      speechRef.current.speak(data.sentence);
    }
  }, [revealed, isCorrect, data.sentence]);

  const slottedWord = selectedIdx !== null ? data.options[selectedIdx] : null;

  return (
    <div className="space-y-6">
      {/* 1. The Sentence with Interactive Gap Slot */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-center dark:border-slate-700/80 dark:bg-slate-800/40 sm:p-7">
        <div className="mb-2 flex items-center justify-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            {t('study.cloze.heading')}
          </span>
          <button
            type="button"
            onClick={() => speech.speak(data.sentence)}
            className="inline-flex items-center gap-1 rounded-full bg-slate-200/80 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            title={t('study.cloze.listen')}
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>{t('study.cloze.audio')}</span>
          </button>
          <SpeedControl speech={speech} variant="compact" />
        </div>

        {/* The Sentence with the Slot */}
        <p className="text-xl font-medium leading-relaxed text-slate-800 dark:text-slate-100 sm:text-2xl">
          <span>{data.prefix}</span>
          <span
            className={`mx-1.5 inline-flex items-center justify-center min-w-[5rem] px-3 py-1 rounded-xl text-base font-bold transition-all duration-200 align-middle ${
              !revealed
                ? slottedWord
                  ? 'border-2 border-rose-500 bg-rose-50 text-rose-700 shadow-sm dark:bg-rose-950/60 dark:text-rose-300'
                  : 'border-2 border-dashed border-slate-300 bg-white/70 text-slate-500 dark:border-slate-600 dark:bg-slate-800/70'
                : isCorrect
                ? 'border-2 border-emerald-500 bg-emerald-100 text-emerald-800 shadow-sm dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'border-2 border-rose-500 bg-rose-100 text-rose-800 shadow-sm dark:bg-rose-950/60 dark:text-rose-300'
            }`}
          >
            {revealed ? (
              <span className="flex items-center gap-1">
                {isCorrect ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-rose-600" />}
                {slottedWord || data.targetWord}
              </span>
            ) : (
              slottedWord || '____'
            )}
          </span>
          <span>{data.suffix}</span>
        </p>

        {/* Translation / Meaning Hint */}
        {data.translation && (
          <div className="mt-3.5 text-sm text-slate-500 dark:text-slate-400">
            <span>{t('study.cloze.hint')} </span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{data.translation}</span>
          </div>
        )}
      </div>

      {/* 2. Small Option Cards */}
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{t('study.cloze.choose')}</span>
          <span className="hidden sm:inline">{t('study.cloze.pressKeys')}</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {data.options.map((opt, idx) => {
            const isTarget = idx === data.correctIndex;
            const isPicked = idx === selectedIdx;

            let cardStyle =
              'border-slate-200 bg-white hover:border-rose-400 hover:bg-rose-50/40 text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-rose-600 dark:hover:bg-rose-950/30';

            if (revealed) {
              if (isTarget) {
                cardStyle =
                  'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold shadow-md ring-2 ring-emerald-400/30 dark:bg-emerald-950/60 dark:text-emerald-200';
              } else if (isPicked) {
                cardStyle =
                  'border-rose-500 bg-rose-50 text-rose-900 font-medium shadow-sm dark:bg-rose-950/60 dark:text-rose-200';
              } else {
                cardStyle = 'opacity-40 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40';
              }
            } else if (isPicked) {
              cardStyle =
                'border-rose-500 bg-rose-50 text-rose-900 font-semibold shadow ring-2 ring-rose-400/30 dark:bg-rose-950/50 dark:text-rose-200';
            }

            return (
              <button
                key={opt + idx}
                type="button"
                disabled={revealed}
                onClick={() => onSelect(idx)}
                className={`group relative flex flex-col items-center justify-center rounded-xl border-2 px-3 py-3 text-center transition-all duration-150 active:scale-95 ${cardStyle}`}
              >
                {/* Keyboard shortcut badge */}
                <span className="absolute top-1.5 left-2 rounded bg-slate-100 px-1.5 py-0.2 text-xs font-semibold text-slate-500 group-hover:bg-rose-100 group-hover:text-rose-700 dark:bg-slate-700 dark:text-slate-400 dark:group-bg-rose-900">
                  {idx + 1}
                </span>

                <span className="mt-1 text-base font-semibold">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
