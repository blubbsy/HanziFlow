import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Lightbulb, Search, TriangleAlert } from 'lucide-react';
import { AudioButton } from '../components/AudioButton';
import { SpeedControl } from '../components/SpeedControl';
import { FreePinyin } from '../components/ToneText';
import type { SpeechApi } from '../utils/speech';
import { GRAMMAR_BY_ID } from './grammarData';
import { HskBadge, PatternFormula, RichText, card, focusRing } from './ui';
import { WIKI_CATEGORIES, loadWiki, searchWiki, type WikiArticle, type WikiCategory } from './wikiData';
import { useI18n } from '../i18n/react';

export interface WikiUiState {
  article: string | null;
  category: WikiCategory | 'all';
  query: string;
}

interface Props {
  ui: WikiUiState;
  onUiChange: (next: WikiUiState) => void;
  colorTones: boolean;
  speech: SpeechApi;
  onOpenLesson: (lessonId: string) => void;
}

function HskRange({ range }: { range: [number, number] }) {
  const { t } = useI18n();
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
      {range[0] === range[1] ? t('wiki.hskSingle', { level: range[0] }) : t('wiki.hsk', { from: range[0], to: range[1] })}
    </span>
  );
}

export function WikiView({ ui, onUiChange, colorTones, speech, onOpenLesson }: Props) {
  const { t } = useI18n();
  const [articles, setArticles] = useState<WikiArticle[] | null>(null);
  const [failed, setFailed] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadWiki()
      .then((list) => !cancelled && setArticles(list))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    topRef.current?.scrollIntoView?.({ block: 'start' });
    if (ui.article) {
      backRef.current?.focus();
    }
  }, [ui.article]);

  const matches = useMemo(() => {
    if (!articles) return [];
    const byCategory = ui.category === 'all' ? articles : articles.filter((a) => a.category === ui.category);
    return searchWiki(byCategory, ui.query);
  }, [articles, ui.category, ui.query]);

  const present = useMemo(() => new Set((articles ?? []).map((a) => a.category)), [articles]);

  if (failed) return <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{t('wiki.error')}</p>;
  if (!articles) return <p className="p-4 text-sm text-slate-500" role="status">{t('wiki.loading')}</p>;

  const article = ui.article ? articles.find((a) => a.id === ui.article) : undefined;

  if (article) {
    const lessons = article.relatedPointIds.map((id) => GRAMMAR_BY_ID.get(id)).filter((p) => p !== undefined);
    return (
      <div ref={topRef} className="space-y-4" data-wiki-article={article.id}>
        <button
          ref={backRef}
          type="button"
          onClick={() => onUiChange({ ...ui, article: null })}
          className={`inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-sm font-medium text-slate-600 hover:text-rose-600 dark:text-slate-300 ${focusRing}`}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> {t('wiki.back')}
        </button>

        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <HskRange range={article.hskRange} />
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {t(`wiki.category.${article.category}`)}
            </span>
            {article.status !== 'reviewed' && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">{t('wiki.draft')}</span>
            )}
            <a
              href={`https://github.com/blubbsy/Adilingo/issues/new?title=${encodeURIComponent(`[Wiki] ${article.id}: ${article.title}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-slate-500 underline hover:text-rose-600"
            >
              {t('wiki.report')}
            </a>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
            <RichText text={article.title} />
          </h2>
          <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
            <RichText text={article.summary} />
          </p>
        </header>

        {article.pattern && (
          <section className={`${card} p-4 sm:p-5`}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('wiki.pattern')}</h3>
            <PatternFormula pattern={article.pattern} />
          </section>
        )}

        <section className="space-y-3" aria-labelledby="wiki-rules">
          <div className="flex items-center justify-between gap-2 px-1">
            <h3 id="wiki-rules" className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden /> {t('wiki.rules')}
            </h3>
            <SpeedControl speech={speech} variant="compact" />
          </div>
          {article.rules.map((r, i) => (
            <div key={i} className={`${card} space-y-3 p-4 sm:p-5`}>
              <p className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                <RichText text={r.rule} />
              </p>
              <ul className="space-y-2">
                {r.examples.map((ex, k) => (
                  <li key={k} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50">
                    <div className="min-w-0 flex-1">
                      <p lang="zh-CN" className="font-hanzi text-lg text-slate-900 dark:text-slate-100 sm:text-xl">
                        {ex.hanzi}
                      </p>
                      <p className="mt-0.5 text-sm">
                        <FreePinyin text={ex.pinyin} color={colorTones} className="text-slate-600 dark:text-slate-300" />
                      </p>
                      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{ex.english}</p>
                    </div>
                    <div className="shrink-0">
                      <AudioButton speech={speech} text={ex.hanzi} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {article.contrasts.length > 0 && (
          <section className={`${card} space-y-2 p-4 sm:p-5`} aria-labelledby="wiki-contrasts">
            <h3 id="wiki-contrasts" className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('wiki.contrasts')}</h3>
            <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {article.contrasts.map((c, i) => (
                <li key={i}>
                  <strong className="font-semibold"><RichText text={c.vs} />:</strong> <RichText text={c.text} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {article.pitfalls.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30" aria-labelledby="wiki-pitfalls">
            <h3 id="wiki-pitfalls" className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
              <TriangleAlert className="h-4 w-4" aria-hidden /> {t('wiki.pitfalls')}
            </h3>
            <ul className="space-y-1.5 text-sm text-amber-900 dark:text-amber-100">
              {article.pitfalls.map((p, i) => (
                <li key={i}>
                  <RichText text={p} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {lessons.length > 0 && (
          <section aria-labelledby="wiki-related">
            <h3 id="wiki-related" className="mb-2 px-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('wiki.related')}</h3>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
              {lessons.map((p) => (
                <li key={p.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenLesson(p.id)}
                    data-lesson={p.id}
                    className={`${card} flex w-full items-center gap-3 p-3 text-left transition hover:border-rose-300 ${focusRing}`}
                  >
                    <HskBadge level={p.hskLevel} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium"><RichText text={p.title} /></span>
                    <span className="sr-only">{t('wiki.openLesson')}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  return (
    <div ref={topRef} className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">{t('wiki.intro')}</p>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
        <input
          type="search"
          value={ui.query}
          onChange={(e) => onUiChange({ ...ui, query: e.target.value })}
          placeholder={t('wiki.search')}
          aria-label={t('wiki.search')}
          className={`w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-slate-600 dark:bg-slate-900 ${focusRing}`}
        />
      </label>
      <div role="group" aria-label={t('wiki.categories.aria')} className="flex flex-wrap gap-1.5">
        {(['all', ...WIKI_CATEGORIES.filter((c) => present.has(c))] as const).map((c) => {
          const active = ui.category === c;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={active}
              onClick={() => onUiChange({ ...ui, category: c })}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${focusRing} ${
                active ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {c === 'all' ? t('common.all') : t(`wiki.category.${c}`)}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">{t('wiki.count', { count: matches.length })}</p>
      {matches.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">{t('wiki.empty', { query: ui.query })}</p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
          {matches.map((a) => (
            <li key={a.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onUiChange({ ...ui, article: a.id })}
                data-article={a.id}
                className={`${card} flex h-full w-full flex-col gap-1.5 p-4 text-left transition hover:border-rose-300 ${focusRing}`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <HskRange range={a.hskRange} />
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{t(`wiki.category.${a.category}`)}</span>
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100"><RichText text={a.title} /></span>
                <span className="line-clamp-3 text-sm text-slate-500 dark:text-slate-400"><RichText text={a.summary} /></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
