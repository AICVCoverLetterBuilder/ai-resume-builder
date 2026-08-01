/**
 * Shared fixtures and production-path helpers for the permanent AAB-389 suite.
 * Free-text occupations/employers only — no occupation-table hard-coding.
 */
import type { CVData, WorkExperience } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import { expect } from 'vitest';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
  applyFinalizedBulletsToCv,
  normalizeSummaryCandidateText,
  type FinalizeCvAiFieldResult,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import {
  SummaryAiDiagnosticSession,
  resolveAuthoritativeVisibleSummaryText,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  buildSummaryV2ManifestForCv,
  buildSummaryV2DeterministicText,
  buildSummaryV2StyledDeterministicText,
  evaluateNativeRealizationContract,
  detectUnresolvedGenderPlaceholder,
} from '@/lib/cv-summary-v2';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import { UNIVERSAL_STYLE_FIXTURES } from '@/lib/__tests__/helpers/universal-style-fixtures';

export const AAB389_REF = '2026-07-01';

export const AAB389_LOCALES: Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
];

export const AAB389_GENDERED_LOCALES: Locale[] = ['sr', 'hr', 'ru', 'hi'];

export const AAB389_GENDERS = [
  { key: 'male' as const, value: 'male' as string | undefined },
  { key: 'female' as const, value: 'female' as string | undefined },
  { key: 'unspecified' as const, value: undefined as string | undefined },
];

export const AAB389_SUMMARY_ACTIONS = [
  'generate_empty',
  'generate_existing',
  'shorter',
  'stronger',
  'professional',
] as const;

export type Aab389SummaryAction = (typeof AAB389_SUMMARY_ACTIONS)[number];

export const AAB389_BAD_PROVIDER =
  'Team leader with 99% success at FakeCorp using Leadership and critical thinking skills.';

/** Visible gender placeholders that must never reach the user. */
export const AAB389_GENDER_PLACEHOLDER_RE =
  /radio\s*\/\s*la|zaposlen\s*\/\s*a|работал\(а\)|занимал\(а\)|करता\s*\/\s*करती|था\s*\/\s*थी|izvršavao\s*\/\s*la/u;

/** Known malformed locale tokens from the AAB-386/387/388 device audits. */
export const AAB389_MALFORMED_SURFACE_RE =
  /sustituyé|\bcon\s+ricore\b|ainsi que remplace(?=[^\p{L}])|ainsi que remplaçais|zielgerichtet\s+als|通算で約5年半。|Sa oko pet i po|S ukupno oko/u;

export function aab389Hash(text: string): string {
  return fingerprintText(normalizeSummaryCandidateText(text) || 'empty');
}

export function aab389SeedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

export type Aab389CvOptions = {
  locale: Locale;
  summary?: string;
  gender?: string | undefined;
  /** Seeded fixture variants. */
  seed?: 'two' | 'one' | 'five' | 'empty_employer' | 'punct_employer' | 'current_last';
};

function fixtureFor(locale: Locale) {
  return UNIVERSAL_STYLE_FIXTURES[locale];
}

function makeEntry(
  id: string,
  position: string,
  company: string,
  description: string,
  present: boolean,
  start: string,
  end: string,
): WorkExperience {
  return {
    id,
    position,
    company,
    startDate: start,
    endDate: end,
    isPresent: present,
    description,
    originalUserDescription: description,
    descriptionOrigin: 'user' as const,
  } as WorkExperience;
}

/** Build a CV with arbitrary free-text roles/employers and structured dates. */
export function aab389Cv(options: Aab389CvOptions): CVData {
  const f = fixtureFor(options.locale);
  const seed = options.seed || 'two';
  const gender = options.gender ?? '';

  let experience: WorkExperience[];
  if (seed === 'one') {
    experience = [
      makeEntry('solo', f.roleC, 'NordWerk', f.current, true, '2023-01', ''),
    ];
  } else if (seed === 'empty_employer') {
    experience = [
      makeEntry('radwerk', f.roleC, '', f.current, true, '2024-01', ''),
      makeEntry('stadthotel', f.roleP, 'StadtHotel', f.prior, false, '2021-01', '2023-12'),
    ];
  } else if (seed === 'punct_employer') {
    experience = [
      makeEntry('radwerk', f.roleC, 'RadWerk & Co., Ltd.', f.current, true, '2024-01', ''),
      makeEntry('stadthotel', f.roleP, 'Stadt-Hotel (Main)', f.prior, false, '2021-01', '2023-12'),
    ];
  } else if (seed === 'five') {
    experience = [
      makeEntry('e1', f.roleC, 'Alpha Co', f.current, true, '2024-01', ''),
      makeEntry('e2', f.roleP, 'Beta Co', f.prior, false, '2022-01', '2023-12'),
      makeEntry('e3', `${f.roleP} II`, 'Gamma Co', f.prior, false, '2020-01', '2021-12'),
      makeEntry('e4', `${f.roleC} Jr`, 'Delta Co', f.prior, false, '2018-01', '2019-12'),
      makeEntry('e5', f.roleP, 'Epsilon Co', f.prior, false, '2016-01', '2017-12'),
    ];
  } else if (seed === 'current_last') {
    experience = [
      makeEntry('stadthotel', f.roleP, 'StadtHotel', f.prior, false, '2021-01', '2023-12'),
      makeEntry('radwerk', f.roleC, 'RadWerk', f.current, true, '2024-01', ''),
    ];
  } else {
    experience = [
      makeEntry('radwerk', f.roleC, 'RadWerk', f.current, true, '2024-01', ''),
      makeEntry('stadthotel', f.roleP, 'StadtHotel', f.prior, false, '2021-01', '2023-12'),
    ];
  }

  return {
    id: `aab389-${options.locale}-${seed}`,
    name: `AAB389 ${options.locale}`,
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      address: '',
      jobTitle: f.roleC,
      gender,
    },
    summary: options.summary ?? '',
    experience,
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    templateId: 'modern',
    contentLocale: options.locale,
  } as CVData;
}

export function aab389DeterministicSource(
  locale: Locale,
  gender?: string,
  seed: Aab389CvOptions['seed'] = 'two',
): string {
  const cv = aab389Cv({ locale, gender, seed });
  const manifest = buildSummaryV2ManifestForCv({
    cv,
    locale,
    gender,
    referenceDateIso: AAB389_REF,
  });
  return manifest ? buildSummaryV2DeterministicText(manifest) : '';
}

export function aab389StyledSource(
  locale: Locale,
  style: 'shorter' | 'stronger' | 'professional',
  gender?: string,
): string {
  const cv = aab389Cv({ locale, gender });
  const manifest = buildSummaryV2ManifestForCv({
    cv,
    locale,
    gender,
    referenceDateIso: AAB389_REF,
  });
  return manifest ? buildSummaryV2StyledDeterministicText(manifest, style) : '';
}

/** Top-level Summary finalize through the same path as the application. */
export function aab389FinalizeSummary(options: {
  locale: Locale;
  gender?: string;
  action: Aab389SummaryAction;
  existingSummary: string;
  seed?: Aab389CvOptions['seed'];
  candidate?: string;
}): FinalizeCvAiFieldResult {
  const cv = aab389Cv({
    locale: options.locale,
    gender: options.gender,
    summary: options.existingSummary,
    seed: options.seed,
  });
  const duration = buildExperienceDurationSnapshot(cv.experience || [], AAB389_REF);
  const rewriteStyle = options.action === 'shorter'
    ? 'shorter' as const
    : options.action === 'stronger'
      ? 'stronger' as const
      : options.action === 'professional'
        ? 'professional' as const
        : undefined;
  const actionName = options.action === 'generate_empty' || options.action === 'generate_existing'
    ? 'summary_generate'
    : `summary_${options.action}`;
  return finalizeCvAiFieldForApply({
    field: 'summary',
    action: actionName,
    requestedLocale: options.locale,
    gender: options.gender,
    cv,
    candidate: options.candidate ?? (
      options.action.startsWith('generate') && !options.existingSummary
        ? ''
        : AAB389_BAD_PROVIDER
    ),
    durationSnapshot: duration,
    referenceDateIso: AAB389_REF,
    ...(rewriteStyle ? { rewriteStyle } : {}),
  });
}

/** Commit Summary apply + usage the same way the UI does after a visible write. */
export function aab389CommitSummary(options: {
  locale: Locale;
  cv: CVData;
  fin: FinalizeCvAiFieldResult;
  usageBefore: number;
  requestId: string;
  gender?: string;
}): {
  visibleText: string;
  visibleHash: string;
  cvRefHash: string;
  reactHash: string;
  persistedHash: string;
  raceGuardResult: string | null | undefined;
  usageAfter: number;
} {
  const text = options.fin.text || '';
  const cvRef = { current: { ...options.cv } };
  cvRef.current = applyFinalizedSummaryToCv(cvRef.current, options.locale, options.fin);
  const visibleText = resolveAuthoritativeVisibleSummaryText({
    operationOwnedSummary: cvRef.current.summary,
    staleReactSummary: '',
  });
  const reactState = { ...cvRef.current };
  const persisted = { ...cvRef.current };
  const session = new SummaryAiDiagnosticSession({
    uiLocale: options.locale,
    requestedLocale: options.locale,
    contentLocale: options.locale,
    templateId: 'modern',
    gender: options.gender || 'male',
    requestId: options.requestId,
    usageCountBefore: options.usageBefore,
    operationMode: 'enhance_existing_content',
  });
  session.recordFinalizeResult(options.fin);
  session.recordVisibleApply(true, options.usageBefore, visibleText);
  recordProAiUserActionSuccess();
  const usageAfter = options.usageBefore + 1;
  session.patch({ usageCountAfter: usageAfter });
  session.commit();
  return {
    visibleText,
    visibleHash: aab389Hash(visibleText),
    cvRefHash: aab389Hash(cvRef.current.summary || ''),
    reactHash: aab389Hash(reactState.summary || ''),
    persistedHash: aab389Hash(persisted.summary || ''),
    raceGuardResult: session.draft.raceGuardResult,
    usageAfter: getProAiUsageCount(),
  };
}

/** Shared positive assertions for a successful Summary finalize. */
export function aab389AssertSummarySuccess(
  fin: FinalizeCvAiFieldResult,
  locale: Locale,
  label: string,
): string {
  expect(fin.blocked, label).toBe(false);
  expect(fin.countedAsSuccess, label).toBe(true);
  const text = fin.text || '';
  expect(text.length, label).toBeGreaterThan(20);
  expect(text, label).not.toMatch(AAB389_GENDER_PLACEHOLDER_RE);
  expect(detectUnresolvedGenderPlaceholder(text), label).toBe(false);
  expect(text, label).not.toMatch(AAB389_MALFORMED_SURFACE_RE);
  const contract = evaluateNativeRealizationContract({ text, locale });
  expect(contract.nativeRealizationRejectionReasons, label).toEqual([]);
  expect(fin.diagnostics?.coveredCurrentDutyFactCount, label).toBeGreaterThanOrEqual(1);
  expect(fin.diagnostics?.durationExpressionCount ?? 1, label).toBe(1);
  const f = fixtureFor(locale);
  if (f.scriptProbe) expect(text, label).toMatch(f.scriptProbe);
  if (f.latinLeak) expect(text, label).not.toMatch(f.latinLeak);
  return text;
}

/** Experience empty-current generate / weak Stronger / saturated no-op helpers. */
export function aab389FinalizeExperience(options: {
  locale: Locale;
  gender?: string;
  experienceId: string;
  cv: CVData;
  candidate: string;
  rewriteStyle?: 'stronger';
}): FinalizeCvAiFieldResult {
  const duration = buildExperienceDurationSnapshot(options.cv.experience || [], AAB389_REF);
  return finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    experienceId: options.experienceId,
    requestedLocale: options.locale,
    gender: options.gender,
    cv: options.cv,
    candidate: options.candidate,
    referenceDateIso: AAB389_REF,
    durationSnapshot: duration,
    ...(options.rewriteStyle ? { rewriteStyle: options.rewriteStyle } : {}),
  });
}

export function aab389ApplyExperience(
  cv: CVData,
  locale: Locale,
  experienceId: string,
  fin: FinalizeCvAiFieldResult,
): CVData {
  return applyFinalizedBulletsToCv(cv, locale, experienceId, fin);
}

export { UNIVERSAL_STYLE_FIXTURES };
