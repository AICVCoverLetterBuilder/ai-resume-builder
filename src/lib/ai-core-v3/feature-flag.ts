export const AI_CORE_V3_SELECTOR_KEY = 'NEXT_PUBLIC_AI_CORE_V3_ENABLED' as const;

export type AiCoreV3Mode = 'v3_default' | 'v2_rollback';

export interface AiCoreV3FlagEnvironment {
  readonly NEXT_PUBLIC_AI_CORE_V3_ENABLED?: string;
}

let testOverride: boolean | undefined;

export function resolveAiCoreV3Mode(environment: AiCoreV3FlagEnvironment = {}): AiCoreV3Mode {
  if (testOverride !== undefined) {
    return testOverride ? 'v3_default' : 'v2_rollback';
  }
  const selector = environment[AI_CORE_V3_SELECTOR_KEY];
  if (selector === undefined || selector === '' || selector === 'true') {
    return 'v3_default';
  }
  return 'v2_rollback';
}

export function isAiCoreV3Enabled(environment: AiCoreV3FlagEnvironment = {}): boolean {
  return resolveAiCoreV3Mode(environment) === 'v3_default';
}

export function setAiCoreV3TestOverride(enabled: boolean): void {
  testOverride = enabled;
}

export function resetAiCoreV3TestOverride(): void {
  testOverride = undefined;
}
