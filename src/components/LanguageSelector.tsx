import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { LOCALES, Locale } from '../i18n/translations';

export function LanguageSelector() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LOCALES.find(l => l.code === locale) ?? LOCALES[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
        aria-label="Change language"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{current.flag}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
          {LOCALES.map((loc) => (
            <button
              key={loc.code}
              onClick={() => { setLocale(loc.code as Locale); setOpen(false); }}
              className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
                locale === loc.code
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <span className="text-base">{loc.flag}</span>
              <span>{loc.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
