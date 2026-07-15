/**
 * Deterministic locale-bound fallbacks for CV fact IDs.
 * Never emits English when requestedLocale !== 'en'.
 */
import type { Locale } from './i18n/translations';
import type { CoverLetterGender } from './cover-letter-gender';
import { normalizeCoverLetterGender } from './cover-letter-gender';
import {
  classifyDutyCategory,
  formatExperienceBullets,
  type CvCanonicalFact,
  type CvCanonicalFactSet,
  type CvDutyCategory,
} from './cv-canonical-facts';
import {
  formatApproximateDurationPhrase,
  type ExperienceDuration,
} from './cv-experience-duration';

type GenderTone = 'male' | 'female' | 'neutral';

function tone(gender?: CoverLetterGender | string): GenderTone {
  const g = normalizeCoverLetterGender(gender);
  if (g === 'male') return 'male';
  if (g === 'female') return 'female';
  return 'neutral';
}

/** Per-locale, category-bound bullet shells that preserve duty meaning. */
const BULLET_BY_CATEGORY: Record<
  Locale,
  Record<Exclude<CvDutyCategory, 'generic'>, (g: GenderTone) => string>
> = {
  en: {
    beverage_service: () =>
      'Prepared and served a wide variety of cocktails, spirits, and beverages.',
    hygiene_safety: () =>
      'Maintained a clean and organised bar area and hygiene/safety standards.',
    customer_service_guest_relationship: () =>
      'Provided attentive customer service and built rapport with guests.',
    inventory_stock: () =>
      'Managed stock levels, assisted with inventory counts, and communicated supply needs to management.',
  },
  de: {
    beverage_service: () =>
      'Zubereitung und Ausschenken einer großen Auswahl an Cocktails, Spirituosen und Getränken.',
    hygiene_safety: () =>
      'Saubere und organisierte Barkfläche sowie Hygiene- und Sicherheitsstandards eingehalten.',
    customer_service_guest_relationship: () =>
      'Aufmerksamen Kundenservice geleistet und eine gute Beziehung zu den Gästen aufgebaut.',
    inventory_stock: () =>
      'Bestände verwaltet, bei Inventurzählungen unterstützt und Bedarf an das Management gemeldet.',
  },
  es: {
    beverage_service: () =>
      'Preparé y serví una amplia variedad de cócteles, licores y bebidas.',
    hygiene_safety: () =>
      'Mantuve limpia y organizada el área de la barra y las normas de higiene y seguridad.',
    customer_service_guest_relationship: () =>
      'Ofrecí un servicio atento a los clientes y construí rapport con los huéspedes.',
    inventory_stock: () =>
      'Gestioné niveles de inventario, apoyé conteos de stock y comuniqué necesidades al management.',
  },
  fr: {
    beverage_service: () =>
      'Préparer et servir une large variété de cocktails, spiritueux et boissons.',
    hygiene_safety: () =>
      'Maintenir un bar propre et organisé ainsi que les normes d’hygiène et de sécurité.',
    customer_service_guest_relationship: () =>
      'Assurer un service client attentif et instaurer une relation de confiance avec les clients.',
    inventory_stock: () =>
      'Gérer les stocks, assister aux inventaires et communiquer les besoins à la direction.',
  },
  it: {
    beverage_service: () =>
      'Prepara e serve un’ampia varietà di cocktail, distillati e bevande.',
    hygiene_safety: () =>
      'Mantiene l’area del bancone pulita e organizzata e gli standard di igiene e sicurezza.',
    customer_service_guest_relationship: () =>
      'Fornisce un servizio clienti attento e costruisce un buon rapporto con gli ospiti.',
    inventory_stock: () =>
      'Gestisce i livelli di scorte, supporta gli inventari e comunica le esigenze alla direzione.',
  },
  ar: {
    beverage_service: () =>
      'إعداد وتقديم مجموعة واسعة من الكوكتيلات والمشروبات الروحية والمشروبات.',
    hygiene_safety: () =>
      'الحفاظ على منطقة البار نظيفة ومنظمة وعلى معايير النظافة والسلامة.',
    customer_service_guest_relationship: () =>
      'تقديم خدمة عملاء منتبهة وبناء علاقة جيدة مع الضيوف.',
    inventory_stock: () =>
      'إدارة مستويات المخزون والمساعدة في جرد المخزون وإبلاغ الإدارة باحتياجات التوريد.',
  },
  sr: {
    beverage_service: (g) =>
      g === 'male'
        ? 'Pripremao sam i služio širok spektar koktela, žestokih pića i napitaka.'
        : 'Pripremala sam i služila širok spektar koktela, žestokih pića i napitaka.',
    hygiene_safety: (g) =>
      g === 'male'
        ? 'Održavao sam čist i organizovan prostor šanka uz standarde higijene i bezbednosti.'
        : 'Održavala sam čist i organizovan prostor šanka uz standarde higijene i bezbednosti.',
    customer_service_guest_relationship: (g) =>
      g === 'male'
        ? 'Pružao sam pažljivu uslugu gostima i gradio odnos poverenja sa klijentima.'
        : 'Pružala sam pažljivu uslugu gostima i gradila odnos poverenja sa klijentima.',
    inventory_stock: (g) =>
      g === 'male'
        ? 'Upravljao sam nivoima zaliha, pomagao pri inventaru i javljao potrebe snabdevanja menadžmentu.'
        : 'Upravljala sam nivoima zaliha, pomagala pri inventaru i javljala potrebe snabdevanja menadžmentu.',
  },
  hr: {
    beverage_service: (g) =>
      g === 'male'
        ? 'Pripremao sam i posluživao širok spektar koktela, žestokih pića i napitaka.'
        : 'Pripremala sam i posluživala širok spektar koktela, žestokih pića i napitaka.',
    hygiene_safety: (g) =>
      g === 'male'
        ? 'Održavao sam čist i organiziran prostor šanka uz standarde higijene i sigurnosti.'
        : 'Održavala sam čist i organiziran prostor šanka uz standarde higijene i sigurnosti.',
    customer_service_guest_relationship: (g) =>
      g === 'male'
        ? 'Pružao sam pažljivu uslugu gostima i gradio odnos povjerenja s klijentima.'
        : 'Pružala sam pažljivu uslugu gostima i gradila odnos povjerenja s klijentima.',
    inventory_stock: (g) =>
      g === 'male'
        ? 'Upravljao sam razinama zaliha, pomagao pri inventuri i javljao potrebe nabave menadžmentu.'
        : 'Upravljala sam razinama zaliha, pomagala pri inventuri i javljala potrebe nabave menadžmentu.',
  },
  ru: {
    beverage_service: (g) =>
      g === 'male'
        ? 'Готовил и подавал широкий ассортимент коктейлей, крепких напитков и других напитков.'
        : 'Готовила и подавала широкий ассортимент коктейлей, крепких напитков и других напитков.',
    hygiene_safety: (g) =>
      g === 'male'
        ? 'Поддерживал чистоту и порядок на барной стойке, соблюдая стандарты гигиены и безопасности.'
        : 'Поддерживала чистоту и порядок на барной стойке, соблюдая стандарты гигиены и безопасности.',
    customer_service_guest_relationship: (g) =>
      g === 'male'
        ? 'Оказывал внимательное обслуживание гостей и выстраивал доверительные отношения с клиентами.'
        : 'Оказывала внимательное обслуживание гостей и выстраивала доверительные отношения с клиентами.',
    inventory_stock: (g) =>
      g === 'male'
        ? 'Управлял уровнем запасов, помогал с инвентаризацией и сообщал о потребностях снабжения руководству.'
        : 'Управляла уровнем запасов, помогала с инвентаризацией и сообщала о потребностях снабжения руководству.',
  },
  'pt-BR': {
    beverage_service: () =>
      'Preparei e servi uma ampla variedade de coquetéis, destilados e bebidas.',
    hygiene_safety: () =>
      'Mantive a área do bar limpa e organizada e os padrões de higiene e segurança.',
    customer_service_guest_relationship: () =>
      'Prestei atendimento atento aos clientes e construí rapport com os hóspedes.',
    inventory_stock: () =>
      'Gerenciei níveis de estoque, apoiei contagens de inventário e comuniquei necessidades à gestão.',
  },
  hi: {
    beverage_service: () =>
      'विभिन्न प्रकार के कॉकटेल, स्पिरिट्स और पेय तैयार करके परोसे।',
    hygiene_safety: () =>
      'बार क्षेत्र को साफ़ और व्यवस्थित रखा तथा स्वच्छता और सुरक्षा मानकों का पालन किया।',
    customer_service_guest_relationship: () =>
      'अतिथियों को ध्यानपूर्वक सेवा दी और ग्राहकों के साथ अच्छा संबंध बनाया।',
    inventory_stock: () =>
      'स्टॉक स्तरों का प्रबंधन किया, इन्वेंटरी गणना में सहायता की और प्रबंधन को आपूर्ति आवश्यकताएँ बताईं।',
  },
  ja: {
    beverage_service: () =>
      '多様なカクテル、スピリッツ、飲料を調製し提供した。',
    hygiene_safety: () =>
      'バーエリアを清潔で整理整頓された状態に保ち、衛生・安全基準を維持した。',
    customer_service_guest_relationship: () =>
      '丁寧なお客様対応を行い、ゲストとの信頼関係を築いた。',
    inventory_stock: () =>
      '在庫水準を管理し、棚卸しを支援し、補充ニーズをマネジメントへ伝えた。',
  },
};

const SUMMARY_SHELL: Record<Locale, (role: string, duties: string, g: GenderTone, durationPhrase?: string) => string> = {
  en: (role, duties, _g, durationPhrase) =>
    durationPhrase
      ? `${role || 'Professional'} ${durationPhrase}. ${duties}`.trim()
      : `${role || 'Professional'} with relevant experience. ${duties}`.trim(),
  de: (role, duties, _g, durationPhrase) =>
    durationPhrase
      ? `${role || 'Fachkraft'} ${durationPhrase}. ${duties}`.trim()
      : `${role || 'Fachkraft'} mit relevanter Berufserfahrung. ${duties}`.trim(),
  es: (role, duties, _g, durationPhrase) =>
    durationPhrase
      ? `${role || 'Profesional'} ${durationPhrase}. ${duties}`.trim()
      : `${role || 'Profesional'} con experiencia relevante. ${duties}`.trim(),
  fr: (role, duties, _g, durationPhrase) =>
    durationPhrase
      ? `${role || 'Professionnel(le)'} ${durationPhrase}. ${duties}`.trim()
      : `${role || 'Professionnel(le)'} avec une expérience pertinente. ${duties}`.trim(),
  it: (role, duties, _g, durationPhrase) =>
    durationPhrase
      ? `${role || 'Professionista'} ${durationPhrase}. ${duties}`.trim()
      : `${role || 'Professionista'} con esperienza pertinente. ${duties}`.trim(),
  ar: (role, duties, _g, durationPhrase) =>
    durationPhrase
      ? `${role || 'محترف'} ${durationPhrase}. ${duties}`.trim()
      : `${role || 'محترف'} ذو خبرة ذات صلة. ${duties}`.trim(),
  sr: (role, duties, g, durationPhrase) =>
    g === 'male'
      ? (durationPhrase
        ? `${role || 'Profesionalac'} ${durationPhrase}. ${duties}`.trim()
        : `${role || 'Profesionalac'} sa relevantnim iskustvom. ${duties}`.trim())
      : (durationPhrase
        ? `${role || 'Profesionalka'} ${durationPhrase}. ${duties}`.trim()
        : `${role || 'Profesionalka'} sa relevantnim iskustvom. ${duties}`.trim()),
  hr: (role, duties, g, durationPhrase) =>
    g === 'male'
      ? (durationPhrase
        ? `${role || 'Profesionalac'} ${durationPhrase}. ${duties}`.trim()
        : `${role || 'Profesionalac'} s relevantnim iskustvom. ${duties}`.trim())
      : (durationPhrase
        ? `${role || 'Profesionalka'} ${durationPhrase}. ${duties}`.trim()
        : `${role || 'Profesionalka'} s relevantnim iskustvom. ${duties}`.trim()),
  ru: (role, duties, g, durationPhrase) =>
    g === 'male'
      ? (durationPhrase
        ? `${role || 'Специалист'} ${durationPhrase}. ${duties}`.trim()
        : `${role || 'Специалист'} с релевантным опытом. ${duties}`.trim())
      : (durationPhrase
        ? `${role || 'Специалистка'} ${durationPhrase}. ${duties}`.trim()
        : `${role || 'Специалистка'} с релевантным опытом. ${duties}`.trim()),
  'pt-BR': (role, duties, _g, durationPhrase) =>
    durationPhrase
      ? `${role || 'Profissional'} ${durationPhrase}. ${duties}`.trim()
      : `${role || 'Profissional'} com experiência relevante. ${duties}`.trim(),
  hi: (role, duties, _g, durationPhrase) =>
    durationPhrase
      ? `${role || 'पेशेवर'} ${durationPhrase}। ${duties}`.trim()
      : `${role || 'पेशेवर'} के पास प्रासंगिक अनुभव है। ${duties}`.trim(),
  ja: (role, duties, _g, durationPhrase) =>
    durationPhrase
      ? `${role || 'プロフェッショナル'}${durationPhrase}。${duties}`.trim()
      : `${role || 'プロフェッショナル'}として関連経験があります。${duties}`.trim(),
};

function localizeRoleLabel(role: string, locale: Locale, g: GenderTone): string {
  const raw = (role || '').trim();
  if (!raw) return '';
  if (/bartender/i.test(raw)) {
    const map: Partial<Record<Locale, string>> = {
      en: 'Bartender',
      de: g === 'female' ? 'Bartenderin' : 'Bartender',
      es: g === 'female' ? 'Bartendera' : 'Bartender',
      fr: g === 'female' ? 'Barmaid' : 'Barman',
      it: 'Bartender',
      ar: g === 'female' ? 'نادلة البار' : 'نادل البار',
      sr: 'Barmen',
      hr: 'Barmen',
      ru: 'Бармен',
      'pt-BR': 'Bartender',
      hi: 'बारटेंडर',
      ja: 'バーテンダー',
    };
    return map[locale] || raw;
  }
  // Avoid injecting raw English job titles into locales with gendered forms that would fail validation.
  if (locale !== 'en' && /^[A-Za-z][A-Za-z\s/&'’.-]{0,60}$/.test(raw)) {
    return '';
  }
  return raw;
}

function localizedBulletForFact(
  fact: CvCanonicalFact,
  locale: Locale,
  gender?: CoverLetterGender | string,
): string {
  const g = tone(gender);
  const category = fact.category || classifyDutyCategory(fact.sourceText || fact.value);
  if (category === 'generic') {
    if (locale === 'en') return (fact.sourceText || fact.value).trim();
    // Non-English: cannot claim a safe translation for unknown duties — force block upstream.
    return '';
  }
  const table = BULLET_BY_CATEGORY[locale] || BULLET_BY_CATEGORY.en;
  return table[category](g).trim();
}

export function deterministicLocalizedBulletsFromCanonical(
  facts: CvCanonicalFact[],
  locale: Locale,
  gender?: CoverLetterGender | string,
): string {
  if (!facts.length) return '';
  const lines = facts.map((f) => localizedBulletForFact(f, locale, gender));
  if (lines.some((l) => !l.trim())) return '';
  return formatExperienceBullets(lines);
}

export function deterministicLocalizedSummaryFromCanonical(
  factSet: CvCanonicalFactSet,
  locale: Locale,
  gender?: CoverLetterGender | string,
  duration?: ExperienceDuration,
): string {
  const g = tone(gender);
  const rawRole = factSet.facts.find((f) => f.type === 'job_title')?.value
    || factSet.facts.find((f) => f.type === 'role')?.value
    || '';
  const role = localizeRoleLabel(rawRole, locale, g);
  const bullets = factSet.facts
    .filter((f) => f.type === 'experience_bullet')
    .slice(0, 4)
    .map((f) => localizedBulletForFact(f, locale, gender).replace(/[.。۔।]\s*$/u, ''));
  if (bullets.some((b) => !b.trim())) return '';
  const duties = bullets.join(locale === 'ja' ? '。' : locale === 'hi' ? '। ' : '. ');
  const shell = SUMMARY_SHELL[locale] || SUMMARY_SHELL.en;
  const durationPhrase = duration?.hasValidDates
    ? formatApproximateDurationPhrase(duration, locale)
    : '';
  let text = shell(role, duties, g, durationPhrase || undefined).replace(/\s+/g, ' ').trim();
  if (locale === 'hi' && !/[।.!?…]\s*$/u.test(text)) text = `${text}।`;
  else if (!/[.!?…।۔]\s*$/u.test(text)) text = `${text}.`;
  return text;
}

/** True when exported text is essentially an English canonical dump into a non-English locale. */
export function isEnglishCanonicalDump(
  exported: string,
  canonicalSource: string,
  requestedLocale: Locale,
  options?: { canonicalLocale?: Locale },
): boolean {
  if (requestedLocale === 'en') return false;
  // Same-locale identity is valid when the canonical source is that locale (Serbian-first, etc.).
  if (options?.canonicalLocale && options.canonicalLocale === requestedLocale) return false;

  const norm = (s: string) =>
    s
      .normalize('NFKC')
      .replace(/^[•\-\*\u2022]\s*/gm, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  const a = norm(exported);
  const b = norm(canonicalSource);

  const localeAnchors: Partial<Record<Locale, RegExp>> = {
    de: /\b(Cocktail|Gästen|Hygiene|Inventur|Bestände)\b/i,
    es: /\b(cócteles|huéspedes|higiene|inventario)\b/i,
    fr: /\b(cocktails|clients|hygiène|inventaires|stocks)\b/i,
    it: /\b(cocktail|ospiti|igiene|scorte|inventari)\b/i,
    sr: /\b(koktel|gost|higijen|zalih|šank|inventar)\b/i,
    hr: /\b(koktel|gosti|higijen|zalih|šanka|inventur)\b/i,
    'pt-BR': /\b(coquetéis|hóspedes|higiene|estoque|inventário)\b/i,
  };
  const englishAnchors =
    /\b(prepared and served|maintained a clean|provided attentive|managed stock|cocktails, spirits|inventory counts)\b/i;

  if (a && b && a === b) {
    // Identical to source: only an English dump when the source is English.
    const sourceLocale = options?.canonicalLocale;
    if (sourceLocale && sourceLocale !== 'en') return false;
    if (sourceLocale === 'en') return true;
    // No provenance: identical text is OK when it carries requested-locale anchors / script.
    if (requestedLocale === 'hi' && /[\u0900-\u097F]/.test(exported)) return false;
    if (requestedLocale === 'ar' && /[\u0600-\u06FF]/.test(exported)) return false;
    if (requestedLocale === 'ja' && /[\u3040-\u30ff\u3400-\u9fff]/.test(exported)) return false;
    if (requestedLocale === 'ru' && /[\u0400-\u04FF]/.test(exported)) return false;
    const localeRe = localeAnchors[requestedLocale];
    if (localeRe && localeRe.test(exported) && !englishAnchors.test(exported)) return false;
    // Diacritic / lexicon evidence that the identical source is already in the requested locale.
    if ((requestedLocale === 'sr' || requestedLocale === 'hr') && /[čćžšđČĆŽŠĐ]/u.test(exported)) return false;
    if (requestedLocale === 'de' && /[äöüÄÖÜß]/u.test(exported) && !englishAnchors.test(exported)) return false;
    if (requestedLocale === 'fr' && /[àâçéèêëîïôùûüÿœæ]/iu.test(exported) && !englishAnchors.test(exported)) return false;
    if (requestedLocale === 'es' && /[áéíóúñ¿¡]/iu.test(exported) && !englishAnchors.test(exported)) return false;
    if (requestedLocale === 'it' && /[àèéìòù]/iu.test(exported) && !englishAnchors.test(exported)) return false;
    if (requestedLocale === 'pt-BR' && /[áàâãéêíóôõúç]/iu.test(exported) && !englishAnchors.test(exported)) return false;
    // Clear English hospitality dump into a non-English export.
    if (englishAnchors.test(exported)) return true;
    if (/\b(prepared and served|maintained a clean|provided attentive|managed stock)\b/i.test(exported)) {
      return true;
    }
    // Pure ASCII English body with no target-locale markers: treat as English dump
    // (covers generic English duties that cannot localize for sr/de/…).
    if (
      /^[\x00-\x7F•\-\u2022\s.,;:/'"()]+$/u.test(exported)
      && /\b(the|and|for|with|from|experimental|research|protocol|tuned|laboratory|lab)\b/i.test(exported)
    ) {
      return true;
    }
    return false;
  }
  if (!a) return false;

  // Script-based languages: English dump has no target script.
  if (requestedLocale === 'hi' && !/[\u0900-\u097F]/.test(exported)) return true;
  if (requestedLocale === 'ar' && !/[\u0600-\u06FF]/.test(exported)) return true;
  if (requestedLocale === 'ja' && !/[\u3040-\u30ff\u3400-\u9fff]/.test(exported)) return true;
  if (requestedLocale === 'ru' && !/[\u0400-\u04FF]/.test(exported)) return true;

  // Latin locales: English hospitality anchors with no locale service lexicon.
  const localeRe = localeAnchors[requestedLocale];
  if (englishAnchors.test(exported) && localeRe && !localeRe.test(exported)) return true;
  return false;
}
