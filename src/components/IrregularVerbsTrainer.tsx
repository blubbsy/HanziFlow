import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Volume2,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  IRREGULAR_VERBS,
  type IrregularPattern,
  type IrregularVerb,
} from '../data/irregularVerbs';
import type { SpeechApi } from '../utils/speech';
import { SpeedControl } from './SpeedControl';
import type { MessageKey } from '../i18n';
import { useI18n } from '../i18n/react';

interface Props {
  speech: SpeechApi;
  onBack?: () => void;
}

type DrillMode = 'cards' | 'cloze' | 'browse';

const PATTERN_LABELS: Record<IrregularPattern, { label: MessageKey; desc: MessageKey; color: string }> = {
  AAA: {
    label: 'english.irregular.pattern.AAA.label',
    desc: 'english.irregular.pattern.AAA.desc',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  ABB: {
    label: 'english.irregular.pattern.ABB.label',
    desc: 'english.irregular.pattern.ABB.desc',
    color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  ABC: {
    label: 'english.irregular.pattern.ABC.label',
    desc: 'english.irregular.pattern.ABC.desc',
    color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  },
  ABA: {
    label: 'english.irregular.pattern.ABA.label',
    desc: 'english.irregular.pattern.ABA.desc',
    color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  },
};

export function IrregularVerbsTrainer({ speech, onBack }: Props) {
  const { t, rich } = useI18n();
  const [drillMode, setDrillMode] = useState<DrillMode>('cards');
  const [selectedPattern, setSelectedPattern] = useState<IrregularPattern | 'all'>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Cloze quiz state
  const [clozeAnswerState, setClozeAnswerState] = useState<{ selectedOption: string; isCorrect: boolean } | null>(null);

  const filteredVerbs = useMemo(() => {
    return IRREGULAR_VERBS.filter((v) => {
      const matchPattern = selectedPattern === 'all' || v.pattern === selectedPattern;
      const matchSearch =
        !searchQuery ||
        v.v1.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.v2.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.v3.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.meaningZh.includes(searchQuery);
      return matchPattern && matchSearch;
    });
  }, [selectedPattern, searchQuery]);

  const currentVerb: IrregularVerb | undefined = filteredVerbs[currentIndex] ?? filteredVerbs[0];

  function handleNext() {
    setRevealed(false);
    setClozeAnswerState(null);
    if (currentIndex < filteredVerbs.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  }

  function handlePrev() {
    setRevealed(false);
    setClozeAnswerState(null);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      setCurrentIndex(Math.max(0, filteredVerbs.length - 1));
    }
  }

  // Cloze exercise generator for current verb
  const clozeData = useMemo(() => {
    if (!currentVerb) return null;
    // Pick between past (V₂) or participle (V₃)
    const targetType: 'v2' | 'v3' = currentIndex % 2 === 0 ? 'v2' : 'v3';
    const targetWord = targetType === 'v2' ? currentVerb.v2 : currentVerb.v3;
    const exampleSentence = targetType === 'v2' ? currentVerb.exampleSentence.v2 : currentVerb.exampleSentence.v3;

    // Create sentence with gap
    const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(`\\b${escaped}\\b`, 'i');
    const sentenceWithGap = exampleSentence.replace(rx, '[ ____ ]');

    // Generate 3 distractors from other verbs
    const otherVerbs = IRREGULAR_VERBS.filter((v) => v.v1 !== currentVerb.v1);
    const distractors = otherVerbs
      .slice(0, 10)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map((v) => (targetType === 'v2' ? v.v2 : v.v3));

    // Also include base form as a tricky distractor if different
    if (currentVerb.v1 !== targetWord && distractors.length > 0) {
      distractors[0] = currentVerb.v1;
    }

    const options = Array.from(new Set([targetWord, ...distractors])).sort(() => 0.5 - Math.random());

    return {
      targetType,
      targetWord,
      sentenceWithGap,
      translation: currentVerb.exampleSentence.meaningZh,
      options,
    };
  }, [currentVerb, currentIndex]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-2 py-4 sm:px-4">
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              title={t('common.back')}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
              <Zap className="h-3 w-3" /> {t('english.irregular.badge')}
            </div>
            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
              {t('english.irregular.title')}
            </h1>
          </div>
        </div>

        {/* Drill Mode Switcher */}
        <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
          <button
            onClick={() => {
              setDrillMode('cards');
              setRevealed(false);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              drillMode === 'cards'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            {t('english.irregular.mode.cards')}
          </button>
          <button
            onClick={() => {
              setDrillMode('cloze');
              setClozeAnswerState(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              drillMode === 'cloze'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            {t('english.irregular.mode.cloze')}
          </button>
          <button
            onClick={() => setDrillMode('browse')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              drillMode === 'browse'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            {t('english.irregular.mode.browse')}
          </button>
        </div>
      </header>

      {/* Pattern Filter Bar */}
      <section className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500">{t('english.irregular.models')}</span>
        <button
          onClick={() => {
            setSelectedPattern('all');
            setCurrentIndex(0);
            setRevealed(false);
          }}
          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
            selectedPattern === 'all'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {t('english.irregular.allPatterns', { count: IRREGULAR_VERBS.length })}
        </button>

        {(['AAA', 'ABB', 'ABC', 'ABA'] as IrregularPattern[]).map((pat) => {
          const count = IRREGULAR_VERBS.filter((v) => v.pattern === pat).length;
          const active = selectedPattern === pat;
          return (
            <button
              key={pat}
              onClick={() => {
                setSelectedPattern(pat);
                setCurrentIndex(0);
                setRevealed(false);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition border ${
                active
                  ? 'border-rose-600 bg-rose-600 text-white shadow-sm'
                  : PATTERN_LABELS[pat].color
              }`}
            >
              {t('english.irregular.patternCount', { pattern: pat, count })}
            </button>
          );
        })}
      </section>

      {/* Mode 1: Three-Forms Card Drill */}
      {drillMode === 'cards' && currentVerb && (
        <section className="mx-auto max-w-2xl space-y-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {rich('english.irregular.progress', { current: currentIndex + 1, total: filteredVerbs.length }, { strong: (text) => <strong className="text-slate-900 dark:text-slate-100">{text}</strong> })}
            </span>
            <span className="inline-flex items-center gap-2">
              <SpeedControl speech={speech} variant="compact" />
              <span className="rounded-lg border px-2 py-0.5 font-semibold text-xs border-slate-200 dark:border-slate-700">
                {t(PATTERN_LABELS[currentVerb.pattern].label)}
              </span>
            </span>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            {/* Front: Prompt Base Verb */}
            <div className="p-8 text-center sm:p-12">
              <span className="text-xs uppercase tracking-widest text-slate-500">{t('english.irregular.baseForm')}</span>
              <div className="mt-2 flex items-center justify-center gap-3">
                <h2 className="text-4xl font-black text-slate-900 dark:text-slate-100 sm:text-5xl">
                  {currentVerb.v1}
                </h2>
                <button
                  onClick={() => speech.speak(currentVerb.v1)}
                  className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
                  title={t('topics.listen')}
                >
                  <Volume2 className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-base font-medium text-slate-500">{currentVerb.ipaV1}</p>
              <div className="mt-4 text-xl font-bold text-rose-600 dark:text-rose-400">
                {currentVerb.meaningZh}
              </div>

              {!revealed ? (
                <div className="mt-8">
                  <button
                    onClick={() => setRevealed(true)}
                    className="rounded-2xl bg-slate-900 px-8 py-3.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  >
                    {t('english.irregular.reveal')}
                  </button>
                </div>
              ) : (
                /* Revealed Forms */
                <div className="mt-8 space-y-6 border-t border-slate-100 pt-6 animate-fade-in dark:border-slate-700">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Past Form V2 */}
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-left dark:border-amber-900/40 dark:bg-amber-950/20">
                      <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
                        <span>{t('english.irregular.past')}</span>
                        <button
                          onClick={() => speech.speak(currentVerb.v2)}
                          className="text-amber-700 hover:text-amber-900 dark:text-amber-300"
                        >
                          <Volume2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                        {currentVerb.v2}
                      </div>
                      <div className="text-xs text-slate-500">{currentVerb.ipaV2}</div>
                      <div className="mt-2 text-xs italic text-slate-600 dark:text-slate-300">
                        {t('common.quote', { text: currentVerb.exampleSentence.v2 })}
                      </div>
                    </div>

                    {/* Past Participle V3 */}
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-left dark:border-emerald-900/40 dark:bg-emerald-950/20">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        <span>{t('english.irregular.participle')}</span>
                        <button
                          onClick={() => speech.speak(currentVerb.v3)}
                          className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300"
                        >
                          <Volume2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                        {currentVerb.v3}
                      </div>
                      <div className="text-xs text-slate-500">{currentVerb.ipaV3}</div>
                      <div className="mt-2 text-xs italic text-slate-600 dark:text-slate-300">
                        {t('common.quote', { text: currentVerb.exampleSentence.v3 })}
                      </div>
                    </div>
                  </div>

                  {/* Pattern Advice */}
                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900/50 dark:text-slate-400">
                    <Sparkles className="mr-1 inline-block h-3.5 w-3.5 text-amber-500" />
                    <strong>{t('english.irregular.advice')}</strong> {t(PATTERN_LABELS[currentVerb.pattern].desc)}
                  </div>
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-700/60 dark:bg-slate-900/50">
              <button
                onClick={handlePrev}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {t('english.irregular.prev')}
              </button>
              <button
                onClick={handleNext}
                className="rounded-xl bg-rose-600 px-6 py-2 text-xs font-bold text-white hover:bg-rose-700 shadow-sm"
              >
                {t('english.irregular.next')}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Mode 2: Sentence Cloze Drill */}
      {drillMode === 'cloze' && clozeData && currentVerb && (
        <section className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {rich('english.irregular.questions', { current: currentIndex + 1, total: filteredVerbs.length }, { strong: (text) => <strong className="text-slate-900 dark:text-slate-100">{text}</strong> })}
            </span>
            <span>
              {rich(
                'english.irregular.target',
                { form: t(clozeData.targetType === 'v2' ? 'english.irregular.formV2' : 'english.irregular.formV3') },
                { strong: (text) => <strong className="text-rose-600 dark:text-rose-400">{text}</strong> },
              )}
            </span>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('english.irregular.choose')}
            </div>

            <div className="mt-4 text-center">
              <span className="rounded-lg bg-rose-50 px-3 py-1 text-sm font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                {t('english.irregular.baseVerb', { verb: currentVerb.v1, meaning: currentVerb.meaningZh })}
              </span>
            </div>

            {/* Sentence gap */}
            <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center text-lg font-bold text-slate-900 dark:bg-slate-900/50 dark:text-slate-100 sm:text-xl">
              {clozeData.sentenceWithGap}
            </div>
            <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
              {clozeData.translation}
            </p>

            {/* Options Small Cards */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {clozeData.options.map((opt, idx) => {
                const isSelected = clozeAnswerState?.selectedOption === opt;
                const isTarget = opt === clozeData.targetWord;
                const answered = clozeAnswerState !== null;

                let cardStyle =
                  'border-slate-200 bg-white text-slate-800 hover:border-rose-400 hover:bg-rose-50/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

                if (answered) {
                  if (isTarget) {
                    cardStyle =
                      'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold';
                  } else if (isSelected && !isTarget) {
                    cardStyle =
                      'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300';
                  } else {
                    cardStyle = 'opacity-40 border-slate-200 bg-slate-50 dark:bg-slate-900';
                  }
                }

                return (
                  <button
                    key={opt}
                    disabled={answered}
                    onClick={() => {
                      const correct = opt === clozeData.targetWord;
                      setClozeAnswerState({ selectedOption: opt, isCorrect: correct });
                      if (correct) {
                        speech.speak(opt);
                      }
                    }}
                    className={`flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-all ${cardStyle}`}
                  >
                    <span className="text-xs font-semibold text-slate-500">[{idx + 1}]</span>
                    <span className="mt-1 text-base font-bold">{opt}</span>
                  </button>
                );
              })}
            </div>

            {/* Feedback and Continue */}
            {clozeAnswerState && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5 animate-fade-in dark:border-slate-700">
                <div className="flex items-center gap-2">
                  {clozeAnswerState.isCorrect ? (
                    <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-5 w-5" /> {t('grammar.exercise.correct')}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-sm font-bold text-rose-600 dark:text-rose-400">
                      <XCircle className="h-5 w-5" /> {t('english.irregular.wrong', { answer: clozeData.targetWord })}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleNext}
                  className="rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  {t('english.irregular.nextQuestion')}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Mode 3: Categorized Dictionary Reference */}
      {drillMode === 'browse' && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('english.irregular.search')}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full min-w-[680px] text-left text-xs sm:text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3.5 font-bold">{t('english.irregular.col.pattern')}</th>
                  <th className="px-4 py-3.5 font-bold">{t('english.irregular.col.base')}</th>
                  <th className="px-4 py-3.5 font-bold">{t('english.irregular.col.past')}</th>
                  <th className="px-4 py-3.5 font-bold">{t('english.irregular.col.participle')}</th>
                  <th className="px-4 py-3.5 font-bold">{t('english.irregular.col.meaning')}</th>
                  <th className="px-4 py-3.5 font-bold">{t('english.irregular.col.pronunciation')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredVerbs.map((v) => (
                  <tr key={v.v1} className="hover:bg-slate-50/50 dark:hover:bg-slate-750">
                    <td className="px-4 py-3">
                      <span className="rounded-md px-2 py-0.5 text-xs font-bold font-mono border border-slate-200 dark:border-slate-700">
                        {v.pattern}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                      <div>{v.v1}</div>
                      <div className="text-xs text-slate-500 font-normal">{v.ipaV1}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-amber-700 dark:text-amber-400">
                      <div>{v.v2}</div>
                      <div className="text-xs text-slate-500 font-normal">{v.ipaV2}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-700 dark:text-emerald-400">
                      <div>{v.v3}</div>
                      <div className="text-xs text-slate-500 font-normal">{v.ipaV3}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                      {v.meaningZh}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => speech.speak(`${v.v1}, ${v.v2}, ${v.v3}`)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                        title={t('english.irregular.speakAll')}
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
