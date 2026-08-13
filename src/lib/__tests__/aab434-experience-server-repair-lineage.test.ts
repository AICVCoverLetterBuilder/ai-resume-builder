import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import { formatExperienceBullets } from '../cv-canonical-facts';
import { finalizeCvAiFieldForApply } from '../cv-ai-finalize-apply';
import {
  clearExperienceAiDiagnostics,
  clearExperienceAiDiagnosticsForTests,
  ExperienceAiDiagnosticSession,
} from '../cv-experience-ai-diagnostics';
import {
  checkExperienceDiagnosticCompleteness,
  checkExperienceDiagnosticInvariants,
  clearCvAiDiagnosticHistory,
} from '../cv-ai-diagnostics-contract';

const SOURCE = formatExperienceBullets([
  'प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री बनाती थी।',
  'ग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ बनाती थी।',
  'डिज़ाइन परियोजनाओं की समीक्षा करती थी और अंतिम आउटपुट की गुणवत्ता जाँचती थी।',
]);

// The API's accepted repair keeps all three duties, including review/check
// semantics. It is intentionally not the client no-op repair path.
const SERVER_REPAIRED = formatExperienceBullets([
  'प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री तैयार करती थी।',
  'ग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।',
  'डिज़ाइन परियोजनाओं की समीक्षा करती थी और अंतिम आउटपुट की गुणवत्ता जाँचती थी।',
]);

function fixture(): CVData {
  return {
    id: 'aab434-be5c',
    name: 'AAB434',
    personal: {
      fullName: 'Test User', email: 'test@example.com', phone: '', address: '',
      jobTitle: 'ग्राफिक डिज़ाइनर', gender: 'female',
    },
    summary: '',
    experience: [{
      id: 'be5c794b', position: 'ग्राफिक डिज़ाइनर', company: 'TestWerk GmbH',
      startDate: '2024-01', endDate: '2026-02', isPresent: false,
      description: SOURCE, originalUserDescription: SOURCE,
      canonicalDescription: SOURCE, descriptionOrigin: 'user',
    }],
    education: [], skills: [], languages: [], certifications: [],
    templateId: 'modern-minimal', region: 'EU',
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

describe('AAB434 Experience server-repair lineage truth', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    clearExperienceAiDiagnostics();
    clearCvAiDiagnosticHistory();
  });

  it('serializes the exact completed Hindi API repair as server repair, not client noop repair', () => {
    const finalized = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv: fixture(),
      candidate: SERVER_REPAIRED,
      experienceId: 'be5c794b',
      industry: 'design',
      level: 'mid',
      originHint: 'ai_repaired',
    });

    expect(finalized.countedAsSuccess).toBe(true);
    expect(finalized.text).toContain('अंतिम आउटपुट की गुणवत्ता जाँचती थी');
    expect(finalized.diagnostics?.finalCandidateSource).toBe('server_repair');
    expect(finalized.diagnostics?.serverRepairAttempted).toBe(true);
    expect(finalized.diagnostics?.serverRepairSelected).toBe(true);
    expect(finalized.diagnostics?.serverRepairSource).toBe('api_server_repair');
    expect(finalized.diagnostics?.noOpRepairAttempted).toBe(false);
    expect(finalized.diagnostics?.noOpRepairApplied).toBe(false);
    expect(finalized.diagnostics?.providerPredicateValidationApplicable).toBe(false);
    expect(finalized.diagnostics?.finalCandidatePredicateIdentityCount).toBe(3);
    expect(finalized.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);

    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'hi', requestedLocale: 'hi', templateId: 'modern-minimal',
      jobContextHash: 'aab434-be5c', requestId: 'aab434-server-repair', usageCountBefore: 23,
    });
    session.recordApiResponse({
      httpStatus: 200, repairAttempted: true, resultText: SERVER_REPAIRED,
    });
    session.recordFinalizeResult(finalized);
    expect(session.evaluatePreApplyDecisionGates()).toMatchObject({ passed: true });
    session.patch({
      visibleRequiredFactCount: 3,
      visibleCoveredFactCount: 3,
      visibleUncoveredFactIdentityHashes: [],
      visibleFactCoveragePassed: true,
      visibleRequiredPredicateCount: 3,
      visibleCoveredPredicateCount: 3,
      visiblePredicateCoveragePassed: true,
      visibleNormalizedHash: finalized.diagnostics?.finalNormalizedHash,
      visibleLocaleValidationPassed: true,
      visibleTenseValidationPassed: true,
    });
    session.recordVisibleApply(true, 24, {
      visibleDescription: finalized.text,
      finalNormalizedText: finalized.text,
    });
    const trace = session.commit();

    expect(trace.providerResponseKind).toBe('repair');
    expect(trace.apiResponseKind).toBe('repair');
    expect(trace.serverRepairAttempted).toBe(true);
    expect(trace.serverRepairSelected).toBe(true);
    expect(trace.serverRepairSource).toBe('api_server_repair');
    expect(trace.finalCandidateSource).toBe('server_repair');
    expect(trace.noOpRepairAttempted).toBe(false);
    expect(trace.noOpRepairApplied).toBe(false);
    expect(trace.providerPredicateValidationApplicable).toBe(false);
    expect(trace.providerCandidatePredicateIdentityCount).toBe(0);
    expect(trace.providerSourceUnitPredicateCoveragePassed).toBeNull();
    expect(trace.finalCandidatePredicateIdentityCount).toBe(3);
    expect(trace.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.shouldIncrementUsage).toBe(true);
    expect(trace.usageCountBefore).toBe(23);
    expect(trace.usageCountAfter).toBe(24);
    expect(trace.countedAsSuccess).toBe(true);

    const raw = trace.candidateLineage?.find((item) => item.candidateKind === 'server_provider_raw');
    const repaired = trace.candidateLineage?.find((item) => item.candidateKind === 'server_repair');
    expect(raw).toMatchObject({ present: true, accepted: false, rejectionStage: 'server_validation_repair' });
    expect(repaired).toMatchObject({ present: true, accepted: true });
    expect(trace.stages?.find((stage) => stage.stage === 'deterministic_fallback_started'))
      .toMatchObject({ result: 'skipped', typedReason: 'server_repair_accepted' });
    const invariants = checkExperienceDiagnosticInvariants(trace);
    expect(invariants.passed, JSON.stringify(invariants.failures)).toBe(true);
    expect(checkExperienceDiagnosticCompleteness(trace as unknown as Record<string, unknown>).passed)
      .toBe(true);
  });
});
