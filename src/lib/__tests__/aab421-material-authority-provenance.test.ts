import { beforeEach, describe, expect, it } from 'vitest';
import type { Locale } from '@/lib/i18n/translations';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  SUMMARY_V2_PRINT_MATERIAL_CATEGORY,
  acceptSummaryV2LocalizationResponse,
  analyzeSummaryV2FinalUnitOwnership,
  auditSummaryV2MaterialClaims,
  buildEntryOwnedFactsFromLiveDescription,
  buildSummaryV2DeterministicText,
  buildSummaryV2ManifestForCv,
  hashSummaryV2Text,
  projectLocalizedSummaryV2Manifest,
  setSummaryV2EnabledForTests,
  validateSummaryV2AgainstManifest,
  validateSummaryV2MaterialAuthorityProvenance,
  type SummaryV2CandidateSourceKind,
  type SummaryV2EntryOwned,
  type SummaryV2MaterialAuthorityResult,
  type SummaryV2SelectionManifest,
} from '@/lib/cv-summary-v2';
import {
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { checkSummaryDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';
import {
  SummaryAiDiagnosticSession,
  clearSummaryAiDiagnosticsForTests,
} from '@/lib/cv-summary-ai-diagnostics';

const REF = '2026-08-12';
const LOCALES: Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
];
const PRINT: Record<Locale, string> = {
  en: 'I prepare materials for print.',
  de: 'Ich bereite Materialien für Printmedien vor.',
  es: 'Preparo materiales impresos.',
  fr: 'Je prépare des supports imprimés.',
  it: 'Preparo materiali stampati.',
  ar: 'أُعِدُّ المواد المطبوعة.',
  sr: 'Pripremam materijale za štampu.',
  hr: 'Pripremam tiskane materijale.',
  ru: 'Я готовлю печатные материалы.',
  'pt-BR': 'Preparo materiais impressos.',
  hi: 'मैं मुद्रित सामग्री तैयार करती हूँ।',
  ja: '印刷物を準備します。',
};
const ORDINARY: Record<Locale, string> = {
  en: 'I maintain detailed archive records.',
  de: 'Ich pflege ausführliche Archivunterlagen.',
  es: 'Mantengo registros detallados del archivo.',
  fr: 'Je tiens des dossiers d’archives détaillés.',
  it: 'Mantengo registri di archivio dettagliati.',
  ar: 'أحافظ على سجلات الأرشيف التفصيلية.',
  sr: 'Vodim detaljnu arhivsku evidenciju.',
  hr: 'Vodim detaljnu arhivsku evidenciju.',
  ru: 'Я веду подробные архивные записи.',
  'pt-BR': 'Mantenho registros detalhados do arquivo.',
  hi: 'मैं विस्तृत अभिलेख रिकॉर्ड बनाए रखती हूँ।',
  ja: '詳細な資料記録を管理します。',
};
const ROLE: Record<Locale, string> = {
  en: 'Community archive workflow steward',
  de: 'Koordinatorin für gemeinschaftliche Archivabläufe',
  es: 'Responsable de flujos del archivo comunitario',
  fr: 'Responsable des flux des archives communautaires',
  it: 'Responsabile dei flussi dell’archivio comunitario',
  ar: 'مسؤولة سير عمل الأرشيف المجتمعي',
  sr: 'Koordinatorka tokova arhive zajednice',
  hr: 'Koordinatorica tijeka arhive zajednice',
  ru: 'Координатор процессов общественного архива',
  'pt-BR': 'Responsável pelos fluxos do arquivo comunitário',
  hi: 'सामुदायिक अभिलेख कार्यप्रवाह समन्वयक',
  ja: '地域資料管理業務の調整担当者',
};

function entry(options: {
  id: string;
  locale?: Locale;
  duty: string;
  present?: boolean;
  role?: string;
  employer?: string;
}): SummaryV2EntryOwned {
  const locale = options.locale || 'en';
  const role = options.role || ROLE[locale];
  return {
    entryId: options.id,
    role,
    employer: options.employer || `Protected Entity ${options.id}`,
    startDate: options.present === false ? '2021-01' : '2024-01',
    endDate: options.present === false ? '2023-12' : '',
    isPresent: options.present !== false,
    employmentState: options.present === false ? 'completed' : 'present',
    sourceRoleTitleHash: hashSummaryV2Text(role),
    sourceLocale: locale,
    descriptionHash: hashSummaryV2Text(options.duty),
    facts: buildEntryOwnedFactsFromLiveDescription({
      entryId: options.id,
      liveDescription: options.duty,
      sourceLocale: locale,
    }),
  };
}

function manifest(options: {
  currentDuty?: string;
  priorDuty?: string;
  locale?: Locale;
} = {}): SummaryV2SelectionManifest {
  const locale = options.locale || 'en';
  const current = entry({
    id: 'current-source-entry',
    locale,
    duty: options.currentDuty || ORDINARY[locale],
  });
  const prior = options.priorDuty ? entry({
    id: 'prior-source-entry',
    locale,
    duty: options.priorDuty,
    present: false,
  }) : null;
  return {
    revision: 'aab421-material-authority-test',
    snapshotHash: `snapshot-${locale}-${hashSummaryV2Text([
      options.currentDuty, options.priorDuty,
    ].join('|'))}`,
    locale,
    gender: 'female',
    totalDurationMonths: 24,
    durationPhrase: locale === 'en' ? 'approximately two years of experience' : 'duration',
    styleHintUsed: false,
    current,
    priors: prior ? [prior] : [],
    requiredCurrentFacts: current.facts.map((fact) => ({ ...fact })),
    requiredPriorFacts: prior ? prior.facts.map((fact) => ({ ...fact })) : [],
    maxDutiesPerEntry: 3,
  };
}

function auditDeterministic(
  source: SummaryV2SelectionManifest,
  text = buildSummaryV2DeterministicText(source),
  candidateSource: SummaryV2CandidateSourceKind = 'deterministic',
) {
  const ownership = analyzeSummaryV2FinalUnitOwnership(text, source, {
    candidateSource,
    preserveConstructionOrder: candidateSource === 'deterministic',
  });
  return {
    text,
    ownership,
    audit: auditSummaryV2MaterialClaims(text, source, ownership.evidence),
  };
}

function work(duty: string): WorkExperience {
  return {
    id: 'current-source-entry', position: ROLE.en, company: 'Protected Entity Runtime',
    startDate: '2024-01', endDate: '', isPresent: true, description: duty,
    originalUserDescription: duty, descriptionOrigin: 'user', generatedLocale: 'en',
  } as WorkExperience;
}

function runtimeCv(duty: string): CVData {
  return {
    id: 'material-authority-runtime', name: 'Material authority runtime',
    personal: {
      fullName: 'Private', email: '', phone: '', address: '', jobTitle: '', gender: 'female',
    },
    summary: '', experience: [work(duty)], education: [], skills: [], certifications: [],
    languages: [], templateId: 'modern-minimal', region: 'EU',
    createdAt: REF, updatedAt: REF, contentLocale: 'en',
  } as unknown as CVData;
}

describe('AAB 421 generic material-claim authority provenance', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    clearSummaryAiDiagnosticsForTests();
  });

  it('1. accepts same-entry print and serializes the exact immutable authorizing fact', () => {
    const source = manifest({ currentDuty: PRINT.en });
    const result = validateSummaryV2AgainstManifest(
      buildSummaryV2DeterministicText(source),
      source,
      { candidateSource: 'deterministic', preserveConstructionOrder: true },
    );
    expect(result.ok, result.reason || '').toBe(true);
    const sourceFact = source.current!.facts[0]!;
    const claim = result.materialAuthority.finalClaimAuthorityEvidence[0]!;
    expect(claim).toMatchObject({
      canonicalCategory: SUMMARY_V2_PRINT_MATERIAL_CATEGORY,
      finalUnitRoleSlot: 'current_role',
      authorityMatchPassed: true,
      unsupportedReason: null,
      authorizingSourceFactHashes: [sourceFact.sourceFactHash],
    });
    expect(result.materialAuthority.sourceAuthorityEvidence[0]).toMatchObject({
      sourceFactHash: sourceFact.sourceFactHash,
      sourceLocale: 'en',
      canonicalMaterialCategories: [SUMMARY_V2_PRINT_MATERIAL_CATEGORY],
      authorityPhase: 'immutable_source_fact',
      sourceFactEntryOwnershipPassed: true,
    });
    expect(result.materialAuthority.sourcePrintFactPresentScope)
      .toBe('aggregate_selected_manifest_authority');
  });

  it('2. rejects a same-entry final print claim when immutable source has no print authority', () => {
    const source = manifest();
    const base = buildSummaryV2DeterministicText(source);
    const invented = base.replace(/maintain detailed archive records/iu, 'prepare materials for print');
    const result = validateSummaryV2AgainstManifest(invented, source, {
      candidateSource: 'provider',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('unsupported_print_medium_claim');
    expect(result.materialAuthority.finalClaimAuthorityEvidence[0]).toMatchObject({
      authorityMatchPassed: false,
      unsupportedReason: 'owner_matching_source_authority_missing',
      authorizingSourceFactHashes: [],
    });
  });

  it('3. does not borrow print authority from another selected entry', () => {
    const source = manifest({ priorDuty: PRINT.en });
    const base = buildSummaryV2DeterministicText(source);
    const invented = base.replace(/maintain detailed archive records/iu, 'prepare materials for print');
    const result = validateSummaryV2AgainstManifest(invented, source, {
      candidateSource: 'provider',
    });
    const currentClaim = result.materialAuthority.finalClaimAuthorityEvidence.find(
      (claim) => claim.finalUnitRoleSlot === 'current_role',
    );
    expect(result.reason).toBe('unsupported_print_medium_claim');
    expect(currentClaim).toMatchObject({
      authorityMatchPassed: false,
      authorizingSourceEntryHash: null,
      authorizingSourceFactHashes: [],
    });
  });

  it('4. does not admit authority from an omitted Experience entry', () => {
    const source = manifest();
    const omitted = entry({ id: 'omitted-print-entry', duty: PRINT.en, present: false });
    const finalText = `${ROLE.en} — ${source.current!.employer} — ${PRINT.en}`;
    const audit = auditSummaryV2MaterialClaims(finalText, source);
    expect(omitted.facts[0]!.sourceMaterialClaimCategories)
      .toEqual([SUMMARY_V2_PRINT_MATERIAL_CATEGORY]);
    expect(audit.sourceAuthorityEvidence).toEqual([]);
    expect(audit.finalClaimAuthorityEvidence[0]).toMatchObject({
      authorityMatchPassed: false,
      unsupportedReason: 'owner_matching_source_authority_missing',
    });
  });

  it('5. preserves immutable fact/category identity through source-bound localization', () => {
    const source = manifest({ currentDuty: PRINT.en, locale: 'en' });
    source.locale = 'de';
    source.durationPhrase = 'ungefähr zwei Jahre Berufserfahrung';
    source.current!.roleSourceLocale = 'en';
    const original = source.current!.facts[0]!;
    const localized = acceptSummaryV2LocalizationResponse({
      manifest: source,
      source: 'provider',
      response: {
        targetLocale: 'de',
        entries: [{
          entryId: source.current!.entryId,
          localizedRoleTitle: ROLE.de,
          facts: [{ factId: original.factId, localizedText: PRINT.de }],
        }],
      },
    }).manifest;
    expect(localized).not.toBeNull();
    const projected = projectLocalizedSummaryV2Manifest({ manifest: source, localized: localized! })!;
    const projectedFact = projected.current!.facts[0]!;
    expect(projectedFact.bulletText).toBe(PRINT.de);
    expect(projectedFact.sourceFactHash).toBe(original.sourceFactHash);
    expect(projectedFact.factId).toBe(original.factId);
    expect(projectedFact.sourceMaterialClaimCategories)
      .toEqual([SUMMARY_V2_PRINT_MATERIAL_CATEGORY]);
    expect(projectedFact.sourceMaterialAuthorityPhase).toBe('immutable_source_fact');
    const finalText = `${ROLE.de} — ${projected.current!.employer} — ${PRINT.de}`;
    const audit = auditSummaryV2MaterialClaims(finalText, projected);
    expect(audit.invariantPassed).toBe(true);
    expect(audit.finalClaimAuthorityEvidence[0]!.authorizingSourceFactHashes)
      .toEqual([original.sourceFactHash]);
  });

  it.each([
    ['6. provider', 'provider'],
    ['7. deterministic fallback', 'deterministic'],
    ['8. repaired provider', 'repaired_provider'],
    ['9. final selected', 'final_selected'],
  ] as const)('%s cannot introduce print without source authority', (_label, candidateSource) => {
    const source = manifest();
    const base = buildSummaryV2DeterministicText(source);
    const invented = base.replace(/maintain detailed archive records/iu, 'prepare materials for print');
    const result = validateSummaryV2AgainstManifest(invented, source, {
      candidateSource,
      preserveConstructionOrder: candidateSource === 'deterministic',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('unsupported_print_medium_claim');
    expect(result.materialAuthority.unsupportedPrintClaimCount).toBe(1);
  });

  it('10. missing fact-level diagnostics fails invariant and blocks apply/usage (+0)', () => {
    const cv = runtimeCv(PRINT.en);
    const source = buildSummaryV2ManifestForCv({
      cv, locale: 'en', gender: 'female', referenceDateIso: REF,
    });
    const candidate = buildSummaryV2DeterministicText(source);
    const finalized = finalizeCvAiFieldForApply({
      action: 'summary_generate', field: 'summary', requestedLocale: 'en', gender: 'female',
      cv, candidate, referenceDateIso: REF,
      durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], REF),
    });
    expect(finalized.blocked, finalized.reason).toBe(false);
    expect(finalized.diagnostics?.materialAuthority).toBeDefined();
    expect(finalized.diagnostics!.materialAuthority!.sourceAuthorityEvidence[0])
      .toMatchObject({
        sourceFactHash: source.current!.facts[0]!.sourceFactHash,
        canonicalMaterialCategories: [SUMMARY_V2_PRINT_MATERIAL_CATEGORY],
        authorityPhase: 'immutable_source_fact',
      });
    expect(finalized.diagnostics!.materialAuthority!.finalClaimAuthorityEvidence[0])
      .toMatchObject({
        authorizingSourceFactHashes: [source.current!.facts[0]!.sourceFactHash],
        authorityMatchPassed: true,
      });
    const diagnostics = {
      ...finalized.diagnostics,
      materialAuthority: {
        ...finalized.diagnostics!.materialAuthority!,
        // Simulate a serialization defect that drops the exact authorizing fact
        // while legacy aggregate booleans still claim success.
        sourceAuthorityEvidence: [],
      },
    };
    const withoutProof = { ...finalized, diagnostics };
    const invariantInput = {
      ...diagnostics,
      summaryV2FactIdPathActive: true,
      finalPrintClaimDetected: true,
      sourcePrintFactPresent: true,
      finalUnsupportedDesignMediumCount: 0,
      groundingValidationPassed: true,
    } as Parameters<typeof checkSummaryDiagnosticInvariants>[0];
    const invariant = checkSummaryDiagnosticInvariants(invariantInput);
    expect(invariant.failures.map((failure) => failure.invariantCode))
      .toContain('material_authority_provenance_invariant_failed');

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'en', requestedLocale: 'en', contentLocale: 'en',
      templateId: 'modern-minimal', gender: 'female', requestId: 'aab421-missing-proof',
      usageCountBefore: 8, operationMode: 'generate_from_context',
    });
    session.recordCvSnapshot(cv, '');
    session.recordFinalizeResult(withoutProof);
    const gate = session.evaluatePreApplyDecisionGates();
    expect(gate.diagnosticInvariantCheckPassed).toBe(false);
    expect(gate.passed).toBe(false);
    session.recordVisibleApply(false, 8);
    const trace = session.commit();
    expect(trace.visibleApplySucceeded).toBe(false);
    expect(trace.countedAsSuccess).toBe(false);
    expect(trace.usageCountAfter).toBe(8);
  });

  it('11. rejects contradictory source fact-to-entry ownership as an invariant failure', () => {
    const source = manifest({ currentDuty: PRINT.en });
    source.current!.facts[0]!.entryId = 'wrong-owning-entry';
    const { audit } = auditDeterministic(source);
    expect(audit.invariantPassed).toBe(false);
    expect(audit.invariantFailureReasons).toContain('source_fact_entry_ownership_mismatch');
    expect(audit.finalClaimAuthorityEvidence[0]).toMatchObject({
      authorityMatchPassed: false,
      unsupportedReason: 'owner_matching_source_authority_missing',
    });
  });

  it('12. rejects final-unit owner and authorizing-entry owner mismatch', () => {
    const source = manifest({ priorDuty: PRINT.en });
    const finalText = `${ROLE.en} — ${source.current!.employer} — ${PRINT.en}`;
    const audit = auditSummaryV2MaterialClaims(finalText, source);
    expect(audit.sourcePrintFactPresent).toBe(true);
    expect(audit.finalClaimAuthorityEvidence[0]).toMatchObject({
      finalUnitRoleSlot: 'current_role',
      authorityMatchPassed: false,
      authorizingSourceEntryHash: null,
      unsupportedReason: 'owner_matching_source_authority_missing',
    });
  });

  it('13. authorizes two legitimate print units only from each unit owning entry', () => {
    const source = manifest({ currentDuty: PRINT.en, priorDuty: PRINT.en });
    const { ownership, audit } = auditDeterministic(source);
    expect(ownership.passed).toBe(true);
    expect(audit.finalClaimAuthorityEvidence).toHaveLength(2);
    expect(audit.finalClaimAuthorityEvidence.every((claim) => claim.authorityMatchPassed))
      .toBe(true);
    expect(audit.finalClaimAuthorityEvidence.map((claim) => claim.authorizingSourceEntryHash))
      .toEqual(audit.finalClaimAuthorityEvidence.map((claim) => claim.finalUnitOwningEntryHash));
    expect(new Set(audit.finalClaimAuthorityEvidence.map(
      (claim) => claim.authorizingSourceEntryHash,
    )).size).toBe(2);
  });

  it('14. duplicate semantic print facts in different jobs never cross-credit', () => {
    const source = manifest({ currentDuty: PRINT.en, priorDuty: PRINT.en });
    source.current!.facts[0]!.sourcePrintFactPresent = false;
    source.current!.facts[0]!.sourceMaterialClaimCategories = [];
    const { audit } = auditDeterministic(source);
    const current = audit.finalClaimAuthorityEvidence.find(
      (claim) => claim.finalUnitRoleSlot === 'current_role',
    )!;
    const prior = audit.finalClaimAuthorityEvidence.find(
      (claim) => claim.finalUnitRoleSlot === 'prior_role',
    )!;
    expect(current.authorityMatchPassed).toBe(false);
    expect(current.authorizingSourceFactHashes).toEqual([]);
    expect(prior.authorityMatchPassed).toBe(true);
    expect(prior.authorizingSourceFactHashes)
      .toEqual([source.priors[0]!.facts[0]!.sourceFactHash]);
    expect(source.current!.facts[0]!.sourceFactHash)
      .not.toBe(source.priors[0]!.facts[0]!.sourceFactHash);
  });

  it('15. retains positive/negative design_medium_print behavior in all 12 locales (24/24)', () => {
    let positive = 0;
    let negative = 0;
    for (const locale of LOCALES) {
      const withAuthority = manifest({ currentDuty: PRINT[locale], locale });
      const positiveText = `${ROLE[locale]} — ${withAuthority.current!.employer} — ${PRINT[locale]}`;
      const positiveAudit = auditSummaryV2MaterialClaims(positiveText, withAuthority);
      expect(positiveAudit.finalClaimAuthorityEvidence[0], `${locale}/positive`).toMatchObject({
        canonicalCategory: SUMMARY_V2_PRINT_MATERIAL_CATEGORY,
        authorityMatchPassed: true,
        detectedTargetLocale: locale,
      });
      expect(positiveAudit.invariantPassed, `${locale}/positive/invariant`).toBe(true);
      positive += 1;

      const withoutAuthority = manifest({ currentDuty: ORDINARY[locale], locale });
      const negativeText = `${ROLE[locale]} — ${withoutAuthority.current!.employer} — ${PRINT[locale]}`;
      const negativeAudit = auditSummaryV2MaterialClaims(negativeText, withoutAuthority);
      expect(negativeAudit.finalClaimAuthorityEvidence[0], `${locale}/negative`).toMatchObject({
        canonicalCategory: SUMMARY_V2_PRINT_MATERIAL_CATEGORY,
        authorityMatchPassed: false,
        unsupportedReason: 'owner_matching_source_authority_missing',
      });
      negative += 1;
    }
    expect({ positive, negative }).toEqual({ positive: 12, negative: 12 });
  });

  it('16. serializes no raw CV content and fingerprints content beyond stable entry ID', () => {
    const first = manifest({ currentDuty: PRINT.en });
    const second = manifest({ currentDuty: `${PRINT.en} I also review archive proofs.` });
    const firstAudit = auditDeterministic(first).audit;
    const secondAudit = auditDeterministic(second).audit;
    const firstIdentity = firstAudit.selectedEntrySourceContentFingerprints[0]!;
    const secondIdentity = secondAudit.selectedEntrySourceContentFingerprints[0]!;
    expect(firstIdentity.entryIdHash).toBe(secondIdentity.entryIdHash);
    expect(firstIdentity.sourceContentFingerprint)
      .not.toBe(secondIdentity.sourceContentFingerprint);
    const json = JSON.stringify(firstAudit);
    for (const raw of [
      first.current!.entryId,
      first.current!.role,
      first.current!.employer,
      first.current!.facts[0]!.bulletText,
    ]) expect(json).not.toContain(raw);
    expect(validateSummaryV2MaterialAuthorityProvenance(
      JSON.parse(json) as SummaryV2MaterialAuthorityResult,
    ).passed).toBe(true);
  });
});
