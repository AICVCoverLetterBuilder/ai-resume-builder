/**
 * Experience AI job-context identity and stale-generated-content invalidation.
 *
 * When position/industry materially change, prior AI-generated (or legacy-recovered
 * AI) duties must not ground the next Experience AI Improvement — even if they
 * remain visible until the user regenerates.
 */
import type { Locale } from './i18n/translations';
import type { WorkExperience } from './types';

function isAiOrigin(origin?: string | null): boolean {
  return origin === 'ai_generated'
    || origin === 'ai_repaired'
    || origin === 'deterministic_fallback';
}

const COOKING_SEMANTIC_DUTY_KEYS = [
  'food_preparation_restaurant_standards',
  'workplace_hygiene',
  'kitchen_team_collaboration',
] as const;

const COOKING_KEY_SET = new Set<string>(COOKING_SEMANTIC_DUTY_KEYS);
export type ExperienceJobContextInput = {
  position?: string | null;
  industry?: string | null;
  locale?: string | null;
  level?: string | null;
};

export type ExperienceJobContext = {
  key: string;
  positionNorm: string;
  industryNorm: string;
  localeNorm: string;
  levelNorm: string;
  positionClass: ExperiencePositionClass;
};

export type ExperiencePositionClass =
  | 'baker_food'
  | 'pharmacist_pharmacy'
  | 'software_tech'
  | 'hospitality_service'
  | 'logistics'
  | 'healthcare'
  | 'general';

/** Non-PII diagnostic fields for Experience AI traces (no raw CV text). */
export type ExperienceAiJobContextTrace = {
  previousContextKey?: string;
  requestContextKey: string;
  appliedContextKey?: string;
  normalizedPositionClass: ExperiencePositionClass;
  normalizedIndustry: string;
  locale: string;
  level: string;
  descriptionOrigin?: string;
  groundingSource: 'genuine_user' | 'same_context_generated' | 'excluded_stale' | 'none';
  staleGeneratedContentExcluded: boolean;
  semanticDutyKeysBefore: string[];
  semanticDutyKeysUsed: string[];
  requestIdMatch: boolean;
  contextMatch: boolean;
  resultApplied: boolean;
  rejectedReason?: string;
  aiUsageIncremented: boolean;
  /** Non-PII Experience AI rejection / apply diagnostics (no raw duties). */
  sourceLocale?: string;
  sourceFactCount?: number;
  requiredFactCount?: number;
  coveredFactCount?: number;
  providerBulletCount?: number;
  fallbackBulletCount?: number;
  finalBulletCount?: number;
  finalBulletScripts?: string[];
  tenseMode?: 'present' | 'past' | 'unknown';
  rejectionStage?: string;
  typedFailureReason?: string;
  fallbackApplied?: boolean;
  countedAsSuccess?: boolean;
};

function collapseWs(value: string): string {
  return (value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** FNV-1a 32-bit — stable, non-cryptographic, non-PII identity hash. */
export function hashJobContextParts(parts: string[]): string {
  let h = 0x811c9dc5;
  const joined = parts.join('|');
  for (let i = 0; i < joined.length; i++) {
    h ^= joined.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `fnv1a_${(h >>> 0).toString(16)}`;
}

export function normalizeIndustryToken(industry?: string | null): string {
  const t = collapseWs(industry || '');
  if (!t) return 'general';
  if (/pharmac|farmac|apotek|аптек|औषध|薬局/.test(t)) return 'pharmacy';
  if (/hospitalit|food|restoran|restaurant|kuhinj|kitchen|baker|pek/.test(t)) return 'hospitality';
  if (/tech|software|it\b|dev|program/.test(t)) return 'tech';
  if (/logist|warehouse|skladi/.test(t)) return 'logistics';
  if (/health|medic|nurse|doctor/.test(t)) return 'healthcare';
  return t.replace(/[^a-z0-9_+\-]+/g, '_').slice(0, 48) || 'general';
}

export function normalizeLevelToken(level?: string | null): string {
  const t = collapseWs(level || '');
  if (!t) return 'mid';
  if (/entry|junior|počet|pocet|entry-level|प्रवेश|初級/.test(t)) return 'entry';
  if (/senior|seni|виши|वरिष्ठ|シニア/.test(t)) return 'senior';
  if (/lead|manager|rukovod|руковод|प्रबंध|リード/.test(t)) return 'lead';
  if (/mid|srednj|средн|मध्यम|中級/.test(t)) return 'mid';
  return t.slice(0, 24);
}

export function classifyExperiencePosition(position?: string | null): ExperiencePositionClass {
  const t = collapseWs(position || '');
  if (!t) return 'general';
  if (/apotekar|pharmacist|farmac|chemist|pharmaceut|фармацевт|फार्मासिस्ट|薬剤師/.test(t)) {
    return 'pharmacist_pharmacy';
  }
  if (/baker|pekar|pekarka|बेकर|パン職人|bäcker|boulanger/.test(t)) {
    return 'baker_food';
  }
  if (/cook|chef|kuvar|kuhar|bartender|barmen|waiter|konobar|barista/.test(t)) {
    return 'hospitality_service';
  }
  if (/software|developer|engineer|programer|programator|devops|frontend|backend/.test(t)) {
    return 'software_tech';
  }
  if (/driver|warehouse|skladi|skladist|logist|courier|dostavlja|magacin|magacioner|lagerist/.test(t)) {
    return 'logistics';
  }
  if (/nurse|doctor|physician|medic|terapeut|лијеч|врач/.test(t)) {
    return 'healthcare';
  }
  return 'general';
}

export function buildExperienceJobContext(input: ExperienceJobContextInput): ExperienceJobContext {
  const positionNorm = collapseWs(input.position || '');
  const positionClass = classifyExperiencePosition(input.position);
  let industryNorm = normalizeIndustryToken(input.industry);
  // When industry is unset, derive a stable class-aligned token so Summary and
  // Experience share the same job-context key after occupation changes.
  if ((!input.industry || !String(input.industry).trim()) || industryNorm === 'general') {
    if (positionClass === 'pharmacist_pharmacy') industryNorm = 'pharmacy';
    else if (positionClass === 'baker_food' || positionClass === 'hospitality_service') {
      industryNorm = 'hospitality';
    } else if (positionClass === 'software_tech') industryNorm = 'tech';
    else if (positionClass === 'logistics') industryNorm = 'logistics';
    else if (positionClass === 'healthcare') industryNorm = 'healthcare';
  }
  const localeNorm = collapseWs(input.locale || 'en') || 'en';
  const levelNorm = normalizeLevelToken(input.level);
  const key = hashJobContextParts([
    positionClass,
    positionNorm.slice(0, 64),
    industryNorm,
    localeNorm,
    levelNorm,
  ]);
  return {
    key,
    positionNorm,
    industryNorm,
    localeNorm,
    levelNorm,
    positionClass,
  };
}

export function experienceJobContextsMatch(
  a?: Pick<ExperienceJobContext, 'key'> | string | null,
  b?: Pick<ExperienceJobContext, 'key'> | string | null,
): boolean {
  const ka = typeof a === 'string' ? a : a?.key;
  const kb = typeof b === 'string' ? b : b?.key;
  return Boolean(ka && kb && ka === kb);
}

/**
 * Genuine user-authored grounding (typed or user-confirmed), not legacy AI recovery.
 */
export function hasGenuineUserExperienceGrounding(
  exp: Pick<WorkExperience, 'originalUserDescription' | 'groundingRecoverySource' | 'descriptionOrigin'>,
): boolean {
  const orig = (exp.originalUserDescription || '').trim();
  if (!orig) return false;
  if (exp.groundingRecoverySource === 'legacy_recovered_display_duties') return false;
  return true;
}

export function listExperienceSemanticDutyKeys(
  exp: Pick<WorkExperience, 'recoveredSemanticDuties'>,
): string[] {
  return [...new Set((exp.recoveredSemanticDuties || []).map((d) => d.key).filter(Boolean))];
}

function dutyDomainConflictsWithContext(
  keys: string[],
  context: ExperienceJobContext,
): boolean {
  const hasCooking = keys.some((k) => COOKING_KEY_SET.has(k));
  if (!hasCooking) return false;
  return context.positionClass === 'pharmacist_pharmacy'
    || context.positionClass === 'software_tech'
    || context.positionClass === 'logistics'
    || context.industryNorm === 'pharmacy'
    || context.industryNorm === 'tech'
    || context.industryNorm === 'logistics';
}

/**
 * Invalidation matrix (AI Improvement grounding only):
 *
 * | Change                         | Genuine user duties | Same-context AI/legacy | Cross-context AI/legacy |
 * |--------------------------------|---------------------|------------------------|-------------------------|
 * | Locale only                    | keep / localize     | may reuse              | exclude                 |
 * | Level only                     | keep                | new context key        | exclude                 |
 * | Company / dates only           | keep                | keep                   | keep                    |
 * | Position material change       | keep (user facts)   | exclude                | exclude                 |
 * | Industry material change       | keep (user facts)   | exclude                | exclude                 |
 */
export function isExperienceGroundingValidForAiContext(
  exp: WorkExperience,
  requestContext: ExperienceJobContext,
): boolean {
  const keys = listExperienceSemanticDutyKeys(exp);
  const groundingText = (
    exp.canonicalDescription
    || exp.originalUserDescription
    || ''
  ).trim();

  if (hasGenuineUserExperienceGrounding(exp)) {
    if (dutyDomainConflictsWithContext(keys, requestContext)) return false;
    if (
      textLooksLikeCookingDuties(groundingText)
      && (requestContext.positionClass === 'pharmacist_pharmacy'
        || requestContext.industryNorm === 'pharmacy')
    ) {
      return false;
    }
    return true;
  }

  const storedKey = exp.generationJobContextKey || exp.groundingJobContextKey;
  if (storedKey) {
    return experienceJobContextsMatch(storedKey, requestContext.key);
  }

  // Legacy-recovered AI display duties: only reusable in a compatible food context.
  if (exp.groundingRecoverySource === 'legacy_recovered_display_duties') {
    if (dutyDomainConflictsWithContext(keys, requestContext)) return false;
    if (keys.some((k) => COOKING_KEY_SET.has(k)) || textLooksLikeCookingDuties(groundingText)) {
      return requestContext.positionClass === 'baker_food'
        || requestContext.positionClass === 'hospitality_service'
        || requestContext.industryNorm === 'hospitality';
    }
    return false;
  }

  // AI-authored display without a stored context key must not FACT-LOCK a new
  // occupation. Canonical-only rows (legacy package fixtures) remain usable
  // unless the duty domain conflicts with the request role.
  if (isAiOrigin(exp.descriptionOrigin)) {
    if (dutyDomainConflictsWithContext(keys, requestContext)) return false;
    if (
      textLooksLikeCookingDuties(groundingText)
      && (requestContext.positionClass === 'pharmacist_pharmacy'
        || requestContext.positionClass === 'software_tech'
        || requestContext.industryNorm === 'pharmacy'
        || requestContext.industryNorm === 'tech')
    ) {
      return false;
    }
    // AI-only (no canonical/original): never ground from display text alone.
    if (!groundingText) return false;
    return false;
  }

  // Unmarked canonical/original (older fixtures): allow unless domain conflict.
  if (groundingText) {
    if (dutyDomainConflictsWithContext(keys, requestContext)) return false;
    if (
      textLooksLikeCookingDuties(groundingText)
      && (requestContext.positionClass === 'pharmacist_pharmacy'
        || requestContext.industryNorm === 'pharmacy')
    ) {
      return false;
    }
    return true;
  }

  return false;
}

export type AiGroundingResolution = {
  sourceDescription: string;
  groundingSource: ExperienceAiJobContextTrace['groundingSource'];
  staleGeneratedContentExcluded: boolean;
  semanticDutyKeysBefore: string[];
  semanticDutyKeysUsed: string[];
  /** Copy of the experience safe for AI request/finalize fact-set construction. */
  experienceForAi: WorkExperience;
};

/**
 * Resolve which duties may FACT-LOCK Experience AI for the current job context.
 */
export function resolveExperienceAiGrounding(
  exp: WorkExperience,
  requestContext: ExperienceJobContext,
  resolveGroundingText: (e: WorkExperience) => string,
): AiGroundingResolution {
  const semanticDutyKeysBefore = listExperienceSemanticDutyKeys(exp);
  const valid = isExperienceGroundingValidForAiContext(exp, requestContext);
  if (!valid) {
    const hadStaleGeneratedOrRecovered = Boolean(
      exp.groundingRecoverySource === 'legacy_recovered_display_duties'
      || isAiOrigin(exp.descriptionOrigin)
      || exp.generationJobContextKey
      || semanticDutyKeysBefore.length > 0
      || textLooksLikeCookingDuties(
        `${exp.canonicalDescription || ''} ${exp.originalUserDescription || ''} ${exp.description || ''}`,
      ),
    );
    const stripped: WorkExperience = {
      ...exp,
      // Clear display + grounding on the AI request copy so FACT LOCK cannot
      // resurrect excluded occupation duties from the live textarea.
      description: '',
      originalUserDescription: undefined,
      canonicalDescription: undefined,
      recoveredSemanticDuties: undefined,
      groundingRecoverySource: undefined,
      descriptionOrigin: exp.descriptionOrigin && isAiOrigin(exp.descriptionOrigin)
        ? exp.descriptionOrigin
        : 'ai_generated',
    };
    return {
      sourceDescription: '',
      groundingSource: hadStaleGeneratedOrRecovered ? 'excluded_stale' : 'none',
      staleGeneratedContentExcluded: hadStaleGeneratedOrRecovered,
      semanticDutyKeysBefore,
      semanticDutyKeysUsed: [],
      experienceForAi: stripped,
    };
  }

  const text = resolveGroundingText(exp).trim();
  const genuine = hasGenuineUserExperienceGrounding(exp);
  return {
    sourceDescription: text,
    groundingSource: text
      ? (genuine ? 'genuine_user' : 'same_context_generated')
      : 'none',
    staleGeneratedContentExcluded: false,
    semanticDutyKeysBefore,
    semanticDutyKeysUsed: text ? semanticDutyKeysBefore : [],
    experienceForAi: exp,
  };
}

/**
 * After a valid AI apply under `appliedContext`, stamp identity and drop stale
 * recovered cooking keys that belonged to a prior occupation.
 */
export function stampExperienceGenerationContext(
  exp: WorkExperience,
  appliedContext: ExperienceJobContext,
): WorkExperience {
  const previous = exp.generationJobContextKey || exp.groundingJobContextKey;
  const next: WorkExperience = {
    ...exp,
    previousGenerationJobContextKey: previous && previous !== appliedContext.key
      ? previous
      : exp.previousGenerationJobContextKey,
    generationJobContextKey: appliedContext.key,
    groundingJobContextKey: hasGenuineUserExperienceGrounding(exp)
      ? (exp.groundingJobContextKey || appliedContext.key)
      : exp.groundingJobContextKey,
  };
  if (!hasGenuineUserExperienceGrounding(exp)) {
    next.originalUserDescription = undefined;
    next.canonicalDescription = undefined;
    next.groundingRecoverySource = undefined;
    next.recoveredSemanticDuties = undefined;
  } else if (previous && previous !== appliedContext.key) {
    next.recoveredSemanticDuties = undefined;
  }
  return next;
}

/**
 * Safe occupation-aware Experience fallback when no user duties exist.
 * Generic, non-metric, non-achievement claims only.
 */
export function buildOccupationAwareExperienceFallback(options: {
  locale: Locale;
  gender?: string;
  position?: string;
  industry?: string;
  isPresent?: boolean;
}): string {
  const ctx = buildExperienceJobContext({
    position: options.position,
    industry: options.industry,
    locale: options.locale,
  });
  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'ženski' || g === 'zenski';
  const present = options.isPresent !== false;
  const locale = options.locale;

  if (ctx.positionClass === 'pharmacist_pharmacy' || ctx.industryNorm === 'pharmacy') {
    if (locale === 'hr') {
      return [
        '• Obavlja poslove u skladu sa standardima farmaceutske djelatnosti.',
        '• Vodi računa o točnosti, organizaciji radnog prostora i profesionalnoj komunikaciji s klijentima i timom.',
        present
          ? '• Prati svakodnevne procedure i tijek rada u ljekarni uz dogovorenu razinu odgovornosti.'
          : (female
            ? '• Pratila je svakodnevne procedure i tijek rada u ljekarni uz dogovorenu razinu odgovornosti.'
            : '• Pratio je svakodnevne procedure i tijek rada u ljekarni uz dogovorenu razinu odgovornosti.'),
      ].join('\n');
    }
    if (locale === 'sr') {
      return [
        '• Obavlja poslove u skladu sa standardima farmaceutske delatnosti.',
        '• Vodi računa o tačnosti, organizaciji radnog prostora i profesionalnoj komunikaciji sa klijentima i timom.',
        present
          ? '• Prati svakodnevne procedure i tok rada u apoteci uz dogovoreni nivo odgovornosti.'
          : (female
            ? '• Pratila je svakodnevne procedure i tok rada u apoteci uz dogovoreni nivo odgovornosti.'
            : '• Pratio je svakodnevne procedure i tok rada u apoteci uz dogovoreni nivo odgovornosti.'),
      ].join('\n');
    }
    if (locale === 'hi') {
      return [
        '• फार्मेसी संबंधी मानकों के अनुसार पेशेवर कर्तव्य निभाती हूँ।',
        '• कार्यस्थल की व्यवस्था, सटीकता और ग्राहकों तथा टीम के साथ पेशेवर संवाद सुनिश्चित करती हूँ।',
        '• दैनिक प्रक्रियाओं का पालन करते हुए निर्धारित जिम्मेदारी के साथ कार्य करती हूँ।',
      ].join('\n');
    }
    return [
      '• Carry out assigned duties in line with pharmacy practice standards.',
      '• Maintain accuracy, an organised workstation, and professional communication with clients and the team.',
      present
        ? '• Follow day-to-day pharmacy procedures at the agreed level of responsibility.'
        : '• Followed day-to-day pharmacy procedures at the agreed level of responsibility.',
    ].join('\n');
  }

  if (locale === 'sr') {
    return [
      '• Obavlja dodeljene profesionalne poslove u skladu sa standardima radnog mesta.',
      '• Vodi računa o tačnosti, organizaciji rada i profesionalnoj komunikaciji u timu.',
      present
        ? '• Prati dogovorene procedure i svakodnevne zadatke na poziciji.'
        : (female
          ? '• Pratila je dogovorene procedure i svakodnevne zadatke na poziciji.'
          : '• Pratio je dogovorene procedure i svakodnevne zadatke na poziciji.'),
    ].join('\n');
  }
  if (locale === 'hi') {
    return [
      female
        ? '• भूमिका के मानकों के अनुसार सौंपे गए पेशेवर कार्य करती हूँ।'
        : '• भूमिका के मानकों के अनुसार सौंपे गए पेशेवर कार्य करता हूँ।',
      female
        ? '• सटीकता, कार्य व्यवस्था और टीम के साथ पेशेवर संवाद बनाए रखती हूँ।'
        : '• सटीकता, कार्य व्यवस्था और टीम के साथ पेशेवर संवाद बनाए रखता हूँ।',
      female
        ? '• दैनिक प्रक्रियाओं और सहमत जिम्मेदारियों का पालन करती हूँ।'
        : '• दैनिक प्रक्रियाओं और सहमत जिम्मेदारियों का पालन करता हूँ।',
    ].join('\n');
  }
  return [
    '• Carry out assigned professional duties in line with workplace standards.',
    '• Maintain accuracy, organised work practices, and professional team communication.',
    present
      ? '• Follow agreed procedures and day-to-day responsibilities in the role.'
      : '• Followed agreed procedures and day-to-day responsibilities in the role.',
  ].join('\n');
}

/** Detect cooking/restaurant wording that must not survive a pharmacist apply. */
export function textLooksLikeCookingDuties(text: string): boolean {
  return /priprem\w*\s+jel|restoran|kuhinj|kitchen|dish(?:es)?|baker|बेकर|रेस्तरां|व्यंजन|रसोई|restaurant\s+standard|higijen\w*\s+radnog|workplace\s+hygiene|kitchen\s+team|food_preparation|namirnic|kulinar/i.test(
    text || '',
  );
}

/** Detect pharmacy-domain wording that must not ground a non-pharmacy occupation. */
export function textLooksLikePharmacyDuties(text: string): boolean {
  return /farmac|apotek|pharmacy\s+practice|pharmacy\s+procedure|ljekarn|फार्मेसी|薬剤/i.test(text || '');
}

/**
 * Regulated / clinical pharmacist claims that must not be invented from industry
 * or title alone — only permitted when present in genuine user-authored duties.
 */
export function hasUnsupportedRegulatedPharmacyClaims(text: string): boolean {
  return /recept|prescription|dozir|dosage|interakcij|interaction|neželjen|adverse|savetovan\w*\s+(?:pacijen|pacijent|pacijenata)|patient\s+counsel|terapij|therapy|zalih|stock|nabavk|procurement|lekar|doctor|pharmacotherapy|farmakoterap|izdavanj\w*\s+lek|dispens/i.test(
    text || '',
  );
}

/**
 * True when candidate text is from a prior occupation domain incompatible with
 * the request context (used after stale grounding exclusion).
 */
export function candidateConflictsWithJobContext(
  text: string,
  context: ExperienceJobContext,
): boolean {
  if (!text.trim()) return false;
  if (
    textLooksLikeCookingDuties(text)
    && (context.positionClass === 'pharmacist_pharmacy'
      || context.positionClass === 'software_tech'
      || context.industryNorm === 'pharmacy'
      || context.industryNorm === 'tech')
  ) {
    return true;
  }
  if (
    textLooksLikePharmacyDuties(text)
    && (context.positionClass === 'software_tech'
      || context.positionClass === 'baker_food'
      || context.industryNorm === 'tech'
      || context.industryNorm === 'hospitality')
  ) {
    return true;
  }
  if (
    hasUnsupportedRegulatedPharmacyClaims(text)
    && (context.positionClass === 'pharmacist_pharmacy' || context.industryNorm === 'pharmacy')
  ) {
    // Regulated claims without user evidence are always unsupported for empty-grounding
    // generation — callers decide whether user grounding was present.
    return true;
  }
  return false;
}

const COOKING_SEMANTIC_KEYS = new Set([
  'food_preparation_restaurant_standards',
  'workplace_hygiene',
  'kitchen_team_collaboration',
]);

/** Drop semantic duties that conflict with the current occupation context. */
export function filterSemanticDutiesForJobContext<T extends { key: string }>(
  duties: T[],
  context: ExperienceJobContext,
): T[] {
  const foodOk = context.positionClass === 'baker_food'
    || context.positionClass === 'hospitality_service'
    || context.industryNorm === 'hospitality';
  if (foodOk) return duties;
  return duties.filter((d) => !COOKING_SEMANTIC_KEYS.has(d.key));
}

/**
 * Summary is stale for export/preview when it still carries prior-occupation
 * claims (e.g. cooking under Apotekar) or its generation context mismatches.
 */
export function isSummaryStaleForJobContext(
  summary: string,
  context: ExperienceJobContext,
  options?: {
    summaryOrigin?: string | null;
    summaryGenerationContextKey?: string | null;
    isUserAuthoredSummary?: boolean;
  },
): boolean {
  const text = summary || '';
  if (!text.trim()) return false;
  if (
    options?.summaryGenerationContextKey
    && !experienceJobContextsMatch(options.summaryGenerationContextKey, context.key)
    && options.summaryOrigin !== 'user'
  ) {
    return true;
  }
  if (textLooksLikeCookingDuties(text) && !isFoodCompatibleContext(context)) {
    // Even user-authored cooking summaries must not export under pharmacist/
    // software titles as if they were current occupational duties.
    return true;
  }
  return false;
}

function isFoodCompatibleContext(context: ExperienceJobContext): boolean {
  return context.positionClass === 'baker_food'
    || context.positionClass === 'hospitality_service'
    || context.industryNorm === 'hospitality';
}

/**
 * Remove orphan duration noun fragments such as `. godine,` / ` godine, gde`
 * left after broken sentence merges.
 */
export function scrubOrphanDurationFragments(summary: string): string {
  let out = (summary || '').trim();
  // Duplicate "…iskustva. godine," / "…iskustva. godina,"
  out = out.replace(
    /\b(iskustva|iskustvom|iskustvu)\s*\.\s*(godine|godina|godinu)\b[,:]?\s*/giu,
    '$1. ',
  );
  // Orphan ". godine, gde/sa" — but never calendar genitive "YYYY. godine".
  out = out.replace(
    /(?<!\d{4})\.\s*(godine|godina|godinu)\s*[,:]?\s*(?=gde|gdje|u\s|sa\s)/giu,
    '. ',
  );
  out = out.replace(
    /^(godine|godina|godinu)\s*[,:]?\s*(?=gde|gdje|u\s|sa\s)/giu,
    '',
  );
  // Double duration noun after half-year phrase: "i po godine iskustva godine"
  out = out.replace(/\bi\s+po\s+godine\s+iskustva\s*\.?\s*godine\b/giu, 'i po godine iskustva');
  return out.replace(/\s+/g, ' ').trim();
}

/** Safe Summary when duties are role-generic only (no cooking / no regulated claims). */
export function buildOccupationAwareSummaryFallback(options: {
  locale: Locale;
  gender?: string;
  position?: string;
  industry?: string;
  company?: string;
  startDate?: string;
  durationPhrase?: string;
  isPresent?: boolean;
}): string {
  const ctx = buildExperienceJobContext({
    position: options.position,
    industry: options.industry,
    locale: options.locale,
  });
  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'ženski' || g === 'zenski';
  const locale = options.locale;
  const company = (options.company || '').trim();
  const duration = (options.durationPhrase || '').trim();
  const start = (options.startDate || '').trim();
  const monthNamesSr: Record<string, string> = {
    '01': 'januara', '02': 'februara', '03': 'marta', '04': 'aprila',
    '05': 'maja', '06': 'juna', '07': 'jula', '08': 'avgusta',
    '09': 'septembra', '10': 'oktobra', '11': 'novembra', '12': 'decembra',
  };
  const ym = /^(\d{4})-(\d{2})/.exec(start);
  const fromClause = ym && monthNamesSr[ym[2]]
    ? `od ${monthNamesSr[ym[2]]} ${ym[1]}`
    : '';

  if (locale === 'sr' || locale === 'hr') {
    const role = ctx.positionClass === 'pharmacist_pharmacy'
      ? (female ? 'apotekarka' : 'apotekar')
      : ((options.position || '').trim() || (female ? 'profesionalka' : 'profesionalac'));
    const employed = female ? 'Zaposlena' : 'Zaposlen';
    const where = company
      ? `${employed} kao ${role} u kompaniji ${company}${fromClause ? ` ${fromClause}` : ''}`
      : `${employed} kao ${role}${fromClause ? ` ${fromClause}` : ''}`;
    const dur = duration
      ? (duration.startsWith('sa ') || duration.startsWith('s ') ? duration : `sa ${duration}`)
      : '';
    const open = dur ? `${where}, ${dur}.` : `${where}.`;
    const duties = ctx.positionClass === 'pharmacist_pharmacy' || ctx.industryNorm === 'pharmacy'
      ? 'Obavlja zadatke u skladu sa standardima farmaceutske delatnosti i vodi računa o tačnosti, organizaciji radnog prostora i profesionalnoj komunikaciji sa klijentima i timom.'
      : 'Obavlja dodeljene profesionalne zadatke u skladu sa standardima radnog mesta, uz tačnost i profesionalnu komunikaciju u timu.';
    return scrubOrphanDurationFragments(`${open} ${duties}`.replace(/\s+/g, ' ').trim());
  }

  if (locale === 'en') {
    const role = options.position || 'professional';
    const open = company
      ? `Working as ${role} at ${company}${duration ? `, ${duration}` : ''}.`
      : `${role}${duration ? ` ${duration}` : ''}.`;
    const duties = ctx.positionClass === 'pharmacist_pharmacy' || ctx.industryNorm === 'pharmacy'
      ? 'Carries out assigned duties in line with pharmacy practice standards, with attention to accuracy, organisation, and professional communication with clients and the team.'
      : 'Carries out assigned professional duties with accuracy, organisation, and professional team communication.';
    return `${open} ${duties}`.replace(/\s+/g, ' ').trim();
  }

  if (locale === 'hi') {
    const role = options.position || 'पेशेवर';
    return female
      ? `मैं ${role} हूँ और फार्मेसी संबंधी मानकों के अनुसार सटीकता, व्यवस्था और पेशेवर संवाद के साथ कार्य करती हूँ।`
      : `मैं ${role} हूँ और फार्मेसी संबंधी मानकों के अनुसार सटीकता, व्यवस्था और पेशेवर संवाद के साथ कार्य करता हूँ।`;
  }

  return scrubOrphanDurationFragments(
    `${options.position || 'Professional'}${duration ? ` ${duration}` : ''}. Carries out assigned professional duties with accuracy and professional communication.`,
  );
}
