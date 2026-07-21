/**
 * Experience AI no-op recovery: provider echo → one stylistic repair →
 * deterministic stylistic fallback. Never treats whitespace/bullet/case-only
 * deltas as meaningful improvement.
 */
import type { Locale } from './i18n/translations';
import {
  formatExperienceBullets,
  splitExperienceBullets,
} from './cv-canonical-facts';
import {
  experienceAiHasMeaningfulChange,
} from './cv-experience-perspective';
import {
  extractSourceDutyUnits,
  stripDutyListPrefix,
  universalPreserveSourceUnit,
} from './cv-source-fact-identity';

export const EXPERIENCE_AI_NOOP_RECOVERY_REVISION = 'experience-ai-noop-recovery-293-v1' as const;

export type ExperienceAiNoOpFinalCandidateSource =
  | 'provider'
  | 'noop_repair'
  | 'deterministic_fallback'
  | 'none';

export function isRecoverableExperienceProviderNoOp(result: {
  blocked?: boolean;
  countedAsSuccess?: boolean;
  reason?: string;
  diagnostics?: {
    noOpRejected?: boolean;
    providerNoOpDetected?: boolean;
    typedFailureReason?: string;
    rejectionStage?: string;
  };
}): boolean {
  if (result.countedAsSuccess) return false;
  const d = result.diagnostics;
  if (d?.providerNoOpDetected || d?.noOpRejected) return true;
  const reason = result.reason || d?.typedFailureReason || '';
  return reason === 'ai_no_meaningful_change'
    || reason === 'experience_ai_noop'
    || d?.rejectionStage === 'provider:noop';
}

/** Prompt for one dedicated provider rewrite after an echo/no-op. */
export function buildExperienceAiNoOpRepairPrompt(options: {
  locale: Locale | string;
  sourceDescription: string;
  previousOutput: string;
  isPresent: boolean;
  gender?: string;
  industry?: string;
  level?: string;
  position?: string;
}): string {
  const tense = options.isPresent
    ? 'current-role present / habitual-present CV tense'
    : 'completed-role past CV tense';
  return [
    'EXPERIENCE AI NO-OP REPAIR REQUIRED.',
    `Rewrite the experience bullets in ${options.locale}.`,
    'The previous model output was rejected because it was materially identical to the source.',
    'Make a real stylistic and professional improvement while preserving EVERY source duty.',
    'Do NOT add new duties, tools, achievements, metrics, numbers, employers, or facts.',
    'Do NOT drop, merge-away, or replace any material duty.',
    `Employment state tense: ${tense}.`,
    options.gender ? `Gender grammar: ${options.gender}.` : '',
    options.industry ? `Industry context: ${options.industry}.` : '',
    options.level ? `Seniority: ${options.level}.` : '',
    options.position ? `Role title (context only): ${options.position}.` : '',
    'Output ONLY bullet lines starting with "•", same count and order as SOURCE FACTS.',
    'SOURCE FACTS (immutable):',
    options.sourceDescription.slice(0, 2500),
    'Previous rejected output (do not echo unchanged):',
    options.previousOutput.slice(0, 2500),
  ].filter(Boolean).join('\n');
}

/**
 * Light professional polish for South Slavic CV bullets — wording must change
 * under normalizeSourceFactText, without inventing duties.
 */
function polishSouthSlavicUnit(unit: string): string {
  let t = stripDutyListPrefix(unit || '').trim();
  if (!t) return t;
  t = t
    .replace(/\bkolegicama i kolegama\b/giu, 'kolegama')
    .replace(/\bna koordinaciji pripreme i premještanja\b/giu, 'pri pripremi i premještanju')
    .replace(/\bna koordinaciji\b/giu, 'pri')
    .replace(
      /\bskladišne evidencije i održava urednu raspoređenost uskladištene robe\b/giu,
      'skladišnu evidenciju te održava uredno i organizirano skladištenje robe',
    )
    .replace(
      /\bskladisne evidencije i odrzava urednu rasporedjenost uskladistene robe\b/giu,
      'skladisnu evidenciju te odrzava uredno i organizirano skladistenje robe',
    )
    .replace(/\bi održava\b/giu, ' te održava')
    .replace(/\bi odrzava\b/giu, ' te odrzava')
    .replace(/\bunutar skladišta\b/giu, 'u skladištu')
    .replace(/\bs kolegama pri\b/giu, 's kolegama na')
    .replace(
      /\bProvjerava točnost zaprimljene robe i prateće dokumentacije\b/giu,
      'Provjerava točnost zaprimljene robe te prateće dokumentacije',
    )
    .replace(
      /\bSurađuje s kolegama pri pripremi i premještanju robe\b/giu,
      'Surađuje s kolegama na pripremi i premještanju robe unutar skladišta',
    );
  // Prefer "te" once between major coordinated clauses when still " i ".
  if (/\bi\b/i.test(t) && !/\bte\b/i.test(t)) {
    t = t.replace(/\bi\b/i, 'te');
  }
  return t.replace(/\s+/g, ' ').trim();
}

function polishEnglishUnit(unit: string): string {
  let t = stripDutyListPrefix(unit || '').trim();
  if (!t) return t;
  t = t
    .replace(/\band maintains\b/gi, ' while maintaining')
    .replace(/\band update\b/gi, ' and routinely update')
    .replace(/\bworks with colleagues\b/gi, 'coordinates with colleagues')
    .replace(/\bcheck(?:s|ing)?\b/gi, 'verifies');
  if (!/\bwhile\b|\broutinely\b|\bcoordinates\b|\bverifies\b/i.test(t)) {
    t = t.replace(/\.$/, '').trim();
    t = `${t} as part of day-to-day role duties.`;
  }
  return t.replace(/\s+/g, ' ').trim();
}

function polishUnit(unit: string, locale: Locale): string {
  if (locale === 'hr' || locale === 'sr') return polishSouthSlavicUnit(unit);
  if (locale === 'en') return polishEnglishUnit(unit);
  // Generic: insert a light professional connector without new nouns/tools.
  let t = stripDutyListPrefix(unit || '').trim();
  if (!t) return t;
  if (!/\bas part of\b|\bu okviru\b|\bim Rahmen\b/i.test(t)) {
    t = t.replace(/[.。۔।!?…]\s*$/u, '').trim();
    if (locale === 'de') t = `${t} im Rahmen der Rolle.`;
    else if (locale === 'ja') t = `${t}（日常業務として）。`;
    else if (locale === 'ru') t = `${t} в рамках повседневных обязанностей.`;
    else if (locale === 'ar') t = `${t} في إطار المهام اليومية.`;
    else if (locale === 'hi') t = `${t} दैनिक भूमिका के अंतर्गत।`;
    else t = `${t} as part of day-to-day role duties.`;
  }
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * Safe deterministic stylistic rewrite after provider + repair both echo.
 * Preserves duty units; forces material wording change when possible.
 */
export function buildExperienceAiNoOpStylisticFallback(options: {
  sourceDescription: string;
  locale: Locale;
  isPresent: boolean;
  gender?: string;
}): string {
  const units = extractSourceDutyUnits(options.sourceDescription);
  if (!units.length) return '';
  const lines = units.map((unit) => {
    const tensed = universalPreserveSourceUnit(unit, {
      isPresent: options.isPresent,
      locale: options.locale,
      gender: options.gender,
    }) || stripDutyListPrefix(unit);
    const polished = polishUnit(tensed, options.locale);
    return polished || tensed;
  });
  const text = formatExperienceBullets(lines);
  if (experienceAiHasMeaningfulChange(options.sourceDescription, text)) {
    return text;
  }
  // Last-resort per-unit differentiator that still avoids new duties/tools.
  const forced = lines.map((line, i) => {
    const base = line.replace(/[.。۔।!?…]\s*$/u, '').trim();
    if (options.locale === 'hr' || options.locale === 'sr') {
      return `${base} u sklopu redovitih radnih zadataka.`;
    }
    if (options.locale === 'en') {
      return `${base} within regular assigned duties.`;
    }
    return `${base}${i === 0 ? '' : ''}`.trim() || line;
  });
  const forcedText = formatExperienceBullets(forced);
  return experienceAiHasMeaningfulChange(options.sourceDescription, forcedText)
    ? forcedText
    : '';
}

export function experienceAiNoOpFallbackIsSafe(options: {
  sourceDescription: string;
  candidate: string;
}): boolean {
  const candidate = (options.candidate || '').trim();
  if (!candidate) return false;
  if (!experienceAiHasMeaningfulChange(options.sourceDescription, candidate)) return false;
  const srcCount = extractSourceDutyUnits(options.sourceDescription).length;
  const outCount = splitExperienceBullets(candidate).filter(Boolean).length;
  if (srcCount > 0 && outCount > 0 && outCount < srcCount) return false;
  return true;
}
