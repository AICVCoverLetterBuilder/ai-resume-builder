/**
 * Permanent device-equivalent regression for internal AAB 417.
 * Arabic UI + female + empty Summary + hi/hi/ar/ar/hi Experience authority.
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  applyFinalizedSummaryToCv,
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { countSummaryDurationExpressions } from '@/lib/cv-summary-duration-ownership';
import {
  SummaryAiDiagnosticSession,
  clearSummaryAiDiagnosticsForTests,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  buildSummaryV2ManifestForCv,
  buildSummaryV2ProviderExperienceEntries,
  clearSummaryV2LocalizationCacheForTests,
  localizeSummaryV2Manifest,
  resolveSummaryCurrentRole,
  setSummaryV2EnabledForTests,
  summaryV2SnapshotMatchesCv,
  validateSummaryV2LocalizationResponse,
  type SummaryV2LocalizationProviderResponse,
  type SummaryV2LocalizationTransport,
  type SummaryV2LocalizationTransportInput,
  type SummaryV2SelectionManifest,
} from '@/lib/cv-summary-v2';

const REF = '2026-08-11';

const ARABIC = {
  e1: {
    role: 'مشرفة استلام بضائع',
    facts: [
      'فحصت البضائع الواردة.',
      'راجعت وثائق الاستلام.',
      'نسقت حركة البضائع مع الزملاء.',
    ],
  },
  e2: {
    role: 'فنية صيانة معدات',
    facts: [
      'تفحص المعدات يومياً.',
      'تسجل أعمال الصيانة.',
      'تنسق الإصلاحات مع الفريق.',
    ],
  },
} as const;

function experience(options: {
  id: string;
  position: string;
  company: string;
  startDate: string;
  endDate?: string;
  isPresent: boolean;
  description: string;
  locale: 'hi' | 'ar';
}): WorkExperience {
  return {
    id: options.id,
    position: options.position,
    company: options.company,
    startDate: options.startDate,
    endDate: options.endDate || '',
    isPresent: options.isPresent,
    description: options.description,
    canonicalDescription: options.description,
    originalUserDescription: options.description,
    descriptionOrigin: 'user',
    generatedLocale: options.locale,
    positionSourceLocale: options.locale,
  } as WorkExperience;
}

function deviceCv(): CVData {
  return {
    id: 'aab417-device-ar-hi-hi-ar-ar-hi',
    personal: {
      fullName: 'مستخدمة الاختبار',
      email: 'device@example.test',
      phone: '',
      address: '',
      jobTitle: '',
      gender: 'female',
    },
    summary: '',
    experience: [
      experience({
        id: 'e1-hi-completed',
        position: 'गोदाम निरीक्षक',
        company: 'شركة النور',
        startDate: '2019-01',
        endDate: '2021-12',
        isPresent: false,
        locale: 'hi',
        description: [
          'आने वाले सामान की जाँच की।',
          'प्राप्ति दस्तावेज़ों की समीक्षा की।',
          'सहकर्मियों के साथ सामान की आवाजाही समन्वित की।',
        ].join('\n'),
      }),
      experience({
        id: 'e2-hi-current-newest',
        position: 'रखरखाव तकनीशियन',
        company: 'مؤسسة الأفق',
        startDate: '2024-03',
        isPresent: true,
        locale: 'hi',
        description: [
          'उपकरणों की दैनिक जाँच करती हैं।',
          'रखरखाव कार्य दर्ज करती हैं।',
          'टीम के साथ मरम्मत का समन्वय करती हैं।',
        ].join('\n'),
      }),
      experience({
        id: 'e3-ar-completed',
        position: 'مساعدة مكتبة',
        company: 'مكتبة المدينة',
        startDate: '2022-01',
        endDate: '2023-12',
        isPresent: false,
        locale: 'ar',
        description: [
          'سجلت الكتب المستعارة والمعادة.',
          'رتبت الكتب حسب الفهرس.',
          'ساعدت الزوار في العثور على العناوين.',
        ].join('\n'),
      }),
      experience({
        id: 'e4-ar-current-older',
        position: 'منسقة خدمات',
        company: 'مركز الهدى',
        startDate: '2022-06',
        isPresent: true,
        locale: 'ar',
        description: [
          'تنظم طلبات الخدمة.',
          'تتابع مواعيد العملاء.',
          'تنسق العمل مع الزملاء.',
        ].join('\n'),
      }),
      experience({
        id: 'e5-hi-current-oldest',
        position: 'सेवा समन्वयक',
        company: 'مركز السلام',
        startDate: '2020-02',
        isPresent: true,
        locale: 'hi',
        description: [
          'सेवा अनुरोध व्यवस्थित करती हैं।',
          'ग्राहक समय का पालन करती हैं।',
          'सहकर्मियों के साथ काम समन्वित करती हैं।',
        ].join('\n'),
      }),
    ],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    templateId: 'modern',
    contentLocale: 'ar',
  } as CVData;
}

function manifest(cv = deviceCv()): SummaryV2SelectionManifest {
  return buildSummaryV2ManifestForCv({
    cv,
    locale: 'ar',
    gender: 'female',
    referenceDateIso: REF,
  });
}

function responseFor(input: SummaryV2LocalizationTransportInput): SummaryV2LocalizationProviderResponse {
  return {
    targetLocale: 'ar',
    entries: input.entries.map((entry) => {
      const localized = ARABIC[entry.entryId.startsWith('e2') ? 'e2' : 'e1'];
      return {
        entryId: entry.entryId,
        localizedRoleTitle: localized.role,
        facts: entry.facts.map((fact, index) => ({
          factId: fact.factId,
          localizedText: localized.facts[index]!,
        })),
      };
    }),
  };
}

const successfulTransport: SummaryV2LocalizationTransport = async (input) => responseFor(input);

function transportError(reason: string, httpStatus: number, apiResponseKind: string): Error {
  return Object.assign(new Error(reason), { reason, httpStatus, apiResponseKind });
}

describe('AAB 417 multilingual Summary localization recovery', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    clearSummaryV2LocalizationCacheForTests();
    clearSummaryAiDiagnosticsForTests();
    localStorage.clear();
  });

  afterEach(() => {
    setSummaryV2EnabledForTests(null);
    clearSummaryV2LocalizationCacheForTests();
    clearSummaryAiDiagnosticsForTests();
  });

  it('resolves the newest of three current roles and keeps completed priors explicit', () => {
    const cv = deviceCv();
    const selected = resolveSummaryCurrentRole(cv.experience || []);
    const source = manifest(cv);

    expect(selected?.id).toBe('e2-hi-current-newest');
    expect(source.current?.entryId).toBe('e2-hi-current-newest');
    expect(source.priors.map((entry) => entry.entryId)).toEqual([
      'e1-hi-completed',
      'e3-ar-completed',
    ]);
    expect(source.requiredCurrentFacts).toHaveLength(3);
    expect(source.requiredPriorFacts).toHaveLength(6);
  });

  it('localizes per entry, bypasses same-locale authority, serializes the localized provider input, finalizes, applies once, and records hash parity', async () => {
    const cv = deviceCv();
    const source = manifest(cv);
    const calls: SummaryV2LocalizationTransportInput[] = [];
    const outcome = await localizeSummaryV2Manifest({
      manifest: source,
      transport: async (input) => {
        calls.push(input);
        return responseFor(input);
      },
    });

    expect(outcome.reason).toBeNull();
    expect(outcome.manifest).not.toBeNull();
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.entries.length === 1)).toBe(true);
    expect(outcome.selectedEntryCount).toBe(3);
    expect(outcome.sameLocaleBypassCount).toBe(1);
    expect(outcome.providerLocalizedEntryCount).toBe(2);
    expect(outcome.localizationSource).toBe('mixed_authoritative');
    expect(outcome.validation?.factOwnershipParityPassed).toBe(true);

    const providerEntries = buildSummaryV2ProviderExperienceEntries({
      manifest: source,
      localized: outcome.manifest!,
    });
    expect(providerEntries).toHaveLength(3);
    expect(providerEntries?.every((entry) => entry.sourceLocale === 'ar')).toBe(true);
    const serializedProviderContext = JSON.stringify(providerEntries);
    expect(serializedProviderContext).toMatch(/[\u0600-\u06FF]/u);
    expect(serializedProviderContext).not.toMatch(/[\u0900-\u097F]/u);
    expect(serializedProviderContext).toContain(ARABIC.e2.role);
    expect(serializedProviderContext).toContain(ARABIC.e1.facts[0]);

    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const finalized = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'ar',
      gender: 'female',
      cv,
      candidate: '',
      referenceDateIso: REF,
      durationSnapshot: duration,
      localizedSummaryManifest: outcome.manifest,
    });
    expect(finalized.blocked, finalized.reason).toBe(false);
    expect(finalized.countedAsSuccess).toBe(true);
    expect(finalized.text).toMatch(/[\u0600-\u06FF]/u);
    expect(finalized.text).not.toMatch(/[\u0900-\u097F]/u);
    expect(finalized.text).not.toMatch(/\b(?:manager|warehouse|team leader|leadership)\b/iu);
    expect(countSummaryDurationExpressions(finalized.text || '', 'ar')).toBe(1);
    expect(finalized.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
    expect(finalized.diagnostics?.coveredPriorDutyFactCount).toBe(6);

    const applied = applyFinalizedSummaryToCv(cv, 'ar', finalized);
    expect(applied.summary).toBe(finalized.text);
    const diag = new SummaryAiDiagnosticSession({
      uiLocale: 'ar',
      requestedLocale: 'ar',
      contentLocale: 'ar',
      templateId: 'modern',
      gender: 'female',
      requestId: 'aab417-success',
      usageCountBefore: 7,
      operationMode: 'generate_from_context',
    });
    diag.recordCvSnapshot(cv, '');
    diag.recordFinalizeResult(finalized);
    diag.recordVisibleApply(true, 8, applied.summary || '');
    const trace = diag.commit();
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountBefore).toBe(7);
    expect(trace.usageCountAfter).toBe(8);
    expect(trace.finalValidatedCandidateHash).toBe(trace.visibleCandidateHashAfterApply);
    expect(trace.visibleSummaryMatchesFinalHash).toBe(true);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.privacyCheckPassed).toBe(true);
  });

  it('uses the alternate target-Summary context contract after one primary timeout without leaking partial context', async () => {
    const source = manifest();
    const primary: SummaryV2LocalizationTransport = async (input) => {
      if (input.entries[0]?.entryId === 'e2-hi-current-newest') {
        throw transportError('request_timeout', 504, 'timeout');
      }
      return responseFor(input);
    };
    const recoveryCalls: string[] = [];
    const outcome = await localizeSummaryV2Manifest({
      manifest: source,
      transport: primary,
      recoveryTransport: async (input) => {
        recoveryCalls.push(input.entries[0]!.entryId);
        return responseFor(input);
      },
    });

    expect(outcome.manifest).not.toBeNull();
    expect(outcome.primaryFailureReason).toBe('request_timeout');
    expect(outcome.localizationRecoveryAttempted).toBe(true);
    expect(outcome.localizationRecoveryAccepted).toBe(true);
    expect(outcome.recoveryLocalizedEntryCount).toBe(1);
    expect(recoveryCalls).toEqual(['e2-hi-current-newest']);
    expect(outcome.sourceByEntryId['e1-hi-completed']).toBe('provider');
    expect(outcome.sourceByEntryId['e2-hi-current-newest']).toBe('summary_provider_recovery');
    expect(outcome.sourceByEntryId['e3-ar-completed']).toBe('same_locale_authoritative');
    expect(JSON.stringify(outcome.manifest)).not.toMatch(/[\u0900-\u097F]/u);
  });

  it('fails closed with complete truthful pre-candidate diagnostics when primary and recovery are unavailable', async () => {
    const cv = deviceCv();
    const failure = transportError('request_timeout', 504, 'timeout');
    const outcome = await localizeSummaryV2Manifest({
      manifest: manifest(cv),
      transport: async () => { throw failure; },
      recoveryTransport: async () => { throw failure; },
    });
    expect(outcome.manifest).toBeNull();
    expect(outcome.reason).toBe('request_timeout');
    expect(outcome.httpStatus).toBe(504);
    expect(outcome.apiResponseKind).toBe('timeout');
    expect(outcome.localizationRecoveryAttempted).toBe(true);
    expect(outcome.localizationRecoveryAccepted).toBe(false);

    const diag = new SummaryAiDiagnosticSession({
      uiLocale: 'ar',
      requestedLocale: 'ar',
      contentLocale: 'ar',
      templateId: 'modern',
      gender: 'female',
      requestId: 'aab417-fail-closed',
      usageCountBefore: 7,
      operationMode: 'generate_from_context',
    });
    diag.recordCvSnapshot(cv, '');
    diag.stage('localization', 'fail', outcome.reason || undefined);
    diag.recordPreCandidateTerminalFailure({
      stage: 'localization',
      reason: outcome.reason || 'localization_provider_failed',
      usageAfter: 7,
      httpStatus: outcome.httpStatus,
      apiResponseKind: outcome.apiResponseKind,
      serverFallbackUsed: outcome.serverFallbackUsed,
      clientFallbackUsed: outcome.clientFallbackUsed,
    });
    const trace = diag.commit();

    expect(cv.summary).toBe('');
    expect(trace.finalCandidateSource).toBe('none');
    expect(trace.providerCandidatePresent).toBe(false);
    expect(trace.deterministicCandidatePresent).toBe(false);
    expect(trace.fallbackCandidatePresent).toBe(false);
    expect(trace.meaningfulChangeDetected).toBe(false);
    expect(trace.noOpDetected).toBe(false);
    expect(trace.apiResponseKind).toBe('timeout');
    expect(trace.serverFallbackUsed).toBe(false);
    expect(trace.clientFallbackUsed).toBe(false);
    expect(trace.grammarValidationPassed).toBeNull();
    expect(trace.groundingValidationPassed).toBeNull();
    expect(trace.durationValidationPassed).toBeNull();
    expect(trace.stages.find((stage) => stage.name === 'visible_apply')?.status).toBe('skipped');
    expect(trace.stages.find((stage) => stage.name === 'grounding_validation')?.status).toBe('skipped');
    expect(trace.candidateLineage).toEqual([]);
    expect(trace.visibleApplySucceeded).toBe(false);
    expect(trace.countedAsSuccess).toBe(false);
    expect(trace.usageCountBefore).toBe(7);
    expect(trace.usageCountAfter).toBe(7);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.missingRequiredDiagnosticFields).toEqual([]);
    expect(trace.nullRequiredDiagnosticFields).toEqual([]);
    expect(trace.privacyCheckPassed).toBe(true);
  });

  it('same-locale Arabic authority bypasses transport and the entry cache is source-bound', async () => {
    const cv = deviceCv();
    cv.experience = cv.experience?.filter((entry) => entry.id === 'e3-ar-completed') || [];
    const source = manifest(cv);
    let calls = 0;
    const outcome = await localizeSummaryV2Manifest({
      manifest: source,
      transport: async () => {
        calls += 1;
        throw new Error('transport_must_not_run');
      },
    });
    expect(calls).toBe(0);
    expect(outcome.localizationAttempted).toBe(false);
    expect(outcome.sameLocaleBypassCount).toBe(1);
    expect(outcome.manifest?.entries[0]?.localizedRoleTitle).toBe('مساعدة مكتبة');
  });

  it('rejects cross-entry fact migration and unsupported material before manifest acceptance', async () => {
    const source = manifest();
    const fullInput: SummaryV2LocalizationTransportInput = {
      targetLocale: 'ar',
      gender: 'female',
      repair: false,
      entries: [source.current!, ...source.priors].map((entry) => ({
        entryId: entry.entryId,
        sourceLocale: entry.sourceLocale,
        roleTitle: entry.role,
        employer: entry.employer,
        employmentState: entry.employmentState,
        facts: [...source.requiredCurrentFacts, ...source.requiredPriorFacts]
          .filter((fact) => fact.entryId === entry.entryId)
          .map((fact) => ({
            factId: fact.factId,
            sourceText: fact.bulletText,
            sourceTextHash: fact.sourceFactHash,
          })),
      })),
    };
    const migrated = responseFor(fullInput);
    const first = migrated.entries[0]!.facts[0]!;
    const second = migrated.entries[1]!.facts[0]!;
    [first.factId, second.factId] = [second.factId, first.factId];
    const ownership = validateSummaryV2LocalizationResponse(source, migrated);
    expect(ownership.factIdParityPassed).toBe(true);
    expect(ownership.factOwnershipParityPassed).toBe(false);
    expect(ownership.reason).toBe('localization_fact_ownership_failed');

    const unsupported = await localizeSummaryV2Manifest({
      manifest: source,
      transport: async (input) => {
        const response = responseFor(input);
        response.entries[0]!.facts[0]!.localizedText = 'حققت زيادة بنسبة 99% وقادت فريقاً.';
        return response;
      },
    });
    expect(unsupported.manifest).toBeNull();
    expect(unsupported.reason).toBe('localization_unsupported_material_claim');
  });

  it('fails the immutable Experience race guard after an in-flight fact edit', () => {
    const cv = deviceCv();
    const source = manifest(cv);
    expect(summaryV2SnapshotMatchesCv({
      cv,
      locale: 'ar',
      gender: 'female',
      referenceDateIso: REF,
      expectedSnapshotHash: source.snapshotHash,
    })).toBe(true);

    const edited = structuredClone(cv);
    edited.experience![1]!.description += '\nजोड़ी गई नई जिम्मेदारी।';
    expect(summaryV2SnapshotMatchesCv({
      cv: edited,
      locale: 'ar',
      gender: 'female',
      referenceDateIso: REF,
      expectedSnapshotHash: source.snapshotHash,
    })).toBe(false);
  });

  it('does not retry an equivalent timeout as repair when no recovery contract is supplied', async () => {
    let calls = 0;
    const outcome = await localizeSummaryV2Manifest({
      manifest: manifest(),
      transport: async () => {
        calls += 1;
        throw transportError('request_timeout', 504, 'timeout');
      },
    });
    expect(outcome.manifest).toBeNull();
    expect(outcome.localizationRepairAttempted).toBe(false);
    expect(calls).toBe(2); // exactly the two selected Hindi entries, once each
  });

  it('accepts the normal transport fixture used by both Generate and rewrite operations', async () => {
    const outcome = await localizeSummaryV2Manifest({
      manifest: manifest(),
      transport: successfulTransport,
    });
    expect(outcome.manifest).not.toBeNull();
  });
});
