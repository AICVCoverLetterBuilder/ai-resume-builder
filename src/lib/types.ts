export type Region = 'US' | 'EU' | 'Balkan' | 'MiddleEast' | 'India' | 'Japan';

export type TemplateId = 'modern-minimal' | 'creative-bold' | 'creative-artistic' | 'elegant-formal' | 'clean-simple' | 'professional-classic' | 'ats-standard' | 'executive-premium' | 'nordic-clean' | 'tech-sidebar' | 'corporate-navy' | 'contemporary-bold' | 'rirekisho';

export type ProfessionCategory = 'tech' | 'marketing' | 'executive' | 'student' | 'general' | 'startup';

export type Tone = 'formal' | 'confident' | 'friendly';

export interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  photo?: string;
  photoEnabled?: boolean;
  jobTitle: string;
  linkedIn?: string;
  website?: string;
  fathersName?: string;
  nationality?: string;
  dateOfBirth?: string;
  gender?: string;
}

/** Provenance of the visible experience `description` field. */
export type CvExperienceDescriptionOrigin =
  | 'user'
  | 'ai_generated'
  | 'ai_repaired'
  | 'deterministic_fallback'
  | 'user_confirmed_ai_edit';

export interface WorkExperience {
  id: string;
  company: string;
  position: string;
  /**
   * How `position` was authored. Display/export may re-project app-localized
   * occupation titles into the active content locale, but must preserve exact
   * manual free-text (including intentional foreign-script titles).
   */
  positionProvenance?:
    | 'manual'
    | 'occupation_option'
    | 'ai_generated'
    | 'localized_generated'
    | 'legacy_unknown';
  /** True when the user materially edited the position field in the form. */
  positionUserEdited?: boolean;
  /** Locale in which the app last generated or localized `position`, when known. */
  positionSourceLocale?: string;
  /** Optional stable occupation key when selected from localized options. */
  positionSourceKey?: string;
  startDate: string;
  endDate: string;
  isPresent: boolean;
  /** Display / localized bullets for the active UI locale (may be AI-generated). */
  description: string;
  /**
   * Original user-entered duties before any AI transformation.
   * Safest grounding source; never written from AI output.
   */
  originalUserDescription?: string;
  /**
   * User-confirmed canonical grounding facts (initialized from original user input
   * or explicit user edit). Never automatically promoted from AI output.
   */
  canonicalDescription?: string;
  /** Provenance of the visible `description` field. */
  descriptionOrigin?: CvExperienceDescriptionOrigin;
  /** Last AI/fallback generated description (display), if any. */
  generatedDescription?: string;
  /** Locale of `generatedDescription` / last AI apply for this experience. */
  generatedLocale?: string;
  /** Locale of the current explicit user/manual description, when known. */
  descriptionSourceLocale?: string;
  /**
   * Per-entry AI output provenance (stable Experience.id ownership).
   * Unedited AI output hashes + pre-AI fact snapshot for later operations.
   */
  aiOutputProvenance?: import('./cv-experience-ai-output-provenance').ExperienceAiOutputProvenanceRecord;
  /**
   * Marks originalUserDescription/canonicalDescription that were recovered from
   * classified legacy display text (not ordinary user-confirmed typing).
   */
  groundingRecoverySource?: 'legacy_recovered_display_duties' | 'legacy_user_origin_duties';
  /**
   * Semantic duty keys recovered for export grounding alongside
   * canonicalDescription when present. Identity is key-based — not tied to
   * display line count or English shell padding.
   */
  recoveredSemanticDuties?: Array<{
    key: string;
    confidence: 'narrow_supported' | 'exact_user_origin';
    sourceClauseIndex: number;
    sourceClause?: string;
    sourceClauseHash?: string;
    sourceFactId?: string;
  }>;
  /**
   * Job-context identity for the last AI/fallback Experience generation
   * (position class + industry + locale + level). Used to invalidate stale
   * AI grounding after occupation/industry changes.
   */
  generationJobContextKey?: string;
  /** Job-context identity when genuine user grounding was captured. */
  groundingJobContextKey?: string;
  /** Prior generation context key retained for non-PII diagnostics. */
  previousGenerationJobContextKey?: string;
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  startDate: string;
  endDate: string;
  description: string;
}

/** Provenance for the active professional summary — controls duration-injection policy. */
export type CvSummaryOrigin =
  | 'user'
  | 'ai_generated'
  | 'ai_repaired'
  | 'deterministic_fallback';

export interface CVData {
  id: string;
  name: string;
  personal: PersonalInfo;
  summary: string;
  /** Locale of the visible CV content after apply / legacy hydration. */
  contentLocale?: string;
  /** Locale of the last generated Summary, when the visible Summary is AI-authored. */
  summaryGeneratedLocale?: string;
  /** Idempotent persisted-runtime migration marker. */
  runtimeMigrationVersion?: number;
  /** Frozen source-locale summary (mirrors canonicalSnapshot when present). */
  canonicalSummary?: string;
  /**
   * Who authored the current summary. AI/fallback summaries must carry the shared
   * deterministic duration; user-written summaries must not be force-injected.
   */
  summaryOrigin?: CvSummaryOrigin;
  /**
   * Job-context identity for the last AI/fallback Summary generation
   * (same key scheme as Experience). Used to invalidate stale Summary text after
   * occupation/industry changes without requiring a manual Summary regenerate.
   */
  summaryGenerationContextKey?: string;
  experience: WorkExperience[];
  education: Education[];
  skills: string[];
  certifications: string[];
  languages: { name: string; level: string }[];
  templateId: TemplateId;
  region: Region;
  createdAt: string;
  updatedAt: string;
  /**
   * Locale-aware canonical source lock. Locale is the validated source language
   * (Serbian-first, Hindi-first, Arabic-first, …) — never assumed English.
   */
  canonicalSnapshot?: import('./cv-canonical-snapshot').CanonicalCvSnapshot;
  /** Localized projections keyed by requested locale; must match snapshot revision/hash to export. */
  localizedProjections?: Record<string, import('./cv-canonical-snapshot').ValidatedLocalizedCvProjection>;
  /** Source-bound, lazily-created Experience duty surfaces persisted with the draft. */
  experienceLocalizedSurfaces?: import('./cv-experience-localized-surfaces').ExperienceLocalizedSurfaceStore;
}

export interface CoverLetterData {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female' | 'prefer_not_to_say' | '';
  jobTitle: string;
  companyName: string;
  tone: Tone;
  content: string;
  templateId: TemplateId;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  plan: 'free' | 'pro';
  cvs: CVData[];
  coverLetters: CoverLetterData[];
  downloadsUsed: { cv: number; cl: number };
}

export const regionSettings: Record<Region, {
  photoRequired: boolean;
  dateFormat: string;
  showAddress: boolean;
  showAge: boolean;
  formalTone: boolean;
}> = {
  US: { photoRequired: false, dateFormat: 'MM/YYYY', showAddress: false, showAge: false, formalTone: false },
  EU: { photoRequired: true, dateFormat: 'MM.YYYY', showAddress: true, showAge: false, formalTone: true },
  Balkan: { photoRequired: true, dateFormat: 'DD.MM.YYYY', showAddress: true, showAge: true, formalTone: true },
  MiddleEast: { photoRequired: true, dateFormat: 'DD/MM/YYYY', showAddress: true, showAge: true, formalTone: true },
  India: { photoRequired: true, dateFormat: 'DD/MM/YYYY', showAddress: true, showAge: true, formalTone: true },
  Japan: { photoRequired: true, dateFormat: 'YYYY/MM/DD', showAddress: true, showAge: true, formalTone: true },
};

export const templateInfo: Record<TemplateId, {
  name: string;
  category: string;
  professions: ProfessionCategory[];
  description: string;
  isPro: boolean;
}> = {
  'modern-minimal': { name: 'Modern Minimal', category: 'ATS-Friendly', professions: ['tech', 'general'], description: 'Clean, ATS-ready design that gets your profile noticed by recruiters fast.', isPro: false },
  'clean-simple': { name: 'Clean Simple', category: 'ATS-Friendly', professions: ['student', 'general'], description: 'Simple and clear layout that makes a strong impression for any first application.', isPro: false },
  'professional-classic': { name: 'Professional Classic', category: 'ATS-Friendly', professions: ['general', 'executive'], description: 'Trusted by recruiters across all industries — timeless, polished, dependable.', isPro: false },
  'creative-bold': { name: 'Creative Bold', category: 'Creative', professions: ['marketing'], description: 'Stand out instantly with a bold layout built to impress in creative industries.', isPro: true },
  'creative-artistic': { name: 'Creative Artistic', category: 'Creative', professions: ['marketing'], description: 'Express your personality with a stylish design that leaves a lasting impression.', isPro: true },
  'elegant-formal': { name: 'Elegant Formal', category: 'Executive', professions: ['executive'], description: 'Refined and authoritative — ideal for senior roles where first impressions matter.', isPro: true },
  'ats-standard': { name: 'ATS Standard', category: 'ATS-Friendly', professions: ['tech', 'general'], description: 'Built to pass every automated screen — maximise your chances of reaching the interview.', isPro: true },
  'executive-premium': { name: 'Executive Premium', category: 'Executive', professions: ['executive'], description: 'A commanding design for C-level leaders who need to make every word count.', isPro: true },
  'nordic-clean': { name: 'Nordic Clean', category: 'Modern', professions: ['tech', 'general'], description: 'Calm, focused layout that lets your experience speak clearly — no clutter.', isPro: true },
    'tech-sidebar': { name: 'Tech Sidebar', category: 'Modern', professions: ['tech', 'marketing'], description: 'Two-column structure that organises your skills and experience for maximum impact.', isPro: true },
    'corporate-navy': { name: 'Corporate Navy', category: 'Executive', professions: ['executive', 'general'], description: 'Bold and authoritative — signals confidence from the first glance.', isPro: true },
      'contemporary-bold': { name: 'Contemporary Bold', category: 'Modern', professions: ['tech', 'startup'], description: 'Strong, structured design for tech and startup roles that demand attention.', isPro: true },
      'rirekisho': { name: '履歴書 (Rirekisho)', category: 'Japanese', professions: ['general', 'tech', 'executive'], description: 'The authentic Japanese CV format — built to meet local hiring standards perfectly.', isPro: true },
    };

export type RecommendationConfidence = 'insufficient-data' | 'rules-based';

export interface TemplateRecommendation {
  templateId: TemplateId;
  confidence: RecommendationConfidence;
  reason: string;
}

export const TEMPLATE_TIE_BREAK_ORDER: TemplateId[] = [
  'modern-minimal',
  'clean-simple',
  'professional-classic',
  'ats-standard',
  'tech-sidebar',
  'nordic-clean',
  'contemporary-bold',
  'creative-bold',
  'creative-artistic',
  'corporate-navy',
  'elegant-formal',
  'executive-premium',
  'rirekisho',
];

export const PREMIUM_RECOMMENDATION_TIE_BREAK_ORDER: TemplateId[] = TEMPLATE_TIE_BREAK_ORDER.filter(
  (id) => templateInfo[id].isPro,
);

const PREMIUM_FALLBACK_TEMPLATE: TemplateId = PREMIUM_RECOMMENDATION_TIE_BREAK_ORDER[0];

function isTemplateId(value: string): value is TemplateId {
  return Object.prototype.hasOwnProperty.call(templateInfo, value);
}

function isPremiumTemplateId(value: string): value is TemplateId {
  return isTemplateId(value) && templateInfo[value].isPro;
}

export function getPremiumRecommendationFallback(): TemplateId {
  return PREMIUM_FALLBACK_TEMPLATE;
}

export function validatePremiumRecommendationTemplateId(templateId: TemplateId): TemplateId {
  return templateInfo[templateId]?.isPro ? templateId : PREMIUM_FALLBACK_TEMPLATE;
}

export function normalizeRecommendedTemplateId(result: unknown, fallback: TemplateId = PREMIUM_FALLBACK_TEMPLATE): TemplateId {
  const safeFallback = validatePremiumRecommendationTemplateId(fallback);

  if (typeof result === 'string') {
    const normalized = result.trim().toLowerCase().replace(/_/g, '-');
    return isPremiumTemplateId(normalized) ? normalized : safeFallback;
  }

  if (result && typeof result === 'object') {
    const candidate = (result as { templateId?: unknown; id?: unknown; slug?: unknown }).templateId
      ?? (result as { id?: unknown }).id
      ?? (result as { slug?: unknown }).slug;
    return normalizeRecommendedTemplateId(candidate, fallback);
  }

  return safeFallback;
}

function cvRecommendationText(cv: CVData): string {
  return [
    cv.personal.jobTitle,
    cv.summary,
    ...cv.experience.flatMap((exp) => [exp.position, exp.company, exp.description]),
    ...cv.education.flatMap((edu) => [edu.degree, edu.school, edu.description]),
    ...cv.skills,
    ...cv.certifications,
  ].join(' ').toLowerCase();
}

function hasMeaningfulRecommendationInput(cv: CVData): boolean {
  return Boolean(
    cv.personal.jobTitle.trim()
    || cv.summary.trim()
    || cv.experience.some((exp) => exp.position.trim() || exp.company.trim() || exp.description.trim())
    || cv.education.some((edu) => edu.degree.trim() || edu.school.trim() || edu.description.trim())
    || cv.skills.some((skill) => skill.trim())
    || cv.certifications.some((certification) => certification.trim())
  );
}

function inferRecommendationLevel(cv: CVData, explicitLevel?: 'entry' | 'mid' | 'senior'): 'entry' | 'mid' | 'senior' {
  if (explicitLevel) return explicitLevel;

  const text = cvRecommendationText(cv);
  if (/chief|founder|co-founder|director|vp|vice president|head of|principal|staff|architect|senior manager/.test(text)) return 'senior';
  if (/senior|lead|manager|consultant|specialist/.test(text)) return 'senior';
  if (/student|intern|junior|entry|graduate|trainee|apprentice/.test(text)) return 'entry';

  const filledExperience = cv.experience.filter((exp) => exp.position || exp.company || exp.description).length;
  const filledEducation = cv.education.filter((edu) => edu.degree || edu.school || edu.description).length;
  if (filledExperience >= 3) return 'senior';
  if (filledExperience >= 1) return 'mid';
  if (filledEducation > 0) return 'entry';
  return 'mid';
}

function addTemplateScore(scores: Record<TemplateId, number>, ids: TemplateId[], amount: number) {
  ids.forEach((id) => {
    if (!templateInfo[id].isPro) return;
    scores[id] += amount;
  });
}

function cvFromJobTitle(jobTitle: string): CVData {
  return {
    id: 'recommendation-input',
    name: '',
    personal: { fullName: '', email: '', phone: '', address: '', jobTitle },
    summary: '',
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: PREMIUM_FALLBACK_TEMPLATE,
    region: 'US',
    createdAt: '',
    updatedAt: '',
  };
}

export interface TemplateRecommendationScoreBreakdown {
  scores: Record<TemplateId, number>;
  level: 'entry' | 'mid' | 'senior';
  hasPhoto: boolean;
  wordCount: number;
  filledExperience: number;
  premiumCandidates: TemplateId[];
}

export function getTemplateRecommendationScoreBreakdown(input: CVData | string, experienceLevel?: 'entry' | 'mid' | 'senior'): TemplateRecommendationScoreBreakdown {
  const cv = typeof input === 'string' ? cvFromJobTitle(input) : input;
  const text = cvRecommendationText(cv);
  const level = inferRecommendationLevel(cv, experienceLevel);
  const hasPhoto = Boolean(cv.personal.photo && cv.personal.photoEnabled !== false);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const filledExperience = cv.experience.filter((exp) => exp.position || exp.company || exp.description).length;
  const scores = Object.fromEntries((Object.keys(templateInfo) as TemplateId[]).map((id) => [id, 0])) as Record<TemplateId, number>;

  if (cv.region === 'US' || !hasPhoto || wordCount > 180 || /ats|applicant tracking|resume parser|keywords?/.test(text)) {
    addTemplateScore(scores, ['modern-minimal', 'ats-standard', 'professional-classic', 'clean-simple'], 3);
  }

  if (hasPhoto) addTemplateScore(scores, ['nordic-clean', 'creative-bold', 'creative-artistic', 'elegant-formal', 'executive-premium'], 2);
  if (wordCount > 260 || filledExperience >= 4) addTemplateScore(scores, ['tech-sidebar', 'corporate-navy', 'ats-standard', 'professional-classic'], 2);
  if (wordCount < 80 || level === 'entry') addTemplateScore(scores, ['clean-simple', 'modern-minimal', 'ats-standard', 'nordic-clean'], 5);

  if (/software|developer|engineer|devops|data scientist|machine learning|ai engineer|programmer|web|frontend|backend|fullstack|qa|cyber|cloud|sre|platform|mobile|android|ios|typescript|react|python|kubernetes/.test(text)) {
    addTemplateScore(scores, ['tech-sidebar', 'ats-standard', 'modern-minimal', 'contemporary-bold'], level === 'senior' ? 5 : 4);
  }

  if (/sales|account executive|business development|revenue|market|brand|content|social|growth|seo|sem|ppc|email market|product market|campaign|copywriter/.test(text)) {
    addTemplateScore(scores, ['contemporary-bold', 'creative-bold', 'creative-artistic'], 5);
  }

  if (/design|creative|ux|ui|graphic|\bart\b|photo|video|media|animator|illustrator|portfolio|figma/.test(text)) {
    addTemplateScore(scores, ['creative-bold', 'creative-artistic', 'contemporary-bold'], 6);
  }

  if (/ceo|cto|cfo|coo|cmo|cpo|chief|founder|co-founder|director|vp|vice president|head of|managing|president|board/.test(text) || level === 'senior') {
    addTemplateScore(scores, ['executive-premium', 'corporate-navy', 'elegant-formal'], 4);
  }

  if (/finance|financial|banking|investment|analyst|consultant|accountant|auditor|legal|attorney|lawyer|compliance|risk/.test(text)) {
    addTemplateScore(scores, ['corporate-navy', 'professional-classic', 'elegant-formal'], 5);
  }

  if (/doctor|physician|nurse|healthcare|medical|therapist|pharmacist|dentist|clinical/.test(text)) {
    addTemplateScore(scores, ['professional-classic', 'nordic-clean', 'ats-standard'], 4);
  }

  if (/teacher|professor|lecturer|educator|researcher|academic|university|school/.test(text)) {
    addTemplateScore(scores, ['professional-classic', 'ats-standard', 'clean-simple'], 4);
  }

  if (/startup|entrepreneur|product|operations|ops|scrum|agile|delivery/.test(text)) {
    addTemplateScore(scores, ['contemporary-bold', 'tech-sidebar', 'modern-minimal'], 4);
  }

  return {
    scores,
    level,
    hasPhoto,
    wordCount,
    filledExperience,
    premiumCandidates: PREMIUM_RECOMMENDATION_TIE_BREAK_ORDER,
  };
}

export function recommendTemplateDetails(input: CVData | string, experienceLevel?: 'entry' | 'mid' | 'senior'): TemplateRecommendation {
  const cv = typeof input === 'string' ? cvFromJobTitle(input) : input;

  if (cv.region === 'Japan') {
    return { templateId: validatePremiumRecommendationTemplateId('rirekisho'), confidence: 'rules-based', reason: 'Japanese-region CVs use the local Rirekisho format.' };
  }

  if (!hasMeaningfulRecommendationInput(cv)) {
    return {
      templateId: PREMIUM_FALLBACK_TEMPLATE,
      confidence: 'insufficient-data',
      reason: `Not enough CV content to personalize a template recommendation; using the first premium template in the deterministic tie-break order (${PREMIUM_FALLBACK_TEMPLATE}).`,
    };
  }

  const { scores } = getTemplateRecommendationScoreBreakdown(cv, experienceLevel);

  const templateId = PREMIUM_RECOMMENDATION_TIE_BREAK_ORDER.reduce((best, current) => (
    scores[current] > scores[best] ? current : best
  ), PREMIUM_FALLBACK_TEMPLATE);

  return {
    templateId: validatePremiumRecommendationTemplateId(templateId),
    confidence: 'rules-based',
    reason: `Deterministic premium-only score from CV industry signals, experience level, photo presence, content length, and ATS preference; ties use ${PREMIUM_RECOMMENDATION_TIE_BREAK_ORDER.join(' > ')}.`,
  };
}

export function recommendTemplate(input: CVData | string, experienceLevel?: 'entry' | 'mid' | 'senior'): TemplateId {
  return recommendTemplateDetails(input, experienceLevel).templateId;
}
