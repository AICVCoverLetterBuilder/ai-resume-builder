import type { Locale } from '@/lib/i18n/translations';
import { SUMMARY_V2_REVISION } from './flag';
import { factCoveredInText } from './facts';
import { bulletToWhereClauseEn, dutyTenseFromEmploymentState, summaryHasMalformedDoublePast } from './tense';
import type {
  SummaryV2EmploymentState,
  SummaryV2EntryFact,
  SummaryV2SelectionManifest,
  SummaryV2ValidationResult,
} from './types';

const RESIDUE_MARKERS: Array<{ re: RegExp; needle: string }> = [
  { re: /\bAtlas\b/iu, needle: 'atlas' },
  { re: /\bRewitu\b/iu, needle: 'rewitu' },
  { re: /\bincoming\s+goods\b/iu, needle: 'incoming goods' },
  { re: /\bwarehouse\s+employee\b/iu, needle: 'warehouse employee' },
  { re: /\bgraphic\s+designer\b/iu, needle: 'graphic designer' },
  {
    re: /\bvisual\s+materials\s+and\s+graphic\s+elements\b/iu,
    needle: 'visual materials and graphic elements',
  },
];

/**
 * Stale residue = Summary mentions occupation memory that the live selection
 * manifest does not own. Live Atlas/Rewitu/warehouse/design content is NOT residue.
 */
export function detectStaleOccupationResidue(
  summary: string,
  manifest: SummaryV2SelectionManifest,
): boolean {
  const text = summary || '';
  if (!text.trim()) return false;
  const owned = [
    manifest.current,
    ...manifest.priors,
  ]
    .filter(Boolean)
    .map((e) => {
      const entry = e!;
      return [
        entry.role,
        entry.employer,
        ...entry.facts.map((f) => f.bulletText),
        ...manifest.requiredCurrentFacts
          .filter((f) => f.entryId === entry.entryId)
          .map((f) => f.bulletText),
        ...manifest.requiredPriorFacts
          .filter((f) => f.entryId === entry.entryId)
          .map((f) => f.bulletText),
      ].join(' ');
    })
    .join(' ')
    .toLowerCase();

  for (const { re, needle } of RESIDUE_MARKERS) {
    if (!re.test(text)) continue;
    if (!owned.includes(needle)) return true;
  }
  return false;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countDurationExpressions(text: string, locale: Locale): number {
  const t = text || '';
  if (locale === 'en') {
    const matches = t.match(
      /\b(?:approximately|about|around|with)?\s*(?:one|two|three|four|five|six|seven|eight|nine|ten|[\d.]+)\s+(?:and\s+a\s+half\s+)?years?\s+of\s+experience\b/giu,
    );
    const alt = t.match(/\bI\s+have\s+[^.]{0,80}\bexperience\b/giu);
    return Math.max(matches?.length || 0, alt?.length || 0);
  }
  // Count sentence-level duration claims (not every keyword hit inside one phrase).
  const units = t.split(/(?<=[.!?。؟])\s+/u).map((u) => u.trim()).filter(Boolean);
  return units.filter((u) => (
    /Erfahrung|experiencia|expérience|esperienza|опыт|лет|года|год\b|iskustva|godina|godine|経験|通算|約\d|年半|年|अनुभव|वर्ष|خبرة|سنة|سنوات|anos\b|anni\b|Jahren|Jahre|years?\s+of\s+experience|mjesec|meseci|mohi|か月|meses|mois/iu
      .test(u)
  )).length;
}

/** JS `\b` is ASCII-only — use includes-style markers for non-Latin scripts. */
function hasAnyMarker(text: string, markers: string[]): boolean {
  const t = (text || '').toLocaleLowerCase();
  return markers.some((m) => m && t.includes(m.toLocaleLowerCase()));
}

/**
 * Enforce per-entry duty tense from employmentState.
 * EN natural prose must use the tensed "where I …" clause.
 * Non-EN shells must embed the same tensed duty authority for completed entries.
 */
export function entryDutiesMatchEmploymentTense(
  text: string,
  facts: SummaryV2EntryFact[],
  employmentState: SummaryV2EmploymentState,
  locale: Locale,
): boolean {
  if (facts.length === 0) return true;
  const corpus = (text || '').toLowerCase();
  if (!corpus) return false;
  const tense = dutyTenseFromEmploymentState(employmentState);

  return facts.every((f) => {
    const expected = bulletToWhereClauseEn(f.bulletText, tense).toLowerCase();
    if (expected && corpus.includes(expected)) return true;

    // Coordinated verbs: require each past/present head verb.
    const heads = expected.split(/\s+and\s+/u).map((p) => p.trim().split(/\s+/u)[0]).filter(Boolean);
    if (heads.length >= 2 && heads.every((h) => corpus.includes(h))) return true;

    if (locale !== 'en') {
      // Non-EN shells embed live bullets unchanged (present or already-past native).
      const live = (f.bulletText || '').replace(/[.;]+$/u, '').trim().toLowerCase();
      if (live && corpus.includes(live)) return true;
    }
    return false;
  });
}

/**
 * Shared V2 validator — provider, repair, deterministic, and visible apply
 * all use this exact manifest contract (including per-entry duty tense).
 */
export function validateSummaryV2AgainstManifest(
  summary: string,
  manifest: SummaryV2SelectionManifest,
): SummaryV2ValidationResult {
  void SUMMARY_V2_REVISION;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const requiredCurrent = manifest.requiredCurrentFacts;
  const requiredPrior = manifest.requiredPriorFacts;
  const coveredCurrent = requiredCurrent.filter((f) => factCoveredInText(f, text)).length;
  const coveredPrior = requiredPrior.filter((f) => factCoveredInText(f, text)).length;

  const current = manifest.current;
  const prior = manifest.priors[0] || null;
  const currentRolePresent = Boolean(
    current?.role
    && new RegExp(escapeRegExp(current.role), 'iu').test(text),
  );
  const currentEmployerPresent = Boolean(
    current?.employer
    && new RegExp(escapeRegExp(current.employer), 'iu').test(text),
  );
  const currentStateExpressed = /\b(?:currently|derzeit|actuellement|attualmente|actualmente|atualmente|trenutno)\b/iu
    .test(text)
    || /\bsince\b/iu.test(text)
    || hasAnyMarker(text, ['сейчас', 'حاليا', 'حالیا', 'أعمل', 'वर्तमान', '現在']);
  const priorRolePresent = !prior?.role
    || new RegExp(escapeRegExp(prior.role), 'iu').test(text);
  const priorEmployerPresent = !prior?.employer
    || new RegExp(escapeRegExp(prior.employer), 'iu').test(text);
  const priorStateExpressed = !prior
    || /\b(?:previously|formerly|zuvor|anteriormente|auparavant|in\s+precedenza|prethodno)\b/iu
      .test(text)
    || hasAnyMarker(text, ['ранее', 'سابقا', 'इससे पहले', '以前']);

  const currentDutyTenseOk = !current
    || entryDutiesMatchEmploymentTense(
      text,
      requiredCurrent,
      current.employmentState,
      manifest.locale,
    );
  const priorDutyTenseOk = manifest.priors.every((p) => {
    const facts = requiredPrior.filter((f) => f.entryId === p.entryId);
    return entryDutiesMatchEmploymentTense(
      text,
      facts,
      p.employmentState,
      manifest.locale,
    );
  });

  const durationExpressionCount = countDurationExpressions(text, manifest.locale);
  const staleResidueDetected = detectStaleOccupationResidue(text, manifest);
  const unsupportedClaimCount = staleResidueDetected ? 1 : 0;
  const hasLiveAuthority = Boolean(manifest.current || manifest.priors.length > 0);

  let reason: string | null = null;
  if (!text) reason = 'empty_summary';
  else if (!hasLiveAuthority) reason = 'no_live_experience_authority';
  else if (staleResidueDetected) reason = 'stale_occupation_residue';
  else if (manifest.totalDurationMonths <= 0 && durationExpressionCount > 0) {
    reason = 'unsupported_duration_without_dates';
  } else if (manifest.totalDurationMonths > 0 && durationExpressionCount !== 1) {
    reason = 'duration_not_exactly_once';
  } else if (requiredCurrent.length > 0 && coveredCurrent < requiredCurrent.length) {
    reason = 'current_duty_coverage_incomplete';
  } else if (requiredPrior.length > 0 && coveredPrior < requiredPrior.length) {
    reason = 'prior_duty_coverage_incomplete';
  } else if (current && (!currentRolePresent || !currentEmployerPresent || !currentStateExpressed)) {
    reason = 'missing_current_role_intro';
  } else if (prior && (!priorRolePresent || !priorEmployerPresent || !priorStateExpressed)) {
    reason = 'missing_prior_role_intro';
  } else if (manifest.locale === 'en' && summaryHasMalformedDoublePast(text)) {
    reason = 'malformed_double_past_inflection';
  } else if (!currentDutyTenseOk || !priorDutyTenseOk) {
    reason = 'duty_tense_mismatch';
  }

  return {
    ok: reason === null,
    reason,
    requiredCurrentFactCount: requiredCurrent.length,
    coveredCurrentFactCount: coveredCurrent,
    requiredPriorFactCount: requiredPrior.length,
    coveredPriorFactCount: coveredPrior,
    durationExpressionCount,
    currentRolePresent,
    currentEmployerPresent,
    currentStateExpressed,
    priorRolePresent,
    priorEmployerPresent,
    priorStateExpressed,
    currentDutyTenseOk,
    priorDutyTenseOk,
    staleResidueDetected,
    unsupportedClaimCount,
  };
}
