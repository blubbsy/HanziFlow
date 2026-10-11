import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowRight, Flag, RotateCcw, Sparkles, Volume2, X } from 'lucide-react';
import type { CardProgress, DirectionProgress, Grade, SessionCard, Settings, ToneKey, VocabItem } from '../types';
import { checkPinyin, markSyllable, numberedToMarked, parseNumbered, stripTones } from '../utils/pinyinHelper';
import { nextInterval } from '../utils/srsEngine';
import { levelLabel } from '../data/vocab';
import { getCourseConfig, trackOf } from '../data/courses';
import { nextSpeechRate, type SpeechApi } from '../utils/speech';
import { AudioButton } from './AudioButton';
import { FreePinyin, PinyinText } from './ToneText';
import { playCorrect, playError } from '../utils/sound';
import { ClozeExerciseView } from './ClozeExerciseView';
import { buildClozeExercise } from '../exercises/types';
import type { TFunction } from '../i18n';
import { useI18n } from '../i18n/react';

export function formatInterval(days: number, t: TFunction): string {
  if (days <= 0) return t('common.interval.today');
  if (days < 30) return t('common.interval.days', { days });
  return t('common.interval.months', { months: Math.round(days / 30) });
}

export interface CardResult {
  correct: boolean;
  latencyMs: number;
}

interface Props {
  card: SessionCard;
  vocab: VocabItem[];
  progress?: CardProgress;
  settings: Settings;
  speech: SpeechApi;
  onGrade: (grade: Grade, result: CardResult) => void;
}

/** Random sample of wrong options from the same level. */
function pickDistractors(item: VocabItem, vocab: VocabItem[], n = 3): VocabItem[] {
  const sameLevel = vocab.filter((v) => v.hskLevel === item.hskLevel && v.id !== item.id);
  const pool = sameLevel.length >= n ? sameLevel : vocab.filter((v) => v.id !== item.id);

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function stableShuffle<T>(arr: T[], seed: string): T[] {
  const copy = [...arr];
  let h = hashString(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    h = (Math.imul(31, h) + 17) | 0;
    const j = Math.abs(h) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function generateWordToneOptions(syllables: { base: string; tone: ToneKey }[]): string[] {
  const correct = syllables.map((s) => markSyllable(s.base, Number(s.tone) || 1)).join('');
  const options = new Set<string>();
  options.add(correct);

  // Distractor 1: All tone 1 (or 2 if already 1)
  const d1 = syllables.map((s) => markSyllable(s.base, s.tone === '1' ? 2 : 1)).join('');
  options.add(d1);

  // Distractor 2: All tone 4 (or 3 if already 4)
  const d2 = syllables.map((s) => markSyllable(s.base, s.tone === '4' ? 3 : 4)).join('');
  options.add(d2);

  // Distractor 3: Shift tone of first syllable
  const firstToneNum = Number(syllables[0]?.tone) || 1;
  const shifted1 = (firstToneNum % 4) + 1;
  const d3 = syllables.map((s, i) => (i === 0 ? markSyllable(s.base, shifted1) : markSyllable(s.base, Number(s.tone) || 1))).join('');
  options.add(d3);

  // Distractor 4: Shift tone of second syllable if multi-syllable
  if (syllables.length > 1) {
    const secondToneNum = Number(syllables[1]?.tone) || 1;
    const shifted2 = (secondToneNum % 4) + 1;
    const d4 = syllables.map((s, i) => (i === 1 ? markSyllable(s.base, shifted2) : markSyllable(s.base, Number(s.tone) || 1))).join('');
    options.add(d4);
  }

  // Safety fallbacks if set size < 4
  for (let t = 1; t <= 4 && options.size < 4; t++) {
    options.add(syllables.map((s) => markSyllable(s.base, t)).join(''));
  }

  return Array.from(options).slice(0, 4);
}

function PinyinSuggestions({
  item,
  value,
  onSelect,
}: {
  item: VocabItem;
  value: string;
  onSelect: (val: string) => void;
}) {
  const { t } = useI18n();
  const syllables = useMemo(() => {
    return parseNumbered(item.pinyinNumbered).map((s) => ({
      base: s.base,
      tone: s.tone,
    }));
  }, [item.pinyinNumbered]);

  // Generate 4 plausible tone pattern choices for this word
  const wordToneOptions = useMemo(() => {
    const rawOptions = generateWordToneOptions(syllables);
    return stableShuffle(rawOptions, item.id);
  }, [syllables, item.id]);

  // Extract the current syllable being typed to show live autocomplete tone chips
  const lastToken = value.trim().split(/\s+/).pop() ?? '';
  const untonedToken = stripTones(lastToken).toLowerCase();
  const hasVowels = /[aeiouü]/.test(untonedToken);

  const activeSyllableTones = useMemo(() => {
    if (!hasVowels || untonedToken.length < 1) return [];
    const t1 = markSyllable(untonedToken, 1);
    if (t1 === untonedToken) return [];
    return [1, 2, 3, 4].map((tone) => markSyllable(untonedToken, tone));
  }, [untonedToken, hasVowels]);

  function handleSyllableSelect(toned: string) {
    const parts = value.trim().split(/\s+/);
    if (parts.length === 0 || parts[0] === '') {
      onSelect(toned);
      return;
    }
    parts[parts.length - 1] = toned;
    const hasMore = parts.length < syllables.length;
    onSelect(parts.join(' ') + (hasMore ? ' ' : ''));
  }

  return (
    <div className="mt-3 space-y-2 text-left">
      {/* 1. Live Syllable Autocomplete (shown while typing an unaccented syllable) */}
      {activeSyllableTones.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/70 p-2 text-xs dark:border-rose-900/50 dark:bg-rose-950/30">
          <span className="font-medium text-rose-800 dark:text-rose-200">
            {t('study.tones.forToken', { token: untonedToken })}
          </span>
          {activeSyllableTones.map((toned, i) => (
            <button
              key={toned}
              type="button"
              onClick={() => handleSyllableSelect(toned)}
              className="inline-flex items-center gap-0.5 rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-sm font-semibold text-rose-900 shadow-sm transition hover:bg-rose-100 active:scale-95 dark:border-rose-700 dark:bg-slate-800 dark:text-rose-200"
            >
              <span>{toned}</span>
              <span className="text-[10px] font-normal text-slate-400">({i + 1})</span>
            </button>
          ))}
        </div>
      )}

      {/* 2. Word Tone Pattern Choices */}
      <div>
        <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          {t('study.tones.choices')}
        </span>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {wordToneOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(opt)}
              className={`flex items-center justify-center rounded-xl border px-3 py-1.5 text-sm font-semibold transition active:scale-95 ${
                value === opt
                  ? 'border-rose-500 bg-rose-50 text-rose-800 shadow-sm dark:bg-rose-950/50 dark:text-rose-200'
                  : 'border-slate-200 bg-slate-50/80 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <span>{opt}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Tone Accents Toolbar for manual letter insertion */}
      <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="text-slate-400 dark:text-slate-500">{t('study.tones.accents')}</span>
        {['ā', 'á', 'ǎ', 'à', 'ē', 'é', 'ě', 'è', 'ī', 'í', 'ǐ', 'ì', 'ō', 'ó', 'ǒ', 'ò', 'ū', 'ú', 'ǔ', 'ù', 'ü'].map((char) => (
          <button
            key={char}
            type="button"
            onClick={() => onSelect(value + char)}
            className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white font-medium hover:bg-slate-100 active:scale-90 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            {char}
          </button>
        ))}
      </div>
    </div>
  );
}

function computePinyinDiff(typed: string, target: string): Array<{ char: string; match: boolean }> {
  const a = typed;
  const b = target;
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (a[i].toLowerCase() === b[j].toLowerCase()) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: Array<{ char: string; match: boolean }> = [];
  let i = m;
  let j = n;
  while (i > 0) {
    if (j > 0 && a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
      result.unshift({ char: a[i - 1], match: true });
      i--;
      j--;
    } else if (j > 0 && dp[i][j - 1] >= dp[i - 1][j]) {
      j--;
    } else {
      result.unshift({ char: a[i - 1], match: false });
      i--;
    }
  }
  return result;
}

function PinyinDiffText({
  typed,
  target,
  isCorrect,
}: {
  typed: string;
  target: string;
  isCorrect: boolean;
}) {
  if (isCorrect) {
    return <span className="font-semibold text-emerald-600 dark:text-emerald-400">{typed}</span>;
  }

  const diff = computePinyinDiff(typed, target);
  return (
    <span>
      {diff.map((part, idx) => (
        <span
          key={idx}
          className={
            part.match
              ? 'text-slate-800 dark:text-slate-200'
              : 'rounded bg-rose-100 px-0.5 font-bold text-rose-700 underline decoration-rose-500 dark:bg-rose-950/70 dark:text-rose-300'
          }
        >
          {part.char}
        </span>
      ))}
    </span>
  );
}

export function ReviewCard({ card, vocab, progress, settings, speech, onGrade }: Props) {
  const { t, rich } = useI18n();
  const { item, direction, prompt } = card;
  const dirProgress: DirectionProgress | undefined = direction === 'recall' ? progress?.recall : progress?.recognition;

  const [revealed, setRevealed] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [pinyinInput, setPinyinInput] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [pinyinCheck, setPinyinCheck] = useState<ReturnType<typeof checkPinyin> | null>(null);
  const mountTime = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const speechRef = useRef(speech);
  speechRef.current = speech;

  // Reset flip when card item changes
  useEffect(() => {
    setIsFlipped(false);
  }, [item.id]);

  const isChineseWord = getCourseConfig(settings.course).features.pinyin && /[\u4e00-\u9fa5]/.test(item.hanzi);
  const failureCount = dirProgress?.failureCount ?? 0;
  const pinyinHelperMode = settings.pinyinHelperMode ?? 'adaptive';
  const threshold = settings.pinyinAdaptiveThreshold ?? 2;
  const isAdaptiveTriggered = pinyinHelperMode === 'adaptive' && (failureCount >= threshold || Boolean(dirProgress?.isLeech));
  // A word seen for the first time always comes with its pinyin: nobody can guess a reading they have never met
  const isFirstSight = card.isNew && pinyinHelperMode !== 'never';
  const autoShowPinyin = isChineseWord && (pinyinHelperMode === 'always' || isAdaptiveTriggered || isFirstSight);
  const allowFlip = isChineseWord && pinyinHelperMode !== 'never';

  // Play audio automatically for listening drill once per card (without self-cancellation on speech state changes)
  useEffect(() => {
    if (prompt === 'audio') {
      // Uses the live saved speed (read inside speak) so changing speed does not re-trigger autoplay.
      speechRef.current.speak(item.speakAs ?? item.hanzi);
    }
  }, [prompt, item.id, item.hanzi, direction]);

  // Clean up speech only when this card unmounts
  useEffect(() => {
    return () => {
      speechRef.current.cancel();
    };
  }, []);

  // Distractors & options for multiple-choice modes
  const options = useMemo(() => {
    const distractors = pickDistractors(item, vocab, 3);
    const list = [...distractors, item].sort(() => Math.random() - 0.5);
    return list;
  }, [item, vocab]);

  const correctIndex = useMemo(() => options.findIndex((o) => o.id === item.id), [options, item.id]);

  const clozeData = useMemo(() => {
    if (prompt !== 'cloze') return null;
    return buildClozeExercise(item, vocab);
  }, [prompt, item, vocab]);

  // Focus typing input
  useEffect(() => {
    if (prompt === 'pinyin' && !revealed) {
      inputRef.current?.focus();
    }
  }, [prompt, revealed]);

  function handleClozeAnswer(choiceIdx: number) {
    if (revealed || !clozeData) return;
    const ok = choiceIdx === clozeData.correctIndex;
    setSelectedIdx(choiceIdx);
    setIsCorrect(ok);
    setRevealed(true);

    if (settings.soundEffects) {
      if (ok) playCorrect();
      else playError();
    }
  }

  function handleAnswer(choiceIdx: number) {
    if (revealed) return;
    const ok = choiceIdx === correctIndex;
    setSelectedIdx(choiceIdx);
    setIsCorrect(ok);
    setRevealed(true);

    if (settings.soundEffects) {
      if (ok) playCorrect();
      else playError();
    }
  }

  function handlePinyinSubmit(e: FormEvent) {
    e.preventDefault();
    if (revealed) return;
    const check = checkPinyin(pinyinInput, item);
    const ok = check.correct;
    setPinyinCheck(check);
    setIsCorrect(ok);
    setRevealed(true);

    if (settings.soundEffects) {
      if (ok) playCorrect();
      else playError();
    }
  }

  function handlePinyinInputChange(raw: string) {
    // Live tone numbers conversion, e.g. hao3 -> hǎo
    const converted = numberedToMarked(raw);
    setPinyinInput(converted);
  }

  function handleRevealWithoutAnswer() {
    if (revealed) return;
    if (prompt === 'pinyin') {
      const check = checkPinyin(pinyinInput, item);
      setPinyinCheck(check);
    }
    setIsCorrect(false);
    setRevealed(true);
    if (settings.soundEffects) playError();
  }

  function submitGrade(grade: Grade) {
    const latencyMs = Math.max(0, Date.now() - mountTime.current);
    onGrade(grade, {
      correct: Boolean(isCorrect),
      latencyMs,
    });
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) {
        if (e.key === 'Enter') return; // let form handle submit
      }

      // S cycles the playback speed (never while typing an answer). On a listening prompt it replays at the new speed.
      if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        const sp = speechRef.current;
        sp.setRate(nextSpeechRate(sp.rate));
        if (prompt === 'audio' && !revealed) sp.speak(item.speakAs ?? item.hanzi);
        return;
      }

      if (!revealed) {
        if ((e.key === 'f' || e.key === 'F' || e.key === 'p' || e.key === 'P') && allowFlip && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          setIsFlipped((f) => !f);
          return;
        }

        if (prompt === 'hanzi' || prompt === 'english' || prompt === 'audio') {
          if (['1', '2', '3', '4'].includes(e.key)) {
            e.preventDefault();
            const idx = parseInt(e.key, 10) - 1;
            if (idx >= 0 && idx < options.length) {
              handleAnswer(idx);
            }
          }
        } else if (prompt === 'cloze' && clozeData) {
          if (['1', '2', '3', '4'].includes(e.key)) {
            e.preventDefault();
            const idx = parseInt(e.key, 10) - 1;
            if (idx >= 0 && idx < clozeData.options.length) {
              handleClozeAnswer(idx);
            }
          }
        }
        if (e.key === ' ' || e.key === 'Enter') {
          if (prompt !== 'pinyin') {
            e.preventDefault();
            handleRevealWithoutAnswer();
          }
        }
      } else {
        // Revealed: 1-4 for grades, or Enter/Space for suggested grade
        if (['1', '2', '3', '4'].includes(e.key)) {
          e.preventDefault();
          submitGrade(parseInt(e.key, 10) as Grade);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          submitGrade(isCorrect ? 3 : 1);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [revealed, isCorrect, prompt, options.length, clozeData, allowFlip, item.hanzi]);

  const suggestedGrade: Grade = isCorrect ? 3 : 1;

  return (
    <div className="mx-auto max-w-2xl">
      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
              {levelLabel(item.hskLevel, settings.course ?? 'chinese', t)}
            </span>
            <span className="rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {direction === 'recall'
                ? t('study.kind.recall')
                : prompt === 'audio'
                ? t('study.kind.listening')
                : prompt === 'pinyin'
                ? t('study.kind.pinyin')
                : prompt === 'cloze'
                ? t('study.kind.cloze')
                : t('study.kind.recognition')}
            </span>
            {dirProgress?.isLeech && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" /> {t('study.leech')}
              </span>
            )}
          </div>

          <a
            href={`https://github.com/blubbsy/Adilingo/issues/new?title=${encodeURIComponent(`[Vocab Issue] ${item.hanzi} (${item.id})`)}&body=${encodeURIComponent(`### Word Issue\nWord: ${item.hanzi} (${item.pinyin})\nID: ${item.id}\nIssue:\n`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title={t('study.report.title')}
          >
            <Flag className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t('study.report')}</span>
          </a>
        </div>

        {/* Central Question Prompt / Cloze Exercise */}
        {prompt === 'cloze' && clozeData ? (
          <div className="my-6">
            <ClozeExerciseView
              data={clozeData}
              revealed={revealed}
              selectedIdx={selectedIdx}
              isCorrect={isCorrect}
              speech={speech}
              speechRate={settings.speechRate}
              onSelect={handleClozeAnswer}
            />
          </div>
        ) : (
          <div className="my-5 text-center sm:my-8">
            {prompt === 'audio' && (
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => speech.speak(item.speakAs ?? item.hanzi, settings.speechRate)}
                  className="flex h-24 w-24 items-center justify-center rounded-3xl bg-rose-500 text-white shadow-xl shadow-rose-500/25 transition active:scale-95 hover:bg-rose-600"
                  aria-label={t('study.replayAudio')}
                >
                  <Volume2 className="h-10 w-10 animate-pulse" />
                </button>
                <p className="mt-4 text-sm font-medium text-slate-500">
                  {t(trackOf(settings.course) === 'english' ? 'study.listen.definition' : 'study.listen.meaning')}
                </p>
              </div>
            )}

            {prompt === 'english' && (
              <div className="space-y-3">
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
                  {item.english.slice(0, 2).join('; ')}
                </div>
                <p className="text-sm text-slate-500">
                  {t(trackOf(settings.course) === 'english' ? 'study.pick.englishWord' : 'study.pick.character')}
                </p>
              </div>
            )}

            {(prompt === 'hanzi' || prompt === 'pinyin') && (
              <div className="space-y-3">
                {isChineseWord && allowFlip && prompt === 'hanzi' ? (
                  <div className="flex flex-col items-center">
                    {/* Adaptive Scaffold Pill if auto-triggered */}
                    {autoShowPinyin && (
                      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/80 px-3 py-1 text-xs font-semibold text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 shadow-sm animate-fade-in">
                        <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <span>
                          {isAdaptiveTriggered ? t('card.adaptiveScaffold', { count: failureCount }) : pinyinHelperMode === 'always' ? t('card.pinyinAlways') : t('card.newWordHint')}
                        </span>
                      </div>
                    )}

                    {/* Stumbled notice if 1 mistake and not yet auto-shown */}
                    {!autoShowPinyin && failureCount > 0 && (
                      <div className="mb-2 text-[11px] font-medium text-amber-600/90 dark:text-amber-400">
                        {t('card.stumbledNotice', { count: failureCount })}
                      </div>
                    )}

                    {/* 3D Flip Card */}
                    <div
                      className="flip-card-container group relative mx-auto w-full max-w-xs cursor-pointer select-none"
                      onClick={() => setIsFlipped((f) => !f)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setIsFlipped((f) => !f);
                        }
                      }}
                      title={isFlipped ? t('card.flipBackTitle') : t('card.flipTitle')}
                      aria-label={isFlipped ? t('card.ariaFlipped') : t('card.ariaFront')}
                    >
                      <div className={`flip-card-inner ${isFlipped ? 'is-flipped' : ''}`}>
                        {/* FRONT FACE: Chinese Symbol */}
                        <div className="flip-card-front flex min-h-[160px] flex-col items-center justify-center rounded-3xl border-2 border-slate-200/90 bg-gradient-to-b from-white to-slate-50 p-6 shadow-sm transition group-hover:border-rose-400 group-hover:shadow-md dark:border-slate-700 dark:from-slate-800/90 dark:to-slate-850 dark:group-hover:border-rose-500">
                          <div className="font-hanzi text-6xl font-bold tracking-wide text-slate-900 dark:text-slate-100 sm:text-7xl">
                            {item.hanzi}
                          </div>

                          {/* If autoShowPinyin is active, display the tone-accented pinyin subtitle on front */}
                          {autoShowPinyin && (
                            <div className="mt-2 text-xl font-bold text-rose-600 dark:text-rose-400">
                              <PinyinText item={item} color={settings.colorTones} />
                            </div>
                          )}

                        </div>

                        {/* BACK FACE: Pinyin, Tone Accents & Audio */}
                        <div className="flip-card-back flex min-h-[160px] flex-col items-center justify-center rounded-3xl border-2 border-rose-300 bg-rose-50/95 p-6 shadow-md dark:border-rose-800 dark:bg-rose-950/70">
                          <span className="font-hanzi text-lg font-medium text-rose-700/80 dark:text-rose-300/80">
                            {item.hanzi}
                          </span>
                          <div className="my-1 text-3xl font-bold text-rose-950 dark:text-rose-100 sm:text-4xl">
                            <PinyinText item={item} color={settings.colorTones} />
                          </div>
                          <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <AudioButton speech={speech} text={item.speakAs ?? item.hanzi} rate={settings.speechRate} />
                            <span className="text-xs text-rose-600 dark:text-rose-400">
                              {t('card.tapToFlipBack')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-2">
                      <AudioButton speech={speech} text={item.speakAs ?? item.hanzi} rate={settings.speechRate} />
                      <button
                        type="button"
                        onClick={() => setIsFlipped((f) => !f)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-xs hover:border-rose-300 hover:text-rose-600 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>
                          {isFlipped ? t('card.showHanziBtn') : t('card.peekPinyinBtn')}
                        </span>
                      </button>
                      <span className="text-sm text-slate-500">{t('card.whatMeans')}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={`${/[\u4e00-\u9fa5]/.test(item.hanzi) ? 'font-hanzi' : 'font-sans'} text-6xl font-bold tracking-wide text-slate-900 dark:text-slate-100 sm:text-7xl`}>
                      {item.hanzi}
                    </div>
                    {isChineseWord && autoShowPinyin && (
                      <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
                        <PinyinText item={item} color={settings.colorTones} />
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-2">
                      <AudioButton speech={speech} text={item.speakAs ?? item.hanzi} rate={settings.speechRate} />
                      <span className="text-sm text-slate-500">
                        {prompt === 'pinyin' ? t('card.typePinyin') : t('card.whatMeans')}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Multiple Choice Answers */}
        {(prompt === 'hanzi' || prompt === 'english' || prompt === 'audio') && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
            {options.map((opt, idx) => {
              const label = prompt === 'english' ? opt.hanzi : opt.english.slice(0, 2).join('; ');
              let btnStyle =
                'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-700/50';

              if (revealed) {
                if (idx === correctIndex) {
                  btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200 font-semibold';
                } else if (idx === selectedIdx) {
                  btnStyle = 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/40 dark:text-rose-200';
                } else {
                  btnStyle = 'opacity-40 border-slate-200 dark:border-slate-700';
                }
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={revealed}
                  onClick={() => handleAnswer(idx)}
                  className={`flex min-h-12 items-center justify-between rounded-2xl border-2 px-4 py-2.5 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${btnStyle}`}
                >
                  <span className={prompt === 'english' && /[\u4e00-\u9fa5]/.test(label) ? 'font-hanzi text-lg' : ''}>{label}</span>
                  <kbd className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                    {idx + 1}
                  </kbd>
                </button>
              );
            })}
          </div>
        )}

        {/* Pinyin Typing Input & Autocomplete */}
        {prompt === 'pinyin' && !revealed && (
          <div className="mt-4">
            <form onSubmit={handlePinyinSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                autoFocus
                value={pinyinInput}
                onChange={(e) => handlePinyinInputChange(e.target.value)}
                placeholder={t('card.pinyinPlaceholder')}
                className="w-full rounded-2xl border-2 border-slate-300 px-4 py-3 text-lg font-medium outline-none focus:border-rose-500 dark:border-slate-600 dark:bg-slate-800"
              />
              <button
                type="submit"
                className="rounded-2xl bg-slate-900 px-6 font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                {t('card.check')}
              </button>
            </form>
            <PinyinSuggestions item={item} value={pinyinInput} onSelect={setPinyinInput} />
          </div>
        )}

        {/* Revealed Details Breakdown */}
        {revealed && (
          <div className="mt-6 border-t border-slate-100 pt-6 dark:border-slate-700/60 animate-fade-in">
            {prompt === 'pinyin' && (
              <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100 dark:border-slate-700/60">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('card.pinyinCheckTitle')}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isCorrect
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {isCorrect ? `✓ ${t('card.correct')}` : `✗ ${t('card.needsPractice')}`}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('card.youTyped')}</div>
                    <div className="mt-1 font-mono text-xl">
                      {pinyinInput.trim() ? (
                        <PinyinDiffText typed={numberedToMarked(pinyinInput.trim())} target={item.pinyin} isCorrect={Boolean(isCorrect)} />
                      ) : (
                        <span className="font-sans text-sm italic text-slate-400">{t('card.noAnswer')}</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('card.targetPinyin')}</div>
                    <div className="mt-1 font-mono text-xl font-bold">
                      <FreePinyin text={item.pinyin} color={settings.colorTones} />
                    </div>
                  </div>
                </div>

                {pinyinCheck && !isCorrect && (
                  <div className="mt-3.5 space-y-1.5 border-t border-slate-100 pt-2.5 text-xs dark:border-slate-700/50">
                    {pinyinCheck.tonesWrong && (
                      <p className="flex items-start gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{t('card.tonesWrong')}</span>
                      </p>
                    )}
                    {pinyinCheck.umlautMissing && (
                      <p className="flex items-start gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{rich('card.umlautMissing', undefined, { strong: (text) => <strong>{text}</strong>, em: (text) => <em>{text}</em> })}</span>
                      </p>
                    )}
                    {!pinyinCheck.tonesWrong && !pinyinCheck.umlautMissing && pinyinInput.trim() && (
                      <p className="flex items-start gap-1.5 font-medium text-rose-600 dark:text-rose-400">
                        <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{t('card.spellingDiffers')}</span>
                      </p>
                    )}
                  </div>
                )}
                {pinyinCheck?.variant && (
                  <p className="mt-2 text-xs text-sky-700 dark:text-sky-300">
                    {t('card.variant', { pinyin: item.pinyin })}
                  </p>
                )}
              </div>
            )}
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className={`${/[\u4e00-\u9fa5]/.test(item.hanzi) ? 'font-hanzi' : 'font-sans'} text-3xl font-bold text-slate-900 dark:text-slate-100`}>
                  {item.hanzi}
                </span>
                <span className="text-lg font-medium text-slate-600 dark:text-slate-300">
                  <FreePinyin text={item.pinyin} color={settings.colorTones} />
                </span>
                <span className="text-sm text-slate-500">
                  {item.english.join('; ')}
                </span>
              </div>
              {item.definition && (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {item.abbr && <span className="mr-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-semibold dark:bg-slate-700">{item.abbr}</span>}
                  {item.definition}
                </p>
              )}

              {item.exampleSentence && (
                <div className="mt-3 border-t border-slate-200/60 pt-3 dark:border-slate-700/60">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-hanzi text-base text-slate-800 dark:text-slate-200">
                        {item.exampleSentence.hanzi}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        <FreePinyin text={item.exampleSentence.pinyin} color={settings.colorTones} />
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                        {item.exampleSentence.english}
                      </p>
                    </div>
                    <AudioButton speech={speech} text={item.exampleSentence.hanzi} rate={settings.speechRate} />
                  </div>
                </div>
              )}
            </div>

            {/* FSRS Rating Actions */}
            <div className="mt-6 space-y-3">
              {/* Primary Next Action */}
              <button
                type="button"
                onClick={() => submitGrade(suggestedGrade)}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 px-6 text-base font-bold text-white shadow-lg transition active:scale-[0.99] ${
                  isCorrect
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                }`}
              >
                <span>{isCorrect ? t('card.nextGood') : t('card.reviewAgain')}</span>
                <ArrowRight className="h-4 w-4" />
                <kbd className="ml-2 rounded bg-black/20 px-1.5 py-0.5 text-xs font-normal">{t('card.spaceEnter')}</kbd>
              </button>

              {/* FSRS 4-grade breakdown preview */}
              <div className="grid grid-cols-4 gap-2">
                {([1, 2, 3, 4] as Grade[]).map((g) => {
                  const days = nextInterval(dirProgress, g);
                  const isSuggested = g === suggestedGrade;

                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => submitGrade(g)}
                      className={`flex flex-col items-center rounded-xl border p-2 text-center transition ${
                        isSuggested
                          ? 'border-slate-400 bg-slate-100 font-semibold dark:border-slate-500 dark:bg-slate-700'
                          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="text-xs font-semibold">{t(`study.grade.${g}`)}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('common.interval.short', { days })}</div>
                      <kbd className="mt-1 text-[10px] text-slate-400">[{g}]</kbd>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!revealed && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleRevealWithoutAnswer}
              className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {t(prompt !== 'pinyin' ? 'card.revealAnswerKey' : 'card.revealAnswer')}
            </button>
          </div>
        )}
      </article>
    </div>
  );
}
