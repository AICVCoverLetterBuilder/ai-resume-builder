import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import { formatExperienceBullets } from '../cv-canonical-facts';
import { finalizeCvAiFieldForApply } from '../cv-ai-finalize-apply';
import type { FinalizeCvAiFieldResult } from '../cv-ai-finalize-apply';
import { createExperienceAiOperationSnapshot } from '../cv-experience-ai-operation-snapshot';
import { sourceFactIdentityId } from '../cv-source-fact-identity';
import { ExperienceAiDiagnosticSession } from '../cv-experience-ai-diagnostics';

const SOURCE = formatExperienceBullets([
  '\u0917\u094d\u0930\u093e\u0939\u0915\u094b\u0902 \u0915\u0940 \u0906\u0935\u0936\u094d\u092f\u0915\u0924\u093e\u0913\u0902 \u0915\u0947 \u0905\u0928\u0941\u0938\u093e\u0930 \u0935\u093f\u091c\u093c\u0941\u0905\u0932 \u0921\u093f\u091c\u093c\u093e\u0907\u0928 \u0905\u0935\u0927\u093e\u0930\u0923\u093e\u090f\u0901 \u092c\u0928\u093e\u0924\u0940 \u0925\u0940\u0964',
  '\u092a\u094d\u0930\u093f\u0902\u091f \u0914\u0930 \u0921\u093f\u091c\u093f\u091f\u0932 \u092e\u093e\u0927\u094d\u092f\u092e\u094b\u0902 \u0915\u0947 \u0932\u093f\u090f \u0917\u094d\u0930\u093e\u092b\u093f\u0915 \u0938\u093e\u092e\u0917\u094d\u0930\u0940 \u092c\u0928\u093e\u0924\u0940 \u0925\u0940\u0964',
  '\u0921\u093f\u091c\u093c\u093e\u0907\u0928 \u092a\u0930\u093f\u092f\u094b\u091c\u0928\u093e\u0913\u0902 \u0915\u0940 \u0938\u092e\u0940\u0915\u094d\u0937\u093e \u0915\u0930\u0924\u0940 \u0925\u0940\u0964 \u0905\u0902\u0924\u093f\u092e \u0906\u0909\u091f\u092a\u0941\u091f \u0915\u0940 \u0917\u0941\u0923\u0935\u0924\u094d\u0924\u093e \u091c\u093e\u0901\u091a\u0924\u0940 \u0925\u0940\u0964',
]);
const PARTIAL = formatExperienceBullets([
  'D\u00e9veloppait des concepts de design visuel selon les besoins des clients.',
  'Examinait les projets de design et v\u00e9rifiait la qualit\u00e9 des rendus finaux.',
]);

function cv(): CVData {
  return {
    id: 'aab445', name: 'AAB445',
    personal: { fullName: 'AAB445', email: 'aab445@example.com', phone: '', address: '', jobTitle: 'Graphic Designer', gender: 'female' },
    summary: '', experience: [{
      id: 'be5c794b', position: 'Graphic Designer', company: 'TestWerk GmbH',
      startDate: '2024-01', endDate: '2026-02', isPresent: false,
      description: SOURCE, originalUserDescription: SOURCE, canonicalDescription: SOURCE,
      descriptionOrigin: 'user',
    }], education: [], skills: [], languages: [], certifications: [],
    templateId: 'modern-minimal', region: 'EU', createdAt: '2026-01-01', updatedAt: '2026-01-01',
  } as CVData;
}

describe('AAB445 canonical provider uncovered identity set', () => {
  it('dedupes split clauses to one immutable source-fact identity', () => {
    const base = createExperienceAiOperationSnapshot({
      requestId: 'aab445', experienceEntryId: 'be5c794b', locale: 'fr',
      liveText: '\u2022 Provider output not validated', authoritativeTextOverride: SOURCE,
      provenanceOriginOverride: 'originalUserDescription', jobContextHash: 'aab445-context',
      visibleComparisonProvenance: 'ai_generated_unedited',
    });
    const thirdFact = base.units.slice(-2).map((unit) => unit.rawUnit).join(' ');
    const thirdId = sourceFactIdentityId(thirdFact);
    const snapshot = {
      ...base,
      units: [base.units[0], base.units[1], {
        ...base.units[2], rawUnit: thirdFact, sourceUnitId: thirdId, sourceFactIds: [thirdId],
      }],
      normalizedSourceText: [base.units[0].rawUnit, base.units[1].rawUnit, thirdFact].join('\n'),
      sourceUnitCount: 3,
      sourceFactIds: [base.units[0].sourceUnitId, base.units[1].sourceUnitId, thirdId],
    };
    const result = finalizeCvAiFieldForApply({
      action: 'experience_bullets', field: 'experience_description', requestedLocale: 'fr',
      gender: 'female', cv: cv(), candidate: PARTIAL, experienceId: 'be5c794b',
      industry: 'design', level: 'mid', operationSnapshot: snapshot,
    });
    expect(result.countedAsSuccess).toBe(false);
    expect(result.diagnostics?.providerRequiredFactCount).toBe(3);
    expect(result.diagnostics?.providerCoveredFactCount).toBe(2);
    expect(result.diagnostics?.providerUncoveredFactIdentityHashes).toEqual([thirdId]);
    expect(result.diagnostics?.providerUncoveredFactCount).toBe(1);
  });

  it('keeps true multi-fact misses and dedupes repeated canonical IDs', () => {
    const record = (covered: number, ids: string[]) => {
      const session = new ExperienceAiDiagnosticSession({
        uiLocale: 'fr', requestedLocale: 'fr', contentLocale: 'fr', templateId: 'modern-minimal',
        jobContextHash: 'aab445', requestId: `aab445-${covered}`, usageCountBefore: 34,
      });
      session.recordFinalizeResult({
        blocked: true, countedAsSuccess: false, text: '', reason: 'provider_rejected',
        origin: 'ai_generated', diagnostics: {
          providerRequiredFactCount: 3,
          providerCoveredFactCount: covered,
          providerUncoveredFactIdentityHashes: ids,
          providerAccepted: false,
          finalCandidatePresent: false,
        },
      } as unknown as FinalizeCvAiFieldResult);
      return session.commit();
    };
    expect(record(1, ['sf_b', 'sf_c']).providerUncoveredFactCount).toBe(2);
    expect(record(0, ['sf_a', 'sf_b', 'sf_c']).providerUncoveredFactCount).toBe(3);
    expect(record(2, ['sf_c', 'sf_c']).providerUncoveredFactIdentityHashes).toEqual(['sf_c']);
    expect(record(2, ['sf_c', 'sf_c']).providerUncoveredFactCount).toBe(1);
  });
});
