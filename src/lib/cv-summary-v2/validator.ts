import type { Locale } from '@/lib/i18n/translations';
import { SUMMARY_V2_REVISION } from './flag';
import { factCoveredInText } from './facts';
import { bulletToWhereClauseEn, dutyTenseFromEmploymentState, summaryHasMalformedDoublePast } from './tense';
import { bulletToGermanWoIchClause } from './german-surface';
import { realizeFirstPersonDutyClause } from './native-surface';
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

/** Invented metrics / leadership / quantified impact not owned by the manifest. */
function detectUnsupportedMaterialClaims(text: string): boolean {
  const t = text || '';
  if (!t.trim()) return false;
  return (
    /\b\d+\s*%/u.test(t)
    || /\$\s*\d|\b\d+\s*(?:USD|EUR|€)/iu.test(t)
    || /\b(?:team\s+of\s+\d+|Team\s+von\s+\d+|führte\s+ein\s+Team|led\s+a\s+team|staff\s+of\s+\d+)\b/iu
      .test(t)
    || /\b(?:steigerte\s+ich\s+den\s+Umsatz|increased\s+(?:revenue|sales)|boosted\s+revenue)\b/iu
      .test(t)
    || /\b(?:Leadership|critical\s+thinking\s+skills)\b/iu.test(t)
  );
}

function countDurationExpressions(text: string, locale: Locale): number {
  const t = text || '';
  if (locale === 'en') {
    const matches = t.match(
      /\b(?:approximately|about|around|with)?\s*(?:one|two|three|four|five|six|seven|eight|nine|ten|[\d.]+)\s+(?:and\s+a\s+half\s+)?years?\s+of\s+experience\b/giu,
    );
    const alt = t.match(/\bI\s+(?:have|bring)\s+[^.]{0,80}\bexperience\b/giu);
    return Math.max(matches?.length || 0, alt?.length || 0);
  }
  // Count sentence-level duration claims (not every keyword hit inside one phrase).
  const units = t.split(/(?<=[.!?。؟।])\s+/u).map((u) => u.trim()).filter(Boolean);
  return units.filter((u) => (
    /Erfahrung|experiencia|expérience|esperienza|опыт|лет|года|год\b|iskustva|godina|godine|経験|通算|約\d|年半|年|अनुभव|वर्ष|خبرة|سنة|سنوات|años?\b|anos\b|anni\b|Jahren|Jahre|years?\s+of\s+experience|mjesec|meseci|mohi|か月|meses|mois/iu
      .test(u)
  )).length;
}

/** JS `\b` is ASCII-only — use includes-style markers for non-Latin scripts. */
function hasAnyMarker(text: string, markers: string[]): boolean {
  const t = (text || '').toLocaleLowerCase();
  return markers.some((m) => m && t.includes(m.toLocaleLowerCase()));
}

function stripOptionalGermanSoftModifiers(text: string): string {
  return (text || '')
    .replace(/\b(?:kompetent|serviceorientiert)\s+und\s+(?:kompetent|serviceorientiert)\b/giu, '')
    .replace(
      /\b(?:herzlich|kompetent|serviceorientiert|freundlich|zuverlässig|sorgfältig|fundiert|zielgerichtet|insgesamt)\b/giu,
      '',
    )
    // Drop redundant hotel NP when employer already states the hotel context.
    .replace(/\s+des Hotels\b/giu, '')
    .replace(/\bsowie\b/giu, 'und')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+und\s+und\b/giu, ' und ')
    .replace(/\s+und\s+(?=[,.]|$)/giu, ' ')
    .trim();
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
  gender?: string | null,
): boolean {
  if (facts.length === 0) return true;
  const corpus = (text || '').toLowerCase();
  if (!corpus) return false;
  const tense = dutyTenseFromEmploymentState(employmentState);
  const corpusSoft = stripOptionalGermanSoftModifiers(corpus);

  return facts.every((f) => {
    const expected = bulletToWhereClauseEn(f.bulletText, tense).toLowerCase();
    if (expected && corpus.includes(expected)) return true;

    // Coordinated verbs: require each past/present head verb.
    const heads = expected.split(/\s+and\s+/u).map((p) => p.trim().split(/\s+/u)[0]).filter(Boolean);
    if (heads.length >= 2 && heads.every((h) => corpus.includes(h))) return true;

    if (locale === 'de') {
      // German V2 uses first-person "wo ich …" clauses, not raw live bullets.
      const deClause = bulletToGermanWoIchClause(f.bulletText, tense).toLowerCase();
      if (deClause && corpus.includes(deClause)) return true;
      // Shorter / polish may drop soft adjectives — still require the duty core.
      const deSoft = stripOptionalGermanSoftModifiers(deClause);
      if (deSoft.length >= 8 && corpusSoft.includes(deSoft)) return true;
      // Also accept significant stems from the live bullet once the 1sg finite is present.
      const live = (f.bulletText || '').replace(/[.;]+$/u, '').trim().toLowerCase();
      const stems = live
        .split(/[^a-zäöüß0-9]+/iu)
        .filter((t) => t.length >= 5)
        .slice(0, 4);
      if (
        stems.length > 0
        && stems.every((s) => corpus.includes(s))
        && /\b(?:prüfe|prüfte|koordiniere|koordinierte|erstellte|anpasste|vorbereitete|überprüfte|spreche|nehme|nahm|führe|führte|durchführe|entgegennehme|entgegennahm|begrüßte|verwaltete|beantwortete|erfasste|bearbeitete|austausche|austauschte)\b/iu
          .test(corpus)
      ) {
        return true;
      }
    }

    if (locale !== 'en') {
      // Non-EN shells: accept live bullets OR first-person native realizations.
      const live = (f.bulletText || '').replace(/[.;]+$/u, '').trim().toLowerCase();
      if (live && corpus.includes(live)) return true;
      const realized = realizeFirstPersonDutyClause(
        f.bulletText,
        locale,
        employmentState,
        gender,
      ).toLowerCase();
      if (realized && corpus.includes(realized)) return true;
      // Stem fallback: significant content tokens still present after 1sg rewrite.
      const stems = live
        .split(/[^\p{L}0-9]+/u)
        .filter((t) => t.length >= 5)
        .slice(0, 3);
      if (stems.length > 0 && stems.every((s) => corpus.includes(s))) return true;
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

  const current = manifest.current;
  const prior = manifest.priors[0] || null;
  const coveredCurrent = requiredCurrent.filter((f) => factCoveredInText(
    f,
    text,
    dutyTenseFromEmploymentState(current?.employmentState),
  )).length;
  const coveredPrior = requiredPrior.filter((f) => {
    const owner = manifest.priors.find((p) => p.entryId === f.entryId);
    return factCoveredInText(
      f,
      text,
      dutyTenseFromEmploymentState(owner?.employmentState),
    );
  }).length;
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
    || hasAnyMarker(text, [
      'сейчас', 'حاليا', 'حالیا', 'أعمل', 'वर्तमान', '現在', '現職',
      'in my current role', 'en mi rol actual', 'dans mon rôle', 'nel mio ruolo',
      'na minha função atual', 'в текущей роли', 'u trenutnoj ulozi',
      'في دوري الحالي', 'वर्तमान भूमिका',
      'in meiner aktuellen rolle', 'in einer früheren rolle',
    ]);
  const priorRolePresent = !prior?.role
    || new RegExp(escapeRegExp(prior.role), 'iu').test(text);
  const priorEmployerPresent = !prior?.employer
    || new RegExp(escapeRegExp(prior.employer), 'iu').test(text);
  const priorStateExpressed = !prior
    || /\b(?:previously|formerly|zuvor|anteriormente|auparavant|in\s+precedenza|prethodno|ranije)\b/iu
      .test(text)
    || hasAnyMarker(text, [
      'ранее', 'سابقا', 'इससे पहले', 'पहले', '以前', '前は', '前職',
      'antes', 'prije', 'già', 'déjà', "j'ai déjà",
      'in a previous role', 'en un rol anterior', 'dans un rôle précédent',
      'in un ruolo precedente', 'em uma função anterior', 'в предыдущей роли',
      'u prethodnoj ulozi', 'في دور سابق', 'पिछली भूमिका',
      'in einer früheren rolle',
    ]);

  const currentDutyTenseOk = !current
    || entryDutiesMatchEmploymentTense(
      text,
      requiredCurrent,
      current.employmentState,
      manifest.locale,
      manifest.gender,
    );
  const priorDutyTenseOk = manifest.priors.every((p) => {
    const facts = requiredPrior.filter((f) => f.entryId === p.entryId);
    return entryDutiesMatchEmploymentTense(
      text,
      facts,
      p.employmentState,
      manifest.locale,
      manifest.gender,
    );
  });

  const durationExpressionCount = countDurationExpressions(text, manifest.locale);
  const staleResidueDetected = detectStaleOccupationResidue(text, manifest);
  const unsupportedMaterialClaim = detectUnsupportedMaterialClaims(text);
  const unsupportedClaimCount = (staleResidueDetected ? 1 : 0)
    + (unsupportedMaterialClaim ? 1 : 0);
  const hasLiveAuthority = Boolean(manifest.current || manifest.priors.length > 0);

  let reason: string | null = null;
  if (!text) reason = 'empty_summary';
  else if (!hasLiveAuthority) reason = 'no_live_experience_authority';
  else if (staleResidueDetected) reason = 'stale_occupation_residue';
  else if (unsupportedMaterialClaim) reason = 'unsupported_material_claim';
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
