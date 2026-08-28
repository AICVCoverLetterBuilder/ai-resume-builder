import { immutableCopy } from '../immutability';

export const GERMAN_AAB529_DEVICE_OUTPUT_FIXTURE = immutableCopy({
  provenance: 'user_supplied_device_output' as const,
  provenanceScope: 'regression_evidence_not_proven_aab529_build_source_identity' as const,
  currentRole: {
    entryId: 'aab529-current-role',
    sourceBullets: [
      'Erstellt konkrete Arbeitsergebnisse für den Aufgabenbereich.',
      'Prüft vorliegende Unterlagen und schließt erforderliche Nacharbeiten ab.',
      'Stimmt Arbeitsschritte mit Kolleginnen und Kollegen ab.',
    ],
  },
  priorRole: {
    entryId: 'aab529-prior-role',
    sourceBullets: [
      'Führte einfache Funktionsprüfungen an elektrischen Anlagen nach vorgegebenen Prüfschritten durch.',
      'Dokumentierte festgestellte Abweichungen und leitete die Informationen an den zuständigen Techniker weiter.',
      'Unterstützte bei der Vorbereitung von Werkzeugen und Unterlagen für geplante Serviceeinsätze.',
    ],
  },
  observedMalformedSummary: 'Ich verfüge über insgesamt etwa fünfeinhalb Jahre Berufserfahrung. Derzeit arbeite ich als Servicetechniker Elektrotechnik bei NordWerk Elektroservice Test, wo ich konkrete Arbeitsergebnisse für den Aufgabenbereich erstelle, vorliegende Unterlagen und schließt erforderliche Nacharbeiten abprüfe und Arbeitsschritte mit Kolleginnen und Kollegen abstimme. Zuvor arbeitete ich als Elektroniker für Betriebstechnik bei RheinMain Anlagenservice Test, wo ich einfache Funktionsprüfungen an elektrischen Anlagen nach vorgegebenen Prüfschritten durchführte, festgestellte Abweichungen und leitete die Informationen an den zuständigen Techniker weiterdokumentierte und bei der Vorbereitung von Werkzeugen und Unterlagen für geplante Serviceeinsätze unterstützte.',
  malformedSurfaceMarkers: ['abprüfe', 'weiterdokumentierte'],
  expectedDecision: 'reject' as const,
  expectedCategory: 'language_quality' as const,
  productionGrammarEvaluatorImplemented: false as const,
});
