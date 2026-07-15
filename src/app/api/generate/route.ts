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
  deterministicBulletsFromCanonical,
} from '@/lib/cv-canonical-facts';
import { activateCvExperienceBullets, activateCvSummary } from '@/lib/cv-content-activation';

// ── Rate limiter (in-memory, per-IP) ─────────────────────────────────────────
// Resets on server restart. For production with multiple instances, replace with
// an external store (Upstash Redis, etc.).
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20;  // 20 requests per minute per IP

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function rateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true, retryAfter: 0 };
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
      timeout: 25000,
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

async function callWithRetry(params: Parameters<Anthropic['messages']['create']>[0]): Promise<Anthropic.Messages.Message> {
  const client = getClient();
  try {
    return await client.messages.create(params) as Anthropic.Messages.Message;
  } catch (err) {
    // Retry once on transient errors (network, 5xx, timeout, overloaded)
    const isTransient =
      err instanceof Error &&
      (err.message.includes('timeout') ||
        err.message.includes('ECONNRESET') ||
        err.message.includes('overloaded') ||
        err.message.includes('529') ||
        err.message.includes('503') ||
        err.message.includes('502') ||
        err.message.includes('500'));
    if (isTransient) {
      return await client.messages.create(params) as Anthropic.Messages.Message;
    }
    throw err;
  }
}

function getText(response: Anthropic.Messages.Message): string {
  const block = response.content[0];
  if (block?.type !== 'text') return '';
  // Strip leading/trailing quotation marks (straight and curly)
  return block.text.trim().replace(/^[""\u201C\u201E]+|[""\u201D\u201F]+$/g, '').trim();
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
      { error: 'Content-Type must be application/json.' },
      { status: 415 },
    );
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
  const { allowed, retryAfter } = rateLimit(ip);
  if (!allowed) {
    return jsonResponse(
      { error: `Too many requests. Please try again in ${retryAfter} seconds.` },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  try {
    const body = await req.json();
    const { action, proToken, freeUserId, ...params } = body;

    // ── Pro token verification ──────────────────────────────────────────────
    const isPro = (await verifyProToken(proToken)) !== null;

    // ── Free tier handling ────────────────────────────────────────────
    // Free users are allowed limited AI actions tracked server-side.
    // Actions not in FREE_ACTION_LIMITS (e.g. 'rewrite') are Pro-only.
    // Abuse protection: rate limiting (above) still applies.
    // Map legacy action names to canonical action keys
    const resolvedAction = action === 'cover-letter' ? 'cover-letter-gen' : action;

    let _freeUserId: string | null = null;
    if (!isPro && PRO_SIGNING_KEY) {
      _freeUserId = freeUserId || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
      // Check how many free uses this user has left for this action (NO increment)
      const { allowed } = canUseFreeAction(_freeUserId!, resolvedAction);
      if (!allowed) {
        return jsonResponse(
          { error: 'Pro access required for AI features.' },
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

    if (action === 'summary') {
      const { locale, gender, experienceEntries, skills, languages, education } = params;
      const jobTitle = sanitizeField(params.jobTitle, 500);
      const experienceDuration = sanitizeField(params.experienceDuration, 50);
      const resolvedLocale = normalizeLocale(locale);
      const localeInfo = localeInstructions[resolvedLocale];
      const genderNote = getGenderInstruction(resolvedLocale, gender || '');

      // Build experience context block from real data
      const entries: Array<{ position?: string; company?: string; startDate?: string; endDate?: string; description?: string }> =
        Array.isArray(experienceEntries) ? experienceEntries : [];
      const skillsList: string[] = Array.isArray(skills) ? skills : [];
      const langsList: Array<{ name?: string; level?: string }> = Array.isArray(languages) ? languages : [];
      const eduList: Array<{ degree?: string; school?: string }> = Array.isArray(education) ? education : [];

      // Build duration phrase based on actual calculated duration
      let durationPhrase = '';
      if (experienceDuration === 'practical') {
        durationPhrase = 'IMPORTANT: The candidate has less than 6 months of work experience. Use wording like "with practical experience in" or "with recent hands-on experience as" — never mention years or imply long experience.';
      } else if (experienceDuration === 'under-one-year') {
        durationPhrase = 'IMPORTANT: The candidate has 6–11 months of work experience. Use wording like "with almost one year of experience" — never say "1 year" or more.';
      } else if (experienceDuration && !isNaN(Number(experienceDuration))) {
        const yrs = parseFloat(experienceDuration as string);
        if (yrs < 2) {
          durationPhrase = `IMPORTANT: The candidate has approximately ${yrs} year(s) of work experience. State this accurately (e.g. "over one year" or "around ${yrs} year(s)") — do not round up or inflate.`;
        } else {
          durationPhrase = `IMPORTANT: The candidate has approximately ${yrs} years of work experience. You may state this accurately — do not inflate or invent higher numbers.`;
        }
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

      const response = await callWithRetry({
        model: MODEL,
        max_tokens: 600,
        temperature: 0.75,
        stream: false,
        system: `You are an expert CV writer who creates authentic, human-sounding professional summaries in ${localeInfo.languageName}.
Rules:
- Plain text only. No markdown, no bullet points, no headers, no lists.
- NEVER wrap output in quotation marks of any kind (" " ' ' « » „ " etc.). Output the raw text directly.
- Do NOT start or end with any quote character. The very first character must be a letter.
- Sound like a real professional, not a generic template.
- NEVER invent experience duration, years, or metrics. Use ONLY what is provided in the CV data below.
- NEVER use phrases like "2+ years", "5 years", "extensive experience", "over a decade" unless the calculated duration supports it.
- Do NOT use clichéd openers like "Highly motivated", "Results-driven", "Dynamic professional", "Passionate about", or "Dedicated to".
- Focus on genuine strengths: professional background, core skills, key strengths, work style, and the value the person brings to a team.
- Write in a natural, human tone — professional but warm, not robotic.
- For mobile readability, break the text into 2–3 short paragraphs separated by a blank line.
- FACT LOCK: Use ONLY duties/skills/languages present in the CV data. Never invent allergy checks, muddling, syrups, wastage, kitchen staff, evening shifts, inventory shortages, opening/closing procedures, or other unsupported claims.
- COMPLETENESS: Always finish every sentence. Never stop mid-word, mid-participle, or after a dangling conjunction (especially in Hindi Devanagari).
- PERSPECTIVE: Use one consistent perspective (first person OR third person) throughout — never mix.
- LANGUAGE QUALITY: ${localeInfo.nativeQualityNote}`,
        messages: [
          {
            role: 'user',
            content: `Write a professional summary in ${localeInfo.languageName} for a ${jobTitle || localeInfo.fallbackRole}.

${durationPhrase}${experienceBlock}${skillsBlock}${langsBlock}${eduBlock}

Structure (3–5 sentences, 180–250 words total):
1. Who the candidate is — their role and experience background (use accurate duration wording per the instruction above).
2. Key skills and areas of expertise (reference actual skills if provided).
3. Main strengths, achievements, or contributions (based only on provided description data).
4. Work style, approach, or how they collaborate.
5. (Optional) Career focus or professional goal.

Plain text only. No quotation marks anywhere. Finish the last sentence completely before stopping. Output the summary only — nothing else.${genderNote}`,
          },
        ],
      });

      const rawText = getText(response);
      const cleanedText = rawText
        .trim()
        .replace(/^[\s"""''«»„\u201C\u201D\u2018\u2019\u00AB\u00BB]+/, '')
        .replace(/[\s"""''«»„\u201C\u201D\u2018\u2019\u00AB\u00BB]+$/, '');

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

      const activated = await activateCvSummary({
        locale: resolvedLocale,
        gender: gender || '',
        factSet,
        candidate: cleanedText,
        sourceFactsText,
        fallbackSummary: groundedFallback,
        repair: async (prompt) => {
          const repaired = await callWithRetry({
            model: MODEL,
            max_tokens: 600,
            temperature: 0.3,
            stream: false,
            system: `You rewrite complete CV summaries in ${localeInfo.languageName}. Finish every sentence. Never invent duties. Plain text only.`,
            messages: [{ role: 'user', content: prompt }],
          });
          return getText(repaired)
            .trim()
            .replace(/^[\s"""''«»„\u201C\u201D\u2018\u2019\u00AB\u00BB]+/, '')
            .replace(/[\s"""''«»„\u201C\u201D\u2018\u2019\u00AB\u00BB]+$/, '');
        },
      });

      if (_freeUserId) recordFreeAction(_freeUserId, 'summary');
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

      const styleMap: Record<string, string> = {
        shorter: 'Make it more concise and to the point. Keep only the most important information. 1–2 sentences maximum.',
        stronger: 'Rewrite using strong, active verbs and impactful language. Make it sound confident and results-oriented without inventing fake numbers or metrics.',
        professional: 'Rewrite in a polished, professional tone. Use clear, formal vocabulary without corporate jargon or filler words.',
      };

      const response = await callWithRetry({
        model: MODEL,
        max_tokens: 400,
        temperature: 0.65,
        stream: false,
        system: `You are a professional CV editor. Rewrite text per the given instructions in ${localeInfo.languageName}.
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
            content: `${styleMap[style] || styleMap.professional}${genderNote}\n\nText: ${text}`,
          },
        ],
      });

      const rewritten = getText(response) || text;
      const rewriteFactSet = buildCvCanonicalFactSet({
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
      const activated = await activateCvSummary({
        locale: resolvedLocale,
        gender: gender || '',
        factSet: rewriteFactSet,
        candidate: rewritten,
        sourceFactsText: text,
        fallbackSummary: text,
        repair: async (prompt) => {
          const repaired = await callWithRetry({
            model: MODEL,
            max_tokens: 400,
            temperature: 0.25,
            stream: false,
            system: `You repair CV text in ${localeInfo.languageName}. Keep the same facts. Finish every sentence. Plain text only.`,
            messages: [{ role: 'user', content: prompt }],
          });
          return getText(repaired).trim();
        },
      });

      return jsonResponse({
        result: activated.content || text,
        cvFidelityStatus: activated.status,
        repairAttempted: activated.repairAttempted,
        fallbackUsed: activated.fallbackUsed,
        violationCount: activated.violations.length,
      });
    }

    if (action === 'bullets') {
      const { industry, level, locale, gender } = params;
      const position = sanitizeField(params.position, 500);
      const company = sanitizeField(params.company, 500);
      const sourceDescription = sanitizeText(params.sourceDescription ?? params.description ?? '', 8000);
      const resolvedLocale = normalizeLocale(locale);
      const localeInfo = localeInstructions[resolvedLocale];
      const companyName = company || localeInfo.fallbackCompany;
      const factSet = buildFactSetFromExperienceDescription(sourceDescription, {
        experienceIndex: 0,
        company: companyName,
        position,
      });
      const canonicalBullets = bulletsForExperience(factSet, 0);
      const hasCanonical = canonicalBullets.length > 0;

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
          cvFidelityStatus: hasCanonical ? 'fallback' : 'passed',
          usedFactIds: canonicalBullets.map((b) => b.id),
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
      const factLockNote = hasCanonical
        ? `FACT LOCK: You are given SOURCE BULLETS with stable IDs. Output EXACTLY ${canonicalBullets.length} bullets in the same order. Translate/polish grammar only. Do NOT add, remove, or replace duties. Do NOT invent allergy checks, muddling, syrups, wastage, kitchen cooperation, evening shifts, inventory shortages, or any duty absent from SOURCE BULLETS.`
        : 'No prior bullets were supplied. Write role-appropriate bullets without invented metrics.';

      const response = await callWithRetry({
        model: MODEL,
        max_tokens: 450,
        temperature: hasCanonical ? 0.35 : 0.65,
        stream: false,
        system: `You are an expert CV writer creating work experience bullet points in ${localeInfo.languageName}.
Rules:
- Output ONLY bullet points, each starting with "•"
- Each bullet: exactly 1 sentence, clear and direct, under 22 words
- ${factLockNote}
- NO fake metrics or invented percentages
- CRITICAL LANGUAGE RULE: Every word must be in ${localeInfo.languageName}. Only keep universal acronyms (CRM, ERP, KPI, SQL, API) when genuinely used.${genderNote}
- LANGUAGE QUALITY: ${localeInfo.nativeQualityNote}`,
        messages: [
          {
            role: 'user',
            content: hasCanonical
              ? `Localize the following canonical work bullets into ${localeInfo.languageName} for ${levelDesc} ${roleLabel}${atCompany}.

SOURCE BULLETS:
${formatCanonicalBulletsForPrompt(canonicalBullets)}

Output format: one bullet per line, each starting with "•". Same count and order. Nothing else.`
              : `Write 4 CV work experience bullet points in ${localeInfo.languageName} for a ${levelDesc} ${roleLabel}${atCompany}.

Output format: one bullet per line, each starting with "•". Nothing else.`,
          },
        ],
      });

      let aiResult = getText(response);
      if (!aiResult || !aiResult.includes('•')) {
        aiResult = generateBulletsOffline(
          (industry || 'general') as BulletIndustry,
          (level || 'mid') as BulletLevel,
          companyName,
          resolvedLocale,
          sourceDescription,
        );
      }

      const activated = await activateCvExperienceBullets({
        locale: resolvedLocale,
        gender: gender || '',
        experienceIndex: 0,
        factSet,
        candidate: aiResult,
        repair: hasCanonical
          ? async (prompt) => {
              const repaired = await callWithRetry({
                model: MODEL,
                max_tokens: 450,
                temperature: 0.2,
                stream: false,
                system: `You repair CV bullets in ${localeInfo.languageName}. Preserve fact IDs/duties. Output only "•" lines.`,
                messages: [{ role: 'user', content: prompt }],
              });
              return getText(repaired);
            }
          : undefined,
      });

      if (_freeUserId) recordFreeAction(_freeUserId, 'bullets');
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
      return jsonResponse({
        result: activated.content || deterministicBulletsFromCanonical(canonicalBullets),
        cvFidelityStatus: activated.status,
        repairAttempted: activated.repairAttempted,
        fallbackUsed: activated.fallbackUsed,
        usedFactIds: canonicalBullets.map((b) => b.id),
        violationCount: activated.violations.length,
      });
    }

    return jsonResponse({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    if (err instanceof CoverLetterGenerationIncompleteError) {
      return jsonResponse(
        { error: err.message },
        { status: 502 },
      );
    }
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[AI Generate Error]', errorMessage);
    if (err instanceof Error && err.stack) {
      console.error('[AI Generate Error Stack]', err.stack);
    }
    return jsonResponse(
      { error: 'AI service is temporarily unavailable. Please try again in a moment.' },
      { status: 503 }
    );
  }
}
