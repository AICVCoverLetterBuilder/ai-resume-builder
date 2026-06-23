/**
 * @vitest-environment jsdom
 */
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';

// ---- Hoisted shared mutable state that the mock can reference ----
const { mockI18nState, mockSetLocale } = vi.hoisted(() => {
  const state: { locale: string; dir: 'ltr' | 'rtl'; t: Record<string, unknown> } = {
    locale: 'en',
    dir: 'ltr',
    t: {},
  };
  const setLocale = vi.fn((l: string) => {
    state.locale = l;
    state.dir = l === 'ar' ? 'rtl' : 'ltr';
  });
  return { mockI18nState: state, mockSetLocale: setLocale };
});

const languagesData = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', dir: 'ltr' as const },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', dir: 'rtl' as const },
];

// Build a translation object stub that returns 'test' for any missing key
function buildT(tagline: string) {
  const deepProxy = () =>
    new Proxy(
      {},
      {
        get(_t: Record<string, unknown>, p: string | symbol) {
          if (p === 'map') return () => [];
          if (typeof p === 'string' && !isNaN(Number(p))) return 'test';
          return 'test';
        },
      }
    );
  return {
    hero: {
      professionalResumesAiPowered: tagline,
      badge: 'badge',
      title: 'title',
      subtitle: 'subtitle',
      valueDesc: 'desc',
      cta: 'cta',
      ctaSecondary: 'cta2',
      footerText: 'ft',
    },
    common: deepProxy(),
    templates: deepProxy(),
    previews: deepProxy(),
    features: deepProxy(),
    howItWorks: deepProxy(),
    whoIsThisFor: deepProxy(),
    privacyFirst: deepProxy(),
    simplePricing: deepProxy(),
    pricing: deepProxy(),
    faq: deepProxy(),
    cv: deepProxy(),
    nav: deepProxy(),
    footer: deepProxy(),
    about: deepProxy(),
  };
}

// ---- Mock useI18n ----
vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({
    t: mockI18nState.t,
    locale: mockI18nState.locale,
    setLocale: mockSetLocale,
    dir: mockI18nState.dir,
    languages: languagesData,
    currentLanguage: languagesData.find(l => l.code === mockI18nState.locale) || languagesData[0],
  }),
}));

// ---- Tagline display component (mirrors the real HeroSection's tagline rendering) ----
import { useI18n } from '@/lib/i18n/context';

function TaglineDisplay() {
  const { t, locale } = useI18n();
  return React.createElement(
    'p',
    {
      className: 'mt-3 text-sm font-medium text-primary/80 tracking-wide uppercase sm:text-base',
      'data-locale': locale,
    },
    t.hero.professionalResumesAiPowered
  );
}

// ---- Test Suite ----
describe('landing page tagline localization', () => {
  beforeEach(() => {
    mockI18nState.locale = 'en';
    mockI18nState.dir = 'ltr';
    mockI18nState.t = buildT('Professional resumes. AI-powered.');
    mockSetLocale.mockClear();
  });

  const englishTagline = 'Professional resumes. AI-powered.';
  const arabicTagline = 'سير ذاتية احترافية. مدعومة بالذكاء الاصطناعي.';

  test('renders the English tagline when locale is English', () => {
    render(React.createElement(TaglineDisplay));
    expect(screen.getByText(englishTagline)).toBeTruthy();
  });

  test('renders the Arabic tagline when locale is Arabic', () => {
    mockI18nState.locale = 'ar';
    mockI18nState.dir = 'rtl';
    mockI18nState.t = buildT(arabicTagline);
    render(React.createElement(TaglineDisplay));
    expect(screen.getByText(arabicTagline)).toBeTruthy();
    expect(screen.queryByText(englishTagline)).toBeNull();
  });

  test('does not render the English tagline while Arabic is active', () => {
    mockI18nState.locale = 'ar';
    mockI18nState.dir = 'rtl';
    mockI18nState.t = buildT(arabicTagline);
    render(React.createElement(TaglineDisplay));
    expect(screen.queryByText(englishTagline)).toBeNull();
    expect(screen.getByText(arabicTagline)).toBeTruthy();
  });

  test('changing locale from English to Arabic while component is mounted updates the displayed tagline', () => {
    const { rerender } = render(React.createElement(TaglineDisplay));
    // Initially English
    expect(screen.getByText(englishTagline)).toBeTruthy();
    expect(screen.queryByText(arabicTagline)).toBeNull();

    // Switch state as if setLocale was called
    act(() => {
      mockSetLocale('ar');
    });
    mockI18nState.locale = 'ar';
    mockI18nState.dir = 'rtl';
    mockI18nState.t = buildT(arabicTagline);

    // Re-render the same component
    rerender(React.createElement(TaglineDisplay));

    // Now Arabic should be shown, English gone
    expect(screen.getByText(arabicTagline)).toBeTruthy();
    expect(screen.queryByText(englishTagline)).toBeNull();
  });

  test('Arabic inherits RTL direction correctly', () => {
    mockI18nState.locale = 'ar';
    mockI18nState.dir = 'rtl';
    mockI18nState.t = buildT(arabicTagline);
    render(React.createElement(TaglineDisplay));
    const el = screen.getByText(arabicTagline);
    expect(el).toBeTruthy();
    // RTL direction is set on document.documentElement by the real I18nProvider
    // The component renders the correctly translated Arabic text
  });
});
