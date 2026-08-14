/**
 * Shared occupation-agnostic Experience predicate grounding (AAB-343+).
 *
 * Dedicated warehouse/locale scanners remain stricter specializations.
 * When no dedicated module applies, this layer derives predicate identities
 * from authoritative source duty units (not bullet count or locale alone).
 *
 * Cross-locale matching uses action-frame + material semantic coverage
 * (same substrate as fact coverage), not raw token overlap.
 */
import { splitExperienceBullets } from './cv-canonical-facts';
import {
  classifyExperienceActionFrame,
  validateCrossLocaleSemanticCoverage,
} from './cv-cross-locale-experience';
import {
  extractSourceDutyUnits,
  sourceFactIdentityId,
  stripDutyListPrefix,
} from './cv-source-fact-identity';
import {
  classifyMaterialDutyKeys,
  localizedHasDuty,
  materialDutyKeysFromDescription,
  validateMaterialDutyCoverage,
  validateDistinctExperienceBullets,
  validateNoExtraGeneratedDuties,
} from './cv-material-duty-coverage';
import type { MaterialDutyKey } from './cv-material-duty-coverage';
import {
  sourceHasWarehouseDomainApplicability,
  sourceIsCookingHospitalityWithoutWarehouseEvidence,
} from './cv-warehouse-domain-applicability';

/** Packaging proof — must survive minification in web / Android / AAB assets. */
export const GENERIC_EXPERIENCE_PREDICATE_343_REVISION =
  'generic-experience-predicate-343-v1' as const;

void GENERIC_EXPERIENCE_PREDICATE_343_REVISION;

/** True when authoritative source has extractable duties needing predicate coverage. */
export function sourceRequiresGenericExperiencePredicates(
  sourceDescription: string,
): boolean {
  void GENERIC_EXPERIENCE_PREDICATE_343_REVISION;
  const units = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter((u) => (u || '').trim().length >= 8);
  return units.length >= 1;
}

export type GenericExperiencePredicateScan = {
  revision: typeof GENERIC_EXPERIENCE_PREDICATE_343_REVISION;
  sourcePredicateIdentityCount: number;
  candidatePredicateIdentityCount: number;
  candidateAddedPredicateCount: number;
  candidateAddedPredicateIdentityHashes: string[];
  sourceUnitPredicateCoveragePassed: boolean;
  finalCandidatePredicateValidationApplicable: true;
  missingPredicateIdentityHashes: string[];
  reason: string | null;
};

function genericPredicateIdentity(sourceUnit: string): string {
  const frame = classifyExperienceActionFrame(sourceUnit);
  const sf = sourceFactIdentityId(sourceUnit);
  return `gen_pred_${frame}_${sf.replace(/^sf_/, '')}`;
}

function addedPredicateIdentity(candidateUnit: string): string {
  const sf = sourceFactIdentityId(candidateUnit);
  return `gen_pred_added_${sf.replace(/^sf_/, '')}`;
}

function canonicalMaterialDutyKey(key: string): string {
  const aliases: Record<string, string> = {
    warehouse_document_check: 'warehouse_inbound_check',
    warehouse_orderly_goods: 'warehouse_records',
    warehouse_preparation: 'warehouse_movement',
    warehouse_colleague_coordination: 'warehouse_movement',
    design_graphic_elements: 'design_visual_materials',
    design_project_requirements: 'design_review_adapt',
    design_different_screens: 'design_files_formats',
    design_team_collaboration: 'team_collaboration',
  };
  return aliases[key] || key;
}

function specificMaterialDutyKeys(unit: string): string[] {
  return Array.from(new Set(
    classifyMaterialDutyKeys(unit || '')
      .filter((key) => key !== 'generic_duty')
      .map((key) => canonicalMaterialDutyKey(key)),
  ));
}

/** A paraphrase may not change its source unit's material action/object family. */
function materialUnitsCompatible(
  sourceUnit: string,
  candidateUnit: string,
  sourceMaterialKeys: Set<string>,
  allowUnclassifiedLocalizedMaterial = false,
): boolean {
  const sourceKeys = specificMaterialDutyKeys(sourceUnit);
  const candidateKeys = specificMaterialDutyKeys(candidateUnit);
  if (sourceKeys.length === 0 && candidateKeys.length === 0) return true;
  const supportedCandidateKeys = candidateKeys.every((key) => sourceMaterialKeys.has(key));
  if (sourceKeys.length === 0) return supportedCandidateKeys && candidateKeys.length > 0;
  if (allowUnclassifiedLocalizedMaterial && candidateKeys.length === 0) return true;
  const localizedSourceKeysCovered = sourceKeys.every(
    (key) => localizedHasDuty(key as MaterialDutyKey, candidateUnit),
  );
  return supportedCandidateKeys
    && localizedSourceKeysCovered
    && (candidateKeys.length === 0
      || candidateKeys.some((key) => sourceKeys.includes(key)));
}

function framesCompatible(
  want: ReturnType<typeof classifyExperienceActionFrame>,
  got: ReturnType<typeof classifyExperienceActionFrame>,
): boolean {
  if (want === got) return true;
  // Soft near-equivalents (mirrors validateCrossLocaleSemanticCoverage).
  if (want === 'generic_duty' || got === 'generic_duty') return true;
  const softPairs: Array<[string, string]> = [
    ['prepare_materials', 'coordinate_info'],
    ['prepare_materials', 'check_records'],
    ['prepare_materials', 'update_records'],
    ['prepare_materials', 'collaborate_visual'],
    ['check_records', 'update_records'],
    ['check_records', 'coordinate_info'],
    ['check_records', 'collaborate_visual'],
    ['coordinate_info', 'collaborate_visual'],
    ['update_records', 'collaborate_visual'],
  ];
  return softPairs.some(
    ([a, b]) => (want === a && got === b) || (want === b && got === a),
  );
}

function dominantWritingSystem(
  text: string,
): 'arabic' | 'cyrillic' | 'devanagari' | 'latin' | 'other' {
  const counts = {
    arabic: (text.match(/\p{Script=Arabic}/gu) || []).length,
    cyrillic: (text.match(/\p{Script=Cyrillic}/gu) || []).length,
    devanagari: (text.match(/\p{Script=Devanagari}/gu) || []).length,
    latin: (text.match(/\p{Script=Latin}/gu) || []).length,
  };
  const best = (Object.entries(counts) as Array<[keyof typeof counts, number]>)
    .sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : 'other';
}

/**
 * Bipartite 1:1 match of source units ↔ candidate units by action frame.
 * Returns covered source indices and unused candidate indices.
 */
function matchSourceToCandidateUnits(
  sourceUnits: string[],
  candUnits: string[],
  allowUnclassifiedLocalizedMaterial = false,
): { coveredSi: number[]; usedCi: Set<number> } {
  const coveredSi: number[] = [];
  const usedCi = new Set<number>();
  const srcFrames = sourceUnits.map((u) => classifyExperienceActionFrame(u));
  const candFrames = candUnits.map((u) => classifyExperienceActionFrame(u));
  const sourceMaterialKeys = new Set(
    sourceUnits.flatMap((unit) => specificMaterialDutyKeys(unit)),
  );

  // Prefer exact frame matches first, then soft.
  for (const exactOnly of [true, false]) {
    for (let si = 0; si < sourceUnits.length; si += 1) {
      if (coveredSi.includes(si)) continue;
      const want = srcFrames[si]!;
      let matched = -1;
      for (let ci = 0; ci < candUnits.length; ci += 1) {
        if (usedCi.has(ci)) continue;
        if (!materialUnitsCompatible(
          sourceUnits[si]!,
          candUnits[ci]!,
          sourceMaterialKeys,
          allowUnclassifiedLocalizedMaterial,
        )) continue;
        const sourceMaterial = specificMaterialDutyKeys(sourceUnits[si]!);
        const candidateMaterial = specificMaterialDutyKeys(candUnits[ci]!);
        const materialIdentityMatch = sourceMaterial.length > 0
          && sourceMaterial.every((key) => localizedHasDuty(key as MaterialDutyKey, candUnits[ci]!))
          && (candidateMaterial.length === 0
            || candidateMaterial.some((key) => sourceMaterial.includes(key)));
        if (exactOnly && materialIdentityMatch) {
          matched = ci;
          break;
        }
        const got = candFrames[ci]!;
        if (exactOnly) {
          if (want === got) {
            matched = ci;
            break;
          }
        } else if (framesCompatible(want, got)) {
          matched = ci;
          break;
        }
      }
      if (matched >= 0) {
        usedCi.add(matched);
        coveredSi.push(si);
      }
    }
  }
  return { coveredSi, usedCi };
}

/**
 * Scan occupation-agnostic predicate coverage for Experience AI.
 * Identities are stable hashes of authoritative source units; candidate units
 * must cover each source identity 1:1 without merges, splits, or additions.
 */
export function scanGenericExperiencePredicates(
  sourceDescription: string,
  candidateDescription: string,
  options?: {
    allowValidatedCrossScriptBridge?: boolean;
    /**
     * Route-level cross-locale validation has already proved the requested
     * locale, perspective, and target employment state.  That proof allows a
     * same-script translation (for example Hindi -> French after source
     * locale detection is unavailable) to use the same one-to-one semantic
     * bridge as a cross-script translation.  This is opt-in so the ordinary
     * generic predicate gate remains unchanged for every other caller.
     */
    allowValidatedCrossLocaleBridge?: boolean;
  },
): GenericExperiencePredicateScan {
  void GENERIC_EXPERIENCE_PREDICATE_343_REVISION;
  const sourceUnits = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter((u) => (u || '').trim().length >= 8);
  const sourceIds = sourceUnits.map((u) => genericPredicateIdentity(u));
  const candUnits = splitExperienceBullets(candidateDescription || '')
    .map((b) => stripDutyListPrefix(b).trim())
    .filter(Boolean);

  if (!sourceUnits.length) {
    return {
      revision: GENERIC_EXPERIENCE_PREDICATE_343_REVISION,
      sourcePredicateIdentityCount: 0,
      candidatePredicateIdentityCount: 0,
      candidateAddedPredicateCount: 0,
      candidateAddedPredicateIdentityHashes: [],
      sourceUnitPredicateCoveragePassed: false,
      finalCandidatePredicateValidationApplicable: true,
      missingPredicateIdentityHashes: [],
      reason: 'generic_experience_predicate_source_empty',
    };
  }

  const distinct = validateDistinctExperienceBullets(candidateDescription);
  const extras = validateNoExtraGeneratedDuties(
    sourceDescription,
    candidateDescription,
  );
  // Material keys are advisory for the generic path: Romance/CJK soft shells and
  // cross-locale fallbacks may paraphrase objects while still covering frames 1:1.
  // Unsupported tools/metrics/scope still fail via validateNoExtraGeneratedDuties.
  // Cross-domain leakage: cooking sources must not accept design/warehouse shells.
  const srcKeys = materialDutyKeysFromDescription(sourceDescription || '');
  const candKeys = materialDutyKeysFromDescription(candidateDescription || '');
  const materialCoverage = validateMaterialDutyCoverage(
    sourceDescription || '',
    candidateDescription || '',
  );
  const sourceCooking = sourceIsCookingHospitalityWithoutWarehouseEvidence(
    sourceDescription || '',
  )
    || srcKeys.some((k) => k === 'food_prep'
      || k === 'hygiene_workplace'
      || k === 'kitchen_collaboration');
  const candidateDesign = candKeys.some((k) => k.startsWith('design_'))
    || /(?:डिज़ाइन|डिजाइन|grafi[cč]k|dise[nñ]o|design\s+handoff|ビジュアル|مواد\s*بصرية)/iu
      .test(candidateDescription || '');
  const candidateWarehouseLeak = !sourceHasWarehouseDomainApplicability(sourceDescription || '')
    && candKeys.some((k) => k.startsWith('warehouse_'))
    && /(?:गोदाम|माल की तैयारी|skladišt|warehouse|Wareneingang|mercanc[ií]a)/iu
      .test(candidateDescription || '');
  const crossDomainLeakage = sourceCooking && (candidateDesign || candidateWarehouseLeak);

  const warehouseApplicable = sourceHasWarehouseDomainApplicability(sourceDescription || '');
  // Dedicated locale scanners recognize broader warehouse vocabulary. The
  // generic layer may accept an unclassified localized object only when its
  // action frame still maps one-to-one; registered added duties remain fatal.
  let { coveredSi, usedCi } = matchSourceToCandidateUnits(
    sourceUnits,
    candUnits,
    warehouseApplicable,
  );
  const semanticCoverage = validateCrossLocaleSemanticCoverage(
    sourceDescription || '',
    candidateDescription || '',
  );
  const sourceWritingSystem = dominantWritingSystem(sourceDescription || '');
  const candidateWritingSystem = dominantWritingSystem(candidateDescription || '');
  // Translation can legitimately change both lexical action frames and the
  // surface material-family token. Permit an identity bridge only when every
  // independent safety boundary proves a complete 1:1 translation. Added,
  // merged, duplicated, unsupported, and cross-domain actions remain fatal.
  const provenCrossLocaleTranslation = (
    options?.allowValidatedCrossScriptBridge === true
    || options?.allowValidatedCrossLocaleBridge === true
  )
    && sourceWritingSystem !== 'other'
    && candidateWritingSystem !== 'other'
    && sourceUnits.length === candUnits.length
    && semanticCoverage.ok
    && extras.valid
    && distinct.ok
    && !crossDomainLeakage;
  if (provenCrossLocaleTranslation && coveredSi.length < sourceUnits.length) {
    coveredSi = sourceUnits.map((_, index) => index);
    usedCi = new Set(candUnits.map((_, index) => index));
  }
  const missing = sourceIds.filter((_, i) => !coveredSi.includes(i));
  const addedHashes: string[] = [];
  for (let ci = 0; ci < candUnits.length; ci += 1) {
    if (!usedCi.has(ci)) {
      addedHashes.push(addedPredicateIdentity(candUnits[ci]!));
    }
  }
  // Include inserted material predicates even when the surrounding candidate
  // unit was consumed. This closes the merge-two-source-units + invented-shell
  // aggregate-coverage hole.
  const sourceMaterialKeys = new Set(
    sourceUnits.flatMap((unit) => specificMaterialDutyKeys(unit)),
  );
  if (!provenCrossLocaleTranslation) {
    for (let ci = 0; ci < candUnits.length; ci += 1) {
      for (const key of specificMaterialDutyKeys(candUnits[ci]!)) {
        if (sourceMaterialKeys.has(key)) continue;
        const id = addedPredicateIdentity(`extra:material_key:${key}:${ci}`);
        if (!addedHashes.includes(id)) addedHashes.push(id);
      }
    }
  }
  if (extras.valid === false) {
    for (const label of extras.extras || []) {
      const id = addedPredicateIdentity(`extra:${label}`);
      if (!addedHashes.includes(id)) addedHashes.push(id);
    }
  }
  if (crossDomainLeakage) {
    const id = addedPredicateIdentity(
      candidateDesign ? 'extra:cross_domain_design' : 'extra:cross_domain_warehouse',
    );
    if (!addedHashes.includes(id)) addedHashes.push(id);
  }

  const merged = candUnits.length > 0
    && candUnits.length < sourceUnits.length;
  const normalizedCandidateUnits = candUnits.map((unit) => unit
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim());
  const literalDuplicate = new Set(normalizedCandidateUnits).size
    < normalizedCandidateUnits.length;
  const splitOrDup = literalDuplicate
    || (!distinct.ok
      && sourceUnits.length >= 2
      && !warehouseApplicable);
  const countMismatch = candUnits.length !== sourceUnits.length;
  const coveredCount = coveredSi.length;

  // This scanner already performs a stricter one-to-one action-frame match.
  // Do not also require the older aggregate semantic matcher: it can collapse
  // two warehouse duties into one family even when every source unit has a
  // distinct, material-preserving target bullet.
  const ok = missing.length === 0
    && addedHashes.length === 0
    && !merged
    && !splitOrDup
    && !countMismatch
    && !crossDomainLeakage
    && (provenCrossLocaleTranslation || warehouseApplicable || materialCoverage.valid)
    && coveredCount === sourceUnits.length
    && candUnits.length === sourceUnits.length;

  let reason: string | null = null;
  if (!ok) {
    if (crossDomainLeakage) {
      reason = 'generic_experience_predicate_cross_domain_leakage';
    } else if (addedHashes.length > 0 || candUnits.length > sourceUnits.length) {
      reason = 'generic_experience_predicate_added_action';
    } else if (!warehouseApplicable && !materialCoverage.valid) {
      reason = 'source_unit_predicate_coverage_failed';
    } else if (merged || (countMismatch && candUnits.length < sourceUnits.length)) {
      reason = 'generic_experience_predicate_merged_duties';
    } else if (splitOrDup) {
      reason = 'generic_experience_predicate_split_or_duplicate';
    } else if (missing.length > 0) {
      reason = 'source_unit_predicate_coverage_failed';
    } else {
      reason = 'source_unit_predicate_coverage_failed';
    }
  }

  return {
    revision: GENERIC_EXPERIENCE_PREDICATE_343_REVISION,
    sourcePredicateIdentityCount: sourceIds.length,
    candidatePredicateIdentityCount: coveredCount,
    candidateAddedPredicateCount: addedHashes.length,
    candidateAddedPredicateIdentityHashes: addedHashes,
    sourceUnitPredicateCoveragePassed: ok,
    finalCandidatePredicateValidationApplicable: true,
    missingPredicateIdentityHashes: missing,
    reason,
  };
}
