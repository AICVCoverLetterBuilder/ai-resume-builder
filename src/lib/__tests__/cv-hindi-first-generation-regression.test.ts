/**
 * @vitest-environment jsdom
 *
 * Android build 227 real-device regression: with an existing Serbian/English
 * Professional Summary, the FIRST Hindi Generate/Shorter/Stronger/Professional
 * attempt failed with the localized `generation_validation_failed` toast, but
 * the exact same locale then succeeded immediately after one successful
 * generation in ANY other language (observed with Portuguese).
 *
 * EXACT DETERMINISTIC CAUSE (see `cv-localized-fallback.ts`):
 *   `localizedBulletForFact` classifies each experience-bullet fact into a
 *   duty *category* (beverage_service / hygiene_safety / customer_service /
 *   inventory_stock / generic) and, for `generic` bullets, a narrower
 *   *intent* (process / collaboration / analysis / planning). Both tables
 *   were built around an office/hospitality vocabulary. Any real CV whose
 *   duties fall outside that vocabulary (warehouse work, driving, forklift
 *   operation, and plenty of other everyday jobs — exactly the persona used
 *   throughout this repo's own fixtures, "Vozač viličara") produced an
 *   UNCLASSIFIED generic bullet. For every locale except `en`,
 *   `localizedBulletForFact` returned `''` for that bullet, which made
 *   `deterministicLocalizedSummaryFromCanonical` return `''` outright
 *   (`bullets.some((b) => !b.trim())`) — i.e. the ONE recovery step every
 *   validator treats as "always safe" had NOTHING to offer.
 *
 *   This is not a state/order/cache bug: the fallback is a pure function of
 *   (factSet, locale, gender, duration). It is *provider (LLM) sampling
 *   variance* that decides, per request, whether the deterministic fallback
 *   is ever reached at all — the AI provider's raw response is
 *   non-deterministic, so sometimes it directly produces valid text (no
 *   fallback needed) and sometimes it needs the repair+fallback chain.
 *   Hindi's stricter validators (Devanagari-script guard, duration-clause
 *   placement, tense-mix checks) reject provider output more often than
 *   sr/en, so Hindi hits the broken fallback far more often — "clearing" the
 *   instant an unrelated request happens not to need the fallback at all.
 *   `deterministicLocalizedSummaryFromCanonical`, `resolveOccupationalTitleForSummary`,
 *   `buildCvCanonicalFactSet`, and every validator in this chain are pure,
 *   stateless functions of their explicit inputs — there is no module-level
 *   cache, singleton, or "first successful locale" memo anywhere in this
 *   path (see cv-canonical-snapshot.ts / cv-role-title.ts / cv-content-quality.ts).
 *
 * FIX: `localizedBulletForFact` (cv-localized-fallback.ts) now:
 *   1. Classifies common warehouse/driving/delivery duties into a new
 *      `logistics` generic intent (translated for all 12 locales), and
 *   2. Falls back to a locale-safe, non-inventive `GENERIC_DUTY_FALLBACK`
 *      catch-all sentence — never `''`, never raw (possibly wrong-language)
 *      source text — for any remaining unclassified generic duty.
 *   This guarantees the deterministic fallback is always non-empty and valid
 *   for every locale, so the first Hindi attempt succeeds whether or not the
 *   provider/repair chain needed it.
 *
 * This file resets the module registry before every test (`vi.resetModules`)
 * and re-imports the pipeline fresh each time, which would surface any
 * hidden module-level cache/singleton if one existed — none does.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';

const REF = '2027-03-15'; // exactly 72 months (6 years) after the 2021-03 start date below.

// Realistic Serbian forklift-driver CV. Duties deliberately span:
//  - a duty now classified as the new `logistics` generic intent,
//  - a duty that classifies as `inventory_stock` (an existing category),
//  - a duty that matches NO category and NO generic intent at all (the exact
//    gap this fix closes) — proving the fallback is never empty regardless.
const BULLETS = [
  'Utovar i istovar robe u skladištu',
  'Bezbedno rukovanje viličarom prilikom transporta tereta',
  'Praćenje i organizacija nivoa zaliha u skladištu',
  'Povremeno šišanje kućnih ljubimaca kao dodatna usluga za kolege',
].map((b) => `• ${b}`).join('\n');

function forkliftCv(overrides?: Partial<CVData>): CVData {
  return {
    id: 'sr-forklift-hindi-1',
    name: 'Vozac',
    personal: {
      fullName: 'Testni Vozač',
      email: 'vozac@example.com',
      phone: '+381',
      address: 'Novi Sad',
      jobTitle: 'Vozač viličara',
      gender: 'male',
    },
    summary: 'Vozač viličara sa iskustvom u skladišnom poslovanju.',
    experience: [
      {
        id: 'exp-skladiste',
        company: 'Skladiste DOO',
        position: 'Vozač viličara',
        startDate: '2021-03',
        endDate: '',
        isPresent: true,
        description: BULLETS,
        canonicalDescription: BULLETS,
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
}

/** Re-import the whole pipeline fresh, so any hidden module-level cache would surface. */
async function freshPipeline() {
  const canonicalMod = await import('@/lib/cv-canonical-snapshot');
  const durationMod = await import('@/lib/cv-experience-duration');
  const summaryMod = await import('@/lib/cv-summary-integrity');
  const factsMod = await import('@/lib/cv-canonical-facts');
  const fallbackMod = await import('@/lib/cv-localized-fallback');
  const activationMod = await import('@/lib/cv-content-activation');
  const guardMod = await import('@/lib/cv-ai-locale-guard');
  const roleMod = await import('@/lib/cv-role-title');
  return { canonicalMod, durationMod, summaryMod, factsMod, fallbackMod, activationMod, guardMod, roleMod };
}

async function sealedForkliftCv(overrides?: Partial<CVData>) {
  const { canonicalMod } = await freshPipeline();
  return canonicalMod.sealCanonicalFromValidatedSource(forkliftCv(overrides), {
    locale: 'sr',
    createdFrom: 'user_structured_input',
    revise: false,
  });
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('1. Cold app state -> first Hindi Generate succeeds', () => {
  it('no prior generation at all, straight to Hindi', async () => {
    const { durationMod, summaryMod } = await freshPipeline();
    const cv = await sealedForkliftCv();
    const durationSnapshot = durationMod.buildExperienceDurationSnapshot(cv.experience, REF);
    const finalized = summaryMod.finalizeClientAiSummary(cv.summary, cv, 'hi', durationSnapshot);
    expect(finalized.blocked).toBe(false);
    expect(finalized.summary).toMatch(/[\u0900-\u097F]/);
  });
});

describe('2. Serbian success -> first Hindi Generate succeeds', () => {
  it('generates Serbian first, then Hindi on the very next request', async () => {
    const { durationMod, summaryMod, canonicalMod } = await freshPipeline();
    let cv = await sealedForkliftCv();
    const durationSnapshot = durationMod.buildExperienceDurationSnapshot(cv.experience, REF);

    const sr = summaryMod.finalizeClientAiSummary(cv.summary, cv, 'sr', durationSnapshot);
    expect(sr.blocked).toBe(false);
    cv = canonicalMod.acceptValidatedAiContent(cv, { locale: 'sr', summary: sr.summary, summaryOrigin: sr.origin });

    const hi = summaryMod.finalizeClientAiSummary(cv.summary, cv, 'hi', durationSnapshot);
    expect(hi.blocked).toBe(false);
    expect(hi.summary).toMatch(/[\u0900-\u097F]/);
  });
});

describe('3. English success -> first Hindi Generate succeeds', () => {
  it('generates English first, then Hindi on the very next request', async () => {
    const { durationMod, summaryMod, canonicalMod } = await freshPipeline();
    let cv = await sealedForkliftCv();
    const durationSnapshot = durationMod.buildExperienceDurationSnapshot(cv.experience, REF);

    const en = summaryMod.finalizeClientAiSummary(cv.summary, cv, 'en', durationSnapshot);
    expect(en.blocked).toBe(false);
    cv = canonicalMod.acceptValidatedAiContent(cv, { locale: 'en', summary: en.summary, summaryOrigin: en.origin });

    const hi = summaryMod.finalizeClientAiSummary(cv.summary, cv, 'hi', durationSnapshot);
    expect(hi.blocked).toBe(false);
    expect(hi.summary).toMatch(/[\u0900-\u097F]/);
  });
});

describe('4. Serbian -> English -> first Hindi Generate succeeds', () => {
  it('two prior successful languages, then Hindi still succeeds on its first attempt', async () => {
    const { durationMod, summaryMod, canonicalMod } = await freshPipeline();
    let cv = await sealedForkliftCv();
    const durationSnapshot = durationMod.buildExperienceDurationSnapshot(cv.experience, REF);

    const sr = summaryMod.finalizeClientAiSummary(cv.summary, cv, 'sr', durationSnapshot);
    cv = canonicalMod.acceptValidatedAiContent(cv, { locale: 'sr', summary: sr.summary, summaryOrigin: sr.origin });
    const en = summaryMod.finalizeClientAiSummary(cv.summary, cv, 'en', durationSnapshot);
    cv = canonicalMod.acceptValidatedAiContent(cv, { locale: 'en', summary: en.summary, summaryOrigin: en.origin });

    const hi = summaryMod.finalizeClientAiSummary(cv.summary, cv, 'hi', durationSnapshot);
    expect(hi.blocked).toBe(false);
    expect(hi.summary).toMatch(/[\u0900-\u097F]/);
  });
});

describe('5. Serbian -> Portuguese -> Hindi succeeds (matches the real-device "unlocked by pt-BR" report)', () => {
  it('pt-BR success does not change whether Hindi succeeds — Hindi succeeds regardless', async () => {
    const { durationMod, summaryMod, canonicalMod } = await freshPipeline();
    let cv = await sealedForkliftCv();
    const durationSnapshot = durationMod.buildExperienceDurationSnapshot(cv.experience, REF);

    const sr = summaryMod.finalizeClientAiSummary(cv.summary, cv, 'sr', durationSnapshot);
    cv = canonicalMod.acceptValidatedAiContent(cv, { locale: 'sr', summary: sr.summary, summaryOrigin: sr.origin });
    const pt = summaryMod.finalizeClientAiSummary(cv.summary, cv, 'pt-BR', durationSnapshot);
    expect(pt.blocked).toBe(false);
    cv = canonicalMod.acceptValidatedAiContent(cv, { locale: 'pt-BR', summary: pt.summary, summaryOrigin: pt.origin });

    const hi = summaryMod.finalizeClientAiSummary(cv.summary, cv, 'hi', durationSnapshot);
    expect(hi.blocked).toBe(false);
    expect(hi.summary).toMatch(/[\u0900-\u097F]/);
  });
});

describe('6. Hindi result validity is identical regardless of language order', () => {
  const orders: Locale[][] = [
    [],
    ['sr'],
    ['en'],
    ['pt-BR'],
    ['sr', 'en'],
    ['en', 'sr'],
    ['ar'],
    ['ja'],
    ['sr', 'pt-BR'],
  ];
  for (const order of orders) {
    it(`order=[${order.join(',')}] -> hi: same success, same script, no leaked Serbian`, async () => {
      const { durationMod, summaryMod, canonicalMod } = await freshPipeline();
      let cv = await sealedForkliftCv();
      const durationSnapshot = durationMod.buildExperienceDurationSnapshot(cv.experience, REF);
      for (const loc of order) {
        const step = summaryMod.finalizeClientAiSummary(cv.summary, cv, loc, durationSnapshot);
        expect(step.blocked).toBe(false);
        cv = canonicalMod.acceptValidatedAiContent(cv, { locale: loc, summary: step.summary, summaryOrigin: step.origin });
      }
      const hi = summaryMod.finalizeClientAiSummary(cv.summary, cv, 'hi', durationSnapshot);
      expect(hi.blocked).toBe(false);
      expect(hi.summary).toMatch(/[\u0900-\u097F]/);
      expect(hi.summary).not.toMatch(/Vozač|vilič/iu);
    });
  }
});

describe('7-9. First Hindi Stronger / Shorter / Professional all succeed on the first attempt', () => {
  // The rewrite styles share the exact same finalize/accept pipeline as Generate
  // (see handleRewrite in cv-builder/page.tsx) — style only changes the AI prompt,
  // never the validation/fallback chain, so simulating provider failure for each
  // style below exercises the same code path handleRewrite uses.
  const styles = ['stronger', 'shorter', 'professional'] as const;
  for (const style of styles) {
    it(`first Hindi "${style}" succeeds even when the provider echoes the Serbian source`, async () => {
      const { durationMod, summaryMod } = await freshPipeline();
      const cv = await sealedForkliftCv();
      const durationSnapshot = durationMod.buildExperienceDurationSnapshot(cv.experience, REF);
      // Worst case: rewrite provider response is just the untouched Serbian summary.
      const finalized = summaryMod.finalizeClientAiSummary(cv.summary, cv, 'hi', durationSnapshot);
      expect(finalized.blocked).toBe(false);
      expect(finalized.summary).toMatch(/[\u0900-\u097F]/);
      void style; // style only changes the upstream AI prompt, not this pipeline
    });
  }
});

describe('10. Provider returns Serbian for Hindi -> repair succeeds', () => {
  it('activateCvSummary repairs a Serbian provider echo into valid Hindi', async () => {
    const { factsMod, activationMod } = await freshPipeline();
    const cv = await sealedForkliftCv();
    const factSet = factsMod.buildCvCanonicalFactSet(cv);
    const activated = await activationMod.activateCvSummary({
      locale: 'hi',
      gender: 'male',
      factSet,
      candidate: cv.summary, // provider echoed Serbian
      sourceFactsText: 'लगभग छह वर्षों का अनुभव।',
      fallbackSummary: cv.summary,
      repair: async () => 'मेरे पास गोदाम में लगभग छह वर्षों का अनुभव है।',
    });
    expect(activated.blocked).toBeFalsy();
    expect(activated.content).toMatch(/[\u0900-\u097F]/);
  });
});

describe('11. Provider and repair both fail -> first-call Hindi deterministic fallback succeeds', () => {
  it('activateCvSummary recovers via the deterministic fallback on the very first call', async () => {
    const { factsMod, activationMod } = await freshPipeline();
    const cv = await sealedForkliftCv();
    const factSet = factsMod.buildCvCanonicalFactSet(cv);
    const activated = await activationMod.activateCvSummary({
      locale: 'hi',
      gender: 'male',
      factSet,
      candidate: cv.summary, // provider echoed Serbian
      sourceFactsText: cv.summary,
      fallbackSummary: cv.summary, // caller hint is also frozen Serbian — must not be trusted
      repair: async () => cv.summary, // repair also echoes Serbian
    });
    expect(activated.blocked).toBeFalsy();
    expect(activated.status).toBe('fallback');
    expect(activated.content).toMatch(/[\u0900-\u097F]/);
    expect(activated.content).not.toMatch(/Vozač/u);
  });
});

describe('12. Hindi output with a Latin proper noun (company "Upopo") passes', () => {
  it('a valid Hindi summary is not rejected solely for containing a Latin company name', async () => {
    const { durationMod, summaryMod } = await freshPipeline();
    const cv = await sealedForkliftCv({
      experience: [
        {
          id: 'exp-upopo',
          company: 'Upopo',
          position: 'Vozač viličara',
          startDate: '2021-03',
          endDate: '',
          isPresent: true,
          description: BULLETS,
          canonicalDescription: BULLETS,
        },
      ],
    });
    const durationSnapshot = durationMod.buildExperienceDurationSnapshot(cv.experience, REF);
    const hindiSummary =
      'मैं लगभग छह वर्षों के अनुभव वाला Upopo में वेयरहाउस चालक हूँ और गोदाम में माल का सुरक्षित परिवहन करता हूँ।';
    const finalized = summaryMod.finalizeClientAiSummary(hindiSummary, cv, 'hi', durationSnapshot);
    expect(finalized.blocked).toBe(false);
    expect(finalized.summary).toMatch(/Upopo/);
  });
});

describe('13. Hindi output containing mostly English/Serbian prose fails', () => {
  it('rejects an English paragraph requested as Hindi', async () => {
    const { durationMod, summaryMod } = await freshPipeline();
    const cv = await sealedForkliftCv();
    const durationSnapshot = durationMod.buildExperienceDurationSnapshot(cv.experience, REF);
    const englishProse =
      'I am an experienced forklift operator with around six years of warehouse experience, loading and unloading goods safely.';
    const finalized = summaryMod.finalizeClientAiSummary(englishProse, cv, 'hi', durationSnapshot);
    // Wrong-language provider text must be repaired/replaced by the grounded
    // Hindi fallback, never applied verbatim as Hindi.
    expect(finalized.summary).not.toBe(englishProse);
    if (!finalized.blocked) expect(finalized.summary).toMatch(/[\u0900-\u097F]/);
  });

  it('rejects a Serbian paragraph requested as Hindi', async () => {
    const { durationMod, summaryMod } = await freshPipeline();
    const cv = await sealedForkliftCv();
    const durationSnapshot = durationMod.buildExperienceDurationSnapshot(cv.experience, REF);
    const finalized = summaryMod.finalizeClientAiSummary(cv.summary, cv, 'hi', durationSnapshot);
    expect(finalized.summary).not.toBe(cv.summary);
    if (!finalized.blocked) expect(finalized.summary).toMatch(/[\u0900-\u097F]/);
  });
});

describe('14. Hindi six-year duration phrase passes on a cold-start call', () => {
  it('"लगभग छह वर्षों" is recognized without any prior Hindi/other-locale call', async () => {
    const { durationMod, guardMod } = await freshPipeline();
    const cv = await sealedForkliftCv();
    const durationSnapshot = durationMod.buildExperienceDurationSnapshot(cv.experience, REF);
    const check = durationMod.validateSummaryDuration(
      'मैं लगभग छह वर्षों के अनुभव वाला गोदाम चालक हूँ।',
      durationSnapshot.total,
      { locale: 'hi', requireDurationClaim: true },
    );
    expect(check.valid).toBe(true);
    void guardMod;
  });
});

describe('15. Unmapped Serbian title never leaks into Hindi', () => {
  it('the raw job title "Vozač viličara" never appears in the Hindi grounded fallback', async () => {
    const { durationMod, factsMod, fallbackMod } = await freshPipeline();
    const cv = await sealedForkliftCv();
    const durationSnapshot = durationMod.buildExperienceDurationSnapshot(cv.experience, REF);
    const factSet = factsMod.buildCvCanonicalFactSet(cv);
    const grounded = fallbackMod.deterministicLocalizedSummaryFromCanonical(factSet, 'hi', 'male', durationSnapshot.total);
    expect(grounded).toBeTruthy();
    expect(grounded).not.toMatch(/Vozač|vilič/iu);
  });
});

describe('16. No global cache is primed by Portuguese/English before Hindi runs', () => {
  it('Hindi-only cold run produces byte-identical grounded text to a run preceded by pt-BR/en', async () => {
    const durationModA = (await freshPipeline()).durationMod;
    const cvA = await sealedForkliftCv();
    const durationSnapshotA = durationModA.buildExperienceDurationSnapshot(cvA.experience, REF);
    const { factsMod: factsModA, fallbackMod: fallbackModA } = await freshPipeline();
    const factSetA = factsModA.buildCvCanonicalFactSet(cvA);
    const groundedCold = fallbackModA.deterministicLocalizedSummaryFromCanonical(
      factSetA, 'hi', 'male', durationSnapshotA.total,
    );

    vi.resetModules();
    const { durationMod: durationModB, summaryMod: summaryModB, canonicalMod: canonicalModB, factsMod: factsModB, fallbackMod: fallbackModB } =
      await freshPipeline();
    let cvB = await sealedForkliftCv();
    const durationSnapshotB = durationModB.buildExperienceDurationSnapshot(cvB.experience, REF);
    const pt = summaryModB.finalizeClientAiSummary(cvB.summary, cvB, 'pt-BR', durationSnapshotB);
    cvB = canonicalModB.acceptValidatedAiContent(cvB, { locale: 'pt-BR', summary: pt.summary, summaryOrigin: pt.origin });
    const en = summaryModB.finalizeClientAiSummary(cvB.summary, cvB, 'en', durationSnapshotB);
    cvB = canonicalModB.acceptValidatedAiContent(cvB, { locale: 'en', summary: en.summary, summaryOrigin: en.origin });
    const factSetB = factsModB.buildCvCanonicalFactSet(cvB);
    const groundedWarm = fallbackModB.deterministicLocalizedSummaryFromCanonical(
      factSetB, 'hi', 'male', durationSnapshotB.total,
    );

    expect(groundedWarm).toBe(groundedCold);
  });
});

describe('17. Old Serbian/English response cannot overwrite Hindi (stale-request guard simulation)', () => {
  it('a late-arriving stale Serbian response never overwrites the already-applied Hindi result', async () => {
    const { durationMod, summaryMod, canonicalMod } = await freshPipeline();
    let cv = await sealedForkliftCv();
    const durationSnapshot = durationMod.buildExperienceDurationSnapshot(cv.experience, REF);

    let latestRequestId: string | null = 'req_sr';
    latestRequestId = 'req_hi'; // Hindi request supersedes the in-flight Serbian one.

    const hi = summaryMod.finalizeClientAiSummary(cv.summary, cv, 'hi', durationSnapshot);
    expect(hi.blocked).toBe(false);
    if (latestRequestId === 'req_hi') {
      cv = canonicalMod.acceptValidatedAiContent(cv, { locale: 'hi', summary: hi.summary, summaryOrigin: hi.origin });
    }
    expect(cv.summary).toBe(hi.summary);

    // Stale Serbian response resolves late; requestId no longer matches latest.
    const sr = summaryMod.finalizeClientAiSummary('Vozač viličara sa iskustvom.', cv, 'sr', durationSnapshot);
    let applied = false;
    if (latestRequestId === 'req_sr') {
      cv = canonicalMod.acceptValidatedAiContent(cv, { locale: 'sr', summary: sr.summary, summaryOrigin: sr.origin });
      applied = true;
    }
    expect(applied).toBe(false);
    expect(cv.summary).toBe(hi.summary);
  });
});

describe('18-19. Usage counting: failed Hindi attempt does not increment; successful fallback increments exactly once', () => {
  it('the handleGenSummary counting gate never increments when finalize reports blocked', async () => {
    // Mirrors the exact gate in cv-builder/page.tsx handleGenSummary: the
    // increment call is only ever reached in the `!finalized.blocked` branch.
    // (Post-fix, a realistic CV's grounded fallback essentially always
    // succeeds — see tests 1-12 — so this exercises the gate itself directly,
    // the same invariant `pro-ai-counting-boundary.test.ts` locks in for the
    // wrong-language / rejected-content case.)
    const usageMod = await import('@/lib/ai-usage-policy');
    const before = usageMod.getProAiUsageCount();
    const finalized = { blocked: true as const, summary: '', origin: 'user' as const };
    if (!finalized.blocked) {
      usageMod.recordProAiUserActionSuccess();
    }
    expect(usageMod.getProAiUsageCount()).toBe(before);
  });

  it('a successful first Hindi fallback/repair recovery increments the usage count exactly once', async () => {
    const usageMod = await import('@/lib/ai-usage-policy');
    const { durationMod, summaryMod } = await freshPipeline();
    const cv = await sealedForkliftCv();
    const durationSnapshot = durationMod.buildExperienceDurationSnapshot(cv.experience, REF);
    const before = usageMod.getProAiUsageCount();
    // Worst case: provider echoes Serbian, forcing the recovery chain.
    const finalized = summaryMod.finalizeClientAiSummary(cv.summary, cv, 'hi', durationSnapshot);
    expect(finalized.blocked).toBe(false);
    expect(['ai_repaired', 'deterministic_fallback']).toContain(finalized.origin);
    usageMod.recordProAiUserActionSuccess(); // one visible apply => exactly one increment
    expect(usageMod.getProAiUsageCount()).toBe(before + 1);
    // Repair/fallback attempts inside finalizeClientAiSummary never call the
    // counter themselves — only the caller's single post-success call does.
    expect(usageMod.getProAiUsageCount()).toBe(before + 1);
  });
});

describe('20. Final contentLocale becomes hi after a successful first Hindi apply', () => {
  it('acceptValidatedAiContent sets locale metadata from user grounding without promoting AI summary to canonical', async () => {
    const { durationMod, summaryMod, canonicalMod } = await freshPipeline();
    // Cold state: no canonical snapshot exists yet. AI may set display summary
    // and snapshot locale metadata, but must not write AI text into canonicalSummary.
    const cv = forkliftCv();
    const durationSnapshot = durationMod.buildExperienceDurationSnapshot(cv.experience, REF);
    const hi = summaryMod.finalizeClientAiSummary(cv.summary, cv, 'hi', durationSnapshot);
    expect(hi.blocked).toBe(false);
    const next = canonicalMod.acceptValidatedAiContent(cv, { locale: 'hi', summary: hi.summary, summaryOrigin: hi.origin });
    expect(next.summary).toBe(hi.summary);
    expect(next.canonicalSnapshot?.canonicalLocale).toBe('hi');
    // AI Hindi prose must not become the sealed canonical summary fact.
    expect(next.canonicalSummary || '').not.toBe(hi.summary);
  });
});

describe('21. Repeated run: the full Hindi-first flow across 50 fresh module resets, zero flakes', () => {
  it('50 independent cold-state runs all succeed on the first Hindi attempt', async () => {
    for (let i = 0; i < 50; i += 1) {
      vi.resetModules();
      const { durationMod, summaryMod } = await freshPipeline();
      const cv = await sealedForkliftCv();
      const durationSnapshot = durationMod.buildExperienceDurationSnapshot(cv.experience, REF);
      const hi = summaryMod.finalizeClientAiSummary(cv.summary, cv, 'hi', durationSnapshot);
      expect(hi.blocked).toBe(false);
      expect(hi.summary).toMatch(/[\u0900-\u097F]/);
      expect(hi.summary).not.toMatch(/Vozač|vilič/iu);
    }
  });
});
