import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import { generateBulletsOffline, type BulletIndustry, type BulletLevel } from '@/lib/ai-bullets';
import { DEFAULT_LOCALE, type Locale, resolveLocaleCandidate } from '@/lib/i18n/translations';
import { sanitizeField, sanitizeText } from '@/lib/input-sanitizer';
import { resolveCorsOrigin, buildCorsHeaders, handleOptions } from '@/lib/cors';

// ─── Rate limiter (in-memory, per-IP) ─────────────────────────────────────────
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

/**
 * Verify that an HMAC-signed Pro token is valid.
 * Returns true if the token matches the expected signature and has not expired.
 */
function verifyProToken(token: string | undefined | null): boolean {
  if (!token) return false;
  if (!PRO_SIGNING_KEY) return false; // no key configured → treat all as non-Pro

  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return false;

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    const { exp, isPro } = decoded as { exp?: number; isPro?: boolean };

    // Explicitly verify isPro is exactly true — do not grant access if missing,
    // false, or malformed
    if (isPro !== true) return false;

    // Check expiration
    if (exp && Date.now() >= exp) return false;

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', PRO_SIGNING_KEY)
      .update(payload)
      .digest('base64url');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
  } catch {
    return false;
  }
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
    nativeQualityNote: 'Write as a native English-speaking professional. Use standard British or American business English. Avoid overly formal or robotic phrasing.',
  },
  'pt-BR': {
    languageName: 'Portuguese (Brazil)', fallbackCandidate: 'a pessoa candidata', fallbackRole: 'a vaga', fallbackCompany: 'a empresa', coverLetterName: 'Seu nome', closing: 'Atenciosamente',
    toneMap: { formal: 'formal e profissional', confident: 'confiante e assertivo', friendly: 'caloroso e próximo' },
    nativeQualityNote: 'Escreva como um profissional nativo do Brasil. Use português brasileiro natural e fluente, com vocabulário de negócios adequado. Evite traduções literais do inglês. Use "liderou", "desenvolveu", "implementou" como verbos de ação. Nunca misture inglês no texto.',
  },
  de: {
    languageName: 'German', fallbackCandidate: 'die bewerbende Person', fallbackRole: 'die Position', fallbackCompany: 'das Unternehmen', coverLetterName: 'Ihr Name', closing: 'Mit freundlichen Grüßen',
    toneMap: { formal: 'formell und professionell', confident: 'selbstbewusst und überzeugend', friendly: 'warm und persönlich' },
    nativeQualityNote: 'Schreiben Sie wie ein Muttersprachler im deutschen Geschäftsumfeld. Verwenden Sie natürliche, professionelle Formulierungen aus deutschen Lebensläufen (Lebenslauf-Stil). Bevorzugen Sie deutsche Fachbegriffe. Niemals englische Begriffe einfügen, außer für etablierte Abkürzungen wie CRM, ERP, KPI. Starke Verben: "leitete", "entwickelte", "optimierte", "koordinierte".',
  },
  es: {
    languageName: 'Spanish', fallbackCandidate: 'la persona candidata', fallbackRole: 'el puesto', fallbackCompany: 'la empresa', coverLetterName: 'Tu nombre', closing: 'Atentamente',
    toneMap: { formal: 'formal y profesional', confident: 'seguro y convincente', friendly: 'cercano y amable' },
    nativeQualityNote: 'Escribe como un profesional nativo de habla hispana. Usa español profesional natural, con terminología de negocio estándar. Verbos de acción fuertes: "lideró", "desarrolló", "implementó", "coordinó", "gestionó". Evita calcos del inglés. Nunca mezcles inglés en el texto salvo siglas estándar como CRM, ERP.',
  },
  fr: {
    languageName: 'French', fallbackCandidate: 'la personne candidate', fallbackRole: 'le poste', fallbackCompany: "l'entreprise", coverLetterName: 'Votre nom', closing: 'Cordialement',
    toneMap: { formal: 'formel et professionnel', confident: 'sûr de soi et affirmé', friendly: 'chaleureux et accessible' },
    nativeQualityNote: "Rédigez comme un professionnel francophone natif. Utilisez un français professionnel naturel avec un vocabulaire commercial courant en France. Verbes d'action forts : a dirigé, a développé, a mis en oeuvre, a coordonné. Évitez les calques de l'anglais et ne mélangez jamais l'anglais sauf pour les acronymes standard comme CRM, ERP.",
  },
  it: {
    languageName: 'Italian', fallbackCandidate: 'la persona candidata', fallbackRole: 'il ruolo', fallbackCompany: "l'azienda", coverLetterName: 'Il tuo nome', closing: 'Cordiali saluti',
    toneMap: { formal: 'formale e professionale', confident: 'sicuro e deciso', friendly: 'cordiale e umano' },
    nativeQualityNote: "Scrivi come un professionista italiano madrelingua. Usa un italiano professionale naturale con terminologia aziendale corrente. Verbi d'azione forti: ha guidato, ha sviluppato, ha implementato, ha coordinato, ha gestito. Evita i calchi dall'inglese e non mescolare mai l'inglese, ad eccezione di acronimi standard come CRM, ERP.",
  },
  ar: {
    languageName: 'Arabic', fallbackCandidate: 'المرشح', fallbackRole: 'الوظيفة', fallbackCompany: 'الشركة', coverLetterName: 'اسمك', closing: 'مع خالص التحية',
    toneMap: { formal: 'رسمي واحترافي', confident: 'واثق وحازم', friendly: 'ودود وقريب' },
    nativeQualityNote: 'اكتب بأسلوب محترف عربي سليم، كما يكتبه متحدث عربي أصلي. استخدم مصطلحات الأعمال العربية الأصيلة بدلاً من التعريب الحرفي من الإنجليزية. أفعال قوية: "قاد"، "طوّر"، "نفّذ"، "نسّق"، "أدار"، "أشرف". لا تستخدم كلمات إنجليزية مدرجة داخل الجملة العربية إلا للاختصارات المعروفة مثل CRM وERP. اكتب باللغة العربية الفصحى المهنية.',
  },
  sr: {
    languageName: 'Serbian', fallbackCandidate: 'kandidat', fallbackRole: 'poziciju', fallbackCompany: 'kompaniju', coverLetterName: 'Vaše ime', closing: 'Srdačno',
    toneMap: { formal: 'formalan i profesionalan', confident: 'samouveren i odlučan', friendly: 'topao i pristupačan' },
    nativeQualityNote: 'Piši kao izvorni govornik srpskog jezika u profesionalnom kontekstu. Koristi prirodan, fluidan srpski poslovni jezik. Jaki glagoli radnje: "vodio/la", "razvio/la", "implementirao/la", "koordinirao/la", "upravljao/la". Nikada ne umeći engleske reči u srpski tekst osim standardnih skraćenica (CRM, ERP, KPI). Koristiti latinicu.',
  },
  hr: {
    languageName: 'Croatian', fallbackCandidate: 'kandidat', fallbackRole: 'poziciju', fallbackCompany: 'tvrtku', coverLetterName: 'Vaše ime', closing: 'Srdačan pozdrav',
    toneMap: { formal: 'formalan i profesionalan', confident: 'samouvjeren i odlučan', friendly: 'topao i pristupačan' },
    nativeQualityNote: 'Piši kao izvorni govornik hrvatskog jezika u profesionalnom kontekstu. Koristi prirodan, tečan hrvatski poslovni jezik. Jaki glagoli radnje: "vodio/la", "razvio/la", "implementirao/la", "koordinirao/la", "upravljao/la". Nikada ne umetaj engleske riječi u hrvatski tekst osim standardnih kratica (CRM, ERP, KPI). Koristiti latinicu.',
  },
  ru: {
    languageName: 'Russian', fallbackCandidate: 'кандидат', fallbackRole: 'позицию', fallbackCompany: 'компанию', coverLetterName: 'Ваше имя', closing: 'С уважением',
    toneMap: { formal: 'формальный и профессиональный', confident: 'уверенный и убедительный', friendly: 'доброжелательный и открытый' },
    nativeQualityNote: 'Пишите как носитель русского языка в профессиональном контексте. Используйте естественный деловой русский язык. Сильные глаголы действия: «руководил», «разработал», «внедрил», «координировал», «управлял», «оптимизировал». Никогда не вставляйте английские слова в русский текст, кроме устоявшихся аббревиатур (CRM, ERP, KPI). Не используйте формы «(а)» — определите род из контекста или сформулируйте нейтрально.',
  },
  hi: {
    languageName: 'Hindi', fallbackCandidate: 'उम्मीदवार', fallbackRole: 'पद', fallbackCompany: 'कंपनी', coverLetterName: 'आपका नाम', closing: 'सादर',
    toneMap: { formal: 'औपचारिक और पेशेवर', confident: 'आत्मविश्वासी और प्रभावशाली', friendly: 'सौम्य और आत्मीय' },
    nativeQualityNote: 'शुद्ध और स्वाभाविक हिंदी में लिखें जैसा कोई हिंदी-भाषी पेशेवर लिखता है। व्यावसायिक हिंदी शब्दावली का उपयोग करें। मजबूत क्रिया शब्द: "नेतृत्व किया", "विकसित किया", "क्रियान्वित किया", "समन्वय किया", "प्रबंधन किया"। अंग्रेज़ी शब्दों का हिंदी में अनुलिपि (transliteration) न करें — जैसे "नेगोशिएशन" की जगह "वार्तालाप" या "बातचीत" लिखें। CRM, ERP जैसे प्रचलित संक्षिप्त रूप स्वीकार्य हैं।',
  },
  ja: {
    languageName: 'Japanese', fallbackCandidate: '候補者', fallbackRole: '職種', fallbackCompany: '企業', coverLetterName: 'お名前', closing: '敬具',
    toneMap: { formal: 'フォーマルで丁寧', confident: '自信があり説得力のある', friendly: '親しみやすく温かい' },
    nativeQualityNote: '日本語ネイティブのビジネスパーソンとして記述してください。職務経歴書・履歴書で実際に使われる自然な日本語ビジネス表現を使用してください。力強い動詞：「主導した」「開発した」「実装した」「調整した」「管理した」「改善した」。英単語を日本語の文中に混在させないこと（CRM、ERP などの定着した略語は可）。カタカナ語は最小限にし、適切な日本語表現を優先してください。',
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
 * Returns a gender instruction clause to append to AI prompts for languages
 * that require grammatical gender agreement (Serbian, Croatian).
 * For other languages returns an empty string.
 */
function getGenderInstruction(locale: string, gender: string): string {
  const genderLocales = ['sr', 'hr'];
  if (!genderLocales.includes(locale)) return '';

  if (gender === 'male') {
    return ' VAŽNO: Subjekt je MUŠKI. Koristi ISKLJUČIVO muške glagolske i pridevske oblike kroz ceo tekst (npr. "Vodio sam", "Razvio sam", "Radio sam", "Bio sam", "Sarađivao sam", "Upravljao sam"). NIKADA ne koristi kombinovane oblike kao "Vodio/la", "radio/la", "bio/la". Svaki glagol mora biti u muškom rodu.';
  }
  if (gender === 'female') {
    return ' VAŽNO: Subjekt je ŽENSKI. Koristi ISKLJUČIVO ženske glagolske i pridevske oblike kroz ceo tekst (npr. "Vodila sam", "Razvila sam", "Radila sam", "Bila sam", "Sarađivala sam", "Upravljala sam"). NIKADA ne koristi kombinovane oblike kao "Vodio/la", "radio/la", "bio/la". Svaki glagol mora biti u ženskom rodu.';
  }
  // No gender selected — use neutral/nominalized structures
  return ' Pol nije poznat. Koristi neutralne imeničke i gerundske strukture bez ličnih glagolskih oblika (npr. "Vođenje projekata", "Razvoj sistema", "Upravljanje timom", "Koordinacija aktivnosti"). NIKADA ne koristi kombinovane oblike kao "Vodio/la", "radio/la", "bio/la".';
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
    const isPro = verifyProToken(proToken);

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
          { error: 'Pro subscription required for AI features.' },
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
      const personalEmail = sanitizeField(params.personalEmail, 200);
      const personalPhone = sanitizeField(params.personalPhone, 100);
      const resolvedLocale = normalizeLocale(locale);
      const localeInfo = localeInstructions[resolvedLocale];

      // Use provided name strictly — never fall back to placeholder strings when name exists
      const candidateName = (typeof personalName === 'string' ? personalName.trim() : '') || '';
      const displayName = candidateName || localeInfo.fallbackCandidate;
      // Header name line: only use candidateName if available, otherwise empty (we won't show placeholder in header)
      const headerName = candidateName || '';

      const toneDesc = localeInfo.toneMap[(tone as 'formal' | 'confident' | 'friendly') || 'formal'] || localeInfo.toneMap.formal;
      const variantNote = variant && variant > 0
        ? ' Use a different opening and structure than the standard version.'
        : '';
      const genderNote = getGenderInstruction(resolvedLocale, gender || '');

      const response = await callWithRetry({
        model: MODEL,
        max_tokens: 480,
        temperature: 0.8,
        stream: false,
        system: `You are an expert cover letter writer who creates authentic, human-sounding cover letters in ${localeInfo.languageName}.
Rules:
- Plain text only. No markdown. No bullet points.
- Do NOT wrap output in quotation marks — output the letter text directly.
- Write naturally and professionally, as a real person would.
- Do NOT use fake or invented numbers, percentages, or metrics unless clearly implied by the job title.
- Focus on genuine motivation, relevant skills, and fit for the role.
- Keep sentences concise. Avoid corporate jargon and filler phrases.
- NEVER use placeholder names like "Your Name", "the candidate", "Candidate", or equivalent in any language. Always use the actual name provided.
- When referring to the job title inside the letter, use the natural ${localeInfo.languageName} equivalent of the title (e.g. if the letter is in Arabic and the job title is "Software Engineer", write "مهندس برمجيات"; if Hindi, write "सॉफ्टवेयर इंजीनियर"). If the title is already in the target language, keep it as-is.
- LANGUAGE QUALITY: ${localeInfo.nativeQualityNote}`,
        messages: [
          {
            role: 'user',
            content: `Write a cover letter in ${localeInfo.languageName} for ${displayName} applying for ${jobTitle || localeInfo.fallbackRole} at ${companyName || localeInfo.fallbackCompany}.
Tone: ${toneDesc}.${variantNote}${genderNote}
Structure: greeting, 3 short paragraphs (motivation + relevant experience / key skills / enthusiasm for company), closing with "${localeInfo.closing},\n${displayName}".
The closing signature MUST use "${displayName}" — never a placeholder.
Localize the job title naturally into ${localeInfo.languageName} when mentioning it in the letter body.
Plain text only. Under 280 words. Output the letter only. Do not wrap in quotation marks.`,
          },
        ],
      });

      const letterBody = getText(response);
      const dateStr = new Date().toLocaleDateString(resolvedLocale, { year: 'numeric', month: 'long', day: 'numeric' });

      // Build header: only include lines that have real content
      const headerLines: string[] = [];
      if (headerName) headerLines.push(headerName);
      if (personalEmail && typeof personalEmail === 'string' && personalEmail.trim()) headerLines.push(personalEmail.trim());
      if (personalPhone && typeof personalPhone === 'string' && personalPhone.trim()) headerLines.push(personalPhone.trim());

      const headerBlock = headerLines.length > 0 ? headerLines.join('\n') + '\n\n' : '';
      const fullLetter = `${headerBlock}${dateStr}\n\n${letterBody}`;

      if (_freeUserId) recordFreeAction(_freeUserId, action === 'cover-letter' ? 'cover-letter-gen' : action);
      return jsonResponse({ result: fullLetter });
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

Plain text only. No quotation marks anywhere. Output the summary only — nothing else.${genderNote}`,
          },
        ],
      });

      const rawText = getText(response);
      const cleanedText = rawText
        .trim()
        .replace(/^[\s"""''«»„\u201C\u201D\u2018\u2019\u00AB\u00BB]+/, '')
        .replace(/[\s"""''«»„\u201C\u201D\u2018\u2019\u00AB\u00BB]+$/, '');
      if (_freeUserId) recordFreeAction(_freeUserId, 'summary');
      return jsonResponse({ result: cleanedText });
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
        max_tokens: 180,
        temperature: 0.65,
        stream: false,
        system: `You are a professional CV editor. Rewrite text per the given instructions in ${localeInfo.languageName}.
Rules:
- Output only the rewritten text, nothing else.
- Do NOT wrap output in quotation marks of any kind.
- Keep the meaning intact while improving quality.
- Do NOT invent numbers, metrics, or percentages that are not in the original text.
- Do NOT use vague invented metrics like "by 44%" or "11 hours" unless they appear in the original.
- Focus on responsibilities, collaboration, and qualitative improvements — not fabricated numbers.
- Sound natural and human, not templated or robotic.
- Use 3–4 concise bullet points or short sentences. Avoid long, repetitive, or overly corporate phrasing.
- LANGUAGE QUALITY: ${localeInfo.nativeQualityNote}`,
        messages: [
          {
            role: 'user',
            content: `${styleMap[style] || styleMap.professional}${genderNote}\n\nText: ${text}`,
          },
        ],
      });

      return jsonResponse({ result: getText(response) || text });
    }

    if (action === 'bullets') {
      const { industry, level, locale, gender } = params;
      const position = sanitizeField(params.position, 500);
      const company = sanitizeField(params.company, 500);
      const resolvedLocale = normalizeLocale(locale);
      const localeInfo = localeInstructions[resolvedLocale];
      const companyName = company || localeInfo.fallbackCompany;

      // If no API key, fall back to offline templates
      if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
        const offlineResult = generateBulletsOffline(
          (industry || 'general') as BulletIndustry,
          (level || 'mid') as BulletLevel,
          companyName,
          resolvedLocale,
        );
        if (_freeUserId) recordFreeAction(_freeUserId, 'bullets');
        return jsonResponse({ result: offlineResult });
      }

      const genderNote = getGenderInstruction(resolvedLocale, gender || '');

      const levelDescriptions: Record<string, string> = {
        entry: 'entry-level or junior',
        mid: 'mid-level',
        senior: 'senior',
        lead: 'lead or managerial',
      };

      // Industry-specific context hints to guide more relevant AI output
      const industryContextHints: Record<string, string> = {
        tech: 'Use specific technologies: programming languages, frameworks, cloud platforms, dev tools. Mention real engineering activities like code reviews, deployments, architecture, debugging.',
        data_ai: 'Reference tools like Python, SQL, Spark, ML frameworks, BI platforms. Mention real data activities: pipelines, model training, dashboards, analysis, experimentation.',
        cybersecurity: 'Reference security tools, threat categories, compliance frameworks. Mention real activities: incident response, penetration testing, vulnerability management, SIEM, access control.',
        sales_retail: 'Reference retail activities: serving customers on the floor, POS systems, upselling, stock management, visual merchandising, targets. Avoid vague corporate language.',
        sales_b2b: 'Reference B2B activities: prospecting, pipeline management, CRM, deal closing, account management, negotiations, demos. Use specific targets and outcomes.',
        sales: 'Reference specific sales activities: pipeline management, CRM tools, prospecting, negotiations, account management, quota attainment.',
        marketing: 'Reference specific channels and tools: SEO, Google Ads, email campaigns, social media, analytics platforms, content creation, campaign results.',
        finance: 'Reference finance tools and activities: financial modelling, Excel, ERP, month-end close, budgeting, reporting, audit, variance analysis.',
        banking_fintech: 'Reference banking and fintech-specific activities: KYC, AML, credit analysis, payment systems, regulatory compliance, portfolio management, open banking.',
        healthcare: 'Reference clinical activities: patient care, assessments, documentation, multidisciplinary teams, clinical protocols, patient safety. Keep language professional and accurate.',
        pharmacy: 'Reference pharmacy activities: dispensing, patient counselling, drug interactions, controlled drugs, stock management, clinical audits, pharmacy law compliance.',
        education: 'Reference teaching activities: lesson planning, curriculum delivery, student assessment, classroom management, differentiation, parent communication, CPD.',
        human_resources: 'Reference HR activities: recruitment, onboarding, performance management, ER cases, policy development, payroll, engagement surveys, compliance.',
        customer_service: 'Reference support activities: handling enquiries, complaints, ticketing systems, KPIs like CSAT and FCR, escalation, CRM tools, SLA adherence.',
        logistics: 'Reference logistics activities: shipment coordination, WMS, inventory management, carrier management, customs compliance, OTIF, route optimisation.',
        operations: 'Reference operational activities: process improvement, KPI reporting, capacity planning, quality control, vendor management, operational efficiency initiatives.',
        executive: 'Reference leadership activities: P&L management, board reporting, strategic planning, stakeholder management, change programmes, team building.',
        project_management: 'Reference PM activities: project planning, risk registers, stakeholder communication, budget management, Agile/PRINCE2, governance, delivery milestones.',
        design: 'Reference design tools and activities: Figma, user research, usability testing, design systems, prototyping, accessibility, design sprints.',
        engineering: 'Reference engineering activities: CAD design, testing, FEA, component qualification, project delivery, technical documentation, standards compliance.',
        construction: 'Reference construction activities: site management, programme scheduling, subcontractor management, NEC/JCT contracts, RAMS, health and safety, RFIs.',
        hospitality: 'Reference hospitality activities: guest service, F&B operations, housekeeping standards, revenue management, reservations, events coordination.',
        legal: 'Reference legal activities: drafting, due diligence, litigation, regulatory compliance, contract negotiation, client management, legal research.',
        administration: 'Reference admin activities: diary management, document processing, event coordination, office management, supplier liaison, data entry, compliance.',
        general: 'Use professional, role-appropriate language. Reference realistic tasks and responsibilities for the position described.',
      };

      const industryHint = industryContextHints[(industry as string) ?? 'general'] || industryContextHints.general;

      const levelDesc = levelDescriptions[level || 'mid'] || 'mid-level';
      const roleLabel = position ? `${position}` : `${industry || 'professional'}`;
      const atCompany = companyName && companyName !== localeInfo.fallbackCompany ? ` at ${companyName}` : '';

      const response = await callWithRetry({
        model: MODEL,
        max_tokens: 450,
        temperature: 0.65,
        stream: false,
        system: `You are an expert CV writer creating work experience bullet points in ${localeInfo.languageName}.
Rules:
- Output ONLY bullet points, each starting with "•"
- Each bullet: exactly 1 sentence, clear and direct, under 22 words
- Be SPECIFIC to the job title, seniority level, and industry — name real tools, systems, tasks, and outcomes for this exact profession
- Use strong action verbs in past tense appropriate to the role
- NO generic phrases like "improved processes", "worked with team", "participated in projects", "contributed to company success"
- NO fake metrics or invented percentages — omit numbers unless the role clearly involves measurable outcomes
- NO filler words, no long explanations
- Professional but natural — sound like a real person describing real work, not a template
- Match the seniority: entry = assisted/supported/contributed; mid = led/managed/built; senior/lead = directed/defined/oversaw
- CRITICAL LANGUAGE RULE: Every word must be in ${localeInfo.languageName}. NEVER mix in English words, English phrases, or English transliterations mid-sentence. Translate tools and concepts natively where a native term exists. Only keep universally accepted technical acronyms (CRM, ERP, KPI, SQL, API) if they are genuinely used in that language.${genderNote}
- LANGUAGE QUALITY: ${localeInfo.nativeQualityNote}
Industry context: ${industryHint}`,
        messages: [
          {
            role: 'user',
            content: `Write 4 CV work experience bullet points in ${localeInfo.languageName} for a ${levelDesc} ${roleLabel}${atCompany}.

Each bullet must describe a specific, realistic task or achievement for this exact role and industry. Use industry-specific language, tools, and terminology.

Output format: one bullet per line, each starting with "•". Nothing else.`,
          },
        ],
      });

      const aiResult = getText(response);

      // Validate we got bullets; fall back to offline if response looks bad
      if (!aiResult || !aiResult.includes('•')) {
        const offlineResult = generateBulletsOffline(
          (industry || 'general') as BulletIndustry,
          (level || 'mid') as BulletLevel,
          companyName,
          resolvedLocale,
        );
        if (_freeUserId) recordFreeAction(_freeUserId, 'bullets');
        return jsonResponse({ result: offlineResult });
      }

      if (_freeUserId) recordFreeAction(_freeUserId, 'bullets');
      if (process.env.NODE_ENV !== 'production') console.log('[AI Improvements API]', { industry, level, locale, resultLength: aiResult.length });
      return jsonResponse({ result: aiResult });
    }

    return jsonResponse({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
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
