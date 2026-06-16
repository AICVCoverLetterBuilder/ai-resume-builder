import type { Locale } from './i18n/translations';

const CV_LANGUAGE_CODES = [
  'en',
  'de',
  'fr',
  'es',
  'it',
  'ar',
  'sr',
  'hr',
  'ru',
  'pt',
  'hi',
  'ja',
  'zh',
  'ko',
  'tr',
  'nl',
  'pl',
  'uk',
  'ro',
  'el',
  'cs',
  'sv',
  'da',
  'fi',
] as const;

type CvLanguageCode = (typeof CV_LANGUAGE_CODES)[number];

export interface CvLanguageOption {
  code: CvLanguageCode;
  canonicalName: string;
  localizedLabel: string;
  searchTerms: string[];
}

const FALLBACK_ENGLISH_LABELS: Record<CvLanguageCode, string> = {
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  ar: 'Arabic',
  sr: 'Serbian',
  hr: 'Croatian',
  ru: 'Russian',
  pt: 'Portuguese',
  hi: 'Hindi',
  ja: 'Japanese',
  zh: 'Chinese',
  ko: 'Korean',
  tr: 'Turkish',
  nl: 'Dutch',
  pl: 'Polish',
  uk: 'Ukrainian',
  ro: 'Romanian',
  el: 'Greek',
  cs: 'Czech',
  sv: 'Swedish',
  da: 'Danish',
  fi: 'Finnish',
};

const LANGUAGE_ALIASES: Partial<Record<CvLanguageCode, string[]>> = {
  en: ['eng'],
  de: ['deu', 'deutsch'],
  fr: ['fra', 'francais', 'français'],
  es: ['spa', 'espanol', 'español'],
  it: ['ita', 'italiano'],
  ar: ['ara', 'arabic'],
  sr: ['srpski', 'serbian latin'],
  hr: ['hrvatski'],
  ru: ['rus', 'russian'],
  pt: ['por', 'portuguese', 'portugues', 'português'],
  hi: ['hin'],
  ja: ['jpn', 'nihongo'],
  zh: ['chi', 'zho', 'mandarin'],
  ko: ['kor', 'hangul'],
  tr: ['tur', 'turkce', 'türkçe'],
  nl: ['nld', 'dutch', 'nederlands'],
  pl: ['pol', 'polski'],
  uk: ['ukr', 'ukrainian'],
  ro: ['ron', 'romanian', 'română', 'romana'],
  el: ['ell', 'greek', 'ellinika', 'ελληνικά'],
  cs: ['ces', 'czech', 'čeština', 'cestina'],
  sv: ['swe', 'svenska'],
  da: ['dan', 'dansk'],
  fi: ['fin', 'suomi'],
};

const DISPLAY_LOCALES: Record<Locale, string> = {
  en: 'en',
  de: 'de',
  es: 'es',
  fr: 'fr',
  it: 'it',
  ar: 'ar',
  sr: 'sr-Latn',
  hr: 'hr',
  ru: 'ru',
  'pt-BR': 'pt-BR',
  hi: 'hi',
  ja: 'ja',
};

const displayNamesCache = new Map<string, Intl.DisplayNames | null>();

function getDisplayNames(locale: string): Intl.DisplayNames | null {
  const cached = displayNamesCache.get(locale);
  if (cached !== undefined) return cached;

  try {
    const formatter = new Intl.DisplayNames([locale], { type: 'language' });
    displayNamesCache.set(locale, formatter);
    return formatter;
  } catch {
    displayNamesCache.set(locale, null);
    return null;
  }
}

function normalizeSearchValue(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getDisplayLocale(locale: Locale): string {
  return DISPLAY_LOCALES[locale] ?? 'en';
}

function getNativeLocale(code: CvLanguageCode): string {
  if (code === 'sr') return 'sr-Latn';
  if (code === 'pt') return 'pt-BR';
  return code;
}

function getLanguageLabel(code: CvLanguageCode, locale: string): string {
  const formatter = getDisplayNames(locale);
  return formatter?.of(code) ?? FALLBACK_ENGLISH_LABELS[code];
}

function getCanonicalName(code: CvLanguageCode): string {
  return getLanguageLabel(code, 'en');
}

function getSearchTerms(code: CvLanguageCode): string[] {
  const terms = new Set<string>([
    code,
    getCanonicalName(code),
    getLanguageLabel(code, getNativeLocale(code)),
    ...(LANGUAGE_ALIASES[code] ?? []),
  ]);

  Object.values(DISPLAY_LOCALES).forEach((locale) => {
    terms.add(getLanguageLabel(code, locale));
  });

  return Array.from(terms).filter(Boolean);
}

function matchesKnownLanguage(input: string, code: CvLanguageCode): boolean {
  const normalizedInput = normalizeSearchValue(input);
  if (!normalizedInput) return false;

  return getSearchTerms(code).some((term) => normalizeSearchValue(term) === normalizedInput);
}

export function getCvLanguageOptions(locale: Locale): CvLanguageOption[] {
  const displayLocale = getDisplayLocale(locale);

  return CV_LANGUAGE_CODES.map((code) => ({
    code,
    canonicalName: getCanonicalName(code),
    localizedLabel: getLanguageLabel(code, displayLocale),
    searchTerms: getSearchTerms(code),
  }));
}

export function filterCvLanguageOptions(
  query: string,
  locale: Locale,
  selectedNames: string[] = [],
): CvLanguageOption[] {
  const normalizedQuery = normalizeSearchValue(query);
  const selected = new Set(selectedNames.map((name) => normalizeSearchValue(resolveStoredCvLanguageName(name) ?? name)));

  return getCvLanguageOptions(locale)
    .filter((option) => !selected.has(normalizeSearchValue(option.canonicalName)))
    .filter((option) => {
      if (!normalizedQuery) return true;
      return option.searchTerms.some((term) => normalizeSearchValue(term).includes(normalizedQuery));
    })
    .sort((left, right) => {
      const leftStartsWith = left.searchTerms.some((term) => normalizeSearchValue(term).startsWith(normalizedQuery));
      const rightStartsWith = right.searchTerms.some((term) => normalizeSearchValue(term).startsWith(normalizedQuery));

      if (leftStartsWith !== rightStartsWith) return leftStartsWith ? -1 : 1;
      return left.localizedLabel.localeCompare(right.localizedLabel);
    });
}

export function resolveStoredCvLanguageName(input: string): string | null {
  const trimmedInput = input.trim();
  if (!trimmedInput) return null;

  const matchedCode = CV_LANGUAGE_CODES.find((code) => matchesKnownLanguage(trimmedInput, code));
  return matchedCode ? getCanonicalName(matchedCode) : null;
}

export function getLocalizedCvLanguageName(input: string, locale: Locale): string {
  const trimmedInput = input.trim();
  if (!trimmedInput) return input;

  const matchedCode = CV_LANGUAGE_CODES.find((code) => matchesKnownLanguage(trimmedInput, code));
  return matchedCode ? getLanguageLabel(matchedCode, getDisplayLocale(locale)) : input;
}
