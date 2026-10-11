import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Database, Download, QrCode, Trash2, Upload, X, Zap } from 'lucide-react';
import type { Curriculum, PinyinHelperMode, Settings, StudyMode, ThemePref, UserState } from '../types';
import { courseVars, getCourseConfig } from '../data/courses';
import { ROTATION_PERCENTS, rotationCourseIds, rotationPercent } from '../utils/rotation';
import { SPEECH_RATES, type SpeechApi } from '../utils/speech';
import { createDefaultState, exportBackup, parseBackup, type StorageBackend } from '../utils/storage';
import { createEmptyGrammarProgress, exportableGrammarProgress, importGrammarProgress, saveGrammarProgress } from '../grammar';
import { AudioButton } from './AudioButton';
import { CHINESE_MODES, ENGLISH_MODES } from './ModeSelector';
import { getStoredSyncKey } from '../utils/syncService';
import type { MessageKey } from '../i18n';
import { useI18n } from '../i18n/react';
import { errorText } from '../i18n/errors';
import { LanguageMenu } from './LanguageMenu';

interface Props {
  state: UserState;
  backend: StorageBackend;
  speech: SpeechApi;
  onChangeSettings: (s: Settings) => void;
  onReplaceState: (s: UserState) => void;
  onClose: () => void;
  onOpenSyncModal: () => void;
  onOpenCatalogue?: () => void;
}

const BACKEND_LABEL: Record<StorageBackend, MessageKey> = {
  indexeddb: 'settings.backend.indexeddb',
  localstorage: 'settings.backend.localstorage',
  memory: 'settings.backend.memory',
};

/** Syllables shown next to the tone-color switch, with the CSS class of their tone. */
const TONE_DEMO: [string, string][] = [
  ['mā', 'text-tone1'],
  ['má', 'text-tone2'],
  ['mǎ', 'text-tone3'],
  ['mà', 'text-tone4'],
  ['ma', 'text-tone0'],
];

export function SettingsModal({
  state,
  backend,
  speech,
  onChangeSettings,
  onReplaceState,
  onClose,
  onOpenSyncModal,
  onOpenCatalogue,
}: Props) {
  const syncKey = getStoredSyncKey();
  const s = state.settings;
  const course = getCourseConfig(s.course);
  const mixIds = s.rotation?.courses ?? [];
  const mixPercent = rotationPercent(state);
  const mixCourses = rotationCourseIds(state).map((id) => getCourseConfig(id));
  const { t, lang } = useI18n();
  const set = (patch: Partial<Settings>) => onChangeSettings({ ...s, ...patch });
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleImport(file: File) {
    try {
      const { state: imported, grammar } = await parseBackup(file);
      const words = Object.keys(imported.progress).length;
      if (!window.confirm(t('settings.import.confirm', { words, reviews: imported.stats.totalReviewed }))) return;
      onReplaceState(imported);
      const grammarOk = grammar !== undefined && (await importGrammarProgress(grammar)) !== null;
      setMessage({ ok: true, text: t(grammarOk ? 'settings.import.doneGrammar' : 'settings.import.done', { words }) });
    } catch (e) {
      setMessage({ ok: false, text: errorText(t, e) });
    }
  }

  async function handleReset() {
    if (!window.confirm(t('settings.reset.confirm'))) return;
    onReplaceState({ ...createDefaultState(), settings: s });
    await saveGrammarProgress(createEmptyGrammarProgress());
    setMessage({ ok: true, text: t('settings.reset.done') });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-pop max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl outline-none sm:rounded-3xl sm:pb-6 lg:max-w-2xl dark:bg-slate-800"
      >
        <div className="flex items-center justify-between">
          <h2 id="settings-title" className="text-xl font-bold">{t('settings.heading')}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label={t('settings.closeAria')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <Group title={t('settings.group.course')}>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 font-hanzi text-xl font-bold text-white" aria-hidden>
              {course.badge}
            </span>
            <span className="min-w-0 flex-1 font-semibold leading-snug">{t(course.cardTitleKey, courseVars(course, lang))}</span>
            {onOpenCatalogue && (
              <button
                type="button"
                onClick={onOpenCatalogue}
                data-testid="settings-open-catalogue"
                className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                {t('switcher.change')}
              </button>
            )}
          </div>
        </Group>

        <Group title={t('settings.group.mix')}>
          <p className="text-xs text-slate-500">{t('settings.mix.intro')}</p>
          {mixCourses.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t('settings.mix.empty')}</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {mixCourses.map((c) => {
                const label = t(c.nameKey, courseVars(c, lang));
                return (
                  <li key={c.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                    <span aria-hidden>{c.badge}</span>
                    <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{label}</span>
                    <button
                      type="button"
                      onClick={() => set({ rotation: { courses: mixIds.filter((id) => id !== c.id), percent: mixPercent } })}
                      aria-label={t('rotation.removeAria', { name: label })}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      {t('settings.mix.remove')}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {onOpenCatalogue && (
            <button
              type="button"
              onClick={onOpenCatalogue}
              className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:border-slate-600 dark:hover:bg-slate-700"
            >
              {t('settings.mix.add')}
            </button>
          )}
          {mixCourses.length > 0 && (
            <div className="mt-3" role="radiogroup" aria-label={t('settings.mix.share')}>
              <p className="mb-1.5 text-xs text-slate-500">{t('settings.mix.share')}</p>
              <div className="flex gap-2">
                {ROTATION_PERCENTS.map((pc) => (
                  <button
                    key={pc}
                    type="button"
                    role="radio"
                    aria-checked={mixPercent === pc}
                    onClick={() => set({ rotation: { courses: mixIds, percent: pc } })}
                    className={`rounded-lg border-2 px-3 py-1.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                      mixPercent === pc ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {t('settings.mix.percent', { percent: pc })}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Group>

        <Group title={t('settings.group.language')}>
          <LanguageMenu variant="inline" value={s.uiLanguage ?? course.defaultUiLanguage} onChange={(next) => set({ uiLanguage: next })} />
          <p className="mt-2 text-xs text-slate-500">{t('settings.uiLanguageDesc')}</p>
        </Group>

        <Group title={t('settings.group.curriculum')}>
          <div className="grid gap-2" role="radiogroup" aria-label={t('settings.curriculum')}>
            {course.curricula.map((c) => (
              <button
                key={c.id}
                role="radio"
                aria-checked={s.curriculum === c.id}
                onClick={() => set({ curriculum: c.id as Curriculum })}
                className={`rounded-xl border-2 p-3 text-left transition ${
                  s.curriculum === c.id ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                }`}
              >
                <span className="block font-medium">{t(`curriculum.${c.id}.name`)}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{t(`curriculum.${c.id}.desc`)}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">{t('settings.curriculumNote')}</p>
        </Group>

        <Group title={t('settings.group.audio')}>
          <div className="flex flex-wrap items-center gap-2">
            {SPEECH_RATES.map((r) => (
              <button
                key={r}
                onClick={() => set({ speechRate: r })}
                aria-pressed={s.speechRate === r}
                className={`rounded-lg border px-3 py-1.5 text-sm tabular-nums ${
                  s.speechRate === r ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {r}×
              </button>
            ))}
            <AudioButton
              speech={speech}
              text={course.speechSample}
              rate={s.speechRate}
              label={t('settings.audioTest')}
            />
          </div>
          <label className="mt-3 flex items-center justify-between gap-4">
            <span>{t('settings.soundEffectsHaptics')}</span>
            <Toggle checked={s.soundEffects} onChange={(v) => set({ soundEffects: v })} label={t('settings.soundEffects')} />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            {speech.voice
              ? t('settings.voice.local', { name: speech.voice.name, lang: speech.voice.lang })
              : t(course.track === 'english' ? 'settings.voice.stream.english' : 'settings.voice.stream.chinese')}
          </p>
        </Group>

        <Group title={t('settings.group.display')}>
          <div className="mb-3 flex items-center justify-between gap-4">
            <span>{t('settings.theme')}</span>
            <div className="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-600" role="radiogroup" aria-label={t('settings.theme')}>
              {(['system', 'light', 'dark'] as ThemePref[]).map((theme) => (
                <button
                  key={theme}
                  role="radio"
                  aria-checked={s.theme === theme}
                  onClick={() => set({ theme })}
                  className={`rounded-md px-3 py-1 text-sm ${s.theme === theme ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''}`}
                >
                  {t(`settings.theme.${theme}`)}
                </button>
              ))}
            </div>
          </div>
          {course.features.tones && (
            <label className="flex items-center justify-between gap-4">
              <span>
                {t('settings.colorTones')}
                <span className="ml-2 text-sm">
                  {TONE_DEMO.map(([syllable, className]) => (
                    <span key={syllable} className={`${className} mr-1`}>
                      {syllable}
                    </span>
                  ))}
                </span>
              </span>
              <Toggle checked={s.colorTones} onChange={(v) => set({ colorTones: v })} label={t('settings.colorTones')} />
            </label>
          )}
        </Group>

        <Group title={t('settings.pace')}>
          {/* Quick Presets */}
          <div className="mb-4">
            <span className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('settings.pace.presets')}
            </span>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {[
                { id: 'casual', label: t('settings.pace.casual'), newCards: 5, dailyCap: 25, sessionSize: 10, icon: '🐢' },
                { id: 'steady', label: t('settings.pace.steady'), newCards: 10, dailyCap: 50, sessionSize: 15, icon: '🚶' },
                { id: 'ambitious', label: t('settings.pace.ambitious'), newCards: 20, dailyCap: 100, sessionSize: 20, icon: '🏃' },
                { id: 'intensive', label: t('settings.pace.intensive'), newCards: 35, dailyCap: 200, sessionSize: 30, icon: '🚀' },
              ].map((p) => {
                const isActive =
                  s.newCardsPerDay === p.newCards &&
                  s.dailyCap === p.dailyCap &&
                  (s.sessionSize ?? 15) === p.sessionSize;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => set({ newCardsPerDay: p.newCards, dailyCap: p.dailyCap, sessionSize: p.sessionSize })}
                    className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center transition ${
                      isActive
                        ? 'border-rose-500 bg-rose-50 font-semibold text-rose-800 shadow-xs dark:bg-rose-950/40 dark:text-rose-200'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:bg-slate-700/40'
                    }`}
                  >
                    <span className="text-base">{p.icon}</span>
                    <span className="text-xs font-medium">{p.label}</span>
                    <span className="text-[10px] text-slate-400 tabular-nums">+{p.newCards} / {p.dailyCap}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <RangeSlider
            label={t('settings.newCards')}
            value={s.newCardsPerDay}
            min={0}
            max={50}
            step={1}
            unit={t('settings.unit.wordsPerDay')}
            description={t('settings.newCardsDesc')}
            onChange={(v) => set({ newCardsPerDay: v })}
          />

          <RangeSlider
            label={t('settings.dailyCap')}
            value={s.dailyCap}
            min={10}
            max={300}
            step={5}
            unit={t('settings.unit.cardsPerDay')}
            description={t('settings.dailyCapDesc')}
            onChange={(v) => set({ dailyCap: v })}
          />

          <RangeSlider
            label={t('settings.sessionSize')}
            value={s.sessionSize ?? 15}
            min={5}
            max={40}
            step={5}
            unit={t('settings.unit.cards')}
            description={t('settings.sessionSizeDesc')}
            onChange={(v) => set({ sessionSize: v })}
          />

          <label className="mt-3 flex items-center justify-between gap-4">
            <span className="text-sm font-medium">{t('settings.defaultMode')}</span>
            <select
              value={s.defaultMode}
              onChange={(e) => set({ defaultMode: e.target.value as StudyMode })}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
            >
              {(course.track === 'english' ? ENGLISH_MODES : CHINESE_MODES).map((m) => (
                <option key={m.id} value={m.id}>
                  {t(m.titleKey)}
                </option>
              ))}
            </select>
          </label>
        </Group>

        {course.features.pinyin && (
          <Group title={t('settings.pinyinHelper')}>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              {t('settings.pinyinHelperDesc')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label={t('settings.pinyinMode')}>
              {[
                {
                  id: 'adaptive',
                  title: t('settings.pinyinMode.adaptive'),
                  desc: t('settings.pinyinMode.adaptive.desc'),
                  icon: '🧠',
                },
                {
                  id: 'flip',
                  title: t('settings.pinyinMode.flip'),
                  desc: t('settings.pinyinMode.flip.desc'),
                  icon: '🃏',
                },
                {
                  id: 'always',
                  title: t('settings.pinyinMode.always'),
                  desc: t('settings.pinyinMode.always.desc'),
                  icon: '👁️',
                },
                {
                  id: 'never',
                  title: t('settings.pinyinMode.never'),
                  desc: t('settings.pinyinMode.never.desc'),
                  icon: '🔒',
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={(s.pinyinHelperMode ?? 'adaptive') === opt.id}
                  onClick={() => set({ pinyinHelperMode: opt.id as PinyinHelperMode })}
                  className={`rounded-xl border-2 p-3 text-left transition ${
                    (s.pinyinHelperMode ?? 'adaptive') === opt.id
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-sm">
                    <span>{opt.icon}</span>
                    <span>{opt.title}</span>
                  </div>
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>

            {(s.pinyinHelperMode ?? 'adaptive') === 'adaptive' && (
              <div className="mt-3 rounded-2xl border border-amber-200/80 bg-amber-50/50 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/20">
                <RangeSlider
                  label={t('settings.pinyinThreshold')}
                  value={s.pinyinAdaptiveThreshold ?? 2}
                  min={1}
                  max={5}
                  step={1}
                  unit={t('settings.unit.mistakes')}
                  description={t('settings.pinyinThresholdDesc')}
                  onChange={(v) => set({ pinyinAdaptiveThreshold: v })}
                />
              </div>
            )}
          </Group>
        )}

        <Group title={t('settings.group.sync')}>
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                  <Zap className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t(syncKey ? 'settings.sync.activeTitle' : 'settings.sync.inactiveTitle')}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t(syncKey ? 'settings.sync.activeDesc' : 'settings.sync.inactiveDesc')}
                  </p>
                </div>
              </div>
              {syncKey && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> {t('settings.sync.badge')}
                </span>
              )}
            </div>

            <button
              onClick={onOpenSyncModal}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
            >
              <QrCode className="h-3.5 w-3.5" />
              {t(syncKey ? 'settings.sync.manage' : 'settings.sync.link')}
            </button>
          </div>
        </Group>

        <Group title={t('settings.group.data')}>
          <p className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">
            <Database className="h-3.5 w-3.5" /> {t('settings.storedIn', { backend: t(BACKEND_LABEL[backend]) })}
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={async () => exportBackup(state, await exportableGrammarProgress())} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900">
              <Download className="h-4 w-4" /> {t('settings.export')}
            </button>
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700">
              <Upload className="h-4 w-4" /> {t('settings.import')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = '';
              }}
            />
            <button onClick={handleReset} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">
              <Trash2 className="h-4 w-4" /> {t('settings.reset')}
            </button>
          </div>
          {message && (
            <p role="status" className={`mt-2 text-sm ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>
              {message.text}
            </p>
          )}
        </Group>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function RangeSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  description,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  description?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
        <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 tabular-nums dark:bg-rose-950/60 dark:text-rose-300">
          {value} {unit}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold text-slate-400 tabular-nums">{min}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const numVal = Number(e.target.value);
            if (Number.isFinite(numVal)) {
              onChange(Math.max(min, Math.min(max, numVal)));
            }
          }}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 dark:bg-slate-700"
        />
        <span className="text-[11px] font-semibold text-slate-400 tabular-nums">{max}</span>
      </div>
      {description && <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>}
    </div>
  );
}
