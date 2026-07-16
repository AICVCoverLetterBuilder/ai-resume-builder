/**
 * Shared CV content-quality fixes (duration, tense, natural wording).
 * Applied in the content/localization pipeline — not in template layouts.
 */
import type { CVData, CvSummaryOrigin, WorkExperience } from './types';
import type { Locale } from './i18n/translations';
import { formatExperienceBullets, splitExperienceBullets, buildCvCanonicalFactSet, classifyDutyCategory } from './cv-canonical-facts';
import {
  buildExperienceDurationSnapshot,
  formatApproximateDurationPhrase,
  repairSummaryDuration,
  summaryHasDurationClaim,
  summaryIncludesDurationPhrase,
  yearWordForLocale,
  type ExperienceDuration,
  type ExperienceDurationSnapshot,
  validateSummaryDuration,
} from './cv-experience-duration';
import { normalizeCoverLetterGender } from './cover-letter-gender';
import {
  hasMisplacedHindiDuration,
  isDurationOnlyFragmentSentence,
  UNSUPPORTED_SUMMARY_FLUFF,
  validateLocalizedSummary,
  validateSummaryCompleteness,
} from './cv-semantic-fidelity';
import {
  localizeOccupationalTitleForProjection,
  resolveOccupationalTitleForSummary,
} from './cv-role-title';
import { deduplicateSkillsForExport } from './cv-skills-projection';
import { localizeCvLanguageLevel } from './cv-language-levels';
import { getLocalizedCvLanguageName } from './cv-language-options';
import { deterministicLocalizedSummaryFromCanonical, localizeCanonicalBulletLine } from './cv-localized-fallback';

/** Structured context used to build a natural, non-fragment duration sentence. */
export type DurationIntegrationContext = {
  role?: string;
  company?: string;
  startDate?: string;
  gender?: string;
};

export type ContactCenterMeaning =
  | 'phone_inquiries'
  | 'complaint_issue_resolution'
  | 'cross_team_coordination'
  | 'interaction_logging'
  | null;

/** True when the summary authoring path must carry the shared duration claim. */
export function summaryOriginRequiresDuration(origin?: CvSummaryOrigin | null): boolean {
  return origin === 'ai_generated'
    || origin === 'ai_repaired'
    || origin === 'deterministic_fallback';
}

/** Strip invented fluff / outcome guarantees (Serbian enrichment, Hindi satisfaction). */
export function stripUnsupportedSummaryFluff(text: string, locale: Locale): string {
  let out = text || '';
  for (const row of UNSUPPORTED_SUMMARY_FLUFF) {
    if (row.locale && row.locale !== locale) continue;
    out = out.replace(row.re, ' ');
  }
  return out.replace(/\s+/g, ' ').replace(/\s+([.।!?])/gu, '$1').trim();
}

/** Classify a source (canonical) bullet into contact-center meanings without changing fact categories. */
export function classifyContactCenterMeaning(sourceText: string): ContactCenterMeaning {
  const t = (sourceText || '').toLowerCase().normalize('NFKC');
  if (
    /(phone|telefon|फ़ोन|फोन)/iu.test(t)
    && /(inquir|query|question|upit|प्रश्न|प्रश्)/iu.test(t)
  ) {
    return 'phone_inquiries';
  }
  if (
    /(complaint|reclamation|reklamacij|शिकायत|reclam)/iu.test(t)
    || (/(issue|problem|žel|жалоб|समस्या)/iu.test(t) && /(resolv|rešav|समाधान|handle|deal)/iu.test(t))
  ) {
    return 'complaint_issue_resolution';
  }
  if (
    /(collaborat|coordinate|sarađ|सहयोग|team|tim)/iu.test(t)
    && /(request|zahtev|अनुरोध|escalat|prosleđ|आगे)/iu.test(t)
  ) {
    return 'cross_team_coordination';
  }
  if (
    /(record|evidenc|रिकॉर्ड|log|track|प्रणाली|sistem)/iu.test(t)
    && /(conversation|razgovor|वार्तालाप|data|podatk|डेटा)/iu.test(t)
  ) {
    return 'interaction_logging';
  }
  return null;
}

function contactCenterBullet(
  meaning: Exclude<ContactCenterMeaning, null>,
  locale: Locale,
  isPresent: boolean,
  gender?: string,
): string | null {
  const female = normalizeCoverLetterGender(gender) === 'female';
  if (locale === 'hi') {
    if (!isPresent) {
      // Past-role style (imperfective past) — only when not current.
      const past: Record<Exclude<ContactCenterMeaning, null>, string> = {
        phone_inquiries:
          'फ़ोन के माध्यम से ग्राहकों के प्रश्नों का उत्तर देती थी और सेवाओं के बारे में सटीक तथा समय पर जानकारी प्रदान करती थी।',
        complaint_issue_resolution:
          'आंतरिक प्रक्रियाओं और गुणवत्ता मानकों के अनुसार ग्राहकों की शिकायतों और समस्याओं का समाधान करती थी।',
        cross_team_coordination:
          'ग्राहकों के अनुरोधों को प्रभावी ढंग से आगे बढ़ाने और हल करने के लिए अन्य टीमों के साथ सहयोग करती थी।',
        interaction_logging:
          'किए गए वार्तालापों का रिकॉर्ड रखती थी और ग्राहक ट्रैकिंग प्रणाली में संबंधित डेटा दर्ज करती थी।',
      };
      const malePast: Record<Exclude<ContactCenterMeaning, null>, string> = {
        phone_inquiries:
          'फ़ोन के माध्यम से ग्राहकों के प्रश्नों का उत्तर देता था और सेवाओं के बारे में सटीक तथा समय पर जानकारी प्रदान करता था।',
        complaint_issue_resolution:
          'आंतरिक प्रक्रियाओं और गुणवत्ता मानकों के अनुसार ग्राहकों की शिकायतों और समस्याओं का समाधान करता था।',
        cross_team_coordination:
          'ग्राहकों के अनुरोधों को प्रभावी ढंग से आगे बढ़ाने और हल करने के लिए अन्य टीमों के साथ सहयोग करता था।',
        interaction_logging:
          'किए गए वार्तालापों का रिकॉर्ड रखता था और ग्राहक ट्रैकिंग प्रणाली में संबंधित डेटा दर्ज करता था।',
      };
      return female ? past[meaning] : malePast[meaning];
    }
    const present: Record<Exclude<ContactCenterMeaning, null>, string> = {
      phone_inquiries:
        'फ़ोन के माध्यम से ग्राहकों के प्रश्नों का उत्तर देती हूँ और सेवाओं के बारे में सटीक तथा समय पर जानकारी प्रदान करती हूँ।',
      complaint_issue_resolution:
        'आंतरिक प्रक्रियाओं और गुणवत्ता मानकों के अनुसार ग्राहकों की शिकायतों और समस्याओं का समाधान करती हूँ।',
      cross_team_coordination:
        'ग्राहकों के अनुरोधों को प्रभावी ढंग से आगे बढ़ाने और हल करने के लिए अन्य टीमों के साथ सहयोग करती हूँ।',
      interaction_logging:
        'किए गए वार्तालापों का रिकॉर्ड रखती हूँ और ग्राहक ट्रैकिंग प्रणाली में संबंधित डेटा दर्ज करती हूँ।',
    };
    const malePresent: Record<Exclude<ContactCenterMeaning, null>, string> = {
      phone_inquiries:
        'फ़ोन के माध्यम से ग्राहकों के प्रश्नों का उत्तर देता हूँ और सेवाओं के बारे में सटीक तथा समय पर जानकारी प्रदान करता हूँ।',
      complaint_issue_resolution:
        'आंतरिक प्रक्रियाओं और गुणवत्ता मानकों के अनुसार ग्राहकों की शिकायतों और समस्याओं का समाधान करता हूँ।',
      cross_team_coordination:
        'ग्राहकों के अनुरोधों को प्रभावी ढंग से आगे बढ़ाने और हल करने के लिए अन्य टीमों के साथ सहयोग करता हूँ।',
      interaction_logging:
        'किए गए वार्तालापों का रिकॉर्ड रखता हूँ और ग्राहक ट्रैकिंग प्रणाली में संबंधित डेटा दर्ज करता हूँ।',
    };
    return female ? present[meaning] : malePresent[meaning];
  }
  if (locale === 'sr' || locale === 'hr') {
    if (!isPresent) {
      return female
        ? ({
          phone_inquiries:
            'Odgovarala sam na upite klijenata putem telefona i pružala tačne i pravovremene informacije o uslugama.',
          complaint_issue_resolution:
            'Rešavala sam reklamacije i žalbe klijenata uz poštovanje internih procedura i standarda kvaliteta.',
          cross_team_coordination:
            'Sarađivala sam sa drugim timovima kako bi zahtevi klijenata bili efikasno prosleđeni i rešeni.',
          interaction_logging:
            'Vodila sam evidenciju o obavljenim razgovorima i unosila relevantne podatke u sistem za praćenje klijenata.',
        } as const)[meaning]
        : ({
          phone_inquiries:
            'Odgovarao sam na upite klijenata putem telefona i pružao tačne i pravovremene informacije o uslugama.',
          complaint_issue_resolution:
            'Rešavao sam reklamacije i žalbe klijenata uz poštovanje internih procedura i standarda kvaliteta.',
          cross_team_coordination:
            'Sarađivao sam sa drugim timovima kako bi zahtevi klijenata bili efikasno prosleđeni i rešeni.',
          interaction_logging:
            'Vodio sam evidenciju o obavljenim razgovorima i unosio relevantne podatke u sistem za praćenje klijenata.',
        } as const)[meaning];
    }
    // Present-tense CV style for ongoing roles (gender-neutral finite forms).
    return ({
      phone_inquiries:
        'Odgovaram na upite klijenata putem telefona i pružam tačne i pravovremene informacije o uslugama.',
      complaint_issue_resolution:
        'Rešavam reklamacije i žalbe klijenata uz poštovanje internih procedura i standarda kvaliteta.',
      cross_team_coordination:
        'Sarađujem sa drugim timovima kako bi zahtevi klijenata bili efikasno prosleđeni i rešeni.',
      interaction_logging:
        'Vodim evidenciju o obavljenim razgovorima i unosim relevantne podatke u sistem za praćenje klijenata.',
    } as const)[meaning];
  }
  return null;
}

/** Strip unnatural Hindi loanwords (never invent a legal “claim” sense). */
export function normalizeHindiCustomerServiceWording(text: string): string {
  let out = text || '';
  out = out.replace(/रिक्लेमेशन/gu, 'समस्याओं');
  out = out.replace(/शिकायतों और समस्याओंओं/gu, 'शिकायतों और समस्याओं');
  out = out.replace(/शिकायतों\s+और\s+समस्याओं/gu, 'शिकायतों और समस्याओं');
  // Customer-service complaint/problem pairing — not a global आपत्ति ban.
  if (/शिकायत/u.test(out)) {
    out = out.replace(/शिकायतों\s+और\s+आपत्तियों/gu, 'शिकायतों और समस्याओं');
  }
  // Natural plural for "skills" — "कौशलताओं" is an awkward double-plural.
  out = out.replace(/कौशलताओं/gu, 'कौशलों');
  return out;
}

/** Natural Serbian role phrase for running prose — never touches the dedicated role/title field. */
export function normalizeSerbianRolePhrase(text: string): string {
  let out = text || '';
  out = out.replace(
    /\b(Iskusna|Iskusan)\s+Call\s*centar\s+(agentkinja|agent)\b/giu,
    (_m, adj: string, noun: string) => `${adj} ${noun} call centra`,
  );
  out = out.replace(
    /\bCall\s*centar\s+(agentkinja|agent)\b/giu,
    (_m, noun: string) => `${noun} call centra`,
  );
  return out;
}

/** Serbian feminine team-member agreement in summary prose (female gender only). */
export function applySerbianFemaleAgreement(text: string, gender?: string): string {
  if (normalizeCoverLetterGender(gender) !== 'female') return text || '';
  let out = text || '';
  const pairs: Array<[RegExp, string]> = [
    [/što\s+je\s+čini\s+vrednim\s+članom/giu, 'što je čini vrednom članicom'],
    [/čini\s+je\s+vrednim\s+članom/giu, 'čini je vrednom članicom'],
    [/čini\s+vrednim\s+članom/giu, 'čini vrednom članicom'],
    [/čini\s+je\s+pouzdanim\s+članom/giu, 'čini je pouzdanom članicom'],
    [/čini\s+pouzdanim\s+članom/giu, 'čini pouzdanom članicom'],
    [/čini\s+je\s+važnim\s+članom/giu, 'čini je važnom članicom'],
    [/čini\s+važnim\s+članom/giu, 'čini važnom članicom'],
  ];
  for (const [re, repl] of pairs) out = out.replace(re, repl);
  return out;
}

/** Serbian present-tense summary verbs for an ongoing (current) role — mirrors bullet-level tense fix. */
export function applySerbianSummaryCurrentTense(text: string, isCurrentRole: boolean): string {
  if (!isCurrentRole) return text || '';
  let out = text || '';
  const pairs: Array<[RegExp, string]> = [
    [/\bodgovarala je\b/giu, 'odgovara'],
    [/\bodgovarao je\b/giu, 'odgovara'],
    [/\brešavala je\b/giu, 'rešava'],
    [/\brešavao je\b/giu, 'rešava'],
    [/\bsarađivala je\b/giu, 'sarađuje'],
    [/\bsarađivao je\b/giu, 'sarađuje'],
    [/\bvodila je\b/giu, 'vodi'],
    [/\bvodio je\b/giu, 'vodi'],
    [/\bpružala je\b/giu, 'pruža'],
    [/\bpružao je\b/giu, 'pruža'],
    [/\bpružala\b/giu, 'pruža'],
    [/\bpružao\b/giu, 'pruža'],
    [/\bunosila\b/giu, 'unosi'],
    [/\bunosio\b/giu, 'unosi'],
    [/\bodgovarala sam\b/giu, 'odgovaram'],
    [/\bodgovarao sam\b/giu, 'odgovaram'],
    [/\brešavala sam\b/giu, 'rešavam'],
    [/\brešavao sam\b/giu, 'rešavam'],
  ];
  for (const [re, repl] of pairs) out = out.replace(re, repl);
  return out;
}

/** Hindi present-habitual for ongoing roles; strip habitual past. */
export function applyHindiCurrentRoleTense(text: string): string {
  return (text || '')
    .replace(/देती थी/gu, 'देती हूँ')
    .replace(/देता था/gu, 'देता हूँ')
    .replace(/करती थी/gu, 'करती हूँ')
    .replace(/करता था/gu, 'करता हूँ')
    .replace(/रखती थी/gu, 'रखती हूँ')
    .replace(/रखता था/gu, 'रखता हूँ')
    .replace(/दर्ज करती थी/gu, 'दर्ज करती हूँ')
    .replace(/दर्ज करता था/gu, 'दर्ज करता हूँ')
    .replace(/प्रदान करती थी/gu, 'प्रदान करती हूँ')
    .replace(/प्रदान करता था/gu, 'प्रदान करता हूँ')
    .replace(/सहयोग करती थी/gu, 'सहयोग करती हूँ')
    .replace(/सहयोग करता था/gu, 'सहयोग करता हूँ');
}

/** Serbian present-tense CV verbs for ongoing roles. */
export function applySerbianCurrentRoleTense(text: string): string {
  let out = text || '';
  const pairs: Array<[RegExp, string]> = [
    [/\bOdgovarala sam\b/gu, 'Odgovaram'],
    [/\bOdgovarao sam\b/gu, 'Odgovaram'],
    [/\bRešavala sam\b/gu, 'Rešavam'],
    [/\bRešavao sam\b/gu, 'Rešavam'],
    [/\bSarađivala sam\b/gu, 'Sarađujem'],
    [/\bSarađivao sam\b/gu, 'Sarađujem'],
    [/\bVodila sam\b/gu, 'Vodim'],
    [/\bVodio sam\b/gu, 'Vodim'],
    [/\bRadila sam\b/gu, 'Radim'],
    [/\bRadio sam\b/gu, 'Radim'],
    [/\bAnalizirala sam\b/gu, 'Analiziram'],
    [/\bAnalizirao sam\b/gu, 'Analiziram'],
    [/\bUčestvovala sam\b/gu, 'Učestvujem'],
    [/\bUčestvovao sam\b/gu, 'Učestvujem'],
    [/\bKreirala sam\b/gu, 'Kreiram'],
    [/\bKreirao sam\b/gu, 'Kreiram'],
    [/\bIzrađivala sam\b/gu, 'Izrađujem'],
    [/\bIzrađivao sam\b/gu, 'Izrađujem'],
    [/\bPratila sam\b/gu, 'Pratim'],
    [/\bPratio sam\b/gu, 'Pratim'],
    [/\bpružala\b/gu, 'pružam'],
    [/\bpružao\b/gu, 'pružam'],
    [/\bunosila\b/gu, 'unosim'],
    [/\bunosio\b/gu, 'unosim'],
  ];
  for (const [re, repl] of pairs) out = out.replace(re, repl);
  return out;
}

/** Hindi present-progressive for ongoing production/process roles. */
export function applyProductionHindiPresentTense(text: string, gender?: string): string {
  const g = normalizeCoverLetterGender(gender);
  const female = g !== 'male';
  let out = text || '';
  const pairs: Array<[RegExp, string]> = female
    ? [
      [/काम करती थी/gu, 'काम कर रही हूँ'],
      [/सहयोग करती थी/gu, 'सहयोग कर रही हूँ'],
      [/विश्लेषण करती थी/gu, 'विश्लेषण कर रही हूँ'],
      [/तैयार करती थी/gu, 'तैयार कर रही हूँ'],
      [/भाग लेती थी/gu, 'भाग ले रही हूँ'],
      [/योजना बनाती थी/gu, 'योजना बना रही हूँ'],
    ]
    : [
      [/काम करता था/gu, 'काम कर रहा हूँ'],
      [/सहयोग करता था/gu, 'सहयोग कर रहा हूँ'],
      [/विश्लेषण करता था/gu, 'विश्लेषण कर रहा हूँ'],
      [/तैयार करता था/gu, 'तैयार कर रहा हूँ'],
      [/भाग लेता था/gu, 'भाग ले रहा हूँ'],
      [/योजना बनाता था/gu, 'योजना बना रहा हूँ'],
    ];
  for (const [re, repl] of pairs) out = out.replace(re, repl);
  return out;
}

export function normalizeExperienceBulletsForQuality(
  exp: WorkExperience,
  locale: Locale,
  gender?: string,
): { description: string; changed: boolean } {
  const source = (exp.canonicalDescription || exp.description || '').trim();
  const sourceBullets = splitExperienceBullets(source);
  const locBullets = splitExperienceBullets(exp.description || '');
  const isPresent = Boolean(exp.isPresent);
  let changed = false;
  const next = sourceBullets.map((sourceText, i) => {
    let text = (locBullets[i] || sourceText).trim();
    const meaning = classifyContactCenterMeaning(sourceText);
    if (meaning && (locale === 'hi' || locale === 'sr' || locale === 'hr')) {
      const preferred = contactCenterBullet(meaning, locale, isPresent, gender);
      if (preferred) {
        if (preferred !== text) changed = true;
        return preferred;
      }
    }
    if (
      classifyDutyCategory(sourceText) === 'generic'
      && (locale === 'hi' || locale === 'sr' || locale === 'hr')
    ) {
      const localized = localizeCanonicalBulletLine(sourceText, locale, gender);
      if (localized) {
        let next = localized;
        if (locale === 'hi' && isPresent) {
          next = applyProductionHindiPresentTense(next, gender);
        }
        if ((locale === 'sr' || locale === 'hr') && isPresent) {
          next = applySerbianCurrentRoleTense(next);
        }
        if (next !== text) changed = true;
        return next;
      }
    }
    if (locale === 'hi') {
      const before = text;
      text = normalizeHindiCustomerServiceWording(text);
      if (isPresent) {
        text = applyHindiCurrentRoleTense(text);
        if (!classifyContactCenterMeaning(sourceText)) {
          text = applyProductionHindiPresentTense(text, gender);
        }
      }
      if (text !== before) changed = true;
    }
    if ((locale === 'sr' || locale === 'hr') && isPresent) {
      const before = text;
      text = applySerbianCurrentRoleTense(text);
      if (text !== before) changed = true;
    }
    return text;
  });
  // Preserve trailing localized-only lines only if source empty
  if (!sourceBullets.length && locBullets.length) {
    let text = locBullets.join('\n');
    if (locale === 'hi') {
      const before = text;
      text = normalizeHindiCustomerServiceWording(text);
      if (isPresent) text = applyHindiCurrentRoleTense(text);
      changed = text !== before;
      return { description: formatExperienceBullets(splitExperienceBullets(text)), changed };
    }
  }
  if (!next.length) return { description: exp.description || '', changed: false };
  return { description: formatExperienceBullets(next), changed };
}

const HINDI_MONTHS: Record<string, string> = {
  '01': 'जनवरी', '02': 'फ़रवरी', '03': 'मार्च', '04': 'अप्रैल', '05': 'मई', '06': 'जून',
  '07': 'जुलाई', '08': 'अगस्त', '09': 'सितंबर', '10': 'अक्तूबर', '11': 'नवंबर', '12': 'दिसंबर',
};

function formatHindiMonthYear(startDate?: string): string {
  const m = /^(\d{4})-(\d{2})/.exec((startDate || '').trim());
  if (!m) return '';
  const month = HINDI_MONTHS[m[2]];
  return month ? `${month} ${m[1]}` : '';
}

/**
 * Deterministic, gender-aware Hindi sentence that integrates the duration claim into a
 * single complete sentence (never a standalone "लगभग ... के साथ।" fragment).
 * Female/male prefer the direct subject-led form; unspecified gender uses a neutral
 * restructuring without वाला/वाली, per project policy (never infer gender from name/photo).
 */
function buildHindiIntegratedDurationSentence(
  duration: ExperienceDuration,
  context: DurationIntegrationContext,
): string {
  const word = duration.unit === 'years'
    ? yearWordForLocale('hi', duration.approxYears)
    : String(duration.totalMonths);
  const unitWord = duration.unit === 'years' ? 'वर्षों' : 'महीनों';
  const role = (context.role || 'पेशेवर').trim();
  const company = (context.company || '').trim();
  const monthYear = formatHindiMonthYear(context.startDate);
  const employmentClause = monthYear && company
    ? ` और ${monthYear} से ${company} में कार्यरत हूँ`
    : company
      ? ` और ${company} में कार्यरत हूँ`
      : '';
  const gender = normalizeCoverLetterGender(context.gender);
  if (gender === 'female') {
    return `मैं लगभग ${word} ${unitWord} के अनुभव वाली ${role} हूँ${employmentClause}।`;
  }
  if (gender === 'male') {
    return `मैं लगभग ${word} ${unitWord} के अनुभव वाला ${role} हूँ${employmentClause}।`;
  }
  return `${role} के क्षेत्र में लगभग ${word} ${unitWord} का अनुभव है${employmentClause}।`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Remove malformed or duplicate Hindi duration clauses from running text. */
function stripHindiDurationClauses(text: string): string {
  let out = (text || '').trim();
  out = out.replace(
    /,\s*(?:लगभग|करीब)\s*(?:\d+|एक|दो|तीन|चार|पाँच|पांच|छह)\s*वर्षों?\s*(?:के\s+अनुभव)?\s*के\s+साथ\s*/gu,
    '',
  );
  out = out.replace(
    /(?:^|\s)(?:लगभग|करीब)\s*(?:\d+|एक|दो|तीन|चार|पाँच|पांच|छह)\s*वर्षों?\s*(?:के\s+अनुभव)?\s*के\s+साथ\s*/gu,
    ' ',
  );
  return out.replace(/\s+/g, ' ').replace(/\s+([,।])/gu, '$1').trim();
}

/** Strip employment/role/start-date phrases already carried by the Hindi opening sentence. */
function stripHindiEmploymentDuplicate(text: string, context: DurationIntegrationContext): string {
  let out = (text || '').trim();
  const company = (context.company || '').trim();
  const monthYear = formatHindiMonthYear(context.startDate);
  const role = (context.role || '').trim();

  if (monthYear && company) {
    const patterns = [
      new RegExp(
        `(?:और\\s+)?${escapeRegExp(monthYear)}\\s+से\\s+${escapeRegExp(company)}\\s+में\\s+(?:कार्यरत\\s+)?(?:हूँ|है)`,
        'giu',
      ),
      new RegExp(
        `${escapeRegExp(monthYear)}\\s+से\\s+${escapeRegExp(company)}\\s+में\\s+${escapeRegExp(role)}\\s+के\\s+रूप\\s+में`,
        'giu',
      ),
      new RegExp(`${escapeRegExp(monthYear)}\\s+से\\s+${escapeRegExp(company)}`, 'giu'),
    ];
    for (const re of patterns) out = out.replace(re, ' ');
  }

  if (role) {
    out = out.replace(new RegExp(`${escapeRegExp(role)}\\s+के\\s+रूप\\s+में`, 'giu'), '');
    out = out.replace(new RegExp(`(?:मैं\\s+)?${escapeRegExp(role)}\\s+हूँ`, 'giu'), '');
  }

  return out.replace(/\s+/g, ' ').replace(/^[,\s]+|[,\s]+$/gu, '').trim();
}

function sentenceOverlapsOpening(sentence: string, opening: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const s = norm(sentence);
  const o = norm(opening);
  if (!s || s.length < 12) return true;
  if (o.includes(s)) return true;
  if (/^(?:मैं\s+)?(?:लगभग|करीब)\s+\S+\s+वर्ष/u.test(s) && /कार्यरत\s+हूँ/u.test(s) && s.length <= o.length + 24) {
    return true;
  }
  return false;
}

/**
 * Hindi-only duration integration: build a natural opening sentence with duration at the
 * start, then append remaining grounded content with duplicate claims removed.
 */
export function injectHindiDurationWithOpening(
  summary: string,
  duration: ExperienceDuration,
  context: DurationIntegrationContext,
): string {
  const opening = buildHindiIntegratedDurationSentence(duration, context);
  const trimmed = (summary || '').trim();
  if (!trimmed) return opening;

  const sentences = trimmed.split(/(?<=[।.!?])\s+/u).map((s) => s.trim()).filter(Boolean);
  const remainderParts: string[] = [];

  for (const sent of sentences) {
    let cleaned = stripHindiDurationClauses(sent);
    cleaned = stripHindiEmploymentDuplicate(cleaned, context);
    cleaned = cleaned.replace(/^[,\s]+|[,\s]+$/gu, '').trim();
    if (!cleaned || cleaned.length < 8) continue;
    if (/\bV\b/u.test(cleaned) || /पेशेवर के पास प्रासंगिक अनुभव है/u.test(cleaned)) continue;
    if (/स्टॉक|इन्वेंटरी|आपूर्ति/u.test(cleaned)) continue;
    if (sentenceOverlapsOpening(cleaned, opening)) continue;
    if (!/[।.!?…]\s*$/u.test(cleaned)) cleaned = `${cleaned}।`;
    remainderParts.push(cleaned);
  }

  if (!remainderParts.length) return opening;
  return `${opening} ${remainderParts.join(' ')}`.replace(/\s+/g, ' ').trim();
}

function findFirstSentenceSplit(text: string): { head: string; delim: string; rest: string } | null {
  const m = text.match(/^([\s\S]*?)([.।!?])(\s*[\s\S]*)$/u);
  if (!m || !m[1].trim()) return null;
  return { head: m[1], delim: m[2], rest: m[3].trim() };
}

/**
 * Weave a duration phrase into the first sentence of `text` via a comma — never emit the
 * phrase as its own standalone sentence (no fragment such as "लगभग पाँच वर्षों ... के साथ।").
 * Searches the whole string for the first sentence terminator (no fixed-length window), so
 * long AI-generated sentences never fall through to a naive "phrase. rest" concatenation.
 */
function mergeDurationPhraseIntoFirstSentence(text: string, phrase: string, locale: Locale): string {
  const trimmed = (text || '').trim();
  // Hindi must never use comma-splice — use injectHindiDurationWithOpening instead.
  if (locale === 'hi') return trimmed;
  const terminal = '.';
  if (!trimmed) {
    return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.`;
  }
  const split = findFirstSentenceSplit(trimmed);
  if (split) {
    const merged = `${split.head.trim()}, ${phrase}${split.delim}`.replace(/\s+/g, ' ').trim();
    return split.rest ? `${merged} ${split.rest}`.replace(/\s+/g, ' ').trim() : merged;
  }
  const withoutTrailingPunct = trimmed.replace(/[.।!?]+\s*$/u, '');
  return `${withoutTrailingPunct}, ${phrase}${terminal}`.replace(/\s+/g, ' ').trim();
}

/**
 * Constrained rewrite for an already-fragmented summary: when the first (or last) sentence
 * is a bare duration clause, merge it into the neighboring sentence via a comma instead of
 * leaving it as its own sentence. Does not remove the duration claim.
 */
export function repairFragmentedSummary(text: string, locale: Locale): string {
  const original = (text || '').trim();
  if (!original) return original;
  const sentences = original.split(/(?<=[।.!?])\s+/u).map((s) => s.trim()).filter(Boolean);
  if (sentences.length < 2) return original;
  const terminal = locale === 'hi' ? '।' : '.';
  if (isDurationOnlyFragmentSentence(sentences[0])) {
    const first = sentences[0].replace(/[।.!?]\s*$/u, '');
    const rest = sentences.slice(1).join(' ');
    return `${first}, ${rest}`.replace(/\s+/g, ' ').trim();
  }
  const lastIdx = sentences.length - 1;
  if (isDurationOnlyFragmentSentence(sentences[lastIdx])) {
    const last = sentences[lastIdx].replace(/[।.!?]\s*$/u, '');
    const head = sentences.slice(0, lastIdx).join(' ').replace(/[।.!?]\s*$/u, '');
    return `${head}, ${last}${terminal}`.replace(/\s+/g, ' ').trim();
  }
  return original;
}

function hasLeadingOrTrailingFragment(text: string): boolean {
  const sentences = (text || '').split(/(?<=[।.!?])\s+/u).map((s) => s.trim()).filter(Boolean);
  if (!sentences.length) return false;
  if (isDurationOnlyFragmentSentence(sentences[0])) return true;
  if (sentences.length > 1 && isDurationOnlyFragmentSentence(sentences[sentences.length - 1])) return true;
  return false;
}

function hindiDurationPlacementOk(text: string, locale: Locale): boolean {
  return locale !== 'hi' || !hasMisplacedHindiDuration(text);
}

/** Summary duration: reject → constrained repair → revalidate → duration-locked fallback. */
export function resolveSummaryWithDurationPolicy(
  summary: string,
  duration: ExperienceDuration,
  locale: Locale,
  options?: {
    /** When true (AI / fallback), missing duration is a violation and must be injected. */
    forceDurationPhrase?: boolean;
    requireDurationClaim?: boolean;
    /** Role/company/date/gender used to build a natural, non-fragment duration sentence. */
    context?: DurationIntegrationContext;
  },
): {
  summary: string;
  status: 'passed' | 'repaired' | 'fallback';
  violation?: 'experience_duration_mismatch';
} {
  const requireClaim = Boolean(options?.forceDurationPhrase || options?.requireDurationClaim);
  const context = options?.context;

  // A previously-saved or independently produced summary may already carry the duration
  // claim but as a standalone leading/trailing fragment — repair the structure first.
  let working = summary;
  if (requireClaim && hasLeadingOrTrailingFragment(working)) {
    working = repairFragmentedSummary(working, locale);
  }

  // Hindi comma-spliced duration at end of first sentence → opening-sentence rewrite.
  if (requireClaim && locale === 'hi' && context && hasMisplacedHindiDuration(working)) {
    const repairedHi = injectHindiDurationWithOpening(working, duration, context);
    if (
      validateSummaryDuration(repairedHi, duration, { requireDurationClaim: requireClaim, locale }).valid
      && hindiDurationPlacementOk(repairedHi, locale)
      && !hasLeadingOrTrailingFragment(repairedHi)
    ) {
      return {
        summary: repairedHi.trim(),
        status: 'repaired',
        violation: 'experience_duration_mismatch',
      };
    }
    working = repairedHi;
  }

  const initial = validateSummaryDuration(working, duration, {
    requireDurationClaim: requireClaim,
    locale,
  });
  if (
    initial.valid
    && (!requireClaim || (!hasLeadingOrTrailingFragment(working) && hindiDurationPlacementOk(working, locale)))
  ) {
    return { summary: working.trim(), status: working === summary ? 'passed' : 'repaired' };
  }

  // Missing claim on generated summaries: inject the shared phrase (do not invent duties).
  if (requireClaim && !summaryHasDurationClaim(working)
    && !summaryIncludesDurationPhrase(working, duration, locale)
    && duration.hasValidDates) {
    const injected = injectDurationPhrase(working, duration, locale, context);
    if (
      validateSummaryDuration(injected, duration, { requireDurationClaim: true, locale }).valid
      && !hasLeadingOrTrailingFragment(injected)
      && hindiDurationPlacementOk(injected, locale)
    ) {
      return {
        summary: injected.trim(),
        status: 'repaired',
        violation: 'experience_duration_mismatch',
      };
    }
  }

  const repaired = repairSummaryDuration(working, duration, locale);
  const afterRepair = validateSummaryDuration(repaired, duration, {
    requireDurationClaim: requireClaim,
    locale,
  });
  if (afterRepair.valid && (!requireClaim || (!hasLeadingOrTrailingFragment(repaired) && hindiDurationPlacementOk(repaired, locale)))) {
    return {
      summary: repaired.trim(),
      status: 'repaired',
      violation: 'experience_duration_mismatch',
    };
  }

  // Deterministic locale fallback using the same duration — do not invent duties.
  const phrase = formatApproximateDurationPhrase(duration, locale);
  const stripped = working
    .replace(/\bwith\s+(?:around|about|approximately)\s+(?:\d+(?:\.\d+)?|one|two|three|four|five|six)\s+years?\s+of\s+experience\b/giu, '')
    .replace(/\b(?:around|about|approximately)\s+(?:\d+(?:\.\d+)?|one|two|three|four|five|six)\s+years?\b/giu, '')
    .replace(/\bsa\s+oko\s+(?:jedne?|dve|dvije|tri|četiri|cetiri|pet|šest|\d+)\s+godina\s+iskustva\b/giu, '')
    .replace(/\b(?:oko|približno)\s+(?:jedne?|dve|dvije|tri|četiri|cetiri|pet|šest|\d+)\s+godin\w*/giu, '')
    .replace(/लगभग\s*(?:\d+|एक|दो|तीन|चार|पाँच|पांच|छह)\s*वर्षों के अनुभव के साथ/gu, '')
    .replace(/(?:लगभग|करीब)?\s*(?:\d+|एक|दो|तीन|चार|पाँच|पांच|छह)\s*वर्षों?/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/^[،,.\s।]+|[،,.\s।]+$/gu, '')
    .trim();

  let fallback = '';
  if (locale === 'hi' && context) {
    fallback = injectHindiDurationWithOpening(stripped || working, duration, context);
  } else if (phrase && stripped) {
    fallback = mergeDurationPhraseIntoFirstSentence(stripped, phrase, locale);
  } else if (phrase) {
    fallback = locale === 'hi' ? `${phrase}।` : `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.`;
  } else {
    fallback = stripped || working.trim();
  }

  // Last resort: minimal duration-locked sentence (same underlying length).
  if (
    !validateSummaryDuration(fallback, duration, { requireDurationClaim: requireClaim, locale }).valid
    || hasLeadingOrTrailingFragment(fallback)
    || !hindiDurationPlacementOk(fallback, locale)
    || !fallback.trim()
  ) {
    if (locale === 'hi') {
      fallback = duration.hasValidDates
        ? buildHindiIntegratedDurationSentence(duration, context || {})
        : buildHindiIntegratedDurationSentence(duration, context || { role: 'पेशेवर' });
    } else if (locale === 'sr' || locale === 'hr') {
      fallback = phrase ? `Profesionalka ${phrase}.` : 'Profesionalka sa relevantnim iskustvom.';
    } else if (locale === 'ja') {
      fallback = phrase ? `プロフェッショナル${phrase}。` : 'プロフェッショナルとして関連経験があります。';
    } else {
      fallback = phrase ? `Professional ${phrase}.` : 'Professional with relevant experience.';
    }
  }

  return {
    summary: fallback.trim(),
    status: 'fallback',
    violation: 'experience_duration_mismatch',
  };
}

/**
 * Inject the shared approximate-duration phrase into a summary that lacks any duration claim.
 * Hindi uses a dedicated opening-sentence builder — never comma-splice.
 */
export function injectDurationPhrase(
  summary: string,
  duration: ExperienceDuration,
  locale: Locale,
  context?: DurationIntegrationContext,
): string {
  const text = (summary || '').trim();
  if (locale === 'hi' && duration.hasValidDates) {
    return injectHindiDurationWithOpening(text, duration, context || {});
  }
  const phrase = formatApproximateDurationPhrase(duration, locale);
  if (!phrase) return text;
  return mergeDurationPhraseIntoFirstSentence(text, phrase, locale);
}

export type CvContentQualityResult = {
  cv: CVData;
  durationSnapshot: ExperienceDurationSnapshot;
  repaired: boolean;
  violations: Array<'experience_duration_mismatch'>;
};

export type CvContentQualityOptions = {
  gender?: string;
  /** Shared reference date for Present roles — same value for PDF and DOCX. */
  referenceDate?: Date | string;
  /** Precomputed snapshot; when set, dates are not recalculated from localized text. */
  durationSnapshot?: ExperienceDurationSnapshot;
  /** Override / clarify summary provenance for duration policy. */
  summaryOrigin?: CvSummaryOrigin;
};

/**
 * Shared content path for preview / PDF / DOCX.
 * Attaches duration claims to experience via snapshot; never invents dates.
 * Duration injection applies only to AI / repaired / deterministic_fallback summaries.
 */
export function applyCvContentQuality(
  cv: CVData,
  locale: Locale,
  options?: CvContentQualityOptions,
): CvContentQualityResult {
  const gender = options?.gender || cv.personal?.gender || '';
  const durationSnapshot = options?.durationSnapshot
    || buildExperienceDurationSnapshot(cv.experience || [], options?.referenceDate ?? new Date());
  const origin: CvSummaryOrigin | undefined = options?.summaryOrigin ?? cv.summaryOrigin;
  const requireDuration = summaryOriginRequiresDuration(origin);

  const violations: Array<'experience_duration_mismatch'> = [];
  let repaired = false;
  let nextOrigin = origin;

  const experience = (cv.experience || []).map((exp) => {
    const q = normalizeExperienceBulletsForQuality(exp, locale, gender);
    if (q.changed) repaired = true;
    return { ...exp, description: q.description };
  });

  const duration = durationSnapshot.total;
  let summary = stripUnsupportedSummaryFluff(cv.summary || '', locale);
  if (summary !== (cv.summary || '').trim()) repaired = true;

  const primaryExp = (cv.experience || []).find((e) => e.isPresent) || (cv.experience || [])[0];
  const hasCurrentRole = (cv.experience || []).some((e) => e.isPresent);
  const durationContext: DurationIntegrationContext = {
    role: resolveOccupationalTitleForSummary({
      profileJobTitle: cv.personal?.jobTitle,
      currentExperienceTitle: primaryExp?.position,
      locale,
      gender,
    }),
    company: primaryExp?.company || '',
    startDate: primaryExp?.startDate || '',
    gender,
  };

  const summaryResult = resolveSummaryWithDurationPolicy(summary, duration, locale, {
    forceDurationPhrase: requireDuration,
    requireDurationClaim: requireDuration,
    context: durationContext,
  });
  if (summaryResult.status !== 'passed') {
    repaired = true;
    if (summaryResult.status === 'repaired' && origin === 'ai_generated') {
      nextOrigin = 'ai_repaired';
    } else if (summaryResult.status === 'fallback') {
      nextOrigin = 'deterministic_fallback';
    }
  }

  summary = summaryResult.summary;
  if (locale === 'hi') {
    const before = summary;
    if (
      requireDuration
      && (
        hasMisplacedHindiDuration(summary)
        || /\bV\b/u.test(summary)
        || /पेशेवर के पास प्रासंगिक अनुभव है/u.test(summary)
        || /स्टॉक|इन्वेंटरी|आपूर्ति/u.test(summary)
      )
    ) {
      summary = injectHindiDurationWithOpening(summary, duration, durationContext);
      repaired = true;
    }
    summary = normalizeHindiCustomerServiceWording(summary);
    summary = applyHindiCurrentRoleTense(summary);
    summary = stripUnsupportedSummaryFluff(summary, locale);
    if (summary !== before) repaired = true;
  } else if (locale === 'sr' || locale === 'hr') {
    const before = summary;
    summary = normalizeSerbianRolePhrase(summary);
    if (hasCurrentRole) summary = applySerbianSummaryCurrentTense(summary, true);
    summary = applySerbianFemaleAgreement(summary, gender);
    summary = stripUnsupportedSummaryFluff(summary, locale);
    if (summary !== before) repaired = true;
  }

  // Only surface a violation if the final summary still mismatches the policy for this origin.
  if (!validateSummaryDuration(summary, duration, {
    requireDurationClaim: requireDuration,
    locale,
  }).valid) {
    violations.push('experience_duration_mismatch');
  }

  const factSet = buildCvCanonicalFactSet({ ...cv, experience });
  const summaryIntegrity = validateLocalizedSummary(summary, factSet, {
    locale,
    gender,
    expectedDuration: duration,
    stage: 'export-quality',
  });
  const completeness = validateSummaryCompleteness(summary, { locale });
  const blockingKinds = new Set([
    'summary_incomplete',
    'generic_summary_template_leak',
    'unsupported_summary_fact',
    'unsupported_achievement_or_impact',
    'invalid_occupational_title_in_summary',
  ]);
  const needsGroundedFallback = !completeness.valid
    || summaryIntegrity.violations.some((v) => blockingKinds.has(v.kind));
  if (needsGroundedFallback && summaryOriginRequiresDuration(origin)) {
    const grounded = deterministicLocalizedSummaryFromCanonical(factSet, locale, gender, duration);
    if (grounded) {
      const groundedResolved = resolveSummaryWithDurationPolicy(grounded, duration, locale, {
        forceDurationPhrase: requireDuration,
        requireDurationClaim: requireDuration,
        context: durationContext,
      });
      const groundedCheck = validateLocalizedSummary(groundedResolved.summary, factSet, {
        locale,
        gender,
        expectedDuration: duration,
        stage: 'export-fallback',
      });
      const groundedComplete = validateSummaryCompleteness(groundedResolved.summary, { locale }).valid;
      const groundedBlocked = groundedCheck.violations.some((v) => blockingKinds.has(v.kind));
      if (groundedComplete && !groundedBlocked) {
        summary = groundedResolved.summary;
        nextOrigin = 'deterministic_fallback';
        repaired = true;
      }
    }
  }

  const localizedLanguages = (cv.languages || []).map((lang) => ({
    name: getLocalizedCvLanguageName(lang.name, locale) || lang.name,
    level: localizeCvLanguageLevel(lang.level, locale),
  }));
  const localizedSkills = deduplicateSkillsForExport(cv.skills || [], locale);
  const localizedExperience = experience.map((exp) => ({
    ...exp,
    position: localizeOccupationalTitleForProjection(exp.position || '', locale, gender),
  }));

  return {
    cv: {
      ...cv,
      personal: {
        ...cv.personal,
        jobTitle: localizeOccupationalTitleForProjection(
          cv.personal?.jobTitle || '',
          locale,
          gender,
        ),
      },
      summary,
      experience: localizedExperience,
      languages: localizedLanguages,
      skills: localizedSkills,
      ...(nextOrigin ? { summaryOrigin: nextOrigin } : {}),
    },
    durationSnapshot,
    repaired,
    violations,
  };
}

/** Duration-locked deterministic summary shell fragment for activation/export fallbacks. */
export function appendDurationToSummaryShell(
  summary: string,
  duration: ExperienceDuration,
  locale: Locale,
): string {
  if (!duration.hasValidDates || !summaryHasClaimableSlot(summary)) return summary;
  if (validateSummaryDuration(summary, duration).valid && /\b(year|godin|वर्ष)/iu.test(summary)) {
    return summary;
  }
  const phrase = formatApproximateDurationPhrase(duration, locale);
  if (!phrase) return summary;
  const roleInject = summary.match(/^([^.]{2,80}?)\.\s*(.*)$/u);
  if (roleInject) {
    let out = `${roleInject[1]} ${phrase}. ${roleInject[2]}`.replace(/\s+/g, ' ').trim();
    if (locale === 'hi') {
      out = `${roleInject[1]} ${phrase}। ${roleInject[2]}`.replace(/\s+/g, ' ').trim();
    }
    if (!/[.!?…।]\s*$/u.test(out)) out = locale === 'hi' ? `${out}।` : `${out}.`;
    return out;
  }
  return summary;
}

function summaryHasClaimableSlot(summary: string): boolean {
  return Boolean(summary?.trim());
}
