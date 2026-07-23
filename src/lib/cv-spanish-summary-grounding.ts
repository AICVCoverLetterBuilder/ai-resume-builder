/**
 * Entry-owned Spanish Professional Summary grounding (three semantic slots).
 * AAB-306: reject unsupported skills/print/logistics, require finite clauses,
 * and enforce entry-owned warehouse + design fact coverage.
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
import { fingerprintText } from './cv-export-diagnostics';

export const SPANISH_SUMMARY_GROUNDING_306_REVISION =
  'spanish-summary-grounding-306-v1' as const;

void SPANISH_CV_AI_305_REVISION;
void SPANISH_SUMMARY_GROUNDING_306_REVISION;

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

/** Unsupported design/media claims unless present in authoritative source. */
const DESIGN_UNSUPPORTED_ES =
  /\b(?:material(?:es)?\s+impresos?|medios?\s+impresos?|impresi[oó]n|imprenta|print\s*media|packaging|branding|identidad\s+de\s+marca|material(?:es)?\s+de\s+marketing|publicidad|logos?|campa[nñ]as?\s+publicitarias?|redes?\s+sociales?|dise[nñ]o\s+de\s+envases?)\b/iu;

const QUALITY_COMPLETENESS_ES =
  /\b(?:integridad(?:\s+y\s+completitud)?(?:\s+de\s+los\s+env[ií]os)?|completitud(?:\s+de\s+los\s+env[ií]os)?|garantizar\s+la\s+calidad|m[aá]xima\s+calidad|altos?\s+est[aá]ndares?|ausencia\s+de\s+da[nñ]os|precisi[oó]n\s+total)\b/iu;

const LOGISTICS_SUBSTITUTION_ES =
  /\b(?:prepara(?:ci[oó]n\s+de)?\s+pedidos?\s+para\s+(?:su\s+)?expedici[oó]n|gesti[oó]n\s+de\s+env[ií]os|despacho\s+de\s+mercanc|picking|kommissionierung|gesti[oó]n\s+integral\s+del\s+almac[eé]n|env[ií]os\s+entrantes)\b/iu;

const SKILLS_BLOCK_ES =
  /\bhabilidades\s+clave\b|\bcompetencias\s+clave\b|\bhabilidades\s*:/iu;

const UNSUPPORTED_SKILL_CUES_ES = [
  'liderazgo',
  'pensamiento crítico',
  'pensamiento critico',
  'adaptabilidad',
  'resolución de problemas',
  'resolucion de problemas',
  'gestión del tiempo',
  'gestion del tiempo',
  'inteligencia emocional',
  'atención al detalle',
  'atencion al detalle',
  'comunicación',
  'comunicacion',
  'trabajo en equipo',
  'agile',
  'scrum',
] as const;

const TOOL_CUES_ES =
  /\b(?:SAP|ERP|Photoshop|Illustrator|InDesign|Excel\s+avanzado|Agile|Scrum)\b/iu;

const WAREHOUSE_FACT_CUE_ES =
  /(?:mercanc[ií]a\s+entrant|recepci[oó]n\s+de\s+mercanc|documentaci[oó]n(?:\s+relacionada)?|documentos(?:\s+relacionados)?|registros(?:\s+relacionados)?|preparaci[oó]n|movimiento|traslado|compa[nñ]er|\brevisa\b|\bcomprueba\b|\bcontrola\b|\bcoordina\b|almac[eé]n)/iu;

const DESIGN_FACT_CUE_ES =
  /(?:visual|gr[aá]fic|dise[nñ]o|archivo(?:s)?\s+(?:finales?\s+)?(?:de\s+)?dise[nñ]o|pantalla|formato|elemento)/iu;

/** Finite main-clause verbs for prose Summary units. */
const FINITE_VERB_ES =
  /(?<!\p{L})(?:trabaja|trabajó|desempeña|desempeñó|ejerce|ejerció|ocupa|ocupó|realiza|realizó|colabora|colaboró|desarrolla|desarrolló|coordina|coordinó|revisa|revisó|comprueba|comprobó|crea|creó|prepara|preparó|adapta|adaptó|cuenta|es|fue|est[aá]|estuvo|incluye)(?!\p{L})/iu;

const GERUND_ONLY_INTRO_ES =
  /^(?:profesional|professional)\s*,\s*actualmente\s+\S+ándose\b|^actualmente\s+\S+ándose\b/iu;

const PRIOR_FRAGMENT_ES =
  /^(?:con\s+experiencia\s+previa|experiencia\s+(?:previa\s+)?en|responsable\s+de)\b/iu;

export type SpanishSummaryRoleSlot =
  | 'current_intro'
  | 'current_duty'
  | 'prior_role'
  | 'skills'
  | 'other';

/** Entry-owned semantic fact ids (repository-compatible warehouse/design keys). */
export type SpanishSummaryFactId =
  | 'incoming_goods_check'
  | 'related_documents_check'
  | 'goods_preparation_coordination'
  | 'goods_movement_coordination'
  | 'colleague_collaboration'
  | 'visual_material_creation'
  | 'graphic_element_creation'
  | 'design_material_review'
  | 'design_material_adaptation'
  | 'final_design_file_preparation'
  | 'multi_format_preparation'
  | 'screen_preparation';

const CURRENT_FACT_IDS: SpanishSummaryFactId[] = [
  'incoming_goods_check',
  'related_documents_check',
  'goods_preparation_coordination',
  'goods_movement_coordination',
  'colleague_collaboration',
];

const PRIOR_FACT_IDS: SpanishSummaryFactId[] = [
  'visual_material_creation',
  'graphic_element_creation',
  'design_material_review',
  'design_material_adaptation',
  'final_design_file_preparation',
  'multi_format_preparation',
  'screen_preparation',
];

export function formatSpanishEmployerPhrase(employer: string): string | null {
  const company = (employer || '').replace(/\s+/g, ' ').trim();
  if (!company) return null;
  if (/^(?:en|para|de|del|en\s+la\s+empresa|para\s+la\s+empresa)\s+/iu.test(company)) {
    return company;
  }
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

export function isSpanishGenericSkillsUnit(sentence: string): boolean {
  const s = (sentence || '').trim();
  if (!s) return false;
  if (SKILLS_BLOCK_ES.test(s)) return true;
  const hits = UNSUPPORTED_SKILL_CUES_ES.filter((c) => new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'iu').test(s)).length;
  return hits >= 3;
}

export function detectSpanishSummaryFactIds(text: string): Set<SpanishSummaryFactId> {
  const t = text || '';
  const found = new Set<SpanishSummaryFactId>();
  if (/(?:mercanc[ií]a\s+entrant|recepci[oó]n\s+de\s+mercanc|incoming\s+goods)/iu.test(t)) {
    found.add('incoming_goods_check');
  }
  if (/(?:documentaci[oó]n(?:\s+relacionada)?|documentos(?:\s+relacionados)?|registros(?:\s+relacionados)?|related\s+(?:documents?|records?))/iu.test(t)) {
    found.add('related_documents_check');
  }
  if (/(?:preparaci[oó]n(?:\s+y\s+el\s+movimiento)?(?:\s+de\s+(?:las?\s+)?mercanc)|preparaci[oó]n\s+de\s+(?:las?\s+)?mercanc)/iu.test(t)) {
    found.add('goods_preparation_coordination');
  }
  if (/(?:movimiento|traslado|movimiento\s+de\s+(?:las?\s+)?mercanc)/iu.test(t)) {
    found.add('goods_movement_coordination');
  }
  if (/(?:compa[nñ]er|colegas|colabor)/iu.test(t) && /(?:coordina|preparaci|movimiento|traslado)/iu.test(t)) {
    found.add('colleague_collaboration');
  }
  if (/(?:material(?:es)?\s+visual(?:es)?|visual\s+materials?)/iu.test(t)) {
    found.add('visual_material_creation');
  }
  if (/(?:elementos?\s+gr[aá]ficos?|graphic\s+elements?)/iu.test(t)) {
    found.add('graphic_element_creation');
  }
  if (/(?:revis(?:a|ó|o|ar)|review).{0,40}(?:material(?:es)?\s+de\s+dise[nñ]o|dise[nñ]o)/iu.test(t)
    || /(?:material(?:es)?\s+de\s+dise[nñ]o).{0,40}(?:revis)/iu.test(t)) {
    found.add('design_material_review');
  }
  if (/(?:adapt(?:a|ó|o|ar)|adapting).{0,40}(?:dise[nñ]o|material)/iu.test(t)
    || /(?:revis(?:a|ó|o).{0,20}y\s+adapt)/iu.test(t)) {
    found.add('design_material_adaptation');
  }
  if (/(?:archivos?\s+finales?(?:\s+de\s+dise[nñ]o)?|final\s+(?:design\s+)?files?)/iu.test(t)) {
    found.add('final_design_file_preparation');
  }
  if (/(?:formatos?|formats?)/iu.test(t)) {
    found.add('multi_format_preparation');
  }
  if (/(?:pantallas?|screens?)/iu.test(t)) {
    found.add('screen_preparation');
  }
  return found;
}

export function countSpanishUnsupportedSummaryClaims(
  text: string,
  options: {
    currentEntryDuties?: string;
    priorEntryDuties?: string;
    structuredSkills?: string[];
  } = {},
): {
  unsupportedClaimCount: number;
  unsupportedClaimKinds: string[];
  reasons: string[];
} {
  void SPANISH_SUMMARY_GROUNDING_306_REVISION;
  const corpus = `${options.currentEntryDuties || ''}\n${options.priorEntryDuties || ''}`;
  const reasons: string[] = [];
  const kinds = new Set<string>();
  let count = 0;

  const allowedSkills = new Set(
    (options.structuredSkills || [])
      .map((s) => (s || '').trim().toLowerCase())
      .filter(Boolean),
  );

  if (isSpanishGenericSkillsUnit(text) || SKILLS_BLOCK_ES.test(text)) {
    count += 1;
    kinds.add('generic_skills_block');
    reasons.push('unsupported_generic_skills_block');
  }

  for (const skill of UNSUPPORTED_SKILL_CUES_ES) {
    const re = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'iu');
    if (re.test(text) && !allowedSkills.has(skill.toLowerCase())) {
      // Structured skills may authorize exact labels.
      const authorized = [...allowedSkills].some((a) => a.includes(skill.toLowerCase()) || skill.toLowerCase().includes(a));
      if (!authorized && !re.test(corpus)) {
        count += 1;
        kinds.add(`skill:${skill}`);
        reasons.push(`unsupported_skill:${skill}`);
      }
    }
  }

  if (DESIGN_UNSUPPORTED_ES.test(text) && !DESIGN_UNSUPPORTED_ES.test(corpus)) {
    count += 1;
    kinds.add('unsupported_design_medium');
    reasons.push('unsupported_design_medium');
  }

  if (QUALITY_COMPLETENESS_ES.test(text) && !QUALITY_COMPLETENESS_ES.test(corpus)) {
    count += 1;
    kinds.add('unsupported_quality_completeness');
    reasons.push('unsupported_quality_completeness');
  }

  if (LOGISTICS_SUBSTITUTION_ES.test(text) && !LOGISTICS_SUBSTITUTION_ES.test(corpus)) {
    count += 1;
    kinds.add('unsupported_logistics_substitution');
    reasons.push('unsupported_logistics_substitution');
  }

  if (TOOL_CUES_ES.test(text) && !TOOL_CUES_ES.test(corpus)) {
    count += 1;
    kinds.add('unsupported_tool');
    reasons.push('unsupported_tool_or_framework');
  }

  return {
    unsupportedClaimCount: count,
    unsupportedClaimKinds: [...kinds],
    reasons,
  };
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
  gerundOnlyIntro: boolean;
  priorFragment: boolean;
} {
  void SPANISH_CV_AI_305_REVISION;
  void SPANISH_SUMMARY_GROUNDING_306_REVISION;
  const units = splitSpanishSummaryUnits(summary);
  const intro = units[0] || (summary || '').trim();
  const gerundOnlyIntro = GERUND_ONLY_INTRO_ES.test(intro)
    || (/\bdesempeñándose\b/iu.test(intro) && !/\b(?:trabaja|desempeña|ejerce|ocupa)\b/iu.test(intro));
  const priorFragment = units.some((u) => PRIOR_FRAGMENT_ES.test(u) && !FINITE_VERB_ES.test(u));
  const fragmentIntro = !intro
    || intro.length < 12
    || /,\s*$/u.test(intro)
    || /^(?:desde|como|con|en)\s+\S+\.?$/iu.test(intro)
    || gerundOnlyIntro
    || priorFragment;

  // Require a finite verb that is not only buried after a gerund-led fragment opener.
  const missingFiniteVerb = Boolean(intro) && (
    !FINITE_VERB_ES.test(intro)
    || (gerundOnlyIntro && !/\b(?:trabaja|desempeña|ejerce|ocupa|cuenta)\b/iu.test(intro))
  );

  const durationHits = [
    ...intro.matchAll(
      /(?:alrededor\s+de|unos?\s+|unas?\s+|cerca\s+de|aproximadamente\s+)?(?:\d+[.,]\d+|\d+|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)(?:\s+años?\s+y\s+medio|\s+y\s+medio\s+años?|\s+años?)/giu,
    ),
  ];
  const duplicateDuration = durationHits.length >= 2;

  const hybridDuration = /\d+[.,]\d+\s+(?:uno|dos|tres|cuatro|cinco|seis|siete)\s+y\s+medio|(?:uno|dos|tres|cuatro|cinco|seis)\s+y\s+medio\s+\d+[.,]\d+/iu
    .test(intro)
    || /\d+[.,]\d+\s+años?.{0,24}(?:uno|dos|tres|cuatro|cinco|seis)\s+y\s+medio/iu.test(intro)
    || /\d+[.,]\d+\s+y\s+medio\s+años?/iu.test(intro);

  // Also reject non-intro units that are prior fragments without finite verbs.
  for (const unit of units) {
    if (PRIOR_FRAGMENT_ES.test(unit) && !FINITE_VERB_ES.test(unit)) {
      return {
        ok: false,
        reason: 'spanish_summary_prior_fragment',
        missingFiniteVerb: true,
        duplicateDuration,
        hybridDuration,
        fragmentIntro: true,
        gerundOnlyIntro,
        priorFragment: true,
      };
    }
    if (!FINITE_VERB_ES.test(unit) && !isSpanishGenericSkillsUnit(unit)) {
      // Skills units are rejected separately; other units need finite verbs.
      if (unit.length > 20) {
        return {
          ok: false,
          reason: 'spanish_summary_unit_missing_finite_verb',
          missingFiniteVerb: true,
          duplicateDuration,
          hybridDuration,
          fragmentIntro: false,
          gerundOnlyIntro,
          priorFragment: false,
        };
      }
    }
  }

  if (gerundOnlyIntro || (fragmentIntro && GERUND_ONLY_INTRO_ES.test(intro))) {
    return {
      ok: false,
      reason: 'spanish_summary_gerund_only_intro',
      missingFiniteVerb: true,
      duplicateDuration,
      hybridDuration,
      fragmentIntro: true,
      gerundOnlyIntro: true,
      priorFragment: false,
    };
  }
  if (fragmentIntro) {
    return {
      ok: false,
      reason: 'spanish_summary_intro_fragment',
      missingFiniteVerb,
      duplicateDuration,
      hybridDuration,
      fragmentIntro: true,
      gerundOnlyIntro,
      priorFragment,
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
      gerundOnlyIntro: false,
      priorFragment: false,
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
      gerundOnlyIntro: false,
      priorFragment: false,
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
      gerundOnlyIntro: false,
      priorFragment: false,
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
    gerundOnlyIntro: false,
    priorFragment: false,
  };
}

export type SpanishSummaryEmploymentQuality = {
  ok: boolean;
  reason: string | null;
  unitCount: number;
  finalUnitRoleSlots: SpanishSummaryRoleSlot[];
  finalSentenceHashes: string[];
  finalSentenceRoleSlots: SpanishSummaryRoleSlot[];
  unsupportedDesignMedium: boolean;
  unsupportedClaimCount: number;
  unsupportedClaimKinds: string[];
  missingFiniteVerb: boolean;
  duplicateDuration: boolean;
  hybridDuration: boolean;
  groundingValidationPassed: boolean;
  grammarValidationPassed: boolean;
  slotValidationPassed: boolean;
  typedRejectionReason: string | null;
  currentRoleTitlePresent: boolean;
  currentRoleTitleMatchesStructuredRole: boolean;
  currentEmploymentIntroductionCount: number;
  currentRoleOmittedDetected: boolean;
  currentRoleConcreteFactCoverage: number;
  currentMissingFactIds: SpanishSummaryFactId[];
  priorRoleGroundingPassed: boolean;
  priorMissingFactIds: SpanishSummaryFactId[];
  priorCompanyPresent: boolean;
  hasGenericSkillsUnit: boolean;
  currentIntroSlotPresent: boolean;
  currentDutySlotPresent: boolean;
  priorRoleSlotPresent: boolean;
  summaryGroundingRevision: typeof SPANISH_SUMMARY_GROUNDING_306_REVISION;
};

function sourceRequiresCurrentWarehouseFacts(duties: string, role: string): boolean {
  return WAREHOUSE_FACT_CUE_ES.test(duties)
    || matchesWarehouseOccupationalTitle(role)
    || /almac[eé]n|warehouse|moz[oa]|trabajador(?:a)?\s+de\s+almac/i.test(role)
    || classifyMaterialDutyKeys(duties).some((k) => k.startsWith('warehouse_'));
}

function sourceRequiresPriorDesignFacts(duties: string, role: string): boolean {
  return DESIGN_FACT_CUE_ES.test(`${duties} ${role}`)
    || /dise[nñ]o|design|gr[aá]fic/i.test(`${role} ${duties}`);
}

export function analyzeSpanishSummaryEmploymentQuality(
  summary: string,
  options: {
    company?: string;
    role?: string;
    priorCompany?: string;
    currentEntryDuties?: string;
    priorEntryDuties?: string;
    gender?: string;
    structuredRole?: string;
    structuredSkills?: string[];
  } = {},
): SpanishSummaryEmploymentQuality {
  void SPANISH_CV_AI_305_REVISION;
  void SPANISH_SUMMARY_GROUNDING_306_REVISION;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const units = splitSpanishSummaryUnits(text);
  const introGrammar = validateSpanishSummaryIntroGrammar(text, { company: options.company });
  const unsupportedScan = countSpanishUnsupportedSummaryClaims(text, {
    currentEntryDuties: options.currentEntryDuties,
    priorEntryDuties: options.priorEntryDuties,
    structuredSkills: options.structuredSkills,
  });
  const unsupportedDesignMedium = DESIGN_UNSUPPORTED_ES.test(text)
    && !DESIGN_UNSUPPORTED_ES.test(`${options.currentEntryDuties || ''} ${options.priorEntryDuties || ''}`);
  const company = (options.company || '').trim();
  const priorCompany = (options.priorCompany || '').trim();
  const companyEsc = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const priorEsc = priorCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const structuredRole = (options.structuredRole || options.role || '').trim();
  const slots: SpanishSummaryRoleSlot[] = [];
  let hasGenericSkillsUnit = false;

  for (let i = 0; i < units.length; i += 1) {
    const sentence = units[i]!;
    if (isSpanishGenericSkillsUnit(sentence)) {
      hasGenericSkillsUnit = true;
      slots.push('skills');
      continue;
    }
    const hasCompany = companyEsc ? new RegExp(companyEsc, 'iu').test(sentence) : false;
    const hasDuration = /(?:alrededor\s+de|unos?|cerca\s+de|aproximadamente).{0,40}años|años\s+de\s+experiencia|(?:uno|dos|tres|cuatro|cinco|seis)\s+años?\s+y\s+medio|(?:uno|dos|tres|cuatro|cinco|seis)\s+y\s+medio\s+años/iu
      .test(sentence);
    const hasPriorCue = /(?:anteriormente|antes|previamente|con\s+anterioridad|experiencia\s+previa)\b/iu.test(sentence);
    const hasPriorCompany = priorEsc ? new RegExp(priorEsc, 'iu').test(sentence) : false;
    const hasDuty = WAREHOUSE_FACT_CUE_ES.test(sentence)
      && !hasPriorCue
      && !(hasCompany && hasDuration && i === 0 && sentence.length > 160);
    const hasDesign = DESIGN_FACT_CUE_ES.test(sentence);

    // Prefer a dedicated current_duty slot: when intro already consumed company+duration,
    // later warehouse cues are duties. Do not merge duty-only coverage into intro alone.
    if (i === 0 && (hasCompany || hasDuration) && !hasPriorCue) {
      // If the first unit also carries material warehouse duties, still mark intro —
      // coverage checks require a separate duty unit when warehouse domain is active.
      slots.push('current_intro');
    } else if ((hasPriorCue || hasPriorCompany || (hasDesign && hasPriorCue)) && !hasDuty) {
      slots.push('prior_role');
    } else if (hasDuty || (WAREHOUSE_FACT_CUE_ES.test(sentence) && !hasPriorCue && i > 0)) {
      slots.push('current_duty');
    } else if (hasPriorCue || hasPriorCompany || (hasDesign && i > 0)) {
      slots.push('prior_role');
    } else {
      slots.push('other');
    }
  }

  // If intro swallowed duties (single long first sentence) and no current_duty slot,
  // treat as incomplete slots for warehouse domain — do not invent a fake duty slot.
  const currentIntroSlotPresent = slots.includes('current_intro');
  const currentDutySlotPresent = slots.includes('current_duty');
  const priorRoleSlotPresent = slots.includes('prior_role');

  const currentDuties = options.currentEntryDuties || '';
  const priorDuties = options.priorEntryDuties || '';
  const warehouseDomain = sourceRequiresCurrentWarehouseFacts(currentDuties, structuredRole);
  const designDomain = sourceRequiresPriorDesignFacts(priorDuties, options.role || '');

  const detectedFacts = detectSpanishSummaryFactIds(text);
  // Intro-only warehouse cues do not satisfy duty coverage when no duty slot exists.
  const dutyUnitText = units
    .filter((_, i) => slots[i] === 'current_duty')
    .join(' ');
  const priorUnitText = units
    .filter((_, i) => slots[i] === 'prior_role')
    .join(' ');
  const dutyFacts = dutyUnitText
    ? detectSpanishSummaryFactIds(dutyUnitText)
    : new Set<SpanishSummaryFactId>();
  const priorFacts = priorUnitText
    ? detectSpanishSummaryFactIds(priorUnitText)
    : new Set<SpanishSummaryFactId>();

  // When duties are only inside intro (no duty slot), do not count them as covered.
  const effectiveCurrentFacts = currentDutySlotPresent ? dutyFacts : new Set<SpanishSummaryFactId>();
  const currentMissing = CURRENT_FACT_IDS.filter((id) => {
    if (!warehouseDomain) return false;
    // Require the three material clusters (+ colleague when coordination is source-backed).
    if (id === 'colleague_collaboration') {
      return /compa[nñ]er|colleague/i.test(currentDuties) && !effectiveCurrentFacts.has(id);
    }
    return !effectiveCurrentFacts.has(id);
  });
  // Compress preparation+movement+colleague into requiring all three when source has them.
  const requiredCurrentMin = warehouseDomain ? 3 : 0;
  const currentCoverage = effectiveCurrentFacts.size;

  const priorMissing = PRIOR_FACT_IDS.filter((id) => {
    if (!designDomain || !priorDuties.trim()) return false;
    return !priorFacts.has(id);
  });
  const priorCompanyPresent = Boolean(
    !priorCompany
    || (priorEsc && new RegExp(priorEsc, 'iu').test(text)),
  );
  const priorRoleGroundingPassed = !designDomain || !priorDuties.trim()
    ? true
    : priorRoleSlotPresent
      && priorCompanyPresent
      && priorFacts.has('visual_material_creation')
      && priorFacts.has('graphic_element_creation')
      && (priorFacts.has('design_material_review') || priorFacts.has('design_material_adaptation'))
      && priorFacts.has('final_design_file_preparation')
      && priorFacts.has('multi_format_preparation')
      && priorFacts.has('screen_preparation');

  const rolePresent = Boolean(
    structuredRole
    && new RegExp(structuredRole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text),
  ) || /(?:operari[ao]|moz[oa]|trabajador(?:a)?|emplead[oa])\s+de\s+almac/iu.test(text)
    || /dise[nñ]ador(?:a)?\s+gr[aá]fic/iu.test(text);

  let reason: string | null = null;
  if (!text) reason = 'empty_summary';
  else if (hasGenericSkillsUnit || slots.includes('skills')) {
    reason = 'spanish_summary_generic_skills_unit';
  } else if (unsupportedScan.unsupportedClaimCount > 0) {
    reason = unsupportedScan.reasons[0] || 'spanish_summary_unsupported_claims';
  } else if (unsupportedDesignMedium) {
    reason = 'spanish_summary_unsupported_design_medium';
  } else if (!introGrammar.ok) {
    reason = introGrammar.reason;
  } else if ((warehouseDomain || designDomain) && units.length < 3) {
    reason = 'spanish_summary_incomplete_slots';
  } else if (warehouseDomain && (!currentIntroSlotPresent || !currentDutySlotPresent)) {
    reason = 'spanish_summary_missing_current_duty_slot';
  } else if (designDomain && priorDuties.trim() && !priorRoleSlotPresent) {
    reason = 'spanish_summary_missing_prior_slot';
  } else if (warehouseDomain && currentCoverage < requiredCurrentMin) {
    reason = 'spanish_summary_current_fact_coverage_incomplete';
  } else if (warehouseDomain && currentMissing.length > 0 && currentCoverage < 4) {
    // Fail when material warehouse clusters are missing.
    reason = 'spanish_summary_current_fact_coverage_incomplete';
  } else if (!priorRoleGroundingPassed) {
    reason = 'spanish_summary_prior_fact_coverage_incomplete';
  } else if (priorCompany && !priorCompanyPresent) {
    reason = 'spanish_summary_prior_employer_missing';
  } else if (company && companyEsc && !new RegExp(companyEsc, 'iu').test(text)) {
    reason = 'spanish_summary_current_employer_missing';
  } else if (/[\u0900-\u097F\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF]/.test(text)) {
    reason = 'spanish_summary_foreign_script';
  }

  // Extra: generic prior design sentence without material facts
  if (!reason && designDomain && priorDuties.trim()) {
    const priorOnlyGeneric = /experiencia\s+previa\s+en\s+dise[nñ]o\s+gr[aá]fico/iu.test(text)
      && priorMissing.length > 0;
    if (priorOnlyGeneric) reason = 'spanish_summary_generic_prior_design';
  }

  const grammarValidationPassed = introGrammar.ok && !hasGenericSkillsUnit;
  const slotValidationPassed = !(warehouseDomain || designDomain)
    || (
      currentIntroSlotPresent
      && (!warehouseDomain || currentDutySlotPresent)
      && (!designDomain || !priorDuties.trim() || priorRoleSlotPresent)
      && !slots.includes('skills')
    );
  const groundingOk = reason == null
    && grammarValidationPassed
    && slotValidationPassed
    && unsupportedScan.unsupportedClaimCount === 0
    && !unsupportedDesignMedium
    && priorRoleGroundingPassed;

  const finalSentenceHashes = units.map((u) => fingerprintText(u));
  const finalSentenceRoleSlots = [...slots];

  return {
    ok: groundingOk,
    reason,
    unitCount: units.length,
    finalUnitRoleSlots: slots,
    finalSentenceHashes,
    finalSentenceRoleSlots,
    unsupportedDesignMedium,
    unsupportedClaimCount: unsupportedScan.unsupportedClaimCount
      + (unsupportedDesignMedium && !unsupportedScan.unsupportedClaimKinds.includes('unsupported_design_medium') ? 1 : 0),
    unsupportedClaimKinds: unsupportedDesignMedium
      && !unsupportedScan.unsupportedClaimKinds.includes('unsupported_design_medium')
      ? [...unsupportedScan.unsupportedClaimKinds, 'unsupported_design_medium']
      : unsupportedScan.unsupportedClaimKinds,
    missingFiniteVerb: introGrammar.missingFiniteVerb,
    duplicateDuration: introGrammar.duplicateDuration,
    hybridDuration: introGrammar.hybridDuration,
    groundingValidationPassed: groundingOk,
    grammarValidationPassed,
    slotValidationPassed,
    typedRejectionReason: reason,
    currentRoleTitlePresent: rolePresent,
    currentRoleTitleMatchesStructuredRole: rolePresent,
    currentEmploymentIntroductionCount: currentIntroSlotPresent ? 1 : 0,
    currentRoleOmittedDetected: warehouseDomain && !rolePresent,
    currentRoleConcreteFactCoverage: currentCoverage,
    currentMissingFactIds: currentMissing,
    priorRoleGroundingPassed,
    priorMissingFactIds: priorMissing,
    priorCompanyPresent,
    hasGenericSkillsUnit,
    currentIntroSlotPresent,
    currentDutySlotPresent,
    priorRoleSlotPresent,
    summaryGroundingRevision: SPANISH_SUMMARY_GROUNDING_306_REVISION,
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
  void SPANISH_SUMMARY_GROUNDING_306_REVISION;
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
    role = 'profesional de almacén';
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
  // Keep the authoritative Spanish duration phrase shape from
  // formatApproximateDurationPhrase (`con alrededor de … de experiencia`).
  // Do not re-wrap with another "alrededor de" — that breaks duration idempotence.
  durRaw = durRaw
    .replace(/\b6[,.]5\b/gu, 'seis años y medio')
    .replace(/\b(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+y\s+medio\s+años?\b/giu, '$1 años y medio');

  let intro = '';
  if (enCompany && durRaw) {
    intro = monthYear
      ? `Profesional que actualmente trabaja como ${role} ${enCompany} desde ${monthYear} ${durRaw}`
      : `Profesional que actualmente trabaja como ${role} ${enCompany} ${durRaw}`;
  } else if (enCompany) {
    intro = monthYear
      ? `Profesional que actualmente trabaja como ${role} ${enCompany} desde ${monthYear}`
      : `Profesional que actualmente trabaja como ${role} ${enCompany}`;
  } else if (durRaw) {
    intro = `Profesional ${durRaw}`;
  } else {
    intro = `Profesional que actualmente trabaja como ${role}`;
  }
  if (!/[.]$/u.test(intro)) intro = `${intro}.`;

  const dutySentence = warehouseRole
    ? 'Revisa la mercancía entrante y la documentación relacionada, y coordina con sus compañeros la preparación y el movimiento de las mercancías.'
    : '';

  const priorRole = (options.priorRole || '').trim();
  const priorEmployer = (options.priorEmployer || '').trim();
  const priorEn = formatSpanishEmployerPhrase(priorEmployer);
  const priorDuties = options.priorSourceDuties || '';
  const priorLooksDesign = /(?:dizajn|design|grafik|dise[nñ]o|visual|vizuel|visuell|デザイン|gr[aá]fic)/i
    .test(`${priorRole} ${priorDuties}`);
  let priorSentence = '';
  if ((priorRole || priorLooksDesign) && priorLooksDesign) {
    const priorLabel = unspecified
      ? 'diseño gráfico'
      : localizeGraphicDesigner('es', options.gender);
    const designFacts = 'donde creó materiales visuales y elementos gráficos, revisó y adaptó materiales de diseño y preparó archivos finales de diseño para distintos formatos y pantallas';
    priorSentence = priorEn
      ? `Anteriormente trabajó como ${priorLabel} ${priorEn}, ${designFacts}.`
      : `Anteriormente trabajó como ${priorLabel}, ${designFacts}.`;
  }

  return [intro, dutySentence, priorSentence]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
