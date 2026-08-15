import { describe, expect, it } from 'vitest';
import {
  buildCrossLocaleExperienceFallback,
  validateCrossLocaleSemanticCoverage,
} from '../cv-cross-locale-experience';

const source = [
  '\u092a\u094d\u0930\u093f\u0902\u091f \u0914\u0930 \u0921\u093f\u091c\u093f\u091f\u0932 \u092e\u0940\u0921\u093f\u092f\u093e \u0915\u0947 \u0932\u093f\u090f \u0917\u094d\u0930\u093e\u092b\u093f\u0915 \u0938\u093e\u092e\u0917\u094d\u0930\u0940 \u0924\u0948\u092f\u093e\u0930 \u0915\u0930\u0924\u0940 \u0925\u0940\u0964',
  '\u0917\u094d\u0930\u093e\u0939\u0915\u094b\u0902 \u0915\u0940 \u0906\u0935\u0936\u094d\u092f\u0915\u0924\u093e\u0913\u0902 \u0915\u0947 \u0905\u0928\u0941\u0938\u093e\u0930 \u0935\u093f\u091c\u093c\u0941\u0905\u0932 \u0921\u093f\u091c\u093c\u093e\u0907\u0928 \u0905\u0935\u0927\u093e\u0930\u0923\u093e\u090f\u0901 \u0935\u093f\u0915\u0938\u093f\u0924 \u0915\u0930\u0924\u0940 \u0925\u0940\u0964',
  '\u0905\u0902\u0924\u093f\u092e \u0906\u0909\u091f\u092a\u0941\u091f \u0915\u0940 \u0917\u0941\u0923\u0935\u0924\u094d\u0924\u093e \u0938\u0941\u0928\u093f\u0936\u094d\u091a\u093f\u0924 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u0921\u093f\u091c\u093c\u093e\u0907\u0928 \u092a\u0930\u093f\u092f\u094b\u091c\u0928\u093e\u0913\u0902 \u0915\u0940 \u0938\u092e\u0940\u0915\u094d\u0937\u093e \u0915\u0930\u0924\u0940 \u0925\u0940\u0964',
].join(' ');

describe('AAB454 PT-BR Experience semantic grounding', () => {
  it('projects the three source-owned relations without generic enrichment', () => {
    const candidate = buildCrossLocaleExperienceFallback({
      sourceDescription: source,
      sourceLocale: 'hi',
      targetLocale: 'pt-BR',
      gender: 'female',
      isPresent: false,
      position: 'Graphic Designer',
    });
    expect(candidate).toContain('mídias impressas e digitais');
    expect(candidate).toContain('necessidades dos clientes');
    expect(candidate).toContain('qualidade dos resultados finais');
    const coverage = validateCrossLocaleSemanticCoverage(source, candidate);
    expect(coverage.ok).toBe(true);
    expect(coverage.requiredCount).toBe(3);
    expect(coverage.coveredCount).toBe(3);
    expect(coverage.addedSemanticArgumentCount).toBe(0);
    expect(coverage.missingSemanticArgumentKinds).toEqual([]);
  });

  it.each([
    'Criou materiais gráficos para mídias impressas e digitais e conforme os requisitos do projeto.',
    'Desenvolveu conceitos de design visual de acordo com as necessidades dos clientes e segundo normas estabelecidas.',
    'Revisou projetos de design e verificou a qualidade dos resultados finais para todos os projetos diariamente.',
  ])('rejects an unsourced semantic qualifier: %s', (candidate) => {
    const coverage = validateCrossLocaleSemanticCoverage(source, candidate);
    expect(coverage.ok).toBe(false);
    expect(coverage.addedSemanticArgumentCount).toBeGreaterThan(0);
  });
});
