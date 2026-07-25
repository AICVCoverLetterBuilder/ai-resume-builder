/**
 * @vitest-environment node
 *
 * AAB-333 — French Experience per-bullet locale diagnostic truth:
 * "Coordonne avec ses collègues la préparation…" must not classify as `es`
 * via shared article `la` + French acute `é`.
 */
import { describe, expect, it } from 'vitest';
import {
  guessUnitLocale,
  tokenHasExactCue,
  validateAiUnitLocalePurity,
} from '@/lib/cv-ai-unit-locale-purity';
import { checkExperienceDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';
import { buildFrenchWarehouseExperienceFallback } from '@/lib/cv-french-experience-grounding';

const FR_WAREHOUSE_BULLETS = [
  'Contrôle les marchandises entrantes dans l’entrepôt.',
  'Vérifie les documents associés aux marchandises reçues.',
  'Coordonne avec ses collègues la préparation et le déplacement des marchandises.',
] as const;

const FR_WAREHOUSE_TEXT = FR_WAREHOUSE_BULLETS.join('\n');

const ES_WAREHOUSE_BULLETS = [
  'Revisa la mercancía entrante en el almacén.',
  'Comprueba la documentación relacionada con la mercancía recibida.',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
] as const;

describe('AAB-333 French per-bullet locale diagnostic truth', () => {
  it('exact third French bullet classifies as fr, never es', () => {
    expect(guessUnitLocale(FR_WAREHOUSE_BULLETS[2], 'fr')).toBe('fr');
    expect(guessUnitLocale(FR_WAREHOUSE_BULLETS[2], 'fr')).not.toBe('es');
  });

  it('detectedLocaleByBullet is ["fr","fr","fr"] with purity truth', () => {
    const purity = validateAiUnitLocalePurity(FR_WAREHOUSE_TEXT, 'fr', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.detectedLocaleByUnit).toEqual(['fr', 'fr', 'fr']);
    expect(purity.detectedLocaleByUnit).not.toContain('es');
    expect(purity.wrongLocaleUnitCount).toBe(0);
    expect(purity.mixedLanguageUnitCount).toBe(0);
    expect(purity.sourceLanguageLeakageDetected).toBe(false);
    expect(purity.targetLocalePurityPassed).toBe(true);
    expect(purity.ok).toBe(true);
  });

  it('deterministic French warehouse builder remains pure under fr target', () => {
    const text = buildFrenchWarehouseExperienceFallback({
      sourceDescription: [
        'Checks incoming goods.',
        'Checks the related documents.',
        'Works with colleagues to prepare and move goods.',
      ].join('\n'),
      isPresent: true,
    });
    const purity = validateAiUnitLocalePurity(text, 'fr', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.detectedLocaleByUnit.every((l) => l === 'fr' || l == null)).toBe(true);
    expect(purity.detectedLocaleByUnit).not.toContain('es');
    expect(purity.targetLocalePurityPassed).toBe(true);
    expect(purity.wrongLocaleUnitCount).toBe(0);
  });

  it('lexical boundaries: es does not match inside ses; con does not match inside longer FR tokens', () => {
    expect(tokenHasExactCue('avec ses collègues', 'es')).toBe(false);
    expect(tokenHasExactCue('ses', 'es')).toBe(false);
    expect(tokenHasExactCue('es importante', 'es')).toBe(true);
    expect(tokenHasExactCue('Coordonne avec ses collègues', 'con')).toBe(false);
    expect(tokenHasExactCue('trabaja con compañeros', 'con')).toBe(true);
  });

  it('genuine Spanish warehouse bullets still detect as Spanish', () => {
    for (const bullet of ES_WAREHOUSE_BULLETS) {
      expect(guessUnitLocale(bullet, 'es')).toBe('es');
    }
    const purity = validateAiUnitLocalePurity(ES_WAREHOUSE_BULLETS.join('\n'), 'es', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.detectedLocaleByUnit).toEqual(['es', 'es', 'es']);
    expect(purity.targetLocalePurityPassed).toBe(true);
  });

  it('invariant: purity pass + zero wrong/mixed ⇒ no foreign non-null bullet locale', () => {
    const purity = validateAiUnitLocalePurity(FR_WAREHOUSE_TEXT, 'fr', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.targetLocalePurityPassed).toBe(true);
    expect(purity.wrongLocaleUnitCount).toBe(0);
    expect(purity.mixedLanguageUnitCount).toBe(0);
    for (const locale of purity.detectedLocaleByUnit) {
      if (locale != null && locale !== 'unknown') {
        expect(locale).toBe('fr');
      }
    }

    const ok = checkExperienceDiagnosticInvariants({
      requestedTargetLocale: 'fr',
      targetLocale: 'fr',
      targetLocalePurityPassed: true,
      wrongLocaleBulletCount: 0,
      mixedLanguageBulletCount: 0,
      detectedLocaleByBullet: ['fr', 'fr', 'fr'],
      countedAsSuccess: false,
    } as never);
    expect(
      ok.failures.some((f) => f.invariantCode === 'purity_pass_with_foreign_detected_bullet_locale'),
    ).toBe(false);

    const bad = checkExperienceDiagnosticInvariants({
      requestedTargetLocale: 'fr',
      targetLocale: 'fr',
      targetLocalePurityPassed: true,
      wrongLocaleBulletCount: 0,
      mixedLanguageBulletCount: 0,
      detectedLocaleByBullet: ['fr', 'fr', 'es'],
      countedAsSuccess: false,
    } as never);
    expect(
      bad.failures.some((f) => f.invariantCode === 'purity_pass_with_foreign_detected_bullet_locale'),
    ).toBe(true);
  });
});
