import { useState, useMemo } from 'react';
import { X, Award, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import type { CourseId, HskLevel, VocabItem } from '../types';
import { levelLabel } from '../data/vocab';
import { useI18n } from '../i18n/react';
import { ModalFrame } from './ModalFrame';

interface Props {
  vocab: VocabItem[];
  isOpen: boolean;
  course?: CourseId;
  onClose: () => void;
  onComplete: (estimatedLevel: HskLevel, markLevelsKnown: HskLevel[]) => void;
}

interface Question {
  item: VocabItem;
  level: HskLevel;
  options: string[];
  correctIndex: number;
}

const TOTAL_QUESTIONS = 15;

export function PlacementTestModal({ vocab, isOpen, course = 'chinese', onClose, onComplete }: Props) {
  const { t, formatList } = useI18n();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentLevel, setCurrentLevel] = useState<HskLevel>(2);
  const [history, setHistory] = useState<{ level: HskLevel; correct: boolean }[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // Group vocabulary by level for quick selection
  const vocabByLevel = useMemo(() => {
    const map = new Map<HskLevel, VocabItem[]>();
    for (let l = 1; l <= 7; l++) {
      map.set(l as HskLevel, vocab.filter((v) => v.hskLevel === l));
    }
    return map;
  }, [vocab]);

  // Generate question for the active question index and current level
  const question: Question | null = useMemo(() => {
    if (!isOpen || isFinished) return null;
    const pool = vocabByLevel.get(currentLevel) ?? [];
    if (!pool.length) return null;

    // Pick a random word from the pool
    const target = pool[Math.floor(Math.random() * pool.length)];
    const targetMeaning = target.english[0] || 'meaning';

    // Pick 3 distractors from the same level
    const otherPool = pool.filter((v) => v.id !== target.id);
    const distractors: string[] = [];
    const used = new Set<string>([targetMeaning]);

    while (distractors.length < 3 && otherPool.length > 0) {
      const cand = otherPool[Math.floor(Math.random() * otherPool.length)];
      const m = cand.english[0];
      if (m && !used.has(m)) {
        distractors.push(m);
        used.add(m);
      }
    }

    const options = [...distractors, targetMeaning].sort(() => Math.random() - 0.5);
    const correctIndex = options.indexOf(targetMeaning);

    return {
      item: target,
      level: currentLevel,
      options,
      correctIndex,
    };
  }, [isOpen, isFinished, currentIndex, currentLevel, vocabByLevel]);

  // Calculate placement result when done
  const estimatedLevel: HskLevel = useMemo(() => {
    if (!history.length) return 1;
    // Calculate passing levels (at least 60% accuracy at that level tested)
    const levelStats = new Map<HskLevel, { correct: number; total: number }>();
    for (const h of history) {
      const cur = levelStats.get(h.level) ?? { correct: 0, total: 0 };
      cur.total++;
      if (h.correct) cur.correct++;
      levelStats.set(h.level, cur);
    }

    let highestPassed: HskLevel = 1;
    for (let l = 1; l <= 6; l++) {
      const s = levelStats.get(l as HskLevel);
      if (s && s.total >= 1 && s.correct / s.total >= 0.6) {
        highestPassed = Math.max(highestPassed, l) as HskLevel;
      }
    }
    // Estimated starting level is the next level after highest passed
    return Math.min(6, highestPassed + 1) as HskLevel;
  }, [history]);

  const priorLevelsToMark: HskLevel[] = useMemo(() => {
    const list: HskLevel[] = [];
    for (let l = 1; l < estimatedLevel; l++) {
      list.push(l as HskLevel);
    }
    return list;
  }, [estimatedLevel]);

  if (!isOpen) return null;

  function handleSelect(optionIdx: number) {
    if (answered || !question) return;
    setSelectedOption(optionIdx);
    setAnswered(true);

    const isCorrect = optionIdx === question.correctIndex;
    const newHistory = [...history, { level: question.level, correct: isCorrect }];
    setHistory(newHistory);

    // Adaptive step: move up if correct, move down if incorrect
    let nextLevel = currentLevel;
    if (isCorrect) {
      nextLevel = Math.min(6, currentLevel + 1) as HskLevel;
    } else {
      nextLevel = Math.max(1, currentLevel - 1) as HskLevel;
    }

    setTimeout(() => {
      if (currentIndex + 1 >= TOTAL_QUESTIONS) {
        setIsFinished(true);
      } else {
        setCurrentLevel(nextLevel);
        setCurrentIndex((i) => i + 1);
        setSelectedOption(null);
        setAnswered(false);
      }
    }, 600);
  }

  function handleApplyPlacement(markKnown: boolean) {
    onComplete(estimatedLevel, markKnown ? priorLevelsToMark : []);
    onClose();
  }

  return (
    <ModalFrame label={t('dashboard.placementTest')} onClose={onClose} className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
          aria-label={t('common.close')}
        >
          <X className="h-5 w-5" />
        </button>

        {!isFinished ? (
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-rose-500" /> {t('placement.title')}
              </span>
              <span>
                {currentIndex + 1} / {TOTAL_QUESTIONS}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-rose-500 transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / TOTAL_QUESTIONS) * 100}%` }}
              />
            </div>

            {question && (
              <div className="mt-8 text-center">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {t('placement.testing', { level: levelLabel(question.level, course, t) })}
                </span>

                <div className={`my-6 text-6xl font-bold tracking-wide text-slate-900 dark:text-slate-100 ${
                  /[\u4e00-\u9fa5]/.test(question.item.hanzi) ? 'font-hanzi' : 'font-sans'
                }`}>
                  {question.item.hanzi}
                </div>

                <p className="mb-6 text-sm text-slate-500">{t('placement.question')}</p>

                <div className="grid grid-cols-1 gap-2.5 text-left">
                  {question.options.map((opt, idx) => {
                    let style =
                      'border-slate-200 hover:border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700/50';

                    if (answered) {
                      if (idx === question.correctIndex) {
                        style = 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200';
                      } else if (idx === selectedOption) {
                        style = 'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200';
                      } else {
                        style = 'opacity-40 border-slate-200 dark:border-slate-700';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        disabled={answered}
                        onClick={() => handleSelect(idx)}
                        className={`flex items-center justify-between rounded-2xl border-2 px-4 py-3.5 text-sm font-medium transition ${style}`}
                      >
                        <span>{opt}</span>
                        <span className="text-xs text-slate-500">{idx + 1}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
              <Award className="h-8 w-8" />
            </div>

            <h3 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {t('placement.recommended', { level: levelLabel(estimatedLevel, course, t) })}
            </h3>

            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {estimatedLevel > 1
                ? t('placement.basis', { level: levelLabel(estimatedLevel - 1, course, t) })
                : t('placement.basisBeginner')}
            </p>

            {priorLevelsToMark.length > 0 && (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-left dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" /> {t('placement.skip.title')}
                </div>
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                  {t('placement.skip.desc', { levels: formatList(priorLevelsToMark.map((l) => levelLabel(l, course, t))), start: levelLabel(estimatedLevel, course, t) })}
                </p>
              </div>
            )}

            <div className="mt-6 space-y-2.5">
              {priorLevelsToMark.length > 0 && (
                <button
                  onClick={() => handleApplyPlacement(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 font-semibold text-white shadow-lg shadow-rose-600/20 hover:bg-rose-700 transition"
                >
                  {t('placement.markAndStart', { levels: formatList(priorLevelsToMark.map((l) => levelLabel(l, course, t))) })}
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}

              <button
                onClick={() => handleApplyPlacement(false)}
                className="w-full rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition"
              >
                {t('placement.keepNew')}
              </button>
            </div>
          </div>
        )}
    </ModalFrame>
  );
}
