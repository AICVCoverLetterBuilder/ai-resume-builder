/**
 * AAB-319 Phase 1 — German Summary competency grounding.
 * Exact AAB-318 bad Kernkompetenzen fixture + explicit-skill controls.
 */
import { describe, expect, it } from 'vitest';
import {
  GERMAN_SUMMARY_COMPETENCY_GROUNDING_319_REVISION,
  SUMMARY_EXPLICIT_SKILL_AUTHORITY_319_REVISION,
  analyzeGermanSummaryDurationScope,
  analyzeGermanSummaryEmploymentQuality,
  buildGermanEntryOwnedSummary,
  buildSummaryExplicitSkillAuthority,
  extractGermanSummaryCompetencyClaims,
  scanGermanSummaryCompetencyClaims,
  splitGermanCompetencyListItems,
  stripGermanUnsupportedCompetencyUnits,
} from '@/lib/cv-german-summary-grounding';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import type { CVData } from '@/lib/types';

const REF = '2026-07-19';

const BAD_AAB318_DE = [
  'Lagermitarbeiterin bei Atlas seit Januar 2023, zuständig für die Prüfung',
  'eingehender Waren und der zugehörigen Dokumentation sowie die Koordination mit',
  'Kollegen bei der Vorbereitung und dem Transport von Waren, mit etwa',
  'sechseinhalb Jahren Erfahrung. Zuvor war sie als Grafikdesignerin bei Rewitu',
  'tätig, wo sie visuelle Materialien erstellte, Designunterlagen überarbeitete und',
  'finale Dateien für verschiedene Formate aufbereitete. Zu ihren Kernkompetenzen',
  'zählen Führung, Organisation, kritisches Denken, Anpassungsfähigkeit,',
  'Problemlösung, Zeitmanagement, emotionale Intelligenz, Detailgenauigkeit,',
  'Kommunikation sowie Agile/Scrum.',
].join(' ');

const WH_DE = [
  'Prüft eingehende Waren',
  'Prüft die zugehörige Dokumentation',
  'Koordiniert mit Kollegen die Vorbereitung und Bewegung von Waren',
].join('\n');

const GD_DE = [
  'Erstellt visuelle Materialien und Grafiken',
  'Überarbeitet und passt Designunterlagen an',
  'Bereitet finale Designdateien für Formate und Bildschirme vor',
].join('\n');

function germanFixture(overrides: {
  summary?: string;
  gender?: string;
  skills?: string[];
} = {}): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Lagermitarbeiterin',
      gender: overrides.gender || 'female',
    },
    summary: overrides.summary ?? '',
    experience: [
      {
        id: 'atlas',
        position: 'Lagermitarbeiterin',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_DE,
        canonicalDescription: WH_DE,
      },
      {
        id: 'rewitu',
        position: 'Grafikdesignerin',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2022-12',
        isPresent: false,
        description: GD_DE,
        canonicalDescription: GD_DE,
      },
    ],
    education: [],
    skills: (overrides.skills || []).map((name) => ({ name })),
    languages: [],
    contentLocale: 'de',
  } as CVData;
}

describe('AAB-319 German Summary competency grounding', () => {
  it('revision markers are reachable', () => {
    expect(GERMAN_SUMMARY_COMPETENCY_GROUNDING_319_REVISION).toBe(
      'german-summary-competency-grounding-319-v1',
    );
    expect(SUMMARY_EXPLICIT_SKILL_AUTHORITY_319_REVISION).toBe(
      'summary-explicit-skill-authority-319-v1',
    );
  });

  it('splits comma/sowie competency lists into individual claim units', () => {
    const sentence = 'Zu ihren Kernkompetenzen zählen Führung, Organisation, kritisches Denken, Anpassungsfähigkeit, Problemlösung, Zeitmanagement, emotionale Intelligenz, Detailgenauigkeit, Kommunikation sowie Agile/Scrum.';
    const items = splitGermanCompetencyListItems(sentence);
    expect(items.length).toBeGreaterThanOrEqual(10);
    expect(items.some((i) => /Führung/i.test(i))).toBe(true);
    expect(items.some((i) => /Agile\s*\/\s*Scrum/i.test(i))).toBe(true);

    const claims = extractGermanSummaryCompetencyClaims(sentence);
    const nonBlock = claims.filter((c) => c.kind !== 'competency_block');
    expect(nonBlock.length).toBeGreaterThanOrEqual(10);
  });

  it('exact AAB-318 bad fixture: provider competency scan rejects', () => {
    const scan = scanGermanSummaryCompetencyClaims(BAD_AAB318_DE, { structuredSkills: [] });
    expect(scan.unsupportedCompetencyCount).toBeGreaterThanOrEqual(10);
    expect(scan.unsupportedMethodologyCount).toBeGreaterThanOrEqual(1);
    expect(scan.unsupportedLeadershipCount).toBeGreaterThanOrEqual(1);
    expect(scan.unsupportedCompetencyKinds).toContain('unsupported_competency_claim');
    expect(scan.unsupportedCompetencyKinds).toContain('unsupported_soft_skill_claim');
    expect(scan.unsupportedCompetencyKinds).toContain('unsupported_methodology_claim');
    expect(scan.unsupportedCompetencyKinds).toContain('unsupported_leadership_claim');
    expect(scan.providerRejectionStage).toBe('competency_grounding_validation');
    expect(scan.competencyInferenceFromRoleForbidden).toBe(true);

    const quality = analyzeGermanSummaryEmploymentQuality(BAD_AAB318_DE, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      currentEntryDuties: WH_DE,
      priorEntryDuties: GD_DE,
      priorCompany: 'Rewitu',
      gender: 'female',
      structuredSkills: [],
    });
    expect(quality.groundingValidationPassed).toBe(false);
    expect(quality.unsupportedClaimCount).toBeGreaterThanOrEqual(10);
    expect(quality.typedRejectionReason).toMatch(/competency_grounding/);
  });

  it('strip removes whole Kernkompetenzen unit without word-stripping', () => {
    const stripped = stripGermanUnsupportedCompetencyUnits(BAD_AAB318_DE);
    expect(stripped).not.toMatch(/Kernkompetenzen|Führung|Agile\/Scrum/i);
    expect(stripped).toMatch(/Atlas/);
    expect(stripped).toMatch(/Rewitu/);
    expect(stripped).not.toMatch(/zählen\s*,/);
  });

  it('CONTROL A — explicit Kommunikation may be retained', () => {
    const text = 'Zu ihren Kernkompetenzen zählen Kommunikation.';
    const scan = scanGermanSummaryCompetencyClaims(text, {
      structuredSkills: ['Kommunikation'],
    });
    expect(scan.unsupportedCompetencyCount).toBe(0);
  });

  it('CONTROL B — explicit Scrum may be retained; does not authorize Agile alone', () => {
    const scrumOk = scanGermanSummaryCompetencyClaims(
      'Sie nutzt Scrum in Projekten.',
      { structuredSkills: ['Scrum'] },
    );
    expect(scrumOk.unsupportedMethodologyCount).toBe(0);

    const expanded = scanGermanSummaryCompetencyClaims(
      'Zu den Kompetenzen zählen Agile/Scrum und Kanban.',
      { structuredSkills: ['Scrum'] },
    );
    expect(expanded.unsupportedMethodologyCount).toBeGreaterThanOrEqual(1);
  });

  it('CONTROL C — explicit Führung may be retained without team-size expansion', () => {
    const ok = scanGermanSummaryCompetencyClaims(
      'Zu ihren Stärken zählt Führung.',
      { structuredSkills: ['Führung'] },
    );
    expect(ok.unsupportedLeadershipCount).toBe(0);
  });

  it('CONTROL D — coordination duty alone cannot authorize Kommunikation', () => {
    const text = 'Zu ihren Kernkompetenzen zählen Kommunikationsstärke.';
    const scan = scanGermanSummaryCompetencyClaims(text, { structuredSkills: [] });
    expect(scan.unsupportedCompetencyCount).toBeGreaterThanOrEqual(1);
  });

  it('CONTROL E — localized explicit skill identity maps to German label', () => {
    const auth = buildSummaryExplicitSkillAuthority(['Communication']);
    expect(auth.some((a) => a.canonicalId === 'communication')).toBe(true);
    const scan = scanGermanSummaryCompetencyClaims(
      'Zu ihren Stärken zählt Kommunikation.',
      { structuredSkills: ['Communication'] },
    );
    expect(scan.unsupportedCompetencyCount).toBe(0);
  });

  it('no explicit skills → no generic competency sentence survives grounding', () => {
    const text = `${BAD_AAB318_DE}`;
    const quality = analyzeGermanSummaryEmploymentQuality(text, {
      company: 'Atlas',
      structuredSkills: [],
      currentEntryDuties: WH_DE,
      priorEntryDuties: GD_DE,
    });
    expect(quality.groundingValidationPassed).toBe(false);
    expect(quality.explicitSkillsSlotPresent).toBe(false);
  });

  it('deterministic German rebuild: no Kernkompetenzen; scoped total duration', () => {
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
    expect(text).toMatch(/Lagermitarbeiterin/);
    expect(text).toMatch(/bei Atlas/);
    expect(text).toMatch(/bei Rewitu/);
    expect(text).toMatch(/Grafikdesignerin/);
    expect(text).toMatch(/insgesamt/i);
    expect(text).toMatch(/sechseinhalb/);
    expect(text).not.toMatch(/Kernkompetenzen|Führung|Agile\/Scrum|emotionale Intelligenz/i);
    const scope = analyzeGermanSummaryDurationScope(text, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
    });
    expect(scope.finalDurationScopeValidationPassed).toBe(true);
    expect(scope.finalDurationTotalCareerMarkerPresent).toBe(true);
    expect(scope.finalDurationCurrentRoleAttachmentRisk).toBe(false);
    const quality = analyzeGermanSummaryEmploymentQuality(text, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      currentEntryDuties: WH_DE,
      priorEntryDuties: GD_DE,
      priorCompany: 'Rewitu',
      gender: 'female',
      structuredSkills: [],
    });
    expect(quality.groundingValidationPassed).toBe(true);
    expect(quality.unsupportedClaimCount).toBe(0);
  });

  it('finalize rejects AAB-318 bad provider and recovers grounded German Summary', () => {
    const cv = germanFixture({ summary: '' });
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: BAD_AAB318_DE,
      referenceDateIso: REF,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).toMatch(/bei Atlas/i);
    expect(fin.text).toMatch(/bei Rewitu|Grafik/i);
    expect(fin.text).toMatch(/insgesamt/i);
    expect(fin.text).toMatch(/sechseinhalb/i);
    expect(fin.text).not.toMatch(/Kernkompetenzen|Führung|Agile\/Scrum|emotionale Intelligenz/i);
    expect(fin.diagnostics?.unsupportedClaimCount ?? 0).toBe(0);
    expect(fin.diagnostics?.providerRejectionReason || fin.diagnostics?.providerOutcome)
      .toBeTruthy();
  });

  it('current-role-attached duration fails scope validation', () => {
    const ambiguous = 'Lagermitarbeiterin bei Atlas seit Januar 2023 mit etwa sechseinhalb Jahren Erfahrung.';
    const scope = analyzeGermanSummaryDurationScope(ambiguous, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
    });
    expect(scope.finalDurationScopeValidationPassed).toBe(false);
    expect(scope.finalDurationCurrentRoleAttachmentRisk).toBe(true);
  });

  it('standalone insgesamt duration passes scope validation', () => {
    const ok = 'Insgesamt verfügt sie über etwa sechseinhalb Jahre Berufserfahrung.';
    const scope = analyzeGermanSummaryDurationScope(ok, { company: 'Atlas' });
    expect(scope.finalDurationScopeValidationPassed).toBe(true);
    expect(scope.finalDurationOwnerDetected).toBe('total_professional_experience');
  });
});
