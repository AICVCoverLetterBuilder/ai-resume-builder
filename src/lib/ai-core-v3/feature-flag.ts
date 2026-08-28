export const AI_CORE_V3_ENVIRONMENT_KEY = 'AI_CORE_V3_ENABLED' as const;

export interface AiCoreV3FlagEnvironment {
  readonly AI_CORE_V3_ENABLED?: string;
}

let testOverride: boolean | undefined;

export function isAiCoreV3Enabled(environment: AiCoreV3FlagEnvironment = {}): boolean {
  if (testOverride !== undefined) {
    return testOverride;
  }
  return environment[AI_CORE_V3_ENVIRONMENT_KEY] === 'true';
}

export function setAiCoreV3TestOverride(enabled: boolean): void {
  testOverride = enabled;
}

export function resetAiCoreV3TestOverride(): void {
  testOverride = undefined;
}
