/**
 * Experience Stronger — locale-native deterministic transforms for weak sources.
 * Never invents tools, metrics, leadership, or extra duties.
 */
import type { Locale } from '@/lib/i18n/translations';
import {
  formatExperienceBullets,
  splitExperienceBullets,
} from '@/lib/cv-canonical-facts';
import {
  experienceAiHasMeaningfulChange,
} from '@/lib/cv-experience-perspective';
import {
  extractSourceDutyUnits,
  stripDutyListPrefix,
  universalPreserveSourceUnit,
} from '@/lib/cv-source-fact-identity';
import { validateNoExtraGeneratedDuties } from '@/lib/cv-material-duty-coverage';
import { fingerprintText } from '@/lib/cv-export-diagnostics';

export const EXPERIENCE_STRONGER_386_REVISION =
  'experience-stronger-386-v1' as const;

export const EXPERIENCE_STYLE_NO_SAFE_MATERIAL_CHANGE =
  'experience_style_no_safe_material_change' as const;

/** JS \\b is ASCII-only — use this after non-ASCII verb stems. */
const VERB_END = '(?=[\\s.,;:!?]|$)';

function hashNorm(text: string): string {
  return fingerprintText(
    (text || '').replace(/\s+/g, ' ').trim().toLowerCase() || 'empty',
  );
}

function strengthenLead(
  text: string,
  verb: string,
  replacement: string,
): string {
  const re = new RegExp(`^${verb}${VERB_END}`, 'u');
  return text.replace(re, replacement);
}

/** Leading-verb / connector strengthening — no new nouns/tools/metrics. */
function strengthenUnit(unit: string, locale: Locale, isPresent: boolean): string {
  let t = stripDutyListPrefix(unit || '').trim();
  if (!t) return t;

  if (locale === 'en') {
    t = strengthenLead(t, 'Performs', 'Actively performs');
    t = strengthenLead(t, 'performs', 'actively performs');
    t = strengthenLead(t, 'Inspects', 'Thoroughly inspects');
    t = strengthenLead(t, 'inspects', 'thoroughly inspects');
    t = strengthenLead(t, 'Inspected', 'Thoroughly inspected');
    t = strengthenLead(t, 'inspected', 'thoroughly inspected');
    t = strengthenLead(t, 'Replaces', 'Promptly replaces');
    t = strengthenLead(t, 'replaces', 'promptly replaces');
    t = strengthenLead(t, 'Replaced', 'Promptly replaced');
    t = strengthenLead(t, 'replaced', 'promptly replaced');
    t = strengthenLead(t, 'Recorded', 'Carefully recorded');
    t = strengthenLead(t, 'recorded', 'carefully recorded');
  } else if (locale === 'de') {
    t = strengthenLead(t, 'Führt', 'Zuverlässig führt');
    t = strengthenLead(t, 'Prüft', 'Sorgfältig prüft');
    t = strengthenLead(t, 'Prüfte', 'Sorgfältig prüfte');
    t = strengthenLead(t, 'Tauscht', 'Sicher tauscht');
    t = strengthenLead(t, 'Tauschte', 'Sicher tauschte');
    t = strengthenLead(t, 'Erfasste', 'Sorgfältig erfasste');
  } else if (locale === 'es') {
    t = strengthenLead(t, 'Realiza', 'Realiza con atención');
    t = strengthenLead(t, 'Inspecciona', 'Inspecciona con cuidado');
    t = strengthenLead(t, 'Inspeccionó', 'Inspeccionó con cuidado');
    t = strengthenLead(t, 'Sustituye', 'Sustituye con cuidado');
    t = strengthenLead(t, 'Sustituyó', 'Sustituyó con cuidado');
    t = strengthenLead(t, 'Registró', 'Registró con detalle');
  } else if (locale === 'fr') {
    t = strengthenLead(t, 'Effectue', 'Effectue avec soin');
    t = strengthenLead(t, 'Inspecte', 'Inspecte attentivement');
    t = strengthenLead(t, 'Inspectait', 'Inspectait attentivement');
    t = strengthenLead(t, 'Remplace', 'Remplace avec soin');
    t = strengthenLead(t, 'Remplaçait', 'Remplaçait avec soin');
    t = strengthenLead(t, 'Enregistrait', 'Enregistrait soigneusement');
  } else if (locale === 'it') {
    t = strengthenLead(t, 'Esegue', 'Esegue con cura');
    t = strengthenLead(t, 'Controlla', 'Controlla attentamente');
    t = strengthenLead(t, 'Controllava', 'Controllava attentamente');
    t = strengthenLead(t, 'Ha controllato', 'Ha controllato attentamente');
    t = strengthenLead(t, 'Sostituisce', 'Sostituisce con cura');
    t = strengthenLead(t, 'Sostituiva', 'Sostituiva con cura');
    t = strengthenLead(t, 'Ha sostituito', 'Ha sostituito con cura');
    t = strengthenLead(t, 'Registrava', 'Registrava con attenzione');
    t = strengthenLead(t, 'Ha registrato', 'Ha registrato con attenzione');
  } else if (locale === 'pt-BR') {
    t = strengthenLead(t, 'Realiza', 'Realiza com atenção');
    t = strengthenLead(t, 'Inspeciona', 'Inspeciona com cuidado');
    t = strengthenLead(t, 'Inspecionava', 'Inspecionava com cuidado');
    t = strengthenLead(t, 'Substitui', 'Substitui com cuidado');
    t = strengthenLead(t, 'Substituía', 'Substituía com cuidado');
    t = strengthenLead(t, 'Registrava', 'Registrava com atenção');
  } else if (locale === 'ru') {
    t = strengthenLead(t, 'Выполняет', 'Надёжно выполняет');
    t = strengthenLead(t, 'Проверяет', 'Тщательно проверяет');
    t = strengthenLead(t, 'Проверял', 'Тщательно проверял');
    t = strengthenLead(t, 'Заменяет', 'Оперативно заменяет');
    t = strengthenLead(t, 'Заменял', 'Оперативно заменял');
    t = strengthenLead(t, 'Фиксировал', 'Аккуратно фиксировал');
  } else if (locale === 'sr') {
    t = strengthenLead(t, 'Obavlja', 'Pouzdano obavlja');
    t = strengthenLead(t, 'Pregleda', 'Pažljivo pregleda');
    t = strengthenLead(t, 'Pregledao', 'Pažljivo pregledao');
    t = strengthenLead(t, 'Proverava', 'Pažljivo proverava');
    t = strengthenLead(t, 'Proveravao', 'Pažljivo proveravao');
    t = strengthenLead(t, 'Menja', 'Efikasno menja');
    t = strengthenLead(t, 'Menjao', 'Efikasno menjao');
    t = strengthenLead(t, 'Beležio', 'Pažljivo beležio');
    t = strengthenLead(t, 'Evidentira', 'Pažljivo evidentira');
    t = strengthenLead(t, 'Evidentirao', 'Pažljivo evidentirao');
    // Coordinated predicates after i/te — same adverbs, never leave a bare 3sg/past twin.
    t = t.replace(/\s+i\s+evidentira\b/giu, ' i pažljivo evidentira');
    t = t.replace(/\s+i\s+evidentirao\b/giu, ' i pažljivo evidentirao');
    t = t.replace(/\s+i\s+beležio\b/giu, ' i pažljivo beležio');
    t = t.replace(/\s+i\s+ažurira\b/giu, ' i pažljivo ažurira');
    t = t.replace(/\s+i\s+ažurirao\b/giu, ' i pažljivo ažurirao');
  } else if (locale === 'hr') {
    t = strengthenLead(t, 'Obavlja', 'Pouzdano obavlja');
    t = strengthenLead(t, 'Pregledava', 'Pažljivo pregledava');
    t = strengthenLead(t, 'Pregledavao', 'Pažljivo pregledavao');
    t = strengthenLead(t, 'Provjerava', 'Pažljivo provjerava');
    t = strengthenLead(t, 'Provjeravao', 'Pažljivo provjeravao');
    t = strengthenLead(t, 'Mijenja', 'Učinkovito mijenja');
    t = strengthenLead(t, 'Mijenjao', 'Učinkovito mijenjao');
    t = strengthenLead(t, 'Bilježio', 'Pažljivo bilježio');
    t = strengthenLead(t, 'Evidentira', 'Pažljivo evidentira');
    t = strengthenLead(t, 'Evidentirao', 'Pažljivo evidentirao');
    t = t.replace(/\s+i\s+evidentira\b/giu, ' i pažljivo evidentira');
    t = t.replace(/\s+i\s+evidentirao\b/giu, ' i pažljivo evidentirao');
    t = t.replace(/\s+i\s+bilježio\b/giu, ' i pažljivo bilježio');
    t = t.replace(/\s+i\s+ažurira\b/giu, ' i pažljivo ažurira');
    t = t.replace(/\s+i\s+ažurirao\b/giu, ' i pažljivo ažurirao');
  } else if (locale === 'ar') {
    t = strengthenLead(t, 'ينفذ', 'ينفذ بدقة');
    t = strengthenLead(t, 'يفحص', 'يفحص بعناية');
    t = strengthenLead(t, 'يستبدل', 'يستبدل بسرعة');
    t = strengthenLead(t, 'راجع', 'راجع بعناية');
    t = strengthenLead(t, 'أعدّ', 'أعدّ بدقة');
    t = strengthenLead(t, 'ضبط', 'ضبط بعناية');
  } else if (locale === 'hi') {
    t = t
      .replace(/करता है/gu, 'सावधानी से करता है')
      .replace(/की जाँच करता है/gu, 'की गहन जाँच करता है')
      .replace(/बदलता है/gu, 'शीघ्र बदलता है')
      .replace(/की जाँच की।/gu, 'की गहन जाँच की।')
      .replace(/दर्ज किए।/gu, 'सावधानी से दर्ज किए।')
      .replace(/पुर्जे बदले।/gu, 'पुर्जे शीघ्र बदले।');
  } else if (locale === 'ja') {
    // Prefix intensifiers only — mid-phrase inserts break CJK identity substring coverage.
    if (!/^(?:確実に|入念に|適切に)/u.test(t)) {
      t = t
        .replace(/^(.+を行う。)$/u, '確実に$1')
        .replace(/^(.+を点検する。)$/u, '入念に$1')
        .replace(/^(.+を交換する。)$/u, '適切に$1')
        .replace(/^(.+を点検した。)$/u, '入念に$1')
        .replace(/^(.+を記録した。)$/u, '確実に$1')
        .replace(/^(.+を交換した。)$/u, '適切に$1');
    }
  }

  void isPresent;
  return t.replace(/\s+/g, ' ').trim();
}

export function buildExperienceStrongerDeterministic(options: {
  sourceDescription: string;
  locale: Locale;
  isPresent: boolean;
  gender?: string;
}): {
  text: string;
  noSafeMaterialChange: boolean;
  semanticStyleOperationsApplied: string[];
  beforeHash: string;
  afterHash: string;
  sourceFactCount: number;
  coveredFactCount: number;
} {
  void EXPERIENCE_STRONGER_386_REVISION;
  const source = options.sourceDescription || '';
  const units = extractSourceDutyUnits(source);
  const beforeHash = hashNorm(source);
  if (!units.length) {
    return {
      text: source,
      noSafeMaterialChange: true,
      semanticStyleOperationsApplied: [],
      beforeHash,
      afterHash: beforeHash,
      sourceFactCount: 0,
      coveredFactCount: 0,
    };
  }

  const lines = units.map((unit) => {
    const tensed = universalPreserveSourceUnit(unit, {
      isPresent: options.isPresent,
      locale: options.locale,
      gender: options.gender,
    }) || stripDutyListPrefix(unit);
    return strengthenUnit(tensed, options.locale, options.isPresent) || tensed;
  });
  const text = formatExperienceBullets(lines);
  const meaningful = experienceAiHasMeaningfulChange(source, text);
  const groundingOk = validateNoExtraGeneratedDuties(source, text).valid;
  const outUnits = splitExperienceBullets(text).filter(Boolean).length;
  const safe = meaningful && groundingOk && outUnits >= units.length;
  const afterHash = hashNorm(safe ? text : source);

  return {
    text: safe ? text : source,
    noSafeMaterialChange: !safe,
    semanticStyleOperationsApplied: safe
      ? ['active_verb_strengthen', 'role_congruent_flow']
      : [],
    beforeHash,
    afterHash,
    sourceFactCount: units.length,
    coveredFactCount: safe ? units.length : units.length,
  };
}

/** Heuristic: already uses stronger professional verbs/connectors. */
export function isExperienceStyleSaturated(
  sourceDescription: string,
  locale: Locale,
): boolean {
  const t = sourceDescription || '';
  if (locale === 'en') {
    return /\b(?:Actively performs|Thoroughly inspects|Thoroughly inspected|Promptly replaces|Promptly replaced|Carefully recorded)\b/u.test(t);
  }
  if (locale === 'de') {
    return /(?:Zuverlässig führt|Sorgfältig prüft|Sorgfältig prüfte|Sicher tauschte|Sorgfältig erfasste)/u.test(t);
  }
  if (locale === 'es') {
    return /(?:Realiza con atención|Inspecciona con cuidado|Inspeccionó con cuidado|Sustituyó con cuidado|Registró con detalle)/u.test(t);
  }
  if (locale === 'fr') {
    return /(?:Effectue avec soin|Inspecte attentivement|Inspectait attentivement|Remplaçait avec soin|Enregistrait soigneusement)/u.test(t);
  }
  if (locale === 'it') {
    return /(?:Esegue con cura|Controlla attentamente|Ha controllato attentamente|Ha sostituito con cura|Ha registrato con attenzione)/u.test(t);
  }
  if (locale === 'pt-BR') {
    return /(?:Realiza com atenção|Inspeciona com cuidado|Inspecionava com cuidado|Substituía com cuidado|Registrava com atenção)/u.test(t);
  }
  if (locale === 'ru') {
    return /(?:Надёжно выполняет|Тщательно проверяет|Тщательно проверял|Оперативно заменял|Аккуратно фиксировал)/u.test(t);
  }
  if (locale === 'sr') {
    return /(?:Pouzdano obavlja|Pažljivo pregleda|Pažljivo pregledao|Pažljivo proverava|Pažljivo proveravao|Efikasno menjao|Pažljivo beležio|pažljivo evidentira)/iu.test(t);
  }
  if (locale === 'hr') {
    return /(?:Pouzdano obavlja|Pažljivo pregledava|Pažljivo pregledavao|Pažljivo provjerava|Pažljivo provjeravao|Učinkovito mijenjao|Pažljivo bilježio|pažljivo evidentira)/iu.test(t);
  }
  if (locale === 'ar') {
    return /(?:ينفذ بدقة|يفحص بعناية|راجع بعناية|أعدّ بدقة|ضبط بعناية)/u.test(t);
  }
  if (locale === 'hi') {
    return /(?:सावधानी से करता|गहन जाँच|सावधानी से दर्ज|शीघ्र बदले)/u.test(t);
  }
  if (locale === 'ja') {
    return /(?:確実に|入念に|適切に)/u.test(t);
  }
  return false;
}
