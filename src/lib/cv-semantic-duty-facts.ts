/**
 * Semantic duty-fact contract for export grounding.
 * Duty identity is key-based — not English shell count and not display line count.
 */
import { splitExperienceBullets } from './cv-canonical-facts';
import { classifyMaterialDutyKeys, type MaterialDutyKey } from './cv-material-duty-coverage';
import type { CanonicalCvSnapshot } from './cv-canonical-snapshot';
import type { WorkExperience } from './types';
import { isCrossLocaleOperation } from './cv-content-locale';
import type { Locale } from './i18n/translations';
import {
  resolveExperienceSourceLocale,
  type ExperienceSourceLocaleResolution,
} from './cv-experience-source-locale';

export type SemanticDutyKey =
  | 'food_preparation_restaurant_standards'
  | 'workplace_hygiene'
  | 'kitchen_team_collaboration'
  | 'logistics_transport'
  | 'logistics_loading'
  | 'logistics_delivery'
  | 'team_collaboration'
  | 'process_internal'
  | `user_origin_clause_${string}`;

export type SemanticDutyConfidence = 'narrow_supported' | 'exact_user_origin';

export type RecoveredSemanticDuty = {
  key: SemanticDutyKey;
  confidence: SemanticDutyConfidence;
  sourceClauseIndex: number;
  /** Exact stored user clause used by generic recovery; never emitted in diagnostics. */
  sourceClause?: string;
  /** Stable one-way provenance for the normalized stored user clause. */
  sourceClauseHash?: string;
  /** Canonical snapshot fact ID aligned to this clause, when a snapshot exists. */
  sourceFactId?: string;
  /** Stable Experience owner; required to prevent cross-entry clause reuse. */
  experienceId?: string;
  /** Locale resolved from this entry's current authoritative source. */
  sourceLocale?: string;
  /** Evidence path used to resolve the source locale. */
  sourceLocaleResolution?: ExperienceSourceLocaleResolution;
};

export type ExperienceSemanticGrounding = {
  source: 'legacy_recovered_display_duties' | 'user_origin_recovered' | 'modern_provenance' | 'none';
  duties: RecoveredSemanticDuty[];
  recoveryFailureReason?: string;
};

export const LEGACY_USER_ORIGIN_DUTIES = 'legacy_user_origin_duties' as const;

const MATERIAL_TO_SEMANTIC: Partial<Record<MaterialDutyKey, SemanticDutyKey>> = {
  food_prep: 'food_preparation_restaurant_standards',
  hygiene_workplace: 'workplace_hygiene',
  kitchen_collaboration: 'kitchen_team_collaboration',
  logistics_transport: 'logistics_transport',
  logistics_loading: 'logistics_loading',
  logistics_delivery: 'logistics_delivery',
  team_collaboration: 'team_collaboration',
  process_internal: 'process_internal',
};

const SEMANTIC_ORDER: SemanticDutyKey[] = [
  'food_preparation_restaurant_standards',
  'workplace_hygiene',
  'kitchen_team_collaboration',
  'logistics_transport',
  'logistics_loading',
  'logistics_delivery',
  'team_collaboration',
  'process_internal',
];

/** Internal shells for deterministic Summary/bullet generation only — never display padding. */
export const SEMANTIC_TO_INTERNAL_SHELL: Partial<Record<SemanticDutyKey, string>> = {
  food_preparation_restaurant_standards: 'Prepare dishes according to restaurant standards.',
  workplace_hygiene: 'Maintain workplace hygiene.',
  kitchen_team_collaboration: 'Collaborate with the kitchen team.',
  logistics_transport: 'Transport goods according to schedule.',
  logistics_loading: 'Load and unload goods safely.',
  logistics_delivery: 'Complete deliveries according to route plans.',
  team_collaboration: 'Collaborate with the team.',
  process_internal: 'Follow established internal processes.',
};

function normalizeSourceClause(text: string): string {
  return (text || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/** Non-reversible deterministic hash used only to prove stored-clause provenance. */
export function hashUserOriginSourceClause(text: string): string {
  const normalized = normalizeSourceClause(text);
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16)}_l${normalized.length}`;
}

function clausesMatchExactly(left: string[], right: string[]): boolean {
  return left.length > 0
    && left.length === right.length
    && left.every((clause, index) => normalizeSourceClause(clause) === normalizeSourceClause(right[index] || ''));
}

function clausesAreUsable(clauses: string[]): boolean {
  return clauses.length > 0 && clauses.every((clause) => {
    const normalized = normalizeSourceClause(clause);
    return normalized.length >= 3 && /[\p{L}\p{N}]/u.test(normalized);
  });
}

function explicitUserOrigin(origin: WorkExperience['descriptionOrigin'] | string | undefined): boolean {
  return origin === 'user' || origin === 'manual';
}

/**
 * Recover arbitrary user-entered duties without interpreting or inventing them.
 * Every recovered duty is the current visible manual clause. Legacy original
 * and canonical data is evidence only; it cannot replace a differing clause.
 */
export function recoverSemanticDutiesFromUserOrigin(
  exp: WorkExperience,
  canonicalSnapshot?: CanonicalCvSnapshot,
): ExperienceSemanticGrounding {
  const visible = splitExperienceBullets(exp.description || '');
  const original = splitExperienceBullets(exp.originalUserDescription || '');
  const canonical = splitExperienceBullets(exp.canonicalDescription || '');
  const hasCanonicalEvidence = canonical.length > 0 || Boolean(canonicalSnapshot);

  if (!explicitUserOrigin(exp.descriptionOrigin) || !exp.id?.trim() || !hasCanonicalEvidence) {
    return { source: 'none', duties: [] };
  }
  if (!clausesAreUsable(original) || !clausesAreUsable(visible)) {
    return {
      source: 'none',
      duties: [],
      recoveryFailureReason: 'legacy_user_origin_recovery_insufficient_source',
    };
  }
  if (visible.length !== original.length) {
    return {
      source: 'none',
      duties: [],
      recoveryFailureReason: 'legacy_user_origin_recovery_bullet_mapping_failed',
    };
  }

  // AAB-399: current explicit user/manual content is authoritative. A legacy
  // original/canonical surface may have the same bullet count while belonging
  // to a previous occupation. Such equal-length stale content must never
  // replace the current visible clauses.

  let snapshotFactIds: string[] = [];
  let snapshotClauses: string[] = [];
  if (canonicalSnapshot) {
    const matchingEntries = canonicalSnapshot.canonicalExperiences
      .filter((item) => item.experienceId === exp.id);
    const snapshotEntry = matchingEntries[0];
    const orderedBullets = snapshotEntry?.bullets
      ? [...snapshotEntry.bullets].sort((a, b) => a.order - b.order)
      : [];
    const factIds = orderedBullets.map((bullet) => bullet.factId?.trim()).filter(Boolean);
    const snapshotValid = canonicalSnapshot.canonicalState === 'valid'
      && Boolean(canonicalSnapshot.canonicalSourceHash)
      && canonicalSnapshot.canonicalRevision >= 1
      && matchingEntries.length === 1
      && orderedBullets.length === original.length
      && new Set(factIds).size === orderedBullets.length
      && orderedBullets.every((bullet, index) => (
        Boolean(bullet.factId?.trim())
        && Boolean(bullet.sourceText?.trim())
        && bullet.order === index
      ));
    if (!snapshotValid) {
      return {
        source: 'none',
        duties: [],
        recoveryFailureReason: 'legacy_user_origin_recovery_malformed_snapshot',
      };
    }
    snapshotClauses = orderedBullets.map((bullet) => bullet.sourceText);
    if (clausesMatchExactly(visible, snapshotClauses)) {
      snapshotFactIds = orderedBullets.map((bullet) => bullet.factId);
    }
  }

  if (canonical.length === 0 && snapshotClauses.length === 0) {
    return {
      source: 'none',
      duties: [],
      recoveryFailureReason: 'legacy_user_origin_recovery_insufficient_source',
    };
  }

  const sourceLocaleResult = resolveExperienceSourceLocale(exp, canonicalSnapshot);
  const sourceLocale = sourceLocaleResult.locale || 'unknown';
  const entryIdentityHash = hashUserOriginSourceClause(exp.id);
  const duties: RecoveredSemanticDuty[] = visible.map((sourceClause, sourceClauseIndex) => {
    const sourceClauseHash = hashUserOriginSourceClause(sourceClause);
    const canonicalFactId = snapshotFactIds[sourceClauseIndex];
    return {
      key: `user_origin_clause_${entryIdentityHash}_${sourceClauseHash}`,
      confidence: 'exact_user_origin',
      sourceClauseIndex,
      sourceClause,
      sourceClauseHash,
      sourceFactId: canonicalFactId
        || `experience-${entryIdentityHash}-clause-${sourceClauseIndex}-${sourceClauseHash}`,
      experienceId: exp.id,
      sourceLocale,
      sourceLocaleResolution: sourceLocaleResult.resolution,
    };
  });
  return { source: 'user_origin_recovered', duties };
}

export function recoveredUserOriginNeedsSourceBoundLocalization(
  grounding: ExperienceSemanticGrounding,
  targetLocale: Locale,
): boolean {
  if (grounding.source !== 'user_origin_recovered' || grounding.duties.length === 0) return false;
  const sourceLocales = [...new Set(grounding.duties.map((duty) => duty.sourceLocale || 'unknown'))];
  return sourceLocales.length !== 1
    || sourceLocales[0] === 'unknown'
    || isCrossLocaleOperation(sourceLocales[0], targetLocale);
}

const RECOVERABLE_MATERIAL = new Set<MaterialDutyKey>(Object.keys(MATERIAL_TO_SEMANTIC) as MaterialDutyKey[]);

/** Reject clauses that invent unsupported claims. */
const UNSAFE_CLAUSE_RE =
  /भंडारण|स्टॉक|इन्वेंटरी|नेतृत्व|दबाव|कुशलता|स्वास्थ्य|मानक उच्च|storage|inventory|leadership|pressure|efficiency|cuisine|mediterranean|serbian cuisine|health standard|high[- ]quality|under pressure|achievement|metric|reliability|initiative|management|team leadership/iu;

function materialKeysInOrder(text: string): MaterialDutyKey[] {
  const found = new Set(
    classifyMaterialDutyKeys(text).filter((key) => RECOVERABLE_MATERIAL.has(key)),
  );
  const order: MaterialDutyKey[] = [
    'food_prep',
    'hygiene_workplace',
    'kitchen_collaboration',
    'logistics_transport',
    'logistics_loading',
    'logistics_delivery',
    'team_collaboration',
    'process_internal',
  ];
  return order.filter((key) => found.has(key));
}

/**
 * Classify visible/legacy display text into semantic duties.
 * One display line may yield multiple duty keys (hygiene + kitchen on one clause).
 */
export function recoverSemanticDutiesFromDisplayText(visible: string): ExperienceSemanticGrounding {
  const text = (visible || '').trim();
  if (!text || UNSAFE_CLAUSE_RE.test(text)) {
    return { source: 'none', duties: [] };
  }

  const clauses = splitExperienceBullets(text);
  if (clauses.length === 0) return { source: 'none', duties: [] };

  const duties: RecoveredSemanticDuty[] = [];
  const seen = new Set<SemanticDutyKey>();

  for (let clauseIndex = 0; clauseIndex < clauses.length; clauseIndex += 1) {
    const clause = clauses[clauseIndex];
    if (UNSAFE_CLAUSE_RE.test(clause)) {
      return { source: 'none', duties: [] };
    }
    const materials = materialKeysInOrder(clause);
    if (materials.length === 0) {
      return { source: 'none', duties: [] };
    }
    for (const material of materials) {
      const key = MATERIAL_TO_SEMANTIC[material];
      if (!key || seen.has(key)) continue;
      seen.add(key);
      duties.push({
        key,
        confidence: 'narrow_supported',
        sourceClauseIndex: clauseIndex,
      });
    }
  }

  duties.sort(
    (a, b) => SEMANTIC_ORDER.indexOf(a.key) - SEMANTIC_ORDER.indexOf(b.key),
  );

  return duties.length > 0
    ? { source: 'legacy_recovered_display_duties', duties }
    : { source: 'none', duties: [] };
}

export function semanticDutyKeys(grounding: ExperienceSemanticGrounding): SemanticDutyKey[] {
  return grounding.duties.map((d) => d.key);
}

export function internalShellsFromSemanticDuties(duties: RecoveredSemanticDuty[]): string {
  return duties
    .map((d) => d.sourceClause || SEMANTIC_TO_INTERNAL_SHELL[d.key])
    .filter(Boolean)
    .join('\n');
}

export function displayTextForSemanticRecovery(exp: WorkExperience): string {
  return ((exp.description || '').trim() || (exp.generatedDescription || '').trim());
}

/**
 * Resolve semantic grounding for an experience.
 * Exact current visible user/manual provenance wins; legacy original and
 * display classification remain fallback evidence for non-user-origin data.
 */
export function resolveExperienceSemanticGrounding(
  exp: WorkExperience,
  options?: { canonicalSnapshot?: CanonicalCvSnapshot },
): ExperienceSemanticGrounding {
  const fromUserOrigin = recoverSemanticDutiesFromUserOrigin(exp, options?.canonicalSnapshot);
  if (fromUserOrigin.recoveryFailureReason) {
    return fromUserOrigin;
  }

  const original = (exp.originalUserDescription || '').trim();
  const currentMatchesOriginal = clausesMatchExactly(
    splitExperienceBullets(exp.description || ''),
    splitExperienceBullets(original),
  );
  if (fromUserOrigin.duties.length > 0 && !currentMatchesOriginal) {
    return fromUserOrigin;
  }

  const isLegacyRecovered = exp.groundingRecoverySource === 'legacy_recovered_display_duties';
  const display = displayTextForSemanticRecovery(exp);
  const fromDisplay = recoverSemanticDutiesFromDisplayText(display);

  if (original) {
    const fromOriginal = recoverSemanticDutiesFromDisplayText(original);
    // Upgrade incomplete prior shell recovery when display yields more duties.
    if (fromDisplay.duties.length > fromOriginal.duties.length) {
      return fromDisplay;
    }
    if (fromOriginal.duties.length > 0) {
      return {
        source: isLegacyRecovered ? 'legacy_recovered_display_duties' : 'modern_provenance',
        duties: fromOriginal.duties,
      };
    }
  }

  if (fromUserOrigin.duties.length > 0) {
    return fromUserOrigin;
  }

  return fromDisplay;
}
