/**
 * Universal AI button contract: generate vs enhance/regenerate.
 *
 * Shared by Experience, Summary, Cover Letter, stronger-content, and future
 * AI actions. Mode selection is content-emptiness only — never occupation
 * catalogues, locale special-cases, or per-title templates.
 */
import type { Locale } from './i18n/translations';
import type { AiErrorCode } from './ai-error-codes';

export type AiOperationMode =
  | 'generate_from_context'
  | 'enhance_existing_content'
  | 'regenerate_existing_content';

export type AiActionKind =
  | 'experience_bullets'
  | 'summary'
  | 'cover_letter'
  | 'stronger_content'
  | 'rewrite_style';

/** Every user-visible LLM-backed AI button in the product. */
export type AiLlmButtonId =
  | 'experience_ai_improvements'
  | 'summary_generate'
  | 'summary_shorter'
  | 'summary_stronger'
  | 'summary_professional'
  | 'cover_letter_generate'
  | 'cover_letter_regenerate';

export const AI_LLM_BUTTON_INVENTORY: readonly {
  id: AiLlmButtonId;
  uiSurface: string;
  apiAction: string;
  handler: string;
}[] = [
  {
    id: 'experience_ai_improvements',
    uiSurface: 'cv-builder Experience AI Improvements',
    apiAction: 'bullets',
    handler: 'handleGenBullets',
  },
  {
    id: 'summary_generate',
    uiSurface: 'cv-builder Professional Summary Generate',
    apiAction: 'summary',
    handler: 'handleGenSummary',
  },
  {
    id: 'summary_shorter',
    uiSurface: 'cv-builder Summary Shorter',
    apiAction: 'rewrite:shorter',
    handler: 'handleRewrite(shorter)',
  },
  {
    id: 'summary_stronger',
    uiSurface: 'cv-builder Summary Stronger',
    apiAction: 'rewrite:stronger',
    handler: 'handleRewrite(stronger)',
  },
  {
    id: 'summary_professional',
    uiSurface: 'cv-builder Summary Professional',
    apiAction: 'rewrite:professional',
    handler: 'handleRewrite(professional)',
  },
  {
    id: 'cover_letter_generate',
    uiSurface: 'cover-letter Generate',
    apiAction: 'cover-letter-gen',
    handler: 'handleGenerate → runCoverLetterGeneration',
  },
  {
    id: 'cover_letter_regenerate',
    uiSurface: 'cover-letter Regenerate',
    apiAction: 'cover-letter-regen',
    handler: 'handleRegenerate → runCoverLetterGeneration',
  },
] as const;

/**
 * Resolve operation mode for a specific LLM button from latest visible target.
 */
export function resolveAiButtonOperationMode(
  button: AiLlmButtonId,
  targetContent: string | null | undefined,
): AiOperationMode {
  const empty = !(targetContent || '').trim();
  switch (button) {
    case 'experience_ai_improvements':
    case 'summary_generate':
    case 'summary_shorter':
    case 'summary_stronger':
    case 'summary_professional':
    case 'cover_letter_generate':
      return empty ? 'generate_from_context' : 'enhance_existing_content';
    case 'cover_letter_regenerate':
      return empty ? 'generate_from_context' : 'regenerate_existing_content';
    default:
      return resolveAiOperationMode({ targetContent });
  }
}

export function summaryRewriteButtonId(
  style: 'shorter' | 'stronger' | 'professional',
): AiLlmButtonId {
  if (style === 'shorter') return 'summary_shorter';
  if (style === 'stronger') return 'summary_stronger';
  return 'summary_professional';
}

export const AI_SUPPORTED_LOCALES: readonly Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
] as const;

export const AI_INDUSTRY_VALUES = [
  'general', 'tech', 'data_ai', 'cybersecurity', 'sales_retail', 'sales_b2b',
  'marketing', 'finance', 'banking_fintech', 'healthcare', 'pharmacy',
  'education', 'human_resources', 'customer_service', 'logistics', 'operations',
  'executive', 'project_management', 'design', 'engineering', 'construction',
  'hospitality', 'legal', 'administration', 'sales',
] as const;

export const AI_LEVEL_VALUES = ['entry', 'mid', 'senior', 'lead'] as const;

export type ResolveAiOperationModeInput = {
  /** Latest visible target field text (empty → generation). */
  targetContent: string | null | undefined;
  /**
   * Optional unit extractor (Experience duties). When omitted, non-whitespace
   * trimmed length decides emptiness.
   */
  contentUnits?: string[];
  /** Explicit regenerate button (e.g. Summary regenerate with existing text). */
  forceRegenerate?: boolean;
};

/**
 * Universal mode decision — identical for every AI button.
 */
export function resolveAiOperationMode(
  input: ResolveAiOperationModeInput,
): AiOperationMode {
  if (input.forceRegenerate) return 'regenerate_existing_content';
  const units = input.contentUnits;
  if (units) {
    return units.filter((u) => (u || '').trim()).length === 0
      ? 'generate_from_context'
      : 'enhance_existing_content';
  }
  const text = (input.targetContent || '').trim();
  return text.length === 0
    ? 'generate_from_context'
    : 'enhance_existing_content';
}

export function aiTargetContentWasEmpty(
  targetContent: string | null | undefined,
  contentUnits?: string[],
): boolean {
  return resolveAiOperationMode({ targetContent, contentUnits }) === 'generate_from_context';
}

/** Fold free-text for soft stem matching (any script). */
export function foldAiTextToken(token: string): string {
  return (token || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * Title stems from the user's free-text occupation — not a catalogue.
 * Tokens length ≥ 3 (or ≥ 2 for CJK) become soft relevance anchors.
 */
export function freeTextTitleStems(position: string): string[] {
  const raw = (position || '').trim();
  if (!raw) return [];
  const parts = raw
    .split(/[\s/|,;·•\-–—]+/u)
    .map(foldAiTextToken)
    .filter((t) => {
      if (!t) return false;
      if (/[\u3040-\u30ff\u3400-\u9fff]/.test(t)) return t.length >= 1;
      return t.length >= 3;
    });
  return [...new Set(parts)].slice(0, 16);
}

/**
 * Soft relevance: generated text should share ≥1 stem with the free-text title
 * when stems exist. Empty title → pass (context may be industry/level only).
 */
export function textLooksRelevantToFreeTextTitle(
  text: string,
  position: string,
): boolean {
  const stems = freeTextTitleStems(position);
  if (!stems.length) return true;
  const folded = foldAiTextToken(text);
  if (!folded) return false;
  return stems.some((stem) => {
    const needle = stem.slice(0, Math.min(stem.length, Math.max(4, Math.floor(stem.length * 0.75))));
    return needle.length >= 2 && folded.includes(needle);
  });
}

const GENERIC_FILLER_RE =
  /obavlja\s+dodeljene\s+profesionalne\s+(?:poslove|zadatke)|carry\s+out\s+assigned\s+professional\s+duties|सौंपे\s+गए\s+पेशेवर\s+कार्य|führt\s+zugewiesene\s+aufgaben|realiza\s+tareas\s+asignadas|exécute\s+les\s+tâches\s+assignées/iu;

const UNSAFE_INVENTION_RE =
  /(?:\bKPI\b|\bOKR\b|\bExcel\b|\bSalesforce\b|\bSAP\b|\bCRM\b|\bJira\b|\bSlack\b|%\s*(?:poveć|increase|growth|steigerung)|lead(?:ership|er)?\s+team|managed\s+\d+|tim\s+od\s+\d+|team\s+of\s+\d+|klijent(?:ima|e)|clients?|achievement|nagrada|award|certificat|ISO\s*\d+|increased\s+revenue)/iu;

export function aiOutputLooksGenericFillerOnly(text: string): boolean {
  const lines = (text || '')
    .split(/\r?\n|•/)
    .map((l) => l.replace(/^[•\-\*]\s*/, '').trim())
    .filter(Boolean);
  if (!lines.length) return true;
  return lines.every((l) => GENERIC_FILLER_RE.test(l));
}

export function countAiUnsafeInventionClaims(text: string): number {
  const t = text || '';
  if (!t.trim()) return 0;
  return UNSAFE_INVENTION_RE.test(t) ? 1 : 0;
}

export type AiTypedFailureReason =
  | 'experience_generation_failed'
  | 'experience_generation_not_relevant'
  | 'experience_generation_locale_invalid'
  | 'experience_generation_unsafe_claims'
  | 'experience_enhancement_failed'
  | 'experience_enhancement_fact_coverage_incomplete'
  | 'summary_generation_failed'
  | 'summary_grounding_failed'
  | 'summary_rewrite_failed'
  | 'cover_letter_generation_failed'
  | 'cover_letter_regeneration_failed'
  | 'stronger_content_generation_failed'
  | 'ai_output_locale_invalid'
  | 'ai_output_unsafe_claims'
  | 'ai_request_stale'
  | 'ai_noop'
  | 'generation_validation_failed';

/** Map typed failure → user-facing AiErrorCode (localized separately). */
export function mapAiOperationFailureToErrorCode(
  reason: string | null | undefined,
  action?: AiActionKind,
): AiErrorCode {
  switch (reason) {
    case 'experience_generation_failed':
      return 'experience_generation_failed';
    case 'experience_generation_not_relevant':
      return 'experience_generation_not_relevant';
    case 'experience_generation_locale_invalid':
    case 'ai_output_locale_invalid':
      return 'experience_generation_locale_invalid';
    case 'experience_generation_unsafe_claims':
    case 'ai_output_unsafe_claims':
      return 'experience_generation_unsafe_claims';
    case 'experience_enhancement_failed':
    case 'experience_enhancement_fact_coverage_incomplete':
    case 'experience_material_fact_coverage_incomplete':
      return 'experience_enhancement_fact_coverage_incomplete';
    case 'summary_generation_failed':
      return 'summary_generation_failed';
    case 'summary_grounding_failed':
      return 'summary_grounding_failed';
    case 'summary_rewrite_failed':
      return 'summary_rewrite_failed';
    case 'cover_letter_generation_failed':
      return 'cover_letter_generation_failed';
    case 'cover_letter_regeneration_failed':
      return 'cover_letter_regeneration_failed';
    case 'stronger_content_generation_failed':
      return 'stronger_content_generation_failed';
    case 'ai_noop':
    case 'experience_ai_noop':
      return 'ai_noop';
    case 'ai_request_stale':
      return 'ai_request_stale';
    default:
      if (action === 'rewrite_style' || action === 'stronger_content') {
        return 'summary_rewrite_failed';
      }
      if (action === 'summary') return 'summary_generation_failed';
      if (action === 'cover_letter') return 'cover_letter_generation_failed';
      return 'generation_validation_failed';
  }
}

/** Experience-compat aliases (existing diagnostics / callers). */
export type ExperienceAiOperationModeCompat =
  | 'generate_from_job_context'
  | 'enhance_existing_description';

export function toExperienceAiOperationModeCompat(
  mode: AiOperationMode,
): ExperienceAiOperationModeCompat {
  if (mode === 'generate_from_context') return 'generate_from_job_context';
  return 'enhance_existing_description';
}

export function fromExperienceAiOperationModeCompat(
  mode: ExperienceAiOperationModeCompat | AiOperationMode | string | null | undefined,
): AiOperationMode {
  if (mode === 'generate_from_job_context' || mode === 'generate_from_context') {
    return 'generate_from_context';
  }
  if (mode === 'regenerate_existing_content') return 'regenerate_existing_content';
  return 'enhance_existing_content';
}

/** Local heuristics — not LLM-backed; outside Pro AI usage counting. */
export const AI_NON_LLM_BUTTON_INVENTORY: readonly {
  id: string;
  uiSurface: string;
  handler: string;
}[] = [
  {
    id: 'template_ai_recommend',
    uiSurface: 'cv-builder AI Recommend template',
    handler: 'recommendTemplate (local heuristic)',
  },
  {
    id: 'job_description_analyzer',
    uiSurface: 'cv-builder Job description analyzer',
    handler: 'analyzeJobDescription (local heuristic)',
  },
] as const;

/** True when CV has enough structured context to generate a grounded Summary. */
export function hasSufficientSummaryGenerationContext(cv: {
  personal?: { jobTitle?: string } | null;
  experience?: Array<{
    position?: string;
    company?: string;
    description?: string;
  }> | null;
  skills?: string[] | null;
}): boolean {
  if ((cv.personal?.jobTitle || '').trim()) return true;
  if ((cv.skills || []).some((s) => (s || '').trim())) return true;
  return (cv.experience || []).some(
    (e) =>
      (e.position || '').trim()
      || (e.company || '').trim()
      || (e.description || '').trim(),
  );
}

/**
 * Deterministic, claim-safe style shaping for Summary rewrite fallbacks.
 * Never invents tools, metrics, leadership, or clients.
 */
export function applySummaryRewriteStyleDeterministic(
  text: string,
  style: 'shorter' | 'stronger' | 'professional',
): string {
  const raw = (text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  if (style === 'shorter') {
    const parts = raw.split(/(?<=[.!?。！？])\s+/).filter(Boolean);
    return (parts.slice(0, 2).join(' ') || raw).trim();
  }
  if (style === 'stronger') {
    return raw
      .replace(/\bhelped\b/gi, 'delivered')
      .replace(/\bworked on\b/gi, 'owned')
      .replace(/\bresponsible for\b/gi, 'drove')
      .replace(/\bgood\b/gi, 'solid');
  }
  // professional: strip casual softeners without inventing facts
  return raw
    .replace(/\breally\b/gi, '')
    .replace(/\bvery\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

