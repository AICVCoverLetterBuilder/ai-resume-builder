/**
 * Android build 225 regression: after switching the app language away from
 * Serbian (e.g. sr -> hi), the FIRST cross-locale Generate Summary sometimes
 * showed the localized "generation_validation_failed" toast, even though the
 * exact same locale succeeded moments later (e.g. after sr -> pt-BR -> hi).
 *
 * ROOT CAUSE (see cv-role-title.ts `localizeKnownTitle`):
 *   Whenever the AI provider's raw response needed the deterministic recovery
 *   chain (repair failed / provider echoed the source language / provider
 *   omitted the duration claim), the recovery path builds a "shell" sentence
 *   that embeds a resolved role/title directly into the target-locale prose —
 *   both `resolveSummaryWithDurationPolicy`'s last-resort duration sentence
 *   (cv-content-quality.ts) and `deterministicLocalizedSummaryFromCanonical`
 *   (cv-localized-fallback.ts) call `resolveOccupationalTitleForSummary` for
 *   this. That resolver only had explicit translations for two job titles
 *   ("Operater u proizvodnji", "Dizajner enterijera"); for every OTHER job
 *   title, `localizeKnownTitle` fell through to `return normalized` whenever
 *   the source title contained anything outside a plain ASCII pattern —
 *   which includes ANY Serbian/Croatian diacritic (č, ć, š, đ, ž) or any other
 *   script. That raw, untranslated source-language text then got woven into
 *   the "guaranteed-safe" fallback sentence for hi/de/ar/ja/es/fr/it/ru/pt-BR
 *   (and even en, since `isWrongLanguageAiOutput` rejects Serbo-Croatian
 *   diacritics for every locale except sr/hr), which the locale/script guard
 *   (`isWrongLanguageAiOutput` / `textMatchesRequestedFieldLocale`) correctly
 *   rejected — producing a terminal validation-failed toast from what was
 *   supposed to be the LAST, always-safe recovery step.
 *
 *   This only manifested when the recovery chain actually reached that shell
 *   sentence, which depends on the AI provider's specific (non-deterministic)
 *   response for that request — hence "intermittent" and "first request
 *   after a switch" (the exact locale/provider roll that happens to need the
 *   fallback varies run to run; it is not about React state staleness).
 *
 * FIX: `localizeKnownTitle` now returns `null` (not raw source text) for any
 * unmapped title whose script doesn't already match the requested locale
 * (ASCII is still kept for `en`, and sr/hr keep their own diacritics), so
 * callers fall back to the always-correct-script generic role label
 * (`getOccupationalTitleFallback`) instead of leaking foreign-language text.
 *
 * This file also locks in the atomic-locale-request-context and
 * stale-response-guard behavior added to cv-builder/page.tsx.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import { sealCanonicalFromValidatedSource, acceptValidatedAiContent } from '@/lib/cv-canonical-snapshot';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { finalizeClientAiSummary } from '@/lib/cv-summary-integrity';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import { deterministicLocalizedSummaryFromCanonical } from '@/lib/cv-localized-fallback';
import { isWrongLanguageAiOutput } from '@/lib/cv-ai-locale-guard';
import { activateCvSummary } from '@/lib/cv-content-activation';
import { resolveOccupationalTitleForSummary } from '@/lib/cv-role-title';

const REF = '2026-07-15';

// A deliberately UNMAPPED Serbian job title (contains the diacritic "č"),
// unlike the "Operater u proizvodnji" fixture used elsewhere, which IS mapped
// and therefore never exercised the leak. Duties reuse the well-classified
// process/collaboration/analysis/planning categories (proven across all 12
// locales in cv-cross-locale-ai-regression.test.ts) so this fixture isolates
// the title-leak bug from unrelated duty-classification coverage gaps.
const SR_BULLETS = [
  'Razvoj i implementacija internih procesa u skladištu',
  'Saradnja sa međufunkcionalnim timovima na izvršenju projekata',
  'Analiza poslovnih podataka i priprema izveštaja za rukovodstvo',
  'Planiranje i koordinacija aktivnosti odeljenja',
].map((b) => `• ${b}`).join('\n');

function srCv(overrides?: Partial<CVData>): CVData {
  const cv: CVData = {
    id: 'sr-forklift-1',
    name: 'Vozac',
    personal: {
      fullName: 'Testni Vozač',
      email: 'vozac@example.com',
      phone: '+381',
      address: 'Novi Sad',
      jobTitle: 'Vozač viličara',
      gender: 'male',
    },
    summary: 'Vozač viličara sa iskustvom u skladišnom poslovanju i izveštavanju.',
    experience: [
      {
        id: 'exp-skladiste',
        company: 'Skladiste DOO',
        position: 'Vozač viličara',
        startDate: '2021-03',
        endDate: '',
        isPresent: true,
        description: SR_BULLETS,
        canonicalDescription: SR_BULLETS,
      },
    ],
    education: [],
    skills: ['Rukovanje viličarom'],
    certifications: [],
    languages: [{ name: 'Engleski', level: 'Srednji' }],
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

const NON_SOURCE_LOCALES: Locale[] = ['de', 'es', 'fr', 'it', 'ar', 'ru', 'pt-BR', 'hi', 'ja', 'en'];

describe('1. Root cause: unmapped diacritic job title must never leak into the deterministic fallback', () => {
  for (const locale of NON_SOURCE_LOCALES) {
    it(`resolveOccupationalTitleForSummary('Vozač viličara', ${locale}) never returns raw Serbian text`, () => {
      const resolved = resolveOccupationalTitleForSummary({
        profileJobTitle: 'Vozač viličara',
        currentExperienceTitle: 'Vozač viličara',
        locale,
        gender: 'male',
      });
      expect(resolved).not.toMatch(/Vozač/u);
      expect(resolved).not.toMatch(/vilič/iu);
    });
  }

  it('English keeps a plain-ASCII unmapped title as-is (no unnecessary genericization)', () => {
    expect(resolveOccupationalTitleForSummary({
      profileJobTitle: 'Software Engineer',
      locale: 'en',
      gender: 'male',
    })).toBe('Software Engineer');
  });

  for (const locale of NON_SOURCE_LOCALES) {
    it(`sr source with unmapped title -> ${locale}: grounded deterministic fallback is valid and not blocked`, () => {
      const cv = srCv();
      const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);
      const factSet = buildCvCanonicalFactSet(cv);
      const grounded = deterministicLocalizedSummaryFromCanonical(factSet, locale, 'male', durationSnapshot.total);
      expect(grounded).toBeTruthy();
      expect(grounded).not.toMatch(/Vozač/u);

      const finalized = finalizeClientAiSummary(grounded, cv, locale, durationSnapshot);
      expect(finalized.blocked).toBe(false);
      expect(isWrongLanguageAiOutput(finalized.summary, locale)).toBe(false);
    });
  }
});

describe('2. Regression harness — sequence A: sr generate, switch to hi, generate immediately', () => {
  it('Hindi result is accepted on the first attempt after a direct sr -> hi switch', () => {
    let cv = srCv();
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);

    // Step 1: Serbian generation succeeds.
    const srFinalized = finalizeClientAiSummary(cv.summary, cv, 'sr', durationSnapshot);
    expect(srFinalized.blocked).toBe(false);
    cv = acceptValidatedAiContent(cv, { locale: 'sr', summary: srFinalized.summary, summaryOrigin: srFinalized.origin });

    // Step 2: switch UI locale to hi, immediately generate. Simulate the
    // worst case: the provider's first Hindi attempt echoes the Serbian
    // source (forcing the full recovery chain, exactly like real-world
    // provider variance sometimes does).
    const hiFinalized = finalizeClientAiSummary(cv.summary, cv, 'hi', durationSnapshot);
    expect(hiFinalized.blocked).toBe(false);
    expect(hiFinalized.summary).toMatch(/[\u0900-\u097F]/);
    expect(isWrongLanguageAiOutput(hiFinalized.summary, 'hi')).toBe(false);

    const next = acceptValidatedAiContent(cv, { locale: 'hi', summary: hiFinalized.summary, summaryOrigin: hiFinalized.origin });
    expect(next.summary).toBe(hiFinalized.summary);
  });
});

describe('3. Regression harness — sequence B: sr -> pt-BR -> hi', () => {
  it('pt-BR then hi both succeed on the first attempt each', () => {
    let cv = srCv();
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);

    const ptFinalized = finalizeClientAiSummary(cv.summary, cv, 'pt-BR', durationSnapshot);
    expect(ptFinalized.blocked).toBe(false);
    cv = acceptValidatedAiContent(cv, { locale: 'pt-BR', summary: ptFinalized.summary, summaryOrigin: ptFinalized.origin });

    const hiFinalized = finalizeClientAiSummary(cv.summary, cv, 'hi', durationSnapshot);
    expect(hiFinalized.blocked).toBe(false);
    expect(hiFinalized.summary).toMatch(/[\u0900-\u097F]/);
  });
});

describe('4. Regression harness — sequence C: sr -> de/ar/ja/en, first generation after each switch', () => {
  const targets: Locale[] = ['de', 'ar', 'ja', 'en'];
  for (const target of targets) {
    it(`sr -> ${target}: first generation succeeds even when the provider echoes the Serbian source`, () => {
      const cv = srCv();
      const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);
      const finalized = finalizeClientAiSummary(cv.summary, cv, target, durationSnapshot);
      expect(finalized.blocked).toBe(false);
      expect(isWrongLanguageAiOutput(finalized.summary, target)).toBe(false);
    });
  }
});

describe('5. Recovery: provider result is Serbian, repair also fails, deterministic Hindi fallback succeeds once', () => {
  it('activateCvSummary recovers via fallback for an unmapped title without a terminal error', async () => {
    const cv = srCv();
    const factSet = buildCvCanonicalFactSet(cv);
    const activated = await activateCvSummary({
      locale: 'hi',
      gender: 'male',
      factSet,
      candidate: cv.summary, // provider echoed Serbian
      sourceFactsText: 'लगभग तीन वर्षों का अनुभव।',
      fallbackSummary: cv.summary, // caller hint is also frozen Serbian text — must not be trusted
      repair: async () => cv.summary, // repair also echoes Serbian
    });
    expect(activated.blocked).toBeFalsy();
    expect(activated.status).toBe('fallback');
    expect(activated.content).toMatch(/[\u0900-\u097F]/);
    expect(activated.content).not.toMatch(/Vozač/u);
    expect(isWrongLanguageAiOutput(activated.content, 'hi')).toBe(false);
  });
});

describe('6. Stale-response guard (out-of-order requests)', () => {
  it('an older Serbian request resolving after a newer Hindi request must not overwrite the Hindi result', () => {
    // Simulate the requestId-correlation guard added to cv-builder/page.tsx:
    // only the response whose requestId matches the LATEST request for that
    // action may be applied.
    let latestRequestId: string | null = null;
    let cv = srCv();
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);

    const srRequestId = 'req_sr_1';
    latestRequestId = srRequestId; // Serbian request starts.

    const hiRequestId = 'req_hi_2';
    latestRequestId = hiRequestId; // Hindi request starts (supersedes sr).

    // Hindi response arrives first and is applied (its id still matches latest).
    const hiFinalized = finalizeClientAiSummary(cv.summary, cv, 'hi', durationSnapshot);
    expect(hiFinalized.blocked).toBe(false);
    if (latestRequestId === hiRequestId) {
      cv = acceptValidatedAiContent(cv, { locale: 'hi', summary: hiFinalized.summary, summaryOrigin: hiFinalized.origin });
    }
    expect(cv.summary).toBe(hiFinalized.summary);

    // Stale Serbian response arrives late — its id no longer matches latest, so it must be dropped.
    const srFinalized = finalizeClientAiSummary('Vozač viličara sa iskustvom.', cv, 'sr', durationSnapshot);
    let applied = false;
    if (latestRequestId === srRequestId) {
      cv = acceptValidatedAiContent(cv, { locale: 'sr', summary: srFinalized.summary, summaryOrigin: srFinalized.origin });
      applied = true;
    }
    expect(applied).toBe(false);
    expect(cv.summary).toBe(hiFinalized.summary); // Hindi result remains visible.
  });
});

describe('7. A duty outside the known category/intent vocabulary must still produce a safe, grounded fallback (never block)', () => {
  it('a duty matching no category and no generic intent still gets a safe, non-empty, correct-script Hindi fallback', () => {
    // "Šišanje pudlica..." (grooming poodles) matches none of the known duty
    // categories (beverage/hygiene/customer/inventory) nor any generic intent
    // (process/collaboration/analysis/planning/logistics). Before the
    // GENERIC_DUTY_FALLBACK catch-all, `localizedBulletForFact` returned ''
    // for every non-English locale here, which made the deterministic
    // fallback — the step every validator treats as "always available" —
    // silently produce NOTHING. Real-world CVs with duties outside the
    // office/hospitality/logistics vocabulary (matches the real-device
    // report) hit this exact gap, most visibly for Hindi because its script/
    // duration/tense validators reject provider output more often, forcing
    // the deterministic path far more frequently than for sr/en.
    const unclassifiableBullet = '• Šišanje pudlica i drugih kućnih ljubimaca u salonu';
    const cv = srCv({
      summary: '',
      experience: [
        {
          id: 'exp-groom',
          company: 'Salon DOO',
          position: 'Vozač viličara',
          startDate: '2021-03',
          endDate: '',
          isPresent: true,
          description: unclassifiableBullet,
          canonicalDescription: unclassifiableBullet,
        },
      ],
    });
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);
    const factSet = buildCvCanonicalFactSet(cv);
    const grounded = deterministicLocalizedSummaryFromCanonical(factSet, 'hi', 'male', durationSnapshot.total);
    expect(grounded).toBeTruthy();
    expect(grounded).toMatch(/[\u0900-\u097F]/);
    expect(grounded).not.toMatch(/Šišanje|pudlic/iu);

    const finalized = finalizeClientAiSummary(grounded, cv, 'hi', durationSnapshot);
    expect(finalized.blocked).toBe(false);
    expect(isWrongLanguageAiOutput(finalized.summary, 'hi')).toBe(false);

    // Server activation chain: provider + repair both echo the unclassifiable
    // Serbian source, so it must recover via the same safe catch-all fallback
    // instead of blocking.
    const activated = activateCvSummary({
      locale: 'hi',
      gender: 'male',
      factSet,
      candidate: cv.summary,
      sourceFactsText: unclassifiableBullet,
      fallbackSummary: cv.summary,
      repair: async () => cv.summary,
    });
    return activated.then((result) => {
      expect(result.blocked).toBeFalsy();
      expect(result.content).toMatch(/[\u0900-\u097F]/);
      expect(result.content).not.toMatch(/Šišanje|pudlic/iu);
    });
  });
});

describe('8. Atomic locale request context is wired into cv-builder/page.tsx', () => {
  const source = fs.readFileSync(path.resolve('src/app/cv-builder/page.tsx'), 'utf8');

  it('handleGenSummary captures requestedLocale once from reqCtx and reuses it end to end', () => {
    const fn = source.slice(source.indexOf('const handleGenSummary'), source.indexOf('const handleGenBullets'));
    expect(fn).toMatch(/const requestedLocale = reqCtx\.locale as Locale/);
    expect(fn).toMatch(/finalizeClientAiSummary\(nextSummary, cv, requestedLocale, durationSnapshot\)/);
    expect(fn).toMatch(/acceptValidatedAiContent\(prev, \{\s*locale: requestedLocale/);
    expect(fn).toMatch(/latestSummaryRequestIdRef\.current !== reqCtx\.requestId/);
  });

  it('handleGenBullets guards stale responses per-experience and uses requestedLocale', () => {
    const fn = source.slice(source.indexOf('const handleGenBullets'), source.indexOf('const handleRewrite'));
    expect(fn).toMatch(/const requestedLocale = reqCtx\.locale as Locale/);
    expect(fn).toMatch(/latestBulletsRequestIdRef\.current\[expId\] !== reqCtx\.requestId/);
    expect(fn).toMatch(/willAcceptValidatedAiContent\(\{ locale: requestedLocale/);
  });

  it('handleRewrite captures requestedLocale and guards stale responses', () => {
    const fn = source.slice(source.indexOf('const handleRewrite'), source.indexOf('const handleAnalyzeJob'));
    expect(fn).toMatch(/const requestedLocale = reqCtx\.locale as Locale/);
    expect(fn).toMatch(/latestRewriteRequestIdRef\.current !== reqCtx\.requestId/);
  });

  it('AI_LOCALE_REQUEST diagnostics are wired for summary, bullets, and rewrite', () => {
    const occurrences = source.match(/logAiLocaleTransitionDiagnostics\(/g) || [];
    expect(occurrences.length).toBeGreaterThanOrEqual(6);
  });
});
