/**
 * Experience AI operation mode — thin adapter over the universal AI contract.
 * Generation fallback is title-grounded for arbitrary free-text occupations
 * (no occupation catalogue / per-title keyword branches).
 */
import type { Locale } from './i18n/translations';
import { formatExperienceBullets, splitExperienceBullets } from './cv-canonical-facts';
import { extractSourceDutyUnits } from './cv-source-fact-identity';
import {
  detectExperiencePersonMode,
  validateExperienceCvPerspective,
} from './cv-experience-perspective';
import { hasUnsupportedRegulatedPharmacyClaims } from './cv-experience-job-context';
import {
  aiOutputLooksGenericFillerOnly,
  aiOutputRepeatsFullTitleUnnaturally,
  classifyFreeTextJobDomain,
  countAiUnsafeInventionClaims,
  freeTextTitleStems,
  jobTitleScriptConflictsWithLocale,
  resolveAiOperationMode,
  textLooksRelevantToFreeTextTitle,
  toExperienceAiOperationModeCompat,
  type ExperienceAiOperationModeCompat,
  type FreeTextJobDomain,
} from './cv-ai-operation-contract';
import { validateArabicExperienceEmploymentTense } from './cv-arabic-experience-tense';

export type ExperienceAiOperationMode = ExperienceAiOperationModeCompat;

export function resolveExperienceAiOperationMode(
  sourceDescription: string | null | undefined,
): ExperienceAiOperationMode {
  const units = extractSourceDutyUnits(sourceDescription || '');
  return toExperienceAiOperationModeCompat(
    resolveAiOperationMode({
      targetContent: sourceDescription,
      contentUnits: units,
    }),
  );
}

export function experienceAiSourceWasEmpty(sourceDescription: string | null | undefined): boolean {
  return resolveExperienceAiOperationMode(sourceDescription) === 'generate_from_job_context';
}

/** @deprecated Prefer freeTextTitleStems from cv-ai-operation-contract. */
export function titleRelevanceStems(position: string): string[] {
  return freeTextTitleStems(position);
}

export function generationTextLooksRelevantToTitle(
  text: string,
  position: string,
): boolean {
  return textLooksRelevantToFreeTextTitle(text, position);
}

export function generationLooksGenericFillerOnly(text: string): boolean {
  return aiOutputLooksGenericFillerOnly(text);
}

export type GenerationValidationResult = {
  ok: boolean;
  reason?: string;
  generatedBulletCount: number;
  relevanceValidationPassed: boolean;
  perspectiveValidationPassed: boolean;
  tenseValidationPassed: boolean;
  unsupportedClaimCount: number;
  providerTensePassed?: boolean;
  normalizedTensePassed?: boolean;
  finalTensePassed?: boolean;
  finalEmploymentState?: 'current' | 'completed';
  finalGenderAgreementPassed?: boolean;
  finalArabicVerbForms?: string[];
};

/**
 * Generation-mode postconditions — no source-fact coverage.
 */
export function validateExperienceGenerationOutput(
  text: string,
  options: {
    locale: Locale;
    position?: string;
    isPresent?: boolean;
    gender?: string;
  },
): GenerationValidationResult {
  const bullets = splitExperienceBullets(text || '').filter(Boolean);
  const generatedBulletCount = bullets.length;
  if (generatedBulletCount !== 3) {
    return {
      ok: false,
      reason: 'experience_generation_failed',
      generatedBulletCount,
      relevanceValidationPassed: false,
      perspectiveValidationPassed: false,
      tenseValidationPassed: false,
      unsupportedClaimCount: 0,
    };
  }
  const unique = new Set(bullets.map((b) => b.replace(/\s+/g, ' ').trim().toLowerCase()));
  if (unique.size < 3) {
    return {
      ok: false,
      reason: 'experience_generation_failed',
      generatedBulletCount,
      relevanceValidationPassed: false,
      perspectiveValidationPassed: false,
      tenseValidationPassed: false,
      unsupportedClaimCount: 0,
    };
  }
  if (generationLooksGenericFillerOnly(text)) {
    return {
      ok: false,
      reason: 'experience_generation_not_relevant',
      generatedBulletCount,
      relevanceValidationPassed: false,
      perspectiveValidationPassed: true,
      tenseValidationPassed: true,
      unsupportedClaimCount: 0,
    };
  }
  if (aiOutputRepeatsFullTitleUnnaturally(text, options.position || '')) {
    return {
      ok: false,
      reason: 'experience_generation_not_relevant',
      generatedBulletCount,
      relevanceValidationPassed: false,
      perspectiveValidationPassed: true,
      tenseValidationPassed: true,
      unsupportedClaimCount: 0,
    };
  }
  const titleDomain = classifyFreeTextJobDomain(options.position || '');
  // Cross-domain leakage: design titles must not absorb warehouse/goods duties.
  if (
    titleDomain === 'design'
    && /(?:warehouse|skladist|incoming\s+goods|deliver\s+goods|गोदाम|माल और|आवाजाही|robu|isporuč|inventar)/iu.test(text)
  ) {
    return {
      ok: false,
      reason: 'experience_generation_not_relevant',
      generatedBulletCount,
      relevanceValidationPassed: false,
      perspectiveValidationPassed: true,
      tenseValidationPassed: true,
      unsupportedClaimCount: 0,
    };
  }
  const relevanceValidationPassed = generationTextLooksRelevantToTitle(
    text,
    options.position || '',
  );
  if (!relevanceValidationPassed) {
    return {
      ok: false,
      reason: 'experience_generation_not_relevant',
      generatedBulletCount,
      relevanceValidationPassed: false,
      perspectiveValidationPassed: true,
      tenseValidationPassed: true,
      unsupportedClaimCount: 0,
    };
  }
  const perspective = validateExperienceCvPerspective(text, options.locale);
  if (!perspective.ok) {
    return {
      ok: false,
      reason: 'experience_generation_failed',
      generatedBulletCount,
      relevanceValidationPassed: true,
      perspectiveValidationPassed: false,
      tenseValidationPassed: true,
      unsupportedClaimCount: 0,
    };
  }
  const person = detectExperiencePersonMode(text, options.locale);
  let tenseValidationPassed = person !== 'first_singular';
  if (options.locale === 'ar') {
    const employmentTense = validateArabicExperienceEmploymentTense(text, {
      isPresent: options.isPresent !== false,
      gender: options.gender,
    });
    tenseValidationPassed = tenseValidationPassed && employmentTense.finalTensePassed
      && employmentTense.finalGenderAgreementPassed;
    if (!tenseValidationPassed) {
      return {
        ok: false,
        reason: employmentTense.reason || 'experience_generation_failed',
        generatedBulletCount,
        relevanceValidationPassed: true,
        perspectiveValidationPassed: perspective.ok,
        tenseValidationPassed: false,
        unsupportedClaimCount: 0,
        providerTensePassed: employmentTense.providerTensePassed,
        normalizedTensePassed: employmentTense.normalizedTensePassed,
        finalTensePassed: employmentTense.finalTensePassed,
        finalEmploymentState: employmentTense.finalEmploymentState,
        finalGenderAgreementPassed: employmentTense.finalGenderAgreementPassed,
        finalArabicVerbForms: employmentTense.finalArabicVerbForms,
      };
    }
  }
  if (!tenseValidationPassed) {
    return {
      ok: false,
      reason: 'experience_generation_failed',
      generatedBulletCount,
      relevanceValidationPassed: true,
      perspectiveValidationPassed: perspective.ok,
      tenseValidationPassed: false,
      unsupportedClaimCount: 0,
    };
  }
  let unsupportedClaimCount = countAiUnsafeInventionClaims(text);
  if (hasUnsupportedRegulatedPharmacyClaims(text)) unsupportedClaimCount += 1;
  if (unsupportedClaimCount > 0) {
    return {
      ok: false,
      reason: 'experience_generation_unsafe_claims',
      generatedBulletCount,
      relevanceValidationPassed: true,
      perspectiveValidationPassed: true,
      tenseValidationPassed: true,
      unsupportedClaimCount,
    };
  }
  const arOk = options.locale === 'ar'
    ? validateArabicExperienceEmploymentTense(text, {
      isPresent: options.isPresent !== false,
      gender: options.gender,
    })
    : null;
  return {
    ok: true,
    generatedBulletCount,
    relevanceValidationPassed: true,
    perspectiveValidationPassed: true,
    tenseValidationPassed: true,
    unsupportedClaimCount: 0,
    ...(arOk ? {
      providerTensePassed: arOk.providerTensePassed,
      normalizedTensePassed: arOk.normalizedTensePassed,
      finalTensePassed: arOk.finalTensePassed,
      finalEmploymentState: arOk.finalEmploymentState,
      finalGenderAgreementPassed: arOk.finalGenderAgreementPassed,
      finalArabicVerbForms: arOk.finalArabicVerbForms,
    } : {}),
  };
}

function roleLabel(position: string, female: boolean, locale: Locale): string {
  const p = (position || '').trim();
  if (p && !jobTitleScriptConflictsWithLocale(p, locale)) return p;
  if (locale === 'sr' || locale === 'hr') return female ? 'profesionalka' : 'profesionalac';
  if (locale === 'hi') return 'पेशेवर';
  if (locale === 'ar') return 'المهني';
  if (locale === 'ja') return '担当者';
  if (locale === 'de') return 'Fachkraft';
  if (locale === 'es') return 'profesional';
  if (locale === 'fr') return 'professionnel';
  if (locale === 'it') return 'professionista';
  if (locale === 'ru') return 'специалист';
  if (locale === 'pt-BR') return 'profissional';
  return 'Professional';
}

/**
 * Soft domain phrasing from free-text title — never returns a foreign-script
 * title for injection into a different target locale's prose.
 */
function softDomainFromTitle(position: string, locale: Locale): string {
  const raw = (position || '').trim();
  if (!raw) return '';
  if (jobTitleScriptConflictsWithLocale(raw, locale)) return '';
  const stripped = raw.replace(
    /^(koordinator(?:ka)?|coordinator|specijalista|specialist|analitičar(?:ka)?|analyst|menadžer(?:ka)?|manager|saradnik(?:ca)?|assistant|responsável|coordenador(?:a)?|responsable|radnik(?:ca)?|radnica|worker|associate)\s+/iu,
    '',
  ).trim();
  const afterPrep = stripped.match(/\b(?:u|za|za|in|for)\s+(.+)$/iu)?.[1]?.trim();
  if (afterPrep && afterPrep.length >= 4 && afterPrep.length < stripped.length) {
    return afterPrep;
  }
  return stripped || raw;
}

type DutyTriple = [string, string, string];

/** Locale-pure shells keyed by soft semantic domain — no raw foreign titles. */
function domainShells(
  domain: FreeTextJobDomain,
  locale: Locale,
  present: boolean,
  female: boolean,
): DutyTriple | null {
  if (locale === 'hi') {
    if (domain === 'design') {
      if (present) {
        return female
          ? [
            'विभिन्न परियोजनाओं के लिए दृश्य सामग्री और ग्राफिक तत्व तैयार करती है।',
            'आवश्यकताओं के अनुसार डिज़ाइन सामग्री की समीक्षा और अनुकूलन करती है।',
            'अंतिम डिज़ाइन फ़ाइलें तैयार करती है और उन्हें विभिन्न प्रारूपों के लिए अनुकूलित करती है।',
          ]
          : [
            'विभिन्न परियोजनाओं के लिए दृश्य सामग्री और ग्राफिक तत्व तैयार करता है।',
            'आवश्यकताओं के अनुसार डिज़ाइन सामग्री की समीक्षा और अनुकूलन करता है।',
            'अंतिम डिज़ाइन फ़ाइलें तैयार करता है और उन्हें विभिन्न प्रारूपों के लिए अनुकूलित करता है।',
          ];
      }
      return [
        'विभिन्न परियोजनाओं के लिए दृश्य सामग्री और ग्राफिक तत्व तैयार किए।',
        'आवश्यकताओं के अनुसार डिज़ाइन सामग्री की समीक्षा और अनुकूलन किया।',
        'अंतिम डिज़ाइन फ़ाइलें तैयार कीं और उन्हें विभिन्न प्रारूपों के लिए अनुकूलित किया।',
      ];
    }
    if (domain === 'warehouse') {
      if (present) {
        return female
          ? [
            'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित करती है।',
            'गोदाम के रिकॉर्ड अद्यतन करती है और सामान को व्यवस्थित रखती है।',
            'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।',
          ]
          : [
            'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित करता है।',
            'गोदाम के रिकॉर्ड अद्यतन करता है और सामान को व्यवस्थित रखता है।',
            'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करता है।',
          ];
      }
      return [
        'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित किया।',
        'गोदाम के रिकॉर्ड अद्यतन किए और सामान को व्यवस्थित रखा।',
        'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय किया।',
      ];
    }
    if (present) {
      return female
        ? [
          'दैनिक कार्य रिकॉर्ड की समीक्षा करती है और डेटा की पूर्णता सुनिश्चित करती है।',
          'कार्य दस्तावेज़ अद्यतन करती है और खुली मदों की स्थिति पर नज़र रखती है।',
          'सहकर्मियों के साथ जानकारी का समन्वय करके दस्तावेज़ समय पर पूरा करती है।',
        ]
        : [
          'दैनिक कार्य रिकॉर्ड की समीक्षा करता है और डेटा की पूर्णता सुनिश्चित करता है।',
          'कार्य दस्तावेज़ अद्यतन करता है और खुली मदों की स्थिति पर नज़र रखता है।',
          'सहकर्मियों के साथ जानकारी का समन्वय करके दस्तावेज़ समय पर पूरा करता है।',
        ];
    }
    return [
      'दैनिक कार्य रिकॉर्ड की समीक्षा की और डेटा की पूर्णता सुनिश्चित की।',
      'कार्य दस्तावेज़ अद्यतन किए और खुली मदों की स्थिति पर नज़र रखी।',
      'सहकर्मियों के साथ जानकारी का समन्वय करके दस्तावेज़ समय पर पूरा किया।',
    ];
  }

  if (locale === 'en') {
    if (domain === 'design') {
      return present
        ? [
          'Create visual materials and graphic elements for digital products and platforms.',
          'Review and adapt design materials according to project requirements.',
          'Prepare final design files and adjust formats for different screens.',
        ]
        : [
          'Created visual materials and graphic elements for digital products and platforms.',
          'Reviewed and adapted design materials according to project requirements.',
          'Prepared final design files and adjusted formats for different screens.',
        ];
    }
    if (domain === 'warehouse') {
      return present
        ? [
          'Check incoming goods and related documentation for accurate recording.',
          'Update warehouse records and keep goods orderly.',
          'Coordinate preparation and movement of goods with colleagues.',
        ]
        : [
          'Checked incoming goods and related documentation for accurate recording.',
          'Updated warehouse records and kept goods orderly.',
          'Coordinated preparation and movement of goods with colleagues.',
        ];
    }
  }

  if (locale === 'ar') {
    if (domain === 'design') {
      if (present) {
        return female
          ? [
            'تعدّ مواد بصرية وعناصر رسومية للمنتجات والمنصات الرقمية.',
            'تراجع وتكيّف مواد التصميم وفق متطلبات المشروع.',
            'تعدّ ملفات التصميم النهائية وتضبط الصيغ لشاشات مختلفة.',
          ]
          : [
            'يعدّ مواد بصرية وعناصر رسومية للمنتجات والمنصات الرقمية.',
            'يراجع ويكيّف مواد التصميم وفق متطلبات المشروع.',
            'يعدّ ملفات التصميم النهائية ويضبط الصيغ لشاشات مختلفة.',
          ];
      }
      return female
        ? [
          'أعدّت مواد بصرية وعناصر رسومية للمنتجات والمنصات الرقمية.',
          'راجعت وكيّفت مواد التصميم وفق متطلبات المشروع.',
          'أعدّت ملفات التصميم النهائية وضبطت الصيغ لشاشات مختلفة.',
        ]
        : [
          'أعدّ مواد بصرية وعناصر رسومية للمنتجات والمنصات الرقمية.',
          'راجع وكيّف مواد التصميم وفق متطلبات المشروع.',
          'أعدّ ملفات التصميم النهائية وضبط الصيغ لشاشات مختلفة.',
        ];
    }
    if (domain === 'warehouse') {
      if (present) {
        return female
          ? [
            'تتحقق من البضائع الواردة والوثائق المرفقة لضمان التسجيل الدقيق.',
            'تحدّث سجلات المستودع وتحافظ على ترتيب البضائع.',
            'تنسّق إعداد البضائع وحركتها مع الزملاء.',
          ]
          : [
            'يتحقق من البضائع الواردة والوثائق المرفقة لضمان التسجيل الدقيق.',
            'يحدّث سجلات المستودع ويحافظ على ترتيب البضائع.',
            'ينسّق إعداد البضائع وحركتها مع الزملاء.',
          ];
      }
      return female
        ? [
          'تحقّقت من البضائع الواردة والوثائق المرفقة لضمان التسجيل الدقيق.',
          'حدّثت سجلات المستودع وحافظت على ترتيب البضائع.',
          'نسّقت إعداد البضائع وحركتها مع الزملاء.',
        ]
        : [
          'تحقّق من البضائع الواردة والوثائق المرفقة لضمان التسجيل الدقيق.',
          'حدّث سجلات المستودع وحافظ على ترتيب البضائع.',
          'نسّق إعداد البضائع وحركتها مع الزملاء.',
        ];
    }
  }

  if (locale === 'ja') {
    if (domain === 'design') {
      return [
        'デジタル製品やプラットフォーム向けにビジュアル素材とグラフィック要素を作成する。',
        '要件に合わせてデザイン素材を確認し調整する。',
        '最終デザインファイルを準備し、画面ごとに形式を調整する。',
      ];
    }
    if (domain === 'warehouse') {
      return [
        '入荷した商品と関連書類の正確性を確認する。',
        '倉庫記録を更新し、保管品の整然とした配置を維持する。',
        '同僚と連携して商品の準備と移動を調整する。',
      ];
    }
  }

  if (locale === 'ru') {
    if (domain === 'design') {
      if (present) {
        return [
          'Создаёт визуальные материалы и графические элементы для цифровых продуктов и платформ.',
          'Проверяет и адаптирует дизайн-материалы в соответствии с требованиями проекта.',
          'Подготавливает финальные дизайн-файлы и настраивает форматы для разных экранов.',
        ];
      }
      return female
        ? [
          'Создавала визуальные материалы и графические элементы для цифровых продуктов и платформ.',
          'Проверяла и адаптировала дизайн-материалы в соответствии с требованиями проекта.',
          'Подготавливала финальные дизайн-файлы и настраивала форматы для разных экранов.',
        ]
        : [
          'Создавал визуальные материалы и графические элементы для цифровых продуктов и платформ.',
          'Проверял и адаптировал дизайн-материалы в соответствии с требованиями проекта.',
          'Подготавливал финальные дизайн-файлы и настраивал форматы для разных экранов.',
        ];
    }
    if (domain === 'warehouse') {
      if (present) {
        return [
          'Проверяет поступающие товары и сопроводительные документы, обеспечивая точность учёта.',
          'Обновляет складские записи и поддерживает порядок и организованное размещение товаров.',
          'Координирует с коллегами подготовку товаров и их перемещение внутри склада.',
        ];
      }
      return female
        ? [
          'Проверяла поступающие товары и сопроводительные документы, обеспечивая точность учёта.',
          'Обновляла складские записи и поддерживала порядок и организованное размещение товаров.',
          'Координировала с коллегами подготовку товаров и их перемещение внутри склада.',
        ]
        : [
          'Проверял поступающие товары и сопроводительные документы, обеспечивая точность учёта.',
          'Обновлял складские записи и поддерживал порядок и организованное размещение товаров.',
          'Координировал с коллегами подготовку товаров и их перемещение внутри склада.',
        ];
    }
  }

  if ((locale === 'sr' || locale === 'hr') && domain === 'design') {
    return present
      ? [
        'Kreira vizuelne materijale i grafičke elemente za digitalne proizvode i platforme.',
        'Pregleda i prilagođava dizajn materijale prema zahtevima projekta.',
        'Priprema finalne dizajn fajlove i prilagođava formate za različite ekrane.',
      ]
      : [
        female
          ? 'Kreirala je vizuelne materijale i grafičke elemente za digitalne proizvode i platforme.'
          : 'Kreirao je vizuelne materijale i grafičke elemente za digitalne proizvode i platforme.',
        female
          ? 'Pregledala je i prilagođavala dizajn materijale prema zahtevima projekta.'
          : 'Pregledao je i prilagođavao dizajn materijale prema zahtevima projekta.',
        female
          ? 'Pripremala je finalne dizajn fajlove i prilagođavala formate za različite ekrane.'
          : 'Pripremao je finalne dizajn fajlove i prilagođavao formate za različite ekrane.',
      ];
  }

  return null;
}

/**
 * Deterministic job-context generation fallback (not source-preserving).
 * Grounds arbitrary free-text titles without occupation catalogues.
 * Never injects foreign-script job titles into target-locale prose.
 */
export function buildJobContextGenerationFallback(options: {
  locale: Locale;
  gender?: string;
  position?: string;
  industry?: string;
  isPresent?: boolean;
}): string {
  const locale = options.locale;
  const present = options.isPresent !== false;
  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'ženski' || g === 'zenski';
  const domain = classifyFreeTextJobDomain(options.position || '');
  void options.industry;

  const specialized = domainShells(domain, locale, present, female);
  if (specialized) {
    return formatExperienceBullets([...specialized]);
  }

  // Safe domain phrase only when script-compatible with the target locale.
  const domainPhrase = softDomainFromTitle(options.position || '', locale);
  const role = roleLabel(options.position || '', female, locale);
  const domainOrRole = domainPhrase || role;

  if (locale === 'sr' || locale === 'hr') {
    const lines = present
      ? [
        `Pregleda dokumentaciju povezanu sa svakodnevnim zadacima u oblasti ${domainOrRole} i proverava potpunost podataka.`,
        'Ažurira evidenciju i prati status dokumentacije u skladu sa potrebama radnog mesta.',
        'Koordiniše razmenu informacija sa kolegama radi pravovremenog kompletiranja dokumentacije.',
      ]
      : [
        female
          ? `Pregledala je dokumentaciju povezanu sa svakodnevnim zadacima u oblasti ${domainOrRole} i proveravala potpunost podataka.`
          : `Pregledao je dokumentaciju povezanu sa svakodnevnim zadacima u oblasti ${domainOrRole} i proveravao potpunost podataka.`,
        female
          ? 'Ažurirala je evidenciju i pratila status dokumentacije u skladu sa potrebama radnog mesta.'
          : 'Ažurirao je evidenciju i pratio status dokumentacije u skladu sa potrebama radnog mesta.',
        female
          ? 'Koordinisala je razmenu informacija sa kolegama radi pravovremenog kompletiranja dokumentacije.'
          : 'Koordinisao je razmenu informacija sa kolegama radi pravovremenog kompletiranja dokumentacije.',
      ];
    return formatExperienceBullets(lines);
  }

  if (locale === 'en') {
    return formatExperienceBullets(present
      ? [
        `Review day-to-day records related to ${domainOrRole} and verify data completeness.`,
        'Update work documentation and track open items according to role needs.',
        'Coordinate information sharing with colleagues to complete documentation on time.',
      ]
      : [
        `Reviewed day-to-day records related to ${domainOrRole} and verified data completeness.`,
        'Updated work documentation and tracked open items according to role needs.',
        'Coordinated information sharing with colleagues to complete documentation on time.',
      ]);
  }

  if (locale === 'hi') {
    // Domain shells above cover design/warehouse; generic Hindi never embeds Latin titles.
    return formatExperienceBullets(present
      ? [
        'दैनिक कार्य रिकॉर्ड की समीक्षा करती है और डेटा की पूर्णता सुनिश्चित करती है।',
        'कार्य दस्तावेज़ अद्यतन करती है और खुली मदों की स्थिति पर नज़र रखती है।',
        'सहकर्मियों के साथ जानकारी का समन्वय करके दस्तावेज़ समय पर पूरा करती है।',
      ]
      : [
        'दैनिक कार्य रिकॉर्ड की समीक्षा की और डेटा की पूर्णता सुनिश्चित की।',
        'कार्य दस्तावेज़ अद्यतन किए और खुली मदों की स्थिति पर नज़र रखी।',
        'सहकर्मियों के साथ जानकारी का समन्वय करके दस्तावेज़ समय पर पूरा किया।',
      ]);
  }

  if (locale === 'ar') {
    if (present) {
      return formatExperienceBullets(female
        ? [
          'تراجع السجلات اليومية المرتبطة بالدور وتتحقق من اكتمال البيانات.',
          'تحدّث وثائق العمل وتتابع البنود المفتوحة وفق احتياجات الدور.',
          'تنسّق تبادل المعلومات مع الزملاء لإكمال التوثيق في الوقت المناسب.',
        ]
        : [
          'يراجع السجلات اليومية المرتبطة بالدور ويتحقق من اكتمال البيانات.',
          'يحدّث وثائق العمل ويتابع البنود المفتوحة وفق احتياجات الدور.',
          'ينسّق تبادل المعلومات مع الزملاء لإكمال التوثيق في الوقت المناسب.',
        ]);
    }
    return formatExperienceBullets(female
      ? [
        'راجعت السجلات اليومية المرتبطة بالدور وتحقّقت من اكتمال البيانات.',
        'حدّثت وثائق العمل وتابعت البنود المفتوحة وفق احتياجات الدور.',
        'نسّقت تبادل المعلومات مع الزملاء لإكمال التوثيق في الوقت المناسب.',
      ]
      : [
        'راجع السجلات اليومية المرتبطة بالدور وتحقّق من اكتمال البيانات.',
        'حدّث وثائق العمل وتابع البنود المفتوحة وفق احتياجات الدور.',
        'نسّق تبادل المعلومات مع الزملاء لإكمال التوثيق في الوقت المناسب.',
      ]);
  }

  if (locale === 'ja') {
    return formatExperienceBullets([
      '日常業務に関する記録を確認し、データの完全性を検証する。',
      '業務文書を更新し、未完了項目の状況を確認する。',
      '関係者と情報を調整し、文書を期限内に完了させる。',
    ]);
  }

  if (locale === 'de') {
    return formatExperienceBullets(present
      ? [
        `Prüft tägliche Unterlagen im Bereich ${domainOrRole} und kontrolliert die Vollständigkeit der Daten.`,
        'Aktualisiert Arbeitsdokumentation und verfolgt offene Vorgänge.',
        'Koordiniert den Informationsaustausch mit Kolleginnen und Kollegen zur fristgerechten Fertigstellung.',
      ]
      : [
        `Prüfte tägliche Unterlagen im Bereich ${domainOrRole} und kontrollierte die Vollständigkeit der Daten.`,
        'Aktualisierte Arbeitsdokumentation und verfolgte offene Vorgänge.',
        'Koordinierte den Informationsaustausch mit Kolleginnen und Kollegen zur fristgerechten Fertigstellung.',
      ]);
  }

  if (locale === 'es') {
    return formatExperienceBullets(present
      ? [
        `Revisa registros diarios relacionados con ${domainOrRole} y verifica la integridad de los datos.`,
        'Actualiza la documentación de trabajo y sigue asuntos abiertos.',
        'Coordina el intercambio de información con colegas para completar la documentación a tiempo.',
      ]
      : [
        `Revisó registros diarios relacionados con ${domainOrRole} y verificó la integridad de los datos.`,
        'Actualizó la documentación de trabajo y siguió asuntos abiertos.',
        'Coordinó el intercambio de información con colegas para completar la documentación a tiempo.',
      ]);
  }

  if (locale === 'fr') {
    return formatExperienceBullets(present
      ? [
        `Examine les dossiers quotidiens liés à ${domainOrRole} et vérifie l’exhaustivité des données.`,
        'Met à jour la documentation de travail et suit les dossiers ouverts.',
        'Coordonne l’échange d’informations avec les collègues pour finaliser la documentation.',
      ]
      : [
        `Examinait les dossiers quotidiens liés à ${domainOrRole} et vérifiait l’exhaustivité des données.`,
        'Mettait à jour la documentation de travail et suivait les dossiers ouverts.',
        'Coordonnait l’échange d’informations avec les collègues pour finaliser la documentation.',
      ]);
  }

  if (locale === 'it') {
    return formatExperienceBullets(present
      ? [
        `Esamina i registri quotidiani relativi a ${domainOrRole} e verifica la completezza dei dati.`,
        'Aggiorna la documentazione di lavoro e segue le pratiche aperte.',
        'Coordina lo scambio di informazioni con i colleghi per completare la documentazione.',
      ]
      : [
        `Esaminava i registri quotidiani relativi a ${domainOrRole} e verificava la completezza dei dati.`,
        'Aggiornava la documentazione di lavoro e seguiva le pratiche aperte.',
        'Coordinava lo scambio di informazioni con i colleghi per completare la documentazione.',
      ]);
  }

  if (locale === 'ru') {
    return formatExperienceBullets(present
      ? [
        'Проверяет повседневные рабочие записи и полноту данных.',
        'Обновляет рабочую документацию и отслеживает открытые пункты.',
        'Согласовывает обмен информацией с коллегами для своевременного завершения документации.',
      ]
      : female
        ? [
          'Проверяла повседневные рабочие записи и полноту данных.',
          'Обновляла рабочую документацию и отслеживала открытые пункты.',
          'Согласовывала обмен информацией с коллегами для своевременного завершения документации.',
        ]
        : [
          'Проверял повседневные рабочие записи и полноту данных.',
          'Обновлял рабочую документацию и отслеживал открытые пункты.',
          'Согласовывал обмен информацией с коллегами для своевременного завершения документации.',
        ]);
  }

  if (locale === 'pt-BR') {
    return formatExperienceBullets(present
      ? [
        `Revisa registros diários relacionados a ${domainOrRole} e verifica a completude dos dados.`,
        'Atualiza a documentação de trabalho e acompanha itens em aberto.',
        'Coordena a troca de informações com colegas para concluir a documentação no prazo.',
      ]
      : [
        `Revisava registros diários relacionados a ${domainOrRole} e verificava a completude dos dados.`,
        'Atualizava a documentação de trabalho e acompanhava itens em aberto.',
        'Coordenava a troca de informações com colegas para concluir a documentação no prazo.',
      ]);
  }

  // Final layer: always three useful English CV bullets (never empty).
  return formatExperienceBullets(present
    ? [
      'Review day-to-day work records and verify data completeness.',
      'Update work documentation and track open items according to role needs.',
      'Coordinate information sharing with colleagues to complete documentation on time.',
    ]
    : [
      'Reviewed day-to-day work records and verified data completeness.',
      'Updated work documentation and tracked open items according to role needs.',
      'Coordinated information sharing with colleagues to complete documentation on time.',
    ]);
}
