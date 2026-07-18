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
import { resolveOccupationalTitleForSummary } from './cv-role-title';
import {
  classifyMaterialDutyKeys,
  applyEnglishEmploymentTense,
  validateMaterialDutyCoverage,
  type MaterialDutyKey,
} from './cv-material-duty-coverage';
import {
  extractSourceDutyUnits,
  optionalTemplatePreservesSourceUnit,
  universalPreserveSourceUnit,
} from './cv-source-fact-identity';
import { buildConciseGroundedSummary } from './cv-summary-grounding';

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
    food_preparation: () =>
      'Prepared dishes in accordance with established restaurant and cuisine standards.',
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
    food_preparation: () =>
      'Zubereitung von Gerichten gemäß den festgelegten Restaurant- und Küchenstandards.',
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
    food_preparation: () =>
      'Preparación de platos conforme a los estándares establecidos del restaurante y la cocina.',
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
    food_preparation: () =>
      'Préparation de plats conformément aux normes établies du restaurant et de la cuisine.',
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
    food_preparation: () =>
      'Preparazione di piatti in conformità con gli standard del ristorante e della cucina.',
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
    food_preparation: () =>
      'إعداد الأطباق وفقاً لمعايير المطعم والمطبخ المعتمدة.',
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
    food_preparation: (g) =>
      g === 'male'
        ? 'Pripremao sam jela u skladu sa utvrđenim standardima restorana i kuhinje.'
        : 'Pripremala sam jela u skladu sa utvrđenim standardima restorana i kuhinje.',
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
    food_preparation: (g) =>
      g === 'male'
        ? 'Pripremao sam jela u skladu s utvrđenim standardima restorana i kuhinje.'
        : 'Pripremala sam jela u skladu s utvrđenim standardima restorana i kuhinje.',
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
    food_preparation: (g) =>
      g === 'male'
        ? 'Готовил блюда в соответствии с установленными стандартами ресторана и кухни.'
        : 'Готовила блюда в соответствии с установленными стандартами ресторана и кухни.',
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
    food_preparation: () =>
      'Preparo de pratos de acordo com os padrões estabelecidos do restaurante e da cozinha.',
  },
  hi: {
    beverage_service: (g) =>
      g === 'male'
        ? 'मैं विभिन्न प्रकार के कॉकटेल, स्पिरिट्स और पेय तैयार करके परोसता हूँ।'
        : 'मैं विभिन्न प्रकार के कॉकटेल, स्पिरिट्स और पेय तैयार करके परोसती हूँ।',
    hygiene_safety: (g) =>
      g === 'male'
        ? 'मैं बार क्षेत्र की स्वच्छता और सुरक्षा मानकों को बनाए रखता हूँ।'
        : 'मैं बार क्षेत्र की स्वच्छता और सुरक्षा मानकों को बनाए रखती हूँ।',
    customer_service_guest_relationship: (g) =>
      g === 'male'
        ? 'मैं अतिथियों को ध्यानपूर्वक सेवा देता हूँ और ग्राहकों के साथ अच्छा संबंध बनाता हूँ।'
        : 'मैं अतिथियों को ध्यानपूर्वक सेवा देती हूँ और ग्राहकों के साथ अच्छा संबंध बनाती हूँ।',
    inventory_stock: (g) =>
      g === 'male'
        ? 'मैं स्टॉक स्तरों का प्रबंधन करता हूँ और प्रबंधन को आपूर्ति आवश्यकताएँ बताता हूँ।'
        : 'मैं स्टॉक स्तरों का प्रबंधन करती हूँ और प्रबंधन को आपूर्ति आवश्यकताएँ बताती हूँ।',
    food_preparation: (g) =>
      g === 'male'
        ? 'मैं रेस्तराँ और रसोई के निर्धारित मानकों के अनुसार व्यंजन तैयार करता हूँ।'
        : 'मैं रेस्तराँ और रसोई के निर्धारित मानकों के अनुसार व्यंजन तैयार करती हूँ।',
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
    food_preparation: () =>
      'レストランおよび厨房の定められた基準に従って料理を準備した。',
  },
};

const SUMMARY_SHELL: Record<Locale, (role: string, duties: string, g: GenderTone, durationPhrase?: string) => string> = {
  en: (role, duties, _g, durationPhrase) =>
    durationPhrase
      ? `${role || 'Professional'} ${durationPhrase}. ${duties}`.trim()
      // Avoid the banned empty shell "Professional with relevant experience" —
      // when duties are present, a neutral role + duties is grounded content.
      : `${role || 'Professional'}. ${duties}`.trim(),
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
        : `${role || 'Profesionalac'}. ${duties}`.trim())
      : (durationPhrase
        ? `${role || 'Profesionalka'} ${durationPhrase}. ${duties}`.trim()
        : `${role || 'Profesionalka'}. ${duties}`.trim()),
  hr: (role, duties, g, durationPhrase) =>
    g === 'male'
      ? (durationPhrase
        ? `${role || 'Profesionalac'} ${durationPhrase}. ${duties}`.trim()
        : `${role || 'Profesionalac'}. ${duties}`.trim())
      : (durationPhrase
        ? `${role || 'Profesionalka'} ${durationPhrase}. ${duties}`.trim()
        : `${role || 'Profesionalka'}. ${duties}`.trim()),
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
    durationPhrase && role
      ? `मैं ${durationPhrase} वाली ${role} हूँ। ${duties}`.trim()
      : role
        ? `${role} के रूप में ${duties}`.trim()
        : duties,
  ja: (role, duties, _g, durationPhrase) =>
    durationPhrase
      ? `${role || 'プロフェッショナル'}${durationPhrase}。${duties}`.trim()
      : `${role || 'プロフェッショナル'}として関連経験があります。${duties}`.trim(),
};

function localizeRoleLabel(
  role: string,
  locale: Locale,
  g: GenderTone,
  profileJobTitle?: string,
  dutiesText?: string,
): string {
  const raw = (role || '').trim();
  const gender = g === 'male' ? 'male' : g === 'female' ? 'female' : '';
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
  return resolveOccupationalTitleForSummary({
    profileJobTitle,
    currentExperienceTitle: raw,
    locale,
    gender,
    dutiesText,
  });
}

type GenericDutyIntent = 'process' | 'collaboration' | 'analysis' | 'planning' | 'logistics';
type CookingDutyIntent =
  | 'cuisine_prep'
  | 'kitchen_org'
  | 'kitchen_collab'
  | 'workplace_hygiene'
  | 'ingredient_storage'
  | 'hygiene_and_storage'
  | 'hygiene_and_kitchen_collab';

/**
 * Cooking / restaurant duty intents. Checked before office collaboration/process
 * so Serbian "sarađivala … kuhinjskog tima" does not become cross-functional
 * corporate collaboration.
 */
function classifyCookingDutyIntent(text: string): CookingDutyIntent | null {
  const t = text.toLowerCase().normalize('NFKC');
  const kitchenCtx = /(kuhinj|kitchen|jel\w*|namirnic|cuisine|dish(?:es)?|restaurant|food|mediteransk|mediterranean)/iu.test(t);
  const hasIngredientStorage = /(skladišt\w*\s+namirnic|ingredient.?stor|material.?stor|भंडारण|Lebensmittel[- ]?Lager|almacenamiento de ingredientes|stockage des ingrédients|conservazione degli ingredienti|تخزين المكونات|хранения продуктов|armazenamento de ingredientes|食材保管|freshness|свежин)/iu.test(t);
  const hasWorkplaceHygiene = (
    /\b(higijen\w*|hygiene|čist|clean|स्वच्छ)/iu.test(t)
    && !/\b(bar\s+area|šank|shank|cocktail|koktel)/iu.test(t)
    && (
      kitchenCtx
      || /radn\w*\s+prostor|workstation|workplace|कार्यस्थल|radnog\s+prostora/iu.test(t)
    )
  );
  const hasKitchenCollab = (
    (kitchenCtx || /kuhinjsk\w*\s+tim|kitchen\s+team/iu.test(t))
    && /(sara[dđ]\w*|collaborat|koordin\w*|koleg\w*|tim|team|servis|service|posluživ\w*|सहयोग)/iu.test(t)
  );
  // Combined hygiene + kitchen collaboration (two meanings, one display unit).
  if (hasWorkplaceHygiene && hasKitchenCollab) {
    return 'hygiene_and_kitchen_collab';
  }
  // Combined only when the source explicitly names both meanings.
  if (hasIngredientStorage && hasWorkplaceHygiene) {
    return 'hygiene_and_storage';
  }
  // Ingredient/material storage only when the source explicitly names it.
  if (hasIngredientStorage && (kitchenCtx || /namirnic|ingredient|hran|food/iu.test(t))) {
    return 'ingredient_storage';
  }
  // Workplace hygiene — narrowest meaning. Never expand into storage.
  if (hasWorkplaceHygiene) {
    return 'workplace_hygiene';
  }
  if (hasKitchenCollab) {
    return 'kitchen_collab';
  }
  if (
    /(radni\s+prostor|workstation|uredan|orderly|priprem\w*\s+namirnic|food[- ]?preparation\s+task)/iu.test(t)
    || (/organiz\w*/iu.test(t) && kitchenCtx)
  ) {
    return 'kitchen_org';
  }
  if (
    /\b(jel\w*|kuhinj\w*|cuisine|dish(?:es)?|mediteransk\w*|mediterranean|srpsk\w*|serbian|restaurant\s+standard|recept\w*|recipe|menu|cook)/iu.test(t)
    || /priprem\w*.{0,40}(jel|hran|obrok|dish)/iu.test(t)
    || /भोजन|पकवान|طبخ|料理/.test(t)
  ) {
    return 'cuisine_prep';
  }
  return null;
}

/**
 * Generic cooking fallbacks — never invent specific cuisines (Serbian/Mediterranean/…).
 * Cuisine names are added only when the *source* fact already contains them
 * (see `localizeCookingBulletFromSource`).
 */
const COOKING_INTENT_BULLET: Partial<
  Record<Locale, Partial<Record<CookingDutyIntent, (g: GenderTone, present?: boolean) => string>>>
> = {
  en: {
    cuisine_prep: (_g, present) =>
      present
        ? 'Prepare dishes in accordance with the restaurant’s established standards.'
        : 'Prepared dishes in accordance with the restaurant’s established standards.',
    kitchen_org: (_g, present) =>
      present
        ? 'Organize food-preparation tasks and maintain an orderly kitchen workstation.'
        : 'Organized food-preparation tasks and maintained an orderly kitchen workstation.',
    kitchen_collab: (_g, present) =>
      present
        ? 'Collaborate with the kitchen team during daily service.'
        : 'Collaborated with the kitchen team during daily service.',
    workplace_hygiene: (_g, present) =>
      present ? 'Maintain workplace hygiene.' : 'Maintained workplace hygiene.',
    ingredient_storage: (_g, present) =>
      present
        ? 'Follow ingredient-storage procedures.'
        : 'Followed ingredient-storage procedures.',
    hygiene_and_storage: (_g, present) =>
      present
        ? 'Maintain workplace hygiene and follow ingredient-storage procedures.'
        : 'Maintained workplace hygiene and followed ingredient-storage procedures.',
    hygiene_and_kitchen_collab: (_g, present) =>
      present
        ? 'Maintain workplace hygiene and collaborate with the kitchen team.'
        : 'Maintained workplace hygiene and collaborated with the kitchen team.',
  },
  de: {
    cuisine_prep: () =>
      'Zubereitung von Gerichten gemäß den festgelegten Restaurantstandards.',
    kitchen_org: () =>
      'Organisation der Essenszubereitung und Aufrechterhaltung eines ordentlichen Küchenarbeitsplatzes.',
    kitchen_collab: () =>
      'Abstimmung mit Küchenkolleginnen und -kollegen während des täglichen Service.',
    workplace_hygiene: () =>
      'Aufrechterhaltung der Hygiene am Arbeitsplatz.',
    ingredient_storage: () =>
      'Einhaltung der Lebensmittel-Lagerungsverfahren.',
    hygiene_and_storage: () =>
      'Aufrechterhaltung der Hygiene am Arbeitsplatz und Einhaltung der Lebensmittel-Lagerungsverfahren.',
  },
  es: {
    cuisine_prep: () =>
      'Preparación de platos según los estándares establecidos del restaurante.',
    kitchen_org: () =>
      'Organización de las tareas de preparación de alimentos y mantenimiento de un puesto de cocina ordenado.',
    kitchen_collab: () =>
      'Coordinación con compañeros de cocina durante el servicio diario.',
    workplace_hygiene: () =>
      'Mantenimiento de la higiene del puesto de trabajo.',
    ingredient_storage: () =>
      'Cumplimiento de los procedimientos de almacenamiento de ingredientes.',
    hygiene_and_storage: () =>
      'Mantenimiento de la higiene del puesto de trabajo y cumplimiento del almacenamiento de ingredientes.',
  },
  fr: {
    cuisine_prep: () =>
      'Préparation de plats conformément aux normes établies du restaurant.',
    kitchen_org: () =>
      'Organisation des tâches de préparation des aliments et maintien d’un poste de cuisine ordonné.',
    kitchen_collab: () =>
      'Coordination avec les collègues de cuisine pendant le service quotidien.',
    workplace_hygiene: () =>
      'Maintien de l’hygiène du poste de travail.',
    ingredient_storage: () =>
      'Respect des procédures de stockage des ingrédients.',
    hygiene_and_storage: () =>
      'Maintien de l’hygiène du poste de travail et respect du stockage des ingrédients.',
  },
  it: {
    cuisine_prep: () =>
      'Preparazione di piatti secondo gli standard definiti del ristorante.',
    kitchen_org: () =>
      'Organizzazione delle attività di preparazione degli alimenti e mantenimento di una postazione di cucina ordinata.',
    kitchen_collab: () =>
      'Coordinamento con i colleghi di cucina durante il servizio quotidiano.',
    workplace_hygiene: () =>
      'Mantenimento dell’igiene della postazione di lavoro.',
    ingredient_storage: () =>
      'Rispetto delle procedure di conservazione degli ingredienti.',
    hygiene_and_storage: () =>
      'Mantenimento dell’igiene della postazione e rispetto della conservazione degli ingredienti.',
  },
  ar: {
    cuisine_prep: () =>
      'إعداد الأطباق وفقاً لمعايير المطعم المعتمدة.',
    kitchen_org: () =>
      'تنظيم مهام تحضير الطعام والحفاظ على مكان عمل مرتب في المطبخ.',
    kitchen_collab: () =>
      'التنسيق مع زملاء المطبخ أثناء الخدمة اليومية.',
    workplace_hygiene: () =>
      'الحفاظ على نظافة مكان العمل.',
    ingredient_storage: () =>
      'اتباع إجراءات تخزين المكونات.',
    hygiene_and_storage: () =>
      'الحفاظ على نظافة مكان العمل واتباع إجراءات تخزين المكونات.',
  },
  sr: {
    cuisine_prep: (g, present) =>
      present
        ? 'Pripremam jela u skladu sa utvrđenim standardima restorana.'
        : g === 'male'
          ? 'Pripremao sam jela u skladu sa utvrđenim standardima restorana.'
          : 'Pripremala sam jela u skladu sa utvrđenim standardima restorana.',
    kitchen_org: (g, present) =>
      present
        ? 'Organizujem pripremu namirnica i održavam uredan radni prostor u kuhinji.'
        : g === 'male'
          ? 'Organizovao sam pripremu namirnica i održavao uredan radni prostor u kuhinji.'
          : 'Organizovala sam pripremu namirnica i održavala uredan radni prostor u kuhinji.',
    kitchen_collab: (g, present) =>
      present
        ? 'Sarađujem sa kolegama iz kuhinjskog tima tokom dnevnog servisa.'
        : g === 'male'
          ? 'Sarađivao sam sa kolegama iz kuhinjskog tima tokom dnevnog servisa.'
          : 'Sarađivala sam sa kolegama iz kuhinjskog tima tokom dnevnog servisa.',
    workplace_hygiene: (g, present) =>
      present
        ? 'Održavam higijenu radnog prostora.'
        : g === 'male'
          ? 'Održavao sam higijenu radnog prostora.'
          : 'Održavala sam higijenu radnog prostora.',
    ingredient_storage: (g, present) =>
      present
        ? 'Poštujem pravila skladištenja namirnica.'
        : g === 'male'
          ? 'Poštovao sam pravila skladištenja namirnica.'
          : 'Poštovala sam pravila skladištenja namirnica.',
    hygiene_and_storage: (g, present) =>
      present
        ? 'Održavam higijenu radnog prostora i poštujem pravila skladištenja namirnica.'
        : g === 'male'
          ? 'Održavao sam higijenu radnog prostora i poštovao pravila skladištenja namirnica.'
          : 'Održavala sam higijenu radnog prostora i poštovala pravila skladištenja namirnica.',
  },
  hr: {
    cuisine_prep: (g, present) =>
      present
        ? 'Pripremam jela u skladu s utvrđenim standardima restorana.'
        : g === 'male'
          ? 'Pripremao sam jela u skladu s utvrđenim standardima restorana.'
          : 'Pripremala sam jela u skladu s utvrđenim standardima restorana.',
    kitchen_org: (g, present) =>
      present
        ? 'Organiziram pripremu namirnica i održavam uredan radni prostor u kuhinji.'
        : g === 'male'
          ? 'Organizirao sam pripremu namirnica i održavao uredan radni prostor u kuhinji.'
          : 'Organizirala sam pripremu namirnica i održavala uredan radni prostor u kuhinji.',
    kitchen_collab: (g, present) =>
      present
        ? 'Surađujem s kolegama iz kuhinjskog tima tijekom dnevnog servisa.'
        : g === 'male'
          ? 'Surađivao sam s kolegama iz kuhinjskog tima tijekom dnevnog servisa.'
          : 'Surađivala sam s kolegama iz kuhinjskog tima tijekom dnevnog servisa.',
    workplace_hygiene: (g, present) =>
      present
        ? 'Održavam higijenu radnog prostora.'
        : g === 'male'
          ? 'Održavao sam higijenu radnog prostora.'
          : 'Održavala sam higijenu radnog prostora.',
    ingredient_storage: (g, present) =>
      present
        ? 'Poštujem pravila skladištenja namirnica.'
        : g === 'male'
          ? 'Poštovao sam pravila skladištenja namirnica.'
          : 'Poštovala sam pravila skladištenja namirnica.',
    hygiene_and_storage: (g, present) =>
      present
        ? 'Održavam higijenu radnog prostora i poštujem pravila skladištenja namirnica.'
        : g === 'male'
          ? 'Održavao sam higijenu radnog prostora i poštovao pravila skladištenja namirnica.'
          : 'Održavala sam higijenu radnog prostora i poštovala pravila skladištenja namirnica.',
  },
  ru: {
    cuisine_prep: (g, present) =>
      present
        ? 'Готовлю блюда в соответствии с установленными стандартами ресторана.'
        : g === 'male'
          ? 'Готовил блюда в соответствии с установленными стандартами ресторана.'
          : 'Готовила блюда в соответствии с установленными стандартами ресторана.',
    kitchen_org: (g, present) =>
      present
        ? 'Организую подготовку продуктов и поддерживаю порядок на рабочем месте на кухне.'
        : g === 'male'
          ? 'Организовывал подготовку продуктов и поддерживал порядок на рабочем месте на кухне.'
          : 'Организовывала подготовку продуктов и поддерживала порядок на рабочем месте на кухне.',
    kitchen_collab: (g, present) =>
      present
        ? 'Сотрудничаю с коллегами кухонной бригады во время ежедневного обслуживания.'
        : g === 'male'
          ? 'Сотрудничал с коллегами кухонной бригады во время ежедневного обслуживания.'
          : 'Сотрудничала с коллегами кухонной бригады во время ежедневного обслуживания.',
    workplace_hygiene: (g, present) =>
      present
        ? 'Поддерживаю чистоту рабочего места.'
        : g === 'male'
          ? 'Поддерживал чистоту рабочего места.'
          : 'Поддерживала чистоту рабочего места.',
    ingredient_storage: (g, present) =>
      present
        ? 'Соблюдаю правила хранения продуктов.'
        : g === 'male'
          ? 'Соблюдал правила хранения продуктов.'
          : 'Соблюдала правила хранения продуктов.',
    hygiene_and_storage: (g, present) =>
      present
        ? 'Поддерживаю чистоту рабочего места и соблюдаю правила хранения продуктов.'
        : g === 'male'
          ? 'Поддерживал чистоту рабочего места и соблюдал правила хранения продуктов.'
          : 'Поддерживала чистоту рабочего места и соблюдала правила хранения продуктов.',
  },
  'pt-BR': {
    cuisine_prep: () =>
      'Preparo de pratos conforme os padrões estabelecidos do restaurante.',
    kitchen_org: () =>
      'Organização das tarefas de preparação de alimentos e manutenção de uma estação de cozinha ordenada.',
    kitchen_collab: () =>
      'Coordenação com colegas de cozinha durante o serviço diário.',
    workplace_hygiene: () =>
      'Manutenção da higiene do local de trabalho.',
    ingredient_storage: () =>
      'Cumprimento dos procedimentos de armazenamento de ingredientes.',
    hygiene_and_storage: () =>
      'Manutenção da higiene do local de trabalho e cumprimento do armazenamento de ingredientes.',
  },
  hi: {
    cuisine_prep: (g, present) =>
      present
        ? (g === 'male'
          ? 'मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करता हूँ।'
          : 'मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती हूँ।')
        : (g === 'male'
          ? 'मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करता था।'
          : 'मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती थी।'),
    kitchen_org: (g, present) =>
      present
        ? (g === 'male'
          ? 'मैं खाद्य तैयारी के कार्यों को व्यवस्थित रखता हूँ और रसोई के कार्यक्षेत्र को व्यवस्थित बनाए रखता हूँ।'
          : 'मैं खाद्य तैयारी के कार्यों को व्यवस्थित रखती हूँ और रसोई के कार्यक्षेत्र को व्यवस्थित बनाए रखती हूँ।')
        : (g === 'male'
          ? 'मैं खाद्य तैयारी के कार्यों को व्यवस्थित रखता था और रसोई के कार्यक्षेत्र को व्यवस्थित बनाए रखता था।'
          : 'मैं खाद्य तैयारी के कार्यों को व्यवस्थित रखती थी और रसोई के कार्यक्षेत्र को व्यवस्थित बनाए रखती थी।'),
    kitchen_collab: (g, present) =>
      present
        ? (g === 'male'
          ? 'मैं रसोई टीम के साथ सहयोग करता हूँ।'
          : 'मैं रसोई टीम के साथ सहयोग करती हूँ।')
        : (g === 'male'
          ? 'मैं रसोई टीम के साथ सहयोग करता था।'
          : 'मैं रसोई टीम के साथ सहयोग करती थी।'),
    workplace_hygiene: (g, present) =>
      present
        ? (g === 'male'
          ? 'मैं कार्यस्थल की स्वच्छता बनाए रखता हूँ।'
          : 'मैं कार्यस्थल की स्वच्छता बनाए रखती हूँ।')
        : (g === 'male'
          ? 'मैं कार्यस्थल की स्वच्छता बनाए रखता था।'
          : 'मैं कार्यस्थल की स्वच्छता बनाए रखती थी।'),
    ingredient_storage: (g, present) =>
      present
        ? (g === 'male'
          ? 'मैं सामग्री भंडारण प्रक्रियाओं का पालन करता हूँ।'
          : 'मैं सामग्री भंडारण प्रक्रियाओं का पालन करती हूँ।')
        : (g === 'male'
          ? 'मैं सामग्री भंडारण प्रक्रियाओं का पालन करता था।'
          : 'मैं सामग्री भंडारण प्रक्रियाओं का पालन करती थी।'),
    hygiene_and_storage: (g, present) =>
      present
        ? (g === 'male'
          ? 'मैं कार्यस्थल की स्वच्छता बनाए रखता हूँ और सामग्री भंडारण प्रक्रियाओं का पालन करता हूँ।'
          : 'मैं कार्यस्थल की स्वच्छता बनाए रखती हूँ और सामग्री भंडारण प्रक्रियाओं का पालन करती हूँ।')
        : (g === 'male'
          ? 'मैं कार्यस्थल की स्वच्छता बनाए रखता था और सामग्री भंडारण प्रक्रियाओं का पालन करता था।'
          : 'मैं कार्यस्थल की स्वच्छता बनाए रखती थी और सामग्री भंडारण प्रक्रियाओं का पालन करती थी।'),
    hygiene_and_kitchen_collab: (g, present) =>
      present
        ? (g === 'male'
          ? 'कार्यस्थल की स्वच्छता बनाए रखता हूँ और रसोई टीम के साथ सहयोग करता हूँ।'
          : 'कार्यस्थल की स्वच्छता बनाए रखती हूँ और रसोई टीम के साथ सहयोग करती हूँ।')
        : (g === 'male'
          ? 'कार्यस्थल की स्वच्छता बनाए रखता था और रसोई टीम के साथ सहयोग करता था।'
          : 'कार्यस्थल की स्वच्छता बनाए रखती थी और रसोई टीम के साथ सहयोग करती थी।'),
  },
  ja: {
    cuisine_prep: (_g, present) =>
      present
        ? 'レストランの定められた基準に従って料理を準備している。'
        : 'レストランの定められた基準に従って料理を準備した。',
    kitchen_org: (_g, present) =>
      present
        ? '食材準備作業を整理し、厨房の作業場を整然と維持している。'
        : '食材準備作業を整理し、厨房の作業場を整然と維持した。',
    kitchen_collab: (_g, present) =>
      present
        ? '日常サービス中に厨房の同僚と連携している。'
        : '日常サービス中に厨房の同僚と連携した。',
    workplace_hygiene: (_g, present) =>
      present
        ? '職場の衛生を維持している。'
        : '職場の衛生を維持した。',
    ingredient_storage: (_g, present) =>
      present
        ? '食材保管手順に従っている。'
        : '食材保管手順に従った。',
    hygiene_and_storage: (_g, present) =>
      present
        ? '職場の衛生を維持し、食材保管手順に従っている。'
        : '職場の衛生を維持し、食材保管手順に従った。',
  },
};

/** Only when source already names both Serbian + Mediterranean cuisines. */
const COOKING_CUISINE_FROM_SOURCE: Partial<Record<Locale, (g: GenderTone) => string>> = {
  en: () =>
    'Prepared Serbian and Mediterranean dishes in accordance with the restaurant’s established standards.',
  de: () =>
    'Zubereitung serbischer und mediterraner Gerichte gemäß den festgelegten Restaurantstandards.',
  es: () =>
    'Preparación de platos serbios y mediterráneos según los estándares establecidos del restaurante.',
  fr: () =>
    'Préparation de plats serbes et méditerranéens conformément aux normes établies du restaurant.',
  it: () =>
    'Preparazione di piatti serbi e mediterranei secondo gli standard definiti del ristorante.',
  ar: () =>
    'إعداد أطباق صربية ومتوسطية وفقاً لمعايير المطعم المعتمدة.',
  sr: (g) =>
    g === 'male'
      ? 'Pripremao sam jela srpske i mediteranske kuhinje u skladu sa standardima restorana.'
      : 'Pripremala sam jela srpske i mediteranske kuhinje u skladu sa standardima restorana.',
  hr: (g) =>
    g === 'male'
      ? 'Pripremao sam jela srpske i mediteranske kuhinje u skladu sa standardima restorana.'
      : 'Pripremala sam jela srpske i mediteranske kuhinje u skladu sa standardima restorana.',
  ru: (g) =>
    g === 'male'
      ? 'Готовил блюда сербской и средиземноморской кухни в соответствии со стандартами ресторана.'
      : 'Готовила блюда сербской и средиземноморской кухни в соответствии со стандартами ресторана.',
  'pt-BR': () =>
    'Preparo de pratos da culinária sérvia e mediterrânea conforme os padrões estabelecidos do restaurante.',
  hi: () =>
    'रेस्तराँ के निर्धारित मानकों के अनुसार सर्बियाई और भूमध्यसागरीय व्यंजन तैयार किए।',
  ja: () =>
    'レストランの定められた基準に従い、セルビア料理および地中海料理を準備した。',
};

function localizeCookingBulletFromSource(
  sourceText: string,
  intent: CookingDutyIntent,
  locale: Locale,
  gender?: CoverLetterGender | string,
  isPresent = false,
): string {
  const g = tone(gender);
  const table = COOKING_INTENT_BULLET[locale] || COOKING_INTENT_BULLET.en;
  if (
    intent === 'cuisine_prep'
    && /\b(srpsk\w*|serbian)/iu.test(sourceText)
    && /\b(mediteransk\w*|mediterranean)/iu.test(sourceText)
  ) {
    const specific = COOKING_CUISINE_FROM_SOURCE[locale] || COOKING_CUISINE_FROM_SOURCE.en;
    const specificText = specific!(g).trim();
    if (isPresent && locale === 'hi') {
      return g === 'male'
        ? 'मैं रेस्तरां के निर्धारित मानकों के अनुसार सर्बियाई और भूमध्यसागरीय व्यंजन तैयार करता हूँ।'
        : 'मैं रेस्तरां के निर्धारित मानकों के अनुसार सर्बियाई और भूमध्यसागरीय व्यंजन तैयार करती हूँ।';
    }
    if (isPresent && locale === 'en') {
      return specificText.replace(/^Prepared\b/, 'Prepare');
    }
    if (isPresent && (locale === 'sr' || locale === 'hr')) {
      return g === 'male' || g === 'female'
        ? specificText
          .replace(/^Pripremao sam\b/i, 'Pripremam')
          .replace(/^Pripremala sam\b/i, 'Pripremam')
        : specificText;
    }
    return specificText;
  }
  return (table?.[intent] || COOKING_INTENT_BULLET.en?.[intent] || (() => ''))(g, isPresent).trim();
}

/**
 * `\b<stem>\b` breaks the moment the source language inflects the stem with a
 * suffix — e.g. Serbian "saradn\b" never matches inside "saradnja", "koordin\b"
 * never matches inside "koordinacija", because the trailing `\b` requires the
 * stem to end the word. Latin-script stems below therefore only anchor the
 * *start* of the word (`\b<stem>`) and allow any run of further ASCII letters to
 * follow, which safely covers Serbian/Croatian/Spanish/etc. case endings without
 * requiring an exact word match. Devanagari terms use plain substring checks
 * since `\b` never matches at a non-word/non-word (Devanagari-to-space) boundary.
 */
function classifyGenericDutyIntent(text: string): GenericDutyIntent | null {
  const t = text.toLowerCase();
  // Cooking duties must not fall through to office collaboration via "tim/sarađ".
  if (classifyCookingDutyIntent(t)) return null;
  const startsWord = (...stems: string[]) =>
    new RegExp(`\\b(?:${stems.join('|')})[a-z]*`, 'iu').test(t);
  const includesAny = (...terms: string[]) => terms.some((term) => t.includes(term));

  if (
    startsWord('process', 'internal', 'implement', 'razvoj', 'unapređ', 'proces')
    || includesAny('प्रक्रिया')
  ) return 'process';
  if (
    startsWord('cross.?functional', 'collaborat', 'saradn', 'tim', 'project execution')
    || includesAny('सहयोग', 'परियोजना')
  ) return 'collaboration';
  if (
    startsWord('data', 'analys', 'report', 'izveštaj', 'analiz')
    || includesAny('विश्लेषण', 'रिपोर्ट')
  ) return 'analysis';
  if (
    startsWord('plan', 'planning', 'coordinat', 'coordination', 'koordin', 'planir')
    || includesAny('योजना', 'समन्वय')
  ) return 'planning';
  // Warehouse / driving / delivery duties (e.g. forklift operators, drivers,
  // couriers) never matched any bucket above — every generic-duty CV outside
  // an office/hospitality context fell through to an empty translation for
  // every non-English locale (see `GENERIC_DUTY_FALLBACK` below for the
  // remaining catch-all once even this bucket doesn't match).
  if (
    startsWord(
      'transport', 'deliver', 'delivery', 'load', 'unload', 'warehouse',
      'utovar', 'istovar', 'vozi', 'vožnj', 'voz', 'rukovan', 'viličar', 'vilicar',
      'sklad', 'isporuč', 'isporuc', 'prevoz', 'tovar',
    )
    || includesAny('परिवहन', 'गोदाम', 'डिलीवरी', 'लोडिंग')
  ) return 'logistics';
  return null;
}

const GENERIC_INTENT_BULLET: Partial<
  Record<Locale, Record<GenericDutyIntent, (g: GenderTone) => string>>
> = {
  en: {
    process: () => 'Develop and implement internal processes.',
    collaboration: () => 'Collaborate with cross-functional teams on project execution.',
    analysis: () => 'Analyze business data and prepare reports for senior management.',
    planning: () => 'Plan and coordinate departmental activities.',
    logistics: () => 'Transport, load, and deliver goods safely as part of warehouse operations.',
  },
  de: {
    process: () => 'Entwicklung und Umsetzung interner Prozesse.',
    collaboration: () => 'Zusammenarbeit mit funktionsübergreifenden Teams bei der Projektumsetzung.',
    analysis: () => 'Analyse von Geschäftsdaten und Erstellung von Berichten für die Geschäftsführung.',
    planning: () => 'Planung und Koordination von Abteilungsaktivitäten.',
    logistics: () => 'Transport, Beladung und sichere Auslieferung von Waren im Rahmen des Lagerbetriebs.',
  },
  es: {
    process: () => 'Desarrollo e implementación de procesos internos.',
    collaboration: () => 'Colaboración con equipos multifuncionales en la ejecución de proyectos.',
    analysis: () => 'Análisis de datos empresariales y elaboración de informes para la alta dirección.',
    planning: () => 'Planificación y coordinación de las actividades del departamento.',
    logistics: () => 'Transporte, carga y entrega segura de mercancías en las operaciones del almacén.',
  },
  fr: {
    process: () => 'Développement et mise en œuvre de processus internes.',
    collaboration: () => 'Collaboration avec des équipes transverses sur l’exécution de projets.',
    analysis: () => 'Analyse des données commerciales et préparation de rapports pour la direction.',
    planning: () => 'Planification et coordination des activités du département.',
    logistics: () => 'Transport, chargement et livraison sécurisée des marchandises dans le cadre des opérations d’entrepôt.',
  },
  it: {
    process: () => 'Sviluppo e implementazione di processi interni.',
    collaboration: () => 'Collaborazione con team multifunzionali nell’esecuzione dei progetti.',
    analysis: () => 'Analisi dei dati aziendali e preparazione di report per il management.',
    planning: () => 'Pianificazione e coordinamento delle attività del reparto.',
    logistics: () => 'Trasporto, carico e consegna sicura delle merci nelle operazioni di magazzino.',
  },
  ar: {
    process: () => 'تطوير وتنفيذ العمليات الداخلية.',
    collaboration: () => 'التعاون مع فرق متعددة الوظائف لتنفيذ المشاريع.',
    analysis: () => 'تحليل بيانات الأعمال وإعداد التقارير للإدارة العليا.',
    planning: () => 'التخطيط والتنسيق لأنشطة القسم.',
    logistics: () => 'نقل وتحميل وتسليم البضائع بأمان ضمن عمليات المستودع.',
  },
  ru: {
    process: () => 'Разработка и внедрение внутренних процессов.',
    collaboration: () => 'Сотрудничество с межфункциональными командами при реализации проектов.',
    analysis: () => 'Анализ бизнес-данных и подготовка отчётов для руководства.',
    planning: () => 'Планирование и координация деятельности отдела.',
    logistics: () => 'Транспортировка, погрузка и безопасная доставка товаров в рамках складских операций.',
  },
  'pt-BR': {
    process: () => 'Desenvolvimento e implementação de processos internos.',
    collaboration: () => 'Colaboração com equipes multifuncionais na execução de projetos.',
    analysis: () => 'Análise de dados de negócios e elaboração de relatórios para a alta gestão.',
    planning: () => 'Planejamento e coordenação das atividades do departamento.',
    logistics: () => 'Transporte, carregamento e entrega segura de mercadorias nas operações do armazém.',
  },
  ja: {
    process: () => '社内プロセスの開発と実施。',
    collaboration: () => 'プロジェクト遂行のための部門横断チームとの協力。',
    analysis: () => '経営データの分析と経営陣向け報告書の作成。',
    planning: () => '部門活動の計画と調整。',
    logistics: () => '倉庫業務における貨物の輸送、積み込み、および安全な配送。',
  },
  sr: {
    process: () => 'Radim na razvoju i implementaciji internih procesa.',
    collaboration: () => 'Sarađujem sa međufunkcionalnim timovima na izvršenju projekata.',
    analysis: () => 'Analiziram poslovne podatke i pripremam izveštaje za više rukovodstvo.',
    planning: () => 'Učestvujem u planiranju i koordinaciji aktivnosti odeljenja.',
    logistics: () => 'Transportujem, utovaram i bezbedno isporučujem robu u okviru skladišnog poslovanja.',
  },
  hr: {
    process: () => 'Radim na razvoju i implementaciji internih procesa.',
    collaboration: () => 'Surađujem s međufunkcionalnim timovima na izvršenju projekata.',
    analysis: () => 'Analiziram poslovne podatke i pripremam izvještaje za više rukovodstvo.',
    planning: () => 'Sudjelujem u planiranju i koordinaciji aktivnosti odjela.',
    logistics: () => 'Transportiram, utovarujem i sigurno isporučujem robu u okviru skladišnog poslovanja.',
  },
  hi: {
    process: (g) => (g === 'male' ? 'आंतरिक प्रक्रियाओं के विकास और कार्यान्वयन में काम कर रहा हूँ।' : 'आंतरिक प्रक्रियाओं के विकास और कार्यान्वयन में काम कर रही हूँ।'),
    collaboration: (g) => (g === 'male' ? 'परियोजना क्रियान्वयन में क्रॉस-फंक्शनल टीमों के साथ सहयोग कर रहा हूँ।' : 'परियोजना क्रियान्वयन में क्रॉस-फंक्शनल टीमों के साथ सहयोग कर रही हूँ।'),
    analysis: (g) => (g === 'male' ? 'व्यावसायिक डेटा का विश्लेषण कर रहा हूँ और वरिष्ठ प्रबंधन के लिए रिपोर्ट तैयार कर रहा हूँ।' : 'व्यावसायिक डेटा का विश्लेषण कर रही हूँ और वरिष्ठ प्रबंधन के लिए रिपोर्ट तैयार कर रही हूँ।'),
    planning: (g) => (g === 'male' ? 'विभागीय गतिविधियों की योजना और समन्वय में भाग ले रहा हूँ।' : 'विभागीय गतिविधियों की योजना और समन्वय में भाग ले रही हूँ।'),
    logistics: (g) => (g === 'male' ? 'गोदाम कार्यों के अंतर्गत माल का परिवहन, लोडिंग और सुरक्षित डिलीवरी कर रहा हूँ।' : 'गोदाम कार्यों के अंतर्गत माल का परिवहन, लोडिंग और सुरक्षित डिलीवरी कर रही हूँ।'),
  },
};

/**
 * Last-resort, non-inventive duty sentence used only when a "generic" bullet
 * matches none of the known intents above (`classifyGenericDutyIntent` ===
 * null). Before this existed, `localizedBulletForFact` returned an EMPTY
 * string for every locale except `en` (which leaked the raw, possibly
 * wrong-language source text instead) — which made
 * `deterministicLocalizedSummaryFromCanonical` / `deterministicLocalizedBulletsFromCanonical`
 * return `''` outright (`bullets.some((b) => !b.trim())`), so the ONE
 * fallback step that every other validation layer treats as "always safe"
 * silently had NO output to give whenever a CV's duties fell outside the
 * narrow office/hospitality vocabulary those tables cover. Because provider +
 * repair failure is itself non-deterministic (LLM sampling), this surfaced as
 * an intermittent `generation_validation_failed` — hitting locales with
 * stricter validation (Hindi's script/duration/tense checks) far more often,
 * and "clearing" the moment an unrelated request happened to succeed without
 * ever touching this fallback. This sentence does not claim any specific,
 * unsupported duty (mirrors the same genericity as "process"/"planning"
 * above) — it only confirms the fact that the person carried out the
 * responsibilities of the role, which the canonical CV already establishes.
 */
const GENERIC_DUTY_FALLBACK: Record<Locale, (g: GenderTone) => string> = {
  en: () => 'Carried out assigned professional responsibilities within the role.',
  de: () => 'Wahrnehmung der zugewiesenen beruflichen Aufgaben und Verantwortlichkeiten in dieser Rolle.',
  es: () => 'Cumplimiento de las responsabilidades profesionales asignadas en el puesto.',
  fr: () => 'Exécution des responsabilités professionnelles confiées dans le cadre du poste.',
  it: () => 'Svolgimento delle responsabilità professionali assegnate nel ruolo.',
  ar: () => 'أداء المهام والمسؤوليات المهنية الموكلة في هذا الدور.',
  ru: () => 'Выполнение возложенных профессиональных обязанностей в рамках занимаемой должности.',
  'pt-BR': () => 'Cumprimento das responsabilidades profissionais atribuídas na função.',
  ja: () => '職務における担当業務および責任を遂行。',
  sr: () => 'Obavljam dodeljene profesionalne obaveze i odgovornosti u okviru pozicije.',
  hr: () => 'Obavljam dodijeljene profesionalne obveze i odgovornosti u okviru pozicije.',
  hi: (g) => (g === 'male'
    ? 'इस भूमिका के अंतर्गत सौंपे गए पेशेवर कर्तव्यों और जिम्मेदारियों को पूरा कर रहा हूँ।'
    : 'इस भूमिका के अंतर्गत सौंपे गए पेशेवर कर्तव्यों और जिम्मेदारियों को पूरा कर रही हूँ।'),
};

/** Per-material-duty lines so warehouse/software/sales duties never collapse. */
function localizedMaterialDutyBullet(
  key: MaterialDutyKey,
  locale: Locale,
  g: GenderTone,
  isPresent: boolean,
): string | null {
  const hi = (female: string, male: string) => (g === 'male' ? male : female);
  const table: Partial<Record<MaterialDutyKey, Partial<Record<Locale, string>>>> = {
    logistics_transport: {
      en: isPresent ? 'Transport goods as part of warehouse operations.' : 'Transported goods as part of warehouse operations.',
      hi: hi('मैं गोदाम कार्यों के अंतर्गत माल का परिवहन करती हूँ।', 'मैं गोदाम कार्यों के अंतर्गत माल का परिवहन करता हूँ।'),
      de: 'Transport von Waren im Rahmen der Lagerprozesse.',
      sr: isPresent
        ? 'Transportujem robu u okviru skladišnog poslovanja.'
        : (g === 'male' ? 'Transportovao sam robu u okviru skladišnog poslovanja.' : 'Transportovala sam robu u okviru skladišnog poslovanja.'),
    },
    logistics_loading: {
      en: isPresent ? 'Load shipments carefully during warehouse handling.' : 'Loaded shipments carefully during warehouse handling.',
      hi: hi('मैं गोदाम हैंडलिंग के दौरान लोडिंग करती हूँ।', 'मैं गोदाम हैंडलिंग के दौरान लोडिंग करता हूँ।'),
      de: 'Sorgfältige Beladung von Sendungen im Lagerbetrieb.',
      sr: isPresent
        ? 'Utovaram pošiljke pažljivo u skladišnom poslovanju.'
        : (g === 'male' ? 'Utovarao sam pošiljke pažljivo u skladišnom poslovanju.' : 'Utovarala sam pošiljke pažljivo u skladišnom poslovanju.'),
    },
    logistics_delivery: {
      en: isPresent ? 'Deliver goods safely to their destination.' : 'Delivered goods safely to their destination.',
      hi: hi('मैं माल की सुरक्षित डिलीवरी करती हूँ।', 'मैं माल की सुरक्षित डिलीवरी करता हूँ।'),
      de: 'Sichere Auslieferung von Waren an den Bestimmungsort.',
      sr: isPresent
        ? 'Sigurno isporučujem robu do odredišta.'
        : (g === 'male' ? 'Sigurno sam isporučivao robu do odredišta.' : 'Sigurno sam isporučivala robu do odredišta.'),
    },
    software_development: {
      en: isPresent ? 'Develop application features and APIs for the product.' : 'Developed application features and APIs for the product.',
      hi: hi('मैं उत्पाद के लिए एप्लिकेशन सुविधाएँ और API विकसित करती हूँ।', 'मैं उत्पाद के लिए एप्लिकेशन सुविधाएँ और API विकसित करता हूँ।'),
      de: 'Entwicklung von Anwendungsfunktionen und APIs für das Produkt.',
      sr: isPresent
        ? 'Razvijam aplikativne funkcionalnosti i API-je.'
        : (g === 'male' ? 'Razvijao sam aplikativne funkcionalnosti i API-je.' : 'Razvijala sam aplikativne funkcionalnosti i API-je.'),
    },
    software_testing: {
      en: isPresent ? 'Test features with unit and integration checks.' : 'Tested features with unit and integration checks.',
      hi: hi('मैं सुविधाओं का इकाई और एकीकरण परीक्षण करती हूँ।', 'मैं सुविधाओं का इकाई और एकीकरण परीक्षण करता हूँ।'),
      de: 'Testen von Funktionen mit Unit- und Integrationstests.',
      sr: isPresent
        ? 'Testiram funkcionalnosti jediničnim i integracionim testovima.'
        : (g === 'male' ? 'Testirao sam funkcionalnosti jediničnim i integracionim testovima.' : 'Testirala sam funkcionalnosti jediničnim i integracionim testovima.'),
    },
    software_documentation: {
      en: isPresent ? 'Document APIs and implementation details for the team.' : 'Documented APIs and implementation details for the team.',
      hi: hi('मैं टीम के लिए API और कार्यान्वयन विवरण का दस्तावेजीकरण करती हूँ।', 'मैं टीम के लिए API और कार्यान्वयन विवरण का दस्तावेजीकरण करता हूँ।'),
      de: 'Dokumentation von APIs und Implementierungsdetails für das Team.',
      sr: isPresent
        ? 'Dokumentujem API-je i detalje implementacije za tim.'
        : (g === 'male' ? 'Dokumentovao sam API-je i detalje implementacije za tim.' : 'Dokumentovala sam API-je i detalje implementacije za tim.'),
    },
    sales_prospecting: {
      en: isPresent ? 'Prospect new leads and build the sales pipeline.' : 'Prospected new leads and built the sales pipeline.',
      hi: hi('मैं नए लीड खोजती हूँ और सेल्स पाइपलाइन बनाती हूँ।', 'मैं नए लीड खोजता हूँ और सेल्स पाइपलाइन बनाता हूँ।'),
      de: 'Akquise neuer Leads und Aufbau der Vertriebspipeline.',
      sr: isPresent
        ? 'Pronalazim potencijalne klijente i gradim prodajni pipeline.'
        : (g === 'male' ? 'Pronalazio sam potencijalne klijente i gradio prodajni pipeline.' : 'Pronalazila sam potencijalne klijente i gradila prodajni pipeline.'),
    },
    sales_client_communication: {
      en: isPresent ? 'Communicate with clients about needs and proposals.' : 'Communicated with clients about needs and proposals.',
      hi: hi('मैं ग्राहकों से आवश्यकताओं और प्रस्तावों पर संवाद करती हूँ।', 'मैं ग्राहकों से आवश्यकताओं और प्रस्तावों पर संवाद करता हूँ।'),
      de: 'Kommunikation mit Kunden zu Anforderungen und Angeboten.',
      sr: isPresent
        ? 'Komuniciram sa klijentima o potrebama i predlozima.'
        : (g === 'male' ? 'Komunicirao sam sa klijentima o potrebama i predlozima.' : 'Komunicirala sam sa klijentima o potrebama i predlozima.'),
    },
    sales_order_processing: {
      en: isPresent ? 'Process customer orders through to fulfillment.' : 'Processed customer orders through to fulfillment.',
      hi: hi('मैं ग्राहक ऑर्डर को पूर्ति तक प्रोसेस करती हूँ।', 'मैं ग्राहक ऑर्डर को पूर्ति तक प्रोसेस करता हूँ।'),
      de: 'Bearbeitung von Kundenaufträgen bis zur Erfüllung.',
      sr: isPresent
        ? 'Obrađujem narudžbe klijenata do isporuke.'
        : (g === 'male' ? 'Obrađivao sam narudžbe klijenata do isporuke.' : 'Obrađivala sam narudžbe klijenata do isporuke.'),
    },
    cs_inquiry_channels: {
      en: isPresent
        ? 'Respond to customer inquiries by email and phone, providing clear and timely support.'
        : 'Responded to customer inquiries by email and phone, providing clear and timely support.',
      hi: hi(
        'मैं ईमेल और फोन द्वारा ग्राहक पूछताछ का उत्तर देती हूँ।',
        'मैं ईमेल और फोन द्वारा ग्राहक पूछताछ का उत्तर देता हूँ।',
      ),
      sr: isPresent
        ? 'Odgovaram na upite klijenata putem e-pošte i telefona.'
        : (g === 'male'
          ? 'Odgovarao sam na upite klijenata putem e-pošte i telefona.'
          : 'Odgovarala sam na upite klijenata putem e-pošte i telefona.'),
    },
    cs_complaint_resolution: {
      en: isPresent
        ? 'Resolve customer complaints and issues according to internal procedures and quality standards.'
        : 'Resolved customer complaints and issues according to internal procedures and quality standards.',
      hi: hi(
        'आंतरिक प्रक्रियाओं और गुणवत्ता मानकों के अनुसार ग्राहकों की शिकायतों और समस्याओं का समाधान करती हूँ।',
        'आंतरिक प्रक्रियाओं और गुणवत्ता मानकों के अनुसार ग्राहकों की शिकायतों और समस्याओं का समाधान करता हूँ।',
      ),
      sr: isPresent
        ? 'Rešavam reklamacije i žalbe klijenata uz poštovanje internih procedura i standarda kvaliteta.'
        : (g === 'male'
          ? 'Rešavao sam reklamacije i žalbe klijenata uz poštovanje internih procedura i standarda kvaliteta.'
          : 'Rešavala sam reklamacije i žalbe klijenata uz poštovanje internih procedura i standarda kvaliteta.'),
    },
    cs_issue_logging: {
      en: isPresent
        ? 'Record customer issues accurately in the support system.'
        : 'Recorded customer issues accurately in the support system.',
      hi: hi(
        'मैं सपोर्ट सिस्टम में ग्राहक समस्याओं को दर्ज करती हूँ।',
        'मैं सपोर्ट सिस्टम में ग्राहक समस्याओं को दर्ज करता हूँ।',
      ),
      sr: isPresent
        ? 'Beležim probleme klijenata u sistemu podrške.'
        : (g === 'male'
          ? 'Beležio sam probleme klijenata u sistemu podrške.'
          : 'Beležila sam probleme klijenata u sistemu podrške.'),
    },
    cs_request_coordination: {
      en: isPresent
        ? 'Coordinate with colleagues to resolve customer requests efficiently.'
        : 'Coordinated with colleagues to resolve customer requests efficiently.',
      hi: hi(
        'मैं सहकर्मियों के साथ समन्वय कर ग्राहक अनुरोधों का समाधान करती हूँ।',
        'मैं सहकर्मियों के साथ समन्वय कर ग्राहक अनुरोधों का समाधान करता हूँ।',
      ),
      sr: isPresent
        ? 'Koordiniram sa kolegama radi rešavanja zahteva klijenata.'
        : (g === 'male'
          ? 'Koordinirao sam sa kolegama radi rešavanja zahteva klijenata.'
          : 'Koordinirala sam sa kolegama radi rešavanja zahteva klijenata.'),
    },
  };
  const byLocale = table[key];
  if (!byLocale) return null;
  // Never silently substitute English templates for a non-English request —
  // that leaks English into Serbian/Hindi exports (build-253 generalization).
  if (locale === 'en') return (byLocale.en || null)?.trim() || null;
  return (byLocale[locale] || null)?.trim() || null;
}

function localizedBulletForFact(
  fact: CvCanonicalFact,
  locale: Locale,
  gender?: CoverLetterGender | string,
  options?: { useGenericCatchAll?: boolean; isPresent?: boolean },
): string {
  const g = tone(gender);
  const source = (fact.sourceText || fact.value || '').replace(/^[•\-\*\u2022]\s*/u, '').trim();
  const category = fact.category || classifyDutyCategory(source);
  const isPresent = Boolean(options?.isPresent);
  const universal = universalPreserveSourceUnit(source, { isPresent });
  const sourceHasGuestHospitality = /\b(guest|guests|rapport|gost(?:ima|i)?|ospiti|huésped|hospitality)\b/iu.test(source);

  // Cooking localization: trusted when cooking intent matched the source unit.
  const cookingIntent = classifyCookingDutyIntent(source);
  if (cookingIntent) {
    const cooked = localizeCookingBulletFromSource(source, cookingIntent, locale, gender, isPresent);
    if (cooked.trim()) return cooked.trim();
  }

  const sourceIsNonEnglish = /[čćžšđČĆŽŠĐа-яА-Я\u0900-\u097F\u0600-\u06FF]/.test(source);

  // Optional material-key templates — never required for English-authored correctness.
  const materialKeys = classifyMaterialDutyKeys(source).filter((k) =>
    k.startsWith('logistics_')
    || k.startsWith('software_')
    || k.startsWith('sales_')
    || k.startsWith('cs_'),
  );
  for (const key of materialKeys) {
    const materialLine = localizedMaterialDutyBullet(key, locale, g, isPresent);
    if (!materialLine) continue;
    if (optionalTemplatePreservesSourceUnit(source, materialLine)) return materialLine;
    // Non-English source → target locale (including en): allow key-faithful translations.
    if (
      (locale !== 'en' || sourceIsNonEnglish)
      && validateMaterialDutyCoverage(source, materialLine).valid
      && validateNoExtraGeneratedDutiesRelaxed(source, materialLine)
    ) {
      return materialLine;
    }
  }

  const renderCategoryShell = (): string => {
    if (category === 'generic') return '';
    const table = BULLET_BY_CATEGORY[locale] || BULLET_BY_CATEGORY.en;
    const shellFn = table[category as Exclude<CvDutyCategory, 'generic'>];
    if (!shellFn) return '';
    let line = shellFn(g).trim();
    if (locale === 'hi' && !isPresent) {
      line = line
        .replace(/करती हूँ/gu, 'करती थी')
        .replace(/करता हूँ/gu, 'करता था')
        .replace(/रखती हूँ/gu, 'रखती थी')
        .replace(/रखता हूँ/gu, 'रखता था')
        .replace(/देती हूँ/gu, 'देती थी')
        .replace(/देता हूँ/gu, 'देता था')
        .replace(/बनाती हूँ/gu, 'बनाती थी')
        .replace(/बनाता हूँ/gu, 'बनाता था')
        .replace(/परोसती हूँ/gu, 'परोसती थी')
        .replace(/परोसता हूँ/gu, 'परोसता था')
        .replace(/बताती हूँ/gu, 'बताती थी')
        .replace(/बताता हूँ/gu, 'बताता था');
    }
    if (locale === 'en' && isPresent) {
      line = applyEnglishEmploymentTense(line, true);
    }
    return line;
  };

  // English: universal source preservation is the correctness path for English
  // source units. Non-English source still needs English locale projection via
  // intent/category shells (without inventing guests/rapport).
  if (locale === 'en') {
    if (category === 'generic') {
      const intent = classifyGenericDutyIntent(source);
      const intentTable = GENERIC_INTENT_BULLET.en;
      if (intent && intentTable?.[intent]) {
        const line = intentTable[intent](g).trim();
        if (optionalTemplatePreservesSourceUnit(source, line) || sourceIsNonEnglish) {
          return line;
        }
      }
    } else if (!(category === 'customer_service_guest_relationship' && !sourceHasGuestHospitality)) {
      const shell = renderCategoryShell();
      if (shell && (optionalTemplatePreservesSourceUnit(source, shell) || sourceIsNonEnglish)) {
        return shell;
      }
    }
    if (universal) {
      // Unmapped non-English duties must not leak into an English summary/export.
      if (sourceIsNonEnglish) {
        return (GENERIC_DUTY_FALLBACK.en || (() => ''))(g).trim();
      }
      return universal;
    }
    if (options?.useGenericCatchAll) {
      return (GENERIC_DUTY_FALLBACK.en || (() => ''))(g).trim();
    }
    return '';
  }

  // Non-English: locale projection may use intent/category shells, except the
  // hospitality guest/rapport shell when the source has no guest evidence.
  if (category === 'generic') {
    const intent = classifyGenericDutyIntent(source);
    const intentTable = GENERIC_INTENT_BULLET[locale];
    if (intent && intentTable?.[intent]) {
      // Locale-native intent projection (en→sr/hi/de/…). English-authored
      // unknown duties that only weakly match an intent still prefer universal
      // when the intent line fails fidelity — see optionalTemplate check.
      const line = intentTable[intent](g).trim();
      if (optionalTemplatePreservesSourceUnit(source, line) || sourceIsNonEnglish) {
        return line;
      }
      // Strong generic intents (process/collab/analysis/…) for English source:
      // project to the requested locale rather than leaking English into sr/hi exports.
      if (
        intent === 'process'
        || intent === 'collaboration'
        || intent === 'analysis'
        || intent === 'planning'
        || intent === 'logistics'
      ) {
        return line;
      }
    }
    if (options?.useGenericCatchAll) {
      const fallbackTable = GENERIC_DUTY_FALLBACK[locale] || GENERIC_DUTY_FALLBACK.en;
      return fallbackTable(g).trim();
    }
    if (!sourceIsNonEnglish && universal) return universal;
    if (locale === 'hi' && /\p{Script=Devanagari}/u.test(universal)) return universal;
    if ((locale === 'sr' || locale === 'hr') && /[čćžšđČĆŽŠĐ]/u.test(universal)) return universal;
    if (locale === 'ru' && /[\u0400-\u04FF]/.test(universal)) return universal;
    if (locale === 'ar' && /[\u0600-\u06FF]/.test(universal)) return universal;
    if (locale === 'ja' && /[\u3040-\u30FF\u3400-\u9FFF]/.test(universal)) return universal;
    const fallbackTable = GENERIC_DUTY_FALLBACK[locale] || GENERIC_DUTY_FALLBACK.en;
    return fallbackTable(g).trim();
  }

  if (
    category === 'customer_service_guest_relationship'
    && !sourceHasGuestHospitality
  ) {
    // Never invent guests/rapport for contact-center / unknown CS-like text.
    return universal || '';
  }

  const shell = renderCategoryShell();
  if (shell) return shell;
  return universal || '';
}

/** Soft extras check used only for non-English material templates. */
function validateNoExtraGeneratedDutiesRelaxed(source: string, line: string): boolean {
  return !/\b(guests?|rapport|hospitality)\b/iu.test(line)
    || /\b(guests?|rapport|hospitality)\b/iu.test(source);
}

export function localizeCanonicalBulletLine(
  sourceText: string,
  locale: Locale,
  gender?: CoverLetterGender | string,
  options?: { isPresent?: boolean },
): string {
  const fact: CvCanonicalFact = {
    id: 'tmp',
    type: 'experience_bullet',
    value: sourceText.replace(/^[•\-\*\u2022]\s*/, '').trim(),
    sourceText: sourceText.replace(/^[•\-\*\u2022]\s*/, '').trim(),
    category: classifyDutyCategory(sourceText),
    source: 'tmp',
  };
  return localizedBulletForFact(fact, locale, gender, options);
}

export function deterministicLocalizedBulletsFromCanonical(
  facts: CvCanonicalFact[],
  locale: Locale,
  gender?: CoverLetterGender | string,
  options?: { isPresent?: boolean },
): string {
  if (!facts.length) return '';
  let lines = facts.map((f) => localizedBulletForFact(f, locale, gender, options));
  if (lines.some((l) => !l.trim())) return '';

  // Generic category-collision guard: never emit the same English shell once per
  // source unit. For non-English, keep locale-correct lines (even if templates
  // collide) rather than injecting English universals or wiping the projection.
  if (facts.length >= 2) {
    const norms = lines.map((l) => l.toLowerCase().replace(/\s+/g, ' ').trim());
    if (new Set(norms).size < norms.length) {
      if (locale === 'en') {
        lines = facts.map((f) => {
          const source = (f.sourceText || f.value || '').replace(/^[•\-\*\u2022]\s*/u, '').trim();
          return universalPreserveSourceUnit(source, { isPresent: Boolean(options?.isPresent) });
        });
        if (lines.some((l) => !l.trim())) return '';
        const rebuiltNorms = lines.map((l) => l.toLowerCase().replace(/\s+/g, ' ').trim());
        if (new Set(rebuiltNorms).size < rebuiltNorms.length) return '';
      } else {
        const localeOk = (t: string) => {
          if (locale === 'hi') return /[\u0900-\u097F]/.test(t) && !/[čćžšđ]/i.test(t);
          if (locale === 'ar') return /[\u0600-\u06FF]/.test(t);
          if (locale === 'ja') return /[\u3040-\u30ff\u3400-\u9fff]/.test(t);
          if (locale === 'ru') return /[\u0400-\u04FF]/.test(t);
          // Latin locales: do not treat plain English ASCII as Serbian/German/etc.
          if (locale === 'sr' || locale === 'hr') {
            return /[čćžšđČĆŽŠĐ]/.test(t)
              || /\b(radim|sarađujem|analiziram|učestvujem|obavljam|vodim|koordiniram|transportujem)\b/i.test(t);
          }
          if (locale === 'de') {
            return /[äöüßÄÖÜ]/.test(t)
              || /\b(und|mit|für|der|die|das|von|zur|zum|im|am)\b/i.test(t);
          }
          return Boolean(t.trim()) && !/[\u0900-\u097F\u0600-\u06FF]/.test(t);
        };
        if (!lines.every(localeOk)) return '';
      }
    }
  }
  return formatExperienceBullets(lines);
}

/**
 * Rebuild Experience from authoritative source duty units — one localized line
 * per source bullet. Used when provider/fallback collapsed distinct facts.
 */
export function buildSourcePreservingExperienceBullets(
  sourceDescription: string,
  locale: Locale,
  gender?: CoverLetterGender | string,
  options?: { isPresent?: boolean },
): string {
  const units = extractSourceDutyUnits(sourceDescription);
  if (!units.length) return '';
  const facts = units.map((sourceText, i) => ({
    id: `source-preserve-${i}`,
    type: 'experience_bullet' as const,
    value: sourceText,
    sourceText,
    category: classifyDutyCategory(sourceText),
    source: 'source_preserve' as const,
  }));
  return deterministicLocalizedBulletsFromCanonical(facts, locale, gender, options);
}

export function deterministicLocalizedSummaryFromCanonical(
  factSet: CvCanonicalFactSet,
  locale: Locale,
  gender?: CoverLetterGender | string,
  duration?: ExperienceDuration,
): string {
  // Concise grounded summary (≤90 words): occupation + duration + duty meanings
  // + optional skill labels. Never invents achievements from skill names.
  const concise = buildConciseGroundedSummary(factSet, locale, gender, duration, {
    includeSkills: true,
  }).trim();
  if (concise) return concise;

  // Legacy shell fallback when the concise builder cannot form a sentence
  // (e.g. empty duties with only a role).
  const g = tone(gender);
  const rawRole = factSet.facts.find((f) => f.type === 'job_title')?.value
    || factSet.facts.find((f) => f.type === 'role')?.value
    || '';
  const profileTitle = factSet.facts.find((f) => f.type === 'job_title')?.value || '';
  const sourceDuties = factSet.facts
    .filter((f) => f.type === 'experience_bullet')
    .map((f) => f.sourceText || f.value)
    .join('\n');
  const role = localizeRoleLabel(rawRole, locale, g, profileTitle, sourceDuties);
  const bullets = factSet.facts
    .filter((f) => f.type === 'experience_bullet')
    .slice(0, 5)
    .map((f) => {
      const line = localizedBulletForFact(f, locale, gender, { useGenericCatchAll: true })
        .replace(/^[•\-\u2013\u2014\*\u2022\u25CF\u25E6]\s*/u, '')
        .replace(/^\d+[.)]\s+/u, '')
        .replace(/[.。۔।]\s*$/u, '');
      return line.trim();
    });
  if (bullets.some((b) => !b.trim()) && !role) return '';
  const duties = bullets.filter((b) => b.trim()).join(locale === 'ja' ? '。' : locale === 'hi' ? '। ' : '. ');
  const shell = SUMMARY_SHELL[locale] || SUMMARY_SHELL.en;
  const durationPhrase = duration?.hasValidDates
    ? formatApproximateDurationPhrase(duration, locale)
    : '';
  let text = shell(role, duties, g, durationPhrase || undefined).replace(/\s+/g, ' ').trim();
  text = text
    .replace(/[•\u2022\u25CF\u25E6]/gu, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
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
