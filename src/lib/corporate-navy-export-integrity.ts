/**
 * Corporate Navy export locale integrity.
 * Per-field locale validation — never reuse another locale's bullets for Hindi.
 */
import type { CVData } from './types';
import type { Locale } from './i18n/translations';
import { detectContentLocale } from './cv-canonical-snapshot';
import {
  buildFactSetFromExperienceDescription,
  bulletsForExperience,
  formatExperienceBullets,
  splitExperienceBullets,
} from './cv-canonical-facts';
import { localizeCvLanguageLevel } from './cv-language-levels';
import { getLocalizedCvLanguageName } from './cv-language-options';
import { getLocalizedCvSkillName } from './cv-skill-options';
import { normalizeCoverLetterGender } from './cover-letter-gender';
import { buildExperienceDurationSnapshot, type ExperienceDurationSnapshot } from './cv-experience-duration';
import { applyCvContentQuality } from './cv-content-quality';
import {
  buildLocalizedSummaryProvenance,
  validateFinalLocalizedCvFields,
  type LocalizedSummaryProvenance,
} from './cv-field-locale-integrity';
import { deterministicLocalizedBulletsFromCanonical } from './cv-localized-fallback';
import { validateLocalizedExperienceBullets } from './cv-semantic-fidelity';
import { resolveCanonicalExperienceDescription } from './cv-export-integrity';
import { normalizeLegacyCvRuntime } from './cv-legacy-runtime-migration';

export type CorporateNavySecurityCategory =
  | 'premises_access_monitoring'
  | 'incident_emergency_response'
  | 'patrols_inspections'
  | 'incident_logs_reporting'
  | 'generic';

export type CnFactLocaleProvenance = {
  factId: string;
  requestedLocale: Locale;
  sourceLocale: Locale | null;
  localizedLocale: Locale | null;
  localizedText: string;
};

export type CorporateNavyExportProjection = {
  projectionId: string;
  requestedLocale: Locale;
  canonicalLocale: Locale | null;
  canonicalRevision: number;
  canonicalSourceHash: string;
  localizedSummary: string;
  localizedSummaryProvenance: LocalizedSummaryProvenance;
  localizedExperiences: Array<{
    experienceId: string;
    role: string;
    company: string;
    bullets: Array<{
      factId: string;
      semanticCategory: CorporateNavySecurityCategory;
      localizedText: string;
      order: number;
      provenance: CnFactLocaleProvenance;
    }>;
  }>;
  localizedLanguageLevels: Array<{ name: string; level: string }>;
  localizedEducation: CVData['education'];
  localizedSkills: string[];
  validationStatus: 'passed' | 'fallback' | 'repaired';
  experienceDurationSnapshot?: ExperienceDurationSnapshot;
  gender?: string;
};

export type CorporateNavyExportDiagnostics = {
  initialRecoveryReasons: string[];
  recoverySource: 'saved_localized_bullets' | 'security_fallback' | 'deterministic_authoritative_facts';
};

export class CorporateNavyLocaleExportError extends Error {
  readonly locale: Locale;
  readonly reason: string;

  constructor(locale: Locale, reason: string) {
    super(`Corporate Navy export blocked for locale=${locale}: ${reason}`);
    this.name = 'CorporateNavyLocaleExportError';
    this.locale = locale;
    this.reason = reason;
  }
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function classifySecurityDutyCategory(text: string): CorporateNavySecurityCategory {
  const t = (text || '').toLowerCase().normalize('NFKC');
  // Order matters: logs/reporting before bare "incident", patrols before generic security.
  if (
    /(incident\s*logs?|evidenc\w*\s+o\s+incident|report(?:ed|ing)?\s+to\s+security|bezbednosn\w*\s+menad|ঘটনা|घटना\s*लॉग|इवेंट\s*लॉग)/iu.test(t)
    || (/(logs?|evidenc|извешт|रिपोर्टिंग|रिपोर्ट)/iu.test(t) && /(incident|घटना)/iu.test(t))
  ) {
    return 'incident_logs_reporting';
  }
  if (/(patrol|inspection|obilask|obilaz|inspekcij|निरीक्षण|गश्त)/iu.test(t)) {
    return 'patrols_inspections';
  }
  if (
    /(emergency|hitn|reagov|respond(?:ed|ing)?|incident\s+response|आपातकाल|प्रतिक्रिया)/iu.test(t)
  ) {
    return 'incident_emergency_response';
  }
  if (
    /(premis|access[- ]?point|monitor|nadgled|pristupn|प्रवेश|परिसर|निगरानी)/iu.test(t)
  ) {
    return 'premises_access_monitoring';
  }
  return 'generic';
}

const HI_SECURITY_FALLBACK: Record<Exclude<CorporateNavySecurityCategory, 'generic'>, (male: boolean) => string> = {
  premises_access_monitoring: (male) =>
    male
      ? 'परिसर और प्रवेश बिंदुओं की नियमित निगरानी की तथा अनधिकृत पहुँच को रोका।'
      : 'परिसर और प्रवेश बिंदुओं की नियमित निगरानी की तथा अनधिकृत पहुँच को रोका।',
  incident_emergency_response: (male) =>
    male
      ? 'घटनाओं और आपात स्थितियों पर शीघ्र प्रतिक्रिया दी तथा सुरक्षा प्रोटोकॉल का पालन किया।'
      : 'घटनाओं और आपात स्थितियों पर शीघ्र प्रतिक्रिया दी तथा सुरक्षा प्रोटोकॉल का पालन किया।',
  patrols_inspections: (male) =>
    male
      ? 'नियमित गश्त और निरीक्षण किए ताकि सुरक्षा मानकों का अनुपालन सुनिश्चित हो।'
      : 'नियमित गश्त और निरीक्षण किए ताकि सुरक्षा मानकों का अनुपालन सुनिश्चित हो।',
  incident_logs_reporting: (male) =>
    male
      ? 'घटना लॉग बनाए रखे और सुरक्षा प्रबंधन को स्पष्ट रिपोर्टिंग की।'
      : 'घटना लॉग बनाए रखे और सुरक्षा प्रबंधन को स्पष्ट रिपोर्टिंग की।',
};

const SR_SECURITY_FALLBACK: Record<Exclude<CorporateNavySecurityCategory, 'generic'>, (male: boolean) => string> = {
  premises_access_monitoring: (male) =>
    male
      ? 'Nadgledao sam prostorije i pristupne tačke radi sprečavanja neovlašćenog pristupa.'
      : 'Nadgledala sam prostorije i pristupne tačke radi sprečavanja neovlašćenog pristupa.',
  incident_emergency_response: (male) =>
    male
      ? 'Reagovao sam na incidente i hitne situacije u skladu sa bezbednosnim protokolima.'
      : 'Reagovala sam na incidente i hitne situacije u skladu sa bezbednosnim protokolima.',
  patrols_inspections: (male) =>
    male
      ? 'Obavljao sam redovne obilaske i inspekcije radi poštovanja standarda bezbednosti.'
      : 'Obavljala sam redovne obilaske i inspekcije radi poštovanja standarda bezbednosti.',
  incident_logs_reporting: (male) =>
    male
      ? 'Vodio sam evidenciju o incidentima i izveštavao bezbednosni menadžment.'
      : 'Vodila sam evidenciju o incidentima i izveštavala bezbednosni menadžment.',
};

const EN_SECURITY_FALLBACK: Record<Exclude<CorporateNavySecurityCategory, 'generic'>, () => string> = {
  premises_access_monitoring: () =>
    'Monitored premises and access points to prevent unauthorized entry.',
  incident_emergency_response: () =>
    'Responded to incidents and emergencies according to security protocols.',
  patrols_inspections: () =>
    'Conducted regular patrols and inspections to uphold security standards.',
  incident_logs_reporting: () =>
    'Maintained incident logs and reported clearly to security management.',
};

export function textMatchesRequestedLocale(text: string, locale: Locale): boolean {
  const raw = (text || '').trim();
  if (!raw) return true;
  if (locale === 'hi') return /[\u0900-\u097F]/.test(raw) && !/[čćžšđ]/iu.test(raw);
  if (locale === 'ar') return /[\u0600-\u06FF]/.test(raw);
  if (locale === 'ja') return /[\u3040-\u30ff\u3400-\u9fff]/.test(raw);
  if (locale === 'ru') return /[\u0400-\u04FF]/.test(raw);
  if (locale === 'sr' || locale === 'hr') {
    // Reject Devanagari / Cyrillic / Arabic as non-matching for Latin SR/HR.
    if (/[\u0900-\u097F\u0600-\u06FF\u0400-\u04FF]/.test(raw)) return false;
    return true;
  }
  if (locale === 'en') {
    if (/[\u0900-\u097F\u0600-\u06FF\u0400-\u04FF]/.test(raw)) return false;
    return true;
  }
  // Other Latin locales: must not be Devanagari/Cyrillic/Arabic.
  if (/[\u0900-\u097F\u0600-\u06FF\u0400-\u04FF]/.test(raw)) return false;
  return true;
}

function containsSerbianLatin(text: string): boolean {
  return /[čćžšđ]/iu.test(text)
    || /\b(nadgledao|reagovao|obavljao|vodio|prostorij|pristupn|incident|bezbednos)/iu.test(text);
}

export function localizedSecurityBullet(
  category: CorporateNavySecurityCategory,
  locale: Locale,
  gender?: string,
): string | null {
  if (category === 'generic') return null;
  const male = normalizeCoverLetterGender(gender) !== 'female';
  if (locale === 'hi') return HI_SECURITY_FALLBACK[category](male);
  if (locale === 'sr') return SR_SECURITY_FALLBACK[category](male);
  if (locale === 'en') return EN_SECURITY_FALLBACK[category]();
  return null;
}

function resolveBulletForLocale(
  sourceText: string,
  locale: Locale,
  gender: string | undefined,
  factId: string,
): { text: string; category: CorporateNavySecurityCategory; provenance: CnFactLocaleProvenance; usedFallback: boolean } {
  const category = classifySecurityDutyCategory(sourceText);
  const sourceLocale = detectContentLocale(sourceText);
  if (textMatchesRequestedLocale(sourceText, locale)) {
    // Explicit rejection: Hindi export must never keep Serbian Latin bullets.
    if (locale === 'hi' && containsSerbianLatin(sourceText)) {
      // fall through to Hindi fallback
    } else {
      return {
        text: sourceText,
        category,
        usedFallback: false,
        provenance: {
          factId,
          requestedLocale: locale,
          sourceLocale,
          localizedLocale: locale,
          localizedText: sourceText,
        },
      };
    }
  }

  const fallback = localizedSecurityBullet(category, locale, gender);
  if (!fallback || !textMatchesRequestedLocale(fallback, locale)) {
    throw new CorporateNavyLocaleExportError(
      locale,
      `mixed_locale_projection: fact ${factId} could not be localized to ${locale}`,
    );
  }
  if (locale === 'hi' && containsSerbianLatin(fallback)) {
    throw new CorporateNavyLocaleExportError(
      locale,
      `mixed_locale_projection: Hindi fallback for ${factId} contained Serbian text`,
    );
  }
  return {
    text: fallback,
    category,
    usedFallback: true,
    provenance: {
      factId,
      requestedLocale: locale,
      sourceLocale,
      localizedLocale: locale,
      localizedText: fallback,
    },
  };
}

/**
 * Prepare one validated Corporate Navy projection for PDF and DOCX.
 * Never reuses Serbian (or other) projection text for a Hindi export.
 */
export function prepareCorporateNavyExport(
  cv: CVData,
  locale: Locale,
  options?: {
    gender?: string;
    referenceDate?: Date | string;
    durationSnapshot?: ExperienceDurationSnapshot;
  },
): {
  cv: CVData;
  projection: CorporateNavyExportProjection;
  diagnostics: CorporateNavyExportDiagnostics;
} {
  cv = normalizeLegacyCvRuntime(cv, locale);
  const gender = options?.gender || cv.personal?.gender || '';
  const sharedDuration = options?.durationSnapshot
    || buildExperienceDurationSnapshot(cv.experience || [], options?.referenceDate ?? new Date());
  let usedFallback = false;
  const initialRecoveryReasons: string[] = [];
  let recoverySource: CorporateNavyExportDiagnostics['recoverySource'] = 'saved_localized_bullets';

  if (locale === 'hi' && cv.summary && !textMatchesRequestedLocale(cv.summary, 'hi')) {
    throw new CorporateNavyLocaleExportError(
      locale,
      'mixed_locale_projection: summary is not Hindi',
    );
  }
  if (locale === 'hi' && cv.summary && containsSerbianLatin(cv.summary)) {
    throw new CorporateNavyLocaleExportError(
      locale,
      'mixed_locale_projection: summary contains Serbian Latin',
    );
  }

  const experiences = (cv.experience || []).map((exp, experienceIndex) => {
    const sourceDesc = resolveCanonicalExperienceDescription(exp);
    const sourceBullets = splitExperienceBullets(sourceDesc);
    let localizedBullets: CorporateNavyExportProjection['localizedExperiences'][number]['bullets'];
    try {
      localizedBullets = sourceBullets.map((sourceText, order) => {
        const factId = `experience-${experienceIndex}-bullet-${order}`;
        const resolved = resolveBulletForLocale(sourceText, locale, gender, factId);
        if (resolved.usedFallback) {
          usedFallback = true;
          recoverySource = 'security_fallback';
        }
        return {
          factId,
          semanticCategory: resolved.category,
          localizedText: resolved.text,
          order,
          provenance: resolved.provenance,
        };
      });
    } catch (err) {
      initialRecoveryReasons.push(
        err && typeof err === 'object' && 'reason' in err
          ? String((err as { reason?: string }).reason || '')
          : err instanceof Error
            ? err.message
            : 'unknown_recovery_failure',
      );
      // Corporate Navy is a visual template, not a security-only occupation.
      // Legacy Baker/logistics/etc. facts must use the shared grounded fallback
      // instead of being rejected by the security-category table.
      const factSet = buildFactSetFromExperienceDescription(sourceDesc, {
        experienceIndex,
        company: exp.company,
        position: exp.position,
        startDate: exp.startDate,
        endDate: exp.endDate,
        isPresent: exp.isPresent,
      });
      const facts = bulletsForExperience(factSet, experienceIndex);
      const generalFallback = deterministicLocalizedBulletsFromCanonical(
        facts,
        locale,
        gender,
        { isPresent: Boolean(exp.isPresent) },
      );
      const validation = validateLocalizedExperienceBullets(generalFallback, factSet, {
        locale,
        gender,
        experienceIndex,
        stage: 'export',
        isPresent: exp.isPresent,
      });
      if (!generalFallback || !validation.valid) throw err;
      usedFallback = true;
      recoverySource = 'deterministic_authoritative_facts';
      localizedBullets = splitExperienceBullets(generalFallback).map((localizedText, order) => ({
        factId: facts[order]?.id || `experience-${experienceIndex}-bullet-${order}`,
        semanticCategory: classifySecurityDutyCategory(sourceBullets[order] || ''),
        localizedText,
        order,
        provenance: {
          factId: facts[order]?.id || `experience-${experienceIndex}-bullet-${order}`,
          requestedLocale: locale,
          sourceLocale: detectContentLocale(sourceBullets[order] || sourceDesc),
          localizedLocale: detectContentLocale(localizedText),
          localizedText,
        },
      }));
    }

    // Per-field: Hindi projection cannot mix Serbian bullets with a Hindi summary.
    if (locale === 'hi') {
      for (const b of localizedBullets) {
        if (!textMatchesRequestedLocale(b.localizedText, 'hi') || containsSerbianLatin(b.localizedText)) {
          throw new CorporateNavyLocaleExportError(
            locale,
            `mixed_locale_projection: ${b.factId} is not valid Hindi`,
          );
        }
      }
    }

    return {
      experienceId: exp.id,
      role: exp.position || '',
      company: exp.company || '',
      bullets: localizedBullets,
      startDate: exp.startDate,
      endDate: exp.endDate,
      isPresent: exp.isPresent,
      canonicalDescription: exp.canonicalDescription || sourceDesc,
    };
  });

  const languageLevels = (cv.languages || []).map((lang) => ({
    name: getLocalizedCvLanguageName(lang.name, locale) || lang.name,
    level: localizeCvLanguageLevel(lang.level, locale),
  }));

  let nextCv: CVData = {
    ...cv,
    experience: (cv.experience || []).map((exp, idx) => {
      const localized = experiences[idx];
      if (!localized) return exp;
      return {
        ...exp,
        description: formatExperienceBullets(localized.bullets.map((b) => b.localizedText), '- '),
        canonicalDescription: localized.canonicalDescription,
      };
    }),
    languages: (cv.languages || []).map((lang, i) => ({
      name: lang.name,
      level: languageLevels[i]?.level || lang.level,
    })),
    skills: (cv.skills || []).map((s) => getLocalizedCvSkillName(s, locale)),
  };

  const quality = applyCvContentQuality(nextCv, locale, {
    gender,
    durationSnapshot: sharedDuration,
    referenceDate: options?.referenceDate || sharedDuration.referenceDateIso,
    summaryOrigin: nextCv.summaryOrigin,
  });
  nextCv = quality.cv;
  const finalLocaleCheck = validateFinalLocalizedCvFields(nextCv, locale);
  if (!finalLocaleCheck.valid) {
    const first = finalLocaleCheck.violations[0];
    throw new CorporateNavyLocaleExportError(
      locale,
      `${first.kind}: ${first.path} does not match requested locale ${locale}`,
    );
  }

  const qualityExperiences = experiences.map((e) => {
    const qExp = nextCv.experience.find((x) => x.id === e.experienceId);
    if (!qExp) return e;
    const qBullets = splitExperienceBullets(qExp.description || '');
    return {
      ...e,
      bullets: e.bullets.map((b, i) => ({
        ...b,
        localizedText: qBullets[i] || b.localizedText,
      })),
    };
  });

  const projectionBase = {
    requestedLocale: locale,
    canonicalLocale: cv.canonicalSnapshot?.canonicalLocale ?? detectContentLocale(
      [cv.canonicalSummary || cv.summary, ...experiences.map((e) => e.canonicalDescription)].join('\n'),
    ) ?? locale,
    canonicalRevision: cv.canonicalSnapshot?.canonicalRevision ?? 0,
    canonicalSourceHash: cv.canonicalSnapshot?.canonicalSourceHash ?? '',
    localizedSummary: nextCv.summary || '',
    localizedSummaryProvenance: buildLocalizedSummaryProvenance({
      requestedLocale: locale,
      canonicalLocale: cv.canonicalSnapshot?.canonicalLocale ?? locale,
      canonicalRevision: cv.canonicalSnapshot?.canonicalRevision ?? 0,
      canonicalSourceHash: cv.canonicalSnapshot?.canonicalSourceHash ?? '',
      origin: nextCv.summaryOrigin,
    }),
    localizedExperiences: qualityExperiences.map((e) => ({
      experienceId: e.experienceId,
      role: nextCv.experience.find((x) => x.id === e.experienceId)?.position || e.role,
      company: e.company,
      bullets: e.bullets,
    })),
    localizedLanguageLevels: nextCv.languages || languageLevels,
    localizedEducation: nextCv.education || [],
    localizedSkills: nextCv.skills || [],
    validationStatus: (usedFallback
      ? 'fallback'
      : quality.repaired
        ? 'repaired'
        : 'passed') as 'passed' | 'fallback' | 'repaired',
    experienceDurationSnapshot: quality.durationSnapshot,
    gender,
  };

  const projection: CorporateNavyExportProjection = {
    ...projectionBase,
    projectionId: `cn-proj-${fnv1aHex(JSON.stringify(projectionBase))}`,
  };

  return {
    cv: nextCv,
    projection,
    diagnostics: {
      initialRecoveryReasons,
      recoverySource,
    },
  };
}
