import type { ToneKey, VocabItem } from '../types';
import { parseNumbered, toneOfMarked, toneSyllables } from '../utils/pinyinHelper';

export const TONE_TEXT_CLASS: Record<ToneKey, string> = {
  '1': 'text-tone1',
  '2': 'text-tone2',
  '3': 'text-tone3',
  '4': 'text-tone4',
  '0': 'text-tone0',
};

export const TONE_BG_CLASS: Record<ToneKey, string> = {
  '1': 'bg-tone1',
  '2': 'bg-tone2',
  '3': 'bg-tone3',
  '4': 'bg-tone4',
  '0': 'bg-tone0',
};

/** Pinyin of a vocab item, syllable by syllable, optionally coloured by tone. */
export function PinyinText({ item, color, className = '' }: { item: VocabItem; color: boolean; className?: string }) {
  const syllables = toneSyllables(item.pinyin, item.pinyinNumbered);
  return (
    <span className={className}>
      {syllables.map((s, i) => (
        <span key={i} className={color ? TONE_TEXT_CLASS[s.tone] : undefined}>
          {s.text}
          {i < syllables.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}

/** Characters coloured by their syllable's tone (when char count matches syllable count). */
export function HanziText({ item, color, className = '' }: { item: VocabItem; color: boolean; className?: string }) {
  const isChinese = /[\u4e00-\u9fa5]/.test(item.hanzi);
  if (!isChinese) {
    return (
      <span lang="en" className={`font-sans tracking-normal ${className}`}>
        {item.hanzi}
      </span>
    );
  }
  const chars = [...item.hanzi];
  const tones = parseNumbered(item.pinyinNumbered).map((s) => s.tone);
  const aligned = color && chars.length === tones.length;
  return (
    <span lang="zh-CN" className={`font-hanzi ${className}`}>
      {chars.map((c, i) => (
        <span key={i} className={aligned ? TONE_TEXT_CLASS[tones[i]] : undefined}>
          {c}
        </span>
      ))}
    </span>
  );
}

/** Free-form marked pinyin (e.g. example sentences): colours each word by its first tone mark. */
export function FreePinyin({ text, color, className = '' }: { text: string; color: boolean; className?: string }) {
  if (!color) return <span className={className}>{text}</span>;
  // Split each word into rough syllables at tone-marked vowels so multi-syllable words get mixed colours.
  const words = text.split(/(\s+)/);
  return (
    <span className={className}>
      {words.map((w, i) =>
        /\s+/.test(w) ? (
          w
        ) : (
          <span key={i}>
            {splitRoughSyllables(w).map((s, j) => (
              <span key={j} className={TONE_TEXT_CLASS[toneOfMarked(s)]}>
                {s}
              </span>
            ))}
          </span>
        ),
      )}
    </span>
  );
}

/** Heuristic split of a marked pinyin word: break after a syllable's final (incl. n/ng/r codas). */
function splitRoughSyllables(word: string): string[] {
  const parts = word.match(/[^aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜAEIOUĀÁǍÀĒÉĚÈŌÓǑÒ]*[aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜAEIOUĀÁǍÀĒÉĚÈŌÓǑÒ]+(?:ng|n(?![aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ])|r(?![aeiouāáǎàēéěè]))?[^a-zA-Züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]*/g);
  return parts && parts.join('') === word ? parts : [word];
}

export function ToneContourIcon({ tone, className = 'h-3.5 w-3.5' }: { tone: ToneKey; className?: string }) {
  switch (tone) {
    case '1': // 55 high flat
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={className} aria-hidden>
          <line x1="3" y1="6" x2="21" y2="6" />
        </svg>
      );
    case '2': // 35 rising
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={className} aria-hidden>
          <line x1="3" y1="18" x2="21" y2="6" />
        </svg>
      );
    case '3': // 214 dipping
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
          <polyline points="3,10 12,20 21,6" />
        </svg>
      );
    case '4': // 51 falling
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={className} aria-hidden>
          <line x1="3" y1="6" x2="21" y2="18" />
        </svg>
      );
    case '0': // Neutral (light dot)
    default:
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <circle cx="12" cy="14" r="3" />
        </svg>
      );
  }
}

export function ToneBadge({ tone, withContour = true }: { tone: ToneKey; withContour?: boolean }) {
  return (
    <span className={`inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded px-1.5 text-xs font-semibold text-white ${TONE_BG_CLASS[tone]}`}>
      <span>{tone === '0' ? '·' : tone}</span>
      {withContour && <ToneContourIcon tone={tone} className="h-2.5 w-2.5 stroke-white" />}
    </span>
  );
}

