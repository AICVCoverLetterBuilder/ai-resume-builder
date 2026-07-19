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
  | 'cs_inquiry_channels'
  | 'cs_complaint_resolution'
  | 'cs_issue_logging'
  | 'cs_request_coordination'
  | 'warehouse_inbound_check'
  | 'warehouse_records'
  | 'warehouse_movement'
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
    // Require real goods/shipment delivery — never match design "deliverables".
    // Non-Latin delivery tokens (डिलीवरी / تسليم / 配送 / доставк) must not rely on
    // ASCII `\b` or letter lookbehinds — they often sit after native letters.
    source: /(?:\b(?!deliverables?\b)deliver(?:y|ed|ing)?\b|\bisporuč\w*|\bisporuk\w*|डिलीवरी)|safe(?:ly)?\s+deliver(?!able)/iu,
    localized: /(?:\b(?!deliverables?\b)deliver(?:y|ed|ing)?\b|\bisporuč\w*|\bAuslieferung\b|\bentrega\b|\blivraison\b|\bconsegna\b|تسليم|доставк\w*|配送|डिलीवरी|sigurno\s+isporuč\w*)/iu,
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
  {
    key: 'cs_inquiry_channels',
    source: /\b(inquir|enquiry|email|phone|telefon|e-?mail|poziv|upit)\b/iu,
    localized: /(inquir|enquiry|email|phone|telefon|e-?mail|poziv|upit|correo|téléphone|telefono|ईमेल|फोन|प्रश्न)/iu,
  },
  {
    key: 'cs_complaint_resolution',
    source:
      /\b(complaint|reclamation|reklamacij|शिकायत|reclam)|(?:resolv\w*.{0,48}(?:customer\s+)?(?:complaint|issue|problem|žalb)|(?:customer\s+)?(?:complaint|issue|problem|žalb).{0,48}resolv)/iu,
    localized:
      /(complaint|reclamation|reklamacij|शिकायत|issue|problem|žalb|resolv|rešav|समाधान|intern)/iu,
  },
  {
    key: 'cs_issue_logging',
    source:
      /\b(records?|log(?:ged|ging)?|support\s+system|ticketing|evidenc|belež|zabiljež|ticket\s+system|tracking\s+system|customer\s+tracking|conversation|razgovor|वार्तालाप)\b/iu,
    localized:
      /(records?|log|support\s+system|ticket|evidenc|belež|zabiljež|sistema|registr|टिकट|सिस्टम|conversation|razgovor|वार्तालाप|tracking|праћен|ट्रैकिंग)/iu,
  },
  {
    key: 'cs_request_coordination',
    // Contact-center escalation only — do not match kitchen/care "collaborate with the … team".
    source:
      /\b(?:coordinat\w*.{0,56}(?:colleague|coworker|customer|request|koleg|team)|(?:colleague|coworker|koleg).{0,48}(?:coordinat|resolve|request|customer)|(?:collaborat|sara[dđ])\w*.{0,48}(?:colleague|coworker|koleg|(?:other\s+)?teams?).{0,48}(?:customer\s+)?requests?|resolve\w*\s+(?:customer\s+)?requests?)\b/iu,
    localized:
      /(coordinat|colleague|koleg|coworker|team|tim|resolve\w*.{0,24}request|zahtev|zahtjev|customer\s+request|समन्वय|सहकर्मी|सहयोग|अनुरोध|resolve\s+customer)/iu,
  },
  {
    key: 'warehouse_inbound_check',
    source:
      /(?:prover\w*|pregled\w*|check\w*|verif\w*|जाँच|जाच).{0,48}(?:rob\w*|goods?|माल|товар|بضائع|商品)|(?:pristigl\w*|incoming|inbound|आने\s*वाल).{0,40}(?:rob\w*|goods?|माल)|(?:prateć\w*|pratec\w*|accompany\w*|संबंधित).{0,24}(?:dokument|document|दस्तावे)/iu,
    localized:
      /(?:(?:prover\w*|pregled\w*|check\w*|verif\w*|जाँच|जाच|確認|تتحقق|проверя).{0,48}(?:rob\w*|goods?|माल|वस्तु|товар|商品|dokument|document|दस्तावे|وثائق|書類)|(?:rob\w*|goods?|माल|वस्तु|товар|商品|dokument|document|दस्तावे).{0,48}(?:prover\w*|pregled\w*|check\w*|verif\w*|जाँच|जाच|確認|تتحقق|проверя)|(?:pristigl\w*|incoming|inbound|आने\s*वाल).{0,40}(?:rob\w*|goods?|माल)|(?:prateć\w*|accompany\w*|संबंधित).{0,24}(?:dokument|document|दस्तावे))/iu,
  },
  {
    key: 'warehouse_records',
    // Hindi often places the object before the verb (रिकॉर्ड अद्यतन / सामान … व्यवस्थित).
    source:
      /(?:(?:ažur\w*|azur\w*|update\w*|अद्यतन|अपडेट).{0,48}(?:evidenc|skladišt|skladist|warehouse|record|रिकॉर्ड|गोदाम)|(?:evidenc|record|रिकॉर्ड|गोदाम|skladišt|warehouse).{0,48}(?:ažur\w*|azur\w*|update\w*|अद्यतन|अपडेट)|(?:uredn\w*|orderly|व्यवस्थित).{0,40}(?:raspored|arrang|सामान|rob\w*|goods)|(?:सामान|rob\w*|goods).{0,40}(?:uredn\w*|orderly|व्यवस्थित))/iu,
    localized:
      /(?:(?:ažur\w*|azur\w*|update\w*|अद्यतन|अपडेट|تحدّث|обновл|更新).{0,48}(?:evidenc|record|रिकॉर्ड|سجلات|учёт|記録|skladišt|skladist|warehouse|गोदाम|مستودع|склад|倉庫)|(?:evidenc|record|रिकॉर्ड|سجلات|учёт|記録|skladišt|warehouse|गोदाम).{0,48}(?:ažur\w*|azur\w*|update\w*|अद्यतन|अपडेट|تحدّث|обновл|更新)|(?:uredn\w*|orderly|व्यवस्थित|ترتيب|упорядоч).{0,40}(?:raspored|arrang|सामान|rob\w*|goods|товар)|(?:सामान|rob\w*|goods|товар).{0,40}(?:uredn\w*|orderly|व्यवस्थित|ترتيب|упорядоч))/iu,
  },
  {
    key: 'warehouse_movement',
    // Hindi often places समन्वय after the objects (तैयारी और आवाजाही का समन्वय).
    source:
      /(?:(?:koordin\w*|coord\w*|समन्वय).{0,56}(?:priprem|prepar|kretanj|movement|आवाजाही|तैयारी)|(?:priprem\w*|prepar\w*|तैयारी).{0,40}(?:kretanj|movement|आवाजाही|rob\w*|goods|माल)|(?:आवाजाही|kretanj|movement).{0,24}(?:समन्वय|koordin|coord)|(?:माल|rob\w*|goods).{0,40}(?:तैयारी|priprem|prepar|आवाजाही)|(?:koleg\w*|colleague\w*|सहकर्मी).{0,40}(?:rob\w*|goods|माल|kretanj|movement|आवाजाही|तैयारी|समन्वय))/iu,
    localized:
      /(?:(?:koordin\w*|coord\w*|समन्वय|تنسّق|координ|調整).{0,56}(?:priprem|prepar|kretanj|movement|आवाजाही|तैयारी|rob\w*|goods|माल|koleg|colleague|सहकर्मी)|(?:priprem|prepar|तैयारी|kretanj|movement|आवाजाही|rob\w*|goods|माल|koleg|colleague|सहकर्मी).{0,56}(?:koordin\w*|coord\w*|समन्वय|تنسّق|координ|調整)|(?:priprem\w*|prepar\w*|तैयारी).{0,40}(?:kretanj|movement|आवाजाही|rob\w*|goods|माल)|(?:आवाजाही|kretanj|movement).{0,24}(?:समन्वय|koordin|coord)|(?:माल|rob\w*|goods).{0,40}(?:तैयारी|आवाजाही)|(?:koleg\w*|colleague\w*|सहकर्मी|زملاء|коллег).{0,40}(?:rob\w*|goods|माल|kretanj|movement|आवाजाही|तैयारी|समन्वय))/iu,
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
  // Kitchen / care team collaboration must not inherit contact-center CS keys.
  if (keys.includes('kitchen_collaboration')) {
    return keys.filter(
      (k) => k !== 'team_collaboration' && k !== 'generic_duty' && !k.startsWith('cs_'),
    );
  }
  if (keys.includes('healthcare_team')) {
    return keys.filter((k) => k !== 'team_collaboration' && k !== 'generic_duty' && !k.startsWith('cs_'));
  }
  // Warehouse inbound/records/movement — prefer over CS false-hits (koleg+coord).
  if (keys.some((k) => k.startsWith('warehouse_'))) {
    return keys.filter(
      (k) => k.startsWith('warehouse_')
        || (!k.startsWith('cs_')
          && k !== 'generic_duty'
          && k !== 'team_collaboration'
          && k !== 'food_prep'
          && k !== 'hygiene_workplace'
          && k !== 'kitchen_collaboration'),
    );
  }
  // Prefer CS contact-center keys over bare team_collaboration when both match.
  if (keys.some((k) => k.startsWith('cs_'))) {
    return keys.filter((k) => k !== 'team_collaboration' && k !== 'generic_duty');
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
    label: 'guest_rapport_hospitality',
    claim: /\b(guests?|rapport|hospitality|huésped|ospiti|gost(?:ima|i)?)\b/iu,
    support: /\b(guests?|rapport|hospitality|huésped|ospiti|gost(?:ima|i)?)\b/iu,
  },
  {
    label: 'safety_inspections',
    claim: /(safety\s+inspection|inspecciones? de seguridad|Sicherheitsinspektion|فحص\s+السلامة|安全点検)/iu,
    support: /(safety\s+inspection|inspeccion|Sicherheitsinspektion|فحص|安全点検)/iu,
  },
  {
    label: 'invented_software_tools',
    claim: /\b(Excel|Salesforce|Slack|Jira|SAP|Tableau)\b/iu,
    support: /\b(Excel|Salesforce|Slack|Jira|SAP|Tableau)\b/iu,
  },
  {
    label: 'invented_metrics_or_kpi',
    claim: /\b(KPI|OKRs?|ROI)\b/iu,
    support: /\b(KPI|OKRs?|ROI)\b/iu,
  },
  {
    label: 'invented_leadership_team',
    claim: /\b(managed a team|leadership|led a team)\b/iu,
    support: /\b(managed a team|leadership|led a team|team lead)\b/iu,
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

/** Normalize a bullet for exact/near-duplicate comparison (no PII beyond duty text). */
export function normalizeExperienceBulletForCompare(text: string): string {
  return (text || '')
    .normalize('NFKC')
    .replace(/^[•\-\*\u2022]\s*/u, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type DuplicateBulletCheck = {
  ok: boolean;
  distinctCount: number;
  totalCount: number;
  reason?: 'exact_duplicate_bullets' | 'near_duplicate_bullets';
};

/**
 * Hard postcondition: Experience must not apply the same (or near-same) bullet
 * multiple times. Does not merge distinct source duties into one.
 */
export function validateDistinctExperienceBullets(description: string): DuplicateBulletCheck {
  const bullets = splitExperienceBullets(description)
    .map((b) => b.trim())
    .filter(Boolean);
  if (bullets.length <= 1) {
    return { ok: true, distinctCount: bullets.length, totalCount: bullets.length };
  }
  const norms = bullets.map(normalizeExperienceBulletForCompare);
  const unique = new Set(norms);
  if (unique.size < norms.length) {
    return {
      ok: false,
      distinctCount: unique.size,
      totalCount: norms.length,
      reason: 'exact_duplicate_bullets',
    };
  }
  // Near-duplicate: token Jaccard ≥ 0.85 between any pair.
  for (let i = 0; i < norms.length; i += 1) {
    const a = new Set(norms[i].split(' ').filter((t) => t.length > 2));
    for (let j = i + 1; j < norms.length; j += 1) {
      const bTokens = norms[j].split(' ').filter((t) => t.length > 2);
      const b = new Set(bTokens);
      if (!a.size || !b.size) continue;
      let inter = 0;
      for (const t of a) if (b.has(t)) inter += 1;
      const union = a.size + b.size - inter;
      if (union > 0 && inter / union >= 0.85) {
        return {
          ok: false,
          distinctCount: unique.size,
          totalCount: norms.length,
          reason: 'near_duplicate_bullets',
        };
      }
    }
  }
  return { ok: true, distinctCount: unique.size, totalCount: norms.length };
}

/**
 * Apply structured employment tense to an English duty line.
 * Present roles → base/present forms; completed roles → past forms.
 */
export function applyEnglishEmploymentTense(line: string, isPresent: boolean): string {
  let t = (line || '').replace(/^[•\-\*\u2022]\s*/u, '').trim();
  if (!t) return t;
  const pairs: Array<[RegExp, string, string]> = [
    [/^(Responded)\b/i, 'Respond', 'Responded'],
    [/^(Respond)\b/i, 'Respond', 'Responded'],
    [/^(Recorded)\b/i, 'Record', 'Recorded'],
    [/^(Record)\b/i, 'Record', 'Recorded'],
    [/^(Coordinated)\b/i, 'Coordinate', 'Coordinated'],
    [/^(Coordinate)\b/i, 'Coordinate', 'Coordinated'],
    [/^(Collaborated)\b/i, 'Collaborate', 'Collaborated'],
    [/^(Collaborate)\b/i, 'Collaborate', 'Collaborated'],
    [/^(Provided)\b/i, 'Provide', 'Provided'],
    [/^(Provide)\b/i, 'Provide', 'Provided'],
    [/^(Handled)\b/i, 'Handle', 'Handled'],
    [/^(Handle)\b/i, 'Handle', 'Handled'],
    [/^(Resolved)\b/i, 'Resolve', 'Resolved'],
    [/^(Resolve)\b/i, 'Resolve', 'Resolved'],
    [/^(Logged)\b/i, 'Log', 'Logged'],
    [/^(Log)\b/i, 'Log', 'Logged'],
    [/^(Documented)\b/i, 'Document', 'Documented'],
    [/^(Document)\b/i, 'Document', 'Documented'],
    [/^(Assisted)\b/i, 'Assist', 'Assisted'],
    [/^(Assist)\b/i, 'Assist', 'Assisted'],
    [/^(Supported)\b/i, 'Support', 'Supported'],
    [/^(Support)\b(?!ed\b)/i, 'Support', 'Supported'],
    [/^(Maintained)\b/i, 'Maintain', 'Maintained'],
    [/^(Maintain)\b/i, 'Maintain', 'Maintained'],
    [/^(Managed)\b/i, 'Manage', 'Managed'],
    [/^(Manage)\b/i, 'Manage', 'Managed'],
    [/^(Reviewed)\b/i, 'Review', 'Reviewed'],
    [/^(Review)\b/i, 'Review', 'Reviewed'],
    [/^(Updated)\b/i, 'Update', 'Updated'],
    [/^(Update)\b/i, 'Update', 'Updated'],
    [/^(Marked)\b/i, 'Mark', 'Marked'],
    [/^(Mark)\b/i, 'Mark', 'Marked'],
    [/^(Prepared)\b/i, 'Prepare', 'Prepared'],
    [/^(Prepare)\b/i, 'Prepare', 'Prepared'],
    [/^(Operated)\b/i, 'Operate', 'Operated'],
    [/^(Operate)\b/i, 'Operate', 'Operated'],
    [/^(Monitored)\b/i, 'Monitor', 'Monitored'],
    [/^(Monitor)\b/i, 'Monitor', 'Monitored'],
    [/^(Installed)\b/i, 'Install', 'Installed'],
    [/^(Install)\b/i, 'Install', 'Installed'],
    [/^(Taught)\b/i, 'Teach', 'Taught'],
    [/^(Teach)\b/i, 'Teach', 'Taught'],
    [/^(Designed)\b/i, 'Design', 'Designed'],
    [/^(Design)\b/i, 'Design', 'Designed'],
    [/^(Calculated)\b/i, 'Calculate', 'Calculated'],
    [/^(Calculate)\b/i, 'Calculate', 'Calculated'],
    [/^(Cleaned)\b/i, 'Clean', 'Cleaned'],
    [/^(Clean)\b/i, 'Clean', 'Cleaned'],
    [/^(Loaded)\b/i, 'Load', 'Loaded'],
    [/^(Load)\b/i, 'Load', 'Loaded'],
    [/^(Delivered)\b/i, 'Deliver', 'Delivered'],
    [/^(Deliver)\b/i, 'Deliver', 'Delivered'],
    [/^(Tested)\b/i, 'Test', 'Tested'],
    [/^(Test)\b/i, 'Test', 'Tested'],
    [/^(Inspected)\b/i, 'Inspect', 'Inspected'],
    [/^(Inspect)\b/i, 'Inspect', 'Inspected'],
  ];
  for (const [re, presentForm, pastForm] of pairs) {
    if (re.test(t)) {
      t = t.replace(re, isPresent ? presentForm : pastForm);
      break;
    }
  }
  return t;
}

export type ExperienceApplyCoverageCheck = {
  ok: boolean;
  reason?: 'experience_material_fact_coverage_incomplete' | 'exact_duplicate_bullets' | 'near_duplicate_bullets' | 'unsupported_generated_duty';
  required: MaterialDutyKey[];
  covered: MaterialDutyKey[];
  distinctSemanticBulletCount: number;
  finalBulletCount: number;
};

/**
 * Final Experience apply gate: coverage of source material facts + no duplicates
 * + no unsupported hospitality extras when absent from source.
 * Dynamic source-fact identity coverage is enforced by callers via
 * `validateSourceFactIdentityCoverage` (avoids a module cycle).
 */
export function validateExperienceApplyMaterialPostcondition(
  sourceDescription: string,
  candidateDescription: string,
): ExperienceApplyCoverageCheck {
  const sourceKeys = materialDutyKeysFromDescription(sourceDescription)
    .filter((k) => k !== 'generic_duty');
  const dup = validateDistinctExperienceBullets(candidateDescription);
  const coverage = validateMaterialDutyCoverage(sourceDescription, candidateDescription);
  const extras = validateNoExtraGeneratedDuties(sourceDescription, candidateDescription);
  const covered = sourceKeys.filter((k) => !coverage.missing.includes(k));
  const finalBulletCount = splitExperienceBullets(candidateDescription).length;
  const sourceUnitCount = splitExperienceBullets(sourceDescription).filter(Boolean).length
    || (sourceDescription.trim() ? 1 : 0);

  if (!dup.ok) {
    return {
      ok: false,
      reason: dup.reason,
      required: sourceKeys,
      covered,
      distinctSemanticBulletCount: dup.distinctCount,
      finalBulletCount,
    };
  }
  if (!extras.valid) {
    return {
      ok: false,
      reason: 'unsupported_generated_duty',
      required: sourceKeys,
      covered,
      distinctSemanticBulletCount: dup.distinctCount,
      finalBulletCount,
    };
  }
  if (sourceKeys.length > 0 && !coverage.valid) {
    return {
      ok: false,
      reason: 'experience_material_fact_coverage_incomplete',
      required: sourceKeys,
      covered,
      distinctSemanticBulletCount: dup.distinctCount,
      finalBulletCount,
    };
  }
  // Distinct source units must not collapse to one semantic bullet.
  const minDistinct = Math.min(Math.max(sourceKeys.length, sourceUnitCount), 2);
  if (minDistinct >= 2 && dup.distinctCount < minDistinct) {
    return {
      ok: false,
      reason: 'experience_material_fact_coverage_incomplete',
      required: sourceKeys,
      covered,
      distinctSemanticBulletCount: dup.distinctCount,
      finalBulletCount,
    };
  }
  return {
    ok: true,
    required: sourceKeys,
    covered,
    distinctSemanticBulletCount: dup.distinctCount,
    finalBulletCount,
  };
}
