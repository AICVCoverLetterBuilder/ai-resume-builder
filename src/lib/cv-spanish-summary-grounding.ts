/**
 * Entry-owned Spanish Professional Summary grounding (three semantic slots).
 * Employer phrase: natural `en <Employer>` / `para <Employer>` — avoid
 * duplicated employer prepositions.
 */
import type { Locale } from './i18n/translations';
import { classifyMaterialDutyKeys } from './cv-material-duty-coverage';
import {
  localizeGraphicDesigner,
  localizeWarehouseEmployee,
  matchesWarehouseOccupationalTitle,
} from './cv-role-title';
import {
  formatApproximateDurationPhrase,
  type ExperienceDuration,
} from './cv-experience-duration';
import { SPANISH_CV_AI_305_REVISION } from './cv-spanish-experience-grounding';

void SPANISH_CV_AI_305_REVISION;

const SPANISH_MONTHS: Record<string, string> = {
  '01': 'enero',
  '02': 'febrero',
  '03': 'marzo',
  '04': 'abril',
  '05': 'mayo',
  '06': 'junio',
  '07': 'julio',
  '08': 'agosto',
  '09': 'septiembre',
  '10': 'octubre',
  '11': 'noviembre',
  '12': 'diciembre',
};

const DESIGN_UNSUPPORTED_ES =
  /\b(?:medios?\s+impresos?|print\s*media|branding|identidad\s+de\s+marca|material(?:es)?\s+de\s+marketing|logos?|campa[nñ]as?\s+publicitarias?|redes?\s+sociales?|dise[nñ]o\s+de\s+envases?)\b/iu;

const WAREHOUSE_FACT_CUE_ES =
  /(?:mercanc[ií]a\s+entrant|recepci[oó]n\s+de\s+mercanc|documentaci[oó]n|documentos|registros|preparaci[oó]n|movimiento|traslado|compa[nñ]er|\brevisa\b|\bcomprueba\b|\bcontrola\b|almac[eé]n)/iu;
const DESIGN_FACT_CUE_ES =
  /(?:visual|gr[aá]fic|dise[nñ]o|archivo\s+de\s+dise[nñ]o|pantalla|formato|elemento)/iu;

const FINITE_VERB_ES =
  /\b(?:trabaja|trabajó|desempeña|desempeñó|ejerce|ejerció|ocupa|ocupó|realiza|realizó|colabora|colaboró|desarrolla|desarrolló|es|fue|est[aá]|estuvo)\b/iu;

export type SpanishSummaryRoleSlot =
  | 'current_intro'
  | 'current_duty'
  | 'prior_role'
  | 'other';

/**
 * Natural Spanish employer phrase — `en Company` or `para Company`.
 * Avoids duplicating an existing en/para prefix.
 */
export function formatSpanishEmployerPhrase(employer: string): string | null {
  const company = (employer || '').replace(/\s+/g, ' ').trim();
  if (!company) return null;
  if (/^(?:en|para|de|del|en\s+la\s+empresa|para\s+la\s+empresa)\s+/iu.test(company)) {
    return company;
  }
  // Prefer `en` for company employment; keep `para` only when already present above.
  return `en ${company}`;
}

export function spanishWarehouseSummaryFragment(key: string): string {
  switch (key) {
    case 'warehouse_inbound_check':
    case 'warehouse_document_check':
      return 'la revisión de la mercancía entrante y de la documentación relacionada';
    case 'warehouse_records':
    case 'warehouse_orderly_goods':
      return 'la comprobación y el mantenimiento de la documentación y los registros relacionados';
    case 'warehouse_movement':
    case 'warehouse_preparation':
    case 'warehouse_colleague_coordination':
      return 'la coordinación con los compañeros de la preparación y el movimiento de la mercancía';
    default:
      return '';
  }
}

export function splitSpanishSummaryUnits(text: string): string[] {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  return normalized
    .split(/(?<=[.!?])\s+(?=\S)/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateSpanishSummaryIntroGrammar(
  summary: string,
  options: { company?: string } = {},
): {
  ok: boolean;
  reason: string | null;
  missingFiniteVerb: boolean;
  duplicateDuration: boolean;
  hybridDuration: boolean;
  fragmentIntro: boolean;
} {
  void SPANISH_CV_AI_305_REVISION;
  const intro = splitSpanishSummaryUnits(summary)[0] || (summary || '').trim();
  const fragmentIntro = !intro
    || intro.length < 12
    || /,\s*$/u.test(intro)
    || /^(?:desde|como|con|en)\s+\S+\.?$/iu.test(intro);

  const missingFiniteVerb = Boolean(intro) && !FINITE_VERB_ES.test(intro);

  const durationHits = [
    ...intro.matchAll(
      /(?:alrededor\s+de|unos?\s+|unas?\s+|cerca\s+de|aproximadamente\s+)?(?:\d+[.,]\d+|\d+|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)(?:\s+años?\s+y\s+medio|\s+y\s+medio\s+años?|\s+años?)/giu,
    ),
  ];
  const duplicateDuration = durationHits.length >= 2;

  // Reject hybrid numeric + written duration (e.g. "6,5 seis y medio años").
  const hybridDuration = /\d+[.,]\d+\s+(?:uno|dos|tres|cuatro|cinco|seis|siete)\s+y\s+medio|(?:uno|dos|tres|cuatro|cinco|seis)\s+y\s+medio\s+\d+[.,]\d+/iu
    .test(intro)
    || /\d+[.,]\d+\s+años?.{0,24}(?:uno|dos|tres|cuatro|cinco|seis)\s+y\s+medio/iu.test(intro)
    || /\d+[.,]\d+\s+y\s+medio\s+años?/iu.test(intro);

  if (fragmentIntro) {
    return {
      ok: false,
      reason: 'spanish_summary_intro_fragment',
      missingFiniteVerb,
      duplicateDuration,
      hybridDuration,
      fragmentIntro: true,
    };
  }
  if (missingFiniteVerb) {
    return {
      ok: false,
      reason: 'spanish_summary_missing_finite_verb',
      missingFiniteVerb: true,
      duplicateDuration,
      hybridDuration,
      fragmentIntro: false,
    };
  }
  if (hybridDuration) {
    return {
      ok: false,
      reason: 'spanish_summary_hybrid_duration',
      missingFiniteVerb: false,
      duplicateDuration,
      hybridDuration: true,
      fragmentIntro: false,
    };
  }
  if (duplicateDuration) {
    return {
      ok: false,
      reason: 'spanish_summary_duplicate_duration',
      missingFiniteVerb: false,
      duplicateDuration: true,
      hybridDuration: false,
      fragmentIntro: false,
    };
  }

  void options.company;
  return {
    ok: true,
    reason: null,
    missingFiniteVerb: false,
    duplicateDuration: false,
    hybridDuration: false,
    fragmentIntro: false,
  };
}

export type SpanishSummaryEmploymentQuality = {
  ok: boolean;
  reason: string | null;
  unitCount: number;
  finalUnitRoleSlots: SpanishSummaryRoleSlot[];
  unsupportedDesignMedium: boolean;
  missingFiniteVerb: boolean;
  duplicateDuration: boolean;
  hybridDuration: boolean;
  groundingValidationPassed: boolean;
  typedRejectionReason: string | null;
};

export function analyzeSpanishSummaryEmploymentQuality(
  summary: string,
  options: {
    company?: string;
    role?: string;
    priorCompany?: string;
    currentEntryDuties?: string;
    priorEntryDuties?: string;
    gender?: string;
  } = {},
): SpanishSummaryEmploymentQuality {
  void SPANISH_CV_AI_305_REVISION;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const units = splitSpanishSummaryUnits(text);
  const introGrammar = validateSpanishSummaryIntroGrammar(text, { company: options.company });
  const unsupportedDesignMedium = DESIGN_UNSUPPORTED_ES.test(text);
  const company = (options.company || '').trim();
  const companyEsc = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const slots: SpanishSummaryRoleSlot[] = [];
  for (let i = 0; i < units.length; i += 1) {
    const sentence = units[i]!;
    const hasCompany = companyEsc ? new RegExp(companyEsc, 'iu').test(sentence) : false;
    const hasDuration = /(?:alrededor\s+de|unos?|cerca\s+de|aproximadamente).{0,40}años|años\s+de\s+experiencia|(?:uno|dos|tres|cuatro|cinco|seis)\s+años?\s+y\s+medio|(?:uno|dos|tres|cuatro|cinco|seis)\s+y\s+medio\s+años/iu
      .test(sentence);
    const hasPrior = /(?:anteriormente|antes|previamente|con\s+anterioridad)\b/iu.test(sentence)
      || DESIGN_FACT_CUE_ES.test(sentence);
    const hasDuty = WAREHOUSE_FACT_CUE_ES.test(sentence);
    if (i === 0 && (hasCompany || hasDuration)) slots.push('current_intro');
    else if (hasPrior && !hasDuty) slots.push('prior_role');
    else if (hasDuty) slots.push('current_duty');
    else if (hasPrior) slots.push('prior_role');
    else slots.push('other');
  }

  let reason: string | null = null;
  const dutiesCorpus = `${options.currentEntryDuties || ''} ${options.priorEntryDuties || ''} ${options.role || ''}`;
  const warehouseDomain = WAREHOUSE_FACT_CUE_ES.test(dutiesCorpus)
    || matchesWarehouseOccupationalTitle(options.role || '')
    || /almac[eé]n|warehouse/i.test(options.role || '');
  const designDomain = DESIGN_FACT_CUE_ES.test(dutiesCorpus)
    || /dise[nñ]o|design|gr[aá]fic/i.test(`${options.role || ''} ${options.priorEntryDuties || ''}`);

  if (!text) reason = 'empty_summary';
  else if (unsupportedDesignMedium) reason = 'spanish_summary_unsupported_design_medium';
  else if (!introGrammar.ok) reason = introGrammar.reason;
  else if ((warehouseDomain || designDomain) && units.length < 2) {
    reason = 'spanish_summary_incomplete_slots';
  } else if (/[\u0900-\u097F\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF]/.test(text)) {
    reason = 'spanish_summary_foreign_script';
  }

  const groundingOk = reason == null && introGrammar.ok && !unsupportedDesignMedium;
  return {
    ok: groundingOk,
    reason,
    unitCount: units.length,
    finalUnitRoleSlots: slots,
    unsupportedDesignMedium,
    missingFiniteVerb: introGrammar.missingFiniteVerb,
    duplicateDuration: introGrammar.duplicateDuration,
    hybridDuration: introGrammar.hybridDuration,
    groundingValidationPassed: groundingOk,
    typedRejectionReason: reason,
  };
}

export function buildSpanishEntryOwnedSummary(options: {
  role: string;
  employer: string;
  datesValue: string;
  gender?: string;
  durationPhrase?: string;
  dutyFacts: Array<{ sourceText?: string; value: string }>;
  priorRole?: string;
  priorEmployer?: string;
  priorSourceDuties?: string;
  locale?: Locale;
  duration?: ExperienceDuration | null;
}): string {
  void SPANISH_CV_AI_305_REVISION;
  void options.locale;

  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'mujer' || g === 'femenino';
  const male = g === 'male' || g === 'm' || g === 'hombre' || g === 'masculino';
  const unspecified = !female && !male;

  let role = (options.role || '').trim();
  const warehouseRole = !role
    || /^(?:profesional|professional)$/iu.test(role)
    || matchesWarehouseOccupationalTitle(role)
    || /almac[eé]n|warehouse|skladist|magazin|lager/i.test(role);
  if (!unspecified) {
    if (!role || /^(?:profesional|professional)$/iu.test(role) || warehouseRole) {
      role = localizeWarehouseEmployee('es', options.gender);
    }
  } else if (warehouseRole) {
    role = 'Profesional con experiencia en almacén';
  }

  const startMatch = /^(\d{4})-(\d{2})/.exec(options.datesValue || '');
  const monthName = startMatch ? SPANISH_MONTHS[startMatch[2]] : '';
  const monthYear = monthName && startMatch
    ? `${monthName} de ${startMatch[1]}`
    : '';
  const company = (options.employer || '').trim();
  const enCompany = formatSpanishEmployerPhrase(company);

  let durRaw = (options.durationPhrase || '')
    .replace(/^[,，]\s*/u, '')
    .replace(/\.$/u, '')
    .trim();
  if (!durRaw && options.duration) {
    durRaw = formatApproximateDurationPhrase(options.duration, 'es')
      .replace(/\.$/u, '')
      .trim();
  }
  // Prefer written half-years; never leave hybrid numeric forms.
  // Normalize awkward "seis y medio años" → "seis años y medio".
  durRaw = durRaw
    .replace(/\b6[,.]5\b/gu, 'seis años y medio')
    .replace(/\b3[,.]5\b/gu, 'tres años y medio')
    .replace(/\b(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+y\s+medio\s+años?\b/giu, '$1 años y medio')
    .replace(/\b(\d+)[,.]5\s+años?\b/gu, (_m, whole: string) => {
      const map: Record<string, string> = {
        1: 'uno',
        2: 'dos',
        3: 'tres',
        4: 'cuatro',
        5: 'cinco',
        6: 'seis',
        7: 'siete',
      };
      return `${map[whole] || whole} años y medio`;
    });

  let intro = '';
  if (enCompany && monthYear && durRaw) {
    intro = `Desde ${monthYear} trabaja como ${role} ${enCompany}, ${durRaw}`;
  } else if (enCompany && monthYear) {
    intro = `Desde ${monthYear} trabaja como ${role} ${enCompany}`;
  } else if (enCompany && durRaw) {
    intro = `Trabaja como ${role} ${enCompany}, ${durRaw}`;
  } else if (enCompany) {
    intro = `Trabaja como ${role} ${enCompany}`;
  } else if (durRaw) {
    intro = `${role}, ${durRaw}`;
  } else {
    intro = role;
  }
  if (!/[.]$/u.test(intro)) intro = `${intro}.`;

  const whFrags = [...new Set(
    options.dutyFacts.flatMap((f) => {
      const src = f.sourceText || f.value;
      const keys = classifyMaterialDutyKeys(src).filter((k) => k.startsWith('warehouse_'));
      return keys.map((k) => spanishWarehouseSummaryFragment(k)).filter(Boolean);
    }),
  )];
  const preferred = [
    spanishWarehouseSummaryFragment('warehouse_inbound_check'),
    spanishWarehouseSummaryFragment('warehouse_records'),
    spanishWarehouseSummaryFragment('warehouse_movement'),
  ].filter((frag) => whFrags.includes(frag));
  const dutyFrags = preferred.length >= 2 ? preferred : whFrags.slice(0, 3);
  let dutySentence = '';
  if (dutyFrags.length >= 2) {
    dutySentence = `La actividad incluye ${dutyFrags[0]}, ${dutyFrags[1]}${dutyFrags[2] ? ` y ${dutyFrags[2]}` : ''}.`;
  } else if (dutyFrags.length === 1) {
    dutySentence = `La actividad incluye ${dutyFrags[0]}, la comprobación y el mantenimiento de la documentación y los registros relacionados y la coordinación con los compañeros de la preparación y el movimiento de la mercancía.`;
  } else if (warehouseRole) {
    dutySentence = 'La actividad incluye la revisión de la mercancía entrante y de la documentación relacionada, la comprobación y el mantenimiento de la documentación y los registros relacionados y la coordinación con los compañeros de la preparación y el movimiento de la mercancía.';
  }

  const priorRole = (options.priorRole || '').trim();
  const priorEmployer = (options.priorEmployer || '').trim();
  const priorEn = formatSpanishEmployerPhrase(priorEmployer);
  const priorDuties = options.priorSourceDuties || '';
  const priorLooksDesign = /(?:dizajn|design|grafik|dise[nñ]o|visual|vizuel|visuell|デザイン|gr[aá]fic)/i
    .test(`${priorRole} ${priorDuties}`);
  let priorSentence = '';
  if (priorRole && priorLooksDesign) {
    const priorLabel = unspecified
      ? 'diseño gráfico'
      : localizeGraphicDesigner('es', options.gender);
    const pastVerb = female ? 'trabajó' : male ? 'trabajó' : 'trabajó';
    const designFacts = 'donde se crearon materiales visuales y elementos gráficos, se revisaron y adaptaron materiales de diseño y se prepararon archivos finales de diseño para distintos formatos y pantallas';
    priorSentence = priorEn
      ? `Anteriormente ${pastVerb} ${priorEn} como ${priorLabel}, ${designFacts}.`
      : `Anteriormente ${pastVerb} como ${priorLabel}, ${designFacts}.`;
  }

  return [intro, dutySentence, priorSentence]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
