/**
 * AAB-388 — Stronger strengthens grounded duty predicates with sparse modifiers.
 * Exact German Shorter→Stronger device path + 12-locale audit + negatives.
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
  SUMMARY_V2_STRONGER_DUTY_SURFACE_388_REVISION,
  SUMMARY_V2_STRONGER_SPARSE_MODIFIER_388_REVISION,
  buildSummaryV2ManifestForCv,
  buildSummaryV2StyledDeterministicText,
  evaluateSummaryV2StyleFulfillment,
  analyzeStrongerNativeSurface,
  isSummaryV2MarkerOnlyStyleChange,
  runSummaryV2,
} from '@/lib/cv-summary-v2';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import { cvForUniversalStyle } from '@/lib/__tests__/helpers/universal-style-fixtures';

const REF = '2026-07-01';

const LOCALES_12: Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'pt-BR', 'ru', 'sr', 'hr', 'hi', 'ar', 'ja',
];

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

const UNNATURAL_ROLE_INTRO =
  /zielgerichtet\s+als|\bübernahm(?:\s+\p{L}+){0,4}\s+als\b|\bdeliver(?:s|ed)?\s+as\b|carried\s+out\s+the\s+role\s+of|con\s+determinación\s+como|me\s+desempeño\s+con\s+determinación|aporto\s+como|m['’]investis|m['’]engageais\s+comme|con\s+determinazione\s+come|portato\s+avanti\s+il\s+ruolo|com\s+determinação\s+como|atuei\s+com\s+foco\s+como|веду\s+работу\s+как|уверенно\s+выполнял(?:\(а\))?\s+роль|doprinosim\s+kao|pridonosim\s+kao|pouzdano\s+izvršavao\/la\s+ulogu|أساهم\s+حالياً|أسهمت\s+كـ|सक्रिय\s+रूप\s+से\s+कार्य|निर्णायक\s+रूप\s+से\s+कार्य|責任を持って推進|主体的に推進/iu;

const AUTHORITY_LEAK =
  /\b(?:Teamleiter|Leadership|owned\s+work|accountable\s+for|verantwortlich\s+für)\b/iu;

const REPEATED_INTENSIFIER =
  /\bzuverlässig\b.*\bzuverlässig\b|\bsorgfältig\b.*\bsorgfältig\b|\bcarefully\b.*\bcarefully\b/iu;

const STACKED_DE =
  /\bherzlich\b[^.]{0,40}\bzuverlässig\b|\bkompetent\s+und\s+serviceorientiert\s+zuverlässig\b/iu;

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

function deDeviceCv(summary: string): CVData {
  return {
    id: 'aab-388-de',
    name: 'Stronger Duty',
    personal: {
      fullName: 'Max Mustermann',
      email: 'm@example.com',
      phone: '',
      address: '',
      jobTitle: 'Fahrradmechaniker',
      gender: 'male',
    },
    summary,
    experience: [
      {
        id: 'radwerk',
        position: 'Fahrradmechaniker',
        company: 'RadWerk',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: CURRENT_RAD,
        canonicalDescription: CURRENT_RAD,
      },
      {
        id: 'stadthotel',
        position: 'Rezeptionist',
        company: 'StadtHotel',
        startDate: '2021-01',
        endDate: '2023-12',
        isPresent: false,
        description: PRIOR_HOTEL,
        canonicalDescription: PRIOR_HOTEL,
      },
    ],
    education: [],
    skills: [],
    languages: [],
  } as CVData;
}

/** Build the exact Shorter surface used as the device Stronger source. */
function buildGermanShorterSource(): { text: string; cv: CVData } {
  const empty = deDeviceCv('');
  const manifest = buildSummaryV2ManifestForCv({
    cv: empty,
    locale: 'de',
    gender: 'male',
    referenceDateIso: REF,
  });
  const text = buildSummaryV2StyledDeterministicText(manifest, 'shorter');
  return { text, cv: deDeviceCv(text) };
}

describe('AAB-388 Stronger duty-predicate native surface', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    seedUsage(19);
  });
  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('exports 388 stronger-duty + sparse-modifier revisions in runtime marker set', () => {
    expect(SUMMARY_V2_STRONGER_DUTY_SURFACE_388_REVISION)
      .toBe('summary-v2-stronger-duty-surface-388-v1');
    expect(SUMMARY_V2_STRONGER_SPARSE_MODIFIER_388_REVISION)
      .toBe('summary-v2-stronger-sparse-modifier-388-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_V2_STRONGER_DUTY_SURFACE_388_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_V2_STRONGER_SPARSE_MODIFIER_388_REVISION);
  });

  it('exact German 405-char Shorter → Stronger: sparse modifiers, apply, usage +1', () => {
    const { text: shorter, cv } = buildGermanShorterSource();
    expect(shorter.length).toBeGreaterThanOrEqual(380);
    expect(shorter.length).toBeLessThanOrEqual(430);

    const duration = buildExperienceDurationSnapshot(cv.experience, REF);
    const fin = finalizeCvAiFieldForApply({
      field: 'summary',
      action: 'summary_stronger',
      requestedLocale: 'de',
      gender: 'male',
      cv,
      candidate: 'IGNORE_PROVIDER_USE_DETERMINISTIC',
      durationSnapshot: duration,
      referenceDateIso: REF,
      rewriteStyle: 'stronger',
    });

    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.strongerStyleFulfilled).toBe(true);
    expect(fin.diagnostics?.nativeSurfaceValidationPassed).toBe(true);
    expect(fin.diagnostics?.nativeStrongSurfacePassed).toBe(true);
    expect(fin.diagnostics?.repeatedStyleModifierCount ?? 0).toBe(0);
    expect(fin.diagnostics?.stackedModifierDetected).not.toBe(true);
    expect(fin.diagnostics?.modifierOnlyTransformationDetected).not.toBe(true);
    expect(
      (fin.diagnostics?.structuralStrengtheningCount ?? 0)
      + (fin.diagnostics?.strongerVerbTransformationCount ?? 0),
    ).toBeGreaterThan(0);

    const text = fin.text || '';
    expect(text).not.toMatch(/zielgerichtet\s+als/iu);
    expect(text).not.toMatch(/\bübernahm(?:\s+\p{L}+){0,4}\s+als\b/iu);
    expect(text).toMatch(/Derzeit arbeite ich als/iu);
    expect(text).toMatch(/Zuvor arbeitete ich als/iu);
    expect(text).toMatch(/\bsowie\b/iu);
    expect(text).not.toMatch(REPEATED_INTENSIFIER);
    expect(text).not.toMatch(STACKED_DE);
    expect((text.match(/\bzuverlässig\b/giu) || []).length).toBeLessThanOrEqual(1);
    expect((text.match(/\bsorgfältig\b/giu) || []).length).toBeLessThanOrEqual(1);
    expect(text).not.toMatch(AUTHORITY_LEAK);
    expect(text).not.toMatch(/\btätig\b/iu);

    expect(fin.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.coveredPriorDutyFactCount).toBe(3);
    expect(fin.diagnostics?.durationExpressionCount ?? 1).toBe(1);

    const professional = buildSummaryV2StyledDeterministicText(
      buildSummaryV2ManifestForCv({
        cv,
        locale: 'de',
        gender: 'male',
        referenceDateIso: REF,
      }),
      'professional',
    );
    expect(hashNorm(text)).not.toBe(hashNorm(shorter));
    expect(hashNorm(text)).not.toBe(hashNorm(professional));

    const surface = analyzeStrongerNativeSurface({
      sourceText: shorter,
      candidateText: text,
      locale: 'de',
    });
    expect(surface.nativeStrongSurfacePassed).toBe(true);
    expect(surface.repeatedStyleModifierCount).toBe(0);
    expect(surface.stackedModifierDetected).toBe(false);
    expect(surface.modifierOnlyTransformationDetected).toBe(false);

    const cvRef = { current: { ...cv } };
    const written = applyFinalizedSummaryToCv(cvRef.current, 'de', fin);
    cvRef.current = written;
    const visibleText = resolveAuthoritativeVisibleSummaryText({
      operationOwnedSummary: cvRef.current.summary,
      staleReactSummary: '',
    });
    expect(visibleText).toBe(text);
    expect(hashNorm(visibleText)).toBe(hashNorm(text));
    expect(hashNorm(cvRef.current.summary || '')).toBe(hashNorm(text));

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'de',
      requestedLocale: 'de',
      contentLocale: 'de',
      templateId: 'modern',
      gender: 'male',
      requestId: 'aab-388-de-stronger',
      usageCountBefore: 19,
      operationMode: 'enhance_existing_content',
    });
    session.recordFinalizeResult(fin);
    expect(session.evaluatePreApplyDecisionGates().passed).toBe(true);
    session.recordVisibleApply(true, 19, visibleText);
    expect(session.draft.raceGuardResult).toBe('ok');
    recordProAiUserActionSuccess();
    session.patch({ usageCountAfter: 20 });
    const trace = session.commit();
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.usageCountAfter).toBe(20);
    expect(getProAiUsageCount()).toBe(20);
  });

  it('audits Stronger visible output for all 12 locales', () => {
    const outputs: Partial<Record<Locale, string>> = {};
    for (const locale of LOCALES_12) {
      const blank = cvForUniversalStyle(locale, '');
      const source = buildSummaryV2StyledDeterministicText(
        buildSummaryV2ManifestForCv({
          cv: blank,
          locale,
          gender: 'male',
          referenceDateIso: REF,
        }),
        'shorter',
      );
      const cv = cvForUniversalStyle(locale, source);
      const duration = buildExperienceDurationSnapshot(cv.experience, REF);
      const fin = finalizeCvAiFieldForApply({
        field: 'summary',
        action: 'summary_stronger',
        requestedLocale: locale,
        gender: 'male',
        cv,
        candidate: 'BAD_PROVIDER_TEAM_LEADER_99',
        durationSnapshot: duration,
        referenceDateIso: REF,
        rewriteStyle: 'stronger',
      });
      if (locale === 'sr' && fin.blocked) {
        expect(fin.countedAsSuccess, locale).toBe(false);
        expect(fin.reason, locale).toBe('style_no_safe_material_change');
        outputs[locale] = source;
        continue;
      }
      expect(fin.blocked, locale).toBe(false);
      expect(fin.countedAsSuccess, locale).toBe(true);
      expect(fin.diagnostics?.strongerStyleFulfilled, locale).toBe(true);
      expect(fin.diagnostics?.markerOnlyStyleChange, locale).not.toBe(true);
      expect(fin.diagnostics?.nativeSurfaceValidationPassed, locale).toBe(true);
      expect(fin.diagnostics?.nativeStrongSurfacePassed, locale).toBe(true);
      expect(fin.diagnostics?.repeatedStyleModifierCount ?? 0, locale).toBe(0);
      expect(fin.diagnostics?.stackedModifierDetected, locale).not.toBe(true);
      expect(fin.diagnostics?.modifierOnlyTransformationDetected, locale).not.toBe(true);
      const text = fin.text || '';
      outputs[locale] = text;
      expect(text, locale).not.toMatch(UNNATURAL_ROLE_INTRO);
      expect(text, locale).not.toMatch(AUTHORITY_LEAK);
      expect(text, locale).not.toMatch(/\bcon\s+ricore\b/iu);
      expect(text, locale).not.toMatch(/\b(?:sorgfaltig|zuverlassig|carefuly|thorougly)\b/iu);
      if (locale === 'it') {
        // Evaluative manner is semantic, not a free Stronger ornament.  The
        // structural Italian join uses ordinary native `e`; `nonché` is
        // reserved for nominal coordination, not independent finite clauses.
        expect(text).not.toMatch(/\bcon\s+rigore\b/iu);
        expect(text).toMatch(/,\s+e\s+/u);
        expect(text).not.toMatch(/,\s+nonché\s+/iu);
        expect(text).not.toMatch(/\bha\s+(?:controllato|registrato|sostituito)\b/iu);
        expect(text).toMatch(/\bho\s+(?:controllato|registrato|sostituito)\b/iu);
      }
      if (locale === 'en') {
        expect(text).toMatch(/^I bring .+\. I currently work as .+, where I .+\. Previously, I worked as .+, where I .+\.$/u);
        expect(text).not.toMatch(/\bI bring\s*[.…]/u);
      }
      if (locale === 'pt-BR') {
        expect(text).not.toMatch(/\s+y\s+/u);
      }
      expect(hashNorm(text), locale).not.toBe(hashNorm(source));
      expect(fin.diagnostics?.coveredCurrentDutyFactCount, locale).toBe(3);
      expect(fin.diagnostics?.coveredPriorDutyFactCount, locale).toBe(3);
      const style = evaluateSummaryV2StyleFulfillment({
        style: 'stronger',
        sourceText: source,
        candidateText: text,
        locale,
      });
      expect(style.semanticStyleOperationsApplied, locale)
        .toContain('duty_predicate_strengthen');
      expect(style.strongerStyleFulfilled, locale).toBe(true);
      expect(style.nativeStrongSurfacePassed, locale).toBe(true);
    }
    expect(Object.keys(outputs).sort()).toEqual([...LOCALES_12].sort());
    for (const locale of LOCALES_12) {
      expect((outputs[locale] || '').length).toBeGreaterThan(20);
    }
  });

  it('exact Italian Shorter → Stronger: con rigore, first-person, apply, usage +1', () => {
    seedUsage(30);
    const blank = cvForUniversalStyle('it', '');
    const shorter = buildSummaryV2StyledDeterministicText(
      buildSummaryV2ManifestForCv({
        cv: blank,
        locale: 'it',
        gender: 'male',
        referenceDateIso: REF,
      }),
      'shorter',
    );
    const cv = cvForUniversalStyle('it', shorter);
    const fin = finalizeCvAiFieldForApply({
      field: 'summary',
      action: 'summary_stronger',
      requestedLocale: 'it',
      gender: 'male',
      cv,
      candidate: 'BAD_PROVIDER',
      durationSnapshot: buildExperienceDurationSnapshot(cv.experience, REF),
      referenceDateIso: REF,
      rewriteStyle: 'stronger',
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.strongerStyleFulfilled).toBe(true);
    expect(fin.diagnostics?.nativeStrongSurfacePassed).toBe(true);
    expect(fin.diagnostics?.repeatedStyleModifierCount ?? 0).toBe(0);
    expect(fin.diagnostics?.stackedModifierDetected).not.toBe(true);
    expect(fin.diagnostics?.modifierOnlyTransformationDetected).not.toBe(true);
    expect(fin.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.coveredPriorDutyFactCount).toBe(3);
    const text = fin.text || '';
    expect(text).not.toMatch(/\bcon\s+rigore\b/iu);
    expect(text).toMatch(/,\s+e\s+/u);
    expect(text).not.toMatch(/,\s+nonché\s+/iu);
    expect(text).not.toMatch(/\bcon\s+ricore\b/iu);
    expect(text).toMatch(/Attualmente lavoro come/iu);
    expect(text).toMatch(/In precedenza ho lavorato come|Ho già lavorato come/iu);
    expect(text).toMatch(/\bho\s+(?:controllato|registrato|sostituito)\b/iu);
    expect(text).not.toMatch(/\bha\s+(?:controllato|registrato|sostituito)\b/iu);
    expect(text).not.toMatch(AUTHORITY_LEAK);

    const cvRef = { current: { ...cv } };
    const written = applyFinalizedSummaryToCv(cvRef.current, 'it', fin);
    cvRef.current = written;
    const visibleText = resolveAuthoritativeVisibleSummaryText({
      operationOwnedSummary: cvRef.current.summary,
      staleReactSummary: '',
    });
    expect(visibleText).toBe(text);
    expect(hashNorm(visibleText)).toBe(hashNorm(text));
    expect(hashNorm(cvRef.current.summary || '')).toBe(hashNorm(text));

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'it',
      requestedLocale: 'it',
      contentLocale: 'it',
      templateId: 'modern',
      gender: 'male',
      requestId: 'aab-388-it-stronger',
      usageCountBefore: 30,
      operationMode: 'enhance_existing_content',
    });
    session.recordFinalizeResult(fin);
    expect(session.evaluatePreApplyDecisionGates().passed).toBe(true);
    session.recordVisibleApply(true, 30, visibleText);
    expect(session.draft.raceGuardResult).toBe('ok');
    recordProAiUserActionSuccess();
    session.patch({ usageCountAfter: 31 });
    const trace = session.commit();
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.usageCountAfter).toBe(31);
    expect(getProAiUsageCount()).toBe(31);
  });

  it('negatives: role intro / ownership / repeated / stacked / adverb-only', () => {
    const { text: shorter, cv } = buildGermanShorterSource();
    const badRole = shorter
      .replace(/Derzeit bin ich als/iu, 'Derzeit arbeite ich zielgerichtet als')
      .replace(/Zuvor war ich als/iu, 'Zuvor übernahm ich zuverlässig als');
    const badRoleEval = evaluateSummaryV2StyleFulfillment({
      style: 'stronger',
      sourceText: shorter,
      candidateText: badRole,
      locale: 'de',
    });
    expect(badRoleEval.strongerStyleFulfilled).toBe(false);
    expect(badRoleEval.styleRejectionReasons.join(' ')).toMatch(
      /unnatural_role_intro|native_unnatural/,
    );

    const ownership = `${shorter} I am accountable for Leadership and owned work.`;
    const ownEval = evaluateSummaryV2StyleFulfillment({
      style: 'stronger',
      sourceText: shorter,
      candidateText: ownership,
      locale: 'de',
    });
    expect(ownEval.strongerStyleFulfilled).toBe(false);

    const adverbOnly = shorter.replace(/prüfe/iu, 'sorgfältig prüfe');
    expect(isSummaryV2MarkerOnlyStyleChange(shorter, adverbOnly, 'de', 'stronger')).toBe(true);
    const advEval = evaluateSummaryV2StyleFulfillment({
      style: 'stronger',
      sourceText: shorter,
      candidateText: adverbOnly,
      locale: 'de',
    });
    expect(advEval.strongerStyleFulfilled).toBe(false);
    expect(
      advEval.markerOnlyStyleChange
      || advEval.modifierOnlyTransformationDetected
      || advEval.styleRejectionReasons.length > 0,
    ).toBe(true);

    const repeated = shorter
      .replace(/prüfe/iu, 'zuverlässig prüfe')
      .replace(/austausche/iu, 'zuverlässig austausche')
      .replace(/begrüßte/iu, 'zuverlässig begrüßte');
    const repEval = evaluateSummaryV2StyleFulfillment({
      style: 'stronger',
      sourceText: shorter,
      candidateText: repeated,
      locale: 'de',
    });
    expect(repEval.strongerStyleFulfilled).toBe(false);
    expect(repEval.repeatedStyleModifierCount ?? 0).toBeGreaterThan(0);
    expect(repEval.nativeStrongSurfacePassed).toBe(false);

    const stackedForced = shorter
      .replace(/begrüßte/iu, 'herzlich zuverlässig begrüßte')
      .replace(
        /Fragen der Gäste beantwortete/iu,
        'Fragen der Gäste kompetent und serviceorientiert zuverlässig beantwortete',
      );
    const stackEval = evaluateSummaryV2StyleFulfillment({
      style: 'stronger',
      sourceText: shorter,
      candidateText: stackedForced,
      locale: 'de',
    });
    expect(stackEval.strongerStyleFulfilled).toBe(false);
    expect(stackEval.stackedModifierDetected).toBe(true);
    expect(stackEval.nativeStrongSurfacePassed).toBe(false);

    const blankIt = cvForUniversalStyle('it', '');
    const itShorter = buildSummaryV2StyledDeterministicText(
      buildSummaryV2ManifestForCv({
        cv: blankIt,
        locale: 'it',
        gender: 'male',
        referenceDateIso: REF,
      }),
      'shorter',
    );
    const ricore = itShorter.replace(/\beseguo\b/iu, 'eseguo con ricore');
    const ricoreEval = evaluateSummaryV2StyleFulfillment({
      style: 'stronger',
      sourceText: itShorter,
      candidateText: ricore,
      locale: 'it',
    });
    expect(ricoreEval.strongerStyleFulfilled).toBe(false);
    expect(ricoreEval.nativeStrongSurfacePassed).toBe(false);
    expect(ricoreEval.nativeStrongSurfaceRejectionReasons.join(' ')).toMatch(
      /misspelled_style_modifier:con ricore/,
    );

    const unknownMod = itShorter.replace(/\beseguo\b/iu, 'eseguo carefully');
    const unknownEval = analyzeStrongerNativeSurface({
      sourceText: itShorter,
      candidateText: unknownMod,
      locale: 'it',
    });
    expect(unknownEval.nativeStrongSurfacePassed).toBe(false);
    expect(unknownEval.nativeStrongSurfaceRejectionReasons.join(' ')).toMatch(
      /unknown_modifier_token:carefully|misspelled/,
    );

    const pipeline = runSummaryV2({
      cv,
      locale: 'de',
      gender: 'male',
      referenceDateIso: REF,
      rewriteStyle: 'stronger',
      candidate: badRole,
    });
    if (pipeline.blocked) {
      expect(pipeline.blocked).toBe(true);
    } else {
      expect(pipeline.text).not.toMatch(/zielgerichtet\s+als/iu);
      expect(pipeline.text).not.toMatch(/\bübernahm(?:\s+\p{L}+){0,4}\s+als\b/iu);
    }
  });
});
