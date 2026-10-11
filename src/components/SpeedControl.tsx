import { Gauge } from 'lucide-react';
import { SPEECH_RATES, nextSpeechRate, type SpeechApi } from '../utils/speech';
import { useI18n } from '../i18n/react';

interface Props {
  speech: Pick<SpeechApi, 'rate' | 'setRate'>;
  /** `chips` shows every speed; `compact` is a single button cycling through them. */
  variant?: 'chips' | 'compact';
  className?: string;
}

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400';

/** In-exercise playback speed control. Writes the saved speech speed, so it applies everywhere. */
export function SpeedControl({ speech, variant = 'chips', className = '' }: Props) {
  const { t } = useI18n();
  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={() => speech.setRate(nextSpeechRate(speech.rate))}
        aria-label={t('speed.cycle', { rate: speech.rate })}
        title={t('speed.cycle', { rate: speech.rate })}
        className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600 hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 ${focusRing} ${className}`}
      >
        <Gauge className="h-3.5 w-3.5" aria-hidden />
        {speech.rate}×
      </button>
    );
  }

  return (
    <div role="radiogroup" aria-label={t('speed.label')} className={`inline-flex items-center gap-1 ${className}`}>
      <Gauge className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      {SPEECH_RATES.map((r) => {
        const active = speech.rate === r;
        return (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => speech.setRate(r)}
            className={`rounded-lg border px-2 py-1 text-xs font-semibold tabular-nums transition ${focusRing} ${
              active
                ? 'border-rose-500 bg-rose-500 text-white'
                : 'border-slate-300 text-slate-600 hover:border-rose-300 dark:border-slate-600 dark:text-slate-300'
            }`}
          >
            {r}×
          </button>
        );
      })}
    </div>
  );
}
