/**
 * Build-293b: Croatian Experience AI deterministic-fallback locative grammar.
 * Guards `pregledom rasporedu` / coordinated adjective agreement on warehouse duties.
 * Does not modify Croatian Professional Summary builders.
 */
import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import {
  applyFinalizedBulletsToCv,
  runCvAiApplyPipeline,
} from '../cv-ai-finalize-apply';
import { formatExperienceBullets } from '../cv-canonical-facts';
import { hashExperienceEntryId } from '../cv-experience-entry-isolation';
import {
  buildExperienceAiNoOpStylisticFallback,
  hasMalformedCroatianWarehouseLocative,
  sanitizeCroatianWarehouseLocativeAgreement,
} from '../cv-experience-ai-noop-recovery';
import { experienceAiHasMeaningfulChange } from '../cv-experience-perspective';
import {
  CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION,
  SUMMARY_DURATION_FINALIZER_REVISION_HR_V2,
  buildCroatianEntryOwnedSummary,
} from '../cv-croatian-summary-grounding';

const HR_WH_SOURCE = formatExperienceBullets([
  'Provjerava točnost zaprimljene robe i prateće dokumentacije.',
  'Ažurira skladišne evidencije i održava urednu raspoređenost uskladištene robe.',
  'Surađuje s kolegicama i kolegama na koordinaciji pripreme i premještanja robe unutar skladišta.',
]);

/** Device-style malformed locative already present in source/provider echo. */
const HR_WH_MALFORMED_ECHO = formatExperienceBullets([
  'Provjerava točnost zaprimljene robe i prateće dokumentacije.',
  'Redovito ažurira skladišne evidencije i skrbi o urednom i pregledom rasporedu uskladištene robe.',
  'Surađuje s kolegama pri pripremi i premještanju robe unutar skladišta.',
]);

const HR_DESIGN_COMPLETED = formatExperienceBullets([
  'Izrađivala je vizualne materijale i grafičke elemente prema brend smjernicama.',
  'Pregledavala je i prilagođavala dizajne prema zahtjevima projekta.',
  'Pripremala je datoteke za tisak i zaslon.',
]);

function warehouseCv(isPresent: boolean, description = HR_WH_SOURCE): CVData {
  return {
    personal: {
      fullName: 'Ana Anić',
      email: 'ana@example.com',
      phone: '',
      address: '',
      jobTitle: 'Radnica u skladištu',
      gender: 'female',
    },
    summary: '',
    experience: [
      {
        id: 'exp-wh',
        position: 'Radnica u skladištu',
        company: 'Atlas',
        startDate: isPresent ? '2023-01' : '2020-01',
        endDate: isPresent ? '' : '2022-12',
        isPresent,
        description,
        originalUserDescription: description,
        canonicalDescription: description,
        descriptionOrigin: 'user',
      },
      {
        id: 'exp-design',
        position: 'grafička dizajnerica',
        company: 'Rewitu',
        startDate: '2019-01',
        endDate: '2022-12',
        isPresent: false,
        description: HR_DESIGN_COMPLETED,
        originalUserDescription: HR_DESIGN_COMPLETED,
        canonicalDescription: HR_DESIGN_COMPLETED,
        descriptionOrigin: 'user',
      },
    ],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    customSections: [],
  };
}

describe('cv-build293b Croatian Experience AI locative grammar', () => {
  it('sanitize + guard reject pregledom rasporedu / urednom i pregledom', () => {
    const bad = 'skrbi o urednom i pregledom rasporedu uskladištene robe';
    expect(hasMalformedCroatianWarehouseLocative(bad)).toBe(true);
    const fixed = sanitizeCroatianWarehouseLocativeAgreement(bad);
    expect(fixed).toBe('skrbi o urednom i preglednom rasporedu uskladištene robe');
    expect(hasMalformedCroatianWarehouseLocative(fixed)).toBe(false);
    expect(hasMalformedCroatianWarehouseLocative(
      'Redovito ažurira skladišne evidencije te skrbi o urednom i preglednom rasporedu uskladištene robe.',
    )).toBe(false);
  });

  it('A: current female warehouse — provider/repair echo → fallback grammar + usage once', () => {
    const cv = warehouseCv(true);
    const recovered = runCvAiApplyPipeline({
      cv,
      locale: 'hr',
      action: 'experience_bullets',
      candidate: HR_WH_SOURCE,
      experienceId: 'exp-wh',
      industry: 'logistics',
      level: 'mid',
      noOpRepairAttempted: true,
      originHint: 'ai_repaired',
    });
    expect(recovered.blocked).toBe(false);
    expect(recovered.finalized.countedAsSuccess).toBe(true);
    expect(recovered.finalized.diagnostics?.deterministicFallbackAppliedAfterNoOp).toBe(true);
    expect(recovered.finalized.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(experienceAiHasMeaningfulChange(HR_WH_SOURCE, recovered.finalized.text)).toBe(true);
    expect(recovered.finalized.text).toContain(
      'Redovito ažurira skladišne evidencije te skrbi o urednom i preglednom rasporedu uskladištene robe',
    );
    expect(recovered.finalized.text).not.toMatch(/pregledom rasporedu|urednom i pregledom/i);
    expect(recovered.finalized.text).toMatch(/Provjerava/);
    expect(recovered.finalized.text).not.toMatch(/Provjeravala je|Ažurirala je/);
    expect(recovered.stateCv.experience.find((e) => e.id === 'exp-wh')?.description)
      .toBe(recovered.finalized.text);
    expect(recovered.stateCv.experience.find((e) => e.id === 'exp-design')?.description)
      .toBe(HR_DESIGN_COMPLETED);
  });

  it('A2: malformed device echo is repaired by stylistic fallback (not retained)', () => {
    const stylistic = buildExperienceAiNoOpStylisticFallback({
      sourceDescription: HR_WH_MALFORMED_ECHO,
      locale: 'hr',
      isPresent: true,
      gender: 'female',
    });
    expect(stylistic).toContain('urednom i preglednom rasporedu');
    expect(stylistic).not.toMatch(/pregledom rasporedu|urednom i pregledom/i);
    expect(hasMalformedCroatianWarehouseLocative(stylistic)).toBe(false);
  });

  it('B: completed female warehouse — past forms + locative agreement', () => {
    const cv = warehouseCv(false);
    const recovered = runCvAiApplyPipeline({
      cv,
      locale: 'hr',
      action: 'experience_bullets',
      candidate: HR_WH_SOURCE,
      experienceId: 'exp-wh',
      industry: 'logistics',
      level: 'mid',
      noOpRepairAttempted: true,
      originHint: 'ai_repaired',
    });
    expect(recovered.blocked).toBe(false);
    expect(recovered.finalized.countedAsSuccess).toBe(true);
    expect(recovered.finalized.text).toMatch(/Provjeravala je|Ažurirala|ažurirala|skrbila/);
    expect(recovered.finalized.text).toContain('urednom i preglednom rasporedu');
    expect(recovered.finalized.text).not.toMatch(/pregledom rasporedu|urednom i pregledom/i);
    expect(recovered.finalized.text).not.toMatch(/^• Provjerava /m);
    expect(recovered.finalized.text).not.toMatch(/^• Redovito ažurira /m);
  });

  it('C: Generate with AI on entry 2 only — warehouse entry 1 unchanged', () => {
    const cv = warehouseCv(true);
    const clickedId = 'exp-design';
    const recovered = runCvAiApplyPipeline({
      cv,
      locale: 'hr',
      action: 'experience_bullets',
      candidate: HR_DESIGN_COMPLETED,
      experienceId: clickedId,
      industry: 'design',
      level: 'mid',
      noOpRepairAttempted: true,
      originHint: 'ai_repaired',
    });
    expect(recovered.finalized.countedAsSuccess).toBe(true);
    expect(hashExperienceEntryId(clickedId)).toBe(hashExperienceEntryId('exp-design'));
    const next = applyFinalizedBulletsToCv(cv, 'hr', clickedId, recovered.finalized);
    expect(next.experience.find((e) => e.id === 'exp-wh')?.description).toBe(HR_WH_SOURCE);
    expect(next.experience.find((e) => e.id === 'exp-design')?.description)
      .toBe(recovered.finalized.text);
  });

  it('D: Croatian Summary non-regression markers + intro grammar', () => {
    expect(CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION).toBe('croatian-summary-intro-grammar-292-v1');
    expect(SUMMARY_DURATION_FINALIZER_REVISION_HR_V2).toBe('croatian-duration-idempotent-v2');
    const text = buildCroatianEntryOwnedSummary({
      role: 'Radnica u skladištu',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 's ukupno oko šest i pol godina',
      dutyFacts: [
        { sourceText: 'Provjerava točnost zaprimljene robe i prateće dokumentacije.', value: 'a' },
        { sourceText: 'Ažurira skladišne evidencije i održava urednu raspoređenost uskladištene robe.', value: 'b' },
        { sourceText: 'Surađuje s kolegama pri pripremi i premještanju robe.', value: 'c' },
      ],
      priorRole: 'grafička dizajnerica',
      priorEmployer: 'Rewitu',
      priorSourceDuties: HR_DESIGN_COMPLETED,
      locale: 'hr',
    });
    expect(text).toMatch(/oko šest i pol godina iskustva/);
    expect(text).toMatch(/zaposlena u tvrtki Atlas/);
  });
});
