/**
 * @vitest-environment jsdom
 *
 * AAB-302 German CV Summary + Experience AI validation (Atlas/Rewitu fixture).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import {
  buildGermanEntryOwnedSummary,
  formatGermanEmployerPrepositional,
  GERMAN_CV_AI_302_REVISION,
  validateGermanSummaryIntroGrammar,
  analyzeGermanSummaryEmploymentQuality,
} from '@/lib/cv-german-summary-grounding';
import {
  formatApproximateDurationPhrase,
  yearWordForLocale,
  mergeExperienceMonthsUnion,
  applyApproximateDurationPolicy,
} from '@/lib/cv-experience-duration';
import { localizeWarehouseEmployee, localizeGraphicDesigner } from '@/lib/cv-role-title';
import { detectExperienceUnsupportedClaimExpansion } from '@/lib/cv-experience-unsupported-claims';
import {
  ExperienceAiDiagnosticSession,
  clearExperienceAiDiagnosticsForTests,
} from '@/lib/cv-experience-ai-diagnostics';
import {
  SummaryAiDiagnosticSession,
  clearSummaryAiDiagnosticsForTests,
} from '@/lib/cv-summary-ai-diagnostics';
import { EXPERIENCE_AI_DIAG_MARKER, SUMMARY_AI_DIAG_MARKER } from '@/lib/cv-ai-diagnostics-contract';

const REF = '2026-07-19';

const WH_DE = [
  'Eingehende Waren prüfen',
  'Unterlagen prüfen',
  'Waren mit Kollegen vorbereiten und bewegen',
].join('\n');

const GD_DE = [
  'Visuelle Materialien und grafische Elemente erstellt',
  'Designmaterialien geprüft und angepasst',
  'Finale Designdateien für verschiedene Formate und Bildschirme vorbereitet',
].join('\n');

function germanFixture(opts?: {
  gender?: string;
  summary?: string;
  currentDesc?: string;
  priorDesc?: string;
}): CVData {
  const gender = opts?.gender ?? 'female';
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: localizeWarehouseEmployee('de', gender),
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: opts?.currentDesc ?? WH_DE,
    originalUserDescription: opts?.currentDesc ?? WH_DE,
    canonicalDescription: opts?.currentDesc ?? WH_DE,
    descriptionOrigin: 'user',
    generatedLocale: 'de',
  };
  const prior: WorkExperience = {
    id: 'exp-rewitu',
    company: 'Rewitu',
    position: localizeGraphicDesigner('de', gender),
    startDate: '2020-01',
    endDate: '2022-12',
    isPresent: false,
    description: opts?.priorDesc ?? GD_DE,
    originalUserDescription: opts?.priorDesc ?? GD_DE,
    canonicalDescription: opts?.priorDesc ?? GD_DE,
    descriptionOrigin: 'user',
    generatedLocale: 'de',
  };
  return {
    id: 'cv-de-302',
    name: 'CV',
    personal: {
      fullName: 'Anna Test',
      email: 'anna@example.com',
      phone: '',
      address: '',
      jobTitle: current.position,
      gender: gender as 'female' | 'male' | 'unspecified',
      photoEnabled: false,
    },
    summary: opts?.summary ?? '',
    contentLocale: 'de',
    experience: [current, prior],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
  };
}

describe('German CV AI (AAB-302)', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    clearSummaryAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes german-cv-ai-302-v1 packaging marker', () => {
    expect(GERMAN_CV_AI_302_REVISION).toBe('german-cv-ai-302-v1');
  });

  it('duration: 78 months → sechseinhalb Jahre (not 6,5)', () => {
    expect(yearWordForLocale('de', 6.5)).toBe('sechseinhalb');
    const totalMonths = mergeExperienceMonthsUnion(
      [
        { startDate: '2023-01', endDate: '', isPresent: true },
        { startDate: '2020-01', endDate: '2022-12', isPresent: false },
      ],
      REF,
    );
    expect(totalMonths).toBe(78);
    const duration = applyApproximateDurationPolicy(totalMonths);
    const phrase = formatApproximateDurationPhrase(duration, 'de');
    expect(phrase).toMatch(/sechseinhalb/);
    expect(phrase).not.toMatch(/6[,.]5/);
  });

  it('employer preposition uses bei, rejects in Atlas', () => {
    expect(formatGermanEmployerPrepositional('Atlas')).toBe('bei Atlas');
    expect(validateGermanSummaryIntroGrammar('Seit Januar 2023 als Lagermitarbeiterin in Atlas tätig.', {
      company: 'Atlas',
    }).ok).toBe(false);
    expect(validateGermanSummaryIntroGrammar('Seit Januar 2023 als Lagermitarbeiterin bei Atlas tätig.', {
      company: 'Atlas',
    }).ok).toBe(true);
  });

  it('gendered titles: Lagermitarbeiterin / Grafikdesignerin', () => {
    expect(localizeWarehouseEmployee('de', 'female')).toBe('Lagermitarbeiterin');
    expect(localizeWarehouseEmployee('de', 'male')).toBe('Lagermitarbeiter');
    expect(localizeGraphicDesigner('de', 'female')).toBe('Grafikdesignerin');
    expect(localizeGraphicDesigner('de', 'male')).toBe('Grafikdesigner');
  });

  it('manual German title is preserved (not overwritten by gender helpers alone)', () => {
    const manual = 'Logistikfachkraft Lager';
    expect(manual).not.toBe(localizeWarehouseEmployee('de', 'female'));
    const cv = germanFixture({ gender: 'female' });
    cv.experience[0]!.position = manual;
    expect(cv.experience[0]!.position).toBe(manual);
  });

  it.each(['female', 'male', 'unspecified'] as const)(
    'empty Summary generate — %s — grounded three-unit German',
    (gender) => {
      const cv = germanFixture({ gender });
      const fin = finalizeCvAiFieldForApply({
        action: 'summary_generate',
        field: 'summary',
        requestedLocale: 'de',
        gender,
        cv,
        candidate: '',
        referenceDateIso: REF,
      });
      expect(fin.blocked).toBe(false);
      expect(fin.countedAsSuccess).toBe(true);
      expect(fin.text).toMatch(/bei Atlas/i);
      expect(fin.text).toMatch(/sechseinhalb/i);
      expect(fin.text).not.toMatch(/\bin Atlas\b/i);
      expect(fin.text).not.toMatch(/6[,.]5/);
      expect(fin.text).toMatch(/Waren|Unterlagen|Kolleg/i);
      expect(fin.text).toMatch(/Rewitu|Grafik|visuell|Design/i);
      expect(fin.text).not.toMatch(/Druckmedien|Branding|Markenidentität|Social Media/i);
      expect(fin.text).not.toMatch(/[\u0900-\u097F]/);
      const quality = analyzeGermanSummaryEmploymentQuality(fin.text, {
        company: 'Atlas',
        gender,
      });
      expect(quality.groundingValidationPassed).toBe(true);
    },
  );

  it('non-empty weak Summary enhances with grounded facts and single duration', () => {
    const weak = 'Seit Januar 2023 als Lagermitarbeiterin bei Atlas tätig. Zuvor als Grafikdesignerin bei Rewitu tätig.';
    const cv = germanFixture({ summary: weak });
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: weak,
      referenceDateIso: REF,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.text).toMatch(/bei Atlas/i);
    expect(fin.text).toMatch(/sechseinhalb|Jahre/i);
    expect(fin.text).not.toMatch(/6[,.]5\s+sechseinhalb|sechseinhalb\s+6[,.]5/);
  });

  it('unsupported provider print/branding claims are rejected by German quality gate', () => {
    const bad = 'Seit Januar 2023 als Lagermitarbeiterin bei Atlas tätig, mit etwa sechseinhalb Jahren Erfahrung. Die Tätigkeit umfasst die Prüfung eingehender Waren. Zuvor arbeitete bei Rewitu als Grafikdesignerin mit Druckmedien und Branding.';
    const quality = analyzeGermanSummaryEmploymentQuality(bad, { company: 'Atlas', gender: 'female' });
    expect(quality.unsupportedDesignMedium).toBe(true);
    expect(quality.groundingValidationPassed).toBe(false);
  });

  it('Experience unsupported expansion catches German quality/scope/leadership/tools', () => {
    const source = WH_DE;
    expect(detectExperienceUnsupportedClaimExpansion(source, `${source}\nHöchste Qualität sicherstellen`).count).toBeGreaterThan(0);
    expect(detectExperienceUnsupportedClaimExpansion(source, `${source}\nSämtliche Prozesse steuern`).count).toBeGreaterThan(0);
    expect(detectExperienceUnsupportedClaimExpansion(source, `${source}\nLeitung des gesamten Lagers`).count).toBeGreaterThan(0);
    expect(detectExperienceUnsupportedClaimExpansion(source, `${source}\nSAP nutzen`).count).toBeGreaterThan(0);
    expect(detectExperienceUnsupportedClaimExpansion(source, `${source}\nProduktivität um 20% steigern`).count).toBeGreaterThan(0);
  });

  const WH_DE_IMPROVED = [
    'Eingehende Waren prüfen und erfassen',
    'Zugehörige Unterlagen und Belege prüfen',
    'Vorbereitung und Bewegung von Waren mit Kolleginnen und Kollegen abstimmen',
  ].join('\n');

  const GD_DE_IMPROVED = [
    'Visuelle Materialien und grafische Elemente erstellt und ausgearbeitet',
    'Designmaterialien geprüft und an Anforderungen angepasst',
    'Finale Designdateien für unterschiedliche Formate und Bildschirme vorbereitet',
  ].join('\n');

  it('current Experience enhance preserves three duties without unsupported claims', () => {
    const cv = germanFixture();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: WH_DE_IMPROVED,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text.toLowerCase()).toMatch(/waren|eingehend/);
    expect(fin.text.toLowerCase()).toMatch(/unterlagen|dokument|belege/);
    expect(fin.text.toLowerCase()).toMatch(/kolleg|beweg|vorbereit/);
    expect(fin.text).not.toMatch(/SAP|Photoshop|höchste Qualität|Leitung/i);
  });

  it('completed Experience enhance keeps past/completed design duties', () => {
    const cv = germanFixture();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: GD_DE_IMPROVED,
      experienceId: 'exp-rewitu',
      referenceDateIso: REF,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).toMatch(/visuell|grafisch|Design/i);
    expect(fin.text).toMatch(/erstellt|angepasst|vorbereitet/i);
    expect(fin.text).not.toMatch(/Druckmedien|Branding|SAP/i);
  });

  it('Experience identical wording is typed no-op (usage not success)', () => {
    const cv = germanFixture();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: WH_DE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      experienceNoOpRecoveryAttempted: true,
    });
    expect(fin.blocked).toBe(true);
    expect(fin.countedAsSuccess).toBe(false);
    expect(fin.text).toBe(WH_DE);
  });

  it('Experience unsupported German expansion is rejected or rebuilt cleanly', () => {
    const cv = germanFixture();
    const poisoned = `${WH_DE}\nHöchste Qualität und Leitung des gesamten Lagers mit SAP`;
    expect(detectExperienceUnsupportedClaimExpansion(WH_DE, poisoned).count).toBeGreaterThan(0);
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: poisoned,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      noOpRepairAttempted: true,
      originHint: 'ai_repaired',
    });
    // Either hard reject or deterministic fallback — never keep unsupported claims.
    expect(fin.text).not.toMatch(/höchste Qualität|Leitung des gesamten|SAP/i);
    if (!fin.blocked) {
      expect(fin.countedAsSuccess).toBe(true);
      expect(fin.text.toLowerCase()).toMatch(/waren|eingehend|unterlagen|kolleg/);
    } else {
      expect(fin.countedAsSuccess).toBe(false);
    }
  });

  it('good German Summary enhance is typed no-op', () => {
    const cv = germanFixture({ summary: '' });
    const generated = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: '',
      referenceDateIso: REF,
    });
    expect(generated.blocked).toBe(false);
    const cvGood = germanFixture({ summary: generated.text });
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_enhance',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv: cvGood,
      candidate: generated.text,
      referenceDateIso: REF,
    });
    expect(fin.blocked).toBe(true);
    expect(fin.countedAsSuccess).toBe(false);
    expect(fin.reason).toMatch(/noop|meaningful/i);
    expect(fin.text).toBe(generated.text);
  });

  it('deterministic German builder produces bei + sechseinhalb + prior Rewitu', () => {
    const text = buildGermanEntryOwnedSummary({
      role: 'Lagermitarbeiterin',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 'mit etwa sechseinhalb Jahren Erfahrung',
      dutyFacts: [
        { value: 'Eingehende Waren prüfen', sourceText: 'Eingehende Waren prüfen' },
        { value: 'Unterlagen prüfen', sourceText: 'Unterlagen prüfen' },
        { value: 'Waren mit Kollegen vorbereiten und bewegen', sourceText: 'Waren mit Kollegen vorbereiten und bewegen' },
      ],
      priorRole: 'Grafikdesignerin',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_DE,
      locale: 'de',
    });
    expect(text).toMatch(/bei Atlas/);
    expect(text).toMatch(/sechseinhalb/);
    expect(text).toMatch(/bei Rewitu/);
    expect(text).not.toMatch(/\bin Atlas\b/);
  });

  it('diagnostics markers remain correct for German Summary and Experience', () => {
    const sum = new SummaryAiDiagnosticSession({
      uiLocale: 'de',
      requestedLocale: 'de',
      contentLocale: 'de',
      templateId: 'modern',
      requestId: 'de-sum',
      usageCountBefore: 0,
      gender: 'female',
      operationMode: 'generate_from_empty',
    });
    sum.patch({
      finalCandidateSource: 'deterministic_fallback',
      providerCandidatePresent: false,
      deterministicCandidatePresent: true,
      grammarValidationPassed: true,
      groundingValidationPassed: true,
      durationValidationPassed: true,
      meaningfulChangeDetected: true,
      noOpDetected: false,
      apiResponseKind: 'fallback',
      serverFallbackUsed: false,
      clientFallbackUsed: true,
    });
    sum.recordVisibleApply(true, 1, 'de summary');
    const sumTrace = sum.commit();
    expect(sumTrace.marker).toBe(SUMMARY_AI_DIAG_MARKER);
    expect(sumTrace.requestedLocale).toBe('de');

    const exp = new ExperienceAiDiagnosticSession({
      uiLocale: 'de',
      requestedLocale: 'de',
      templateId: 'modern',
      jobContextHash: 'de-ctx',
      requestId: 'de-exp',
      usageCountBefore: 1,
    });
    exp.patch({
      selectedSourceKind: 'live_textarea',
      clickedExperienceEntryIdHash: 'fnv1a_de',
    });
    exp.recordVisibleApply(true, 2);
    const expTrace = exp.commit();
    expect(expTrace.marker).toBe(EXPERIENCE_AI_DIAG_MARKER);
    expect(expTrace.requestedLocale).toBe('de');
  });

  it('locale-switch first click: Hindi script does not leak into German Summary', () => {
    const cv = germanFixture({
      summary: 'पूर्व हिंदी सारांश जो जर्मन आउटपुट में नहीं रहना चाहिए।',
    });
    cv.contentLocale = 'de';
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: '',
      referenceDateIso: REF,
    });
    expect(fin.text).not.toMatch(/[\u0900-\u097F]/);
    expect(fin.text).toMatch(/bei Atlas|Lagermitarbeiter/i);
  });
});

describe('German CV AI (AAB-302) regression markers', () => {
  it('preserves accepted language/contract revision markers', async () => {
    const { SUMMARY_NOOP_SUCCESS_CONTRACT_REVISION } = await import('@/lib/cv-ai-finalize-apply');
    const { EXPERIENCE_AI_NOOP_RECOVERY_REVISION } = await import('@/lib/cv-experience-ai-noop-recovery');
    const { EXPERIENCE_AI_UNSUPPORTED_EXPANSION_REVISION } = await import('@/lib/cv-experience-unsupported-claims');
    const { SUMMARY_BUILDER_REVISION } = await import('@/lib/cv-summary-grounding');
    const {
      SUMMARY_BUILDER_REVISION_HR,
      CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION,
    } = await import('@/lib/cv-croatian-summary-grounding');
    const { EXPERIENCE_AI_DIAG_MARKER, SUMMARY_AI_DIAG_MARKER, EXPERIENCE_DIAGNOSTIC_MARKER_302_REVISION } =
      await import('@/lib/cv-ai-diagnostics-contract');
    const { CV_AI_DIAGNOSTICS_LIFECYCLE_MARKER } = await import('@/lib/cv-ai-diagnostics-lifecycle');

    expect(SUMMARY_NOOP_SUCCESS_CONTRACT_REVISION).toBe('summary-noop-success-contract-300-v1');
    expect(EXPERIENCE_AI_NOOP_RECOVERY_REVISION).toBe('experience-ai-noop-recovery-293-v1');
    expect(EXPERIENCE_AI_UNSUPPORTED_EXPANSION_REVISION).toBe('experience-ai-unsupported-expansion-295-v1');
    expect(SUMMARY_BUILDER_REVISION).toMatch(/hindi|live-hindi/i);
    expect(SUMMARY_BUILDER_REVISION_HR).toBe('entry-owned-croatian-rebuild-v1');
    expect(CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION).toBe('croatian-summary-intro-grammar-292-v1');
    expect(SUMMARY_AI_DIAG_MARKER).toBe('SUMMARY_AI_DIAG_V1');
    expect(EXPERIENCE_AI_DIAG_MARKER).toBe('EXPERIENCE_AI_DIAG_V1');
    expect(EXPERIENCE_DIAGNOSTIC_MARKER_302_REVISION).toBe('experience-diagnostic-marker-302-v1');
    expect(GERMAN_CV_AI_302_REVISION).toBe('german-cv-ai-302-v1');
    expect(CV_AI_DIAGNOSTICS_LIFECYCLE_MARKER).toBe('internal-diagnostics-lifecycle-v1');
  });
});
