/**
 * Translation-aware Experience fallback for cross-locale enhance operations.
 * Preserves source fact units while emitting target-locale CV bullets.
 * Not occupation-catalogue-driven; derives soft action frames from source verbs.
 */
import type { Locale } from './i18n/translations';
import { formatExperienceBullets, splitExperienceBullets } from './cv-canonical-facts';
import { detectTextLocale, isCrossLocaleOperation } from './cv-content-locale';
import {
  applyEnglishEmploymentTense,
  classifyMaterialDutyKeys,
  materialDutyKeysFromDescription,
} from './cv-material-duty-coverage';
import {
  applySerbianCvEmploymentTense,
  extractSourceDutyUnits,
  stripDutyListPrefix,
} from './cv-source-fact-identity';
import {
  buildGermanWarehouseExperienceFallback,
  sourceRequiresGermanWarehouseFactCoverage,
  validateGermanWarehouseExperienceCoverage,
} from './cv-german-experience-grounding';
import {
  buildSpanishWarehouseExperienceFallback,
  sourceRequiresSpanishWarehouseFactCoverage,
  validateSpanishWarehouseExperienceCoverage,
} from './cv-spanish-experience-grounding';
import {
  buildFrenchWarehouseExperienceFallback,
  sourceRequiresFrenchWarehouseFactCoverage,
  validateFrenchWarehouseExperienceCoverage,
} from './cv-french-experience-grounding';
import {
  buildItalianWarehouseExperienceFallback,
  sourceRequiresItalianWarehouseFactCoverage,
  validateItalianWarehouseExperienceCoverage,
} from './cv-italian-experience-grounding';
import {
  buildPortugueseWarehouseExperienceFallback,
  sourceRequiresPortugueseWarehouseFactCoverage,
  validatePortugueseWarehouseExperienceCoverage,
} from './cv-portuguese-experience-grounding';
import {
  buildRussianWarehouseExperienceFallback,
  sourceRequiresRussianWarehouseFactCoverage,
  validateRussianWarehouseExperienceCoverage,
} from './cv-russian-experience-grounding';
import {
  buildRussianDesignSemanticFallback,
  sourceRequiresRussianDesignSemanticGrounding,
  validateRussianDesignSemanticProjection,
} from './cv-russian-experience-semantic-grounding';
import {
  buildHindiWarehouseExperienceFallback,
  sourceRequiresHindiWarehouseFactCoverage,
  validateHindiWarehouseExperienceCoverage,
} from './cv-hindi-experience-grounding';
import {
  buildJapaneseWarehouseExperienceFallback,
  buildJapaneseDesignExperienceFallback,
  sourceRequiresJapaneseWarehouseFactCoverage,
  validateJapaneseWarehouseExperienceCoverage,
} from './cv-japanese-experience-grounding';
import {
  buildArabicWarehouseExperienceFallback,
  sourceRequiresArabicWarehouseFactCoverage,
  validateArabicWarehouseExperienceCoverage,
} from './cv-arabic-experience-grounding';
import {
  buildSerbianWarehouseExperienceFallback,
  sourceRequiresSerbianWarehouseFactCoverage,
  validateSerbianWarehouseExperienceCoverage,
} from './cv-serbian-experience-grounding';
import {
  buildCroatianWarehouseExperienceFallback,
  sourceRequiresCroatianWarehouseFactCoverage,
  validateCroatianWarehouseExperienceCoverage,
} from './cv-croatian-experience-grounding';
import {
  buildEnglishWarehouseExperienceFallback,
  sourceRequiresEnglishWarehouseFactCoverage,
  sourceRequiresStrictEnglishWarehouseFactCoverage,
  countEnglishWarehouseTranslatedFacts,
  validateEnglishWarehouseExperienceCoverage,
} from './cv-english-experience-warehouse-grounding';
import { sourceHasWarehouseDomainApplicability } from './cv-warehouse-domain-applicability';
import { buildSourcePreservingExperienceBullets } from './cv-localized-fallback';
import { realizeArabicBuiltExperiencePersonEvidence } from './cv-arabic-experience-tense';
import {
  detectExperienceUnsupportedClaimExpansion,
  extractExperienceSemanticArgumentKinds,
  type ExperienceSemanticArgumentKind,
} from './cv-experience-unsupported-claims';

type ActionFrame =
  | 'check_records'
  | 'update_records'
  | 'coordinate_info'
  | 'prepare_materials'
  | 'collaborate_visual'
  | 'generic_duty';

function fold(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function classifyActionFrame(unit: string): ActionFrame {
  const t = fold(unit);
  // CJK responsibility clauses have no whitespace-equivalent predicate
  // boundary. Classify the owned responsibility from particles/arguments,
  // never by counting each agglutinative surface verb as a new action.
  if (/[\u3040-\u30ff\u3400-\u9fff]/u.test(unit || '')) {
    if (/(?:確認|レビュー|品質|成果物|最終|プロジェクト|案件|検査)/u.test(unit || '')) return 'check_records';
    if (/(?:コンセプト|顧客|クライアント|要望|ニーズ|開発|デザイン|ビジュアル|グラフィック)/u.test(unit || '')) return 'prepare_materials';
    if (/(?:制作|作成|準備|調整|実施|担当)/u.test(unit || '')) return 'prepare_materials';
  }
  // Include Spanish diseño→diseno and revis* so arbitrary-role Romance sources
  // get the same design frames as EN/HR shells (generic predicate path).
  if (/(vizuel|grafick|dizajn|diseno|visual|design|identitet|identity|platform|ビジュアル|تصميم|डिज़ाइन|materiales?\s+visual|elementos?\s+grafic)/.test(t)) {
    // Collaboration only — do not treat bare "product/platform" as collaborate
    // (those appear in ordinary design-creation shells).
    if (/(saradj|collabor|timov|\bteam\b|konsistenc|consistency|تطوير فريق|टीम|チーム)/.test(t)) {
      return 'collaborate_visual';
    }
    if (/(ažur|azur|update|status|reviz|revision|track|ажурир|تحدّث|अद्यतन|更新)/.test(t)) {
      return 'update_records';
    }
    if (/(?:final|archiv|files?|format|pantall|screens?)/.test(t)) {
      return 'update_records';
    }
    if (/(prover|pregled|review|revis|esamin|exam|adapt|prilagod|verif|controll|samic|समीक्षा|راجع|確認)/.test(t)) {
      return 'check_records';
    }
    return 'prepare_materials';
  }
  // Update/coordinate before bare "dokument" so status-tracking units are not
  // collapsed into check_records.
  if (/(ažur|azur|update|evidenc|record|status|raspored|ажурир|обновл|تحدّث|अपडेट|अद्यतन|更新)/.test(t)) {
    return 'update_records';
  }
  if (/(koordin|coord|razmen|exchange|koleg|colleague|inform|координ|تنسّق|समन्वय|調整)/.test(t)) {
    return 'coordinate_info';
  }
  if (/(prover|pregled|check|verif|control|confer|comprueb|revis|tačnost|tacnost|potpunost|dokument|провера|проверя|تتحقق|जाँच|確認)/.test(t)) {
    return 'check_records';
  }
  if (/(priprem|prepar|kreir|creat|finaln|format|ekran|screen|готови|أعد|तैयार|準備)/.test(t)) {
    return 'prepare_materials';
  }
  return 'generic_duty';
}

/** Exported for cross-locale semantic coverage (source↔candidate frames). */
export function classifyExperienceActionFrame(unit: string): ActionFrame {
  return classifyActionFrame(unit);
}

function domainHintFromUnits(units: string[], position?: string): string {
  const title = fold(position || '');
  if (/(dizajn|design|grafick|visual|ui\b|ux\b)/.test(title)) return 'design';
  if (/(skladist|warehouse|magacin|lager|almacen)/.test(title)) return 'warehouse';
  const joined = fold(units.join(' '));
  if (/(grafick|dizajn|vizuel|design|visual|ビジュアル|تصميم|डिज़ाइन)/.test(joined)) {
    return 'design';
  }
  if (/(skladist|склад|warehouse|rob[aeu]|робе|робу|товара|goods|inventar|inventory|مستودع|गोदाम|倉庫|armaz|almac[eé]n|mercanc[ií]a|माल|आवाजाही|तैयारी)/.test(joined)) {
    return 'warehouse';
  }
  if (/(dokument|document|evidenc|record|وثائق|दस्तावेज़|書類)/.test(joined)) {
    return 'documentation';
  }
  return 'work';
}

function englishBullet(
  frame: ActionFrame,
  domain: string,
  isPresent: boolean,
): string {
  const past = !isPresent;
  switch (frame) {
    case 'check_records':
      if (domain === 'warehouse') {
        // Soft cross-locale shells (Serbian/Hindi/…). Strict Spanish→English
        // Atlas uses buildEnglishWarehouseExperienceFallback instead.
        return past
          ? 'Checked incoming goods for accurate recording.'
          : 'Checks incoming goods for accurate recording.';
      }
      if (domain === 'design') {
        return past
          ? 'Reviewed and adapted design materials to project requirements.'
          : 'Reviews and adapts design materials to project requirements.';
      }
      return past
        ? 'Reviewed documentation and checked completeness of related records.'
        : 'Reviews documentation and checks completeness of related records.';
    case 'update_records':
      if (domain === 'warehouse') {
        return past
          ? 'Verified related documentation, updated warehouse records, and maintained orderly arrangement of goods.'
          : 'Verifies related documentation, updates warehouse records, and maintains orderly arrangement of goods.';
      }
      if (domain === 'design') {
        return past
          ? 'Prepared final design files and set formats for different screens.'
          : 'Prepares final design files and sets formats for different screens.';
      }
      return past
        ? 'Updated work records and tracked the status of open items.'
        : 'Updates work records and tracks the status of open items.';
    case 'coordinate_info':
      if (domain === 'warehouse') {
        return past
          ? 'Coordinated preparation and movement of goods with colleagues.'
          : 'Coordinates preparation and movement of goods with colleagues.';
      }
      if (domain === 'design') {
        return past
          ? 'Coordinated design handoffs with colleagues to keep deliverables on schedule.'
          : 'Coordinates design handoffs with colleagues to keep deliverables on schedule.';
      }
      return past
        ? 'Coordinated information sharing with colleagues to complete documentation on time.'
        : 'Coordinates information sharing with colleagues to complete documentation on time.';
    case 'collaborate_visual':
      return past
        ? 'Collaborated with product and development teams to keep visual identity consistent.'
        : 'Collaborates with product and development teams to keep visual identity consistent.';
    case 'prepare_materials':
      if (domain === 'design') {
        return past
          ? 'Created visual materials and graphic elements for digital products and platforms.'
          : 'Creates visual materials and graphic elements for digital products and platforms.';
      }
      if (domain === 'warehouse') {
        return past
          ? 'Prepared goods and related documentation for accurate handling.'
          : 'Prepares goods and related documentation for accurate handling.';
      }
      return past
        ? 'Prepared work materials and adjusted outputs to required formats.'
        : 'Prepares work materials and adjusts outputs to required formats.';
    default:
      if (domain === 'design') {
        return past
          ? 'Carried out day-to-day design duties while checking accuracy of related materials.'
          : 'Performs day-to-day design duties while checking accuracy of related materials.';
      }
      return past
        ? 'Carried out day-to-day role duties while checking accuracy of related records.'
        : 'Performs day-to-day role duties while checking accuracy of related records.';
  }
}

function serbianBullet(
  frame: ActionFrame,
  domain: string,
  isPresent: boolean,
  female: boolean,
): string {
  const pastF = female;
  switch (frame) {
    case 'check_records':
      if (domain === 'warehouse') {
        return isPresent
          ? 'Proverava pristiglu robu i prateću dokumentaciju radi tačnog evidentiranja.'
          : (pastF
            ? 'Proveravala je pristiglu robu i prateću dokumentaciju radi tačnog evidentiranja.'
            : 'Proveravao je pristiglu robu i prateću dokumentaciju radi tačnog evidentiranja.');
      }
      if (domain === 'design') {
        return isPresent
          ? 'Pregleda i prilagođava vizuelne i dizajn materijale prema projektnim zahtevima.'
          : (pastF
            ? 'Pregledala je i prilagođavala vizuelne i dizajn materijale prema projektnim zahtevima.'
            : 'Pregledao je i prilagođavao vizuelne i dizajn materijale prema projektnim zahtevima.');
      }
      return isPresent
        ? 'Pregleda dokumentaciju i proverava potpunost podataka.'
        : (pastF
          ? 'Pregledala je dokumentaciju i proveravala potpunost podataka.'
          : 'Pregledao je dokumentaciju i proveravao potpunost podataka.');
    case 'update_records':
      if (domain === 'warehouse') {
        return isPresent
          ? 'Ažurira skladišnu evidenciju i vodi računa o urednom rasporedu robe.'
          : (pastF
            ? 'Ažurirala je skladišnu evidenciju i vodila računa o urednom rasporedu robe.'
            : 'Ažurirao je skladišnu evidenciju i vodio računa o urednom rasporedu robe.');
      }
      if (domain === 'design') {
        return isPresent
          ? 'Ažurira dizajn fajlove i prati status izmena na materijalima.'
          : (pastF
            ? 'Ažurirala je dizajn fajlove i pratila status izmena na materijalima.'
            : 'Ažurirao je dizajn fajlove i pratio status izmena na materijalima.');
      }
      return isPresent
        ? 'Ažurira evidenciju i prati status dokumentacije u skladu sa potrebama radnog mesta.'
        : (pastF
          ? 'Ažurirala je evidenciju i pratila status dokumentacije.'
          : 'Ažurirao je evidenciju i pratio status dokumentacije.');
    case 'coordinate_info':
      if (domain === 'warehouse') {
        return isPresent
          ? 'Koordiniše pripremu i kretanje robe u saradnji sa kolegama.'
          : (pastF
            ? 'Koordinisala je pripremu i kretanje robe u saradnji sa kolegama.'
            : 'Koordinisao je pripremu i kretanje robe u saradnji sa kolegama.');
      }
      if (domain === 'design') {
        return isPresent
          ? 'Koordiniše predaju dizajn materijala sa kolegama radi poštovanja rokova.'
          : (pastF
            ? 'Koordinisala je predaju dizajn materijala sa kolegama radi poštovanja rokova.'
            : 'Koordinisao je predaju dizajn materijala sa kolegama radi poštovanja rokova.');
      }
      return isPresent
        ? 'Koordiniše razmenu informacija sa kolegama radi pravovremenog kompletiranja dokumentacije.'
        : (pastF
          ? 'Koordinisala je razmenu informacija sa kolegama.'
          : 'Koordinisao je razmenu informacija sa kolegama.');
    case 'collaborate_visual':
      return isPresent
        ? 'Sarađuje sa timovima za proizvod i razvoj radi očuvanja doslednog vizuelnog identiteta.'
        : (pastF
          ? 'Sarađivala je sa timovima za proizvod i razvoj radi očuvanja doslednog vizuelnog identiteta.'
          : 'Sarađivao je sa timovima za proizvod i razvoj radi očuvanja doslednog vizuelnog identiteta.');
    case 'prepare_materials':
      if (domain === 'design') {
        return isPresent
          ? 'Kreira vizuelne materijale i grafičke elemente za digitalne proizvode i platforme.'
          : (pastF
            ? 'Kreirala je vizuelne materijale i grafičke elemente za digitalne proizvode i platforme.'
            : 'Kreirao je vizuelne materijale i grafičke elemente za digitalne proizvode i platforme.');
      }
      return isPresent
        ? 'Priprema radne materijale i prilagođava izlaze potrebnim formatima.'
        : (pastF
          ? 'Pripremala je radne materijale i prilagođavala izlaze potrebnim formatima.'
          : 'Pripremao je radne materijale i prilagođavao izlaze potrebnim formatima.');
    default:
      return isPresent
        ? 'Obavlja svakodnevne dužnosti uz proveru tačnosti povezanih podataka.'
        : (pastF
          ? 'Obavljala je svakodnevne dužnosti uz proveru tačnosti povezanih podataka.'
          : 'Obavljao je svakodnevne dužnosti uz proveru tačnosti povezanih podataka.');
  }
}

/** Soft target-locale shells keyed by action frame + domain (not occupation catalogues). */
function localizedShellBullet(
  locale: Locale,
  frame: ActionFrame,
  isPresent: boolean,
  domain: string,
): string | null {
  const past = !isPresent;
  // Never emit English under a non-English target. Warehouse locale tables below
  // are warehouse-only; design/docs/work must not inherit goods/incoming wording.
  // Canonicalize pt / pt-br / pt_BR aliases onto the `pt-BR` shell table.
  const shellLocale: Locale = (String(locale || '').toLowerCase().replace(/_/g, '-').startsWith('pt')
    ? 'pt-BR'
    : locale);
  if (shellLocale === 'en') {
    return englishBullet(frame, domain, isPresent);
  }
  if (domain !== 'warehouse') {
    const designTable: Partial<Record<Locale, Record<ActionFrame, [string, string]>>> = {
      de: {
        check_records: [
          'Prüft und passt Designmaterialien an die Projektanforderungen an.',
          'Prüfte und passte Designmaterialien an die Projektanforderungen an.',
        ],
        update_records: [
          'Bereitet finale Designdateien vor und stellt Formate für unterschiedliche Bildschirme ein.',
          'Bereitete finale Designdateien vor und stellte Formate für unterschiedliche Bildschirme ein.',
        ],
        coordinate_info: [
          'Koordiniert Designübergaben mit Kolleginnen und Kollegen, um Termine einzuhalten.',
          'Koordinierte Designübergaben mit Kolleginnen und Kollegen, um Termine einzuhalten.',
        ],
        prepare_materials: [
          'Erstellt visuelle Materialien und grafische Elemente für digitale Produkte und Plattformen.',
          'Erstellte visuelle Materialien und grafische Elemente für digitale Produkte und Plattformen.',
        ],
        collaborate_visual: [
          'Arbeitet mit Produkt- und Entwicklungsteams zusammen, um die visuelle Identität konsistent zu halten.',
          'Arbeitete mit Produkt- und Entwicklungsteams zusammen, um die visuelle Identität konsistent zu halten.',
        ],
        generic_duty: [
          'Erledigt die täglichen Designaufgaben und prüft die Genauigkeit zugehöriger Materialien.',
          'Erledigte die täglichen Designaufgaben und prüfte die Genauigkeit zugehöriger Materialien.',
        ],
      },
      es: {
        check_records: [
          'Revisa y adapta materiales de diseño según los requisitos del proyecto.',
          'Revisó y adaptó materiales de diseño según los requisitos del proyecto.',
        ],
        update_records: [
          'Prepara archivos finales de diseño y ajusta formatos para distintas pantallas.',
          'Preparó archivos finales de diseño y ajustó formatos para distintas pantallas.',
        ],
        coordinate_info: [
          'Coordina las entregas de diseño con sus compañeros para cumplir los plazos.',
          'Coordinó las entregas de diseño con sus compañeros para cumplir los plazos.',
        ],
        prepare_materials: [
          'Crea materiales visuales y elementos gráficos para productos y plataformas digitales.',
          'Creó materiales visuales y elementos gráficos para productos y plataformas digitales.',
        ],
        collaborate_visual: [
          'Colabora con equipos de producto y desarrollo para mantener la identidad visual.',
          'Colaboró con equipos de producto y desarrollo para mantener la identidad visual.',
        ],
        generic_duty: [
          'Realiza las tareas diarias de diseño y comprueba la exactitud de los materiales relacionados.',
          'Realizó las tareas diarias de diseño y comprobó la exactitud de los materiales relacionados.',
        ],
      },
      fr: {
        check_records: [
          'Revoit et adapte les matériaux de design selon les exigences du projet.',
          'A revu et adapté les matériaux de design selon les exigences du projet.',
        ],
        update_records: [
          'Prépare les fichiers finaux de design et ajuste les formats pour différents écrans.',
          'A préparé les fichiers finaux de design et ajusté les formats pour différents écrans.',
        ],
        coordinate_info: [
          'Coordonne les livraisons de design avec ses collègues pour respecter les délais.',
          'A coordonné les livraisons de design avec ses collègues pour respecter les délais.',
        ],
        prepare_materials: [
          'Crée des matériaux visuels et des éléments graphiques pour des produits et plateformes numériques.',
          'A créé des matériaux visuels et des éléments graphiques pour des produits et plateformes numériques.',
        ],
        collaborate_visual: [
          'Collabore avec les équipes produit et développement pour maintenir l’identité visuelle.',
          'A collaboré avec les équipes produit et développement pour maintenir l’identité visuelle.',
        ],
        generic_duty: [
          'Assure les tâches quotidiennes de design et vérifie l’exactitude des matériaux associés.',
          'A assuré les tâches quotidiennes de design et vérifié l’exactitude des matériaux associés.',
        ],
      },
      it: {
        check_records: [
          'Rivede e adatta i materiali di design in base ai requisiti del progetto.',
          'Ha rivisto e adattato i materiali di design in base ai requisiti del progetto.',
        ],
        update_records: [
          'Prepara i file finali di design e regola i formati per schermi diversi.',
          'Ha preparato i file finali di design e regolato i formati per schermi diversi.',
        ],
        coordinate_info: [
          'Coordina le consegne di design con i colleghi per rispettare le scadenze.',
          'Ha coordinato le consegne di design con i colleghi per rispettare le scadenze.',
        ],
        prepare_materials: [
          'Crea materiali visivi ed elementi grafici per prodotti e piattaforme digitali.',
          'Ha creato materiali visivi ed elementi grafici per prodotti e piattaforme digitali.',
        ],
        collaborate_visual: [
          'Collabora con i team di prodotto e sviluppo per mantenere l’identità visiva.',
          'Ha collaborato con i team di prodotto e sviluppo per mantenere l’identità visiva.',
        ],
        generic_duty: [
          'Svolge i compiti quotidiani di design e verifica l’accuratezza dei materiali correlati.',
          'Ha svolto i compiti quotidiani di design e verificato l’accuratezza dei materiali correlati.',
        ],
      },
      hi: {
        check_records: [
          'प्रोजेक्ट आवश्यकताओं के अनुसार डिज़ाइन सामग्री की समीक्षा और अनुकूलन करती है।',
          'प्रोजेक्ट आवश्यकताओं के अनुसार डिज़ाइन सामग्री की समीक्षा और अनुकूलन किया।',
        ],
        update_records: [
          'अंतिम डिज़ाइन फ़ाइलें तैयार करती है और विभिन्न स्क्रीन के लिए प्रारूप सेट करती है।',
          'अंतिम डिज़ाइन फ़ाइलें तैयार कीं और विभिन्न स्क्रीन के लिए प्रारूप सेट किए।',
        ],
        coordinate_info: [
          'सहकर्मियों के साथ डिज़ाइन हैंडऑफ़ का समन्वय करती है ताकि डिलिवरेबल्स समय पर रहें।',
          'सहकर्मियों के साथ डिज़ाइन हैंडऑफ़ का समन्वय किया ताकि डिलिवरेबल्स समय पर रहें।',
        ],
        prepare_materials: [
          'डिजिटल उत्पादों और प्लेटफ़ॉर्मों के लिए दृश्य सामग्री और ग्राफ़िक तत्व बनाती है।',
          'डिजिटल उत्पादों और प्लेटफ़ॉर्मों के लिए दृश्य सामग्री और ग्राफ़िक तत्व बनाए।',
        ],
        collaborate_visual: [
          'दृश्य पहचान की निरंतरता बनाए रखने के लिए उत्पाद और विकास टीमों के साथ सहयोग करती है।',
          'दृश्य पहचान की निरंतरता बनाए रखने के लिए उत्पाद और विकास टीमों के साथ सहयोग किया।',
        ],
        generic_duty: [
          'भूमिका के दैनिक डिज़ाइन कर्तव्य पूरे करती है और संबंधित सामग्री की सटीकता जाँचती है।',
          'भूमिका के दैनिक डिज़ाइन कर्तव्य पूरे किए और संबंधित सामग्री की सटीकता जाँची।',
        ],
      },
      ar: {
        check_records: [
          'تراجع وتكيّف مواد التصميم وفق متطلبات المشروع.',
          'راجعت وكيّفت مواد التصميم وفق متطلبات المشروع.',
        ],
        update_records: [
          'تُعدّ ملفات التصميم النهائية وتضبط الصيغ لشاشات مختلفة.',
          'أعدت ملفات التصميم النهائية وضبطت الصيغ لشاشات مختلفة.',
        ],
        coordinate_info: [
          'تنسّق تسليمات التصميم مع الزملاء للحفاظ على الجداول.',
          'نسّقت تسليمات التصميم مع الزملاء للحفاظ على الجداول.',
        ],
        prepare_materials: [
          'تنشئ مواد بصرية وعناصر رسومية للمنتجات والمنصات الرقمية.',
          'أنشأت مواد بصرية وعناصر رسومية للمنتجات والمنصات الرقمية.',
        ],
        collaborate_visual: [
          'تتعاون مع فرق المنتج والتطوير للحفاظ على اتساق الهوية البصرية.',
          'تعاونت مع فرق المنتج والتطوير للحفاظ على اتساق الهوية البصرية.',
        ],
        generic_duty: [
          'تؤدي المهام اليومية للتصميم مع التحقق من دقة المواد ذات الصلة.',
          'أدّت المهام اليومية للتصميم مع التحقق من دقة المواد ذات الصلة.',
        ],
      },
      ja: {
        check_records: [
          'プロジェクト要件に合わせてデザイン素材を確認し適合させる。',
          'プロジェクト要件に合わせてデザイン素材を確認し適合させた。',
        ],
        update_records: [
          '最終デザインファイルを準備し、異なる画面向けに形式を整える。',
          '最終デザインファイルを準備し、異なる画面向けに形式を整えた。',
        ],
        coordinate_info: [
          '同僚と連携してデザインの引き渡しを調整し、納期を守る。',
          '同僚と連携してデザインの引き渡しを調整し、納期を守った。',
        ],
        prepare_materials: [
          'デジタル製品やプラットフォーム向けにビジュアル素材とグラフィック要素を作成する。',
          'デジタル製品やプラットフォーム向けにビジュアル素材とグラフィック要素を作成した。',
        ],
        collaborate_visual: [
          'ビジュアルアイデンティティの一貫性を保つため、製品・開発チームと連携する。',
          'ビジュアルアイデンティティの一貫性を保つため、製品・開発チームと連携した。',
        ],
        generic_duty: [
          '関連素材の正確性を確認しながら日常のデザイン業務を遂行する。',
          '関連素材の正確性を確認しながら日常のデザイン業務を遂行した。',
        ],
      },
      ru: {
        check_records: [
          'Проверяет и адаптирует дизайн-материалы в соответствии с требованиями проекта.',
          'Проверяла и адаптировала дизайн-материалы в соответствии с требованиями проекта.',
        ],
        update_records: [
          'Подготавливает финальные дизайн-файлы и настраивает форматы для разных экранов.',
          'Подготавливала финальные дизайн-файлы и настраивала форматы для разных экранов.',
        ],
        coordinate_info: [
          'Координирует передачу дизайн-материалов с коллегами для соблюдения сроков.',
          'Координировала передачу дизайн-материалов с коллегами для соблюдения сроков.',
        ],
        prepare_materials: [
          'Создаёт визуальные материалы и графические элементы для цифровых продуктов и платформ.',
          'Создавала визуальные материалы и графические элементы для цифровых продуктов и платформ.',
        ],
        collaborate_visual: [
          'Сотрудничает с командами продукта и разработки для сохранения визуальной идентичности.',
          'Сотрудничала с командами продукта и разработки для сохранения визуальной идентичности.',
        ],
        generic_duty: [
          'Выполняет повседневные дизайн-обязанности, проверяя точность связанных материалов.',
          'Выполняла повседневные дизайн-обязанности, проверяя точность связанных материалов.',
        ],
      },
      'pt-BR': {
        check_records: [
          'Revisa e adapta materiais de design conforme os requisitos do projeto.',
          'Revisou e adaptou materiais de design conforme os requisitos do projeto.',
        ],
        update_records: [
          'Prepara arquivos finais de design e ajusta formatos para telas diferentes.',
          'Preparou arquivos finais de design e ajustou formatos para telas diferentes.',
        ],
        coordinate_info: [
          'Coordena handoffs de design com colegas para manter os prazos.',
          'Coordenou handoffs de design com colegas para manter os prazos.',
        ],
        prepare_materials: [
          'Cria materiais visuais e elementos gráficos para produtos e plataformas digitais.',
          'Criou materiais visuais e elementos gráficos para produtos e plataformas digitais.',
        ],
        collaborate_visual: [
          'Colabora com equipes de produto e desenvolvimento para manter a identidade visual.',
          'Colaborou com equipes de produto e desenvolvimento para manter a identidade visual.',
        ],
        generic_duty: [
          'Executa as tarefas diárias de design verificando a precisão dos materiais relacionados.',
          'Executou as tarefas diárias de design verificando a precisão dos materiais relacionados.',
        ],
      },
      sr: {
        check_records: [
          'Pregleda i prilagođava dizajnerske materijale prema zahtevima projekta.',
          'Pregledala je i prilagođavala dizajnerske materijale prema zahtevima projekta.',
        ],
        update_records: [
          'Priprema završne dizajn fajlove i podešava formate za različite ekrane.',
          'Pripremala je završne dizajn fajlove i podešavala formate za različite ekrane.',
        ],
        coordinate_info: [
          'Koordinira predaje dizajna sa kolegama kako bi se poštovali rokovi.',
          'Koordinirala je predaje dizajna sa kolegama kako bi se poštovali rokovi.',
        ],
        prepare_materials: [
          'Kreira vizuelne materijale i grafičke elemente za digitalne proizvode i platforme.',
          'Kreirala je vizuelne materijale i grafičke elemente za digitalne proizvode i platforme.',
        ],
        collaborate_visual: [
          'Sarađuje sa timovima proizvoda i razvoja kako bi vizuelni identitet ostao dosledan.',
          'Sarađivala je sa timovima proizvoda i razvoja kako bi vizuelni identitet ostao dosledan.',
        ],
        generic_duty: [
          'Obavlja svakodnevne dizajnerske dužnosti uz proveru tačnosti povezanih materijala.',
          'Obavljala je svakodnevne dizajnerske dužnosti uz proveru tačnosti povezanih materijala.',
        ],
      },
      hr: {
        check_records: [
          'Pregledava i prilagođava dizajnerske materijale prema zahtjevima projekta.',
          'Pregledavala je i prilagođavala dizajnerske materijale prema zahtjevima projekta.',
        ],
        update_records: [
          'Priprema završne dizajnerske datoteke i podešava formate za različite zaslone.',
          'Pripremala je završne dizajnerske datoteke i podešavala formate za različite zaslone.',
        ],
        coordinate_info: [
          'Koordinira predaje dizajna s kolegama kako bi se poštovali rokovi.',
          'Koordinirala je predaje dizajna s kolegama kako bi se poštovali rokovi.',
        ],
        prepare_materials: [
          'Izrađuje vizualne materijale i grafičke elemente za digitalne proizvode i platforme.',
          'Izrađivala je vizualne materijale i grafičke elemente za digitalne proizvode i platforme.',
        ],
        collaborate_visual: [
          'Surađuje s timovima proizvoda i razvoja kako bi vizualni identitet ostao dosljedan.',
          'Surađivala je s timovima proizvoda i razvoja kako bi vizualni identitet ostao dosljedan.',
        ],
        generic_duty: [
          'Obavlja svakodnevne dizajnerske dužnosti uz provjeru točnosti povezanih materijala.',
          'Obavljala je svakodnevne dizajnerske dužnosti uz provjeru točnosti povezanih materijala.',
        ],
      },
    };
    if (domain === 'design' && designTable[shellLocale]?.[frame]) {
      const row = designTable[shellLocale]![frame]!;
      return past ? row[1] : row[0];
    }
    if (domain !== 'design' && designTable[shellLocale]) {
      // Documentation / generic work: avoid goods wording; use soft generic shells.
      const loc = designTable[shellLocale]!;
      const generic = loc.generic_duty;
      const map: Record<ActionFrame, [string, string]> = {
        check_records: loc.check_records,
        update_records: loc.update_records,
        coordinate_info: loc.coordinate_info,
        prepare_materials: loc.prepare_materials,
        collaborate_visual: loc.collaborate_visual,
        generic_duty: generic,
      };
      // Soften design-specific frames for non-design domains via generic_duty.
      const row = frame === 'prepare_materials' || frame === 'collaborate_visual'
        ? generic
        : map[frame];
      if (row) return past ? row[1] : row[0];
    }
    return null;
  }
  const table: Partial<Record<Locale, Record<ActionFrame, [string, string]>>> = {
    de: {
      check_records: [
        'Prüft eingehende Waren und Begleitdokumente auf korrekte Erfassung.',
        'Prüfte eingehende Waren und Begleitdokumente auf korrekte Erfassung.',
      ],
      update_records: [
        'Aktualisiert Lagerunterlagen und achtet auf eine geordnete Lagerung.',
        'Aktualisierte Lagerunterlagen und achtete auf eine geordnete Lagerung.',
      ],
      coordinate_info: [
        'Koordiniert Vorbereitung und Bewegung von Waren mit Kolleginnen und Kollegen.',
        'Koordinierte Vorbereitung und Bewegung von Waren mit Kolleginnen und Kollegen.',
      ],
      prepare_materials: [
        'Bereitet Arbeitsmaterialien vor und passt Ausgaben an erforderliche Formate an.',
        'Bereitete Arbeitsmaterialien vor und passte Ausgaben an erforderliche Formate an.',
      ],
      collaborate_visual: [
        'Arbeitet mit Produkt- und Entwicklungsteams zusammen, um die visuelle Identität konsistent zu halten.',
        'Arbeitete mit Produkt- und Entwicklungsteams zusammen, um die visuelle Identität konsistent zu halten.',
      ],
      generic_duty: [
        'Erledigt die täglichen Aufgaben der Rolle und prüft die Genauigkeit zugehöriger Unterlagen.',
        'Erledigte die täglichen Aufgaben der Rolle und prüfte die Genauigkeit zugehöriger Unterlagen.',
      ],
    },
    es: {
      check_records: [
        'Revisa la mercancía entrante y la documentación relacionada.',
        'Revisó la mercancía entrante y la documentación relacionada.',
      ],
      update_records: [
        'Comprueba la documentación relacionada y mantiene el orden de la mercancía.',
        'Comprobó la documentación relacionada y mantuvo el orden de la mercancía.',
      ],
      coordinate_info: [
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
        'Coordinó con sus compañeros la preparación y el movimiento de la mercancía.',
      ],
      prepare_materials: [
        'Prepara materiales de trabajo y ajusta las salidas a los formatos necesarios.',
        'Preparó materiales de trabajo y ajustó las salidas a los formatos necesarios.',
      ],
      collaborate_visual: [
        'Colabora con equipos de producto y desarrollo para mantener la identidad visual.',
        'Colaboró con equipos de producto y desarrollo para mantener la identidad visual.',
      ],
      generic_duty: [
        'Realiza las tareas diarias del rol y comprueba la exactitud de los registros relacionados.',
        'Realizó las tareas diarias del rol y comprobó la exactitud de los registros relacionados.',
      ],
    },
    hi: {
      check_records: [
        'आने वाली वस्तुओं और संबंधित दस्तावेज़ों की जाँच करती है ताकि रिकॉर्ड सही रहें।',
        'आने वाली वस्तुओं और संबंधित दस्तावेज़ों की जाँच की ताकि रिकॉर्ड सही रहें।',
      ],
      update_records: [
        'कार्य रिकॉर्ड अद्यतन करती है और खुली स्थितियों की प्रगति ट्रैक करती है।',
        'कार्य रिकॉर्ड अद्यतन किए और खुली स्थितियों की प्रगति ट्रैक की।',
      ],
      coordinate_info: [
        'सहकर्मियों के साथ जानकारी साझा कर काम के समय पर पूरा होने का समन्वय करती है।',
        'सहकर्मियों के साथ जानकारी साझा कर काम के समय पर पूरा होने का समन्वय किया।',
      ],
      prepare_materials: [
        'कार्य सामग्री तैयार करती है और आउटपुट को आवश्यक प्रारूपों में समायोजित करती है।',
        'कार्य सामग्री तैयार की और आउटपुट को आवश्यक प्रारूपों में समायोजित किया।',
      ],
      collaborate_visual: [
        'दृश्य पहचान की निरंतरता बनाए रखने के लिए उत्पाद और विकास टीमों के साथ सहयोग करती है।',
        'दृश्य पहचान की निरंतरता बनाए रखने के लिए उत्पाद और विकास टीमों के साथ सहयोग किया।',
      ],
      generic_duty: [
        'भूमिका के दैनिक कर्तव्य पूरे करती है और सौंपे गए कार्यों की सटीकता सुनिश्चित करती है।',
        'भूमिका के दैनिक कर्तव्य पूरे किए और सौंपे गए कार्यों की सटीकता सुनिश्चित की।',
      ],
    },
    ar: {
      check_records: [
        'تتحقق من البضائع الواردة والوثائق المرفقة لضمان التسجيل الدقيق.',
        'تحققت من البضائع الواردة والوثائق المرفقة لضمان التسجيل الدقيق.',
      ],
      update_records: [
        'تحدّث سجلات المستودع وتحافظ على ترتيب البضائع.',
        'حدّثت سجلات المستودع وحافظت على ترتيب البضائع.',
      ],
      coordinate_info: [
        'تنسّق إعداد البضائع وحركتها مع الزملاء.',
        'نسّقت إعداد البضائع وحركتها مع الزملاء.',
      ],
      prepare_materials: [
        'تُعدّ مواد العمل وتضبط المخرجات وفق الصيغ المطلوبة.',
        'أعدّت مواد العمل وضبطت المخرجات وفق الصيغ المطلوبة.',
      ],
      collaborate_visual: [
        'تتعاون مع فرق المنتج والتطوير للحفاظ على اتساق الهوية البصرية.',
        'تعاونت مع فرق المنتج والتطوير للحفاظ على اتساق الهوية البصرية.',
      ],
      generic_duty: [
        'تؤدي المهام اليومية للدور مع التحقق من دقة السجلات ذات الصلة.',
        'أدّت المهام اليومية للدور مع التحقق من دقة السجلات ذات الصلة.',
      ],
    },
    ja: {
      check_records: [
        '入荷した商品と関連書類の正確性を確認する。',
        '入荷した商品と関連書類の正確性を確認した。',
      ],
      update_records: [
        '倉庫記録を更新し、保管品の整然とした配置を維持する。',
        '倉庫記録を更新し、保管品の整然とした配置を維持した。',
      ],
      coordinate_info: [
        '同僚と連携して商品の準備と移動を調整する。',
        '同僚と連携して商品の準備と移動を調整した。',
      ],
      prepare_materials: [
        '作業資料を準備し、必要な形式に合わせて成果物を調整する。',
        '作業資料を準備し、必要な形式に合わせて成果物を調整した。',
      ],
      collaborate_visual: [
        'ビジュアルアイデンティティの一貫性を保つため、製品・開発チームと連携する。',
        'ビジュアルアイデンティティの一貫性を保つため、製品・開発チームと連携した。',
      ],
      generic_duty: [
        '関連記録の正確性を確認しながら日常業務を遂行する。',
        '関連記録の正確性を確認しながら日常業務を遂行した。',
      ],
    },
    ru: {
      check_records: [
        'Проверяет поступившие товары и сопроводительные документы для точного учёта.',
        'Проверяла поступившие товары и сопроводительные документы для точного учёта.',
      ],
      update_records: [
        'Обновляет складской учёт и поддерживает упорядоченное размещение товаров.',
        'Обновляла складской учёт и поддерживала упорядоченное размещение товаров.',
      ],
      coordinate_info: [
        'Координирует подготовку и перемещение товаров совместно с коллегами.',
        'Координировала подготовку и перемещение товаров совместно с коллегами.',
      ],
      prepare_materials: [
        'Готовит рабочие материалы и адаптирует результаты под нужные форматы.',
        'Готовила рабочие материалы и адаптировала результаты под нужные форматы.',
      ],
      collaborate_visual: [
        'Сотрудничает с командами продукта и разработки для сохранения визуальной идентичности.',
        'Сотрудничала с командами продукта и разработки для сохранения визуальной идентичности.',
      ],
      generic_duty: [
        'Выполняет повседневные обязанности роли, проверяя точность связанных записей.',
        'Выполняла повседневные обязанности роли, проверяя точность связанных записей.',
      ],
    },
    'pt-BR': {
      check_records: [
        'Verifica mercadorias recebidas e documentação relacionada para registro preciso.',
        'Verificou mercadorias recebidas e documentação relacionada para registro preciso.',
      ],
      update_records: [
        'Atualiza registros do armazém e mantém a organização das mercadorias.',
        'Atualizou registros do armazém e manteve a organização das mercadorias.',
      ],
      coordinate_info: [
        'Coordena a preparação e o movimento de mercadorias com colegas.',
        'Coordenou a preparação e o movimento de mercadorias com colegas.',
      ],
      prepare_materials: [
        'Prepara materiais de trabalho e ajusta saídas aos formatos necessários.',
        'Preparou materiais de trabalho e ajustou saídas aos formatos necessários.',
      ],
      collaborate_visual: [
        'Colabora com equipes de produto e desenvolvimento para manter a identidade visual.',
        'Colaborou com equipes de produto e desenvolvimento para manter a identidade visual.',
      ],
      generic_duty: [
        'Executa as tarefas diárias da função verificando a precisão dos registros relacionados.',
        'Executou as tarefas diárias da função verificando a precisão dos registros relacionados.',
      ],
    },
  };
  const row = table[shellLocale]?.[frame];
  if (!row) return null;
  return past ? row[1] : row[0];
}

function hindiWarehouseBullet(frame: ActionFrame, isPresent: boolean): string | null {
  const past = !isPresent;
  switch (frame) {
    case 'check_records':
      return past
        ? 'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित की।'
        : 'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित करती है।';
    case 'update_records':
      return past
        ? 'गोदाम के रिकॉर्ड अद्यतन किए और सामान को व्यवस्थित रखा।'
        : 'गोदाम के रिकॉर्ड अद्यतन करती है और सामान को व्यवस्थित रखती है।';
    case 'coordinate_info':
      return past
        ? 'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय किया।'
        : 'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।';
    default:
      return null;
  }
}

function croatianBullet(
  frame: ActionFrame,
  domain: string,
  isPresent: boolean,
  female: boolean,
): string {
  const pastF = female;
  switch (frame) {
    case 'check_records':
      if (domain === 'warehouse') {
        // Soft frame still merges goods+docs — hard HR grounding rejects this and
        // selects the dedicated three-fact Croatian warehouse fallback instead.
        return isPresent
          ? 'Provjerava točnost zaprimljene robe i prateće dokumentacije.'
          : (pastF
            ? 'Provjeravala je točnost zaprimljene robe i prateće dokumentacije.'
            : 'Provjeravao je točnost zaprimljene robe i prateće dokumentacije.');
      }
      return isPresent
        ? 'Pregledava dokumentaciju i provjerava potpunost podataka.'
        : (pastF
          ? 'Pregledala je dokumentaciju i provjeravala potpunost podataka.'
          : 'Pregledao je dokumentaciju i provjeravao potpunost podataka.');
    case 'update_records':
      if (domain === 'warehouse') {
        return isPresent
          ? 'Ažurira skladišnu evidenciju te održava uredno i organizirano skladištenje robe.'
          : (pastF
            ? 'Ažurirala je skladišnu evidenciju te održavala uredno i organizirano skladištenje robe.'
            : 'Ažurirao je skladišnu evidenciju te održavao uredno i organizirano skladištenje robe.');
      }
      return isPresent
        ? 'Ažurira evidenciju i prati status dokumentacije.'
        : (pastF
          ? 'Ažurirala je evidenciju i pratila status dokumentacije.'
          : 'Ažurirao je evidenciju i pratio status dokumentacije.');
    case 'coordinate_info':
      if (domain === 'warehouse') {
        return isPresent
          ? 'Surađuje s kolegama na pripremi i premještanju robe.'
          : (pastF
            ? 'Surađivala je s kolegama na pripremi i premještanju robe.'
            : 'Surađivao je s kolegama na pripremi i premještanju robe.');
      }
      return isPresent
        ? 'Koordinira razmjenu informacija s kolegama.'
        : (pastF
          ? 'Koordinirala je razmjenu informacija s kolegama.'
          : 'Koordinirao je razmjenu informacija s kolegama.');
    case 'collaborate_visual':
      return isPresent
        ? 'Surađuje s timovima za proizvod i razvoj radi očuvanja dosljednog vizualnog identiteta.'
        : (pastF
          ? 'Surađivala je s timovima za proizvod i razvoj radi očuvanja dosljednog vizualnog identiteta.'
          : 'Surađivao je s timovima za proizvod i razvoj radi očuvanja dosljednog vizualnog identiteta.');
    case 'prepare_materials':
      if (domain === 'design') {
        return isPresent
          ? 'Kreira vizualne materijale i grafičke elemente za digitalne proizvode i platforme.'
          : (pastF
            ? 'Kreirala je vizualne materijale i grafičke elemente za digitalne proizvode i platforme.'
            : 'Kreirao je vizualne materijale i grafičke elemente za digitalne proizvode i platforme.');
      }
      return isPresent
        ? 'Priprema radne materijale i prilagođava izlaze potrebnim formatima.'
        : (pastF
          ? 'Pripremala je radne materijale i prilagođavala izlaze potrebnim formatima.'
          : 'Pripremao je radne materijale i prilagođavao izlaze potrebnim formatima.');
    default:
      return isPresent
        ? 'Obavlja svakodnevne dužnosti radnog mjesta.'
        : (pastF
          ? 'Obavljala je svakodnevne dužnosti radnog mjesta.'
          : 'Obavljao je svakodnevne dužnosti radnog mjesta.');
  }
}

function bulletForLocale(
  locale: Locale,
  frame: ActionFrame,
  domain: string,
  isPresent: boolean,
  gender?: string,
): string {
  const female = /^(female|f|ženski|zenski)$/i.test(String(gender || ''));
  if (locale === 'en') {
    return applyEnglishEmploymentTense(englishBullet(frame, domain, isPresent), isPresent);
  }
  if (locale === 'sr') {
    return applySerbianCvEmploymentTense(
      serbianBullet(frame, domain, isPresent, female),
      isPresent,
      gender,
    );
  }
  if (locale === 'hr') {
    return applySerbianCvEmploymentTense(
      croatianBullet(frame, domain, isPresent, female),
      isPresent,
      gender,
    );
  }
  if (locale === 'hi' && domain === 'warehouse') {
    const warehouse = hindiWarehouseBullet(frame, isPresent);
    if (warehouse) return warehouse;
  }
  const shell = localizedShellBullet(locale, frame, isPresent, domain);
  if (shell) {
    return locale === 'ar'
      ? realizeArabicBuiltExperiencePersonEvidence(shell, { isPresent, gender })
      : shell;
  }
  // Unknown target: English CV form (never return the source language).
  return applyEnglishEmploymentTense(englishBullet(frame, domain, isPresent), isPresent);
}

function nearDupOfAny(candidate: string, existing: string[]): boolean {
  const norm = (text: string) => (text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const a = new Set(norm(candidate).split(' ').filter((t) => t.length > 2));
  if (!a.size) return false;
  for (const other of existing) {
    const bTokens = norm(other).split(' ').filter((t) => t.length > 2);
    const b = new Set(bTokens);
    if (!b.size) continue;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter += 1;
    const union = a.size + b.size - inter;
    if (union > 0 && inter / union >= 0.85) return true;
  }
  return false;
}

function uniquifyLineWithSourceHint(line: string, unit: string, index: number, targetLocale?: Locale): string {
  const base = line.replace(/[.।。.]$/u, '').trim();
  // Cross-locale fallback must never re-inject source-language tokens into the
  // target line (build 272: Latin Serbian hints under English/Hindi targets).
  if (targetLocale) {
    return `${base} (${index + 1}).`;
  }
  const hints = (unit.match(/[A-Za-z\u0900-\u097F\u0600-\u06FF\u0400-\u04FF]{4,}/gu) || [])
    .slice(0, 2);
  if (!hints.length) return `${base} (${index + 1}).`;
  return `${base} (${hints.join(' ')}).`;
}

/** Keep generic localized shells from inventing a project-requirements
 * criterion.  A source that explicitly owns that relation is left unchanged. */
function removeUnsourcedProjectRequirementQualifier(
  sourceDescription: string,
  candidateDescription: string,
): string {
  if (/(?:\bproject\s+(?:requirements?|needs?)\b|\brequisitos?\s+del\s+proyecto\b|\bnecesidades\s+del\s+proyecto\b|\bexigences?\s+du\s+projet\b|\b(?:Projektanforderungen|Anforderungen\s+des\s+Projekts|Projektbedürfnisse)\b|\b(?:requisiti|necessità)\s+del\s+progetto\b|\b(?:requisitos|necessidades)\s+do\s+projeto\b|требованиями\s+проекта|zahtjevima\s+projekta)/iu.test(sourceDescription)) {
    return candidateDescription;
  }
  return candidateDescription
    .replace(/\s+(?:to|according to|per)\s+project requirements/giu, '')
    .replace(/\s+(?:an die|gemäß den)\s+Projektanforderungen/giu, '')
    .replace(/\s+(?:según|conforme a)\s+los requisitos del proyecto/giu, '')
    .replace(/\s+selon\s+les\s+exigences\s+du\s+projet/giu, '')
    .replace(/\s+(?:in base ai)\s+requisiti del progetto/giu, '')
    .replace(/\s+(?:conforme aos)\s+requisitos do projeto/giu, '')
    .replace(/\s+(?:en conformité avec)\s+les exigences du projet/giu, '')
    .replace(/\s+(?:в соответствии с)\s+требованиями проекта/giu, '')
    .replace(/\s+(?:prema)\s+zahtjevima projekta/giu, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1');
}

function semanticArgumentScript(text: string): 'devanagari' | 'arabic' | 'cyrillic' | 'cjk' | 'latin' {
  if (/\p{Script=Devanagari}/u.test(text)) return 'devanagari';
  if (/\p{Script=Arabic}/u.test(text)) return 'arabic';
  if (/\p{Script=Cyrillic}/u.test(text)) return 'cyrillic';
  if (/[\u3040-\u30FF\u3400-\u9FFF]/u.test(text)) return 'cjk';
  return 'latin';
}

/**
 * Relation-preserving Portuguese design projection used by deterministic
 * recovery.  It is driven solely by typed source relations, never by an
 * occupation, entry id, hash, or fixture phrase.  A unit without a complete
 * relation signature returns no projection so the caller fails closed.
 */
function buildPortugueseDesignSemanticFallback(
  units: string[],
  isPresent: boolean,
): string {
  const lines: string[] = [];
  for (const unit of units) {
    const kinds = extractExperienceSemanticArgumentKinds(unit);
    const folded = fold(unit);
    const hasPrint = /(?:print|imprim|papel|impresso|tisk|štamp|طباعة|چاپ|प्रिंट|印刷)/iu.test(folded);
    const hasDigital = /(?:digital|num[eé]ri|m[ií]dia|media|medij|رقمي|डिजिटल|デジタル)/iu.test(folded);
    const hasDesignConcept = /(?:concept|design|d[eé]sign|visual|graf|vizuel|dizajn|تصميم|विज़ुअल|デザイン)/iu.test(folded);
    const hasReview = /(?:review|revis|check|verif|inspect|quality|qualit|qualit[eé]|final|output|kvalitet|провер|مراج|समीक्षा|品質|確認)/iu.test(folded);
    if (kinds.includes('material_medium') && hasPrint && hasDigital) {
      lines.push(isPresent
        ? 'Cria materiais gráficos para mídias impressas e digitais.'
        : 'Criou materiais gráficos para mídias impressas e digitais.');
      continue;
    }
    if (kinds.includes('criterion') && kinds.includes('beneficiary') && hasDesignConcept) {
      lines.push(isPresent
        ? 'Desenvolve conceitos de design visual de acordo com as necessidades dos clientes.'
        : 'Desenvolveu conceitos de design visual de acordo com as necessidades dos clientes.');
      continue;
    }
    if (kinds.includes('quality_output') && hasReview) {
      lines.push(isPresent
        ? 'Revisa projetos de design e verifica a qualidade dos resultados finais.'
        : 'Revisou projetos de design e verificou a qualidade dos resultados finais.');
      continue;
    }
    return '';
  }
  return lines.length === units.length ? formatExperienceBullets(lines) : '';
}

/**
 * Relation-preserving Italian design projection used by deterministic
 * cross-locale recovery.  This projection is keyed only by the typed source
 * relation and its lexical evidence; it never depends on a title, entry id,
 * hash, or fixture wording.  Returning an empty string for an unrecognised
 * relation keeps the fallback fail-closed instead of substituting a generic
 * design shell.
 */
function buildItalianDesignSemanticFallback(
  units: string[],
  isPresent: boolean,
): string {
  const lines: string[] = [];
  for (const unit of units) {
    const kinds = extractExperienceSemanticArgumentKinds(unit);
    const folded = fold(unit);
    const hasPrint = /(?:print|stampat|imprim|मुद्रित|प्रिंट)/iu.test(folded);
    const hasDigital = /(?:digital|num[eé]ri|m[ií]dia|media|डिजिटल)/iu.test(folded);
    const hasDesignConcept = /(?:concept|design|visual|graf|diseñ|diseg|विज़ुअल|डिज़ाइन)/iu.test(folded);
    const hasReview = /(?:review|revis|verif|qualit|final|output|result|समीक्षा|गुणवत्ता|अंतिम|परिणाम)/iu.test(folded);
    if (kinds.includes('material_medium') && hasPrint && hasDigital) {
      lines.push(isPresent
        ? 'Crea materiali grafici per supporti stampati e digitali.'
        : 'Ha creato materiali grafici per supporti stampati e digitali.');
      continue;
    }
    if (kinds.includes('criterion') && kinds.includes('beneficiary') && hasDesignConcept) {
      lines.push(isPresent
        ? 'Sviluppa concetti di design visivo in base alle esigenze dei clienti.'
        : 'Ha sviluppato concetti di design visivo in base alle esigenze dei clienti.');
      continue;
    }
    if (kinds.includes('quality_output') && hasReview) {
      lines.push(isPresent
        ? 'Revisiona progetti di design e verifica la qualità dei risultati finali.'
        : 'Ha revisionato progetti di design e verificato la qualità dei risultati finali.');
      continue;
    }
    return '';
  }
  return lines.length === units.length ? formatExperienceBullets(lines) : '';
}

/**
 * Relation-preserving Serbian design projection used by deterministic recovery.
 * Serbian completed-role predicates are inflected (`kreirala`, `razvijala`,
 * `pregledala`, `proveravala`), so repeated generic shells can look like
 * duplicate/added actions.  Emit one Serbian line per typed source relation;
 * no title, entry id, hash or fixture wording participates in this projection.
 */
function buildSerbianDesignSemanticFallback(
  units: string[],
  isPresent: boolean,
): string {
  const lines: string[] = [];
  for (const unit of units) {
    const kinds = extractExperienceSemanticArgumentKinds(unit);
    const folded = fold(unit);
    const hasPrint = /(?:print|stampat|imprim|tisk|štamp|طباعة|प्रिंट|印刷)/iu.test(folded);
    const hasDigital = /(?:digital|num[eé]ri|m[ií]dia|media|medij|رقمي|डिजिटल|デジタル)/iu.test(folded);
    const hasDesignConcept = /(?:concept|design|visual|graf|vizuel|dizajn|تصميم|विज़ुअल|डिज़ाइन|デザイン)/iu.test(folded);
    const hasReview = /(?:review|revis|verif|prover|pregled|qualit|kvalitet|final|output|result|समीक्षा|गुणवत्ता|अंतिम|परिणाम)/iu.test(folded);
    if (kinds.includes('material_medium') && hasPrint && hasDigital) {
      lines.push(isPresent
        ? 'Kreiram grafičke materijale za štampane i digitalne medije.'
        : 'Kreirala je grafičke materijale za štampane i digitalne medije.');
      continue;
    }
    if (kinds.includes('criterion') && kinds.includes('beneficiary') && hasDesignConcept) {
      lines.push(isPresent
        ? 'Razvijam koncepte vizuelnog dizajna prema potrebama klijenata.'
        : 'Razvijala je koncepte vizuelnog dizajna prema potrebama klijenata.');
      continue;
    }
    if (kinds.includes('quality_output') && hasReview) {
      lines.push(isPresent
        ? 'Pregledam projekte dizajna i proveravam kvalitet finalnih rezultata.'
        : 'Pregledala je projekte dizajna i proveravala kvalitet finalnih rezultata.');
      continue;
    }
    return '';
  }
  return lines.length === units.length ? formatExperienceBullets(lines) : '';
}

/**
 * Build target-locale Experience bullets from source units (cross-locale enhance).
 * Never returns the source language when target differs.
 */
export function buildCrossLocaleExperienceFallback(options: {
  sourceDescription: string;
  sourceLocale?: string | null;
  targetLocale: Locale;
  gender?: string;
  isPresent?: boolean;
  /** Free-text position — preferred domain signal over poisoned unit text. */
  position?: string;
}): string {
  const target = options.targetLocale;
  const units = extractSourceDutyUnits(options.sourceDescription)
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const sourceLocale = options.sourceLocale
    || detectTextLocale(options.sourceDescription);
  if (!units.length) return '';
  if (!isCrossLocaleOperation(sourceLocale, target)
    && detectTextLocale(options.sourceDescription) === target) {
    // Same locale — caller should use source-preserving path instead.
    return '';
  }

  const domain = domainHintFromUnits(units, options.position);
  const isPresent = options.isPresent !== false;
  const female = /^(female|f|ženski|zenski)$/i.test(String(options.gender || ''));

  // Cooking is a material-fact domain, not generic/design work. Reuse the
  // source-preserving locale projector so food preparation, hygiene, and
  // kitchen collaboration remain separate and no design vocabulary is added.
  const sourceMaterialKeys = materialDutyKeysFromDescription(options.sourceDescription || '');

  // Generic design translation for Japanese/CJK. The relation-aware projector
  // is used for any design source, not only the device fixture or a title.
  if (target === 'ja' && domain === 'design') {
    const japaneseDesign = buildJapaneseDesignExperienceFallback({
      sourceDescription: options.sourceDescription,
      isPresent,
    });
    if (splitExperienceBullets(japaneseDesign).length === units.length) return japaneseDesign;
  }

  // A non-empty warehouse source must use the locale's source-fact projector,
  // never the coarse domain shell table. Return only an exact source-unit-count
  // projection that the dedicated semantic validator accepts.
  if (sourceHasWarehouseDomainApplicability(options.sourceDescription || '')) {
    let grounded = '';
    let groundedValid = false;
    if (target === 'en' && sourceRequiresStrictEnglishWarehouseFactCoverage(options.sourceDescription)) {
      grounded = buildEnglishWarehouseExperienceFallback({
        sourceDescription: options.sourceDescription,
        isPresent,
      });
      groundedValid = validateEnglishWarehouseExperienceCoverage(
        options.sourceDescription,
        grounded,
      ).ok;
    } else if (target === 'de' && sourceRequiresGermanWarehouseFactCoverage(options.sourceDescription)) {
      grounded = buildGermanWarehouseExperienceFallback({ sourceDescription: options.sourceDescription, isPresent });
      groundedValid = validateGermanWarehouseExperienceCoverage(options.sourceDescription, grounded).ok;
    } else if (target === 'es' && sourceRequiresSpanishWarehouseFactCoverage(options.sourceDescription)) {
      grounded = buildSpanishWarehouseExperienceFallback({ sourceDescription: options.sourceDescription, isPresent });
      groundedValid = validateSpanishWarehouseExperienceCoverage(options.sourceDescription, grounded).ok;
    } else if (target === 'fr' && sourceRequiresFrenchWarehouseFactCoverage(options.sourceDescription)) {
      grounded = buildFrenchWarehouseExperienceFallback({ sourceDescription: options.sourceDescription, isPresent });
      groundedValid = validateFrenchWarehouseExperienceCoverage(options.sourceDescription, grounded).ok;
    } else if (target === 'it' && sourceRequiresItalianWarehouseFactCoverage(options.sourceDescription)) {
      grounded = buildItalianWarehouseExperienceFallback({ sourceDescription: options.sourceDescription, isPresent });
      groundedValid = validateItalianWarehouseExperienceCoverage(options.sourceDescription, grounded).ok;
    } else if (target === 'pt-BR' && sourceRequiresPortugueseWarehouseFactCoverage(options.sourceDescription)) {
      grounded = buildPortugueseWarehouseExperienceFallback({ sourceDescription: options.sourceDescription, isPresent });
      groundedValid = validatePortugueseWarehouseExperienceCoverage(options.sourceDescription, grounded).ok;
    } else if (target === 'ru' && sourceRequiresRussianWarehouseFactCoverage(options.sourceDescription)) {
      grounded = buildRussianWarehouseExperienceFallback({ sourceDescription: options.sourceDescription, isPresent });
      groundedValid = validateRussianWarehouseExperienceCoverage(options.sourceDescription, grounded).ok;
    } else if (target === 'hi' && sourceRequiresHindiWarehouseFactCoverage(options.sourceDescription)) {
      grounded = buildHindiWarehouseExperienceFallback({
        sourceDescription: options.sourceDescription,
        isPresent,
        gender: options.gender,
      });
      groundedValid = validateHindiWarehouseExperienceCoverage(options.sourceDescription, grounded).ok;
    } else if (target === 'ja' && sourceRequiresJapaneseWarehouseFactCoverage(options.sourceDescription)) {
      grounded = buildJapaneseWarehouseExperienceFallback({
        sourceDescription: options.sourceDescription,
        isPresent,
        gender: options.gender,
      });
      groundedValid = validateJapaneseWarehouseExperienceCoverage(options.sourceDescription, grounded).ok;
    } else if (target === 'ar' && sourceRequiresArabicWarehouseFactCoverage(options.sourceDescription)) {
      grounded = buildArabicWarehouseExperienceFallback({
        sourceDescription: options.sourceDescription,
        isPresent,
        gender: options.gender,
      });
      groundedValid = validateArabicWarehouseExperienceCoverage(options.sourceDescription, grounded).ok;
    } else if (target === 'sr' && sourceRequiresSerbianWarehouseFactCoverage(options.sourceDescription)) {
      grounded = buildSerbianWarehouseExperienceFallback({
        sourceDescription: options.sourceDescription,
        isPresent,
        gender: options.gender,
      });
      groundedValid = validateSerbianWarehouseExperienceCoverage(options.sourceDescription, grounded).ok;
    } else if (target === 'hr' && sourceRequiresCroatianWarehouseFactCoverage(options.sourceDescription)) {
      grounded = buildCroatianWarehouseExperienceFallback({
        sourceDescription: options.sourceDescription,
        isPresent,
        gender: options.gender,
      });
      groundedValid = validateCroatianWarehouseExperienceCoverage(options.sourceDescription, grounded).ok;
    }
    if (groundedValid && splitExperienceBullets(grounded).length === units.length) {
      return grounded;
    }
  }
  if (sourceMaterialKeys.some((key) => (
    key === 'food_prep'
    || key === 'hygiene_workplace'
    || key === 'kitchen_collaboration'
  ))) {
    const cooking = buildSourcePreservingExperienceBullets(
      options.sourceDescription,
      target,
      options.gender,
      { isPresent },
    );
    if (cooking.trim()) return cooking;
  }

  // Unknown/documentation roles must not inherit the design table merely
  // because they are not warehouse roles. Project each authoritative unit
  // through the general source-preserving localizer, retaining one target
  // bullet per source identity and disambiguating only repeated safe shells.
  if (domain === 'work' || domain === 'documentation') {
    const everyUnitHasMaterialIdentity = units.every((unit) => (
      classifyMaterialDutyKeys(unit).some((key) => key !== 'generic_duty')
    ));
    if (!everyUnitHasMaterialIdentity) return '';
    const projected = buildSourcePreservingExperienceBullets(
      options.sourceDescription,
      target,
      options.gender,
      { isPresent },
    );
    const projectedUnits = splitExperienceBullets(projected);
    if (projectedUnits.length === units.length) {
      const generalLines: string[] = [];
      for (let i = 0; i < projectedUnits.length; i += 1) {
        let line = projectedUnits[i]!;
        if (nearDupOfAny(line, generalLines)) {
          line = uniquifyLineWithSourceHint(line, units[i] || '', i, target);
        }
        generalLines.push(line);
      }
      return formatExperienceBullets(generalLines);
    }
  }

  // Russian design: emit the three concrete fact families directly. Coarse
  // action-frame shells (generic daily duty / visual-only review) caused false
  // 3/3 semantic coverage on device while missing adaptation and final files.
  if (domain === 'design' && target === 'ru') {
    if (sourceRequiresRussianDesignSemanticGrounding(options.sourceDescription)) {
      const projected = buildRussianDesignSemanticFallback({
        sourceDescription: options.sourceDescription,
        isPresent,
        gender: options.gender,
      });
      return validateRussianDesignSemanticProjection(options.sourceDescription, projected).ok
        ? projected
        : '';
    }
    // Preserve the established generic bridge for design sources that do not
    // match the AAB451 three-fact semantic catalogue. The new strict contract
    // is opt-in only when all source arguments are recognized.
  }

  // Portuguese deterministic recovery must retain each source-owned design
  // relation.  The generic frame table is intentionally not used here because
  // it can turn distinct media/criterion/quality duties into interchangeable
  // product/platform/project shells.
  if (domain === 'design' && target === 'pt-BR') {
    const sourceKinds = extractExperienceSemanticArgumentKinds(options.sourceDescription);
    const relationAnchors = sourceKinds.filter((kind) => (
      kind === 'criterion'
      || kind === 'beneficiary'
      || kind === 'material_medium'
      || kind === 'quality_output'
    ));
    const richRelationSource = sourceKinds.includes('criterion')
      && sourceKinds.includes('beneficiary')
      && (sourceKinds.includes('material_medium') || sourceKinds.includes('quality_output'));
    if (richRelationSource && relationAnchors.length >= 2) {
      const projected = buildPortugueseDesignSemanticFallback(units, isPresent);
      if (projected.trim()) return projected;
      return '';
    }
  }

  // Italian deterministic recovery retains the same source-owned media,
  // client-needs, and review/quality relations as the immutable units.  A
  // generic frame shell can make all three bullets look covered while
  // silently dropping one of those arguments, so only a complete typed
  // relation projection is eligible here.
  if (domain === 'design' && target === 'it') {
    const sourceKinds = extractExperienceSemanticArgumentKinds(options.sourceDescription);
    const relationAnchors = sourceKinds.filter((kind) => (
      kind === 'criterion'
      || kind === 'beneficiary'
      || kind === 'material_medium'
      || kind === 'quality_output'
    ));
    const richRelationSource = sourceKinds.includes('criterion')
      && sourceKinds.includes('beneficiary')
      && (sourceKinds.includes('material_medium') || sourceKinds.includes('quality_output'));
    if (richRelationSource && relationAnchors.length >= 2) {
      const projected = buildItalianDesignSemanticFallback(units, isPresent);
      if (projected.trim()) return projected;
      return '';
    }
  }

  // Serbian deterministic recovery retains source-owned media, client-needs,
  // and review/quality relations instead of falling back to repeated generic
  // duties.  A complete typed relation signature is required; otherwise the
  // caller fails closed rather than accepting an unsafe shell.
  if (domain === 'design' && target === 'sr') {
    const sourceKinds = extractExperienceSemanticArgumentKinds(options.sourceDescription);
    const relationAnchors = sourceKinds.filter((kind) => (
      kind === 'criterion'
      || kind === 'beneficiary'
      || kind === 'material_medium'
      || kind === 'quality_output'
    ));
    const richRelationSource = sourceKinds.includes('criterion')
      && sourceKinds.includes('beneficiary')
      && (sourceKinds.includes('material_medium') || sourceKinds.includes('quality_output'));
    if (richRelationSource && relationAnchors.length >= 2) {
      const projected = buildSerbianDesignSemanticFallback(units, isPresent);
      if (projected.trim()) return projected;
      return '';
    }
  }

  const frames = units.map((u) => classifyActionFrame(u));
  const lines: string[] = [];
  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i]!;
    const line = bulletForLocale(target, frame, domain, isPresent, options.gender);
    if (!line.trim()) return '';
    lines.push(line);
  }
  return formatExperienceBullets(lines.map((line) => removeUnsourcedProjectRequirementQualifier(
    options.sourceDescription,
    line,
  )));
}

/** True when candidate still looks like the source language under a different target. */
export function candidateLeaksSourceLocale(
  candidate: string,
  sourceLocale: string | null | undefined,
  targetLocale: Locale,
): boolean {
  if (!candidate.trim()) return false;
  if (!isCrossLocaleOperation(sourceLocale, targetLocale)) return false;
  const detected = detectTextLocale(candidate);
  if (detected === 'unknown') {
    // Heuristic: Serbian lexicon under English target.
    if (
      (targetLocale === 'en' || targetLocale === 'de' || targetLocale === 'es')
      && (sourceLocale === 'sr' || sourceLocale === 'hr')
      && /\b(?:obavlja|ažurira|azurira|koordiniše|koordinise|evidencij|kolegama)\b/iu.test(candidate)
    ) {
      return true;
    }
    return false;
  }
  return isCrossLocaleOperation(detected, targetLocale)
    && !isCrossLocaleOperation(detected, sourceLocale || detected);
}

export function countTranslatedFactUnits(sourceDescription: string, result: string): number {
  // AAB-329 — German warehouse result (incl. EN→DE): object-level fact coverage.
  // Must run before the English warehouse short-circuit, otherwise a German
  // translation of an English warehouse source reports translatedFactCount=0.
  if (sourceRequiresGermanWarehouseFactCoverage(sourceDescription || '')) {
    const deCovered = validateGermanWarehouseExperienceCoverage(
      sourceDescription,
      result,
    ).covered.length;
    if (deCovered > 0) return deCovered;
  }
  // AAB-330 — Spanish warehouse result (incl. EN→ES / DE-visible→ES): same.
  if (sourceRequiresSpanishWarehouseFactCoverage(sourceDescription || '')) {
    const esCovered = validateSpanishWarehouseExperienceCoverage(
      sourceDescription,
      result,
    ).covered.length;
    if (esCovered > 0) return esCovered;
  }
  // AAB-332 — French warehouse result (incl. EN→FR / ES-visible→FR): same.
  // Only short-circuit when the result itself looks French so English/Spanish
  // results of warehouse sources are not miscounted by FR stem overlap.
  if (
    sourceRequiresFrenchWarehouseFactCoverage(sourceDescription || '')
    && /(?:contr[oô]le|v[eé]rifie|coordonne|marchandises?|coll[eè]gues?|entrep[oô]t)/iu.test(result || '')
  ) {
    const frCovered = validateFrenchWarehouseExperienceCoverage(
      sourceDescription,
      result,
    ).covered.length;
    if (frCovered > 0) return frCovered;
  }
  // AAB-334 — Italian warehouse result (incl. EN→IT / FR-visible→IT): same.
  if (
    sourceRequiresItalianWarehouseFactCoverage(sourceDescription || '')
    && /(?:controlla|verifica|documentazione|magazzino|colleghi|movimentazione|merci\s+in\s+entrata)/iu
      .test(result || '')
  ) {
    const itCovered = validateItalianWarehouseExperienceCoverage(
      sourceDescription,
      result,
    ).covered.length;
    if (itCovered > 0) return itCovered;
  }
  // AAB-335 — Brazilian Portuguese warehouse result (incl. IT-visible→pt-BR).
  if (
    sourceRequiresPortugueseWarehouseFactCoverage(sourceDescription || '')
    && /(?:mercadorias?|armaz[eé]m|documenta[cç][aã]o|colegas|movimenta[cç][aã]o|confere)/iu
      .test(result || '')
  ) {
    const ptCovered = validatePortugueseWarehouseExperienceCoverage(
      sourceDescription,
      result,
    ).covered.length;
    if (ptCovered > 0) return ptCovered;
  }
  // AAB-337 — Russian warehouse result (incl. PT-BR-visible→ru).
  if (
    sourceRequiresRussianWarehouseFactCoverage(sourceDescription || '')
    && /(?:проверяет|координирует|поступающ|документац|коллег|склад|товар)/iu
      .test(result || '')
  ) {
    const ruCovered = validateRussianWarehouseExperienceCoverage(
      sourceDescription,
      result,
    ).covered.length;
    if (ruCovered > 0) return ruCovered;
  }
  // AAB-338 — Hindi warehouse result (incl. RU-visible→hi).
  if (
    sourceRequiresHindiWarehouseFactCoverage(sourceDescription || '')
    && /(?:जाँच|जांच|गोदाम|माल|सहकर्मि|समन्वय|दस्तावे|आवाजाही|स्थानांतरण)/u
      .test(result || '')
  ) {
    const hiCovered = validateHindiWarehouseExperienceCoverage(
      sourceDescription,
      result,
    ).covered.length;
    if (hiCovered > 0) return hiCovered;
  }
  // AAB-339 — Japanese warehouse result (incl. HI-visible→ja).
  if (
    sourceRequiresJapaneseWarehouseFactCoverage(sourceDescription || '')
    && /(?:入荷|関連書類|倉庫|同僚|商品の準備|確認します|確認する|確認した)/u
      .test(result || '')
  ) {
    const jaCovered = validateJapaneseWarehouseExperienceCoverage(
      sourceDescription,
      result,
    ).covered.length;
    if (jaCovered > 0) return jaCovered;
  }
  // AAB-340 — Arabic warehouse result (incl. JA-visible→ar).
  if (
    sourceRequiresArabicWarehouseFactCoverage(sourceDescription || '')
    && /(?:البضائع|المستندات|الوثائق|المستودع|الزملاء|الواردة|المستلمة|تفحص|تتحقق|تنسق|يفحص|يتحقق|ينسق)/u
      .test(result || '')
  ) {
    const arCovered = validateArabicWarehouseExperienceCoverage(
      sourceDescription,
      result,
    ).covered.length;
    if (arCovered > 0) return arCovered;
  }
  // AAB-341 — Serbian warehouse result (incl. AR-visible→sr).
  if (
    sourceRequiresSerbianWarehouseFactCoverage(sourceDescription || '')
    && /(?:proverava|pregledava|kontroliše|koordinira|sarađuje|skladišt|pristigl|prateć|kolegama|priprem|premešt|dokumentacij)/iu
      .test(result || '')
  ) {
    const srCovered = validateSerbianWarehouseExperienceCoverage(
      sourceDescription,
      result,
    ).covered.length;
    if (srCovered > 0) return srCovered;
  }
  // AAB-342 — Croatian warehouse result (incl. SR-visible→hr).
  if (
    sourceRequiresCroatianWarehouseFactCoverage(sourceDescription || '')
    && /(?:provjerava|pregledava|kontrolira|surađuje|skladišt|pristigl|zaprimljen|prateć|kolegama|priprem|premješt|dokumentacij)/iu
      .test(result || '')
  ) {
    const hrCovered = validateCroatianWarehouseExperienceCoverage(
      sourceDescription,
      result,
    ).covered.length;
    if (hrCovered > 0) return hrCovered;
  }
  // AAB-327 — English warehouse: count distinct source fact identities, not
  // collapsed action-frame / material-category matches.
  if (sourceRequiresStrictEnglishWarehouseFactCoverage(sourceDescription || '')) {
    return countEnglishWarehouseTranslatedFacts(sourceDescription, result);
  }
  const coverage = validateCrossLocaleSemanticCoverage(sourceDescription, result);
  return coverage.coveredCount;
}

/**
 * Cross-language fact coverage via action-frame identity (not literal tokens).
 * Each source unit must pair with a distinct candidate bullet of the same frame,
 * or a material-key match when frames are both generic.
 */
export function validateCrossLocaleSemanticCoverage(
  sourceDescription: string,
  candidateDescription: string,
): {
  ok: boolean;
  requiredCount: number;
  coveredCount: number;
  uncoveredCount: number;
  /** Source-unit indexes paired 1:1 with a candidate unit by the typed bridge. */
  coveredSourceIndexes: number[];
  /** Source-unit indexes that have no typed cross-locale candidate match. */
  uncoveredSourceIndexes: number[];
  semanticArgumentCoveragePassed: boolean;
  addedSemanticArgumentCount: number;
  addedSemanticArgumentKinds: ExperienceSemanticArgumentKind[];
  missingSemanticArgumentKinds: ExperienceSemanticArgumentKind[];
  /** Material candidate relations that have no authority in the matched fact. */
  unauthorizedArgumentCount?: number;
  unauthorizedArgumentKinds?: ExperienceSemanticArgumentKind[];
  /** Candidate-only relation evidence is privacy-safe: categories only. */
  crossEntryRelationLeakageCount?: number;
  reason?: string;
} {
  const srcUnits = extractSourceDutyUnits(sourceDescription)
    .map((u) => stripDutyListPrefix(u))
    .filter((u) => u.length > 8);
  const bullets = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);
  const requiredCount = srcUnits.length;
  // Russian design candidates need fact-owned object/argument validation rather
  // than the generic action-frame bridge. This is shared by provider, repair,
  // deterministic fallback, and visible post-write validation.
  if (/[\u0400-\u04FF]/u.test(candidateDescription || '')
    && sourceRequiresRussianDesignSemanticGrounding(sourceDescription)) {
    const ru = validateRussianDesignSemanticProjection(sourceDescription, candidateDescription);
    const coveredSourceIndexes = srcUnits
      .map((_, index) => index)
      .filter((index) => index < ru.covered.length);
    const uncoveredSourceIndexes = srcUnits
      .map((_, index) => index)
      .filter((index) => !coveredSourceIndexes.includes(index));
    return {
      ok: ru.ok,
      requiredCount,
      coveredCount: ru.covered.length,
      uncoveredCount: ru.uncovered.length,
      coveredSourceIndexes,
      uncoveredSourceIndexes,
      semanticArgumentCoveragePassed: ru.addedSemanticArgumentCount === 0,
      addedSemanticArgumentCount: ru.addedSemanticArgumentCount,
      addedSemanticArgumentKinds: ru.addedSemanticArgumentCount ? ['criterion'] : [],
      missingSemanticArgumentKinds: ru.uncovered.length ? ['material_medium'] : [],
      reason: ru.reason || undefined,
    };
  }
  if (!requiredCount) {
    return {
      ok: true,
      requiredCount: 0,
      coveredCount: 0,
      uncoveredCount: 0,
      coveredSourceIndexes: [],
      uncoveredSourceIndexes: [],
      semanticArgumentCoveragePassed: true,
      addedSemanticArgumentCount: 0,
      addedSemanticArgumentKinds: [],
      missingSemanticArgumentKinds: [],
    };
  }
  if (!bullets.length) {
    return {
      ok: false,
      requiredCount,
      coveredCount: 0,
      uncoveredCount: requiredCount,
      coveredSourceIndexes: [],
      uncoveredSourceIndexes: srcUnits.map((_, index) => index),
      semanticArgumentCoveragePassed: false,
      addedSemanticArgumentCount: 0,
      addedSemanticArgumentKinds: [],
      missingSemanticArgumentKinds: [],
      reason: 'experience_material_fact_coverage_incomplete',
    };
  }

  const srcFrames = srcUnits.map((u) => classifyActionFrame(u));
  const candFrames = bullets.map((b) => classifyActionFrame(b));
  const usedB = new Set<number>();
  const coveredSourceIndexes: number[] = [];
  const matchedCandidateIndexes = new Map<number, number>();
  let covered = 0;
  const warehouseSource = sourceHasWarehouseDomainApplicability(sourceDescription);
  for (let si = 0; si < srcFrames.length; si += 1) {
    const want = srcFrames[si];
    let matched = -1;
    for (let bi = 0; bi < candFrames.length; bi += 1) {
      if (usedB.has(bi)) continue;
      if (candFrames[bi] === want) {
        matched = bi;
        break;
      }
    }
    // Soft: near-equivalent frames when shells remap documentation↔design verbs.
    // Warehouse sources must not soft-match office docs/info-exchange frames.
    if (matched < 0 && !warehouseSource) {
      for (let bi = 0; bi < candFrames.length; bi += 1) {
        if (usedB.has(bi)) continue;
        const got = candFrames[bi];
        const soft = (want === 'generic_duty' || got === 'generic_duty')
          || (want === 'prepare_materials' && (got === 'coordinate_info' || got === 'check_records' || got === 'update_records' || got === 'collaborate_visual'))
          || (want === 'check_records' && (got === 'prepare_materials' || got === 'update_records' || got === 'coordinate_info' || got === 'collaborate_visual'))
          || (want === 'coordinate_info' && (got === 'prepare_materials' || got === 'collaborate_visual' || got === 'check_records'))
          || (want === 'update_records' && (got === 'check_records' || got === 'prepare_materials' || got === 'collaborate_visual'))
          || (want === 'collaborate_visual' && (got === 'coordinate_info' || got === 'prepare_materials' || got === 'check_records'));
        if (soft) {
          matched = bi;
          break;
        }
      }
    }
    if (matched >= 0) {
      usedB.add(matched);
      covered += 1;
      coveredSourceIndexes.push(si);
      matchedCandidateIndexes.set(si, matched);
    }
  }
  const uncoveredCount = requiredCount - covered;
  const uncoveredSourceIndexes = srcUnits
    .map((_, index) => index)
    .filter((index) => !coveredSourceIndexes.includes(index));
  // Cross-locale lexical overlap cannot prove that a qualifier belongs to the
  // same source fact.  Run the typed unsupported-argument scan as a second,
  // independent boundary: predicate/frame coverage may be complete while a
  // candidate still adds project requirements, standards, universal scope, or
  // a collaboration argument that is absent from the immutable source.
  const unsupported = detectExperienceUnsupportedClaimExpansion(
    sourceDescription,
    candidateDescription,
  );
  const addedSemanticArgumentKinds: ExperienceSemanticArgumentKind[] = [];
  for (const kind of unsupported.kinds) {
    if (kind === 'requirements_scope_expansion') addedSemanticArgumentKinds.push('criterion');
    else if (kind === 'standards_compliance_claim') addedSemanticArgumentKinds.push('standards_criterion');
    else if (kind === 'universal_scope_claim') addedSemanticArgumentKinds.push('universal_scope');
    else if (kind === 'frequency_scope_claim') addedSemanticArgumentKinds.push('frequency_scope');
    else if (kind === 'unsupported_modifier_expansion') addedSemanticArgumentKinds.push('team_relation');
    else if (kind === 'unsupported_tool_claim') addedSemanticArgumentKinds.push('tool_system');
    else if (kind === 'unsupported_metric_claim') addedSemanticArgumentKinds.push('quantitative_metric');
    else if (kind === 'leadership_claim' || kind === 'supervision_expansion') {
      addedSemanticArgumentKinds.push('leadership_management');
    } else if (
      kind === 'assurance_escalation'
      || kind === 'guarantee_escalation'
      || kind === 'responsibility_escalation'
      || kind === 'outcome_ownership'
      || kind === 'organization_responsibility_claim'
    ) {
      addedSemanticArgumentKinds.push('responsibility_escalation');
    } else if (
      kind === 'unsupported_object_expansion'
      || kind === 'object_scope_expansion'
    ) {
      addedSemanticArgumentKinds.push('object_domain');
    } else if (
      kind === 'unsupported_generated_duty'
      || kind === 'action_scope_expansion'
      || kind === 'coordinated_predicate_expansion'
      || kind === 'logistics_scope_expansion'
    ) {
      addedSemanticArgumentKinds.push('unrelated_action');
    }
  }
  const uniqueAddedSemanticArgumentKinds = [
    ...new Set(addedSemanticArgumentKinds),
  ];
  // Compare typed relation classes in both directions.  Translation may
  // change the words, but it must retain each source-owned relation and may
  // not introduce a relation class absent from the immutable source facts.
  const scriptsDiffer = semanticArgumentScript(sourceDescription)
    !== semanticArgumentScript(candidateDescription);
  const missingSemanticArgumentKinds: ExperienceSemanticArgumentKind[] = [];
  const sourceArgumentKinds = extractExperienceSemanticArgumentKinds(sourceDescription);
  const sourceRelationAnchorCount = sourceArgumentKinds.filter((kind) => (
    kind === 'criterion'
    || kind === 'beneficiary'
    || kind === 'material_medium'
    || kind === 'quality_output'
  )).length;
  const richRelationSource = sourceArgumentKinds.includes('criterion')
    && sourceArgumentKinds.includes('beneficiary')
    && (sourceArgumentKinds.includes('material_medium') || sourceArgumentKinds.includes('quality_output'));
  // Sparse legacy duties do not expose enough typed relation authority for the
  // cross-locale argument bridge; their established predicate/material gates
  // remain authoritative. Relation-rich source facts opt into the strict
  // no-added/no-missing semantic contract below.
  if (!richRelationSource) {
    uniqueAddedSemanticArgumentKinds.splice(0, uniqueAddedSemanticArgumentKinds.length);
  }
  // Typed cross-script argument comparison is enabled only when the source
  // has enough explicit relation anchors to distinguish a real argument from
  // a translated surface noun. Existing frame/material validators continue to
  // enforce source-owned relation presence for sparse/legacy fixtures.
  // Russian design has dedicated source-owned validators; preserve their
  // legacy explanatory frame result and let that typed validator own the
    // relation decision rather than applying the generic Latin bridge twice.
  const candidateIsCyrillic = /\p{Script=Cyrillic}/u.test(candidateDescription || '');
  if (scriptsDiffer && richRelationSource && !candidateIsCyrillic) {
    const candidateArgumentKinds = extractExperienceSemanticArgumentKinds(candidateDescription);
    const sourceArgumentKindSet = new Set(sourceArgumentKinds);
    // A frame match alone cannot prove that the source-owned relation survived.
    // Require every explicit source relation anchor to remain represented in the
    // target surface; otherwise a generic 3/3 shell could silently drop media,
    // beneficiary/criterion, or output-quality scope.
    for (const kind of sourceArgumentKinds) {
      // Existing localized shells can express the project object through the
      // quality-output clause.
      const projectScopeRepresentedByReview = kind === 'project_scope'
        && candidateArgumentKinds.includes('quality_output');
      if (!candidateArgumentKinds.includes(kind)
        && !projectScopeRepresentedByReview
        && !missingSemanticArgumentKinds.includes(kind)) {
        missingSemanticArgumentKinds.push(kind);
      }
    }
    for (const kind of candidateArgumentKinds) {
      if (!sourceArgumentKindSet.has(kind) && !uniqueAddedSemanticArgumentKinds.includes(kind)) {
        uniqueAddedSemanticArgumentKinds.push(kind);
      }
    }
  }
  // Relation authority is fact-owned, not aggregate-CV-owned. For each
  // source/candidate pair, a material relation in the realized candidate must
  // occur in that exact source fact. This preserves translated synonyms while
  // rejecting an added tool, metric, team/leadership relation, object/domain,
  // or action borrowed from another fact or entry.
  const unauthorizedArgumentKinds: ExperienceSemanticArgumentKind[] = [];
  for (const [sourceIndex, candidateIndex] of matchedCandidateIndexes) {
    if (!scriptsDiffer || !richRelationSource) continue;
    const sourceKinds = new Set(extractExperienceSemanticArgumentKinds(srcUnits[sourceIndex] || ''));
    const candidateKinds = extractExperienceSemanticArgumentKinds(bullets[candidateIndex] || '');
    for (const kind of candidateKinds) {
      // Relation qualifiers (criterion/beneficiary/media/project/quality) are
      // validated by the bidirectional typed bridge below. The per-fact
      // ownership pass is reserved for material additions that cannot be
      // authorized by aggregate lexical overlap: tools, metrics, leadership,
      // escalated responsibility, changed domains, and added actions.
      if (!['tool_system', 'quantitative_metric', 'leadership_management',
        'responsibility_escalation', 'object_domain', 'unrelated_action'].includes(kind)) continue;
      if (!sourceKinds.has(kind) && !unauthorizedArgumentKinds.includes(kind)) {
        unauthorizedArgumentKinds.push(kind);
      }
    }
  }
  // An extra candidate bullet cannot inherit authority from any selected
  // source fact. Keep the evidence categorical and privacy-safe.
  if (usedB.size !== bullets.length) {
    for (let index = 0; index < bullets.length; index += 1) {
      if (!usedB.has(index)) {
        const kinds = extractExperienceSemanticArgumentKinds(bullets[index]);
        if (kinds.length && !unauthorizedArgumentKinds.includes('unrelated_action')) {
          unauthorizedArgumentKinds.push('unrelated_action');
        }
      }
    }
  }
  for (const kind of unauthorizedArgumentKinds) {
    if (!uniqueAddedSemanticArgumentKinds.includes(kind)) {
      uniqueAddedSemanticArgumentKinds.push(kind);
    }
  }
  const semanticArgumentCoveragePassed = uniqueAddedSemanticArgumentKinds.length === 0
    && missingSemanticArgumentKinds.length === 0;
  const ok = covered >= Math.min(3, requiredCount)
    && uncoveredCount === 0
    && semanticArgumentCoveragePassed;
  return {
    ok,
    requiredCount,
    coveredCount: covered,
    uncoveredCount,
    coveredSourceIndexes,
    uncoveredSourceIndexes,
    semanticArgumentCoveragePassed,
    addedSemanticArgumentCount: uniqueAddedSemanticArgumentKinds.length,
    addedSemanticArgumentKinds: uniqueAddedSemanticArgumentKinds,
    missingSemanticArgumentKinds,
    unauthorizedArgumentCount: unauthorizedArgumentKinds.length,
    unauthorizedArgumentKinds,
    crossEntryRelationLeakageCount: unauthorizedArgumentKinds.includes('unrelated_action') ? 1 : 0,
    reason: ok
      ? undefined
      : (semanticArgumentCoveragePassed
        ? 'experience_material_fact_coverage_incomplete'
        : (unauthorizedArgumentKinds.length
          ? 'experience_semantic_relation_ownership_failed'
          : 'experience_semantic_argument_expansion')),
  };
}
