import { describe, expect, test } from 'vitest';
import {
  clearCoverLetterStateTransitions,
  createCoverLetterActiveResult,
  detectCoverLetterContentLocale,
  getCoverLetterStateTransitions,
  isActiveCoverLetterResultEligible,
  recordCoverLetterStateTransition,
  snapshotCoverLetterState,
  type CoverLetterActiveResult,
} from '../cover-letter-active-result';
import { assembleCoverLetterContent } from '../cover-letter-generation';
import { buildDeterministicSparseCoverLetter } from '../cover-letter-grounding';
import { buildCoverLetterFactSet } from '../cover-letter-facts';
import { resolveCoverLetterGenerationResult } from '../cover-letter-generation-resolve';
import { COVER_LETTER_GROUNDING_BACKEND_REVISION } from '../cover-letter-grounding-diagnostics';
import type { ActiveCoverLetterRequest } from '../cover-letter-flow';

const SPARSE = buildCoverLetterFactSet({
  personalName: 'Alex Carter',
  jobTitle: 'Software Developer',
  companyName: 'Acme',
});

function japaneseFallback(): string {
  const letter = buildDeterministicSparseCoverLetter('ja', {
    candidateName: 'Alex Carter',
    jobTitle: 'Software Developer',
    companyName: 'Acme',
    factSet: SPARSE,
    dateLine: '2026年7月14日',
    gender: 'unspecified',
  });
  return assembleCoverLetterContent(letter);
}

function hindiFallback(gender: 'male' | 'female' | 'unspecified' = 'unspecified'): string {
  const letter = buildDeterministicSparseCoverLetter('hi', {
    candidateName: 'Alex Carter',
    jobTitle: 'Software Developer',
    companyName: 'Acme',
    factSet: SPARSE,
    dateLine: '14 जुलाई 2026',
    gender,
  });
  return assembleCoverLetterContent(letter);
}

describe('cover letter active-result lifetime', () => {
  test('Japanese with Latin names is not mis-detected as English', () => {
    const ja = japaneseFallback();
    expect(detectCoverLetterContentLocale(ja, 'ja')).toBe('ja');
    expect(detectCoverLetterContentLocale(ja)).toBe('ja');
  });

  test('activeRequest cleanup / idle phase do not clear eligibility', () => {
    const content = japaneseFallback();
    const active = createCoverLetterActiveResult({
      content,
      locale: 'ja',
      gender: 'unspecified',
      groundingStatus: 'fallback',
      requestId: 'req-1',
      source: 'fallback',
    });
    expect(active).not.toBeNull();
    expect(isActiveCoverLetterResultEligible(active, 'ja', 'unspecified', 'success')).toBe(true);
    expect(isActiveCoverLetterResultEligible(active, 'ja', 'prefer_not_to_say', 'idle')).toBe(true);
    expect(isActiveCoverLetterResultEligible(active, 'ja', 'unspecified', 'error')).toBe(true);
    // loading may hide downloads during a newer request
    expect(isActiveCoverLetterResultEligible(active, 'ja', 'unspecified', 'loading')).toBe(false);
  });

  test('simulated timing: fallback stays after toast dismiss and late invalid response', () => {
    clearCoverLetterStateTransitions();
    const content = japaneseFallback();
    let active: CoverLetterActiveResult | null = null;
    let phase: 'idle' | 'loading' | 'success' | 'error' = 'idle';
    let isGenerating = false;

    // t=0 start
    phase = 'loading';
    isGenerating = true;
    recordCoverLetterStateTransition(
      'generation_started',
      snapshotCoverLetterState({ selectedLocale: 'ja', generationPhase: 'idle', isGenerating: false }),
      snapshotCoverLetterState({ selectedLocale: 'ja', generationPhase: 'loading', isGenerating: true }),
    );

    // t=1 fallback activates
    active = createCoverLetterActiveResult({
      content,
      locale: 'ja',
      gender: 'unspecified',
      groundingStatus: 'fallback',
      requestId: 'req-ja',
      source: 'fallback',
    });
    phase = 'success';
    isGenerating = false;
    expect(isActiveCoverLetterResultEligible(active, 'ja', 'unspecified', phase)).toBe(true);

    // t=3 toast dismissed — no state mutation required; still eligible
    expect(isActiveCoverLetterResultEligible(active, 'ja', 'unspecified', 'success')).toBe(true);

    // t=4 late invalid original — must not clear
    const request: ActiveCoverLetterRequest = {
      requestId: 'req-ja-newer',
      locale: 'ja',
      gender: 'unspecified',
    };
    // Old request id differs → stale / ignored by resolver
    const late = resolveCoverLetterGenerationResult({
      active: request,
      requestId: 'req-ja',
      requestedLocale: 'ja',
      selectedLocale: 'ja',
      selectedGenderRaw: '',
      requestedGenderNormalized: 'unspecified',
      serverContent: 'Dear Team, I have extensive Java experience.',
      serverGroundingRaw: 'failed',
      backendRevision: COVER_LETTER_GROUNDING_BACKEND_REVISION,
      candidateName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Acme',
      factSet: SPARSE,
    });
    expect(late.outcome).toBe('stale');
    expect(isActiveCoverLetterResultEligible(active, 'ja', 'unspecified', 'success')).toBe(true);

    // request cleanup must not affect active
    isGenerating = false;
    expect(isGenerating).toBe(false);
    expect(isActiveCoverLetterResultEligible(active, 'ja', 'unspecified', 'idle')).toBe(true);
    expect(getCoverLetterStateTransitions().length).toBeGreaterThan(0);
  });

  test('late invalid matching request must not wipe a newer active result via resolver stale path', () => {
    const activeContent = japaneseFallback();
    const active = createCoverLetterActiveResult({
      content: activeContent,
      locale: 'ja',
      gender: 'unspecified',
      groundingStatus: 'fallback',
      requestId: 'newest',
      source: 'fallback',
    });
    const newest: ActiveCoverLetterRequest = {
      requestId: 'newest',
      locale: 'ja',
      gender: 'unspecified',
    };
    // Late response for a different request id
    const late = resolveCoverLetterGenerationResult({
      active: newest,
      requestId: 'old',
      requestedLocale: 'ja',
      selectedLocale: 'ja',
      selectedGenderRaw: '',
      requestedGenderNormalized: 'unspecified',
      serverContent: 'totally english junk with Java and Python leadership',
      serverGroundingRaw: 'failed',
      candidateName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Acme',
      factSet: SPARSE,
    });
    expect(late.outcome).toBe('stale');
    expect(isActiveCoverLetterResultEligible(active, 'ja', 'unspecified', 'success')).toBe(true);
  });

  test('Japanese passed and fallback results remain downloadable', () => {
    const content = japaneseFallback();
    for (const status of ['passed', 'fallback'] as const) {
      const active = createCoverLetterActiveResult({
        content,
        locale: 'ja',
        gender: 'female',
        groundingStatus: status,
        requestId: `ja-${status}`,
        source: status,
      });
      expect(isActiveCoverLetterResultEligible(active, 'ja', 'female', 'success')).toBe(true);
      expect(isActiveCoverLetterResultEligible(active, 'ja', 'female', 'idle')).toBe(true);
    }
  });

  test('Hindi fallback remains downloadable', () => {
    const content = hindiFallback('female');
    const active = createCoverLetterActiveResult({
      content,
      locale: 'hi',
      gender: 'female',
      groundingStatus: 'fallback',
      requestId: 'hi-f',
      source: 'fallback',
    });
    expect(isActiveCoverLetterResultEligible(active, 'hi', 'female', 'success')).toBe(true);
  });

  test('locale/gender changes intentionally invalidate eligibility', () => {
    const content = japaneseFallback();
    const active = createCoverLetterActiveResult({
      content,
      locale: 'ja',
      gender: 'unspecified',
      groundingStatus: 'passed',
      requestId: 'inv',
      source: 'passed',
    });
    expect(isActiveCoverLetterResultEligible(active, 'en', 'unspecified', 'success')).toBe(false);
    expect(isActiveCoverLetterResultEligible(active, 'ja', 'male', 'success')).toBe(false);
  });

  test('diagnostics cleanup alone cannot clear active eligibility', () => {
    const content = japaneseFallback();
    const active = createCoverLetterActiveResult({
      content,
      locale: 'ja',
      gender: 'unspecified',
      groundingStatus: 'fallback',
      requestId: 'diag',
      source: 'fallback',
    });
    clearCoverLetterStateTransitions();
    expect(getCoverLetterStateTransitions()).toHaveLength(0);
    expect(isActiveCoverLetterResultEligible(active, 'ja', 'unspecified', 'success')).toBe(true);
  });
});
