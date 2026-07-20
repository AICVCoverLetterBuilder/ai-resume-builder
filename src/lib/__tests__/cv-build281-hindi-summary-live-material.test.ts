/**
 * Build 281: live Hindi object-before-verb material extraction, duration
 * idempotence, exact three-sentence slots, runtime-281 markers.
 */
import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import { formatExperienceBullets } from '../cv-canonical-facts';
import {
  classifyMaterialDutyKeys,
  hindiWarehouseCueKeysFromUnit,
  materialDutyKeysFromDescription,
} from '../cv-material-duty-coverage';
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
  splitHindiSummaryUnits,
} from '../cv-summary-grounding';
import { SUMMARY_DURATION_FINALIZER_REVISION } from '../cv-content-quality';
import { buildExperienceJobContext } from '../cv-experience-job-context';
import { SummaryAiDiagnosticSession } from '../cv-summary-ai-diagnostics';
import { buildExperienceDurationSnapshot } from '../cv-experience-duration';

/** Live Android-like Hindi: object-before-verb + जांच anusvara forms. */
const WH_HI_LIVE = formatExperienceBullets([
  'माल की जांच करती है और संबंधित दस्तावेज़ों की जाँच करती है।',
  'गोदाम के रिकॉर्ड अद्यतन करती है और सामान को व्यवस्थित रखती है।',
  'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।',
]);

const GD_HI = formatExperienceBullets([
  'प्रिंट और डिजिटल दोनों माध्यमों के लिए ग्राफिक डिज़ाइन तैयार किया।',
  'ब्रांड की दृश्य पहचान और दिशानिर्देश बनाए रखे।',
]);

const EN_WH_STALE = formatExperienceBullets([
  'Checked incoming goods and accompanying documents for accuracy.',
  'Updated warehouse records and arranged goods in an orderly way.',
  'Coordinated preparation and movement of goods with colleagues.',
]);

const EN_GD_STALE = formatExperienceBullets([
  'Created print and digital graphic design materials.',
  'Maintained visual identity and brand guidelines.',
]);

const DEVICE_INVALID =
  'जनवरी 2023 से Atlas में कार्यरत और लगभग साढ़े छह वर्षों के संयुक्त अनुभव के '
  + 'साथ प्रिंट व डिजिटल दोनों माध्यमों के लिए प्रभावशाली ग्राफिक डिज़ाइन तैयार '
  + 'करती रही। इससे पहले Rewitu में ग्राफिक डिज़ाइनर के रूप में ब्रांड की दृश्य '
  + 'पहचान को सुदृढ़ बनाए रखने में सक्रिय भूमिका निभा चुकी।';

const ID_ATLAS = 'd7157a5f-aaaa-4bbb-8ccc-ddddeeeeeee1';
const ID_REWITU = 'e922aae9-bbbb-4ccc-8ddd-eeeefffff001';

function persistedFixture(order: 'wh-first' | 'gd-first' = 'wh-first'): CVData {
  const wh = {
    id: ID_ATLAS,
    position: 'Radnica u skladištu',
    company: 'Atlas',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: WH_HI_LIVE,
    originalUserDescription: WH_HI_LIVE,
    canonicalDescription: EN_WH_STALE,
    generatedDescription: EN_WH_STALE,
    descriptionOrigin: 'ai_generated' as const,
    generatedLocale: 'en' as const,
    groundingJobContextKey: 'stale-en-context',
    generationJobContextKey: 'stale-en-context',
  };
  const gd = {
    id: ID_REWITU,
    position: 'Grafički dizajner',
    company: 'Rewitu',
    startDate: '2020-01',
    endDate: '2023-04',
    isPresent: false,
    description: GD_HI,
    originalUserDescription: GD_HI,
    canonicalDescription: EN_GD_STALE,
    generatedDescription: EN_GD_STALE,
    descriptionOrigin: 'ai_generated' as const,
    generatedLocale: 'en' as const,
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
    summary: DEVICE_INVALID,
    summaryOrigin: 'ai_generated',
    experience: order === 'wh-first' ? [wh, gd] : [gd, wh],
    education: [],
    skills: [],
    languages: [],
    contentLocale: 'hi',
    canonicalSummary: DEVICE_INVALID,
  };
}

function runOrchestration(cv: CVData, candidate: string) {
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
    requestId: 'req-build281',
    usageCountBefore: 0,
    operationMode: 'enhance_existing_content',
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

describe('build 281 Hindi Summary live material + duration idempotence', () => {
  it('exposes runtime-281 revision markers', () => {
    expect(SUMMARY_PIPELINE_REVISION).toBe('summary-runtime-281-v1');
    expect(SUMMARY_BUILDER_REVISION).toBe('live-hindi-material-rebuild-v3');
    expect(SUMMARY_UNIT_SPLITTER_REVISION).toBe('hindi-three-sentence-slots-v3');
    expect(SUMMARY_GROUNDING_REVISION).toBe('entry-owned-grounding-v3');
    expect(SUMMARY_DURATION_FINALIZER_REVISION).toBe('duration-idempotent-v3');
  });

  it('extracts concrete keys from object-before-verb जांच units', () => {
    expect(classifyMaterialDutyKeys('माल की जांच करती है।')).toContain('warehouse_inbound_check');
    expect(materialDutyKeysFromDescription(WH_HI_LIVE).filter((k) => k !== 'generic_duty').length)
      .toBeGreaterThanOrEqual(2);
    const cues = [...new Set(
      WH_HI_LIVE.split(/\n+/).flatMap((u) => hindiWarehouseCueKeysFromUnit(u)),
    )];
    const expected = [
      'warehouse_inbound_check',
      'warehouse_document_check',
      'warehouse_records',
      'warehouse_orderly_goods',
      'warehouse_preparation',
      'warehouse_movement',
      'warehouse_colleague_coordination',
    ];
    expect(cues.filter((c) => expected.includes(c)).length).toBeGreaterThanOrEqual(2);
  });

  it('rebuilds three-sentence Hindi Summary; duration pass1===pass2; usage 0→1', () => {
    const { pipe, applied, usageAfter } = runOrchestration(persistedFixture(), DEVICE_INVALID);
    expect(applied).toBe(true);
    expect(usageAfter).toBe(1);
    const text = pipe.finalized.text;
    expect(splitHindiSummaryUnits(text)).toHaveLength(3);
    expect(text).toMatch(/वेयरहाउस\s*कर्मचारी\s+के\s+रूप\s+में/);
    expect(text).toMatch(/जनवरी\s+2023\s+से\s+Atlas/);
    expect(text).toMatch(/लगभग\s+साढ़े\s+छह\s+वर्षों\s+का\s+संयुक्त\s+अनुभव/);
    expect(text).toMatch(/माल|गोदाम|आवाजाही|जाँच|जांच/);
    expect(text).toMatch(/Rewitu/);
    expect(text).toMatch(/ग्राफिक|डिज़ाइन|प्रिंट/);

    const d = pipe.finalized.diagnostics!;
    expect(d.currentEntryMaterialKeys?.includes('generic_duty')).toBe(false);
    expect((d.currentEntryMaterialKeys || []).length).toBeGreaterThanOrEqual(2);
    expect(d.currentSourceUnitMaterialKeys?.length).toBeGreaterThanOrEqual(3);
    expect(d.deterministicCandidateSentenceCount).toBe(3);
    expect(d.finalSentenceRoleSlots || d.finalUnitRoleSlots).toEqual([
      'current_intro',
      'current_duty',
      'prior_role',
    ]);
    expect(d.candidateCurrentEmploymentIntroductionCount).toBe(1);
    expect(d.currentRoleConcreteFactCoverage).toBeGreaterThanOrEqual(2);
    expect(d.priorRoleGroundingPassed).toBe(true);
    expect(d.currentSlotForeignFactCount).toBe(0);
    expect(d.semanticCrossEntryLeakageDetected).toBe(false);
    expect(d.durationSecondPassChanged).toBe(false);
    expect(d.durationPass1Hash).toBe(d.durationPass2Hash);
    expect(d.durationPass1CandidateHash).toBe(d.durationPass2CandidateHash);
    expect(d.durationPass2CandidateHash).toBe(d.groundingInputCandidateHash);
    expect(d.deterministicCandidateHash).toBe(d.durationPass1CandidateHash);
    expect(d.durationFinalizerIdempotent).toBe(true);
    expect(d.summaryPipelineRevision).toBe('summary-runtime-281-v1');
    expect(d.summaryBuilderRevision).toBe('live-hindi-material-rebuild-v3');
    expect(d.summaryUnitSplitterRevision).toBe('hindi-three-sentence-slots-v3');
    expect(d.summaryGroundingRevision).toBe('entry-owned-grounding-v3');
    expect(d.summaryDurationFinalizerRevision).toBe('duration-idempotent-v3');
  });

  it('50× stable + reversed Experience order', () => {
    let first = '';
    for (let i = 0; i < 50; i += 1) {
      const order = i % 2 === 0 ? 'wh-first' : 'gd-first';
      const { pipe, applied } = runOrchestration(persistedFixture(order), DEVICE_INVALID);
      expect(applied, `iter ${i}`).toBe(true);
      expect(splitHindiSummaryUnits(pipe.finalized.text)).toHaveLength(3);
      expect(pipe.finalized.diagnostics?.durationPass1Hash)
        .toBe(pipe.finalized.diagnostics?.durationPass2Hash);
      if (i === 0) first = pipe.finalized.text;
      else expect(pipe.finalized.text).toBe(first);
    }
  });

  it('invalid +0; repaired +1; identical no-op +0; restart retains', () => {
    const bare: CVData = { ...persistedFixture(), experience: [] };
    const rejected = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv: bare,
      candidate: DEVICE_INVALID,
      referenceDateIso: '2026-07-19',
    });
    expect(rejected.countedAsSuccess).toBe(false);

    const first = runOrchestration(persistedFixture(), DEVICE_INVALID);
    expect(first.applied).toBe(true);
    expect(first.usageAfter).toBe(1);
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
    expect(secondFin.blocked).toBe(false);
    expect(secondFin.text.trim()).toBe(live);

    const restarted = structuredClone(first.stateCv);
    expect(restarted.summary).toBe(live);
    expect(restarted.contentLocale).toBe('hi');
  });

  it('raw invalid analyzer remains fail-closed', () => {
    const q = analyzeHindiSummaryEmploymentQuality(DEVICE_INVALID, {
      company: 'Atlas',
      role: 'वेयरहाउस कर्मचारी',
      structuredRole: 'वेयरहाउस कर्मचारी',
      currentEntryDuties: WH_HI_LIVE,
      priorEntryDuties: GD_HI,
      priorCompany: 'Rewitu',
    });
    expect(q.groundingValidationPassed).toBe(false);
  });
});
