import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { CVData } from '@/lib/types';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  buildCrossLocaleExperienceFallback,
  validateCrossLocaleSemanticCoverage,
} from '@/lib/cv-cross-locale-experience';
import {
  buildJapaneseDesignExperienceFallback,
  scanJapaneseExperiencePredicates,
  validateJapaneseExperienceEmploymentTense,
} from '@/lib/cv-japanese-experience-grounding';
import { scanGenericExperiencePredicates } from '@/lib/cv-generic-experience-predicate-grounding';
import { extractExperienceSemanticArgumentKinds } from '@/lib/cv-experience-unsupported-claims';
import { validateAiUnitLocalePurity } from '@/lib/cv-ai-unit-locale-purity';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { buildExperienceAiOutputProvenance } from '@/lib/cv-experience-ai-output-provenance';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { normalizeExperienceAiSourceText } from '@/lib/cv-experience-ai-operation-snapshot';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import { clearExperienceAiDiagnosticsForTests } from '@/lib/cv-experience-ai-diagnostics';

function exactSource(): string {
  const fixture = fs.readFileSync(
    path.resolve(__dirname, 'aab432-hindi-experience-noop-fallback-grounding.test.ts'),
    'utf8',
  );
  const body = fixture.match(/const EXACT_BE5C_SOURCE = formatExperienceBullets\(([\s\S]*?)\);/)?.[1];
  if (!body) throw new Error('AAB432 exact source fixture not found');
  return Function('formatExperienceBullets', `return formatExperienceBullets(${body});`)(formatExperienceBullets) as string;
}

const SOURCE = exactSource();

const JAPANESE = formatExperienceBullets([
  '\u5370\u5237\u30fb\u30c7\u30b8\u30bf\u30eb\u5a92\u4f53\u5411\u3051\u306e\u30b0\u30e9\u30d5\u30a3\u30c3\u30af\u7d20\u6750\u3092\u5236\u4f5c\u3057\u305f\u3002',
  '\u9867\u5ba2\u306e\u8981\u671b\u306b\u5fdc\u3058\u3066\u30d3\u30b8\u30e5\u30a2\u30eb\u30c7\u30b6\u30a4\u30f3\u306e\u30b3\u30f3\u30bb\u30d7\u30c8\u3092\u958b\u767a\u3057\u305f\u3002',
  '\u30c7\u30b6\u30a4\u30f3\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u3092\u30ec\u30d3\u30e5\u30fc\u3057\u3001\u6700\u7d42\u6210\u679c\u7269\u306e\u54c1\u8cea\u3092\u78ba\u8a8d\u3057\u305f\u3002',
]);
const UNSAFE_JAPANESE = formatExperienceBullets([
  '\u5370\u5237\u30fb\u30c7\u30b8\u30bf\u30eb\u5a92\u4f53\u5411\u3051\u306e\u30b0\u30e9\u30d5\u30a3\u30c3\u30af\u7d20\u6750\u3092\u5236\u4f5c\u3057\u305f\u3002',
  '\u9867\u5ba2\u306e\u8981\u671b\u306b\u5fdc\u3058\u3066\u30d3\u30b8\u30e5\u30a2\u30eb\u30c7\u30b6\u30a4\u30f3\u306e\u30b3\u30f3\u30bb\u30d7\u30c8\u3092\u958b\u767a\u3057\u3001\u3059\u3079\u3066\u306e\u6848\u4ef6\u3067\u6bce\u65e5\u6a19\u6e96\u306b\u5f93\u3063\u3066\u4f5c\u696d\u3057\u305f\u3002',
  '\u30c7\u30b6\u30a4\u30f3\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u3092\u30ec\u30d3\u30e5\u30fc\u3057\u3001\u6700\u7d42\u6210\u679c\u7269\u306e\u54c1\u8cea\u3092\u78ba\u8a8d\u3057\u305f\u3002',
]);

const ENTRY_ID = 'be5c794b';

function cv(): CVData {
  const visible = formatExperienceBullets([
    '\u0043r\u00e9ait des supports graphiques pour les m\u00e9dias imprim\u00e9s et num\u00e9riques.',
    '\u00c9laborait des concepts de design visuel selon les besoins des clients.',
    '\u00c9valuait les projets de design et v\u00e9rifiait la qualit\u00e9 des rendus finaux.',
  ]);
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: ENTRY_ID,
    appliedOutput: visible,
    preAiFactText: SOURCE,
    sourceLocale: 'hi',
    targetLocale: 'fr',
    operationMode: 'enhance_existing',
    sourceAuthorityKind: 'original_user',
  });
  return {
    id: 'aab449-ja',
    personal: { fullName: 'CJK test', email: 'cjk@example.com', phone: '', address: '', jobTitle: 'Graphic Designer', gender: 'female' },
    contentLocale: 'ja',
    experience: [{
      id: ENTRY_ID,
      position: 'Graphic Designer',
      company: 'TestWerk',
      startDate: '2021-01',
      endDate: '2024-01',
      isPresent: false,
      description: visible,
      originalUserDescription: SOURCE,
      canonicalDescription: SOURCE,
      descriptionOrigin: 'ai_generated',
      generatedDescription: visible,
      generatedLocale: 'fr',
      aiOutputProvenance: provenance,
    }],
    education: [], skills: [], languages: [], certifications: [], projects: [],
  } as unknown as CVData;
}

describe('AAB449 generic Japanese/CJK Experience bridge', () => {
  beforeEach(() => clearExperienceAiDiagnosticsForTests());

  it('projects the exact completed design duties into three Japanese units', () => {
    expect(fingerprintText(normalizeExperienceAiSourceText(SOURCE))).toBe('fnv1a_431c4554_l204_b2346_e2404');
    expect(ENTRY_ID).toBe('be5c794b');
    const fallback = buildJapaneseDesignExperienceFallback({ sourceDescription: SOURCE, isPresent: false });
    expect(fallback).toBe(JAPANESE);
    expect(validateAiUnitLocalePurity(fallback, 'ja', { kind: 'experience_bullet', requireUnits: true }).ok).toBe(true);
    const semantic = validateCrossLocaleSemanticCoverage(SOURCE, fallback);
    expect(semantic.ok).toBe(true);
    expect(semantic.requiredCount).toBe(3);
    expect(semantic.coveredCount).toBe(3);
    expect(semantic.addedSemanticArgumentCount).toBe(0);
    expect(extractExperienceSemanticArgumentKinds(SOURCE).sort()).toEqual(
      extractExperienceSemanticArgumentKinds(fallback).sort(),
    );
    expect(validateJapaneseExperienceEmploymentTense(JAPANESE, false).finalTensePassed).toBe(true);
    expect(validateJapaneseExperienceEmploymentTense(JAPANESE.replaceAll('した。', 'する。'), false).finalTensePassed).toBe(false);
  });

  it('counts Japanese clauses as owned responsibilities, not agglutinative verbs', () => {
    const scan = scanJapaneseExperiencePredicates(SOURCE, JAPANESE);
    expect(scan.sourcePredicateIdentityCount).toBe(3);
    expect(scan.candidatePredicateIdentityCount).toBe(3);
    expect(scan.candidateAddedPredicateCount).toBe(0);
    expect(scan.sourceUnitPredicateCoveragePassed).toBe(true);
    const generic = scanGenericExperiencePredicates(SOURCE, JAPANESE, {
      allowValidatedCrossScriptBridge: true,
    });
    expect(generic.candidateAddedPredicateCount).toBe(0);
  });

  it('handles an unrelated Japanese free-text role without design-specific fallback assumptions', () => {
    const source = formatExperienceBullets([
      '\u8acb\u6c42\u66f8\u3092\u6574\u7406\u3057\u3066\u8a18\u9332\u3057\u305f\u3002',
      '\u9867\u5ba2\u3078\u306e\u9023\u7d61\u3092\u8abf\u6574\u3057\u305f\u3002',
    ]);
    const candidate = formatExperienceBullets([
      '\u8acb\u6c42\u66f8\u3092\u6574\u7406\u3057\u3001\u8a18\u9332\u3057\u305f\u3002',
      '\u9867\u5ba2\u3078\u306e\u9023\u7d61\u3092\u8abf\u6574\u3057\u305f\u3002',
    ]);
    const scan = scanJapaneseExperiencePredicates(source, candidate);
    expect(validateAiUnitLocalePurity(candidate, 'ja', { kind: 'experience_bullet', requireUnits: true }).ok).toBe(true);
    expect(scan.sourcePredicateIdentityCount).toBe(2);
    expect(scan.candidatePredicateIdentityCount).toBe(2);
    expect(scan.sourceUnitPredicateCoveragePassed).toBe(true);
    expect(scan.candidateAddedPredicateCount).toBe(0);
    expect(validateCrossLocaleSemanticCoverage(source, candidate).ok).toBe(true);
  });

  it.each([
    ['omits one duty', JAPANESE.split('\n').slice(0, 2).join('\n')],
    ['merges duties', formatExperienceBullets(['\u5370\u5237\u30fb\u30c7\u30b8\u30bf\u30eb\u5a92\u4f53\u5411\u3051\u306e\u30b0\u30e9\u30d5\u30a3\u30c3\u30af\u7d20\u6750\u3092\u5236\u4f5c\u3057\u3001\u9867\u5ba2\u306e\u8981\u671b\u306b\u5fdc\u3058\u3066\u30b3\u30f3\u30bb\u30d7\u30c8\u3092\u958b\u767a\u3057\u305f\u3002', JAPANESE.split('\n')[2]])],
    ['adds an unrelated responsibility', `${JAPANESE}\n\u55b6\u696d\u30c1\u30fc\u30e0\u3092\u7ba1\u7406\u3057\u305f\u3002`],
  ])('rejects %s', (_label, candidate) => {
    const scan = scanJapaneseExperiencePredicates(SOURCE, candidate);
    expect(scan.sourceUnitPredicateCoveragePassed).toBe(false);
  });

  it.each([
    ['project requirements', JAPANESE.replace('\u9867\u5ba2\u306e\u8981\u671b\u306b\u5fdc\u3058\u3066', '\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u8981\u4ef6\u306b\u5f93\u3063\u3066')],
    ['standards criterion', JAPANESE.replace('\u54c1\u8cea\u3092\u78ba\u8a8d\u3057\u305f', '\u54c1\u8cea\u3092\u78ba\u8a8d\u3057\u3001\u57fa\u6e96\u306b\u5f93\u3063\u305f')],
    ['universal and frequency scope', UNSAFE_JAPANESE],
    ['foreign responsibility', `${JAPANESE}\n\u55b6\u696d\u30c1\u30fc\u30e0\u3092\u7ba1\u7406\u3057\u305f\u3002`],
  ])('rejects %s semantic expansion', (_label, candidate) => {
    const scan = scanGenericExperiencePredicates(SOURCE, candidate, {
      allowValidatedCrossScriptBridge: true,
    });
    expect(scan.sourceUnitPredicateCoveragePassed).toBe(false);
    expect(scan.candidateAddedPredicateCount).toBeGreaterThanOrEqual(0);
  });

  it('keeps the trusted prior French provenance over a heuristic detector', () => {
    const result = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'ja',
      gender: 'female',
      cv: cv(),
      candidate: JAPANESE,
      experienceId: ENTRY_ID,
      industry: 'design',
      level: 'mid',
      referenceDateIso: '2026-08-15',
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: formatExperienceBullets([
          '\u0043r\u00e9ait des supports graphiques pour les m\u00e9dias imprim\u00e9s et num\u00e9riques.',
          '\u00c9laborait des concepts de design visuel selon les besoins des clients.',
          '\u00c9valuait les projets de design et v\u00e9rifiait la qualit\u00e9 des rendus finaux.',
        ]),
        locale: 'ja',
        requestId: 'aab449-ja-request',
        jobContextHash: 'aab449-ja-job',
        experienceEntryId: ENTRY_ID,
        authoritativeTextOverride: SOURCE,
        provenanceOriginOverride: 'originalUserDescription',
      }),
      currentTextareaProvenance: 'ai_generated_unedited',
      authoritativeFactSourceKind: 'original_user',
      currentTextareaUsedForFactExtraction: false,
      lastAiOutputHashMatched: true,
      materialUserEditDetected: false,
      staleGeneratedDescriptionIgnored: false,
    });
    expect(result.countedAsSuccess).toBe(true);
    expect(result.diagnostics?.finalCandidateSource).toMatch(/provider|deterministic_fallback|server_repair/);
    expect(result.diagnostics?.sourceUnitPredicateCoveragePassed).toBe(true);
    expect(result.diagnostics?.finalAddedPredicateCount).toBe(0);
    expect(result.diagnostics?.visibleTextareaLocaleBeforeApply).toBe('fr');
    expect(result.diagnostics?.entryGeneratedLocaleBeforeApply).toBe('fr');
    expect(typeof result.diagnostics?.visibleLocaleMetadataMismatchRecorded).toBe('boolean');
  });

});
