// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { buildExperienceAiOutputProvenance } from '@/lib/cv-experience-ai-output-provenance';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import {
  clearExperienceAiDiagnosticsForTests,
  ExperienceAiDiagnosticSession,
  getLatestExperienceAiDiagnostic,
} from '@/lib/cv-experience-ai-diagnostics';

const bullets = (lines: string[]) => lines.map((line) => `• ${line}`).join('\n');
const SOURCE = [
  'Izrađivala sam vizuelne koncepte i rasporede za digitalne materijale.',
  'Uređivala sam grafike i fotografije za različite projekte.',
  'Usaglašavala sam nacrte i izmene sa članovima projektnog tima.',
].join('\n');
const VALID_VISIBLE = bullets([
  'طوّرتْ المفاهيم البصرية وصمّمتْ التخطيطات الخاصة بالمواد الرقمية.',
  'أجرتْ تعديلات على الرسومات والصور لخدمة متطلبات المشاريع المختلفة.',
  'تعاونتْ مع أعضاء فريق المشروع في مراجعة المسودات وإدخال التعديلات اللازمة عليها.',
]);
const MALFORMED_VISIBLE = VALID_VISIBLE.replace('أجرتْ', 'أجريتْ');

function fixture(visible = VALID_VISIBLE): { cv: CVData; exp: WorkExperience; snapshot: ReturnType<typeof createExperienceAiOperationSnapshot> } {
  const exp = {
    id: 'a221-ar-completed',
    company: 'Rewitu',
    position: 'مصممة جرافيك',
    startDate: '2019-06',
    endDate: '2023-12',
    isPresent: false,
    description: visible,
    originalUserDescription: SOURCE,
    canonicalDescription: SOURCE,
    descriptionOrigin: 'ai_generated',
    contentLocale: 'ar',
    aiOutputProvenance: buildExperienceAiOutputProvenance({
      experienceEntryId: 'a221-ar-completed',
      appliedOutput: visible,
      preAiFactText: SOURCE,
      sourceLocale: 'sr',
      targetLocale: 'ar',
      operationMode: 'enhance_existing',
      sourceAuthorityKind: 'original_user',
    }),
  } as unknown as WorkExperience;
  const cv = {
    personal: {
      fullName: 'Test User', email: 'test@example.com', phone: '', address: '',
      jobTitle: 'مصممة جرافيك', gender: 'female',
    },
    summary: '', experience: [exp], education: [], skills: [], certifications: [],
    languages: [], contentLocale: 'ar',
  } as unknown as CVData;
  const snapshot = createExperienceAiOperationSnapshot({
    liveText: visible,
    authoritativeTextOverride: SOURCE,
    provenanceOriginOverride: 'originalUserDescription',
    locale: 'ar',
    requestId: 'req-aab425-device',
    jobContextHash: 'job-aab425-device',
    experienceEntryId: exp.id,
  });
  return { cv, exp, snapshot };
}

function finalize(visible = VALID_VISIBLE) {
  const f = fixture(visible);
  return {
    ...f,
    finalized: finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'ar',
      sourceLocale: 'sr',
      gender: 'female',
      cv: f.cv,
      candidate: visible,
      experienceId: f.exp.id,
      industry: 'general',
      level: 'mid',
      operationSnapshot: f.snapshot,
      jobContextHash: 'job-aab425-device',
      earlyUneditedRerunNoOp: true,
    }),
  };
}

describe('AAB-425 provider-error local no-op recovery source gate', () => {
  beforeEach(() => clearExperienceAiDiagnosticsForTests());

  it.each([
    ['422 validation failure', 422, 'generation_validation_failed'],
    ['500 provider failure', 500, 'provider_http_failure'],
    ['timeout', null, 'request_timeout'],
    ['malformed response', 502, 'malformed_provider_response'],
  ])('%s: valid unedited Arabic completed text becomes semantic no-op +0', (_label, status, code) => {
    const f = finalize();
    expect(f.finalized.diagnostics?.earlyNoOpPreflightPassed).toBe(true);
    expect(f.finalized.diagnostics?.semanticNoOpDetected).toBe(true);
    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'ar', requestedLocale: 'ar', contentLocale: 'ar', templateId: '',
      gender: 'female', industryNorm: 'general', levelNorm: 'mid',
      jobContextHash: 'job-aab425-device', requestId: 'req-aab425-device', usageCountBefore: 14,
    });
    session.recordProviderFailureRecoveredNoOp(f.finalized, {
      httpStatus: status,
      attempted: true,
      errorCode: code,
    });
    session.recordVisibleApply(false, 14);
    session.commit();
    const trace = getLatestExperienceAiDiagnostic();
    expect(trace?.providerAttempted).toBe(true);
    expect(trace?.providerHttpStatus).toBe(status);
    expect(trace?.providerResponseKind).toBe('error');
    expect(trace?.apiResponseKind).toBe('error');
    expect(trace?.semanticNoOpDetected).toBe(true);
    expect(trace?.finalDecisionKind).toBe('semantic_noop');
    expect(trace?.canonicalExperienceDecisionAllowsApply).toBe(false);
    expect(trace?.canonicalExperienceDecisionAllowsUsage).toBe(false);
    expect(trace?.countedAsSuccess).toBe(false);
    expect(trace?.usageCountAfter).toBe(14);
    expect(trace?.providerValidationApplicable).toBe(false);
    expect(trace?.providerRequiredFactCount).toBeNull();
    expect(trace?.providerCoveredFactCount).toBeNull();
    expect(trace?.providerUncoveredFactIdentityHashes).toEqual([]);
    expect(trace?.diagnosticInvariantFailures || []).not.toContainEqual(
      expect.objectContaining({ invariantCode: 'incomplete_coverage_with_empty_uncovered_hashes' }),
    );
  });

  it('malformed Arabic morphology fails closed despite matching historical AI output', () => {
    const f = finalize(MALFORMED_VISIBLE);
    expect(f.finalized.diagnostics?.earlyNoOpPreflightPassed).not.toBe(true);
    expect(f.finalized.diagnostics?.finalDecisionKind).not.toBe('semantic_noop');
  });

  it('material visible edit does not use stale last-AI no-op recovery', () => {
    const f = fixture();
    f.exp.description = `${VALID_VISIBLE}\n• أضفتُ ادعاءً جديداً غير موثق.`;
    const finalized = finalizeCvAiFieldForApply({
      action: 'experience_bullets', field: 'experience_description', requestedLocale: 'ar',
      sourceLocale: 'sr', gender: 'female', cv: f.cv, candidate: f.exp.description,
      experienceId: f.exp.id, industry: 'general', level: 'mid', operationSnapshot: f.snapshot,
    });
    expect(finalized.diagnostics?.earlyNoOpPreflightPassed).not.toBe(true);
    expect(finalized.diagnostics?.semanticNoOpDetected).not.toBe(true);
  });
});
