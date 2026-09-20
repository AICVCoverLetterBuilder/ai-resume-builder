import { afterEach, describe, expect, it } from 'vitest';
import {
  isAiCoreV3Enabled,
  resetAiCoreV3TestOverride,
  resolveAiCoreV3Mode,
  setAiCoreV3TestOverride,
} from '../feature-flag';

describe('AI Core V3 feature flag', () => {
  afterEach(() => {
    resetAiCoreV3TestOverride();
  });

  it('defaults to V3 and selects rollback only through fail-closed public selector semantics', () => {
    expect(resolveAiCoreV3Mode()).toBe('v3_default');
    expect(resolveAiCoreV3Mode({ NEXT_PUBLIC_AI_CORE_V3_ENABLED: '' })).toBe('v3_default');
    expect(resolveAiCoreV3Mode({ NEXT_PUBLIC_AI_CORE_V3_ENABLED: 'true' })).toBe('v3_default');
    expect(resolveAiCoreV3Mode({ NEXT_PUBLIC_AI_CORE_V3_ENABLED: 'false' })).toBe('v2_rollback');
    expect(resolveAiCoreV3Mode({ NEXT_PUBLIC_AI_CORE_V3_ENABLED: 'invalid' })).toBe('v2_rollback');
    expect(isAiCoreV3Enabled()).toBe(true);
  });

  it('supports an explicit, resettable test override', () => {
    setAiCoreV3TestOverride(false);
    expect(isAiCoreV3Enabled()).toBe(false);
    resetAiCoreV3TestOverride();
    expect(isAiCoreV3Enabled()).toBe(true);
  });

  it('starts this test on the V3 default after the previous test cleanup', () => {
    expect(isAiCoreV3Enabled()).toBe(true);
  });
});
