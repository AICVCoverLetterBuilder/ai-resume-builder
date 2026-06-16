import { describe, expect, test } from 'vitest';
import {
  DEFAULT_LOCALE,
  resolveInitialLocalePreference,
} from '../i18n/translations';

describe('resolveInitialLocalePreference', () => {
  test('defaults to English when no language preference is saved', () => {
    expect(resolveInitialLocalePreference(null)).toBe(DEFAULT_LOCALE);
    expect(resolveInitialLocalePreference(undefined)).toBe(DEFAULT_LOCALE);
  });

  test('ignores unsupported browser or device locales on first launch', () => {
    expect(resolveInitialLocalePreference(null)).toBe(DEFAULT_LOCALE);
  });

  test('restores a manually saved locale on future visits', () => {
    expect(resolveInitialLocalePreference('sr')).toBe('sr');
    expect(resolveInitialLocalePreference('de-DE')).toBe('de');
    expect(resolveInitialLocalePreference('pt')).toBe('pt-BR');
  });

  test('keeps the saved locale as the single source of truth', () => {
    expect(resolveInitialLocalePreference('en')).toBe('en');
    expect(resolveInitialLocalePreference('ja')).toBe('ja');
  });
});
