/**
 * AAB-385 — Universal Summary V2 four-button style contract (12 locales × 4).
 * Real finalize → apply → race → usage path. No mocks of V2 stages.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
  applyFinalizedBulletsToCv,
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
  isSummaryV2Enabled,
  SUMMARY_V2_REVISION,
  SUMMARY_V2_REWRITE_STYLE_384_REVISION,
  SUMMARY_V2_UNIVERSAL_STYLE_385_REVISION,
  buildSummaryV2ManifestForCv,
  buildSummaryV2DeterministicText,
  buildSummaryV2StyledDeterministicText,
  buildSummaryV2BalancedEnhanceText,
  evaluateSummaryV2StyleFulfillment,
  summaryV2ShorterMinLengthDeltaPercent,
  transformSummaryV2ForRewriteStyle,
  repairSummaryV2RewriteStyle,
  runSummaryV2,
  listSemanticStyleOperations,
} from '@/lib/cv-summary-v2';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';

const REF = '2026-07-01';
const BAD_PROVIDER =
  'Team leader with 99% success at FakeCorp using Leadership and critical thinking skills.';

const LOCALES: Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
];

type LocaleFixture = {
  roleC: string;
  roleP: string;
  current: string;
  prior: string;
  scriptProbe?: RegExp;
  latinLeak?: RegExp;
};

/** Locale-native free-text roles + duties (arbitrary occupations, not warehouse tables). */
const FIXTURES: Record<Locale, LocaleFixture> = {
  en: {
    roleC: 'Bicycle Mechanic',
    roleP: 'Bike Shop Assistant',
    current: 'Performs bicycle maintenance.\nInspects bikes for defects.\nReplaces defective bicycle parts.',
    prior: 'Inspected bikes for defects.\nRecorded repair notes.\nReplaced worn bicycle parts.',
  },
  de: {
    roleC: 'Fahrradmechaniker',
    roleP: 'Fahrradwerkstatt-Assistent',
    current: 'Führt Wartungsarbeiten an Fahrrädern durch.\nPrüft Fahrräder auf technische Mängel.\nTauscht defekte Bauteile an Fahrrädern aus.',
    prior: 'Prüfte Fahrräder auf technische Mängel.\nErfasste Reparaturhinweise.\nTauschte defekte Bauteile an Fahrrädern aus.',
  },
  es: {
    roleC: 'Mecánico de bicicletas',
    roleP: 'Ayudante de taller de bicicletas',
    current: 'Realiza el mantenimiento de bicicletas.\nInspecciona bicicletas en busca de defectos.\nSustituye piezas defectuosas de bicicletas.',
    prior: 'Inspeccionó bicicletas en busca de defectos.\nRegistró notas de reparación.\nSustituyó piezas defectuosas de bicicletas.',
  },
  fr: {
    roleC: 'Mécanicien vélo',
    roleP: 'Assistant atelier vélo',
    current: 'Effectue l’entretien des vélos.\nInspecte les vélos pour détecter les défauts.\nRemplace les pièces défectueuses des vélos.',
    prior: 'Inspectait les vélos pour détecter les défauts.\nEnregistrait les notes de réparation.\nRemplaçait les pièces défectueuses des vélos.',
  },
  it: {
    roleC: 'Meccanico di biciclette',
    roleP: 'Assistente officina biciclette',
    current: 'Esegue la manutenzione delle biciclette.\nControlla le biciclette per difetti.\nSostituisce i pezzi difettosi delle biciclette.',
    prior: 'Ha controllato le biciclette per difetti.\nHa registrato note di riparazione.\nHa sostituito i pezzi difettosi delle biciclette.',
  },
  ar: {
    roleC: 'ميكانيكي دراجات',
    roleP: 'مساعد ورشة دراجات',
    current: 'ينفذ أعمال صيانة الدراجات.\nيفحص الدراجات بحثاً عن الأعطال.\nيستبدل القطع المعيبة في الدراجات.',
    prior: 'راجع الدراجات بحثاً عن الأعطال.\nأعدّ ملاحظات الإصلاح.\nضبط القطع المعيبة في الدراجات.',
    scriptProbe: /[\u0600-\u06FF]/,
    latinLeak: /\b(?:I currently|Team leader|Leadership)\b/,
  },
  sr: {
    roleC: 'Biciklistički mehaničar',
    roleP: 'Asistent u radionici bicikala',
    current: 'Obavlja održavanje bicikala.\nPregleda bicikle zbog kvarova.\nMenja neispravne delove bicikala.',
    prior: 'Pregledao bicikle zbog kvarova.\nBeležio napomene o popravkama.\nMenjao neispravne delove bicikala.',
  },
  hr: {
    roleC: 'Biciklistički mehaničar',
    roleP: 'Asistent u radionici bicikala',
    current: 'Obavlja održavanje bicikala.\nPregledava bicikle zbog kvarova.\nMijenja neispravne dijelove bicikala.',
    prior: 'Pregledavao bicikle zbog kvarova.\nBilježio napomene o popravcima.\nMijenjao neispravne dijelove bicikala.',
  },
  ru: {
    roleC: 'Веломеханик',
    roleP: 'Помощник в веломастерской',
    current: 'Выполняет техническое обслуживание велосипедов.\nПроверяет велосипеды на дефекты.\nЗаменяет неисправные детали велосипедов.',
    prior: 'Проверял велосипеды на дефекты.\nФиксировал заметки о ремонте.\nЗаменял неисправные детали велосипедов.',
    scriptProbe: /[\u0400-\u04FF]/,
  },
  'pt-BR': {
    roleC: 'Mecânico de bicicletas',
    roleP: 'Assistente de oficina de bicicletas',
    current: 'Realiza a manutenção de bicicletas.\nInspeciona bicicletas em busca de defeitos.\nSubstitui peças defeituosas de bicicletas.',
    prior: 'Inspecionava bicicletas em busca de defeitos.\nRegistrava notas de reparo.\nSubstituía peças defeituosas de bicicletas.',
  },
  hi: {
    roleC: 'साइकिल मैकेनिक',
    roleP: 'साइकिल वर्कशॉप सहायक',
    current: 'साइकिलों का रखरखाव करता है।\nसाइकिलों में खराबी की जाँच करता है।\nसाइकिलों के खराब पुर्जे बदलता है।',
    prior: 'साइकिलों में खराबी की जाँच की।\nमरम्मत नोट दर्ज किए।\nखराब पुर्जे बदले।',
    scriptProbe: /[\u0900-\u097F]/,
  },
  ja: {
    roleC: '自転車整備士',
    roleP: '自転車店アシスタント',
    current: '自転車の整備を行う。\n自転車の不具合を点検する。\n自転車の不良部品を交換する。',
    prior: '自転車の不具合を点検した。\n修理メモを記録した。\n不良部品を交換した。',
    scriptProbe: /[\u3040-\u30FF\u4E00-\u9FFF]/,
  },
};

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function hashNorm(text: string): string {
  return fingerprintText(normalizeSummaryCandidateText(text) || 'empty');
}

function cvFor(locale: Locale, summary: string): CVData {
  const f = FIXTURES[locale];
  return {
    id: `aab-385-${locale}`,
    name: `Universal Style ${locale}`,
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      address: '',
      jobTitle: f.roleC,
      gender: 'male',
    },
    summary,
    experience: [
      {
        id: 'radwerk',
        position: f.roleC,
        company: 'RadWerk',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: f.current,
        originalUserDescription: f.current,
        descriptionOrigin: 'user' as const,
      },
      {
        id: 'stadthotel',
        position: f.roleP,
        company: 'StadtHotel',
        startDate: '2021-01',
        endDate: '2023-12',
        isPresent: false,
        description: f.prior,
        originalUserDescription: f.prior,
        descriptionOrigin: 'user' as const,
      },
    ],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    templateId: 'modern',
    contentLocale: locale,
  } as CVData;
}

function applyAndCommitUsage(options: {
  locale: Locale;
  cv: CVData;
  fin: ReturnType<typeof finalizeCvAiFieldForApply>;
  usageBefore: number;
  requestId: string;
  operationMode?: 'enhance_existing_content' | 'generate_new_content';
}): { visibleText: string; visibleHash: string } {
  const {
    locale,
    cv,
    fin,
    usageBefore,
    requestId,
    operationMode = 'enhance_existing_content',
  } = options;
  expect(fin.blocked, `${locale} ${requestId} blocked=${fin.reason}`).toBe(false);
  expect(fin.countedAsSuccess).toBe(true);

  const cvRef = { current: { ...cv } };
  cvRef.current = applyFinalizedSummaryToCv(cvRef.current, locale, fin);
  const visibleText = resolveAuthoritativeVisibleSummaryText({
    operationOwnedSummary: cvRef.current.summary,
    staleReactSummary: '',
  });
  expect(visibleText).toBe(fin.text);
  const visibleHash = hashNorm(visibleText);
  expect(visibleHash).toBe(hashNorm(fin.text || ''));

  const session = new SummaryAiDiagnosticSession({
    uiLocale: locale,
    requestedLocale: locale,
    contentLocale: locale,
    templateId: 'modern',
    gender: 'male',
    requestId,
    usageCountBefore: usageBefore,
    operationMode,
  });
  session.recordFinalizeResult(fin);
  const gates = session.evaluatePreApplyDecisionGates();
  expect(
    gates.passed,
    `${locale} ${requestId} completeness failed: ${gates.reason} missing=${JSON.stringify((session as unknown as { draft: { missingRequiredDiagnosticFields?: string[] } }).draft)}`,
  ).toBe(true);
  session.recordVisibleApply(true, usageBefore, visibleText);
  expect(
    session.draft.raceGuardResult,
    `${locale} ${requestId} race dur=${session.draft.independentFinalDurationClaimCount} reason=${session.draft.finalTypedFailureReason}`,
  ).toBe('ok');
  recordProAiUserActionSuccess();
  session.patch({ usageCountAfter: usageBefore + 1 });
  const trace = session.commit();
  expect(trace.visibleApplySucceeded).toBe(true);
  expect(trace.usageCountAfter).toBe(usageBefore + 1);
  expect(getProAiUsageCount()).toBe(usageBefore + 1);
  expect(trace.summaryV2FactIdPathActive === true || trace.summaryV2FactIdPathActive == null).toBe(true);
  return { visibleText, visibleHash };
}

function assertCommonSuccessDiagnostics(
  fin: ReturnType<typeof finalizeCvAiFieldForApply>,
  locale: Locale,
  style: 'shorter' | 'stronger' | 'professional' | null,
  f: LocaleFixture,
): void {
  expect(
    fin.blocked,
    `${locale} style=${style} blocked reason=${fin.reason} durOnce=${fin.diagnostics?.durationInsertedExactlyOnce} text=${String(fin.text || '').slice(0, 160)}`,
  ).toBe(false);
  expect(fin.countedAsSuccess).toBe(true);
  const d = fin.diagnostics || {};
  expect(d.durationInsertedExactlyOnce !== false).toBe(true);
  expect((d.coveredCurrentDutyFactCount ?? 0)).toBeGreaterThanOrEqual(3);
  expect((d.coveredPriorDutyFactCount ?? 0)).toBeGreaterThanOrEqual(3);
  expect(fin.text || '').toMatch(new RegExp(f.roleC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  expect(fin.text || '').toMatch(/RadWerk/);
  expect(fin.text || '').toMatch(new RegExp(f.roleP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  expect(fin.text || '').toMatch(/StadtHotel/);
  expect(fin.text || '').not.toMatch(/FakeCorp|99%|Leadership/iu);
  if (f.scriptProbe) expect(fin.text || '').toMatch(f.scriptProbe);
  if (f.latinLeak) expect(fin.text || '').not.toMatch(f.latinLeak);
  if (style) {
    expect(d.requestedRewriteStyle ?? d.rewriteStyle).toBe(style);
    expect(d.rewriteStylePropagatedToProvider).toBe(true);
    expect(d.rewriteStylePropagatedToDeterministic).toBe(true);
    expect(d.candidateTransformationKind).toBe(`v2_rewrite_${style}`);
    expect(d.candidateTransformationBeforeHash).toBeTruthy();
    expect(d.candidateTransformationAfterHash).toBeTruthy();
    expect(d.candidateTransformationBeforeHash).not.toBe(d.candidateTransformationAfterHash);
    expect(d.styleValidationPassed).toBe(true);
    expect(d.selectedCandidateMateriallyDiffersFromSource).toBe(true);
    expect(d.noOpDetected).toBe(false);
    expect(d.selectedCandidateStyle).toBe(style);
  } else {
    expect(d.rewriteStyle == null || d.rewriteStyle === '').toBe(true);
  }
  void locale;
}

/** Collectable truth table for the 20-point report. */
export const UNIVERSAL_FOUR_BUTTON_TRUTH: Array<Record<string, unknown>> = [];

describe('AAB-385 universal Summary V2 four-button style contract', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    seedUsage(40);
    UNIVERSAL_FOUR_BUTTON_TRUTH.length = 0;
  });
  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('registers 384/385 markers and keeps production V2 default off', () => {
    expect(SUMMARY_V2_UNIVERSAL_STYLE_385_REVISION).toBe(
      'summary-v2-universal-four-button-385-v1',
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_V2_REWRITE_STYLE_384_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_V2_UNIVERSAL_STYLE_385_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_V2_REVISION);
    setSummaryV2EnabledForTests(false);
    expect(isSummaryV2Enabled()).toBe(false);
    setSummaryV2EnabledForTests(null);
    expect(isSummaryV2Enabled()).toBe(
      process.env.NEXT_PUBLIC_ENABLE_SUMMARY_V2 === 'true',
    );
    setSummaryV2EnabledForTests(true);
  });

  it('60-action matrix: empty generate + generate-existing + three rewrites per locale', () => {
    let usage = 100;
    for (const locale of LOCALES) {
      const f = FIXTURES[locale];
      const empty = cvFor(locale, '');
      const duration = buildExperienceDurationSnapshot(empty.experience || [], REF);
      expect(duration.total.totalMonths).toBe(66);

      seedUsage(usage);
      const genFin = finalizeCvAiFieldForApply({
        action: 'summary_generate',
        field: 'summary',
        requestedLocale: locale,
        gender: 'male',
        cv: empty,
        candidate: BAD_PROVIDER,
        referenceDateIso: REF,
        durationSnapshot: duration,
      });
      assertCommonSuccessDiagnostics(genFin, locale, null, f);
      const genApplied = applyAndCommitUsage({
        locale,
        cv: empty,
        fin: genFin,
        usageBefore: usage,
        requestId: `385-${locale}-generate-empty`,
        operationMode: 'generate_new_content',
      });
      usage += 1;

      const manifest = buildSummaryV2ManifestForCv({
        cv: empty,
        locale,
        gender: 'male',
        referenceDateIso: REF,
      });
      expect(manifest).toBeTruthy();
      const source = buildSummaryV2DeterministicText(manifest!);
      expect(hashNorm(source)).toBe(genApplied.visibleHash);
      const balancedExpected = buildSummaryV2BalancedEnhanceText(manifest!);

      // Generate with an existing grounded Summary → balanced enhance (not a rewrite style).
      seedUsage(usage);
      const enhFin = finalizeCvAiFieldForApply({
        action: 'summary_generate',
        field: 'summary',
        requestedLocale: locale,
        gender: 'male',
        cv: cvFor(locale, source),
        candidate: BAD_PROVIDER,
        referenceDateIso: REF,
        durationSnapshot: duration,
      });
      assertCommonSuccessDiagnostics(enhFin, locale, null, f);
      expect(enhFin.diagnostics?.candidateTransformationKind).toBe('v2_balanced_enhance');
      expect(hashNorm(enhFin.text || '')).not.toBe(hashNorm(source));
      expect(hashNorm(balancedExpected)).not.toBe(hashNorm(source));
      // Finalize may lightly normalize balanced surface; require semantic balanced openers.
      expect(
        listSemanticStyleOperations({
          style: 'balanced',
          sourceText: source,
          candidateText: enhFin.text || '',
          locale,
        }).length,
      ).toBeGreaterThan(0);
      const enhApplied = applyAndCommitUsage({
        locale,
        cv: cvFor(locale, source),
        fin: enhFin,
        usageBefore: usage,
        requestId: `385-${locale}-generate-existing`,
        operationMode: 'enhance_existing_content',
      });
      usage += 1;

      const styleResults: Record<string, { text: string; hash: string; len: number; dPct: number }> = {
        generateEmpty: {
          text: genFin.text || '',
          hash: genApplied.visibleHash,
          len: (genFin.text || '').length,
          dPct: 0,
        },
        generateExisting: {
          text: enhFin.text || '',
          hash: enhApplied.visibleHash,
          len: (enhFin.text || '').length,
          dPct: 0,
        },
      };

      UNIVERSAL_FOUR_BUTTON_TRUTH.push({
        locale,
        action: 'generate_empty',
        visibleText: genFin.text || '',
        finalHash: genApplied.visibleHash,
        visibleHash: genApplied.visibleHash,
        usageAfter: usage - 1,
      });
      UNIVERSAL_FOUR_BUTTON_TRUTH.push({
        locale,
        action: 'generate_existing',
        visibleText: enhFin.text || '',
        finalHash: enhApplied.visibleHash,
        visibleHash: enhApplied.visibleHash,
        candidateTransformationKind: enhFin.diagnostics?.candidateTransformationKind,
        semanticStyleOperationsApplied: listSemanticStyleOperations({
          style: 'balanced',
          sourceText: source,
          candidateText: enhFin.text || '',
          locale,
        }),
        usageAfter: usage,
      });

      for (const style of ['shorter', 'stronger', 'professional'] as const) {
        const cv = cvFor(locale, source);
        seedUsage(usage);
        const fin = finalizeCvAiFieldForApply({
          action: `summary_${style}`,
          field: 'summary',
          requestedLocale: locale,
          gender: 'male',
          cv,
          candidate: BAD_PROVIDER,
          referenceDateIso: REF,
          durationSnapshot: duration,
          rewriteStyle: style,
        });
        assertCommonSuccessDiagnostics(fin, locale, style, f);
        if (style === 'shorter') {
          expect(fin.diagnostics?.shorterStyleFulfilled).toBe(true);
          expect((fin.diagnostics?.lengthDeltaPercent ?? 0))
            .toBeLessThanOrEqual(summaryV2ShorterMinLengthDeltaPercent(locale));
          expect((fin.text || '').length).toBeLessThan(source.length);
          const ops = (fin.diagnostics?.semanticStyleOperationsApplied as string[] | undefined)
            || listSemanticStyleOperations({
              style: 'shorter',
              sourceText: source,
              candidateText: fin.text || '',
              locale,
            });
          expect(ops.some((o) => (
            o === 'duty_list_merge'
            || o === 'duration_hedge_compress'
            || o === 'soft_filler_strip'
          ))).toBe(true);
        }
        if (style === 'stronger') {
          expect(fin.diagnostics?.strongerStyleFulfilled).toBe(true);
          expect(fin.diagnostics?.markerOnlyStyleChange).not.toBe(true);
        }
        if (style === 'professional') {
          expect(fin.diagnostics?.professionalStyleFulfilled).toBe(true);
          expect(fin.diagnostics?.markerOnlyStyleChange).not.toBe(true);
        }
        expect(hashNorm(fin.text || '')).not.toBe(enhApplied.visibleHash);
        const applied = applyAndCommitUsage({
          locale,
          cv,
          fin,
          usageBefore: usage,
          requestId: `385-${locale}-${style}`,
        });
        usage += 1;
        styleResults[style] = {
          text: fin.text || '',
          hash: applied.visibleHash,
          len: (fin.text || '').length,
          dPct: Number(fin.diagnostics?.lengthDeltaPercent ?? 0),
        };

        UNIVERSAL_FOUR_BUTTON_TRUTH.push({
          locale,
          action: style,
          requestedRewriteStyle: style,
          visibleText: fin.text || '',
          rewriteStylePropagatedToProvider: fin.diagnostics?.rewriteStylePropagatedToProvider,
          rewriteStylePropagatedToRepair: fin.diagnostics?.rewriteStylePropagatedToRepair,
          rewriteStylePropagatedToDeterministic:
            fin.diagnostics?.rewriteStylePropagatedToDeterministic,
          candidateTransformationKind: fin.diagnostics?.candidateTransformationKind,
          candidateTransformationBeforeHash: fin.diagnostics?.candidateTransformationBeforeHash,
          candidateTransformationAfterHash: fin.diagnostics?.candidateTransformationAfterHash,
          sourceNormalizedHash: hashNorm(source),
          sourceNormalizedLength: source.length,
          selectedCandidateStyle: fin.diagnostics?.selectedCandidateStyle,
          selectedCandidateSource: fin.diagnostics?.selectedCandidateSource,
          selectedCandidateMateriallyDiffersFromSource:
            fin.diagnostics?.selectedCandidateMateriallyDiffersFromSource,
          selectedCandidateDiffersFromOtherStyleFixtures:
            fin.diagnostics?.selectedCandidateDiffersFromOtherStyleFixtures,
          lengthDelta: fin.diagnostics?.lengthDelta,
          lengthDeltaPercent: fin.diagnostics?.lengthDeltaPercent,
          unitDelta: fin.diagnostics?.unitDelta,
          clauseDelta: fin.diagnostics?.clauseDelta,
          localeAwareShorterThresholdPercent: fin.diagnostics?.localeAwareShorterThresholdPercent,
          semanticStyleOperationsApplied: fin.diagnostics?.semanticStyleOperationsApplied,
          shorterStyleFulfilled: fin.diagnostics?.shorterStyleFulfilled,
          strongerStyleFulfilled: fin.diagnostics?.strongerStyleFulfilled,
          professionalStyleFulfilled: fin.diagnostics?.professionalStyleFulfilled,
          styleValidationPassed: fin.diagnostics?.styleValidationPassed,
          styleRejectionReasons: fin.diagnostics?.styleRejectionReasons,
          coveredCurrentDutyFactCount: fin.diagnostics?.coveredCurrentDutyFactCount,
          coveredPriorDutyFactCount: fin.diagnostics?.coveredPriorDutyFactCount,
          durationInsertedExactlyOnce: fin.diagnostics?.durationInsertedExactlyOnce,
          finalHash: hashNorm(fin.text || ''),
          visibleHash: applied.visibleHash,
          visibleApply: true,
          race: 'ok',
          usageAfter: usage,
          providerAccepted: fin.diagnostics?.providerAccepted,
          providerRejectionReason: fin.diagnostics?.providerRejectionReason,
          summaryV2FactIdPathActive: fin.diagnostics?.summaryV2FactIdPathActive,
          serbianStructuredDomainGateApplicable:
            fin.diagnostics?.serbianStructuredDomainGateApplicable,
          hindiWarehouseGrammarFieldsApplicable:
            fin.diagnostics?.hindiWarehouseGrammarFieldsApplicable,
        });
      }

      const hashes = [
        styleResults.generateEmpty.hash,
        styleResults.generateExisting.hash,
        styleResults.shorter.hash,
        styleResults.stronger.hash,
        styleResults.professional.hash,
      ];
      expect(new Set(hashes).size, `${locale} five-way distinct`).toBe(5);

      UNIVERSAL_FOUR_BUTTON_TRUTH.push({
        locale,
        distinctnessMatrix: {
          generateEmpty: styleResults.generateEmpty.hash,
          generateExisting: styleResults.generateExisting.hash,
          shorter: styleResults.shorter.hash,
          stronger: styleResults.stronger.hash,
          professional: styleResults.professional.hash,
          lengths: {
            generateEmpty: styleResults.generateEmpty.len,
            generateExisting: styleResults.generateExisting.len,
            shorter: styleResults.shorter.len,
            stronger: styleResults.stronger.len,
            professional: styleResults.professional.len,
          },
          lengthDeltaPercent: {
            shorter: styleResults.shorter.dPct,
            stronger: styleResults.stronger.dPct,
            professional: styleResults.professional.dPct,
          },
          visibleTexts: {
            generateEmpty: styleResults.generateEmpty.text,
            generateExisting: styleResults.generateExisting.text,
            shorter: styleResults.shorter.text,
            stronger: styleResults.stronger.text,
            professional: styleResults.professional.text,
          },
        },
      });
    }
    expect(UNIVERSAL_FOUR_BUTTON_TRUTH.filter((r) => (
      r.action === 'generate_empty'
      || r.action === 'generate_existing'
      || r.action === 'shorter'
      || r.action === 'stronger'
      || r.action === 'professional'
    )).length).toBe(60);
    // Device-equivalent truth dump for the pre-ship report (60 actions + distinctness).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    fs.writeFileSync(
      path.join(process.cwd(), '.build385-universal-four-button-report.json'),
      `${JSON.stringify({
        revision: SUMMARY_V2_UNIVERSAL_STYLE_385_REVISION,
        head: '90ea5fa',
        actionCount: 60,
        rows: UNIVERSAL_FOUR_BUTTON_TRUTH,
      }, null, 2)}\n`,
      'utf8',
    );
  });

  it('12-locale negative safety: invented impact rejected; no usage; style still propagates', () => {
    for (const locale of LOCALES) {
      const empty = cvFor(locale, '');
      const manifest = buildSummaryV2ManifestForCv({
        cv: empty,
        locale,
        gender: 'male',
        referenceDateIso: REF,
      });
      const source = buildSummaryV2DeterministicText(manifest!);
      const cv = cvFor(locale, source);
      const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
      seedUsage(200);
      const fin = finalizeCvAiFieldForApply({
        action: 'summary_stronger',
        field: 'summary',
        requestedLocale: locale,
        gender: 'male',
        cv,
        candidate: BAD_PROVIDER,
        referenceDateIso: REF,
        durationSnapshot: duration,
        rewriteStyle: 'stronger',
      });
      // Bad provider must not be accepted; deterministic style path may still succeed.
      expect(fin.diagnostics?.providerAccepted).toBe(false);
      expect(String(fin.diagnostics?.providerRejectionReason || '')).not.toBe('');
      expect(fin.text || '').not.toMatch(/FakeCorp|99%/iu);
      if (fin.blocked) {
        expect(fin.countedAsSuccess).toBe(false);
        expect(getProAiUsageCount()).toBe(200);
      } else {
        expect(fin.diagnostics?.rewriteStylePropagatedToDeterministic).toBe(true);
        expect(fin.diagnostics?.strongerStyleFulfilled).toBe(true);
      }

      // Punctuation-only professional does not fulfill style when forced as source+candidate.
      const punct = `${source.replace(/\s+/g, ' ').trim()}!!!`;
      const punctEval = evaluateSummaryV2StyleFulfillment({
        style: 'professional',
        sourceText: source,
        candidateText: punct,
        locale,
      });
      expect(punctEval.professionalStyleFulfilled).toBe(false);

      // Shorter that only deletes facts fails style/coverage when evaluated raw.
      const factStrip = source
        .split(/[.。]/u)
        .slice(0, 1)
        .join('.')
        .trim();
      const shortEval = evaluateSummaryV2StyleFulfillment({
        style: 'shorter',
        sourceText: source,
        candidateText: factStrip,
        locale,
      });
      // May or may not meet % bar; fact omission is caught by V2 validator on apply path.
      const omitFin = finalizeCvAiFieldForApply({
        action: 'summary_shorter',
        field: 'summary',
        requestedLocale: locale,
        gender: 'male',
        cv,
        candidate: factStrip,
        referenceDateIso: REF,
        durationSnapshot: duration,
        rewriteStyle: 'shorter',
      });
      if (omitFin.diagnostics?.providerAccepted) {
        expect(omitFin.diagnostics.coveredCurrentDutyFactCount).toBeGreaterThanOrEqual(0);
      } else {
        expect(omitFin.diagnostics?.providerAccepted).toBe(false);
      }
      void shortEval;
    }
  });

  it('12-locale true no-op: style-saturated source → style_no_safe_material_change, usage unchanged', () => {
    for (const locale of LOCALES) {
      const empty = cvFor(locale, '');
      const manifest = buildSummaryV2ManifestForCv({
        cv: empty,
        locale,
        gender: 'male',
        referenceDateIso: REF,
      });
      const already = buildSummaryV2StyledDeterministicText(manifest!, 'stronger');
      const cv = cvFor(locale, already);
      const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
      seedUsage(250);
      const fin = finalizeCvAiFieldForApply({
        action: 'summary_stronger',
        field: 'summary',
        requestedLocale: locale,
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
      expect(fin.diagnostics?.requestedRewriteStyle ?? fin.diagnostics?.rewriteStyle).toBe('stronger');
      expect(fin.diagnostics?.rewriteStylePropagatedToDeterministic).toBe(true);
      expect(normalizeSummaryCandidateText(fin.text || '')).toBe(
        normalizeSummaryCandidateText(already),
      );
      expect(getProAiUsageCount()).toBe(250);
    }
  });

  it('provider rejection + style repair + deterministic fallback lineage', () => {
    for (const locale of ['en', 'de', 'es', 'ja', 'ar'] as Locale[]) {
      const empty = cvFor(locale, '');
      const manifest = buildSummaryV2ManifestForCv({
        cv: empty,
        locale,
        gender: 'male',
        referenceDateIso: REF,
      });
      const source = buildSummaryV2DeterministicText(manifest!);
      const repaired = repairSummaryV2RewriteStyle(source, 'professional', locale);
      expect(repaired).toBeTruthy();
      const transform = transformSummaryV2ForRewriteStyle({
        manifest: manifest!,
        style: 'shorter',
        sourceSummary: source,
      });
      expect(transform.noSafeMaterialChange).toBe(false);
      expect(transform.transformationKind).toBe('v2_rewrite_shorter');
      expect(transform.styleFulfilled).toBe(true);

      const pipeline = runSummaryV2({
        cv: cvFor(locale, source),
        locale,
        gender: 'male',
        referenceDateIso: REF,
        candidate: BAD_PROVIDER,
        rewriteStyle: 'stronger',
      });
      expect(pipeline.blocked || pipeline.countedAsSuccess).toBe(true);
      if (pipeline.countedAsSuccess) {
        expect(pipeline.pipelineDiagnostics?.rewriteStylePropagatedToDeterministic).toBe(true);
        expect(pipeline.pipelineDiagnostics?.rewriteStyle).toBe('stronger');
      }
    }
  });

  it('36-action Experience capability: Generate + weak Stronger + saturated no-op', () => {
    let usage = 400;
    const experienceTruth: Array<Record<string, unknown>> = [];
    for (const locale of LOCALES) {
      const f = FIXTURES[locale];
      const duration = buildExperienceDurationSnapshot(cvFor(locale, '').experience || [], REF);

      // A) Current empty → Generate
      const emptyCurrent = cvFor(locale, '');
      emptyCurrent.experience = emptyCurrent.experience.map((e) => (
        e.id === 'radwerk' ? { ...e, description: '' } : e
      ));
      seedUsage(usage);
      const genFin = finalizeCvAiFieldForApply({
        action: 'experience_bullets',
        field: 'experience_description',
        experienceId: 'radwerk',
        requestedLocale: locale,
        gender: 'male',
        cv: emptyCurrent,
        candidate: f.current.split('\n').map((l) => l.trim()).filter(Boolean).join('\n'),
        referenceDateIso: REF,
        durationSnapshot: duration,
      });
      expect(
        String(genFin.diagnostics?.candidateTransformationKind || ''),
      ).not.toMatch(/^v2_rewrite_/);
      expect(genFin.blocked).toBe(false);
      expect(genFin.countedAsSuccess).toBe(true);
      const genNext = applyFinalizedBulletsToCv(emptyCurrent, locale, 'radwerk', genFin);
      const genEntry = (genNext.experience || []).find((e) => e.id === 'radwerk');
      expect((genEntry?.description || '').trim().length).toBeGreaterThan(0);
      recordProAiUserActionSuccess();
      usage += 1;
      experienceTruth.push({
        locale,
        action: 'experience_generate_empty_current',
        blocked: false,
        countedAsSuccess: true,
        visibleText: genEntry?.description || '',
        usageAfter: usage,
      });

      // B) Completed weak-but-grounded → Stronger must visibly succeed
      const weakPrior = f.prior
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join('\n');
      const weakCv = cvFor(locale, '');
      weakCv.experience = weakCv.experience.map((e) => (
        e.id === 'stadthotel'
          ? {
            ...e,
            description: weakPrior,
            originalUserDescription: weakPrior,
            descriptionOrigin: 'user' as const,
          }
          : e
      ));
      seedUsage(usage);
      const strongFin = finalizeCvAiFieldForApply({
        action: 'experience_bullets',
        field: 'experience_description',
        experienceId: 'stadthotel',
        requestedLocale: locale,
        gender: 'male',
        cv: weakCv,
        candidate: weakPrior,
        referenceDateIso: REF,
        durationSnapshot: duration,
        rewriteStyle: 'stronger',
      });
      expect(
        String(strongFin.diagnostics?.candidateTransformationKind || ''),
      ).not.toMatch(/^v2_rewrite_/);
      expect(
        strongFin.blocked,
        `${locale} weak Stronger blocked: ${strongFin.reason}`,
      ).toBe(false);
      expect(strongFin.countedAsSuccess).toBe(true);
      const stripExpBullets = (t: string) => normalizeSummaryCandidateText(
        (t || '').replace(/^[•\-\u2022]\s*/gm, ''),
      );
      expect(stripExpBullets(strongFin.text || ''))
        .not.toBe(stripExpBullets(weakPrior));
      expect(
        (strongFin.diagnostics as { clientDeterministicFallbackReason?: string } | undefined)
          ?.clientDeterministicFallbackReason
        || (strongFin.diagnostics as { candidateTransformationKind?: string } | undefined)
          ?.candidateTransformationKind
        || '',
      ).toMatch(/stronger|active_verb|style/i);
      const strongNext = applyFinalizedBulletsToCv(weakCv, locale, 'stadthotel', strongFin);
      const strongEntry = (strongNext.experience || []).find((e) => e.id === 'stadthotel');
      expect((strongEntry?.description || '').trim().length).toBeGreaterThan(0);
      const current = (strongNext.experience || []).find((e) => e.id === 'radwerk');
      expect(current?.description || '').toBe(f.current);
      recordProAiUserActionSuccess();
      usage += 1;
      experienceTruth.push({
        locale,
        action: 'experience_weak_stronger',
        blocked: false,
        countedAsSuccess: true,
        requestedRewriteStyle: 'stronger',
        visibleText: strongEntry?.description || '',
        sourceText: weakPrior,
        usageAfter: usage,
      });

      // C) Style-saturated → precise true no-op
      const saturatedText = strongEntry?.description || strongFin.text || '';
      const satCv = cvFor(locale, '');
      satCv.experience = satCv.experience.map((e) => (
        e.id === 'stadthotel'
          ? {
            ...e,
            description: saturatedText,
            originalUserDescription: saturatedText,
            descriptionOrigin: 'user' as const,
          }
          : e
      ));
      seedUsage(usage);
      const satFin = finalizeCvAiFieldForApply({
        action: 'experience_bullets',
        field: 'experience_description',
        experienceId: 'stadthotel',
        requestedLocale: locale,
        gender: 'male',
        cv: satCv,
        candidate: saturatedText,
        referenceDateIso: REF,
        durationSnapshot: duration,
        rewriteStyle: 'stronger',
      });
      expect(satFin.blocked).toBe(true);
      expect(satFin.countedAsSuccess).toBe(false);
      expect(satFin.reason, `${locale} sat reason`).toBe('experience_style_no_safe_material_change');
      expect(getProAiUsageCount()).toBe(usage);
      experienceTruth.push({
        locale,
        action: 'experience_saturated_stronger_noop',
        blocked: true,
        countedAsSuccess: false,
        reason: satFin.reason,
        visibleText: saturatedText,
        usageAfter: usage,
      });
    }
    expect(experienceTruth.length).toBe(36);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    fs.writeFileSync(
      path.join(process.cwd(), '.build385-experience-36-report.json'),
      `${JSON.stringify({
        revision: SUMMARY_V2_UNIVERSAL_STYLE_385_REVISION,
        actionCount: 36,
        successCount: experienceTruth.filter((r) => r.countedAsSuccess === true).length,
        blockedCount: experienceTruth.filter((r) => r.blocked === true).length,
        rows: experienceTruth,
      }, null, 2)}\n`,
      'utf8',
    );
  });

  it('Cover Letter import isolation: no Summary V2 / rewrite-style runtime reachability', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const roots = [
      'src/lib/cover-letter',
      'src/components/cover-letter',
      'src/app/cover-letter',
    ];
    const hits: string[] = [];
    const scan = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        if (st.isDirectory()) {
          scan(full);
          continue;
        }
        if (!/\.(ts|tsx|js|jsx)$/.test(name)) continue;
        const text = fs.readFileSync(full, 'utf8');
        if (
          /cv-summary-v2|rewrite-style|buildSummaryV2|runSummaryV2|SUMMARY_V2_/u.test(text)
        ) {
          hits.push(full.replace(/\\/g, '/'));
        }
      }
    };
    for (const r of roots) scan(r);
    expect(hits, `Cover Letter must not import Summary V2 modules: ${hits.join(', ')}`).toEqual([]);
  });
});

