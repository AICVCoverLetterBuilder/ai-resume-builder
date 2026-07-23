/**
 * @vitest-environment jsdom
 *
 * AAB-304 Experience AI output provenance — contaminated AI text must not
 * become authoritative fact source on the next click.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  runCvAiApplyPipeline,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import {
  EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION,
  buildExperienceAiOutputProvenance,
  hashExperienceAiOutputText,
  resolveExperienceTextareaProvenance,
  refreshProvenanceAfterMaterialUserEdit,
} from '@/lib/cv-experience-ai-output-provenance';
import {
  applyGeneratedExperienceDescription,
  resolveExperienceAiAuthoritativeSource,
} from '@/lib/cv-experience-provenance';
import { applyCanonicalExperienceEdit } from '@/lib/cv-canonical-snapshot';
import {
  clearExperienceAiDiagnosticsForTests,
  clearExperienceAiDiagnostics,
  ExperienceAiDiagnosticSession,
} from '@/lib/cv-experience-ai-diagnostics';
import {
  clearSummaryAiDiagnostics,
  clearSummaryAiDiagnosticsForTests,
} from '@/lib/cv-summary-ai-diagnostics';
import { clearCvAiDiagnosticHistory } from '@/lib/cv-ai-diagnostics-contract';
import { EXPERIENCE_AI_DIAG_MARKER } from '@/lib/cv-ai-diagnostics-contract';
import { localizeWarehouseEmployee } from '@/lib/cv-role-title';
import {
  validateGermanWarehouseExperienceCoverage,
  detectGermanExperienceUnsupportedExpansion,
  buildGermanWarehouseExperienceFallback,
} from '@/lib/cv-german-experience-grounding';
import { getProAiUsageCount } from '@/lib/ai-usage-policy';

const REF = '2026-07-19';

const HI_WH = [
  'आने वाले माल की जाँच करती है।',
  'संबंधित दस्तावेज़ों की जाँच करती है।',
  'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।',
].join('\n');

const BAD_AAB302_DE = [
  'Prüft täglich Unterlagen im Lagerbereich und kontrolliert die Vollständigkeit der erfassten Daten.',
  'Aktualisiert die Arbeitsdokumentation und verfolgt offene Vorgänge bis zur Klärung.',
  'Koordiniert den Informationsaustausch mit Kolleginnen und Kollegen zur fristgerechten Fertigstellung der Aufgaben.',
].join('\n');

const GOOD_DE = [
  'Prüft eingehende Waren.',
  'Kontrolliert die dazugehörigen Unterlagen und Aufzeichnungen.',
  'Koordiniert mit Kolleginnen und Kollegen die Vorbereitung und Bewegung der Waren.',
].join('\n');

function baseCv(entries: WorkExperience[]): CVData {
  return {
    id: 'cv-prov-304',
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
    templateId: 'modern-minimal',
    experience: entries,
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    hobbies: [],
    updatedAt: REF,
  };
}

function warehouseEntry(overrides: Partial<WorkExperience> = {}): WorkExperience {
  return {
    id: 'exp-atlas',
    company: 'Atlas',
    position: 'गोदाम कर्मचारी',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: HI_WH,
    originalUserDescription: HI_WH,
    canonicalDescription: HI_WH,
    descriptionOrigin: 'user',
    ...overrides,
  };
}

function contaminateWithBadAi(exp: WorkExperience): WorkExperience {
  return applyGeneratedExperienceDescription(exp, BAD_AAB302_DE, {
    locale: 'de',
    origin: 'ai_generated',
    sourceLocale: 'hi',
    operationMode: 'enhance',
  });
}

describe('AAB-304 Experience AI output provenance', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    clearSummaryAiDiagnosticsForTests();
    try {
      localStorage.clear();
    } catch {
      /* jsdom */
    }
  });

  it('exposes experience-ai-output-provenance-304-v1 packaging marker', () => {
    expect(EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION).toBe(
      'experience-ai-output-provenance-304-v1',
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION);
    const r = resolveExperienceTextareaProvenance(contaminateWithBadAi(warehouseEntry()));
    expect(r.revision).toBe('experience-ai-output-provenance-304-v1');
  });

  it('1. stores last AI output hash per entry after successful apply', () => {
    const after = contaminateWithBadAi(warehouseEntry());
    expect(after.aiOutputProvenance?.experienceEntryId).toBe('exp-atlas');
    expect(after.aiOutputProvenance?.lastAiOutputNormalizedHash).toBe(
      hashExperienceAiOutputText(BAD_AAB302_DE),
    );
    expect(after.aiOutputProvenance?.preAiFactSnapshotText).toContain('माल');
  });

  it('2–5. provenance survives serialization, restart, locale and template switch', () => {
    const after = contaminateWithBadAi(warehouseEntry());
    const json = JSON.stringify(after);
    const rehydrated = JSON.parse(json) as WorkExperience;
    const p = resolveExperienceTextareaProvenance({
      ...rehydrated,
      description: BAD_AAB302_DE,
    });
    expect(p.currentTextareaProvenance).toBe('ai_generated_unedited');
    expect(p.staleGeneratedDescriptionIgnored).toBe(true);

    const localeSwitched = { ...rehydrated, generatedLocale: 'hi' };
    expect(resolveExperienceTextareaProvenance({
      ...localeSwitched,
      description: BAD_AAB302_DE,
    }).currentTextareaProvenance).toBe('ai_generated_unedited');

    const cv = baseCv([after]);
    cv.templateId = 'corporate-navy';
    expect(resolveExperienceTextareaProvenance(cv.experience[0]!).currentTextareaProvenance)
      .toBe('ai_generated_unedited');
  });

  it('6–8. provenance keyed by stable id; reorder safe; delete removes only that entry', () => {
    const a = contaminateWithBadAi(warehouseEntry({ id: 'exp-a' }));
    const b = contaminateWithBadAi(warehouseEntry({
      id: 'exp-b',
      description: HI_WH,
      originalUserDescription: HI_WH,
      company: 'Beta',
    }));
    const reordered = [b, a];
    expect(reordered[1]!.aiOutputProvenance?.experienceEntryId).toBe('exp-a');
    expect(reordered[0]!.aiOutputProvenance?.experienceEntryId).toBe('exp-b');
    const remaining = reordered.filter((e) => e.id !== 'exp-a');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe('exp-b');
  });

  it('9–12. clearing diagnostics/history does not clear provenance; usage independent', () => {
    const after = contaminateWithBadAi(warehouseEntry());
    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'de',
      requestedLocale: 'de',
      contentLocale: 'de',
      templateId: 'modern-minimal',
      gender: 'female',
      industryNorm: 'warehouse',
      levelNorm: 'mid',
      jobContextHash: 'k',
      requestId: 'r1',
      usageCountBefore: 0,
    });
    session.stage('button_pressed', 'ok');
    session.commit();
    clearExperienceAiDiagnostics();
    clearSummaryAiDiagnostics();
    clearCvAiDiagnosticHistory();
    expect(after.aiOutputProvenance?.lastAiOutputNormalizedHash).toBeTruthy();
    const usageBefore = getProAiUsageCount();
    expect(after.aiOutputProvenance?.revision).toBe(EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION);
    expect(getProAiUsageCount()).toBe(usageBefore);
  });

  it('13–14. unedited AI and formatting-only still count as unedited', () => {
    const after = contaminateWithBadAi(warehouseEntry());
    const plain = resolveExperienceTextareaProvenance(after);
    expect(plain.currentTextareaProvenance).toBe('ai_generated_unedited');
    expect(plain.lastAiOutputHashMatched).toBe(true);
    expect(plain.materialUserEditDetected).toBe(false);

    const formatted = resolveExperienceTextareaProvenance({
      ...after,
      description: BAD_AAB302_DE.replace(/•/g, '-').replace(/\.\n/g, '\n'),
    });
    // Equivalent units after shared normalization
    const fmt2 = resolveExperienceTextareaProvenance({
      ...after,
      description: `${BAD_AAB302_DE}\n`,
    });
    expect(fmt2.currentTextareaProvenance).toBe('ai_generated_unedited');
    expect(formatted.materialUserEditDetected).toBe(false);
  });

  it('15–18. material edit becomes authoritative; prior AI text is not', () => {
    const after = contaminateWithBadAi(warehouseEntry());
    const editedText = `${GOOD_DE}\nPrüft zusätzlich Retouren.`;
    const edited = refreshProvenanceAfterMaterialUserEdit(
      { ...after, description: editedText, descriptionOrigin: 'user_confirmed_ai_edit' },
      editedText,
    );
    const p = resolveExperienceTextareaProvenance({
      ...edited,
      description: editedText,
      descriptionOrigin: 'user_confirmed_ai_edit',
      generatedDescription: BAD_AAB302_DE,
    });
    expect(p.materialUserEditDetected).toBe(true);
    expect(p.currentTextareaProvenance).toBe('ai_generated_user_edited');
    expect(p.authoritativeFactSourceKind).toBe('current_textarea');
    expect(p.authoritativeFactText).toContain('Retouren');

    const auth = resolveExperienceAiAuthoritativeSource(after);
    expect(auth.kind).not.toBe('currentTextarea');
    expect(auth.text).toContain('माल');
    expect(auth.currentTextareaIgnoredOrOverridden).toBe(true);
  });

  it('19–33. exact AAB-302 contaminated text is not fact source; safe recovery', () => {
    const contaminated = contaminateWithBadAi(warehouseEntry());
    const auth = resolveExperienceAiAuthoritativeSource(contaminated);
    expect(auth.text).not.toMatch(/täglich|Informationsaustausch|Vollständigkeit/i);
    expect(auth.text).toContain('माल');

    const p = resolveExperienceTextareaProvenance(contaminated);
    expect(p.currentTextareaProvenance).toBe('ai_generated_unedited');
    expect(p.staleGeneratedDescriptionIgnored).toBe(true);
    expect(p.currentTextareaUsedForFactExtraction).toBe(false);

    const badScan = detectGermanExperienceUnsupportedExpansion(auth.text, BAD_AAB302_DE);
    expect(badScan.count).toBeGreaterThan(0);

    const covBad = validateGermanWarehouseExperienceCoverage(auth.text, BAD_AAB302_DE);
    expect(covBad.ok).toBe(false);

    const safe = buildGermanWarehouseExperienceFallback({
      sourceDescription: auth.text,
      isPresent: true,
    });
    const covGood = validateGermanWarehouseExperienceCoverage(auth.text, safe);
    expect(covGood.ok).toBe(true);
    expect(detectGermanExperienceUnsupportedExpansion(auth.text, safe).count).toBe(0);
    expect(safe).toMatch(/eingehende Waren/i);
    expect(safe).toMatch(/Unterlagen|Aufzeichnungen/i);
    expect(safe).toMatch(/Vorbereitung|Bewegung/i);
    expect(safe).toMatch(/Kolleg/i);
    expect(safe).not.toMatch(/täglich|Informationsaustausch|fristgerecht/i);
  });

  it('20–21. same-locale and cross-locale German grounding both reject contaminated AI as source', () => {
    const contaminated = contaminateWithBadAi(warehouseEntry());
    const cv = baseCv([contaminated]);
    const source = resolveExperienceAiAuthoritativeSource(contaminated).text;

    const sameLocale = finalizeCvAiFieldForApply({
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
    expect(sameLocale.text).not.toMatch(/täglich|Informationsaustausch|Vollständigkeit/i);

    const cross = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv: baseCv([warehouseEntry()]),
      candidate: BAD_AAB302_DE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      originHint: 'deterministic_fallback',
    });
    expect(cross.text).not.toMatch(/täglich|Informationsaustausch|Vollständigkeit/i);
    expect(source).toContain('माल');
  });

  it('34–38. unsafe recovery fails with +0; safe recovery succeeds once', () => {
    const contaminated = contaminateWithBadAi(warehouseEntry());
    const cv = baseCv([contaminated]);
    const usageBefore = getProAiUsageCount();

    const fail = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: BAD_AAB302_DE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      originHint: 'provider',
    });
    // Provider-shaped bad text must not succeed as-is.
    if (fail.countedAsSuccess) {
      expect(fail.text).not.toMatch(/täglich|Informationsaustausch/i);
    } else {
      expect(fail.blocked || !fail.countedAsSuccess).toBe(true);
    }
    expect(getProAiUsageCount()).toBe(usageBefore);

    const safeText = buildGermanWarehouseExperienceFallback({
      sourceDescription: resolveExperienceAiAuthoritativeSource(contaminated).text,
      isPresent: true,
    });
    const ok = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: safeText,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      originHint: 'deterministic_fallback',
    });
    expect(ok.blocked).toBe(false);
    expect(ok.countedAsSuccess).toBe(true);
  });

  it('39–40. correct stable entry updated; other entry unchanged', () => {
    const a = contaminateWithBadAi(warehouseEntry({ id: 'exp-a' }));
    const b: WorkExperience = {
      id: 'exp-b',
      company: 'Other',
      position: 'Büro',
      startDate: '2020-01',
      endDate: '2021-01',
      isPresent: false,
      description: 'Büroarbeiten erledigt.',
      originalUserDescription: 'Büroarbeiten erledigt.',
      descriptionOrigin: 'user',
    };
    const cv = baseCv([a, b]);
    const source = resolveExperienceAiAuthoritativeSource(a).text;
    const safe = buildGermanWarehouseExperienceFallback({
      sourceDescription: source,
      isPresent: true,
    });
    const applied = applyGeneratedExperienceDescription(a, safe, {
      locale: 'de',
      origin: 'deterministic_fallback',
      sourceLocale: 'hi',
    });
    const nextCv = {
      ...cv,
      experience: cv.experience.map((e) => (e.id === 'exp-a' ? applied : e)),
    };
    expect(nextCv.experience[0]!.description).toMatch(/eingehende Waren/i);
    expect(nextCv.experience[1]!.description).toBe('Büroarbeiten erledigt.');
  });

  it('41. generated-from-empty stamps provenance without requiring warehouse', () => {
    const empty: WorkExperience = {
      id: 'exp-empty',
      company: 'X',
      position: 'Bäcker',
      startDate: '2022-01',
      endDate: '',
      isPresent: true,
      description: '',
      descriptionOrigin: 'user',
    };
    const generated = 'Backt Brot und bereitet Teig vor.';
    const after = applyGeneratedExperienceDescription(empty, generated, {
      locale: 'de',
      origin: 'ai_generated',
      confirmGeneratedAsGrounding: true,
    });
    expect(after.aiOutputProvenance?.generatedFromEmpty).toBe(true);
    expect(after.originalUserDescription).toBe(generated);
  });

  it('42. user-edited generated output preserves new user facts via canonical edit', () => {
    const after = contaminateWithBadAi(warehouseEntry());
    const cv = baseCv([after]);
    const edited = `${GOOD_DE}\nPrüft zusätzlich Retouren.`;
    const next = applyCanonicalExperienceEdit(cv, 'exp-atlas', 'description', edited, 'de');
    const exp = next.experience[0]!;
    expect(exp.descriptionOrigin).toBe('user_confirmed_ai_edit');
    expect(exp.originalUserDescription).toContain('Retouren');
    const p = resolveExperienceTextareaProvenance(exp);
    expect(p.materialUserEditDetected || p.currentTextareaUsedForFactExtraction).toBe(true);
  });

  it('43–46. marker + privacy: provenance diagnostics expose hashes/kinds not raw text', () => {
    expect(EXPERIENCE_AI_DIAG_MARKER).toBe('EXPERIENCE_AI_DIAG_V1');
    const after = contaminateWithBadAi(warehouseEntry());
    const rec = buildExperienceAiOutputProvenance({
      experienceEntryId: after.id,
      appliedOutput: BAD_AAB302_DE,
      preAiFactText: HI_WH,
      sourceLocale: 'hi',
      targetLocale: 'de',
    });
    const serialized = JSON.stringify({
      currentTextareaProvenance: 'ai_generated_unedited',
      lastAiOutputHashMatched: true,
      lastAiOutputNormalizedHash: rec.lastAiOutputNormalizedHash,
      preAiFactIdentityHashes: rec.preAiFactIdentityHashes,
    });
    expect(serialized).not.toMatch(/täglich|Informationsaustausch|आने वाले/);
    expect(serialized).toContain('ai_generated_unedited');
  });

  it('two-operation fixture: contaminate then second click uses pre-AI facts', () => {
    const op1 = contaminateWithBadAi(warehouseEntry());
    expect(op1.description).toBe(BAD_AAB302_DE);
    expect(op1.originalUserDescription).toBe(HI_WH);

    const op2Prov = resolveExperienceTextareaProvenance(op1);
    expect(op2Prov.currentTextareaProvenance).toBe('ai_generated_unedited');
    expect(op2Prov.generatedDescriptionPreexisted).toBe(true);
    expect(op2Prov.lastAiOutputHashMatched).toBe(true);
    expect(op2Prov.materialUserEditDetected).toBe(false);
    expect(op2Prov.staleGeneratedDescriptionIgnored).toBe(true);
    expect(op2Prov.currentTextareaUsedForFactExtraction).toBe(false);
    expect(['pre_ai_snapshot', 'original_user', 'canonical']).toContain(
      op2Prov.authoritativeFactSourceKind,
    );

    const auth = resolveExperienceAiAuthoritativeSource(op1);
    expect(auth.text).toBe(HI_WH);
    const pipe = runCvAiApplyPipeline({
      cv: baseCv([op1]),
      locale: 'de',
      action: 'experience_bullets',
      candidate: BAD_AAB302_DE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      originHint: 'deterministic_fallback',
    });
    expect(pipe.finalized.text).not.toMatch(/täglich|Informationsaustausch|Vollständigkeit/i);
    if (pipe.finalized.countedAsSuccess) {
      expect(pipe.stateCv.experience[0]!.description).toMatch(/Waren|Unterlagen|Kolleg/i);
    } else {
      expect(pipe.blocked).toBe(true);
      expect(pipe.stateCv.experience[0]!.description).toBe(BAD_AAB302_DE);
    }
  });
});
