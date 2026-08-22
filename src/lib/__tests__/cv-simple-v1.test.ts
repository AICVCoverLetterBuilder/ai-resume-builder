import { describe, expect, it, vi } from 'vitest';
import { applyCanonicalSummaryEdit } from '../cv-canonical-snapshot';
import { createEmptyCv } from '../cv-defaults';
import { normalizeLegacyCvRuntime } from '../cv-legacy-runtime-migration';
import {
  getCvContentLocale,
  getCvEditorContentLocale,
  getCvSummaryText,
  isCvSimpleV1Enabled,
  materializeSimpleV1ContentLocale,
  normalizeSupportedCvContentLocale,
  resolveCvRuntimeForUi,
} from '../cv-simple-v1';
import type { CVData } from '../types';

function populatedCv(contentLocale: CVData['contentLocale'] = 'sr'): CVData {
  const cv = createEmptyCv(contentLocale);
  return {
    ...cv,
    personal: {
      fullName: 'Milica Petrović',
      email: 'milica@example.test',
      phone: '+381 11 555 0101',
      address: 'Beograd',
      jobTitle: 'Operativna menadžerka',
    },
    summary: 'CURRENT TEXT A',
    canonicalSummary: 'STALE TEXT B',
    summaryGeneratedLocale: 'ja',
    summaryOrigin: 'ai_generated',
    experience: Array.from({ length: 5 }, (_, index) => ({
      id: `experience-${index + 1}`,
      company: `Kompanija ${index + 1}`,
      position: `Pozicija ${index + 1}`,
      startDate: '2020-01',
      endDate: '',
      isPresent: true,
      description: `Opis posla ${index + 1}`,
    })),
    education: [{
      id: 'education-1',
      school: 'Univerzitet u Beogradu',
      degree: 'Diplomirani ekonomista',
      startDate: '2015-10',
      endDate: '2019-06',
      description: 'Poslovna ekonomija',
    }],
    skills: ['Planiranje', 'Organizacija'],
  };
}

describe('Simple V1 content locale and Summary authority', () => {
  it('sets a new Serbian CV contentLocale from its current UI locale', () => {
    expect(createEmptyCv('sr').contentLocale).toBe('sr');
  });

  it('sets a new Japanese CV contentLocale from its current UI locale', () => {
    expect(createEmptyCv('ja').contentLocale).toBe('ja');
  });

  it('keeps explicit contentLocale independent while UI locale changes', () => {
    const cv = populatedCv('sr');

    for (const uiLocale of ['sr', 'en', 'ar', 'de'] as const) {
      expect(getCvContentLocale(cv, { uiLocale })).toBe('sr');
      expect(materializeSimpleV1ContentLocale(cv, { uiLocale })).toBe(cv);
    }
  });

  it('does not mutate populated CV content across repeated UI-locale switches', () => {
    const cv = populatedCv('sr');
    const before = structuredClone(cv);
    let after = cv;

    for (const uiLocale of ['sr', 'en', 'ar', 'hi', 'ja', 'de'] as const) {
      after = materializeSimpleV1ContentLocale(after, { uiLocale });
      expect(getCvContentLocale(after, { uiLocale })).toBe('sr');
    }

    expect(after).toBe(cv);
    expect(after).toStrictEqual(before);
  });

  it('preserves an existing explicit contentLocale and canonicalizes it', () => {
    const cv = { ...populatedCv('sr'), contentLocale: 'pt-BR' as const };

    expect(getCvContentLocale(cv, { uiLocale: 'ja' })).toBe('pt-BR');
    expect(materializeSimpleV1ContentLocale(cv, { uiLocale: 'ja' })).toBe(cv);
  });

  it('uses only the UI-locale compatibility bridge for a legacy CV without contentLocale', () => {
    const { contentLocale: _legacyContentLocale, ...legacyCv } = populatedCv('sr');
    const bridged = materializeSimpleV1ContentLocale(legacyCv, { uiLocale: 'ja' });
    const { contentLocale, ...bridgedWithoutContentLocale } = bridged;

    expect(contentLocale).toBe('ja');
    expect(bridgedWithoutContentLocale).toStrictEqual(legacyCv);
    expect(getCvSummaryText(bridged)).toBe('CURRENT TEXT A');
  });

  it('does not inspect, translate, or otherwise mutate legacy text while bridging', () => {
    const { contentLocale: _legacyContentLocale, ...legacyCv } = populatedCv('sr');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    try {
      const bridged = materializeSimpleV1ContentLocale(legacyCv, { uiLocale: 'ar' });
      expect(bridged.contentLocale).toBe('ar');
      expect(bridged.summary).toBe(legacyCv.summary);
      expect(bridged.experience).toBe(legacyCv.experience);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('selects visible saved cv.summary over stale legacy Summary metadata', () => {
    const cv = {
      ...populatedCv('sr'),
      generatedSummary: 'STALE TEXT B',
      recoveredSummary: 'STALE TEXT B',
      selectedFinalSummary: 'STALE TEXT B',
    };

    expect(getCvSummaryText(cv)).toBe('CURRENT TEXT A');
  });

  it('does not let stale generatedLocale replace the saved Summary during UI changes', () => {
    const cv = populatedCv('sr');

    for (const uiLocale of ['en', 'ja', 'ar'] as const) {
      const sameCv = materializeSimpleV1ContentLocale(cv, { uiLocale });
      expect(getCvSummaryText(sameCv)).toBe('CURRENT TEXT A');
      expect(sameCv.summaryGeneratedLocale).toBe('ja');
    }
  });

  it('normalizes every supported Simple V1 contentLocale', () => {
    const supported = ['sr', 'en', 'hi', 'ar', 'ja', 'de', 'fr', 'es', 'it', 'hr', 'pt-BR', 'ru'] as const;

    for (const locale of supported) {
      expect(normalizeSupportedCvContentLocale(locale)).toBe(locale);
    }
    expect(normalizeSupportedCvContentLocale('pt_br')).toBe('pt-BR');
  });

  it('keeps editor content-locale binding stable under Simple V1', () => {
    const cv = populatedCv('sr');
    const editorLocale = getCvEditorContentLocale(cv, 'de', true);
    const edited = applyCanonicalSummaryEdit(cv, 'Izmenjen sažetak', editorLocale);

    expect(editorLocale).toBe('sr');
    expect(edited.contentLocale).toBe('sr');
  });

  it('keeps feature-off runtime routing on the unchanged legacy migration', () => {
    const { contentLocale: _legacyContentLocale, ...legacyCv } = populatedCv('sr');
    const expectedLegacy = normalizeLegacyCvRuntime(legacyCv, 'ja');

    expect(isCvSimpleV1Enabled('false')).toBe(false);
    expect(resolveCvRuntimeForUi(legacyCv, 'ja', false)).toStrictEqual(expectedLegacy);
    expect(resolveCvRuntimeForUi(legacyCv, 'ja', true)).toStrictEqual({
      ...legacyCv,
      contentLocale: 'ja',
    });
  });

  it('does not perform AI or network work while resolving content locale', () => {
    const cv = populatedCv('sr');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    try {
      expect(getCvContentLocale(cv, { uiLocale: 'de' })).toBe('sr');
      expect(resolveCvRuntimeForUi(cv, 'de', true)).toBe(cv);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
