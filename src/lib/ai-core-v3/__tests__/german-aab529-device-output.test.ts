import { describe, expect, it } from 'vitest';
import { createCandidateEnvelope } from '../candidate-envelope';
import { GERMAN_AAB529_DEVICE_OUTPUT_FIXTURE } from '../fixtures/german-aab529-device-output';
import { createSummaryFactManifest } from '../summary-manifest';
import { runAiCoreV3Validation, type ValidationPhaseResult } from '../validators';

const fixture = GERMAN_AAB529_DEVICE_OUTPUT_FIXTURE;

function passed(category: 'semantic' | 'language_quality'): ValidationPhaseResult {
  return { category, status: 'passed', violations: [] };
}

describe('German AAB529 user-supplied device-output fixture', () => {
  it('preserves the exact malformed family with limited provenance claims', () => {
    expect(fixture.provenance).toBe('user_supplied_device_output');
    expect(fixture.provenanceScope).toBe('regression_evidence_not_proven_aab529_build_source_identity');
    expect(fixture.currentRole.sourceBullets).toEqual([
      'Erstellt konkrete Arbeitsergebnisse für den Aufgabenbereich.',
      'Prüft vorliegende Unterlagen und schließt erforderliche Nacharbeiten ab.',
      'Stimmt Arbeitsschritte mit Kolleginnen und Kollegen ab.',
    ]);
    expect(fixture.priorRole.sourceBullets).toEqual([
      'Führte einfache Funktionsprüfungen an elektrischen Anlagen nach vorgegebenen Prüfschritten durch.',
      'Dokumentierte festgestellte Abweichungen und leitete die Informationen an den zuständigen Techniker weiter.',
      'Unterstützte bei der Vorbereitung von Werkzeugen und Unterlagen für geplante Serviceeinsätze.',
    ]);
    expect(fixture.observedMalformedSummary).toContain('abprüfe');
    expect(fixture.observedMalformedSummary).toContain('weiterdokumentierte');
    expect(fixture.malformedSurfaceMarkers).toEqual(['abprüfe', 'weiterdokumentierte']);
    expect(fixture.expectedDecision).toBe('reject');
    expect(fixture.expectedCategory).toBe('language_quality');
    expect(fixture.productionGrammarEvaluatorImplemented).toBe(false);
    expect(Object.isFrozen(fixture)).toBe(true);
  });

  it('rejects a test-only language-quality violation without changing or repairing the candidate', () => {
    const manifest = createSummaryFactManifest({
      operationId: 'aab529-summary-operation',
      operationKind: 'summary_generate',
      targetLocale: 'de',
      currentRoleEntryId: fixture.currentRole.entryId,
      selectedEntries: [
        {
          entryId: fixture.currentRole.entryId,
          roleTitle: 'Servicetechniker Elektrotechnik',
          employer: 'NordWerk Elektroservice Test',
          employmentState: 'present',
          dates: { start: { year: 2024 }, end: null },
          facts: fixture.currentRole.sourceBullets.map((text, index) => ({
            factId: `current-fact-${index + 1}`,
            text,
            sourceHash: `current-source-${index + 1}`,
            required: true,
          })),
        },
        {
          entryId: fixture.priorRole.entryId,
          roleTitle: 'Elektroniker für Betriebstechnik',
          employer: 'RheinMain Anlagenservice Test',
          employmentState: 'completed',
          dates: { start: { year: 2018 }, end: { year: 2023 } },
          facts: fixture.priorRole.sourceBullets.map((text, index) => ({
            factId: `prior-fact-${index + 1}`,
            text,
            sourceHash: `prior-source-${index + 1}`,
            required: true,
          })),
        },
      ],
      structuredTotalDurationMonths: 66,
      skills: [],
      education: [],
      languages: ['Deutsch'],
      sourceSnapshotHash: 'aab529-source-snapshot',
    });
    const candidate = createCandidateEnvelope({
      operationId: manifest.operationId,
      candidateId: 'aab529-device-candidate',
      operationKind: manifest.operationKind,
      targetLocale: manifest.targetLocale,
      sourceSnapshotHash: manifest.sourceSnapshotHash,
      text: fixture.observedMalformedSummary,
    });
    const originalCandidate = candidate.text;
    const result = runAiCoreV3Validation(
      { manifest, candidate },
      {
        semantic: () => passed('semantic'),
        languageQuality: () => ({
          category: 'language_quality',
          status: 'failed',
          violations: [{
            code: 'malformed_surface',
            category: 'language_quality',
            detail: 'Test-only fixture double detected the documented malformed markers',
          }],
        }),
      },
    );

    expect(result.decision).toBe('reject');
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: 'malformed_surface',
      category: 'language_quality',
    }));
    expect(candidate.text).toBe(originalCandidate);
    expect(JSON.stringify(result)).not.toContain('replacement');
    expect('accepted' in result).toBe(false);
    expect('apply' in result).toBe(false);
  });
});
