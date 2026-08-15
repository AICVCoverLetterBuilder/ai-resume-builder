import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '../types';
import { formatExperienceBullets } from '../cv-canonical-facts';
import {
  buildExperienceAiOutputProvenance,
  resolveExperienceTextareaProvenance,
  resolveTrustedUneditedAiOutputLocale,
} from '../cv-experience-ai-output-provenance';
import { createExperienceAiOperationSnapshot } from '../cv-experience-ai-operation-snapshot';
import { finalizeCvAiFieldForApply } from '../cv-ai-finalize-apply';

const ENTRY_ID = 'be5c794b';
const VISIBLE_FRENCH = formatExperienceBullets([
  'Cr\u00e9ait des supports graphiques pour les m\u00e9dias imprim\u00e9s et num\u00e9riques.',
  'D\u00e9veloppait des concepts de design visuel selon les besoins des clients.',
  'Examinait les mat\u00e9riaux de design et les projets de design, puis v\u00e9rifiait la qualit\u00e9 des rendus finaux.',
]);

function exactSource(): string {
  const fixture = fs.readFileSync(
    path.resolve(__dirname, 'aab432-hindi-experience-noop-fallback-grounding.test.ts'),
    'utf8',
  );
  const body = fixture.match(/const EXACT_BE5C_SOURCE = formatExperienceBullets\(([\s\S]*?)\);/)?.[1];
  if (!body) throw new Error('AAB432 exact source fixture not found');
  return Function('formatExperienceBullets', `return formatExperienceBullets(${body});`)(formatExperienceBullets) as string;
}

function makeExperience(overrides: Partial<WorkExperience> = {}): WorkExperience {
  const source = exactSource();
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: ENTRY_ID,
    appliedOutput: VISIBLE_FRENCH,
    preAiFactText: source,
    sourceLocale: 'hi',
    targetLocale: 'fr',
    operationMode: 'enhance_existing',
    sourceAuthorityKind: 'original_user',
  });
  return {
    id: ENTRY_ID,
    position: 'Graphic Designer',
    company: 'TestWerk GmbH',
    startDate: '2024-01',
    endDate: '2026-02',
    isPresent: false,
    description: VISIBLE_FRENCH,
    originalUserDescription: source,
    canonicalDescription: source,
    generatedDescription: VISIBLE_FRENCH,
    generatedLocale: 'fr',
    contentLocale: 'es',
    descriptionOrigin: 'ai_generated',
    aiOutputProvenance: provenance,
    ...overrides,
  } as WorkExperience;
}

function makeCv(exp = makeExperience()): CVData {
  return {
    id: 'aab446',
    name: 'AAB446',
    personal: {
      fullName: 'AAB446', email: 'aab446@example.com', phone: '', address: '',
      jobTitle: 'Graphic Designer', gender: 'female',
    },
    summary: '', experience: [exp], education: [], skills: [], languages: [],
    certifications: [], projects: [], templateId: 'modern-minimal', region: 'EU',
    createdAt: '2026-01-01', updatedAt: '2026-01-01', contentLocale: 'es',
  } as CVData;
}

describe('AAB446 trusted locale and terminal no-op lifecycle', () => {
  it('uses same-entry hash-matched AI provenance over stale document locale', () => {
    const exp = makeExperience();
    const provenance = resolveExperienceTextareaProvenance(exp);
    expect(provenance.currentTextareaProvenance).toBe('ai_generated_unedited');
    expect(provenance.lastAiOutputHashMatched).toBe(true);
    expect(resolveTrustedUneditedAiOutputLocale({
      exp,
      provenance,
      requestedLocale: 'fr',
    })).toBe('fr');
  });

  it.each([
    ['material edit', { description: `${VISIBLE_FRENCH}\nEt utilisait Salesforce.`, descriptionOrigin: 'ai_generated' as const }, 'fr'],
    ['changed target locale', {}, 'es'],
    ['different entry', { id: 'a221433' }, 'fr'],
  ])('does not trust stale provenance for %s', (_name, overrides, requestedLocale) => {
    const exp = makeExperience(overrides);
    const provenance = resolveExperienceTextareaProvenance(exp);
    expect(resolveTrustedUneditedAiOutputLocale({
      exp,
      provenance,
      requestedLocale,
    })).toBeNull();
  });

  it('terminalizes an unedited rerun before provider/fallback phases', () => {
    const exp = makeExperience();
    const source = exactSource();
    const pre = resolveExperienceTextareaProvenance(exp);
    const snapshot = createExperienceAiOperationSnapshot({
      requestId: 'aab446-noop',
      experienceEntryId: ENTRY_ID,
      locale: 'fr',
      liveText: VISIBLE_FRENCH,
      authoritativeTextOverride: source,
      provenanceOriginOverride: 'originalUserDescription',
      jobContextHash: 'aab446-context',
      visibleComparisonProvenance: 'ai_generated_unedited',
      visibleComparisonMatchedLastAiOutput: true,
      visibleComparisonMaterialUserEditDetected: false,
    });
    const result = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'fr',
      gender: 'female',
      cv: makeCv(exp),
      candidate: '',
      experienceId: ENTRY_ID,
      industry: 'design',
      level: 'mid',
      operationSnapshot: snapshot,
      earlyUneditedRerunNoOp: true,
    });
    expect(result.countedAsSuccess).toBe(false);
    expect(result.reason).toBe('experience_ai_noop');
    expect(result.diagnostics?.semanticNoOpDetected).toBe(true);
    expect(result.diagnostics?.earlyNoOpPreflightPassed).toBe(true);
    expect(result.diagnostics?.sourceAlreadyValidForTarget).toBe(true);
    expect(result.diagnostics?.providerAttempted).toBe(false);
    expect(result.diagnostics?.providerRequiredFactCount).toBeNull();
    expect(result.diagnostics?.providerCoveredFactCount).toBeNull();
    expect(result.diagnostics?.providerUncoveredFactCount).toBeNull();
    expect(result.diagnostics?.providerUncoveredFactIdentityHashes).toEqual([]);
    expect(result.diagnostics?.finalCandidateSource).toBe('none');
    expect(result.diagnostics?.translationFallbackAttempted).toBe(false);
    expect(result.diagnostics?.clientDeterministicFallbackAttempted).toBe(false);
  });
});
