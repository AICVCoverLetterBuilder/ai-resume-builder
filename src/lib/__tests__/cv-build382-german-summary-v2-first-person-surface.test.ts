/**
 * AAB-382 — German Summary V2 first-person surface grammar.
 * Device: AAB 381 applied despite duration fragment, Ich + third-person
 * dash duties (Führt/Prüft/Tauscht), prior-role person mismatch, and
 * "sowie vorgenommene Änderungen" coordination — while grammar flags stayed true.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import {
  SummaryAiDiagnosticSession,
  resolveAuthoritativeVisibleSummaryText,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  validateGermanGeneratedCaseGrammar,
  GERMAN_SUMMARY_V2_FIRST_PERSON_SURFACE_382_REVISION as GRAMMAR_382,
} from '@/lib/cv-german-summary-current-duty-coverage';
import {
  setSummaryV2EnabledForTests,
  SUMMARY_V2_REVISION,
  buildGermanSummaryV2FromManifest,
  bulletToGermanWoIchClause,
  GERMAN_SUMMARY_V2_FIRST_PERSON_SURFACE_382_REVISION,
  buildSummaryV2ManifestForCv,
} from '@/lib/cv-summary-v2';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';

const REF = '2026-07-01';

const WH_DE = [
  'prüft eingehende Waren',
  'prüft Dokumentation zu erhaltenen Waren',
  'koordiniert mit Kolleginnen die Vorbereitung und Bewegung der Waren',
].join('\n');

const GD_DE = [
  'erstellte visuelle Materialien und grafische Elemente',
  'überprüfte und passte Designmaterialien an',
  'bereitete finale Designdateien für Formate und Bildschirme vor',
].join('\n');

/** Exact device-shaped bad surface from AAB 381 (two-entry). */
const DEVICE_BAD_DE = [
  'mit etwa fünfeinhalb Jahren Erfahrung.',
  'Ich arbeite derzeit als Lagermitarbeiterin bei Atlas — Führt Wareneingangskontrollen durch; Prüft Begleitdokumente; Tauscht Informationen mit Kolleginnen aus.',
  'Zuvor arbeitete ich als Grafikdesignerin bei Rewitu — Führt Designabstimmungen durch; Prüft Layouts; sowie vorgenommene Änderungen.',
].join(' ');

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function twoEntryEmptyGermanCv(options?: {
  currentRole?: string;
  priorRole?: string;
  currentDuties?: string;
  priorDuties?: string;
}): CVData {
  return {
    id: 'aab-382-de-v2-surface',
    name: 'DE V2 Surface',
    personal: {
      fullName: 'Anna Beispiel',
      email: 'a@example.com',
      phone: '',
      address: '',
      jobTitle: options?.currentRole || 'Lagermitarbeiterin',
      gender: 'female',
    },
    summary: '',
    experience: [
      {
        id: 'atlas',
        position: options?.currentRole || 'Lagermitarbeiterin',
        company: 'Atlas',
        startDate: '2021-01',
        endDate: '',
        isPresent: true,
        description: options?.currentDuties || WH_DE,
        canonicalDescription: options?.currentDuties || WH_DE,
      },
      {
        id: 'rewitu',
        position: options?.priorRole || 'Grafikdesignerin',
        company: 'Rewitu',
        startDate: '2018-01',
        endDate: '2020-12',
        isPresent: false,
        description: options?.priorDuties || GD_DE,
        canonicalDescription: options?.priorDuties || GD_DE,
      },
    ],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    templateId: 'modern',
    contentLocale: 'de',
  } as CVData;
}

describe('AAB-382 German Summary V2 first-person surface grammar', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    seedUsage(11);
  });
  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('exports 382 revision markers', () => {
    expect(GERMAN_SUMMARY_V2_FIRST_PERSON_SURFACE_382_REVISION).toBe(
      'german-summary-v2-first-person-surface-382-v1',
    );
    expect(GRAMMAR_382).toBe(GERMAN_SUMMARY_V2_FIRST_PERSON_SURFACE_382_REVISION);
  });

  it('rejects exact device-bad text in final and visible grammar diagnostics', () => {
    const badGrammar = validateGermanGeneratedCaseGrammar(DEVICE_BAD_DE);
    expect(badGrammar.germanControlledCaseGrammarPassed).toBe(false);
    expect(badGrammar.failureKinds).toEqual(
      expect.arrayContaining([
        'duration_sentence_fragment',
        'standalone_capitalized_third_person_verb',
      ]),
    );

    const cv = twoEntryEmptyGermanCv();
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: DEVICE_BAD_DE,
      referenceDateIso: REF,
      durationSnapshot: duration,
    });

    // Provider/device-shaped bad text must not commit with grammar=true.
    // Either blocked on grammar, or repaired/fallback to good first-person text.
    if (fin.blocked) {
      expect(fin.diagnostics?.grammarValidationPassed).toBe(false);
      expect(fin.diagnostics?.germanControlledCaseGrammarPassed).toBe(false);
      expect(fin.diagnostics?.finalGermanGrammarValidationPassed).toBe(false);
    } else {
      expect(fin.diagnostics?.grammarValidationPassed).toBe(true);
      expect(fin.diagnostics?.germanControlledCaseGrammarPassed).toBe(true);
      expect(fin.diagnostics?.finalGermanGrammarValidationPassed).toBe(true);
      expect(fin.text).toMatch(/^Ich verfüge über/u);
      expect(fin.text).toMatch(/wo ich/u);
      expect(fin.text).not.toMatch(/—\s*(?:Führt|Prüft|Tauscht)\b/u);
      expect(fin.text).not.toMatch(/^mit etwa .+ Erfahrung\./u);
    }

    // Visible path: feeding the bad text must flip visible grammar false.
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'de',
      requestedLocale: 'de',
      contentLocale: 'de',
      templateId: 'modern',
      gender: 'female',
      requestId: 'aab-382-device-bad-visible',
      usageCountBefore: 11,
      operationMode: 'generate_from_context',
    });
    // Seed finalize diagnostics as if a bad candidate were temporarily written.
    session.recordFinalizeResult({
      blocked: false,
      countedAsSuccess: true,
      text: DEVICE_BAD_DE,
      origin: 'ai_generated',
      roleDutyConflict: false,
      diagnostics: {
        summaryBuilderRevision: SUMMARY_V2_REVISION,
        finalNormalizedHash: 'bad',
        finalValidatedCandidateHash: 'bad',
        requiredCurrentDutyFactIds: ['v2_entry_a', 'v2_entry_b', 'v2_entry_c'],
        requiredCurrentDutyFactCount: 3,
        coveredCurrentDutyFactCount: 3,
        requiredPriorDutyFactCount: 3,
        coveredPriorDutyFactCount: 3,
        germanControlledCaseGrammarPassed: true, // stale wrong pre-write claim
        finalGermanGrammarValidationPassed: true,
        grammarValidationPassed: true,
        finalDurationScopeValidationPassed: true,
        finalPerspectiveMode: 'first_person',
      } as never,
    });
    session.recordVisibleApply(true, 11, DEVICE_BAD_DE);
    expect(session.draft.visibleGermanGrammarValidationPassed).toBe(false);
    expect(session.visibleApplySucceeded).toBe(false);
  });

  it('two-entry empty Summary: complete first-person sentences, grammar true, usage +1', () => {
    const cv = twoEntryEmptyGermanCv();
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: '',
      referenceDateIso: REF,
      durationSnapshot: duration,
    });

    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.summaryBuilderRevision).toBe(SUMMARY_V2_REVISION);
    expect(fin.text).toMatch(/^Ich verfüge über (?:insgesamt )?etwa .+ Jahre Berufserfahrung\./u);
    expect(fin.text).toMatch(/\b(?:Derzeit arbeite ich|Ich arbeite derzeit)\b/u);
    expect(fin.text).toMatch(/\bwo ich\b/u);
    expect(fin.text).toMatch(/\bZuvor arbeitete ich\b/u);
    expect(fin.text).not.toMatch(/[\u2014\u2013]\s*\p{Lu}/u);
    expect(fin.text).not.toMatch(/\b(?:Führt|Prüft|Tauscht)\b/u);
    expect(fin.text).not.toMatch(/^mit etwa .+ Erfahrung\./u);
    expect(fin.diagnostics?.grammarValidationPassed).toBe(true);
    expect(fin.diagnostics?.germanControlledCaseGrammarPassed).toBe(true);
    expect(fin.diagnostics?.finalGermanGrammarValidationPassed).toBe(true);

    const written = applyFinalizedSummaryToCv(cv, 'de', fin);
    const visibleText = resolveAuthoritativeVisibleSummaryText({
      operationOwnedSummary: written.summary,
      staleReactSummary: '',
    });
    const before = getProAiUsageCount();
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'de',
      requestedLocale: 'de',
      contentLocale: 'de',
      templateId: 'modern',
      gender: 'female',
      requestId: 'aab-382-de-good',
      usageCountBefore: before,
      operationMode: 'generate_from_context',
    });
    session.recordFinalizeResult(fin);
    expect(session.evaluatePreApplyDecisionGates().passed).toBe(true);
    session.recordVisibleApply(true, before, visibleText);
    expect(session.visibleApplySucceeded).toBe(true);
    expect(session.draft.visibleGermanGrammarValidationPassed).toBe(true);
    expect(session.draft.visibleSummaryMatchesFinalHash).toBe(true);
    recordProAiUserActionSuccess();
    session.patch({ usageCountAfter: before + 1 });
    const trace = session.commit();
    expect(trace.usageCountAfter).toBe(12);
    expect(getProAiUsageCount()).toBe(12);
  });

  it('converts present/past, separable and irregular German duty verbs to wo-ich clauses', () => {
    expect(bulletToGermanWoIchClause('prüft eingehende Waren', 'present'))
      .toMatch(/eingehende Waren prüfe/i);
    expect(bulletToGermanWoIchClause('führt Wareneingangskontrollen durch', 'present'))
      .toMatch(/Wareneingangskontrollen durchführe/i);
    expect(bulletToGermanWoIchClause('spricht mit Kundinnen', 'present'))
      .toMatch(/mit Kundinnen spreche/i);
    expect(bulletToGermanWoIchClause('nimmt Anrufe entgegen', 'present'))
      .toMatch(/Anrufe entgegennehme/i);
    expect(bulletToGermanWoIchClause('erstellte visuelle Materialien', 'past'))
      .toMatch(/visuelle Materialien erstellte/i);
    expect(bulletToGermanWoIchClause('passte Designmaterialien an', 'past'))
      .toMatch(/Designmaterialien anpasste/i);
    expect(bulletToGermanWoIchClause('bereitete finale Dateien vor', 'past'))
      .toMatch(/finale Dateien vorbereitete/i);
    expect(bulletToGermanWoIchClause('überprüfte und passte Designmaterialien an', 'past'))
      .toMatch(/Designmaterialien überprüfte und anpasste/i);
  });

  it('supports arbitrary German occupations with first-person surface', () => {
    const cv = twoEntryEmptyGermanCv({
      currentRole: 'Zahnarzthelferin',
      priorRole: 'Rezeptionistin',
      currentDuties: [
        'bereitet Behandlungsräume vor',
        'nimmt Patientinnen entgegen',
        'führt Terminkalender',
      ].join('\n'),
      priorDuties: [
        'begrüßte Gäste',
        'nahm Anrufe entgegen',
        'verwaltete Reservierungen',
      ].join('\n'),
    });
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: '',
      referenceDateIso: REF,
      durationSnapshot: duration,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.text).toMatch(/Zahnarzthelferin/i);
    expect(fin.text).toMatch(/Rezeptionistin/i);
    expect(fin.text).toMatch(/\b(?:Derzeit arbeite ich|Ich arbeite derzeit)\b/u);
    expect(fin.text).toMatch(/\bwo ich\b/u);
    expect(fin.text).not.toMatch(/[\u2014\u2013]/u);
    expect(fin.diagnostics?.grammarValidationPassed).toBe(true);
    expect(validateGermanGeneratedCaseGrammar(fin.text).germanControlledCaseGrammarPassed)
      .toBe(true);
  });

  it('manifest builder emits complete first-person German without dash tails', () => {
    const cv = twoEntryEmptyGermanCv();
    const manifest = buildSummaryV2ManifestForCv({
      cv,
      locale: 'de',
      gender: 'female',
      referenceDateIso: REF,
    });
    const text = buildGermanSummaryV2FromManifest(manifest);
    expect(text).toMatch(/^Ich verfüge über/u);
    expect(text).toMatch(/wo ich .+ prüfe/iu);
    expect(text).toMatch(/wo ich .+ erstellte|vorbereitete|anpasste/iu);
    expect(text).not.toMatch(/[\u2014\u2013]/u);
    expect(validateGermanGeneratedCaseGrammar(text).germanControlledCaseGrammarPassed).toBe(true);
  });

  it('still allows safe Stronger enrichment adjectives without grammar reject', () => {
    const good = [
      'Ich verfüge über etwa fünfeinhalb Jahre Berufserfahrung.',
      'Ich arbeite derzeit als Lagermitarbeiterin bei Atlas, wo ich eingehende Waren prüfe,',
      'Dokumentation zu erhaltenen Waren prüfe und mit Kolleginnen die Vorbereitung und Bewegung der Waren koordiniere.',
      'Zuvor arbeitete ich als Grafikdesignerin bei Rewitu, wo ich visuelle Materialien und grafische Elemente erstellte.',
      'Als professionelle, kompetente und serviceorientierte Fachkraft arbeite ich zuverlässig.',
    ].join(' ');
    const g = validateGermanGeneratedCaseGrammar(good);
    expect(g.germanControlledCaseGrammarPassed).toBe(true);
    expect(g.failureKinds).toEqual([]);
  });
});
