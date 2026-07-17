/**
 * Semantic duty-fact contract for export grounding.
 * Duty identity is key-based — not English shell count and not display line count.
 */
import { splitExperienceBullets } from './cv-canonical-facts';
import { classifyMaterialDutyKeys, type MaterialDutyKey } from './cv-material-duty-coverage';
import type { WorkExperience } from './types';

export type SemanticDutyKey =
  | 'food_preparation_restaurant_standards'
  | 'workplace_hygiene'
  | 'kitchen_team_collaboration'
  | 'logistics_transport'
  | 'logistics_loading'
  | 'logistics_delivery'
  | 'team_collaboration'
  | 'process_internal';

export type SemanticDutyConfidence = 'narrow_supported';

export type RecoveredSemanticDuty = {
  key: SemanticDutyKey;
  confidence: SemanticDutyConfidence;
  sourceClauseIndex: number;
};

export type ExperienceSemanticGrounding = {
  source: 'legacy_recovered_display_duties' | 'modern_provenance' | 'none';
  duties: RecoveredSemanticDuty[];
};

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
export const SEMANTIC_TO_INTERNAL_SHELL: Record<SemanticDutyKey, string> = {
  food_preparation_restaurant_standards: 'Prepare dishes according to restaurant standards.',
  workplace_hygiene: 'Maintain workplace hygiene.',
  kitchen_team_collaboration: 'Collaborate with the kitchen team.',
  logistics_transport: 'Transport goods according to schedule.',
  logistics_loading: 'Load and unload goods safely.',
  logistics_delivery: 'Complete deliveries according to route plans.',
  team_collaboration: 'Collaborate with the team.',
  process_internal: 'Follow established internal processes.',
};

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
    .map((d) => SEMANTIC_TO_INTERNAL_SHELL[d.key])
    .filter(Boolean)
    .join('\n');
}

export function displayTextForSemanticRecovery(exp: WorkExperience): string {
  return ((exp.description || '').trim() || (exp.generatedDescription || '').trim());
}

/**
 * Resolve semantic grounding for an experience.
 * Modern provenance (user original) wins; otherwise recover from display.
 */
export function resolveExperienceSemanticGrounding(exp: WorkExperience): ExperienceSemanticGrounding {
  const original = (exp.originalUserDescription || '').trim();
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

  return fromDisplay;
}
