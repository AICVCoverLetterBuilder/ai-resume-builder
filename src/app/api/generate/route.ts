import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { generateBulletsOffline, type BulletIndustry, type BulletLevel } from '@/lib/ai-bullets';
import { DEFAULT_LOCALE, type Locale, resolveLocaleCandidate } from '@/lib/i18n/translations';
import { sanitizeField, sanitizeText } from '@/lib/input-sanitizer';
import { resolveCorsOrigin, buildCorsHeaders, handleOptions } from '@/lib/cors';
import { verifyProToken } from '@/lib/pro-token';
import {
  assembleCoverLetterContent,
  CoverLetterGenerationIncompleteError,
  generateStructuredCoverLetterWithRetries,
  sanitizeCoverLetterContent,
} from '@/lib/cover-letter-generation';
import { buildCoverLetterFactSet } from '@/lib/cover-letter-facts';
import { COVER_LETTER_GROUNDING_BACKEND_REVISION } from '@/lib/cover-letter-grounding-diagnostics';
import { getCoverLetterGenderInstruction, normalizeCoverLetterGender } from '@/lib/cover-letter-gender';
import {
  buildFactSetFromExperienceDescription,
  buildCvCanonicalFactSet,
  formatCanonicalBulletsForPrompt,
  bulletsForExperience,
} from '@/lib/cv-canonical-facts';
import {
  deterministicLocalizedBulletsFromCanonical,
  deterministicLocalizedSummaryFromCanonical,
} from '@/lib/cv-localized-fallback';
import {
  scanGenericExperiencePredicates,
  sourceRequiresGenericExperiencePredicates,
} from '@/lib/cv-generic-experience-predicate-grounding';
import { activateCvExperienceBullets, activateCvSummary } from '@/lib/cv-content-activation';
import { buildJobContextGenerationFallback, validateExperienceGenerationOutput } from '@/lib/cv-experience-ai-operation-mode';
import {
  applySummaryRewriteStyleDeterministic,
  hasSufficientSummaryGenerationContext,
} from '@/lib/cv-ai-operation-contract';
import {
  applyApproximateDurationPolicy,
  durationToPromptToken,
  type ExperienceDuration,
  type ExperienceDurationSnapshot,
} from '@/lib/cv-experience-duration';
import { createHash, randomUUID } from 'crypto';
import type { AiErrorCode } from '@/lib/ai-error-codes';
import { validateAiUnitLocalePurity } from '@/lib/cv-ai-unit-locale-purity';
import {
  AI_PROVIDER_CALL_TIMEOUT_MS,
  EXPERIENCE_LOCALIZATION_TRANSLATION_TIMEOUT_MS,
  EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS,
  callProviderWithDeadline,
  computeExperienceLocalizationDeadline,
  computeServerDeadline,
  hasProviderBudget,
  isProviderAbortOrTimeoutError,
  isRetryableProviderError,
  logAiServerRequestTiming,
  remainingBudgetMs,
  shouldForceRespond,
} from '@/lib/ai-request-timing';
import { parseSummaryV2LocalizationProviderJson } from '@/lib/cv-summary-v2';
import {
  EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
  hashExperienceLocalizedSurfaceValue,
  validateExperienceLocalizationIndependentVerification,
  type ExperienceLocalizationProviderRecord,
  type ExperienceLocalizationIndependentVerificationResponse,
  type ExperienceLocalizationRequest,
  type ExperienceLocalizationRequestRecord,
  EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS,
  EXPERIENCE_LOCALIZATION_MAX_BATCH_SOURCE_CHARS,
  EXPERIENCE_LOCALIZATION_MAX_BATCH_SOURCE_UTF8_BYTES,
  EXPERIENCE_LOCALIZATION_PROVIDER_BATCH_SIZE,
  canonicalizeExperienceLocalizationText,
  measureExperienceLocalizationText,
  validateExperienceLocalizationPhysicalBatch,
} from '@/lib/cv-experience-localized-surfaces';

/**
 * Explicit Vercel serverless function execution budget (seconds).
 * The application response deadline (`AI_SERVER_BUDGET_MS` = 22s) is kept
 * several seconds under this platform limit so cold-start + serialization
 * cannot push a healthy recovery path into a Vercel kill (~31s previously
 * terminated Android build 231 after ~32s with a transport-level network toast).
 *
 * NOTE: Next.js requires this route-segment config to be a plain literal.
 * Kept in sync with `AI_PLATFORM_MAX_DURATION_S` (30) via unit tests.
 */
export const maxDuration = 30;

// ── Rate limiter (in-memory) ────────────────────────────────────────────────
// Resets on server restart. For production with multiple instances, replace with
// an external store (Upstash Redis, etc.).
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
/** Anonymous / IP burst limit — abuse protection (not the Pro 30-day safety cap). */
const RATE_LIMIT_MAX_REQUESTS_IP = 20;
/** Verified Pro token-hash burst limit — higher than IP so rapid UI actions are not mistaken for outages. */
const RATE_LIMIT_MAX_REQUESTS_PRO = 60;

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function rateLimit(
  key: string,
  maxRequests: number,
): { allowed: boolean; retryAfter: number; count: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0, count: 1 };
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)) / 1000);
    return { allowed: false, retryAfter, count: entry.count };
  }

  entry.count++;
  return { allowed: true, retryAfter: 0, count: entry.count };
}

function hashLimiterIdentity(raw: string): string {
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

// Periodic cleanup of stale entries (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
      if (now - entry.windowStart >= RATE_LIMIT_WINDOW_MS * 2) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60_000);
}

function classifyProviderError(err: unknown): {
  code: AiErrorCode;
  status: number;
  retryAfter: number | null;
  providerStatus: number | string | null;
} {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  const statusMatch = msg.match(/\b(429|529|503|502|401|403|402)\b/);
  const providerStatus = statusMatch ? Number(statusMatch[1]) : null;

  if (providerStatus === 429 || lower.includes('rate limit') || lower.includes('too many requests')) {
    return { code: 'provider_rate_limited', status: 429, retryAfter: 60, providerStatus: providerStatus ?? 429 };
  }
  if (providerStatus === 529 || providerStatus === 503 || lower.includes('overloaded') || lower.includes('529')) {
    return { code: 'provider_temporarily_unavailable', status: 503, retryAfter: 60, providerStatus: providerStatus ?? 503 };
  }
  if (lower.includes('credit') || lower.includes('billing') || lower.includes('quota') || providerStatus === 402) {
    return { code: 'provider_credit_exhausted', status: 402, retryAfter: null, providerStatus: providerStatus ?? 402 };
  }
  if (lower.includes('authentication') || lower.includes('invalid api key') || lower.includes('unauthorized') || providerStatus === 401) {
    return { code: 'provider_auth_error', status: 401, retryAfter: null, providerStatus: providerStatus ?? 401 };
  }
  if (
    lower.includes('timeout')
    || lower.includes('aborted')
    || lower.includes('abort')
    || (err instanceof Error && (
      err.name === 'AbortError'
      || err.name === 'APIUserAbortError'
      || err.name === 'APIConnectionTimeoutError'
    ))
  ) {
    return { code: 'request_timeout', status: 504, retryAfter: null, providerStatus: null };
  }
  return { code: 'provider_temporarily_unavailable', status: 503, retryAfter: 60, providerStatus };
}

// ─── Pro token verification ───────────────────────────────────────────────────
const PRO_SIGNING_KEY = process.env.PRO_SIGNING_KEY || '';

// ─── Free tier usage tracker ──────────────────────────────────────────────────
// In-memory tracking of free AI actions per app_user_id.
// Allows free users to use limited AI features without a Pro token.
//
// ⚠ PRODUCTION WARNING — In-memory state on Vercel serverless
//   This Map lives in a single Node.js process instance. On Vercel:
//   • Instances are recycled frequently — quotas reset silently on restart.
//   • Concurrent requests can reach different instances — each has its own Map.
//   • A free user can exceed their limit simply by hitting a fresh instance.
//
//   For production accuracy, replace with an external store (e.g. Upstash Redis,
//   Vercel KV, or a database). Until then, treat this as an approximate throttle
//   for internal testing, NOT a hard enforcement boundary.
const FREE_ACTION_LIMITS: Record<string, number> = {
  'cover-letter-gen': 1,   // 1 cover letter generation per free user
  'cover-letter-regen': 1, // 1 cover letter regeneration per free user
};

const FREE_ALLOWED_ACTIONS = new Set(['cover-letter-gen', 'cover-letter-regen']);
const FREE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24-hour sliding window per user

const freeUsageMap = new Map<string, { counts: Record<string, number>; windowStart: number }>();

function canUseFreeAction(userId: string, action: string): { allowed: boolean; remaining: number } {
  // Only cover-letter-gen and cover-letter-regen are free-allowed
  if (!FREE_ALLOWED_ACTIONS.has(action)) {
    return { allowed: false, remaining: 0 };
  }
  const now = Date.now();
  let entry = freeUsageMap.get(userId);
  if (!entry || now - entry.windowStart >= FREE_WINDOW_MS) {
    entry = { counts: {}, windowStart: now };
    freeUsageMap.set(userId, entry);
  }
  const used = entry.counts[action] || 0;
  const limit = FREE_ACTION_LIMITS[action];
  const remaining = Math.max(0, limit - used);
  if (used >= limit) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: remaining };
}

/**
 * Record a successful free-tier AI action.
 * Must ONLY be called after the AI call succeeds.
 */
function recordFreeAction(userId: string, action: string): void {
  if (!FREE_ALLOWED_ACTIONS.has(action)) return;
  const now = Date.now();
  let entry = freeUsageMap.get(userId);
  if (!entry || now - entry.windowStart >= FREE_WINDOW_MS) {
    entry = { counts: {}, windowStart: now };
    freeUsageMap.set(userId, entry);
  }
  entry.counts[action] = (entry.counts[action] || 0) + 1;
}

// Periodic cleanup of stale free-usage entries (every 30 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of freeUsageMap.entries()) {
      if (now - entry.windowStart >= FREE_WINDOW_MS * 2) {
        freeUsageMap.delete(key);
      }
    }
  }, 30 * 60 * 1000);
}

// ─── Input sanitizer ──────────────────────────────────────────────────────────
// Shared sanitization logic is in @/lib/input-sanitizer

// Client is created lazily at request time so the build succeeds without the key
let anthropic: Anthropic | null = null;

function getClient(): Anthropic {
  // Support Orchids proxy auth (ANTHROPIC_AUTH_TOKEN) as well as direct ANTHROPIC_API_KEY
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }
  if (!anthropic) {
    anthropic = new Anthropic({
      apiKey,
      // Hard-disable SDK retries: the SDK retries timeouts by default, which
      // stacked multiple full timeout slices and held the Vercel invocation
      // open until the platform killed it (~31s → Android network_error).
      maxRetries: 0,
      timeout: AI_PROVIDER_CALL_TIMEOUT_MS,
    });
  }
  return anthropic;
}

const MODEL = 'claude-sonnet-4-6'; // Updated for Orchids proxy compatibility (was claude-3-5-sonnet-latest)

const localeInstructions: Record<Locale, {
  languageName: string;
  fallbackCandidate: string;
  fallbackRole: string;
  fallbackCompany: string;
  coverLetterName: string;
  closing: string;
  toneMap: Record<'formal' | 'confident' | 'friendly', string>;
  nativeQualityNote: string;
}> = {
  en: {
    languageName: 'English', fallbackCandidate: 'the candidate', fallbackRole: 'the role', fallbackCompany: 'the company', coverLetterName: 'Your Name', closing: 'Sincerely',
    toneMap: { formal: 'formal and professional', confident: 'confident and assertive', friendly: 'warm and personable' },
    nativeQualityNote: 'Write as a native English-speaking professional. Use standard business English. Use strong action verbs only when SOURCE FACTS support them. Never invent leadership, tools, or achievements.',
  },
  'pt-BR': {
    languageName: 'Portuguese (Brazil)', fallbackCandidate: 'a pessoa candidata', fallbackRole: 'a vaga', fallbackCompany: 'a empresa', coverLetterName: 'Seu nome', closing: 'Atenciosamente',
    toneMap: { formal: 'formal e profissional', confident: 'confiante e assertivo', friendly: 'caloroso e próximo' },
    nativeQualityNote: 'Escreva como um profissional nativo do Brasil. Use português brasileiro natural. Use verbos de ação fortes somente quando suportados pelos SOURCE FACTS. Nunca invente liderança, ferramentas ou conquistas. Preserve o título exato; ao explicar suporte/logística, prefira "Colaborador de suporte ao cliente na área de logística". Nunca misture inglês no texto salvo siglas padrão.',
  },
  de: {
    languageName: 'German', fallbackCandidate: 'die bewerbende Person', fallbackRole: 'die Position', fallbackCompany: 'das Unternehmen', coverLetterName: 'Ihr Name', closing: 'Mit freundlichen Grüßen',
    toneMap: { formal: 'formell und professionell', confident: 'selbstbewusst und überzeugend', friendly: 'warm und persönlich' },
    nativeQualityNote: 'Schreiben Sie wie ein Muttersprachler im deutschen Geschäftsumfeld. Anrede: „Sehr geehrte Damen und Herren,“ — nie „von {Firma}“. Starke Verben nur bei Beleg in SOURCE FACTS. Niemals Führungs- oder Leistungsversprechen erfinden. Keine erfundenen Tools oder Kennzahlen. Nie „einen ehrlichen Beitrag“ — lieber „einen engagierten Beitrag im Team zu leisten“.',
  },
  es: {
    languageName: 'Spanish', fallbackCandidate: 'la persona candidata', fallbackRole: 'el puesto', fallbackCompany: 'la empresa', coverLetterName: 'Tu nombre', closing: 'Atentamente',
    toneMap: { formal: 'formal y profesional', confident: 'seguro y convincente', friendly: 'cercano y amable' },
    nativeQualityNote: 'Escribe como un profesional nativo. Usa verbos de acción solo si están respaldados por SOURCE FACTS. Nunca inventes liderazgo, herramientas ni logros. Evita "cuando sea apropiado". En tono formal: carta completa (unos tres párrafos), sin "aportar con decisión" ni "El puesto me resulta de verdadero interés". Para tono confiado, no reduzcas la carta a frases demasiado breves e inseguras.',
  },
  fr: {
    languageName: 'French', fallbackCandidate: 'la personne candidate', fallbackRole: 'le poste', fallbackCompany: "l'entreprise", coverLetterName: 'Votre nom', closing: 'Cordialement',
    toneMap: { formal: 'formel et professionnel', confident: 'sûr de soi et affirmé', friendly: 'chaleureux et accessible' },
    nativeQualityNote: "Rédigez comme un professionnel francophone natif. Préférez « vivement intéressé par la possibilité de rejoindre vos équipes » et « mettre mon engagement et ma motivation au service de votre organisation » — pas « intéressé à rejoindre » ni « mettre toute ma bonne volonté ». N'utilisez des verbes d'action forts que s'ils sont étayés par SOURCE FACTS. N'inventez jamais leadership, outils ou réalisations.",
  },
  it: {
    languageName: 'Italian', fallbackCandidate: 'la persona candidata', fallbackRole: 'il ruolo', fallbackCompany: "l'azienda", coverLetterName: 'Il tuo nome', closing: 'Cordiali saluti',
    toneMap: { formal: 'formale e professionale', confident: 'sicuro e deciso', friendly: 'cordiale e umano' },
    nativeQualityNote: "Scrivi come un professionista italiano madrelingua. Usa verbi d'azione forti solo se supportati da SOURCE FACTS. Non inventare leadership, strumenti o risultati. Mai \"mettere a disposizione la mia disponibilità\". Con saluto al team usa \"Vi ringrazio\", non \"La ringrazio\". Per la disponibilità al colloquio usa una frase completa con verbo finito (es. \"rimango a vostra completa disposizione\"), mai un frammento staccato.",
  },
  ar: {
    languageName: 'Arabic', fallbackCandidate: 'المرشح', fallbackRole: 'الوظيفة', fallbackCompany: 'الشركة', coverLetterName: 'اسمك', closing: 'مع خالص التحية',
    toneMap: { formal: 'رسمي واحترافي', confident: 'واثق وحازم', friendly: 'ودود وقريب' },
    nativeQualityNote: 'اكتب بأسلوب عربي فصحى مهني طبيعي. استخدم أفعالًا قوية فقط إن وردت في SOURCE FACTS. لا تخترع قيادة أو أدوات أو إنجازات. فضّل "للتقدم لشغل وظيفة" و"وأتطلع إلى فرصة الانضمام إلى فريقكم" بدل الترجّي. فضّل "والتكيف مع متطلبات هذا الدور والوفاء بمسؤولياته". ولا تُشعِر أن المرشح يعمل أصلًا لدى الشركة.',
  },
  sr: {
    languageName: 'Serbian', fallbackCandidate: 'kandidat', fallbackRole: 'poziciju', fallbackCompany: 'kompaniju', coverLetterName: 'Vaše ime', closing: 'Srdačno',
    toneMap: { formal: 'formalan i profesionalan', confident: 'samouveren i odlučan', friendly: 'topao i pristupačan' },
    nativeQualityNote: 'Piši prirodnim profesionalnim srpskim. Jaki glagoli samo ako su podržani u SOURCE FACTS. Ne izmišljaj vođenje, alate ili postignuća. Latinica. Za „Android tester” koristi „poziciju Android testera”. Za ostale engleske/latinične nazive uloga NE dodaj padežne nastavke (nikad Teachera/Lawyera/Managera) — zadrži tačan naziv u navodnicima: „Teacher“. Izbegavaj „proizvodi koriste korisnici”.',
  },
  hr: {
    languageName: 'Croatian', fallbackCandidate: 'kandidat', fallbackRole: 'poziciju', fallbackCompany: 'tvrtku', coverLetterName: 'Vaše ime', closing: 'Srdačan pozdrav',
    toneMap: { formal: 'formalan i profesionalan', confident: 'samouvjeren i odlučan', friendly: 'topao i pristupačan' },
    nativeQualityNote: 'Piši prirodnim profesionalnim hrvatskim. Jaki glagoli samo ako su podržani u SOURCE FACTS. Ne izmišljaj vodstvo, alate ili postignuća. Latinica. Nepoznate/višeriječi nazive uloga zadrži točno u navodnicima (poziciju „Saradnik…“), bez djelomičnog sklanjanja (nikad „Saradnika za…“). Ne izmišljaj ugled tvrtke.',
  },
  ru: {
    languageName: 'Russian', fallbackCandidate: 'кандидат', fallbackRole: 'позицию', fallbackCompany: 'компанию', coverLetterName: 'Ваше имя', closing: 'С уважением',
    toneMap: { formal: 'формальный и профессиональный', confident: 'уверенный и убедительный', friendly: 'доброжелательный и открытый' },
    nativeQualityNote: 'Пишите естественным деловым русским. Сильные глаголы — только при подтверждении в SOURCE FACTS. Не выдумывайте руководство, инструменты или достижения. Предпочитайте «буду рад возможности присоединиться», не «рассмотреть возможность присоединиться». Не приписывайте компании неподтверждённую ориентацию/престиж.',
  },
  hi: {
    languageName: 'Hindi', fallbackCandidate: 'उम्मीदवार', fallbackRole: 'पद', fallbackCompany: 'कंपनी', coverLetterName: 'आपका नाम', closing: 'सादर',
    toneMap: { formal: 'औपचारिक और पेशेवर', confident: 'आत्मविश्वासी और प्रभावशाली', friendly: 'सौम्य और आत्मीय' },
    nativeQualityNote: 'स्वाभाविक पेशेवर हिंदी लिखें। मजबूत क्रियाएँ केवल तभी जब SOURCE FACTS में हों। नेतृत्व, तकनीक या उपलब्धियाँ गढ़ें नहीं। कंपनी को बिना स्रोत के प्रतिष्ठित/मूल्य-केंद्रित न बताएँ।',
  },
  ja: {
    languageName: 'Japanese', fallbackCandidate: '候補者', fallbackRole: '職種', fallbackCompany: '企業', coverLetterName: 'お名前', closing: '敬具',
    toneMap: { formal: 'フォーマルで丁寧', confident: '自信があり説得力のある', friendly: '親しみやすく温かい' },
    nativeQualityNote: '自然なビジネス日本語で記述してください。強い動詞はSOURCE FACTSがある場合のみ。リーダーシップ・ツール・成果を創作しないでください。企業の評判や価値観（例: 顧客サービスを重視する企業として認識）を根拠なく断言しないでください。自信のあるトーンでは「現時点では…積み重ねていきたい」など過度に弱気な表現を避け、学習と貢献の意思をはっきり書いてください。敬具に読点を付けないでください。',
  },
};

function normalizeLocale(value: unknown): Locale {
  return resolveLocaleCandidate(typeof value === 'string' ? value : null) ?? DEFAULT_LOCALE;
}

/**
 * One bounded Anthropic call under the shared application deadline.
 * - `maxRetries: 0` (SDK default retries of timeouts are the build-231 killer)
 * - AbortSignal hard-cancels the underlying HTTP request when the slice expires
 * - Timeouts/aborts are NEVER retried; only fast 5xx/ECONNRESET may retry once
 *   when enough remaining budget remains for another full slice
 */
async function callWithRetry(
  params: Parameters<Anthropic['messages']['create']>[0],
  deadlineAt?: number | null,
  onAttempt?: () => void,
  configuredTimeoutMs: number = AI_PROVIDER_CALL_TIMEOUT_MS,
  timeoutStage: 'provider' | 'translation' | 'verifier' = 'provider',
  cancellationSignal?: AbortSignal | null,
  allowRetry = true,
): Promise<Anthropic.Messages.Message> {
  const client = getClient();
  const runOnce = () => {
    onAttempt?.();
    return callProviderWithDeadline(
      (options) => client.messages.create(params, {
        signal: options.signal ?? undefined,
        timeout: options.timeout,
        maxRetries: 0,
      }) as Promise<Anthropic.Messages.Message>,
      deadlineAt,
      configuredTimeoutMs,
      timeoutStage,
      cancellationSignal,
    );
  };

  try {
    return await runOnce();
  } catch (err) {
    if (isProviderAbortOrTimeoutError(err)) throw err;
    const canRetry =
      allowRetry
      && isRetryableProviderError(err)
      && hasProviderBudget(deadlineAt)
      && (deadlineAt == null || remainingBudgetMs(deadlineAt) >= AI_PROVIDER_CALL_TIMEOUT_MS);
    if (canRetry) return await runOnce();
    throw err;
  }
}

function getText(response: Anthropic.Messages.Message): string {
  const block = response.content[0];
  if (block?.type !== 'text') return '';
  // Strip leading/trailing quotation marks (straight and curly)
  return block.text.trim().replace(/^[""\u201C\u201E]+|[""\u201D\u201F]+$/g, '').trim();
}

const EXPERIENCE_COMPACT_TRANSLATOR_MAX_RECORDS = EXPERIENCE_LOCALIZATION_PROVIDER_BATCH_SIZE;
const EXPERIENCE_COMPACT_LOCALIZED_SURFACE_MAX_CHARS = EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS;
const EXPERIENCE_ROUTE_FINALIZATION_MARGIN_MS = 2_000;

type CompactTranslatorRecord = {
  recordId: string;
  sourceText: string;
  sourceLocale: string;
  targetLocale: string;
};

type CompactTranslatorResponseRecord = {
  recordId: string;
  localizedSurface: string;
};

function parseCompactTranslatorResponse(raw: string): CompactTranslatorResponseRecord[] | null {
  const text = String(raw || '').trim();
  if (!text.startsWith('{') || !text.endsWith('}')) return null;
  try {
    const value = JSON.parse(text) as { records?: unknown };
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (Object.keys(value).length !== 1 || !Object.prototype.hasOwnProperty.call(value, 'records')) return null;
    if (!Array.isArray(value.records)) return null;
    const records: CompactTranslatorResponseRecord[] = [];
    let totalCanonicalChars = 0;
    let totalUtf8Bytes = 0;
    for (const record of value.records) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
      if (Object.keys(record).length !== 2) return null;
      const candidate = record as Record<string, unknown>;
      if (
        typeof candidate.recordId !== 'string'
        || typeof candidate.localizedSurface !== 'string'
        || !candidate.recordId
        || !candidate.localizedSurface.trim()
        || candidate.localizedSurface.length > EXPERIENCE_COMPACT_LOCALIZED_SURFACE_MAX_CHARS
      ) return null;
      const localizedSurface = candidate.localizedSurface.trim();
      const metrics = measureExperienceLocalizationText(localizedSurface);
      totalCanonicalChars += metrics.canonicalChars;
      totalUtf8Bytes += metrics.utf8Bytes;
      if (totalCanonicalChars > EXPERIENCE_LOCALIZATION_MAX_BATCH_SOURCE_CHARS
        || totalUtf8Bytes > EXPERIENCE_LOCALIZATION_MAX_BATCH_SOURCE_UTF8_BYTES) return null;
      records.push({
        recordId: candidate.recordId,
        localizedSurface,
      });
    }
    return records;
  } catch {
    return null;
  }
}

type CompactVerifierRecord = {
  recordId: string;
  sourceText: string;
  candidateLocalizedText: string;
  sourceLocale: string;
  targetLocale: string;
};

type CompactVerifierDecision = {
  recordId: string;
  decision: 'passed' | 'rejected';
  mismatchCategory: 'none' | 'predicate_mismatch' | 'object_mismatch'
    | 'work_domain_mismatch' | 'source_responsibility_removed' | 'scope_mismatch'
    | 'negation_mismatch' | 'tense_mismatch' | 'unsupported_responsibility_added'
    | 'cross_entry_fact' | 'cross_occupation_substitution' | 'ambiguous';
  predicatePreserved: boolean;
  objectPreserved: boolean;
  workDomainPreserved: boolean;
  sourceResponsibilityPreserved: boolean;
  scopePreserved: boolean;
  negationPreserved: boolean;
  tensePreserved: boolean;
  unsupportedFactsIntroduced: boolean;
  crossEntryFactIntroduced: boolean;
  crossOccupationSubstitution: boolean;
};

const COMPACT_VERIFIER_KEYS = [
  'recordId', 'decision', 'mismatchCategory', 'predicatePreserved', 'objectPreserved',
  'workDomainPreserved', 'sourceResponsibilityPreserved', 'scopePreserved',
  'negationPreserved', 'tensePreserved', 'unsupportedFactsIntroduced',
  'crossEntryFactIntroduced', 'crossOccupationSubstitution',
].sort();
const COMPACT_VERIFIER_MISMATCHES = new Set([
  'none', 'predicate_mismatch', 'object_mismatch', 'work_domain_mismatch',
  'source_responsibility_removed', 'scope_mismatch', 'negation_mismatch',
  'tense_mismatch', 'unsupported_responsibility_added', 'cross_entry_fact',
  'cross_occupation_substitution', 'ambiguous',
]);

function parseCompactVerifierResponse(raw: string): CompactVerifierDecision[] | null {
  const text = String(raw || '').trim();
  if (!text.startsWith('{') || !text.endsWith('}')) return null;
  try {
    const value = JSON.parse(text) as { records?: unknown };
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (Object.keys(value).length !== 1 || !Array.isArray(value.records)) return null;
    const records = value.records as Array<Record<string, unknown>>;
    const booleanKeys = COMPACT_VERIFIER_KEYS.filter((key) => (
      !['recordId', 'decision', 'mismatchCategory'].includes(key)
    ));
    if (!records.every((record) => (
      record && typeof record === 'object' && !Array.isArray(record)
      && JSON.stringify(Object.keys(record).sort()) === JSON.stringify(COMPACT_VERIFIER_KEYS)
      && typeof record.recordId === 'string' && Boolean(record.recordId)
      && (record.decision === 'passed' || record.decision === 'rejected')
      && typeof record.mismatchCategory === 'string'
      && COMPACT_VERIFIER_MISMATCHES.has(record.mismatchCategory)
      && booleanKeys.every((key) => typeof record[key] === 'boolean')
    ))) return null;
    return records as CompactVerifierDecision[];
  } catch {
    return null;
  }
}

function deadlineOwnerOf(error: unknown): string | null {
  return error && typeof error === 'object' && 'deadlineOwner' in error
    ? String((error as { deadlineOwner?: unknown }).deadlineOwner || '') || null
    : null;
}

/**
 * Gender instruction for languages that require grammatical gender agreement.
 * Selected app gender is the only source of truth (never inferred from names).
 */
function getGenderInstruction(locale: string, gender: string): string {
  return getCoverLetterGenderInstruction(locale, gender);
}

/**
 * Handle CORS preflight for Capacitor native app cross-origin requests.
 * Validates the Origin against the allowlist before responding.
 */
export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handleOptions(req);
}

export async function POST(req: NextRequest) {
  // Application deadline starts at the earliest route entry — before CORS
  // resolution, body parsing, auth, or any provider work — so cold-start and
  // validation cannot silently eat the budget that must stay under Vercel.
  const serverReceivedAt = Date.now();
  let deadlineAt = computeServerDeadline(serverReceivedAt);

  // Resolve CORS origin from the request once, used in all jsonResponse calls
  const _corsOrigin = resolveCorsOrigin(req.headers.get('origin'));
  const _corsHeaders = buildCorsHeaders(_corsOrigin);
  function jsonResponse(data: unknown, init?: ResponseInit): NextResponse {
    return NextResponse.json(data, {
      ...init,
      headers: {
        ..._corsHeaders,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
  }

  // ── Content-Type validation ───────────────────────────────────────────────
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return jsonResponse(
      { error: 'Content-Type must be application/json.', code: 'generation_validation_failed' },
      { status: 415 },
    );
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';

  try {
    const body = await req.json();
    const { action, proToken, freeUserId, requestId, ...params } = body;
    if (
      action === 'experience-localize'
      || action === 'export-title-localize'
      || action === 'summary-context-localize'
    ) {
      deadlineAt = computeExperienceLocalizationDeadline(serverReceivedAt);
    }

    // ── Pro token verification (before limiter identity) ────────────────────
    const verifiedPro = await verifyProToken(proToken);
    const isPro = verifiedPro !== null;

    // Verified Pro → token-hash key (not free anonymous / install counter).
    // Anonymous → IP key. Never log the raw token.
    const limiterKeyType = isPro ? 'pro_token_hash' : 'ip';
    const limiterKey = isPro
      ? `pro:${hashLimiterIdentity(String(proToken))}`
      : `ip:${ip}`;
    const maxRequests = isPro ? RATE_LIMIT_MAX_REQUESTS_PRO : RATE_LIMIT_MAX_REQUESTS_IP;
    const { allowed, retryAfter, count: limiterCount } = rateLimit(limiterKey, maxRequests);
    if (!allowed) {
      console.info('[ai-diagnostics]', JSON.stringify({
        requestId: typeof requestId === 'string' ? requestId : null,
        timestamp: Date.now(),
        operation: action ?? null,
        httpStatus: 429,
        applicationErrorCode: 'server_rate_limited',
        isProVerified: isPro,
        limiterKeyType,
        countBefore: limiterCount,
        countAfter: limiterCount,
        retryAfterSec: retryAfter,
      }));
      return jsonResponse(
        {
          error: `Too many requests. Please try again in ${retryAfter} seconds.`,
          code: 'server_rate_limited',
          retryAfter,
        },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      );
    }

    // ── Free tier handling ────────────────────────────────────────────
    // Free users are allowed limited AI actions tracked server-side.
    // Actions not in FREE_ACTION_LIMITS (e.g. 'rewrite') are Pro-only.
    // Abuse protection: rate limiting (above) still applies.
    // Map legacy action names to canonical action keys
    const resolvedAction = action === 'cover-letter' ? 'cover-letter-gen' : action;

    let _freeUserId: string | null = null;
    if (!isPro && PRO_SIGNING_KEY) {
      _freeUserId = freeUserId || ip || 'anon';
      // Check how many free uses this user has left for this action (NO increment)
      const { allowed: freeAllowed } = canUseFreeAction(_freeUserId!, resolvedAction);
      if (!freeAllowed) {
        const code: AiErrorCode = FREE_ALLOWED_ACTIONS.has(resolvedAction)
          ? 'free_ai_limit_reached'
          : 'invalid_pro_token';
        return jsonResponse(
          {
            error: 'Pro access required for AI features.',
            code,
          },
          { status: 403 },
        );
      }
    }

    // Validate API key is available for actions that require AI
    // (AI Improvements has a fallback to offline templates, so it doesn't require this)
    const hasApiKey = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
    if (action !== 'bullets' && !hasApiKey) {
      return jsonResponse(
        { error: 'AI service is not configured. Please try again later.' },
        { status: 500 }
      );
    }

    if (action === 'cover-letter' || action === 'cover-letter-gen' || action === 'cover-letter-regen') {
      const { tone, locale, variant, gender } = params;
      const jobTitle = sanitizeField(params.jobTitle, 500);
      const companyName = sanitizeField(params.companyName, 500);
      const personalName = sanitizeField(params.personalName, 200);
      const jobDescription = sanitizeField(params.jobDescription, 4000);
      const summary = sanitizeField(params.summary, 2000);
      const resolvedLocale = normalizeLocale(locale);
      const localeInfo = localeInstructions[resolvedLocale];

      // Use provided name strictly — never fall back to placeholder strings when name exists
      const candidateName = (typeof personalName === 'string' ? personalName.trim() : '') || '';
      const displayName = candidateName || localeInfo.fallbackCandidate;
      const normalizedGender = normalizeCoverLetterGender(gender || '');

      const resolvedTone = (['formal', 'confident', 'friendly'].includes(String(tone))
        ? tone
        : 'formal') as 'formal' | 'confident' | 'friendly';
      let toneDesc = localeInfo.toneMap[resolvedTone] || localeInfo.toneMap.formal;
      // Gender-aware Spanish/Italian tone adjectives for confident letters.
      if (resolvedLocale === 'es' && resolvedTone === 'confident' && normalizedGender === 'female') {
        toneDesc = 'segura, convincente y decidida';
      } else if (resolvedLocale === 'es' && resolvedTone === 'confident' && normalizedGender === 'male') {
        toneDesc = 'seguro, convincente y decidido';
      } else if (resolvedLocale === 'it' && resolvedTone === 'confident' && normalizedGender === 'female') {
        toneDesc = 'sicura e decisa';
      } else if (resolvedLocale === 'it' && resolvedTone === 'confident' && normalizedGender === 'male') {
        toneDesc = 'sicuro e deciso';
      }
      const variantNote = variant && variant > 0
        ? ' Use a different opening and structure than the standard version — still without inventing facts.'
        : '';
      const genderNote = getGenderInstruction(resolvedLocale, gender || '');

      const experienceEntries = Array.isArray(params.experienceEntries) ? params.experienceEntries : [];
      const skillsList: string[] = Array.isArray(params.skills) ? params.skills : [];
      const languagesList = Array.isArray(params.languages) ? params.languages : [];
      const educationList = Array.isArray(params.education) ? params.education : [];
      const certificationsList: string[] = Array.isArray(params.certifications) ? params.certifications : [];

      const factSet = buildCoverLetterFactSet({
        personalName: candidateName,
        jobTitle,
        companyName,
        jobDescription,
        summary,
        experience: experienceEntries,
        education: educationList,
        skills: skillsList,
        certifications: certificationsList,
        languages: languagesList,
      });

      let generationAttempts = 0;
      const {
        letter: structuredLetter,
        groundingStatus,
        repairAttempted,
        fallbackUsed,
        usedFactIds,
        groundingViolationCount,
      } = await generateStructuredCoverLetterWithRetries({
        locale: resolvedLocale,
        closing: localeInfo.closing,
        candidateName,
        displayName,
        companyName,
        jobTitle,
        languageName: localeInfo.languageName,
        toneDesc,
        variantNote,
        genderNote,
        gender: normalizedGender,
        tone: resolvedTone,
        fallbackRole: localeInfo.fallbackRole,
        fallbackCompany: localeInfo.fallbackCompany,
        factSet,
        generate: async (attempt, maxTokens, userPrompt) => {
          generationAttempts = attempt + 1;
          if (process.env.NODE_ENV !== 'production') {
            console.log('[Cover Letter Structured]', {
              locale: resolvedLocale,
              coverLetter: true,
              maxTokens,
              attempt,
              factCount: factSet.facts.length,
              isSparse: factSet.isSparse,
            });
          }
          const response = await callWithRetry({
            model: MODEL,
            max_tokens: maxTokens,
            temperature: attempt === 0 ? 0.4 : 0.2,
            stream: false,
            system: `You are an expert cover letter writer for ${localeInfo.languageName}.
Return ONLY valid JSON matching the requested schema.
Rules:
- Every field must be complete and in ${localeInfo.languageName}.
- Never stop mid-sentence.
- Never invent experience, skills, tools, leadership, metrics, or achievements that are absent from SOURCE FACTS.
- Never mix languages except company names, job titles, or candidate names when appropriate.
- Never use placeholder names.
- Prefer a shorter honest letter over a detailed invented one.
- LANGUAGE QUALITY: ${localeInfo.nativeQualityNote}`,
            messages: [{ role: 'user', content: userPrompt }],
          });
          return getText(response);
        },
      });

      // NOTE: the `structured-v4` schema/version marker is intentionally NOT stamped
      // into the letter body anymore. The engine fingerprint is carried by
      // `coverLetterGenerationEngine` (and groundingStatus for diagnostics).
      const letterBody = assembleCoverLetterContent(structuredLetter, resolvedLocale);

      // Body-only response: preview/PDF/DOCX render the document date (and any
      // contact block) themselves. Do not bake name/email/phone/date into result.
      const fullLetter = sanitizeCoverLetterContent(letterBody);

      if (process.env.NODE_ENV !== 'production') {
        console.log('[Cover Letter Generation]', {
          type: 'coverLetter',
          locale: resolvedLocale,
          generationEngine: 'structured-v4',
          groundingStatus,
          valid: true,
          retryCount: generationAttempts,
        });
      }

      if (_freeUserId) recordFreeAction(_freeUserId, action === 'cover-letter' ? 'cover-letter-gen' : action);
      return jsonResponse({
        result: fullLetter,
        coverLetterGenerationEngine: 'structured-v4',
        coverLetterBackendRevision: COVER_LETTER_GROUNDING_BACKEND_REVISION,
        groundingStatus,
        repairAttempted,
        fallbackUsed,
        usedFactIds,
        groundingViolations: groundingViolationCount,
        contentLocale: resolvedLocale,
        requestFactCount: factSet.facts.length,
        isSparse: factSet.isSparse,
      });
    }

    if (action === 'experience-localize') {
      const requestedTargetLocale = typeof (params.targetLocale || params.locale) === 'string'
        ? String(params.targetLocale || params.locale)
        : '';
      const supportedTargetLocale = resolveLocaleCandidate(requestedTargetLocale);
      if (!supportedTargetLocale || supportedTargetLocale !== requestedTargetLocale) {
        return jsonResponse({
          error: 'Experience localization target locale is unsupported.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: 'experience_localization_unsupported_target_locale',
        }, { status: 422 });
      }
      const resolvedLocale = supportedTargetLocale;
      const targetInfo = localeInstructions[resolvedLocale];
      const snapshotId = sanitizeField(params.snapshotId, 240);
      const records = Array.isArray(params.records) ? params.records : [];
      if (records.length > EXPERIENCE_COMPACT_TRANSLATOR_MAX_RECORDS) {
        return jsonResponse({
          error: 'Experience localization batch exceeds the bounded provider manifest.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: 'experience_localization_batch_too_large',
        }, { status: 422 });
      }
      if (!snapshotId || !records.length) {
        return jsonResponse({
          error: 'Experience localization requires one bounded structured manifest.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: 'experience_localization_request_invalid',
        }, { status: 422 });
      }
      const rawSourceMetrics = records.map((record: Record<string, unknown>) =>
        measureExperienceLocalizationText(typeof record.sourceText === 'string' ? record.sourceText : ''));
      if (rawSourceMetrics.some((metrics: { canonicalChars: number }) => (
        metrics.canonicalChars > EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS
      ))) {
        return jsonResponse({
          error: 'Experience localization source text exceeds the canonical limit.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: 'experience_localization_source_text_too_long',
        }, { status: 422 });
      }
      const safeRecords: ExperienceLocalizationRequestRecord[] = records.map((record: Record<string, unknown>) => ({
        requestIdentity: sanitizeField(record.requestIdentity, 300),
        cvId: sanitizeField(record.cvId, 200),
        experienceId: sanitizeField(record.experienceId, 200),
        experienceLineageHash: sanitizeField(record.experienceLineageHash, 240),
        sourceClauseIndex: Number(record.sourceClauseIndex),
        sourceClauseHash: sanitizeField(record.sourceClauseHash, 240),
        semanticFactId: sanitizeField(record.semanticFactId, 300),
        sourceLocale: sanitizeField(record.sourceLocale, 20) as Locale,
        targetLocale: sanitizeField(record.targetLocale, 20) as Locale,
        canonicalLineageHash: sanitizeField(record.canonicalLineageHash, 240),
        sourceText: canonicalizeExperienceLocalizationText(sanitizeText(
          record.sourceText,
          typeof record.sourceText === 'string' ? Math.max(1, record.sourceText.length) : 1,
        )),
      }));
      if (safeRecords.some((record) => (
        !record.requestIdentity
        || !record.cvId
        || !record.experienceId
        || !record.experienceLineageHash
        || !Number.isInteger(record.sourceClauseIndex)
        || record.sourceClauseIndex < 0
        || !record.sourceClauseHash
        || !record.semanticFactId
        || resolveLocaleCandidate(record.sourceLocale) !== record.sourceLocale
        || record.targetLocale !== resolvedLocale
        || !record.canonicalLineageHash
        || !record.sourceText
        || hashExperienceLocalizedSurfaceValue(record.sourceText) !== record.sourceClauseHash
      ))) {
        return jsonResponse({
          error: 'Experience localization manifest identity is incomplete.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: 'experience_localization_request_identity_invalid',
        }, { status: 422 });
      }
      const expectedById = new Map(safeRecords.map((record) => [record.requestIdentity, record]));
      if (expectedById.size !== safeRecords.length) {
        return jsonResponse({
          error: 'Experience localization manifest contains duplicate identities.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: 'experience_localization_duplicate_request_identity',
        }, { status: 422 });
      }
      const physicalBatchValidation = validateExperienceLocalizationPhysicalBatch(safeRecords);
      if (!physicalBatchValidation.ok) {
        return jsonResponse({
          error: 'Experience localization batch exceeds the bounded translator contract.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: physicalBatchValidation.reason,
          translationProviderAttemptCount: 0,
          independentVerifierAttemptCount: 0,
          translatedRecordCount: 0,
        }, { status: 422 });
      }
      const requestNonce = randomUUID().replace(/-/g, '').slice(0, 12);
      const compactRecords: CompactTranslatorRecord[] = safeRecords.map((record, index) => ({
        recordId: `tr_${requestNonce}_${index.toString(36)}`,
        sourceText: record.sourceText,
        sourceLocale: record.sourceLocale,
        targetLocale: record.targetLocale,
      }));
      const immutableByCompactId = new Map(
        compactRecords.map((record, index) => [record.recordId, safeRecords[index]] as const),
      );
      if (immutableByCompactId.size !== compactRecords.length) {
        return jsonResponse({
          error: 'Experience localization compact identities collided.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: 'experience_localization_compact_identity_collision',
          translationProviderAttemptCount: 0,
          independentVerifierAttemptCount: 0,
          translatedRecordCount: 0,
        }, { status: 422 });
      }
      const totalSourceCanonicalChars = safeRecords.reduce(
        (sum, record) => sum + measureExperienceLocalizationText(record.sourceText).canonicalChars, 0,
      );
      const translatorMaxTokens = Math.min(6200, Math.max(1200, 1200 + totalSourceCanonicalChars));
      // Compact verifier output contains only an opaque ID and fixed semantic
      // decisions. 125 tokens/record plus 900 tokens of schema/safety margin
      // covers the serialized maximum (1,650 tokens for six records).
      const verifierMaxTokens = Math.min(1650, Math.max(1200, 900 + safeRecords.length * 125));
      const compactTranslatorSystem = `You are a strict CV Experience translator. Translate only into ${targetInfo.languageName} (${resolvedLocale}). Return exactly one JSON object with no markdown, code fences, prose, or extra fields. Return exactly one localized surface for every supplied recordId and no additional records. Preserve each recordId exactly. Translate only sourceText. Preserve the same professional predicate, work object, and professional domain. Add no facts, tools, systems, qualifications, metrics, achievements, leadership, compliance, quality, frequency, responsibility, impact, or enrichment.`;
      const compactTranslatorUser = JSON.stringify({
        task: 'localize_cv_experience_surfaces',
        records: compactRecords,
        responseSchema: {
          records: [{
            recordId: 'exact input recordId',
            localizedSurface: 'one target-language duty clause',
          }],
        },
      });
      const compactTranslatorRequestBytes = Buffer.byteLength(JSON.stringify({
        model: MODEL,
        max_tokens: translatorMaxTokens,
        temperature: 0,
        stream: false,
        system: compactTranslatorSystem,
        messages: [{ role: 'user', content: compactTranslatorUser }],
      }), 'utf8');
      let providerAttemptCount = 0;
      const translationStartedAt = Date.now();
      let response;
      try {
        response = await callWithRetry({
        model: MODEL,
        max_tokens: translatorMaxTokens,
        temperature: 0,
        stream: false,
        system: compactTranslatorSystem,
        messages: [{
          role: 'user',
          content: compactTranslatorUser,
        }],
        }, deadlineAt, () => {
          providerAttemptCount += 1;
        }, EXPERIENCE_LOCALIZATION_TRANSLATION_TIMEOUT_MS, 'translation', req.signal, false);
      } catch (err) {
        const owner = deadlineOwnerOf(err);
        const typedReason = owner === 'client_abort'
          ? 'client_abort'
          : owner === 'route_deadline'
            ? (/insufficient/i.test(err instanceof Error ? err.message : '')
              ? 'route_deadline_insufficient'
              : 'route_deadline_exceeded')
            : isProviderAbortOrTimeoutError(err)
              ? 'translation_transport_timeout'
              : 'provider_http_failure';
        return jsonResponse({
          error: typedReason === 'translation_transport_timeout'
            ? 'Experience localization translation timed out.'
            : 'Experience localization translation provider failed.',
          code: typedReason === 'provider_http_failure' ? 'generation_validation_failed' : 'request_timeout',
          localizationTypedFailureReason: typedReason,
          localizationFailureStage: 'translation_transport',
          deadlineOwner: owner,
          configuredTimeoutMs: EXPERIENCE_LOCALIZATION_TRANSLATION_TIMEOUT_MS,
          elapsedMs: Date.now() - translationStartedAt,
          providerResponded: false,
          parserReached: false,
          translationProviderAttemptCount: providerAttemptCount,
          independentVerifierAttemptCount: 0,
          translatedRecordCount: 0,
          retryCount: Math.max(0, providerAttemptCount - 1),
        }, { status: typedReason === 'provider_http_failure' ? 422 : 504 });
      }
      const compactResponseRecords = parseCompactTranslatorResponse(getText(response));
      const compactTranslatorResponseBytes = Buffer.byteLength(getText(response), 'utf8');
      const translationElapsedMs = Date.now() - translationStartedAt;
      if (!compactResponseRecords) {
        return jsonResponse({
          error: 'Experience localization provider returned malformed structured JSON.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: 'experience_localization_provider_malformed_json',
          translationProviderAttemptCount: providerAttemptCount,
          independentVerifierAttemptCount: 0,
          translatedRecordCount: 0,
        }, { status: 422 });
      }
      const returnedIds = compactResponseRecords.map((record) => record.recordId);
      const identityMatch = compactResponseRecords.length === compactRecords.length
        && new Set(returnedIds).size === returnedIds.length
        && returnedIds.every((id) => immutableByCompactId.has(id))
        && compactRecords.every((record) => returnedIds.includes(record.recordId));
      if (!identityMatch) {
        return jsonResponse({
          error: 'Experience localization provider changed the immutable manifest.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: 'experience_localization_provider_identity_mismatch',
          translationProviderAttemptCount: providerAttemptCount,
          independentVerifierAttemptCount: 0,
          translatedRecordCount: compactResponseRecords.length,
        }, { status: 422 });
      }
      const reconstructedCandidates: ExperienceLocalizationProviderRecord[] = compactResponseRecords.map((candidate) => {
        const source = immutableByCompactId.get(candidate.recordId)!;
        return {
          ...source,
          localizedText: candidate.localizedSurface,
          // Wire compatibility only. The independent verifier below is the
          // sole semantic acceptance authority; no provider self-attestation
          // is accepted or transported by the compact translator contract.
          semanticValidation: {
            validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
            predicatePreserved: true,
            objectPreserved: true,
            workDomainPreserved: true,
            scopePreserved: true,
            negationPreserved: true,
            tensePreserved: true,
            unsupportedFactsIntroduced: false,
          },
        };
      });
      const completedTranslationDiagnostics = {
        translationProviderAttemptCount: providerAttemptCount,
        translatedRecordCount: reconstructedCandidates.length,
        translationResponded: true,
        translationParserPassed: true,
        compactTranslatorIdsValidated: true,
        fullIdentitiesReconstructed: true,
        candidateHashesComputed: false,
        translationElapsedMs,
        compactTranslatorRequestBytes,
        compactTranslatorResponseBytes,
      };
      const compactSurfaceInvalid = reconstructedCandidates.some((candidate) => (
        candidate.localizedText === expectedById.get(candidate.requestIdentity)?.sourceText
        || !validateAiUnitLocalePurity(candidate.localizedText, resolvedLocale, {
          kind: 'experience_bullet',
          requireUnits: true,
        }).ok
      ));
      if (compactSurfaceInvalid) {
        return jsonResponse({
          error: 'Experience localization translator returned an invalid target-locale surface.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: 'experience_localization_provider_wrong_locale',
          ...completedTranslationDiagnostics,
          independentVerifierAttemptCount: 0,
        }, { status: 422 });
      }
      const verificationPairs = reconstructedCandidates.map((candidate) => {
        const source = expectedById.get(candidate.requestIdentity)!;
        return {
          requestIdentity: source.requestIdentity,
          cvId: source.cvId,
          experienceId: source.experienceId,
          experienceLineageHash: source.experienceLineageHash,
          sourceClauseIndex: source.sourceClauseIndex,
          sourceClauseHash: source.sourceClauseHash,
          semanticFactId: source.semanticFactId,
          sourceLocale: source.sourceLocale,
          targetLocale: source.targetLocale,
          canonicalLineageHash: source.canonicalLineageHash,
          sourceText: source.sourceText,
          candidateLocalizedText: candidate.localizedText,
          candidateSurfaceHash: hashExperienceLocalizedSurfaceValue(candidate.localizedText),
        };
      });
      const completedVerificationInputDiagnostics = {
        ...completedTranslationDiagnostics,
        candidateHashesComputed: true,
      };
      const verifierNonce = randomUUID().replace(/-/g, '').slice(0, 12);
      const compactVerifierRecords: CompactVerifierRecord[] = verificationPairs.map((pair, index) => ({
        recordId: `vr_${verifierNonce}_${index.toString(36)}`,
        sourceText: pair.sourceText,
        candidateLocalizedText: pair.candidateLocalizedText,
        sourceLocale: pair.sourceLocale,
        targetLocale: pair.targetLocale,
      }));
      const immutableByVerifierId = new Map(compactVerifierRecords.map((record, index) => (
        [record.recordId, verificationPairs[index]] as const
      )));
      const compactVerifierSystem = `You are an independent semantic verifier for CV Experience localization. You did not produce the candidate translations. Compare each sourceText directly with candidateLocalizedText. Return exactly one JSON object with no markdown, prose, code fences, or extra fields, and exactly one decision for every recordId. Preserve recordId exactly. For every pair independently verify the same professional predicate/action, work object, work domain, source responsibility, scope, negation, and employment tense. Reject removed or added responsibilities/facts, cross-entry facts, cross-occupation substitutions, and invented tools, systems, metrics, achievements, leadership, compliance, quality, frequency, or impact. decision may be passed only when every preservation boolean is true, every introduction/substitution boolean is false, and mismatchCategory is none.`;
      const compactVerifierUser = JSON.stringify({
        task: 'independently_verify_cv_experience_localized_surfaces',
        records: compactVerifierRecords,
        responseSchema: {
          records: [{
            recordId: 'exact input recordId',
            decision: 'passed | rejected',
            mismatchCategory: 'none | predicate_mismatch | object_mismatch | work_domain_mismatch | source_responsibility_removed | scope_mismatch | negation_mismatch | tense_mismatch | unsupported_responsibility_added | cross_entry_fact | cross_occupation_substitution | ambiguous',
            predicatePreserved: 'boolean', objectPreserved: 'boolean',
            workDomainPreserved: 'boolean', sourceResponsibilityPreserved: 'boolean',
            scopePreserved: 'boolean', negationPreserved: 'boolean', tensePreserved: 'boolean',
            unsupportedFactsIntroduced: 'boolean', crossEntryFactIntroduced: 'boolean',
            crossOccupationSubstitution: 'boolean',
          }],
        },
      });
      const compactVerifierRequestBytes = Buffer.byteLength(JSON.stringify({
        model: MODEL, max_tokens: verifierMaxTokens, temperature: 0, stream: false,
        system: compactVerifierSystem,
        messages: [{ role: 'user', content: compactVerifierUser }],
      }), 'utf8');
      const routeRemainingAtVerifierDispatchMs = remainingBudgetMs(deadlineAt);
      const verifierAllowanceMs = Math.min(
        EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS,
        routeRemainingAtVerifierDispatchMs - EXPERIENCE_ROUTE_FINALIZATION_MARGIN_MS,
      );
      if (verifierAllowanceMs < 1_000 || req.signal.aborted) {
        return jsonResponse({
          error: req.signal.aborted
            ? 'Experience localization was cancelled.'
            : 'Insufficient route budget to dispatch independent verification.',
          code: 'request_timeout',
          localizationTypedFailureReason: req.signal.aborted
            ? 'client_abort'
            : 'route_deadline_insufficient',
          localizationFailureStage: 'verifier_pre_dispatch',
          deadlineOwner: req.signal.aborted ? 'client_abort' : 'route_deadline',
          translationProviderAttemptCount: providerAttemptCount,
          independentVerifierAttemptCount: 0,
          translatedRecordCount: reconstructedCandidates.length,
          translationResponded: true,
          translationParserPassed: true,
          compactTranslatorIdsValidated: true,
          fullIdentitiesReconstructed: true,
          candidateHashesComputed: true,
          verifierDispatched: false,
          routeRemainingAtVerifierDispatchMs,
          translationElapsedMs,
        }, { status: 504 });
      }
      let verifierAttemptCount = 0;
      const verifierStartedAt = Date.now();
      let verificationResponse;
      try {
        verificationResponse = await callWithRetry({
          model: MODEL,
          max_tokens: verifierMaxTokens,
          temperature: 0,
          stream: false,
          system: compactVerifierSystem,
          messages: [{
            role: 'user',
            content: compactVerifierUser,
          }],
        }, deadlineAt, () => {
          verifierAttemptCount += 1;
        }, EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS, 'verifier', req.signal, false);
      } catch (err) {
        const owner = deadlineOwnerOf(err);
        const typedReason = owner === 'client_abort'
          ? 'client_abort'
          : owner === 'route_deadline'
            ? 'route_deadline_exceeded'
            : isProviderAbortOrTimeoutError(err)
              ? 'verifier_transport_timeout'
              : 'provider_http_failure';
        return jsonResponse({
          error: typedReason === 'verifier_transport_timeout'
            ? 'Independent Experience localization verification timed out.'
            : 'Independent Experience localization verification failed.',
          code: typedReason === 'provider_http_failure' ? 'generation_validation_failed' : 'request_timeout',
          localizationTypedFailureReason: typedReason,
          localizationFailureStage: 'verifier_transport',
          deadlineOwner: owner,
          configuredTimeoutMs: EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS,
          elapsedMs: Date.now() - verifierStartedAt,
          translationElapsedMs,
          providerResponded: false,
          parserReached: false,
          translationProviderAttemptCount: providerAttemptCount,
          independentVerifierAttemptCount: verifierAttemptCount,
          translatedRecordCount: reconstructedCandidates.length,
          translationResponded: true,
          translationParserPassed: true,
          compactTranslatorIdsValidated: true,
          fullIdentitiesReconstructed: true,
          candidateHashesComputed: true,
          verifierDispatched: true,
          verifierResponded: false,
          verifierParserReached: false,
          verifiedRecordCount: 0,
          routeRemainingAtVerifierDispatchMs,
          compactTranslatorRequestBytes,
          compactTranslatorResponseBytes,
          compactVerifierRequestBytes,
          retryCount: Math.max(0, verifierAttemptCount - 1),
        }, { status: typedReason === 'provider_http_failure' ? 422 : 504 });
      }
      const compactVerifierResponseBytes = Buffer.byteLength(getText(verificationResponse), 'utf8');
      const compactVerifierDecisions = parseCompactVerifierResponse(getText(verificationResponse));
      if (!compactVerifierDecisions) {
        return jsonResponse({
          error: 'Independent Experience localization verifier returned malformed structured JSON.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: 'experience_localization_verifier_malformed_json',
          ...completedVerificationInputDiagnostics,
          independentVerifierAttemptCount: verifierAttemptCount,
          verifierDispatched: true,
          verifierResponded: true,
          verifierParserReached: true,
          verifiedRecordCount: 0,
        }, { status: 422 });
      }
      const verifierIds = compactVerifierDecisions.map((decision) => decision.recordId);
      const verifierIdentityMatch = compactVerifierDecisions.length === compactVerifierRecords.length
        && new Set(verifierIds).size === verifierIds.length
        && verifierIds.every((id) => immutableByVerifierId.has(id))
        && compactVerifierRecords.every((record) => verifierIds.includes(record.recordId));
      if (!verifierIdentityMatch) {
        return jsonResponse({
          error: 'Independent verifier changed the compact manifest.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: 'experience_localization_verifier_identity_mismatch',
          ...completedVerificationInputDiagnostics,
          independentVerifierAttemptCount: verifierAttemptCount,
          verifierDispatched: true,
          verifierResponded: true,
          verifierParserReached: true,
          verifiedRecordCount: compactVerifierDecisions.length,
        }, { status: 422 });
      }
      const independentVerification: ExperienceLocalizationIndependentVerificationResponse = {
        snapshotId,
        targetLocale: resolvedLocale,
        validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
        records: compactVerifierDecisions.map((decision) => {
          const pair = immutableByVerifierId.get(decision.recordId)!;
          const { sourceText: _sourceText, candidateLocalizedText: _candidateText, ...identity } = pair;
          const { recordId: _recordId, ...semanticDecision } = decision;
          return { ...identity, ...semanticDecision };
        }),
      };
      const localizationRequest: ExperienceLocalizationRequest = {
        task: 'localize_cv_experience_surfaces',
        snapshotId,
        targetLocale: resolvedLocale,
        records: safeRecords as ExperienceLocalizationRequestRecord[],
      };
      const independentlyValidated = validateExperienceLocalizationIndependentVerification({
        request: localizationRequest,
        candidates: reconstructedCandidates,
        verification: independentVerification,
      });
      if (!independentlyValidated.ok) {
        return jsonResponse({
          error: 'Independent Experience localization verification rejected the batch.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: independentlyValidated.reason,
          ...completedVerificationInputDiagnostics,
          independentVerifierAttemptCount: verifierAttemptCount,
          verifierDispatched: true,
          verifierResponded: true,
          verifierParserReached: true,
          verifiedRecordCount: independentVerification.records.length,
        }, { status: 422 });
      }
      return jsonResponse({
        localizedExperienceSurfaces: {
          snapshotId,
          targetLocale: resolvedLocale,
          records: reconstructedCandidates,
          provenance: 'provider',
          providerAttemptCount,
          independentVerification: {
            ...independentVerification,
            verifierAttemptCount,
          },
        },
        localizationSource: 'provider',
        localizationTiming: {
          translationElapsedMs,
          verifierElapsedMs: Date.now() - verifierStartedAt,
          translationTimeoutMs: EXPERIENCE_LOCALIZATION_TRANSLATION_TIMEOUT_MS,
          verifierTimeoutMs: EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS,
          compactTranslatorRequestBytes,
          compactTranslatorResponseBytes,
          compactTranslatorMaxTokens: translatorMaxTokens,
          compactVerifierRequestBytes,
          compactVerifierResponseBytes,
          compactVerifierMaxTokens: verifierMaxTokens,
          routeRemainingAtVerifierDispatchMs,
          translationResponded: true,
          translationParserPassed: true,
          compactTranslatorIdsValidated: true,
          fullIdentitiesReconstructed: true,
          candidateHashesComputed: true,
          verifierDispatched: true,
          verifierResponded: true,
          verifierParserReached: true,
          verifiedRecordCount: independentVerification.records.length,
        },
      });
    }

    if (action === 'export-title-localize') {
      const resolvedLocale = normalizeLocale(params.targetLocale || params.locale);
      const targetInfo = localeInstructions[resolvedLocale];
      const rawEntries = Array.isArray(params.entries) ? params.entries : [];
      if (!rawEntries.length || rawEntries.length > 8) {
        return jsonResponse({
          error: 'Export title localization requires between one and eight entries.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: 'export_title_localization_invalid_batch',
        }, { status: 422 });
      }

      type SafeTitleEntry = {
        entryId: string;
        sourceLocale: string;
        roleTitle: string;
        employer: string;
        employmentState: 'present' | 'completed';
      };
      type TitleTranslatorPayload = {
        targetLocale: string;
        entries: Array<{ entryId: string; localizedRoleTitle: string }>;
      };
      type TitleVerifierPayload = {
        targetLocale: string;
        entries: Array<{
          entryId: string;
          decision: 'passed' | 'rejected';
          semanticEquivalent: boolean;
          targetLocalePassed: boolean;
          unsupportedScopeIntroduced: boolean;
        }>;
      };
      type TitleRepairContext = {
        failedStage: string;
        previousCandidates: Array<{
          entryId: string;
          localizedRoleTitle: string;
        }>;
        verifierDecisions: Array<{
          entryId: string;
          decision: string;
          semanticEquivalent: boolean;
          targetLocalePassed: boolean;
          unsupportedScopeIntroduced: boolean;
        }>;
      };
      type TitleTransportStage = 'translation' | 'verifier';

      const safeEntries: SafeTitleEntry[] = rawEntries.map((entry: Record<string, unknown>) => ({
        entryId: sanitizeField(entry.entryId, 200),
        sourceLocale: sanitizeField(entry.sourceLocale, 20),
        roleTitle: sanitizeField(entry.roleTitle, 500),
        employer: sanitizeField(entry.employer, 500),
        employmentState: entry.employmentState === 'present' ? 'present' : 'completed',
      }));
      const expectedIds = safeEntries.map((entry) => entry.entryId);
      const validInput = safeEntries.every((entry) => (
        entry.entryId.length > 0
        && entry.roleTitle.length > 0
        && entry.sourceLocale.length > 0
      ))
        && new Set(expectedIds).size === expectedIds.length;
      if (!validInput) {
        return jsonResponse({
          error: 'Export title localization received invalid entry identities.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: 'export_title_localization_identity_invalid',
        }, { status: 422 });
      }

      const parseStrictObject = <T,>(raw: string): T | null => {
        const cleaned = String(raw || '')
          .trim()
          .replace(/^```(?:json)?\s*/iu, '')
          .replace(/\s*```$/u, '');
        if (!cleaned.startsWith('{') || !cleaned.endsWith('}')) return null;
        try {
          return JSON.parse(cleaned) as T;
        } catch {
          return null;
        }
      };

      const asRecord = (value: unknown): Record<string, unknown> => (
        value && typeof value === 'object' && !Array.isArray(value)
          ? value as Record<string, unknown>
          : {}
      );

      const repair = params.repair === true;
      const rawRepairContext = (
        repair
        && params.repairContext
        && typeof params.repairContext === 'object'
        && !Array.isArray(params.repairContext)
      )
        ? params.repairContext as Record<string, unknown>
        : null;
      const repairContext: TitleRepairContext | null = rawRepairContext
        ? {
          failedStage: sanitizeField(rawRepairContext.failedStage, 80),
          previousCandidates: (Array.isArray(rawRepairContext.previousCandidates)
            ? rawRepairContext.previousCandidates
            : [])
            .slice(0, 8)
            .map((value: unknown) => {
              const entry = asRecord(value);
              return {
                entryId: sanitizeField(entry.entryId, 200),
                localizedRoleTitle: sanitizeField(entry.localizedRoleTitle, 500),
              };
            })
            .filter((entry) => (
              expectedIds.includes(entry.entryId)
              && entry.localizedRoleTitle.length > 0
            )),
          verifierDecisions: (Array.isArray(rawRepairContext.verifierDecisions)
            ? rawRepairContext.verifierDecisions
            : [])
            .slice(0, 8)
            .map((value: unknown) => {
              const entry = asRecord(value);
              return {
                entryId: sanitizeField(entry.entryId, 200),
                decision: sanitizeField(entry.decision, 40),
                semanticEquivalent: entry.semanticEquivalent === true,
                targetLocalePassed: entry.targetLocalePassed === true,
                unsupportedScopeIntroduced: entry.unsupportedScopeIntroduced === true,
              };
            })
            .filter((entry) => expectedIds.includes(entry.entryId)),
        }
        : null;

      const classifyTitleTransportFailure = (
        error: unknown,
        stage: TitleTransportStage,
      ): {
        reason: string;
        code: AiErrorCode;
        status: number;
        retryAfter: number | null;
        providerStatus: number | string | null;
        deadlineOwner: string | null;
      } => {
        const owner = deadlineOwnerOf(error);
        if (owner === 'client_abort') {
          return {
            reason: 'export_title_localization_client_abort',
            code: 'request_timeout',
            status: 504,
            retryAfter: null,
            providerStatus: null,
            deadlineOwner: owner,
          };
        }
        if (owner === 'route_deadline') {
          return {
            reason: 'export_title_localization_route_deadline_exceeded',
            code: 'request_timeout',
            status: 504,
            retryAfter: null,
            providerStatus: null,
            deadlineOwner: owner,
          };
        }
        if (
          owner === 'translation_transport'
          || owner === 'verifier_transport'
          || isProviderAbortOrTimeoutError(error)
        ) {
          return {
            reason: stage === 'translation'
              ? 'export_title_localization_translation_transport_timeout'
              : 'export_title_localization_verifier_transport_timeout',
            code: 'request_timeout',
            status: 504,
            retryAfter: null,
            providerStatus: null,
            deadlineOwner: owner,
          };
        }

        const classified = classifyProviderError(error);
        const reasonByCode: Partial<Record<AiErrorCode, string>> = {
          provider_rate_limited: 'export_title_localization_provider_rate_limited',
          provider_auth_error: 'export_title_localization_provider_auth_error',
          provider_credit_exhausted: 'export_title_localization_provider_credit_exhausted',
          provider_temporarily_unavailable:
            'export_title_localization_provider_temporarily_unavailable',
          request_timeout: stage === 'translation'
            ? 'export_title_localization_translation_transport_timeout'
            : 'export_title_localization_verifier_transport_timeout',
        };
        return {
          reason: reasonByCode[classified.code]
            || 'export_title_localization_provider_transport_failed',
          code: classified.code,
          status: classified.status,
          retryAfter: classified.retryAfter,
          providerStatus: classified.providerStatus,
          deadlineOwner: owner,
        };
      };

      let translatorAttemptCount = 0;
      let verifierAttemptCount = 0;
      let translatorResponse: Anthropic.Messages.Message;
      try {
        translatorResponse = await callWithRetry({
          model: MODEL,
          max_tokens: 1200,
          temperature: 0,
          stream: false,
          system: `You are a strict CV job-title localization engine. Translate only into ${targetInfo.languageName} (${resolvedLocale}). Return one JSON object and no commentary or markdown. Preserve every entryId exactly. Translate only the roleTitle. Preserve the role's occupation, specialization, seniority, coordination/management scope, technical domain, customer-facing scope, and employment meaning. Preserve product names, standards, acronyms, and proper nouns exactly when they are not normally translated. Do not add qualifications, tools, leadership, regulated responsibility, seniority, achievements, or scope not present in the source. Employers are context only and must never appear inside localizedRoleTitle.${repair ? ' This is a repair attempt. Use the supplied repairContext from the rejected prior attempt and correct only the rejected title localization while preserving the exact source meaning.' : ''}`,
          messages: [{
            role: 'user',
            content: JSON.stringify({
              task: 'localize_export_job_titles',
              targetLocale: resolvedLocale,
              gender: sanitizeField(params.gender, 30),
              entries: safeEntries,
              ...(repairContext ? { repairContext } : {}),
              responseSchema: {
                targetLocale: resolvedLocale,
                entries: [{
                  entryId: 'exact input entryId',
                  localizedRoleTitle: 'target-language role title only',
                }],
              },
            }),
          }],
        }, deadlineAt, () => {
          translatorAttemptCount += 1;
        }, EXPERIENCE_LOCALIZATION_TRANSLATION_TIMEOUT_MS, 'translation', req.signal, false);
      } catch (error) {
        const failure = classifyTitleTransportFailure(error, 'translation');
        return jsonResponse({
          error: 'Export title localization translation transport failed.',
          code: failure.code,
          localizationTypedFailureReason: failure.reason,
          localizationFailureStage: 'title_translation_transport',
          deadlineOwner: failure.deadlineOwner,
          providerStatus: failure.providerStatus,
          retryAfter: failure.retryAfter,
          titleTranslatorAttemptCount: translatorAttemptCount,
          titleVerifierAttemptCount: verifierAttemptCount,
        }, {
          status: failure.status,
          ...(failure.retryAfter
            ? { headers: { 'Retry-After': String(failure.retryAfter) } }
            : {}),
        });
      }

      const translated = parseStrictObject<TitleTranslatorPayload>(getText(translatorResponse));
      const translatedById = new Map(
        Array.isArray(translated?.entries)
          ? translated!.entries.map((entry) => [String(entry.entryId || ''), entry])
          : [],
      );
      const translationParityPassed = translated?.targetLocale === resolvedLocale
        && translatedById.size === safeEntries.length
        && safeEntries.every((entry) => {
          const candidate = translatedById.get(entry.entryId);
          return Boolean(
            candidate
            && typeof candidate.localizedRoleTitle === 'string'
            && candidate.localizedRoleTitle.trim().length > 0
            && candidate.localizedRoleTitle.trim().length <= 500,
          );
        });
      if (!translationParityPassed) {
        const partialCandidates = Array.isArray(translated?.entries)
          ? translated!.entries
            .map((entry) => ({
              entryId: sanitizeField(entry.entryId, 200),
              localizedRoleTitle: sanitizeField(entry.localizedRoleTitle, 500),
            }))
            .filter((entry) => (
              expectedIds.includes(entry.entryId)
              && entry.localizedRoleTitle.length > 0
            ))
          : [];
        return jsonResponse({
          error: 'Title localization provider returned malformed structured JSON.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: 'export_title_localization_provider_malformed',
          localizationFailureStage: 'title_translation_parse',
          titleRepairContext: {
            failedStage: 'translator_parse',
            previousCandidates: partialCandidates,
            verifierDecisions: [],
          } satisfies TitleRepairContext,
          titleTranslatorAttemptCount: translatorAttemptCount,
          titleVerifierAttemptCount: verifierAttemptCount,
        }, { status: 422 });
      }

      const candidates = safeEntries.map((entry) => ({
        entryId: entry.entryId,
        sourceLocale: entry.sourceLocale,
        sourceRoleTitle: entry.roleTitle,
        targetLocale: resolvedLocale,
        candidateRoleTitle: translatedById.get(entry.entryId)!.localizedRoleTitle.trim(),
      }));

      let verifierResponse: Anthropic.Messages.Message;
      try {
        verifierResponse = await callWithRetry({
          model: MODEL,
          max_tokens: 1200,
          temperature: 0,
          stream: false,
          system: `You are an independent CV title verifier. Do not translate or rewrite. Compare each sourceRoleTitle with candidateRoleTitle. Return one JSON object only. Pass only when the candidate is in ${targetInfo.languageName} (${resolvedLocale}), preserves the same occupation, specialization, seniority, technical/customer domain and responsibility scope, and introduces no qualification, tool, leadership, regulated duty, achievement, or extra scope. Preserve every entryId exactly. Reject untranslated source-language titles unless the title is a genuine invariant product code or acronym.`,
          messages: [{
            role: 'user',
            content: JSON.stringify({
              task: 'verify_export_job_title_localization',
              targetLocale: resolvedLocale,
              entries: candidates,
              responseSchema: {
                targetLocale: resolvedLocale,
                entries: [{
                  entryId: 'exact input entryId',
                  decision: 'passed or rejected',
                  semanticEquivalent: true,
                  targetLocalePassed: true,
                  unsupportedScopeIntroduced: false,
                }],
              },
            }),
          }],
        }, deadlineAt, () => {
          verifierAttemptCount += 1;
        }, EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS, 'verifier', req.signal, false);
      } catch (error) {
        const failure = classifyTitleTransportFailure(error, 'verifier');
        return jsonResponse({
          error: 'Export title localization independent verifier transport failed.',
          code: failure.code,
          localizationTypedFailureReason: failure.reason,
          localizationFailureStage: 'title_verifier_transport',
          deadlineOwner: failure.deadlineOwner,
          providerStatus: failure.providerStatus,
          retryAfter: failure.retryAfter,
          titleTranslatorAttemptCount: translatorAttemptCount,
          titleVerifierAttemptCount: verifierAttemptCount,
        }, {
          status: failure.status,
          ...(failure.retryAfter
            ? { headers: { 'Retry-After': String(failure.retryAfter) } }
            : {}),
        });
      }

      const verified = parseStrictObject<TitleVerifierPayload>(getText(verifierResponse));
      const verifiedById = new Map(
        Array.isArray(verified?.entries)
          ? verified!.entries.map((entry) => [String(entry.entryId || ''), entry])
          : [],
      );
      const verifierPassed = verified?.targetLocale === resolvedLocale
        && verifiedById.size === safeEntries.length
        && safeEntries.every((entry) => {
          const record = verifiedById.get(entry.entryId);
          return Boolean(
            record
            && record.decision === 'passed'
            && record.semanticEquivalent === true
            && record.targetLocalePassed === true
            && record.unsupportedScopeIntroduced === false,
          );
        });
      if (!verifierPassed) {
        const verifierDecisions = Array.isArray(verified?.entries)
          ? verified!.entries
            .map((entry) => ({
              entryId: sanitizeField(entry.entryId, 200),
              decision: sanitizeField(entry.decision, 40),
              semanticEquivalent: entry.semanticEquivalent === true,
              targetLocalePassed: entry.targetLocalePassed === true,
              unsupportedScopeIntroduced: entry.unsupportedScopeIntroduced === true,
            }))
            .filter((entry) => expectedIds.includes(entry.entryId))
          : [];
        return jsonResponse({
          error: 'Independent title localization verification rejected the candidate.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason:
            'export_title_localization_independent_verification_failed',
          localizationFailureStage: 'title_independent_verification',
          titleRepairContext: {
            failedStage: 'independent_verifier',
            previousCandidates: candidates.map((entry) => ({
              entryId: entry.entryId,
              localizedRoleTitle: entry.candidateRoleTitle,
            })),
            verifierDecisions,
          } satisfies TitleRepairContext,
          titleTranslatorAttemptCount: translatorAttemptCount,
          titleVerifierAttemptCount: verifierAttemptCount,
        }, { status: 422 });
      }

      return jsonResponse({
        localizedManifest: {
          targetLocale: resolvedLocale,
          entries: safeEntries.map((entry) => ({
            entryId: entry.entryId,
            localizedRoleTitle: translatedById.get(entry.entryId)!.localizedRoleTitle.trim(),
            facts: [],
          })),
        },
        localizationSource: 'provider_independent_verified',
        titleTranslatorAttemptCount: translatorAttemptCount,
        titleVerifierAttemptCount: verifierAttemptCount,
      });
    }

    if (action === 'summary-localize' || action === 'summary-context-localize') {
      const summaryContextRecovery = action === 'summary-context-localize';
      const resolvedLocale = normalizeLocale(params.targetLocale || params.locale);
      const targetInfo = localeInstructions[resolvedLocale];
      const entries = Array.isArray(params.entries) ? params.entries : [];
      if (!entries.length) {
        return jsonResponse({
          error: 'Structured localization requires at least one Experience entry.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
        }, { status: 422 });
      }
      type SafeLocalizationEntry = {
        entryId: string;
        sourceLocale: string;
        roleTitle: string;
        employer: string;
        employmentState: 'present' | 'completed';
        facts: Array<{ factId: string; sourceText: string }>;
      };
      const safeEntries: SafeLocalizationEntry[] = entries.slice(0, 8).map((entry: Record<string, unknown>) => ({
        entryId: sanitizeField(entry.entryId, 200),
        sourceLocale: sanitizeField(entry.sourceLocale, 20),
        roleTitle: sanitizeField(entry.roleTitle, 500),
        employer: sanitizeField(entry.employer, 500),
        employmentState: entry.employmentState === 'present' ? 'present' : 'completed',
        facts: (Array.isArray(entry.facts) ? entry.facts : []).slice(0, 12).map(
          (fact: Record<string, unknown>) => ({
            factId: sanitizeField(fact.factId, 240),
            sourceText: sanitizeText(fact.sourceText, 1200),
          }),
        ),
      }));
      const expectedEntryIds = safeEntries.map((entry) => entry.entryId);
      const expectedFactIds = safeEntries.flatMap((entry) => entry.facts.map((fact) => fact.factId));
      let response: Anthropic.Messages.Message;
      try {
        response = await callWithRetry({
          model: MODEL,
          max_tokens: Math.min(1800, 420 + safeEntries.length * 520),
          temperature: 0,
          stream: false,
          system: summaryContextRecovery
            ? `You prepare immutable, target-language Experience context for a professional Summary in ${targetInfo.languageName} (${resolvedLocale}). Return one JSON object and no commentary or markdown. Transform every source-language role and duty into natural target-language wording while preserving every entryId and factId exactly. This is context transformation, not enrichment: preserve employer, ownership, employment state, predicate, object, negation, scope, and tense; add no tools, systems, qualifications, certifications, metrics, achievements, leadership, frequency, responsibility, impact, or facts. Use the selected gender only where grammatically required.`
            : `You are a strict structured CV localization engine. Translate only into ${targetInfo.languageName} (${resolvedLocale}). Return one JSON object and no commentary or markdown. Preserve every entryId and factId exactly. Preserve employers exactly. Translate each role title and each duty separately. Preserve meaning, employment state, and factual scope. Add no tools, systems, qualifications, certifications, metrics, achievements, leadership, frequency, responsibility, scope, impact, or enrichment. Use natural target-language role titles and complete duty clauses. Use the selected gender only where grammatically required.${params.repair === true ? ' Previous structured localization was rejected. Recheck exact ID parity, target script, completeness, and source scope before responding.' : ''}`,
          messages: [{
            role: 'user',
            content: JSON.stringify({
              task: summaryContextRecovery
                ? 'prepare_target_summary_experience_context'
                : 'localize_cv_experience_manifest',
              targetLocale: resolvedLocale,
              gender: sanitizeField(params.gender, 30),
              entries: safeEntries,
              responseSchema: {
                targetLocale: resolvedLocale,
                entries: [{
                  entryId: 'exact input entryId',
                  localizedRoleTitle: 'target-language role title',
                  facts: [{ factId: 'exact input factId', localizedText: 'target-language duty' }],
                }],
              },
            }),
          }],
        }, deadlineAt, undefined,
        summaryContextRecovery
          ? EXPERIENCE_LOCALIZATION_TRANSLATION_TIMEOUT_MS
          : AI_PROVIDER_CALL_TIMEOUT_MS,
        summaryContextRecovery ? 'translation' : 'provider',
        req.signal,
        false);
      } catch (error) {
        const timeout = isProviderAbortOrTimeoutError(error);
        const classified = classifyProviderError(error);
        const typedReason = timeout ? 'request_timeout' : classified.code;
        return jsonResponse({
          error: timeout
            ? 'AI localization request timed out.'
            : 'AI localization provider is temporarily unavailable.',
          code: classified.code,
          localizationTypedFailureReason: typedReason,
          apiResponseKind: timeout ? 'timeout' : 'http_error',
          serverFallbackUsed: false,
          clientFallbackUsed: false,
          providerStatus: classified.providerStatus,
        }, { status: timeout ? 504 : classified.status });
      }
      const parsed = parseSummaryV2LocalizationProviderJson(getText(response));
      if (!parsed) {
        return jsonResponse({
          error: 'Localization provider returned malformed structured JSON.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: 'localization_provider_malformed_json',
        }, { status: 422 });
      }
      const actualEntryIds = parsed.entries.map((entry) => entry.entryId);
      const actualFactIds = parsed.entries.flatMap((entry) => entry.facts.map((fact) => fact.factId));
      const idsMatch = parsed.targetLocale === resolvedLocale
        && expectedEntryIds.length === actualEntryIds.length
        && expectedFactIds.length === actualFactIds.length
        && new Set(actualEntryIds).size === actualEntryIds.length
        && new Set(actualFactIds).size === actualFactIds.length
        && expectedEntryIds.every((id) => actualEntryIds.includes(id))
        && expectedFactIds.every((id) => actualFactIds.includes(id));
      if (!idsMatch) {
        return jsonResponse({
          error: 'Localization provider changed the structured fact manifest.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
          localizationTypedFailureReason: 'localization_id_parity_failed',
        }, { status: 422 });
      }
      return jsonResponse({
        localizedManifest: parsed,
        localizationSource: summaryContextRecovery ? 'summary_provider_recovery' : 'provider',
        apiResponseKind: 'localized_manifest',
        serverFallbackUsed: false,
        clientFallbackUsed: false,
      });
    }

    if (action === 'summary-simple-v1') {
      const operation = params.operation === 'generate' || params.operation === 'rewrite'
        ? params.operation
        : null;
      const style = ['shorter', 'stronger', 'professional'].includes(String(params.style))
        ? String(params.style) as 'shorter' | 'stronger' | 'professional'
        : null;
      if (!operation || (operation === 'rewrite' && !style)) {
        return jsonResponse({
          error: 'Invalid Simple V1 Summary operation.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
        }, { status: 400 });
      }

      const resolvedLocale = normalizeLocale(params.contentLocale);
      const localeInfo = localeInstructions[resolvedLocale];
      const gender = sanitizeField(params.gender, 40);
      const genderNote = getGenderInstruction(resolvedLocale, gender || '');
      const rawFacts = params.facts && typeof params.facts === 'object' && !Array.isArray(params.facts)
        ? params.facts as Record<string, unknown>
        : {};
      const safeFacts = {
        jobTitle: sanitizeField(rawFacts.jobTitle, 300),
        roles: (Array.isArray(rawFacts.roles) ? rawFacts.roles : []).slice(0, 4).map((value) => {
          const role = value && typeof value === 'object' && !Array.isArray(value)
            ? value as Record<string, unknown>
            : {};
          return {
            position: sanitizeField(role.position, 300),
            company: sanitizeField(role.company, 300),
            startDate: sanitizeField(role.startDate, 40),
            endDate: sanitizeField(role.endDate, 40),
            isPresent: role.isPresent === true,
            description: sanitizeText(role.description, 3000),
          };
        }),
        education: (Array.isArray(rawFacts.education) ? rawFacts.education : []).slice(0, 3).map((value) => {
          const education = value && typeof value === 'object' && !Array.isArray(value)
            ? value as Record<string, unknown>
            : {};
          return {
            school: sanitizeField(education.school, 300),
            degree: sanitizeField(education.degree, 300),
            startDate: sanitizeField(education.startDate, 40),
            endDate: sanitizeField(education.endDate, 40),
          };
        }),
        skills: (Array.isArray(rawFacts.skills) ? rawFacts.skills : [])
          .slice(0, 16)
          .map((value) => sanitizeField(value, 160)),
        certifications: (Array.isArray(rawFacts.certifications) ? rawFacts.certifications : [])
          .slice(0, 8)
          .map((value) => sanitizeField(value, 200)),
        languages: (Array.isArray(rawFacts.languages) ? rawFacts.languages : []).slice(0, 8).map((value) => {
          const language = value && typeof value === 'object' && !Array.isArray(value)
            ? value as Record<string, unknown>
            : {};
          return {
            name: sanitizeField(language.name, 120),
            level: sanitizeField(language.level, 80),
          };
        }),
      };
      const sourceSummary = operation === 'rewrite'
        ? sanitizeText(params.sourceSummary, 3000)
        : '';
      if (operation === 'rewrite' && !sourceSummary.trim()) {
        return jsonResponse({
          error: 'A current Summary is required for rewrite.',
          code: 'generation_validation_failed' satisfies AiErrorCode,
        }, { status: 422 });
      }

      const styleInstruction = style === 'shorter'
        ? 'Make the source Summary meaningfully shorter while preserving its supported facts.'
        : style === 'stronger'
          ? 'Improve impact and wording without adding achievements, scope, or facts.'
          : 'Improve the professional tone without adding facts.';
      const response = await callWithRetry({
        model: MODEL,
        max_tokens: 360,
        temperature: 0.35,
        stream: false,
        system: `Write one concise professional CV Summary in ${localeInfo.languageName} (${resolvedLocale}).
Return plain Summary text only: no markdown, heading, list, quotation marks, or JSON.
Use only CURRENT STRUCTURED CV FACTS and, for a rewrite, the supplied CURRENT SUMMARY.
Employer names, dates, numbers, metrics, tools, duties, qualifications, and achievements must be copied from those sources; never invent them.
Do not calculate new durations or metrics. Write two to four complete sentences.
${operation === 'rewrite' ? styleInstruction : 'Create a complete Summary from the structured facts. Ignore any Summary text not explicitly supplied in this request.'}
${genderNote}`,
        messages: [{
          role: 'user',
          content: JSON.stringify({
            contentLocale: resolvedLocale,
            gender,
            operation,
            ...(style ? { style } : {}),
            facts: safeFacts,
            ...(operation === 'rewrite' ? { currentSummary: sourceSummary } : {}),
          }),
        }],
      }, deadlineAt);

      return jsonResponse({
        result: getText(response),
        simpleV1: true,
        providerResultKind: 'text',
      });
    }

    if (action === 'summary') {
      const { locale, gender, experienceEntries, skills, languages, education } = params;
      const jobTitle = sanitizeField(params.jobTitle, 500);
      const resolvedLocale = normalizeLocale(locale);
      const localeInfo = localeInstructions[resolvedLocale];
      const genderNote = getGenderInstruction(resolvedLocale, gender || '');

      // Prefer the shared precomputed duration snapshot — never re-estimate per locale.
      const snapshot = params.experienceDurationSnapshot as ExperienceDurationSnapshot | undefined;
      const totalFromSnapshot: ExperienceDuration | undefined = snapshot?.total
        && typeof snapshot.total.totalMonths === 'number'
        ? applyApproximateDurationPolicy(snapshot.total.totalMonths)
        : undefined;
      const experienceDuration = totalFromSnapshot
        ? durationToPromptToken(totalFromSnapshot)
        : sanitizeField(params.experienceDuration, 50);

      // Build experience context block from real data
      const entries: Array<{ position?: string; company?: string; startDate?: string; endDate?: string; description?: string }> =
        Array.isArray(experienceEntries) ? experienceEntries : [];
      const skillsList: string[] = Array.isArray(skills) ? skills : [];
      const langsList: Array<{ name?: string; level?: string }> = Array.isArray(languages) ? languages : [];
      const eduList: Array<{ degree?: string; school?: string }> = Array.isArray(education) ? education : [];

      // Build duration phrase based on actual calculated duration (supports half years).
      let durationPhrase = '';
      if (experienceDuration === 'practical') {
        durationPhrase = 'IMPORTANT: The candidate has less than 6 months of work experience. Use wording like "with practical experience in" or "with recent hands-on experience as" — never mention years or imply long experience.';
      } else if (experienceDuration === 'under-one-year') {
        durationPhrase = 'IMPORTANT: The candidate has under one year of work experience. Use months / "almost one year" wording — never say "1 year" or more.';
      } else if (experienceDuration && !isNaN(Number(experienceDuration))) {
        const yrs = parseFloat(experienceDuration as string);
        durationPhrase = `IMPORTANT: Shared deterministic duration: approximately ${yrs} year(s) of work experience (totalMonths=${totalFromSnapshot?.totalMonths ?? 'n/a'}). State THIS exact approximate year count in the summary — do not invent a different number. Prefer omitting an explicit year count if unsure; the client will inject the authoritative phrase.`;
      } else {
        durationPhrase = 'IMPORTANT: Exact experience duration is unknown. Do NOT mention any number of years or imply a specific duration. Use phrases like "with professional experience in" instead.';
      }

      // Build experience details text
      let experienceBlock = '';
      if (entries.length > 0) {
        experienceBlock = '\n\nWork Experience (use this data — do not invent roles or durations):\n';
        experienceBlock += entries.map(e =>
          `- ${e.position || ''}${e.company ? ' at ' + e.company : ''}${e.startDate ? ' (' + e.startDate + ' – ' + (e.endDate || 'present') + ')' : ''}${e.description ? ': ' + e.description.slice(0, 200) : ''}`
        ).join('\n');
      }

      const skillsBlock = skillsList.length > 0 ? `\n\nSkills: ${skillsList.join(', ')}` : '';
      const langsBlock = langsList.length > 0 ? `\n\nLanguages: ${langsList.map(l => l.name + (l.level ? ' (' + l.level + ')' : '')).join(', ')}` : '';
      const eduBlock = eduList.length > 0 ? `\n\nEducation: ${eduList.map(e => [e.degree, e.school].filter(Boolean).join(' at ')).join('; ')}` : '';

      const providerStartedAt = Date.now();
      let providerFinishedAt = providerStartedAt;
      let providerAborted = false;
      let providerFailureReason: 'provider_attempt_timeout' | null = null;
      let repairFailureReason: 'repair_attempt_timeout' | null = null;
      let cleanedText = '';
      try {
        const response = await callWithRetry({
          model: MODEL,
          max_tokens: 220,
          temperature: 0.4,
          stream: false,
          system: `You write concise, fact-locked CV professional summaries in ${localeInfo.languageName}.
Rules:
- Plain text only. No markdown, no bullet points, no headers, no lists.
- NEVER wrap output in quotation marks. Output raw summary text only.
- MAXIMUM LENGTH: 2 short sentences, about 40–75 words, hard maximum 90 words. Never write an essay or multi-paragraph summary.
- Use ONLY the immutable allowed facts provided. Never invent duties, quality claims, health/food-safety standards, storage, inventory, menu work, pressure, efficiency, reliability, attention to detail, dedication, career ambitions, or international-workplace suitability.
- Skills are LABELS only. You may write "Key skills include X, Y, Z." Never convert skills into demonstrated leadership, initiative, problem-solving achievements, smooth operations, or personality traits.
- NEVER invent experience duration. Use ONLY the shared duration instruction below (or omit duration if unknown).
- Do NOT use previous summaries, repair text, or template filler as facts.
- Prefer occupation + approximate experience + grounded responsibilities in sentence 1; optional skills label list in sentence 2.
- Company name: omit unless needed to distinguish employment.
- COMPLETENESS: Finish every sentence. Never stop mid-word.
- For Hindi: never invent print/मुद्रण/छपाई unless SOURCE FACTS contain print; close current-role sentences with हैं/है (never bare पेशेवर। or करती।); avoid orphan जहाँ clauses.
- PERSPECTIVE: One consistent perspective (first OR third person).
- GENDER: Use natural gendered occupational forms and grammar for the selected gender where the language requires it (e.g. Serbian female Baker = Pekarka, never Pekara).
- LANGUAGE QUALITY: ${localeInfo.nativeQualityNote}`,
          messages: [
            {
              role: 'user',
              content: `Write a professional summary in ${localeInfo.languageName} for occupation: ${jobTitle || localeInfo.fallbackRole}.

IMMUTABLE ALLOWED FACTS (use only these):
${durationPhrase}${experienceBlock}${skillsBlock}${langsBlock}${eduBlock}

FORBIDDEN: achievements not in duties; skill inflation; high-quality/health/strictly claims; fast-paced/under pressure; initiative/leadership behavior from skill names; career goals; repeating languages unless essential.

Structure:
1) Occupation + approximate experience (if provided) + core grounded responsibilities.
2) Optional: "Key skills include …" listing skill labels only.

Output the summary only — nothing else. Max 90 words.${genderNote}`,
            },
          ],
        }, deadlineAt);
        providerFinishedAt = Date.now();
        const rawText = getText(response);
        cleanedText = rawText
          .trim()
          .replace(/^[\s"""''«»„\u201C\u201D\u2018\u2019\u00AB\u00BB]+/, '')
          .replace(/[\s"""''«»„\u201C\u201D\u2018\u2019\u00AB\u00BB]+$/, '');
      } catch (providerErr) {
        providerFinishedAt = Date.now();
        providerAborted = isProviderAbortOrTimeoutError(providerErr);
        // Continue to activateCvSummary → deterministic local fallback. Never
        // wait for a late provider promise or let Vercel kill the invocation.
        if (!providerAborted) throw providerErr;
        providerFailureReason = 'provider_attempt_timeout';
        cleanedText = '';
      }

      const factSet = buildCvCanonicalFactSet({
        personal: { fullName: '', email: '', phone: '', address: '', jobTitle: jobTitle || '' },
        summary: '',
        experience: entries.map((e, idx) => ({
          id: `e${idx}`,
          company: e.company || '',
          position: e.position || '',
          startDate: e.startDate || '',
          endDate: e.endDate === 'present' ? '' : (e.endDate || ''),
          isPresent: e.endDate === 'present',
          description: e.description || '',
        })),
        education: eduList.map((e, idx) => ({
          id: `ed${idx}`,
          school: e.school || '',
          degree: e.degree || '',
          startDate: '',
          endDate: '',
          description: '',
        })),
        skills: skillsList,
        certifications: [],
        languages: langsList.map((l) => ({ name: l.name || '', level: l.level || '' })),
      });
      const sourceFactsText = [experienceBlock, skillsBlock, langsBlock, eduBlock].join('\n');
      const groundedFallback = [
        jobTitle ? `${jobTitle}.` : '',
        entries[0]?.description ? entries[0].description.split('\n')[0] : '',
        skillsList.length ? skillsList.slice(0, 5).join(', ') + '.' : '',
      ].filter(Boolean).join(' ').trim()
        || 'Professional with relevant experience, ready to contribute responsibly.';

      // Final response guard: if almost no budget remains, skip repair and go
      // straight to local fallback so JSON is returned before Vercel kills us.
      const forceRespond = shouldForceRespond(deadlineAt) || providerAborted;
      let repairStartedAt: number | null = null;
      let repairFinishedAt: number | null = null;
      const fallbackStartedAt = Date.now();
      const activated = await activateCvSummary({
        locale: resolvedLocale,
        gender: gender || '',
        factSet,
        candidate: cleanedText,
        sourceFactsText,
        fallbackSummary: groundedFallback,
        duration: totalFromSnapshot,
        deadlineAt,
        repair: forceRespond
          ? undefined
          : async (prompt) => {
            if (shouldForceRespond(deadlineAt)) {
              throw Object.assign(new Error('Request timeout: response guard'), { name: 'AbortError' });
            }
            repairStartedAt = Date.now();
            try {
              const repaired = await callWithRetry({
                model: MODEL,
                max_tokens: 600,
                temperature: 0.3,
                stream: false,
                system: resolvedLocale === 'hi'
                  ? `You rewrite complete CV professional summaries in Hindi (Devanagari).
Rules:
- Preserve exact factual scope from SOURCE FACTS only — never invent print/मुद्रण/छपाई, branding, marketing, tools, achievements, education, or certifications unless present in facts.
- Prefer digital/visual/graphic/screens/files wording when those appear in facts; do not add print media.
- Exactly three complete sentences: current intro, current duties, prior role.
- Current intro must end with a finite copula (e.g. पेशेवर हैं। / कार्यरत हैं।), never a bare nominal पेशेवर।
- Current duty sentences must use complete finite forms (करती हैं / अद्यतन करती हैं), never bare करती। or orphan जहाँ fragments.
- Prior completed role uses natural past forms (तैयार करती थीं / तैयार कीं).
- Preserve Atlas, Rewitu and structured roles; exactly one combined duration claim.
- Finish every sentence. Plain text only. Never prefix with labels.`
                  : `You rewrite complete CV summaries in ${localeInfo.languageName}. Finish every sentence. Never invent duties. Plain text only. Never prefix with labels like "CORRECTED PROFESSIONAL SUMMARY:".`,
                messages: [{ role: 'user', content: prompt }],
              }, deadlineAt);
              repairFinishedAt = Date.now();
              return getText(repaired)
                .trim()
                .replace(/^[\s"""''«»„\u201C\u201D\u2018\u2019\u00AB\u00BB]+/, '')
                .replace(/[\s"""''«»„\u201C\u201D\u2018\u2019\u00AB\u00BB]+$/, '');
            } catch (repairErr) {
              repairFinishedAt = Date.now();
              if (isProviderAbortOrTimeoutError(repairErr)) {
                repairFailureReason = 'repair_attempt_timeout';
                throw repairErr;
              }
              throw repairErr;
            }
          },
      });
      const fallbackFinishedAt = Date.now();

      logAiServerRequestTiming({
        requestId: typeof requestId === 'string' ? requestId : null,
        action: 'summary_generate',
        requestedLocale: resolvedLocale,
        serverReceivedAt,
        providerStartedAt,
        providerFinishedAt,
        providerValid: activated.status === 'passed',
        providerAborted,
        providerFailureReason,
        repairAttempted: activated.repairAttempted,
        repairFailureReason,
        repairSkippedReason: !activated.repairAttempted && activated.status !== 'passed'
          ? (forceRespond ? 'response_guard_or_provider_abort' : 'insufficient_deadline_budget')
          : null,
        repairStartedAt,
        repairFinishedAt,
        fallbackStartedAt: activated.status === 'fallback' ? fallbackStartedAt : null,
        fallbackFinishedAt: activated.status === 'fallback' ? fallbackFinishedAt : null,
        serverRespondedAt: Date.now(),
        deadlineAt,
      });

      if (_freeUserId) recordFreeAction(_freeUserId, 'summary');
      if (activated.blocked || activated.status === 'blocked' || !activated.content.trim()) {
        if (shouldForceRespond(deadlineAt)) {
          return jsonResponse({
            error: 'AI request timed out.',
            code: 'request_timeout',
            cvFidelityStatus: 'blocked',
            repairAttempted: activated.repairAttempted,
            fallbackUsed: activated.fallbackUsed,
            violationCount: activated.violations.length,
          }, { status: 504 });
        }
        const emergencyLocalized = deterministicLocalizedSummaryFromCanonical(
          factSet,
          resolvedLocale,
          gender || '',
        ).trim();
        if (emergencyLocalized) {
          return jsonResponse({
            result: emergencyLocalized,
            cvFidelityStatus: 'fallback',
            repairAttempted: activated.repairAttempted,
            fallbackUsed: true,
            violationCount: activated.violations.length,
            providerFailureReason,
            repairFailureReason,
          });
        }
        return jsonResponse({
          error: `Could not produce a complete localized summary for ${resolvedLocale}. Export/generation was blocked to avoid an English dump.`,
          cvFidelityStatus: 'blocked',
          repairAttempted: activated.repairAttempted,
          fallbackUsed: activated.fallbackUsed,
          violationCount: activated.violations.length,
        }, { status: 422 });
      }
      return jsonResponse({
        result: activated.content,
        cvFidelityStatus: activated.status,
        repairAttempted: activated.repairAttempted,
        fallbackUsed: activated.fallbackUsed,
        violationCount: activated.violations.length,
      });
    }

    if (action === 'rewrite') {
      const { style, locale, gender } = params;
      const text = sanitizeText(params.text, 10000);
      const resolvedLocale = normalizeLocale(locale);
      const localeInfo = localeInstructions[resolvedLocale];
      const genderNote = getGenderInstruction(resolvedLocale, gender || '');
      const isEmptyTarget = !text.trim();
      const rewriteStyle = (['shorter', 'stronger', 'professional'].includes(String(style))
        ? style
        : 'professional') as 'shorter' | 'stronger' | 'professional';

      const styleMap: Record<string, string> = {
        shorter: 'Make it more concise and to the point. Keep only the most important information. 1–2 sentences maximum.',
        stronger: 'Rewrite using strong, active verbs and impactful language. Make it sound confident and results-oriented without inventing fake numbers or metrics.',
        professional: 'Rewrite in a polished, professional tone. Use clear, formal vocabulary without corporate jargon or filler words.',
      };
      const generateStyleMap: Record<string, string> = {
        shorter: 'Write a concise professional summary (1–2 sentences) from the SOURCE FACTS only.',
        stronger: 'Write a confident, results-oriented professional summary from the SOURCE FACTS only. Use strong active verbs. Do not invent metrics, tools, leadership, clients, or achievements.',
        professional: 'Write a polished professional summary from the SOURCE FACTS only. Formal vocabulary, no corporate jargon, no invented facts.',
      };

      const cvContext = params.cvContext;
      if (isEmptyTarget) {
        if (!cvContext || !hasSufficientSummaryGenerationContext(cvContext)) {
          return jsonResponse({
            error: 'Insufficient CV context to generate a professional summary.',
            code: 'summary_rewrite_failed' satisfies AiErrorCode,
            cvFidelityStatus: 'blocked',
          }, { status: 422 });
        }
      }

      const rewriteFactSet = cvContext
        ? buildCvCanonicalFactSet(cvContext)
        : buildCvCanonicalFactSet({
          personal: { fullName: '', email: '', phone: '', address: '', jobTitle: '' },
          summary: text,
          experience: [{
            id: 'rewrite-0',
            company: '',
            position: '',
            startDate: '',
            endDate: '',
            isPresent: false,
            description: text,
          }],
          education: [],
          skills: [],
          certifications: [],
          languages: [],
        });
      const sourceFactsText = cvContext
        ? [
          cvContext.personal?.jobTitle || '',
          ...(cvContext.experience || []).map((e: { position?: string; company?: string; description?: string }) =>
            [e.position, e.company, e.description].filter(Boolean).join(' — ')),
          (cvContext.skills || []).join(', '),
        ].filter(Boolean).join('\n')
        : text;
      const groundedBase = cvContext
        ? deterministicLocalizedSummaryFromCanonical(
          rewriteFactSet,
          resolvedLocale,
          gender || '',
        ).trim()
        : '';
      const fallbackSummary = isEmptyTarget
        ? applySummaryRewriteStyleDeterministic(groundedBase, rewriteStyle) || groundedBase
        : (cvContext ? (cvContext.summary || text) : text);

      const providerStartedAt = Date.now();
      let providerFinishedAt = providerStartedAt;
      let providerAborted = false;
      let providerFailureReason: 'provider_attempt_timeout' | null = null;
      let repairFailureReason: 'repair_attempt_timeout' | null = null;
      let rewritten = isEmptyTarget ? '' : text;
      try {
        const response = await callWithRetry({
          model: MODEL,
          max_tokens: 400,
          temperature: 0.65,
          stream: false,
          system: isEmptyTarget
            ? `You are a professional CV writer. Generate a professional summary in ${localeInfo.languageName} from SOURCE FACTS only.
Rules:
- Output only the summary text, nothing else.
- Do NOT wrap output in quotation marks of any kind.
- Do NOT invent numbers, metrics, percentages, tools, leadership, clients, certifications, personality traits, or duties that are not in SOURCE FACTS.
- Use only years/durations that appear in SOURCE FACTS or are clearly derivable from structured dates there.
- Sound natural and human, not templated or robotic.
- Always finish every sentence completely — never truncate mid-word.
- Keep one consistent perspective (first OR third person).
- LANGUAGE QUALITY: ${localeInfo.nativeQualityNote}`
            : `You are a professional CV editor. Rewrite text per the given instructions in ${localeInfo.languageName}.
Rules:
- Output only the rewritten text, nothing else.
- Do NOT wrap output in quotation marks of any kind.
- Keep the meaning intact while improving quality.
- Do NOT invent numbers, metrics, percentages, or duties that are not in the original text.
- Do NOT use vague invented metrics like "by 44%" or "11 hours" unless they appear in the original.
- Focus on responsibilities, collaboration, and qualitative improvements — not fabricated numbers.
- Sound natural and human, not templated or robotic.
- Always finish every sentence completely — never truncate mid-word.
- Keep one consistent perspective (first OR third person).
- LANGUAGE QUALITY: ${localeInfo.nativeQualityNote}`,
          messages: [
            {
              role: 'user',
              content: isEmptyTarget
                ? `${generateStyleMap[rewriteStyle] || generateStyleMap.professional}${genderNote}

SOURCE FACTS:
${sourceFactsText || '(none)'}`
                : `${styleMap[rewriteStyle] || styleMap.professional}${genderNote}\n\nText: ${text}`,
            },
          ],
        }, deadlineAt);
        providerFinishedAt = Date.now();
        rewritten = getText(response) || (isEmptyTarget ? '' : text);
      } catch (providerErr) {
        providerFinishedAt = Date.now();
        providerAborted = isProviderAbortOrTimeoutError(providerErr);
        if (!providerAborted) throw providerErr;
        providerFailureReason = 'provider_attempt_timeout';
        rewritten = isEmptyTarget ? '' : text;
      }
      const rewriteForceRespond = shouldForceRespond(deadlineAt) || providerAborted;
      let rewriteRepairStartedAt: number | null = null;
      let rewriteRepairFinishedAt: number | null = null;
      const rewriteFallbackStartedAt = Date.now();
      const activated = await activateCvSummary({
        locale: resolvedLocale,
        gender: gender || '',
        factSet: rewriteFactSet,
        candidate: rewritten,
        sourceFactsText,
        fallbackSummary,
        deadlineAt,
        repair: rewriteForceRespond
          ? undefined
          : async (prompt) => {
            rewriteRepairStartedAt = Date.now();
            try {
              const repaired = await callWithRetry({
                model: MODEL,
                max_tokens: 400,
                temperature: 0.25,
                stream: false,
                system: `You repair CV text in ${localeInfo.languageName}. Keep the same facts. Finish every sentence. Plain text only. Never prefix with labels like "CORRECTED PROFESSIONAL SUMMARY:".`,
                messages: [{ role: 'user', content: prompt }],
              }, deadlineAt);
              rewriteRepairFinishedAt = Date.now();
              return getText(repaired).trim();
            } catch (repairErr) {
              rewriteRepairFinishedAt = Date.now();
              if (isProviderAbortOrTimeoutError(repairErr)) {
                repairFailureReason = 'repair_attempt_timeout';
              }
              throw repairErr;
            }
          },
      });
      const rewriteFallbackFinishedAt = Date.now();

      logAiServerRequestTiming({
        requestId: typeof requestId === 'string' ? requestId : null,
        action: `rewrite_${rewriteStyle}`,
        requestedLocale: resolvedLocale,
        serverReceivedAt,
        providerStartedAt,
        providerFinishedAt,
        providerValid: activated.status === 'passed',
        providerAborted,
        providerFailureReason,
        repairAttempted: activated.repairAttempted,
        repairFailureReason,
        repairSkippedReason: !activated.repairAttempted && activated.status !== 'passed'
          ? (rewriteForceRespond ? 'response_guard_or_provider_abort' : 'insufficient_deadline_budget')
          : null,
        repairStartedAt: rewriteRepairStartedAt,
        repairFinishedAt: rewriteRepairFinishedAt,
        fallbackStartedAt: activated.status === 'fallback' ? rewriteFallbackStartedAt : null,
        fallbackFinishedAt: activated.status === 'fallback' ? rewriteFallbackFinishedAt : null,
        serverRespondedAt: Date.now(),
        deadlineAt,
      });

      if (activated.blocked || activated.status === 'blocked' || !activated.content.trim()) {
        if (shouldForceRespond(deadlineAt)) {
          return jsonResponse({
            error: 'AI request timed out.',
            code: 'request_timeout',
            cvFidelityStatus: 'blocked',
            repairAttempted: activated.repairAttempted,
            fallbackUsed: activated.fallbackUsed,
            violationCount: activated.violations.length,
          }, { status: 504 });
        }
        const emergencyLocalized = applySummaryRewriteStyleDeterministic(
          deterministicLocalizedSummaryFromCanonical(
            rewriteFactSet,
            resolvedLocale,
            gender || '',
          ).trim(),
          rewriteStyle,
        ).trim() || deterministicLocalizedSummaryFromCanonical(
          rewriteFactSet,
          resolvedLocale,
          gender || '',
        ).trim();
        if (emergencyLocalized) {
          return jsonResponse({
            result: emergencyLocalized,
            cvFidelityStatus: 'fallback',
            repairAttempted: activated.repairAttempted,
            fallbackUsed: true,
            violationCount: activated.violations.length,
            providerFailureReason,
            repairFailureReason,
            operationMode: isEmptyTarget ? 'generate_from_context' : 'enhance_existing_content',
          });
        }
        return jsonResponse({
          error: `Could not produce complete localized text for ${resolvedLocale}. Changes were not applied to avoid mixed-language content.`,
          code: 'summary_rewrite_failed' satisfies AiErrorCode,
          cvFidelityStatus: 'blocked',
          repairAttempted: activated.repairAttempted,
          fallbackUsed: activated.fallbackUsed,
          violationCount: activated.violations.length,
        }, { status: 422 });
      }
      return jsonResponse({
        result: activated.content,
        cvFidelityStatus: activated.status,
        repairAttempted: activated.repairAttempted,
        fallbackUsed: activated.fallbackUsed,
        violationCount: activated.violations.length,
        operationMode: isEmptyTarget ? 'generate_from_context' : 'enhance_existing_content',
      });
    }

    if (action === 'bullets') {
      const { industry, level, locale, gender } = params;
      const position = sanitizeField(params.position, 500);
      const company = sanitizeField(params.company, 500);
      // Recovery requests carry an immutable, entry-owned fact snapshot.  It
      // outranks the visible textarea and the ordinary sourceDescription field
      // so a prior unedited AI surface can never become fact authority.
      const sourceDescription = sanitizeText(
        params.factAuthorityDescription
          ?? params.sourceDescription
          ?? params.description
          ?? '',
        8000,
      );
      const isPresentRole = params.isPresent === true
        || params.isPresent === 'true'
        || String(params.endDate || '').toLowerCase() === 'present';
      const resolvedLocale = normalizeLocale(locale);
      const localeInfo = localeInstructions[resolvedLocale];
      const companyName = company || localeInfo.fallbackCompany;
      // Empty sourceDescription means occupation-aware generation (no FACT LOCK).
      // Never treat a missing/blank source as cooking duties to preserve.
      const factSet = buildFactSetFromExperienceDescription(sourceDescription, {
        experienceIndex: 0,
        company: companyName,
        position,
      });
      const canonicalBullets = bulletsForExperience(factSet, 0);
      const hasCanonical = canonicalBullets.length > 0;

      // If no API key and no source: title-relevant job-context generation fallback.
      if (!hasCanonical && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
        const occupationFallback = buildJobContextGenerationFallback({
          locale: resolvedLocale,
          gender: gender || '',
          position,
          industry: industry || 'general',
          isPresent: isPresentRole,
        });
        if (_freeUserId) recordFreeAction(_freeUserId, 'bullets');
        return jsonResponse({
          result: occupationFallback,
          cvFidelityStatus: 'passed',
          usedFactIds: [],
          fallbackUsed: true,
          occupationGenericFallbackUsed: true,
          operationMode: 'generate_from_job_context',
        });
      }

      // If no API key, fall back to offline templates (fact-locked when source exists)
      if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
        const offlineResult = generateBulletsOffline(
          (industry || 'general') as BulletIndustry,
          (level || 'mid') as BulletLevel,
          companyName,
          resolvedLocale,
          sourceDescription,
        );
        if (_freeUserId) recordFreeAction(_freeUserId, 'bullets');
        return jsonResponse({
          result: offlineResult,
          cvFidelityStatus: 'fallback',
          usedFactIds: canonicalBullets.map((b) => b.id),
          fallbackUsed: true,
        });
      }

      const genderNote = getGenderInstruction(resolvedLocale, gender || '');
      const levelDescriptions: Record<string, string> = {
        entry: 'entry-level or junior',
        mid: 'mid-level',
        senior: 'senior',
        lead: 'lead or managerial',
      };
      const levelDesc = levelDescriptions[level || 'mid'] || 'mid-level';
      const roleLabel = position ? `${position}` : `${industry || 'professional'}`;
      const atCompany = companyName && companyName !== localeInfo.fallbackCompany ? ` at ${companyName}` : '';
      const employmentTenseNote = isPresentRole
        ? 'EMPLOYMENT STATUS: current role (Present). Describe ongoing duties in natural present / habitual-present CV tense for the target language. Do NOT use completed-past forms that present the role as finished.'
        : 'EMPLOYMENT STATUS: past role (ended). Describe duties in natural past tense for the target language.';
      const noopRepairRequested = params.noopRepair === true
        || params.noopRepair === 'true'
        || Boolean(params.repairPromptHint);
      const factLockNote = hasCanonical
        ? `FACT LOCK: You are given immutable SOURCE BULLETS (original/confirmed user duties) with stable IDs and semantic categories. Preserve EVERY material duty — do not drop, merge-away, or replace any duty. Prefer one bullet per source duty (same order). Translate/polish grammar only. Preserve each bullet's category meaning (guest service stays guest/customer service — never replace with colleague cooperation; inventory counts/management communication must stay; do not invent standard/custom recipes or cuisine types unless present in SOURCE). Do NOT invent adjacent industry duties (e.g. do not add ingredient/material storage to workplace hygiene; do not add route planning to delivery; do not add documentation to testing). Do NOT invent allergy checks, muddling, syrups, wastage, kitchen cooperation, evening shifts, inventory shortages, leadership, metrics, or any duty absent from SOURCE BULLETS. Output CV bullets only — never explain grounding, never mention source duties/role duties/canonical facts/validation. Serbian must use natural forms (koktele not kokteile; barmen/bartending not barteninga; level phrases must match stored enums — never "srednje naprednom").`
        : `GENERATION MODE: The user supplied no duties. Infer exactly 3 ordinary role responsibilities from job title, industry, and seniority only. Company name is display context only — never invent company-specific facts. Use third-person CV style where the language requires it. No tools/software, metrics/KPIs, years of experience, achievements, clients, team size, leadership, certifications, or regulated claims. No generic filler like "carry out assigned professional duties". No English when the target language is not English.`;

      const providerStartedAt = Date.now();
      let providerFinishedAt = providerStartedAt;
      let providerAborted = false;
      let providerFailureReason: 'provider_attempt_timeout' | null = null;
      let repairFailureReason: 'repair_attempt_timeout' | null = null;
      let aiResult = '';
      let generationRepairAttempted = false;
      try {
        const noopSystem = `You are an expert CV writer performing a NO-OP REPAIR rewrite in ${localeInfo.languageName}.
The previous output was rejected because it was materially identical to the source.
Rules:
- Output ONLY bullet points, each starting with "•"
- Make a real stylistic and professional improvement (wording/structure), not punctuation/whitespace/bullet-marker/capitalization-only changes
- Preserve EVERY source duty and the exact factual scope — do NOT add duties, tools, achievements, metrics, numbers, or facts
- Do NOT invent quality inspection/control, standards/compliance/regulations/procedures/policies, safety, audits, certifications, supervision, leadership, or organization when the source only states collaboration
- Do NOT add universal quantifiers (all/every/entire/svih/svu/cjelokupne) unless SOURCE FACTS establish that scope
- ${employmentTenseNote}
- CRITICAL LANGUAGE RULE: Every word must be in ${localeInfo.languageName}. Only keep universal acronyms when genuinely used.${genderNote}
- LANGUAGE QUALITY: ${localeInfo.nativeQualityNote}`;
        const noopUser = typeof params.repairPromptHint === 'string' && params.repairPromptHint.trim()
          ? String(params.repairPromptHint).slice(0, 6000)
          : `Rewrite these SOURCE FACTS into improved ${localeInfo.languageName} CV bullets for ${levelDesc} ${roleLabel}${atCompany}.
${employmentTenseNote}
Gender: ${gender || 'unspecified'}.
Industry: ${industry || 'general'}. Level: ${levelDesc}.

SOURCE FACTS:
${sourceDescription.slice(0, 2500)}

Previous rejected output (do not echo unchanged):
${String(params.previousOutput || sourceDescription).slice(0, 2500)}

Output only "•" bullet lines, same duty count/order.`;
        const response = await callWithRetry({
          model: MODEL,
          max_tokens: 450,
          temperature: noopRepairRequested ? 0.55 : (hasCanonical ? 0.35 : 0.55),
          stream: false,
          system: noopRepairRequested
            ? noopSystem
            : `You are an expert CV writer creating work experience bullet points in ${localeInfo.languageName}.
Rules:
- Output ONLY bullet points, each starting with "•"
- Each bullet: exactly 1 sentence, clear and direct, under 22 words
- ${factLockNote}
- ${employmentTenseNote}
- NO fake metrics or invented percentages
- CRITICAL LANGUAGE RULE: Every word must be in ${localeInfo.languageName}. Only keep universal acronyms (CRM, ERP, KPI, SQL, API) when genuinely used.${genderNote}
- LANGUAGE QUALITY: ${localeInfo.nativeQualityNote}`,
          messages: [
            {
              role: 'user',
              content: noopRepairRequested
                ? noopUser
                : hasCanonical
                ? `Localize the following canonical work bullets into ${localeInfo.languageName} for ${levelDesc} ${roleLabel}${atCompany}.
${employmentTenseNote}
Gender: ${gender || 'unspecified'}.

SOURCE BULLETS (immutable confirmed duties — preserve every material duty):
${formatCanonicalBulletsForPrompt(canonicalBullets)}

Output format: one bullet per line, each starting with "•". Same count and order. Nothing else.`
                : `Generate exactly 3 CV work experience bullet points in ${localeInfo.languageName} for a ${levelDesc} ${roleLabel}${atCompany ? ` (employer display name: ${companyName}; do not invent employer-specific facts)` : ''}.
Industry context: ${industry || 'general'}.
${employmentTenseNote}
Gender (grammar only): ${gender || 'unspecified'}.

Infer ordinary day-to-day responsibilities from the job title and level. Output format: exactly three lines, each starting with "•". Nothing else.`,
            },
          ],
        }, deadlineAt);
        providerFinishedAt = Date.now();
        aiResult = getText(response);
      } catch (providerErr) {
        providerFinishedAt = Date.now();
        providerAborted = isProviderAbortOrTimeoutError(providerErr);
        if (!providerAborted) throw providerErr;
        providerFailureReason = 'provider_attempt_timeout';
        aiResult = '';
      }
      if (!aiResult || !aiResult.includes('•')) {
        aiResult = noopRepairRequested
          ? ''
          : hasCanonical
          ? generateBulletsOffline(
            (industry || 'general') as BulletIndustry,
            (level || 'mid') as BulletLevel,
            companyName,
            resolvedLocale,
            sourceDescription,
          )
          : buildJobContextGenerationFallback({
            locale: resolvedLocale,
            gender: gender || '',
            position,
            industry: industry || 'general',
            isPresent: isPresentRole,
          });
      }

      const bulletsForceRespond = shouldForceRespond(deadlineAt) || providerAborted;

      // Generation Mode: skip source-fact activation; optional one repair then job-context fallback.
      if (!hasCanonical) {
        let generationContent = aiResult;
        let generationStatus: 'passed' | 'repaired' | 'fallback' = 'passed';
        let genCheck = validateExperienceGenerationOutput(generationContent, {
          locale: resolvedLocale,
          position,
          isPresent: isPresentRole,
        });
        if (
          !genCheck.ok
          && !bulletsForceRespond
          && (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
        ) {
          generationRepairAttempted = true;
          try {
            const repaired = await callWithRetry({
              model: MODEL,
              max_tokens: 450,
              temperature: 0.2,
              stream: false,
              system: `You repair CV generation bullets in ${localeInfo.languageName}. Output exactly 3 third-person CV bullets relevant to the job title. No tools, metrics, leadership, achievements, or company-specific inventions. ${employmentTenseNote}`,
              messages: [{
                role: 'user',
                content: `Job title: ${roleLabel}\nIndustry: ${industry || 'general'}\nLevel: ${levelDesc}\nGender: ${gender || 'unspecified'}\nPrevious invalid output:\n${generationContent.slice(0, 2000)}\n\nOutput exactly 3 lines starting with "•".`,
              }],
            }, deadlineAt);
            generationContent = getText(repaired);
            genCheck = validateExperienceGenerationOutput(generationContent, {
              locale: resolvedLocale,
              position,
              isPresent: isPresentRole,
            });
            if (genCheck.ok) generationStatus = 'repaired';
          } catch {
            // fall through to deterministic fallback
          }
        }
        if (!genCheck.ok) {
          generationContent = buildJobContextGenerationFallback({
            locale: resolvedLocale,
            gender: gender || '',
            position,
            industry: industry || 'general',
            isPresent: isPresentRole,
          });
          generationStatus = 'fallback';
        }
        if (_freeUserId) recordFreeAction(_freeUserId, 'bullets');
        return jsonResponse({
          result: generationContent,
          cvFidelityStatus: generationStatus,
          repairAttempted: generationRepairAttempted,
          fallbackUsed: generationStatus === 'fallback',
          usedFactIds: [],
          violationCount: 0,
          operationMode: 'generate_from_job_context',
          providerFailureReason,
          repairFailureReason,
        });
      }

      let bulletsRepairStartedAt: number | null = null;
      let bulletsRepairFinishedAt: number | null = null;
      const bulletsFallbackStartedAt = Date.now();
      const activated = await activateCvExperienceBullets({
        locale: resolvedLocale,
        gender: gender || '',
        experienceIndex: 0,
        factSet,
        candidate: aiResult,
        isPresent: isPresentRole,
        deadlineAt,
        allowDeterministicFallback: !noopRepairRequested,
        repair: !noopRepairRequested && !bulletsForceRespond
          ? async (prompt) => {
              bulletsRepairStartedAt = Date.now();
              try {
                const repaired = await callWithRetry({
                  model: MODEL,
                  max_tokens: 450,
                  temperature: 0.2,
                  stream: false,
                  system: `You repair CV bullets in ${localeInfo.languageName}. Preserve every material duty and fact ID. Restore any missing duty categories listed in the repair note. Remove unsupported invented duties (e.g. material storage when source only has workplace hygiene) and any meta/grounding wording. Use the required employment tense and gender. Output only clean "•" CV lines — no explanations.`,
                  messages: [{ role: 'user', content: prompt }],
                }, deadlineAt);
                bulletsRepairFinishedAt = Date.now();
                return getText(repaired);
              } catch (repairErr) {
                bulletsRepairFinishedAt = Date.now();
                if (isProviderAbortOrTimeoutError(repairErr)) {
                  repairFailureReason = 'repair_attempt_timeout';
                }
                throw repairErr;
              }
            }
          : undefined,
      });
      const bulletsFallbackFinishedAt = Date.now();

      logAiServerRequestTiming({
        requestId: typeof requestId === 'string' ? requestId : null,
        action: 'bullets_generate',
        requestedLocale: resolvedLocale,
        serverReceivedAt,
        providerStartedAt,
        providerFinishedAt,
        providerValid: activated.status === 'passed',
        providerAborted,
        providerFailureReason,
        repairAttempted: activated.repairAttempted,
        repairFailureReason,
        repairSkippedReason: hasCanonical && !activated.repairAttempted && activated.status !== 'passed'
          ? (bulletsForceRespond ? 'response_guard_or_provider_abort' : 'insufficient_deadline_budget')
          : null,
        repairStartedAt: bulletsRepairStartedAt,
        repairFinishedAt: bulletsRepairFinishedAt,
        fallbackStartedAt: activated.status === 'fallback' ? bulletsFallbackStartedAt : null,
        fallbackFinishedAt: activated.status === 'fallback' ? bulletsFallbackFinishedAt : null,
        serverRespondedAt: Date.now(),
        deadlineAt,
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log('[AI Improvements API]', {
          industry,
          level,
          locale,
          resultLength: activated.content.length,
          cvFidelityStatus: activated.status,
          factCount: canonicalBullets.length,
        });
      }
      if (activated.blocked || activated.status === 'blocked' || !activated.content.trim()) {
        if (shouldForceRespond(deadlineAt)) {
          return jsonResponse({
            error: 'AI request timed out.',
            code: 'request_timeout',
            cvFidelityStatus: 'blocked',
            repairAttempted: activated.repairAttempted,
            fallbackUsed: activated.fallbackUsed,
            usedFactIds: canonicalBullets.map((b) => b.id),
            violationCount: activated.violations.length,
          }, { status: 504 });
        }
        const emergencyLocalized = deterministicLocalizedBulletsFromCanonical(
          canonicalBullets,
          resolvedLocale,
          gender || '',
          { isPresent: isPresentRole },
        ).trim();
        const emergencyPredicateTruth = sourceRequiresGenericExperiencePredicates(sourceDescription)
          ? scanGenericExperiencePredicates(sourceDescription, emergencyLocalized)
          : null;
        const emergencySourcePreserving = Boolean(emergencyLocalized)
          && (!emergencyPredicateTruth
            || (emergencyPredicateTruth.sourceUnitPredicateCoveragePassed
              && emergencyPredicateTruth.candidateAddedPredicateCount === 0));
        if (emergencySourcePreserving) {
          if (_freeUserId) recordFreeAction(_freeUserId, 'bullets');
          return jsonResponse({
            result: emergencyLocalized,
            cvFidelityStatus: 'fallback',
            repairAttempted: activated.repairAttempted,
            fallbackUsed: true,
            usedFactIds: canonicalBullets.map((b) => b.id),
            violationCount: activated.violations.length,
            providerFailureReason,
            repairFailureReason,
          });
        }
        return jsonResponse({
          error: `Could not produce valid localized bullets for ${resolvedLocale}. English canonical text was not written into the CV.`,
          cvFidelityStatus: 'blocked',
          repairAttempted: activated.repairAttempted,
          fallbackUsed: activated.fallbackUsed,
          usedFactIds: canonicalBullets.map((b) => b.id),
          violationCount: activated.violations.length,
        }, { status: 422 });
      }
      if (_freeUserId) recordFreeAction(_freeUserId, 'bullets');
      return jsonResponse({
        result: activated.content,
        cvFidelityStatus: activated.status,
        repairAttempted: activated.repairAttempted,
        fallbackUsed: activated.fallbackUsed,
        providerPhase: activated.providerPhase,
        usedFactIds: canonicalBullets.map((b) => b.id),
        violationCount: activated.violations.length,
      });
    }

    return jsonResponse({ error: 'Unknown action', code: 'generation_validation_failed' }, { status: 400 });
  } catch (err) {
    if (err instanceof CoverLetterGenerationIncompleteError) {
      return jsonResponse(
        { error: err.message, code: 'generation_validation_failed' },
        { status: 502 },
      );
    }
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[AI Generate Error]', errorMessage);
    if (err instanceof Error && err.stack) {
      console.error('[AI Generate Error Stack]', err.stack);
    }
    const classified = classifyProviderError(err);
    console.info('[ai-diagnostics]', JSON.stringify({
      timestamp: Date.now(),
      httpStatus: classified.status,
      applicationErrorCode: classified.code,
      providerStatus: classified.providerStatus,
      retryAfterSec: classified.retryAfter,
    }));
    return jsonResponse(
      {
        error: classified.code === 'provider_rate_limited'
          ? 'AI provider rate limit reached. Please try again shortly.'
          : classified.code === 'provider_auth_error'
            ? 'AI provider authentication failed.'
            : classified.code === 'provider_credit_exhausted'
              ? 'AI provider credits are exhausted.'
              : classified.code === 'request_timeout'
                ? 'AI request timed out.'
                : 'AI provider is temporarily unavailable. Please try again in a moment.',
        code: classified.code,
        retryAfter: classified.retryAfter,
        providerStatus: classified.providerStatus,
      },
      {
        status: classified.status,
        headers: classified.retryAfter
          ? { 'Retry-After': String(classified.retryAfter) }
          : undefined,
      },
    );
  }
}
