import { describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  buildCrossLocaleExperienceFallback,
  validateCrossLocaleSemanticCoverage,
} from '@/lib/cv-cross-locale-experience';
import { scanGenericExperiencePredicates } from '@/lib/cv-generic-experience-predicate-grounding';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';

const SOURCE = [
  'ग्राफिक डिज़ाइन सामग्री को मुद्रित और डिजिटल माध्यमों के लिए तैयार करती थी।',
  'ग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।',
  'अंतिम परिणामों की गुणवत्ता सुनिश्चित करने के लिए डिज़ाइन परियोजनाओं की समीक्षा करती थी।',
].join(' ');

const VALID_CANDIDATE = formatExperienceBullets([
  'Ha creato materiali grafici per supporti stampati e digitali.',
  'Ha sviluppato concetti di design visivo in base alle esigenze dei clienti.',
  'Ha revisionato progetti di design e verificato la qualità dei risultati finali.',
]);

describe('AAB459 Italian cross-locale predicate bridge', () => {
  it('shows the deterministic Italian fallback and both coverage layers', () => {
    const candidate = buildCrossLocaleExperienceFallback({
      sourceDescription: SOURCE,
      sourceLocale: 'hi',
      targetLocale: 'it',
      gender: 'female',
      isPresent: false,
      position: 'Designer Grafica',
    });
    const semantic = validateCrossLocaleSemanticCoverage(SOURCE, candidate);
    const predicates = scanGenericExperiencePredicates(SOURCE, candidate, {
      allowValidatedCrossScriptBridge: true,
      allowValidatedCrossLocaleBridge: true,
    });
    expect(candidate).toContain('Ha creato');
    expect(candidate).toContain('esigenze dei clienti');
    expect(candidate).toContain('verificato la qualità');
    expect(semantic).toMatchObject({ requiredCount: 3, coveredCount: 3, uncoveredCount: 0, ok: true });
    expect(predicates).toMatchObject({
      sourcePredicateIdentityCount: 3,
      candidatePredicateIdentityCount: 3,
      candidateAddedPredicateCount: 0,
      sourceUnitPredicateCoveragePassed: true,
    });
  });

  it.each([
    VALID_CANDIDATE.replace(
      'in base alle esigenze dei clienti',
      'in base alle esigenze dei clienti e ai requisiti del progetto',
    ),
    VALID_CANDIDATE.replace(
      'in base alle esigenze dei clienti',
      'secondo gli standard stabiliti',
    ),
    VALID_CANDIDATE.replace(
      'qualità dei risultati finali',
      'qualità dei risultati finali per tutti i progetti quotidianamente',
    ),
  ])('rejects an unsourced Italian semantic argument: %s', (candidate) => {
    const semantic = validateCrossLocaleSemanticCoverage(SOURCE, candidate);
    expect(semantic.ok).toBe(false);
    expect(semantic.addedSemanticArgumentCount).toBeGreaterThan(0);
    const predicates = scanGenericExperiencePredicates(SOURCE, candidate, {
      allowValidatedCrossScriptBridge: true,
      allowValidatedCrossLocaleBridge: true,
    });
    expect(predicates.sourceUnitPredicateCoveragePassed).toBe(false);
  });

  it('accepts the safe Italian candidate at the shared Experience finalizer boundary', () => {
    const cv: CVData = {
      id: 'cv-aab459', name: 'AAB459', summary: '', contentLocale: 'hi', templateId: 'ats-standard', region: 'US', createdAt: '2026-01-01', updatedAt: '2026-01-01',
      personal: { fullName: 'Test User', email: 'test@example.com', phone: '', address: '', jobTitle: 'Graphic Designer', gender: 'female', photoEnabled: false },
      experience: [{
        id: 'exp-aab459', company: 'TestWerk', position: 'Graphic Designer', startDate: '2020-01', endDate: '2024-12', isPresent: false,
        description: SOURCE, originalUserDescription: SOURCE, canonicalDescription: SOURCE, descriptionOrigin: 'user',
      }],
      education: [], skills: [], certifications: [], languages: [],
    };
    const finalized = finalizeCvAiFieldForApply({
      action: 'experience_bullets', field: 'experience_description', requestedLocale: 'it', gender: 'female', cv,
      candidate: VALID_CANDIDATE, originHint: 'deterministic_fallback', experienceId: 'exp-aab459', industry: 'general', level: 'mid',
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: SOURCE, locale: 'it', requestId: 'req-aab459', jobContextHash: 'job-aab459', experienceEntryId: 'exp-aab459',
        authoritativeTextOverride: SOURCE, provenanceOriginOverride: 'originalUserDescription',
      }),
    });
    expect(finalized.blocked).toBe(false);
    expect(finalized.countedAsSuccess).toBe(true);
    expect(finalized.origin).toBe('deterministic_fallback');
    expect(finalized.text).toBe(VALID_CANDIDATE);
    expect(finalized.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
  });

  it('keeps fact-3 review/quality coverage and rejects an added coordinated action', () => {
    const reviewOnly = VALID_CANDIDATE.replace(
      'Ha revisionato progetti di design e verificato la qualità dei risultati finali.',
      'Ha revisionato progetti di design.',
    );
    const nativeSynonym = VALID_CANDIDATE.replace(
      'Ha revisionato progetti di design e verificato la qualità dei risultati finali.',
      'Ha esaminato i progetti di design e controllato la qualità dei risultati finali.',
    );
    const plusEvent = `${VALID_CANDIDATE}\n• Ha organizzato eventi.`;
    expect(validateCrossLocaleSemanticCoverage(SOURCE, reviewOnly)).toMatchObject({ ok: false });
    expect(validateCrossLocaleSemanticCoverage(SOURCE, plusEvent)).toMatchObject({ ok: false });
    expect(validateCrossLocaleSemanticCoverage(SOURCE, nativeSynonym)).toMatchObject({ ok: true });
  });

  it.each([
    ['healthcare', 'Prepared patient records for digital media according to client needs.', 'Ha preparato le cartelle dei pazienti per i media digitali secondo le esigenze dei clienti.', 'Ha utilizzato Salesforce per preparare le cartelle dei pazienti per i media digitali secondo le esigenze dei clienti.'],
    ['software', 'Updated application documentation for digital media according to client needs.', 'Ha aggiornato la documentazione dell’applicazione per i media digitali secondo le esigenze dei clienti.', 'Ha diretto un team e aggiornato la documentazione dell’applicazione per i media digitali secondo le esigenze dei clienti.'],
    ['hospitality', 'Prepared guest service materials for digital media according to client needs.', 'Ha preparato materiali per il servizio agli ospiti per i media digitali secondo le esigenze dei clienti.', 'Ha organizzato eventi e preparato materiali per il servizio agli ospiti per i media digitali secondo le esigenze dei clienti.'],
    ['office', 'Reviewed client documents for digital media according to client needs.', 'Ha revisionato documenti dei clienti per i media digitali secondo le esigenze dei clienti.', 'Ha revisionato software aziendale per i media digitali secondo le esigenze dei clienti.'],
    ['trade', 'Prepared work materials for digital media according to client needs.', 'Ha preparato materiali di lavoro per i media digitali secondo le esigenze dei clienti.', 'Ha preparato materiali di lavoro per i media digitali secondo le esigenze dei clienti aumentando le vendite del 40%.'],
  ] as const)('keeps generic relation ownership for arbitrary %s free-text duties', (_domain, source, safe, unsafe) => {
    expect(validateCrossLocaleSemanticCoverage(source, safe).ok).toBe(true);
    const rejected = validateCrossLocaleSemanticCoverage(source, unsafe);
    expect(rejected.ok).toBe(false);
    expect(rejected.addedSemanticArgumentCount).toBeGreaterThan(0);
  });
});
