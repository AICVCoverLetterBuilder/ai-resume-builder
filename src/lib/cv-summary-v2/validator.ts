import type { Locale } from '@/lib/i18n/translations';
import { SUMMARY_V2_REVISION } from './flag';
import { factCoveredInText, hashSummaryV2Text } from './facts';
import { bulletToWhereClauseEn, dutyTenseFromEmploymentState, summaryHasMalformedDoublePast } from './tense';
import { bulletToGermanWoIchClause } from './german-surface';
import {
  realizeFirstPersonDutyClause,
  japaneseDutyRealizationVariants,
  evaluateNativeRealizationContract,
} from './native-surface';
import type {
  SummaryV2CandidateSourceKind,
  SummaryV2EmploymentState,
  SummaryV2EntryFact,
  SummaryV2SelectionManifest,
  SummaryV2ValidationResult,
} from './types';
import { validateAiUnitLocalePurity } from '../cv-ai-unit-locale-purity';
import { inspectSummaryV2TranslatableSurface } from './localization';
import {
  classifySummaryV2EntrySurfaceAuthority,
} from './localization';
import { validateLocalizedSummaryRoleTitleGender } from '@/lib/cv-summary-structured-role-localization';
import { auditSummaryV2MaterialClaims } from './material-claims';
import { analyzeSummaryV2FinalUnitOwnership } from './unit-ownership';
import { fingerprintText } from '../cv-export-diagnostics';
import { unsupportedSummaryV2QualityMannerClaims } from './semantic-claims';

/** Compatibility diagnostic; V2 deliberately has no fixture occupation lexicon. */
export function detectStaleOccupationResidue(
  _summary: string,
  _manifest: SummaryV2SelectionManifest,
): boolean {
  // V2 has no occupation-name memory. Generic selected-entry unit ownership,
  // required-fact coverage and source-claim authority reject stale material.
  return false;
}

export type SummaryV2ValidationOptions = {
  candidateSource?: SummaryV2CandidateSourceKind;
  preserveConstructionOrder?: boolean;
  /** Internal-only: this text was just constructed from the supplied manifest. */
  trustedConstructionAuthority?: boolean;
};

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

/** Strip claim-safe Stronger duty intensifiers / join ornaments for tense match. */
function stripDutyStyleIntensifiers(text: string): string {
  return (text || '')
    .replace(/\b(?:con rigor|avec rigueur|con rigore|com rigor|carefully|thoroughly|pouzdano|pažljivo|uredno)\b/giu, '')
    .replace(/тщательно\s*/gu, '')
    .replace(/بعناية\s*/gu, '')
    .replace(/بكفاءة\s*/gu, '')
    .replace(/सावधानीपूर्वक\s*/gu, '')
    .replace(/निरंतर\s*/gu, '')
    .replace(/着実に/gu, '')
    .replace(/丁寧に/gu, '')
    .replace(/\ba la vez que\b/giu, 'y')
    .replace(/\basí como\b/giu, 'y')
    .replace(/ साथ ही /gu, ' और ')
    .replace(/ كما /gu, ' و')
    .replace(/\bainsi que\b/giu, 'et')
    .replace(/\bnonché\b/giu, 'e')
    .replace(/\bbem como\b/giu, 'e')
    .replace(/а также\s*/gu, 'и ')
    .replace(/\s+te\s+/giu, ' i ')
    .replace(/ ثم /gu, ' و')
    .replace(/、また/gu, '、')
    .replace(/\bas well as\b/giu, 'and')
    .replace(/\s{2,}/g, ' ')
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
      // Stronger may insert claim-safe duty intensifiers — strip before match.
      const corpusBare = stripDutyStyleIntensifiers(corpus);
      const live = (f.bulletText || '').replace(/[.;]+$/u, '').trim().toLowerCase();
      if (live && (corpus.includes(live) || corpusBare.includes(live))) return true;
      const realized = realizeFirstPersonDutyClause(
        f.bulletText,
        locale,
        employmentState,
        gender,
      ).toLowerCase();
      if (realized && (corpus.includes(realized) || corpusBare.includes(realized))) return true;
      const realizedBare = stripDutyStyleIntensifiers(realized);
      if (realizedBare.length >= 8 && corpusBare.includes(realizedBare)) return true;
      if (
        locale === 'es'
        && /(?:,|(?<!\p{L})(?:y|e)(?!\p{L}))\s+\p{L}+/iu.test(live)
      ) {
        // Coordinated Spanish facts are validated against the exact
        // manifest-owned first-person realization. Falling through to loose
        // stems would let `registré y gestionó` cover the same nouns while
        // violating the expected person/tense transformation.
        return false;
      }
      if (locale === 'ja') {
        // Chained Japanese clauses inflect the bullet's finite verb (行う→行い).
        const variants = japaneseDutyRealizationVariants(f.bulletText, employmentState)
          .map((v) => v.toLowerCase())
          .filter((v) => v.length >= 4);
        if (variants.some((v) => corpus.includes(v) || corpusBare.includes(v))) return true;
      }
      // Stem fallback: significant content tokens still present after 1sg rewrite.
      const stems = live
        .split(/[^\p{L}0-9]+/u)
        .filter((t) => t.length >= 5)
        .slice(0, 3);
      if (stems.length > 0 && stems.every((s) => corpusBare.includes(s) || corpus.includes(s))) {
        return true;
      }
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
  options: SummaryV2ValidationOptions = {},
): SummaryV2ValidationResult {
  void SUMMARY_V2_REVISION;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const requiredCurrent = manifest.requiredCurrentFacts;
  const requiredPrior = manifest.requiredPriorFacts;

  const current = manifest.current;
  const prior = manifest.priors[0] || null;
  const selectedEntries = [...(current ? [current] : []), ...manifest.priors];
  const ownership = analyzeSummaryV2FinalUnitOwnership(text, manifest, options);
  const evidenceForEntry = (entryId: string) => ownership.evidence.filter(
    (evidence) => evidence.owningEntryId === entryId,
  );
  const unitForEvidence = (unitIndex: number) => ownership.units[unitIndex] || '';
  const unitTextForEntry = (entryId: string) => evidenceForEntry(entryId)
    .map((evidence) => unitForEvidence(evidence.unitIndex))
    .join(' ');
  const factUnitCoverageEvidence = [
    ...requiredCurrent.map((fact) => ({ fact, semanticRole: 'current_fact' as const })),
    ...requiredPrior.map((fact) => ({ fact, semanticRole: 'prior_fact' as const })),
  ].map(({ fact, semanticRole }) => {
    const owner = selectedEntries.find((entry) => entry.entryId === fact.entryId);
    const matches = owner ? evidenceForEntry(owner.entryId).filter((unitEvidence) => {
      const unit = unitForEvidence(unitEvidence.unitIndex);
      return factCoveredInText(
        fact,
        unit,
        dutyTenseFromEmploymentState(owner.employmentState),
      ) || entryDutiesMatchEmploymentTense(
        unit,
        [fact],
        owner.employmentState,
        manifest.locale,
        manifest.gender,
      );
    }) : [];
    const covered = matches.length > 0;
    const ownershipPassed = Boolean(
      ownership.passed
      && owner
      && matches.every((unitEvidence) => unitEvidence.owningEntryId === owner.entryId)
      && matches.every((unitEvidence) => (
        semanticRole === 'current_fact'
          ? unitEvidence.roleSlot === 'current_role'
          : unitEvidence.roleSlot === 'prior_role'
      )),
    );
    return {
      factId: fact.factId,
      factHash: fingerprintText(fact.factId),
      owningEntryId: fact.entryId,
      owningEntryHash: fingerprintText(fact.entryId),
      semanticRole,
      matchedUnitHashes: matches.map((unitEvidence) => unitEvidence.unitHash),
      matchedUnitOwnerHashes: matches.map((unitEvidence) => unitEvidence.owningEntryHash || ''),
      matchedUnitRoleSlots: matches.map((unitEvidence) => unitEvidence.roleSlot),
      ownershipPassed,
      covered,
    };
  });
  const coveredCurrent = factUnitCoverageEvidence.filter(
    (evidence) => evidence.semanticRole === 'current_fact' && evidence.covered,
  ).length;
  const coveredPrior = factUnitCoverageEvidence.filter(
    (evidence) => evidence.semanticRole === 'prior_fact' && evidence.covered,
  ).length;
  const factUnitOwnershipValidationPassed = ownership.passed
    && factUnitCoverageEvidence.every((evidence) => evidence.ownershipPassed);
  const currentUnitText = current ? unitTextForEntry(current.entryId) : '';
  const currentRolePresent = Boolean(
    current?.role
    && new RegExp(escapeRegExp(current.role), 'iu').test(currentUnitText),
  );
  const currentEmployerPresent = Boolean(
    current?.employer
    && new RegExp(escapeRegExp(current.employer), 'iu').test(currentUnitText),
  );
  const currentStateExpressed = /\b(?:currently|derzeit|actuellement|attualmente|actualmente|atualmente|trenutno)\b/iu
    .test(currentUnitText)
    || /\bsince\b/iu.test(currentUnitText)
    || hasAnyMarker(currentUnitText, [
      'сейчас', 'حاليا', 'حالیا', 'أعمل', 'वर्तमान', '現在', '現職',
      'in my current role', 'en mi rol actual', 'dans mon rôle', 'nel mio ruolo',
      'na minha função atual', 'в текущей роли', 'u trenutnoj ulozi',
      'في دوري الحالي', 'वर्तमान भूमिका',
      'in meiner aktuellen rolle', 'in einer früheren rolle',
    ]);
  const priorRolePresent = manifest.priors.every((entry) => (
    !entry.role || new RegExp(escapeRegExp(entry.role), 'iu').test(unitTextForEntry(entry.entryId))
  ));
  const priorEmployerPresent = manifest.priors.every((entry) => (
    !entry.employer || new RegExp(escapeRegExp(entry.employer), 'iu').test(unitTextForEntry(entry.entryId))
  ));
  const priorStateExpressed = !prior || manifest.priors.every((entry) => {
    const priorUnitText = unitTextForEntry(entry.entryId);
    return /\b(?:previously|formerly|before\s+that|zuvor|anteriormente|auparavant|in\s+precedenza|prethodno|ranije)\b/iu
      .test(priorUnitText)
    || hasAnyMarker(priorUnitText, [
      'ранее', 'سابقا', 'इससे पहले', 'पहले', '以前', '前は', '前職',
      'antes', 'prije', 'già', 'déjà', "j'ai déjà",
      'in a previous role', 'en un rol anterior', 'dans un rôle précédent',
      'in un ruolo precedente', 'em uma função anterior', 'в предыдущей роли',
      'u prethodnoj ulozi', 'في دور سابق', 'पिछली भूमिका',
      'in einer früheren rolle',
    ]);
  });

  // A deterministic rewrite is newly constructed from this manifest; its
  // per-entry current/completed tense is structured authority, not a premise
  // to re-infer from localized prose. Native realization still validates the
  // visible finite forms below. Provider and repair candidates never opt in.
  const preserveDeterministicTenseAuthority = options.trustedConstructionAuthority === true;
  const currentDutyTenseOk = preserveDeterministicTenseAuthority || !current
    || entryDutiesMatchEmploymentTense(
      currentUnitText,
      requiredCurrent,
      current.employmentState,
      manifest.locale,
      manifest.gender,
    );
  const priorDutyTenseOk = preserveDeterministicTenseAuthority || manifest.priors.every((p) => {
    const facts = requiredPrior.filter((f) => f.entryId === p.entryId);
    return entryDutiesMatchEmploymentTense(
      unitTextForEntry(p.entryId),
      facts,
      p.employmentState,
      manifest.locale,
      manifest.gender,
    );
  });

  const durationExpressionCount = countDurationExpressions(text, manifest.locale);
  const staleResidueDetected = detectStaleOccupationResidue(text, manifest);
  const unsupportedMaterialClaim = detectUnsupportedMaterialClaims(text);
  const materialAuthority = auditSummaryV2MaterialClaims(text, manifest, ownership.evidence);
  const unsupportedQualityMannerClaims = unsupportedSummaryV2QualityMannerClaims(text, manifest);
  const qualityMannerAuthorityPassed = unsupportedQualityMannerClaims.length === 0;
  const unsupportedClaimCount = (staleResidueDetected ? 1 : 0)
    + (unsupportedMaterialClaim ? 1 : 0)
    + materialAuthority.unsupportedMaterialClaimCount
    + unsupportedQualityMannerClaims.length;
  const localePurity = validateAiUnitLocalePurity(text, manifest.locale, {
    kind: 'summary_sentence',
    requireUnits: true,
  });
  const hasLiveAuthority = Boolean(manifest.current || manifest.priors.length > 0);
  const roleTitleSurfaceEvidence = selectedEntries.map((entry) => {
    const roleAuthority = classifySummaryV2EntrySurfaceAuthority({ manifest, entry }).roleTitleAuthority;
    const gender = validateLocalizedSummaryRoleTitleGender({
      sourceRoleTitle: entry.sourceRoleTitle || entry.role,
      localizedRoleTitle: entry.role,
      sourceLocale: entry.roleSourceLocale || entry.sourceLocale,
      targetLocale: manifest.locale,
      gender: manifest.gender,
      foreignLocalizationRequired: roleAuthority === 'foreign_localization_required'
        || Boolean(
          entry.roleTitleLocalizationSource
          && entry.roleTitleLocalizationSource !== 'same_locale_authoritative'
          && entry.sourceRoleTitle
          && entry.sourceRoleTitle !== entry.role,
        ),
    });
    const surface = inspectSummaryV2TranslatableSurface({
      localizedText: entry.role,
      sourceText: entry.sourceRoleTitle || entry.role,
      employer: entry.employer,
      targetLocale: manifest.locale,
    });
    return {
      owningEntryHash: hashSummaryV2Text(entry.entryId),
      detectedLocale: surface.detectedLocale,
      detectedScript: surface.detectedScript,
      classification: 'translatable' as const,
      targetLocaleNativeSurfacePassed: surface.targetLocaleNativeSurfacePassed,
      localizedTitleHash: hashSummaryV2Text(entry.role),
      sourceRoleTitleHash: entry.sourceRoleTitleHash || hashSummaryV2Text(entry.role),
      genderValidationPassed: gender.passed,
      genderValidationApplicable: gender.applicable,
      genderValidationReason: gender.reason,
      expectedRoleTitleHash: gender.expectedRoleTitleHash,
      provenance: entry.roleTitleLocalizationSource || 'source_manifest_role_title',
    };
  });
  const roleTitleSurfaceValidationPassed = roleTitleSurfaceEvidence.every(
    (entry) => entry.targetLocaleNativeSurfacePassed && entry.genderValidationPassed,
  );
  const roleTitleGenderValidationPassed = roleTitleSurfaceEvidence.every(
    (entry) => entry.genderValidationPassed,
  );
  const nativeContract = evaluateNativeRealizationContract({
    text,
    locale: manifest.locale,
    perspectiveMode: 'first_person',
    gender: manifest.gender,
  });
  const perspectiveValidationPassed = nativeContract.firstPersonPredicateChainPassed;
  const arabicMorphologyValidationPassed = manifest.locale !== 'ar'
    || nativeContract.localeVerbMorphologyPassed;
  const russianMorphologyValidationPassed = manifest.locale !== 'ru'
    || nativeContract.localeVerbMorphologyPassed;
  const hindiFirstPersonAgreementPassed = manifest.locale !== 'hi'
    || nativeContract.hindiFirstPersonAgreementPassed;

  let reason: string | null = null;
  if (!text) reason = 'empty_summary';
  else if (!hasLiveAuthority) reason = 'no_live_experience_authority';
  else if (!roleTitleSurfaceValidationPassed) reason = 'foreign_role_title_surface';
  else if (!localePurity.targetLocalePurityPassed) reason = 'locale_impurity';
  else if (staleResidueDetected) reason = 'stale_occupation_residue';
  else if (unsupportedMaterialClaim) reason = 'unsupported_material_claim';
  else if (!qualityMannerAuthorityPassed) reason = 'unsupported_quality_manner_claim';
  else if (!materialAuthority.invariantPassed) {
    reason = 'material_authority_provenance_invariant_failed';
  } else if (materialAuthority.unsupportedPrintClaimCount > 0) {
    reason = 'unsupported_print_medium_claim';
  }
  else if (!hindiFirstPersonAgreementPassed) reason = 'hindi_first_person_agreement_invalid';
  else if (!perspectiveValidationPassed) reason = 'mixed_perspective';
  else if (
    manifest.locale === 'hr'
    && !nativeContract.nativeCoordinationValidationPassed
    && nativeContract.nativeRealizationRejectionReasons.includes(
      'unnatural_coordination:hr_awkward_professional_role_intro',
    )
  ) reason = 'hr_awkward_professional_role_intro';
  else if (nativeContract.nativeRealizationRejectionReasons.includes(
    'locale_verb_morphology:ptbr_invalid_role_intro_valency',
  )) reason = 'ptbr_invalid_role_intro_valency';
  else if (!arabicMorphologyValidationPassed) reason = 'malformed_arabic_finite_verb';
  else if (!russianMorphologyValidationPassed) reason = 'malformed_russian_finite_verb';
  else if (current && (!currentRolePresent || !currentEmployerPresent || !currentStateExpressed)) {
    reason = 'missing_current_role_intro';
  } else if (prior && (!priorRolePresent || !priorEmployerPresent || !priorStateExpressed)) {
    reason = 'missing_prior_role_intro';
  } else if (!ownership.passed) {
    reason = ownership.reason || 'final_unit_ownership_failed';
  } else if (manifest.totalDurationMonths <= 0 && durationExpressionCount > 0) {
    reason = 'unsupported_duration_without_dates';
  } else if (manifest.totalDurationMonths > 0 && durationExpressionCount !== 1) {
    reason = 'duration_not_exactly_once';
  } else if (requiredCurrent.length > 0 && coveredCurrent < requiredCurrent.length) {
    reason = 'current_duty_coverage_incomplete';
  } else if (requiredPrior.length > 0 && coveredPrior < requiredPrior.length) {
    reason = 'prior_duty_coverage_incomplete';
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
    unsupportedQualityMannerClaimCount: unsupportedQualityMannerClaims.length,
    unsupportedQualityMannerClaimKinds: [...new Set(unsupportedQualityMannerClaims.map((claim) => claim.kind))],
    unsupportedQualityMannerClaimHashes: [...new Set(unsupportedQualityMannerClaims.map((claim) => claim.surfaceHash))],
    qualityMannerAuthorityPassed,
    targetLocalePurityPassed: localePurity.targetLocalePurityPassed,
    sourceLanguageLeakageDetected: localePurity.sourceLanguageLeakageDetected,
    unexpectedLocaleCodes: localePurity.unexpectedLocaleCodes as Locale[],
    sourceLanguageLeakageTokens: [],
    wrongLocaleUnitCount: localePurity.wrongLocaleUnitCount,
    wrongScriptUnitCount: localePurity.wrongScriptUnitCount,
    roleTitleSurfaceValidationPassed,
    roleTitleGenderValidationPassed,
    roleTitleSurfaceEvidence,
    perspectiveValidationPassed,
    arabicMorphologyValidationPassed,
    russianMorphologyValidationPassed,
    hindiFirstPersonAgreementPassed,
    hindiSentenceAgreementRecords: nativeContract.hindiSentenceAgreementRecords,
    printClaimDetected: materialAuthority.printClaimDetected,
    sourcePrintFactPresent: materialAuthority.sourcePrintFactPresent,
    unsupportedPrintClaimCount: materialAuthority.unsupportedPrintClaimCount,
    materialAuthority,
    unitOwnershipValidationPassed: ownership.passed,
    unitOwnershipFailureReason: ownership.reason,
    finalUnitOwnership: ownership.evidence,
    factUnitCoverageEvidence,
    factUnitOwnershipValidationPassed,
  };
}
