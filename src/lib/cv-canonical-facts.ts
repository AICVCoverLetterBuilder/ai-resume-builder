/**
 * Canonical CV professional facts — one source of truth for all locales.
 * Localized outputs may rephrase grammar, never invent new duties or claims.
 */
import type { CVData, Education, WorkExperience } from './types';
import type { Locale } from './i18n/translations';
import {
  captureUserGroundingBeforeAi,
  ensureExperienceAiAuthoritativeSource,
  freezeExperienceAiAuthoritativeDescription,
  resolveExperienceGroundingDescription,
} from './cv-experience-provenance';
import {
  matchesGraphicDesignerOccupationalTitle,
  matchesWarehouseOccupationalTitle,
} from './cv-role-title';

export type CvFactType =
  | 'summary'
  | 'employer'
  | 'role'
  | 'dates'
  | 'experience_bullet'
  | 'skill'
  | 'language_name'
  | 'language_level'
  | 'education_degree'
  | 'education_school'
  | 'education_dates'
  | 'education_description'
  | 'certification'
  | 'identity'
  | 'job_title';

/** Stable semantic buckets used to reject meaning-replacement across locales. */
export type CvDutyCategory =
  | 'beverage_service'
  | 'hygiene_safety'
  | 'customer_service_guest_relationship'
  | 'inventory_stock'
  | 'food_preparation'
  | 'generic';

export type CvCanonicalFact = {
  id: string;
  type: CvFactType;
  value: string;
  source: string;
  /** Original source text for experience bullets (same as value when built from canonical). */
  sourceText?: string;
  category?: CvDutyCategory;
  order?: number;
  experienceIndex?: number;
  bulletIndex?: number;
};

export type CvCanonicalFactSet = {
  facts: CvCanonicalFact[];
  localeHint?: Locale | string;
  isSparse: boolean;
};

/**
 * Split a work-experience description into duty units.
 * Supports real Android/editor textarea formats:
 * - newline-separated bullets
 * - inline `• duty • duty`
 * - leading hyphen/asterisk bullets
 * - semicolon-separated duties (when they look like separate sentences)
 * Does not split inside dates (1.1.2022), decimals, or bare company tokens.
 */
export function splitExperienceBullets(description: string): string[] {
  if (!description?.trim()) return [];
  const normalized = description
    .replace(/\uFEFF/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  const stripPrefix = (line: string) =>
    line.replace(/^[•\-\*\u2022\u25CF\u25E6]\s*/, '').trim();

  const fromLines: string[] = [];
  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    // Inline bullet glyphs: "• a. • b." or "a. • b."
    if (/[•\u2022\u25CF]/.test(line)) {
      const parts = line
        .split(/\s*[•\u2022\u25CF]\s+/)
        .map((p) => stripPrefix(p).trim())
        .filter(Boolean);
      if (parts.length > 1) {
        fromLines.push(...parts);
        continue;
      }
    }
    fromLines.push(stripPrefix(line));
  }

  // Semicolon-separated multi-duty lines (avoid splitting abbreviations like "Inc.;")
  const expanded: string[] = [];
  for (const unit of fromLines) {
    if (
      /;\s+/.test(unit)
      && /[a-zA-Zа-яА-ЯčćžšđČĆŽŠĐ\u0900-\u097F]{4,}.{8,};\s+[A-ZČĆŽŠĐ\u0400-\u04FF\u0900-\u097F]/.test(unit)
    ) {
      const semis = unit
        .split(/;\s+/)
        .map((p) => stripPrefix(p).trim())
        .filter((p) => p.length > 12);
      if (semis.length > 1) {
        expanded.push(...semis);
        continue;
      }
    }
    if (unit) expanded.push(unit);
  }

  // Sentence-separated duties in one textarea block (common on Android when
  // newlines are lost): "Duty one. Duty two. Duty three."
  // Do not split decimals/dates (1.1.2022) or trailing elaborations that start
  // with filler capitals ("Extended operational coverage…").
  const looksLikeStandaloneDuty = (text: string): boolean => {
    const t = text.trim();
    if (t.length < 20) return false;
    if (/^(Extended|Additional|Including|Across|With\s+precise|Item\s+\d|Coverage\s+item)/iu.test(t)) {
      return false;
    }
    return true;
  };
  const sentenced: string[] = [];
  for (const unit of expanded) {
    // `\s*` allows Android concatenated duties with no space after periods.
    const parts = unit
      .split(/(?<=[.!?।])\s*(?=[A-ZČĆŽŠĐА-ЯЁІЇЄĞÜÖÄ\u0900-\u097F])/u)
      .map((p) => stripPrefix(p).trim())
      .filter((p) => p.length > 8);
    if (parts.length > 1 && parts.every(looksLikeStandaloneDuty)) {
      sentenced.push(...parts);
      continue;
    }
    if (unit) sentenced.push(unit);
  }

  return sentenced.filter(Boolean);
}

export function formatExperienceBullets(bullets: string[], bulletPrefix = '• '): string {
  return bullets.map((b) => `${bulletPrefix}${b.replace(/^[•\-\*\u2022]\s*/, '').trim()}`).join('\n');
}

export function classifyDutyCategory(text: string): CvDutyCategory {
  const t = text.toLowerCase().normalize('NFKC');
  if (
    /\b(guest|guests|customer|customers|rapport|gost|gosti|gostima|klijent|клиент|грах|ग्राहक|客|ضيف|clientes?)\b/iu.test(t)
    || /attentive customer|building rapport|built rapport|uslugu gost/iu.test(t)
  ) {
    return 'customer_service_guest_relationship';
  }
  // Stem match: Serbian "higijenske/higijena" must not require an exact word-boundary end.
  // Prefer hygiene over inventory when both storage and hygiene appear in one duty.
  // Hindi/Arabic/CJK tokens must stay outside `\b(...)` — JS word boundaries are ASCII-only.
  if (
    /\b(hygiene|safety|clean|organised|organized|čist|cist|higijen\w*|санитар\w*)/iu.test(t)
    || /bar area|standarde higijen|food[- ]?safet|bezbednost\s+hran|sigurnost\s+hran/iu.test(t)
    || /स्वच्छ|साफ|衛生|نظاف/u.test(t)
  ) {
    return 'hygiene_safety';
  }
  if (
    /\b(inventory|stock|supply|zalih|inventar|снабжен|запас|स्टॉक|在庫|مخزون|replenish|dopun)/iu.test(t)
    || /\bskladišt\w*/iu.test(t)
  ) {
    return 'inventory_stock';
  }
  // Cooking / food preparation (not beverage) — before beverage so "jela/kuhinja" wins.
  if (
    /\b(dish(?:es)?|cuisine|kitchen|menu|recipe|cook(?:ing|ed)?|food\s*prep|restaurant\s+standard)/iu.test(t)
    || /\b(jel\w*|kuhinj\w*|kuhar\w*|namirnic\w*|mediteransk\w*|srpsk\w*\s+i\s+mediteransk)/iu.test(t)
    || /priprem\w*.{0,40}(jel|hran|namirnic|obrok)/iu.test(t)
    || /organiz\w*.{0,40}(priprem|radni\s+prostor|workstation)/iu.test(t)
    || /sara[dđ]\w*.{0,40}(kuhinj|kitchen|koleg)/iu.test(t)
    || /भोजन|पकवान|खाना|व्यंजन|तैयार|रसोई|रेस्तरां|रेस्तراँ|طبخ|料理/u.test(t)
  ) {
    return 'food_preparation';
  }
  // "prepared/served/priprema/…" alone are generic verbs used across many unrelated
  // duties (e.g. "prepared reports", "priprema izveštaja") — only beverage-classify
  // when an actual drink/beverage noun is present in the text.
  if (
    /\b(cocktail|cocktails|spirit|spirits|beverage|beverages|drink|drinks|koktel\w*|коктейл|पेय|飲料|مشروب|pić\w*|napi(?:tak|tka|će|ci))\b/iu.test(t)
  ) {
    return 'beverage_service';
  }
  return 'generic';
}

/** Multilingual anchors that must remain for each duty category. */
// Note: avoid \\b for non-Latin scripts — JS word boundaries are ASCII-centric.
export const DUTY_CATEGORY_PRESENCE: Record<Exclude<CvDutyCategory, 'generic'>, RegExp> = {
  beverage_service:
    /(cocktail|koktel|cóctel|coquetel|кокт|напит|कॉकटेल|कोकटेल|पेय|飲料|مشروب|كوكتيل|bebida|getränk|spirit|spirituosen|beverage|drink|pić|napit)/iu,
  hygiene_safety:
    /(hygiene|higijen|гигиен|безопасност|safety|bezbednost|sigurnost|clean|чист|čist|cist|organiz|organis|bar area|higij|साफ|स्वच्छ|衛生|نظاف|sicherheit|igiene|higiene|food[- ]?safet|ingredient.?stor)/iu,
  customer_service_guest_relationship:
    /(guest|gäst|gost|гост|customer|kunden|klijen|клиент|rapport|odnos|ग्राहक|अतिथि|客|ضيف|ضيوف|client|huésp|ospiti|atenti|uslug|zahtev|žalb|reklamacij)/iu,
  inventory_stock:
    /(inventory|stock|zalih|inventar|inventur|supply|запас|снаб|स्टॉक|इन्वेंट|在庫|مخزون|invent|beständ|inventaire|conteggio|scorte|estoque|Bestände|niveau|skladišt|ingredient|namirnic|freshness)/iu,
  food_preparation:
    /(dish(?:es)?|cuisine|kitchen|küche|küchen|gerichte|essens|menu|recipe|cook|food\s*prep|restaurant|jel\w*|kuhinj\w*|namirnic\w*|mediterr|mediterranean|serbian\s+and|srpsk|priprem\w*|zubereit|plat|plato|piatto|кухн|طبخ|भोजन|व्यंजन|तैयार|रसोई|रेस्तराँ|料理|prépar|kolleg|colleagues|servis|service|workstation|arbeitsplatz|posto de|poste de)/iu,
};

/** Phrases that replace guest service with teammate cooperation (not equivalent). */
export const GUEST_DUTY_REPLACEMENT = /\b(colleagu|koleg|saradnik|saradn|коллег|सहकर्मी|busy period|gužv|peak (?:hour|period)|zajedno sa kolegama)\b/iu;

/** Recipe claims often invented by hospitality localization. */
export const RECIPE_INVENTION = /\b(standard|custom|standardn|prilagođen).{0,40}(recip|recept)|receptur|signature recip/iu;

function push(
  facts: CvCanonicalFact[],
  fact: Omit<CvCanonicalFact, 'value'> & { value: string },
): void {
  const value = fact.value.trim();
  if (!value) return;
  facts.push({ ...fact, value });
}

function experienceSourceDescription(exp: WorkExperience): string {
  const grounded = resolveExperienceGroundingDescription(exp).trim();
  const live = (exp.description || '').trim();
  const role = (exp.position || '').trim();
  if (!live || !grounded || live === grounded) return grounded || live;

  // EN-only stale Atlas/Rewitu discard: when the same entry id was reused for a
  // new free-text role, never keep English warehouse/design triad canonical as
  // Summary source-of-truth. Do not touch non-English grounded corpora.
  // Use full occupational title matchers (FR Employée d'entrepôt, ES almacén, …)
  // — a narrow English-only role regex falsely discarded EN warehouse canonical
  // under localized warehouse titles when live Experience was HR/foreign.
  const roleLooksWarehouse = matchesWarehouseOccupationalTitle(role);
  const roleLooksDesign = matchesGraphicDesignerOccupationalTitle(role);
  const groundedEnWarehouseTriad = /incoming\s+goods/iu.test(grounded)
    && /(?:related\s+documentation|documentation\s+related)/iu.test(grounded)
    && /(?:colleague|preparation\s+and\s+movement)/iu.test(grounded);
  const liveEnWarehouseTriad = /incoming\s+goods/iu.test(live)
    && /(?:related\s+documentation|documentation\s+related)/iu.test(live)
    && /(?:colleague|preparation\s+and\s+movement)/iu.test(live);
  const liveLooksEnglishReplacement = /[A-Za-z]{4,}/.test(live)
    && !/[čćžšđČĆŽŠĐ]/.test(live)
    && !/[\u0400-\u04FF\u0900-\u097F\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF]/.test(live);
  if (
    !roleLooksWarehouse
    && groundedEnWarehouseTriad
    && !liveEnWarehouseTriad
    && liveLooksEnglishReplacement
  ) {
    return live;
  }
  const groundedEnDesignTriad = /visual\s+materials/iu.test(grounded)
    && /design\s+(?:materials?|files?)/iu.test(grounded);
  const liveEnDesignTriad = /visual\s+materials/iu.test(live)
    && /design\s+(?:materials?|files?)/iu.test(live);
  if (
    !roleLooksDesign
    && !roleLooksWarehouse
    && groundedEnDesignTriad
    && !liveEnDesignTriad
    && liveLooksEnglishReplacement
  ) {
    return live;
  }
  return grounded || live;
}

export function buildCvCanonicalFactSet(
  cv: Pick<CVData, 'personal' | 'summary' | 'experience' | 'education' | 'skills' | 'certifications' | 'languages'> & {
    canonicalSummary?: string;
  },
  options?: { localeHint?: Locale | string; preferCanonicalFields?: boolean },
): CvCanonicalFactSet {
  const facts: CvCanonicalFact[] = [];
  const preferCanonical = options?.preferCanonicalFields !== false;
  const summaryValue = preferCanonical
    ? (cv.canonicalSummary || cv.summary || '')
    : (cv.summary || '');

  push(facts, {
    id: 'identity-0',
    type: 'identity',
    value: cv.personal?.fullName ?? '',
    source: 'cv.personal.fullName',
  });
  push(facts, {
    id: 'job-title-0',
    type: 'job_title',
    value: cv.personal?.jobTitle ?? '',
    source: 'cv.personal.jobTitle',
  });
  push(facts, {
    id: 'summary-0',
    type: 'summary',
    value: summaryValue,
    source: preferCanonical && cv.canonicalSummary ? 'cv.canonicalSummary' : 'cv.summary',
  });

  (cv.experience ?? []).forEach((exp, experienceIndex) => {
    push(facts, {
      id: `experience-${experienceIndex}-employer`,
      type: 'employer',
      value: exp.company ?? '',
      source: `cv.experience[${experienceIndex}].company`,
      experienceIndex,
    });
    push(facts, {
      id: `experience-${experienceIndex}-role`,
      type: 'role',
      value: exp.position ?? '',
      source: `cv.experience[${experienceIndex}].position`,
      experienceIndex,
    });
    const dates = [exp.startDate, exp.isPresent ? 'present' : exp.endDate].filter(Boolean).join(' – ');
    push(facts, {
      id: `experience-${experienceIndex}-dates`,
      type: 'dates',
      value: dates,
      source: `cv.experience[${experienceIndex}].dates`,
      experienceIndex,
    });
    const sourceDescription = experienceSourceDescription(exp);
    splitExperienceBullets(sourceDescription).forEach((bullet, bulletIndex) => {
      const category = classifyDutyCategory(bullet);
      push(facts, {
        id: `experience-${experienceIndex}-bullet-${bulletIndex}`,
        type: 'experience_bullet',
        value: bullet,
        sourceText: bullet,
        category,
        order: bulletIndex,
        source: exp.canonicalDescription
          ? `cv.experience[${experienceIndex}].canonicalDescription[${bulletIndex}]`
          : `cv.experience[${experienceIndex}].description[${bulletIndex}]`,
        experienceIndex,
        bulletIndex,
      });
    });
  });

  (cv.skills ?? []).forEach((skill, idx) => {
    push(facts, {
      id: `skill-${idx}`,
      type: 'skill',
      value: skill,
      source: `cv.skills[${idx}]`,
    });
  });

  (cv.languages ?? []).forEach((lang, idx) => {
    push(facts, {
      id: `language-${idx}-name`,
      type: 'language_name',
      value: lang.name ?? '',
      source: `cv.languages[${idx}].name`,
    });
    push(facts, {
      id: `language-${idx}-level`,
      type: 'language_level',
      value: lang.level ?? '',
      source: `cv.languages[${idx}].level`,
    });
  });

  (cv.education ?? []).forEach((edu, idx) => {
    push(facts, {
      id: `education-${idx}-degree`,
      type: 'education_degree',
      value: edu.degree ?? '',
      source: `cv.education[${idx}].degree`,
    });
    push(facts, {
      id: `education-${idx}-school`,
      type: 'education_school',
      value: edu.school ?? '',
      source: `cv.education[${idx}].school`,
    });
    const eduDates = [edu.startDate, edu.endDate].filter(Boolean).join(' – ');
    push(facts, {
      id: `education-${idx}-dates`,
      type: 'education_dates',
      value: eduDates,
      source: `cv.education[${idx}].dates`,
    });
    push(facts, {
      id: `education-${idx}-description`,
      type: 'education_description',
      value: edu.description ?? '',
      source: `cv.education[${idx}].description`,
    });
  });

  (cv.certifications ?? []).forEach((cert, idx) => {
    push(facts, {
      id: `certification-${idx}`,
      type: 'certification',
      value: cert,
      source: `cv.certifications[${idx}]`,
    });
  });

  const professional = facts.filter((f) =>
    ['experience_bullet', 'summary', 'skill', 'employer', 'role'].includes(f.type),
  );
  return {
    facts,
    localeHint: options?.localeHint,
    isSparse: professional.length < 2,
  };
}

export function bulletsForExperience(
  factSet: CvCanonicalFactSet,
  experienceIndex: number,
): CvCanonicalFact[] {
  return factSet.facts
    .filter((f) => f.type === 'experience_bullet' && f.experienceIndex === experienceIndex)
    .sort((a, b) => (a.bulletIndex ?? 0) - (b.bulletIndex ?? 0));
}

export function buildFactSetFromExperienceDescription(
  description: string,
  meta?: {
    experienceIndex?: number;
    company?: string;
    position?: string;
    startDate?: string;
    endDate?: string;
    isPresent?: boolean;
  },
): CvCanonicalFactSet {
  const experienceIndex = meta?.experienceIndex ?? 0;
  const experience: WorkExperience = {
    id: `exp-${experienceIndex}`,
    company: meta?.company ?? '',
    position: meta?.position ?? '',
    startDate: meta?.startDate ?? '',
    endDate: meta?.endDate ?? '',
    isPresent: Boolean(meta?.isPresent),
    description,
    canonicalDescription: description,
  };
  // Pad leading empty experiences so forEach indices match the real experienceIndex.
  // Otherwise bullets are tagged experience-0 and bulletsForExperience(…, n>0) returns none.
  const padded: WorkExperience[] = Array.from({ length: experienceIndex }, (_, i) => ({
    id: `exp-pad-${i}`,
    company: '',
    position: '',
    startDate: '',
    endDate: '',
    isPresent: false,
    description: '',
    canonicalDescription: '',
  }));
  padded.push(experience);
  return buildCvCanonicalFactSet({
    personal: { fullName: '', email: '', phone: '', address: '', jobTitle: '' },
    summary: '',
    experience: padded,
    education: [] as Education[],
    skills: [],
    certifications: [],
    languages: [],
  });
}

export function formatCanonicalBulletsForPrompt(
  bullets: CvCanonicalFact[],
): string {
  if (!bullets.length) return '(none — do not invent duties)';
  return bullets
    .map((b) => `- [${b.id}] category=${b.category || 'generic'} :: ${b.sourceText || b.value}`)
    .join('\n');
}

export function deterministicBulletsFromCanonical(
  bullets: CvCanonicalFact[],
): string {
  if (!bullets.length) return '';
  return formatExperienceBullets(bullets.map((b) => b.sourceText || b.value));
}

/**
 * Resolve grounding duties for AI requests / fact sets.
 * Never returns AI-generated display text when user/canonical sources exist.
 *
 * @deprecated For Experience AI request/finalize use
 * `freezeExperienceAiAuthoritativeDescription` so live user edits beat stale canonical.
 * Kept for export / snapshot callers that still need classic canonical priority.
 */
export function freezeCanonicalExperienceDescription(
  exp: Pick<
    WorkExperience,
    'description' | 'canonicalDescription' | 'originalUserDescription' | 'descriptionOrigin'
  >,
): string {
  return resolveExperienceGroundingDescription(exp);
}

/**
 * Experience AI FACT-LOCK text: live user-edited textarea wins over stale canonical.
 */
export function freezeExperienceAiDescription(
  exp: WorkExperience,
): string {
  return freezeExperienceAiAuthoritativeDescription(exp);
}

/**
 * Capture user grounding before AI Improvements.
 * Never promotes AI-generated description into canonical/original storage.
 */
export function ensureCanonicalExperienceFrozen(
  exp: WorkExperience,
): WorkExperience {
  return captureUserGroundingBeforeAi(exp);
}

/**
 * Prepare an experience row for Experience AI: capture provenance, then shadow
 * grounding to the authoritative live/user source for this request.
 */
export function ensureExperienceAiSourceFrozen(
  exp: WorkExperience,
): WorkExperience {
  return ensureExperienceAiAuthoritativeSource(captureUserGroundingBeforeAi(exp));
}
