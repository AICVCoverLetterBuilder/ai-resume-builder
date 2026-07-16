/**
 * Android build 224 regression: Serbian-authored CV content + a non-Serbian
 * requested locale (German, Hindi, Arabic, Japanese, English, ...) produced a
 * localized "AI output failed validation" toast for Generate Summary/Bullets,
 * even though Serbian -> Serbian generation worked.
 *
 * Root cause (see cv-ai-locale-guard.ts and cv-experience-duration.ts):
 *  - `validateSummaryDuration` ignored the requested locale, so translated
 *    duration phrases ("vier Jahre", "चार वर्षों") were never recognized and
 *    the summary was rejected as failing duration grounding.
 *  - The deterministic fallback's generic-duty intent classifier used
 *    `\b<stem>\b`, which never matches inside inflected Serbian/Croatian forms
 *    ("saradnja", "koordinacija", "planiranje", "izveštaja"), so the localized
 *    fallback silently produced no duty text for German/Spanish/etc. and
 *    fell through to blocked.
 *  - `GENERIC_INTENT_BULLET` lacked translations for most locales, so even a
 *    successfully classified duty fell back to English text for a German/
 *    Hindi/Arabic/Japanese/etc. request.
 *  - Nothing validated that freshly-generated text was actually written in the
 *    requested locale, so a provider response that echoed the Serbian source
 *    (or a caller-supplied hint built from frozen Serbian canonical text) could
 *    slip through unchallenged.
 *
 * This file locks in the fix across all 12 supported locales.
 */
import { describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import { sealCanonicalFromValidatedSource, acceptValidatedAiContent } from '@/lib/cv-canonical-snapshot';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { finalizeClientAiSummary } from '@/lib/cv-summary-integrity';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import { deterministicLocalizedSummaryFromCanonical } from '@/lib/cv-localized-fallback';
import { isWrongLanguageAiOutput } from '@/lib/cv-ai-locale-guard';
import { activateCvSummary } from '@/lib/cv-content-activation';

const REF = '2026-07-15';

const SR_BULLETS = [
  'Razvoj i implementacija internih procesa',
  'Saradnja sa međufunkcionalnim timovima na izvršenju projekata',
  'Analiza poslovnih podataka i priprema izveštaja za rukovodstvo',
  'Planiranje i koordinacija aktivnosti odeljenja',
].map((b) => `• ${b}`).join('\n');

function srCv(overrides?: Partial<CVData>): CVData {
  const cv: CVData = {
    id: 'sr-op-1',
    name: 'Operator',
    personal: {
      fullName: 'Testni Operater',
      email: 'op@example.com',
      phone: '+381',
      address: 'Belgrade',
      jobTitle: 'OPERATER U PROIZVODNJI',
      gender: 'female',
    },
    summary: 'Operaterka u proizvodnji sa iskustvom u procesima i izveštavanju.',
    experience: [
      {
        id: 'exp-hilux',
        company: 'Hilux',
        position: 'Operater u proizvodnji',
        startDate: '2022-01',
        endDate: '',
        isPresent: true,
        description: SR_BULLETS,
        canonicalDescription: SR_BULLETS,
      },
    ],
    education: [],
    skills: ['Upravljanje projektima'],
    certifications: [],
    languages: [{ name: 'Engleski', level: 'Napredni' }],
    templateId: 'creative-artistic',
    region: 'Balkan',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
  return sealCanonicalFromValidatedSource(cv, {
    locale: 'sr',
    createdFrom: 'user_structured_input',
    revise: false,
  });
}

const ALL_LOCALES: Locale[] = ['en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja'];

const SCRIPT_EXPECTATION: Partial<Record<Locale, RegExp>> = {
  hi: /[\u0900-\u097F]/,
  ar: /[\u0600-\u06FF]/,
  ja: /[\u3040-\u30FF\u3400-\u9FFF]/,
  ru: /[\u0400-\u04FF]/,
};

describe('Cross-locale AI generation regression (Android build 224)', () => {
  const cv = srCv();
  const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);

  describe('1. Target locale acceptance — Serbian source, every supported requested locale', () => {
    for (const locale of ALL_LOCALES) {
      it(`sr source -> ${locale} requested: grounded fallback is valid, correct script, and applies with contentLocale=${locale}`, () => {
        const factSet = buildCvCanonicalFactSet(cv);
        const grounded = deterministicLocalizedSummaryFromCanonical(
          factSet,
          locale,
          'female',
          durationSnapshot.total,
        );
        expect(grounded).toBeTruthy();

        // Feed the grounded candidate through the exact same client finalize path
        // Generate Summary uses in production.
        const finalized = finalizeClientAiSummary(grounded, cv, locale, durationSnapshot);
        expect(finalized.blocked).toBe(false);
        expect(finalized.summary.trim().length).toBeGreaterThan(0);

        // Serbian text must never satisfy a non-Serbian/Croatian request.
        if (locale !== 'sr' && locale !== 'hr') {
          expect(isWrongLanguageAiOutput(finalized.summary, locale)).toBe(false);
        }
        const scriptRe = SCRIPT_EXPECTATION[locale];
        if (scriptRe) {
          expect(finalized.summary).toMatch(scriptRe);
        }

        const nextCv = acceptValidatedAiContent(cv, {
          locale,
          summary: finalized.summary,
          summaryOrigin: finalized.origin,
        });
        expect(nextCv.summary).toBe(finalized.summary);
      });
    }

    it('confirms Serbian -> Serbian still works end to end', () => {
      const finalized = finalizeClientAiSummary(
        'Operaterka u proizvodnji sa oko četiri godine iskustva u procesima i izveštavanju.',
        cv,
        'sr',
        durationSnapshot,
      );
      expect(finalized.blocked).toBe(false);
    });
  });

  describe('2. Old contentLocale must not reject a valid new-locale result', () => {
    it('persisted contentLocale=sr, requested target de: valid German output is accepted', () => {
      const cvWithSrContentLocale = { ...cv, summaryOrigin: 'ai_generated' as const };
      const factSet = buildCvCanonicalFactSet(cvWithSrContentLocale);
      const grounded = deterministicLocalizedSummaryFromCanonical(factSet, 'de', 'female', durationSnapshot.total);
      const finalized = finalizeClientAiSummary(grounded, cvWithSrContentLocale, 'de', durationSnapshot);
      expect(finalized.blocked).toBe(false);
      expect(isWrongLanguageAiOutput(finalized.summary, 'de')).toBe(false);

      const nextCv = acceptValidatedAiContent(cvWithSrContentLocale, {
        locale: 'de',
        summary: finalized.summary,
        summaryOrigin: finalized.origin,
      });
      expect(nextCv.summary).toBe(finalized.summary);
    });
  });

  describe('3. Grounding across translation', () => {
    it('German translation of the Serbian "four years as X" fact passes grounding', () => {
      const germanTranslation =
        'Produktionsmitarbeiterin mit etwa vier Jahren Erfahrung. Entwicklung und Umsetzung interner Prozesse.';
      const finalized = finalizeClientAiSummary(germanTranslation, cv, 'de', durationSnapshot);
      expect(finalized.blocked).toBe(false);
    });

    it('Hindi translation of the same Serbian fact passes grounding', () => {
      const factSet = buildCvCanonicalFactSet(cv);
      const hindiTranslation = deterministicLocalizedSummaryFromCanonical(
        factSet,
        'hi',
        'female',
        durationSnapshot.total,
      );
      const finalized = finalizeClientAiSummary(hindiTranslation, cv, 'hi', durationSnapshot);
      expect(finalized.blocked).toBe(false);
      expect(finalized.summary).toMatch(/[\u0900-\u097F]/);
    });

    it('still rejects an invented duty/category not present in canonical facts (e.g. beverage service)', () => {
      const invented =
        'Produktionsmitarbeiterin mit vier Jahren Erfahrung. Zubereitung von Cocktails und Getränken für Gäste.';
      const finalized = finalizeClientAiSummary(invented, cv, 'de', durationSnapshot);
      // The unsupported category must not be silently accepted; the deterministic
      // fallback recovers with only grounded canonical facts.
      expect(finalized.summary).not.toMatch(/Cocktail|Getränke/i);
    });
  });

  describe('4. Invalid output -> repair -> deterministic fallback (server activation)', () => {
    it('provider returns Serbian for a German request; repair returns valid German; German repair is applied', async () => {
      const factSet = buildCvCanonicalFactSet(cv);
      const activated = await activateCvSummary({
        locale: 'de',
        gender: 'female',
        factSet,
        candidate: cv.summary, // wrong-language: Serbian, but 'de' was requested
        sourceFactsText: 'Vier Jahre Erfahrung als Produktionsmitarbeiterin.',
        fallbackSummary: 'Professional with relevant experience, ready to contribute responsibly.',
        repair: async () =>
          'Produktionsmitarbeiterin mit etwa vier Jahren Erfahrung. Entwicklung und Umsetzung interner Prozesse.',
      });
      expect(activated.blocked).toBeFalsy();
      expect(activated.status).toBe('repaired');
      expect(isWrongLanguageAiOutput(activated.content, 'de')).toBe(false);
    });

    it('provider returns Serbian for a Hindi request; repair also fails; deterministic Hindi fallback is applied without a terminal error', async () => {
      const factSet = buildCvCanonicalFactSet(cv);
      const activated = await activateCvSummary({
        locale: 'hi',
        gender: 'female',
        factSet,
        candidate: cv.summary,
        sourceFactsText: 'चार वर्षों का अनुभव।',
        // A hint built from frozen Serbian canonical text — must not be trusted for 'hi'.
        fallbackSummary: cv.summary,
        repair: async () => cv.summary, // repair also echoes Serbian
      });
      expect(activated.blocked).toBeFalsy();
      expect(activated.status).toBe('fallback');
      expect(activated.content).toMatch(/[\u0900-\u097F]/);
      expect(isWrongLanguageAiOutput(activated.content, 'hi')).toBe(false);
    });
  });

  describe('5. Fallback produced entirely client-side when provider+repair are unavailable', () => {
    for (const locale of ['de', 'hi', 'ar', 'ja', 'en'] as Locale[]) {
      it(`sr -> ${locale}: client-side deterministic fallback is grounded, correct-language, and not blocked`, () => {
        // Simulate the provider echoing the Serbian source verbatim.
        const finalized = finalizeClientAiSummary(cv.summary, cv, locale, durationSnapshot);
        expect(finalized.blocked).toBe(false);
        expect(isWrongLanguageAiOutput(finalized.summary, locale)).toBe(false);
      });
    }
  });

  describe('6. Regression matrix required by the report: sr -> de/hi/ar/ja/en, and sr -> sr', () => {
    const pairs: Locale[] = ['de', 'hi', 'ar', 'ja', 'en', 'sr'];
    for (const target of pairs) {
      it(`Serbian existing CV + Generate Summary requested in ${target} succeeds`, () => {
        const factSet = buildCvCanonicalFactSet(cv);
        const grounded = deterministicLocalizedSummaryFromCanonical(
          factSet,
          target,
          'female',
          durationSnapshot.total,
        );
        const finalized = finalizeClientAiSummary(grounded, cv, target, durationSnapshot);
        expect(finalized.blocked).toBe(false);
      });
    }
  });
});
