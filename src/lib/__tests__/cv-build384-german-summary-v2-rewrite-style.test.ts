/**
 * AAB-384 — Summary V2 rewrite-style contract (Kürzer / Stärker / Professionell).
 * Device-equivalent German three-click matrix through real finalize → apply → usage.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
  normalizeSummaryCandidateText,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import {
  SummaryAiDiagnosticSession,
  resolveAuthoritativeVisibleSummaryText,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  setSummaryV2EnabledForTests,
  SUMMARY_V2_REVISION,
  SUMMARY_V2_REWRITE_STYLE_384_REVISION,
  buildSummaryV2ManifestForCv,
  buildSummaryV2StyledDeterministicText,
  transformSummaryV2ForRewriteStyle,
  evaluateSummaryV2StyleFulfillment,
  runSummaryV2,
  summaryV2StylePairDistinct,
  isSummaryV2Enabled,
} from '@/lib/cv-summary-v2';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';

const REF = '2026-07-01';

const DEVICE_SOURCE =
  'Ich verfüge über insgesamt etwa fünfeinhalb Jahre Berufserfahrung. '
  + 'Derzeit arbeite ich als Fahrradmechaniker bei RadWerk, wo ich '
  + 'Wartungsarbeiten an Fahrrädern durchführe, Fahrräder auf technische Mängel '
  + 'prüfe und defekte Bauteile an Fahrrädern austausche. Zuvor arbeitete ich als '
  + 'Rezeptionist bei StadtHotel, wo ich Gäste herzlich an der Rezeption des '
  + 'Hotels begrüßte, Reservierungen sowie vorgenommene Änderungen erfasste und '
  + 'bearbeitete und Fragen der Gäste kompetent und serviceorientiert beantwortete.';

const CURRENT_RAD = [
  'Führt Wartungsarbeiten an Fahrrädern durch.',
  'Prüft Fahrräder auf technische Mängel.',
  'Tauscht defekte Bauteile an Fahrrädern aus.',
].join('\n');

const PRIOR_HOTEL = [
  'Begrüßte Gäste herzlich an der Rezeption des Hotels.',
  'Erfasste und bearbeitete Reservierungen sowie vorgenommene Änderungen.',
  'Beantwortete Fragen der Gäste kompetent und serviceorientiert.',
].join('\n');

const BAD_PROVIDER =
  'Ich bin Teamleiter mit 99% Erfolg und führe 12 Mitarbeiter bei FakeCorp '
  + 'mit Leadership und kritischem Denken.';

const LOCALES: Locale[] = [
  'en', 'de', 'fr', 'es', 'it', 'pt-BR', 'ru', 'sr', 'hr', 'hi', 'ar', 'ja',
];

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function deviceCv(options?: {
  summary?: string;
  currentRole?: string;
  currentCompany?: string;
  priorRole?: string;
  priorCompany?: string;
  currentDuties?: string;
  priorDuties?: string;
  extraEntries?: CVData['experience'];
  onlyCurrent?: boolean;
}): CVData {
  const experience = [
    {
      id: 'radwerk',
      position: options?.currentRole || 'Fahrradmechaniker',
      company: options?.currentCompany || 'RadWerk',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: options?.currentDuties || CURRENT_RAD,
      canonicalDescription: options?.currentDuties || CURRENT_RAD,
    },
    ...(options?.onlyCurrent
      ? []
      : [{
        id: 'stadthotel',
        position: options?.priorRole || 'Rezeptionist',
        company: options?.priorCompany || 'StadtHotel',
        startDate: '2021-01',
        endDate: '2023-12',
        isPresent: false,
        description: options?.priorDuties || PRIOR_HOTEL,
        canonicalDescription: options?.priorDuties || PRIOR_HOTEL,
      }]),
    ...(options?.extraEntries || []),
  ];
  return {
    id: 'aab-384-device',
    name: 'DE V2 Rewrite Style',
    personal: {
      fullName: 'Max Mustermann',
      email: 'm@example.com',
      phone: '',
      address: '',
      jobTitle: options?.currentRole || 'Fahrradmechaniker',
      gender: 'male',
    },
    summary: options?.summary ?? DEVICE_SOURCE,
    experience,
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    templateId: 'modern',
    contentLocale: 'de',
  } as CVData;
}

function hashNorm(text: string): string {
  return fingerprintText(normalizeSummaryCandidateText(text) || 'empty');
}

function runStyleClick(style: 'shorter' | 'stronger' | 'professional', usageBefore: number) {
  const cv = deviceCv({ summary: DEVICE_SOURCE });
  const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
  expect(duration.total.totalMonths).toBe(66);
  seedUsage(usageBefore);
  const fin = finalizeCvAiFieldForApply({
    action: `summary_${style}`,
    field: 'summary',
    requestedLocale: 'de',
    gender: 'male',
    cv,
    candidate: BAD_PROVIDER,
    referenceDateIso: REF,
    durationSnapshot: duration,
    rewriteStyle: style,
  });
  expect(fin.blocked).toBe(false);
  expect(fin.countedAsSuccess).toBe(true);
  expect(fin.diagnostics?.rewriteStyle).toBe(style);
  expect(fin.diagnostics?.requestedRewriteStyle ?? fin.diagnostics?.rewriteStyle).toBeTruthy();
  expect(fin.diagnostics?.rewriteStylePropagatedToProvider).toBe(true);
  expect(fin.diagnostics?.rewriteStylePropagatedToDeterministic).toBe(true);
  expect(fin.diagnostics?.candidateTransformationKind).toBe(`v2_rewrite_${style}`);
  expect(fin.diagnostics?.candidateTransformationBeforeHash).toBeTruthy();
  expect(fin.diagnostics?.candidateTransformationAfterHash).toBeTruthy();
  expect(fin.diagnostics?.candidateTransformationBeforeHash)
    .not.toBe(fin.diagnostics?.candidateTransformationAfterHash);
  expect(fin.diagnostics?.styleValidationPassed).toBe(true);
  expect(fin.diagnostics?.selectedCandidateMateriallyDiffersFromSource).toBe(true);
  expect(fin.diagnostics?.noOpDetected).toBe(false);
  expect(fin.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
  expect(fin.diagnostics?.coveredPriorDutyFactCount).toBe(3);
  expect(fin.diagnostics?.durationInsertedExactlyOnce).toBe(true);
  expect(fin.diagnostics?.germanControlledCaseGrammarPassed !== false).toBe(true);
  expect(String(fin.diagnostics?.providerRejectionReason || '')).not.toBe(
    'summary_v2_provider_rejected_or_repaired',
  );

  if (style === 'shorter') {
    expect(fin.diagnostics?.shorterStyleFulfilled).toBe(true);
    expect((fin.text || '').length).toBeLessThan(DEVICE_SOURCE.length);
    expect((fin.diagnostics?.lengthDeltaPercent ?? 0)).toBeLessThanOrEqual(-8);
  }
  if (style === 'stronger') {
    expect(fin.diagnostics?.strongerStyleFulfilled).toBe(true);
    expect(fin.text).toMatch(/zielgerichtet|übernahm|zuverlässig/iu);
  }
  if (style === 'professional') {
    expect(fin.diagnostics?.professionalStyleFulfilled).toBe(true);
    expect(fin.text).toMatch(/\btätig\b/iu);
  }

  const cvRef = { current: { ...cv } };
  const written = applyFinalizedSummaryToCv(cvRef.current, 'de', fin);
  cvRef.current = written;
  const visibleText = resolveAuthoritativeVisibleSummaryText({
    operationOwnedSummary: cvRef.current.summary,
    staleReactSummary: '',
  });
  expect(visibleText).toBe(fin.text);
  expect(hashNorm(visibleText)).toBe(hashNorm(fin.text || ''));

  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'de',
    requestedLocale: 'de',
    contentLocale: 'de',
    templateId: 'modern',
    gender: 'male',
    requestId: `aab-384-${style}`,
    usageCountBefore: usageBefore,
    operationMode: 'enhance_existing_content',
  });
  session.recordFinalizeResult(fin);
  expect(session.evaluatePreApplyDecisionGates().passed).toBe(true);
  session.recordVisibleApply(true, usageBefore, visibleText);
  expect(session.draft.raceGuardResult).toBe('ok');
  recordProAiUserActionSuccess();
  session.patch({ usageCountAfter: usageBefore + 1 });
  const trace = session.commit();
  expect(trace.visibleApplySucceeded).toBe(true);
  expect(trace.usageCountAfter).toBe(usageBefore + 1);
  expect(getProAiUsageCount()).toBe(usageBefore + 1);

  return { fin, text: fin.text || '', hash: hashNorm(fin.text || '') };
}

describe('AAB-384 German Summary V2 rewrite-style contract', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    seedUsage(40);
  });
  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('exports 384 rewrite-style marker and keeps V2 production default off', () => {
    expect(SUMMARY_V2_REWRITE_STYLE_384_REVISION).toBe('summary-v2-rewrite-style-384-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_V2_REWRITE_STYLE_384_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_V2_REVISION);
    setSummaryV2EnabledForTests(false);
    expect(isSummaryV2Enabled()).toBe(false);
    setSummaryV2EnabledForTests(null);
    // null restores env: V2-ON matrix sets NEXT_PUBLIC_ENABLE_SUMMARY_V2=true.
    expect(isSummaryV2Enabled()).toBe(
      process.env.NEXT_PUBLIC_ENABLE_SUMMARY_V2 === 'true',
    );
    setSummaryV2EnabledForTests(true);
  });

  it('exact three-style device matrix from immutable AAB-383 source', () => {
    expect(DEVICE_SOURCE.length).toBe(506);
    const shorter = runStyleClick('shorter', 40);
    const stronger = runStyleClick('stronger', 41);
    const professional = runStyleClick('professional', 42);

    expect(shorter.hash).not.toBe(stronger.hash);
    expect(shorter.hash).not.toBe(professional.hash);
    expect(stronger.hash).not.toBe(professional.hash);
    expect(shorter.hash).not.toBe(hashNorm(DEVICE_SOURCE));
    expect(stronger.hash).not.toBe(hashNorm(DEVICE_SOURCE));
    expect(professional.hash).not.toBe(hashNorm(DEVICE_SOURCE));

    expect(shorter.text).not.toMatch(/Teamleiter|99%|FakeCorp|Leadership/iu);
    expect(stronger.text).not.toMatch(/Teamleiter|99%|FakeCorp|Leadership/iu);
    expect(professional.text).not.toMatch(/Teamleiter|99%|FakeCorp|Leadership/iu);

    // Stronger must not collapse into professional.
    expect(stronger.text).not.toMatch(/\btätig\b/iu);
    expect(professional.text).not.toMatch(/zielgerichtet|übernahm ich zuverlässig/iu);
  });

  it('provider acceptance + precise rejection + style repair lineage', () => {
    const cv = deviceCv();
    const manifest = buildSummaryV2ManifestForCv({
      cv,
      locale: 'de',
      gender: 'male',
      referenceDateIso: REF,
    });
    const goodStronger = buildSummaryV2StyledDeterministicText(manifest, 'stronger');
    const accepted = runSummaryV2({
      cv,
      locale: 'de',
      gender: 'male',
      referenceDateIso: REF,
      rewriteStyle: 'stronger',
      candidate: goodStronger,
    });
    expect(accepted.blocked).toBe(false);
    expect(accepted.origin).toBe('ai_generated');
    expect(accepted.pipelineDiagnostics?.providerRejectionReason).toBeNull();

    const near = DEVICE_SOURCE;
    const repaired = runSummaryV2({
      cv,
      locale: 'de',
      gender: 'male',
      referenceDateIso: REF,
      rewriteStyle: 'stronger',
      candidate: near,
    });
    expect(repaired.blocked).toBe(false);
    expect(['ai_repaired', 'deterministic_fallback']).toContain(repaired.origin);
    expect(repaired.pipelineDiagnostics?.rewriteStylePropagatedToRepair).toBe(true);

    const rejected = runSummaryV2({
      cv,
      locale: 'de',
      gender: 'male',
      referenceDateIso: REF,
      rewriteStyle: 'shorter',
      candidate: BAD_PROVIDER,
    });
    expect(rejected.pipelineDiagnostics?.providerRejectionReasons?.length).toBeGreaterThan(0);
    expect(rejected.pipelineDiagnostics?.providerRejectionReason).not.toBe(
      'summary_v2_provider_rejected_or_repaired',
    );
  });

  it('style-aware deterministic fallback transforms existing Summary', () => {
    const cv = deviceCv();
    const manifest = buildSummaryV2ManifestForCv({
      cv,
      locale: 'de',
      gender: 'male',
      referenceDateIso: REF,
    });
    expect(summaryV2StylePairDistinct(manifest)).toBe(true);
    for (const style of ['shorter', 'stronger', 'professional'] as const) {
      const tr = transformSummaryV2ForRewriteStyle({
        manifest,
        style,
        sourceSummary: DEVICE_SOURCE,
      });
      expect(tr.noSafeMaterialChange).toBe(false);
      expect(tr.styleFulfilled).toBe(true);
      expect(tr.transformationKind).toBe(`v2_rewrite_${style}`);
      expect(tr.beforeHash).not.toBe(tr.afterHash);
      const sf = evaluateSummaryV2StyleFulfillment({
        style,
        sourceText: DEVICE_SOURCE,
        candidateText: tr.text,
        locale: 'de',
      });
      expect(sf.styleValidationPassed).toBe(true);
    }
  });

  it('negatives: drop duty / invent impact / punctuation-only / locale / leakage', () => {
    const cv = deviceCv();
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);

    const dropsDuty = DEVICE_SOURCE.replace(
      ', Fahrräder auf technische Mängel prüfe und defekte Bauteile an Fahrrädern austausche',
      '',
    );
    const dropFin = finalizeCvAiFieldForApply({
      action: 'summary_shorter',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'male',
      cv,
      candidate: dropsDuty,
      referenceDateIso: REF,
      durationSnapshot: duration,
      rewriteStyle: 'shorter',
    });
    // Provider dropped a duty — must not be accepted as shorter provider path.
    expect(dropFin.diagnostics?.providerAccepted).toBe(false);

    const invents = [
      DEVICE_SOURCE,
      'Dadurch steigerte ich den Umsatz um 40% und führte ein Team von 8 Personen.',
    ].join(' ');
    const inventFin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'male',
      cv,
      candidate: invents,
      referenceDateIso: REF,
      durationSnapshot: duration,
      rewriteStyle: 'stronger',
    });
    expect(inventFin.diagnostics?.providerAccepted).toBe(false);
    expect(inventFin.text || '').not.toMatch(/40%|Team von 8/iu);

    const punctOnly = `${DEVICE_SOURCE.replace(/\./g, '. ')}  `;
    const punctEval = evaluateSummaryV2StyleFulfillment({
      style: 'professional',
      sourceText: DEVICE_SOURCE,
      candidateText: punctOnly,
      locale: 'de',
    });
    expect(punctEval.styleValidationPassed).toBe(false);

    const enLeak = finalizeCvAiFieldForApply({
      action: 'summary_professional',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'male',
      cv,
      candidate: 'I currently work as a bike mechanic at RadWerk with leadership skills.',
      referenceDateIso: REF,
      durationSnapshot: duration,
      rewriteStyle: 'professional',
    });
    expect(enLeak.diagnostics?.providerAccepted).toBe(false);
    expect(enLeak.text || '').not.toMatch(/\bI currently work\b/u);

    const leakCv = deviceCv({
      extraEntries: [{
        id: 'ghost',
        position: 'Pilot',
        company: 'SkyCorp',
        startDate: '2018-01',
        endDate: '2019-01',
        isPresent: false,
        description: 'Fliegt Flugzeuge.\nPlant Routen.\nPrüft Instrumente.',
        canonicalDescription: 'Fliegt Flugzeuge.\nPlant Routen.\nPrüft Instrumente.',
      }],
    });
    const leakDur = buildExperienceDurationSnapshot(leakCv.experience || [], REF);
    const leakFin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'male',
      cv: leakCv,
      candidate: BAD_PROVIDER,
      referenceDateIso: REF,
      durationSnapshot: leakDur,
      rewriteStyle: 'stronger',
    });
    // Max two priors in V2 selection — ghost may be selected or not; never invent FakeCorp.
    expect(leakFin.text || '').not.toMatch(/FakeCorp|Teamleiter/iu);
  });

  it('true no-op only when source already style-saturated', () => {
    const cv0 = deviceCv({ summary: DEVICE_SOURCE });
    const manifest = buildSummaryV2ManifestForCv({
      cv: cv0,
      locale: 'de',
      gender: 'male',
      referenceDateIso: REF,
    });
    const already = buildSummaryV2StyledDeterministicText(manifest, 'stronger');
    const cv = deviceCv({ summary: already });
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    seedUsage(55);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'male',
      cv,
      candidate: already,
      referenceDateIso: REF,
      durationSnapshot: duration,
      rewriteStyle: 'stronger',
    });
    expect(fin.blocked).toBe(true);
    expect(fin.countedAsSuccess).toBe(false);
    expect(fin.reason).toBe('style_no_safe_material_change');
    expect(fin.diagnostics?.noOpDetected).toBe(true);
    expect(fin.diagnostics?.noOpRejectionReason).toBe('style_no_safe_material_change');
    expect(normalizeSummaryCandidateText(fin.text || '')).toBe(
      normalizeSummaryCandidateText(already),
    );
    expect(getProAiUsageCount()).toBe(55);
  });

  it('breadth: one/two/more entries, arbitrary DE roles, umlauts, separable verbs', () => {
    const one = deviceCv({
      onlyCurrent: true,
      summary: '',
      currentRole: 'Gerätewart',
      currentCompany: 'Müller & Söhne',
      currentDuties: [
        'Führt Wartungsarbeiten an Geräten durch.',
        'Prüft Geräte auf technische Mängel.',
        'Tauscht defekte Bauteile aus.',
      ].join('\n'),
    });
    const two = deviceCv({
      summary: '',
      currentRole: 'Hörakustiker',
      currentCompany: 'HörWelt',
      priorRole: 'Bürokauffrau',
      priorCompany: 'BüroHaus',
      currentDuties: [
        'Passt Hörgeräte an.',
        'Berät Kundinnen und Kunden.',
        'Führt Hörtests durch.',
      ].join('\n'),
      priorDuties: [
        'Erstellte Angebote.',
        'Bearbeitete Kundenanfragen.',
        'Pflegte die Terminkalender.',
      ].join('\n'),
    });
    for (const cv of [one, two]) {
      const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
      for (const style of ['shorter', 'stronger', 'professional'] as const) {
        const fin = finalizeCvAiFieldForApply({
          action: `summary_${style}`,
          field: 'summary',
          requestedLocale: 'de',
          gender: 'male',
          cv,
          candidate: '',
          referenceDateIso: REF,
          durationSnapshot: duration,
          rewriteStyle: style,
        });
        expect(fin.blocked, `${cv.personal.jobTitle}-${style}`).toBe(false);
        expect(fin.countedAsSuccess).toBe(true);
        expect(fin.diagnostics?.styleValidationPassed).toBe(true);
        expect(fin.text || '').toMatch(/Derzeit|bin ich|Ich habe|Ich verfüge/iu);
      }
    }
  });

  it('shared rewriteStyle contract propagates for all 12 locales', () => {
    for (const locale of LOCALES) {
      const cv: CVData = {
        ...deviceCv({ summary: locale === 'de' ? DEVICE_SOURCE : '' }),
        contentLocale: locale,
        personal: {
          ...deviceCv().personal,
          jobTitle: locale === 'en' ? 'Bike Mechanic' : 'Fahrradmechaniker',
        },
        experience: (deviceCv().experience || []).map((e, i) => (
          i === 0 && locale === 'en'
            ? {
              ...e,
              position: 'Bike Mechanic',
              company: 'RadWerk',
              description: 'Performs bike maintenance.\nInspects bikes.\nReplaces defective parts.',
              canonicalDescription: 'Performs bike maintenance.\nInspects bikes.\nReplaces defective parts.',
            }
            : e
        )),
      };
      if (locale !== 'de' && locale !== 'en') {
        // Shell locales: generate-from-empty then style from empty source uses styled builder.
        cv.summary = '';
      }
      const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
      const fin = finalizeCvAiFieldForApply({
        action: 'summary_stronger',
        field: 'summary',
        requestedLocale: locale,
        gender: 'male',
        cv,
        candidate: '',
        referenceDateIso: REF,
        durationSnapshot: duration,
        rewriteStyle: 'stronger',
      });
      expect(fin.diagnostics?.rewriteStyle).toBe('stronger');
      // Empty generate may succeed without style flags when no source; propagation still set when style present.
      if (!fin.blocked && cv.summary) {
        expect(fin.diagnostics?.rewriteStylePropagatedToDeterministic).toBe(true);
      }
    }
  });
});
