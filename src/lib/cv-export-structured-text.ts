import type { CVData, WorkExperience } from './types';
import type { Locale } from './i18n/translations';
import { localesEquivalent } from './cv-content-locale';
import { formatExperienceBullets } from './cv-canonical-facts';

export const CV_EXPORT_STRUCTURED_TEXT_REVISION =
  'cv-export-structured-text-405-v1' as const;
export const CV_EXPORT_RENDER_DUTY_PROJECTION_REVISION =
  'cv-export-render-duty-projection-405-v1' as const;

export function normalizeStructuredExportText(text: string): string {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function collectCvStructuredTextTokens(cv: CVData): string[] {
  const values = [
    cv.personal?.fullName,
    cv.personal?.jobTitle,
    cv.personal?.email,
    cv.personal?.phone,
    cv.personal?.address,
    cv.personal?.linkedIn,
    cv.personal?.website,
    ...(cv.experience || []).flatMap((entry) => [entry.company, entry.position]),
    ...(cv.education || []).flatMap((entry) => [entry.school, entry.degree]),
    ...(cv.certifications || []),
  ];
  return [...new Set(
    values
      .map((value) => normalizeStructuredExportText(String(value || '')))
      .filter((value) => value.length >= 2),
  )].sort((a, b) => b.length - a.length);
}

function firstMaterialChar(value: string): string {
  return Array.from(value).find((char) => /[\p{L}\p{N}]/u.test(char)) || '';
}

function lastMaterialChar(value: string): string {
  return Array.from(value).reverse().find((char) => /[\p{L}\p{N}]/u.test(char)) || '';
}

function boundaryProbe(char: string, side: 'start' | 'end'): string {
  if (!char) return side === 'start' ? 'Abc' : 'abc';
  if (/\p{N}/u.test(char)) return '123';
  if (/\p{Script=Latin}/u.test(char)) {
    if (/\p{Lu}/u.test(char)) return 'Abc';
    return 'abc';
  }
  if (/\p{L}/u.test(char)) return `${char}${char}${char}`;
  return side === 'start' ? 'Abc' : 'abc';
}

/**
 * Protect exact structured tokens while still exposing their lexical boundary
 * shape to the existing narrative normalizers. The visible boundary probes let
 * rules such as `.Software -> . Software` and `wordSoftware -> word Software`
 * fire exactly as they did before token protection, while the protected value
 * itself is restored byte-for-byte afterwards.
 */
function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeNarrativeWithProtectedStructuredTokens(
  text: string,
  tokens: readonly string[],
  normalize: (protectedText: string) => string,
): string {
  const original = String(text || '');
  const presentTokens = [...new Set(tokens)]
    .filter((value) => Boolean(value) && original.includes(value))
    .sort((a, b) => b.length - a.length);
  if (presentTokens.length === 0) return normalize(original);

  const tokenPattern = new RegExp(
    presentTokens.map(escapeRegexLiteral).join('|'),
    'gu',
  );
  const replacements = new Map<string, string>();
  const protectedText = original.replace(tokenPattern, (value) => {
    const id = replacements.size.toString(36);
    const startProbe = boundaryProbe(firstMaterialChar(value), 'start');
    const endProbe = boundaryProbe(lastMaterialChar(value), 'end');
    const stub = `${startProbe}\uE000${id}\uE001${endProbe}`;
    replacements.set(stub, value);
    return stub;
  });

  let result = normalize(protectedText);
  for (const [stub, value] of replacements) {
    result = result.split(stub).join(value);
  }
  return result;
}

function exactRecoveredUserOriginClauses(entry: WorkExperience, locale: Locale): string[] | null {
  if (entry.groundingRecoverySource !== 'legacy_user_origin_duties') return null;
  const duties = [...(entry.recoveredSemanticDuties || [])]
    .sort((a, b) => a.sourceClauseIndex - b.sourceClauseIndex);
  if (duties.length < 2) return null;
  if (!duties.every((duty) => duty.confidence === 'exact_user_origin' && Boolean(duty.sourceClause?.trim()))) {
    return null;
  }
  const locales = [...new Set(
    duties
      .map((duty) => String(duty.sourceLocale || '').trim())
      .filter(Boolean),
  )];
  if (locales.length > 1) return null;
  const sourceLocale = locales[0] || String(entry.descriptionSourceLocale || '').trim();
  if (!sourceLocale || !localesEquivalent(sourceLocale, locale)) return null;
  return duties.map((duty) => String(duty.sourceClause || '').trim()).filter(Boolean);
}

/**
 * Render-only Experience projection. It never changes the editor/canonical
 * description. Exact recovered same-locale clauses may be exposed as separate
 * bullets for PDF/DOCX layout, while cross-locale prepared descriptions remain
 * the already-validated localized projection.
 */
export function getExperienceExportRenderDescription(
  entry: WorkExperience,
  locale: Locale,
): string {
  const recoveredClauses = exactRecoveredUserOriginClauses(entry, locale);
  return recoveredClauses?.length
    ? formatExperienceBullets(recoveredClauses)
    : String(entry.description || '');
}

/** Build an ephemeral CV view for renderers; the supplied CV is never mutated. */
export function buildCvExportRenderProjection(cv: CVData, locale: Locale): CVData {
  let changed = false;
  const experience = (cv.experience || []).map((entry) => {
    const description = getExperienceExportRenderDescription(entry, locale);
    if (description === String(entry.description || '')) return entry;
    changed = true;
    return { ...entry, description };
  });
  return changed ? { ...cv, experience } : cv;
}
