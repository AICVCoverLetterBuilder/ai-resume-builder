/**
 * Shared CV content-quality fixes (duration, tense, natural wording).
 * Applied in the content/localization pipeline — not in template layouts.
 */
import type { CVData, CvSummaryOrigin, WorkExperience } from './types';
import type { Locale } from './i18n/translations';
import { formatExperienceBullets, splitExperienceBullets } from './cv-canonical-facts';
import {
  buildExperienceDurationSnapshot,
  formatApproximateDurationPhrase,
  repairSummaryDuration,
  summaryHasDurationClaim,
  summaryIncludesDurationPhrase,
  type ExperienceDuration,
  type ExperienceDurationSnapshot,
  validateSummaryDuration,
} from './cv-experience-duration';
import { normalizeCoverLetterGender } from './cover-letter-gender';
import { UNSUPPORTED_SUMMARY_FLUFF } from './cv-semantic-fidelity';

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
    [/\bpružala\b/gu, 'pružam'],
    [/\bpružao\b/gu, 'pružam'],
    [/\bunosila\b/gu, 'unosim'],
    [/\bunosio\b/gu, 'unosim'],
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
    if (locale === 'hi') {
      const before = text;
      text = normalizeHindiCustomerServiceWording(text);
      if (isPresent) text = applyHindiCurrentRoleTense(text);
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

/** Summary duration: reject → constrained repair → revalidate → duration-locked fallback. */
export function resolveSummaryWithDurationPolicy(
  summary: string,
  duration: ExperienceDuration,
  locale: Locale,
  options?: {
    /** When true (AI / fallback), missing duration is a violation and must be injected. */
    forceDurationPhrase?: boolean;
    requireDurationClaim?: boolean;
  },
): {
  summary: string;
  status: 'passed' | 'repaired' | 'fallback';
  violation?: 'experience_duration_mismatch';
} {
  const requireClaim = Boolean(options?.forceDurationPhrase || options?.requireDurationClaim);
  const initial = validateSummaryDuration(summary, duration, {
    requireDurationClaim: requireClaim,
    locale,
  });
  if (initial.valid) {
    return { summary: summary.trim(), status: 'passed' };
  }

  // Missing claim on generated summaries: inject the shared phrase (do not invent duties).
  if (requireClaim && !summaryHasDurationClaim(summary)
    && !summaryIncludesDurationPhrase(summary, duration, locale)
    && duration.hasValidDates) {
    const injected = injectDurationPhrase(summary, duration, locale);
    if (validateSummaryDuration(injected, duration, { requireDurationClaim: true, locale }).valid) {
      return {
        summary: injected.trim(),
        status: 'repaired',
        violation: 'experience_duration_mismatch',
      };
    }
  }

  const repaired = repairSummaryDuration(summary, duration, locale);
  const afterRepair = validateSummaryDuration(repaired, duration, {
    requireDurationClaim: requireClaim,
    locale,
  });
  if (afterRepair.valid) {
    return {
      summary: repaired.trim(),
      status: 'repaired',
      violation: 'experience_duration_mismatch',
    };
  }

  // Deterministic locale fallback using the same duration — do not invent duties.
  const phrase = formatApproximateDurationPhrase(duration, locale);
  const stripped = summary
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
  if (phrase && stripped) {
    const roleInject = stripped.match(/^(.{2,80}?)[.।]\s*(.*)$/u);
    if (locale === 'hi') {
      if (roleInject) {
        fallback = `${roleInject[1].trim()} ${phrase}। ${roleInject[2].trim()}`.replace(/\s+/g, ' ').trim();
      } else {
        fallback = `${phrase}। ${stripped}`;
      }
      if (!/[।.!?…]\s*$/u.test(fallback)) fallback = `${fallback}।`;
    } else if (roleInject) {
      fallback = `${roleInject[1].trim()} ${phrase}. ${roleInject[2].trim()}`.replace(/\s+/g, ' ').trim();
      if (!/[.!?…]\s*$/u.test(fallback)) fallback = `${fallback}.`;
    } else {
      fallback = `${stripped} ${phrase}.`.replace(/\s+/g, ' ').trim();
    }
  } else if (phrase) {
    fallback = locale === 'hi' ? `${phrase}।` : `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.`;
  } else {
    fallback = stripped || summary.trim();
  }

  // Last resort: minimal duration-locked sentence (same underlying length).
  if (!validateSummaryDuration(fallback, duration, { requireDurationClaim: requireClaim, locale }).valid || !fallback.trim()) {
    if (locale === 'hi') {
      fallback = phrase ? `${phrase}।` : 'पेशेवर के पास प्रासंगिक अनुभव है।';
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

/** Inject the shared approximate-duration phrase into a summary that lacks any duration claim. */
export function injectDurationPhrase(
  summary: string,
  duration: ExperienceDuration,
  locale: Locale,
): string {
  const phrase = formatApproximateDurationPhrase(duration, locale);
  const text = (summary || '').trim();
  if (!phrase) return text;
  if (!text) {
    return locale === 'hi' ? `${phrase}।` : `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.`;
  }
  if (locale === 'hi') {
    // Prefer: "<role/opening> लगभग पाँच वर्षों के अनुभव के साथ। <rest>"
    const roleInject = text.match(/^(.{2,100}?)([.।])\s*(.*)$/u);
    if (roleInject) {
      let out = `${roleInject[1].trim()} ${phrase}${roleInject[2]} ${roleInject[3].trim()}`.replace(/\s+/g, ' ').trim();
      if (!/[।.!?…]\s*$/u.test(out)) out = `${out}।`;
      return out;
    }
    // Or lead with duration when the text is a single clause.
    let out = `${phrase}। ${text.replace(/^[।.\s]+/u, '')}`.replace(/\s+/g, ' ').trim();
    if (!/[।.!?…]\s*$/u.test(out)) out = `${out}।`;
    return out;
  }
  if (locale === 'ja') {
    const roleInject = text.match(/^(.{2,100}?)([。．.])\s*(.*)$/u);
    if (roleInject) {
      return `${roleInject[1].trim()}${phrase}${roleInject[2]}${roleInject[3].trim()}`;
    }
    return `${text.replace(/[。．.]\s*$/u, '')}${phrase}。`;
  }
  if (locale === 'sr' || locale === 'hr') {
    // Prefer: "Profesionalka sa oko pet godina iskustva ..."
    const roleInject = text.match(/^(.{2,100}?)\.\s*(.*)$/u);
    if (roleInject) {
      const head = roleInject[1].trim();
      // If head already looks like a role intro, append phrase after it.
      let out = `${head} ${phrase}. ${roleInject[2].trim()}`.replace(/\s+/g, ' ').trim();
      if (!/[.!?…]\s*$/u.test(out)) out = `${out}.`;
      return out;
    }
    const out = `${text.replace(/\.\s*$/u, '')} ${phrase}.`.replace(/\s+/g, ' ').trim();
    return out;
  }
  // English / default
  {
    const roleInject = text.match(/^(.{2,100}?)\.\s*(.*)$/u);
    if (roleInject) {
      let out = `${roleInject[1].trim()} ${phrase}. ${roleInject[2].trim()}`.replace(/\s+/g, ' ').trim();
      if (!/[.!?…]\s*$/u.test(out)) out = `${out}.`;
      return out;
    }
    const out = `${text.replace(/\.\s*$/u, '')} ${phrase}.`.replace(/\s+/g, ' ').trim();
    return out;
  }
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

  const summaryResult = resolveSummaryWithDurationPolicy(summary, duration, locale, {
    forceDurationPhrase: requireDuration,
    requireDurationClaim: requireDuration,
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
    summary = normalizeHindiCustomerServiceWording(summary);
    summary = applyHindiCurrentRoleTense(summary);
    summary = stripUnsupportedSummaryFluff(summary, locale);
    if (summary !== before) repaired = true;
  } else if (locale === 'sr' || locale === 'hr') {
    const before = summary;
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

  return {
    cv: {
      ...cv,
      summary,
      experience,
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
