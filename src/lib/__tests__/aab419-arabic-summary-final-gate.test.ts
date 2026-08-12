/**
 * AAB 419 real-device-equivalent Arabic Summary final source gate.
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  auditSummaryV2PrintClaims,
  buildSummaryV2DeterministicText,
  buildSummaryV2ManifestForCv,
  classifySummaryV2EntrySurfaceAuthority,
  clearSummaryV2LocalizationCacheForTests,
  detectPrintMediumClaim,
  evaluateNativeRealizationContract,
  hashSummaryV2Text,
  localizeSummaryV2Manifest,
  projectLocalizedSummaryV2Manifest,
  realizeFirstPersonDutyClause,
  resolveSummaryCurrentRoleWithEvidence,
  setSummaryV2EnabledForTests,
  validateSummaryV2AgainstManifest,
  type SummaryV2LocalizationTransportInput,
  type SummaryV2SelectionManifest,
} from '@/lib/cv-summary-v2';
import {
  applyFinalizedSummaryToCv,
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { checkSummaryDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import {
  SummaryAiDiagnosticSession,
  clearSummaryAiDiagnosticsForTests,
} from '@/lib/cv-summary-ai-diagnostics';

const REF = '2026-08-11';

function work(options: Partial<WorkExperience> & Pick<WorkExperience, 'id' | 'position' | 'company' | 'startDate' | 'description'>): WorkExperience {
  return {
    endDate: '', isPresent: false, originalUserDescription: options.description,
    descriptionOrigin: 'user', ...options,
  } as WorkExperience;
}

function deviceCv(): CVData {
  const experience = [
    work({ id: '90ceb-current-2026-03', position: 'Grafički dizajner', company: 'Rewitu Current Test', startDate: '2026-03', isPresent: true, generatedLocale: 'ar', positionSourceLocale: 'sr', description: 'تُعِدُّ المفاهيم البصرية والتخطيطات للمواد الرقمية.\nتُحرِّر الرسومات والصور لمختلف المشاريع.\nتُنسِّق المسودات والتعديلات مع أعضاء فريق المشروع.' }),
    work({ id: '8da-current-2026-01', position: 'مشرفة أرشيف', company: 'Archive Co', startDate: '2026-01', isPresent: true, generatedLocale: 'ar', positionSourceLocale: 'ar', description: 'تراجع السجلات.' }),
    work({ id: 'b9d3-current-2023-01', position: 'مشرفة ملفات', company: 'File Co', startDate: '2023-01', isPresent: true, generatedLocale: 'ar', positionSourceLocale: 'ar', description: 'تنظم الملفات.' }),
    work({ id: 'be5c-hi-completed', position: 'ग्राफिक डिज़ाइनर', company: 'TestWerk GmbH', startDate: '2024-01', endDate: '2026-02', generatedLocale: 'hi', positionSourceLocale: 'hi', description: 'ग्राहकों की आवश्यकताओं के अनुसार दृश्य अवधारणाएँ तैयार कीं।\nडिज़ाइन परियोजनाओं की समीक्षा की।\nडिजिटल सामग्री तैयार की।' }),
    work({ id: 'a221-ar-completed', position: 'Grafički dizajner', company: 'Rewitu', startDate: '2019-06', endDate: '2023-12', generatedLocale: 'ar', positionSourceLocale: 'sr', description: 'أعدّتْ المفاهيم البصرية والتخطيطات للمواد الرقمية.\nحرّرتْ الرسومات والصور لمختلف المشاريع.\nنسّقتْ المسودات والتعديلات مع أعضاء فريق المشروع.' }),
  ];
  return {
    id: 'aab419-device', name: 'AAB419', personal: { fullName: 'مستخدمة', email: '', phone: '', address: '', jobTitle: '', gender: 'female' },
    summary: '', experience, education: [], skills: [], languages: [], certifications: [], projects: [],
    templateId: 'modern-minimal', contentLocale: 'ar', region: 'RS', createdAt: REF, updatedAt: REF,
  } as unknown as CVData;
}

function manifest(cv = deviceCv()): SummaryV2SelectionManifest {
  return buildSummaryV2ManifestForCv({ cv, locale: 'ar', gender: 'female', referenceDateIso: REF });
}

function localizedText(entryId: string, factIndex: number, withUnsupportedPrint = false): string {
  if (entryId.startsWith('90ceb')) return ['أُعِدُّ المفاهيم البصرية والتخطيطات للمواد الرقمية.', 'أُحرِّر الرسومات والصور لمختلف المشاريع.', 'أُنسِّق المسودات والتعديلات مع أعضاء فريق المشروع.'][factIndex]!;
  if (entryId.startsWith('be5c')) return withUnsupportedPrint
    ? ['أعد المواد الجرافيكية لمختلف الوسائط المطبوعة والرقمية.', 'أراجع مشاريع التصميم لضمان جودة المخرجات النهائية.', 'أطور مفاهيم التصميم وفق متطلبات العملاء.'][factIndex]!
    : ['أعددت المواد الجرافيكية لمختلف الوسائط الرقمية.', 'راجعت مشاريع التصميم لضمان جودة المخرجات النهائية.', 'طورت مفاهيم التصميم وفق متطلبات العملاء.'][factIndex]!;
  return ['أعددت المفاهيم البصرية والتخطيطات للمواد الرقمية.', 'حررت الرسومات والصور لمختلف المشاريع.', 'نسقت المسودات والتعديلات مع أعضاء فريق المشروع.'][factIndex]!;
}

async function localizeDevice(withUnsupportedPrint = false) {
  return localizeSummaryV2Manifest({
    manifest: manifest(),
    transport: async (input: SummaryV2LocalizationTransportInput) => ({
      targetLocale: 'ar',
      entries: input.entries.map((entry) => ({
        entryId: entry.entryId,
        localizedRoleTitle: entry.entryId.startsWith('90ceb') || entry.entryId.startsWith('a221')
          ? 'مصممة جرافيك'
          : 'مصممة جرافيك',
        facts: entry.facts.map((fact, index) => ({ factId: fact.factId, localizedText: localizedText(entry.entryId, index, withUnsupportedPrint) })),
      })),
    }),
  });
}

describe('AAB 419 Arabic Summary final source gate', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    clearSummaryV2LocalizationCacheForTests();
    clearSummaryAiDiagnosticsForTests();
  });

  it('classifies Serbian title as linguistic while Arabic duties stay target-native', () => {
    const m = manifest(); const entry = m.current!;
    const a = classifySummaryV2EntrySurfaceAuthority({ manifest: m, entry });
    expect(a.roleTitleTargetNative).toBe(false);
    expect(a.localizationRequiredFactIds).toEqual([]);
  });

  it('localizes only a foreign same-locale title and preserves employer/duties', async () => {
    const calls: SummaryV2LocalizationTransportInput[] = [];
    const out = await localizeSummaryV2Manifest({ manifest: manifest(), transport: async (input) => {
      calls.push(input); return { targetLocale: 'ar', entries: input.entries.map((entry) => ({ entryId: entry.entryId, localizedRoleTitle: 'مصممة جرافيك', facts: entry.facts.map((fact, i) => ({ factId: fact.factId, localizedText: localizedText(entry.entryId, i) })) })) };
    }});
    const currentCall = calls.find((call) => call.entries[0]?.entryId.startsWith('90ceb'))!.entries[0]!;
    expect(currentCall.translateRoleTitle).toBe(true); expect(currentCall.facts).toHaveLength(0);
    const current = out.manifest!.entries.find((entry) => entry.entryId.startsWith('90ceb'))!;
    expect(current.employer).toBe('Rewitu Current Test');
    expect(current.facts[0]!.localizedText).toContain('تُعِدُّ');
    expect(current.localizedRoleTitleLocalizationSource).toBe('provider');
  });

  it('fully bypasses Arabic title/duties while preserving a Latin employer', async () => {
    const m = manifest(); const scoped = { ...m, current: { ...m.current!, role: 'مصممة جرافيك' }, priors: [], requiredPriorFacts: [] };
    let calls = 0; const out = await localizeSummaryV2Manifest({ manifest: scoped, transport: async () => { calls += 1; throw new Error('not called'); } });
    expect(calls).toBe(0); expect(out.sameLocaleBypassCount).toBe(1); expect(out.manifest!.entries[0]!.employer).toBe('Rewitu Current Test');
  });

  it.each(['Graphic Designer', 'Grafikdesigner', 'Grafički dizajner', 'ग्राफिक डिज़ाइनर'])(
    'requires field localization for arbitrary foreign title %s', (role) => {
      const m = manifest(); const entry = { ...m.current!, role };
      expect(classifySummaryV2EntrySurfaceAuthority({ manifest: { ...m, current: entry }, entry }).roleTitleTargetNative).toBe(false);
    },
  );

  it('realizes arbitrary current Arabic duties in first person', () => {
    expect(realizeFirstPersonDutyClause('تُنسِّق الملفات مع الفريق', 'ar', 'present')).toMatch(/^أ/u);
  });

  it('realizes completed Arabic auxiliary clauses in first person', () => {
    expect(realizeFirstPersonDutyClause('كانت تُراجع الملفات', 'ar', 'completed')).toBe('كنت أُراجع الملفات');
  });

  it('expands only terminal gemination in completed first-person morphology', () => {
    expect(realizeFirstPersonDutyClause('أعدّتْ المواد', 'ar', 'completed')).toBe('أعددت المواد');
    expect(realizeFirstPersonDutyClause('حرّرتْ الصور', 'ar', 'completed')).toBe('حررت الصور');
  });

  it('rejects mixed first/third Arabic perspective', () => {
    const q = evaluateNativeRealizationContract({ text: 'أعمل حالياً كمصممة، تُراجع الملفات وتنسق العمل.', locale: 'ar' });
    expect(q.firstPersonPredicateChainPassed).toBe(false);
  });

  it.each(['أعدّتْت المواد.', 'حرّرتْت الصور.', 'نسّقتْت العمل.'])(
    'rejects duplicated past suffix with diacritics: %s', (text) => {
      expect(evaluateNativeRealizationContract({ text: `عملت سابقاً، ${text}`, locale: 'ar' }).localeVerbMorphologyPassed).toBe(false);
    },
  );

  it('detects normalized Arabic printed-media variants', () => {
    expect(detectPrintMediumClaim('الوسائط المطبوعة والرقمية')).toBe(true);
    expect(detectPrintMediumClaim('مواد للطباعة')).toBe(true);
  });

  it('rejects an Arabic print claim when the owning source fact lacks it', () => {
    const m = manifest(); const text = 'سابقاً عملت كمصممة في TestWerk GmbH، حيث أعددت الوسائط المطبوعة.';
    expect(auditSummaryV2PrintClaims(text, m).unsupportedPrintClaimCount).toBe(1);
  });

  it('accepts an Arabic print claim when the owning source fact has it', () => {
    const m = manifest(); const owner = m.priors.find((entry) => entry.entryId.startsWith('be5c'))!;
    owner.facts[0]!.sourcePrintFactPresent = true;
    expect(auditSummaryV2PrintClaims('عملت في TestWerk GmbH، حيث أعددت الوسائط المطبوعة.', m).unsupportedPrintClaimCount).toBe(0);
  });

  it('does not borrow print authority from another Experience entry', () => {
    const m = manifest(); m.current!.facts[0]!.sourcePrintFactPresent = true;
    expect(auditSummaryV2PrintClaims('عملت في TestWerk GmbH، حيث أعددت الوسائط المطبوعة.', m).unsupportedPrintClaimCount).toBe(1);
  });

  it('actual projected foreign role title fails even when whole sentence is Arabic', () => {
    const m = manifest(); const text = buildSummaryV2DeterministicText(m);
    const q = validateSummaryV2AgainstManifest(text, m);
    expect(q.roleTitleSurfaceValidationPassed).toBe(false); expect(q.reason).toBe('foreign_role_title_surface');
  });

  it('Latin employer remains allowed after role localization', async () => {
    const out = await localizeDevice(); const current = out.manifest!.entries[0]!;
    expect(current.employer).toBe('Rewitu Current Test');
  });

  it('AAB 419 device fallback with invented Arabic print is blocked before apply', async () => {
    const cv = deviceCv(); const loc = await localizeDevice(true);
    const fin = finalizeCvAiFieldForApply({ action: 'summary_generate', field: 'summary', requestedLocale: 'ar', gender: 'female', cv, candidate: 'نص غير مكتمل.', referenceDateIso: REF, durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], REF), localizedSummaryManifest: loc.manifest });
    expect(fin.blocked).toBe(true); expect(fin.countedAsSuccess).toBe(false); expect(fin.reason).toBe('unsupported_print_medium_claim');
    expect(applyFinalizedSummaryToCv(cv, 'ar', fin).summary).toBe('');
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'ar', requestedLocale: 'ar', contentLocale: 'ar',
      templateId: 'modern-minimal', gender: 'female', requestId: 'aab419-invalid-print',
      usageCountBefore: 7, operationMode: 'generate_from_context',
    });
    session.recordCvSnapshot(cv, ''); session.recordFinalizeResult(fin);
    session.recordVisibleApply(false, 7);
    expect(session.commit()).toMatchObject({ visibleApplySucceeded: false, countedAsSuccess: false, usageCountAfter: 7 });
  });

  it('corrected device fallback passes role, perspective, morphology and grounding gates', async () => {
    const cv = deviceCv(); const loc = await localizeDevice(false);
    const source = manifest(cv);
    const projected = projectLocalizedSummaryV2Manifest({
      manifest: source,
      localized: loc.manifest!,
    })!;
    const deterministic = buildSummaryV2DeterministicText(projected);
    const providerMissingCurrentIntro = deterministic.replace(
      /أعمل حالياً[^.]+?، حيث/u,
      'أؤدي مهاماً، حيث',
    );
    expect(validateSummaryV2AgainstManifest(providerMissingCurrentIntro, projected).reason)
      .toBe('missing_current_role_intro');
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const fin = finalizeCvAiFieldForApply({ action: 'summary_generate', field: 'summary', requestedLocale: 'ar', gender: 'female', cv, candidate: providerMissingCurrentIntro, referenceDateIso: REF, durationSnapshot: duration, localizedSummaryManifest: loc.manifest });
    expect(fin.blocked, fin.reason).toBe(false); expect(fin.origin).toBe('deterministic_fallback');
    expect(fin.diagnostics).toMatchObject({
      providerRejectionReason: 'missing_current_role_intro',
      finalCandidateSource: 'deterministic_fallback',
      perspectiveValidationPassed: true,
      grammarValidationPassed: true,
      finalStructuredRoleLocaleValidationPassed: true,
      currentRoleTitleSource: 'provider',
      requiredCurrentDutyFactCount: 3,
      coveredCurrentDutyFactCount: 3,
      requiredPriorDutyFactCount: 6,
      coveredPriorDutyFactCount: 6,
      durationSemanticValueMonths: 86,
      finalRenderedDurationSemanticMonths: 84,
      finalDurationScopeValidationPassed: true,
      durationFinalizerIdempotent: true,
      finalPrintClaimDetected: false,
      sourcePrintFactPresent: false,
    });
    expect(fin.diagnostics?.groundingInputCandidateHash)
      .toBe(fin.diagnostics?.finalValidatedCandidateHash);

    const applied = applyFinalizedSummaryToCv(cv, 'ar', fin);
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'ar', requestedLocale: 'ar', contentLocale: 'ar',
      templateId: 'modern-minimal', gender: 'female', requestId: 'aab419-corrected-device',
      usageCountBefore: 7, operationMode: 'generate_from_context',
    });
    session.recordCvSnapshot(cv, '');
    session.recordFinalizeResult(fin);
    session.recordVisibleApply(true, 8, applied.summary || '');
    const trace = session.commit();
    expect(trace.usageCountAfter).toBe(8);
    expect(trace.finalValidatedCandidateHash).toBe(trace.visibleCandidateHashAfterApply);
    expect(trace.visibleSummaryMatchesFinalHash).toBe(true);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.privacyCheckPassed).toBe(true);
    expect(trace.diagnosticPrivacyViolations).toEqual([]);
  });

  it('equality invariant rejects null hashes compared as true', () => {
    const q = checkSummaryDiagnosticInvariants({ deterministicCandidateEqualsGroundingInput: true, deterministicCandidateHash: null, groundingInputCandidateHash: null });
    expect(q.failures.some((f) => f.invariantCode === 'candidate_equality_true_without_both_hashes')).toBe(true);
  });

  it('role provenance invariant rejects true status with null ownership', () => {
    const q = checkSummaryDiagnosticInvariants({ currentRoleTitlePresent: true, currentRoleTitleMatchesStructuredRole: true, currentRoleTitleSource: null, currentRoleTitleEntryIdHash: null });
    expect(q.failures.some((f) => f.invariantCode === 'current_role_true_without_source_bound_provenance')).toBe(true);
  });

  it('matched-unit invariant rejects whole-candidate hashes', () => {
    const q = checkSummaryDiagnosticInvariants({ finalUnitHashes: ['unit-a'], visibleCurrentDutyFactMatchedUnitHashesByFactHash: { v2_entry_fact: ['candidate-hash'] } });
    expect(q.failures.some((f) => f.invariantCode === 'matched_fact_hash_not_final_owning_unit_hash')).toBe(true);
  });

  it('ownership invariant rejects a current fact credited from a prior unit', () => {
    const q = checkSummaryDiagnosticInvariants({
      countedAsSuccess: true,
      unitOwnershipValidationPassed: true,
      factUnitOwnershipValidationPassed: true,
      finalUnitHashes: ['current-unit', 'prior-unit'],
      finalUnitOwnershipEvidence: [
        { unitHash: 'current-unit', roleSlot: 'current_role', owningEntryHash: 'current-owner' },
        { unitHash: 'prior-unit', roleSlot: 'prior_role', owningEntryHash: 'prior-owner' },
      ],
      factUnitOwnershipEvidence: [{
        factHash: 'current-fact',
        owningEntryHash: 'current-owner',
        semanticRole: 'current_fact',
        matchedUnitHashes: ['prior-unit'],
        matchedUnitOwnerHashes: ['prior-owner'],
        matchedUnitRoleSlots: ['prior_role'],
        ownershipPassed: true,
        covered: true,
      }],
    });
    expect(q.failures.some((failure) => (
      failure.invariantCode === 'summary_v2_fact_cross_entry_unit_ownership_violation'
    ))).toBe(true);
  });

  it('preserves AAB 419 current-role ranking evidence', () => {
    const r = resolveSummaryCurrentRoleWithEvidence(deviceCv().experience || []);
    expect(r.candidates.slice(0, 3).map((e) => e.comparisonKey)).toEqual([24315, 24313, 24277]);
  });

  it('preserves 86 structured months and one approximate seven-year claim', async () => {
    const cv = deviceCv(); const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    expect(duration.total.totalMonths).toBe(86);
    await localizeDevice(false);
    expect(manifest(cv).totalDurationMonths).toBe(86);
  });

  it('privacy-safe role evidence contains hashes but no raw title or entry id', async () => {
    const cv = deviceCv(); const loc = await localizeDevice(false);
    const fin = finalizeCvAiFieldForApply({ action: 'summary_generate', field: 'summary', requestedLocale: 'ar', gender: 'female', cv, candidate: '', referenceDateIso: REF, durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], REF), localizedSummaryManifest: loc.manifest });
    const serialized = JSON.stringify(fin.diagnostics?.roleTitleSurfaceEvidence || []);
    expect(serialized).not.toContain('Grafički'); expect(serialized).not.toContain('90ceb');
    expect(serialized).toContain(hashSummaryV2Text('90ceb-current-2026-03'));
  });

  it('successful hashes and fact-unit hashes are materialized consistently', async () => {
    const cv = deviceCv(); const loc = await localizeDevice(false);
    const fin = finalizeCvAiFieldForApply({ action: 'summary_generate', field: 'summary', requestedLocale: 'ar', gender: 'female', cv, candidate: '', referenceDateIso: REF, durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], REF), localizedSummaryManifest: loc.manifest });
    expect(fin.diagnostics?.groundingInputCandidateHash).toBe(fin.diagnostics?.finalValidatedCandidateHash);
    const allowed = new Set(fin.diagnostics?.finalUnitHashes || []);
    for (const hashes of Object.values(fin.diagnostics?.visibleCurrentDutyFactMatchedUnitHashesByFactHash || {})) hashes.forEach((hash) => expect(allowed.has(hash)).toBe(true));
    expect(fin.diagnostics?.currentRoleTitleEntryIdHash).toBe(fingerprintText('90ceb-current-2026-03'));
    expect(fin.diagnostics?.unitOwnershipValidationPassed).toBe(true);
    expect(fin.diagnostics?.factUnitOwnershipValidationPassed).toBe(true);
    expect(fin.diagnostics?.finalUnitOwnershipEvidence).toEqual([
      { unitHash: 'fnv1a_21466e9e_l39_b1571_e46', roleSlot: 'duration', owningEntryHash: null, priorOrdinal: null },
      { unitHash: 'fnv1a_8c67ecc7_l198_b1571_e46', roleSlot: 'current_role', owningEntryHash: 'fnv1a_f022e8eb_l21_b57_e51', priorOrdinal: null },
      { unitHash: 'fnv1a_45f8bee0_l188_b1587_e46', roleSlot: 'prior_role', owningEntryHash: 'fnv1a_21d36980_l17_b98_e100', priorOrdinal: 1 },
      { unitHash: 'fnv1a_a656bff3_l177_b1587_e46', roleSlot: 'prior_role', owningEntryHash: 'fnv1a_8c401dbd_l17_b97_e100', priorOrdinal: 2 },
    ]);
    expect(fin.diagnostics?.factUnitOwnershipEvidence).toEqual([
      { factHash: 'fnv1a_43e17a32_l39_b118_e49', owningEntryHash: 'fnv1a_f022e8eb_l21_b57_e51', semanticRole: 'current_fact', matchedUnitHashes: ['fnv1a_8c67ecc7_l198_b1571_e46'], matchedUnitOwnerHashes: ['fnv1a_f022e8eb_l21_b57_e51'], matchedUnitRoleSlots: ['current_role'], ownershipPassed: true, covered: true },
      { factHash: 'fnv1a_ee7180bc_l39_b118_e53', owningEntryHash: 'fnv1a_f022e8eb_l21_b57_e51', semanticRole: 'current_fact', matchedUnitHashes: ['fnv1a_8c67ecc7_l198_b1571_e46'], matchedUnitOwnerHashes: ['fnv1a_f022e8eb_l21_b57_e51'], matchedUnitRoleSlots: ['current_role'], ownershipPassed: true, covered: true },
      { factHash: 'fnv1a_8f0bb1cc_l39_b118_e55', owningEntryHash: 'fnv1a_f022e8eb_l21_b57_e51', semanticRole: 'current_fact', matchedUnitHashes: ['fnv1a_8c67ecc7_l198_b1571_e46'], matchedUnitOwnerHashes: ['fnv1a_f022e8eb_l21_b57_e51'], matchedUnitRoleSlots: ['current_role'], ownershipPassed: true, covered: true },
      { factHash: 'fnv1a_44df736_l34_b118_e99', owningEntryHash: 'fnv1a_21d36980_l17_b98_e100', semanticRole: 'prior_fact', matchedUnitHashes: ['fnv1a_45f8bee0_l188_b1587_e46'], matchedUnitOwnerHashes: ['fnv1a_21d36980_l17_b98_e100'], matchedUnitRoleSlots: ['prior_role'], ownershipPassed: true, covered: true },
      { factHash: 'fnv1a_14af85e1_l35_b118_e56', owningEntryHash: 'fnv1a_21d36980_l17_b98_e100', semanticRole: 'prior_fact', matchedUnitHashes: ['fnv1a_45f8bee0_l188_b1587_e46'], matchedUnitOwnerHashes: ['fnv1a_21d36980_l17_b98_e100'], matchedUnitRoleSlots: ['prior_role'], ownershipPassed: true, covered: true },
      { factHash: 'fnv1a_256ff292_l35_b118_e50', owningEntryHash: 'fnv1a_21d36980_l17_b98_e100', semanticRole: 'prior_fact', matchedUnitHashes: ['fnv1a_45f8bee0_l188_b1587_e46'], matchedUnitOwnerHashes: ['fnv1a_21d36980_l17_b98_e100'], matchedUnitRoleSlots: ['prior_role'], ownershipPassed: true, covered: true },
      { factHash: 'fnv1a_5ee6507c_l35_b118_e97', owningEntryHash: 'fnv1a_8c401dbd_l17_b97_e100', semanticRole: 'prior_fact', matchedUnitHashes: ['fnv1a_a656bff3_l177_b1587_e46'], matchedUnitOwnerHashes: ['fnv1a_8c401dbd_l17_b97_e100'], matchedUnitRoleSlots: ['prior_role'], ownershipPassed: true, covered: true },
      { factHash: 'fnv1a_d2b6948f_l35_b118_e54', owningEntryHash: 'fnv1a_8c401dbd_l17_b97_e100', semanticRole: 'prior_fact', matchedUnitHashes: ['fnv1a_a656bff3_l177_b1587_e46'], matchedUnitOwnerHashes: ['fnv1a_8c401dbd_l17_b97_e100'], matchedUnitRoleSlots: ['prior_role'], ownershipPassed: true, covered: true },
      { factHash: 'fnv1a_f2a931ef_l35_b118_e97', owningEntryHash: 'fnv1a_8c401dbd_l17_b97_e100', semanticRole: 'prior_fact', matchedUnitHashes: ['fnv1a_a656bff3_l177_b1587_e46'], matchedUnitOwnerHashes: ['fnv1a_8c401dbd_l17_b97_e100'], matchedUnitRoleSlots: ['prior_role'], ownershipPassed: true, covered: true },
    ]);
    expect(fin.diagnostics?.finalUnitOwnershipEvidence?.[1]?.owningEntryHash)
      .toBe(fin.diagnostics?.currentRoleTitleEntryIdHash);
    const serializedOwnership = JSON.stringify({
      units: fin.diagnostics?.finalUnitOwnershipEvidence,
      facts: fin.diagnostics?.factUnitOwnershipEvidence,
    });
    expect(serializedOwnership).not.toMatch(/90ceb|be5c|a221|Rewitu|TestWerk|Grafi/iu);
  });
});
