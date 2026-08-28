import { afterEach, describe, expect, it } from 'vitest';
import {
  isAiCoreV3Enabled,
  resetAiCoreV3TestOverride,
  setAiCoreV3TestOverride,
} from '../feature-flag';

describe('AI Core V3 feature flag', () => {
  afterEach(() => {
    resetAiCoreV3TestOverride();
  });

  it('defaults to false and enables only through the explicit environment contract', () => {
    expect(isAiCoreV3Enabled()).toBe(false);
    expect(isAiCoreV3Enabled({ AI_CORE_V3_ENABLED: 'false' })).toBe(false);
    expect(isAiCoreV3Enabled({ AI_CORE_V3_ENABLED: 'true' })).toBe(true);
  });

  it('supports an explicit, resettable test override', () => {
    setAiCoreV3TestOverride(true);
    expect(isAiCoreV3Enabled()).toBe(true);
    resetAiCoreV3TestOverride();
    expect(isAiCoreV3Enabled()).toBe(false);
  });

  it('starts this test disabled after the previous test cleanup', () => {
    expect(isAiCoreV3Enabled()).toBe(false);
  });
});
