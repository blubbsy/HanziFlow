import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { LOCALE_META, UI_LANGUAGES, type UiLanguage } from '../i18n';
import { useI18n } from '../i18n/react';

interface Props {
  value: UiLanguage;
  onChange: (lang: UiLanguage) => void;
  /** `popover`: button + menu; `compact`: short button for the top bar; `inline`: all options visible (Settings). */
  variant?: 'popover' | 'compact' | 'inline';
  /** Open the menu above the button (for controls at the bottom of the screen). */
  openUp?: boolean;
  className?: string;
}

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400';

/** Language names are written in their own language and tagged with it so screen readers pronounce them correctly. */
function LanguageName({ lang }: { lang: UiLanguage }) {
  const meta = LOCALE_META[lang];
  return (
    <span lang={meta.htmlLang} className="min-w-0 truncate">
      {meta.nativeName}
    </span>
  );
}

export function LanguageMenu({ value, onChange, variant = 'popover', openUp = false, className = '' }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (lang: UiLanguage) => {
    onChange(lang);
    setOpen(false);
    triggerRef.current?.focus();
  };

  if (variant === 'inline') {
    return (
      <div role="radiogroup" aria-label={t('app.language')} className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${className}`}>
        {UI_LANGUAGES.map((lang) => {
          const selected = lang === value;
          return (
            <button
              key={lang}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(lang)}
              className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition ${focusRing} ${
                selected ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
              }`}
            >
              <span aria-hidden>{LOCALE_META[lang].flag}</span>
              <LanguageName lang={lang} />
            </button>
          );
        })}
      </div>
    );
  }

  const compact = variant === 'compact';
  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('app.language')}
        title={t('app.language')}
        className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${focusRing} ${
          compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1 text-xs'
        }`}
      >
        <span aria-hidden>{LOCALE_META[value].flag}</span>
        {compact ? <span lang={LOCALE_META[value].htmlLang}>{value.toUpperCase()}</span> : <LanguageName lang={value} />}
        <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t('lang.select')}
          className={`absolute z-50 min-w-[10rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800 ${
            openUp ? 'bottom-full left-0 mb-1' : 'right-0 mt-1 lg:left-0 lg:right-auto'
          }`}
        >
          {UI_LANGUAGES.map((lang) => {
            const selected = lang === value;
            return (
              <button
                key={lang}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                autoFocus={selected}
                onClick={() => choose(lang)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${focusRing} ${
                  selected ? 'font-semibold text-rose-600 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <span aria-hidden>{LOCALE_META[lang].flag}</span>
                <LanguageName lang={lang} />
                {selected && <Check className="ml-auto h-4 w-4 shrink-0" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
