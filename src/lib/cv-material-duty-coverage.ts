/**
 * Material duty coverage across AI Improvements locales.
 * Every distinct source duty meaning must survive localization unless duplicate.
 */
import { splitExperienceBullets } from './cv-canonical-facts';
import { fingerprintText } from './cv-export-diagnostics';
import {
  detectExperienceUnsupportedClaimExpansion,
  type ExperienceUnsupportedClaimKind,
} from './cv-experience-unsupported-claims';
import { sourceHasWarehouseDomainApplicability } from './cv-warehouse-domain-applicability';

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
  | 'design_visual_materials'
  | 'design_review_adapt'
  | 'design_brand_identity'
  | 'design_files_formats'
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
    // Hindi तैयारी (warehouse goods prep) must NOT match — require food anchors or
    // तैयार not followed by ी (तैयारी).
    source: /priprem\w*.{0,40}(jel|hran|obrok)|jel\w*|dish(?:es)?|cuisine|restaurant\s+standard|prema\s+standardima\s+restorana|व्यंजन|तैयार(?!ी)|(?:zubereit|prépar)\w*.{0,40}(gericht|plat|dish)|(?:prepare|prepared|preparing)\s+(?:dishes|food|meals?|cuisine)/iu,
    localized: /(dish|cuisine|restaurant|jel|kuhinj|व्यंजन|तैयार|रसोई|zubereit|gerichte|plat|piatto|piatti|preparazione|طبق|أطباق|إعداد|блюд|prato|料理|prépar|cook|Gerichten|jela)/iu,
  },
  {
    key: 'hygiene_workplace',
    source: /higijen\w*|hygiene|radn\w*\s+prostor|workstation|workplace|čist|clean|स्वच्छ|कार्यस्थल/iu,
    localized: /(hygiene|higijen|स्वच्छ|कार्यस्थल|workstation|workplace|clean|sauber|limpieza|hygiène|igiene|نظاف|гигиен|чистот|рабоч\w*\s+мест|limpeza|衛生|bar area|radni prostor|Arbeitsplatz|puesto de trabajo|poste de travail|postazione|مكان العمل|local de trabalho)/iu,
  },
  {
    key: 'kitchen_collaboration',
    source: /sara[dđ]\w*.{0,48}(kuhinj|kitchen)|kuhinjsk\w*\s+tim|kitchen\s+team|kolegama?\s+iz\s+kuhinj|रसोई\s*टीम|kitchen\s+colleagues/iu,
    localized: /(kitchen\s+(?:team|colleagues)|kuhinj|रसोई|सहयोग|समन्वय|küchenkolleg|Küchenteam|compañeros de cocina|equipo de cocina|collègues de cuisine|équipe de cuisine|colleghi di cucina|team di cucina|زملاء المطبخ|فريق المطبخ|кухонн|команд[\p{L}-]*\s+кухн|colegas de cozinha|equipe da cozinha|厨房|キッチン(?:チーム)?|collaborat|coordinat|Zusammenarbeit|colaboraci[oó]n|sara[dđ]|surađ)/iu,
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
    localized: /(medical\s+record|診療記録|カルテ|chart|медицинск)/iu,
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
    // Hindi object-before-verb: माल … जाँच/जांच. Never use ASCII \b around Devanagari.
    // जाँच (chandrabindu) and जांच (anusvara) are both live Android spellings.
    // Require goods/receipt/warehouse evidence — bare document/data checking is not warehouse.
    source:
      /(?:(?:prover\w*|provjer\w*|pregled\w*|check\w*|verif\w*|revisa|comprueba|controla|जाँच|जांच|जाच|تتحقق|تحقّقت|يتحقق|فحص|تسجيل|проверя).{0,48}(?:rob\w*|goods?|माल|товар|بضائع|商品|mercanc[ií]a|zaprimljen\w*|ulazn\w*\s+rob)|(?:rob\w*|goods?|माल|товар|بضائع|واردة|商品|mercanc[ií]a|zaprimljen\w*|сопроводительн).{0,48}(?:prover\w*|provjer\w*|pregled\w*|check\w*|verif\w*|revisa|comprueba|controla|जाँच|जांच|जाच|تتحقق|تحقّقت|يتحقق|فحص|تسجيل|проверя)|(?:pristigl\w*|incoming|inbound|आने\s*वाल|واردة|поступающ|zaprimljen\w*|entrant(?:e|es)|recepci[oó]n\s+de\s+mercanc).{0,40}(?:rob\w*|goods?|माल|بضائع|товар|mercanc[ií]a)|(?:(?:prateć\w*|pratec\w*|popratn\w*|accompany\w*|संबंधित|مرفق|сопроводительн|relacionad\w*).{0,40}(?:dokument|document|documentaci[oó]n|documentos|registros|दस्तावे|وثائق|документ))|(?:(?:dokument|document|documentaci[oó]n|documentos|registros|दस्तावे|وثائق|документ).{0,40}(?:prover\w*|provjer\w*|pregled\w*|check\w*|verif\w*|revisa|comprueba|controla|जाँच|जांच|जाच|تتحقق|فحص|संबंधित|مرفق|проверя|сопроводительн|relacionad\w*).{0,32}(?:rob\w*|goods?|zaprimljen\w*|skladišt\w*|warehouse|almac[eé]n|माल|بضائع|товар|商品|mercanc[ií]a)))/iu,
  // Japanese warehouse cues in DUTY_RULES localized patterns
  localized:
      /(?:(?:prover\w*|provjer\w*|pregled\w*|check\w*|verif\w*|revisa|comprueba|controla|जाँच|जांच|जाच|確認|تتحقق|تحقّقت|يتحقق|فحص|проверя|入荷|prüf\w*|kontroll\w*|überprüf\w*).{0,48}(?:rob\w*|goods?|माल|वस्तु|товар|بضائع|واردة|商品|mercanc[ií]a|zaprimljen\w*|skladišt\w*|сопроводительн|関連書類|添付書類|Waren|Wareneingang|eingehend\w*\s+Waren|Lieferungen)|(?:rob\w*|goods?|माल|वस्तु|товар|بضائع|واردة|商品|mercanc[ií]a|zaprimljen\w*|skladišt\w*|сопроводительн|関連書類|添付書類|Waren|Wareneingang).{0,48}(?:prover\w*|provjer\w*|pregled\w*|check\w*|verif\w*|revisa|comprueba|controla|जाँच|जांच|जाच|確認|تتحقق|تحقّقت|فحص|проверя|prüf\w*|kontroll\w*|überprüf\w*)|(?:pristigl\w*|incoming|inbound|आने\s*वाल|واردة|поступающ|入荷|zaprimljen\w*|eingehend|entrant(?:e|es)|recepci[oó]n).{0,40}(?:rob\w*|goods?|माल|بضائع|товар|商品|Waren|mercanc[ií]a)|(?:prateć\w*|popratn\w*|accompany\w*|संबंधित|مرفق|сопроводительн|関連書類|添付書類|zugehörig|dazugehörig|begleitend|relacionad\w*).{0,40}(?:dokument|document|documentaci[oó]n|documentos|registros|दस्तावे|وثائق|документ|Unterlagen|Dokumente|Aufzeichnungen|Belege))/iu,
  },
  {
    key: 'warehouse_records',
    // Hindi often places the object before the verb (रिकॉर्ड अद्यतन / सामान … व्यवस्थित).
    source:
      /(?:(?:ažur\w*|azur\w*|update\w*|अद्यतन|अपडेट|تحدّث|حدّثت?|يحدّث|обновл|поддержива).{0,48}(?:evidenc|skladišt|skladist|warehouse|record|रिकॉर्ड|गोदाम|سجلات|مستودع|складск|запис|учёт|учет|поряд)|(?:evidenc|record|रिकॉर्ड|गोदाम|سجلات|مستودع|skladišt|warehouse|складск|запис).{0,48}(?:ažur\w*|azur\w*|update\w*|अद्यतन|अपडेट|обновл|поддержива)|(?:uredn\w*|orderly|व्यवस्थित|ترتيب|تحافظ|حافظت?|поряд|размещен).{0,40}(?:raspored|arrang|सामान|rob\w*|goods|بضائع|товар)|(?:सामान|rob\w*|goods|بضائع|товар).{0,40}(?:uredn\w*|orderly|व्यवस्थित|ترتيب|поряд|размещен))/iu,
    localized:
      /(?:(?:ažur\w*|azur\w*|update\w*|अद्यतन|अपडेट|تحدّث|حدّثت?|يحدّث|تحديث|обновл|更新|поддержива|prüf\w*|kontroll\w*|überprüf\w*).{0,48}(?:evidenc|record|रिकॉर्ड|سجلات|учёт|учет|запись|записи|запис|記録|skladišt|skladist|warehouse|गोदाम|مستودع|склад|倉庫|поряд|Unterlagen|Dokumente|Aufzeichnungen|Belege|Lagerunterlagen)|(?:evidenc|record|रिकॉर्ड|سجلات|учёт|учет|запись|записи|запис|記録|skladišt|warehouse|गोदाम|مستودع|складск|Unterlagen|Dokumente|Aufzeichnungen|Belege).{0,48}(?:ažur\w*|azur\w*|update\w*|अद्यतन|अपडेट|تحدّث|حدّثت?|يحدّث|تحديث|обновл|更新|поддержива|prüf\w*|kontroll\w*|überprüf\w*)|(?:uredn\w*|orderly|व्यवस्थित|ترتيب|упорядоч|تحافظ|حافظت?|поряд|размещен|geordnet).{0,40}(?:raspored|arrang|सामान|rob\w*|goods|بضائع|товар|Waren)|(?:सामान|rob\w*|goods|بضائع|товар|Waren).{0,40}(?:uredn\w*|orderly|व्यवस्थित|ترتيب|упорядоч|поряд|размещен|geordnet))/iu,
  },
  {
    key: 'warehouse_movement',
    // Hindi often places समन्वय after the objects (तैयारी और आवाजाही का समन्वय).
    // सहकर्मियों (oblique plural) must match — do not require ASCII \b.
    source:
      /(?:(?:koordin\w*|coord\w*|समन्वय|تنسّق|نسّقت?|ينسّق|координир|согласов).{0,56}(?:priprem|prepar|kretanj|movement|आवाजाही|तैयारी|إعداد|تجهيز|حركة|بضائع|подготов|перемещен|коллег|товар)|(?:priprem\w*|prepar\w*|तैयारी|إعداد|تجهيز|подготов).{0,40}(?:kretanj|movement|आवाजाही|rob\w*|goods|माल|حركة|بضائع|товар|перемещен)|(?:आवाजाही|kretanj|movement|حركة|перемещен).{0,24}(?:समन्वय|koordin|coord|تنسّق|координир)|(?:माल|rob\w*|goods|بضائع|товар).{0,40}(?:तैयारी|priprem|prepar|आवाजाही|إعداد|حركة|подготов|перемещен)|(?:koleg\w*|colleague\w*|सहकर्मी|زملاء|коллег).{0,48}(?:rob\w*|goods|माल|بضائع|kretanj|movement|आवाजाही|तैयारी|समन्वय|إعداد|حركة|подготов|перемещен|координир)|(?:rob\w*|goods|माल|kretanj|movement|आवाजाही|तैयारी|подготов|перемещен).{0,48}(?:koleg\w*|colleague\w*|सहकर्मी|समन्वय|коллег))/iu,
    localized:
      /(?:(?:koordin\w*|coord\w*|समन्वय|تنسّق|نسّقت?|ينسّق|تنسيق|координ|согласов|調整|Koordinier|Stimmt\s+ab|Abstimmung).{0,56}(?:priprem|prepar|kretanj|movement|आवाजाही|तैयारी|إعداد|تجهيز|حركة|rob\w*|goods|माल|بضائع|koleg|colleague|सहकर्मी|زملاء|подготов|перемещен|коллег|Vorbereitung|Bewegung|Transport|Waren|Kolleg)|(?:priprem|prepar|तैयारी|إعداد|تجهيز|kretanj|movement|आवाजाही|حركة|rob\w*|goods|माल|بضائع|koleg|colleague|सहकर्मी|زملاء|подготов|перемещен|коллег|Vorbereitung|Bewegung|Transport|Waren|Kolleg).{0,56}(?:koordin\w*|coord\w*|समन्वय|تنسّق|نسّقت?|ينسّق|تنسيق|координ|согласов|調整|Koordinier|Stimmt\s+ab)|(?:priprem\w*|prepar\w*|तैयारी|إعداد|تجهيز|подготов|Vorbereitung).{0,40}(?:kretanj|movement|आवाजाही|حركة|rob\w*|goods|माल|بضائع|товар|перемещен|Bewegung|Transport|Waren)|(?:आवाजाही|kretanj|movement|حركة|перемещен|Bewegung).{0,24}(?:समन्वय|koordin|coord|تنسّق|تنسيق|координ|Koordinier)|(?:माल|rob\w*|goods|بضائع|товар|Waren).{0,40}(?:तैयारी|إعداد|आवाजाही|حركة|подготов|перемещен|Vorbereitung|Bewegung)|(?:koleg\w*|colleague\w*|सहकर्मी|زملاء|коллег|Kolleg\w*).{0,48}(?:rob\w*|goods|माल|بضائع|kretanj|movement|आवाजाही|तैयारी|समन्वय|إعداد|حركة|подготов|перемещен|Waren|Vorbereitung|Bewegung))/iu,
  },
  {
    key: 'design_visual_materials',
    source:
      /(?:visual\s+materials?|graphic\s+elements?|materiales?\s+visuales?|elementos?\s+gr[aá]ficos?|mat[eé]riaux?\s+visuels?|[eé]l[eé]ments?\s+graphiques?|materiali\s+visivi|elementi\s+grafici|materiais?\s+visuais?|visuelle?\s+Materialien|grafische?\s+Elemente|vizueln\w*\s+materijal|grafi[cč]k\w*\s+element|दृश्य\s*सामग्री|ग्राफिक\s*तत्व|مواد\s*بصرية|عناصر\s*رسومية|مطبوعة\s*ورقمية|print\s+and\s+digital|визуальн[а-яёА-ЯЁ]*\s+материал|графическ[а-яёА-ЯЁ]*\s+элемент)/iu,
    localized:
      /(?:visual\s+materials?|graphic\s+elements?|materiales?\s+visuales?|elementos?\s+gr[aá]ficos?|mat[eé]riaux?\s+visuels?|[eé]l[eé]ments?\s+graphiques?|materiali\s+visivi|elementi\s+grafici|materiais?\s+visuais?|visuelle?\s+Materialien|grafische?\s+Elemente|vizueln\w*\s+materijal|grafi[cč]k\w*\s+element|दृश्य\s*सामग्री|ग्राफिक\s*तत्व|مواد\s*بصرية|عناصر\s*رسومية|визуальн[а-яё]*\s+материал|графическ[а-яё]*\s+элемент|дизайн-?материал|ビジュアル素材|視覚素材|グラフィック要素|デザイン素材)/iu,
  },
  {
    key: 'design_review_adapt',
    // Arabic: never treat bare راجع/مراجعة (e.g. bicycle inspection) as design —
    // require design/adapt/project-requirements co-evidence (same as EN/RU).
    source:
      /(?:review\w*.{0,40}(?:design|dizajn|dise[nñ]o)|adapt\w*.{0,40}(?:design|dizajn|dise[nñ]o)|revis\w*.{0,40}(?:dise[nñ]o|design)|adapt\w*.{0,40}materiales?\s+de\s+dise[nñ]o|materiales?\s+de\s+dise[nñ]o|आवश्यकताओं.{0,40}डिज़ाइन|(?:مراجعة|راجع(?:ت)?).{0,48}(?:تصميم|تكيّف|كيّف|مواد\s*التصميم|متطلبات\s*المشروع)|تكيّف|كيّفت?|requirements?.{0,40}design|проверя\w*.{0,40}адаптир|адаптир\w*.{0,40}(?:дизайн|требовани)|требовани\w*\s+проекта)/iu,
    // Never treat bare "проверя/review" as adaptation — require adapt / project-requirements evidence.
    localized:
      /(?:adapt\w*.{0,40}(?:design|dizajn|dise[nñ]o|материал|Design)|prilago[dđ]|passte?\s+.{0,40}an|anpasst|revis\w*.{0,40}(?:dise[nñ]o|design)|materiales?\s+de\s+dise[nñ]o|matériaux?\s+de\s+design|materiali\s+di\s+design|अनुकूलन|تكيّف|كيّفت?|адаптир\w*.{0,40}(?:дизайн|требовани|материал)|(?:مراجعة|راجع(?:ت)?).{0,48}(?:تصميم|تكيّف|كيّف|مواد\s*التصميم|متطلبات\s*المشروع)|(?:проверя\w*|review\w*|pregled\w*|समीक्षा).{0,48}адаптир|(?:требовани\w*\s+проекта|project\s+requirements?|متطلبات\s*المشروع|आवश्यकताओं|Projektanforderungen)|(?:確認|レビュー).{0,24}(?:調整|適合)|要件に合わせて)/iu,
  },
  {
    key: 'design_brand_identity',
    source:
      /(?:visual\s+identity|brand\s+(?:guidelines?|identity)|दृश्य\s*पहचान|ब्रांड|الهوية\s*البصرية|إرشادات\s*العلامة)/iu,
    localized:
      /(?:visual\s+identity|brand|दृश्य\s*पहचान|ब्रांड|الهوية\s*البصرية|إرشادات\s*العلامة|бренд|визуальн(?:ая|ой)?\s+идентичн)/iu,
  },
  {
    key: 'design_files_formats',
    source:
      /(?:design\s+files?|final\s+design|archivos?\s+finales?(?:\s+de\s+dise[nñ]o)?|fichiers?\s+finaux|file\s+finali|arquivos?\s+finais|dizajn\s*fajl|डिज़ाइन\s*फ़ाइल|ملفات\s*التصميم|صيغ\s*التصميم|formats?\s+for\s+different|formatos?\s+y\s+pantallas|дизайн-?файл|финальн\w*\s+дизайн|формат\w*.{0,40}экран|подготавлива\w*.{0,40}файл)/iu,
    // Bare "экран" / generic "материалы" must not satisfy final files/formats.
    localized:
      /(?:design\s+files?|archivos?\s+finales?(?:\s+de\s+dise[nñ]o)?|fichiers?\s+finaux|file\s+finali|arquivos?\s+finais|finale?\s+Designdateien|Designdateien|dizajn\s*fajl|završn\w*\s+(?:dizajnersk\w*\s+)?datotek|datotek\w*.{0,40}format|format\w*.{0,40}(?:zaslon|ekran|Bildschirm|écrans?|schermi|telas?)|डिज़ाइन\s*फ़ाइल|ملفات\s*التصميم|صيغ\s*التصميم|дизайн-?файл|финальн[а-яё]*\s+дизайн-?файл|файл[а-яё]*.{0,32}дизайн|формат[а-яё]*.{0,40}экран|экран[а-яё]*.{0,32}формат|подготавлива[а-яё]*.{0,40}файл|настраива[а-яё]*.{0,40}формат|最終(?:デザイン)?ファイル|デザインファイル|形式|フォーマット|画面)/iu,
  },
];

/** Runtime marker — Russian Experience material model (must remain in packaged assets). */
export const RUSSIAN_EXPERIENCE_MATERIAL_REVISION = 'russian-experience-material-v1' as const;
void RUSSIAN_EXPERIENCE_MATERIAL_REVISION;
/** Runtime marker — Japanese Experience material model (must remain in packaged assets). */
export const JAPANESE_EXPERIENCE_MATERIAL_REVISION = 'japanese-experience-material-v1' as const;
void JAPANESE_EXPERIENCE_MATERIAL_REVISION;
/** Runtime marker — Croatian Experience material model. */
export const CROATIAN_EXPERIENCE_MATERIAL_REVISION = 'croatian-experience-material-v1' as const;
void CROATIAN_EXPERIENCE_MATERIAL_REVISION;
/** Runtime marker — Croatian vs Serbian locale discrimination. */
export const CROATIAN_SERBIAN_LOCALE_DISCRIMINATION_REVISION =
  'croatian-serbian-locale-discrimination-v1' as const;
void CROATIAN_SERBIAN_LOCALE_DISCRIMINATION_REVISION;
/** Runtime marker — role/domain-aware material classification (build 291). */
export const CROATIAN_ROLE_AWARE_MATERIAL_CLASSIFIER_REVISION =
  'croatian-role-aware-material-classifier-291-v1' as const;
void CROATIAN_ROLE_AWARE_MATERIAL_CLASSIFIER_REVISION;
/** Runtime marker — poisoned Serbian live design source recovery. */
export const CROATIAN_DESIGN_POISONED_SOURCE_RECOVERY_REVISION =
  'croatian-design-poisoned-source-recovery-291-v1' as const;
void CROATIAN_DESIGN_POISONED_SOURCE_RECOVERY_REVISION;
/** Runtime marker — Croatian design family rebuild routing. */
export const CROATIAN_DESIGN_FALLBACK_ROUTING_REVISION =
  'croatian-design-fallback-routing-291-v1' as const;
void CROATIAN_DESIGN_FALLBACK_ROUTING_REVISION;
/** Runtime marker — Russian design three-family coverage (build 286). */
export const RUSSIAN_DESIGN_FAMILIES_REVISION = 'russian-design-families-286-v1' as const;
void RUSSIAN_DESIGN_FAMILIES_REVISION;
/** Runtime marker — Russian design fallback routing (rebuild, not source-preserving). */
export const RUSSIAN_DESIGN_FALLBACK_ROUTING_REVISION =
  'russian-design-fallback-routing-287-v1' as const;
void RUSSIAN_DESIGN_FALLBACK_ROUTING_REVISION;

/** Authoritative design material keys used by Summary/Experience family accounting. */
export const RUSSIAN_AUTHORITATIVE_DESIGN_MATERIAL_KEYS = [
  'design_visual_materials',
  'design_graphic_elements',
  'design_review_adapt',
  'design_project_requirements',
  'design_files_formats',
  'design_different_screens',
] as const;

export const RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT = 3 as const;

export function isRussianDesignFamilyRejectionReason(reason: string | null | undefined): boolean {
  const r = String(reason || '');
  return r === 'russian_design_generic_duty'
    || r === 'russian_design_family_coverage_incomplete'
    || r === 'russian_design_family_incomplete'
    || r === 'russian_design_semantic_duplicate'
    || r === 'russian_design_family_rebuild_failed';
}
/** Fine-grained Hindi warehouse cues for per-unit diagnostics (aliases of the 3 keys). */
export type WarehouseMaterialCueKey =
  | 'warehouse_inbound_check'
  | 'warehouse_document_check'
  | 'warehouse_records'
  | 'warehouse_orderly_goods'
  | 'warehouse_preparation'
  | 'warehouse_movement'
  | 'warehouse_colleague_coordination';

const HINDI_WAREHOUSE_CUE_RULES: Array<{ key: WarehouseMaterialCueKey; re: RegExp }> = [
  { key: 'warehouse_inbound_check', re: /(?:आने\s*वाल).{0,40}माल|(?:माल).{0,40}(?:जाँच|जांच|जाच)|(?:जाँच|जांच|जाच).{0,40}माल/u },
  { key: 'warehouse_document_check', re: /(?:संबंधित).{0,40}दस्तावे|(?:दस्तावे).{0,40}(?:जाँच|जांच|जाच|संबंधित)/u },
  { key: 'warehouse_records', re: /(?:गोदाम).{0,48}(?:रिकॉर्ड|अद्यतन)|(?:रिकॉर्ड).{0,48}अद्यतन|अद्यतन.{0,48}(?:रिकॉर्ड|गोदाम)/u },
  { key: 'warehouse_orderly_goods', re: /(?:सामान).{0,40}व्यवस्थित|व्यवस्थित.{0,40}सामान/u },
  { key: 'warehouse_preparation', re: /(?:माल).{0,40}तैयारी|तैयारी.{0,40}(?:माल|आवाजाही)/u },
  { key: 'warehouse_movement', re: /आवाजाही|(?:माल).{0,40}आवाजाही/u },
  { key: 'warehouse_colleague_coordination', re: /सहकर्मी[\u0900-\u097F]{0,12}.{0,80}समन्वय|समन्वय.{0,80}सहकर्मी/u },
];

export function hindiWarehouseCueKeysFromUnit(unit: string): WarehouseMaterialCueKey[] {
  const t = (unit || '').normalize('NFKC');
  if (!t.trim()) return [];
  const out: WarehouseMaterialCueKey[] = [];
  for (const rule of HINDI_WAREHOUSE_CUE_RULES) {
    if (rule.re.test(t)) out.push(rule.key);
  }
  return out;
}

/** Fine-grained Arabic warehouse cues for per-unit diagnostics. */
const ARABIC_WAREHOUSE_CUE_RULES: Array<{ key: WarehouseMaterialCueKey; re: RegExp }> = [
  { key: 'warehouse_inbound_check', re: /(?:البضائع\s*الواردة|واردة)|(?:تتحقق|تحقّقت|فحص).{0,40}(?:بضائع|وثائق)|(?:بضائع|وثائق).{0,40}(?:تتحقق|تحقّقت|فحص|تسجيل)/u },
  { key: 'warehouse_document_check', re: /الوثائق\s*المرفقة|وثائق.{0,24}مرفق|مرفق.{0,24}وثائق/u },
  { key: 'warehouse_records', re: /سجلات\s*المستودع|(?:تحدّث|حدّثت).{0,40}سجلات|سجلات.{0,40}(?:تحدّث|حدّثت|تحديث)/u },
  { key: 'warehouse_orderly_goods', re: /ترتيب\s*البضائع|(?:تحافظ|حافظت).{0,40}ترتيب/u },
  { key: 'warehouse_preparation', re: /(?:إعداد|تجهيز)\s*البضائع|البضائع.{0,24}(?:إعداد|تجهيز)/u },
  { key: 'warehouse_movement', re: /حركة\s*البضائع|حركتها|(?:البضائع).{0,24}حركة/u },
  { key: 'warehouse_colleague_coordination', re: /(?:تنسّق|نسّقت).{0,48}زملاء|زملاء.{0,48}(?:تنسّق|نسّقت|تنسيق)/u },
];

export function arabicWarehouseCueKeysFromUnit(unit: string): WarehouseMaterialCueKey[] {
  const t = (unit || '').normalize('NFKC');
  if (!t.trim()) return [];
  const out: WarehouseMaterialCueKey[] = [];
  for (const rule of ARABIC_WAREHOUSE_CUE_RULES) {
    if (rule.re.test(t)) out.push(rule.key);
  }
  return out;
}

/** Fine-grained Russian warehouse cues (morphology-aware). */
const RUSSIAN_WAREHOUSE_CUE_RULES: Array<{ key: WarehouseMaterialCueKey; re: RegExp }> = [
  {
    key: 'warehouse_inbound_check',
    re: /(?:поступающ\w*.{0,24}товар|товар\w*.{0,24}поступающ|проверя\w*.{0,40}(?:товар|документ)|(?:товар|документ).{0,40}проверя)/iu,
  },
  {
    key: 'warehouse_document_check',
    re: /сопроводительн\w*\s+документ|документ\w*.{0,24}сопроводительн/iu,
  },
  {
    key: 'warehouse_records',
    re: /(?:обновл\w*.{0,40}(?:складск\w*\s+)?запис|складск\w*\s+запис|запис\w*.{0,40}обновл|учёт|учет)/iu,
  },
  {
    key: 'warehouse_orderly_goods',
    re: /(?:поддержива\w*.{0,40}поряд|поряд\w*.{0,40}(?:размещен|товар)|организованн\w*\s+размещен|упорядоч)/iu,
  },
  {
    key: 'warehouse_preparation',
    re: /(?:подготов\w*.{0,40}товар|товар\w*.{0,40}подготов)/iu,
  },
  {
    key: 'warehouse_movement',
    re: /перемещен\w*(?:.{0,40}товар|.{0,40}склад)|товар\w*.{0,40}перемещен/iu,
  },
  {
    key: 'warehouse_colleague_coordination',
    re: /(?:координир\w*|согласов\w*).{0,48}коллег|коллег\w*.{0,48}(?:координир|согласов|подготов|перемещен)/iu,
  },
];

export function russianWarehouseCueKeysFromUnit(unit: string): WarehouseMaterialCueKey[] {
  void RUSSIAN_EXPERIENCE_MATERIAL_REVISION;
  const t = (unit || '').normalize('NFKC');
  if (!t.trim()) return [];
  const out: WarehouseMaterialCueKey[] = [];
  for (const rule of RUSSIAN_WAREHOUSE_CUE_RULES) {
    if (rule.re.test(t)) out.push(rule.key);
  }
  return out;
}

/** Fine-grained Japanese warehouse cues. */
const JAPANESE_WAREHOUSE_CUE_RULES: Array<{ key: WarehouseMaterialCueKey; re: RegExp }> = [
  {
    key: 'warehouse_inbound_check',
    re: /入荷|関連書類|添付書類|(?:商品|品物).{0,24}(?:確認|正確)|(?:書類).{0,16}確認|正確性/u,
  },
  {
    key: 'warehouse_document_check',
    re: /関連書類|添付書類|書類確認|書類の照合/u,
  },
  {
    key: 'warehouse_records',
    re: /倉庫記録|在庫記録|(?:記録).{0,12}更新|(?:更新).{0,12}(?:記録|倉庫)/u,
  },
  {
    key: 'warehouse_orderly_goods',
    re: /整理|配置|保管|(?:整然).{0,16}(?:配置|保管)|保管状態/u,
  },
  {
    key: 'warehouse_preparation',
    re: /(?:商品|品物).{0,16}準備|準備.{0,16}(?:商品|品物)/u,
  },
  {
    key: 'warehouse_movement',
    re: /移動|倉庫内|(?:商品|品物).{0,16}移動/u,
  },
  {
    key: 'warehouse_colleague_coordination',
    re: /同僚.{0,24}(?:連携|調整)|(?:連携|調整).{0,24}同僚/u,
  },
];

export function japaneseWarehouseCueKeysFromUnit(unit: string): WarehouseMaterialCueKey[] {
  void JAPANESE_EXPERIENCE_MATERIAL_REVISION;
  const t = (unit || '').normalize('NFKC');
  if (!t.trim()) return [];
  const out: WarehouseMaterialCueKey[] = [];
  for (const rule of JAPANESE_WAREHOUSE_CUE_RULES) {
    if (rule.re.test(t)) out.push(rule.key);
  }
  return out;
}

export type DesignMaterialCueKey =
  | 'design_visual_materials'
  | 'design_graphic_elements'
  | 'design_review_adapt'
  | 'design_project_requirements'
  | 'design_brand_identity'
  | 'design_files_formats'
  | 'design_different_screens'
  | 'design_team_collaboration';

const ARABIC_DESIGN_CUE_RULES: Array<{ key: DesignMaterialCueKey; re: RegExp }> = [
  { key: 'design_visual_materials', re: /مواد\s*بصرية|عناصر\s*رسومية|مواد\s*مطبوعة|رقمية/u },
  { key: 'design_graphic_elements', re: /عناصر\s*رسومية/u },
  { key: 'design_review_adapt', re: /(?:مراجعة|راجعت?).{0,48}(?:تصميم|تكيّف|كيّف|مواد\s*التصميم|متطلبات\s*المشروع)|تكيّف|كيّفت|متطلبات\s*المشروع/u },
  { key: 'design_project_requirements', re: /متطلبات\s*المشروع/u },
  { key: 'design_brand_identity', re: /الهوية\s*البصرية|إرشادات\s*العلامة/u },
  { key: 'design_files_formats', re: /ملفات\s*التصميم|صيغ\s*التصميم/u },
  { key: 'design_different_screens', re: /شاشات\s*مختلفة|لشاشات/u },
  { key: 'design_team_collaboration', re: /(?:تعاون|تنسيق|نسّقت).{0,40}(?:فريق|زملاء)|(?:فريق|زملاء).{0,40}(?:تعاون|تنسيق)/u },
];

export function arabicDesignCueKeysFromUnit(unit: string): DesignMaterialCueKey[] {
  const t = (unit || '').normalize('NFKC');
  if (!t.trim()) return [];
  const out: DesignMaterialCueKey[] = [];
  for (const rule of ARABIC_DESIGN_CUE_RULES) {
    if (rule.re.test(t)) out.push(rule.key);
  }
  return out;
}

const RUSSIAN_DESIGN_CUE_RULES: Array<{ key: DesignMaterialCueKey; re: RegExp }> = [
  {
    key: 'design_visual_materials',
    re: /визуальн[а-яё]*\s+материал|дизайн-?материал/iu,
  },
  {
    key: 'design_graphic_elements',
    re: /графическ[а-яё]*\s+элемент/iu,
  },
  {
    key: 'design_review_adapt',
    re: /(?:проверя[а-яё]*.{0,40}адаптир|адаптир[а-яё]*.{0,40}(?:дизайн|требовани|материал)|требовани[а-яё]*\s+проекта)/iu,
  },
  {
    key: 'design_project_requirements',
    re: /требовани[а-яё]*\s+проекта|в\s+соответствии\s+с\s+требованиями/iu,
  },
  {
    key: 'design_files_formats',
    re: /(?:финальн[а-яё]*\s+)?дизайн-?файл|файл[а-яё]*.{0,40}дизайн|формат[а-яё]*.{0,40}экран|экран[а-яё]*.{0,24}формат|подготавлива[а-яё]*.{0,40}файл|настраива[а-яё]*.{0,40}формат/iu,
  },
  {
    key: 'design_different_screens',
    re: /(?:разн[а-яё]*|различн[а-яё]*)\s+экран|экран[а-яё]*.{0,24}формат|формат[а-яё]*.{0,40}экран/iu,
  },
  {
    key: 'design_brand_identity',
    re: /бренд|визуальн[а-яё]*\s+идентичн|айдентик/iu,
  },
];

/** Generic Russian design prose that must not satisfy authoritative design families. */
const RUSSIAN_GENERIC_DESIGN_DUTY_RE =
  /повседневн[а-яё]*\s+дизайн|повседневн[а-яё]*\s+обязан|выполнял[а-яё]*\s+дизайн-?задач|дизайн-?задач|сопутствующ[а-яё]*\s+материал|точност[а-яё]*.{0,24}сопутствующ|обеспечивал[а-яё]*\s+точност[а-яё]*.{0,24}материал/iu;

const RUSSIAN_DESIGN_CREATION_RE =
  /визуальн[а-яё]*\s+материал|графическ[а-яё]*\s+элемент|цифров[а-яё]*\s+продукт|платформ/iu;

const RUSSIAN_DESIGN_REVIEW_ADAPT_RE =
  /(?:проверя[а-яё]*.{0,40}адаптир|адаптир[а-яё]*.{0,48}(?:дизайн|требовани|материал)|требовани[а-яё]*\s+проекта|в\s+соответствии\s+с\s+требованиями)/iu;

const RUSSIAN_DESIGN_FINAL_DELIVERY_RE =
  /(?:финальн[а-яё]*\s+)?дизайн-?файл|файл[а-яё]*.{0,40}дизайн|формат[а-яё]*.{0,40}экран|экран[а-яё]*.{0,32}формат|подготавлива[а-яё]*.{0,40}файл|настраива[а-яё]*.{0,40}формат/iu;

const RUSSIAN_VISUAL_MATERIAL_CORE_RE =
  /визуальн[а-яё]*\s+материал|графическ[а-яё]*\s+(?:элемент|материал)|дизайн-?материал/iu;

export function russianDesignCueKeysFromUnit(unit: string): DesignMaterialCueKey[] {
  void RUSSIAN_EXPERIENCE_MATERIAL_REVISION;
  const t = (unit || '').normalize('NFKC');
  if (!t.trim()) return [];
  if (isRussianGenericDesignDutyUnit(t) && !RUSSIAN_DESIGN_CREATION_RE.test(t)
    && !RUSSIAN_DESIGN_REVIEW_ADAPT_RE.test(t)
    && !RUSSIAN_DESIGN_FINAL_DELIVERY_RE.test(t)) {
    return [];
  }
  const out: DesignMaterialCueKey[] = [];
  for (const rule of RUSSIAN_DESIGN_CUE_RULES) {
    if (rule.re.test(t)) out.push(rule.key);
  }
  return out;
}

const JAPANESE_DESIGN_CUE_RULES: Array<{ key: DesignMaterialCueKey; re: RegExp }> = [
  {
    key: 'design_visual_materials',
    re: /ビジュアル素材|視覚素材|デザイン素材/u,
  },
  {
    key: 'design_graphic_elements',
    re: /グラフィック要素/u,
  },
  {
    key: 'design_review_adapt',
    re: /(?:確認|レビュー).{0,24}(?:調整|適合)|(?:調整|適合).{0,24}(?:要件|デザイン)|要件に合わせて/u,
  },
  {
    key: 'design_project_requirements',
    re: /プロジェクト要件|要件に合わせ|要件/u,
  },
  {
    key: 'design_files_formats',
    re: /最終(?:デザイン)?ファイル|デザインファイル|形式|フォーマット/u,
  },
  {
    key: 'design_different_screens',
    re: /画面|端末|デバイス|画面ごと|画面別/u,
  },
];

export function japaneseDesignCueKeysFromUnit(unit: string): DesignMaterialCueKey[] {
  void JAPANESE_EXPERIENCE_MATERIAL_REVISION;
  const t = (unit || '').normalize('NFKC');
  if (!t.trim()) return [];
  const out: DesignMaterialCueKey[] = [];
  for (const rule of JAPANESE_DESIGN_CUE_RULES) {
    if (rule.re.test(t)) out.push(rule.key);
  }
  return out;
}

/** Fine-grained Croatian warehouse cues. */
const CROATIAN_WAREHOUSE_CUE_RULES: Array<{ key: WarehouseMaterialCueKey; re: RegExp }> = [
  {
    key: 'warehouse_inbound_check',
    re: /(?:zaprimljen|primljen|ulazn)\w*\s+rob|provjer\w*.{0,40}(?:rob|dokument)|(?:rob|dokument).{0,40}provjer|točnost.{0,24}(?:rob|dokument)/iu,
  },
  {
    key: 'warehouse_document_check',
    re: /(?:prateć|popratn)\w*\s+dokument|dokument\w*.{0,24}(?:prateć|popratn)/iu,
  },
  {
    key: 'warehouse_records',
    re: /skladišn\w*\s+(?:evidencij|zapis)|ažurir\w*.{0,40}(?:evidencij|zapis|skladiš)|(?:evidencij|zapis).{0,40}ažurir/iu,
  },
  {
    key: 'warehouse_orderly_goods',
    re: /(?:uredn|organiziran)\w*.{0,40}(?:skladišt|raspored|rob)|raspoređenost|skladištenje\s+rob/iu,
  },
  {
    key: 'warehouse_preparation',
    re: /priprem\w*.{0,40}rob|rob\w*.{0,40}priprem/iu,
  },
  {
    key: 'warehouse_movement',
    re: /premještanj\w*|kretanj\w*\s+rob|rob\w*.{0,40}(?:premješt|kretanj)|unutar\s+skladišt/iu,
  },
  {
    key: 'warehouse_colleague_coordination',
    re: /(?:surađ|koordin)\w*.{0,48}koleg|koleg\w*.{0,48}(?:surađ|koordin|priprem|premješt)/iu,
  },
];

export function croatianWarehouseCueKeysFromUnit(unit: string): WarehouseMaterialCueKey[] {
  void CROATIAN_EXPERIENCE_MATERIAL_REVISION;
  const t = (unit || '').normalize('NFKC');
  if (!t.trim()) return [];
  const out: WarehouseMaterialCueKey[] = [];
  for (const rule of CROATIAN_WAREHOUSE_CUE_RULES) {
    if (rule.re.test(t)) out.push(rule.key);
  }
  return out;
}

const CROATIAN_DESIGN_CUE_RULES: Array<{ key: DesignMaterialCueKey; re: RegExp }> = [
  {
    key: 'design_visual_materials',
    re: /vizualn\w*\s+materijal|dizajnersk\w*\s+materijal/iu,
  },
  {
    key: 'design_graphic_elements',
    re: /grafičk\w*\s+element/iu,
  },
  {
    key: 'design_review_adapt',
    re: /(?:pregledav|provjerav|prilagođav)\w*.{0,48}(?:dizajn|materijal|zahtjev)|zahtjev\w*\s+projekt/iu,
  },
  {
    key: 'design_project_requirements',
    re: /zahtjev\w*\s+projekt|prema\s+zahtjev/iu,
  },
  {
    key: 'design_files_formats',
    re: /završn\w*\s+(?:dizajnersk\w*\s+)?datotek|datotek\w*.{0,40}(?:format|dizajn)|format\w*.{0,40}(?:zaslon|ekran|datotek)/iu,
  },
  {
    key: 'design_different_screens',
    re: /(?:različit\w*\s+)?(?:zaslon|ekran)/iu,
  },
];

/** Generic Croatian/Serbian design prose that must not satisfy design families. */
const CROATIAN_GENERIC_DESIGN_DUTY_RE =
  /svakodnevn\w*\s+dužnost|profesionaln\w*\s+zadat|razmjen\w*\s+informacij|razmen\w*\s+informacij|pregled\w*\s+dokumentacij|provjer\w*\s+(?:potpunost\s+)?podat|prover\w*\s+(?:potpunost\s+)?podat/iu;

const CROATIAN_DESIGN_CREATION_RE =
  /vizualn\w*\s+materijal|grafičk\w*\s+element|digitaln\w*\s+proizvod|platform/iu;

const CROATIAN_DESIGN_REVIEW_ADAPT_RE =
  /(?:pregledav|provjerav|prilagođav)\w*.{0,48}(?:dizajn|materijal|zahtjev)|zahtjev\w*\s+projekt/iu;

const CROATIAN_DESIGN_FINAL_DELIVERY_RE =
  /završn\w*\s+(?:dizajnersk\w*\s+)?datotek|format\w*.{0,40}(?:zaslon|ekran)|(?:zaslon|ekran)\w*.{0,40}format/iu;

export function croatianDesignCueKeysFromUnit(unit: string): DesignMaterialCueKey[] {
  void CROATIAN_EXPERIENCE_MATERIAL_REVISION;
  const t = (unit || '').normalize('NFKC');
  if (!t.trim()) return [];
  if (
    isCroatianGenericDesignDutyUnit(t)
    && !CROATIAN_DESIGN_CREATION_RE.test(t)
    && !CROATIAN_DESIGN_REVIEW_ADAPT_RE.test(t)
    && !CROATIAN_DESIGN_FINAL_DELIVERY_RE.test(t)
  ) {
    return [];
  }
  const out: DesignMaterialCueKey[] = [];
  for (const rule of CROATIAN_DESIGN_CUE_RULES) {
    if (rule.re.test(t)) out.push(rule.key);
  }
  return out;
}

export function isCroatianGenericDesignDutyUnit(unit: string): boolean {
  return CROATIAN_GENERIC_DESIGN_DUTY_RE.test((unit || '').normalize('NFKC'));
}

export type CroatianDesignFactFamily =
  | 'creation'
  | 'review_adaptation'
  | 'final_delivery_formats';

export type CroatianDesignFamilyCoverage = {
  ok: boolean;
  creationCovered: boolean;
  reviewAdaptationCovered: boolean;
  finalDeliveryCovered: boolean;
  coveredFamilies: CroatianDesignFactFamily[];
  missingFamilies: CroatianDesignFactFamily[];
  genericDutyUnitCount: number;
  reason?:
    | 'croatian_design_material_coverage_incomplete'
    | 'croatian_design_generic_duty'
    | 'croatian_experience_domain_mismatch';
};

export function validateCroatianDesignFactFamilies(
  candidateDescription: string,
): CroatianDesignFamilyCoverage {
  void CROATIAN_EXPERIENCE_MATERIAL_REVISION;
  const bullets = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);
  let creationCovered = false;
  let reviewAdaptationCovered = false;
  let finalDeliveryCovered = false;
  let genericDutyUnitCount = 0;

  for (const bullet of bullets) {
    const generic = isCroatianGenericDesignDutyUnit(bullet);
    if (generic) genericDutyUnitCount += 1;

    if (
      !generic
      && /vizualn\w*\s+materijal/iu.test(bullet)
      && /grafičk\w*\s+element/iu.test(bullet)
    ) {
      creationCovered = true;
    }
    if (!generic && CROATIAN_DESIGN_REVIEW_ADAPT_RE.test(bullet)) {
      reviewAdaptationCovered = true;
    }
    if (!generic && CROATIAN_DESIGN_FINAL_DELIVERY_RE.test(bullet)) {
      finalDeliveryCovered = true;
    }
  }

  const coveredFamilies: CroatianDesignFactFamily[] = [];
  if (creationCovered) coveredFamilies.push('creation');
  if (reviewAdaptationCovered) coveredFamilies.push('review_adaptation');
  if (finalDeliveryCovered) coveredFamilies.push('final_delivery_formats');
  const missingFamilies: CroatianDesignFactFamily[] = (
    ['creation', 'review_adaptation', 'final_delivery_formats'] as const
  ).filter((f) => !coveredFamilies.includes(f));

  let reason: CroatianDesignFamilyCoverage['reason'];
  if (genericDutyUnitCount > 0 && coveredFamilies.length === 0) {
    reason = 'croatian_design_generic_duty';
  } else if (missingFamilies.length > 0) {
    reason = 'croatian_design_material_coverage_incomplete';
  }

  return {
    ok: missingFamilies.length === 0 && genericDutyUnitCount === 0,
    creationCovered,
    reviewAdaptationCovered,
    finalDeliveryCovered,
    coveredFamilies,
    missingFamilies,
    genericDutyUnitCount,
    reason,
  };
}

export function isCroatianDesignFamilyRejectionReason(reason: string | null | undefined): boolean {
  const r = String(reason || '');
  return r === 'croatian_design_generic_duty'
    || r === 'croatian_design_material_coverage_incomplete'
    || r === 'croatian_experience_domain_mismatch'
    || r === 'croatian_experience_cross_entry_fallback'
    || r === 'croatian_serbian_locale_leakage'
    || r === 'croatian_design_poisoned_live_source';
}

const CROATIAN_DESIGN_POSITION_RE =
  /(?:dizajn|design|grafick|graphic|visual|vizuel|ビジュアル|デザイン|デザイナー|グラフィック|グラフォ|تصميم|डिज़ाइन|дизайн|графическ)/i;

const CROATIAN_WAREHOUSE_GOODS_EVIDENCE_RE =
  /(?:rob\w*|goods?|zaprimljen\w*|ulazn\w*\s+rob|skladišt\w*|warehouse|magacin|prateć\w*|popratn\w*|माल|بضائع|товар|商品|倉庫|入荷)/iu;

/**
 * Serbian-generic live textarea that must never authorize Croatian design rebuild facts.
 */
export function isCroatianDesignPoisonedLiveSource(
  text: string,
  position?: string | null,
): boolean {
  void CROATIAN_DESIGN_POISONED_SOURCE_RECOVERY_REVISION;
  const t = (text || '').trim();
  if (!t) return false;
  const positionLooksDesign = CROATIAN_DESIGN_POSITION_RE.test(String(position || ''));
  const fam = validateCroatianDesignFactFamilies(t);
  if (fam.ok && fam.coveredFamilies.length >= 3) return false;
  const serbianGeneric = /svakodnevn\w*\s+dužnost/iu.test(t)
    && /(?:prover\w*\s+tačnost|koordinisa\w*|razmen\w*)/iu.test(t)
    && /(?:pregled\w*\s+dokument|proverav\w*\s+potpunost)/iu.test(t);
  const noDesignFamilies = !fam.creationCovered
    && !fam.reviewAdaptationCovered
    && !fam.finalDeliveryCovered;
  const srHits = (t.match(/\b(?:prover(?:a|u|ava|avala)|tačnost\w*|koordinisa\w*|razmen\w*|dodeljen\w*|radnog\s+mesta|magacin)\b/giu) || []).length;
  const hrHits = (t.match(/\b(?:provjer(?:a|u|ava)|točnost\w*|surađ\w*|zaprimljen\w*|skladišt\w*|premještanj\w*|prateć\w*)\b/giu) || []).length;
  const serbianDominant = srHits > 0 && srHits >= hrHits;
  return Boolean(
    (serbianGeneric || (noDesignFamilies && isCroatianGenericDesignDutyUnit(t)))
    && (positionLooksDesign || serbianGeneric)
    && serbianDominant
  );
}

/**
 * Role/domain-aware material keys — design roles never inherit warehouse from
 * generic check/document language alone.
 */
export function classifyMaterialDutyKeysForRole(
  text: string,
  position?: string | null,
): MaterialDutyKey[] {
  void CROATIAN_ROLE_AWARE_MATERIAL_CLASSIFIER_REVISION;
  const keys = classifyMaterialDutyKeys(text);
  const domain = CROATIAN_DESIGN_POSITION_RE.test(String(position || ''))
    ? 'design'
    : /(?:skladist|warehouse|magacin|skladišt|倉庫|кладов|مستودع)/i.test(String(position || ''))
      ? 'warehouse'
      : 'other';
  if (domain === 'design') {
    const hasGoods = CROATIAN_WAREHOUSE_GOODS_EVIDENCE_RE.test(text || '');
    return keys.filter((k) => {
      if (!k.startsWith('warehouse_')) return true;
      return hasGoods;
    });
  }
  return keys;
}

export function isRussianGenericDesignDutyUnit(unit: string): boolean {
  return RUSSIAN_GENERIC_DESIGN_DUTY_RE.test((unit || '').normalize('NFKC'));
}

export type RussianDesignFactFamily =
  | 'creation'
  | 'review_adaptation'
  | 'final_delivery_formats';

export type RussianDesignFamilyCoverage = {
  ok: boolean;
  creationCovered: boolean;
  reviewAdaptationCovered: boolean;
  finalDeliveryCovered: boolean;
  coveredFamilies: RussianDesignFactFamily[];
  missingFamilies: RussianDesignFactFamily[];
  genericDutyUnitCount: number;
  genericOnlyMaterialCoverageCount: number;
  semanticVisualMaterialDuplicateCount: number;
  reason?:
    | 'russian_design_family_coverage_incomplete'
    | 'russian_design_generic_duty'
    | 'russian_design_semantic_duplicate';
};

/**
 * Distinct Russian design fact families for Experience apply.
 * Generic daily-design prose contributes zero family coverage.
 */
export function validateRussianDesignFactFamilies(
  candidateDescription: string,
): RussianDesignFamilyCoverage {
  void RUSSIAN_DESIGN_FAMILIES_REVISION;
  const bullets = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);
  let creationCovered = false;
  let reviewAdaptationCovered = false;
  let finalDeliveryCovered = false;
  let genericDutyUnitCount = 0;
  let genericOnlyMaterialCoverageCount = 0;
  let visualCoreBulletCount = 0;

  for (const bullet of bullets) {
    const generic = isRussianGenericDesignDutyUnit(bullet);
    if (generic) {
      genericDutyUnitCount += 1;
      // Generic-only units cover zero authoritative families.
      if (
        !RUSSIAN_DESIGN_REVIEW_ADAPT_RE.test(bullet)
        && !RUSSIAN_DESIGN_FINAL_DELIVERY_RE.test(bullet)
        && !(
          /визуальн[а-яё]*\s+материал/iu.test(bullet)
          && /графическ[а-яё]*\s+элемент/iu.test(bullet)
        )
      ) {
        genericOnlyMaterialCoverageCount += 1;
      }
    }

    const creationHit = !generic
      && /визуальн[а-яё]*\s+материал/iu.test(bullet)
      && /графическ[а-яё]*\s+элемент/iu.test(bullet);
    if (creationHit) creationCovered = true;

    if (!generic && RUSSIAN_DESIGN_REVIEW_ADAPT_RE.test(bullet)) {
      reviewAdaptationCovered = true;
    }
    if (!generic && RUSSIAN_DESIGN_FINAL_DELIVERY_RE.test(bullet)) {
      finalDeliveryCovered = true;
    }

    if (RUSSIAN_VISUAL_MATERIAL_CORE_RE.test(bullet)) {
      visualCoreBulletCount += 1;
    }
  }

  // Semantic duplication: two+ bullets centered on visual materials without
  // each contributing a distinct non-creation family.
  let semanticVisualMaterialDuplicateCount = 0;
  const visualOnlyBullets = bullets.filter((b) => {
    if (!RUSSIAN_VISUAL_MATERIAL_CORE_RE.test(b)) return false;
    const hasAdapt = RUSSIAN_DESIGN_REVIEW_ADAPT_RE.test(b);
    const hasFinal = RUSSIAN_DESIGN_FINAL_DELIVERY_RE.test(b);
    return !hasAdapt && !hasFinal;
  });
  if (visualOnlyBullets.length >= 2) {
    semanticVisualMaterialDuplicateCount = visualOnlyBullets.length - 1;
  } else if (visualCoreBulletCount >= 2 && !reviewAdaptationCovered && !finalDeliveryCovered) {
    semanticVisualMaterialDuplicateCount = visualCoreBulletCount - 1;
  }

  const coveredFamilies: RussianDesignFactFamily[] = [];
  if (creationCovered) coveredFamilies.push('creation');
  if (reviewAdaptationCovered) coveredFamilies.push('review_adaptation');
  if (finalDeliveryCovered) coveredFamilies.push('final_delivery_formats');
  const allFamilies: RussianDesignFactFamily[] = [
    'creation',
    'review_adaptation',
    'final_delivery_formats',
  ];
  const missingFamilies = allFamilies.filter((f) => !coveredFamilies.includes(f));

  if (genericDutyUnitCount > 0 && coveredFamilies.length < 3) {
    return {
      ok: false,
      creationCovered,
      reviewAdaptationCovered,
      finalDeliveryCovered,
      coveredFamilies,
      missingFamilies,
      genericDutyUnitCount,
      genericOnlyMaterialCoverageCount: Math.max(
        genericOnlyMaterialCoverageCount,
        genericDutyUnitCount,
      ),
      semanticVisualMaterialDuplicateCount,
      reason: 'russian_design_generic_duty',
    };
  }
  if (semanticVisualMaterialDuplicateCount > 0 && missingFamilies.length > 0) {
    return {
      ok: false,
      creationCovered,
      reviewAdaptationCovered,
      finalDeliveryCovered,
      coveredFamilies,
      missingFamilies,
      genericDutyUnitCount,
      genericOnlyMaterialCoverageCount,
      semanticVisualMaterialDuplicateCount,
      reason: 'russian_design_semantic_duplicate',
    };
  }
  if (missingFamilies.length > 0) {
    return {
      ok: false,
      creationCovered,
      reviewAdaptationCovered,
      finalDeliveryCovered,
      coveredFamilies,
      missingFamilies,
      genericDutyUnitCount,
      genericOnlyMaterialCoverageCount,
      semanticVisualMaterialDuplicateCount,
      reason: 'russian_design_family_coverage_incomplete',
    };
  }
  return {
    ok: true,
    creationCovered,
    reviewAdaptationCovered,
    finalDeliveryCovered,
    coveredFamilies,
    missingFamilies: [],
    genericDutyUnitCount,
    genericOnlyMaterialCoverageCount,
    semanticVisualMaterialDuplicateCount: 0,
  };
}

/** Per-unit design material keys for Summary/Experience diagnostics (no collapse). */
export function collectDesignMaterialKeysFromDescription(description: string): string[] {
  const units = splitExperienceBullets(description || '');
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (k: string) => {
    if (!k || k === 'generic_duty' || seen.has(k)) return;
    seen.add(k);
    ordered.push(k);
  };
  for (const unit of units.length ? units : [description || '']) {
    for (const k of classifyMaterialDutyKeys(unit)) push(k);
    for (const k of arabicDesignCueKeysFromUnit(unit)) push(k);
    for (const k of russianDesignCueKeysFromUnit(unit)) push(k);
    for (const k of japaneseDesignCueKeysFromUnit(unit)) push(k);
    for (const k of croatianDesignCueKeysFromUnit(unit)) push(k);
  }
  return ordered;
}

export function sourceRequiresCroatianDesignFamilies(sourceDescription: string): boolean {
  const keys = materialDutyKeysFromDescription(sourceDescription)
    .filter((k) => k.startsWith('design_'));
  if (keys.length >= 2) return true;
  const cues = collectDesignMaterialKeysFromDescription(sourceDescription)
    .filter((k) => k.startsWith('design_'));
  return cues.length >= 2;
}

/**
 * Whether a Croatian Experience operation must rebuild concrete design families
 * instead of preserving Serbian-generic or cross-domain poisoned prose.
 */
export function experienceNeedsCroatianDesignFamilyRebuild(options: {
  locale: string;
  sourceDescription?: string | null;
  position?: string | null;
  rejectReason?: string | null;
}): boolean {
  void CROATIAN_EXPERIENCE_MATERIAL_REVISION;
  void CROATIAN_DESIGN_FALLBACK_ROUTING_REVISION;
  if (options.locale !== 'hr') return false;
  const source = options.sourceDescription || '';
  const position = String(options.position || '');
  const positionLooksDesign = CROATIAN_DESIGN_POSITION_RE.test(position);
  const poisoned = isCroatianDesignPoisonedLiveSource(source, position);
  if (poisoned && positionLooksDesign) return true;
  if (isCroatianDesignFamilyRejectionReason(options.rejectReason)) {
    // Family-specific rejects always rebuild. Locale rejects rebuild only for design.
    return true;
  }
  // Provider wrong_language must not fall through to source-preserving when the
  // target is a design entry (poisoned Serbian live text or design position).
  if (
    (options.rejectReason === 'wrong_language' || options.rejectReason === 'locale_mismatch')
    && (positionLooksDesign || poisoned || sourceRequiresCroatianDesignFamilies(source))
  ) {
    return true;
  }
  if (sourceRequiresCroatianDesignFamilies(source)) {
    return !validateCroatianDesignFactFamilies(source).ok;
  }
  if (positionLooksDesign) {
    if (!source.trim()) return true;
    return !validateCroatianDesignFactFamilies(source).ok
      || isCroatianGenericDesignDutyUnit(source)
      || validateCroatianDesignFactFamilies(source).coveredFamilies.length < 3
      || poisoned;
  }
  return false;
}

export function sourceRequiresRussianDesignFamilies(sourceDescription: string): boolean {
  const keys = materialDutyKeysFromDescription(sourceDescription)
    .filter((k) => k.startsWith('design_'));
  if (keys.length >= 2) return true;
  const cues = collectDesignMaterialKeysFromDescription(sourceDescription)
    .filter((k) => k.startsWith('design_'));
  return cues.length >= 2;
}

/**
 * Whether a Russian Experience operation must rebuild the concrete three design
 * families instead of preserving poisoned live textarea / soft frame shells.
 */
export function experienceNeedsRussianDesignFamilyRebuild(options: {
  locale: string;
  sourceDescription?: string | null;
  position?: string | null;
  rejectReason?: string | null;
}): boolean {
  void RUSSIAN_DESIGN_FALLBACK_ROUTING_REVISION;
  if (options.locale !== 'ru') return false;
  if (isRussianDesignFamilyRejectionReason(options.rejectReason)) return true;
  const source = options.sourceDescription || '';
  if (sourceRequiresRussianDesignFamilies(source)) {
    return !validateRussianDesignFactFamilies(source).ok;
  }
  // Position-classified graphic design with incomplete/generic live prose.
  const position = String(options.position || '');
  if (/(dizajn|design|grafick|graphic|visual|vizuel|дизайн|графическ|تصميم|डिज़ाइन)/i.test(position)) {
    if (!source.trim()) return true;
    return !validateRussianDesignFactFamilies(source).ok
      || isRussianGenericDesignDutyUnit(source)
      || validateRussianDesignFactFamilies(source).coveredFamilies.length < 3;
  }
  return false;
}

const ARABIC_ACTION_CUES = /تتحقق|تحقّقت|تحدّث|حدّثت|تنسّق|نسّقت|تعدّ|أعدّت|تراجع|راجعت|تكيّف|كيّفت|تحافظ|حافظت|فحص|تسجيل|تحديث|ترتيب|إعداد|تجهيز/gu;
const ARABIC_OBJECT_CUES = /بضائع|وثائق|سجلات|مستودع|زملاء|مواد|عناصر|تصميم|هوية|إرشادات|ملفات|صيغ/gu;

const HINDI_ACTION_CUES = /जाँच|जांच|जाच|अद्यतन|अपडेट|व्यवस्थित|तैयारी|आवाजाही|समन्वय/gu;
const HINDI_OBJECT_CUES = /माल|दस्तावे|रिकॉर्ड|गोदाम|सामान|सहकर्मी/gu;

const RUSSIAN_ACTION_CUES = /проверя|обновл|поддержива|координир|согласов|созда[её]|адаптир|подготавли|подготов/gu;
const RUSSIAN_OBJECT_CUES = /товар|документ|запис|склад|коллег|материал|элемент|файл|экран|дизайн/gu;

const JAPANESE_ACTION_CUES = /確認|更新|整理|配置|保管|準備|移動|連携|調整|照合|作成|レビュー/gu;
const JAPANESE_OBJECT_CUES = /入荷|商品|品物|書類|倉庫|記録|在庫|同僚|ビジュアル|グラフィック|デザイン|ファイル|形式|画面/gu;

export type CurrentSourceUnitMaterialDiag = {
  currentSourceUnitHashes: string[];
  currentSourceUnitMaterialKeys: string[][];
  currentSourceUnitActionKeys: string[][];
  currentSourceUnitObjectKeys: string[][];
  currentSourceUnitWarehouseCueCount: number[];
  currentSourceUnitFactOwnerEntryIdHash: string | null;
};

/** Per-bullet non-PII material diagnostics for the current Experience entry. */
export function diagnoseCurrentSourceUnitMaterial(
  description: string,
  entryIdHash: string | null,
): CurrentSourceUnitMaterialDiag {
  const units = splitExperienceBullets(description);
  const currentSourceUnitHashes: string[] = [];
  const currentSourceUnitMaterialKeys: string[][] = [];
  const currentSourceUnitActionKeys: string[][] = [];
  const currentSourceUnitObjectKeys: string[][] = [];
  const currentSourceUnitWarehouseCueCount: number[] = [];
  for (const unit of units) {
    const normalized = unit.normalize('NFKC').replace(/\s+/g, ' ').trim();
    currentSourceUnitHashes.push(fingerprintText(normalized));
    const keys = classifyMaterialDutyKeys(unit).filter((k) => k !== 'generic_duty');
    const cues = [
      ...hindiWarehouseCueKeysFromUnit(unit),
      ...arabicWarehouseCueKeysFromUnit(unit),
      ...arabicDesignCueKeysFromUnit(unit),
      ...russianWarehouseCueKeysFromUnit(unit),
      ...russianDesignCueKeysFromUnit(unit),
      ...japaneseWarehouseCueKeysFromUnit(unit),
      ...japaneseDesignCueKeysFromUnit(unit),
      ...croatianWarehouseCueKeysFromUnit(unit),
      ...croatianDesignCueKeysFromUnit(unit),
    ];
    const keySet = new Set<string>(keys);
    const merged = [
      ...keys,
      ...cues.filter((c) => !keySet.has(c)),
    ];
    currentSourceUnitMaterialKeys.push(
      merged.length ? merged : ['generic_duty'],
    );
    currentSourceUnitActionKeys.push([
      ...(normalized.match(HINDI_ACTION_CUES) || []),
      ...(normalized.match(ARABIC_ACTION_CUES) || []),
      ...(normalized.match(RUSSIAN_ACTION_CUES) || []),
      ...(normalized.match(JAPANESE_ACTION_CUES) || []),
    ]);
    currentSourceUnitObjectKeys.push([
      ...(normalized.match(HINDI_OBJECT_CUES) || []),
      ...(normalized.match(ARABIC_OBJECT_CUES) || []),
      ...(normalized.match(RUSSIAN_OBJECT_CUES) || []),
      ...(normalized.match(JAPANESE_OBJECT_CUES) || []),
    ]);
    currentSourceUnitWarehouseCueCount.push(
      hindiWarehouseCueKeysFromUnit(unit).length
        + arabicWarehouseCueKeysFromUnit(unit).length
        + russianWarehouseCueKeysFromUnit(unit).length
        + japaneseWarehouseCueKeysFromUnit(unit).length
        + croatianWarehouseCueKeysFromUnit(unit).length,
    );
  }
  return {
    currentSourceUnitHashes,
    currentSourceUnitMaterialKeys,
    currentSourceUnitActionKeys,
    currentSourceUnitObjectKeys,
    currentSourceUnitWarehouseCueCount,
    currentSourceUnitFactOwnerEntryIdHash: entryIdHash,
  };
}

/** Prefer more specific keys first; skip generic when a specific key matches. */
export function classifyMaterialDutyKeys(text: string): MaterialDutyKey[] {
  const t = (text || '').normalize('NFKC');
  if (!t.trim()) return [];
  const keys: MaterialDutyKey[] = [];
  for (const rule of DUTY_RULES) {
    if (rule.source.test(t)) keys.push(rule.key);
  }
  // Japanese CJK prose: also accept localized DUTY_RULES + fine-grained JA cues.
  if (/[\u3040-\u30FF\u3400-\u9FFF]/.test(t)) {
    for (const rule of DUTY_RULES) {
      if (rule.localized.test(t) && !keys.includes(rule.key)) keys.push(rule.key);
    }
    for (const k of japaneseWarehouseCueKeysFromUnit(t)) {
      if (!keys.includes(k as MaterialDutyKey)) keys.push(k as MaterialDutyKey);
    }
    for (const k of japaneseDesignCueKeysFromUnit(t)) {
      if (!keys.includes(k as MaterialDutyKey)) keys.push(k as MaterialDutyKey);
    }
  }
  // Croatian / shared SC Latin: fine-grained warehouse + design cues.
  if (
    /(?:skladišt|zaprimljen|primljen|ulazn\w*\s+rob|prateć|popratn|provjer|točnost|vizualn|grafičk|dizajn|prilagođ|zaslon|zahtjev\w*\s+projekt)/iu.test(t)
  ) {
    for (const k of croatianWarehouseCueKeysFromUnit(t)) {
      if (!keys.includes(k as MaterialDutyKey)) keys.push(k as MaterialDutyKey);
    }
    for (const k of croatianDesignCueKeysFromUnit(t)) {
      if (!keys.includes(k as MaterialDutyKey)) keys.push(k as MaterialDutyKey);
    }
  }
  // Kitchen / care team collaboration must not inherit contact-center CS keys
  // or false-positive warehouse_movement from prep+colleagues (AAB-344).
  if (keys.includes('kitchen_collaboration')) {
    return keys.filter(
      (k) => k !== 'team_collaboration'
        && k !== 'generic_duty'
        && !k.startsWith('cs_')
        && !k.startsWith('warehouse_'),
    );
  }
  if (keys.includes('healthcare_team')) {
    return keys.filter((k) => k !== 'team_collaboration' && k !== 'generic_duty' && !k.startsWith('cs_'));
  }
  // Design material keys — prefer over CS / food false-hits.
  if (keys.some((k) => k.startsWith('design_'))) {
    return keys.filter(
      (k) => k.startsWith('design_')
        || (!k.startsWith('cs_')
          && k !== 'generic_duty'
          && k !== 'food_prep'
          && k !== 'hygiene_workplace'
          && k !== 'kitchen_collaboration'
          && k !== 'team_collaboration'),
    );
  }
  // Warehouse inbound/records/movement — prefer over CS false-hits (koleg+coord).
  // Cooking/hospitality material keys win over false-positive warehouse_movement
  // from prep+colleagues (AAB-344). Per-unit Atlas warehouse lines still prefer
  // warehouse_* when no cooking keys are present.
  if (keys.some((k) => k.startsWith('warehouse_'))) {
    const cookingMaterial = keys.includes('food_prep')
      || keys.includes('hygiene_workplace')
      || keys.includes('kitchen_collaboration')
      || /(?:\bmeals?\b|\bdishes?\b|\bkitchen\b|\bfood\s+preparation\b|\bhospitality\b)/i.test(t);
    if (cookingMaterial && !sourceHasWarehouseDomainApplicability(t)) {
      return keys.filter(
        (k) => !k.startsWith('warehouse_')
          && k !== 'team_collaboration'
          && k !== 'generic_duty'
          && !k.startsWith('cs_'),
      );
    }
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

export function localizedHasDuty(key: MaterialDutyKey, localized: string): boolean {
  if (key === 'generic_duty') return true;
  const rule = DUTY_RULES.find((r) => r.key === key);
  if (rule?.localized.test(localized)) return true;
  // Fine-grained locale cue keys (HR/JA/RU/AR) may be present without a DUTY_RULE hit.
  if (croatianDesignCueKeysFromUnit(localized).includes(key as DesignMaterialCueKey)) return true;
  if (croatianWarehouseCueKeysFromUnit(localized).includes(key as WarehouseMaterialCueKey)) return true;
  if (japaneseDesignCueKeysFromUnit(localized).includes(key as DesignMaterialCueKey)) return true;
  if (japaneseWarehouseCueKeysFromUnit(localized).includes(key as WarehouseMaterialCueKey)) return true;
  if (arabicDesignCueKeysFromUnit(localized).includes(key as DesignMaterialCueKey)) return true;
  if (russianDesignCueKeysFromUnit(localized).includes(key as DesignMaterialCueKey)) return true;
  if (!rule) return true;
  return false;
}

/**
 * AAB-356 — Coverage of source material keys in target Summary text must use
 * localized duty patterns (not English-only source classifiers).
 */
export function materialDutyKeysCoveredInLocalizedText(
  required: MaterialDutyKey[],
  localized: string,
): { covered: MaterialDutyKey[]; missing: MaterialDutyKey[] } {
  const covered = required.filter((k) => localizedHasDuty(k, localized));
  const missing = required.filter((k) => !localizedHasDuty(k, localized));
  return { covered, missing };
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
    // Exclude English reception/receptionist (recept≠Rezept prescription).
    claim: /(dispens(?:e|ed|ing)|prescription|(?<![a-z])recept(?!ion)|izdavanj\w*\s+lek)/iu,
    support: /(dispens|prescription|(?<![a-z])recept(?!ion)|izdavanj)/iu,
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
  // Croatian / multilingual warehouse expansions (AAB-294 grounding).
  {
    label: 'quality_claim',
    claim: /(?:provjer\w*|prover\w*|pregled\w*|kontrola?|check(?:s|ing)?|inspect(?:s|ion|ing)?).{0,24}(?:kvalitet|quality)|(?:kvalitet|quality).{0,24}(?:provjer|prover|pregled|kontrol|check|inspect)|(?:kontrola?\s+kvalitet|quality\s+(?:control|inspection|assurance)|provjer\w*\s+kvalitet|prover\w*\s+kvalitet)/iu,
    support: /(?:kvalitet|quality\s+(?:control|inspection|assurance|check)|kontrola?\s+kvalitet|qc\b)/iu,
  },
  {
    label: 'standards_compliance_claim',
    claim: /(?:usklađenost.{0,48}(?:standard|propis|regulacij|procedur|politik)|(?:važeć\w*|važeći|važećim)\s+standard\w*|s\s+važećim\s+standardima|poštuje.{0,24}standard|osigurava\s+usklađenost|compliance|regulacij\w*|propisima|prema\s+(?:važeć\w*\s+)?standard)/iu,
    support: /(?:\bstandard|compliance|regulacij|propis|procedur|politik|važeć\w*\s+standard)/iu,
  },
  {
    label: 'universal_scope_claim',
    claim: /(?:\bsvih\b|\bcjelokupn\w*\b|\bsve\s+(?:dokumentacije|robe|artikle|artikala)\b|\ball\s+(?:stored|goods|items|documentation|records)\b|\bevery\s+(?:stored\s+)?(?:item|good|document)\b|\bentire\s+(?:warehouse|inventory|stock)\b)/iu,
    support: /(?:\bsvih\b|\bcjelokupn\w*\b|\bsve\s+(?:dokumentacije|robe|artikle|artikala|uskladišten)\b|\ball\s+(?:stored|goods|items|documentation|records)\b|\bevery\s+(?:item|good|document)\b|\bentire\s+)/iu,
  },
  {
    label: 'organization_responsibility_claim',
    // Verb stems only — do not treat adjective "organizirano" as escalation.
    claim: /\b(?:organizira(?:la|lo|li|ju)?|organizuje|organizovala|organizovao|organises?|organizes?)\b/iu,
    support: /\b(?:organizira(?:la|lo|li|ju|ti)?|organizuje(?:m|š|mo|te|ju)?|organizovala|organizovao|organise[ds]?|organizes?|organising|organizing)\b/iu,
  },
  {
    label: 'leadership_claim',
    claim: /\b(?:vodi\s+tim|vodila\s+tim|vodio\s+tim|nadzir(?:e|ala|ao)\b|nadzire\s+(?:rad|koleg|skladišt)|upravlja(?:la|o)?\s+(?:tim|aktivnost)|managed?\s+a\s+team|led\s+a\s+team|leadership|supervis(?:e|ed|ing|ion)\b)/iu,
    support: /\b(?:vodi\s+tim|vodila\s+tim|vodio\s+tim|nadzir(?:e|ala|ao)|upravlja(?:la|o)?\s+(?:tim|aktivnost)|managed?\s+a\s+team|led\s+a\s+team|leadership|supervis(?:e|ed|ing|ion))\b/iu,
  },
];

export type ExtraGeneratedDutyResult = {
  valid: boolean;
  extras: string[];
  kinds?: ExperienceUnsupportedClaimKind[];
  reason?: 'unsupported_generated_duty';
  scopeExpansionDetected?: boolean;
  universalQuantifierDetected?: boolean;
  responsibilityEscalationDetected?: boolean;
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
  const scan = detectExperienceUnsupportedClaimExpansion(source, joined);
  for (const label of scan.labels) {
    if (!extras.includes(label)) extras.push(label);
  }
  if (extras.length) {
    return {
      valid: false,
      extras,
      kinds: scan.kinds.length
        ? scan.kinds
        : (extras.filter((e): e is ExperienceUnsupportedClaimKind =>
          e === 'quality_claim'
          || e === 'standards_compliance_claim'
          || e === 'universal_scope_claim'
          || e === 'organization_responsibility_claim'
          || e === 'leadership_claim'
          || e === 'unsupported_tool_claim'
          || e === 'unsupported_metric_claim'
          || e === 'unsupported_generated_duty')),
      reason: 'unsupported_generated_duty',
      scopeExpansionDetected: scan.scopeExpansionDetected,
      universalQuantifierDetected: scan.universalQuantifierDetected,
      responsibilityEscalationDetected: scan.responsibilityEscalationDetected,
    };
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
  reason?:
    | 'experience_material_fact_coverage_incomplete'
    | 'exact_duplicate_bullets'
    | 'near_duplicate_bullets'
    | 'unsupported_generated_duty'
    | 'russian_design_family_coverage_incomplete'
    | 'russian_design_generic_duty'
    | 'russian_design_semantic_duplicate'
    | 'croatian_design_material_coverage_incomplete'
    | 'croatian_design_generic_duty'
    | 'croatian_experience_domain_mismatch'
    | 'croatian_experience_cross_entry_fallback'
    | 'croatian_serbian_locale_leakage';
  required: MaterialDutyKey[];
  covered: MaterialDutyKey[];
  distinctSemanticBulletCount: number;
  finalBulletCount: number;
  russianDesignFamilies?: RussianDesignFamilyCoverage;
  croatianDesignFamilies?: CroatianDesignFamilyCoverage;
  unsupportedClaimKinds?: ExperienceUnsupportedClaimKind[];
  unsupportedClaimCount?: number;
  scopeExpansionDetected?: boolean;
  universalQuantifierDetected?: boolean;
  responsibilityEscalationDetected?: boolean;
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
  options?: { targetLocale?: string | null },
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
      unsupportedClaimKinds: extras.kinds,
      unsupportedClaimCount: extras.kinds?.length || extras.extras.length,
      scopeExpansionDetected: extras.scopeExpansionDetected,
      universalQuantifierDetected: extras.universalQuantifierDetected,
      responsibilityEscalationDetected: extras.responsibilityEscalationDetected,
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

  const targetLocale = options?.targetLocale || null;
  const needsHrDesign = targetLocale === 'hr'
    && sourceRequiresCroatianDesignFamilies(sourceDescription);
  if (needsHrDesign) {
    const families = validateCroatianDesignFactFamilies(candidateDescription);
    if (!families.ok) {
      return {
        ok: false,
        reason: families.reason || 'croatian_design_material_coverage_incomplete',
        required: sourceKeys,
        covered,
        distinctSemanticBulletCount: dup.distinctCount,
        finalBulletCount,
        croatianDesignFamilies: families,
      };
    }
  }
  const needsRuDesign = (targetLocale === 'ru' || /[а-яё]/iu.test(candidateDescription))
    && sourceRequiresRussianDesignFamilies(sourceDescription);
  if (needsRuDesign) {
    const families = validateRussianDesignFactFamilies(candidateDescription);
    if (!families.ok) {
      return {
        ok: false,
        reason: families.reason || 'russian_design_family_coverage_incomplete',
        required: sourceKeys,
        covered,
        distinctSemanticBulletCount: dup.distinctCount,
        finalBulletCount,
        russianDesignFamilies: families,
      };
    }
    return {
      ok: true,
      required: sourceKeys,
      covered,
      distinctSemanticBulletCount: dup.distinctCount,
      finalBulletCount,
      russianDesignFamilies: families,
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
