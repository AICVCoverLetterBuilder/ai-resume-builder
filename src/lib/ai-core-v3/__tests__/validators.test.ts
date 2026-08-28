import { describe, expect, it, vi } from 'vitest';
import { createCandidateEnvelope } from '../candidate-envelope';
import type {
  AiCoreV3CandidateEnvelope,
  ExperienceFactManifest,
} from '../contracts';
import { createExperienceFactManifest } from '../experience-manifest';
import {
  runAiCoreV3Validation,
  validateStructuralPhase,
  type AiCoreV3Validator,
  type ValidationPhaseResult,
  type ViolationCategory,
} from '../validators';

function manifest(): ExperienceFactManifest {
  return createExperienceFactManifest({
    operationId: 'validator-operation',
    mode: 'enhance',
    entryId: 'stable-entry-id',
    locale: 'de',
    roleTitle: 'Servicetechniker',
    company: 'NordWerk',
    employmentState: 'present',
    dates: { start: { year: 2024 }, end: null },
    exactSourceText: 'Prüft Unterlagen.',
    facts: [{ factId: 'fact-1', text: 'Prüft Unterlagen.', sourceHash: 'fact-hash', required: true }],
    snapshotHash: 'snapshot-hash',
  });
}

function candidate(): AiCoreV3CandidateEnvelope {
  return createCandidateEnvelope({
    operationId: 'validator-operation',
    candidateId: 'candidate-1',
    operationKind: 'experience_enhance',
    targetLocale: 'de',
    sourceSnapshotHash: 'snapshot-hash',
    text: 'Prüft Unterlagen sorgfältig.',
    providerMetadata: { requestClass: 'test' },
    accepted: true,
  } as AiCoreV3CandidateEnvelope);
}

function passed(category: ViolationCategory): ValidationPhaseResult {
  return { category, status: 'passed', violations: [] };
}

function failed(category: ViolationCategory): ValidationPhaseResult {
  return {
    category,
    status: 'failed',
    violations: [{ code: `${category}_failure`, category, detail: `${category} failed` }],
  };
}

describe('AI Core V3 structural validation', () => {
  it('passes correct structural metadata as one phase only', () => {
    const context = { manifest: manifest(), candidate: candidate() };
    expect(validateStructuralPhase(context)).toEqual({
      category: 'structural',
      status: 'passed',
      violations: [],
    });
    expect(runAiCoreV3Validation(context).decision).toBe('not_ready');
    expect('accepted' in context.candidate).toBe(false);
  });

  it.each([
    ['operation ID', { operationId: 'wrong-operation' }, 'operation_id_mismatch'],
    ['snapshot hash', { sourceSnapshotHash: 'wrong-snapshot' }, 'snapshot_hash_mismatch'],
    ['operation kind', { operationKind: 'experience_generate' as const }, 'operation_kind_mismatch'],
    ['target locale', { targetLocale: 'fr' }, 'target_locale_mismatch'],
    ['empty candidate', { text: '  \n' }, 'empty_candidate_text'],
  ])('rejects a %s mismatch', (_label, patch, code) => {
    const result = validateStructuralPhase({
      manifest: manifest(),
      candidate: { ...candidate(), ...patch },
    });
    expect(result.status).toBe('failed');
    expect(result.violations.map((item) => item.code)).toContain(code);
  });
});

describe('AI Core V3 false-green aggregation', () => {
  it('keeps missing semantic and language-quality phases not_evaluated', () => {
    const result = runAiCoreV3Validation({ manifest: manifest(), candidate: candidate() });
    expect(result.decision).toBe('not_ready');
    expect(result.phases.structural.status).toBe('passed');
    expect(result.phases.semantic.status).toBe('not_evaluated');
    expect(result.phases.language_quality.status).toBe('not_evaluated');
  });

  it.each(['structural', 'semantic', 'language_quality'] as const)(
    'rejects when the %s phase fails',
    (failedCategory) => {
      const validators = {
        structural: () => failedCategory === 'structural' ? failed('structural') : passed('structural'),
        semantic: () => failedCategory === 'semantic' ? failed('semantic') : passed('semantic'),
        languageQuality: () => failedCategory === 'language_quality'
          ? failed('language_quality')
          : passed('language_quality'),
      };
      expect(runAiCoreV3Validation({ manifest: manifest(), candidate: candidate() }, validators).decision)
        .toBe('reject');
    },
  );

  it('fails closed with a typed violation when a validator throws', () => {
    const throwing: AiCoreV3Validator = () => {
      throw new Error('intentional test exception');
    };
    const result = runAiCoreV3Validation(
      { manifest: manifest(), candidate: candidate() },
      { semantic: throwing, languageQuality: () => passed('language_quality') },
    );
    expect(result.decision).toBe('reject');
    expect(result.phases.semantic.status).toBe('failed');
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'validator_exception',
      category: 'semantic',
    }));
  });

  it('accepts only three explicitly passed required phases', () => {
    const result = runAiCoreV3Validation(
      { manifest: manifest(), candidate: candidate() },
      {
        structural: () => passed('structural'),
        semantic: () => passed('semantic'),
        languageQuality: () => passed('language_quality'),
      },
    );
    expect(result.decision).toBe('accept');
  });

  it('never converts null, undefined, or skipped results to passed', () => {
    const context = { manifest: manifest(), candidate: candidate() };
    const nullResult = runAiCoreV3Validation(context, {
      semantic: () => null,
      languageQuality: () => undefined,
    });
    expect(nullResult.decision).toBe('not_ready');
    expect(nullResult.phases.semantic.status).toBe('not_evaluated');
    expect(nullResult.phases.language_quality.status).toBe('not_evaluated');

    const skippedResult = runAiCoreV3Validation(context, {
      semantic: () => ({ category: 'semantic', status: 'not_evaluated', violations: [] }),
      languageQuality: () => passed('language_quality'),
    });
    expect(skippedResult.decision).toBe('not_ready');
  });

  it('does not mutate inputs, expose replacement prose, or invoke external writers', () => {
    const sourceManifest = manifest();
    const sourceCandidate = candidate();
    const beforeManifest = JSON.stringify(sourceManifest);
    const beforeCandidate = JSON.stringify(sourceCandidate);
    const provider = vi.fn();
    const fallbackWriter = vi.fn();
    const applyWriter = vi.fn();
    const maliciousExtraField = () => ({
      ...passed('semantic'),
      replacementText: 'must not escape the validator boundary',
    }) as ValidationPhaseResult;

    const result = runAiCoreV3Validation(
      { manifest: sourceManifest, candidate: sourceCandidate },
      { semantic: maliciousExtraField, languageQuality: () => passed('language_quality') },
    );

    expect(JSON.stringify(sourceManifest)).toBe(beforeManifest);
    expect(JSON.stringify(sourceCandidate)).toBe(beforeCandidate);
    expect(JSON.stringify(result)).not.toContain('replacementText');
    expect(JSON.stringify(result)).not.toContain('must not escape');
    expect(provider).not.toHaveBeenCalled();
    expect(fallbackWriter).not.toHaveBeenCalled();
    expect(applyWriter).not.toHaveBeenCalled();
  });
});
