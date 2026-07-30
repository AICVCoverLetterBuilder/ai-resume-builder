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
  generationLooksGenericAdministrativeOnly,
  generationLooksTautologicalRoleShellOnly,
  generationLooksRoleTitleEchoFillerOnly,
  EXPERIENCE_GENERATION_RELEVANCE_367_REVISION,
  EXPERIENCE_GENERATION_FALLBACK_QUALITY_368_REVISION,
  EXPERIENCE_GENERATION_FALLBACK_SURFACE_369_REVISION,
  jobTitleScriptConflictsWithLocale,
  resolveAiOperationMode,
  textLooksRelevantToFreeTextTitle,
  toExperienceAiOperationModeCompat,
  type ExperienceAiOperationModeCompat,
  type FreeTextJobDomain,
} from './cv-ai-operation-contract';
import { validateArabicExperienceEmploymentTense } from './cv-arabic-experience-tense';
import {
  detectExperienceGenerationUnsupportedClaims,
  EXPERIENCE_GENERATION_CLAIM_SAFETY_366_REVISION,
} from './cv-experience-unsupported-claims';

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
  const titleDomainEarly = classifyFreeTextJobDomain(options.position || '');
  void EXPERIENCE_GENERATION_RELEVANCE_367_REVISION;
  void EXPERIENCE_GENERATION_FALLBACK_QUALITY_368_REVISION;
  void EXPERIENCE_GENERATION_FALLBACK_SURFACE_369_REVISION;
  if (
    generationLooksGenericAdministrativeOnly(text)
    && titleDomainEarly !== 'documentation'
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
  if (generationLooksTautologicalRoleShellOnly(text)) {
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
  if (generationLooksRoleTitleEchoFillerOnly(text)) {
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
  const titleDomain = titleDomainEarly;
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
  void EXPERIENCE_GENERATION_CLAIM_SAFETY_366_REVISION;
  const generationClaims = detectExperienceGenerationUnsupportedClaims({
    candidateText: text,
    position: options.position || '',
  });
  unsupportedClaimCount += generationClaims.count;
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
 * Subject-matter + agentive head from free-text title (morphology, not a catalogue).
 * Derives mid-sentence object readings: plural direct object, short head, and
 * singular compound modifier (e.g. solar panel → solar panel installation work).
 */
function parseFreeTextTitleActionGrounding(
  position: string,
  locale: Locale,
): {
  fullTitle: string;
  objectPlural: string;
  objectShort: string;
  objectModifier: string;
  agentive: string | null;
} {
  const fullTitle = (position || '').trim();
  if (!fullTitle || jobTitleScriptConflictsWithLocale(fullTitle, locale)) {
    return {
      fullTitle: '',
      objectPlural: '',
      objectShort: '',
      objectModifier: '',
      agentive: null,
    };
  }
  const tokens = fullTitle.split(/\s+/u).filter(Boolean);
  if (!tokens.length) {
    return {
      fullTitle: '',
      objectPlural: '',
      objectShort: '',
      objectModifier: '',
      agentive: null,
    };
  }
  const last = tokens[tokens.length - 1];
  const agentiveRe =
    /^(installers?|operators?|technicians?|specialists?|managers?|coordinators?|assistants?|analysts?|engineers?|workers?|associates?|officers?|consultants?|developers?|designers?|supervisors?|clerks?|representatives?|liaisons?)$/iu;
  if (tokens.length >= 2 && agentiveRe.test(last)) {
    const objectTokens = tokens.slice(0, -1).map(toOrdinaryJobNounToken);
    return {
      fullTitle,
      objectPlural: pluralizeObjectPhrase(objectTokens),
      objectShort: pluralizeHeadToken(objectTokens[objectTokens.length - 1] || ''),
      objectModifier: objectTokens.join(' '),
      agentive: last,
    };
  }
  const lowered = tokens.map(toOrdinaryJobNounToken);
  return {
    fullTitle,
    objectPlural: lowered.join(' '),
    objectShort: lowered[lowered.length - 1] || '',
    objectModifier: lowered.join(' '),
    agentive: null,
  };
}

/** Lowercase ordinary job nouns; keep short ALL-CAPS tokens (acronyms). */
function toOrdinaryJobNounToken(token: string): string {
  if (/^[A-Z0-9]{2,}$/u.test(token)) return token;
  return token.toLowerCase();
}

function pluralizeHeadToken(token: string): string {
  if (!token) return '';
  if (/s$/i.test(token)) return token;
  // Uncountable / already mass-like heads stay singular.
  if (/^(traffic|data|equipment|software|hardware|information|research)$/i.test(token)) {
    return token;
  }
  return `${token}s`;
}

function pluralizeObjectPhrase(tokens: string[]): string {
  if (!tokens.length) return '';
  const last = tokens[tokens.length - 1];
  const pluralLast = pluralizeHeadToken(last);
  return [...tokens.slice(0, -1), pluralLast].join(' ');
}

/**
 * EN empty-source duties grounded in free-text title morphology.
 * Natural CV prose: no title echo, no role-requirement filler, varied object
 * phrasing, correct compound modifiers (solar panel installation work).
 */
function buildEnglishActionDutyTriple(
  position: string,
  present: boolean,
): DutyTriple {
  const {
    fullTitle,
    objectPlural,
    objectShort,
    objectModifier,
    agentive,
  } = parseFreeTextTitleActionGrounding(position, 'en');
  const title = fullTitle || 'the role';
  const obj = objectPlural || objectModifier || title.toLowerCase();
  const short = objectShort || obj;
  const mod = objectModifier || short;
  const ag = (agentive || '').toLowerCase();

  if (/^installers?$/.test(ag)) {
    return present
      ? [
        `Installs ${obj} as part of assigned installation work.`,
        `Positions and secures ${short} during installation.`,
        'Coordinates installation activities with colleagues.',
      ]
      : [
        `Installed ${obj} as part of assigned installation work.`,
        `Positioned and secured ${short} during installation.`,
        'Coordinated installation activities with colleagues.',
      ];
  }
  if (/^operators?$/.test(ag)) {
    return present
      ? [
        `Operates ${obj} as part of assigned operations work.`,
        `Monitors ${short} during operations.`,
        'Coordinates operational activities with colleagues.',
      ]
      : [
        `Operated ${obj} as part of assigned operations work.`,
        `Monitored ${short} during operations.`,
        'Coordinated operational activities with colleagues.',
      ];
  }
  if (/^technicians?$/.test(ag)) {
    return present
      ? [
        `Performs technical checks on ${obj} as part of assigned technical work.`,
        `Adjusts ${short} during technical work.`,
        'Coordinates technical activities with colleagues.',
      ]
      : [
        `Performed technical checks on ${obj} as part of assigned technical work.`,
        `Adjusted ${short} during technical work.`,
        'Coordinated technical activities with colleagues.',
      ];
  }
  if (/^analysts?$/.test(ag)) {
    return present
      ? [
        `Analyzes ${mod} information as part of assigned analysis work.`,
        `Reviews ${short} findings and completes required follow-ups.`,
        'Coordinates analysis activities with colleagues.',
      ]
      : [
        `Analyzed ${mod} information as part of assigned analysis work.`,
        `Reviewed ${short} findings and completed required follow-ups.`,
        'Coordinated analysis activities with colleagues.',
      ];
  }
  if (/^coordinators?$|^liaisons?$/.test(ag)) {
    return present
      ? [
        `Coordinates ${mod} workstreams as part of assigned coordination work.`,
        `Tracks ${short} status and completes required follow-ups.`,
        'Aligns coordination needs with colleagues.',
      ]
      : [
        `Coordinated ${mod} workstreams as part of assigned coordination work.`,
        `Tracked ${short} status and completed required follow-ups.`,
        'Aligned coordination needs with colleagues.',
      ];
  }
  if (/^managers?$|^supervisors?$/.test(ag)) {
    return present
      ? [
        `Organizes ${mod} work as part of assigned management duties.`,
        `Reviews ${short} progress and completes required follow-ups.`,
        'Coordinates delivery activities with colleagues.',
      ]
      : [
        `Organized ${mod} work as part of assigned management duties.`,
        `Reviewed ${short} progress and completed required follow-ups.`,
        'Coordinated delivery activities with colleagues.',
      ];
  }
  if (/^designers?$/.test(ag)) {
    return present
      ? [
        `Creates ${mod} materials as part of assigned design work.`,
        `Reviews and adapts ${short} materials for project needs.`,
        'Prepares final files with colleagues as needed.',
      ]
      : [
        `Created ${mod} materials as part of assigned design work.`,
        `Reviewed and adapted ${short} materials for project needs.`,
        'Prepared final files with colleagues as needed.',
      ];
  }
  if (/^developers?$|^engineers?$/.test(ag)) {
    return present
      ? [
        `Develops ${mod} solutions as part of assigned delivery work.`,
        `Reviews ${short} outputs and completes required follow-ups.`,
        'Coordinates delivery activities with colleagues.',
      ]
      : [
        `Developed ${mod} solutions as part of assigned delivery work.`,
        `Reviewed ${short} outputs and completed required follow-ups.`,
        'Coordinated delivery activities with colleagues.',
      ];
  }
  if (/^specialists?$|^consultants?$|^assistants?$|^associates?$|^officers?$|^clerks?$|^workers?$|^representatives?$/.test(ag)) {
    return present
      ? [
        `Produces concrete outputs as part of assigned ${mod} work.`,
        `Reviews ${short} inputs and completes required follow-ups.`,
        'Coordinates delivery activities with colleagues.',
      ]
      : [
        `Produced concrete outputs as part of assigned ${mod} work.`,
        `Reviewed ${short} inputs and completed required follow-ups.`,
        'Coordinated delivery activities with colleagues.',
      ];
  }

  // Opaque / unknown free-text titles: preserve full title once; distinct useful actions.
  return present
    ? [
      `Produces concrete outputs for ${title} work.`,
      'Reviews assigned inputs and completes required follow-ups.',
      'Coordinates with colleagues to finish role outputs on schedule.',
    ]
    : [
      `Produced concrete outputs for ${title} work.`,
      'Reviewed assigned inputs and completed required follow-ups.',
      'Coordinated with colleagues to finish role outputs on schedule.',
    ];
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

/**
 * Subject-matter work phrase for non-English general-domain generation shells.
 */
function softWorkPhraseFromTitle(position: string, locale: Locale): string {
  const soft = softDomainFromTitle(position, locale);
  if (!soft) return '';
  const tokens = soft.split(/\s+/u).filter(Boolean);
  if (!tokens.length) return '';
  const last = tokens[tokens.length - 1];
  let phrase = soft;
  if (
    tokens.length >= 2
    && /^(installers?|operators?|technicians?|specialists?|managers?|coordinators?|assistants?|analysts?|engineers?|workers?|associates?|officers?|consultants?|developers?|designers?|supervisors?|clerks?|representatives?|liaisons?)$/iu
      .test(last)
  ) {
    phrase = tokens.slice(0, -1).join(' ');
  }
  if (locale !== 'en') return phrase;
  if (tokens.length === 1) return `${tokens[0]} work`;
  return /work$/iu.test(phrase) ? phrase : `${phrase} work`;
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
    if (domain === 'documentation') {
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
    if (present) {
      return female
        ? [
          'सौंपे गए दैनिक भूमिका संबंधी कार्य पूरे करती है।',
          'भूमिका की आवश्यकताओं के अनुसार कार्य पूरे करती है।',
          'सहकर्मियों के साथ कार्य गतिविधियों का समन्वय करती है।',
        ]
        : [
          'सौंपे गए दैनिक भूमिका संबंधी कार्य पूरे करता है।',
          'भूमिका की आवश्यकताओं के अनुसार कार्य पूरे करता है।',
          'सहकर्मियों के साथ कार्य गतिविधियों का समन्वय करता है।',
        ];
    }
    return [
      'सौंपे गए दैनिक भूमिका संबंधी कार्य पूरे किए।',
      'भूमिका की आवश्यकताओं के अनुसार कार्य पूरे किए।',
      'सहकर्मियों के साथ कार्य गतिविधियों का समन्वय किया।',
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
    if (locale === 'hr') {
      return present
        ? [
          'Izrađuje vizualne materijale i grafičke elemente za digitalne proizvode i platforme.',
          'Pregledava i prilagođava dizajnerske materijale zahtjevima projekta.',
          'Priprema završne dizajnerske datoteke i prilagođava formate različitim zaslonima.',
        ]
        : [
          female
            ? 'Izrađivala je vizualne materijale i grafičke elemente za digitalne proizvode i platforme.'
            : 'Izrađivao je vizualne materijale i grafičke elemente za digitalne proizvode i platforme.',
          female
            ? 'Pregledavala je i prilagođavala dizajnerske materijale zahtjevima projekta.'
            : 'Pregledavao je i prilagođavao dizajnerske materijale zahtjevima projekta.',
          female
            ? 'Pripremala je završne dizajnerske datoteke i prilagođavala formate različitim zaslonima.'
            : 'Pripremao je završne dizajnerske datoteke i prilagođavao formate različitim zaslonima.',
        ];
    }
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

  if (locale === 'hr' && domain === 'warehouse') {
    if (present) {
      return [
        'Provjerava točnost zaprimljene robe i prateće dokumentacije.',
        'Ažurira skladišnu evidenciju te održava uredno i organizirano skladištenje robe.',
        'Surađuje s kolegama pri pripremi i premještanju robe unutar skladišta.',
      ];
    }
    return female
      ? [
        'Provjeravala je točnost zaprimljene robe i prateće dokumentacije.',
        'Ažurirala je skladišnu evidenciju te održavala uredno i organizirano skladištenje robe.',
        'Surađivala je s kolegama pri pripremi i premještanju robe unutar skladišta.',
      ]
      : [
        'Provjeravao je točnost zaprimljene robe i prateće dokumentacije.',
        'Ažurirao je skladišnu evidenciju te održavao uredno i organizirano skladištenje robe.',
        'Surađivao je s kolegama pri pripremi i premještanju robe unutar skladišta.',
      ];
  }

  if (locale === 'de' && domain === 'warehouse') {
    if (present) {
      return [
        'Prüft eingehende Waren.',
        'Kontrolliert die dazugehörigen Unterlagen und Aufzeichnungen.',
        'Koordiniert mit Kolleginnen und Kollegen die Vorbereitung und Bewegung der Waren.',
      ];
    }
    return [
      'Prüfte eingehende Waren.',
      'Kontrollierte die dazugehörigen Unterlagen und Aufzeichnungen.',
      'Koordinierte mit Kolleginnen und Kollegen die Vorbereitung und Bewegung der Waren.',
    ];
  }

  if (locale === 'es' && domain === 'warehouse') {
    if (present) {
      return [
        'Revisa la mercancía entrante.',
        'Comprueba la documentación relacionada.',
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ];
    }
    return [
      'Revisó la mercancía entrante.',
      'Comprobó la documentación relacionada.',
      'Coordinó con sus compañeros la preparación y el movimiento de la mercancía.',
    ];
  }

  if (locale === 'es' && domain === 'design') {
    if (present) {
      return female
        ? [
          'Crea materiales visuales y elementos gráficos para proyectos digitales.',
          'Revisa y adapta materiales de diseño según los requisitos del proyecto.',
          'Prepara archivos finales de diseño y los ajusta a distintos formatos y pantallas.',
        ]
        : [
          'Crea materiales visuales y elementos gráficos para proyectos digitales.',
          'Revisa y adapta materiales de diseño según los requisitos del proyecto.',
          'Prepara archivos finales de diseño y los ajusta a distintos formatos y pantallas.',
        ];
    }
    return [
      'Creó materiales visuales y elementos gráficos para proyectos digitales.',
      'Revisó y adaptó materiales de diseño según los requisitos del proyecto.',
      'Preparó archivos finales de diseño y los ajustó a distintos formatos y pantallas.',
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

  // English general domain: morphology-grounded duties (never tautological role shells).
  if (locale === 'en' && domain !== 'documentation') {
    return formatExperienceBullets([
      ...buildEnglishActionDutyTriple(options.position || '', present),
    ]);
  }

  // Safe work phrase only when script-compatible with the target locale.
  const workPhrase = softWorkPhraseFromTitle(options.position || '', locale);
  const domainPhrase = softDomainFromTitle(options.position || '', locale);
  const role = roleLabel(options.position || '', female, locale);
  const domainOrRole = domainPhrase || role;
  const groundedWork = workPhrase || (locale === 'en' ? 'role work' : role);

  // Documentation occupations keep the administrative shell (materially related).
  if (domain === 'documentation') {
    if (locale === 'en') {
      return formatExperienceBullets(present
        ? [
          `Reviews day-to-day records related to ${domainOrRole} and verifies data completeness.`,
          'Updates work documentation and tracks open items according to role needs.',
          'Coordinates information sharing with colleagues to complete documentation on time.',
        ]
        : [
          `Reviewed day-to-day records related to ${domainOrRole} and verified data completeness.`,
          'Updated work documentation and tracked open items according to role needs.',
          'Coordinated information sharing with colleagues to complete documentation on time.',
        ]);
    }
  }

  if (locale === 'hr') {
    const lines = present
      ? [
        `Obavlja svakodnevne poslove povezane s područjem ${groundedWork} prema dodijeljenim zadacima.`,
        'Dovršava dodijeljene radne zadatke u skladu s potrebama radnog mjesta.',
        'Koordinira radne aktivnosti s kolegama.',
      ]
      : [
        female
          ? `Obavljala je svakodnevne poslove povezane s područjem ${groundedWork} prema dodijeljenim zadacima.`
          : `Obavljao je svakodnevne poslove povezane s područjem ${groundedWork} prema dodijeljenim zadacima.`,
        female
          ? 'Dovršavala je dodijeljene radne zadatke u skladu s potrebama radnog mjesta.'
          : 'Dovršavao je dodijeljene radne zadatke u skladu s potrebama radnog mjesta.',
        female
          ? 'Koordinirala je radne aktivnosti s kolegama.'
          : 'Koordinirao je radne aktivnosti s kolegama.',
      ];
    return formatExperienceBullets(lines);
  }

  if (locale === 'sr') {
    const lines = present
      ? [
        `Obavlja svakodnevne poslove povezane sa oblastima ${groundedWork} prema dodeljenim zadacima.`,
        'Završava dodeljene radne zadatke u skladu sa potrebama radnog mesta.',
        'Koordiniše radne aktivnosti sa kolegama.',
      ]
      : [
        female
          ? `Obavljala je svakodnevne poslove povezane sa oblastima ${groundedWork} prema dodeljenim zadacima.`
          : `Obavljao je svakodnevne poslove povezane sa oblastima ${groundedWork} prema dodeljenim zadacima.`,
        female
          ? 'Završavala je dodeljene radne zadatke u skladu sa potrebama radnog mesta.'
          : 'Završavao je dodeljene radne zadatke u skladu sa potrebama radnog mesta.',
        female
          ? 'Koordinisala je radne aktivnosti sa kolegama.'
          : 'Koordinisao je radne aktivnosti sa kolegama.',
      ];
    return formatExperienceBullets(lines);
  }

  if (locale === 'en') {
    return formatExperienceBullets([
      ...buildEnglishActionDutyTriple(options.position || '', present),
    ]);
  }

  if (locale === 'hi') {
    return formatExperienceBullets(present
      ? [
        'सौंपे गए दैनिक भूमिका संबंधी कार्य पूरे करती है।',
        'भूमिका की आवश्यकताओं के अनुसार कार्य पूरे करती है।',
        'सहकर्मियों के साथ कार्य गतिविधियों का समन्वय करती है।',
      ]
      : [
        'सौंपे गए दैनिक भूमिका संबंधी कार्य पूरे किए।',
        'भूमिका की आवश्यकताओं के अनुसार कार्य पूरे किए।',
        'सहकर्मियों के साथ कार्य गतिविधियों का समन्वय किया।',
      ]);
  }

  if (locale === 'ar') {
    if (present) {
      return formatExperienceBullets(female
        ? [
          'تنفّذ مهام الدور اليومية وفق ما يُسند إليها.',
          'تكمل مهام العمل وفق احتياجات الدور.',
          'تنسّق أنشطة العمل مع الزملاء حسب متطلبات الدور.',
        ]
        : [
          'ينفّذ مهام الدور اليومية وفق ما يُسند إليه.',
          'يكمل مهام العمل وفق احتياجات الدور.',
          'ينسّق أنشطة العمل مع الزملاء حسب متطلبات الدور.',
        ]);
    }
    return formatExperienceBullets(female
      ? [
        'نفّذت مهام الدور اليومية وفق ما أُسند إليها.',
        'أكملت مهام العمل وفق احتياجات الدور.',
        'نسّقت أنشطة العمل مع الزملاء حسب متطلبات الدور.',
      ]
      : [
        'نفّذ مهام الدور اليومية وفق ما أُسند إليه.',
        'أكمل مهام العمل وفق احتياجات الدور.',
        'نسّق أنشطة العمل مع الزملاء حسب متطلبات الدور.',
      ]);
  }

  if (locale === 'ja') {
    return formatExperienceBullets([
      '割り当てに応じて日常の役割業務を遂行する。',
      '役割の要件に応じて業務タスクを完了する。',
      '同僚と連携して業務活動を調整する。',
    ]);
  }

  if (locale === 'de') {
    return formatExperienceBullets(present
      ? [
        `Führt tägliche Aufgaben im Bereich ${groundedWork} nach Zuweisung aus.`,
        'Erledigt zugewiesene Arbeitsaufgaben entsprechend den Rollenanforderungen.',
        'Stimmt Arbeitstätigkeiten mit Kolleginnen und Kollegen ab.',
      ]
      : [
        `Führte tägliche Aufgaben im Bereich ${groundedWork} nach Zuweisung aus.`,
        'Erledigte zugewiesene Arbeitsaufgaben entsprechend den Rollenanforderungen.',
        'Stimmte Arbeitstätigkeiten mit Kolleginnen und Kollegen ab.',
      ]);
  }

  if (locale === 'es') {
    return formatExperienceBullets(present
      ? [
        `Realiza tareas diarias relacionadas con ${groundedWork} según lo asignado.`,
        'Completa tareas asignadas del rol según las necesidades del puesto.',
        'Coordina actividades de trabajo con colegas.',
      ]
      : [
        `Realizó tareas diarias relacionadas con ${groundedWork} según lo asignado.`,
        'Completó tareas asignadas del rol según las necesidades del puesto.',
        'Coordinó actividades de trabajo con colegas.',
      ]);
  }

  if (locale === 'fr') {
    return formatExperienceBullets(present
      ? [
        `Exécute les tâches quotidiennes liées à ${groundedWork} selon les missions assignées.`,
        'Mène à bien les tâches assignées selon les besoins du rôle.',
        'Coordonne les activités de travail avec les collègues.',
      ]
      : [
        `Exécutait les tâches quotidiennes liées à ${groundedWork} selon les missions assignées.`,
        'Menait à bien les tâches assignées selon les besoins du rôle.',
        'Coordonnait les activités de travail avec les collègues.',
      ]);
  }

  if (locale === 'it') {
    return formatExperienceBullets(present
      ? [
        `Svolge compiti quotidiani legati a ${groundedWork} secondo quanto assegnato.`,
        'Completa i compiti assegnati secondo le esigenze del ruolo.',
        'Coordina le attività di lavoro con i colleghi.',
      ]
      : [
        `Svolgeva compiti quotidiani legati a ${groundedWork} secondo quanto assegnato.`,
        'Completava i compiti assegnati secondo le esigenze del ruolo.',
        'Coordinava le attività di lavoro con i colleghi.',
      ]);
  }

  if (locale === 'ru') {
    return formatExperienceBullets(present
      ? [
        'Выполняет повседневные рабочие задачи роли по назначению.',
        'Завершает рабочие задачи согласно требованиям роли.',
        'Согласовывает рабочие активности с коллегами по требованиям роли.',
      ]
      : female
        ? [
          'Выполняла повседневные рабочие задачи роли по назначению.',
          'Завершала рабочие задачи согласно требованиям роли.',
          'Согласовывала рабочие активности с коллегами по требованиям роли.',
        ]
        : [
          'Выполнял повседневные рабочие задачи роли по назначению.',
          'Завершал рабочие задачи согласно требованиям роли.',
          'Согласовывал рабочие активности с коллегами по требованиям роли.',
        ]);
  }

  if (locale === 'pt-BR') {
    return formatExperienceBullets(present
      ? [
        `Executa tarefas diárias relacionadas a ${groundedWork} conforme atribuído.`,
        'Conclui tarefas atribuídas de acordo com as necessidades da função.',
        'Coordena atividades de trabalho com colegas.',
      ]
      : [
        `Executava tarefas diárias relacionadas a ${groundedWork} conforme atribuído.`,
        'Concluía tarefas atribuídas de acordo com as necessidades da função.',
        'Coordenava atividades de trabalho com colegas.',
      ]);
  }

  // Final layer: always three useful English CV bullets (never empty / never tautological).
  return formatExperienceBullets([
    ...buildEnglishActionDutyTriple(options.position || '', present),
  ]);
}
