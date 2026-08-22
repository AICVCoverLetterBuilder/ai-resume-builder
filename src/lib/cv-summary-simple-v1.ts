import type { Locale } from './i18n/translations';
import type { CVData, WorkExperience } from './types';
import { getCvContentLocale } from './cv-simple-v1';
import { resolveExperienceRoleDisplayTitle } from './cv-known-role-simple-v1';

export const SIMPLE_SUMMARY_DIAGNOSTIC_KEY = 'cvpro-simple-v1-summary-diagnostic';
export const SIMPLE_SUMMARY_DIAGNOSTIC_SCHEMA = 1 as const;

export type SimpleSummaryOperation = 'generate' | 'rewrite';
export type SimpleSummaryStyle = 'shorter' | 'stronger' | 'professional';
export type SimpleSummaryValidationFailure =
  | 'malformed_output'
  | 'empty_or_near_empty'
  | 'wrong_target_script'
  | 'unreasonable_length'
  | 'invented_employer'
  | 'unsupported_number';

export interface SimpleSummaryFacts {
  jobTitle: string;
  roles: Array<{
    position: string;
    company: string;
    startDate: string;
    endDate: string;
    isPresent: boolean;
    description: string;
  }>;
  education: Array<{
    school: string;
    degree: string;
    startDate: string;
    endDate: string;
  }>;
  skills: string[];
  certifications: string[];
  languages: Array<{ name: string; level: string }>;
}

export interface SimpleSummaryProviderRequest {
  requestId: string;
  operation: SimpleSummaryOperation;
  style?: SimpleSummaryStyle;
  contentLocale: Locale;
  gender: string;
  facts: SimpleSummaryFacts;
  sourceSummary?: string;
}

export type SimpleSummaryProviderResult =
  | { ok: true; candidate: unknown; httpStatus?: number }
  | { ok: false; resultKind?: string; httpStatus?: number; errorCode?: string };

export interface SimpleSummaryDiagnostic {
  schemaVersion: typeof SIMPLE_SUMMARY_DIAGNOSTIC_SCHEMA;
  simpleV1: true;
  timestamp: number;
  requestId: string;
  operation: SimpleSummaryOperation;
  style?: SimpleSummaryStyle;
  contentLocale: Locale;
  uiLocale: Locale;
  sourceSummaryHash: string;
  providerResultKind: string;
  providerHttpStatus?: number;
  candidateHash?: string;
  validationPassed: boolean;
  validationFailureReason?: string;
  noOp: boolean;
  staleApplyRejected: boolean;
  applied: boolean;
  usageBefore: number;
  usageAfter: number;
  sourceCommitShort?: string;
}

export type SimpleSummaryOutcome =
  | 'applied'
  | 'provider_failure'
  | 'validation_failed'
  | 'no_op'
  | 'stale'
  | 'apply_failed'
  | 'source_summary_empty'
  | 'source_facts_empty';

export interface RunSimpleSummaryResult {
  outcome: SimpleSummaryOutcome;
  diagnostic: SimpleSummaryDiagnostic;
  validationFailureReason?: SimpleSummaryValidationFailure;
  errorCode?: string;
}

interface RunSimpleSummaryOptions {
  operation: SimpleSummaryOperation;
  style?: SimpleSummaryStyle;
  cv: CVData;
  uiLocale: Locale;
  transport: (request: SimpleSummaryProviderRequest) => Promise<SimpleSummaryProviderResult>;
  getCurrentCv: () => CVData;
  applyCv: (nextCv: CVData) => boolean;
  getUsageCount: () => number;
  incrementUsage: () => void;
  recordDiagnostic?: (diagnostic: SimpleSummaryDiagnostic) => void;
}

const LETTER_OR_NUMBER = /[\p{L}\p{N}]/gu;
const LATIN = /\p{Script=Latin}/u;
const CYRILLIC = /\p{Script=Cyrillic}/u;
const ARABIC = /\p{Script=Arabic}/u;
const DEVANAGARI = /\p{Script=Devanagari}/u;
const JAPANESE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const NUMBER = /\d+(?:[.,]\d+)?%?/gu;
const EMPLOYER_AFTER_PREPOSITION = /\b(?:at|bei|chez|presso|en|em|u)\s+([\p{Lu}][\p{L}\p{N}&.'’_-]*(?:\s+[\p{Lu}][\p{L}\p{N}&.'’_-]*){0,3})/gu;
const ORGANIZATION_SUFFIX = /\b([\p{Lu}][\p{L}\p{N}&.'’_-]*(?:\s+[\p{Lu}][\p{L}\p{N}&.'’_-]*){0,3}\s+(?:Inc|Corp(?:oration)?|Company|LLC|Ltd|GmbH|Group|Systems|Technologies|AG))\b/gu;

export function normalizeSimpleSummaryText(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

export function hashSimpleSummaryText(value: string): string {
  const normalized = normalizeSimpleSummaryText(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function selectedRoles(experience: WorkExperience[]): WorkExperience[] {
  const useful = experience.filter((entry) => (
    entry.position.trim() || entry.company.trim() || entry.description.trim()
  ));
  const currentIndex = useful.findIndex((entry) => entry.isPresent);
  if (currentIndex <= 0) return useful.slice(0, 4);
  return [useful[currentIndex], ...useful.filter((_, index) => index !== currentIndex)].slice(0, 4);
}

export function buildSimpleSummaryFacts(
  cv: CVData,
  contentLocale: Locale = getCvContentLocale(cv),
): SimpleSummaryFacts {
  return {
    jobTitle: String(cv.personal?.jobTitle || '').trim(),
    roles: selectedRoles(cv.experience || []).map((entry) => ({
      position: resolveExperienceRoleDisplayTitle(
        entry,
        contentLocale,
        cv.personal?.gender,
      ),
      company: String(entry.company || '').trim(),
      startDate: String(entry.startDate || '').trim(),
      endDate: String(entry.endDate || '').trim(),
      isPresent: entry.isPresent === true,
      description: String(entry.description || '').trim(),
    })),
    education: (cv.education || []).slice(0, 3).map((entry) => ({
      school: String(entry.school || '').trim(),
      degree: String(entry.degree || '').trim(),
      startDate: String(entry.startDate || '').trim(),
      endDate: String(entry.endDate || '').trim(),
    })),
    skills: (cv.skills || []).map(String).map((value) => value.trim()).filter(Boolean).slice(0, 16),
    certifications: (cv.certifications || []).map(String).map((value) => value.trim()).filter(Boolean).slice(0, 8),
    languages: (cv.languages || []).slice(0, 8).map((entry) => ({
      name: String(entry.name || '').trim(),
      level: String(entry.level || '').trim(),
    })),
  };
}

function hasUsefulFacts(facts: SimpleSummaryFacts): boolean {
  return Boolean(
    facts.jobTitle
    || facts.roles.some((role) => role.position || role.description)
    || facts.skills.length
    || facts.education.some((entry) => entry.degree),
  );
}

function stableFactsHash(facts: SimpleSummaryFacts, gender: string): string {
  return hashSimpleSummaryText(JSON.stringify({ facts, gender }));
}

function scriptRatio(text: string, script: RegExp): number {
  const letters = [...text].filter((character) => /\p{L}/u.test(character));
  if (!letters.length) return 0;
  return letters.filter((character) => script.test(character)).length / letters.length;
}

function hasTargetScript(text: string, locale: Locale): boolean {
  if (locale === 'ar') return scriptRatio(text, ARABIC) >= 0.3;
  if (locale === 'hi') return scriptRatio(text, DEVANAGARI) >= 0.3;
  if (locale === 'ja') return scriptRatio(text, JAPANESE) >= 0.25;
  if (locale === 'ru') return scriptRatio(text, CYRILLIC) >= 0.5;
  if (locale === 'sr') {
    return scriptRatio(text, LATIN) >= 0.5 || scriptRatio(text, CYRILLIC) >= 0.5;
  }
  return scriptRatio(text, LATIN) >= 0.5;
}

function lookupText(value: string): string {
  return normalizeSimpleSummaryText(value).toLocaleLowerCase();
}

function hasInventedEmployer(candidate: string, facts: SimpleSummaryFacts): boolean {
  const knownOrganizations = new Set([
    ...facts.roles.map((role) => role.company),
    ...facts.education.map((entry) => entry.school),
  ].map(lookupText).filter(Boolean));
  const mentioned = [
    ...[...candidate.matchAll(EMPLOYER_AFTER_PREPOSITION)].map((match) => match[1]),
    ...[...candidate.matchAll(ORGANIZATION_SUFFIX)].map((match) => match[1]),
  ].map(lookupText).filter(Boolean);
  return mentioned.some((organization) => !knownOrganizations.has(organization));
}

function hasUnsupportedNumber(candidate: string, facts: SimpleSummaryFacts, sourceSummary?: string): boolean {
  const supported = new Set(
    `${JSON.stringify(facts)} ${sourceSummary || ''}`.match(NUMBER) || [],
  );
  return (candidate.match(NUMBER) || []).some((value) => !supported.has(value));
}

export function validateSimpleSummaryCandidate(options: {
  candidate: unknown;
  contentLocale: Locale;
  facts: SimpleSummaryFacts;
  sourceSummary?: string;
}): { ok: true; text: string } | { ok: false; reason: SimpleSummaryValidationFailure } {
  if (typeof options.candidate !== 'string') return { ok: false, reason: 'malformed_output' };
  const text = options.candidate.trim();
  if (/^(?:\{|\[|<)|\[object Object\]/u.test(text) || /<\/?(?:html|body|script)\b/iu.test(text)) {
    return { ok: false, reason: 'malformed_output' };
  }
  if ((normalizeSimpleSummaryText(text).match(LETTER_OR_NUMBER) || []).length < 24) {
    return { ok: false, reason: 'empty_or_near_empty' };
  }
  if (text.length > 1_600 || normalizeSimpleSummaryText(text).split(' ').length > 220) {
    return { ok: false, reason: 'unreasonable_length' };
  }
  if (!hasTargetScript(text, options.contentLocale)) {
    return { ok: false, reason: 'wrong_target_script' };
  }
  if (hasInventedEmployer(text, options.facts)) {
    return { ok: false, reason: 'invented_employer' };
  }
  if (hasUnsupportedNumber(text, options.facts, options.sourceSummary)) {
    return { ok: false, reason: 'unsupported_number' };
  }
  return { ok: true, text };
}

export function storeSimpleSummaryDiagnostic(diagnostic: SimpleSummaryDiagnostic): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIMPLE_SUMMARY_DIAGNOSTIC_KEY, JSON.stringify(diagnostic));
  } catch {
    // Diagnostics must never affect the Summary result.
  }
}

export async function runSimpleSummaryOperation(
  options: RunSimpleSummaryOptions,
): Promise<RunSimpleSummaryResult> {
  const sourceCv = options.cv;
  const contentLocale = getCvContentLocale(sourceCv, { uiLocale: options.uiLocale });
  const sourceSummary = String(sourceCv.summary || '').trim();
  const facts = buildSimpleSummaryFacts(sourceCv, contentLocale);
  const usageBefore = options.getUsageCount();
  const requestId = `simple-summary-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const sourceSummaryHash = hashSimpleSummaryText(sourceSummary);
  const factsHash = stableFactsHash(facts, sourceCv.personal?.gender || '');

  const finish = (
    outcome: SimpleSummaryOutcome,
    fields: Partial<SimpleSummaryDiagnostic> = {},
    extra: Pick<RunSimpleSummaryResult, 'validationFailureReason' | 'errorCode'> = {},
  ): RunSimpleSummaryResult => {
    const diagnostic: SimpleSummaryDiagnostic = {
      schemaVersion: SIMPLE_SUMMARY_DIAGNOSTIC_SCHEMA,
      simpleV1: true,
      timestamp: Date.now(),
      requestId,
      operation: options.operation,
      ...(options.style ? { style: options.style } : {}),
      contentLocale,
      uiLocale: options.uiLocale,
      sourceSummaryHash,
      providerResultKind: 'not_called',
      validationPassed: false,
      noOp: false,
      staleApplyRejected: false,
      applied: false,
      usageBefore,
      usageAfter: options.getUsageCount(),
      ...(process.env.NEXT_PUBLIC_SOURCE_COMMIT_SHORT
        ? { sourceCommitShort: process.env.NEXT_PUBLIC_SOURCE_COMMIT_SHORT.slice(0, 7).toLowerCase() }
        : {}),
      ...fields,
    };
    options.recordDiagnostic?.(diagnostic);
    return { outcome, diagnostic, ...extra };
  };

  if (!hasUsefulFacts(facts)) {
    return finish('source_facts_empty', { validationFailureReason: 'source_facts_empty' });
  }
  if (options.operation === 'rewrite' && !sourceSummary) {
    return finish('source_summary_empty', { validationFailureReason: 'source_summary_empty' });
  }

  const request: SimpleSummaryProviderRequest = {
    requestId,
    operation: options.operation,
    ...(options.style ? { style: options.style } : {}),
    contentLocale,
    gender: String(sourceCv.personal?.gender || ''),
    facts,
    ...(options.operation === 'rewrite' ? { sourceSummary } : {}),
  };

  let provider: SimpleSummaryProviderResult;
  try {
    provider = await options.transport(request);
  } catch {
    return finish('provider_failure', { providerResultKind: 'transport_failure' });
  }
  if (!provider.ok) {
    return finish('provider_failure', {
      providerResultKind: provider.resultKind || 'provider_failure',
      ...(provider.httpStatus ? { providerHttpStatus: provider.httpStatus } : {}),
    }, { errorCode: provider.errorCode });
  }

  const validation = validateSimpleSummaryCandidate({
    candidate: provider.candidate,
    contentLocale,
    facts,
    ...(options.operation === 'rewrite' ? { sourceSummary } : {}),
  });
  const candidateHash = typeof provider.candidate === 'string'
    ? hashSimpleSummaryText(provider.candidate)
    : undefined;
  if (!validation.ok) {
    return finish('validation_failed', {
      providerResultKind: 'candidate_received',
      ...(provider.httpStatus ? { providerHttpStatus: provider.httpStatus } : {}),
      ...(candidateHash ? { candidateHash } : {}),
      validationFailureReason: validation.reason,
    }, { validationFailureReason: validation.reason });
  }

  if (
    options.operation === 'rewrite'
    && normalizeSimpleSummaryText(validation.text) === normalizeSimpleSummaryText(sourceSummary)
  ) {
    return finish('no_op', {
      providerResultKind: 'candidate_received',
      ...(provider.httpStatus ? { providerHttpStatus: provider.httpStatus } : {}),
      candidateHash,
      validationPassed: true,
      noOp: true,
    });
  }

  const liveCv = options.getCurrentCv();
  const liveContentLocale = getCvContentLocale(liveCv, { uiLocale: options.uiLocale });
  const stale = liveCv.id !== sourceCv.id
    || hashSimpleSummaryText(liveCv.summary || '') !== sourceSummaryHash
    || liveContentLocale !== contentLocale
    || stableFactsHash(
      buildSimpleSummaryFacts(liveCv, liveContentLocale),
      liveCv.personal?.gender || '',
    ) !== factsHash;
  if (stale) {
    return finish('stale', {
      providerResultKind: 'candidate_received',
      ...(provider.httpStatus ? { providerHttpStatus: provider.httpStatus } : {}),
      candidateHash,
      validationPassed: true,
      staleApplyRejected: true,
    });
  }

  const nextCv: CVData = {
    ...liveCv,
    summary: validation.text,
    updatedAt: new Date().toISOString(),
  };
  if (!options.applyCv(nextCv)) {
    return finish('apply_failed', {
      providerResultKind: 'candidate_received',
      ...(provider.httpStatus ? { providerHttpStatus: provider.httpStatus } : {}),
      candidateHash,
      validationPassed: true,
      validationFailureReason: 'visible_apply_rejected',
    });
  }

  options.incrementUsage();
  return finish('applied', {
    providerResultKind: 'candidate_received',
    ...(provider.httpStatus ? { providerHttpStatus: provider.httpStatus } : {}),
    candidateHash,
    validationPassed: true,
    applied: true,
    usageAfter: usageBefore + 1,
  });
}
