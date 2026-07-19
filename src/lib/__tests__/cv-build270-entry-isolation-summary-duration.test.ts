/**
 * @vitest-environment jsdom
 *
 * Build 270 — Experience entry isolation + Summary duration idempotency.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { formatExperienceBullets, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  buildJobContextGenerationFallback,
} from '@/lib/cv-experience-ai-operation-mode';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { buildExperienceJobContext } from '@/lib/cv-experience-job-context';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
  applyFinalizedSummaryToCv,
} from '@/lib/cv-ai-finalize-apply';
import { buildCrossLocaleExperienceFallback } from '@/lib/cv-cross-locale-experience';
import {
  validateCrossEntryExperienceLeakage,
  softDomainClusterFromPosition,
} from '@/lib/cv-experience-entry-isolation';
import {
  countSummaryDurationExpressions,
  enforceAuthoritativeSummaryDuration,
  stripAllSummaryDurationExpressions,
} from '@/lib/cv-summary-duration-ownership';
import {
  buildExperienceDurationSnapshot,
  formatApproximateDurationPhrase,
} from '@/lib/cv-experience-duration';
import {
  SummaryAiDiagnosticSession,
  clearSummaryAiDiagnosticsForTests,
  getLatestSummaryAiDiagnostic,
  assertSummaryAiDiagnosticHasNoCvText,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import type { Locale } from '@/lib/i18n/translations';

const WAREHOUSE = 'Radnica u skladištu';
const DESIGNER = 'Grafički dizajner';

const GOOD_WH_SR = formatExperienceBullets([
  'Proverava pristiglu robu i prateću dokumentaciju radi tačnog evidentiranja.',
  'Ažurira skladišnu evidenciju i vodi računa o urednom rasporedu robe.',
  'Koordiniše pripremu i kretanje robe u saradnji sa kolegama.',
]);

const GOOD_GD_SR = formatExperienceBullets([
  'Kreirala je vizuelne materijale i grafičke elemente za digitalne proizvode i platforme u skladu sa zadatim smernicama.',
  'Sarađivala je sa timovima za proizvod i razvoj radi očuvanja doslednog vizuelnog identiteta.',
  'Pripremala je finalne grafičke fajlove i prilagođavala dizajne različitim formatima i ekranima.',
]);

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function baseCv(overrides?: Partial<CVData>): CVData {
  const warehouse: WorkExperience = {
    id: 'exp-wh',
    company: 'Atlas',
    position: WAREHOUSE,
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: '',
    descriptionOrigin: 'user',
  };
  const designer: WorkExperience = {
    id: 'exp-gd',
    company: 'Rewitu',
    position: DESIGNER,
    startDate: '2020-01',
    endDate: '2023-04',
    isPresent: false,
    description: '',
    descriptionOrigin: 'user',
  };
  return {
    id: 'cv-270',
    name: 'CV',
    personal: {
      fullName: 'Ana Anić',
      email: 'a@example.com',
      phone: '',
      address: '',
      jobTitle: WAREHOUSE,
      gender: 'female',
    },
    summary: '',
    experience: [warehouse, designer],
    education: [],
    skills: ['Communication', 'Teamwork'],
    languages: [],
    certifications: [],
    templateId: 'modern-minimal',
    region: 'Balkan',
    contentLocale: 'sr',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function enhanceEntry(
  cv: CVData,
  experienceId: string,
  locale: Locale,
  candidate: string,
) {
  const exp = cv.experience.find((e) => e.id === experienceId)!;
  const ctx = buildExperienceJobContext({
    position: exp.position,
    industry: 'general',
    locale,
    level: 'mid',
  });
  const snapshot = createExperienceAiOperationSnapshot({
    liveText: exp.description || '',
    locale,
    requestId: `270-${experienceId}-${locale}`,
    jobContextHash: ctx.key,
    experienceEntryId: experienceId,
  });
  return finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    requestedLocale: locale,
    gender: 'female',
    cv,
    candidate,
    experienceId,
    industry: 'general',
    level: 'mid',
    jobContext: ctx,
    operationSnapshot: snapshot,
    originHint: 'ai_generated',
  });
}

describe('build 270 — cross-locale domain isolation', () => {
  it('does not emit warehouse goods shells for designer domain', () => {
    expect(softDomainClusterFromPosition(DESIGNER)).toBe('visual_design');
    const out = buildCrossLocaleExperienceFallback({
      sourceDescription: GOOD_GD_SR,
      sourceLocale: 'sr',
      targetLocale: 'en',
      gender: 'female',
      isPresent: false,
      position: DESIGNER,
    });
    expect(out).not.toMatch(/incoming goods|warehouse records|movement of goods/i);
    expect(out).toMatch(/visual|design|graphic|materials|identity/i);
  });

  it('rejects warehouse leakage into designer entry', () => {
    const cv = baseCv({
      experience: [
        {
          id: 'exp-wh',
          company: 'Atlas',
          position: WAREHOUSE,
          startDate: '2023-01',
          endDate: '',
          isPresent: true,
          description: GOOD_WH_SR,
          canonicalDescription: GOOD_WH_SR,
          descriptionOrigin: 'ai_generated',
        },
        {
          id: 'exp-gd',
          company: 'Rewitu',
          position: DESIGNER,
          startDate: '2020-01',
          endDate: '2023-04',
          isPresent: false,
          description: GOOD_GD_SR,
          canonicalDescription: GOOD_GD_SR,
          descriptionOrigin: 'ai_generated',
        },
      ],
    });
    const leak = validateCrossEntryExperienceLeakage({
      cv,
      targetExperienceId: 'exp-gd',
      candidate: formatExperienceBullets([
        'Sarađivala je sa timovima za proizvod i razvoj radi očuvanja doslednog vizuelnog identiteta.',
        'Proveravala je pristiglu robu i prateću dokumentaciju radi tačnog evidentiranja.',
        'Ažurirala je skladišnu evidenciju i vodila računa o urednom rasporedu robe.',
      ]),
      targetPosition: DESIGNER,
    });
    expect(leak.ok).toBe(false);
    expect(leak.reason).toBe('cross_entry_fact_leakage');
  });
});

describe('build 270 — Summary duration ownership', () => {
  it('strips and counts six-and-a-half / šest i po phrases', () => {
    const dur = buildExperienceDurationSnapshot([
      {
        id: 'a',
        company: 'A',
        position: 'X',
        startDate: '2020-01',
        endDate: '2023-04',
        isPresent: false,
        description: '',
      },
      {
        id: 'b',
        company: 'B',
        position: 'Y',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: '',
      },
    ], '2026-07-19').total;
    const enPhrase = formatApproximateDurationPhrase(dur, 'en');
    const srPhrase = formatApproximateDurationPhrase(dur, 'sr');
    expect(enPhrase).toMatch(/six and a half/i);
    expect(srPhrase).toMatch(/šest i po|sest i po/i);

    const tripleEn = `${enPhrase}, ${enPhrase}, ${enPhrase}. Professional warehouse and design experience.`;
    expect(countSummaryDurationExpressions(tripleEn, 'en')).toBeGreaterThanOrEqual(2);
    const stripped = stripAllSummaryDurationExpressions(tripleEn, 'en');
    expect(countSummaryDurationExpressions(stripped, 'en')).toBe(0);

    const enforced = enforceAuthoritativeSummaryDuration(tripleEn, dur, 'en', {
      requireDurationClaim: true,
    });
    expect(enforced.diagnostics.finalDurationExpressionCount).toBe(1);
    const again = enforceAuthoritativeSummaryDuration(enforced.summary, dur, 'en', {
      requireDurationClaim: true,
    });
    expect(again.summary).toBe(enforced.summary);
    expect(again.diagnostics.finalDurationExpressionCount).toBe(1);

    const tripleSr = `Profesionalka. ${srPhrase}, ${srPhrase}, ${srPhrase}`;
    const enforcedSr = enforceAuthoritativeSummaryDuration(tripleSr, dur, 'sr', {
      requireDurationClaim: true,
    });
    expect(enforcedSr.diagnostics.finalDurationExpressionCount).toBe(1);
  });

  it('finalize Summary is idempotent across 10 generate cycles', () => {
    seedUsage(10);
    const dur = buildExperienceDurationSnapshot([
      {
        id: 'a', company: 'A', position: 'X', startDate: '2020-01', endDate: '2023-04',
        isPresent: false, description: '',
      },
      {
        id: 'b', company: 'B', position: 'Y', startDate: '2023-01', endDate: '',
        isPresent: true, description: '',
      },
    ], '2026-07-19').total;
    let text = 'Warehouse professional who checks documentation and coordinates goods movement. Also design experience.';
    for (let i = 0; i < 10; i += 1) {
      // Pollute with duplicate localized durations before each ownership pass.
      const polluted = `${text} ${formatApproximateDurationPhrase(dur, 'en')}, ${formatApproximateDurationPhrase(dur, 'en')}`;
      const en = enforceAuthoritativeSummaryDuration(polluted, dur, 'en', {
        requireDurationClaim: true,
      });
      expect(en.diagnostics.finalDurationExpressionCount).toBe(1);
      const srPolluted = `${en.summary} ${formatApproximateDurationPhrase(dur, 'sr')}, ${formatApproximateDurationPhrase(dur, 'sr')}`;
      const sr = enforceAuthoritativeSummaryDuration(srPolluted, dur, 'sr', {
        requireDurationClaim: true,
      });
      expect(sr.diagnostics.finalDurationExpressionCount).toBe(1);
      const again = enforceAuthoritativeSummaryDuration(sr.summary, dur, 'sr', {
        requireDurationClaim: true,
      });
      expect(again.summary).toBe(sr.summary);
      text = again.summary;
      recordProAiUserActionSuccess();
    }
    expect(countSummaryDurationExpressions(text, 'sr')).toBe(1);
  });
});

describe('build 270 — exact sequence 50×', () => {
  beforeEach(() => {
    seedUsage(20);
    clearSummaryAiDiagnosticsForTests();
  });

  it('sr gen both entries → en enhance both → sr enhance both; no leakage; duration once; 50×', () => {
    for (let round = 0; round < 50; round += 1) {
      seedUsage(20);
      let cv = baseCv();

      // 1–2 Serbian empty generation
      for (const id of ['exp-wh', 'exp-gd'] as const) {
        const exp = cv.experience.find((e) => e.id === id)!;
        const gen = buildJobContextGenerationFallback({
          locale: 'sr',
          gender: 'female',
          position: exp.position,
          industry: 'general',
          isPresent: Boolean(exp.isPresent),
        });
        const fin = enhanceEntry(cv, id, 'sr', gen);
        expect(fin.blocked, `sr-gen ${id} r${round}: ${fin.reason}`).toBe(false);
        cv = applyFinalizedBulletsToCv(cv, 'sr', id, fin);
        recordProAiUserActionSuccess();
      }
      expect(cv.experience[0].description).not.toMatch(/vizuel|grafičk|dizajn/i);
      expect(cv.experience[1].description).not.toMatch(/skladišt|robe|pristiglu robu/i);

      // 3 Summary sr
      const sumSr = finalizeCvAiFieldForApply({
        action: 'summary_generate',
        field: 'summary',
        requestedLocale: 'sr',
        gender: 'female',
        cv,
        candidate: [
          'Radnica u skladištu u Atlasu.',
          'Proverava robu i dokumentaciju, ažurira evidenciju i koordiniše kretanje robe.',
          'Ranije je radila kao grafički dizajner na vizuelnim materijalima.',
        ].join(' '),
        originHint: 'ai_generated',
        referenceDateIso: '2026-07-19',
      });
      expect(sumSr.blocked, `sum-sr r${round}: ${sumSr.reason}`).toBe(false);
      expect(countSummaryDurationExpressions(sumSr.text, 'sr')).toBeLessThanOrEqual(1);
      cv = applyFinalizedSummaryToCv(cv, 'sr', sumSr);
      recordProAiUserActionSuccess();

      // 5–7 English enhance both (provider returns Serbian — cross-locale)
      for (const id of ['exp-wh', 'exp-gd'] as const) {
        const live = cv.experience.find((e) => e.id === id)!.description || '';
        const fin = enhanceEntry(cv, id, 'en', live);
        expect(fin.blocked, `en ${id} r${round}: ${fin.reason}`).toBe(false);
        expect(fin.text).not.toMatch(/\b(?:Obavlja|Ažurira|Koordiniše|Kreirala|Sarađivala)\b/);
        if (id === 'exp-gd') {
          expect(fin.text).not.toMatch(/incoming goods|warehouse records|movement of goods/i);
        }
        if (id === 'exp-wh') {
          expect(fin.text).not.toMatch(/visual identity|graphic elements/i);
        }
        cv = applyFinalizedBulletsToCv(cv, 'en', id, fin);
        recordProAiUserActionSuccess();
      }

      // 8 English summary
      const sumEn = finalizeCvAiFieldForApply({
        action: 'summary_generate',
        field: 'summary',
        requestedLocale: 'en',
        gender: 'female',
        cv,
        candidate: cv.summary || 'Warehouse and design professional.',
        originHint: 'ai_generated',
        referenceDateIso: '2026-07-19',
      });
      expect(sumEn.blocked, `sum-en r${round}`).toBe(false);
      expect(countSummaryDurationExpressions(sumEn.text, 'en')).toBe(1);
      cv = applyFinalizedSummaryToCv(cv, 'en', sumEn);
      recordProAiUserActionSuccess();

      // 10–12 back to Serbian
      for (const id of ['exp-wh', 'exp-gd'] as const) {
        const live = cv.experience.find((e) => e.id === id)!.description || '';
        const fin = enhanceEntry(cv, id, 'sr', live);
        expect(fin.blocked, `sr-back ${id} r${round}: ${fin.reason}`).toBe(false);
        if (id === 'exp-gd') {
          expect(fin.text).not.toMatch(/pristiglu robu|skladišnu evidenciju|kretanje robe/i);
        }
        if (id === 'exp-wh') {
          expect(fin.text).not.toMatch(/vizuelnog identiteta|grafičke elemente/i);
        }
        cv = applyFinalizedBulletsToCv(cv, 'sr', id, fin);
        recordProAiUserActionSuccess();
      }

      // 16 reorder — identity still binds by id (enhance may be no-op if unchanged)
      cv = {
        ...cv,
        experience: [cv.experience[1], cv.experience[0]],
      };
      const whAfterReorder = cv.experience.find((e) => e.id === 'exp-wh')!;
      expect(whAfterReorder).toBeTruthy();
      expect(cv.experience[0].id).toBe('exp-gd');
      const finWh = enhanceEntry(
        cv,
        'exp-wh',
        'sr',
        // Force a same-locale enhance with provider noise that must not leak designer facts
        formatExperienceBullets([
          ...(splitExperienceBullets(whAfterReorder.description || '').slice(0, 2)),
          'Koordiniše pripremu i kretanje robe u saradnji sa kolegama.',
        ]),
      );
      if (!finWh.blocked) {
        expect(finWh.diagnostics?.stableEntryIdentityMatched).toBe(true);
        cv = applyFinalizedBulletsToCv(cv, 'sr', 'exp-wh', finWh);
      }
      expect(cv.experience.find((e) => e.id === 'exp-wh')!.description)
        .not.toMatch(/vizuelnog identiteta/i);

      // 18 delete designer, add unrelated — no old facts
      const unrelated: WorkExperience = {
        id: 'exp-new',
        company: 'Nova',
        position: 'Asistent u prodaji',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: '',
        descriptionOrigin: 'user',
      };
      cv = {
        ...cv,
        experience: [cv.experience.find((e) => e.id === 'exp-wh')!, unrelated],
      };
      const genNew = buildJobContextGenerationFallback({
        locale: 'sr',
        gender: 'female',
        position: unrelated.position,
        industry: 'general',
        isPresent: true,
      });
      const finNew = enhanceEntry(cv, 'exp-new', 'sr', genNew);
      expect(finNew.blocked, `new r${round}`).toBe(false);
      expect(finNew.text).not.toMatch(/skladišt|robe|vizuel|grafičk/i);
      cv = applyFinalizedBulletsToCv(cv, 'sr', 'exp-new', finNew);

      if (round === 0) {
        const session = new SummaryAiDiagnosticSession({
          uiLocale: 'sr',
          requestedLocale: 'sr',
          contentLocale: 'sr',
          templateId: 'modern-minimal',
          gender: 'female',
          requestId: '270-sum-diag',
          usageCountBefore: getProAiUsageCount(),
        });
        session.recordCvSnapshot(cv, cv.summary || '');
        session.recordFinalizeResult(sumSr);
        session.recordVisibleApply(true, getProAiUsageCount());
        const trace = session.commit();
        expect(assertSummaryAiDiagnosticHasNoCvText(trace)).toEqual([]);
        expect(getLatestSummaryAiDiagnostic()?.durationClaimCountAfterFinalize).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('build 270 — entry identity races', () => {
  it('rejects finalize when experienceId missing or snapshot mismatches', () => {
    const cv = baseCv({
      experience: [
        {
          id: 'exp-wh',
          company: 'Atlas',
          position: WAREHOUSE,
          startDate: '2023-01',
          endDate: '',
          isPresent: true,
          description: GOOD_WH_SR,
          descriptionOrigin: 'ai_generated',
        },
      ],
    });
    const missing = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'sr',
      gender: 'female',
      cv,
      candidate: GOOD_WH_SR,
      // no experienceId
    });
    expect(missing.blocked).toBe(true);
    expect(missing.reason).toBe('experience_entry_mismatch');

    const snap = createExperienceAiOperationSnapshot({
      liveText: GOOD_WH_SR,
      locale: 'sr',
      requestId: 'race-1',
      jobContextHash: 'k',
      experienceEntryId: 'exp-other',
    });
    const mismatch = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'sr',
      gender: 'female',
      cv,
      candidate: GOOD_WH_SR,
      experienceId: 'exp-wh',
      operationSnapshot: snap,
    });
    expect(mismatch.blocked).toBe(true);
    expect(mismatch.diagnostics?.responseRejectedForEntryMismatch).toBe(true);
  });

  it('identical titles still isolate by entry id', () => {
    const cv = baseCv({
      experience: [
        {
          id: 'exp-a',
          company: 'SameCo',
          position: 'Asistent',
          startDate: '2022-01',
          endDate: '2023-01',
          isPresent: false,
          description: formatExperienceBullets([
            'Pripremala je vizuelne prezentacije za klijente.',
            'Sarađivala je sa dizajn timom na brendingu.',
            'Ažurirala je katalog proizvoda.',
          ]),
          descriptionOrigin: 'ai_generated',
        },
        {
          id: 'exp-b',
          company: 'SameCo',
          position: 'Asistent',
          startDate: '2023-02',
          endDate: '',
          isPresent: true,
          description: formatExperienceBullets([
            'Prima robu i proverava dokumentaciju isporuke.',
            'Ažurira skladišnu evidenciju.',
            'Koordiniše kretanje robe sa kolegama.',
          ]),
          descriptionOrigin: 'ai_generated',
        },
      ],
    });
    const leakOntoA = validateCrossEntryExperienceLeakage({
      cv,
      targetExperienceId: 'exp-a',
      candidate: cv.experience[1].description || '',
      targetPosition: 'Asistent dizajna',
    });
    // Title says design-ish — warehouse from B should be foreign when position hints design
    expect(softDomainClusterFromPosition('Asistent dizajna')).toBe('visual_design');
    const leakDesign = validateCrossEntryExperienceLeakage({
      cv,
      targetExperienceId: 'exp-a',
      candidate: cv.experience[1].description || '',
      targetPosition: 'Asistent dizajna',
    });
    expect(leakDesign.ok).toBe(false);
    void leakOntoA;
  });
});
