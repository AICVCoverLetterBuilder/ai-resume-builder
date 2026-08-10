/**
 * @vitest-environment jsdom
 *
 * Build 272 — Universal locale purity, cross-domain isolation, duration truth.
 * Exact build-271 device regressions:
 * - mixed EN+SR designer bullets must never apply under Serbian target;
 * - deliverables must not become warehouse delivery shells;
 * - Summary 6,5 + šest i po must collapse to one claim with truthful diagnostics.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
  applyFinalizedSummaryToCv,
} from '@/lib/cv-ai-finalize-apply';
import { buildJobContextGenerationFallback } from '@/lib/cv-experience-ai-operation-mode';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { buildExperienceJobContext } from '@/lib/cv-experience-job-context';
import { localizeCanonicalBulletLine } from '@/lib/cv-localized-fallback';
import { classifyMaterialDutyKeys } from '@/lib/cv-material-duty-coverage';
import {
  validateAiUnitLocalePurity,
  experienceBulletsFailTargetLocalePurity,
} from '@/lib/cv-ai-unit-locale-purity';
import {
  countSummaryDurationExpressions,
  enforceAuthoritativeSummaryDuration,
} from '@/lib/cv-summary-duration-ownership';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { validateCrossEntryExperienceLeakage } from '@/lib/cv-experience-entry-isolation';
import { detectExperiencePersonMode } from '@/lib/cv-experience-perspective';
import { auditCvExportIntegrity } from '@/lib/cv-export-integrity-audit';
import {
  SummaryAiDiagnosticSession,
  clearSummaryAiDiagnosticsForTests,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  persistProAiRecord,
  getProAiUsageCount,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import type { Locale } from '@/lib/i18n/translations';

const RUNS = 50;
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

const GOOD_WH_EN = formatExperienceBullets([
  'Checks incoming goods and accompanying documentation for accurate recording.',
  'Updates warehouse records and keeps stock arrangement orderly.',
  'Coordinates preparation and movement of goods with colleagues.',
]);

const GOOD_GD_EN = formatExperienceBullets([
  'Created visual materials and graphic elements for digital products and platforms.',
  'Reviewed visual materials and design specifications for consistency.',
  'Prepared final graphic files and adapted designs for different formats and screens.',
]);

const MIXED_DESIGNER_SR_TARGET = formatExperienceBullets([
  'Created visual materials and graphic elements for digital products and platforms.',
  'Reviewed visual materials and design specifications for consistency.',
  'Sigurno sam isporučivala robu do odredišta.',
]);

const DUAL_DURATION_SR =
  'Radnica u skladištu u Atlasu. Proverava robu i dokumentaciju, ažurira evidenciju i koordiniše kretanje robe. Ranije je radila kao grafički dizajner na vizuelnim materijalima. Sa približno 6,5 godina radnog iskustva i sa oko šest i po godine iskustva.';

function seedUsage(n: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count: n,
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
    id: 'cv-272',
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

function enhanceEntry(cv: CVData, experienceId: string, locale: Locale, candidate: string) {
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
    requestId: `272-${experienceId}-${locale}`,
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

function groundBoth(cvIn: CVData): CVData {
  let cv = cvIn;
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
    expect(fin.blocked, `ground ${id}: ${fin.reason}`).toBe(false);
    cv = applyFinalizedBulletsToCv(cv, 'sr', id, fin);
  }
  return cv;
}

describe('build 272 — root causes of device failure', () => {
  it('deliverables does not classify as logistics_delivery', () => {
    const keys = classifyMaterialDutyKeys(
      'Updated design files and tracked revision status across deliverables.',
    );
    expect(keys).not.toContain('logistics_delivery');
  });

  it('localizing design deliverables never emits warehouse delivery Serbian', () => {
    const out = localizeCanonicalBulletLine(
      'Updated design files and tracked revision status across deliverables.',
      'sr',
      'female',
      { isPresent: false },
    );
    expect(out).not.toMatch(/isporuč|robu do odredišta|skladišt/i);
    expect(out).not.toMatch(/\bCreated\b|\bUpdated\b|\bReviewed\b/);
  });

  it('detects Sigurno sam isporučivala as first person', () => {
    expect(
      detectExperiencePersonMode('Sigurno sam isporučivala robu do odredišta.', 'sr'),
    ).toBe('first_singular');
  });

  it('per-unit purity rejects mixed EN+SR designer block under sr', () => {
    const purity = validateAiUnitLocalePurity(MIXED_DESIGNER_SR_TARGET, 'sr', {
      kind: 'experience_bullet',
    });
    expect(purity.ok).toBe(false);
    expect(purity.wrongLocaleUnitCount).toBeGreaterThanOrEqual(2);
    expect(experienceBulletsFailTargetLocalePurity(MIXED_DESIGNER_SR_TARGET, 'sr')).toBe(true);
  });

  it('cross-entry leakage rejects warehouse sentence under designer title', () => {
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
        {
          id: 'exp-gd',
          company: 'Rewitu',
          position: DESIGNER,
          startDate: '2020-01',
          endDate: '2023-04',
          isPresent: false,
          description: GOOD_GD_SR,
          descriptionOrigin: 'ai_generated',
        },
      ],
    });
    const leak = validateCrossEntryExperienceLeakage({
      cv,
      targetExperienceId: 'exp-gd',
      candidate: MIXED_DESIGNER_SR_TARGET,
      targetPosition: DESIGNER,
    });
    expect(leak.ok).toBe(false);
  });
});

describe('build 272 — finalize rejects mixed designer under Serbian', () => {
  beforeEach(() => {
    seedUsage(20);
    clearSummaryAiDiagnosticsForTests();
  });

  it('blocks or repairs mixed EN+SR designer candidate away from warehouse', () => {
    let cv = groundBoth(baseCv());
    cv = {
      ...cv,
      experience: cv.experience.map((e) =>
        e.id === 'exp-gd'
          ? { ...e, description: GOOD_GD_EN, descriptionOrigin: 'ai_generated' as const }
          : e.id === 'exp-wh'
            ? { ...e, description: GOOD_WH_EN, descriptionOrigin: 'ai_generated' as const }
            : e,
      ),
      contentLocale: 'en',
    };
    const fin = enhanceEntry(cv, 'exp-gd', 'sr', MIXED_DESIGNER_SR_TARGET);
    if (!fin.blocked) {
      expect(fin.text).not.toMatch(/isporuč|robu do odredišta|Created visual|Reviewed visual/i);
      expect(validateAiUnitLocalePurity(fin.text, 'sr').ok).toBe(true);
      expect(fin.diagnostics?.targetLocalePurityPassed).not.toBe(false);
    } else {
      expect(fin.countedAsSuccess).toBe(false);
    }
  });

  it(`exact locale-cycle sequence — ${RUNS} runs, zero flakes`, () => {
    for (let round = 0; round < RUNS; round += 1) {
      seedUsage(20);
      let cv = baseCv();

      // 1–2 Serbian generation
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
        expect(validateAiUnitLocalePurity(fin.text, 'sr').ok).toBe(true);
        cv = applyFinalizedBulletsToCv(cv, 'sr', id, fin);
        recordProAiUserActionSuccess();
      }
      expect(cv.experience.find((e) => e.id === 'exp-wh')!.description).not.toMatch(/vizuel|grafičk|dizajn/i);
      expect(cv.experience.find((e) => e.id === 'exp-gd')!.description).not.toMatch(/skladišt|robu|isporuč/i);

      // 3 Summary sr
      const sumSr = finalizeCvAiFieldForApply({
        action: 'summary_generate',
        field: 'summary',
        requestedLocale: 'sr',
        gender: 'female',
        cv,
        candidate: DUAL_DURATION_SR,
        originHint: 'ai_generated',
        referenceDateIso: '2026-07-19',
      });
      expect(sumSr.blocked, `sum-sr r${round}: ${sumSr.reason}`).toBe(false);
      expect(countSummaryDurationExpressions(sumSr.text, 'sr')).toBe(1);
      cv = applyFinalizedSummaryToCv(cv, 'sr', sumSr);
      recordProAiUserActionSuccess();

      // 5–7 English enhance
      for (const id of ['exp-wh', 'exp-gd'] as const) {
        const live = cv.experience.find((e) => e.id === id)!.description || '';
        const fin = enhanceEntry(cv, id, 'en', live);
        expect(fin.blocked, `en ${id} r${round}: ${fin.reason}`).toBe(false);
        expect(validateAiUnitLocalePurity(fin.text, 'en').ok).toBe(true);
        if (id === 'exp-gd') {
          expect(fin.text).not.toMatch(/incoming goods|warehouse|deliver goods/i);
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
        candidate: `${cv.summary || 'Professional.'} around 6.5 years of experience and six and a half years of experience.`,
        originHint: 'ai_generated',
        referenceDateIso: '2026-07-19',
      });
      expect(sumEn.blocked, `sum-en r${round}: ${sumEn.reason || 'no reason'} ${JSON.stringify({
        text: sumEn.text,
        finalSlotRejectionReasons: sumEn.diagnostics?.finalSlotRejectionReasons,
        requiredCurrentDutyFactCount: sumEn.diagnostics?.requiredCurrentDutyFactCount,
        coveredCurrentDutyFactCount: sumEn.diagnostics?.coveredCurrentDutyFactCount,
        missingCurrentDutyFactCount: sumEn.diagnostics?.missingCurrentDutyFactCount,
      })}`).toBe(false);
      expect(countSummaryDurationExpressions(sumEn.text, 'en')).toBe(1);
      cv = applyFinalizedSummaryToCv(cv, 'en', sumEn);
      recordProAiUserActionSuccess();

      // Simulate restart: keep content, switch UI intent to Serbian
      cv = { ...cv, contentLocale: 'en' };

      // 11–12 Serbian enhance — poisoned mixed provider must not leave EN/warehouse/1sg
      const poison = enhanceEntry(cv, 'exp-gd', 'sr', MIXED_DESIGNER_SR_TARGET);
      let designerAlreadyRepaired = false;
      if (poison.blocked) {
        expect(poison.countedAsSuccess).toBe(false);
      } else {
        expect(validateAiUnitLocalePurity(poison.text, 'sr').ok, `poison purity r${round}`).toBe(true);
        expect(poison.text).not.toMatch(/isporuč|robu do odredišta|Created visual|Reviewed visual|\bsam\b/i);
        cv = applyFinalizedBulletsToCv(cv, 'sr', 'exp-gd', poison);
        recordProAiUserActionSuccess();
        designerAlreadyRepaired = true;
      }

      for (const id of ['exp-wh', 'exp-gd'] as const) {
        if (id === 'exp-gd' && designerAlreadyRepaired) continue;
        const live = cv.experience.find((e) => e.id === id)!.description || '';
        const fin = enhanceEntry(cv, id, 'sr', live);
        expect(fin.blocked, `sr-back ${id} r${round}: ${fin.reason}`).toBe(false);
        expect(validateAiUnitLocalePurity(fin.text, 'sr').ok).toBe(true);
        if (id === 'exp-gd') {
          expect(fin.text).not.toMatch(/isporuč|robu do odredišta|Created visual|Reviewed visual/i);
          expect(fin.text).not.toMatch(/\bsam\b/i);
        }
        if (id === 'exp-wh') {
          expect(fin.text).not.toMatch(/vizuelnog identiteta|grafičke elemente/i);
        }
        cv = applyFinalizedBulletsToCv(cv, 'sr', id, fin);
        recordProAiUserActionSuccess();
      }

      // 13 Summary sr again
      const sumSr2 = finalizeCvAiFieldForApply({
        action: 'summary_generate',
        field: 'summary',
        requestedLocale: 'sr',
        gender: 'female',
        cv,
        candidate: DUAL_DURATION_SR,
        originHint: 'ai_generated',
        referenceDateIso: '2026-07-19',
      });
      expect(sumSr2.blocked).toBe(false);
      expect(countSummaryDurationExpressions(sumSr2.text, 'sr')).toBe(1);
      cv = applyFinalizedSummaryToCv(cv, 'sr', sumSr2);

      // Export integrity (non-mutating)
      const audit = auditCvExportIntegrity(cv, 'sr');
      expect(audit.ok, `audit r${round}: ${audit.reasons.join(',')}`).toBe(true);
      expect(audit.summaryDurationClaimCount).toBe(1);
      expect(audit.entries.every((e) => e.targetLocalePurityPassed)).toBe(true);

      // 17 reorder
      cv = { ...cv, experience: [cv.experience[1], cv.experience[0]] };
      expect(cv.experience.find((e) => e.id === 'exp-wh')!.description).not.toMatch(/vizuel|grafičk/i);
      expect(cv.experience.find((e) => e.id === 'exp-gd')!.description).not.toMatch(/skladišt|isporuč/i);

      // 19–21 delete designer, add unrelated
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
      expect(finNew.blocked).toBe(false);
      expect(finNew.text).not.toMatch(/skladišt|robe|vizuel|grafičk|isporuč/i);
      cv = applyFinalizedBulletsToCv(cv, 'sr', 'exp-new', finNew);

      if (round === 0) {
        const session = new SummaryAiDiagnosticSession({
          uiLocale: 'sr',
          requestedLocale: 'sr',
          contentLocale: 'sr',
          templateId: 'modern-minimal',
          gender: 'female',
          requestId: '272-sum',
          usageCountBefore: getProAiUsageCount(),
        });
        session.recordCvSnapshot(cv, DUAL_DURATION_SR);
        session.recordFinalizeResult(sumSr2);
        session.recordVisibleApply(true, getProAiUsageCount() + 1, sumSr2.text);
        const trace = session.commit();
        expect(trace.independentFinalDurationClaimCount).toBe(1);
        expect(trace.durationValidationPassed).toBe(true);
        expect(trace.raceGuardResult).toBe('ok');
      }
    }
  }, 15_000);
});

describe('build 272 — duration + diagnostics truth', () => {
  it('collapses 6,5 + šest i po and stays idempotent', () => {
    const dur = buildExperienceDurationSnapshot(baseCv().experience, '2026-07-19').total;
    const owned = enforceAuthoritativeSummaryDuration(DUAL_DURATION_SR, dur, 'sr', {
      requireDurationClaim: true,
    });
    expect(owned.diagnostics.durationClaimCountBeforeStrip).toBeGreaterThanOrEqual(2);
    expect(owned.diagnostics.independentFinalDurationClaimCount).toBe(1);
    const again = enforceAuthoritativeSummaryDuration(owned.summary, dur, 'sr', {
      requireDurationClaim: true,
    });
    expect(again.summary).toBe(owned.summary);
  });

  it('diagnostics never PASS when visible text has two duration claims', () => {
    clearSummaryAiDiagnosticsForTests();
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'sr',
      requestedLocale: 'sr',
      contentLocale: 'sr',
      templateId: 'modern-minimal',
      gender: 'female',
      requestId: '272-false',
      usageCountBefore: 0,
    });
    const mixed =
      'Profesionalka sa približno 6,5 godina radnog iskustva i sa oko šest i po godine iskustva.';
    session.recordCvSnapshot(baseCv(), mixed);
    session.recordFinalizeResult({
      blocked: false,
      text: mixed,
      origin: 'ai_generated',
      countedAsSuccess: true,
      diagnostics: {
        durationValidationPassed: true,
        finalDurationExpressionCount: 1,
        independentFinalDurationClaimCount: 1,
      },
    });
    session.recordVisibleApply(true, 1, mixed);
    const trace = session.commit();
    expect(trace.independentFinalDurationClaimCount).toBe(2);
    expect(trace.durationValidationPassed).toBe(false);
    expect(trace.finalPostconditionsPassed).toBe(false);
  });
});

describe('build 272 — locale purity matrix samples', () => {
  const pairs: Array<[Locale, string, boolean]> = [
    ['sr', 'Created visual materials and graphic elements for digital products.', false],
    ['sr', 'Kreirala je vizuelne materijale za digitalne proizvode.', true],
    ['en', 'Kreirala je vizuelne materijale za digitalne proizvode.', false],
    ['en', 'Created visual materials and graphic elements for digital products.', true],
    ['hi', 'Created visual materials for digital products.', false],
    ['de', 'Erstellte visuelle Materialien für digitale Produkte.', true],
  ];

  it.each(pairs)('%s purity for sample → %s', (locale, text, expectOk) => {
    const purity = validateAiUnitLocalePurity(text, locale, { kind: 'experience_bullet' });
    expect(purity.ok).toBe(expectOk);
  });
});
