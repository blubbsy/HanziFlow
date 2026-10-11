import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { BookText, GraduationCap, Layers, Route, Zap } from 'lucide-react';
import type { CourseId, Curriculum, SessionRequest, UserState, VocabItem } from '../types';
import type { SpeechApi } from '../utils/speech';
import { getCourseConfig } from '../data/courses';
import { DEFAULT_ENGLISH_GUIDE_UI, EnglishGrammarGuide, type EnglishGuideUi } from '../components/EnglishGrammarGuide';
import { GRAMMAR_BY_ID, GRAMMAR_POINTS, LEARNING_PATHS } from './grammarData';
import { useEnglishGrammar } from './useEnglishGrammar';
import { GrammarLesson } from './GrammarLesson';
import { GrammarList, type LevelFilter } from './GrammarList';
import { useGrammarProgress } from './grammarStorage';
import { LearningPathsView } from './LearningPathsView';
import { buildDomainPaths, buildLevelPaths } from './levelPaths';
import { stepWordIds, unrecordedDoneSteps, type PathContext } from './pathLogic';
import type { GrammarPoint, LearningPath, PathUnit, VocabStep } from './types';
import { card, focusRing } from './ui';
import { WikiView, type WikiUiState } from './WikiView';
import { WIKI_CATEGORIES } from './wikiData';
import { useI18n } from '../i18n/react';

export type Tab = 'paths' | 'grammar' | 'wiki' | 'topics';
const TABS: Tab[] = ['paths', 'grammar', 'wiki', 'topics'];
/** Specialty courses have no grammar. */
const WORD_TABS: Tab[] = ['paths', 'topics'];

interface UiState {
  tab: Tab;
  pathId: string | null;
  level: LevelFilter;
  lesson: { id: string; from: Tab } | null;
  wiki: WikiUiState;
  /** The English wiki tab (grammar wiki, tense table, passive rules). */
  enGuide: EnglishGuideUi;
}

const UI_KEY = 'hanzi-flow:grammar-ui';
const DEFAULT_WIKI: WikiUiState = { article: null, category: 'all', query: '' };
const DEFAULT_UI: UiState = { tab: 'paths', pathId: null, level: 'all', lesson: null, wiki: DEFAULT_WIKI, enGuide: DEFAULT_ENGLISH_GUIDE_UI };

/** Restores the view after the hub is unmounted (e.g. while a vocab session launched from a path is running). */
function loadUi(): UiState {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(UI_KEY) ?? 'null') as Partial<UiState> | null;
    if (!raw || typeof raw !== 'object') return DEFAULT_UI;
    const tab: Tab = raw.tab === 'grammar' || raw.tab === 'wiki' || raw.tab === 'topics' ? raw.tab : 'paths';
    // Validated against the (course-dependent) path list at render time.
    const pathId = typeof raw.pathId === 'string' ? raw.pathId : null;
    const level: LevelFilter = typeof raw.level === 'number' ? raw.level : 'all';
    const lesson =
      raw.lesson && typeof raw.lesson.id === 'string'
        ? { id: raw.lesson.id, from: raw.lesson.from === 'grammar' || raw.lesson.from === 'wiki' ? raw.lesson.from : ('paths' as const) }
        : null;
    const w = raw.wiki as Partial<WikiUiState> | undefined;
    const wiki: WikiUiState = {
      article: typeof w?.article === 'string' ? w.article : null,
      category: (WIKI_CATEGORIES as readonly string[]).includes(w?.category ?? '') ? (w!.category as WikiUiState['category']) : 'all',
      query: typeof w?.query === 'string' ? w.query : '',
    };
    const g = raw.enGuide as Partial<EnglishGuideUi> | undefined;
    const enGuide: EnglishGuideUi = {
      tab: g?.tab === 'tenses' || g?.tab === 'passive' ? g.tab : 'wiki',
      query: typeof g?.query === 'string' ? g.query : '',
      category: typeof g?.category === 'string' ? (g.category as EnglishGuideUi['category']) : 'all',
      article: typeof g?.article === 'string' ? g.article : null,
    };
    return { tab, pathId, level, lesson, wiki, enGuide };
  } catch {
    return DEFAULT_UI;
  }
}

function saveUi(ui: UiState) {
  try {
    window.sessionStorage.setItem(UI_KEY, JSON.stringify(ui));
  } catch {
    /* ignore */
  }
}

/** Makes the next mount of the hub open on `tab` (used by shortcuts elsewhere in the app). */
export function presetGrammarTab(tab: Tab) {
  saveUi({ ...loadUi(), tab, lesson: null });
}

export interface GrammarHubProps {
  /** Active course: decides the tabs (language courses have grammar, specialty courses only paths) and the lessons. */
  course: CourseId;
  vocab: VocabItem[];
  /** Vocab SRS progress; a word counts as learned if progress[id]?.repetitions >= 2. */
  progress: UserState['progress'];
  colorTones: boolean;
  speech: SpeechApi;
  speechRate: number;
  /** Launch vocab practice for a path's vocab step. */
  onStartVocabSession: (req: SessionRequest) => void;
  /** English course: opens the irregular-verb drill. */
  onOpenIrregularVerbs?: () => void;
  /** Active curriculum; syllabus paths are generated for its levels. */
  curriculum?: Curriculum;
  /** Content of the Topics tab (topic training). */
  topics?: ReactNode;
}

export function GrammarHub(props: GrammarHubProps): JSX.Element {
  const { course, vocab, progress: vocabProgress, colorTones, speech, speechRate, onStartVocabSession, onOpenIrregularVerbs, curriculum = 'hsk3_2026', topics } = props;
  const config = getCourseConfig(course);
  const hasGrammar = config.features.grammar;
  const english = config.track === 'english';
  const en = useEnglishGrammar(english && hasGrammar);
  // English lessons arrive as a separate chunk; until then the grammar-dependent panels show a loading note.
  const grammarLoading = english && hasGrammar && !en.data;
  const points = useMemo(() => (english ? (en.data?.ENGLISH_GRAMMAR_POINTS ?? []) : GRAMMAR_POINTS), [english, en.data]);
  const lessonById = useMemo<ReadonlyMap<string, GrammarPoint>>(
    () => (english ? (en.data?.ENGLISH_GRAMMAR_BY_ID ?? new Map()) : GRAMMAR_BY_ID),
    [english, en.data],
  );
  const i18n = useI18n();
  const { t } = i18n;
  const grammar = useGrammarProgress();
  const [stored, setUi] = useState<UiState>(loadUi);
  // Specialty courses only have paths; a remembered grammar/wiki tab of another course must not show up there.
  const ui: UiState = hasGrammar ? stored : { ...stored, tab: stored.tab === 'topics' ? 'topics' : 'paths', lesson: null };
  const tabs: Tab[] = (hasGrammar ? TABS : WORD_TABS).filter((tb) => tb !== 'topics' || topics);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ paths: null, grammar: null, wiki: null, topics: null });

  useEffect(() => saveUi(stored), [stored]);

  const vocabById = useMemo(() => new Map(vocab.map((v) => [v.id, v])), [vocab]);
  const paths = useMemo(
    () =>
      hasGrammar
        ? [...buildLevelPaths(vocab, points, curriculum, i18n), ...(english ? (en.data?.ENGLISH_LEARNING_PATHS ?? []) : LEARNING_PATHS)]
        : buildDomainPaths(vocab, i18n),
    [hasGrammar, vocab, points, curriculum, i18n, english, en.data],
  );
  const ctx: PathContext = useMemo(
    () => ({ vocabById, vocabProgress, grammar: grammar.progress }),
    [vocabById, vocabProgress, grammar.progress],
  );

  // Persist completion of steps that are done (words learned / lesson passed) so it stays sticky.
  const { ready, completeSteps } = grammar;
  useEffect(() => {
    if (!ready) return;
    for (const { pathId, stepIds } of unrecordedDoneSteps(paths, ctx)) completeSteps(pathId, stepIds);
  }, [ready, ctx, completeSteps, paths]);

  const setTab = (tab: Tab) => setUi((u) => ({ ...u, tab, lesson: null }));
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const at = tabs.indexOf(ui.tab);
    const next: Tab = e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[tabs.length - 1] : tabs[(at + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const practiceVocab = (path: LearningPath, _unit: PathUnit, step: VocabStep) => {
    const wordIds = stepWordIds(step, ctx);
    if (!wordIds.length) return;
    onStartVocabSession({
      label: `${path.title} · ${step.title}`,
      mode: 'mixed',
      levels: [],
      topics: [],
      wordIds,
      includeNotDue: true,
      ignoreCap: true,
      limit: wordIds.length,
    });
  };

  const found = ui.lesson ? lessonById.get(ui.lesson.id) : undefined;
  // A remembered lesson of the other language course is ignored.
  const lessonPoint = found && found.track === config.track ? found : undefined;
  const lessonFromPath = ui.lesson?.from === 'paths' ? paths.find((p) => p.id === ui.pathId) : undefined;

  const icons: Record<Tab, typeof Route> = { paths: Route, grammar: GraduationCap, wiki: BookText, topics: Layers };
  const labels: Record<Tab, string> = { paths: t('grammar.tab.paths'), grammar: t('grammar.tab.grammar'), wiki: t('grammar.tab.wiki'), topics: t('grammar.tab.topics') };

  const openWiki = (articleId: string) =>
    setUi((u) => ({ ...u, tab: 'wiki', lesson: null, enGuide: { ...u.enGuide, tab: 'wiki', query: '', category: 'all', article: articleId } }));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      {tabs.length > 1 && (
        <div
          role="tablist"
          aria-label={t('grammar.tabs.aria')}
          className="grid gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/70"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((id) => {
            const active = ui.tab === id;
            const Icon = icons[id];
            return (
              <button
                key={id}
                ref={(el) => {
                  tabRefs.current[id] = el;
                }}
                id={`grammar-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`grammar-panel-${id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(id)}
                onKeyDown={onTabKey}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${focusRing} ${
                  active
                    ? 'bg-white text-rose-600 shadow-sm dark:bg-slate-900 dark:text-rose-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {labels[id]}
              </button>
            );
          })}
        </div>
      )}

      <div role="tabpanel" id={`grammar-panel-${ui.tab}`} aria-labelledby={`grammar-tab-${ui.tab}`}>
        {grammarLoading && ui.tab !== 'wiki' && ui.tab !== 'topics' ? (
          <p role="status" className="py-10 text-center text-sm text-slate-500">
            {en.failed ? t('wiki.error') : t('common.loading')}
          </p>
        ) : lessonPoint ? (
          <GrammarLesson
            key={lessonPoint.id}
            point={lessonPoint}
            pointProgress={grammar.progress.points[lessonPoint.id]}
            colorTones={colorTones}
            speech={speech}
            speechRate={speechRate}
            backLabel={ui.lesson?.from === 'wiki' ? t('wiki.backToArticle') : lessonFromPath ? t('grammar.backTo', { title: lessonFromPath.title }) : t('grammar.allGrammar')}
            onBack={() => setUi((u) => ({ ...u, lesson: null }))}
            onSessionDone={(correct, total) => grammar.recordSession(lessonPoint.id, correct, total)}
            onOpenWiki={lessonPoint.wikiId ? () => openWiki(lessonPoint.wikiId!) : undefined}
          />
        ) : ui.tab === 'topics' ? (
          <>{topics}</>
        ) : ui.tab === 'paths' ? (
          <LearningPathsView
            paths={paths}
            lessons={lessonById}
            ctx={ctx}
            selectedPathId={ui.pathId}
            wordsOnly={!hasGrammar}
            onSelectPath={(pathId) => setUi((u) => ({ ...u, pathId }))}
            onOpenGrammar={(id) => setUi((u) => ({ ...u, lesson: { id, from: 'paths' } }))}
            onPracticeVocab={practiceVocab}
          />
        ) : ui.tab === 'wiki' ? (
          english ? (
            <EnglishGrammarGuide
              speech={speech}
              ui={ui.enGuide}
              lessons={points}
              onUiChange={(enGuide) => setUi((u) => ({ ...u, enGuide }))}
              onOpenIrregularVerbs={onOpenIrregularVerbs}
              onOpenLesson={(id) => setUi((u) => ({ ...u, lesson: { id, from: 'wiki' } }))}
            />
          ) : (
            <WikiView
              ui={ui.wiki}
              onUiChange={(wiki) => setUi((u) => ({ ...u, wiki }))}
              colorTones={colorTones}
              speech={speech}
              onOpenLesson={(id) => setUi((u) => ({ ...u, lesson: { id, from: 'wiki' } }))}
            />
          )
        ) : (
          <div className="space-y-4">
            {english && onOpenIrregularVerbs && (
              <button
                type="button"
                onClick={onOpenIrregularVerbs}
                className={`${card} flex w-full items-center gap-3 p-4 text-left transition hover:border-amber-300 dark:hover:border-amber-700 ${focusRing}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                  <Zap className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">{t('english.hub.irregular')}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{t('english.hub.irregularSub')}</span>
                </span>
              </button>
            )}
            <GrammarList
              points={points}
              progress={grammar.progress}
              level={ui.level}
              onLevelChange={(level) => setUi((u) => ({ ...u, level }))}
              onOpen={(id) => setUi((u) => ({ ...u, lesson: { id, from: 'grammar' } }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
