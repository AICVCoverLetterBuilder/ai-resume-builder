/**
 * AAB-361 — Brazilian Portuguese Professional Summary entry-owned first-person builder.
 * Requested locale `pt-BR` never reuses Italian/French/German/English/Spanish as factual authority.
 */
import type { Locale } from './i18n/translations';
import type { ExperienceDuration } from './cv-experience-duration';
import {
  formatApproximateDurationPhrase,
  formatPortugueseBrazilDurationCore,
} from './cv-experience-duration';
import {
  localizeGraphicDesigner,
  localizeWarehouseEmployee,
  matchesWarehouseOccupationalTitle,
  matchesGraphicDesignerOccupationalTitle,
} from './cv-role-title';
import { resolveLocalizedSummaryRole } from './cv-summary-structured-role-localization';
import { extractGermanCurrentWarehouseDutyFacts } from './cv-german-summary-current-duty-coverage';
import { validateAiUnitLocalePurity } from './cv-ai-unit-locale-purity';
import { PROVIDER_CROSS_LOCALE_NOOP_REASON } from './cv-french-summary-grounding';
import { fingerprintText } from './cv-export-diagnostics';

export const SUMMARY_BUILDER_REVISION_PT_BR =
  'entry-owned-ptbr-rebuild-361-v1' as const;
export const PTBR_SUMMARY_FIRST_PERSON_361_REVISION =
  'ptbr-summary-first-person-361-v1' as const;
export const PTBR_SUMMARY_CROSS_LOCALE_361_REVISION =
  'ptbr-summary-cross-locale-361-v1' as const;
export const PTBR_SUMMARY_UNIT_SPLITTER_361_REVISION =
  'ptbr-summary-unit-splitter-361-v1' as const;
export const PTBR_SUMMARY_DURATION_GRAMMAR_REVISION =
  'ptbr-summary-duration-grammar-362-v1' as const;
/** Canonical typed rejection for malformed Brazilian Portuguese duration noun ordering. */
export const PTBR_SUMMARY_DURATION_GRAMMAR_INVALID =
  'ptbr_summary_duration_grammar_invalid' as const;

void SUMMARY_BUILDER_REVISION_PT_BR;
void PTBR_SUMMARY_FIRST_PERSON_361_REVISION;
void PTBR_SUMMARY_CROSS_LOCALE_361_REVISION;
void PTBR_SUMMARY_UNIT_SPLITTER_361_REVISION;
void PTBR_SUMMARY_DURATION_GRAMMAR_REVISION;
void PTBR_SUMMARY_DURATION_GRAMMAR_INVALID;
void PROVIDER_CROSS_LOCALE_NOOP_REASON;

const PT_BR_CARDINAL_RE =
  '(?:um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|\\d+)';

/**
 * Reject malformed Brazilian Portuguese duration noun ordering such as
 * `seis e meio anos` / `um e meio anos` / `seis anos meio`.
 * Accepts natural `N anos e meio`, `um ano e meio`, whole years, and month spans.
 */
export function analyzePortugueseBrazilDurationGrammar(
  text: string,
  expected?: ExperienceDuration | null,
): {
  grammarValidationPassed: boolean;
  durationGrammarValidationPassed: boolean;
  grammarRejectionReason: string | null;
  durationValidatorRevision: typeof PTBR_SUMMARY_DURATION_GRAMMAR_REVISION;
  malformedDurationOrderingDetected: boolean;
  expectedDurationCore: string | null;
  detectedMalformedPhrase: string | null;
} {
  void PTBR_SUMMARY_DURATION_GRAMMAR_REVISION;
  const t = (text || '').replace(/\s+/g, ' ').trim();
  const malformedRes: Array<{ re: RegExp; label: string }> = [
    {
      re: new RegExp(
        String.raw`\b${PT_BR_CARDINAL_RE}\s+e\s+meio\s+anos?\b`,
        'iu',
      ),
      label: 'fraction_before_noun',
    },
    {
      re: new RegExp(
        String.raw`\b${PT_BR_CARDINAL_RE}\s+anos?\s+meio\b`,
        'iu',
      ),
      label: 'missing_e_before_meio',
    },
    {
      re: /\bmeio\s+(?:um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez)\s+anos?\b/iu,
      label: 'meio_before_cardinal',
    },
    {
      re: /\bcerca\s+(?!de\b)(?:um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez)\s+anos?\s+e\s+meio\b/iu,
      label: 'missing_de_after_cerca',
    },
    {
      re: /\b\d+[.,]\d+\s+anos?\b/iu,
      label: 'numeric_hybrid_years',
    },
  ];
  let detectedMalformedPhrase: string | null = null;
  for (const { re } of malformedRes) {
    const m = t.match(re);
    if (m) {
      detectedMalformedPhrase = m[0];
      break;
    }
  }
  // Duplicate written duration openers (two total-career claims).
  const openerHits = t.match(
    /\b(?:tenho,?\s+(?:ao\s+todo|no\s+total)|com\s+cerca\s+de)\b/giu,
  ) || [];
  const yearSpanHits = t.match(
    new RegExp(
      String.raw`\b${PT_BR_CARDINAL_RE}\s+(?:ano|anos)(?:\s+e\s+meio)?\b`,
      'giu',
    ),
  ) || [];
  const duplicateDuration = openerHits.length > 1 || yearSpanHits.length > 1;

  const expectedCore = expected && expected.hasValidDates
    ? formatPortugueseBrazilDurationCore(expected)
    : null;
  let semanticMismatch = false;
  if (expectedCore && /\b(?:experi[eê]ncia|ano|anos|m[eê]s|meses)\b/iu.test(t)) {
    const hasExpectedCore = new RegExp(
      expectedCore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'iu',
    ).test(t);
    // Only enforce semantic agreement when a duration claim is present.
    if (/\b(?:tenho|cerca\s+de|aproximadamente|anos?|m[eê]ses?)\b/iu.test(t)
      && !hasExpectedCore
      && !detectedMalformedPhrase) {
      semanticMismatch = true;
    }
  }

  const malformedDurationOrderingDetected = Boolean(detectedMalformedPhrase) || duplicateDuration;
  const ok = !malformedDurationOrderingDetected && !semanticMismatch;
  const grammarRejectionReason = !ok
    ? PTBR_SUMMARY_DURATION_GRAMMAR_INVALID
    : null;
  return {
    grammarValidationPassed: ok,
    durationGrammarValidationPassed: ok,
    grammarRejectionReason,
    durationValidatorRevision: PTBR_SUMMARY_DURATION_GRAMMAR_REVISION,
    malformedDurationOrderingDetected,
    expectedDurationCore: expectedCore,
    detectedMalformedPhrase: detectedMalformedPhrase
      || (duplicateDuration ? 'duplicate_duration_claim' : null)
      || (semanticMismatch ? 'duration_semantic_mismatch' : null),
  };
}

export function hasIncorrectPortugueseBrazilDurationGrammar(text: string): boolean {
  return !analyzePortugueseBrazilDurationGrammar(text).grammarValidationPassed;
}

/** Split Brazilian Portuguese Summary into semantic sentence units. */
export function splitPortugueseBrazilSummaryUnits(text: string): string[] {
  void PTBR_SUMMARY_UNIT_SPLITTER_361_REVISION;
  const raw = (text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const bySentence = raw
    .split(/(?<=[.!?])\s+(?=\S)/u)
    .map((s) => s.trim())
    .filter(Boolean);
  if (bySentence.length >= 3) return bySentence;
  if (bySentence.length === 2) return bySentence;
  const forced = raw
    .split(/\s+(?=\b(?:Atualmente|Anteriormente)\b)/iu)
    .map((s) => s.trim())
    .filter(Boolean);
  return forced.length >= 2 ? forced : (raw ? [raw] : []);
}

function assignPtBrUnitRoleSlot(unit: string): string {
  const s = (unit || '').trim();
  if (!s) return 'other';
  if (/\b(?:tenho|(?:ao\s+todo|no\s+total)|experi[eê]ncia\s+profissional|anos\s+e\s+meio)\b/iu.test(s)
    && !/\b(?:atualmente|anteriormente)\b/iu.test(s)) {
    return 'duration';
  }
  if (/\b(?:anteriormente|antes|trabalhei|atuei|exerci)\b/iu.test(s)) {
    return 'prior_role';
  }
  if (/\b(?:atualmente|trabalho\s+na|trabalho\s+como|atuo\s+como)\b/iu.test(s)) {
    return 'current_intro';
  }
  return 'other';
}

export function detectPortugueseBrazilSummaryPerspective(
  text: string,
): 'first_person' | 'neutral_cv' | 'cv_third_person' {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return 'neutral_cv';
  if (/\b(?:eu|tenho|trabalho|trabalhei|atuo|atuei|exerço|exerci|verifico|confiro|me\s+coordeno|criei|revisei|preparei)\b/iu.test(t)) {
    return 'first_person';
  }
  if (/\b(?:ele|ela|trabalha\s+atualmente|trabalhou)\b/iu.test(t)
    && !/\b(?:eu|tenho|trabalho|trabalhei)\b/iu.test(t)) {
    return 'cv_third_person';
  }
  return 'neutral_cv';
}

export type PortugueseBrazilFiniteVerbRecord = {
  sentenceIndex: number;
  tokenHash: string;
  expectedTense: 'present' | 'past' | 'unknown';
  tense: 'present' | 'past' | 'unknown';
  person: 'first_singular' | 'third_singular' | 'unknown';
  compatible: boolean;
};

export type PortugueseBrazilFiniteVerbDiagnostics = {
  finiteVerbCount: number;
  firstPersonCompatibleFiniteVerbCount: number;
  wrongPersonFiniteVerbCount: number;
  wrongPersonFiniteVerbHashes: string[];
  unitPersonAgreementPassed: boolean;
  rejectionReasons: string[];
  records: PortugueseBrazilFiniteVerbRecord[];
};

const PTBR_FIRST_PERSON_PRESENT_IRREGULAR = new Set([
  'sou', 'estou', 'tenho', 'faço', 'vou', 'posso', 'sei', 'vejo', 'dou', 'leio',
]);
const PTBR_FIRST_PERSON_PAST_IRREGULAR = new Set([
  'fui', 'tive', 'fiz', 'vi', 'dei', 'pude', 'soube', 'estive', 'mantive', 'obtive',
]);
const PTBR_NON_VERB_CONNECTOR_WORDS = new Set([
  'e', 'ou', 'para', 'por', 'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no',
  'nas', 'nos', 'com', 'sem', 'as', 'os', 'a', 'o', 'um', 'uma', 'que', 'se',
  'me', 'te', 'lhe', 'lhes',
]);
const PTBR_CLITIC_WORDS = new Set(['me', 'te', 'se', 'lhe', 'lhes', 'nos']);

function normalizePtBrFiniteToken(token: string): string {
  return token
    .toLocaleLowerCase('pt-BR')
    .normalize('NFC')
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
}

function classifyPtBrFiniteToken(token: string): {
  tense: 'present' | 'past' | 'unknown';
  person: 'first_singular' | 'third_singular' | 'unknown';
} {
  const word = normalizePtBrFiniteToken(token);
  if (!word || PTBR_NON_VERB_CONNECTOR_WORDS.has(word)) {
    return { tense: 'unknown', person: 'unknown' };
  }
  if (PTBR_FIRST_PERSON_PRESENT_IRREGULAR.has(word)) {
    return { tense: 'present', person: 'first_singular' };
  }
  if (PTBR_FIRST_PERSON_PAST_IRREGULAR.has(word)) {
    return { tense: 'past', person: 'first_singular' };
  }
  // Regular first-person singular present (-o) and simple past (-ei/-i/-ui).
  if (/\p{L}o$/u.test(word)) {
    return { tense: 'present', person: 'first_singular' };
  }
  if (/(?:ei|i|ui)$/u.test(word)) {
    return { tense: 'past', person: 'first_singular' };
  }
  // First-person and third-person singular imperfect forms share the same
  // surface in Brazilian Portuguese (`trabalhava`, `substituía`). They are
  // therefore compatible with a first-person completed-role shell rather than
  // evidence of a person mismatch.
  if (/(?:ava|ia|\u00eda)$/u.test(word)) {
    return { tense: 'past', person: 'first_singular' };
  }
  // Third-person singular present (-a/-e) and simple past (-ou/-eu/-iu).
  if (/(?:ou|eu|iu)$/u.test(word)) {
    return { tense: 'past', person: 'third_singular' };
  }
  if (/(?:a|e)$/u.test(word)) {
    return { tense: 'present', person: 'third_singular' };
  }
  return { tense: 'unknown', person: 'unknown' };
}

/**
 * Scan every finite predicate position in a first-person Summary clause.
 * The scanner is deliberately bounded to role-intro/relative-clause predicate
 * positions, so ordinary material nouns are never treated as verbs. Unknown
 * paradigms remain unproven and therefore cannot silently turn a mixed-person
 * surface green.
 */
export function analyzePortugueseBrazilFirstPersonFiniteVerbs(
  text: string,
): PortugueseBrazilFiniteVerbDiagnostics {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  const sentences = normalized
    .split(/(?<=[.!?])\s+(?=\S)/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const records: PortugueseBrazilFiniteVerbRecord[] = [];
  const seen = new Set<string>();
  const addCandidate = (
    sentenceIndex: number,
    token: string,
    expectedTense: 'present' | 'past' | 'unknown',
  ) => {
    const clean = normalizePtBrFiniteToken(token);
    if (!clean) return;
    const classified = classifyPtBrFiniteToken(clean);
    if (classified.person === 'unknown') return;
    const key = `${sentenceIndex}:${clean}:${expectedTense}`;
    if (seen.has(key)) return;
    seen.add(key);
    const compatible = classified.person === 'first_singular'
      && (expectedTense === 'unknown' || classified.tense === expectedTense);
    records.push({
      sentenceIndex,
      tokenHash: fingerprintText(`ptbr-finite:${clean}`),
      expectedTense,
      tense: classified.tense,
      person: classified.person,
      compatible,
    });
  };

  sentences.forEach((sentence, sentenceIndex) => {
    const expectedTense: 'present' | 'past' | 'unknown' =
      /\b(?:anteriormente|antes|trabalhei|trabalhou|atuei|exerci)\b/iu.test(sentence)
        ? 'past'
        : /\b(?:atualmente|trabalho|trabalha|atuo|exerço)\b/iu.test(sentence)
          ? 'present'
          : 'unknown';
    // Role-intro predicates are finite even when there is no duty clause.
    const intro = /\b(?:atualmente\s+)?(trabalho|trabalhei|atuo|atuei|exerço|exerci|sou|fui|tenho|tive)\b/iu.exec(sentence);
    if (intro?.[1]) addCandidate(sentenceIndex, intro[1], expectedTense);

    const whereIndex = sentence.search(/\bonde\b/iu);
    if (whereIndex < 0) return;
    const clause = sentence.slice(whereIndex + (sentence.slice(whereIndex).match(/^\bonde\b/iu)?.[0]?.length || 0));
    const tokens = clause.split(/\s+/u).filter(Boolean);
    const predicatePositions = new Set<number>();
    if (tokens.length > 0) predicatePositions.add(0);
    tokens.forEach((token, index) => {
      if (/^[,;:]$/u.test(token) || /[,;:]$/u.test(token)) {
        if (tokens[index + 1]) predicatePositions.add(index + 1);
      }
      if (/^e$/iu.test(normalizePtBrFiniteToken(token)) && tokens[index + 1]) {
        let next = index + 1;
        while (
          next < tokens.length
          && PTBR_CLITIC_WORDS.has(normalizePtBrFiniteToken(tokens[next] || ''))
        ) next += 1;
        if (tokens[next]) {
          const candidate = classifyPtBrFiniteToken(tokens[next] || '');
          const following = normalizePtBrFiniteToken(tokens[next + 1] || '');
          // A bare -a/-e token immediately followed by another conjunction
          // is commonly a coordinated noun (`catálogo e estante e ...`), not
          // a finite predicate. Unambiguous past forms and predicates followed
          // by their objects remain fully checked.
          if (!(
            candidate.person === 'third_singular'
            && candidate.tense === 'present'
            && (following === 'e' || following === 'ou')
          )) predicatePositions.add(next);
        }
      }
    });
    for (const position of predicatePositions) {
      addCandidate(sentenceIndex, tokens[position] || '', expectedTense);
    }
  });

  const wrongPersonFiniteVerbHashes = records
    .filter((record) => !record.compatible)
    .map((record) => record.tokenHash);
  const rejectionReasons = wrongPersonFiniteVerbHashes.length > 0
    ? ['ptbr_first_person_morphology_mismatch', 'ptbr_coordinated_predicate_person_mismatch']
    : [];
  return {
    finiteVerbCount: records.length,
    firstPersonCompatibleFiniteVerbCount: records.filter((record) => record.compatible).length,
    wrongPersonFiniteVerbCount: wrongPersonFiniteVerbHashes.length,
    wrongPersonFiniteVerbHashes,
    unitPersonAgreementPassed: records.length > 0 && wrongPersonFiniteVerbHashes.length === 0,
    rejectionReasons,
    records,
  };
}

const PT_WAREHOUSE_INBOUND =
  /mercadorias?\s+(?:recebidas|que\s+chegam)|verifico\s+as\s+mercadorias/iu;
const PT_WAREHOUSE_DOCS =
  /documenta[cç][aã]o\s+relacionada|confiro\s+a\s+documenta[cç][aã]o/iu;
const PT_WAREHOUSE_COORD =
  /me\s+coordeno\s+com\s+(?:os\s+)?colegas|prepara[cç][aã]o\s+e\s+a\s+movimenta[cç][aã]o\s+das\s+mercadorias/iu;
const PT_DESIGN_CREATE =
  /materiais\s+visuais|elementos\s+gr[aá]ficos|criei\s+materiais/iu;
const PT_DESIGN_REVIEW =
  /revisei\s+e\s+adaptei|adaptei\s+materiais\s+de\s+design|revisei/iu;
const PT_DESIGN_FINAL =
  /arquivos\s+finais\s+de\s+design|diferentes\s+formatos|telas/iu;

export type PortugueseBrazilSummaryEmploymentQuality = {
  groundingValidationPassed: boolean;
  slotValidationPassed: boolean;
  perspectiveValidationPassed: boolean;
  grammarValidationPassed: boolean;
  durationGrammarValidationPassed: boolean;
  perspectiveMode: 'first_person' | 'neutral_cv' | 'cv_third_person';
  typedRejectionReason: string | null;
  slotRejectionReasons: string[];
  grammarRejectionReason: string | null;
  durationValidatorRevision: string;
  malformedDurationOrderingDetected: boolean;
  requiredCurrentDutyFactCount: number;
  coveredCurrentDutyFactCount: number;
  missingCurrentDutyFactCount: number;
  requiredPriorDutyFactCount: number;
  coveredPriorDutyFactCount: number;
  missingPriorDutyFactCount: number;
  finalCurrentDutyCoveragePassed: boolean;
  finalPriorDutyCoveragePassed: boolean;
  currentIntroSlotPresent: boolean;
  currentDutySlotPresent: boolean;
  priorRoleSlotPresent: boolean;
  totalDurationSlotPresent: boolean;
  finalUnitRoleSlots: string[];
  finalSentenceRoleSlots: string[];
  finalSentenceHashes?: string[];
  unitCount?: number;
  targetLocalePurityPassed: boolean;
  wrongLocaleUnitCount: number;
  unexpectedLocaleCodes: string[];
  detectedLocaleByUnit: Array<string | null>;
  unsupportedClaimCount: number;
  employerCrossEntryLeakageDetected: boolean;
  currentEmploymentIntroductionCount: number;
  currentRoleConcreteFactCoverage: number;
  priorRoleGroundingPassed: boolean;
  currentRoleTitlePresent: boolean;
  currentRoleTitleMatchesStructuredRole: boolean;
  finalCurrentEmployerPresent: boolean;
  finalPriorEmployerPresent: boolean;
  finalCurrentEmploymentStateExpressed: boolean;
  finalPriorEmploymentStateExpressed: boolean;
  finalCurrentRoleIntroValidationPassed: boolean;
  finalPriorRoleIntroValidationPassed: boolean;
  finalSlotValidationPassed: boolean;
  finalDurationOwnerExpected: string;
  finalDurationOwnerDetected: string;
  finalDurationScopeValidationPassed: boolean;
  finalDurationCurrentRoleAttachmentRisk: boolean;
  finalDurationTotalCareerMarkerPresent: boolean;
  currentRoleOmittedDetected: boolean;
  ptbrFiniteVerbCount: number;
  ptbrFirstPersonCompatibleFiniteVerbCount: number;
  ptbrWrongPersonFiniteVerbCount: number;
  ptbrWrongPersonFiniteVerbHashes: string[];
  ptbrUnitPersonAgreementPassed: boolean;
};

function countPtBrWarehouseCoverage(text: string): {
  required: number;
  covered: number;
  missing: number;
} {
  const checks = [PT_WAREHOUSE_INBOUND, PT_WAREHOUSE_DOCS, PT_WAREHOUSE_COORD];
  const covered = checks.filter((re) => re.test(text)).length;
  return { required: 3, covered, missing: Math.max(0, 3 - covered) };
}

function countPtBrDesignCoverage(text: string): {
  required: number;
  covered: number;
  missing: number;
} {
  const checks = [PT_DESIGN_CREATE, PT_DESIGN_REVIEW, PT_DESIGN_FINAL];
  const covered = checks.filter((re) => re.test(text)).length;
  return { required: 3, covered, missing: Math.max(0, 3 - covered) };
}

function normalizeDetectedLocaleByUnit(
  units: Array<string | null>,
): Array<string | null> {
  return units.map((code) => {
    if (!code) return code;
    const k = String(code).toLowerCase();
    if (k === 'pt' || k === 'pt-br' || k === 'pt_br') return 'pt-BR';
    return code;
  });
}

export function analyzePortugueseBrazilSummaryEmploymentQuality(
  summary: string,
  options: {
    company?: string;
    role?: string;
    rawCurrentRole?: string;
    priorCompany?: string;
    priorRole?: string;
    rawPriorRole?: string;
    currentEntryDuties?: string;
    priorEntryDuties?: string;
    gender?: string;
    currentEntryId?: string | null;
    priorEntryId?: string | null;
    expectedDuration?: ExperienceDuration | null;
  } = {},
): PortugueseBrazilSummaryEmploymentQuality {
  void PTBR_SUMMARY_FIRST_PERSON_361_REVISION;
  void PTBR_SUMMARY_CROSS_LOCALE_361_REVISION;
  void PTBR_SUMMARY_UNIT_SPLITTER_361_REVISION;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const units = splitPortugueseBrazilSummaryUnits(text);
  const unitCount = units.length;
  const finalSentenceHashes = units.map((u) => fingerprintText(u));
  const perUnitRoleSlots = units.map((u) => assignPtBrUnitRoleSlot(u));
  const purity = validateAiUnitLocalePurity(text, 'pt-BR', {
    kind: 'summary_sentence',
    requireUnits: true,
    requiredScript: 'latin',
  });
  const ptbrFinite = analyzePortugueseBrazilFirstPersonFiniteVerbs(text);
  const perspectiveMode = detectPortugueseBrazilSummaryPerspective(text);
  const perspectiveValidationPassed = perspectiveMode === 'first_person'
    && ptbrFinite.unitPersonAgreementPassed;
  const durationGrammar = analyzePortugueseBrazilDurationGrammar(
    text,
    options.expectedDuration || null,
  );

  const dutiesCorpus = `${options.currentEntryDuties || ''} ${options.role || ''}`;
  const canonicalWarehouseFacts = extractGermanCurrentWarehouseDutyFacts({
    currentEntryDuties: options.currentEntryDuties || '',
  });
  const warehouseRoleCue = matchesWarehouseOccupationalTitle(options.role || '')
    || matchesWarehouseOccupationalTitle(options.rawCurrentRole || '')
    || /warehouse|lager|entrep[oô]t|magazzino|armaz[eé]m|marchandis|merci|mercadorias/i
      .test(dutiesCorpus);
  const requireWarehouseTriad = canonicalWarehouseFacts.length >= 3;
  const designDomain = matchesGraphicDesignerOccupationalTitle(options.priorRole || '')
    || matchesGraphicDesignerOccupationalTitle(options.rawPriorRole || '')
    || /design|grafik|graphiste|visuel|graphic|gr[aá]fica|designer/i.test(
      `${options.priorRole || ''} ${options.priorEntryDuties || ''}`,
    );

  const currentCov = requireWarehouseTriad
    ? countPtBrWarehouseCoverage(text)
    : { required: 0, covered: 0, missing: 0 };
  const priorCov = designDomain
    ? countPtBrDesignCoverage(text)
    : { required: 0, covered: 0, missing: 0 };

  const company = (options.company || '').trim();
  const priorCompany = (options.priorCompany || '').trim();
  const currentIntroSlotPresent = /\b(?:atualmente\s+(?:trabalho|atuo|exerço)|trabalho\s+(?:na|como)|atuo\s+como|atualmente)\b/iu
    .test(text)
    && (company ? new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text) : true);
  const currentDutySlotPresent = currentCov.required === 0 || currentCov.covered >= currentCov.required;
  const priorRoleSlotPresent = !priorCompany && !designDomain
    ? true
    : /\b(?:anteriormente|antes|trabalhei|atuei|exerci)\b/iu.test(text)
      && (priorCompany
        ? new RegExp(priorCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text)
        : true);
  const totalDurationSlotPresent = /\b(?:tenho|(?:ao\s+todo|no\s+total)|experi[eê]ncia\s+profissional|anos\s+e\s+meio)\b/iu
    .test(text)
    && !durationGrammar.malformedDurationOrderingDetected;

  const corpusRoleSlots = [
    ...(totalDurationSlotPresent ? ['duration'] : []),
    ...(currentIntroSlotPresent ? ['current_intro'] : []),
    ...(priorRoleSlotPresent && (priorCompany || designDomain) ? ['prior_role'] : []),
  ];
  const expectedThreeSlotTopology = (requireWarehouseTriad || designDomain)
    && Boolean(company || options.role)
    && (priorCompany || designDomain);
  const finalUnitRoleSlots = unitCount >= 2 ? perUnitRoleSlots : corpusRoleSlots;
  const finalSentenceRoleSlots = [...finalUnitRoleSlots];

  const slotRejectionReasons: string[] = [];
  if (!purity.targetLocalePurityPassed) {
    slotRejectionReasons.push('ptbr_summary_wrong_locale');
  }
  if (!perspectiveValidationPassed) {
    slotRejectionReasons.push('ptbr_summary_perspective_not_first_person');
  }
  if (!ptbrFinite.unitPersonAgreementPassed) {
    slotRejectionReasons.push(...ptbrFinite.rejectionReasons);
  }
  if (!durationGrammar.grammarValidationPassed) {
    slotRejectionReasons.push(PTBR_SUMMARY_DURATION_GRAMMAR_INVALID);
  }
  if (requireWarehouseTriad && currentCov.missing > 0) {
    slotRejectionReasons.push('current_duty_fact_coverage_incomplete');
  }
  if (designDomain && priorCov.missing > 0) {
    slotRejectionReasons.push('prior_duty_fact_coverage_incomplete');
  }
  if ((requireWarehouseTriad || warehouseRoleCue) && !currentIntroSlotPresent && Boolean(company || options.role)) {
    slotRejectionReasons.push('missing_current_intro_slot');
  }
  if ((priorCompany || designDomain) && !priorRoleSlotPresent) {
    slotRejectionReasons.push('missing_prior_role_slot');
  }
  if ((requireWarehouseTriad || designDomain) && !totalDurationSlotPresent) {
    slotRejectionReasons.push('missing_duration_slot');
  }
  if (expectedThreeSlotTopology && unitCount > 0 && unitCount < 3) {
    slotRejectionReasons.push('ptbr_summary_unit_count_mismatch');
  }
  if (
    expectedThreeSlotTopology
    && unitCount >= 3
    && !finalSentenceRoleSlots.every((s, i) => (
      i === 0 ? s === 'duration'
        : i === 1 ? s === 'current_intro'
          : i === 2 ? s === 'prior_role'
            : s === 'prior_role' || s === 'other'
    ))
  ) {
    slotRejectionReasons.push('ptbr_summary_unit_slot_mismatch');
  }

  const italianLeak = /\b(?:dispongo|attualmente|lavoro\s+presso|in\s+precedenza|addetta|merci\s+in\s+arrivo)\b/iu
    .test(text);
  const frenchLeak = /\b(?:je|dispose|travaille\s+actuellement|auparavant|employée|graphiste|marchandises\s+entrantes)\b/iu
    .test(text);
  const germanLeak = /\b(?:ich|verfüge|derzeit|arbeite|arbeitete|lagermitarbeiter|grafikdesigner)\b/iu
    .test(text);
  const spanishLeak = /\b(?:dispongo|actualmente\s+trabajo|anteriormente|empleada\s+de\s+almac[eé]n|mercanc[ií]as)\b/iu
    .test(text)
    && !/\b(?:mercadorias|armaz[eé]m|tenho,?\s+(?:ao\s+todo|no\s+total))\b/iu.test(text);
  const europeanPtOnly = /\becr[aã]s\b/iu.test(text);
  if (italianLeak || frenchLeak || germanLeak || spanishLeak) {
    slotRejectionReasons.push('ptbr_summary_source_language_leakage');
  }
  if (europeanPtOnly) {
    slotRejectionReasons.push('ptbr_summary_european_portuguese_surface');
  }

  const employerCrossEntryLeakageDetected = Boolean(
    company
    && priorCompany
    && company !== priorCompany
    && /atualmente/iu.test(text)
    && new RegExp(priorCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(
      (text.match(/atualmente\s+trabalho[^.]+/iu) || [''])[0],
    ),
  );
  if (employerCrossEntryLeakageDetected) {
    slotRejectionReasons.push('employer_cross_entry_leakage');
  }

  const unsupportedClaimCount = [
    /\b(?:agile|scrum|kpi|lideran[cç]a|marketing|branding|impress[aã]o)\b/iu.test(text),
  ].filter(Boolean).length;
  if (unsupportedClaimCount > 0) {
    slotRejectionReasons.push('unsupported_claim');
  }

  const slotValidationPassed = slotRejectionReasons.length === 0
    && purity.targetLocalePurityPassed
    && perspectiveValidationPassed
    && ptbrFinite.unitPersonAgreementPassed
    && durationGrammar.grammarValidationPassed
    && !italianLeak
    && !frenchLeak
    && !germanLeak
    && !europeanPtOnly
    && (currentCov.required === 0 || currentCov.covered >= currentCov.required)
    && (priorCov.required === 0 || priorCov.covered >= priorCov.required);

  const groundingValidationPassed = slotValidationPassed && Boolean(text);
  const typedRejectionReason = !text
    ? 'empty_summary'
    : (slotRejectionReasons[0] || null);

  const rolePresent = Boolean(options.role)
    && new RegExp(
      String(options.role || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'iu',
    ).test(text);
  const finalCurrentEmployerPresent = Boolean(company)
    && new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text);
  const finalPriorEmployerPresent = !priorCompany
    || new RegExp(priorCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text);

  const detectedLocaleByUnit = normalizeDetectedLocaleByUnit(
    purity.detectedLocaleByUnit || [],
  );

  return {
    groundingValidationPassed,
    slotValidationPassed,
    perspectiveValidationPassed,
    grammarValidationPassed: durationGrammar.grammarValidationPassed
      && ptbrFinite.unitPersonAgreementPassed,
    durationGrammarValidationPassed: durationGrammar.durationGrammarValidationPassed,
    perspectiveMode,
    typedRejectionReason,
    slotRejectionReasons: [...new Set(slotRejectionReasons)],
    grammarRejectionReason: durationGrammar.grammarRejectionReason,
    durationValidatorRevision: durationGrammar.durationValidatorRevision,
    malformedDurationOrderingDetected: durationGrammar.malformedDurationOrderingDetected,
    requiredCurrentDutyFactCount: currentCov.required,
    coveredCurrentDutyFactCount: currentCov.covered,
    missingCurrentDutyFactCount: currentCov.missing,
    requiredPriorDutyFactCount: priorCov.required,
    coveredPriorDutyFactCount: priorCov.covered,
    missingPriorDutyFactCount: priorCov.missing,
    finalCurrentDutyCoveragePassed: currentCov.required === 0
      || currentCov.covered >= currentCov.required,
    finalPriorDutyCoveragePassed: priorCov.required === 0
      || priorCov.covered >= priorCov.required,
    currentIntroSlotPresent,
    currentDutySlotPresent,
    priorRoleSlotPresent,
    totalDurationSlotPresent,
    finalUnitRoleSlots,
    finalSentenceRoleSlots,
    finalSentenceHashes,
    unitCount,
    targetLocalePurityPassed: purity.targetLocalePurityPassed
      && !italianLeak
      && !frenchLeak
      && !germanLeak
      && !europeanPtOnly,
    wrongLocaleUnitCount: Math.max(
      purity.wrongLocaleUnitCount,
      italianLeak ? 1 : 0,
      frenchLeak ? 1 : 0,
      germanLeak ? 1 : 0,
    ),
    unexpectedLocaleCodes: [
      ...new Set([
        ...(purity.unexpectedLocaleCodes || [])
          .map((c) => (String(c).toLowerCase() === 'pt' ? 'pt-BR' : c)),
        ...(italianLeak ? ['it'] : []),
        ...(frenchLeak ? ['fr'] : []),
        ...(germanLeak ? ['de'] : []),
        ...(spanishLeak ? ['es'] : []),
      ]),
    ],
    detectedLocaleByUnit,
    unsupportedClaimCount,
    employerCrossEntryLeakageDetected,
    currentEmploymentIntroductionCount: currentIntroSlotPresent ? 1 : 0,
    currentRoleConcreteFactCoverage: currentCov.covered,
    priorRoleGroundingPassed: priorCov.required === 0
      || priorCov.covered >= priorCov.required,
    currentRoleTitlePresent: rolePresent,
    currentRoleTitleMatchesStructuredRole: rolePresent,
    finalCurrentEmployerPresent,
    finalPriorEmployerPresent,
    finalCurrentEmploymentStateExpressed: /\b(?:atualmente|trabalho|atuo)\b/iu.test(text),
    finalPriorEmploymentStateExpressed: !priorCompany
      || /\b(?:anteriormente|antes|trabalhei|atuei)\b/iu.test(text),
    finalCurrentRoleIntroValidationPassed: currentIntroSlotPresent,
    finalPriorRoleIntroValidationPassed: priorRoleSlotPresent,
    finalSlotValidationPassed: slotValidationPassed,
    finalDurationOwnerExpected: 'total_professional_experience',
    finalDurationOwnerDetected: totalDurationSlotPresent
      ? 'total_professional_experience'
      : 'unknown',
    finalDurationScopeValidationPassed: totalDurationSlotPresent,
    finalDurationCurrentRoleAttachmentRisk: false,
    finalDurationTotalCareerMarkerPresent: totalDurationSlotPresent,
    currentRoleOmittedDetected: Boolean(company || options.role) && !currentIntroSlotPresent,
    ptbrFiniteVerbCount: ptbrFinite.finiteVerbCount,
    ptbrFirstPersonCompatibleFiniteVerbCount: ptbrFinite.firstPersonCompatibleFiniteVerbCount,
    ptbrWrongPersonFiniteVerbCount: ptbrFinite.wrongPersonFiniteVerbCount,
    ptbrWrongPersonFiniteVerbHashes: ptbrFinite.wrongPersonFiniteVerbHashes,
    ptbrUnitPersonAgreementPassed: ptbrFinite.unitPersonAgreementPassed,
  };
}

export function buildPortugueseBrazilEntryOwnedSummary(options: {
  role: string;
  employer: string;
  datesValue?: string;
  gender?: string;
  durationPhrase?: string;
  dutyFacts: Array<{ sourceText?: string; value: string }>;
  priorRole?: string;
  priorEmployer?: string;
  priorSourceDuties?: string;
  locale?: Locale;
  duration?: ExperienceDuration | null;
  hasCurrentRole?: boolean;
}): string {
  void SUMMARY_BUILDER_REVISION_PT_BR;
  void PTBR_SUMMARY_FIRST_PERSON_361_REVISION;
  void options.locale;
  void options.datesValue;

  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'weiblich' || g === 'feminino';

  let role = (options.role || '').trim();
  const currentDutiesCorpus = options.dutyFacts
    .map((f) => f.sourceText || f.value)
    .filter(Boolean)
    .join('\n');
  const warehouseRole = !role
    || /^(?:professional|professionista|professionnel(?:le)?|profissional)$/iu.test(role)
    || matchesWarehouseOccupationalTitle(role)
    || /entrep[oô]t|warehouse|lager|armaz[eé]m|addett[ao]\s+al\s+magazzino|employée\s+d['’]entrepôt|empleado\s+de\s+almacén|funcion[aá]ri[oa]\s+de\s+armaz/i
      .test(role);

  if (warehouseRole) {
    role = localizeWarehouseEmployee('pt-BR', options.gender);
  } else {
    const resolved = resolveLocalizedSummaryRole({
      role,
      targetLocale: 'pt-BR',
      gender: options.gender,
    });
    if (resolved.localizationValidationPassed) {
      role = resolved.localizedTargetRoleLabel;
    }
  }
  role = role.replace(/^./u, (ch) => ch.toLocaleLowerCase('pt-BR'));

  const company = (options.employer || '').trim();
  let durRaw = (options.durationPhrase || '')
    .replace(/^[,，]\s*/u, '')
    .replace(/\.$/u, '')
    .trim();
  if (!durRaw && options.duration) {
    durRaw = formatApproximateDurationPhrase(options.duration, 'pt-BR')
      .replace(/\.$/u, '')
      .trim();
  }
  let durationSentence = '';
  if (durRaw || options.duration) {
    let yearsPhrase = '';
    if (options.duration?.hasValidDates) {
      yearsPhrase = formatPortugueseBrazilDurationCore(options.duration);
    }
    if (!yearsPhrase && durRaw) {
      // Prefer already-correct "N anos e meio" / "um ano e meio" surfaces.
      const correctHalf = durRaw.match(
        /\b((?:um|uma)\s+ano\s+e\s+meio|(?:dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez)\s+anos\s+e\s+meio)\b/iu,
      );
      const correctWhole = durRaw.match(
        /\b((?:um|uma)\s+ano|(?:dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez)\s+anos|(?:um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez)\s+meses)\b/iu,
      );
      if (correctHalf) {
        yearsPhrase = correctHalf[1];
      } else if (correctWhole) {
        yearsPhrase = correctWhole[1];
      } else {
        // Never reassemble malformed "N e meio anos" — rebuild from structured duration.
        yearsPhrase = options.duration?.hasValidDates
          ? formatPortugueseBrazilDurationCore(options.duration)
          : '';
      }
    }
    if (!yearsPhrase) yearsPhrase = 'vários anos';
    durationSentence = `Tenho, ao todo, cerca de ${yearsPhrase} de experiência profissional.`;
  }

  const hasCurrent = options.hasCurrentRole !== false
    && Boolean(company || role || currentDutiesCorpus || options.dutyFacts.length);

  let currentSentence = '';
  if (hasCurrent) {
    const canonicalCurrentFacts = extractGermanCurrentWarehouseDutyFacts({
      currentEntryDuties: currentDutiesCorpus,
    });
    if (warehouseRole && canonicalCurrentFacts.length > 0) {
      const dutyClause = [
        'verifico as mercadorias recebidas',
        'confiro a documentação relacionada a elas',
        'me coordeno com os colegas para a preparação e a movimentação das mercadorias',
      ].join(', ').replace(/, ([^,]*)$/u, ' e $1');
      currentSentence = company
        ? `Atualmente trabalho na ${company} como ${role}, onde ${dutyClause}.`
        : `Atualmente trabalho como ${role}, onde ${dutyClause}.`;
    } else {
      const cookDomain = /(?:cook|chef|kuvar|cozinheir|restaurant|jela|dish|cuisine|küche|küch)/i
        .test(`${role} ${currentDutiesCorpus}`);
      let dutyBits: string[] = [];
      if (cookDomain) {
        dutyBits = [
          'preparo pratos conforme os padrões do restaurante',
          'mantenho a higiene do local de trabalho',
          'colaboro com a equipe da cozinha',
        ];
      } else {
        dutyBits = options.dutyFacts
          .map((f) => (f.sourceText || f.value || '').replace(/[.;]+$/u, '').trim())
          .filter(Boolean)
          .filter((s) => {
            if (/[šđčćž]/iu.test(s)) return false;
            if (/[\u0900-\u097F\u0600-\u06FF\u0400-\u04FF\u3040-\u30FF\u3400-\u9FFF]/.test(s)) {
              return false;
            }
            if (/\b(?:ich|derzeit|prüfe|arbeite|je|travaille|dispose|dispongo|attualmente|priprema|održavanje|saradnja|razvoj|planiranje|analiza|iskustv|skladišt|vilič|vozač|međufunkcionalnim|izvršenju|izvestaj|izveštaj)\b/iu
              .test(s)) {
              return false;
            }
            // Accept only Brazilian Portuguese-looking duty fragments.
            return (
              /[áàâãéêíóôõúç]/iu.test(s)
              || /\b(?:e|as|os|dos|com|para|na|no|onde|verifico|confiro|mantenho|preparo|colaboro)\b/iu.test(s)
            ) && /\b(?:mercador|armaz|document|colega|prato|higien|equipe|cozinha|invent[aá]rio|registro|expedi)\w*/iu
              .test(s);
          })
          .slice(0, 3);
      }
      const dutyTail = dutyBits.length
        ? `, onde ${dutyBits.join(', ').replace(/, ([^,]*)$/u, ' e $1')}`
        : '';
      currentSentence = company
        ? `Atualmente trabalho na ${company} como ${role}${dutyTail}.`
        : `Atualmente trabalho como ${role}${dutyTail}.`;
    }
  }

  const priorRoleRaw = (options.priorRole || '').trim();
  const priorEmployer = (options.priorEmployer || '').trim();
  const priorDuties = options.priorSourceDuties || '';
  const priorLooksDesign = /(?:dizajn|design|grafik|visual|vizuel|visuel|デザイン|diseñ|graphiste|graphic|gr[aá]fica)/i
    .test(`${priorRoleRaw} ${priorDuties}`);
  let priorSentence = '';
  if (priorRoleRaw || priorEmployer || priorDuties) {
    if (priorLooksDesign) {
      const priorResolved = resolveLocalizedSummaryRole({
        role: priorRoleRaw || 'Graphic Designer',
        targetLocale: 'pt-BR',
        gender: options.gender,
      });
      const priorLabel = (priorResolved.localizationValidationPassed
        ? priorResolved.localizedTargetRoleLabel
        : localizeGraphicDesigner('pt-BR', options.gender))
        .replace(/^./u, (ch) => ch.toLocaleLowerCase('pt-BR'));
      const designFacts = [
        'criei materiais visuais e elementos gráficos',
        'revisei e adaptei materiais de design',
        'preparei os arquivos finais de design para diferentes formatos e telas',
      ].join(', ').replace(/, ([^,]*)$/u, ' e $1');
      priorSentence = priorEmployer
        ? `Anteriormente, trabalhei na ${priorEmployer} como ${priorLabel}, onde ${designFacts}.`
        : `Anteriormente, trabalhei como ${priorLabel}, onde ${designFacts}.`;
    } else {
      const priorResolved = resolveLocalizedSummaryRole({
        role: priorRoleRaw || '',
        targetLocale: 'pt-BR',
        gender: options.gender,
      });
      const priorLabel = priorResolved.localizationValidationPassed
        ? priorResolved.localizedTargetRoleLabel
        : (priorRoleRaw || (female ? 'profissional' : 'profissional'));
      priorSentence = priorEmployer
        ? `Anteriormente, trabalhei na ${priorEmployer} como ${priorLabel}.`
        : `Anteriormente, trabalhei como ${priorLabel}.`;
    }
  }

  return [durationSentence, currentSentence, priorSentence]
    .filter(Boolean)
    .map((s) => s.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/u, '').trim())
    .map((s) => (s ? `${s}.` : ''))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when structured duties/role indicate pt-BR entry-owned warehouse/design rebuild. */
export function isPortugueseBrazilStructuredSummaryDomain(corpus: string): boolean {
  const t = corpus || '';
  return matchesWarehouseOccupationalTitle(t)
    || matchesGraphicDesignerOccupationalTitle(t)
    || /warehouse|entrep[oô]t|lager|magazzino|armaz[eé]m|incoming\s+goods|marchandis|merci|mercadorias|graphiste|graphic\s*design|visuel|design\s+files|addett[ao]|funcion[aá]ri/i
      .test(t);
}
