import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import type { CourseId, UserState } from '../types';
import { DOMAIN_FAMILIES, DOMAINS, FAMILY_ICON, domainCourseId, domainName, type DomainInfo } from '../data/domains';
import { courseVars, getCourseConfig, languageCourses, specialtyCourses } from '../data/courses';
import { isWordLearned } from '../utils/srsEngine';
import { useI18n } from '../i18n/react';

interface Props {
  state: UserState;
  activeCourse: CourseId;
  onSelect: (course: CourseId) => void;
  /** Specialty courses currently in the daily mix, and the toggle for one of them. */
  mix: CourseId[];
  onToggleMix: (course: CourseId) => void;
  onClose: () => void;
}

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400';

/**
 * The one place to see, switch and start courses: the two language courses, every specialty course
 * the learner has started, and the catalogue of specialty fields. Progress is never lost by switching.
 */
export function CourseSwitcher({ state, activeCourse, onSelect, mix, onToggleMix, onClose }: Props) {
  const { t, lang, formatNumber } = useI18n();
  const [query, setQuery] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const name = (d: DomainInfo) => domainName(d, lang);

  /** Words learned per course; `null` = never started. The active course lives in the flat `state.progress`. */
  const learnedOf = (id: CourseId): number | null => {
    const progress = id === activeCourse ? state.progress : state.courseProgress?.[id];
    const words = progress ? Object.values(progress) : [];
    return words.length > 0 ? words.filter(isWordLearned).length : null;
  };

  const started = useMemo(
    () => specialtyCourses().filter((c) => c.id !== activeCourse && learnedOf(c.id) !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.courseProgress, activeCourse],
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (d: DomainInfo) => !q || `${d.name.en} ${d.name.zh} ${d.description} ${d.topics.join(' ')}`.toLowerCase().includes(q);
    return DOMAIN_FAMILIES.map((family) => ({ family, domains: DOMAINS.filter((d) => d.family === family && matches(d)) })).filter(
      (g) => g.domains.length > 0,
    );
  }, [query]);

  const status = (id: CourseId, total?: number) => {
    if (id === activeCourse) return t('switcher.current');
    const learned = learnedOf(id);
    if (learned === null) return t('switcher.begin');
    return total ? t('switcher.learned', { learned: formatNumber(learned), total: formatNumber(total) }) : t('switcher.resume');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="switcher-title"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl dark:border-slate-700 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-700">
          <div className="min-w-0">
            <h2 id="switcher-title" className="text-xl font-bold">{t('switcher.title')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('switcher.intro')}</p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className={`shrink-0 rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 ${focusRing}`}
            aria-label={t('catalogue.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-7 overflow-y-auto p-5">
          <section aria-labelledby="switcher-languages">
            <h3 id="switcher-languages" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('switcher.languages')}
            </h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {languageCourses().map((c) => {
                const active = c.id === activeCourse;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      data-course={c.id}
                      onClick={() => onSelect(c.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`flex h-full w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${focusRing} ${
                        active ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <span className="text-3xl" aria-hidden>{c.flag}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold leading-snug">{t(c.cardTitleKey)}</span>
                        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{t(c.cardSubtitleKey)}</span>
                        <span className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${active ? 'text-rose-700 dark:text-rose-300' : 'text-slate-600 dark:text-slate-300'}`}>
                          {active && <Check className="h-3.5 w-3.5" aria-hidden />}
                          {active ? status(c.id) : learnedOf(c.id) === null ? t('switcher.begin') : t('switcher.resume')}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {started.length > 0 && (
            <section aria-labelledby="switcher-mine">
              <h3 id="switcher-mine" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t('switcher.mine')}
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {started.map((c) => {
                  const cfg = getCourseConfig(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        data-course={c.id}
                        onClick={() => onSelect(c.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50 ${focusRing}`}
                      >
                        <span className="text-xl" aria-hidden>{cfg.badge}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium leading-snug">{t(cfg.nameKey, courseVars(cfg, lang))}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">{status(c.id, cfg.domain ? DOMAINS.find((d) => d.id === cfg.domain)?.count : undefined)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-labelledby="switcher-specialty">
            <h3 id="switcher-specialty" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('switcher.specialty')}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('switcher.specialtyIntro')}</p>
            <p className="mb-3 mt-1 text-sm text-slate-500 dark:text-slate-400">{t('rotation.explain')}</p>
            <label className="relative mb-4 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('catalogue.search')}
                aria-label={t('catalogue.search')}
                className={`w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm dark:border-slate-600 dark:bg-slate-900 ${focusRing}`}
              />
            </label>

            {groups.length === 0 && <p className="text-sm text-slate-500">{t('catalogue.empty')}</p>}
            <div className="space-y-6">
              {groups.map(({ family, domains }) => (
                <div key={family} role="group" aria-label={t(`catalogue.family.${family}`)}>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <span aria-hidden>{FAMILY_ICON[family]}</span> {t(`catalogue.family.${family}`)}
                  </h4>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {domains.map((d) => (
                      <li key={d.id} className="min-w-0 rounded-2xl border border-slate-200 p-4 dark:border-slate-700" data-domain={d.id}>
                        <div className="font-semibold leading-snug">{name(d)}</div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{d.description}</p>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('catalogue.terms', { count: d.count })}</p>
                        <div className="mt-3 flex flex-col gap-2">
                          {(['chinese', 'english'] as const).map((track) => {
                            const id = domainCourseId(d.id, track);
                            const active = id === activeCourse;
                            const inMix = mix.includes(id);
                            const cfg = getCourseConfig(id);
                            const label = t(cfg.nameKey, courseVars(cfg, lang));
                            return (
                              <div key={track} className="space-y-1">
                                <button
                                  type="button"
                                  data-course={id}
                                  onClick={() => onSelect(id)}
                                  aria-current={active ? 'true' : undefined}
                                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${focusRing} ${
                                    active ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700'
                                  }`}
                                >
                                  <span className="block font-medium">{t(`catalogue.track.${track}`)}</span>
                                  <span className="block text-xs text-slate-500 dark:text-slate-400">{status(id, d.count)}</span>
                                </button>
                                <button
                                  type="button"
                                  data-mix={id}
                                  aria-pressed={inMix}
                                  aria-label={t(inMix ? 'rotation.removeAria' : 'rotation.addAria', { name: label })}
                                  onClick={() => onToggleMix(id)}
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${focusRing} ${
                                    inMix ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                                  }`}
                                >
                                  {inMix ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
                                  {t(inMix ? 'rotation.added' : 'rotation.add')}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
          <p className="text-xs text-slate-500">{t('catalogue.draft')}</p>
        </div>
      </div>
    </div>
  );
}
