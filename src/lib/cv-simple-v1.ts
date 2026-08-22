import type { CVData } from './types';
import type { Locale } from './i18n/translations';
import {
  DEFAULT_LOCALE,
  resolveLocaleCandidate,
} from './i18n/translations';
import { normalizeLegacyCvRuntime } from './cv-legacy-runtime-migration';

/** Build-time feature flag for the incremental Simple V1 CV authority path. */
export const CV_SIMPLE_V1_ENV_FLAG = 'NEXT_PUBLIC_CV_SIMPLE_V1' as const;

export type CvContentLocaleContext = {
  uiLocale?: string | null;
};

/**
 * Simple V1 is opt-in. Anything other than the literal string "true" keeps
 * the current production behavior.
 */
export function isCvSimpleV1Enabled(
  flagValue: string | boolean | null | undefined = process.env.NEXT_PUBLIC_CV_SIMPLE_V1,
): boolean {
  return flagValue === true || flagValue === 'true';
}

/** Uses the existing supported-locale normalization; never invents a locale. */
export function normalizeSupportedCvContentLocale(
  value: string | null | undefined,
): Locale | null {
  return resolveLocaleCandidate(value);
}

/**
 * The sole Simple V1 content-locale authority. Existing explicit data wins;
 * an unversioned legacy record receives only the current UI-locale bridge.
 * This selector never examines CV prose or generated metadata.
 */
export function getCvContentLocale(
  cv: Pick<CVData, 'contentLocale'>,
  context: CvContentLocaleContext = {},
): Locale {
  return normalizeSupportedCvContentLocale(cv.contentLocale)
    ?? normalizeSupportedCvContentLocale(context.uiLocale)
    ?? DEFAULT_LOCALE;
}

/**
 * Materializes the narrow compatibility bridge without modifying any CV text
 * or generated metadata. Once materialized, contentLocale remains stable.
 */
export function materializeSimpleV1ContentLocale(
  cv: CVData,
  context: CvContentLocaleContext = {},
): CVData {
  const contentLocale = getCvContentLocale(cv, context);
  return cv.contentLocale === contentLocale
    ? cv
    : { ...cv, contentLocale };
}

/** The Simple V1 Summary authority is the real, saved editor field only. */
export function getCvSummaryText(cv: Pick<CVData, 'summary'>): string {
  return typeof cv.summary === 'string' ? cv.summary : '';
}

/**
 * User edits must retain the existing CV content language under Simple V1.
 * Legacy mode continues to bind editor mutations to the current UI locale.
 */
export function getCvEditorContentLocale(
  cv: Pick<CVData, 'contentLocale'>,
  uiLocale: Locale,
  simpleV1Enabled = isCvSimpleV1Enabled(),
): Locale {
  return simpleV1Enabled ? getCvContentLocale(cv, { uiLocale }) : uiLocale;
}

/**
 * Minimal runtime branch used where the legacy migration is explicitly run.
 * Keeping the legacy branch here makes the flag boundary testable and ensures
 * feature-off behavior still delegates to the untouched migration.
 */
export function resolveCvRuntimeForUi(
  cv: CVData,
  uiLocale: Locale,
  simpleV1Enabled = isCvSimpleV1Enabled(),
): CVData {
  return simpleV1Enabled
    ? materializeSimpleV1ContentLocale(cv, { uiLocale })
    : normalizeLegacyCvRuntime(cv, uiLocale);
}
