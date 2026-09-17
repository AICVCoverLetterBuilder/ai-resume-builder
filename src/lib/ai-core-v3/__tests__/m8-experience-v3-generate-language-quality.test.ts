import { describe, expect, it } from 'vitest';
import {
  EXPERIENCE_V3_EVALUATOR_TOOL_NAME,
  EXPERIENCE_V3_EVALUATOR_TOOL,
  EXPERIENCE_V3_LANGUAGE_QUALITY_HARD_DEFECT_CODES,
  EXPERIENCE_V3_LANGUAGE_QUALITY_STYLE_PREFERENCE_CODES,
  buildExperienceV3EvaluatorPrompt,
  executeExperienceV3GenerateServer,
} from '../experience-generate-server';
import type { ExperienceFactManifest } from '../contracts';

const GERMAN_PRESENT_BULLETS = [
  'Führt Wartungs- und Instandhaltungsarbeiten an elektrotechnischen Anlagen und Systemen durch.',
  'Analysiert und behebt Störungen im Bereich der Elektrotechnik systematisch und fachgerecht.',
  'Dokumentiert durchgeführte Servicearbeiten und unterstützt die Sicherstellung des ordnungsgemäßen Anlagenbetriebs.',
] as const;

function manifest(overrides: Partial<ExperienceFactManifest> = {}): ExperienceFactManifest {
  return {
    operationId: 'm8-language-quality',
    operationKind: 'experience_generate',
    mode: 'generate',
    entryId: 'entry-language-quality',
    locale: 'de',
    roleTitle: 'Elektrofachkraft',
    company: 'Beispielbetrieb',
    employmentState: 'present',
    dates: { start: { year: 2024, month: 1 }, end: null },
    industry: 'engineering',
    level: 'mid',
    exactSourceText: '',
    facts: [],
    snapshotHash: 'snapshot-language-quality',
    ...overrides,
  };
}

function writerOutput(value: ExperienceFactManifest, bullets: readonly string[] = GERMAN_PRESENT_BULLETS): string {
  return JSON.stringify({
    operationId: value.operationId,
    entryId: value.entryId,
    snapshotHash: value.snapshotHash,
    locale: value.locale,
    bullets,
  });
}

function evaluatorResponse(
  value: ExperienceFactManifest,
  languageQuality: Record<string, unknown> = { status: 'passed', violations: [] },
) {
  return {
    stopReason: 'tool_use',
    content: [{
      type: 'tool_use' as const,
      name: EXPERIENCE_V3_EVALUATOR_TOOL_NAME,
      input: {
        operationId: value.operationId,
        entryId: value.entryId,
        snapshotHash: value.snapshotHash,
        locale: value.locale,
        phases: {
          semantic: { status: 'passed', violations: [] },
          language_quality: languageQuality,
        },
      },
    }],
  };
}

async function run(
  value: ExperienceFactManifest,
  languageQuality: Record<string, unknown> = { status: 'passed', violations: [] },
) {
  return executeExperienceV3GenerateServer({ manifest: value }, {
    generate: async () => writerOutput(value),
    evaluate: async () => evaluatorResponse(value, languageQuality),
  });
}

describe('M8 Generate language-quality canonical style contract', () => {
  it('fails closed for the pre-fix false green: a failed empty language-quality phase', async () => {
    const result = await run(manifest(), { status: 'failed', violations: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.typedReason).toBe('evaluator_tool_input_malformed');
  });

  it.each([
    ['passed + empty', { status: 'passed', violations: [] }, true],
    ['failed + empty', { status: 'failed', violations: [] }, false],
    ['failed + canonical style only', {
      status: 'failed',
      violations: [{
        code: 'style_convention_preference',
        category: 'language_quality',
        classification: 'style_preference',
        detail: 'Style-only evidence.',
      }],
    }, true],
    ['failed + canonical hard defect', {
      status: 'failed',
      violations: [{
        code: 'grammar_error',
        category: 'language_quality',
        classification: 'hard_defect',
        detail: 'Blocking evidence.',
      }],
    }, false],
    ['failed + style and hard defect', {
      status: 'failed',
      violations: [
        {
          code: 'style_convention_preference',
          category: 'language_quality',
          classification: 'style_preference',
          detail: 'Style-only evidence.',
        },
        {
          code: 'grammar_error',
          category: 'language_quality',
          classification: 'hard_defect',
          detail: 'Blocking evidence.',
        },
      ],
    }, false],
    ['passed + canonical style', {
      status: 'passed',
      violations: [{
        code: 'style_convention_preference',
        category: 'language_quality',
        classification: 'style_preference',
        detail: 'Impossible passed-phase evidence.',
      }],
    }, false],
    ['passed + canonical hard defect', {
      status: 'passed',
      violations: [{
        code: 'grammar_error',
        category: 'language_quality',
        classification: 'hard_defect',
        detail: 'Impossible passed-phase evidence.',
      }],
    }, false],
    ['failed + unknown code', {
      status: 'failed',
      violations: [{
        code: 'unknown_language_quality_code',
        category: 'language_quality',
        classification: 'hard_defect',
        detail: 'Unknown evidence.',
      }],
    }, false],
  ] as const)('enforces the raw language-quality phase shape: %s', async (_label, phase, accepted) => {
    const result = await run(manifest(), phase);
    expect(result.ok).toBe(accepted);
    if (accepted) {
      expect(result).toMatchObject({
        ok: true,
        validation: { phases: { language_quality: { status: 'passed', violations: [] } } },
      });
    } else if (!result.ok) {
      expect(['validation_rejected', 'evaluator_tool_input_malformed']).toContain(result.typedReason);
    }
  });

  it('accepts the exact physical German present-tense candidate through the canonical style contract', async () => {
    const value = manifest();
    const result = await run(value, {
      status: 'failed',
      violations: [{
        code: 'style_convention_preference',
        category: 'language_quality',
        classification: 'style_preference',
        detail: 'Consistent present tense is less conventional than infinitive CV style.',
      }],
    });
    expect(result).toMatchObject({ ok: true, validation: { decision: 'accept' } });
    if (result.ok) expect(result.validation.phases.language_quality).toEqual({
      category: 'language_quality', status: 'passed', violations: [],
    });
  });

  it('accepts an explicit style preference without letting it fail the phase', async () => {
    const result = await run(manifest(), {
      status: 'failed',
      violations: [{
        code: 'valid_alternative_cv_style',
        category: 'language_quality',
        classification: 'style_preference',
        detail: 'Infinitive style is another acceptable convention.',
      }],
    });
    expect(result).toMatchObject({ ok: true });
  });

  it.each([
    ['canonical style + style_preference', 'style_convention_preference', 'style_preference', true],
    ['canonical hard + hard_defect', 'grammar_error', 'hard_defect', false],
    ['canonical hard + style_preference', 'grammar_error', 'style_preference', false],
    ['canonical style + hard_defect', 'style_convention_preference', 'hard_defect', false],
    ['unknown + style_preference', 'unknown_language_quality_code', 'style_preference', false],
    ['unknown + hard_defect', 'unknown_language_quality_code', 'hard_defect', false],
    ['canonical style without classification', 'style_convention_preference', undefined, false],
    ['canonical hard without classification', 'grammar_error', undefined, false],
  ] as const)('enforces %s', async (_label, code, classification, accepted) => {
    const result = await run(manifest(), {
      status: 'failed',
      violations: [{
        code,
        category: 'language_quality',
        ...(classification ? { classification } : {}),
        detail: 'Contract classification fixture.',
      }],
    });
    expect(result.ok).toBe(accepted);
    if (!accepted) {
      expect(['validation_rejected', 'evaluator_tool_input_malformed']).toContain(
        result.ok ? null : result.typedReason,
      );
    }
  });

  it.each([
    ['mixed present and past tense', 'mixed_tense'],
    ['past employment written as current', 'completed_role_present_tense'],
    ['actual grammar defect', 'grammar_error'],
    ['wrong target language', 'wrong_target_language'],
  ])('rejects a canonical hard defect: %s', async (_label, code) => {
    const result = await run(manifest(), {
      status: 'failed',
      violations: [{
        code,
        category: 'language_quality',
        classification: 'hard_defect',
        detail: 'Objective blocking defect.',
      }],
    });
    expect(result).toMatchObject({ ok: false, typedReason: 'validation_rejected' });
  });

  it.each([
    ['valid German infinitive style', ['Wartungs- und Instandhaltungsarbeiten an elektrotechnischen Anlagen durchführen.', 'Störungen im Bereich der Elektrotechnik systematisch und fachgerecht analysieren und beheben.', 'Durchgeführte Servicearbeiten dokumentieren und den ordnungsgemäßen Anlagenbetrieb unterstützen.']],
    ['valid German nominal style', ['Wartung und Instandhaltung elektrotechnischer Anlagen und Systeme.', 'Systematische und fachgerechte Analyse und Behebung elektrotechnischer Störungen.', 'Dokumentation von Servicearbeiten und Sicherstellung des ordnungsgemäßen Anlagenbetriebs.']],
    ['valid German present-action style', GERMAN_PRESENT_BULLETS],
  ])('accepts %s when the evaluator reports no hard defect', async (_label, bullets) => {
    const value = manifest();
    const result = await executeExperienceV3GenerateServer({ manifest: value }, {
      generate: async () => writerOutput(value, bullets),
      evaluate: async () => evaluatorResponse(value),
    });
    expect(result).toMatchObject({ ok: true, validation: { decision: 'accept' } });
  });

  it('keeps the language-quality contract canonical and documents the production distinction', () => {
    expect(EXPERIENCE_V3_LANGUAGE_QUALITY_HARD_DEFECT_CODES).toContain('grammar_error');
    expect(EXPERIENCE_V3_LANGUAGE_QUALITY_HARD_DEFECT_CODES).toContain('mixed_tense');
    expect(EXPERIENCE_V3_LANGUAGE_QUALITY_STYLE_PREFERENCE_CODES).toEqual([
      'style_convention_preference',
      'valid_alternative_cv_style',
    ]);
    expect(EXPERIENCE_V3_LANGUAGE_QUALITY_STYLE_PREFERENCE_CODES).not.toContain('TENSE_PRESENT_ACTIVE_INCONSISTENCY');
    type ViolationSchema = { required: readonly string[]; properties: Record<string, unknown> };
    type PhaseSchema = { properties: { violations: { items: ViolationSchema } } };
    const schema = EXPERIENCE_V3_EVALUATOR_TOOL.input_schema as {
      properties: { phases: { properties: { semantic: PhaseSchema; language_quality: PhaseSchema } } };
    };
    const semanticViolationSchema = schema.properties.phases.properties.semantic.properties.violations.items;
    const languageQualityViolationSchema = schema.properties.phases.properties.language_quality.properties.violations.items;
    const languageQualitySchema = (languageQualityViolationSchema.properties.code as { enum: readonly string[] }).enum;
    expect(languageQualityViolationSchema.required).toEqual(['code', 'category', 'detail', 'classification']);
    expect(semanticViolationSchema.required).toEqual(['code', 'category', 'detail']);
    expect(semanticViolationSchema.properties).not.toHaveProperty('classification');
    expect(languageQualitySchema).toEqual([
      ...EXPERIENCE_V3_LANGUAGE_QUALITY_HARD_DEFECT_CODES,
      ...EXPERIENCE_V3_LANGUAGE_QUALITY_STYLE_PREFERENCE_CODES,
    ]);
    expect(languageQualitySchema).not.toContain('TENSE_PRESENT_ACTIVE_INCONSISTENCY');
    const excludedProviderCodes = [
      'test_only_aab529_malformed_surface',
      'synthetic_language_quality_rejection',
      'language_quality_failed',
      'language_repair_required',
    ];
    for (const code of excludedProviderCodes) expect(languageQualitySchema).not.toContain(code);
    const prompt = buildExperienceV3EvaluatorPrompt(manifest(), {
      operationId: 'm8-language-quality',
      candidateId: 'candidate-language-quality',
      operationKind: 'experience_generate',
      targetLocale: 'de',
      sourceSnapshotHash: 'snapshot-language-quality',
      text: GERMAN_PRESENT_BULLETS.map((bullet) => `• ${bullet}`).join('\n'),
      units: GERMAN_PRESENT_BULLETS.map((text, index) => ({
        unitId: `entry-language-quality:bullet:${index + 1}`,
        entryId: 'entry-language-quality',
        text,
      })),
    });
    expect(prompt).toContain('Do not report a stylistic preference as a violation.');
    expect(prompt).toContain('consistent present-tense action verbs');
    expect(prompt).toContain('classification hard_defect');
    expect(prompt).toContain('style_convention_preference');
    expect(prompt).toContain('valid_alternative_cv_style');
    expect(prompt).toContain('classification is required for language_quality violations');
    expect(prompt).not.toContain('optional classification');
    expect(prompt).not.toContain('TENSE_PRESENT_ACTIVE_INCONSISTENCY');
    expect(prompt).toContain('style_preference');
    const promptHardCodes = prompt.match(/one canonical hard-defect code from: ([^.]+)\./)?.[1].split(', ') ?? [];
    const promptStyleCodes = prompt.match(/one canonical style code: ([^.]+)\./)?.[1].split(' or ') ?? [];
    expect(promptHardCodes).toEqual([...EXPERIENCE_V3_LANGUAGE_QUALITY_HARD_DEFECT_CODES]);
    expect(promptStyleCodes).toEqual([...EXPERIENCE_V3_LANGUAGE_QUALITY_STYLE_PREFERENCE_CODES]);
  });
});
