import { levelLabel } from '../data/vocab';
import type { ReactNode } from 'react';
import type { TrackId } from '../types';
import { useI18n } from '../i18n/react';

const CJK_RUN = /([㐀-鿿　-〿！-？…]+)/;
const HAS_CJK = /[㐀-鿿]/;

export const hasHanzi = (s: string) => HAS_CJK.test(s);

/** Wraps runs of Chinese characters so they get the hanzi font and correct language. */
export function Zh({ text }: { text: string }) {
  const parts = text.split(CJK_RUN);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} lang="zh-CN" className="font-hanzi">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}

/** Plain text with `**bold**` and `*italic*` markup plus hanzi wrapping. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4)
          return (
            <strong key={i} className="font-semibold text-slate-900 dark:text-slate-100">
              <Zh text={p.slice(2, -2)} />
            </strong>
          );
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2)
          return (
            <em key={i}>
              <Zh text={p.slice(1, -1)} />
            </em>
          );
        return <Zh key={i} text={p} />;
      })}
    </>
  );
}

/** Structure formula: chunks with hanzi are highlighted, placeholders are neutral. */
export function PatternFormula({ pattern, size = 'lg', track = 'chinese' }: { pattern: string; size?: 'sm' | 'lg'; track?: TrackId }) {
  const alternatives = pattern.split(/\s{2,}·\s{2,}/);
  const big = size === 'lg';
  return (
    <span className={`flex flex-col ${big ? 'gap-2' : 'gap-1'}`}>
      {alternatives.map((alt, ai) => (
        <span key={ai} className="flex flex-wrap items-center gap-1.5">
          {alt.split(' + ').map((chunk, ci) => (
            <FormulaChunkWithPlus key={ci} first={ci === 0} big={big}>
              <FormulaChunk chunk={chunk} big={big} track={track} />
            </FormulaChunkWithPlus>
          ))}
        </span>
      ))}
    </span>
  );
}

function FormulaChunkWithPlus({ first, big, children }: { first: boolean; big: boolean; children: ReactNode }) {
  return (
    <>
      {!first && (
        <span aria-hidden className={`font-medium text-slate-500 ${big ? 'text-base' : 'text-xs'}`}>
          +
        </span>
      )}
      {children}
    </>
  );
}

/** Fixed words stand out: hanzi in Chinese patterns, lower-case words and parentheses in English ones (slots are capitalised). */
const isFixedChunk = (s: string, track: TrackId) => (track === 'english' ? /^[a-z(]/.test(s) : hasHanzi(s));

function FormulaChunk({ chunk, big, track }: { chunk: string; big: boolean; track: TrackId }) {
  const pad = big ? 'px-2.5 py-1 text-sm' : 'px-1.5 py-0.5 text-xs';
  // Split "想 / 要 / 会" or "Number / 这 / 那" so each alternative is styled on its own.
  const subs = chunk.split(' / ');
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {subs.map((s, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-slate-500">/</span>}
          {isFixedChunk(s, track) ? (
            <span
              className={`rounded-lg bg-rose-100 font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200 ${pad} ${big ? 'text-base' : ''}`}
            >
              <Zh text={s} />
            </span>
          ) : (
            <span className={`rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 ${pad}`}>{s}</span>
          )}
        </span>
      ))}
    </span>
  );
}

export function ProgressBar({ value, label, className = '' }: { value: number; label: string; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={`h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 ${className}`}
    >
      <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function HskBadge({ level, track = 'chinese' }: { level: number; track?: TrackId }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {track === 'english' ? levelLabel(level, 'english', t) : levelLabel(level)}
    </span>
  );
}

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900';

export const primaryBtn = `inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const secondaryBtn = `inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-rose-700 dark:hover:text-rose-300 ${focusRing}`;

export const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
