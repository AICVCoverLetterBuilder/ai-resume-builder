/**
 * @vitest-environment jsdom
 *
 * German empty-source Experience fallback — governed-preposition case grammar.
 * Accusative plural after dative "an"/"von"/"zu"/"bei" must be rejected;
 * morphology must emit dative plural without hard-coding Fahrradmechaniker.
 */
import { describe, expect, it } from 'vitest';
import { formatExperienceBullets, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  buildJobContextGenerationFallback,
  germanExperienceDativePrepositionCaseLooksWrong,
  germanInflectDativePlural,
  validateExperienceGenerationOutput,
} from '@/lib/cv-experience-ai-operation-mode';
import {
  foldAiTextToken,
  peelGermanAgentiveCompound,
} from '@/lib/cv-ai-operation-contract';

describe('German Experience fallback case grammar', () => {
  it('exact AAB-378 device regression: an Fahrräder → an Fahrrädern', () => {
    const fb = buildJobContextGenerationFallback({
      locale: 'de',
      gender: 'male',
      position: 'Fahrradmechaniker',
      isPresent: true,
    });
    const bullets = splitExperienceBullets(fb);
    expect(bullets).toHaveLength(3);
    expect(fb).toMatch(/Führt Wartungsarbeiten an Fahrrädern durch\./);
    expect(fb).toMatch(/Tauscht defekte Bauteile an Fahrrädern aus\./);
    expect(fb).not.toMatch(/\ban\s+Fahrräder\b/);
    // Accusative direct object remains nominative/accusative plural.
    expect(fb).toMatch(/Prüft Fahrräder auf technische Mängel\./);
    expect(validateExperienceGenerationOutput(fb, {
      locale: 'de',
      position: 'Fahrradmechaniker',
      isPresent: true,
    }).ok).toBe(true);
  });

  it('grammar validation rejects generated "an Fahrräder"', () => {
    const bad = formatExperienceBullets([
      'Führt Wartungsarbeiten an Fahrräder durch.',
      'Prüft Fahrräder auf technische Mängel.',
      'Tauscht defekte Bauteile an Fahrräder aus.',
    ]);
    expect(germanExperienceDativePrepositionCaseLooksWrong(bad)).toBe(true);
    const v = validateExperienceGenerationOutput(bad, {
      locale: 'de',
      position: 'Fahrradmechaniker',
      isPresent: true,
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('experience_generation_failed');
  });

  it('dative plural morphology is universal (no Fahrrad hard-code)', () => {
    expect(germanInflectDativePlural('Fahrräder')).toBe('Fahrrädern');
    expect(germanInflectDativePlural('Geräte')).toBe('Geräten');
    expect(germanInflectDativePlural('Bücher')).toBe('Büchern');
    expect(germanInflectDativePlural('Anlagen')).toBe('Anlagen');
    expect(germanInflectDativePlural('Bienen')).toBe('Bienen');
    expect(germanInflectDativePlural('Bibliotheken')).toBe('Bibliotheken');
    expect(germanInflectDativePlural('Autos')).toBe('Autos');
  });

  it('arbitrary German compound titles get correct an + dative plural', () => {
    const cases: Array<{
      position: string;
      expectDat: RegExp;
      forbidAccAfterAn?: RegExp;
    }> = [
      {
        position: 'Motorradmechaniker',
        expectDat: /an\s+Motorrädern/,
        forbidAccAfterAn: /\ban\s+Motorräder\b/,
      },
      {
        position: 'Bootmechaniker',
        expectDat: /an\s+Booten\b/,
        forbidAccAfterAn: /\ban\s+Boote\b/,
      },
      {
        position: 'Solaranlagentechniker',
        expectDat: /an\s+Solaranlagen/,
      },
      {
        position: 'Servicetechniker',
        expectDat: /an\s+\S+/,
      },
    ];
    for (const { position, expectDat, forbidAccAfterAn } of cases) {
      const fb = buildJobContextGenerationFallback({
        locale: 'de',
        gender: 'male',
        position,
        isPresent: true,
      });
      expect(fb, position).toMatch(expectDat);
      if (forbidAccAfterAn) {
        expect(fb, position).not.toMatch(forbidAccAfterAn);
      }
      expect(germanExperienceDativePrepositionCaseLooksWrong(fb), position).toBe(false);
      expect(validateExperienceGenerationOutput(fb, {
        locale: 'de',
        position,
        isPresent: true,
      }).ok, position).toBe(true);
      expect(fb, position).not.toMatch(new RegExp(position, 'i'));
    }
  });

  it('singular stem vs plural object: -rad compounds pluralize then dative-inflect', () => {
    const peeled = peelGermanAgentiveCompound(foldAiTextToken('Lastenradmechaniker'));
    expect(peeled?.objectStem).toMatch(/rad$/);
    const fb = buildJobContextGenerationFallback({
      locale: 'de',
      position: 'Lastenradmechaniker',
      isPresent: true,
    });
    // Plural accusative object OK; dative after an must end in -n.
    expect(fb).toMatch(/Prüft\s+\S*räder\b/);
    expect(fb).toMatch(/an\s+\S*rädern\b/);
    expect(fb).not.toMatch(/\ban\s+\S*räder\b/);
  });

  it('already-n plurals stay unchanged after dative prepositions', () => {
    const fb = buildJobContextGenerationFallback({
      locale: 'de',
      position: 'Bienenhalter',
      isPresent: true,
    });
    expect(fb).toMatch(/von\s+Bienen\b/);
    expect(fb).toMatch(/betreut\s+Bienen\b/);
    expect(germanExperienceDativePrepositionCaseLooksWrong(fb)).toBe(false);
  });

  it('past tense keeps dative plural after an', () => {
    const past = buildJobContextGenerationFallback({
      locale: 'de',
      position: 'Fahrradmechaniker',
      isPresent: false,
    });
    expect(past).toMatch(/Führte Wartungsarbeiten an Fahrrädern durch\./);
    expect(past).toMatch(/Tauschte defekte Bauteile an Fahrrädern aus\./);
    expect(past).not.toMatch(/\ban\s+Fahrräder\b/);
    expect(past).toMatch(/\b(Führte|Prüfte|Tauschte)\b/);
    expect(past).not.toMatch(/\b(Führt|Prüft|Tauscht)\b/);
  });

  it('EN Experience path unchanged', () => {
    const en = buildJobContextGenerationFallback({
      locale: 'en',
      position: 'Solar Panel Installer',
      isPresent: true,
    });
    expect(en).toMatch(/Installs solar panels/i);
    expect(en).not.toMatch(/Fahrrad|Wartungsarbeiten|an\s+\S+räder/i);
    expect(validateExperienceGenerationOutput(en, {
      locale: 'en',
      position: 'Solar Panel Installer',
      isPresent: true,
    }).ok).toBe(true);
  });
});
