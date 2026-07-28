/**
 * Build 278: production Summary button path must receive Serbian warehouse
 * structured titles, build non-null job context, and apply entry-owned Hindi
 * Summary via the same finalize/apply orchestration as cv-builder/page.tsx.
 */
import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import { formatExperienceBullets } from '../cv-canonical-facts';
import {
  applyFinalizedSummaryToCv,
  finalizeCvAiFieldForApply,
  runCvAiApplyPipeline,
  SUMMARY_PIPELINE_REVISION,
} from '../cv-ai-finalize-apply';
import {
  SUMMARY_BUILDER_REVISION,
  SUMMARY_GROUNDING_REVISION,
  SUMMARY_UNIT_SPLITTER_REVISION,
  analyzeHindiSummaryEmploymentQuality,
} from '../cv-summary-grounding';
import { SUMMARY_DURATION_FINALIZER_REVISION } from '../cv-content-quality';

// Revisions move with the active Summary runtime; assert via exported constants.
import {
  buildExperienceJobContext,
  classifyExperiencePosition,
} from '../cv-experience-job-context';
import {
  matchesWarehouseOccupationalTitle,
  resolveOccupationalTitleForSummary,
} from '../cv-role-title';
import { SummaryAiDiagnosticSession } from '../cv-summary-ai-diagnostics';
import { buildExperienceDurationSnapshot } from '../cv-experience-duration';

const WH_HI = formatExperienceBullets([
  'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित करती है।',
  'गोदाम के रिकॉर्ड अद्यतन करती है और सामान को व्यवस्थित रखती है।',
  'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।',
]);

const GD_HI = formatExperienceBullets([
  'प्रिंट और डिजिटल दोनों माध्यमों के लिए ग्राफिक डिज़ाइन तैयार किया।',
  'ब्रांड की दृश्य पहचान और दिशानिर्देश बनाए रखे।',
  'टीम के साथ डिज़ाइन समन्वय किया।',
]);

/** Exact invalid build-278 device candidate (design facts in current Atlas slot). */
const DEVICE_278_INVALID =
  'जनवरी 2023 से Atlas में कार्यरत और लगभग साढ़े छह वर्षों के संयुक्त अनुभव के '
  + 'साथ प्रिंट व डिजिटल दोनों माध्यमों के लिए प्रभावशाली ग्राफिक डिज़ाइन तैयार '
  + 'करती रही। इससे पहले Rewitu में ग्राफिक डिज़ाइनर के रूप में ब्रांड की दृश्य '
  + 'पहचान को सुदृढ़ बनाए रखने में सक्रिय भूमिका निभा चुकी।';

const SERBIAN_WAREHOUSE_VARIANTS = [
  'Radnica u skladištu',
  'Radnik u skladištu',
  'skladištar',
  'skladištarka',
  'magacioner',
  'magacionerka',
  'radnik u magacinu',
  'radnica u magacinu',
  'Radnica u skladistu',
];

function fixtureCv(order: 'wh-first' | 'gd-first' = 'wh-first', summary = DEVICE_278_INVALID): CVData {
  const wh = {
    id: 'exp-wh-atlas',
    position: 'Radnica u skladištu',
    company: 'Atlas',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: WH_HI,
    descriptionOrigin: 'user' as const,
    originalUserDescription: WH_HI,
    canonicalDescription: WH_HI,
    generatedLocale: 'hi' as const,
  };
  const gd = {
    id: 'exp-gd-rewitu',
    position: 'Grafički dizajner',
    company: 'Rewitu',
    startDate: '2020-01',
    endDate: '2023-04',
    isPresent: false,
    description: GD_HI,
    descriptionOrigin: 'user' as const,
    originalUserDescription: GD_HI,
    canonicalDescription: GD_HI,
    generatedLocale: 'hi' as const,
  };
  return {
    personal: {
      fullName: 'Ana Anić',
      email: 'ana@example.com',
      phone: '',
      location: 'Beograd',
      jobTitle: 'Radnica u skladištu',
      gender: 'female',
    },
    summary,
    experience: order === 'wh-first' ? [wh, gd] : [gd, wh],
    education: [],
    skills: [],
    languages: [],
    contentLocale: 'hi',
  };
}

function assertValidRepaired(text: string) {
  expect(text).toMatch(/वेयरहाउस\s*कर्मचारी/);
  expect(text).toMatch(/Atlas/);
  expect(text).toMatch(/साढ़े\s*छह/);
  expect(text).toMatch(/माल|गोदाम|आवाजाही|सामान|स्थानांतरण/);
  expect(text).toMatch(/Rewitu|ग्राफिक|ग्राफ़िक|डिज़ाइन|प्रिंट|दृश्य/);
  expect(text).not.toMatch(/पेशेवर\s+के\s+रूप\s+में/);
  expect(text).toMatch(/कार्यरत\s+हूँ|मेरे\s+पास/);
  const beforePrior = text.split(/इससे\s+पहले/)[0] || text;
  const dutyPart = beforePrior.replace(/^[^।]*।\s*/, '');
  expect(dutyPart).not.toMatch(/ग्राफिक|ग्राफ़िक|डिज़ाइन|प्रिंट|डिजिटल|ब्रांड/);
}

/** Mirrors handleGenSummary → finalize → apply → diagnostic session. */
function runProductionSummaryOrchestration(cv: CVData, candidate: string) {
  const requestedLocale = 'hi' as const;
  const primary = (cv.experience || []).find((e) => e.isPresent) || (cv.experience || [])[0];
  const jobContext = buildExperienceJobContext({
    position: primary?.position || cv.personal?.jobTitle,
    locale: requestedLocale,
  });
  const durationSnapshot = buildExperienceDurationSnapshot(
    cv.experience || [],
    '2026-07-19',
  );
  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'hi',
    requestedLocale,
    contentLocale: cv.contentLocale || null,
    templateId: '',
    gender: cv.personal.gender || '',
    requestId: 'req-build278-prod',
    usageCountBefore: 0,
    operationMode: 'generate_from_context',
    jobContextHash: jobContext.key,
  });
  session.recordCvSnapshot(cv, (cv.summary || '').trim());

  const pipe = runCvAiApplyPipeline({
    cv,
    locale: requestedLocale,
    action: 'summary_generate',
    candidate,
    durationSnapshot,
    referenceDateIso: '2026-07-19',
    jobContext,
  });

  session.recordFinalizeResult(pipe.finalized);
  const applied = !pipe.blocked && pipe.finalized.countedAsSuccess;
  let usageAfter = 0;
  let stateCv = cv;
  if (applied) {
    stateCv = applyFinalizedSummaryToCv(cv, requestedLocale, pipe.finalized, jobContext);
    usageAfter = 1;
  }
  session.recordVisibleApply(applied, usageAfter, applied ? pipe.finalized.text : undefined);
  const trace = session.commit();
  return { pipe, trace, stateCv, jobContext, usageAfter, applied };
}

describe('build 278 Hindi Summary production-path wiring', () => {
  it('classifies Serbian warehouse title variants as warehouse → वेयरहाउस कर्मचारी', () => {
    for (const title of SERBIAN_WAREHOUSE_VARIANTS) {
      expect(matchesWarehouseOccupationalTitle(title), title).toBe(true);
      expect(classifyExperiencePosition(title), title).toBe('logistics');
      expect(
        resolveOccupationalTitleForSummary({
          currentExperienceTitle: title,
          locale: 'hi',
          gender: 'female',
          dutiesText: WH_HI,
        }),
        title,
      ).toBe('वेयरहाउस कर्मचारी');
    }
  });

  it('exact Radnica u skladištu never collapses to पेशेवर', () => {
    const role = resolveOccupationalTitleForSummary({
      profileJobTitle: 'Radnica u skladištu',
      currentExperienceTitle: 'Radnica u skladištu',
      locale: 'hi',
      gender: 'female',
      dutiesText: WH_HI,
    });
    expect(role).toBe('वेयरहाउस कर्मचारी');
    expect(role).not.toBe('पेशेवर');
  });

  it('repairs DEVICE_278 via production orchestration; job context non-null; markers present', () => {
    const cv = fixtureCv('wh-first');
    const { pipe, trace, stateCv, jobContext, usageAfter, applied } = runProductionSummaryOrchestration(
      cv,
      DEVICE_278_INVALID,
    );

    expect(jobContext.key).toBeTruthy();
    expect(trace.currentJobContextHash).toBe(jobContext.key);
    expect(trace.currentJobContextHash).not.toBeNull();

    expect(applied).toBe(true);
    expect(pipe.blocked).toBe(false);
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(usageAfter).toBe(1);
    assertValidRepaired(pipe.finalized.text);
    expect(stateCv.summary).toBe(pipe.finalized.text);
    expect(stateCv.contentLocale).toBe('hi');

    expect(pipe.finalized.diagnostics?.currentEmploymentIntroductionCount).toBe(1);
    expect(pipe.finalized.diagnostics?.currentRoleConcreteFactCoverage).toBeGreaterThanOrEqual(2);
    expect(pipe.finalized.diagnostics?.priorRoleGroundingPassed).toBe(true);
    expect(pipe.finalized.diagnostics?.currentSlotForeignFactCount).toBe(0);
    expect(pipe.finalized.diagnostics?.priorSlotForeignFactCount).toBe(0);
    expect(pipe.finalized.diagnostics?.semanticCrossEntryLeakageDetected).toBe(false);
    expect(pipe.finalized.diagnostics?.durationFinalizerIdempotent).toBe(true);
    expect(pipe.finalized.diagnostics?.currentRoleTitleSource).toBe('structured_current_role');
    expect(pipe.finalized.diagnostics?.finalUnitRoleSlots).toEqual(
      expect.arrayContaining(['duration', 'current_intro', 'prior_role']),
    );
    expect(pipe.finalized.diagnostics?.currentDutySlotPresent
      ?? pipe.finalized.diagnostics?.currentIntroSlotPresent).toBeTruthy();

    expect(pipe.finalized.diagnostics?.summaryPipelineRevision).toBe(SUMMARY_PIPELINE_REVISION);
    expect(pipe.finalized.diagnostics?.summaryBuilderRevision).toBe(SUMMARY_BUILDER_REVISION);
    expect(pipe.finalized.diagnostics?.summaryUnitSplitterRevision).toBe(SUMMARY_UNIT_SPLITTER_REVISION);
    expect(pipe.finalized.diagnostics?.summaryGroundingRevision).toBe(SUMMARY_GROUNDING_REVISION);
    expect(pipe.finalized.diagnostics?.summaryDurationFinalizerRevision)
      .toBe(SUMMARY_DURATION_FINALIZER_REVISION);
    expect(trace.summaryPipelineRevision).toBe(SUMMARY_PIPELINE_REVISION);
    expect(trace.summaryUnitSplitterRevision).toBe(SUMMARY_UNIT_SPLITTER_REVISION);
    expect(trace.summaryGroundingRevision).toBe(SUMMARY_GROUNDING_REVISION);
    expect(trace.summaryDurationFinalizerRevision).toBe(SUMMARY_DURATION_FINALIZER_REVISION);
  });

  it('50× identical production orchestration stays stable', () => {
    const cv = fixtureCv('wh-first');
    let firstText = '';
    for (let i = 0; i < 50; i += 1) {
      const { pipe, applied, usageAfter, trace } = runProductionSummaryOrchestration(
        cv,
        DEVICE_278_INVALID,
      );
      expect(applied, `run ${i}`).toBe(true);
      expect(usageAfter, `run ${i}`).toBe(1);
      expect(trace.currentJobContextHash, `run ${i}`).toBeTruthy();
      assertValidRepaired(pipe.finalized.text);
      if (i === 0) firstText = pipe.finalized.text;
      else expect(pipe.finalized.text).toBe(firstText);
    }
  });

  it('reordered Experience array still selects Present warehouse entry', () => {
    const cv = fixtureCv('gd-first');
    const { pipe, applied, trace, jobContext } = runProductionSummaryOrchestration(
      cv,
      DEVICE_278_INVALID,
    );
    expect(applied).toBe(true);
    expect(trace.currentJobContextHash).toBe(jobContext.key);
    assertValidRepaired(pipe.finalized.text);
    expect(pipe.finalized.diagnostics?.currentRoleConcreteFactCoverage).toBeGreaterThanOrEqual(2);
    expect(pipe.finalized.diagnostics?.priorRoleGroundingPassed).toBe(true);
  });

  it('invalid unrepaired candidate remains fail-closed with usage +0', () => {
    const bare: CVData = {
      ...fixtureCv('wh-first', DEVICE_278_INVALID),
      experience: [],
    };
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv: bare,
      candidate: DEVICE_278_INVALID,
      referenceDateIso: '2026-07-19',
    });
    // Without Experience facts, repair cannot ground — fail closed, +0.
    expect(fin.countedAsSuccess).toBe(false);
    expect(fin.blocked || !fin.countedAsSuccess).toBe(true);
  });

  it('analyzer rejects raw DEVICE_278_INVALID against warehouse structured role', () => {
    const q = analyzeHindiSummaryEmploymentQuality(DEVICE_278_INVALID, {
      company: 'Atlas',
      role: 'वेयरहाउस कर्मचारी',
      structuredRole: 'वेयरहाउस कर्मचारी',
      currentEntryDuties: WH_HI,
      priorEntryDuties: GD_HI,
      priorCompany: 'Rewitu',
    });
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.currentRoleConcreteFactCoverage).toBe(0);
    expect(q.currentRoleOmittedDetected).toBe(true);
  });

  it('valid repaired candidate increments once; identical re-apply is no-op +0', () => {
    const cv = fixtureCv('wh-first');
    const first = runProductionSummaryOrchestration(cv, DEVICE_278_INVALID);
    expect(first.applied).toBe(true);
    expect(first.usageAfter).toBe(1);

    // Mirrors handleGenSummary identical-text no-op: finalize rejects unchanged enhance.
    const live = (first.stateCv.summary || '').trim();
    const secondFin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv: first.stateCv,
      candidate: live,
      referenceDateIso: '2026-07-19',
    });
    expect(secondFin.blocked).toBe(true);
    expect(secondFin.countedAsSuccess).toBe(false);
    expect(secondFin.reason).toBe('summary_noop_after_normalization');
    expect((secondFin.text || '').trim()).toBe(live);
    const identicalNoop = (secondFin.text || '').trim() === live;
    expect(identicalNoop).toBe(true);
    const usageAfterNoop = identicalNoop ? 1 : 2; // countBefore was already 1
    expect(usageAfterNoop).toBe(1);
  });
});
