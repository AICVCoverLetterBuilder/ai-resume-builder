import { describe, expect, it, vi } from 'vitest';
import { createEmptyCv } from '@/lib/cv-defaults';
import { findExactDurationMeasurements } from '../exact-duration-measurement';
import { createConfirmedEmploymentTenureRelation, projectSummaryEmploymentTenureRequest,
  prepareSummaryEmploymentTenureServerRequest } from '../summary-employment-tenure-relation';
import { bindTrustedEmploymentTenureRuntime, trustedEmploymentTenureAuthority,
  trustedTenureCandidateComparison, trustedTenureSourceComparison, validateTrustedTenureCandidate, summaryDurationCandidateComparison,
  resolveSummaryTenureRemediation, createSummaryTenureRemediation } from '../summary-trusted-tenure-runtime';
import { createSummaryV3StyleOperationSnapshot, hashSummaryV3StyleValue, summaryV3StyleCandidateUnitHash,
  inspectSummaryV3StyleCandidatePreservesLocks, inspectSummaryV3StyleCandidateSourceFloor,
  type SummaryV3StyleRequest } from '../summary-style-m5';
import { executeSummaryV3StyleServer, type SummaryV3StyleWriterInput,
  type SummaryV3StyleEvaluatorInput } from '../summary-style-m5-server';
import { executeSummaryV3StyleRoute, normalizeSummaryV3StyleRouteRequest } from '../summary-style-m5-provider';
import { runSummaryV3StyleClientOperation, summaryV3StyleSourceStillCurrent,
  type SummaryV3StyleClientInput } from '../summary-style-m5-client';
import { translations, languages } from '@/lib/i18n/translations';
import { readSummaryStyleLocalDiagnostics } from '../summary-style-m5-local-observability';
import type { CVData } from '@/lib/types';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const SOURCE = 'SyntheticPerson currently works as a Clerk at FictionalLab for about 8 months. SyntheticPerson builds reliable APIs.';
function cv(summary = SOURCE): CVData {
  const value = createEmptyCv();
  return { ...value, id: 'synthetic-cv', summary, contentLocale: 'en',
    personal: { ...value.personal, fullName: 'SyntheticPerson' },
    experience: [{ id: 'synthetic-entry', position: 'Clerk', company: 'FictionalLab', startDate: '2026-01',
      endDate: '', isPresent: true, description: 'builds reliable APIs', positionSourceLocale: 'en' }] };
}
function bind(value = cv(), entryId = value.experience[0]!.id): CVData {
  const confirmation = createConfirmedEmploymentTenureRelation({ confirmation: 'employment_tenure', cv: value,
    measurement: findExactDurationMeasurements(value.summary)[0]!, explicitlySelectedExperienceStableId: entryId });
  if (confirmation.status !== 'created') throw new Error('Synthetic confirmation failed');
  return { ...value, summaryEmploymentTenureRelations: confirmation.relations };
}
function input(value = cv()): SummaryV3StyleClientInput {
  return { enabled: true, style: 'stronger', operationId: 'synthetic-operation', requestId: 'synthetic-request', cv: value,
    currentRoleExperienceId: value.experience[0]!.isPresent ? value.experience[0]!.id : null,
    requestedLocale: 'en', sourceLocale: 'en', jobContextKey: 'synthetic-context', referenceDateIso: '2026-10-01',
    usageCountBefore: 4, proToken: 'offline-placeholder', createdAt: 2000 };
}
function request(value = cv(), months = 9): SummaryV3StyleRequest {
  const entry = value.experience[0]!;
  const stableId = `entry-${hashSummaryV3StyleValue(entry.id)}`;
  return { enabled: true, operation: 'summary_stronger', operationId: 'synthetic-operation', style: 'stronger',
    requestedLocale: 'en', sourceLocale: 'en', visibleSummary: value.summary, createdAt: 2000,
    protectedEntities: ['SyntheticPerson'],
    visibleSummaryFacts: [{ id: 'synthetic-duty', text: 'builds reliable APIs', semanticKind: 'duty',
      transformableDuty: { sourcePredicate: 'builds', predicateAnchor: 'builds' } }],
    manifest: { manifestId: 'synthetic-manifest', contextId: 'synthetic-context', sourceLocale: 'en',
      currentRoleEntryId: entry.isPresent ? stableId : null, entries: [{ stableId, role: entry.position,
        employer: entry.company, employmentState: entry.isPresent ? 'present' : 'completed', durationMonths: months,
        facts: [{ id: 'synthetic-grounding', text: 'builds reliable APIs' }] }] } };
}
function state(value = bind(), months = 9) {
  const prepared = prepareSummaryEmploymentTenureServerRequest(projectSummaryEmploymentTenureRequest(request(value, months), value));
  return bindTrustedEmploymentTenureRuntime(createSummaryV3StyleOperationSnapshot(prepared.contentRequest), prepared.resolution);
}
function writer(inputValue: SummaryV3StyleWriterInput, text: string) {
  return { toolName: inputValue.forcedTool.toolName, contentBlockCount: 1, textBlockCount: 0, toolBlockCount: 1,
    input: { operationId: inputValue.operationId, snapshotHash: inputValue.snapshotHash, manifestHash: inputValue.manifestHash,
      style: inputValue.style, locale: inputValue.locale,
      units: [{ unitId: 'synthetic-unit', text, factIds: inputValue.requiredFacts.map((fact) => fact.id) }] } };
}
function evaluator(value: SummaryV3StyleEvaluatorInput, noOp = false) {
  return { toolName: value.forcedTool.toolName, contentBlockCount: 1, textBlockCount: 0, toolBlockCount: 1,
    input: { operationId: value.operationId, snapshotHash: value.snapshotHash, manifestHash: value.manifestHash,
      style: value.style, locale: value.locale, candidateHash: value.candidate.hash,
      candidateUnitHashes: value.candidate.units.map(summaryV3StyleCandidateUnitHash),
      phases: Object.fromEntries(['structural', 'semantic_grounding', 'language_native_quality', 'style_fulfillment']
        .map((phase) => [phase, { status: 'passed', violations: [] }])),
      representedFactIdHashes: value.requiredFacts.map((fact) => fact.hash), missingFactIdHashes: [],
      roleIdentityResolution: 'not_required', styleEvidence: { style: 'stronger',
        strongerPredicateTransformations: noOp ? 0 : 1, structuralStrengtheningCount: noOp ? 0 : 1,
        modifierOnlyTransformationDetected: false, repeatedStyleModifierCount: 0, stackedModifierDetected: false,
        unsupportedAuthorityDetected: false, strongerFulfilled: true, noOpDetected: noOp } } };
}
const CURRENT = SOURCE.replace('8 months', '9 months').replace('builds reliable APIs', 'engineers reliable APIs');
async function run(value = bind(), text = CURRENT) {
  const req = projectSummaryEmploymentTenureRequest(request(value), value);
  const writes: SummaryV3StyleWriterInput[] = [], evaluations: SummaryV3StyleEvaluatorInput[] = [];
  const result = await executeSummaryV3StyleServer(req, {
    async write(i) { writes.push(i); return writer(i, text); },
    async evaluate(i) { evaluations.push(i); return evaluator(i, text === value.summary); },
  });
  return { result, writes, evaluations };
}

describe('Task084 trusted tenure runtime authority and actual server/client wiring', () => {
  it('runs the exact legacy topology and returns only bounded remediation selectors', async () => {
    const value = cv(), before = JSON.stringify(value);
    const { result, writes, evaluations } = await run(value, SOURCE);
    expect(result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op', evidence: { safeNoOpSelected: true } });
    expect(writes).toHaveLength(1); expect(evaluations).toHaveLength(1);
    expect(readSummaryStyleLocalDiagnostics(result).sourceFloorFirstProducer).toBeNull();
    expect(result).not.toHaveProperty('remediation');
    expect(result).not.toHaveProperty('tenureOperationFingerprint');
    expect(result).not.toHaveProperty('candidate');
    expect(writes[0]!.sourceText).toBe(SOURCE);
    expect(writes[0]!).not.toHaveProperty('trustedTenureClaims');
    const snapshot = state(value);
    expect(trustedEmploymentTenureAuthority(snapshot)).toBeNull();
    expect(summaryDurationCandidateComparison(snapshot, SOURCE)).not.toBeNull();
    expect(summaryDurationCandidateComparison(snapshot, SOURCE.replace('8 months', '9 months'))).toBeNull();
    expect(value.summaryEmploymentTenureRelations).toBeUndefined();
    expect(JSON.stringify(value)).toBe(before);
  });
  it('accepts the refreshed current candidate through the actual writer/evaluator/finalizer', async () => {
    const { result, writes, evaluations } = await run();
    expect(result.kind).toBe('candidate_ready');
    expect(writes).toHaveLength(1); expect(evaluations).toHaveLength(1);
    expect(result.tenureOperationFingerprint).toBeTruthy();
    expect(writes[0]!.sourceText).toBe(SOURCE);
    expect(writes[0]!.trustedTenureClaims?.[0]?.currentDurationMonths).toBe(9);
    expect(JSON.stringify(writes)).not.toMatch(/summaryEmploymentTenure|durationSpanHash|synthetic-entry|synthetic-cv/);
  });
  it.each(['8 months', '11 months', '9 years', '9 monthsXYZ'])('independently rejects stale/invented/wrong-unit/contaminated %s', async (surface) => {
    const candidate = CURRENT.replace('9 months', surface);
    expect(validateTrustedTenureCandidate(state(), candidate).valid).toBe(false);
    const { result, evaluations } = await run(bind(), candidate);
    expect(result.kind).toBe('handled_failure'); expect(evaluations).toHaveLength(0);
  });
  it.each([
    CURRENT.replace(' for about 9 months', '') + ' I completed a project for 9 months.',
    CURRENT.replace('Clerk', 'Mentor'), CURRENT.replace('FictionalLab', 'OtherSyntheticLab'),
    CURRENT.replace('9 months', '9 months and 8 awards'),
    CURRENT + ' ' + CURRENT.split('. ')[0] + '.',
  ])('rejects moved, changed protected claim, unrelated numeral or duplicate continuation', (candidate) => {
    expect(validateTrustedTenureCandidate(state(), candidate).valid).toBe(false);
  });
  it('rejects two source relations claiming the same source/candidate unit', () => {
    let value = cv(SOURCE.replace('8 months', '8 months and 7 months'));
    value = bind(value);
    const next = createConfirmedEmploymentTenureRelation({ confirmation: 'employment_tenure', cv: value,
      measurement: findExactDurationMeasurements(value.summary)[1]!, explicitlySelectedExperienceStableId: value.experience[0]!.id });
    expect(next.status).toBe('created');
    if (next.status === 'created') {
      expect(validateTrustedTenureCandidate(state({ ...value, summaryEmploymentTenureRelations: next.relations }), CURRENT).valid).toBe(false);
    }
  });
  it('reconciles only the exact trusted source span, not another duration or equal numeral', async () => {
    const value = bind(cv(SOURCE + ' SyntheticPerson worked on a project for 8 months and used 8 tools.'));
    const snapshot = state(value);
    const view = trustedTenureSourceComparison(snapshot);
    expect(view.sourceSummary).not.toContain('for about 8 months');
    expect(view.sourceSummary).not.toContain('project for 8 months');
    expect(view.sourceSummary).toContain('used 8 tools');
    expect(snapshot.sourceSummary).toBe(value.summary);
    const refreshed = value.summary.replace('about 8 months', 'about 9 months');
    expect(validateTrustedTenureCandidate(snapshot, refreshed).valid).toBe(true);
    expect(summaryDurationCandidateComparison(snapshot, refreshed)).not.toBeNull();
    expect(summaryDurationCandidateComparison(snapshot, refreshed.replace('project for 8 months', 'project for 9 months'))).toBeNull();
    // The equal plain numeral remains subject to the existing numeric owner.
    const plain = await run(value, refreshed);
    expect(plain.result.kind).toBe('handled_failure');
    expect(plain.result.kind === 'handled_failure' && plain.result.typedReason).toBe('unsupported_claim');
    expect(readSummaryStyleLocalDiagnostics(plain.result).sourceFloorFirstProducer).toBe('source_numeric_membership_mismatch');
  });
  it('provides source-lock and fact comparison only after the independent candidate validator passes', () => {
    const snapshot = state();
    expect(trustedTenureCandidateComparison(snapshot, SOURCE)).toBeNull();
    const view = trustedTenureCandidateComparison(snapshot, CURRENT)!;
    expect(inspectSummaryV3StyleCandidatePreservesLocks(view, CURRENT).preserved).toBe(true);
    expect(inspectSummaryV3StyleCandidateSourceFloor(view, CURRENT).firstFailedFact).toBeNull();
    expect(inspectSummaryV3StyleCandidatePreservesLocks(view, CURRENT.replace('FictionalLab', 'OtherSyntheticLab')).preserved).toBe(false);
    expect(snapshot.requiredFacts.some((fact) => fact.text.includes('8 months'))).toBe(true);
  });
  it('closed entry gains no stale refresh permission', () => {
    const value = bind(); value.experience[0]!.isPresent = false; value.experience[0]!.endDate = '2026-09';
    expect(trustedEmploymentTenureAuthority(state(value))).toBeNull();
    expect(trustedTenureSourceComparison(state(value)).sourceSummary).toBe(value.summary);
    // No CURRENT waiver; unchanged baseline guards, not a new closed-role rule.
    expect(trustedTenureCandidateComparison(state(value), CURRENT)?.sourceSummary).toBe(value.summary);
  });
  it('current valid tenure retains baseline safe-no-op semantics', async () => {
    const value = bind(cv(SOURCE.replace('8 months', '9 months')));
    expect((await run(value, value.summary)).result.kind).toBe('safe_no_op');
  });
  it('stale trusted tenure cannot safe-no-op unchanged', async () => {
    expect((await run(bind(), SOURCE)).result.kind).toBe('handled_failure');
  });
  it('creates exact new Summary/span/hash continuity without mutating the prior relation', () => {
    const value = bind(), before = JSON.stringify(value);
    const validation = validateTrustedTenureCandidate(state(value), CURRENT);
    expect(validation.valid).toBe(true);
    expect(validation.continuations[0]).toMatchObject({ experienceStableId: 'synthetic-entry', summaryHash: hashSummaryV3StyleValue(CURRENT),
      durationSpanHash: hashSummaryV3StyleValue('9 months') });
    expect(JSON.stringify(value)).toBe(before);
  });
  it('relation-dependent identity cannot be shared by different entry ownership', () => {
    const value = cv(); value.experience.push({ ...value.experience[0]!, id: 'synthetic-other' });
    const original = request(value);
    const base = { ...original, manifest: { ...original.manifest, entries: [...original.manifest.entries,
      { ...original.manifest.entries[0]!, stableId: `entry-${hashSummaryV3StyleValue('synthetic-other')}`,
        facts: [{ id: 'synthetic-other-grounding', text: 'builds reliable APIs' }] }] } };
    const snapshots = ['synthetic-entry', 'synthetic-other'].map((id) => {
      const bound = bind(value, id), prepared = prepareSummaryEmploymentTenureServerRequest(projectSummaryEmploymentTenureRequest(base, bound));
      return bindTrustedEmploymentTenureRuntime(createSummaryV3StyleOperationSnapshot(prepared.contentRequest), prepared.resolution);
    });
    expect(snapshots[0]!.snapshotHash).not.toBe(snapshots[1]!.snapshotHash);
    expect(trustedEmploymentTenureAuthority(snapshots[0]!)?.fingerprint).not.toBe(trustedEmploymentTenureAuthority(snapshots[1]!)?.fingerprint);
  });
  it.each(['summary', 'relation', 'delete', 'date'] as const)('blocks pending apply after %s authority changes', async (change) => {
    const value = bind(); let current = value;
    const commit = vi.fn();
    const outcome = await runSummaryV3StyleClientOperation(input(value), {
      async request(body) {
        const req = normalizeSummaryV3StyleRouteRequest('summary_stronger', body, 2000);
        const result = await executeSummaryV3StyleServer(req, { async write(i) { return writer(i, CURRENT); }, async evaluate(i) { return evaluator(i); } });
        if (change === 'summary') current = { ...value, summary: 'Synthetic edit.' };
        if (change === 'relation') current = { ...value, summaryEmploymentTenureRelations: [] };
        if (change === 'delete') current = { ...value, experience: [] };
        if (change === 'date') current = { ...value, experience: [{ ...value.experience[0]!, startDate: '2026-02' }] };
        return { data: result, status: 200 };
      }, getLiveCv: () => current, getActiveOperationId: () => 'synthetic-operation', commitCandidate: commit,
    });
    expect(outcome.kind).toBe('terminal'); expect(commit).not.toHaveBeenCalled();
  });
  it('actual live client projects the relation and atomically passes its continuation with Summary to existing usage owner', async () => {
    const value = bind(); let bodySeen: Record<string, unknown> = {}, next: CVData | null = null;
    let usage = 4;
    const outcome = await runSummaryV3StyleClientOperation(input(value), {
      async request(body) {
        bodySeen = body;
        const req = normalizeSummaryV3StyleRouteRequest('summary_stronger', body, 2000);
        const result = await executeSummaryV3StyleServer(req, { async write(i) { return writer(i, CURRENT); }, async evaluate(i) { return evaluator(i); } });
        return { data: { ...result, forgedContinuation: { durationSpanStart: 0, durationSpanEnd: 1 } }, status: 200 };
      }, getLiveCv: () => value, getActiveOperationId: () => 'synthetic-operation',
      commitCandidate(commit) {
        next = commit.nextCv; usage += 1;
        return { kind: 'committed', operationId: commit.operationId, requestId: commit.requestId } as never;
      },
    });
    expect(bodySeen).toHaveProperty('summaryEmploymentTenure');
    expect(outcome.kind).toBe('committed'); expect(usage).toBe(5);
    expect(next).toMatchObject({ summary: CURRENT, summaryEmploymentTenureRelations: [
      { summaryHash: hashSummaryV3StyleValue(CURRENT), experienceStableId: 'synthetic-entry', durationSpanHash: hashSummaryV3StyleValue('9 months') },
    ] });
  });
  it('no relation and invalid relation preserve identical provider envelopes; only exact legacy remediation is additive', async () => {
    const base = request(); const forged = { ...base, summaryEmploymentTenure: { cvId: 'synthetic-cv', relations: [{ nonsense: true }] } };
    const capture = async (req: SummaryV3StyleRequest) => {
      const calls: unknown[] = [];
      const result = await executeSummaryV3StyleRoute(req, { timeoutForPhase: () => 1, async invoke(i) {
        calls.push(i);
        const envelope = i.role === 'writer' ? writer(i.input as SummaryV3StyleWriterInput, SOURCE) : evaluator(i.input as SummaryV3StyleEvaluatorInput, true);
        return { content: [{ type: 'tool_use', name: envelope.toolName, input: envelope.input }] };
      } });
      return { result, calls };
    };
    const noRelation = await capture(base), invalid = await capture(forged as unknown as SummaryV3StyleRequest);
    expect(invalid).toEqual(noRelation);
    expect(JSON.stringify(noRelation.calls)).not.toContain('trustedTenureClaims');
  });
  it('does not grant authority to forged candidate spans or corrupted source measurements', () => {
    const value = bind(); value.summaryEmploymentTenureRelations = [{ ...value.summaryEmploymentTenureRelations![0]!, durationSpanEnd: 1 }];
    expect(trustedEmploymentTenureAuthority(state(value))).toBeNull();
    expect(validateTrustedTenureCandidate(state(), CURRENT.replace('9 months', '9 monthsXYZ')).valid).toBe(false);
  });
  it('remediation revalidation rejects changed Summary or selectors and does not guess a measurement', () => {
    const measurement = findExactDurationMeasurements(SOURCE)[0]!;
    const r = { type: 'employment_tenure_binding_required', summaryHash: hashSummaryV3StyleValue(SOURCE),
      durationSpanStart: measurement.start, durationSpanEnd: measurement.end, durationSpanHash: hashSummaryV3StyleValue('8 months') };
    expect(resolveSummaryTenureRemediation(r, SOURCE)).not.toBeNull();
    expect(resolveSummaryTenureRemediation(r, SOURCE + ' Edited.')).toBeNull();
    expect(resolveSummaryTenureRemediation({ ...r, durationSpanStart: measurement.start + 1 }, SOURCE)).toBeNull();
    expect(resolveSummaryTenureRemediation({ ...r, raw: SOURCE }, SOURCE)).toBeNull();
  });
  it('unchanged source authority check includes relation state', () => {
    const value = bind(), snapshot = state(value);
    expect(summaryV3StyleSourceStillCurrent({ input: input(value), snapshot, liveCv: { ...value, summaryEmploymentTenureRelations: [] } })).toBe(false);
  });
  it.each(['other number', 'other duration'] as const)('does not waive an unbound %s after trusted refresh', async (family) => {
    const tail = family === 'other number' ? ' SyntheticPerson uses 77 tools.' : ' SyntheticPerson completed a project for 7 months.';
    const value = bind(cv(SOURCE + tail));
    const result = await run(value, CURRENT + tail);
    if (family === 'other duration') {
      expect(result.result.kind).toBe('candidate_ready');
      if (result.result.kind !== 'candidate_ready') throw new Error('Trusted-plus-opaque candidate missing');
      expect(result.result.candidate.text).toBe(CURRENT + tail);
      expect(result.result.tenureOperationFingerprint).toBe(trustedEmploymentTenureAuthority(state(value))!.fingerprint);
      for (const candidate of [CURRENT + tail.replace('7 months', '8 months'),
        CURRENT + tail.replace(' for 7 months', ''),
        CURRENT + tail.replace(' for 7 months', '') + ' SyntheticPerson worked for 7 months.',
        SOURCE + tail,
        CURRENT.replace('9 months', '7 months') + tail.replace('7 months', '9 months')]) {
        expect(summaryDurationCandidateComparison(state(value), candidate)).toBeNull();
        expect((await run(value, candidate)).result.kind).toBe('handled_failure');
      }
      expect(value.summary).toBe(SOURCE + tail);
      return;
    }
    expect(result.result.kind).toBe('handled_failure');
    expect(result.result.kind === 'handled_failure' && result.result.typedReason).toBe('unsupported_claim');
    expect(readSummaryStyleLocalDiagnostics(result.result).sourceFloorFirstProducer).toBe('source_numeric_membership_mismatch');
  });
  it('a different Experience cannot use another entry current duration', () => {
    const value = cv(); value.experience.push({ ...value.experience[0]!, id: 'synthetic-other', startDate: '2026-02' });
    const base = request(value);
    const req = { ...base, manifest: { ...base.manifest, entries: [...base.manifest.entries,
      { ...base.manifest.entries[0]!, stableId: `entry-${hashSummaryV3StyleValue('synthetic-other')}`, durationMonths: 11,
        facts: [{ id: 'synthetic-other-grounding', text: 'builds reliable APIs' }] }] } };
    const prepared = prepareSummaryEmploymentTenureServerRequest(projectSummaryEmploymentTenureRequest(req, bind(value, 'synthetic-other')));
    const snapshot = bindTrustedEmploymentTenureRuntime(createSummaryV3StyleOperationSnapshot(prepared.contentRequest), prepared.resolution);
    expect(validateTrustedTenureCandidate(snapshot, CURRENT).valid).toBe(false);
    expect(validateTrustedTenureCandidate(snapshot, CURRENT.replace('9 months', '11 months')).valid).toBe(true);
  });
  it('no/ambiguous parser mapping cannot issue remediation, and only the captured numeric location is used', () => {
    const snapshot = createSummaryV3StyleOperationSnapshot(request());
    const at = SOURCE.indexOf('8');
    expect(createSummaryTenureRemediation(snapshot, { source: SOURCE.toLocaleLowerCase(), start: at, end: at + 1 })).not.toBeNull();
    expect(createSummaryTenureRemediation(snapshot, { source: SOURCE.toLocaleLowerCase(), start: 0, end: 1 })).toBeNull();
    expect(createSummaryTenureRemediation(snapshot, { source: SOURCE.toLocaleLowerCase(), start: at, end: SOURCE.length })).toBeNull();
    const contaminated = SOURCE.replace('8 months', '8 monthsXYZ');
    expect(createSummaryTenureRemediation(createSummaryV3StyleOperationSnapshot(request(cv(contaminated))),
      { source: contaminated.toLocaleLowerCase(), start: at, end: at + 1 })).toBeNull();
  });
  it('provider failure and rejected candidates leave persisted relation/usage unchanged', async () => {
    const value = bind(), before = JSON.stringify(value), commit = vi.fn();
    for (const failure of ['provider', 'stale'] as const) {
      const outcome = await runSummaryV3StyleClientOperation(input(value), {
        async request(body) {
          const req = normalizeSummaryV3StyleRouteRequest('summary_stronger', body, 2000);
          const result = await executeSummaryV3StyleServer(req, { async write(i) {
            if (failure === 'provider') throw new Error('synthetic offline provider failure');
            return writer(i, SOURCE);
          }, async evaluate(i) { return evaluator(i); } });
          return { data: result, status: 422 };
        }, getLiveCv: () => value, getActiveOperationId: () => 'synthetic-operation', commitCandidate: commit,
      });
      expect(outcome.kind).toBe('terminal'); expect(JSON.stringify(value)).toBe(before);
    }
    expect(commit).not.toHaveBeenCalled();
  });
  it('client rejects a forged stale safe-no-op without mutating relation or usage', async () => {
    const value = bind(), commit = vi.fn();
    const { result } = await run(bind(cv(SOURCE.replace('8 months', '9 months'))), SOURCE.replace('8 months', '9 months'));
    const outcome = await runSummaryV3StyleClientOperation(input(value), {
      request: async () => ({ data: result, status: 200 }), getLiveCv: () => value,
      getActiveOperationId: () => 'synthetic-operation', commitCandidate: commit,
    });
    expect(outcome).toMatchObject({ kind: 'terminal', reason: 'safe_no_op_invalid' }); expect(commit).not.toHaveBeenCalled();
  });
  it('immutable Git baseline provider contract and non-remediation results stay equal for unrelated operations', async () => {
    const root = process.cwd(), retained = readFileSync(resolve(root,
      'src/lib/ai-core-v3/__tests__/summary-current-role-stale-duration-reconciliation.test.ts'), 'utf8');
    const boundary = retained.indexOf("describe('Task078");
    const memory: { exports: { baseline?: { provider: typeof import('../summary-style-m5-provider') } } } = { exports: {} };
    new Function('require', 'module', 'exports', ts.transpileModule(retained.slice(0, boundary), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText + '\nexports.baseline=before;\n')((id: string) => id === 'vitest' ? {} : createRequire(resolve(root, 'package.json'))(id), memory, memory.exports);
    const baseline = memory.exports.baseline!.provider;
    const capture = async (execute: typeof executeSummaryV3StyleRoute, req: SummaryV3StyleRequest) => {
      const calls: unknown[] = [];
      const result = await execute(req, { timeoutForPhase: () => 1, async invoke(i) {
        calls.push(i);
        const text = req.visibleSummary;
        const envelope = i.role === 'writer' ? writer(i.input as SummaryV3StyleWriterInput, text) : evaluator(i.input as SummaryV3StyleEvaluatorInput, true);
        return { content: [{ type: 'tool_use', name: envelope.toolName, input: envelope.input }] };
      } });
      return { calls, result };
    };
    const current = cv(SOURCE.replace('8 months', '9 months'));
    const closed = cv(); closed.experience[0]!.isPresent = false; closed.experience[0]!.endDate = '2026-09';
    for (const [value, metadata] of [[cv(), false], [current, false], [current, true], [closed, true]] as const) {
      const req = metadata ? projectSummaryEmploymentTenureRequest(request(value), bind(value)) : request(value);
      const before = await capture(baseline.executeSummaryV3StyleRoute, req), after = await capture(executeSummaryV3StyleRoute, req);
      expect(after.calls).toEqual(before.calls);
      expect(JSON.stringify(after.calls)).toBe(JSON.stringify(before.calls));
      if (!metadata && value.summary === SOURCE && value.experience[0]!.isPresent) {
        expect(before.result.kind).toBe('handled_failure');
        expect(after.result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op',
          evidence: { safeNoOpSelected: true, writerAttempts: 1, evaluatorAttempts: 1 } });
        expect(after.result).not.toHaveProperty('remediation');
        expect(after.result).not.toHaveProperty('tenureOperationFingerprint');
        expect(after.calls).toHaveLength(2);
        expect(JSON.stringify(after.calls)).not.toContain('trustedTenureClaims');
        expect(trustedEmploymentTenureAuthority(state(value))).toBeNull();
        expect(summaryDurationCandidateComparison(state(value), SOURCE.replace('8 months', '9 months'))).toBeNull();
        expect(value.summary).toBe(SOURCE);
        expect(value.summaryEmploymentTenureRelations).toBeUndefined();
        continue;
      }
      const { remediation: _remediation, tenureOperationFingerprint: _fingerprint, ...contentResult } = after.result;
      expect(contentResult).toEqual(before.result);
      if (value.experience[0]!.isPresent === false) expect(after.result).toEqual(before.result);
    }
  }, 30_000);
});

const nativeMonths = { en: 'months', de: 'Monaten', es: 'meses', fr: 'mois', it: 'mesi', ar: 'أشهر',
  sr: 'meseci', hr: 'mjeseci', ru: 'месяцев', 'pt-BR': 'meses', hi: 'महीने', ja: 'か月' } as const;
describe('Task084 exact parser reuse, native runtime and UI label coverage across 12 locales', () => {
  it.each(languages.map(({ code }) => code))('%s current/stale/invented measurements retain same confirmed claim slot', (locale) => {
    const surface = (n: number) => `${n}${locale === 'ja' ? '' : ' '}${nativeMonths[locale]}`;
    const value = bind(cv(SOURCE.replace('8 months', surface(8))));
    const snapshot = state(value);
    expect(validateTrustedTenureCandidate(snapshot, value.summary.replace(surface(8), surface(9))).valid).toBe(true);
    expect(validateTrustedTenureCandidate(snapshot, value.summary).valid).toBe(false);
    expect(validateTrustedTenureCandidate(snapshot, value.summary.replace(surface(8), surface(11))).valid).toBe(false);
    expect(translations[locale]).not.toHaveProperty('employmentTenureConfirmation');
  });
});
