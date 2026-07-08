import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { translations, Locale, LOCALES, TranslationKey } from './translations';

const LOCALE_KEY = 'qa-board.locale';

function getInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY) as Locale | null;
    if (stored && stored in translations) return stored;
  } catch { /* ignore */ }

  // Try to detect from browser language
  const browserLang = navigator.language.split('-')[0] as Locale;
  if (browserLang in translations) return browserLang;

  return 'en';
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  formatDate: (dateString: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try { localStorage.setItem(LOCALE_KEY, next); } catch { /* ignore */ }
  }, []);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = translations[locale][key] ?? translations['en'][key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  }, [locale]);

  const formatDate = useCallback((dateString: string): string => {
    const localeInfo = LOCALES.find(l => l.code === locale) ?? LOCALES[0];
    return new Intl.DateTimeFormat(localeInfo.dateLocale, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, formatDate }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
