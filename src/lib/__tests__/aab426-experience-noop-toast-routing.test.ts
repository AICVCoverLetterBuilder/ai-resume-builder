import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aiErrorMessage, mapExperienceAiFailureToErrorCode } from '@/lib/ai-error-codes';
import type { Locale } from '@/lib/i18n/translations';

const LOCALES: Locale[] = [
  'en', 'de', 'fr', 'es', 'it', 'pt-BR', 'ru', 'sr', 'hr', 'hi', 'ar', 'ja',
];
const NOOP_TOAST = "toast.error(aiErrorMessage('ai_noop', requestedLocale));";

function experienceHandlerSource(): string {
  const source = readFileSync('src/app/cv-builder/page.tsx', 'utf8');
  return source.slice(
    source.indexOf('const handleGenBullets'),
    source.indexOf('const handleRewrite'),
  );
}

describe('AAB-426 Experience semantic no-op UX routing', () => {
  it('early valid Arabic completed and current no-ops preserve provider/apply/usage behavior and show one localized no-change toast', () => {
    const handler = experienceHandlerSource();
    const earlyTerminal = handler.slice(
      handler.indexOf('if (earlyNoOp.earlyNoOpPreflightPassed)'),
      handler.indexOf('const requestBody'),
    );
    const terminalContract = readFileSync(
      'src/lib/cv-experience-terminal-outcome.ts',
      'utf8',
    );

    expect(earlyTerminal).toContain('buildExperienceRequestTimeCleanNoOpSnapshot({');
    expect(earlyTerminal).toContain('recordRequestTimeCleanNoOpTerminal(terminalSnapshot)');
    expect(terminalContract).toContain('providerAttempted: false');
    expect(terminalContract).toContain("finalDecisionKind: 'semantic_noop'");
    expect(earlyTerminal).toContain('setGeneratingBulletsId(null);');
    expect(earlyTerminal).not.toContain('apiFetch');
    expect(earlyTerminal.match(/toast\.error\(aiErrorMessage\('ai_noop', requestedLocale\)\);/g))
      .toHaveLength(1);
    expect(earlyTerminal.indexOf(NOOP_TOAST)).toBeGreaterThan(
      earlyTerminal.indexOf('setGeneratingBulletsId(null);'),
    );
    expect(earlyTerminal.indexOf('return;')).toBeGreaterThan(earlyTerminal.indexOf(NOOP_TOAST));

    for (const locale of ['ar', 'en'] as const) {
      const noChange = aiErrorMessage('ai_noop', locale);
      expect(noChange.trim().length).toBeGreaterThan(10);
      expect(noChange).not.toBe(aiErrorMessage('generation_validation_failed', locale));
    }
  });

  it('provider-error recovery and normal provider semantic no-ops use the same no-change contract once', () => {
    const handler = experienceHandlerSource();
    const recovered = handler.slice(
      handler.indexOf('const recoverProviderFailureAsLocalNoOp'),
      handler.indexOf('const logExperienceAiTrace'),
    );
    expect(recovered.match(/toast\.error\(aiErrorMessage\('ai_noop', requestedLocale\)\);/g))
      .toHaveLength(1);
    expect(recovered.indexOf('return true;')).toBeGreaterThan(recovered.indexOf(NOOP_TOAST));

    const providerRecoveryCall = handler.slice(
      handler.indexOf('if (recoverProviderFailureAsLocalNoOp({'),
      handler.indexOf('// Stale-response guard'),
    );
    expect(providerRecoveryCall).toContain('recoverProviderFailureAsLocalNoOp({');
    expect(mapExperienceAiFailureToErrorCode('experience_ai_noop')).toBe('ai_noop');
  });

  it('keeps invalid candidates on error UX and material improvement off the no-change route', () => {
    expect(mapExperienceAiFailureToErrorCode('generation_validation_failed'))
      .toBe('generation_validation_failed');
    expect(mapExperienceAiFailureToErrorCode('experience_generation_failed'))
      .toBe('experience_generation_failed');
    expect(mapExperienceAiFailureToErrorCode('experience_ai_noop')).toBe('ai_noop');
  });

  it('uses the established localized no-change message for all 12 locales', () => {
    for (const locale of LOCALES) {
      const message = aiErrorMessage('ai_noop', locale);
      expect(message.trim().length).toBeGreaterThan(10);
      expect(message).not.toBe(aiErrorMessage('generation_validation_failed', locale));
      expect(message).not.toBe(aiErrorMessage('experience_generation_failed', locale));
    }
  });
});
