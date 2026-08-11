/**
 * AAB-418 device-equivalent source gate.
 * Five Experience entries, three current candidates, ar/hi/ar selection,
 * female Arabic Generate-from-empty, and privacy-safe terminal evidence.
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  applyFinalizedSummaryToCv,
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import {
  SummaryAiDiagnosticSession,
  clearSummaryAiDiagnosticsForTests,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  buildSummaryV2ManifestForCv,
  buildSummaryV2ProviderExperienceEntries,
  clearSummaryV2LocalizationCacheForTests,
  localizeSummaryV2Manifest,
  resolveSummaryCurrentRoleWithEvidence,
  setSummaryV2EnabledForTests,
  summaryV2SnapshotMatchesCv,
  validateSummaryV2LocalizationResponse,
  type SummaryV2LocalizationProviderResponse,
  type SummaryV2LocalizationTransportInput,
  type SummaryV2SelectionManifest,
} from '@/lib/cv-summary-v2';

const REF = '2026-08-11';
const IDS = {
  currentArNewest: 'aab418-current-ar-newest',
  completedHi: 'aab418-completed-hi',
  completedAr: 'aab418-completed-ar',
  currentArOlder: 'aab418-current-ar-older',
  currentHiOldest: 'aab418-current-hi-oldest',
} as const;

const AR = {
  currentRole: '\u0645\u0634\u0631\u0641\u0629 \u0639\u0645\u0644\u064a\u0627\u062a',
  completedRole: '\u0645\u0633\u0627\u0639\u062f\u0629 \u0645\u0643\u062a\u0628\u0629',
  localizedHiRole: '\u0645\u0646\u0633\u0642\u0629 \u0645\u062e\u0632\u0648\u0646',
  currentFacts: [
    '\u062a\u0631\u0627\u062c\u0639 \u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u064a\u0648\u0645\u064a\u0629.',
    '\u062a\u0633\u062c\u0644 \u062d\u0631\u0643\u0629 \u0627\u0644\u0645\u0648\u0627\u062f.',
    '\u062a\u0646\u0633\u0642 \u0627\u0644\u0639\u0645\u0644 \u0645\u0639 \u0627\u0644\u0632\u0645\u0644\u0627\u0621.',
  ],
  completedFacts: [
    '\u0631\u0627\u062c\u0639\u062a \u0627\u0644\u0633\u062c\u0644\u0627\u062a \u0627\u0644\u064a\u0648\u0645\u064a\u0629.',
    '\u0631\u062a\u0628\u062a \u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0628\u062f\u0642\u0629.',
    '\u0633\u0627\u0639\u062f\u062a \u0627\u0644\u0632\u0648\u0627\u0631 \u0641\u064a \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a.',
  ],
  localizedHiFacts: [
    '\u0641\u062d\u0635\u062a \u0627\u0644\u0628\u0636\u0627\u0626\u0639 \u0627\u0644\u0648\u0627\u0631\u062f\u0629.',
    '\u0631\u0627\u062c\u0639\u062a \u0648\u062b\u0627\u0626\u0642 \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645.',
    '\u0646\u0633\u0642\u062a \u062d\u0631\u0643\u0629 \u0627\u0644\u0628\u0636\u0627\u0626\u0639 \u0645\u0639 \u0627\u0644\u0632\u0645\u0644\u0627\u0621.',
  ],
} as const;

const HI = {
  role: '\u0917\u094b\u0926\u093e\u092e \u0928\u093f\u0930\u0940\u0915\u094d\u0937\u0915',
  facts: [
    '\u0906\u0928\u0947 \u0935\u093e\u0932\u0947 \u0938\u093e\u092e\u093e\u0928 \u0915\u0940 \u091c\u093e\u0901\u091a \u0915\u0940\u0964',
    '\u092a\u094d\u0930\u093e\u092a\u094d\u0924\u093f \u0926\u0938\u094d\u0924\u093e\u0935\u0947\u091c\u093c\u094b\u0902 \u0915\u0940 \u0938\u092e\u0940\u0915\u094d\u0937\u093e \u0915\u0940\u0964',
    '\u0938\u0939\u0915\u0930\u094d\u092e\u093f\u092f\u094b\u0902 \u0915\u0947 \u0938\u093e\u0925 \u0938\u093e\u092e\u093e\u0928 \u0915\u0940 \u0906\u0935\u093e\u091c\u093e\u0939\u0940 \u0938\u092e\u0928\u094d\u0935\u093f\u0924 \u0915\u0940\u0964',
  ],
} as const;

function experience(options: {
  id: string;
  locale: 'ar' | 'hi';
  role: string;
  facts: readonly string[];
  company: string;
  startDate: string;
  isPresent: boolean;
  endDate?: string;
}): WorkExperience {
  const description = options.facts.join('\n');
  return {
    id: options.id,
    position: options.role,
    company: options.company,
    startDate: options.startDate,
    endDate: options.endDate || '',
    isPresent: options.isPresent,
    description,
    canonicalDescription: description,
    originalUserDescription: description,
    descriptionOrigin: 'user',
    generatedLocale: options.locale,
    positionSourceLocale: options.locale,
  } as WorkExperience;
}

function deviceCv(options: { brandIsland?: boolean } = {}): CVData {
  const currentFacts = options.brandIsland
    ? [AR.currentFacts[0], 'Atlas', AR.currentFacts[2]]
    : AR.currentFacts;
  return {
    id: 'aab418-device-equivalent',
    name: 'AAB 418 fixture',
    personal: {
      fullName: '\u0645\u0633\u062a\u062e\u062f\u0645\u0629 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631',
      email: 'fixture@example.test',
      phone: '',
      address: '',
      jobTitle: '',
      gender: 'female',
    },
    summary: '',
    experience: [
      experience({
        id: IDS.currentArOlder, locale: 'ar', role: '\u0645\u0646\u0633\u0642\u0629 \u062e\u062f\u0645\u0627\u062a',
        facts: AR.currentFacts, company: '\u0645\u0631\u0643\u0632 \u0627\u0644\u0647\u062f\u0649', startDate: '2022-06', isPresent: true,
      }),
      experience({
        id: IDS.completedHi, locale: 'hi', role: HI.role, facts: HI.facts,
        company: 'Acme-42', startDate: '2019-01', endDate: '2021-12', isPresent: false,
      }),
      experience({
        id: IDS.currentArNewest, locale: 'ar', role: AR.currentRole, facts: currentFacts,
        company: '\u0634\u0631\u0643\u0629 \u0627\u0644\u0646\u0648\u0631', startDate: '2025-07', isPresent: true,
      }),
      experience({
        id: IDS.completedAr, locale: 'ar', role: AR.completedRole, facts: AR.completedFacts,
        company: '\u0645\u0643\u062a\u0628\u0629 \u0627\u0644\u0645\u062f\u064a\u0646\u0629', startDate: '2022-01', endDate: '2023-12', isPresent: false,
      }),
      experience({
        id: IDS.currentHiOldest, locale: 'hi', role: HI.role, facts: HI.facts,
        company: '\u0645\u0631\u0643\u0632 \u0627\u0644\u0633\u0644\u0627\u0645', startDate: '2020-02', isPresent: true,
      }),
    ],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    templateId: 'modern-minimal',
    contentLocale: 'ar',
    region: 'RS',
    createdAt: REF,
    updatedAt: REF,
  } as unknown as CVData;
}

function manifest(cv = deviceCv()): SummaryV2SelectionManifest {
  return buildSummaryV2ManifestForCv({
    cv,
    locale: 'ar',
    gender: 'female',
    referenceDateIso: REF,
  });
}

function localizedResponse(input: SummaryV2LocalizationTransportInput): SummaryV2LocalizationProviderResponse {
  return {
    targetLocale: input.targetLocale,
    entries: input.entries.map((entry) => ({
      entryId: entry.entryId,
      localizedRoleTitle: AR.localizedHiRole,
      facts: entry.facts.map((fact, index) => ({
        factId: fact.factId,
        localizedText: AR.localizedHiFacts[index]!,
      })),
    })),
  };
}

function leakedResponse(input: SummaryV2LocalizationTransportInput): SummaryV2LocalizationProviderResponse {
  return {
    targetLocale: input.targetLocale,
    entries: input.entries.map((entry) => ({
      entryId: entry.entryId,
      localizedRoleTitle: entry.roleTitle,
      facts: entry.facts.map((fact) => ({ factId: fact.factId, localizedText: fact.sourceText })),
    })),
  };
}

async function successfulOutcome(cv = deviceCv()) {
  return localizeSummaryV2Manifest({
    manifest: manifest(cv),
    transport: async (input) => localizedResponse(input),
  });
}

describe('AAB 418 device-equivalent multilingual Summary source gate', () => {
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

  it('reproduces 5 entries, 3 current candidates, and selected ar/hi/ar topology', () => {
    const source = manifest();
    expect(deviceCv().experience).toHaveLength(5);
    expect(deviceCv().experience?.filter((entry) => entry.isPresent)).toHaveLength(3);
    expect(source.current?.entryId).toBe(IDS.currentArNewest);
    expect(source.priors.map((entry) => entry.entryId)).toEqual([IDS.completedHi, IDS.completedAr]);
    expect([source.current, ...source.priors].map((entry) => entry?.sourceLocale)).toEqual(['ar', 'hi', 'ar']);
  });

  it('primary Hindi leakage is classified, materially different repair succeeds, and full manifest is accepted', async () => {
    const calls: boolean[] = [];
    const outcome = await localizeSummaryV2Manifest({
      manifest: manifest(),
      transport: async (input) => {
        calls.push(input.repair);
        return input.repair ? localizedResponse(input) : leakedResponse(input);
      },
    });
    expect(calls).toEqual([false, true]);
    expect(outcome.primaryFailureReason).toBe('localization_wrong_script');
    expect(outcome.localizationRepairAttempted).toBe(true);
    expect(outcome.localizationRepairAccepted).toBe(true);
    expect(outcome.manifest).not.toBeNull();
    expect(outcome.lineageByEntryId[IDS.completedHi]).toBe('provider_repair');
  });

  it('primary and repair wrong-script rejection enter alternate Summary-context recovery', async () => {
    const primaryCalls: boolean[] = [];
    let recoveryCalls = 0;
    const outcome = await localizeSummaryV2Manifest({
      manifest: manifest(),
      transport: async (input) => {
        primaryCalls.push(input.repair);
        return leakedResponse(input);
      },
      recoveryTransport: async (input) => {
        recoveryCalls += 1;
        return localizedResponse(input);
      },
    });
    expect(primaryCalls).toEqual([false, true]);
    expect(recoveryCalls).toBe(1);
    expect(outcome.primaryFailureReason).toBe('localization_wrong_script');
    expect(outcome.localizationRecoveryAttempted).toBe(true);
    expect(outcome.localizationRecoveryAccepted).toBe(true);
    expect(outcome.lineageByEntryId[IDS.completedHi]).toBe('summary_context_recovery');
    expect(outcome.manifest).not.toBeNull();
  });

  it('all wrong-script recovery paths fail closed with field-level privacy-safe evidence', async () => {
    const outcome = await localizeSummaryV2Manifest({
      manifest: manifest(),
      transport: async (input) => leakedResponse(input),
      recoveryTransport: async (input) => leakedResponse(input),
    });
    expect(outcome.manifest).toBeNull();
    expect(outcome.reason).toBe('localization_wrong_script');
    expect(outcome.primaryFailureReason).toBe('localization_wrong_script');
    expect(outcome.localizationRepairAttempted).toBe(true);
    expect(outcome.localizationRecoveryAttempted).toBe(true);
    expect(outcome.lineageByEntryId[IDS.completedHi]).toBe('failed');
    expect(outcome.targetLocaleByEntryId[IDS.completedHi]).toBeNull();
    expect(outcome.validationFailureEvidence).toMatchObject({
      entryId: IDS.completedHi,
      surfaceKind: 'localized_role_title',
      detectedScript: 'devanagari',
      tokenClass: 'translatable_surface_wrong_script',
    });
    expect(JSON.stringify(outcome.validationFailureEvidence)).not.toMatch(/[\u0900-\u097F]/u);
  });

  it('accepted same-locale Arabic entries retain authority through mixed assembly', async () => {
    const outcome = await successfulOutcome(deviceCv({ brandIsland: true }));
    expect(outcome.manifest, outcome.reason || undefined).not.toBeNull();
    expect(outcome.sameLocaleBypassCount).toBe(2);
    expect(outcome.providerLocalizedEntryCount).toBe(1);
    expect(outcome.lineageByEntryId[IDS.currentArNewest]).toBe('same_locale_authoritative');
    expect(outcome.lineageByEntryId[IDS.completedAr]).toBe('same_locale_authoritative');
    expect(outcome.targetLocaleByEntryId[IDS.currentArNewest]).toBe('ar');
    expect(outcome.targetLocaleByEntryId[IDS.completedAr]).toBe('ar');
    expect(outcome.manifest?.entries.find((entry) => entry.entryId === IDS.currentArNewest)
      ?.facts.some((fact) => fact.localizedText === 'Atlas')).toBe(true);
  });

  it('Arabic localization may preserve a source-bound Latin employer entity without weakening prose validation', async () => {
    const outcome = await localizeSummaryV2Manifest({
      manifest: manifest(),
      transport: async (input) => {
        const response = localizedResponse(input);
        response.entries[0]!.localizedRoleTitle = `${AR.localizedHiRole} Acme-42`;
        response.entries[0]!.facts[0]!.localizedText = `${AR.localizedHiFacts[0]} Acme-42`;
        return response;
      },
    });
    expect(outcome.manifest, outcome.reason || undefined).not.toBeNull();
    expect(outcome.validation?.protectedEntityTokenClasses).toContain('employer_entity');
  });

  it('a source technical acronym may remain unchanged while all translatable facts are Arabic', async () => {
    const cv = deviceCv();
    const hi = (cv.experience || []).find((entry) => entry.id === IDS.completedHi);
    expect(hi).toBeDefined();
    hi!.position = 'CEO';
    const outcome = await localizeSummaryV2Manifest({
      manifest: manifest(cv),
      transport: async (input) => {
        const response = localizedResponse(input);
        response.entries[0]!.localizedRoleTitle = 'CEO';
        return response;
      },
    });
    expect(outcome.manifest, outcome.reason || undefined).not.toBeNull();
    expect(outcome.validation?.protectedEntityTokenClasses).toContain('technical_acronym');
  });

  it('actual Devanagari in a translatable role remains a wrong-script rejection', () => {
    const source = manifest();
    const hi = source.priors.find((entry) => entry.entryId === IDS.completedHi)!;
    const scoped: SummaryV2SelectionManifest = {
      ...source,
      current: null,
      priors: [hi],
      requiredCurrentFacts: [],
      requiredPriorFacts: source.requiredPriorFacts.filter((fact) => fact.entryId === hi.entryId),
    };
    const response = leakedResponse({
      targetLocale: 'ar', gender: 'female', repair: false,
      entries: [{
        entryId: hi.entryId, sourceLocale: hi.sourceLocale, roleTitle: hi.role,
        employer: hi.employer, employmentState: hi.employmentState,
        facts: scoped.requiredPriorFacts.map((fact) => ({
          factId: fact.factId, sourceText: fact.bulletText, sourceTextHash: fact.sourceFactHash,
        })),
      }],
    });
    const validation = validateSummaryV2LocalizationResponse(scoped, response);
    expect(validation.reason).toBe('localization_wrong_script');
    expect(validation.failureEvidence?.surfaceKind).toBe('localized_role_title');
    expect(validation.failureEvidence?.detectedScript).toBe('devanagari');
  });

  it('arbitrary Latin role prose is not covered by the protected-entity exemption', async () => {
    const outcome = await localizeSummaryV2Manifest({
      manifest: manifest(),
      transport: async (input) => {
        const response = localizedResponse(input);
        response.entries[0]!.localizedRoleTitle = 'Warehouse manager';
        return response;
      },
    });
    expect(outcome.manifest).toBeNull();
    expect(outcome.reason).toBe('localization_wrong_script');
    expect(outcome.validationFailureEvidence?.tokenClass).toBe('translatable_surface_wrong_script');
  });

  it('same-locale entries never call transport and publish accepted target-locale lineage', async () => {
    const cv = deviceCv();
    cv.experience = cv.experience?.filter((entry) => entry.id === IDS.completedAr) || [];
    let calls = 0;
    const outcome = await localizeSummaryV2Manifest({
      manifest: manifest(cv),
      transport: async () => {
        calls += 1;
        throw new Error('not_expected');
      },
    });
    expect(calls).toBe(0);
    expect(outcome.lineageByEntryId[IDS.completedAr]).toBe('same_locale_authoritative');
    expect(outcome.targetLocaleByEntryId[IDS.completedAr]).toBe('ar');
  });

  it('resolver ranks all three current entries by newest valid structured month independent of array order', () => {
    const cv = deviceCv();
    const reversed = [...(cv.experience || [])].reverse();
    const resolved = resolveSummaryCurrentRoleWithEvidence(reversed);
    expect(resolved.selected?.id).toBe(IDS.currentArNewest);
    expect(resolved.currentCandidateCount).toBe(3);
    expect(resolved.candidates.map((candidate) => candidate.normalizedStartYear)).toEqual([2025, 2022, 2020]);
    expect(resolved.candidates.map((candidate) => candidate.normalizedStartMonth)).toEqual([7, 6, 2]);
    expect(resolved.candidates.map((candidate) => candidate.rank)).toEqual([1, 2, 3]);
    expect(resolved.candidates.every((candidate) => candidate.dateAuthority === 'structured_year_month')).toBe(true);
    expect(resolved.tieFallbackUsed).toBe(false);
  });

  it('invalid and missing dates use deterministic source-order fallback and expose the tie', () => {
    const candidates = [
      { id: 'first', isPresent: true, startDate: 'not-a-date' },
      { id: 'second', isPresent: true, startDate: '' },
      { id: 'third', isPresent: true, startDate: '2025-99' },
    ];
    const resolved = resolveSummaryCurrentRoleWithEvidence(candidates);
    expect(resolved.selected?.id).toBe('first');
    expect(resolved.candidates.every((candidate) => !candidate.valid)).toBe(true);
    expect(resolved.candidates.every((candidate) => candidate.dateAuthority === 'invalid_or_missing')).toBe(true);
    expect(resolved.tieRule).toBe('source_array_order');
    expect(resolved.tieFallbackUsed).toBe(true);
  });

  it('completed-prior selection remains independent of extra current entries', () => {
    const source = manifest();
    expect(source.priors.map((entry) => entry.entryId)).toEqual([IDS.completedHi, IDS.completedAr]);
    expect(source.priors.every((entry) => !entry.isPresent)).toBe(true);
  });

  it('entry/fact parity is revalidated through repair and alternate recovery', async () => {
    let recoveryCalls = 0;
    const outcome = await localizeSummaryV2Manifest({
      manifest: manifest(),
      transport: async (input) => {
        if (!input.repair) return leakedResponse(input);
        const response = localizedResponse(input);
        response.entries[0]!.facts[0]!.factId = 'wrong-owner-fact';
        return response;
      },
      recoveryTransport: async (input) => {
        recoveryCalls += 1;
        return localizedResponse(input);
      },
    });
    expect(recoveryCalls).toBe(1);
    expect(outcome.manifest).not.toBeNull();
    expect(outcome.validation?.entryIdParityPassed).toBe(true);
    expect(outcome.validation?.factIdParityPassed).toBe(true);
    expect(outcome.validation?.factOwnershipParityPassed).toBe(true);
  });

  it('cross-entry fact migration remains rejected', () => {
    const source = manifest();
    const response: SummaryV2LocalizationProviderResponse = {
      targetLocale: 'ar',
      entries: [source.current!, ...source.priors].map((entry) => ({
        entryId: entry.entryId,
        localizedRoleTitle: entry.sourceLocale === 'ar' ? entry.role : AR.localizedHiRole,
        facts: [...source.requiredCurrentFacts, ...source.requiredPriorFacts]
          .filter((fact) => fact.entryId === entry.entryId)
          .map((fact, index) => ({
            factId: fact.factId,
            localizedText: entry.sourceLocale === 'ar' ? fact.bulletText : AR.localizedHiFacts[index]!,
          })),
      })),
    };
    const first = response.entries[0]!.facts[0]!;
    const second = response.entries[1]!.facts[0]!;
    [first.factId, second.factId] = [second.factId, first.factId];
    const validation = validateSummaryV2LocalizationResponse(source, response);
    expect(validation.factIdParityPassed).toBe(true);
    expect(validation.factOwnershipParityPassed).toBe(false);
    expect(validation.reason).toBe('localization_fact_ownership_failed');
  });

  it('only accepted Arabic surfaces reach Summary provider input', async () => {
    const source = manifest();
    const outcome = await successfulOutcome();
    const entries = buildSummaryV2ProviderExperienceEntries({ manifest: source, localized: outcome.manifest! });
    const serialized = JSON.stringify(entries);
    expect(serialized).toMatch(/[\u0600-\u06FF]/u);
    expect(serialized).not.toMatch(/[\u0900-\u097F]/u);
    expect(entries?.every((entry) => entry.sourceLocale === 'ar')).toBe(true);
  });

  it('race after localization invalidates the immutable snapshot before apply', async () => {
    const cv = deviceCv();
    const source = manifest(cv);
    const outcome = await successfulOutcome(cv);
    expect(outcome.manifest).not.toBeNull();
    const edited = structuredClone(cv);
    edited.experience![1]!.description += `\n${HI.facts[0]}`;
    expect(summaryV2SnapshotMatchesCv({
      cv: edited,
      locale: 'ar',
      gender: 'female',
      referenceDateIso: REF,
      expectedSnapshotHash: source.snapshotHash,
    })).toBe(false);
  });

  it('successful Generate-from-empty applies once with final/visible hash parity and +1', async () => {
    const cv = deviceCv();
    const outcome = await successfulOutcome(cv);
    const finalized = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'ar',
      gender: 'female',
      cv,
      candidate: '',
      referenceDateIso: REF,
      durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], REF),
      localizedSummaryManifest: outcome.manifest,
    });
    expect(finalized.blocked, finalized.reason).toBe(false);
    expect(finalized.countedAsSuccess).toBe(true);
    const applied = applyFinalizedSummaryToCv(cv, 'ar', finalized);
    const diag = new SummaryAiDiagnosticSession({
      uiLocale: 'ar', requestedLocale: 'ar', contentLocale: 'ar', templateId: 'modern-minimal',
      gender: 'female', requestId: 'aab418-success', usageCountBefore: 7,
      operationMode: 'generate_from_context',
    });
    diag.recordCvSnapshot(cv, '');
    diag.recordFinalizeResult(finalized);
    diag.recordVisibleApply(true, 8, applied.summary || '');
    const trace = diag.commit();
    expect(trace.usageCountAfter).toBe(8);
    expect(trace.finalValidatedCandidateHash).toBe(trace.visibleCandidateHashAfterApply);
    expect(trace.visibleSummaryMatchesFinalHash).toBe(true);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.diagnosticPrivacyViolations).toEqual([]);
    expect(trace.privacyCheckPassed).toBe(true);
  });

  it('pre-candidate terminal validators serialize canonical null/N/A and +0', async () => {
    const cv = deviceCv();
    const outcome = await localizeSummaryV2Manifest({
      manifest: manifest(cv),
      transport: async (input) => leakedResponse(input),
      recoveryTransport: async (input) => leakedResponse(input),
    });
    const diag = new SummaryAiDiagnosticSession({
      uiLocale: 'ar', requestedLocale: 'ar', contentLocale: 'ar', templateId: 'modern-minimal',
      gender: 'female', requestId: 'aab418-fail', usageCountBefore: 7,
      operationMode: 'generate_from_context',
    });
    diag.recordCvSnapshot(cv, '');
    diag.stage('localization', 'fail', outcome.reason || undefined);
    diag.recordPreCandidateTerminalFailure({
      stage: 'localization', reason: outcome.reason!, usageAfter: 7,
      httpStatus: outcome.httpStatus, apiResponseKind: outcome.apiResponseKind,
    });
    const trace = diag.commit();
    for (const value of [
      trace.perspectiveValidationPassed,
      trace.genderValidationPassed,
      trace.tenseValidationPassed,
      trace.localeValidationPassed,
      trace.targetLocalePurityPassed,
      trace.grammarValidationPassed,
      trace.groundingValidationPassed,
      trace.durationValidationPassed,
      trace.finalPostconditionsPassed,
    ]) expect(value).toBeNull();
    expect(trace.usageCountAfter).toBe(7);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.privacyCheckPassed).toBe(true);
  });

  it('network timeout does not become an equivalent repair request', async () => {
    let calls = 0;
    const timeout = Object.assign(new Error('request_timeout'), {
      reason: 'request_timeout', httpStatus: 504, apiResponseKind: 'timeout',
    });
    const outcome = await localizeSummaryV2Manifest({
      manifest: manifest(),
      transport: async () => {
        calls += 1;
        throw timeout;
      },
    });
    expect(calls).toBe(1);
    expect(outcome.localizationRepairAttempted).toBe(false);
    expect(outcome.manifest).toBeNull();
  });
});
