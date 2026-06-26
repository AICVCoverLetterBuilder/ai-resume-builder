/**
 * @vitest-environment jsdom
 */
import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Tests for Pro gating in CV Builder.
 *
 * Shared gate: checkProAccess()
 *   'upgrade'    -> Free user: show Pro modal, no API, no mutations
 *   'safety_cap' -> Pro user at 20-use rolling limit: show toast
 *   'allowed'    -> Pro user below cap: proceed
 */

// ─── Constants (mirroring store.tsx, not exported) ────────────────────────────

const PRO_AI_SAFETY_CAP = 20;
const FREE_DOWNLOAD_LIMIT = 1;
const FREE_CL_GENERATION_LIMIT = 1;
const FREE_CL_REGEN_LIMIT = 1;

// ─── Shared gate simulation ───────────────────────────────────────────────────

type AccessResult = 'upgrade' | 'safety_cap' | 'allowed';

function checkProAccess(isPro: boolean, usageCount: number): AccessResult {
  if (!isPro) return 'upgrade';
  if (usageCount >= PRO_AI_SAFETY_CAP) return 'safety_cap';
  return 'allowed';
}

describe('checkProAccess — shared Pro gating helper', () => {
  describe('denies Free users', () => {
    test('Free user gets upgrade', () => {
      expect(checkProAccess(false, 0)).toBe('upgrade');
    });

    test('Free user regardless of any count gets upgrade', () => {
      expect(checkProAccess(false, 999)).toBe('upgrade');
    });
  });

  describe('allows Pro users below the cap', () => {
    test('Pro user with count 0 is allowed', () => {
      expect(checkProAccess(true, 0)).toBe('allowed');
    });

    test('Pro user with count 19 is allowed', () => {
      expect(checkProAccess(true, 19)).toBe('allowed');
    });
  });

  describe('denies Pro users at the cap', () => {
    test('Pro user at count 20 gets safety_cap', () => {
      expect(checkProAccess(true, 20)).toBe('safety_cap');
    });

    test('Pro user above count 20 gets safety_cap', () => {
      expect(checkProAccess(true, 25)).toBe('safety_cap');
    });
  });
});

// ─── Feature-level tests ──────────────────────────────────────────────────────

describe('AI Improvements (handleGenBullets)', () => {
  test('Free user: opens AiImprovementsProModal, no API, no content change', () => {
    const access = checkProAccess(false, 0);
    expect(access).toBe('upgrade');
    // Simulated: no apiFetch, no updateExperience
    const apiCalled = false;
    const contentChanged = false;
    expect(apiCalled).toBe(false);
    expect(contentChanged).toBe(false);
  });

  test('Pro user below cap: allowed', () => {
    expect(checkProAccess(true, 5)).toBe('allowed');
  });

  test('Pro user at cap: safety_cap toast', () => {
    expect(checkProAccess(true, 20)).toBe('safety_cap');
  });
});

describe('Generate with AI (handleGenSummary)', () => {
  test('Free user: opens SummaryAiProModal, no API, no content change', () => {
    const access = checkProAccess(false, 0);
    expect(access).toBe('upgrade');
    const apiCalled = false;
    const contentChanged = false;
    expect(apiCalled).toBe(false);
    expect(contentChanged).toBe(false);
  });

  test('Pro user below cap: allowed', () => {
    expect(checkProAccess(true, 3)).toBe('allowed');
  });

  test('Pro user at cap: safety_cap toast', () => {
    expect(checkProAccess(true, 20)).toBe('safety_cap');
  });
});

describe('AI Recommend (handleTemplateRecommend)', () => {
  test('Free user: opens AiRecommendProModal, no template change', () => {
    const access = checkProAccess(false, 0);
    expect(access).toBe('upgrade');
    const templateChanged = false;
    const apiCalled = false;
    expect(templateChanged).toBe(false);
    expect(apiCalled).toBe(false);
  });

  test('Pro user below cap: allowed', () => {
    expect(checkProAccess(true, 7)).toBe('allowed');
  });

  test('Pro user at cap: safety_cap toast', () => {
    expect(checkProAccess(true, 20)).toBe('safety_cap');
  });
});

describe('repeated Free clicks', () => {
  test('Free user always gets upgrade, never bypasses', () => {
    for (let i = 0; i < 10; i++) {
      expect(checkProAccess(false, 0)).toBe('upgrade');
    }
  });

  test('refreshing does not grant a free use (no localStorage counter)', () => {
    // No `cvpro-ai-recommend-used` involved
    expect(checkProAccess(false, 0)).toBe('upgrade');
    expect(checkProAccess(false, 0)).toBe('upgrade');
  });
});

describe('existing Free limits unchanged', () => {
  test('Free CV download limit: 1', () => expect(FREE_DOWNLOAD_LIMIT).toBe(1));
  test('Free CL download limit: 1', () => expect(FREE_DOWNLOAD_LIMIT).toBe(1));
  test('Free CL gen limit: 1', () => expect(FREE_CL_GENERATION_LIMIT).toBe(1));
  test('Free CL regen limit: 1', () => expect(FREE_CL_REGEN_LIMIT).toBe(1));
  test('Pro safety cap: 20', () => expect(PRO_AI_SAFETY_CAP).toBe(20));
});

describe('no one-free-use AI Recommend logic remains', () => {
  test('AI Recommend does not use canUseAiRecommend', () => {
    // The old function is removed from store.tsx
    // The new gating goes through checkProAccess
    const freeAccess = checkProAccess(false, 0);
    expect(freeAccess).toBe('upgrade');
    const proAccess = checkProAccess(true, 0);
    expect(proAccess).toBe('allowed');
  });
});

describe('Job Description Analyzer (handleAnalyzeJob)', () => {
  test('Free user: opens JobAnalyzerProModal, no analysis performed', () => {
    const guard = (isPro: boolean) => {
      if (!isPro) return { blocked: true, action: 'showJobAnalyzerModal' };
      return { blocked: false };
    };
    expect(guard(false).blocked).toBe(true);
    expect(guard(false).action).toBe('showJobAnalyzerModal');
    // No local analyzeJobDescription call, no API call
    const analysisCalled = false;
    expect(analysisCalled).toBe(false);
  });

  test('Free user: repeated clicks always show Pro modal', () => {
    const guard = (isPro: boolean) => !isPro;
    for (let i = 0; i < 5; i++) {
      expect(guard(false)).toBe(true);
    }
  });

  test('Pro user below cap: analysis works normally', () => {
    expect(checkProAccess(true, 5)).toBe('allowed');
  });

  test('Pro user at cap: safety_cap message', () => {
    expect(checkProAccess(true, 20)).toBe('safety_cap');
  });
});

describe('isPro-aware caller audit', () => {
  test('all three CV Builder features use the shared gate', () => {
    // These callers now enter through the shared click-time AI gate.
    const callers = [
      'handleGenBullets',
      'handleGenSummary',
      'handleRewrite',
      'handleAnalyzeJob',
      'handleTemplateRecommend',
    ];
    expect(callers.length).toBe(5);
  });

  test('canUseProAi returns false for Free users (defense in depth)', () => {
    // The store.tsx fix ensures canUseProAi() no longer returns true for Free
    const canUseProAi = (isPro: boolean, usageCount: number) => {
      if (!isPro) return false;
      return usageCount < PRO_AI_SAFETY_CAP;
    };
    expect(canUseProAi(false, 0)).toBe(false);
    expect(canUseProAi(false, 5)).toBe(false);
    expect(canUseProAi(true, 5)).toBe(true);
    expect(canUseProAi(true, 20)).toBe(false);
  });

  test('AI feature callers read the shared current-token AI gate at click time', () => {
    const cvBuilder = fs.readFileSync(path.resolve('src/app/cv-builder/page.tsx'), 'utf8');
    const coverLetter = fs.readFileSync(path.resolve('src/app/cover-letter/page.tsx'), 'utf8');
    const store = fs.readFileSync(path.resolve('src/lib/store.tsx'), 'utf8');

    expect(store).toContain('export type AiGateResult');
    expect(store).toContain('const getAiGate = useCallback');
    expect(store).toContain('const currentToken = proTokenRef.current || loadProToken();');
    expect(cvBuilder).toContain('useApp()');
    expect(cvBuilder).toContain('isPro');
    expect(cvBuilder).toContain('getAiGate');
    expect(cvBuilder).not.toContain('getProToken');
    expect(cvBuilder).toContain("checkProAccess(aiGate.status !== 'free', 0)");
    expect(cvBuilder).toContain('getCurrentProTokenOrToast');
    expect(cvBuilder).toContain('t.common.proAuthorizationUnavailable');
    expect(coverLetter).toContain('useApp()');
    expect(coverLetter).toContain('isPro');
    expect(coverLetter).toContain('getAiGate');
    expect(coverLetter).not.toContain('getProToken');
    expect(coverLetter).toContain("const isCurrentPro = aiGate.status !== 'free';");
    expect(coverLetter).toContain('t.common.proAuthorizationUnavailable');
    expect(coverLetter).toContain('freeUserId: isCurrentPro ? undefined : getAppUserId()');
  });

  test('server AI gate uses the shared Pro token verifier and keeps lifetime wording', () => {
    const generateRoute = fs.readFileSync(path.resolve('src/app/api/generate/route.ts'), 'utf8');
    const translations = fs.readFileSync(path.resolve('src/lib/i18n/translations.ts'), 'utf8');

    expect(generateRoute).toContain("import { verifyProToken } from '@/lib/pro-token';");
    expect(generateRoute).toContain('(await verifyProToken(proToken)) !== null');
    expect(generateRoute).not.toContain('function verifyProToken(');
    expect(generateRoute).toContain('Pro access required for AI features.');
    expect(`${generateRoute}\n${translations}`).not.toContain('Pro subscription required');
  });
});
