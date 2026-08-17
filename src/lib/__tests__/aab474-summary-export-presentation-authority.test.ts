import { describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  normalizeExperienceBulletsForQuality,
  recoverExperiencePresentationFromSource,
} from '@/lib/cv-content-quality';
import { classifyBulletScript } from '@/lib/cv-export-diagnostics';
import { captureSummaryV2Snapshot } from '@/lib/cv-summary-v2/snapshot';
import { buildSummaryV2SelectionManifest } from '@/lib/cv-summary-v2/manifest';
import { hashExperienceSourceLocaleText } from '@/lib/cv-experience-source-locale';
import { resolveExperiencePresentationSnapshot } from '@/lib/cv-experience-localized-surfaces';

const hindiFacts = [
  'मुद्रित और डिजिटल सामग्री के लिए ग्राफिक सामग्री तैयार करती थी।',
  'ग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।',
  'डिज़ाइन परियोजनाओं की समीक्षा करती थी और अंतिम परिणामों की गुणवत्ता की जाँच करती थी।',
].join('\n');

const serbianVisible = [
  'Izrađivala sam grafičke materijale za štampane i digitalne medije.',
  'Razvijala sam vizuelne dizajnerske koncepte prema potrebama klijenata.',
  'Pregledala sam dizajnerske projekte i proveravala kvalitet završnih rezultata.',
].join('\n');

function experience(id: string, isPresent: boolean, description = serbianVisible): WorkExperience {
  return {
    id,
    position: 'Grafička dizajnerica',
    company: id,
    startDate: isPresent ? '2024-01' : '2021-01',
    endDate: isPresent ? '' : '2023-12',
    isPresent,
    description,
    originalUserDescription: hindiFacts,
    canonicalDescription: hindiFacts,
    descriptionOrigin: 'ai_generated',
    generatedDescription: description,
    generatedLocale: 'sr',
    descriptionSourceLocale: 'sr',
    descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(description),
  };
}

function fixture(): CVData {
  return {
    id: 'aab474',
    name: 'AAB474',
    personal: { fullName: 'Test', email: 't@example.com', phone: '1', address: 'X', jobTitle: 'Grafička dizajnerica', gender: 'female', photoEnabled: false },
    summary: '',
    contentLocale: 'sr',
    summaryOrigin: 'deterministic_fallback',
    summaryGeneratedLocale: 'sr',
    experience: [
      experience('current', true),
      experience('testwerk', false),
      experience('rewitu', false),
      experience('omitted-warehouse', false, 'Održavala sam evidenciju zaliha i pripremala otpremu robe.'),
    ],
    education: [], skills: [], certifications: [], languages: [],
    templateId: 'modern-minimal', region: 'EU',
    createdAt: '2026-08-17T00:00:00.000Z', updatedAt: '2026-08-17T00:00:00.000Z',
  };
}

function sameEntryEnglishExperience(description = '• x'): WorkExperience {
  const canonical = [
    'Prepared and served a wide variety of cocktails, spirits, and beverages.',
    'Maintained a clean and organised bar area and hygiene/safety standards.',
    'Provided attentive customer service and built rapport with guests.',
    'Managed stock levels, assisted with inventory counts, and communicated supply needs to management.',
  ].join('\n');
  return {
    id: 'same-entry-recovery', position: 'Bartender', company: 'Atelje Bar',
    startDate: '2024-01', endDate: '', isPresent: true, description,
    originalUserDescription: canonical, canonicalDescription: canonical,
    descriptionOrigin: 'ai_generated', generatedDescription: description,
    generatedLocale: 'en', descriptionSourceLocale: 'en',
    descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(description),
  };
}

describe('AAB474 Summary export and Experience presentation authority', () => {
  it('keeps a valid current Serbian textarea intact and never index-splices Hindi grounding into it', () => {
    const result = normalizeExperienceBulletsForQuality(experience('testwerk', false), 'sr', 'female');
    expect(result.description).toBe(serbianVisible);
    expect(result.description).not.toContain('ग्राफिक');
    expect(result.changed).toBe(false);
  });

  it('fails closed for an explicitly stale cross-locale visible Experience surface', () => {
    const stale = experience('testwerk', false, 'Izrađivala sam grafičke materijale.');
    stale.generatedLocale = 'hr';
    stale.descriptionSourceLocale = 'hr';
    stale.descriptionSourceLocaleTextHash = hashExperienceSourceLocaleText(stale.description);
    const result = normalizeExperienceBulletsForQuality(stale, 'sr', 'female');
    expect(result).toEqual({ description: '', changed: true });
  });

  it('uses the same entry-owned presentation contract for preview/export and records fail-closed stale provenance', () => {
    const cv = fixture();
    cv.experience[1] = experience('testwerk', false, 'Izrađivala sam grafičke materijale.');
    cv.experience[1].generatedLocale = 'hr';
    cv.experience[1].descriptionSourceLocale = 'hr';
    cv.experience[1].descriptionSourceLocaleTextHash = hashExperienceSourceLocaleText(cv.experience[1].description);
    const snapshot = resolveExperiencePresentationSnapshot({ cv, targetLocale: 'sr' });
    expect(snapshot.ok).toBe(false);
    expect(snapshot.cv.experience[0].description).toBe(serbianVisible);
    expect(snapshot.cv.experience[1].description).toBe('');
    expect(snapshot.records[1]).toMatchObject({
      targetLocale: 'sr', projectionRequired: true,
      presentationAuthority: 'unresolved', sourceLanguageLeakageDetected: false,
    });
  });

  it('uses only the Summary V2 current + two selected priors as export fact authority', () => {
    const manifest = buildSummaryV2SelectionManifest(captureSummaryV2Snapshot({
      cv: fixture(), locale: 'sr', gender: 'female', referenceDateIso: '2026-08-17',
    }));
    expect(manifest.current?.entryId).toBe('current');
    expect(manifest.priors.map((entry) => entry.entryId)).toEqual(['testwerk', 'rewitu']);
    expect([...manifest.requiredCurrentFacts, ...manifest.requiredPriorFacts]
      .map((fact) => fact.entryId)).not.toContain('omitted-warehouse');
  });

  it('labels Serbian Latin bullets as Latin script rather than English', () => {
    expect(classifyBulletScript(serbianVisible, 'sr')).toBe('latin');
  });

  it('recovers a placeholder from the same entry only and records a complete target surface', () => {
    const exp = sameEntryEnglishExperience();
    const recovered = recoverExperiencePresentationFromSource(exp, 'sr', 'female');
    expect(recovered.recoveryKind).toBe('same_entry_semantic_recovery');
    expect(recovered.rejectionReason).toBeNull();
    expect(recovered.description).toMatch(/Priprema|Održava|Pruža|Upravlja/);
    expect(recovered.description).not.toBe('• x');
  });

  it('uses same-entry recovery in the shared snapshot and keeps final/selected hashes equal', () => {
    const exp = sameEntryEnglishExperience();
    const cv = { ...fixture(), experience: [exp] };
    const snapshot = resolveExperiencePresentationSnapshot({ cv, targetLocale: 'sr' });
    expect(snapshot.ok).toBe(true);
    expect(snapshot.records[0]).toMatchObject({
      presentationAuthority: 'same_entry_semantic_recovery',
      recoveryAttempted: true,
      recoveryKind: 'same_entry_semantic_recovery',
      selectedPresentationHash: expect.any(String),
      finalPresentationHash: expect.any(String),
      factCoveragePassed: true,
      requiredFactCount: 4,
      coveredFactCount: 4,
      missingFactCount: 0,
    });
    expect(snapshot.records[0].finalPresentationHash)
      .toBe(snapshot.records[0].selectedPresentationHash);
  });

  it('does not recover an unsupported foreign surface and fails closed rather than leaking it', () => {
    const exp = sameEntryEnglishExperience('• 維持された外国語の職務シェル');
    exp.originalUserDescription = '外国語の職務シェルを維持しました。';
    exp.canonicalDescription = exp.originalUserDescription;
    exp.generatedLocale = 'ja';
    exp.descriptionSourceLocale = 'ja';
    const snapshot = resolveExperiencePresentationSnapshot({
      cv: { ...fixture(), experience: [exp] }, targetLocale: 'sr',
    });
    expect(snapshot.ok).toBe(false);
    expect(snapshot.cv.experience[0].description).toBe('');
    expect(snapshot.records[0]).toMatchObject({
      presentationAuthority: 'unresolved',
      rejectionReason: expect.any(String),
    });
  });
});
