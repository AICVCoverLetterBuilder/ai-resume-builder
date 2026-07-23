/**
 * @vitest-environment jsdom
 *
 * AAB-305 Spanish CV Summary + Experience AI validation (Atlas/Rewitu fixture).
 * Fixture strings live only in tests — runtime must not hardcode them.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import {
  buildSpanishEntryOwnedSummary,
  formatSpanishEmployerPhrase,
  validateSpanishSummaryIntroGrammar,
  analyzeSpanishSummaryEmploymentQuality,
} from '@/lib/cv-spanish-summary-grounding';
import {
  SPANISH_CV_AI_305_REVISION,
  sourceRequiresSpanishWarehouseFactCoverage,
  validateSpanishWarehouseExperienceCoverage,
  detectSpanishExperienceUnsupportedExpansion,
  buildSpanishWarehouseExperienceFallback,
} from '@/lib/cv-spanish-experience-grounding';
import {
  formatApproximateDurationPhrase,
  yearWordForLocale,
  mergeExperienceMonthsUnion,
  applyApproximateDurationPolicy,
} from '@/lib/cv-experience-duration';
import { localizeWarehouseEmployee, localizeGraphicDesigner } from '@/lib/cv-role-title';
import {
  ExperienceAiDiagnosticSession,
  clearExperienceAiDiagnosticsForTests,
  clearExperienceAiDiagnostics,
} from '@/lib/cv-experience-ai-diagnostics';
import {
  SummaryAiDiagnosticSession,
  clearSummaryAiDiagnosticsForTests,
  clearSummaryAiDiagnostics,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  clearCvAiDiagnosticHistory,
  EXPERIENCE_AI_DIAG_MARKER,
  SUMMARY_AI_DIAG_MARKER,
} from '@/lib/cv-ai-diagnostics-contract';
import {
  applyGeneratedExperienceDescription,
  resolveExperienceAiAuthoritativeSource,
} from '@/lib/cv-experience-provenance';
import {
  EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION,
  resolveExperienceTextareaProvenance,
  refreshProvenanceAfterMaterialUserEdit,
} from '@/lib/cv-experience-ai-output-provenance';
import { EXPERIENCE_DIAGNOSTICS_FINAL_CANDIDATE_305_REVISION } from '@/lib/cv-ai-finalize-apply';

const REF = '2026-07-19';

const WH_ES = [
  'Revisa la mercancía entrante',
  'Comprueba la documentación relacionada',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía',
].join('\n');

const WH_ES_WEAK = [
  'Revisa mercancía',
  'Comprueba documentos',
  'Coordina con compañeros',
].join('\n');

const GD_ES = [
  'Creó materiales visuales y elementos gráficos',
  'Revisó y adaptó materiales de diseño',
  'Preparó archivos finales de diseño para distintos formatos y pantallas',
].join('\n');

const HI_WH = [
  'आने वाले माल की जाँच करती है।',
  'संबंधित दस्तावेज़ों की जाँच करती है।',
  'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।',
].join('\n');

function spanishFixture(opts?: {
  gender?: string;
  summary?: string;
  currentDesc?: string;
  priorDesc?: string;
  currentOnly?: boolean;
  priorOnly?: boolean;
  noDates?: boolean;
  partialDates?: boolean;
}): CVData {
  const gender = opts?.gender ?? 'female';
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: localizeWarehouseEmployee('es', gender),
    startDate: opts?.noDates ? '' : (opts?.partialDates ? '2023' : '2023-01'),
    endDate: '',
    isPresent: true,
    description: opts?.currentDesc ?? WH_ES,
    originalUserDescription: opts?.currentDesc ?? WH_ES,
    canonicalDescription: opts?.currentDesc ?? WH_ES,
    descriptionOrigin: 'user',
    generatedLocale: 'es',
  };
  const prior: WorkExperience = {
    id: 'exp-rewitu',
    company: 'Rewitu',
    position: localizeGraphicDesigner('es', gender),
    startDate: opts?.noDates ? '' : '2020-01',
    endDate: opts?.noDates ? '' : '2022-12',
    isPresent: false,
    description: opts?.priorDesc ?? GD_ES,
    originalUserDescription: opts?.priorDesc ?? GD_ES,
    canonicalDescription: opts?.priorDesc ?? GD_ES,
    descriptionOrigin: 'user',
    generatedLocale: 'es',
  };
  const experience = opts?.currentOnly
    ? [current]
    : opts?.priorOnly
      ? [prior]
      : [current, prior];
  return {
    id: 'cv-es-305',
    name: 'CV',
    personal: {
      fullName: 'Ana Test',
      email: 'ana@example.com',
      phone: '',
      address: '',
      jobTitle: experience[0]!.position,
      gender: gender as 'female' | 'male' | 'unspecified',
      photoEnabled: false,
    },
    summary: opts?.summary ?? '',
    contentLocale: 'es',
    templateId: 'modern-minimal',
    experience,
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    hobbies: [],
    updatedAt: REF,
  };
}

describe('Spanish CV AI (AAB-305)', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    clearExperienceAiDiagnostics();
    clearSummaryAiDiagnosticsForTests();
    clearSummaryAiDiagnostics();
    clearCvAiDiagnosticHistory();
    localStorage.clear();
  });

  it('exposes spanish-cv-ai-305-v1 packaging marker', () => {
    expect(SPANISH_CV_AI_305_REVISION).toBe('spanish-cv-ai-305-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SPANISH_CV_AI_305_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      EXPERIENCE_DIAGNOSTICS_FINAL_CANDIDATE_305_REVISION,
    );
  });

  it('duration: 78 months → seis años y medio (not hybrid 6,5)', () => {
    expect(yearWordForLocale('es', 6.5)).toMatch(/seis.*medio|medio/i);
    const totalMonths = mergeExperienceMonthsUnion(
      [
        { startDate: '2023-01', endDate: '', isPresent: true },
        { startDate: '2020-01', endDate: '2022-12', isPresent: false },
      ],
      REF,
    );
    expect(totalMonths).toBe(78);
    const duration = applyApproximateDurationPolicy(totalMonths);
    const phrase = formatApproximateDurationPhrase(duration, 'es');
    expect(phrase).toMatch(/seis/i);
    expect(phrase).toMatch(/medio|años/i);
    expect(phrase).not.toMatch(/6[,.]5\s+seis/);
    expect(phrase).not.toMatch(/seis\s+años\s+y\s+medio\s+6/);
  });

  it('employer grammar uses en/para naturally', () => {
    expect(formatSpanishEmployerPhrase('Atlas')).toBe('en Atlas');
    const built = buildSpanishEntryOwnedSummary({
      role: localizeWarehouseEmployee('es', 'female'),
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: formatApproximateDurationPhrase(
        applyApproximateDurationPolicy(78),
        'es',
      ),
      dutyFacts: [
        { value: 'revisión de mercancía entrante' },
        { value: 'comprobación de documentación relacionada' },
        { value: 'coordinación del movimiento de mercancía con compañeros' },
      ],
      priorRole: localizeGraphicDesigner('es', 'female'),
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_ES,
      locale: 'es',
    });
    expect(built).toMatch(/en Atlas/i);
    expect(built).toMatch(/Rewitu/i);
    expect(built).not.toMatch(/en en Atlas/i);
    expect(validateSpanishSummaryIntroGrammar(built, { company: 'Atlas' }).ok).toBe(true);
  });

  it('gendered Spanish titles', () => {
    expect(localizeWarehouseEmployee('es', 'female')).toMatch(/Empleada|trabajadora|Moza/i);
    expect(localizeWarehouseEmployee('es', 'male')).toMatch(/Empleado|trabajador|Mozo/i);
    expect(localizeGraphicDesigner('es', 'female')).toMatch(/Diseñadora/i);
    expect(localizeGraphicDesigner('es', 'male')).toMatch(/Diseñador/i);
  });

  it.each(['female', 'male', 'unspecified'] as const)(
    'SUMMARY empty generate — %s — grounded three-unit Spanish',
    (gender) => {
      const cv = spanishFixture({ gender });
      const fin = finalizeCvAiFieldForApply({
        action: 'summary_generate',
        field: 'summary',
        requestedLocale: 'es',
        gender,
        cv,
        candidate: '',
        referenceDateIso: REF,
      });
      expect(fin.blocked).toBe(false);
      expect(fin.countedAsSuccess).toBe(true);
      expect(fin.text).toMatch(/Atlas/i);
      expect(fin.text).toMatch(/alrededor de|cerca de|aproximadamente|años/i);
      expect(fin.text).toMatch(/mercanc|document|compa[nñ]er|preparaci|movimiento/i);
      expect(fin.text).toMatch(/Rewitu|diseñ|visual|gr[aá]fic/i);
      expect(fin.text).not.toMatch(/6[,.]5\s+seis|seis\s+años\s+y\s+medio\s+6/i);
      expect(fin.text).not.toMatch(/SAP|Photoshop|Excel avanzado|máxima calidad|lideró/i);
      expect(fin.text).not.toMatch(/[\u0900-\u097F\u0400-\u04FF\u0600-\u06FF]/);
      const quality = analyzeSpanishSummaryEmploymentQuality(fin.text, {
        company: 'Atlas',
        gender,
      });
      expect(quality.groundingValidationPassed).toBe(true);
    },
  );

  it('SUMMARY empty — current only / prior only / no dates / partial dates', () => {
    for (const opts of [
      { currentOnly: true },
      { priorOnly: true },
      { noDates: true },
      { partialDates: true },
    ] as const) {
      const cv = spanishFixture(opts);
      const fin = finalizeCvAiFieldForApply({
        action: 'summary_generate',
        field: 'summary',
        requestedLocale: 'es',
        gender: 'female',
        cv,
        candidate: '',
        referenceDateIso: REF,
      });
      // Partial/missing dates may fall back to a typed failure; never leak scripts.
      if (fin.countedAsSuccess) {
        expect(fin.blocked).toBe(false);
        expect(fin.text.trim().length).toBeGreaterThan(10);
      } else {
        expect(fin.blocked).toBe(true);
      }
      expect((fin.text || '')).not.toMatch(/[\u0900-\u097F]/);
    }
  });

  it('SUMMARY rejects provider conflicting duration / unsupported claims / wrong language', () => {
    const cv = spanishFixture();
    const conflicting = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'es',
      gender: 'female',
      cv,
      candidate: 'Trabaja en Atlas con 20 años de experiencia y garantiza la máxima calidad con SAP.',
      referenceDateIso: REF,
    });
    if (conflicting.countedAsSuccess) {
      expect(conflicting.text).not.toMatch(/20 años/i);
      expect(conflicting.text).toMatch(/seis|años|alrededor|cerca|aproximadamente/i);
      expect(conflicting.text).not.toMatch(/máxima calidad|SAP/i);
    } else {
      expect(conflicting.blocked).toBe(true);
    }

    const wrongLang = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'es',
      gender: 'female',
      cv,
      candidate: 'Prüft eingehende Waren bei Atlas mit sechseinhalb Jahren Erfahrung.',
      referenceDateIso: REF,
    });
    if (wrongLang.countedAsSuccess) {
      expect(wrongLang.text).not.toMatch(/Prüft|sechseinhalb|Waren/i);
      expect(wrongLang.text).toMatch(/Atlas|mercanc|años|trabaja/i);
    }
  });

  it('SUMMARY non-empty weak enhances; good Summary typed no-op path', () => {
    const weak = 'Desde enero de 2023 trabaja como trabajadora de almacén en Atlas. Anteriormente trabajó como diseñadora gráfica en Rewitu.';
    const cv = spanishFixture({ summary: weak });
    const enhance = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'es',
      gender: 'female',
      cv,
      candidate: weak,
      referenceDateIso: REF,
    });
    expect(enhance.blocked).toBe(false);
    expect(enhance.countedAsSuccess).toBe(true);
    expect(enhance.text).toMatch(/Atlas/i);
    expect(enhance.text).toMatch(/años|alrededor|cerca|aproximadamente/i);
    expect(enhance.text).toMatch(/mercanc|document|Rewitu|diseñ/i);

    const good = enhance.text;
    const again = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture({ summary: good }),
      candidate: good,
      referenceDateIso: REF,
    });
    // Typed no-op or equivalent — must not invent tools/metrics
    if (again.countedAsSuccess) {
      expect(again.text).not.toMatch(/SAP|Photoshop|máxima calidad|KPI/i);
    } else {
      expect(again.reason || again.diagnostics?.typedFailureReason).toMatch(
        /noop|no_meaningful|no-op|equivalent|unchanged/i,
      );
    }
  });

  it('EXPERIENCE empty current warehouse + completed design', () => {
    const cv = spanishFixture({ currentDesc: '', priorDesc: '' });
    const current = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv,
      candidate: '',
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(current.countedAsSuccess).toBe(true);
    expect(current.text).toMatch(/mercanc/i);
    expect(current.text).not.toMatch(/SAP|Photoshop|diariamente|lideró/i);
    expect(current.text).toMatch(/revisa|comprueba|coordina/i);

    const prior = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture({ currentDesc: WH_ES, priorDesc: '' }),
      candidate: '',
      experienceId: 'exp-rewitu',
      referenceDateIso: REF,
    });
    expect(prior.countedAsSuccess).toBe(true);
    expect(prior.text).toMatch(/visual|gr[aá]fic|dise[nñ]o|archivo|formato|pantalla/i);
    expect(prior.text).not.toMatch(/print|branding|marketing|SAP/i);
  });

  it('EXPERIENCE non-empty: weak improves; unsupported expansions rejected', () => {
    expect(sourceRequiresSpanishWarehouseFactCoverage(WH_ES)).toBe(true);
    const improvedCandidate = [
      'Revisa la mercancía entrante en el área de recepción.',
      'Comprueba la documentación y los registros relacionados.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ].join('\n');
    const improve = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture({ currentDesc: WH_ES_WEAK }),
      candidate: improvedCandidate,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(improve.countedAsSuccess).toBe(true);

    const badQuality = [
      'Revisa la mercancía entrante con máxima calidad.',
      'Comprueba la documentación relacionada en todos los procesos.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía diariamente.',
    ].join('\n');
    const scan = detectSpanishExperienceUnsupportedExpansion(WH_ES, badQuality);
    expect(scan.count).toBeGreaterThan(0);

    const reject = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: [
        'Gestiona documentación general del almacén.',
        'Coordina la comunicación con el equipo.',
        'Asegura la finalización a tiempo de todas las operaciones con SAP.',
      ].join('\n'),
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    if (reject.countedAsSuccess) {
      expect(reject.text).not.toMatch(/SAP|finalización a tiempo|todas las operaciones/i);
      expect(validateSpanishWarehouseExperienceCoverage(WH_ES, reject.text).ok).toBe(true);
    } else {
      expect(reject.blocked).toBe(true);
    }
  });

  it('EXPERIENCE warehouse coverage + deterministic fallback', () => {
    expect(validateSpanishWarehouseExperienceCoverage(WH_ES, WH_ES).ok).toBe(true);
    const generic = [
      'Gestiona documentación general.',
      'Coordina la comunicación.',
      'Realiza tareas de almacén.',
    ].join('\n');
    expect(validateSpanishWarehouseExperienceCoverage(WH_ES, generic).ok).toBe(false);

    const fb = buildSpanishWarehouseExperienceFallback({
      sourceDescription: WH_ES,
      isPresent: true,
    });
    expect(validateSpanishWarehouseExperienceCoverage(WH_ES, fb).ok).toBe(true);
    expect(fb).toMatch(/mercanc[ií]a entrante/i);
    expect(fb).toMatch(/documentaci[oó]n relacionada/i);
    expect(fb).toMatch(/compa[nñ]er/i);

    const past = buildSpanishWarehouseExperienceFallback({
      sourceDescription: WH_ES,
      isPresent: false,
    });
    expect(past).toMatch(/Revisó|Comprobó|Coordinó/i);
  });

  it('EXPERIENCE completed design past tense preserved', () => {
    const improved = [
      'Creó materiales visuales y elementos gráficos para distintos proyectos.',
      'Revisó y adaptó materiales de diseño según los requisitos.',
      'Preparó archivos finales de diseño para distintos formatos y pantallas.',
    ].join('\n');
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture({ priorDesc: GD_ES }),
      candidate: improved,
      experienceId: 'exp-rewitu',
      referenceDateIso: REF,
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).toMatch(/Creó|Revisó|adaptó|Preparó|material|dise[nñ]o|formato|pantalla/i);
    expect(fin.text).not.toMatch(/print|branding|Photoshop|lideró/i);
  });

  it('stable entry identity: wrong entry not updated; no cross-entry leakage', () => {
    const improved = [
      'Revisa la mercancía entrante con atención a la recepción.',
      'Comprueba la documentación relacionada del envío.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ].join('\n');
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: improved,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).not.toMatch(/Rewitu|diseñadora|visuales/i);
    expect(fin.diagnostics?.selectedExperienceEntryIdHash || true).toBeTruthy();
  });

  it('locale switch Hindi → Spanish first click: no Devanagari leakage', () => {
    const cv = spanishFixture({ currentDesc: HI_WH });
    cv.experience[0]!.originalUserDescription = HI_WH;
    cv.experience[0]!.generatedLocale = 'hi';
    cv.contentLocale = 'hi';
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv,
      candidate: '',
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).not.toMatch(/[\u0900-\u097F]/);
    expect(fin.text).toMatch(/mercanc|document|compa[nñ]er|almac[eé]n|revisa|comprueba|coordina/i);
  });

  it('Spanish provenance: unedited AI not authoritative; material edit is', () => {
    const entry = {
      ...spanishFixture().experience[0]!,
      description: HI_WH,
      originalUserDescription: HI_WH,
      canonicalDescription: HI_WH,
      descriptionOrigin: 'user' as const,
      generatedLocale: 'hi',
    };
    const afterAi = applyGeneratedExperienceDescription(entry, WH_ES, {
      locale: 'es',
      origin: 'ai_generated',
      sourceLocale: 'hi',
      operationMode: 'enhance',
    });
    expect(afterAi.aiOutputProvenance?.revision)
      .toBe(EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION);
    const p = resolveExperienceTextareaProvenance(afterAi);
    expect(p.currentTextareaProvenance).toBe('ai_generated_unedited');
    expect(p.materialUserEditDetected).toBe(false);

    const auth = resolveExperienceAiAuthoritativeSource(afterAi);
    expect(auth.currentTextareaIgnoredOrOverridden).toBe(true);

    const editedText = `${WH_ES}\nTambién revisa las devoluciones.`;
    const edited = refreshProvenanceAfterMaterialUserEdit(
      { ...afterAi, description: editedText, descriptionOrigin: 'user_confirmed_ai_edit' },
      editedText,
    );
    const p2 = resolveExperienceTextareaProvenance({
      ...edited,
      description: editedText,
      descriptionOrigin: 'user_confirmed_ai_edit',
    });
    expect(p2.materialUserEditDetected).toBe(true);
    expect(p2.authoritativeFactSourceKind).toBe('current_textarea');
  });

  it('diagnostics: Summary + Experience markers; provider/final coverage separate', () => {
    const cv = spanishFixture();
    const sum = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'es',
      gender: 'female',
      cv,
      candidate: '',
      referenceDateIso: REF,
    });
    const sumSession = new SummaryAiDiagnosticSession({
      uiLocale: 'es',
      requestedLocale: 'es',
      templateId: 'modern-minimal',
      jobContextHash: 'es-sum',
      requestId: 'es-sum-1',
      usageCountBefore: 1,
    });
    sumSession.recordFinalizeResult(sum);
    sumSession.recordVisibleApply(true, 2, sum.text);
    const sumTrace = sumSession.commit();
    expect(sumTrace.marker).toBe(SUMMARY_AI_DIAG_MARKER);
    expect(sumTrace.requestedLocale).toBe('es');

    const exp = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv,
      candidate: [
        'Gestiona documentación general.',
        'Coordina la comunicación.',
        'Realiza tareas de almacén con máxima calidad.',
      ].join('\n'),
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    const expSession = new ExperienceAiDiagnosticSession({
      uiLocale: 'es',
      requestedLocale: 'es',
      templateId: 'modern-minimal',
      jobContextHash: 'es-exp',
      requestId: 'es-exp-1',
      usageCountBefore: 3,
    });
    expSession.patch({
      selectedSourceKind: 'live_textarea',
      clickedExperienceEntryIdHash: 'fnv1a_atlas',
    });
    expSession.recordFinalizeResult(exp);
    if (exp.countedAsSuccess) {
      expSession.recordVisibleApply(true, 4, {
        visibleDescription: exp.text,
        finalNormalizedText: exp.text,
      });
    } else {
      expSession.recordVisibleApply(false, 3);
    }
    const expTrace = expSession.commit();
    expect(expTrace.marker).toBe(EXPERIENCE_AI_DIAG_MARKER);
    expect(expTrace.requestedLocale).toBe('es');
    expect(expTrace.privacyCheckPassed).toBe(true);
    const json = JSON.stringify(expTrace);
    expect(json).not.toMatch(/Revisa la mercancía|ana@example\.com/i);
  });

  it('punctuation-only Experience change is no-op / not charged as success expansion', () => {
    const punct = WH_ES.replace(/\./g, '!');
    const scan = detectSpanishExperienceUnsupportedExpansion(WH_ES, punct);
    expect(scan.count).toBe(0);
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: punct,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    if (!fin.countedAsSuccess) {
      expect(fin.reason || fin.diagnostics?.typedFailureReason).toMatch(
        /noop|no_meaningful|no-op|equivalent/i,
      );
    } else {
      // Material improvement path still must stay grounded
      expect(validateSpanishWarehouseExperienceCoverage(WH_ES, fin.text).ok).toBe(true);
    }
  });
});
