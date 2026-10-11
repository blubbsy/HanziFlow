import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Delete, Keyboard, RotateCcw, Trophy, X } from 'lucide-react';
import { AudioButton } from '../components/AudioButton';
import { SpeedControl } from '../components/SpeedControl';
import { useI18n } from '../i18n/react';
import type { SpeechApi } from '../utils/speech';
import { PASS_RATIO } from './grammarStorage';
import type { GrammarExercise, GrammarPoint, OptionExercise, OrderExercise } from './types';
import { ProgressBar, RichText, Zh, card, focusRing, primaryBtn, secondaryBtn } from './ui';

interface Props {
  point: GrammarPoint;
  speech: SpeechApi;
  speechRate: number;
  /** Called once when the last exercise has been answered. */
  onFinish: (correct: number, total: number) => void;
  onExit: () => void;
}

type Phase = 'answering' | 'feedback' | 'done';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffled index permutation that differs from the identity when possible (so the answer isn't always where authored). */
function permutation(n: number): number[] {
  const id = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return id;
  for (let tries = 0; tries < 5; tries++) {
    const p = shuffle(id);
    if (p.some((v, i) => v !== i)) return p;
  }
  return [...id.slice(1), id[0]];
}

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

function orderIsCorrect(ex: OrderExercise, picked: string[]): boolean {
  const accepted = [ex.tokens, ...(ex.alternatives ?? [])];
  return accepted.some((a) => a.length === picked.length && a.every((t, i) => t === picked[i]));
}

/** Text of the studied language worth reading aloud after answering. */
function speakableAnswer(ex: GrammarExercise, joiner: string): string | null {
  switch (ex.type) {
    case 'order':
      return ex.tokens.join(joiner);
    case 'choice':
      return ex.sentence.includes('___') && ex.sentence !== '___'
        ? ex.sentence.replace('___', ex.options[ex.answer])
        : ex.options[ex.answer];
    case 'translate':
      return ex.optionScript === 'hanzi' ? ex.options[ex.answer] : null;
    case 'error':
      return null;
  }
}

export function ExercisePlayer({ point, speech, onFinish, onExit }: Props) {
  const { t } = useI18n();
  const exercises = point.exercises;
  const english = point.track === 'english';
  const [run, setRun] = useState(0);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>(exercises.length ? 'answering' : 'done');
  const [results, setResults] = useState<boolean[]>([]);
  // option exercises: selected display index; order exercises: picked bank indices
  const [selected, setSelected] = useState<number | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [lastCorrect, setLastCorrect] = useState(false);

  const ex = exercises[idx] as GrammarExercise | undefined;
  // New shuffle per exercise and per run.
  const perm = useMemo(() => {
    if (!ex) return [];
    return permutation(ex.type === 'order' ? ex.tokens.length : ex.options.length);
  }, [ex, run]);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (phase === 'answering') headingRef.current?.focus({ preventScroll: false });
    if (phase === 'feedback') continueRef.current?.focus();
  }, [phase, idx, run]);

  const orderTokens = ex?.type === 'order' ? perm.map((i) => ex.tokens[i]) : [];
  const canCheck =
    phase === 'answering' && !!ex && (ex.type === 'order' ? picked.length === ex.tokens.length : selected !== null);

  const check = useCallback(() => {
    if (!ex || !canCheck) return;
    const correct =
      ex.type === 'order' ? orderIsCorrect(ex, picked.map((i) => orderTokens[i])) : perm[selected ?? -1] === ex.answer;
    setLastCorrect(correct);
    setResults((r) => [...r, correct]);
    setPhase('feedback');
  }, [ex, canCheck, picked, orderTokens, perm, selected]);

  const next = useCallback(() => {
    if (phase !== 'feedback') return;
    if (idx + 1 < exercises.length) {
      setIdx(idx + 1);
      setSelected(null);
      setPicked([]);
      setPhase('answering');
    } else {
      setPhase('done');
      if (!finishedRef.current) {
        finishedRef.current = true;
        onFinish(results.filter(Boolean).length, exercises.length);
      }
    }
  }, [phase, idx, exercises.length, onFinish, results]);

  const restart = () => {
    finishedRef.current = false;
    setRun((r) => r + 1);
    setIdx(0);
    setResults([]);
    setSelected(null);
    setPicked([]);
    setPhase(exercises.length ? 'answering' : 'done');
  };

  const pickToken = useCallback(
    (bankIndex: number) => setPicked((p) => (p.includes(bankIndex) ? p : [...p, bankIndex])),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target) || !ex) return;
      if (e.key === 'Enter') {
        if (phase === 'answering' && canCheck) {
          e.preventDefault();
          check();
        } else if (phase === 'feedback') {
          e.preventDefault();
          next();
        }
        return;
      }
      if (phase !== 'answering') return;
      if (/^[1-9]$/.test(e.key)) {
        const n = Number(e.key) - 1;
        if (ex.type === 'order') {
          if (n < ex.tokens.length) {
            e.preventDefault();
            pickToken(n);
          }
        } else if (n < ex.options.length) {
          e.preventDefault();
          setSelected(n);
        }
      } else if (e.key === 'Backspace' && ex.type === 'order') {
        e.preventDefault();
        setPicked((p) => p.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ex, phase, canCheck, check, next, pickToken]);

  if (phase === 'done' || !ex) {
    const correct = results.filter(Boolean).length;
    const total = exercises.length;
    const ratio = total ? correct / total : 0;
    const passed = ratio >= PASS_RATIO;
    return (
      <section className={`${card} animate-pop p-5 text-center sm:p-8`} aria-labelledby="gx-result">
        <div
          className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full ${
            passed ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'
          }`}
        >
          {passed ? <Trophy className="h-7 w-7" aria-hidden /> : <RotateCcw className="h-7 w-7" aria-hidden />}
        </div>
        <h3 id="gx-result" className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t('grammar.exercise.result', { correct, total })}
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {passed
            ? t('grammar.exercise.passed', { pct: Math.round(ratio * 100) })
            : t('grammar.exercise.failed', { pct: Math.round(ratio * 100), needed: Math.round(PASS_RATIO * 100) })}
        </p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <button type="button" className={secondaryBtn} onClick={restart}>
            <RotateCcw className="h-4 w-4" aria-hidden /> {t('grammar.lesson.practiceAgain')}
          </button>
          <button type="button" className={primaryBtn} onClick={onExit} autoFocus>
            {t('grammar.lesson.backToLesson')}
          </button>
        </div>
      </section>
    );
  }

  const speakText = phase === 'feedback' ? speakableAnswer(ex, english ? ' ' : '') : null;

  return (
    <section className={`${card} p-4 sm:p-6`} aria-label={t('grammar.exercise.practiceAria', { title: point.title })}>
      <div className="mb-4 flex items-center gap-3">
        <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
          {idx + 1} / {exercises.length}
        </span>
        <ProgressBar value={(idx + (phase === 'feedback' ? 1 : 0)) / exercises.length} label={t('grammar.exercise.progress')} />
        <button type="button" onClick={onExit} className={`shrink-0 rounded-lg p-1.5 text-slate-500 hover:text-rose-600 ${focusRing}`} aria-label={t('grammar.exercise.quit')}>
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <h3 ref={headingRef} tabIndex={-1} className="mb-3 text-base font-semibold text-slate-900 outline-none dark:text-slate-100">
        <Zh text={ex.prompt} />
      </h3>

      {ex.type === 'order' ? (
        <OrderBody
          ex={ex}
          bank={orderTokens}
          picked={picked}
          locked={phase !== 'answering'}
          english={english}
          onPick={pickToken}
          onRemove={(pos) => setPicked((p) => p.filter((_, i) => i !== pos))}
          onClear={() => setPicked([])}
        />
      ) : (
        <OptionBody ex={ex} perm={perm} selected={selected} phase={phase} english={english} onSelect={setSelected} />
      )}

      {phase === 'answering' ? (
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
            <Keyboard className="h-3.5 w-3.5" aria-hidden />
            {ex.type === 'order' ? t('grammar.exercise.keysOrder') : t('grammar.exercise.keysChoose', { max: ex.options.length })}
          </p>
          <button type="button" className={`${primaryBtn} w-full sm:w-auto`} disabled={!canCheck} onClick={check}>
            {t('grammar.exercise.check')}
          </button>
        </div>
      ) : (
        <div
          role="status"
          aria-live="polite"
          className={`mt-5 animate-pop rounded-2xl border p-4 ${
            lastCorrect
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
              : 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
          }`}
        >
          <p className={`flex items-center gap-2 font-semibold ${lastCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
            {lastCorrect ? <Check className="h-5 w-5" aria-hidden /> : <X className="h-5 w-5" aria-hidden />}
            {lastCorrect ? t('grammar.exercise.correct') : t('grammar.exercise.notQuite')}
          </p>
          {ex.type === 'order' && (
            <div className="mt-2 text-slate-800 dark:text-slate-200">
              <p lang={english ? 'en' : 'zh-CN'} className={english ? 'text-lg' : 'font-hanzi text-lg'}>
                {ex.tokens.join(english ? ' ' : '')}
              </p>
              {ex.pinyin && <p className="text-sm text-slate-500 dark:text-slate-400">{ex.pinyin}</p>}
            </div>
          )}
          {ex.type !== 'order' && !lastCorrect && (
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              {ex.type === 'error' ? t('grammar.exercise.wrongSentence') : t('grammar.exercise.answer')}{' '}
              <span className={english || (ex.type === 'translate' && ex.optionScript === 'pinyin') ? 'font-medium' : 'font-hanzi text-base font-medium'}>
                <Zh text={ex.options[ex.answer]} />
              </span>
            </p>
          )}
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            <RichText text={ex.explanation} />
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {speakText ? (
              <span className="inline-flex items-center gap-2">
                <AudioButton speech={speech} text={speakText} />
                <SpeedControl speech={speech} variant="compact" />
              </span>
            ) : (
              <span />
            )}
            <button ref={continueRef} type="button" className={primaryBtn} onClick={next}>
              {idx + 1 < exercises.length ? t('grammar.exercise.continue') : t('grammar.exercise.seeResults')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function OptionBody({
  ex,
  perm,
  selected,
  phase,
  english,
  onSelect,
}: {
  ex: OptionExercise;
  perm: number[];
  selected: number | null;
  phase: Phase;
  english: boolean;
  onSelect: (i: number) => void;
}) {
  const { t } = useI18n();
  const answered = phase !== 'answering';
  const sentenceMode = ex.type === 'error' || (ex.type === 'translate' && ex.optionScript === 'hanzi');
  const pinyinOpts = ex.type === 'translate' && ex.optionScript === 'pinyin';
  const filled = selected !== null ? ex.options[perm[selected]] : null;
  const script = english ? 'text-lg' : 'font-hanzi text-lg';
  const scriptLang = english ? 'en' : 'zh-CN';

  return (
    <div>
      {ex.type === 'choice' && ex.sentence !== '___' && (
        <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
          <p lang={scriptLang} className={`${english ? 'text-xl' : 'font-hanzi text-2xl'} leading-relaxed text-slate-900 dark:text-slate-100`}>
            {ex.sentence.split('___').map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && (
                  <span
                    className={`mx-1 inline-block min-w-[2.5em] border-b-2 px-1 text-center ${
                      answered ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300' : filled ? 'border-rose-500 text-rose-700 dark:text-rose-300' : 'border-slate-400'
                    }`}
                  >
                    {answered ? ex.options[ex.answer] : filled ?? ' '}
                  </span>
                )}
              </span>
            ))}
          </p>
          {ex.english && <p lang={english ? 'zh-CN' : undefined} className="mt-1 text-sm text-slate-500 dark:text-slate-400">{ex.english}</p>}
        </div>
      )}
      {ex.type === 'choice' && ex.sentence === '___' && ex.english && (
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{ex.english}</p>
      )}
      {ex.type === 'translate' && (
        <p lang={english ? 'zh-CN' : undefined} className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-lg font-medium text-slate-900 dark:bg-slate-800/60 dark:text-slate-100">
          “{ex.english}”
        </p>
      )}

      {/* Choice fill-the-gap uses small cards */}
      {ex.type === 'choice' ? (
        <div>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{t('grammar.exercise.selectCard')}</p>
          <div role="radiogroup" aria-label={t('grammar.exercise.answerCards')} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {perm.map((orig, i) => {
              const isSel = selected === i;
              const isAnswer = orig === ex.answer;
              let cardTone =
                'border-slate-200 bg-white text-slate-800 shadow-sm hover:border-rose-400 hover:bg-rose-50/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-rose-700';
              if (!answered && isSel)
                cardTone = 'border-rose-500 bg-rose-50 text-rose-800 ring-2 ring-rose-400/40 shadow dark:bg-rose-950/60 dark:text-rose-100';
              if (answered && isAnswer)
                cardTone = 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-400/30 shadow dark:bg-emerald-950/60 dark:text-emerald-100 font-bold';
              else if (answered && isSel)
                cardTone = 'border-rose-500 bg-rose-50 text-rose-900 line-through decoration-rose-400 dark:bg-rose-950/40 dark:text-rose-100';
              else if (answered)
                cardTone = 'border-slate-200 bg-white opacity-40 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400';

              return (
                <button
                  key={`${orig}-${i}`}
                  type="button"
                  role="radio"
                  aria-checked={isSel}
                  disabled={answered}
                  onClick={() => onSelect(i)}
                  className={`group relative flex flex-col items-center justify-center rounded-xl border-2 px-3 py-3 text-center transition-all duration-150 active:scale-95 disabled:cursor-default ${cardTone} ${focusRing}`}
                >
                  <span className="absolute top-1.5 left-2 rounded bg-slate-100 px-1.5 py-0.2 text-xs font-semibold text-slate-500 group-hover:bg-rose-100 group-hover:text-rose-700 dark:bg-slate-750 dark:text-slate-400" aria-hidden>
                    {i + 1}
                  </span>
                  <span className={`mt-1 ${script}`} lang={scriptLang}>
                    {ex.options[orig]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div role="radiogroup" aria-label={t('grammar.exercise.answerOptions')} className={`grid gap-2 ${sentenceMode || pinyinOpts ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {perm.map((orig, i) => {
            const isSel = selected === i;
            const isAnswer = orig === ex.answer;
            let tone =
              'border-slate-200 bg-white text-slate-800 hover:border-rose-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-rose-700';
            if (!answered && isSel) tone = 'border-rose-500 bg-rose-50 text-rose-800 ring-1 ring-rose-500 dark:bg-rose-950/40 dark:text-rose-100';
            if (answered && isAnswer)
              tone =
                ex.type === 'error'
                  ? 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                  : 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100';
            else if (answered && isSel) tone = 'border-rose-500 bg-rose-50 text-rose-900 line-through decoration-rose-400 dark:bg-rose-950/40 dark:text-rose-100';
            else if (answered) tone = 'border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400';
            return (
              <button
                key={`${orig}-${i}`}
                type="button"
                role="radio"
                aria-checked={isSel}
                disabled={answered}
                onClick={() => onSelect(i)}
                className={`flex min-h-[3rem] items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-default ${tone} ${focusRing}`}
              >
                <kbd className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-300 text-xs dark:border-slate-600 font-medium opacity-60" aria-hidden>
                  {i + 1}
                </kbd>
                <span className={pinyinOpts ? 'text-base' : script} lang={pinyinOpts ? undefined : scriptLang}>
                  {ex.options[orig]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OrderBody({
  ex,
  bank,
  picked,
  locked,
  english,
  onPick,
  onRemove,
  onClear,
}: {
  ex: OrderExercise;
  bank: string[];
  picked: number[];
  locked: boolean;
  english: boolean;
  onPick: (bankIndex: number) => void;
  onRemove: (position: number) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const script = english ? 'text-lg' : 'font-hanzi text-lg';
  const scriptLang = english ? 'en' : 'zh-CN';
  return (
    <div>
      <p lang={english ? 'zh-CN' : undefined} className="mb-3 rounded-xl bg-slate-50 px-4 py-3 text-base font-medium text-slate-900 dark:bg-slate-800/60 dark:text-slate-100">
        “{ex.english}”
      </p>
      <div
        aria-label={t('grammar.exercise.yourSentence')}
        className={`flex min-h-[3.75rem] flex-wrap items-center gap-2 rounded-xl border-2 border-dashed p-2 ${
          locked ? 'border-slate-200 dark:border-slate-700' : 'border-slate-300 dark:border-slate-600'
        }`}
      >
        {picked.length === 0 && <span className="px-2 text-sm text-slate-500">{t('grammar.exercise.tapWords')}</span>}
        {picked.map((b, pos) => (
          <button
            key={`${b}-${pos}`}
            type="button"
            disabled={locked}
            onClick={() => onRemove(pos)}
            aria-label={t('grammar.exercise.remove', { word: bank[b] })}
            className={`animate-pop rounded-lg bg-rose-600 px-3 py-1.5 ${script} text-white disabled:bg-slate-600 dark:disabled:bg-slate-700 ${focusRing}`}
            lang={scriptLang}
          >
            {bank[b]}
          </button>
        ))}
        {!locked && picked.length > 0 && (
          <button type="button" onClick={onClear} className={`ml-auto rounded-lg p-1.5 text-slate-500 hover:text-rose-600 ${focusRing}`} aria-label={t('grammar.exercise.clear')}>
            <Delete className="h-5 w-5" aria-hidden />
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2" aria-label={t('grammar.exercise.wordBank')}>
        {bank.map((token, i) => {
          const used = picked.includes(i);
          return (
            <button
              key={`${token}-${i}`}
              type="button"
              disabled={locked || used}
              onClick={() => onPick(i)}
              aria-label={t('grammar.exercise.wordKey', { word: token, n: i + 1 })}
              className={`relative rounded-lg border px-3 py-1.5 ${script} transition ${
                used
                  ? 'border-dashed border-slate-200 text-transparent dark:border-slate-700'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-rose-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
              } ${focusRing}`}
              lang={scriptLang}
            >
              {token}
              {!used && !locked && i < 9 && (
                <span className="absolute -right-1 -top-1.5 rounded bg-slate-100 px-1 font-sans text-xs leading-4 text-slate-500 dark:bg-slate-800 dark:text-slate-400" aria-hidden>
                  {i + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
