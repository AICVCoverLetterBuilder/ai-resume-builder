/**
 * Build-294 Experience AI no-op repair grounding — reject unsupported
 * quality/standards/scope/organization expansions (AAB-294 false negative).
 * Does not modify Croatian Summary or locative-grammar correction logic.
 */
import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import {
  runCvAiApplyPipeline,
} from '../cv-ai-finalize-apply';
import { formatExperienceBullets } from '../cv-canonical-facts';
import { hashExperienceEntryId } from '../cv-experience-entry-isolation';
import {
  EXPERIENCE_AI_NOOP_RECOVERY_REVISION,
  buildExperienceAiNoOpRepairPrompt,
  buildExperienceAiNoOpStylisticFallback,
  sanitizeCroatianWarehouseLocativeAgreement,
} from '../cv-experience-ai-noop-recovery';
import { validateNoExtraGeneratedDuties } from '../cv-material-duty-coverage';
import {
  detectExperienceUnsupportedClaimExpansion as scanClaims,
  EXPERIENCE_AI_UNSUPPORTED_EXPANSION_REVISION,
} from '../cv-experience-unsupported-claims';
import {
  CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION,
  SUMMARY_DURATION_FINALIZER_REVISION_HR_V2,
} from '../cv-croatian-summary-grounding';

const HR_WH_SOURCE = formatExperienceBullets([
  'Provjerava ispravnost pristigle robe i točnost pripadajuće dokumentacije.',
  'Ažurira skladišne evidencije i održava uredan i pregledan raspored uskladištene robe.',
  'Surađuje s kolegama pri pripremi i premještanju robe.',
]);

const HR_WH_AAB294_UNSAFE_REPAIR = formatExperienceBullets([
  'Odgovorna je za provjeru kvalitete i ispravnosti pristigle robe, kao i za usklađenost popratne dokumentacije s važećim standardima.',
  'Redovito ažurira skladišne evidencije te skrbi o preglednom i urednom smještaju svih uskladištenih artikala.',
  'U suradnji s timom organizira i usklađuje aktivnosti vezane uz pripremu robe i njezino premještanje unutar skladišta.',
]);

const HR_WH_SAFE_PARAPHRASE = formatExperienceBullets([
  'Odgovorna je za provjeru ispravnosti pristigle robe i točnosti pripadajuće dokumentacije.',
  'Redovito ažurira skladišne evidencije te skrbi o urednom i preglednom rasporedu uskladištene robe.',
  'Aktivno surađuje s članovima tima pri pripremi i premještanju robe.',
]);

const HR_WH_COMPLETED_SOURCE = formatExperienceBullets([
  'Provjeravala je ispravnost pristigle robe i točnost pripadajuće dokumentacije.',
  'Ažurirala je skladišne evidencije i održavala uredan i pregledan raspored uskladištene robe.',
  'Surađivala je s kolegama pri pripremi i premještanju robe.',
]);

function warehouseCv(description: string, overrides?: Partial<CVData>): CVData {
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
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description,
        originalUserDescription: description,
        canonicalDescription: description,
        descriptionOrigin: 'user',
      },
      {
        id: 'exp-other',
        position: 'Asistentica',
        company: 'Other',
        startDate: '2018-01',
        endDate: '2020-01',
        isPresent: false,
        description: '• Pomagala je u administraciji.',
        originalUserDescription: '• Pomagala je u administraciji.',
        canonicalDescription: '• Pomagala je u administraciji.',
        descriptionOrigin: 'user',
      },
    ],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    customSections: [],
    ...overrides,
  };
}

describe('cv-build294 Experience AI unsupported expansion grounding', () => {
  it('preserves no-op recovery + Summary markers (non-regression)', () => {
    expect(EXPERIENCE_AI_NOOP_RECOVERY_REVISION).toBe('experience-ai-noop-recovery-293-v1');
    expect(EXPERIENCE_AI_UNSUPPORTED_EXPANSION_REVISION)
      .toBe('experience-ai-unsupported-expansion-295-v1');
    expect(CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION).toBe('croatian-summary-intro-grammar-292-v1');
    expect(SUMMARY_DURATION_FINALIZER_REVISION_HR_V2).toBe('croatian-duration-idempotent-v2');
  });

  it('A: AAB-294 unsafe repair is rejected with typed claim kinds', () => {
    const scan = scanClaims(HR_WH_SOURCE, HR_WH_AAB294_UNSAFE_REPAIR);
    expect(scan.count).toBeGreaterThan(0);
    expect(scan.kinds).toEqual(expect.arrayContaining([
      'quality_claim',
      'standards_compliance_claim',
      'universal_scope_claim',
      'organization_responsibility_claim',
    ]));
    expect(scan.universalQuantifierDetected).toBe(true);
    expect(scan.responsibilityEscalationDetected).toBe(true);
    expect(validateNoExtraGeneratedDuties(HR_WH_SOURCE, HR_WH_AAB294_UNSAFE_REPAIR).valid)
      .toBe(false);

    const cv = warehouseCv(HR_WH_SOURCE);
    const repaired = runCvAiApplyPipeline({
      cv,
      locale: 'hr',
      action: 'experience_bullets',
      candidate: HR_WH_AAB294_UNSAFE_REPAIR,
      experienceId: 'exp-wh',
      industry: 'logistics',
      level: 'mid',
      noOpRepairAttempted: true,
      originHint: 'ai_repaired',
    });

    expect(repaired.finalized.diagnostics?.noOpRepairValidationPassed).toBe(false);
    expect(repaired.finalized.diagnostics?.noOpRepairApplied).toBe(false);
    expect(repaired.finalized.diagnostics?.noOpRepairUnsupportedClaimCount).toBeGreaterThan(0);
    expect(repaired.finalized.diagnostics?.noOpRepairUnsupportedClaimKinds).toEqual(
      expect.arrayContaining(['quality_claim', 'standards_compliance_claim']),
    );
    expect(repaired.finalized.diagnostics?.noOpRepairUniversalQuantifierDetected).toBe(true);
    expect(repaired.finalized.diagnostics?.noOpRepairResponsibilityEscalationDetected).toBe(true);
    expect(repaired.finalized.diagnostics?.noOpRepairRejectionReason).toBeTruthy();
    expect(repaired.finalized.text).not.toMatch(/kvalitet|važećim standardima|svih uskladištenih/i);
  });

  it('B: after unsafe repair, deterministic fallback applies safely once', () => {
    const cv = warehouseCv(HR_WH_SOURCE);
    const recovered = runCvAiApplyPipeline({
      cv,
      locale: 'hr',
      action: 'experience_bullets',
      candidate: HR_WH_AAB294_UNSAFE_REPAIR,
      experienceId: 'exp-wh',
      industry: 'logistics',
      level: 'mid',
      noOpRepairAttempted: true,
      originHint: 'ai_repaired',
    });

    expect(recovered.blocked).toBe(false);
    expect(recovered.finalized.countedAsSuccess).toBe(true);
    expect(recovered.finalized.diagnostics?.noOpRepairApplied).toBe(false);
    expect(recovered.finalized.diagnostics?.deterministicFallbackAttemptedAfterNoOp).toBe(true);
    expect(recovered.finalized.diagnostics?.deterministicFallbackAppliedAfterNoOp).toBe(true);
    expect(recovered.finalized.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(recovered.finalized.text).toMatch(/ispravnost|točnost|Ažurira|Surađuje|pregledn/i);
    expect(recovered.finalized.text).toMatch(/preglednom rasporedu|pregledan raspored/i);
    expect(recovered.finalized.text).not.toMatch(/pregledom rasporedu/i);
    expect(recovered.finalized.text).not.toMatch(/kvalitet|važećim standardima|svih uskladištenih|\borganizira\b/i);
    expect(recovered.finalized.text).not.toMatch(/Provjeravala je|Ažurirala je|Surađivala je/);
    expect(validateNoExtraGeneratedDuties(HR_WH_SOURCE, recovered.finalized.text).valid).toBe(true);
    expect(recovered.stateCv.experience.find((e) => e.id === 'exp-wh')?.description)
      .toBe(recovered.finalized.text);
    expect(recovered.stateCv.experience.find((e) => e.id === 'exp-other')?.description)
      .toContain('administraciji');
  });

  it('C: safe Croatian paraphrase is accepted (no false positive)', () => {
    const scan = scanClaims(HR_WH_SOURCE, HR_WH_SAFE_PARAPHRASE);
    expect(scan.count).toBe(0);
    expect(validateNoExtraGeneratedDuties(HR_WH_SOURCE, HR_WH_SAFE_PARAPHRASE).valid).toBe(true);

    const cv = warehouseCv(HR_WH_SOURCE);
    const accepted = runCvAiApplyPipeline({
      cv,
      locale: 'hr',
      action: 'experience_bullets',
      candidate: HR_WH_SAFE_PARAPHRASE,
      experienceId: 'exp-wh',
      industry: 'logistics',
      level: 'mid',
      noOpRepairAttempted: true,
      originHint: 'ai_repaired',
    });
    expect(accepted.blocked).toBe(false);
    expect(accepted.finalized.countedAsSuccess).toBe(true);
    expect(accepted.finalized.diagnostics?.noOpRepairApplied).toBe(true);
    expect(accepted.finalized.diagnostics?.finalCandidateSource).toBe('noop_repair');
    expect(accepted.finalized.diagnostics?.finalUnsupportedClaimCount ?? 0).toBe(0);
    expect(accepted.finalized.text).toMatch(/ispravnost|točnost|preglednom rasporedu|surađuje/i);
  });

  it('D: completed female role — unsafe expansion rejected; safe past fallback', () => {
    const cv = warehouseCv(HR_WH_COMPLETED_SOURCE, {
      experience: [
        {
          id: 'exp-wh',
          position: 'Radnica u skladištu',
          company: 'Atlas',
          startDate: '2019-01',
          endDate: '2022-12',
          isPresent: false,
          description: HR_WH_COMPLETED_SOURCE,
          originalUserDescription: HR_WH_COMPLETED_SOURCE,
          canonicalDescription: HR_WH_COMPLETED_SOURCE,
          descriptionOrigin: 'user',
        },
      ],
    });
    const unsafePast = formatExperienceBullets([
      'Odgovorna je bila za provjeru kvalitete i ispravnosti pristigle robe te usklađenost dokumentacije s važećim standardima.',
      'Redovito je ažurirala skladišne evidencije te skrbila o smještaju svih uskladištenih artikala.',
      'U suradnji s timom organizirala je aktivnosti vezane uz pripremu i premještanje robe.',
    ]);
    const recovered = runCvAiApplyPipeline({
      cv,
      locale: 'hr',
      action: 'experience_bullets',
      candidate: unsafePast,
      experienceId: 'exp-wh',
      industry: 'logistics',
      level: 'mid',
      noOpRepairAttempted: true,
      originHint: 'ai_repaired',
    });
    expect(recovered.finalized.diagnostics?.noOpRepairApplied).toBe(false);
    expect(recovered.finalized.diagnostics?.noOpRepairUnsupportedClaimCount).toBeGreaterThan(0);
    if (!recovered.blocked) {
      expect(recovered.finalized.countedAsSuccess).toBe(true);
      expect(recovered.finalized.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
      expect(recovered.finalized.text).toMatch(/la je|ala je|ivala je/i);
      expect(recovered.finalized.text).not.toMatch(/\bProvjerava\b|\bAžurira\b|\bSurađuje\b/);
      expect(recovered.finalized.text).not.toMatch(/kvalitet|važećim standardima|svih uskladištenih/i);
      expect(validateNoExtraGeneratedDuties(HR_WH_COMPLETED_SOURCE, recovered.finalized.text).valid)
        .toBe(true);
    }
  });

  it('E: quantifier guard rejects scope expansion without rejecting ordinary determiners', () => {
    const withSvih = '• Skrbi o urednom smještaju svih uskladištenih artikala.';
    const withCjelokupne = '• Održava raspored cjelokupne robe u skladištu.';
    const withSveDok = '• Provjerava točnost sve dokumentacije uz zaprimljenu robu.';
    const ordinary = '• Provjerava ispravnost pristigle robe i točnost pripadajuće dokumentacije.';

    expect(scanClaims(HR_WH_SOURCE, withSvih).kinds).toContain('universal_scope_claim');
    expect(scanClaims(HR_WH_SOURCE, withCjelokupne).kinds).toContain('universal_scope_claim');
    expect(scanClaims(HR_WH_SOURCE, withSveDok).kinds).toContain('universal_scope_claim');
    expect(scanClaims(HR_WH_SOURCE, ordinary).kinds).not.toContain('universal_scope_claim');
  });

  it('F: responsibility escalation — reject organize/lead; accept collaborate/coordinate', () => {
    const src = '• Surađuje s kolegama pri pripremi i premještanju robe.';
    expect(scanClaims(src, '• Organizira tim pri pripremi robe.').kinds)
      .toContain('organization_responsibility_claim');
    expect(scanClaims(src, '• Vodi tim pri pripremi robe.').kinds).toContain('leadership_claim');
    expect(scanClaims(src, '• Nadzire rad kolega u skladištu.').kinds).toContain('leadership_claim');
    expect(scanClaims(src, '• Upravlja aktivnostima pripreme robe.').kinds)
      .toContain('leadership_claim');

    expect(scanClaims(src, '• Surađuje s kolegama pri pripremi i premještanju robe.').count)
      .toBe(0);
    expect(scanClaims(src, '• Usklađuje aktivnosti s kolegama pri pripremi robe.').count)
      .toBe(0);
    expect(scanClaims(src, '• Koordinira pripremu s članovima tima.').count).toBe(0);
  });

  it('G: entry targeting — only clicked warehouse entry changes', () => {
    const cv = warehouseCv(HR_WH_SOURCE);
    const whHash = hashExperienceEntryId('exp-wh');
    const otherHash = hashExperienceEntryId('exp-other');
    const recovered = runCvAiApplyPipeline({
      cv,
      locale: 'hr',
      action: 'experience_bullets',
      candidate: HR_WH_AAB294_UNSAFE_REPAIR,
      experienceId: 'exp-wh',
      industry: 'logistics',
      level: 'mid',
      noOpRepairAttempted: true,
      originHint: 'ai_repaired',
    });
    expect(recovered.finalized.diagnostics?.selectedExperienceEntryIdHash).toBe(whHash);
    expect(recovered.finalized.diagnostics?.selectedExperienceEntryIdHash).not.toBe(otherHash);
    expect(recovered.stateCv.experience.find((e) => e.id === 'exp-other')?.description)
      .toContain('administraciji');
    if (!recovered.blocked) {
      expect(recovered.stateCv.experience.find((e) => e.id === 'exp-wh')?.description)
        .toBe(recovered.finalized.text);
    }
  });

  it('H: locative non-regression + repair prompt mentions factual scope guards', () => {
    expect(sanitizeCroatianWarehouseLocativeAgreement(
      'skrbi o urednom i pregledom rasporedu uskladištene robe',
    )).toContain('preglednom rasporedu');
    const prompt = buildExperienceAiNoOpRepairPrompt({
      locale: 'hr',
      sourceDescription: HR_WH_SOURCE,
      previousOutput: HR_WH_SOURCE,
      isPresent: true,
      gender: 'female',
      industry: 'logistics',
    });
    expect(prompt).toMatch(/quality|standard|svih|factual scope|universal/i);
    const fallback = buildExperienceAiNoOpStylisticFallback({
      sourceDescription: HR_WH_SOURCE,
      locale: 'hr',
      isPresent: true,
      gender: 'female',
    });
    expect(fallback).toMatch(/preglednom rasporedu|pregledan raspored/i);
    expect(fallback).not.toMatch(/pregledom rasporedu/i);
    // Locative sanitizer still rewrites the known malformed instrumental form.
    expect(sanitizeCroatianWarehouseLocativeAgreement(
      'skrbi o urednom i pregledom rasporedu uskladištene robe',
    )).toContain('preglednom rasporedu');
  });
});
