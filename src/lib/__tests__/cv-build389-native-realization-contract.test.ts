/**
 * AAB-389 — Shared native realization contract for the Summary V2 surface.
 * Gender is authoritative, duration sentences are finite, duty chains stay
 * first-person, and coordination is native for every supported locale.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Locale } from '@/lib/i18n/translations';
import {
  finalizeCvAiFieldForApply,
  normalizeSummaryCandidateText,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import {
  setSummaryV2EnabledForTests,
  SUMMARY_V2_NATIVE_SURFACE_389_REVISION,
  SUMMARY_V2_GENDER_SURFACE_389_REVISION,
  buildSummaryV2ManifestForCv,
  buildSummaryV2StyledDeterministicText,
  buildSummaryV2DeterministicText,
  evaluateNativeRealizationContract,
  evaluateSummaryV2NativeSurface,
  analyzeStrongerNativeSurface,
  resolveSummaryV2GenderMode,
  detectUnresolvedGenderPlaceholder,
} from '@/lib/cv-summary-v2';
import {
  getProAiUsageCount,
  persistProAiRecord,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import {
  cvForUniversalStyle,
  UNIVERSAL_STYLE_FIXTURES,
} from '@/lib/__tests__/helpers/universal-style-fixtures';

const REF = '2026-07-01';

const LOCALES_12: Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'pt-BR', 'ru', 'sr', 'hr', 'hi', 'ar', 'ja',
];

/** Locales whose realization is gender-sensitive. */
const GENDERED_LOCALES: Locale[] = ['sr', 'hr', 'ru', 'hi'];

const GENDERS: Array<{ key: string; value: string | undefined }> = [
  { key: 'male', value: 'male' },
  { key: 'female', value: 'female' },
  { key: 'unspecified', value: undefined },
];

/** Visible gender placeholders that must never reach the user. */
const GENDER_PLACEHOLDER_RE =
  /radio\s*\/\s*la|radila?\s*\/\s*\p{L}{1,3}|работал\(а\)|занимал\(а\)|करता\s*\/\s*करती|था\s*\/\s*थी|izvršavao\s*\/\s*la/u;

/** Known malformed locale verb tokens. */
const MALFORMED_VERB_RE = /sustituyé|substituí\s+peças|\bsubstitui\b(?=[^\p{L}])/u;

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

/** One real finalize/apply round trip through the top-level app path. */
function runAction(options: {
  locale: Locale;
  gender: string | undefined;
  action: 'summary_generate' | 'summary_shorter' | 'summary_stronger' | 'summary_professional';
  existingSummary: string;
}) {
  const cv = cvForUniversalStyle(options.locale, options.existingSummary);
  if (cv.personal) cv.personal.gender = options.gender || '';
  const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
  const rewriteStyle = options.action === 'summary_shorter'
    ? 'shorter'
    : options.action === 'summary_stronger'
      ? 'stronger'
      : options.action === 'summary_professional'
        ? 'professional'
        : undefined;
  return finalizeCvAiFieldForApply({
    field: 'summary',
    action: options.action,
    requestedLocale: options.locale,
    gender: options.gender,
    cv,
    candidate: options.action === 'summary_generate' && !options.existingSummary
      ? ''
      : 'BAD_PROVIDER_TEAM_LEADER_99',
    durationSnapshot: duration,
    referenceDateIso: REF,
    ...(rewriteStyle ? { rewriteStyle } : {}),
  });
}

function deterministicSource(locale: Locale, gender: string | undefined): string {
  const manifest = buildSummaryV2ManifestForCv({
    cv: cvForUniversalStyle(locale, ''),
    locale,
    gender,
    referenceDateIso: REF,
  });
  return manifest ? buildSummaryV2DeterministicText(manifest) : '';
}

describe('AAB-389 native realization contract', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    seedUsage(12);
  });
  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('exports 389 native-surface + gender revisions in the runtime marker set', () => {
    expect(SUMMARY_V2_NATIVE_SURFACE_389_REVISION)
      .toBe('summary-v2-native-surface-389-v1');
    expect(SUMMARY_V2_GENDER_SURFACE_389_REVISION)
      .toBe('summary-v2-gender-surface-389-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_V2_NATIVE_SURFACE_389_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_V2_GENDER_SURFACE_389_REVISION);
  });

  it('resolves selectedGender authoritatively and detects placeholders', () => {
    expect(resolveSummaryV2GenderMode('male')).toBe('male');
    expect(resolveSummaryV2GenderMode('female')).toBe('female');
    expect(resolveSummaryV2GenderMode('')).toBe('unspecified');
    expect(resolveSummaryV2GenderMode(undefined)).toBe('unspecified');
    expect(resolveSummaryV2GenderMode('muški')).toBe('male');
    expect(resolveSummaryV2GenderMode('женский')).toBe('female');

    expect(detectUnresolvedGenderPlaceholder('Prethodno sam radio/la kao X')).toBe(true);
    expect(detectUnresolvedGenderPlaceholder('Ранее я работал(а) как X')).toBe(true);
    expect(detectUnresolvedGenderPlaceholder('मैं काम करता/करती हूँ')).toBe(true);
    expect(detectUnresolvedGenderPlaceholder('मैं काम करता था')).toBe(false);
    expect(detectUnresolvedGenderPlaceholder('Prethodno sam radio kao X')).toBe(false);
  });

  it('12 locales × 3 genders × 4 actions: complete native visible text', () => {
    for (const locale of LOCALES_12) {
      const fixture = UNIVERSAL_STYLE_FIXTURES[locale];
      for (const gender of GENDERS) {
        const source = deterministicSource(locale, gender.value);
        expect(source.length, `${locale}/${gender.key} source`).toBeGreaterThan(20);

        const actions = [
          { action: 'summary_generate' as const, existing: '' },
          { action: 'summary_generate' as const, existing: source },
          { action: 'summary_shorter' as const, existing: source },
          { action: 'summary_stronger' as const, existing: source },
          { action: 'summary_professional' as const, existing: source },
        ];

        for (const step of actions) {
          const label = `${locale}/${gender.key}/${step.action}${step.existing ? '' : '-empty'}`;
          const fin = runAction({
            locale,
            gender: gender.value,
            action: step.action,
            existingSummary: step.existing,
          });
          expect(fin.blocked, label).toBe(false);
          const text = fin.text || '';
          expect(text.length, label).toBeGreaterThan(20);

          // Gender placeholders never reach visible text.
          expect(text, label).not.toMatch(GENDER_PLACEHOLDER_RE);
          expect(detectUnresolvedGenderPlaceholder(text), label).toBe(false);
          expect(text, label).not.toMatch(MALFORMED_VERB_RE);

          // Shared realization contract must be green for the visible text.
          const contract = evaluateNativeRealizationContract({ text, locale });
          expect(contract.nativeRealizationRejectionReasons, label).toEqual([]);
          expect(contract.finiteDurationSentencePassed, label).toBe(true);
          expect(contract.firstPersonPredicateChainPassed, label).toBe(true);
          expect(contract.localeVerbMorphologyPassed, label).toBe(true);
          expect(contract.roleCaseValidationPassed, label).toBe(true);
          expect(contract.nativeCoordinationValidationPassed, label).toBe(true);
          expect(contract.sentenceCompletenessPassed, label).toBe(true);
          expect(
            evaluateSummaryV2NativeSurface({ text, locale }).nativeSurfaceValidationPassed,
            label,
          ).toBe(true);

          // Facts, duration and script.
          expect(fin.diagnostics?.coveredCurrentDutyFactCount, label).toBe(3);
          expect(fin.diagnostics?.coveredPriorDutyFactCount, label).toBe(3);
          expect(fin.diagnostics?.durationExpressionCount ?? 1, label).toBe(1);
          if (fixture.scriptProbe) expect(text, label).toMatch(fixture.scriptProbe);
          if (fixture.latinLeak) expect(text, label).not.toMatch(fixture.latinLeak);

          // Entry-owned employers, no cross-entry leakage of the other role.
          expect(text, label).toContain('RadWerk');
          expect(text, label).toContain('StadtHotel');
        }
      }
    }
  });

  it('male / female / unspecified emit exactly one correct form per locale', () => {
    const expectations: Record<string, { male: RegExp; female: RegExp; banned: RegExp }> = {
      sr: {
        male: /Prethodno sam radio\b/u,
        female: /Prethodno sam radila\b/u,
        banned: /radio\s*\/\s*la/u,
      },
      hr: {
        male: /Prethodno sam radio\b/u,
        female: /Prethodno sam radila\b/u,
        banned: /radio\s*\/\s*la/u,
      },
      ru: {
        male: /я работал(?=[^\p{L}])/u,
        female: /я работала(?=[^\p{L}])/u,
        banned: /работал\(а\)/u,
      },
      hi: {
        male: /काम करता/u,
        female: /काम करती/u,
        banned: /करता\s*\/\s*करती|था\s*\/\s*थी/u,
      },
    };

    for (const locale of GENDERED_LOCALES) {
      const exp = expectations[locale];
      for (const gender of GENDERS) {
        const source = deterministicSource(locale, gender.value);
        const fin = runAction({
          locale,
          gender: gender.value,
          action: 'summary_stronger',
          existingSummary: source,
        });
        expect(fin.blocked, `${locale}/${gender.key}`).toBe(false);
        const text = fin.text || '';
        expect(text, `${locale}/${gender.key}`).not.toMatch(exp.banned);
        if (gender.key === 'female') {
          expect(text, `${locale}/female`).toMatch(exp.female);
        } else {
          // male and unspecified both realize the unmarked (masculine) form.
          expect(text, `${locale}/${gender.key}`).toMatch(exp.male);
        }
      }
    }
  });

  it('locale-specific fixed defects are gone from visible Stronger output', () => {
    const checks: Partial<Record<Locale, (text: string) => void>> = {
      es: (t) => {
        expect(t).toMatch(/sustituí/u);
        expect(t).not.toMatch(/sustituyé/u);
        expect(t).toMatch(/a la vez que/u);
      },
      fr: (t) => {
        expect(t).not.toMatch(/ainsi que remplace(?=[^\p{L}])/u);
        expect(t).not.toMatch(/ainsi que remplaçais/u);
        expect(t).toMatch(/ainsi que j(?:e |')/u);
      },
      ar: (t) => {
        expect(t).toMatch(/^أمتلك/u);
        expect(t).not.toMatch(/[\u0600-\u06FF]\s*,/u);
        expect(t).toMatch(/راجعت/u);
        expect(t).toMatch(/أعددت/u);
        expect(t).toMatch(/ضبطت/u);
        expect(t).not.toMatch(/ت\u0651/u);
      },
      sr: (t) => {
        expect(t).toMatch(/^Imam /u);
        expect(t).not.toMatch(/^Sa oko/u);
      },
      hr: (t) => {
        expect(t).toMatch(/^Imam /u);
        expect(t).not.toMatch(/^S ukupno oko/u);
        expect(t).toMatch(/gdje/u);
        expect(t).not.toMatch(/(?:^|[^\p{L}])gde(?=[^\p{L}])/u);
      },
      ru: (t) => {
        expect(t).toMatch(/^У меня /u);
        expect(t).not.toMatch(/работа(?:ю|л|ла)\s+как\s/u);
        expect(t).toMatch(/, а также /u);
      },
      'pt-BR': (t) => {
        expect(t).toMatch(/substituo/u);
        expect(t).not.toMatch(/(?:^|[^\p{L}])substitui(?=[^\p{L}])/u);
      },
      hi: (t) => {
        expect(t).toMatch(/मेरे पास .+ है।/u);
        expect(t).not.toMatch(/^लगभग साढ़े/u);
      },
      ja: (t) => {
        expect(t).toMatch(/実務経験があります。/u);
        expect(t).not.toMatch(/通算で約5年半。/u);
        expect(t).not.toMatch(/、また/u);
        expect(t).not.toMatch(/(?:う|る)、/u);
        expect(t).not.toMatch(/した、/u);
      },
      it: (t) => {
        // A generic manner claim is not source-authorized and must be absent.
        expect(t).not.toMatch(/con rigore/u);
        expect(t).not.toMatch(/con ricore/u);
      },
    };

    for (const [loc, check] of Object.entries(checks)) {
      const locale = loc as Locale;
      const source = deterministicSource(locale, 'male');
      const fin = runAction({
        locale,
        gender: 'male',
        action: 'summary_stronger',
        existingSummary: source,
      });
      expect(fin.blocked, locale).toBe(false);
      expect(fin.diagnostics?.strongerStyleFulfilled, locale).toBe(true);
      expect(fin.diagnostics?.nativeStrongSurfacePassed, locale).toBe(true);
      check?.(fin.text || '');
    }
  });

  it('negatives: contract rejects every reported defect class', () => {
    const cases: Array<{ label: string; text: string; locale: Locale; reason: RegExp }> = [
      {
        label: 'es malformed preterite',
        locale: 'es',
        text: 'Cuento con cinco años de experiencia. Actualmente trabajo como X en Y, donde sustituyé piezas.',
        reason: /locale_verb_morphology/u,
      },
      {
        label: 'pt-BR third-person present',
        locale: 'pt-BR',
        text: 'Tenho cinco anos de experiência. Atualmente trabalho como X na Y, onde substitui peças.',
        reason: /locale_verb_morphology|third_person_duty/u,
      },
      {
        label: 'ar third-person prior duties',
        locale: 'ar',
        text: 'أمتلك خمس سنوات من الخبرة. سابقاً عملت كـمساعد في Y، حيث راجع الدراجات وأعدّ الملاحظات.',
        reason: /third_person_duty/u,
      },
      {
        label: 'sr slash gender',
        locale: 'sr',
        text: 'Imam pet godina iskustva. Prethodno sam radio/la kao X u Y, gde sam pregledao bicikle.',
        reason: /unresolved_gender_placeholder/u,
      },
      {
        label: 'hr slash gender',
        locale: 'hr',
        text: 'Imam pet godina iskustva. Prethodno sam radio/la kao X u Y, gdje sam pregledavao bicikle.',
        reason: /unresolved_gender_placeholder/u,
      },
      {
        label: 'ru parenthetical gender',
        locale: 'ru',
        text: 'У меня пять лет опыта. Ранее я работал(а) на должности X в Y, где я проверял велосипеды.',
        reason: /unresolved_gender_placeholder/u,
      },
      {
        label: 'hi slash gender',
        locale: 'hi',
        text: 'मेरे पास पाँच वर्षों का अनुभव है। मैं X के रूप में काम करता/करती हूँ।',
        reason: /unresolved_gender_placeholder/u,
      },
      {
        label: 'sr nominal duration fragment',
        locale: 'sr',
        text: 'Sa oko pet i po godina iskustva. Trenutno radim kao X u Y, gde obavljam održavanje.',
        reason: /nominal_duration_fragment|incomplete_sentence/u,
      },
      {
        label: 'ja incomplete duration',
        locale: 'ja',
        text: '通算で約5年半。現在、YでXとして勤務しています。',
        reason: /nominal_duration_fragment|incomplete_sentence/u,
      },
      {
        label: 'ja mechanical joins',
        locale: 'ja',
        text: '通算で約5年半の実務経験があります。現在、YでXとして勤務しています。業務では整備を行う、また点検する。',
        reason: /unnatural_coordination/u,
      },
      {
        label: 'ru invalid role case',
        locale: 'ru',
        text: 'У меня пять лет опыта. Сейчас я работаю как Веломеханик в Y, где я проверяю велосипеды.',
        reason: /invalid_role_case/u,
      },
      {
        label: 'fr conjunction without subject',
        locale: 'fr',
        text: "J'ai cinq ans d'expérience. Je travaille actuellement comme X chez Y, où j'inspecte les vélos, ainsi que remplace les pièces.",
        reason: /unnatural_coordination/u,
      },
      {
        label: 'ar latin punctuation',
        locale: 'ar',
        text: 'أمتلك خمس سنوات من الخبرة. أعمل حالياً كـميكانيكي في Y، حيث أفحص الدراجات, وأستبدل القطع.',
        reason: /unnatural_coordination/u,
      },
      {
        label: 'hi standalone subordinate fragment',
        locale: 'hi',
        text: 'मेरे पास पाँच वर्षों का अनुभव है। जहाँ साइकिलों की जाँच।',
        reason: /incomplete_sentence/u,
      },
    ];

    for (const c of cases) {
      const contract = evaluateNativeRealizationContract({ text: c.text, locale: c.locale });
      expect(
        contract.nativeRealizationRejectionReasons.join(' '),
        c.label,
      ).toMatch(c.reason);

      const native = evaluateSummaryV2NativeSurface({ text: c.text, locale: c.locale });
      expect(native.nativeSurfaceValidationPassed, c.label).toBe(false);

      const strong = analyzeStrongerNativeSurface({
        sourceText: 'source text placeholder',
        candidateText: c.text,
        locale: c.locale,
      });
      expect(strong.nativeStrongSurfacePassed, c.label).toBe(false);
    }
  });

  it('Serbian male Stronger: no-op when no grounded predicate-level strengthening exists', () => {
    seedUsage(40);
    const source = buildSummaryV2StyledDeterministicText(
      buildSummaryV2ManifestForCv({
        cv: cvForUniversalStyle('sr', ''),
        locale: 'sr',
        gender: 'male',
        referenceDateIso: REF,
      }),
      'shorter',
    );
    const cv = cvForUniversalStyle('sr', source);
    const fin = finalizeCvAiFieldForApply({
      field: 'summary',
      action: 'summary_stronger',
      requestedLocale: 'sr',
      gender: 'male',
      cv,
      candidate: 'BAD_PROVIDER',
      durationSnapshot: buildExperienceDurationSnapshot(cv.experience, REF),
      referenceDateIso: REF,
      rewriteStyle: 'stronger',
    });
    expect(fin.blocked).toBe(true);
    expect(fin.countedAsSuccess).toBe(false);
    expect(fin.reason).toBe('style_no_safe_material_change');
    expect(hashNorm(fin.text || '')).toBe(hashNorm(source));
    expect(getProAiUsageCount()).toBe(40);
  });
});
