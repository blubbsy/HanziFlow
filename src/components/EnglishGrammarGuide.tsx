import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Dumbbell,
  Layers,
  Search,
  Table as TableIcon,
  Volume2,
  Zap,
} from 'lucide-react';
import {
  ACTIVE_PASSIVE_RULES,
  ENGLISH_TENSES,
  MASTER_VERB_EXAMPLE,
  type PersonGroup,
  type TenseGroup,
} from '../data/englishGrammarMaster';
import {
  ENGLISH_GRAMMAR_WIKI,
  GRAMMAR_CATEGORIES,
  type GrammarCategory,
  type GrammarWikiArticle,
} from '../data/englishGrammarWiki';
import type { SpeechApi } from '../utils/speech';
import type { GrammarPoint } from '../grammar/types';
import { SpeedControl } from './SpeedControl';
import { useI18n } from '../i18n/react';

export type EnglishGuideTab = 'wiki' | 'tenses' | 'passive';

/** What the learner has open in the guide; kept by the parent so it survives opening a lesson and coming back. */
export interface EnglishGuideUi {
  tab: EnglishGuideTab;
  query: string;
  category: GrammarCategory | 'all';
  article: string | null;
}

export const DEFAULT_ENGLISH_GUIDE_UI: EnglishGuideUi = { tab: 'wiki', query: '', category: 'all', article: null };

interface Props {
  speech: SpeechApi;
  ui: EnglishGuideUi;
  onUiChange: (ui: EnglishGuideUi) => void;
  onOpenIrregularVerbs?: () => void;
  /** The English lessons (their `wikiId` ties them to articles). */
  lessons: GrammarPoint[];
  /** Opens a grammar lesson that practises the article. */
  onOpenLesson?: (lessonId: string) => void;
}

type MainTab = EnglishGuideTab;

const TENSE_GROUPS: (TenseGroup | 'all')[] = ['all', 'present', 'past', 'future', 'conditional'];

/** Subject pronouns are English example text, not interface text. */
const PERSON_TABS: { id: PersonGroup; subjectName: string }[] = [
  { id: 'first', subjectName: 'I' },
  { id: 'third_singular', subjectName: 'He / She / It' },
  { id: 'plural', subjectName: 'We / They' },
];

export function EnglishGrammarGuide({ speech, ui, lessons, onUiChange, onOpenIrregularVerbs, onOpenLesson }: Props) {
  const { t, rich } = useI18n();
  const activeTab = ui.tab;
  const searchQuery = ui.query;
  const selectedWikiCategory = ui.category;
  const expandedWikiId = ui.article;
  const setActiveTab = (tab: MainTab) => onUiChange({ ...ui, tab });
  const setSearchQuery = (query: string) => onUiChange({ ...ui, query });
  const setSelectedWikiCategory = (category: GrammarCategory | 'all') => onUiChange({ ...ui, category });
  const setExpandedWikiId = (article: string | null) => onUiChange({ ...ui, article });

  /** Lessons per wiki article (the lesson names the article it practises). */
  const lessonsByArticle = useMemo(() => {
    const map = new Map<string, GrammarPoint[]>();
    for (const p of lessons) if (p.wikiId) map.set(p.wikiId, [...(map.get(p.wikiId) ?? []), p]);
    return map;
  }, [lessons]);

  // Tense guide state
  const [selectedGroup, setSelectedGroup] = useState<TenseGroup | 'all'>('all');
  const [selectedPerson, setSelectedPerson] = useState<PersonGroup>('third_singular');
  const [tenseViewMode, setTenseViewMode] = useState<'cards' | 'spo_table'>('cards');
  const [expandedTenseId, setExpandedTenseId] = useState<string | null>(null);

  // Filtered Wikipedia articles
  const filteredWikiArticles = useMemo(() => {
    return ENGLISH_GRAMMAR_WIKI.filter((art) => {
      const matchCat = selectedWikiCategory === 'all' || art.category === selectedWikiCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        art.titleEn.toLowerCase().includes(q) ||
        art.titleZh.toLowerCase().includes(q) ||
        art.summaryZh.toLowerCase().includes(q) ||
        art.keywords.some((k) => k.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [selectedWikiCategory, searchQuery]);

  // Filtered Tenses
  const filteredTenses = useMemo(() => {
    return ENGLISH_TENSES.filter((tense) => {
      const matchGrp = selectedGroup === 'all' || tense.group === selectedGroup;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        tense.nameEn.toLowerCase().includes(q) ||
        tense.nameZh.toLowerCase().includes(q) ||
        tense.signalWords.some((w) => w.toLowerCase().includes(q));
      return matchGrp && matchSearch;
    });
  }, [selectedGroup, searchQuery]);

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-rose-200/80 bg-gradient-to-br from-rose-50 via-white to-amber-50/40 p-4 shadow-sm dark:border-rose-900/50 dark:from-slate-800 dark:via-slate-800 dark:to-rose-950/20 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {rich('english.guide.intro', undefined, {
              strong: (text) => <strong>{text}</strong>,
              hl: (text) => <span className="font-semibold text-rose-600 dark:text-rose-400">{text}</span>,
            })}
          </p>

          {onOpenIrregularVerbs && (
            <button
              onClick={onOpenIrregularVerbs}
              className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-600/20 transition hover:bg-rose-700 active:scale-95"
            >
              <Zap className="h-4 w-4" />
              {t('english.guide.irregularBtn')}
            </button>
          )}
        </div>

        {/* Universal Search Bar */}
        <div className="mt-4 relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('english.guide.searchPlaceholder')}
            className="w-full rounded-2xl border border-slate-200 bg-white/95 py-3.5 pl-12 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Section Navigation Tabs */}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-rose-200/60 pt-4 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('wiki')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'wiki'
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            📖 {t('english.guide.tab.wiki')}
          </button>
          <button
            onClick={() => setActiveTab('tenses')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'tenses'
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            <TableIcon className="h-4 w-4" />
            ⏱️ {t('english.guide.tab.tenses')}
          </button>
          <button
            onClick={() => setActiveTab('passive')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'passive'
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            <Layers className="h-4 w-4" />
            🔄 {t('english.guide.tab.passive')}
          </button>
          <SpeedControl speech={speech} variant="compact" className="ml-auto" />
        </div>
      </header>

      {/* TAB 1: Grammar Wikipedia */}
      {activeTab === 'wiki' && (
        <section className="space-y-6 animate-fade-in">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
            {GRAMMAR_CATEGORIES.map((cat) => {
              const active = selectedWikiCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedWikiCategory(cat.id)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    active
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{t(`english.wiki.category.${cat.id}`)}</span>
                </button>
              );
            })}
          </div>

          {/* Article List */}
          <div className="space-y-4">
            {filteredWikiArticles.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                {t('english.wiki.empty', { query: searchQuery })}
              </div>
            ) : (
              filteredWikiArticles.map((art: GrammarWikiArticle) => {
                const isExpanded = expandedWikiId === art.id;
                return (
                  <article
                    key={art.id}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  >
                    {/* Header */}
                    <div
                      onClick={() => setExpandedWikiId(isExpanded ? null : art.id)}
                      className="cursor-pointer flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6 transition hover:bg-slate-50/50 dark:hover:bg-slate-750"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                            {t('english.wiki.level', { level: art.level })}
                          </span>
                          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                            {art.titleZh}
                          </h2>
                          <span className="text-xs font-medium text-slate-500">({art.titleEn})</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {art.summaryZh}
                        </p>
                        {art.formula && (
                          <div className="mt-2 inline-block rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono font-semibold text-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
                            {t('english.wiki.formula', { formula: art.formula })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {isExpanded ? t('english.wiki.collapse') : t('english.wiki.expand')}
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Detailed Rules & Examples */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-5 sm:p-6 space-y-4 animate-fade-in dark:border-slate-700/60 dark:bg-slate-900/30">
                        <div className="space-y-3">
                          {art.rules.map((rule, idx) => (
                            <div
                              key={idx}
                              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-700 dark:bg-slate-800"
                            >
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {rule.ruleZh}
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                                  {rule.exampleEn}
                                </div>
                                <button
                                  onClick={() => speech.speak(rule.exampleEn)}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                                  title={t('topics.listen')}
                                >
                                  <Volume2 className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{rule.exampleZh}</div>
                            </div>
                          ))}
                        </div>

                        {(lessonsByArticle.get(art.id)?.length ?? 0) > 0 && onOpenLesson && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500">{t('english.wiki.practise')}</span>
                            {lessonsByArticle.get(art.id)!.map((lesson) => (
                              <button
                                key={lesson.id}
                                type="button"
                                onClick={() => onOpenLesson(lesson.id)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
                              >
                                <Dumbbell className="h-3.5 w-3.5" aria-hidden />
                                {lesson.title.split(' · ')[0]}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Pitfalls & Traps */}
                        {art.pitfallsZh && (
                          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                            <div>
                              <strong>{t('english.wiki.pitfalls')}</strong> {art.pitfallsZh}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* TAB 2: Tenses & SPO Blueprint */}
      {activeTab === 'tenses' && (
        <section className="space-y-6 animate-fade-in">
          {/* Controls: Tense Group & Person & View */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-slate-500">{t('english.tense.group')}</span>
              {TENSE_GROUPS.map((g) => {
                const active = selectedGroup === g;
                return (
                  <button
                    key={g}
                    onClick={() => setSelectedGroup(g)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                    }`}
                  >
                    {t(`english.tenseGroup.${g}`)}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Person switcher */}
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900/50">
                {PERSON_TABS.map((p) => {
                  const active = selectedPerson === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPerson(p.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        active
                          ? 'bg-white font-bold text-rose-600 shadow-sm dark:bg-slate-800 dark:text-rose-400'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      }`}
                      title={t(`english.person.${p.id}`)}
                    >
                      {t('english.person.subject', { name: p.subjectName })}
                    </button>
                  );
                })}
              </div>

              {/* Cards vs SPO Table Mode */}
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900/50">
                <button
                  onClick={() => setTenseViewMode('cards')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition ${
                    tenseViewMode === 'cards'
                      ? 'bg-white font-bold text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  <BookOpen className="h-3.5 w-3.5" /> {t('english.tense.viewCards')}
                </button>
                <button
                  onClick={() => setTenseViewMode('spo_table')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition ${
                    tenseViewMode === 'spo_table'
                      ? 'bg-white font-bold text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  <TableIcon className="h-3.5 w-3.5" /> {t('english.tense.viewTable')}
                </button>
              </div>
            </div>
          </div>

          {/* Cards View */}
          {tenseViewMode === 'cards' ? (
            <div className="space-y-4">
              {filteredTenses.map((tense) => {
                const conj = tense.conjugations[selectedPerson];
                const isExpanded = expandedTenseId === tense.id;

                return (
                  <article
                    key={tense.id}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/80"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-5 dark:border-slate-700/60 dark:bg-slate-800/40 sm:p-6">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                            {tense.nameZh}
                          </span>
                          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 sm:text-xl">
                            {tense.nameEn}
                          </h2>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {tense.summaryZh} ({tense.summaryEn})
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedTenseId(isExpanded ? null : tense.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          {isExpanded ? t('english.wiki.collapse') : t('english.tense.expand')}
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="p-5 sm:p-6">
                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Active Voice Box */}
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 dark:border-emerald-950/40 dark:bg-emerald-950/20">
                          <div className="flex items-center justify-between">
                            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                              {t('english.tense.active')}
                            </span>
                            <button
                              onClick={() => speech.speak(conj.fullActive)}
                              className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                              title={t('topics.listen')}
                            >
                              <Volume2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
                            <span className="text-slate-500">{conj.subject} </span>
                            <span className="rounded bg-emerald-200/80 px-1.5 py-0.5 text-emerald-900 dark:bg-emerald-800/80 dark:text-emerald-100">
                              {conj.verbText}
                            </span>{' '}
                            <span>{MASTER_VERB_EXAMPLE.object}.</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{conj.translation}</p>

                          <div className="mt-3 text-xs text-emerald-800 dark:text-emerald-300">
                            <strong>{t('english.tense.activeFormula')}</strong> <code className="font-mono">{tense.formulaActive}</code>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {t('english.tense.verbChange')} <span className="font-semibold text-emerald-700 dark:text-emerald-400">{conj.changedPart}</span>
                          </div>
                        </div>

                        {/* Passive Voice Box */}
                        <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4 dark:border-sky-950/40 dark:bg-sky-950/20">
                          <div className="flex items-center justify-between">
                            <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800 dark:bg-sky-900/60 dark:text-sky-300">
                              {t('english.tense.passive')}
                            </span>
                            <button
                              onClick={() => speech.speak(tense.passive.sentence)}
                              className="rounded-lg p-1 text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-900/50"
                              title={t('topics.listen')}
                            >
                              <Volume2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
                            {/* i18n-ignore: English example sentence */}
                            <span className="text-slate-500">A letter </span>
                            <span className="rounded bg-sky-200/80 px-1.5 py-0.5 text-sky-900 dark:bg-sky-800/80 dark:text-sky-100">
                              {tense.passive.verbPart}
                            </span>{' '}
                            <span className="text-slate-500">
                              {tense.passive.sentence.includes('by') ? 'by him.' : '.' /* i18n-ignore: English example sentence */}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{tense.passive.translation}</p>

                          <div className="mt-3 text-xs text-sky-800 dark:text-sky-300">
                            <strong>{t('english.tense.passiveFormula')}</strong> <code className="font-mono">{tense.formulaPassive}</code>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {t('english.tense.passiveKey')} <span className="font-medium text-sky-700 dark:text-sky-300">{tense.passive.whatChangedZh}</span>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/40">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            {t('english.tense.signalWords')}
                          </h3>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {tense.signalWords.map((word) => (
                              <span
                                key={word}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-mono font-semibold text-slate-700 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              >
                                {word}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            /* SPO Master Tense Table */
            <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <table className="w-full min-w-[760px] text-left text-xs sm:text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3.5 font-bold">{t('english.table.tense')}</th>
                    <th className="px-3 py-3.5 font-bold">{t('english.table.subject')}</th>
                    <th className="px-4 py-3.5 font-bold">{t('english.table.verb')}</th>
                    <th className="px-3 py-3.5 font-bold">{t('english.table.object')}</th>
                    <th className="px-4 py-3.5 font-bold">{t('english.table.example')}</th>
                    <th className="px-4 py-3.5 font-bold">{t('english.table.passive')}</th>
                    <th className="px-4 py-3.5 font-bold">{t('english.table.signal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredTenses.map((tense) => {
                    const conj = tense.conjugations[selectedPerson];
                    return (
                      <tr key={tense.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-750">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                          <div>{tense.nameZh}</div>
                          <div className="text-xs text-slate-500 font-normal">{tense.nameEn}</div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-bold text-rose-600 dark:text-rose-400">
                          {conj.subject}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {conj.verbText}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-500 font-medium">
                          {MASTER_VERB_EXAMPLE.object}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                          <div className="flex items-center gap-1.5">
                            <span>{conj.fullActive}</span>
                            <button
                              onClick={() => speech.speak(conj.fullActive)}
                              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                              title={t('topics.listen')}
                              aria-label={t('topics.listen')}
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="text-xs text-slate-500">{conj.translation}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-sky-700 dark:text-sky-300">
                            {tense.passive.sentence}
                          </span>
                          <div className="text-xs text-slate-500">{tense.passive.translation}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs font-mono">
                          {tense.signalWords.slice(0, 3).join(', ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: Passive Voice Transformation 3 Golden Rules */}
      {activeTab === 'passive' && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8 space-y-6 animate-fade-in">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 sm:text-xl">
                {t('english.passive.title')}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('english.passive.intro')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {ACTIVE_PASSIVE_RULES.map((rule, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/40"
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {rule.step}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {rule.rule}
                  </p>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-800">
                  <div className="font-semibold text-slate-500">{t('english.passive.example')}</div>
                  <div className="mt-1 text-slate-800 dark:text-slate-200">{rule.exampleActive}</div>
                  <div className="mt-1 flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                    <ArrowRight className="h-3 w-3" />
                    {rule.examplePassive}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
