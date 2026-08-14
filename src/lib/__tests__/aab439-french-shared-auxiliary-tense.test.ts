import { describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import { captureSummaryV2Snapshot } from '@/lib/cv-summary-v2/snapshot';
import { buildSummaryV2SelectionManifest } from '@/lib/cv-summary-v2/manifest';
import { buildFrenchStructuredStrongerWithEvidence } from '@/lib/cv-summary-v2/rewrite-style';
import { realizeFirstPersonDutyClause } from '@/lib/cv-summary-v2/native-surface';

function frenchCv(priorDuties: string[]): CVData {
  const duties = (lines: string[]) => lines.join('\n');
  return {
    personal: {
      fullName: 'French Auxiliary', email: 'aux@example.com', phone: '', location: '',
      jobTitle: 'Graphiste', gender: 'female',
    },
    summary: '', contentLocale: 'fr', summaryOrigin: 'ai_generated',
    experience: [
      {
        id: '90ceb215', position: 'Graphiste', company: 'Current', startDate: '2024-01', endDate: '',
        isPresent: true, description: duties(['prépare des concepts', 'retouche des images', 'coordonne les projets']),
        canonicalDescription: duties(['prépare des concepts', 'retouche des images', 'coordonne les projets']),
        descriptionOrigin: 'user', generatedLocale: 'fr',
      },
      {
        id: 'a221433', position: 'Graphiste', company: 'Rewitu', startDate: '2019-01', endDate: '2020-09',
        isPresent: false, description: duties(priorDuties), canonicalDescription: duties(priorDuties),
        descriptionOrigin: 'user', generatedLocale: 'fr',
      },
    ],
    education: [], skills: [], languages: [],
  } as unknown as CVData;
}

function priorEvidence(priorDuties: string[]) {
  const cv = frenchCv(priorDuties);
  const snapshot = captureSummaryV2Snapshot({
    cv, locale: 'fr', gender: 'female', referenceDateIso: '2026-07-20',
  });
  const manifest = buildSummaryV2SelectionManifest(snapshot);
  return buildFrenchStructuredStrongerWithEvidence(manifest);
}

describe('AAB-439 French completed-role auxiliary scope', () => {
  it.each([
    ['imparfait', ['préparais des contenus', 'retouchais les images', 'coordonnais les projets']],
    ['shared', ["j'ai préparé des contenus", 'retouché les images', 'coordonné les projets']],
    ['repeated', ["j'ai préparé des contenus", "j'ai retouché les images", "j'ai coordonné les projets"]],
  ] as const)('%s completed realization keeps past tense for every predicate', (_name, duties) => {
    const result = priorEvidence([...duties]);
    const prior = result.roleTenseEvidence.find((evidence) => evidence.employmentState === 'completed');
    expect(prior?.employmentState).toBe('completed');
    expect(prior?.expectedTense).toBe('past');
    expect(prior?.realizedTense).toBe('past');
    expect(prior?.tenseMatch).toBe(true);
    expect(result.predicateEvidence.filter((evidence) => evidence.owningEntryHash === prior?.owningEntryHash))
      .toHaveLength(3);
    expect(result.predicateEvidence.filter((evidence) => evidence.owningEntryHash === prior?.owningEntryHash)
      .every((evidence) => evidence.realizedTense === 'past' && evidence.tenseMatch)).toBe(true);
    if (_name === 'shared') expect(prior?.auxiliaryScope).toBe('shared');
    if (_name === 'repeated') expect(prior?.auxiliaryScope).toBe('repeated');
    if (_name === 'imparfait') expect(prior?.realizationMode).toBe('imparfait');
    if (_name === 'shared') {
      expect(result.text).toContain("où j'ai préparé des contenus, retouché les images et coordonné les projets");
    }
  });

  it('rejects genuine mixed tense and does not bless a bare participle outside scope', () => {
    const result = priorEvidence(["j'ai préparé des contenus, retouche les images et coordonne les projets"]);
    const prior = result.roleTenseEvidence.find((evidence) => evidence.employmentState === 'completed');
    expect(prior?.tenseMatch).toBe(false);
    expect(prior?.realizedTense).toBe('mixed');
    expect(prior?.realizationMode).toBe('invalid_mixed');
    expect(result.predicateEvidence.some((evidence) => evidence.realizedTense === 'present')).toBe(true);

    const bare = realizeFirstPersonDutyClause('préparé des contenus', 'fr', 'completed');
    expect(bare).toBe('préparé des contenus');
  });

  it('keeps current employment state separate from present tense', () => {
    const result = priorEvidence(["j'ai préparé des contenus", 'retouché les images', 'coordonné les projets']);
    const current = result.roleTenseEvidence.find((evidence) => evidence.employmentState === 'current');
    expect(current?.employmentState).toBe('current');
    expect(current?.expectedTense).toBe('present');
    expect(current?.realizedTense).toBe('present');
  });
});
