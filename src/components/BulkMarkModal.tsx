import { X, Check } from 'lucide-react';
import type { CourseId, HskLevel, UserState, VocabItem } from '../types';
import { levelLabel } from '../data/vocab';
import { bulkMarkLevelKnown } from '../utils/srsEngine';
import { trackOf } from '../data/courses';
import { parseDomainCourse } from '../data/domains';
import { useI18n } from '../i18n/react';
import { ModalFrame } from './ModalFrame';

interface Props {
  vocab: VocabItem[];
  state: UserState;
  isOpen: boolean;
  course?: CourseId;
  onClose: () => void;
  onUpdateState: (newState: UserState) => void;
}

export function BulkMarkModal({ vocab, state, isOpen, course = state.settings.course ?? 'chinese', onClose, onUpdateState }: Props) {
  const { t } = useI18n();
  if (!isOpen) return null;

  const isEnglish = trackOf(course) === 'english';
  const specialty = parseDomainCourse(course) !== null;
  // Only the levels the active course actually has (a specialty course has three tiers)
  const levels: HskLevel[] = ([1, 2, 3, 4, 5, 6] as HskLevel[]).filter((l) => vocab.some((v) => v.hskLevel === l));

  function isLevelFullyKnown(lvl: HskLevel): boolean {
    const words = vocab.filter((v) => v.hskLevel === lvl);
    if (!words.length) return false;
    return words.every((w) => state.progress[w.id]?.manuallyMarkedKnown);
  }

  function handleToggleLevel(lvl: HskLevel) {
    const currentlyKnown = isLevelFullyKnown(lvl);
    const updated = bulkMarkLevelKnown(state, vocab, lvl, !currentlyKnown);
    onUpdateState(updated);
  }

  return (
    <ModalFrame label={t('dashboard.bulkMark')} onClose={onClose} className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
          aria-label={t('common.close')}
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t(specialty ? 'bulk.title.tiers' : isEnglish ? 'bulk.title.english' : 'bulk.title.chinese')}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {t(specialty ? 'bulk.desc.tiers' : isEnglish ? 'bulk.desc.english' : 'bulk.desc.chinese')}
        </p>

        <div className="mt-6 space-y-2.5">
          {levels.map((lvl) => {
            const levelWords = vocab.filter((v) => v.hskLevel === lvl);
            const known = isLevelFullyKnown(lvl);
            const count = levelWords.length;

            return (
              <div
                key={lvl}
                className="flex items-center justify-between rounded-2xl border border-slate-200 p-3.5 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {levelLabel(lvl, course, t)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {t('dictionary.wordCount', { count })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleLevel(lvl)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      known
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {known ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> {t('bulk.markedKnown')}
                      </>
                    ) : (
                      t('bulk.markKnown')
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition"
          >
            {t('common.done')}
          </button>
        </div>
    </ModalFrame>
  );
}
