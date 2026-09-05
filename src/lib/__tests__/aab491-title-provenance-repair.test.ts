import { describe, expect, it } from 'vitest';
import { resolveExperienceTitleForDisplay } from '../cv-role-title';

describe('AAB491 stale app-owned title provenance repair', () => {
  it('reprojects a stale known graphic-designer title from explicit gender and target locale', () => {
    const stale = {
      position: 'Grafički dizajner',
      positionProvenance: 'occupation_option',
      positionSourceKey: 'graphic_designer',
      positionUserEdited: false,
      positionSourceLocale: 'hi',
      descriptionOrigin: 'ai_generated',
    };

    expect(resolveExperienceTitleForDisplay(stale, 'sr', 'female')).toBe('Grafička dizajnerka');
    expect(resolveExperienceTitleForDisplay(stale, 'sr', 'male')).toBe('Grafički dizajner');
    expect(resolveExperienceTitleForDisplay(stale, 'hr', 'female')).toBe('Grafička dizajnerica');
  });

  it('preserves explicit manual and unknown titles', () => {
    const manualAiDescription = {
      position: 'Grafički dizajner',
      positionProvenance: 'manual',
      positionUserEdited: true,
      positionSourceLocale: 'sr',
      descriptionOrigin: 'ai_generated',
    };
    expect(resolveExperienceTitleForDisplay(manualAiDescription, 'hr', 'female')).toBe('Grafički dizajner');

    expect(resolveExperienceTitleForDisplay(manualAiDescription, 'de', 'female')).toBe('Grafički dizajner');

    const manualUnknownTitle = {
      position: 'Vlastiti naziv zanimanja',
      positionProvenance: 'manual',
      positionUserEdited: true,
      positionSourceLocale: 'hi',
      descriptionOrigin: 'user',
    };
    expect(resolveExperienceTitleForDisplay(manualUnknownTitle, 'sr', 'female')).toBe('Vlastiti naziv zanimanja');
  });

  it('changes only the display title and leaves the source Experience fields untouched', () => {
    const stale = {
      id: 'graphic', company: 'Example', position: 'Grafički dizajner',
      positionProvenance: 'occupation_option' as const, positionSourceKey: 'graphic_designer' as const, positionUserEdited: false,
      positionSourceLocale: 'hi', descriptionOrigin: 'ai_generated' as const,
      startDate: '2024-01', endDate: '', isPresent: true,
      description: 'Pripremam grafike.',
    };
    const before = { ...stale };

    expect(resolveExperienceTitleForDisplay(stale, 'sr', 'female')).toBe('Grafička dizajnerka');
    expect(stale).toEqual(before);
  });
});
