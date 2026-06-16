'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  type Locale,
  type TranslationKeys,
  translations,
  languages,
  type LanguageInfo,
  resolveInitialLocalePreference,
  en,
} from './translations';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationKeys;
  dir: 'ltr' | 'rtl';
  languages: LanguageInfo[];
  currentLanguage: LanguageInfo;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

function getSavedOrDefaultLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  return resolveInitialLocalePreference(localStorage.getItem(LOCALE_STORAGE_KEY));
}

/**
 * Creates a Proxy that falls back to English when a translation key is missing.
 * This prevents blank pages caused by missing keys in non-English locales.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createSafeT(locale: Locale, obj: Record<string, unknown>, path: string = '', enFallback?: Record<string, unknown>): any {
  // If the target is not an object (e.g., missing translation),
  // fall back to the English object at this path to avoid blank renders.
  const target = (obj && typeof obj === 'object') ? obj : (enFallback && typeof enFallback === 'object' ? enFallback : {});
  const fallback = (enFallback && typeof enFallback === 'object') ? enFallback : {};

  if (!obj || typeof obj !== 'object') {
    console.warn(`[i18n] Missing translation object for locale: "${locale}" at path: "${path || 'root'}", using English fallback`);
  }

  return new Proxy(target, {
    get(targetObj, prop, receiver) {
      const key = String(prop);
      const currentPath = path ? `${path}.${key}` : key;
      const value = Reflect.get(targetObj, prop, receiver);
      const enValue = (fallback as Record<string, unknown>)[key];

      if (value === undefined) {
        // Fall back to English value if available, otherwise empty string
        if (enValue !== undefined) {
          console.warn(`[i18n] MISSING_KEY: "${currentPath}" in locale: "${locale}", using English fallback`);
          if (typeof enValue === 'object' && enValue !== null && !Array.isArray(enValue)) {
            return createSafeT(locale, enValue as Record<string, unknown>, currentPath, enValue as Record<string, unknown>);
          }
          return enValue;
        }
        console.error(`[i18n] MISSING_KEY: "${currentPath}" in locale: "${locale}" — no English fallback available`);
        return '';
      }

      // If the value is a nested object, make it safe with English fallback
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const enNestedFallback = (typeof enValue === 'object' && enValue !== null && !Array.isArray(enValue))
          ? enValue as Record<string, unknown>
          : undefined;
        return createSafeT(locale, value as Record<string, unknown>, currentPath, enNestedFallback);
      }

      return value;
    }
  });
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const savedLocale = getSavedOrDefaultLocale();
    setLocaleState(savedLocale);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    const lang = languages.find(l => l.code === newLocale);
    document.documentElement.dir = lang?.dir || 'ltr';
    document.documentElement.lang = newLocale;
    window.__cvproLocale = newLocale;
  }, []);

  useEffect(() => {
    const lang = languages.find(l => l.code === locale);
    document.documentElement.dir = lang?.dir || 'ltr';
    document.documentElement.lang = locale;
    window.__cvproLocale = locale;
  }, [locale]);

  const currentLanguage = languages.find(l => l.code === locale) || languages[0];

  // Wrap translations in a safety proxy — falls back to English for any missing key
  const safeT = useMemo(() => createSafeT(locale, translations[locale] as unknown as Record<string, unknown>, '', en as unknown as Record<string, unknown>) as TranslationKeys, [locale]);

  return (
    <I18nContext.Provider value={{
      locale,
      setLocale,
      t: safeT,
      dir: currentLanguage.dir,
      languages,
      currentLanguage,
    }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
}

declare global {
  interface Window {
    __cvproLocale?: Locale;
  }
}
