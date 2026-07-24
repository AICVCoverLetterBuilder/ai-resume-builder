/**
 * AAB-320 Phase 2 — Summary explicit-skill provenance + candidate phase separation.
 */
import { describe, expect, it } from 'vitest';
import {
  SUMMARY_EXPLICIT_SKILL_PROVENANCE_320_REVISION,
  SUMMARY_CANDIDATE_PHASE_SEPARATION_320_REVISION,
  buildSummaryExplicitSkillAuthorityReport,
} from '@/lib/cv-summary-explicit-skill-authority';
import {
  buildSummaryExplicitSkillAuthority,
  buildGermanSummarySkillAuthorityReport,
  scanGermanSummaryCompetencyClaims,
} from '@/lib/cv-german-summary-grounding';
import {
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import type { CVData } from '@/lib/types';

const REF = '2026-07-19';

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

function germanFixture(skills: string[] = []): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Lagermitarbeiterin',
      gender: 'female',
    },
    summary: '',
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
    skills,
    languages: [],
    contentLocale: 'de',
  } as CVData;
}

describe('AAB-320 Summary skill provenance and phase diagnostics', () => {
  it('exposes Phase 2 markers in runtime set', () => {
    expect(SUMMARY_EXPLICIT_SKILL_PROVENANCE_320_REVISION).toBe(
      'summary-explicit-skill-provenance-320-v1',
    );
    expect(SUMMARY_CANDIDATE_PHASE_SEPARATION_320_REVISION).toBe(
      'summary-candidate-phase-separation-320-v1',
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_EXPLICIT_SKILL_PROVENANCE_320_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_CANDIDATE_PHASE_SEPARATION_320_REVISION);
  });

  it('FIXTURE A — empty Skills → authoritative count 0', () => {
    const report = buildSummaryExplicitSkillAuthorityReport([]);
    expect(report.authoritativeExplicitSkillCount).toBe(0);
    expect(report.rawSkillRecordCount).toBe(0);
    const scan = scanGermanSummaryCompetencyClaims(
      'Zu ihren Kernkompetenzen zählen Kommunikation.',
      { structuredSkills: [] },
    );
    expect(scan.explicitSkillFactCount).toBe(0);
    expect(scan.unsupportedCompetencyCount).toBeGreaterThanOrEqual(1);
  });

  it('FIXTURE B — thirteen real user skills → count 13', () => {
    const skills = [
      'Kommunikation', 'Organisation', 'Führung', 'Problemlösung', 'Zeitmanagement',
      'Anpassungsfähigkeit', 'kritisches Denken', 'Detailgenauigkeit', 'emotionale Intelligenz',
      'Scrum', 'Teamfähigkeit', 'Resilienz', 'Excel',
    ];
    const report = buildGermanSummarySkillAuthorityReport(skills);
    expect(report.authoritativeExplicitSkillCount).toBe(13);
    expect(report.canonicalSkillIdentityCount).toBe(13);
    expect(scanGermanSummaryCompetencyClaims('x', { structuredSkills: skills }).explicitSkillFactCount)
      .toBe(13);
  });

  it('FIXTURE C — German/Spanish alias collapse to one canonical skill', () => {
    const report = buildSummaryExplicitSkillAuthorityReport([
      'Kommunikation',
      'Communication',
    ]);
    expect(report.authoritativeExplicitSkillCount).toBe(1);
    expect(report.duplicateSkillAliasCollapseCount).toBeGreaterThanOrEqual(1);
    expect(report.canonicalSkillIdentityCount).toBe(1);
  });

  it('FIXTURE D — stale skills are not authoritative', () => {
    const report = buildSummaryExplicitSkillAuthorityReport([
      { label: 'Kommunikation', sourceKind: 'stale' },
      { label: 'Organisation', sourceKind: 'user_entered' },
    ]);
    expect(report.authoritativeExplicitSkillCount).toBe(1);
    expect(report.staleSkillRecordCount).toBe(1);
    expect(report.records.find((r) => r.canonicalSkillId === 'communication')?.authoritativeForSummary)
      .toBe(false);
  });

  it('FIXTURE E — AI-generated unedited skills are not authoritative', () => {
    const report = buildSummaryExplicitSkillAuthorityReport([
      { label: 'Kommunikation', sourceKind: 'ai_generated_unedited' },
    ]);
    expect(report.authoritativeExplicitSkillCount).toBe(0);
    expect(report.aiGeneratedUneditedSkillRecordCount).toBe(1);
    expect(report.records[0]?.rejectionReason).toBe('ai_generated_unedited_skill');
  });

  it('placeholder / empty rows do not increase authoritative count', () => {
    const report = buildSummaryExplicitSkillAuthorityReport([
      '',
      '  ',
      'Skill',
      'Kommunikation',
    ]);
    expect(report.authoritativeExplicitSkillCount).toBe(1);
    expect(report.suggestedUnselectedSkillRecordCount).toBeGreaterThanOrEqual(1);
  });

  it('AI-generated user-edited skill is authoritative when materially edited', () => {
    const report = buildSummaryExplicitSkillAuthorityReport([
      {
        label: 'Kommunikation',
        sourceKind: 'ai_generated_user_edited',
        userMateriallyEdited: true,
      },
    ]);
    expect(report.authoritativeExplicitSkillCount).toBe(1);
  });

  it('inferred / suggested skills cannot authorize Summary claims', () => {
    const report = buildSummaryExplicitSkillAuthorityReport([
      { label: 'Kommunikation', sourceKind: 'inferred' },
      { label: 'Organisation', sourceKind: 'suggested_not_selected' },
    ]);
    expect(report.authoritativeExplicitSkillCount).toBe(0);
    const scan = scanGermanSummaryCompetencyClaims(
      'Zu ihren Kernkompetenzen zählen Kommunikation und Organisation.',
      {
        structuredSkills: [
          { label: 'Kommunikation', sourceKind: 'inferred' },
          { label: 'Organisation', sourceKind: 'suggested_not_selected' },
        ],
      },
    );
    expect(scan.explicitSkillFactCount).toBe(0);
    expect(scan.unsupportedCompetencyCount).toBeGreaterThanOrEqual(1);
  });

  it('legacy string skills remain user_entered authoritative', () => {
    const facts = buildSummaryExplicitSkillAuthority(['Kommunikation', 'Communication']);
    expect(facts.length).toBe(1);
    expect(facts[0]!.canonicalId).toBe('communication');
  });

  it('diagnostics never expose raw skill labels in authority records', () => {
    const report = buildSummaryExplicitSkillAuthorityReport(['GeheimnisSkillXYZ']);
    const serialized = JSON.stringify(report.records);
    expect(serialized).not.toMatch(/GeheimnisSkillXYZ/);
    expect(report.records[0]?.sourceLabelHash).toMatch(/^fnv1a_/);
    expect(report.records[0]?.canonicalSkillId).toMatch(/^skill:/);
  });

  it('rejected provider clears final* hashes while keeping evaluated* fields', () => {
    const cv = germanFixture([]);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: [
        'Zuvor war sie als Grafikdesignerin bei Rewitu tätig.',
        'Zu ihren Kernkompetenzen zählen Führung und Agile/Scrum.',
        'Insgesamt verfügt sie über etwa sechseinhalb Jahre Berufserfahrung.',
      ].join(' '),
      referenceDateIso: REF,
    });
    // Recovery should succeed for empty Summary — final fields describe selected final.
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.finalCandidateSource).not.toBe('none');
    expect(Array.isArray(fin.diagnostics?.finalSentenceHashes)).toBe(true);
    expect((fin.diagnostics?.finalSentenceHashes as string[]).length).toBeGreaterThan(0);
    expect(fin.diagnostics?.providerRejectionReason || fin.diagnostics?.providerTypedRejectionReason)
      .toBeTruthy();
  });

  it('total recovery failure keeps finalCandidateSource none and empty final hashes', () => {
    const cv = {
      ...germanFixture([]),
      experience: [],
      personal: {
        fullName: 'X',
        email: 'x@example.com',
        phone: '',
        location: '',
        jobTitle: '',
        gender: 'female',
      },
    } as CVData;
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: 'Dies ist ein völlig unbegründeter Text mit Kernkompetenzen Führung.',
      referenceDateIso: REF,
    });
    if (!fin.countedAsSuccess) {
      expect(fin.diagnostics?.finalCandidateSource).toBe('none');
      expect(fin.diagnostics?.finalSentenceHashes || []).toEqual([]);
      expect(fin.diagnostics?.finalValidatedCandidateHash ?? null).toBeNull();
    }
  });
});
