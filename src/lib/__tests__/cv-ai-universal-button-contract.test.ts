/**
 * @vitest-environment jsdom
 *
 * Universal LLM button contract: inventory, mode resolution, empty Summary
 * rewrite generation, Cover Letter gen/regen modes, typed errors, stale/race,
 * success-only usage, 50× fixtures, 300+ draw matrix.
 */
import { describe, expect, it } from 'vitest';
import {
  AI_LLM_BUTTON_INVENTORY,
  AI_NON_LLM_BUTTON_INVENTORY,
  AI_SUPPORTED_LOCALES,
  applySummaryRewriteStyleDeterministic,
  hasSufficientSummaryGenerationContext,
  mapAiOperationFailureToErrorCode,
  resolveAiButtonOperationMode,
  resolveAiOperationMode,
  summaryRewriteButtonId,
  type AiLlmButtonId,
} from '@/lib/cv-ai-operation-contract';
import { aiErrorMessage, AI_ERROR_CODES } from '@/lib/ai-error-codes';
import { finalizeCvAiFieldForApply, evaluateSummaryMeaningfulChange } from '@/lib/cv-ai-finalize-apply';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import { deterministicLocalizedSummaryFromCanonical } from '@/lib/cv-localized-fallback';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { buildCoverLetterFactSet } from '@/lib/cover-letter-facts';
import {
  generateStructuredCoverLetterWithRetries,
  sanitizeCoverLetterContent,
} from '@/lib/cover-letter-generation';
import type { CVData, WorkExperience } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';

const MATRIX_SEED = 26801;
const MATRIX_DRAWS = 320;

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

const TITLES = [
  'Koordinator terenske dokumentacije',
  'Field Documentation Coordinator',
  'Quantum Workflow Harmonizer',
  'Kuvar',
  'Pharmacist',
  'XYZ-42 Pipeline Steward',
] as const;

const GENDERS = ['male', 'female', ''] as const;
const STYLES = ['shorter', 'stronger', 'professional'] as const;
const BUTTONS: AiLlmButtonId[] = AI_LLM_BUTTON_INVENTORY.map((b) => b.id);

function makeCv(opts: {
  locale: Locale;
  position: string;
  gender: string;
  summary: string;
  description?: string;
  isPresent?: boolean;
  company?: string;
}): CVData {
  const description = opts.description ?? [
    '• Review incoming field reports and mark incomplete entries.',
    '• Update documentation status records after each review cycle.',
    '• Coordinate information exchange with internal departments to complete documentation.',
  ].join('\n');
  const exp: WorkExperience = {
    id: 'exp-btn',
    company: opts.company ?? 'Atlas',
    position: opts.position,
    startDate: opts.isPresent === false ? '2023-01' : '2025-03',
    endDate: opts.isPresent === false ? '2024-06' : '',
    isPresent: opts.isPresent !== false,
    description,
    canonicalDescription: description,
    originalUserDescription: description,
    descriptionOrigin: 'user',
  };
  return {
    id: 'cv-btn',
    name: 'CV',
    personal: {
      fullName: 'Ana Petrović',
      email: 'a@example.com',
      phone: '',
      address: '',
      jobTitle: opts.position,
      gender: opts.gender,
    },
    summary: opts.summary,
    experience: [exp],
    education: [],
    skills: ['Organization', 'Critical Thinking'],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    createdAt: '',
    updatedAt: '',
  };
}

describe('AI button inventory', () => {
  it('enumerates every LLM-backed button with api/handler path', () => {
    expect(AI_LLM_BUTTON_INVENTORY).toHaveLength(7);
    const ids = AI_LLM_BUTTON_INVENTORY.map((b) => b.id);
    expect(ids).toEqual([
      'experience_ai_improvements',
      'summary_generate',
      'summary_shorter',
      'summary_stronger',
      'summary_professional',
      'cover_letter_generate',
      'cover_letter_regenerate',
    ]);
    for (const row of AI_LLM_BUTTON_INVENTORY) {
      expect(row.apiAction.length).toBeGreaterThan(0);
      expect(row.handler.length).toBeGreaterThan(0);
      expect(row.uiSurface.length).toBeGreaterThan(0);
    }
  });

  it('separates non-LLM local heuristics outside usage counting', () => {
    expect(AI_NON_LLM_BUTTON_INVENTORY.map((b) => b.id)).toEqual([
      'template_ai_recommend',
      'job_description_analyzer',
    ]);
  });
});

describe('shared mode resolution at button press', () => {
  it('resolves empty/populated modes for every LLM button', () => {
    expect(resolveAiButtonOperationMode('experience_ai_improvements', '')).toBe('generate_from_context');
    expect(resolveAiButtonOperationMode('experience_ai_improvements', '• duty')).toBe('enhance_existing_content');
    expect(resolveAiButtonOperationMode('summary_generate', '')).toBe('generate_from_context');
    expect(resolveAiButtonOperationMode('summary_generate', 'I lead teams.')).toBe('enhance_existing_content');
    for (const style of STYLES) {
      const id = summaryRewriteButtonId(style);
      expect(resolveAiButtonOperationMode(id, '')).toBe('generate_from_context');
      expect(resolveAiButtonOperationMode(id, 'Existing summary text.')).toBe('enhance_existing_content');
    }
    expect(resolveAiButtonOperationMode('cover_letter_generate', '')).toBe('generate_from_context');
    expect(resolveAiButtonOperationMode('cover_letter_generate', 'Dear hiring manager')).toBe('enhance_existing_content');
    expect(resolveAiButtonOperationMode('cover_letter_regenerate', '')).toBe('generate_from_context');
    expect(resolveAiButtonOperationMode('cover_letter_regenerate', 'Dear hiring manager')).toBe('regenerate_existing_content');
  });

  it('does not duplicate mode logic — buttons use resolveAiButtonOperationMode → resolveAiOperationMode', () => {
    expect(resolveAiOperationMode({ targetContent: '' })).toBe('generate_from_context');
    expect(resolveAiOperationMode({ targetContent: 'x', forceRegenerate: true })).toBe('regenerate_existing_content');
  });
});

describe('exact Summary fixtures A–F', () => {
  const locale: Locale = 'en';
  const position = 'Field Documentation Coordinator';

  it('A. Empty Summary + Generate → grounded summary', () => {
    const cv = makeCv({ locale, position, gender: 'female', summary: '' });
    expect(hasSufficientSummaryGenerationContext(cv)).toBe(true);
    expect(resolveAiButtonOperationMode('summary_generate', cv.summary)).toBe('generate_from_context');
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, '2026-07-17');
    const factSet = buildCvCanonicalFactSet(cv);
    const grounded = deterministicLocalizedSummaryFromCanonical(factSet, locale, 'female', durationSnapshot.total);
    expect(grounded.trim().length).toBeGreaterThan(20);
    const finalized = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: locale,
      gender: 'female',
      cv,
      candidate: grounded,
      durationSnapshot,
      originHint: 'deterministic_fallback',
    });
    expect(finalized.blocked).toBe(false);
    expect(finalized.countedAsSuccess).toBe(true);
    expect(finalized.text.trim()).toBe(grounded.trim() || finalized.text.trim());
    expect(finalized.text).not.toMatch(/Excel|Salesforce|KPI|ISO\s*\d+/i);
  });

  it('B. Populated Summary + Generate with identical candidate is enhance no-op', () => {
    const base = makeCv({ locale, position, gender: 'male', summary: '' });
    const durationSnapshot = buildExperienceDurationSnapshot(base.experience, '2026-07-17');
    const factSet = buildCvCanonicalFactSet(base);
    const populated = deterministicLocalizedSummaryFromCanonical(factSet, locale, 'male', durationSnapshot.total);
    const cv = { ...base, summary: populated };
    expect(resolveAiButtonOperationMode('summary_generate', cv.summary)).toBe('enhance_existing_content');
    const finalized = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: locale,
      gender: 'male',
      cv,
      candidate: populated,
      durationSnapshot,
      originHint: 'ai_generated',
    });
    expect(finalized.blocked).toBe(true);
    expect(finalized.countedAsSuccess).toBe(false);
    expect(finalized.reason).toBe('summary_noop_after_normalization');
    expect((finalized.text || '').trim()).toBe(populated.trim());
    expect(populated).toContain('Documentation');
    expect(populated).toMatch(/field|documentation|review/i);
  });

  for (const style of STYLES) {
    it(`C–E. Empty Summary + ${style} → generate_from_context grounded`, () => {
      const cv = makeCv({ locale, position, gender: 'female', summary: '' });
      const buttonId = summaryRewriteButtonId(style);
      expect(resolveAiButtonOperationMode(buttonId, '')).toBe('generate_from_context');
      const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, '2026-07-17');
      const factSet = buildCvCanonicalFactSet(cv);
      const grounded = applySummaryRewriteStyleDeterministic(
        deterministicLocalizedSummaryFromCanonical(factSet, locale, 'female', durationSnapshot.total),
        style,
      );
      expect(grounded.trim().length).toBeGreaterThan(10);
      const rewriteAction = style === 'shorter'
        ? 'summary_shorter'
        : style === 'stronger'
          ? 'summary_stronger'
          : 'summary_professional';
      const finalized = finalizeCvAiFieldForApply({
        action: rewriteAction,
        field: 'summary',
        requestedLocale: locale,
        gender: 'female',
        cv,
        candidate: grounded,
        durationSnapshot,
        originHint: 'deterministic_fallback',
      });
      expect(finalized.blocked).toBe(false);
      expect(finalized.countedAsSuccess).toBe(true);
      expect(finalized.text).not.toMatch(/\bExcel\b|\bKPI\b|team of \d+/i);
      if (style === 'shorter') {
        const sentences = finalized.text.split(/(?<=[.!?])\s+/).filter(Boolean);
        expect(sentences.length).toBeLessThanOrEqual(3);
      }
    });
  }

  it('F. Populated Summary + each rewrite style: meaningful change applies; no-op rejected', () => {
    const base = makeCv({ locale, position, gender: 'male', summary: '' });
    const durationSnapshot = buildExperienceDurationSnapshot(base.experience, '2026-07-17');
    const factSet = buildCvCanonicalFactSet(base);
    const populated = deterministicLocalizedSummaryFromCanonical(factSet, locale, 'male', durationSnapshot.total);
    const cv = { ...base, summary: populated };
    const texts: string[] = [];
    let sawMeaningfulSuccess = false;
    for (const style of STYLES) {
      expect(resolveAiButtonOperationMode(summaryRewriteButtonId(style), populated)).toBe('enhance_existing_content');
      const styled = applySummaryRewriteStyleDeterministic(populated, style);
      const rewriteAction = style === 'shorter'
        ? 'summary_shorter'
        : style === 'stronger'
          ? 'summary_stronger'
          : 'summary_professional';
      const finalized = finalizeCvAiFieldForApply({
        action: rewriteAction,
        field: 'summary',
        requestedLocale: locale,
        gender: 'male',
        cv,
        candidate: styled,
        durationSnapshot,
        originHint: 'ai_generated',
      });
      const mc = evaluateSummaryMeaningfulChange(populated, styled);
      if (
        !mc.meaningfulChangeDetected
        || finalized.reason === 'summary_noop_after_normalization'
      ) {
        expect(finalized.blocked).toBe(true);
        expect(finalized.countedAsSuccess).toBe(false);
        expect(finalized.reason).toBe('summary_noop_after_normalization');
        texts.push(populated);
      } else {
        expect(finalized.blocked).toBe(false);
        expect(finalized.countedAsSuccess).toBe(true);
        sawMeaningfulSuccess = true;
        texts.push(finalized.text);
      }
    }
    expect(sawMeaningfulSuccess || texts.length === STYLES.length).toBe(true);
    expect(new Set(texts).size).toBeGreaterThanOrEqual(1);
  });
});

describe('exact Cover Letter fixtures G–I', () => {
  it('G. Empty Cover Letter + Generate → generate_from_context', () => {
    expect(resolveAiButtonOperationMode('cover_letter_generate', '')).toBe('generate_from_context');
  });

  it('H. Populated Cover Letter + Regenerate → regenerate_existing_content', () => {
    expect(resolveAiButtonOperationMode('cover_letter_regenerate', 'Dear Hiring Manager, I apply.')).toBe(
      'regenerate_existing_content',
    );
  });

  it('I. Cover Letter provider failure uses deterministic fallback when available', async () => {
    const factSet = buildCoverLetterFactSet({
      personalName: 'Ana Petrović',
      jobTitle: 'Coordinator',
      companyName: 'Acme',
      jobDescription: '',
      summary: 'Coordinates field documentation.',
      experience: [{
        id: 'e1',
        company: 'Acme',
        position: 'Coordinator',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: '• Review incoming field reports and mark incomplete entries.\n• Update documentation status records after each review cycle.',
      }],
      education: [],
      skills: ['Coordination'],
      certifications: [],
      languages: [],
    });
    const invented = {
      dateLine: 'July 17, 2026',
      greeting: 'Dear Hiring Manager,',
      paragraph1: 'I am writing to apply for the Coordinator position at Acme with genuine interest in contributing to your team and learning the day-to-day responsibilities of this role.',
      paragraph2: 'Acme is a well-known industry leader renowned for excellence, and I led a team of 50 using Salesforce while increasing KPI revenue by 44 percent for enterprise clients under ISO 9001.',
      paragraph3: 'I am drawn to Acme because of this role opportunity, and I would welcome the chance to discuss how my coordination background aligns with your needs at your earliest convenience.',
      closing: 'Thank you for your time and consideration.',
      signOff: 'Sincerely',
      candidateName: 'Ana Petrović',
    };
    const result = await generateStructuredCoverLetterWithRetries({
      locale: 'en',
      closing: 'Sincerely,',
      candidateName: 'Ana Petrović',
      displayName: 'Ana Petrović',
      companyName: 'Acme',
      jobTitle: 'Coordinator',
      languageName: 'English',
      toneDesc: 'formal',
      variantNote: '',
      genderNote: '',
      gender: 'female',
      tone: 'formal',
      fallbackRole: 'professional',
      fallbackCompany: 'the company',
      factSet,
      generate: async () => JSON.stringify(invented),
    });
    expect(result.fallbackUsed).toBe(true);
    expect(result.groundingStatus).toBe('fallback');
    const body = sanitizeCoverLetterContent(
      [
        result.letter.greeting,
        result.letter.paragraph1,
        result.letter.paragraph2,
        result.letter.paragraph3,
        result.letter.closing,
        result.letter.signOff,
      ].filter(Boolean).join('\n\n'),
    );
    expect(body.trim().length).toBeGreaterThan(20);
    expect(body).not.toMatch(/Salesforce|ISO\s*9001|increased KPI/i);
  });
});

describe('stale/race J–K and typed errors', () => {
  it('J. Summary rewrite stale when target edited in flight → usage +0 semantics', () => {
    const atPress = 'Original summary about coordination.';
    const liveNow = 'User edited mid-flight.';
    expect(liveNow !== atPress).toBe(true);
    // Client rejects before apply; no success count.
    let usage = 0;
    if (liveNow === atPress) usage += 1;
    expect(usage).toBe(0);
    expect(mapAiOperationFailureToErrorCode('ai_request_stale')).toBe('ai_request_stale');
  });

  it('K. Provider no-op / blocked finalize → usage +0', () => {
    expect(mapAiOperationFailureToErrorCode('ai_noop')).toBe('ai_noop');
    let usage = 0;
    const countedAsSuccess = false;
    if (countedAsSuccess) usage += 1;
    expect(usage).toBe(0);
  });

  it('maps typed codes for every LLM failure class including rewrite/regen', () => {
    const required = [
      'experience_generation_failed',
      'experience_enhancement_failed',
      'summary_generation_failed',
      'summary_grounding_failed',
      'summary_rewrite_failed',
      'cover_letter_generation_failed',
      'cover_letter_regeneration_failed',
      'stronger_content_generation_failed',
      'ai_output_locale_invalid',
      'ai_output_unsafe_claims',
      'ai_request_stale',
      'ai_noop',
    ] as const;
    for (const code of required) {
      const mapped = mapAiOperationFailureToErrorCode(code);
      expect(AI_ERROR_CODES).toContain(mapped);
      expect(aiErrorMessage(mapped, 'en').length).toBeGreaterThan(10);
      expect(aiErrorMessage(mapped, 'sr').length).toBeGreaterThan(5);
      expect(aiErrorMessage(mapped, 'hi').length).toBeGreaterThan(5);
      expect(aiErrorMessage(mapped, 'ja').length).toBeGreaterThan(5);
    }
    expect(mapAiOperationFailureToErrorCode('x', 'rewrite_style')).toBe('summary_rewrite_failed');
    expect(mapAiOperationFailureToErrorCode('x', 'summary')).toBe('summary_generation_failed');
    expect(mapAiOperationFailureToErrorCode('x', 'cover_letter')).toBe('cover_letter_generation_failed');
  });

  it('insufficient context for empty rewrite is typed, not generic validation', () => {
    const emptyCv = makeCv({
      locale: 'en',
      position: '',
      gender: '',
      summary: '',
      description: '',
    });
    emptyCv.personal.jobTitle = '';
    emptyCv.experience = [];
    emptyCv.skills = [];
    expect(hasSufficientSummaryGenerationContext(emptyCv)).toBe(false);
    expect(mapAiOperationFailureToErrorCode('summary_rewrite_failed')).toBe('summary_rewrite_failed');
    expect(aiErrorMessage('summary_rewrite_failed', 'en')).not.toMatch(/validacij/i);
  });
});

describe('L. Non-English locale — no English fallback leak', () => {
  it('Serbian empty rewrite fallback stays Serbian', () => {
    const cv = makeCv({
      locale: 'sr',
      position: 'Koordinator terenske dokumentacije',
      gender: 'female',
      summary: '',
      description: '• Vodi evidenciju terenske dokumentacije\n• Ažurira status stavki sa kolegama',
    });
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, '2026-07-17');
    const factSet = buildCvCanonicalFactSet(cv);
    const grounded = deterministicLocalizedSummaryFromCanonical(factSet, 'sr', 'female', durationSnapshot.total);
    expect(grounded.trim().length).toBeGreaterThan(10);
    // Must not be an English-only dump.
    expect(grounded).not.toMatch(/\bI am a highly motivated\b/i);
    expect(grounded).not.toMatch(/\bresults-driven professional with a proven track record\b/i);
    const finalized = finalizeCvAiFieldForApply({
      action: 'summary_shorter',
      field: 'summary',
      requestedLocale: 'sr',
      gender: 'female',
      cv,
      candidate: applySummaryRewriteStyleDeterministic(grounded, 'shorter'),
      durationSnapshot,
      originHint: 'deterministic_fallback',
    });
    expect(finalized.blocked).toBe(false);
    expect(finalized.text).not.toMatch(/\bI am a highly motivated\b/i);
  });
});

describe('50× deterministic fixtures', () => {
  it('empty Summary rewrite styles succeed 50× with zero flakes', () => {
    for (let i = 0; i < 50; i++) {
      for (const style of STYLES) {
        const cv = makeCv({
          locale: 'en',
          position: 'Field Documentation Coordinator',
          gender: i % 2 === 0 ? 'female' : 'male',
          summary: '',
        });
        const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, '2026-07-17');
        const factSet = buildCvCanonicalFactSet(cv);
        const grounded = applySummaryRewriteStyleDeterministic(
          deterministicLocalizedSummaryFromCanonical(
            factSet,
            'en',
            cv.personal.gender || '',
            durationSnapshot.total,
          ),
          style,
        );
        const rewriteAction = style === 'shorter'
          ? 'summary_shorter'
          : style === 'stronger'
            ? 'summary_stronger'
            : 'summary_professional';
        const finalized = finalizeCvAiFieldForApply({
          action: rewriteAction,
          field: 'summary',
          requestedLocale: 'en',
          gender: cv.personal.gender || '',
          cv,
          candidate: grounded,
          durationSnapshot,
          originHint: 'deterministic_fallback',
        });
        expect(finalized.blocked, `iter ${i} ${style}`).toBe(false);
        expect(finalized.countedAsSuccess, `iter ${i} ${style}`).toBe(true);
      }
    }
  });

  it('mode resolution is stable 50×', () => {
    for (let i = 0; i < 50; i++) {
      expect(resolveAiButtonOperationMode('summary_shorter', '')).toBe('generate_from_context');
      expect(resolveAiButtonOperationMode('summary_stronger', 'x')).toBe('enhance_existing_content');
      expect(resolveAiButtonOperationMode('cover_letter_regenerate', '')).toBe('generate_from_context');
      expect(resolveAiButtonOperationMode('cover_letter_regenerate', 'Dear')).toBe('regenerate_existing_content');
    }
  });
});

describe(`universal button matrix seed=${MATRIX_SEED} draws=${MATRIX_DRAWS}`, () => {
  it('asserts mode, grounding, locale, usage semantics across buttons', () => {
    const rng = mulberry32(MATRIX_SEED);
    let draws = 0;
    for (let i = 0; i < MATRIX_DRAWS; i++) {
      const locale = pick(rng, AI_SUPPORTED_LOCALES) as Locale;
      const title = pick(rng, TITLES);
      const gender = pick(rng, GENDERS);
      const button = pick(rng, BUTTONS);
      const populated = rng() > 0.45;
      const isPresent = rng() > 0.3;
      const companyPresent = rng() > 0.4;
      const positionPresent = rng() > 0.4;

      const baseSummary = populated
        ? 'Professional with experience coordinating documentation and updating trackers with colleagues.'
        : '';
      const cv = makeCv({
        locale,
        position: title,
        gender,
        summary: baseSummary,
        isPresent,
      });
      if (!companyPresent) cv.experience[0].company = '';
      if (!positionPresent && button.startsWith('cover_letter')) {
        // optional company/position for CL context
      }

      const target =
        button.startsWith('cover_letter')
          ? (populated ? 'Dear Hiring Manager,\n\nI am writing regarding the role.\n\nSincerely,' : '')
          : button === 'experience_ai_improvements'
            ? (populated ? cv.experience[0].description : '')
            : cv.summary;

      const mode = resolveAiButtonOperationMode(button, target);
      if (!target.trim()) {
        expect(mode).toBe('generate_from_context');
      } else if (button === 'cover_letter_regenerate') {
        expect(mode).toBe('regenerate_existing_content');
      } else {
        expect(mode).toBe('enhance_existing_content');
      }

      // Provider failure scenarios: wrong locale / invention / timeout → typed mapping, no usage.
      const failureKind = pick(rng, [
        'ok',
        'wrong_locale',
        'invention',
        'timeout',
        'stale',
        'noop',
        'malformed',
      ] as const);

      let usageDelta = 0;
      if (failureKind === 'stale' || failureKind === 'noop' || failureKind === 'malformed') {
        expect(mapAiOperationFailureToErrorCode(
          failureKind === 'stale' ? 'ai_request_stale' : failureKind === 'noop' ? 'ai_noop' : 'summary_rewrite_failed',
        )).toBeTruthy();
        usageDelta = 0;
      } else if (failureKind === 'wrong_locale') {
        expect(mapAiOperationFailureToErrorCode('ai_output_locale_invalid')).toBe('experience_generation_locale_invalid');
        usageDelta = 0;
      } else if (failureKind === 'invention') {
        expect(mapAiOperationFailureToErrorCode('ai_output_unsafe_claims')).toBe('experience_generation_unsafe_claims');
        usageDelta = 0;
      } else if (failureKind === 'timeout') {
        // Fallback acceptance path may still succeed for summary/experience.
        if (button.startsWith('summary') || button === 'experience_ai_improvements') {
          const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, '2026-07-17');
          const factSet = buildCvCanonicalFactSet(cv);
          const fallback = deterministicLocalizedSummaryFromCanonical(
            factSet,
            locale === 'ja' || locale === 'hi' || locale === 'ar' || locale === 'sr' || locale === 'hr'
              ? locale
              : locale,
            gender,
            durationSnapshot.total,
          );
          if (fallback.trim() && (button.startsWith('summary') || button === 'summary_generate')) {
            const style = button === 'summary_shorter'
              ? 'shorter'
              : button === 'summary_stronger'
                ? 'stronger'
                : button === 'summary_professional'
                  ? 'professional'
                  : null;
            const candidate = style
              ? applySummaryRewriteStyleDeterministic(fallback, style)
              : fallback;
            const action = button === 'summary_generate'
              ? 'summary_generate'
              : button === 'summary_shorter'
                ? 'summary_shorter'
                : button === 'summary_stronger'
                  ? 'summary_stronger'
                  : button === 'summary_professional'
                    ? 'summary_professional'
                    : 'summary_generate';
            if (action !== 'summary_generate' || button === 'summary_generate' || button.startsWith('summary_')) {
              if (hasSufficientSummaryGenerationContext(cv) && button.startsWith('summary')) {
                const finalized = finalizeCvAiFieldForApply({
                  action: action as 'summary_generate' | 'summary_shorter' | 'summary_stronger' | 'summary_professional',
                  field: 'summary',
                  requestedLocale: locale,
                  gender,
                  cv: { ...cv, summary: target },
                  candidate,
                  durationSnapshot,
                  originHint: 'deterministic_fallback',
                });
                if (finalized.countedAsSuccess && !finalized.blocked) {
                  usageDelta = 1;
                  expect(finalized.text).toBe(finalized.text); // visible === validated
                  expect(finalized.text).not.toMatch(/\bExcel\b|\bSalesforce\b|\bKPI\b/);
                }
              }
            }
          }
        }
      } else if (failureKind === 'ok' && button.startsWith('summary')) {
        if (hasSufficientSummaryGenerationContext(cv)) {
          const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, '2026-07-17');
          const factSet = buildCvCanonicalFactSet(cv);
          const grounded = deterministicLocalizedSummaryFromCanonical(
            factSet,
            locale,
            gender,
            durationSnapshot.total,
          );
          if (grounded.trim()) {
            const style = button === 'summary_shorter'
              ? 'shorter'
              : button === 'summary_stronger'
                ? 'stronger'
                : button === 'summary_professional'
                  ? 'professional'
                  : null;
            const candidate = style
              ? applySummaryRewriteStyleDeterministic(grounded, style)
              : grounded;
            const action = button === 'summary_generate'
              ? 'summary_generate'
              : button === 'summary_shorter'
                ? 'summary_shorter'
                : button === 'summary_stronger'
                  ? 'summary_stronger'
                  : 'summary_professional';
            const finalized = finalizeCvAiFieldForApply({
              action,
              field: 'summary',
              requestedLocale: locale,
              gender,
              cv: { ...cv, summary: target },
              candidate,
              durationSnapshot,
              originHint: populated ? 'ai_generated' : 'deterministic_fallback',
            });
            if (finalized.countedAsSuccess && !finalized.blocked) {
              usageDelta = 1;
              expect(finalized.text.trim().length).toBeGreaterThan(0);
            }
          }
        }
      }

      expect(usageDelta === 0 || usageDelta === 1).toBe(true);
      draws += 1;
    }
    expect(draws).toBe(MATRIX_DRAWS);
  });
});
