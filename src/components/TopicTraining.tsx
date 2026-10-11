import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Ear,
  Eye,
  Filter,
  Languages,
  Layers,
  Music,
  Play,
  Search,
  Star,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import type { SessionRequest, StudyMode, UserState, VocabItem } from '../types';
import type { SpeechApi } from '../utils/speech';
import { isWordLearned, isWordStudied } from '../utils/srsEngine';
import { getCourseConfig } from '../data/courses';
import { useI18n } from '../i18n/react';
import {
  THEME_LABELS,
  buildTopicSessionRequest,
  loadChinesePacks,
  packsForCourse,
  resolveTopicWords,
  type TopicPack,
  type TopicTheme,
} from '../data/topicPacks';

interface Props {
  vocab: VocabItem[];
  state: UserState;
  speech: SpeechApi;
  onStartSession: (req: SessionRequest) => void;
  onToggleStar: (wordId: string) => void;
}

export function TopicTraining({ vocab, state, speech, onStartSession, onToggleStar }: Props) {
  const { t, formatNumber } = useI18n();
  const course = getCourseConfig(state.settings.course);
  const [selectedTheme, setSelectedTheme] = useState<TopicTheme | 'all'>('all');
  const [search, setSearch] = useState('');
  const [activePack, setActivePack] = useState<TopicPack | null>(null);
  const [curated, setCurated] = useState<TopicPack[]>([]);
  const curatedCourse = course.features.topics === 'curated-packs';
  useEffect(() => {
    if (!curatedCourse) return;
    let cancelled = false;
    loadChinesePacks().then((list) => {
      if (!cancelled) setCurated(list);
    });
    return () => {
      cancelled = true;
    };
  }, [curatedCourse]);
  const packs = useMemo(() => packsForCourse(state.settings.course, vocab, curated), [state.settings.course, vocab, curated]);

  // Pre-resolve words and progress for each pack
  const packData = useMemo(() => {
    return packs.map((pack) => {
      const words = resolveTopicWords(pack, vocab);
      const learnedCount = words.filter((w) => isWordLearned(state.progress[w.id])).length;
      const studiedCount = words.filter((w) => isWordStudied(state.progress[w.id])).length;
      const pct = words.length > 0 ? Math.round((learnedCount / words.length) * 100) : 0;
      return {
        pack,
        words,
        learnedCount,
        studiedCount,
        pct,
      };
    });
  }, [packs, vocab, state.progress]);

  // Overall statistics
  const stats = useMemo(() => {
    let totalWords = 0;
    let totalLearned = 0;
    let completedPacks = 0;
    for (const item of packData) {
      totalWords += item.words.length;
      totalLearned += item.learnedCount;
      if (item.pct === 100) completedPacks += 1;
    }
    return {
      totalPacks: packData.length,
      totalWords,
      totalLearned,
      completedPacks,
    };
  }, [packData]);

  // Filtered packs
  const filteredPacks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return packData.filter(({ pack, words }) => {
      if (selectedTheme !== 'all' && pack.theme !== selectedTheme) return false;
      if (!q) return true;

      const matchTitle = pack.title.toLowerCase().includes(q);
      const matchChinese = pack.chineseTitle.includes(q);
      const matchDesc = pack.description.toLowerCase().includes(q);
      const matchWord = words.some(
        (w) =>
          w.hanzi.includes(q) ||
          w.pinyin.toLowerCase().includes(q) ||
          w.english.some((e) => e.toLowerCase().includes(q)),
      );

      return matchTitle || matchChinese || matchDesc || matchWord;
    });
  }, [packData, selectedTheme, search]);

  const activePackData = useMemo(() => {
    if (!activePack) return null;
    return packData.find((p) => p.pack.id === activePack.id) ?? null;
  }, [activePack, packData]);

  const startTopicSession = (pack: TopicPack, words: VocabItem[], mode: StudyMode, limit?: number) => {
    const modeLabel =
      mode === 'audio'
        ? t('topics.mode.listening')
        : mode === 'tone'
        ? t('topics.mode.tone')
        : mode === 'english'
        ? t('topics.label.recall')
        : mode === 'hanzi'
        ? t('topics.label.recognition')
        : t('topics.mode.smart');

    onStartSession(buildTopicSessionRequest(words, mode, t('topics.sessionLabel', { pack: pack.title, mode: modeLabel }), limit));
  };

  return (
    <section className="space-y-6 pb-12">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-rose-200/70 bg-gradient-to-br from-rose-500/10 via-amber-500/5 to-orange-500/10 p-6 shadow-sm dark:border-rose-900/40 dark:from-rose-950/30 dark:via-amber-950/20 dark:to-orange-950/30">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-400">
                <Layers className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t('topics.heading')}</h1>
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  {t('topics.tagline')}
                </p>
              </div>
            </div>
            <p className="max-w-xl text-sm text-slate-600 dark:text-slate-300">
              {t('topics.intro')}
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <div className="px-3">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('topics.metric.packs')}</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">{stats.totalPacks}</div>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="px-3">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('topics.metric.learned')}</div>
              <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
                {stats.totalLearned} <span className="text-xs font-normal text-slate-500">/ {stats.totalWords}</span>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="px-3">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('topics.metric.mastered')}</div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.completedPacks} <span className="text-xs font-normal text-slate-500">/ {stats.totalPacks}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Theme Category Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-200/60 pt-4 dark:border-slate-800/80">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" /> {t('topics.filter.themes')}
          </span>
          <button
            onClick={() => setSelectedTheme('all')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              selectedTheme === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                : 'bg-white/70 text-slate-600 hover:bg-slate-100 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {t('topics.filter.all', { count: packs.length })}
          </button>
          {(Object.keys(THEME_LABELS) as TopicTheme[]).map((theme) => {
            const active = selectedTheme === theme;
            const count = packs.filter((p) => p.theme === theme).length;
            return (
              <button
                key={theme}
                onClick={() => setSelectedTheme(active ? 'all' : theme)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {t(`topics.theme.${theme}`)} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('topics.search.placeholder')}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-800 placeholder-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label={t('topics.search.clear')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Packs Grid */}
      {filteredPacks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <Layers className="h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden />
          <h3 className="mt-3 text-base font-semibold text-slate-800 dark:text-slate-200">{t('topics.empty.title')}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('topics.empty.desc')}</p>
          <button
            onClick={() => {
              setSearch('');
              setSelectedTheme('all');
            }}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            {t('topics.empty.reset')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {filteredPacks.map(({ pack, words, learnedCount, pct }) => {
            const previewWords = words.slice(0, 5);

            return (
              <article
                key={pack.id}
                data-pack-words={words.length}
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-rose-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-rose-800/70"
              >
                <div>
                  {/* Top: Emoji, Tag & Mastery */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-2xl shadow-inner dark:bg-slate-800" aria-hidden>
                      {pack.emoji}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {t(`topics.theme.${pack.theme}`)}
                      </span>

                      {pct === 100 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                          {t('topics.mastered')}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {t('topics.learnedOf', { learned: learnedCount, total: words.length })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                        {pack.title}
                      </h3>
                      <span className="font-hanzi text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {pack.chineseTitle}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {pack.derived ? t('topics.derivedDesc', { count: words.length, topic: pack.title }) : pack.description}
                    </p>
                  </div>

                  {/* Sample Vocabulary Chips */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {previewWords.map((w) => (
                      <span
                        key={w.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 font-hanzi text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {w.hanzi}
                      </span>
                    ))}
                    {words.length > 5 && (
                      <span className="inline-flex items-center rounded-lg bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800/50">
                        {t('topics.more', { count: words.length - 5 })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress & Action Buttons */}
                <div className="mt-5 space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>{t('topics.progress')}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{formatNumber(pct / 100, { style: 'percent' })}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          pct === 100
                            ? 'bg-emerald-500'
                            : pct > 0
                            ? 'bg-rose-500'
                            : 'bg-transparent'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startTopicSession(pack, words, 'mixed')}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 active:scale-[0.98]"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      {t('common.practice')}
                    </button>

                    <button
                      onClick={() => setActivePack(pack)}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80"
                      title={t('topics.inspect')}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {t('topics.words', { count: words.length })}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Detail Modal for Selected Topic Pack */}
      {activePackData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 p-6 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-2xl dark:bg-rose-950/40">
                  {activePackData.pack.emoji}
                </span>
                <div>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {activePackData.pack.title}
                    </h2>
                    <span className="font-hanzi text-sm font-semibold text-slate-500">
                      {activePackData.pack.chineseTitle}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('topics.modal.summary', { count: activePackData.words.length, learned: activePackData.learnedCount, percent: activePackData.pct })}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActivePack(null)}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label={t('common.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Practice Mode Action Bar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/60">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">{t('topics.train')}</span>
              <button
                onClick={() => {
                  startTopicSession(activePackData.pack, activePackData.words, 'mixed');
                  setActivePack(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
              >
                <Play className="h-3 w-3 fill-current" /> {t('topics.mode.smart')}
              </button>
              <button
                onClick={() => {
                  startTopicSession(activePackData.pack, activePackData.words, 'audio');
                  setActivePack(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Ear className="h-3 w-3" /> {t('topics.mode.listening')}
              </button>
              {course.features.tones && (
                <button
                  onClick={() => {
                    startTopicSession(activePackData.pack, activePackData.words, 'tone');
                    setActivePack(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Music className="h-3 w-3" /> {t('topics.mode.tone')}
                </button>
              )}
              <button
                onClick={() => {
                  startTopicSession(activePackData.pack, activePackData.words, 'english');
                  setActivePack(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Languages className="h-3 w-3" /> {t(course.track === 'english' ? 'topics.mode.recall.english' : 'topics.mode.recall.chinese')}
              </button>
              <button
                onClick={() => {
                  startTopicSession(activePackData.pack, activePackData.words, 'mixed', 10);
                  setActivePack(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <Zap className="h-3 w-3" /> {t('topics.mode.sprint')}
              </button>
            </div>

            {/* Vocabulary Words List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
              {activePackData.words.map((item) => {
                const learned = isWordLearned(state.progress[item.id]);
                const starred = state.starredWords?.includes(item.id);

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 transition-colors hover:border-slate-200 hover:bg-slate-50 dark:border-slate-800/60 dark:bg-slate-800/40 dark:hover:bg-slate-800/80"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => speech.speak(item.speakAs ?? item.hanzi)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm hover:text-rose-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:text-rose-400"
                        title={t('topics.listen')}
                        aria-label={t('topics.pronounce', { word: item.hanzi })}
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>

                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-hanzi text-lg font-bold text-slate-900 dark:text-white">
                            {item.hanzi}
                          </span>
                          <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                            {item.pinyin}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {item.english.join(', ')}
                        </p>
                        {item.exampleSentence && (
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-hanzi">
                            {item.exampleSentence.hanzi} ({item.exampleSentence.english})
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onToggleStar(item.id)}
                        className={`rounded-xl p-1.5 transition ${
                          starred
                            ? 'text-amber-500'
                            : 'text-slate-300 hover:text-slate-400 dark:text-slate-600 dark:hover:text-slate-400'
                        }`}
                        title={starred ? t('dictionary.unstarTitle') : t('topics.starForDrill')}
                        aria-label={starred ? t('topics.starred') : t('topics.notStarred')}
                      >
                        <Star className={`h-4 w-4 ${starred ? 'fill-current' : ''}`} />
                      </button>

                      {learned ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> {t('dictionary.status.learned')}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {t('topics.new')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
