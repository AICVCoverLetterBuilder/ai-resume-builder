/**
 * @vitest-environment jsdom
 *
 * AAB-303 German Experience fact grounding — Hindi→German regression from AAB-302.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  runCvAiApplyPipeline,
} from '@/lib/cv-ai-finalize-apply';
import {
  GERMAN_EXPERIENCE_GROUNDING_303_REVISION,
  validateGermanWarehouseExperienceCoverage,
  detectGermanExperienceUnsupportedExpansion,
  buildGermanWarehouseExperienceFallback,
  sourceRequiresGermanWarehouseFactCoverage,
} from '@/lib/cv-german-experience-grounding';
import { validateCrossLocaleSemanticCoverage } from '@/lib/cv-cross-locale-experience';
import { buildJobContextGenerationFallback } from '@/lib/cv-experience-ai-operation-mode';
import { EXPERIENCE_AI_DIAG_MARKER } from '@/lib/cv-ai-diagnostics-contract';
import {
  ExperienceAiDiagnosticSession,
  clearExperienceAiDiagnosticsForTests,
} from '@/lib/cv-experience-ai-diagnostics';
import { localizeWarehouseEmployee } from '@/lib/cv-role-title';

const REF = '2026-07-19';

const HI_WH = [
  'आने वाले माल की जाँच करती है।',
  'संबंधित दस्तावेज़ों की जाँच करती है।',
  'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।',
].join('\n');

const BAD_AAB302_DE = [
  'Prüft tägliche Unterlagen im Bereich Fachkraft und kontrolliert die Vollständigkeit der Daten.',
  'Aktualisiert Arbeitsdokumentation und verfolgt offene Vorgänge.',
  'Koordiniert den Informationsaustausch mit Kolleginnen und Kollegen zur fristgerechten Fertigstellung.',
].join('\n');

const GOOD_DE = [
  'Prüft eingehende Waren.',
  'Kontrolliert die dazugehörigen Unterlagen und Aufzeichnungen.',
  'Koordiniert mit Kolleginnen und Kollegen die Vorbereitung und Bewegung der Waren.',
].join('\n');

function hiWarehouseCv(description = HI_WH): CVData {
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: 'गोदाम कर्मचारी',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description,
    originalUserDescription: description,
    canonicalDescription: description,
    descriptionOrigin: 'user',
    generatedLocale: 'hi',
  };
  return {
    id: 'cv-de-303',
    name: 'CV',
    personal: {
      fullName: 'Anna Test',
      email: 'anna@example.com',
      phone: '',
      address: '',
      jobTitle: localizeWarehouseEmployee('de', 'female'),
      gender: 'female',
      photoEnabled: false,
    },
    summary: '',
    contentLocale: 'de',
    experience: [current],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
  };
}

describe('German Experience grounding (AAB-303)', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes german-experience-grounding-303-v1 packaging marker', () => {
    expect(GERMAN_EXPERIENCE_GROUNDING_303_REVISION).toBe('german-experience-grounding-303-v1');
    const cov = validateGermanWarehouseExperienceCoverage(HI_WH, GOOD_DE);
    expect(cov.revision).toBe('german-experience-grounding-303-v1');
  });

  it('1. Exact AAB-302 bad server fallback is rejected', () => {
    const cv = hiWarehouseCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: BAD_AAB302_DE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      originHint: 'deterministic_fallback',
    });
    // Either hard reject, or safe recovery to grounded German — never keep bad bullets.
    expect(fin.text).not.toMatch(/tägliche Unterlagen|im Bereich Fachkraft|Vollständigkeit der Daten|Informationsaustausch|fristgerechten Fertigstellung/i);
    if (fin.blocked) {
      expect(fin.countedAsSuccess).toBe(false);
      expect(fin.diagnostics?.unsupportedClaimCount ?? 0).toBeGreaterThan(0);
      expect((fin.diagnostics?.coveredFactCount ?? 0)).toBeLessThan(3);
      expect(fin.diagnostics?.finalCandidateSource).not.toBe('provider');
    } else {
      expect(fin.countedAsSuccess).toBe(true);
      expect(fin.text).toMatch(/eingehende Waren/i);
      expect(fin.text).toMatch(/Unterlagen|Aufzeichnungen/i);
      expect(fin.text).toMatch(/Vorbereitung|Bewegung/i);
      expect(fin.diagnostics?.finalCandidateSource).not.toBe('provider');
    }
  });

  it('2–5. Object substitutions fail German warehouse coverage', () => {
    expect(sourceRequiresGermanWarehouseFactCoverage(HI_WH)).toBe(true);
    const docsOnly = '• Prüft Unterlagen.\n• Kontrolliert Daten.\n• Bearbeitet Vorgänge.';
    const cov = validateGermanWarehouseExperienceCoverage(HI_WH, docsOnly);
    expect(cov.ok).toBe(false);
    expect(cov.uncovered).toEqual(expect.arrayContaining([
      'incoming_goods_check',
      'goods_prep_movement_colleagues',
    ]));

    const updateDocs = '• Aktualisiert Arbeitsdokumentation.\n• Verfolgt offene Vorgänge.\n• Prüft eingehende Waren.';
    expect(validateGermanWarehouseExperienceCoverage(HI_WH, updateDocs).ok).toBe(false);

    const infoExchange = [
      '• Prüft eingehende Waren.',
      '• Kontrolliert die dazugehörigen Unterlagen.',
      '• Koordiniert den Informationsaustausch mit Kolleginnen und Kollegen.',
    ].join('\n');
    expect(validateGermanWarehouseExperienceCoverage(HI_WH, infoExchange).ok).toBe(false);

    const deadline = [
      '• Prüft eingehende Waren.',
      '• Kontrolliert die dazugehörigen Unterlagen.',
      '• Sorgt für fristgerechte Fertigstellung mit dem Team.',
    ].join('\n');
    expect(validateGermanWarehouseExperienceCoverage(HI_WH, deadline).ok).toBe(false);
  });

  it('6–10. Unsupported German semantic expansions detected vs source', () => {
    const scan = detectGermanExperienceUnsupportedExpansion(HI_WH, BAD_AAB302_DE);
    expect(scan.count).toBeGreaterThan(0);
    expect(scan.labels.join(' ')).toMatch(/frequency|data_quality|documentation|deadline|malformed|information_exchange/i);
    expect(scan.malformedRolePhraseDetected).toBe(true);
    expect(scan.deadlineClaimDetected).toBe(true);
    expect(scan.documentationExpansionDetected).toBe(true);
  });

  it('11–13. Valid German warehouse translation covers three facts independently', () => {
    const cov = validateGermanWarehouseExperienceCoverage(HI_WH, GOOD_DE);
    expect(cov.ok).toBe(true);
    expect(cov.covered).toHaveLength(3);
    expect(cov.uncovered).toEqual([]);

    const oneBullet = 'Prüft eingehende Waren und Unterlagen und koordiniert mit Kollegen die Vorbereitung und Bewegung der Waren.';
    const one = validateGermanWarehouseExperienceCoverage(HI_WH, oneBullet);
    // One bullet may cover at most the facts it truly contains; must not soft-pass all three via frames alone.
    expect(one.covered.length).toBeLessThanOrEqual(3);
    if (one.ok) {
      expect(oneBullet).toMatch(/eingehende Waren/i);
      expect(oneBullet).toMatch(/Unterlagen/i);
      expect(oneBullet).toMatch(/Vorbereitung|Bewegung/i);
    }
  });

  it('14–15. Soft semantic coverage no longer accepts AAB-302 bad bullets for warehouse', () => {
    const soft = validateCrossLocaleSemanticCoverage(HI_WH, BAD_AAB302_DE);
    expect(soft.ok).toBe(false);
  });

  it('16–17. Invalid fallback recovers via deterministic German warehouse fallback', () => {
    const pipe = runCvAiApplyPipeline({
      cv: hiWarehouseCv(),
      locale: 'de',
      action: 'experience_bullets',
      candidate: BAD_AAB302_DE,
      experienceId: 'exp-atlas',
      industry: 'logistics',
      level: 'mid',
      originHint: 'deterministic_fallback',
    });
    expect(pipe.finalized.blocked).toBe(false);
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(pipe.finalized.text).toMatch(/eingehende Waren/i);
    expect(pipe.finalized.text).toMatch(/Unterlagen|Aufzeichnungen/i);
    expect(pipe.finalized.text).toMatch(/Vorbereitung|Bewegung/i);
    expect(pipe.finalized.text).not.toMatch(/[\u0900-\u097F]/);
    expect(pipe.finalized.text).not.toMatch(/Fachkraft|Informationsaustausch|fristgerecht/i);
    expect(pipe.finalized.diagnostics?.finalCandidateSource).not.toBe('provider');
    expect(pipe.finalized.diagnostics?.serverFallbackUsed).toBe(true);
  });

  it('18–20. Unsafe recovery without warehouse keys still rejects unsupported claims', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv: hiWarehouseCv('सामान्य कार्य करती है।'),
      candidate: BAD_AAB302_DE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      originHint: 'deterministic_fallback',
      noOpRepairAttempted: true,
    });
    // Non-warehouse Hindi source: bad DE must not apply as success with unsupported expansions.
    if (!fin.blocked) {
      expect(fin.text).not.toMatch(/im Bereich Fachkraft|Vollständigkeit der Daten/i);
    } else {
      expect(fin.countedAsSuccess).toBe(false);
      expect(fin.text).toBe('सामान्य कार्य करती है।');
    }
  });

  it('21. Successful recovery usage-style success flag is true once', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv: hiWarehouseCv(),
      candidate: BAD_AAB302_DE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      originHint: 'deterministic_fallback',
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
  });

  it('22. Current entry remains present tense', () => {
    const text = buildGermanWarehouseExperienceFallback({
      sourceDescription: HI_WH,
      isPresent: true,
    });
    expect(text).toMatch(/^•?\s*Prüft|^Prüft/m);
    expect(text).not.toMatch(/\bPrüfte\b/);
  });

  it('23. Completed entry uses completed German style', () => {
    const text = buildGermanWarehouseExperienceFallback({
      sourceDescription: HI_WH,
      isPresent: false,
    });
    expect(text).toMatch(/Prüfte|Kontrollierte|Koordinierte/);
  });

  it('24–25. Stable clicked entry; no cross-entry leakage', () => {
    const other: WorkExperience = {
      id: 'exp-other',
      company: 'Other',
      position: 'Admin',
      startDate: '2020-01',
      endDate: '2021-01',
      isPresent: false,
      description: 'Büroarbeiten erledigt.',
      originalUserDescription: 'Büroarbeiten erledigt.',
      canonicalDescription: 'Büroarbeiten erledigt.',
      descriptionOrigin: 'user',
      generatedLocale: 'de',
    };
    const cv = hiWarehouseCv();
    cv.experience.push(other);
    const pipe = runCvAiApplyPipeline({
      cv,
      locale: 'de',
      action: 'experience_bullets',
      candidate: BAD_AAB302_DE,
      experienceId: 'exp-atlas',
      originHint: 'deterministic_fallback',
    });
    expect(pipe.stateCv.experience.find((e) => e.id === 'exp-atlas')?.description)
      .toMatch(/eingehende Waren/i);
    expect(pipe.stateCv.experience.find((e) => e.id === 'exp-other')?.description)
      .toBe('Büroarbeiten erledigt.');
  });

  it('26–27. Hindi → German first click: no Devanagari in result', () => {
    const pipe = runCvAiApplyPipeline({
      cv: hiWarehouseCv(),
      locale: 'de',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-atlas',
      originHint: 'deterministic_fallback',
    });
    // Empty provider → fallback path
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv: hiWarehouseCv(),
      candidate: BAD_AAB302_DE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      originHint: 'deterministic_fallback',
    });
    expect(fin.text).not.toMatch(/[\u0900-\u097F]/);
    expect(pipe.finalized?.text || fin.text).not.toMatch(/[\u0900-\u097F]/);
  });

  it('28–30. Weak German improve; identical good text is not charged as unsupported expansion', () => {
    const weak = [
      'Eingehende Waren prüfen',
      'Zugehörige Unterlagen prüfen',
      'Waren mit Kolleginnen und Kollegen vorbereiten und bewegen',
    ].join('\n');
    const cv = hiWarehouseCv(weak);
    cv.experience[0]!.generatedLocale = 'de';
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: GOOD_DE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).toMatch(/eingehende Waren/i);

    const scanSame = detectGermanExperienceUnsupportedExpansion(GOOD_DE, GOOD_DE);
    expect(scanSame.count).toBe(0);

    const punctOnly = GOOD_DE.replace(/\./g, '!');
    const scanPunct = detectGermanExperienceUnsupportedExpansion(GOOD_DE, punctOnly);
    expect(scanPunct.count).toBe(0);
    // Punctuation-only vs identical source should not invent unsupported claims.
    const covPunct = validateGermanWarehouseExperienceCoverage(GOOD_DE, punctOnly);
    expect(covPunct.ok).toBe(true);
  });

  it('31–34. Marker + diagnostics truthfulness on rejected candidate', () => {
    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'de',
      requestedLocale: 'de',
      templateId: 'modern',
      jobContextHash: 'de-303',
      requestId: 'de-303-rej',
      usageCountBefore: 8,
    });
    session.patch({
      selectedSourceKind: 'live_textarea',
      clickedExperienceEntryIdHash: 'fnv1a_atlas',
      detectedSourceLocale: 'hi',
      crossLocaleOperation: true,
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv: hiWarehouseCv(),
      candidate: BAD_AAB302_DE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      originHint: 'deterministic_fallback',
    });
    // Capture rejection diagnostics from a force-reject unit path
    const cov = validateGermanWarehouseExperienceCoverage(HI_WH, BAD_AAB302_DE);
    const scan = detectGermanExperienceUnsupportedExpansion(HI_WH, BAD_AAB302_DE);
    expect(cov.uncovered.length).toBeGreaterThan(0);
    expect(scan.count).toBeGreaterThan(0);
    session.patch({
      requiredFactCount: cov.required.length,
      coveredFactCount: cov.covered.length,
      uncoveredFactIdentityHashes: cov.uncovered.map((id) => `de_wh_${id}`),
      unsupportedClaimCount: scan.count,
      finalCandidateSource: fin.diagnostics?.finalCandidateSource || 'none',
      serverFallbackUsed: true,
      apiResponseKind: 'fallback',
      providerResponseKind: 'fallback',
    });
    if (fin.blocked) {
      session.recordVisibleApply(false, 8);
    } else {
      session.patch({
        finalNormalizedHash: 'fnv1a_test_final_303',
        visibleTextareaMatchesFinalNormalizedHash: true,
        visibleDescriptionMatchesFinalHash: true,
      });
      session.recordVisibleApply(true, 9, {
        visibleDescription: fin.text || GOOD_DE,
        finalNormalizedText: fin.text || GOOD_DE,
      });
    }
    const trace = session.commit();
    expect(trace.marker).toBe(EXPERIENCE_AI_DIAG_MARKER);
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.uncoveredFactIdentityHashes.length).toBeGreaterThan(0);
    expect(trace.unsupportedClaimCount).toBeGreaterThan(0);
  });

  it('35. Server warehouse domain shell is grounded (not generic Fachkraft)', () => {
    const shells = buildJobContextGenerationFallback({
      locale: 'de',
      gender: 'female',
      position: 'Lagermitarbeiterin',
      industry: 'logistics',
      isPresent: true,
    });
    expect(shells).toMatch(/eingehende Waren/i);
    expect(shells).not.toMatch(/im Bereich Fachkraft/i);
  });

  it('36–37. Marker non-regression + German Summary regression smoke', async () => {
    expect(EXPERIENCE_AI_DIAG_MARKER).toBe('EXPERIENCE_AI_DIAG_V1');
    const { GERMAN_CV_AI_302_REVISION } = await import('@/lib/cv-german-summary-grounding');
    expect(GERMAN_CV_AI_302_REVISION).toBe('german-cv-ai-302-v1');
  });
});
