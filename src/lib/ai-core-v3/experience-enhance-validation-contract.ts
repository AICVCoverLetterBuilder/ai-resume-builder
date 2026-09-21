export const EXPERIENCE_V3_ENHANCE_VALIDATION_CONTRACT_VERSION = 1 as const;

export type ExperienceV3EnhanceValidationCategory = 'semantic' | 'language_quality';

/**
 * The single finite provider-facing violation vocabulary for Experience V3
 * Enhance. Every entry names one check already required by the evaluator
 * prompt; materiality remains owned by the separate materiality object.
 */
export const EXPERIENCE_V3_ENHANCE_VALIDATION_CONTRACT = [
  {
    code: 'source_fact_loss',
    category: 'semantic',
    meaning: 'The candidate omits or materially changes a required source fact.',
  },
  {
    code: 'entry_ownership_violation',
    category: 'semantic',
    meaning: 'A candidate unit is not owned by the requested Experience entry.',
  },
  {
    code: 'unsupported_claim',
    category: 'semantic',
    meaning: 'The candidate introduces a factual claim not supported by the source.',
  },
  {
    code: 'responsibility_escalation',
    category: 'semantic',
    meaning: 'The candidate escalates responsibility, authority, scope, or universality.',
  },
  {
    code: 'unsupported_quantifier',
    category: 'semantic',
    meaning: 'The candidate introduces an unsupported number, frequency, or quantity.',
  },
  {
    code: 'cross_entry_leakage',
    category: 'semantic',
    meaning: 'The candidate imports a fact from a different Experience entry.',
  },
  {
    code: 'role_company_mutation',
    category: 'semantic',
    meaning: 'The candidate changes the authoritative role or company identity.',
  },
  {
    code: 'date_mutation',
    category: 'semantic',
    meaning: 'The candidate changes authoritative employment dates.',
  },
  {
    code: 'target_language_mismatch',
    category: 'language_quality',
    meaning: 'The candidate is not written in the requested target language.',
  },
  {
    code: 'target_script_mismatch',
    category: 'language_quality',
    meaning: 'The candidate uses a script incompatible with the requested locale.',
  },
  {
    code: 'grammar_defect',
    category: 'language_quality',
    meaning: 'The candidate contains a grammatical or malformed-surface defect.',
  },
  {
    code: 'clarity_defect',
    category: 'language_quality',
    meaning: 'The candidate is unclear or incoherent as professional CV prose.',
  },
  {
    code: 'employment_tense_mismatch',
    category: 'language_quality',
    meaning: 'The candidate tense contradicts the authoritative employment state.',
  },
  {
    code: 'cv_perspective_mismatch',
    category: 'language_quality',
    meaning: 'The candidate does not preserve the required professional CV perspective.',
  },
] as const satisfies readonly Readonly<{
  code: string;
  category: ExperienceV3EnhanceValidationCategory;
  meaning: string;
}>[];

export type ExperienceV3EnhanceValidationCode =
  (typeof EXPERIENCE_V3_ENHANCE_VALIDATION_CONTRACT)[number]['code'];

export const EXPERIENCE_V3_ENHANCE_VALIDATION_CODES = Object.freeze(
  EXPERIENCE_V3_ENHANCE_VALIDATION_CONTRACT.map((entry) => entry.code),
) as readonly ExperienceV3EnhanceValidationCode[];

const experienceV3EnhanceValidationCodeSet = new Set<string>(
  EXPERIENCE_V3_ENHANCE_VALIDATION_CODES,
);

export function experienceV3EnhanceValidationCodesForCategory(
  category: ExperienceV3EnhanceValidationCategory,
): readonly ExperienceV3EnhanceValidationCode[] {
  return EXPERIENCE_V3_ENHANCE_VALIDATION_CONTRACT
    .filter((entry) => entry.category === category)
    .map((entry) => entry.code);
}

export function isExperienceV3EnhanceValidationCode(
  value: unknown,
): value is ExperienceV3EnhanceValidationCode {
  return typeof value === 'string' && experienceV3EnhanceValidationCodeSet.has(value);
}

export function isExperienceV3EnhanceValidationCodeForCategory(
  value: unknown,
  category: ExperienceV3EnhanceValidationCategory,
): value is ExperienceV3EnhanceValidationCode {
  return EXPERIENCE_V3_ENHANCE_VALIDATION_CONTRACT.some(
    (entry) => entry.code === value && entry.category === category,
  );
}

export function experienceV3EnhanceValidationPromptContract(): string {
  const entries = EXPERIENCE_V3_ENHANCE_VALIDATION_CONTRACT.map(
    (entry) => `${entry.category}.${entry.code}: ${entry.meaning}`,
  );
  return `Validation code contract v${EXPERIENCE_V3_ENHANCE_VALIDATION_CONTRACT_VERSION} (use only these exact phase-qualified codes): ${entries.join(' ')}`;
}
