/**
 * Material duty coverage across AI Improvements locales.
 * Every distinct source duty meaning must survive localization unless duplicate.
 */
import { splitExperienceBullets } from './cv-canonical-facts';

export type MaterialDutyKey =
  | 'food_prep'
  | 'hygiene_workplace'
  | 'kitchen_collaboration'
  | 'logistics_transport'
  | 'logistics_loading'
  | 'logistics_delivery'
  | 'process_internal'
  | 'team_collaboration'
  | 'data_analysis'
  | 'reporting'
  | 'software_development'
  | 'software_testing'
  | 'software_documentation'
  | 'sales_prospecting'
  | 'sales_client_communication'
  | 'sales_order_processing'
  | 'healthcare_patient_care'
  | 'healthcare_records'
  | 'healthcare_team'
  | 'generic_duty';

type DutyRule = {
  key: MaterialDutyKey;
  source: RegExp;
  localized: RegExp;
};

const DUTY_RULES: DutyRule[] = [
  {
    key: 'food_prep',
    // Avoid bare "prepare/prepar*" — that matches "prepare reports" and similar.
    source: /priprem\w*.{0,40}(jel|hran|obrok)|jel\w*|dish(?:es)?|cuisine|restaurant\s+standard|prema\s+standardima\s+restorana|व्यंजन|तैयार|(?:zubereit|prépar)\w*.{0,40}(gericht|plat|dish)|(?:prepare|prepared|preparing)\s+(?:dishes|food|meals?|cuisine)/iu,
    localized: /(dish|cuisine|restaurant|jel|kuhinj|व्यंजन|तैयार|रसोई|zubereit|gerichte|plat|piatto|piatti|preparazione|طبق|أطباق|إعداد|блюд|prato|料理|prépar|cook|Gerichten|jela)/iu,
  },
  {
    key: 'hygiene_workplace',
    source: /higijen\w*|hygiene|radn\w*\s+prostor|workstation|workplace|čist|clean|स्वच्छ|कार्यस्थल/iu,
    localized: /(hygiene|higijen|स्वच्छ|कार्यस्थल|workstation|workplace|clean|sauber|limpieza|hygiène|igiene|نظاف|гигиен|чистот|рабоч\w*\s+мест|limpeza|衛生|bar area|radni prostor|Arbeitsplatz|puesto de trabajo|poste de travail|postazione|مكان العمل|local de trabalho)/iu,
  },
  {
    key: 'kitchen_collaboration',
    source: /sara[dđ]\w*.{0,40}(kuhinj|kitchen|tim)|kuhinjsk\w*\s+tim|kitchen\s+team|kolegama?\s+iz\s+kuhinj|रसोई\s*टीम|kitchen\s+colleagues/iu,
    localized: /(kitchen\s+(?:team|colleagues)|kuhinj|रसोई|सहयोग|समन्वय|küchenkolleg|Küchenteam|compañeros de cocina|equipo de cocina|collègues de cuisine|équipe de cuisine|colleghi di cucina|team di cucina|زملاء المطبخ|فريق المطبخ|кухонн|colegas de cozinha|equipe da cozinha|厨房|キッチン(?:チーム)?|collaborat|coordinat|Zusammenarbeit|colaboraci[oó]n|sara[dđ]|surađ)/iu,
  },
  {
    key: 'logistics_transport',
    source: /\b(transport|prevoz|परिवहन)/iu,
    localized: /(transport|prevoz|परिवहन|Beladung|transporte|chargement|trasporto|نقل|перевоз|транспорт|輸送)/iu,
  },
  {
    key: 'logistics_loading',
    source: /\b(load(?:ing|ed)?|utovar|istovar|लोडिंग)/iu,
    localized: /(load|utovar|istovar|लोडिंग|Beladung|carga|chargement|carico|погрузк|carregamento|تحميل|積)/iu,
  },
  {
    key: 'logistics_delivery',
    source: /\b(deliver(?:y|ed|ing)?|isporuč|डिलीवरी|safe(?:ly)?\s+deliver)/iu,
    localized: /(deliver|isporuč|डिलीवरी|Auslieferung|entrega|livraison|consegna|تسليم|доставк|配送|sigurno\s+isporuč)/iu,
  },
  {
    key: 'process_internal',
    source: /internal\s+process|intern\w*\s+proces|razvoj.{0,30}proces|प्रक्रिया/iu,
    localized: /(process|proces|प्रक्रिया|Prozess|proceso|processus|processo|عملية|عمليات|процесс|プロセス)/iu,
  },
  {
    key: 'team_collaboration',
    // Require cross-functional / project-team context — bare "collaborate with
    // other teams" (contact-center escalation) is not this duty.
    source: /cross[- ]?functional|međufunkcional|(collaborat|saradn|sara[dđ]|सहयोग).{0,40}(cross|među|funkcional|functional|project|projek|परियोजना)|परियोजना.{0,40}(सहयोग|collaborat)/iu,
    localized: /(collaborat|colabor|cross[- ]?functional|međufunkcional|saradn|sara[dđ]|सहयोग|Team|équipe|equipo|equipe|فريق|فرق|تعاون|команд|チーム|međufunkcional|multifunc)/iu,
  },
  {
    key: 'data_analysis',
    source: /analy[sz]|analiz|विश्लेषण|poslovne\s+podatke|business\s+data/iu,
    localized: /(analy[sz]|analiz|anális|विश्लेषण|data|podatk|daten|données|dati|بيانات|данн|データ)/iu,
  },
  {
    key: 'reporting',
    source: /report|izveštaj|रिपोर्ट/iu,
    localized: /(report|izveštaj|रिपोर्ट|Bericht|informe|rapport|relatór|отчет|отчёт|تقارير|تقرير|報告)/iu,
  },
  {
    key: 'software_development',
    // Require software/product context — bare "development of internal processes" is not coding.
    source: /\b(react|frontend|backend|typescript|javascript)\b|\b(develop|code|programir)\w*.{0,48}(app|api|feature|software|react|aplikativ)|\b(app|api|feature|software|react|aplikativ).{0,48}(develop|code|program)/iu,
    localized: /(develop|react|code|program|frontend|backend|開発|विकास|Anwendungs|aplikativ|機能)/iu,
  },
  {
    key: 'software_testing',
    source: /\b(test|unit\s+test|qa|परीक्षण)/iu,
    localized: /(test|unit|qa|परीक्षण|テスト)/iu,
  },
  {
    key: 'software_documentation',
    // Require API/software docs — not generic "tehnička dokumentacija".
    source: /\bdocument(?:ation|ed|ing)?\s+(?:apis?|sdk)|\b(?:apis?|sdk)\s+document|\bdocs\b.{0,40}\bapi|API.{0,20}दस्तावेज|दस्तावेज.{0,20}API|\bdokument\w*.{0,30}\bapi/iu,
    localized: /(document|docs|dokument|दस्तावेज|ドキュメント|API)/iu,
  },
  {
    key: 'sales_prospecting',
    source: /\b(prospect|lead\s+gen|pipeline|potencialn\w*\s+klijent|pronalaženje\s+klijen)/iu,
    localized: /(prospect|lead|pipeline|potencial|潜在)/iu,
  },
  {
    key: 'sales_client_communication',
    // Require communicate+client — bare "klijentima" is not a sales duty.
    source: /\b(client\s+communic|customer\s+communic|communic\w*.{0,40}clients?|clients?.{0,40}communic|komunik\w*.{0,40}klijent)/iu,
    localized: /(communic\w*.{0,40}(client|customer|klijent)|client|customer|klijent|cliente|клиент|संचार|संवाद)/iu,
  },
  {
    key: 'sales_order_processing',
    source: /\b(order\s+process|process\w*.{0,40}orders?|orders?.{0,40}process|narudžb|обработ\w*\s+заказ|заказ)/iu,
    localized: /(order|narudžb|pedido|заказ|注文|ऑर्डर|fulfillment|Auftrag)/iu,
  },
  {
    key: 'healthcare_patient_care',
    source: /\b(patient|pacijen|nurs|care)\b/iu,
    localized: /(patient|pacijen|nurs|care|пациент|患者)/iu,
  },
  {
    key: 'healthcare_records',
    source: /\b(medical\s+record|evidenc|chart)\b/iu,
    localized: /(record|evidenc|chart|記録)/iu,
  },
  {
    key: 'healthcare_team',
    source: /\b(care\s+team|medical\s+team|klinick)\b/iu,
    localized: /(team|tim|équipe|チーム)/iu,
  },
];

/** Prefer more specific keys first; skip generic when a specific key matches. */
export function classifyMaterialDutyKeys(text: string): MaterialDutyKey[] {
  const t = (text || '').normalize('NFKC');
  if (!t.trim()) return [];
  const keys: MaterialDutyKey[] = [];
  for (const rule of DUTY_RULES) {
    if (rule.source.test(t)) keys.push(rule.key);
  }
  // Kitchen collaboration is more specific than generic team collaboration.
  if (keys.includes('kitchen_collaboration')) {
    return keys.filter((k) => k !== 'team_collaboration');
  }
  // Prefer documentation/testing over development when those verbs dominate.
  if (keys.includes('software_documentation') && keys.includes('software_development')) {
    return keys.filter((k) => k !== 'software_development');
  }
  if (keys.includes('software_testing') && keys.includes('software_development') && !/\bdevelop/iu.test(t)) {
    return keys.filter((k) => k !== 'software_development');
  }
  if (!keys.length) return ['generic_duty'];
  return keys;
}

export function materialDutyKeysFromDescription(description: string): MaterialDutyKey[] {
  const units = splitExperienceBullets(description);
  const ordered: MaterialDutyKey[] = [];
  const seen = new Set<MaterialDutyKey>();
  for (const unit of units) {
    for (const key of classifyMaterialDutyKeys(unit)) {
      if (key === 'generic_duty') continue;
      if (seen.has(key)) continue;
      seen.add(key);
      ordered.push(key);
    }
  }
  // If every unit was only generic, keep one generic marker so empty≠valid by silence.
  if (!ordered.length && units.length) return ['generic_duty'];
  return ordered;
}

function localizedHasDuty(key: MaterialDutyKey, localized: string): boolean {
  if (key === 'generic_duty') return true;
  const rule = DUTY_RULES.find((r) => r.key === key);
  if (!rule) return true;
  return rule.localized.test(localized);
}

export type MaterialDutyCoverageResult = {
  valid: boolean;
  required: MaterialDutyKey[];
  missing: MaterialDutyKey[];
  reason?: 'missing_canonical_duty';
};

/**
 * Semantic coverage: every material source duty key must appear in localized text.
 * Does not require 1:1 sentence count.
 */
export function validateMaterialDutyCoverage(
  sourceDescription: string,
  localizedDescription: string,
): MaterialDutyCoverageResult {
  const required = materialDutyKeysFromDescription(sourceDescription).filter((k) => k !== 'generic_duty');
  if (!required.length) {
    return { valid: true, required: [], missing: [] };
  }
  const joined = (localizedDescription || '').normalize('NFKC');
  const missing = required.filter((key) => !localizedHasDuty(key, joined));
  if (missing.length) {
    return {
      valid: false,
      required,
      missing,
      reason: 'missing_canonical_duty',
    };
  }
  return { valid: true, required, missing: [] };
}

/** Extra industry duties that must not appear unless the source explicitly supports them. */
const EXTRA_DUTY_CLAIMS: Array<{ label: string; claim: RegExp; support: RegExp }> = [
  {
    label: 'ingredient_or_material_storage',
    claim: /(ingredient[- ]?stor|material[- ]?stor|सामग्री\s*भंडारण|भंडारण\s*प्रक्रिया|skladišt\w*\s+namirnic|Lebensmittel[- ]?Lager|almacenamiento de ingredientes|stockage des ingrédients|conservazione degli ingredienti|تخزين المكونات|хранения продуктов|armazenamento de ingredientes|食材保管)/iu,
    support: /(ingredient|namirnic|skladišt\w*\s+namirnic|भंडारण|Lebensmittel[- ]?Lager|almacen|stockage|conservazione|تخزين|хранен|armazenamento|食材保管|freshness|свежин)/iu,
  },
  {
    label: 'route_planning',
    claim: /(route\s+plan|plan\w*\s+delivery\s+routes?|routing|ruta\s+plan|планирован\w*\s+маршрут|ルート計画)/iu,
    support: /(route\s+plan|routing|ruta|маршрут|ルート)/iu,
  },
  {
    label: 'sales_targets',
    claim: /(sales\s+target|quota|ciljev\w*\s+prodaj|هدف\s+مبيعات|売上目標)/iu,
    support: /(sales\s+target|quota|cilj\w*\s+prodaj|هدف|売上目標)/iu,
  },
  {
    label: 'medication_administration',
    claim: /(medicat(?:ion|e)|administer(?:ed|ing)?\s+drug|primen\w*\s+lek|إعطاء\s+الدواء|投薬)/iu,
    support: /(medicat|drug|lek|دواء|投薬)/iu,
  },
  {
    label: 'prescription_dispensing',
    claim: /(dispens(?:e|ed|ing)|prescription|recept|izdavanj\w*\s+lek)/iu,
    support: /(dispens|prescription|recept|izdavanj)/iu,
  },
  {
    label: 'dosage_interaction_check',
    claim: /(dosag|dozir|drug\s+interaction|interakcij\w*\s+lek|neželjen)/iu,
    support: /(dosag|dozir|interaction|interakcij|neželjen)/iu,
  },
  {
    label: 'patient_therapy_counseling',
    claim: /(patient\s+counsel|savetovan\w*\s+pacijen|terapij|therapy|adverse\s+effect)/iu,
    support: /(patient|pacijen|terapij|therapy|adverse)/iu,
  },
  {
    label: 'medicine_stock_procurement',
    claim: /(medicine\s+stock|zalih\w*\s+lek|procurement|nabavk)/iu,
    support: /(stock|zalih|procurement|nabavk)/iu,
  },
  {
    label: 'doctor_pharmacotherapy',
    claim: /(collaborat\w*\s+with\s+doctors?|saradn\w*\s+sa\s+lekar|pharmacotherapy|farmakoterap)/iu,
    support: /(doctor|lekar|pharmacotherapy|farmakoterap)/iu,
  },
  {
    label: 'safety_inspections',
    claim: /(safety\s+inspection|inspecciones? de seguridad|Sicherheitsinspektion|فحص\s+السلامة|安全点検)/iu,
    support: /(safety\s+inspection|inspeccion|Sicherheitsinspektion|فحص|安全点検)/iu,
  },
];

export type ExtraGeneratedDutyResult = {
  valid: boolean;
  extras: string[];
  reason?: 'unsupported_generated_duty';
};

/**
 * Inverse of coverage: generated text must not introduce material duties
 * absent from the canonical source.
 */
export function validateNoExtraGeneratedDuties(
  sourceDescription: string,
  localizedDescription: string,
): ExtraGeneratedDutyResult {
  const source = (sourceDescription || '').normalize('NFKC');
  const joined = (localizedDescription || '').normalize('NFKC');
  if (!joined.trim()) return { valid: true, extras: [] };
  const extras: string[] = [];
  for (const row of EXTRA_DUTY_CLAIMS) {
    if (row.claim.test(joined) && !row.support.test(source)) {
      extras.push(row.label);
    }
  }
  if (extras.length) {
    return { valid: false, extras, reason: 'unsupported_generated_duty' };
  }
  return { valid: true, extras: [] };
}
