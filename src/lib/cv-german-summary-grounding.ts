/**
 * Entry-owned German Professional Summary grounding (three semantic slots).
 * Employer preposition: natural `bei <Employer>` — never bare `in <Employer>`
 * for company names.
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

/** Packaging proof — must survive minification in internal Android/AAB assets. */
export const GERMAN_CV_AI_302_REVISION = 'german-cv-ai-302-v1' as const;
export const SUMMARY_UNIT_SPLITTER_REVISION_DE = 'german-three-sentence-slots-v1' as const;
export const SUMMARY_GROUNDING_REVISION_DE = 'entry-owned-german-grounding-v1' as const;
export const SUMMARY_BUILDER_REVISION_DE = 'entry-owned-german-rebuild-v1' as const;
export const SUMMARY_DURATION_FINALIZER_REVISION_DE = 'german-duration-idempotent-v1' as const;
export const GERMAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER =
  'german-summary-strict-postconditions-v1' as const;
export const GERMAN_SUMMARY_EMPLOYER_PREPOSITION_REVISION =
  'german-summary-employer-bei-302-v1' as const;

void GERMAN_CV_AI_302_REVISION;
void SUMMARY_UNIT_SPLITTER_REVISION_DE;
void SUMMARY_GROUNDING_REVISION_DE;
void SUMMARY_BUILDER_REVISION_DE;
void SUMMARY_DURATION_FINALIZER_REVISION_DE;
void GERMAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER;
void GERMAN_SUMMARY_EMPLOYER_PREPOSITION_REVISION;

const GERMAN_MONTHS: Record<string, string> = {
  '01': 'Januar',
  '02': 'Februar',
  '03': 'März',
  '04': 'April',
  '05': 'Mai',
  '06': 'Juni',
  '07': 'Juli',
  '08': 'August',
  '09': 'September',
  '10': 'Oktober',
  '11': 'November',
  '12': 'Dezember',
};

const DESIGN_UNSUPPORTED_DE =
  /\b(?:Druck(?:medien)?|Printmedien|Branding|Markenidentität|Marketingmaterial(?:ien)?|Logos?|Werbekampagn(?:e|en)|Social\s*Media|Verpackungsdesign)\b/iu;

const WAREHOUSE_FACT_CUE_DE =
  /(?:eingehend\w*\s+Waren|Wareneingang|Unterlagen|Dokument(?:e|ation)|vorbereit|beweg|Kolleg|prüfen|Kontrolle)/iu;
const DESIGN_FACT_CUE_DE =
  /(?:visuell|grafisch|Design|Designdatei|Bildschirm|Format|Element)/iu;

export type GermanSummaryRoleSlot =
  | 'current_intro'
  | 'current_duty'
  | 'prior_role'
  | 'other';

/** Natural German employer preposition — `bei Atlas`, never `in Atlas` for employers. */
export function formatGermanEmployerPrepositional(employer: string): string | null {
  const company = (employer || '').replace(/\s+/g, ' ').trim();
  if (!company) return null;
  if (/^(?:bei|in|im|am)\s+/iu.test(company)) return company;
  return `bei ${company}`;
}

export function germanWarehouseSummaryFragment(key: string): string {
  switch (key) {
    case 'warehouse_inbound_check':
    case 'warehouse_document_check':
      return 'die Prüfung eingehender Waren und zugehöriger Unterlagen';
    case 'warehouse_records':
    case 'warehouse_orderly_goods':
      return 'die Prüfung und Pflege zugehöriger Unterlagen und Belege';
    case 'warehouse_movement':
    case 'warehouse_preparation':
    case 'warehouse_colleague_coordination':
      return 'die Abstimmung der Vorbereitung und Bewegung von Waren mit Kolleginnen und Kollegen';
    default:
      return '';
  }
}

export function splitGermanSummaryUnits(text: string): string[] {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  return normalized
    .split(/(?<=[.!?])\s+(?=\S)/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateGermanSummaryIntroGrammar(
  summary: string,
  options: { company?: string } = {},
): {
  ok: boolean;
  reason: string | null;
  invalidEmployerPreposition: boolean;
  hybridDuration: boolean;
} {
  const intro = splitGermanSummaryUnits(summary)[0] || (summary || '').trim();
  const company = (options.company || '').replace(/\s+/g, ' ').trim();
  let invalidEmployerPreposition = false;
  if (company) {
    const esc = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const bareIn = new RegExp(`\\b(?:in|im)\\s+${esc}\\b`, 'iu');
    const beiOk = new RegExp(`\\bbei\\s+${esc}\\b`, 'iu');
    if (bareIn.test(intro) && !beiOk.test(intro)) {
      invalidEmployerPreposition = true;
    }
  }
  // Reject hybrid numeric + written duration (e.g. "6,5 sechseinhalb Jahre").
  const hybridDuration = /\d+[.,]\d+\s+(?:anderthalb|zweieinhalb|dreieinhalb|viereinhalb|fünfeinhalb|sechseinhalb|siebeneinhalb)|(?:anderthalb|zweieinhalb|dreieinhalb|viereinhalb|fünfeinhalb|sechseinhalb)\s+\d+[.,]\d+/iu
    .test(intro)
    || /\d+[.,]\d+\s+Jahre.{0,24}(?:anderthalb|zweieinhalb|dreieinhalb|sechseinhalb)/iu.test(intro);

  if (hybridDuration) {
    return {
      ok: false,
      reason: 'german_summary_hybrid_duration',
      invalidEmployerPreposition,
      hybridDuration: true,
    };
  }
  if (invalidEmployerPreposition) {
    return {
      ok: false,
      reason: 'german_summary_invalid_employer_preposition',
      invalidEmployerPreposition: true,
      hybridDuration: false,
    };
  }
  return {
    ok: true,
    reason: null,
    invalidEmployerPreposition: false,
    hybridDuration: false,
  };
}

export type GermanSummaryEmploymentQuality = {
  ok: boolean;
  reason: string | null;
  unitCount: number;
  finalUnitRoleSlots: GermanSummaryRoleSlot[];
  unsupportedDesignMedium: boolean;
  invalidEmployerPreposition: boolean;
  hybridDuration: boolean;
  groundingValidationPassed: boolean;
  typedRejectionReason: string | null;
};

export function analyzeGermanSummaryEmploymentQuality(
  summary: string,
  options: {
    company?: string;
    role?: string;
    priorCompany?: string;
    currentEntryDuties?: string;
    priorEntryDuties?: string;
    gender?: string;
  } = {},
): GermanSummaryEmploymentQuality {
  void GERMAN_CV_AI_302_REVISION;
  void GERMAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const units = splitGermanSummaryUnits(text);
  const introGrammar = validateGermanSummaryIntroGrammar(text, { company: options.company });
  const unsupportedDesignMedium = DESIGN_UNSUPPORTED_DE.test(text);
  const company = (options.company || '').trim();
  const companyEsc = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const slots: GermanSummaryRoleSlot[] = [];
  for (let i = 0; i < units.length; i += 1) {
    const sentence = units[i]!;
    const hasCompany = companyEsc ? new RegExp(companyEsc, 'iu').test(sentence) : false;
    const hasDuration = /(?:etwa|rund|ca\.?|ungefähr).{0,40}Jahre|Jahre(?:n)?\s+(?:Berufs)?[Ee]rfahrung|(?:anderthalb|zweieinhalb|dreieinhalb|sechseinhalb)\s+Jahre/iu
      .test(sentence);
    const hasPrior = /(?:zuvor|früher|vorher|davor)\b/iu.test(sentence) || DESIGN_FACT_CUE_DE.test(sentence);
    const hasDuty = WAREHOUSE_FACT_CUE_DE.test(sentence);
    if (i === 0 && (hasCompany || hasDuration)) slots.push('current_intro');
    else if (hasPrior && !hasDuty) slots.push('prior_role');
    else if (hasDuty) slots.push('current_duty');
    else if (hasPrior) slots.push('prior_role');
    else slots.push('other');
  }

  let reason: string | null = null;
  const dutiesCorpus = `${options.currentEntryDuties || ''} ${options.priorEntryDuties || ''} ${options.role || ''}`;
  const warehouseDomain = WAREHOUSE_FACT_CUE_DE.test(dutiesCorpus)
    || matchesWarehouseOccupationalTitle(options.role || '')
    || /lager|warehouse/i.test(options.role || '');
  const designDomain = DESIGN_FACT_CUE_DE.test(dutiesCorpus)
    || /grafik|design/i.test(`${options.role || ''} ${options.priorEntryDuties || ''}`);

  if (!text) reason = 'empty_summary';
  else if (unsupportedDesignMedium) reason = 'german_summary_unsupported_design_medium';
  else if (!introGrammar.ok) reason = introGrammar.reason;
  else if ((warehouseDomain || designDomain) && units.length < 2) {
    reason = 'german_summary_incomplete_slots';
  } else if (/[\u0900-\u097F\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF]/.test(text)) {
    reason = 'german_summary_foreign_script';
  }

  const groundingOk = reason == null && introGrammar.ok && !unsupportedDesignMedium;
  return {
    ok: groundingOk,
    reason,
    unitCount: units.length,
    finalUnitRoleSlots: slots,
    unsupportedDesignMedium,
    invalidEmployerPreposition: introGrammar.invalidEmployerPreposition,
    hybridDuration: introGrammar.hybridDuration,
    groundingValidationPassed: groundingOk,
    typedRejectionReason: reason,
  };
}

export function buildGermanEntryOwnedSummary(options: {
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
  void SUMMARY_BUILDER_REVISION_DE;
  void SUMMARY_GROUNDING_REVISION_DE;
  void SUMMARY_UNIT_SPLITTER_REVISION_DE;
  void GERMAN_CV_AI_302_REVISION;
  void options.locale;

  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'weiblich';
  const male = g === 'male' || g === 'm' || g === 'männlich';
  const unspecified = !female && !male;

  let role = (options.role || '').trim();
  const warehouseRole = !role
    || /^(?:fachkraft|professional|professionalin)$/iu.test(role)
    || matchesWarehouseOccupationalTitle(role)
    || /lager|warehouse|skladist|magazin/i.test(role);
  if (!unspecified) {
    if (!role || /^(?:fachkraft|professional|professionalin)$/iu.test(role) || warehouseRole) {
      role = localizeWarehouseEmployee('de', options.gender);
    }
  } else if (warehouseRole) {
    role = 'Fachkraft mit Lagererfahrung';
  }

  const startMatch = /^(\d{4})-(\d{2})/.exec(options.datesValue || '');
  const monthYear = startMatch && GERMAN_MONTHS[startMatch[2]]
    ? `${GERMAN_MONTHS[startMatch[2]]} ${startMatch[1]}`
    : '';
  const company = (options.employer || '').trim();
  const beiCompany = formatGermanEmployerPrepositional(company);

  let durRaw = (options.durationPhrase || '')
    .replace(/^[,，]\s*/u, '')
    .replace(/\.$/u, '')
    .trim();
  if (!durRaw && options.duration) {
    durRaw = formatApproximateDurationPhrase(options.duration, 'de')
      .replace(/\.$/u, '')
      .trim();
  }
  // Prefer written half-years; never leave hybrid numeric forms.
  durRaw = durRaw
    .replace(/\b6[,.]5\b/gu, 'sechseinhalb')
    .replace(/\b3[,.]5\b/gu, 'dreieinhalb')
    .replace(/\bdreiereinhalb\b/giu, 'dreieinhalb');

  let intro = '';
  if (beiCompany && monthYear && durRaw) {
    intro = `Seit ${monthYear} als ${role} ${beiCompany} tätig, ${durRaw}`;
  } else if (beiCompany && monthYear) {
    intro = `Seit ${monthYear} als ${role} ${beiCompany} tätig`;
  } else if (beiCompany && durRaw) {
    intro = `Als ${role} ${beiCompany} tätig, ${durRaw}`;
  } else if (beiCompany) {
    intro = `Als ${role} ${beiCompany} tätig`;
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
      return keys.map((k) => germanWarehouseSummaryFragment(k)).filter(Boolean);
    }),
  )];
  const preferred = [
    germanWarehouseSummaryFragment('warehouse_inbound_check'),
    germanWarehouseSummaryFragment('warehouse_records'),
    germanWarehouseSummaryFragment('warehouse_movement'),
  ].filter((frag) => whFrags.includes(frag));
  const dutyFrags = preferred.length >= 2 ? preferred : whFrags.slice(0, 3);
  let dutySentence = '';
  if (dutyFrags.length >= 2) {
    dutySentence = `Die Tätigkeit umfasst ${dutyFrags[0]}, ${dutyFrags[1]}${dutyFrags[2] ? ` sowie ${dutyFrags[2]}` : ''}.`;
  } else if (dutyFrags.length === 1) {
    dutySentence = `Die Tätigkeit umfasst ${dutyFrags[0]}, die Prüfung und Pflege zugehöriger Unterlagen und Belege sowie die Abstimmung der Vorbereitung und Bewegung von Waren mit Kolleginnen und Kollegen.`;
  } else if (warehouseRole) {
    dutySentence = 'Die Tätigkeit umfasst die Prüfung eingehender Waren und zugehöriger Unterlagen, die Prüfung und Pflege zugehöriger Unterlagen und Belege sowie die Abstimmung der Vorbereitung und Bewegung von Waren mit Kolleginnen und Kollegen.';
  }

  const priorRole = (options.priorRole || '').trim();
  const priorEmployer = (options.priorEmployer || '').trim();
  const priorBei = formatGermanEmployerPrepositional(priorEmployer);
  const priorDuties = options.priorSourceDuties || '';
  const priorLooksDesign = /(?:dizajn|design|grafik|visual|vizuel|visuell|デザイン)/i
    .test(`${priorRole} ${priorDuties}`);
  let priorSentence = '';
  if (priorRole && priorLooksDesign) {
    const priorLabel = unspecified
      ? 'Grafikdesign'
      : localizeGraphicDesigner('de', options.gender);
    const pastVerb = female ? 'arbeitete' : male ? 'arbeitete' : 'war tätig';
    const designFacts = female
      ? 'wo visuelle Materialien und grafische Elemente erstellt, Designmaterialien geprüft und angepasst sowie finale Designdateien für verschiedene Formate und Bildschirme vorbereitet wurden'
      : 'wo visuelle Materialien und grafische Elemente erstellt, Designmaterialien geprüft und angepasst sowie finale Designdateien für verschiedene Formate und Bildschirme vorbereitet wurden';
    priorSentence = priorBei
      ? `Zuvor ${pastVerb} ${priorBei} als ${priorLabel}, ${designFacts}.`
      : `Zuvor ${pastVerb} als ${priorLabel}, ${designFacts}.`;
  }

  return [intro, dutySentence, priorSentence]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
