import { describe, expect, it } from 'vitest';
import { detectExperienceUnsupportedClaimExpansion } from '@/lib/cv-experience-unsupported-claims';
import { detectSpanishExperienceUnsupportedExpansion } from '@/lib/cv-spanish-experience-grounding';

describe('AAB-433 source-authorized outcome assurance', () => {
  it.each([
    ['hi', 'अंतिम आउटपुट की गुणवत्ता जाँचती थी।', 'अंतिम आउटपुट की गुणवत्ता सुनिश्चित करती थी।'],
    ['en', 'Inspected final-output quality.', 'Ensured final-output quality.'],
    ['de', 'Prüfte die Qualität der Endausgabe.', 'Gewährleistete die Qualität der Endausgabe.'],
  ])('%s rejects check/review promoted to assurance', (_locale, source, candidate) => {
    expect(detectExperienceUnsupportedClaimExpansion(source, candidate).kinds)
      .toContain('assurance_escalation');
  });

  it('preserves the Spanish guarantee diagnostic surface for shared assurance', () => {
    const result = detectSpanishExperienceUnsupportedExpansion(
      'Revisó la calidad del resultado final.',
      'Garantizó la calidad del resultado final.',
    );

    expect(result.kinds).toContain('guarantee_escalation');
    expect(result.kinds).not.toContain('assurance_escalation');
  });

  it('does not double-count Spanish asegurar as assurance plus guarantee', () => {
    const result = detectSpanishExperienceUnsupportedExpansion(
      'Revisó la calidad del resultado final.',
      'Asegura la calidad del resultado final.',
    );
    expect(result.kinds).toContain('guarantee_escalation');
    expect(result.kinds).not.toContain('assurance_escalation');
  });

  it.each([
    ['hi', 'अंतिम आउटपुट की गुणवत्ता सुनिश्चित करती थी।'],
    ['en', 'Ensured final-output quality.'],
    ['de', 'Gewährleistete die Qualität der Endausgabe.'],
  ])('allows source-authorized assurance for %s', (_locale, source) => {
    expect(detectExperienceUnsupportedClaimExpansion(source, source).kinds)
      .not.toContain('assurance_escalation');
  });

  it('allows source-authorized Spanish guarantee authority', () => {
    const source = 'Garantizó la calidad del resultado final.';
    expect(detectSpanishExperienceUnsupportedExpansion(source, source).kinds)
      .not.toContain('guarantee_escalation');
  });
});
