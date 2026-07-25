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
  materialDutyKeysFromDescription,
} from './cv-material-duty-coverage';
import {
  applySerbianCvEmploymentTense,
  extractSourceDutyUnits,
  stripDutyListPrefix,
} from './cv-source-fact-identity';
import {
  sourceRequiresGermanWarehouseFactCoverage,
  validateGermanWarehouseExperienceCoverage,
} from './cv-german-experience-grounding';
import {
  sourceRequiresSpanishWarehouseFactCoverage,
  validateSpanishWarehouseExperienceCoverage,
} from './cv-spanish-experience-grounding';
import {
  sourceRequiresFrenchWarehouseFactCoverage,
  validateFrenchWarehouseExperienceCoverage,
} from './cv-french-experience-grounding';
import {
  sourceRequiresEnglishWarehouseFactCoverage,
  sourceRequiresStrictEnglishWarehouseFactCoverage,
  countEnglishWarehouseTranslatedFacts,
  validateEnglishWarehouseExperienceCoverage,
} from './cv-english-experience-warehouse-grounding';

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
  if (/(vizuel|grafick|dizajn|visual|design|identitet|identity|platform|ビジュアル|تصميم|डिज़ाइन)/.test(t)) {
    // Collaboration only — do not treat bare "product/platform" as collaborate
    // (those appear in ordinary design-creation shells).
    if (/(saradj|collabor|timov|\bteam\b|konsistenc|consistency|تطوير فريق|टीम|チーム)/.test(t)) {
      return 'collaborate_visual';
    }
    if (/(ažur|azur|update|status|reviz|revision|track|ажурир|تحدّث|अद्यतन|更新)/.test(t)) {
      return 'update_records';
    }
    if (/(prover|pregled|review|adapt|prilagod|verif|samic|समीक्षा|راجع|確認)/.test(t)) {
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
  if (/(prover|pregled|check|verif|tačnost|tacnost|potpunost|dokument|провера|проверя|تتحقق|जाँच|確認)/.test(t)) {
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
          ? 'Checked incoming goods and related documentation for accurate recording.'
          : 'Checks incoming goods and related documentation for accurate recording.';
      }
      if (domain === 'design') {
        return past
          ? 'Reviewed visual materials and design specifications for consistency.'
          : 'Reviews visual materials and design specifications for consistency.';
      }
      return past
        ? 'Reviewed documentation and checked completeness of related records.'
        : 'Reviews documentation and checks completeness of related records.';
    case 'update_records':
      if (domain === 'warehouse') {
        return past
          ? 'Updated warehouse records and maintained orderly arrangement of goods.'
          : 'Updates warehouse records and maintains orderly arrangement of goods.';
      }
      if (domain === 'design') {
        return past
          ? 'Updated design files and tracked revision status across deliverables.'
          : 'Updates design files and tracks revision status across deliverables.';
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
          ? 'Pregleda vizuelne materijale i dizajn specifikacije radi usklađenosti.'
          : (pastF
            ? 'Pregledala je vizuelne materijale i dizajn specifikacije radi usklađenosti.'
            : 'Pregledao je vizuelne materijale i dizajn specifikacije radi usklađenosti.');
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
  if (locale === 'en') {
    return englishBullet(frame, domain, isPresent);
  }
  if (domain !== 'warehouse') {
    const designTable: Partial<Record<Locale, Record<ActionFrame, [string, string]>>> = {
      de: {
        check_records: [
          'Prüft visuelle Materialien und Designvorgaben auf Konsistenz.',
          'Prüfte visuelle Materialien und Designvorgaben auf Konsistenz.',
        ],
        update_records: [
          'Aktualisiert Designdateien und verfolgt den Revisionsstatus der Liefergegenstände.',
          'Aktualisierte Designdateien und verfolgte den Revisionsstatus der Liefergegenstände.',
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
          'Revisa materiales visuales y especificaciones de diseño para garantizar la coherencia.',
          'Revisó materiales visuales y especificaciones de diseño para garantizar la coherencia.',
        ],
        update_records: [
          'Actualiza archivos de diseño y hace seguimiento del estado de revisión de las entregas.',
          'Actualizó archivos de diseño y hizo seguimiento del estado de revisión de las entregas.',
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
      hi: {
        check_records: [
          'दृश्य सामग्री और डिज़ाइन विनिर्देशों की संगति की जाँच करती है।',
          'दृश्य सामग्री और डिज़ाइन विनिर्देशों की संगति की जाँच की।',
        ],
        update_records: [
          'डिज़ाइन फ़ाइलें अपडेट करती है और डिलिवरेबल्स का रिवीज़न स्टेटस ट्रैक करती है।',
          'डिज़ाइन फ़ाइलें अपडेट की और डिलिवरेबल्स का रिवीज़न स्टेटस ट्रैक किया।',
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
          'تراجع المواد البصرية ومواصفات التصميم لضمان الاتساق.',
          'راجعت المواد البصرية ومواصفات التصميم لضمان الاتساق.',
        ],
        update_records: [
          'تحدّث ملفات التصميم وتتابع حالة المراجعات عبر المخرجات.',
          'حدّثت ملفات التصميم وتابعت حالة المراجعات عبر المخرجات.',
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
          'ビジュアル素材とデザイン仕様の整合性を確認する。',
          'ビジュアル素材とデザイン仕様の整合性を確認した。',
        ],
        update_records: [
          'デザインファイルを更新し、成果物の改訂状況を追跡する。',
          'デザインファイルを更新し、成果物の改訂状況を追跡した。',
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
          'Проверяет визуальные материалы и дизайн-спецификации на согласованность.',
          'Проверяла визуальные материалы и дизайн-спецификации на согласованность.',
        ],
        update_records: [
          'Обновляет дизайн-файлы и отслеживает статус правок по материалам.',
          'Обновляла дизайн-файлы и отслеживала статус правок по материалам.',
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
          'Revisa materiais visuais e especificações de design para garantir consistência.',
          'Revisou materiais visuais e especificações de design para garantir consistência.',
        ],
        update_records: [
          'Atualiza arquivos de design e acompanha o status de revisão das entregas.',
          'Atualizou arquivos de design e acompanhou o status de revisão das entregas.',
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
    };
    if (domain === 'design' && designTable[locale]?.[frame]) {
      const row = designTable[locale]![frame]!;
      return past ? row[1] : row[0];
    }
    if (domain !== 'design' && designTable[locale]) {
      // Documentation / generic work: avoid goods wording; use soft generic shells.
      const loc = designTable[locale]!;
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
  const row = table[locale]?.[frame];
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
  if (locale === 'sr' || locale === 'hr') {
    return applySerbianCvEmploymentTense(
      serbianBullet(frame, domain, isPresent, female),
      isPresent,
      gender,
    );
  }
  if (locale === 'hi' && domain === 'warehouse') {
    const warehouse = hindiWarehouseBullet(frame, isPresent);
    if (warehouse) return warehouse;
  }
  const shell = localizedShellBullet(locale, frame, isPresent, domain);
  if (shell) return shell;
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

  // Russian design: emit the three concrete fact families directly. Coarse
  // action-frame shells (generic daily duty / visual-only review) caused false
  // 3/3 semantic coverage on device while missing adaptation and final files.
  if (domain === 'design' && target === 'ru') {
    const lines = isPresent
      ? [
        'Создаёт визуальные материалы и графические элементы для цифровых продуктов и платформ.',
        'Проверяет и адаптирует дизайн-материалы в соответствии с требованиями проекта.',
        'Подготавливает финальные дизайн-файлы и настраивает форматы для разных экранов.',
      ]
      : (female
        ? [
          'Создавала визуальные материалы и графические элементы для цифровых продуктов и платформ.',
          'Проверяла и адаптировала дизайн-материалы в соответствии с требованиями проекта.',
          'Подготавливала финальные дизайн-файлы и настраивала форматы для разных экранов.',
        ]
        : [
          'Создавал визуальные материалы и графические элементы для цифровых продуктов и платформ.',
          'Проверял и адаптировал дизайн-материалы в соответствии с требованиями проекта.',
          'Подготавливал финальные дизайн-файлы и настраивал форматы для разных экранов.',
        ]);
    return formatExperienceBullets(lines);
  }

  const frames = units.map((u) => classifyActionFrame(u));
  // Ensure three distinct bullets when source has three units.
  const used = new Set<string>();
  const lines: string[] = [];
  for (let i = 0; i < frames.length; i += 1) {
    let frame = frames[i];
    let line = bulletForLocale(target, frame, domain, isPresent, options.gender);
    // Prefer disambiguation over frame substitution so source fact frames stay aligned.
    if (used.has(fold(line)) || nearDupOfAny(line, lines)) {
      const hinted = uniquifyLineWithSourceHint(line, units[i] || '', i, target);
      if (!used.has(fold(hinted)) && !nearDupOfAny(hinted, lines)) {
        line = hinted;
      } else {
        const alts: ActionFrame[] = [
          'check_records',
          'update_records',
          'coordinate_info',
          'prepare_materials',
          'collaborate_visual',
          'generic_duty',
        ];
        for (const alt of alts) {
          if (alt === frame) continue;
          const candidate = bulletForLocale(target, alt, domain, isPresent, options.gender);
          if (!used.has(fold(candidate)) && !nearDupOfAny(candidate, lines)) {
            frame = alt;
            line = candidate;
            break;
          }
        }
        if (used.has(fold(line)) || nearDupOfAny(line, lines)) {
          line = uniquifyLineWithSourceHint(line, units[i] || '', i, target);
        }
      }
    }
    used.add(fold(line));
    lines.push(line);
  }

  // Pad to 3 if needed using remaining frames for the domain.
  const padFrames: ActionFrame[] = domain === 'design'
    ? ['prepare_materials', 'collaborate_visual', 'update_records']
    : ['check_records', 'update_records', 'coordinate_info'];
  for (const frame of padFrames) {
    if (lines.length >= 3) break;
    const line = bulletForLocale(target, frame, domain, isPresent, options.gender);
    if (!used.has(fold(line))) {
      used.add(fold(line));
      lines.push(line);
    }
  }

  return formatExperienceBullets(lines.slice(0, Math.max(3, units.length)).slice(0, 3));
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
  reason?: string;
} {
  const srcUnits = extractSourceDutyUnits(sourceDescription)
    .map((u) => stripDutyListPrefix(u))
    .filter((u) => u.length > 8);
  const bullets = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);
  const requiredCount = srcUnits.length;
  if (!requiredCount) {
    return { ok: true, requiredCount: 0, coveredCount: 0, uncoveredCount: 0 };
  }
  if (!bullets.length) {
    return {
      ok: false,
      requiredCount,
      coveredCount: 0,
      uncoveredCount: requiredCount,
      reason: 'experience_material_fact_coverage_incomplete',
    };
  }

  const srcFrames = srcUnits.map((u) => classifyActionFrame(u));
  const candFrames = bullets.map((b) => classifyActionFrame(b));
  const usedB = new Set<number>();
  let covered = 0;
  const warehouseSource = sourceRequiresGermanWarehouseFactCoverage(sourceDescription)
    || sourceRequiresSpanishWarehouseFactCoverage(sourceDescription)
    || materialDutyKeysFromDescription(sourceDescription)
      .some((k) => k.startsWith('warehouse_'));
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
    }
  }
  const uncoveredCount = requiredCount - covered;
  const ok = covered >= Math.min(3, requiredCount) && uncoveredCount === 0;
  return {
    ok,
    requiredCount,
    coveredCount: covered,
    uncoveredCount,
    reason: ok ? undefined : 'experience_material_fact_coverage_incomplete',
  };
}
