/**
 * AAB-347 — candidate projection invariants: validators must receive the same
 * full Summary text as the finalized deterministic candidate, never 34-char
 * synthetic unit placeholders or mismatched stage hashes.
 */
import { describe, expect, it } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  expectProviderRejectedReason,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { checkSummaryDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';
import {
  SUMMARY_CANDIDATE_PROJECTION_INVARIANT_347_REVISION,
  ENGLISH_SUMMARY_VALIDATION_ROLE_ALIGN_347_REVISION,
  stripEnglishUnsupportedCompetencyUnits,
  analyzeEnglishSummaryEmploymentQuality,
} from '@/lib/cv-english-summary-grounding';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import type { CVData } from '@/lib/types';

const WH_EN = [
  'checking incoming goods;',
  'checking documentation related to received goods;',
  'coordinating with colleagues on preparation and movement of goods.',
].join('\n');
const GD_EN = [
  'creating visual materials and graphic elements;',
  'reviewing and adapting design materials;',
  'preparing final design files for different formats and screens.',
].join('\n');
const EXPECTED =
  'I am a warehouse employee with approximately six and a half years of professional experience, currently working at Atlas, where I check incoming goods, verify related documentation, and coordinate with colleagues on the preparation and movement of goods. Previously, I worked as a graphic designer at Rewitu, creating visual materials and graphic elements, reviewing and adapting design materials, and preparing final design files for different formats and screens.';
const EXPECTED_HASH = 'fnv1a_ac83446e_l465_b73_e46';
const SENT0 = 'fnv1a_2b446a2a_l254_b73_e46';
const SENT1 = 'fnv1a_2339b7c1_l210_b80_e46';

function baseCv(): CVData {
  return {
    personal: {
      fullName: 'T',
      email: 't@x.com',
      phone: '',
      location: '',
      jobTitle: 'Warehouse Employee',
      gender: 'female',
    },
    summary: '',
    contentLocale: 'en',
    experience: [
      {
        id: 'atlas',
        position: 'Warehouse Employee',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_EN,
        canonicalDescription: WH_EN,
      },
      {
        id: 'rewitu',
        position: 'Graphic Designer',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2022-12',
        isPresent: false,
        description: GD_EN,
        canonicalDescription: GD_EN,
      },
    ],
    education: [],
    skills: [],
    languages: [],
  } as CVData;
}

describe('AAB-347 candidate projection invariants', () => {
  it('marker reachable', () => {
    expect(SUMMARY_CANDIDATE_PROJECTION_INVARIANT_347_REVISION)
      .toBe('summary-candidate-projection-invariant-347-v1');
    expect(ENGLISH_SUMMARY_VALIDATION_ROLE_ALIGN_347_REVISION)
      .toBe('english-summary-validation-role-align-347-v1');
  });

  it('A. placeholder l34 hashes fail projection invariant', () => {
    const p0 = fingerprintText(`${EXPECTED_HASH}:unit:0`);
    const p1 = fingerprintText(`${EXPECTED_HASH}:unit:1`);
    expect(p0).toBe('fnv1a_d1fd75c5_l34_b102_e48');
    expect(p1).toBe('fnv1a_d0fd7432_l34_b102_e49');
    const check = checkSummaryDiagnosticInvariants({
      requestedLocale: 'en',
      countedAsSuccess: true,
      deterministicAccepted: true,
      deterministicCandidateHash: EXPECTED_HASH,
      groundingInputCandidateHash: EXPECTED_HASH,
      finalValidatedCandidateHash: EXPECTED_HASH,
      groundingInputEqualsFinalValidatedCandidate: true,
      deterministicCandidateSentenceCount: 2,
      finalSentenceHashes: [p0, p1],
      candidateLineage: [],
    });
    expect(check.passed).toBe(false);
    expect(check.failures.some((f) => f.invariantCode === 'projection_placeholder_sentence_hashes'))
      .toBe(true);
  });

  it('B. sentence hashes that disagree with finalized candidate count fail', () => {
    const check = checkSummaryDiagnosticInvariants({
      requestedLocale: 'en',
      countedAsSuccess: true,
      deterministicAccepted: true,
      deterministicCandidateHash: EXPECTED_HASH,
      groundingInputCandidateHash: EXPECTED_HASH,
      finalValidatedCandidateHash: EXPECTED_HASH,
      groundingInputEqualsFinalValidatedCandidate: true,
      deterministicCandidateSentenceCount: 2,
      finalSentenceHashes: [SENT0],
      candidateLineage: [],
    });
    expect(check.passed).toBe(false);
    expect(check.failures.some((f) => f.invariantCode === 'projection_sentence_count_mismatch'))
      .toBe(true);
  });

  it('C/D/E. grounding vs final hash mismatch fails', () => {
    const check = checkSummaryDiagnosticInvariants({
      requestedLocale: 'en',
      countedAsSuccess: true,
      deterministicAccepted: true,
      deterministicCandidateHash: EXPECTED_HASH,
      groundingInputCandidateHash: 'fnv1a_deadbeef_l10_b00_e00',
      finalValidatedCandidateHash: EXPECTED_HASH,
      groundingInputEqualsFinalValidatedCandidate: false,
      deterministicCandidateSentenceCount: 2,
      finalSentenceHashes: [SENT0, SENT1],
      candidateLineage: [],
    });
    expect(check.passed).toBe(false);
    expect(check.failures.some((f) => f.invariantCode === 'projection_grounding_final_hash_mismatch'))
      .toBe(true);
  });

  it('F. repair raw text without usable parse continues to deterministic', () => {
    const unsupported =
      'Warehouse Employee currently working at Atlas, checking incoming goods, '
      + 'verifying related documentation, and coordinating with colleagues on the '
      + 'preparation and movement of goods. Previously worked as a Graphic Designer '
      + 'at Rewitu, creating visual materials and graphic elements, reviewing and adapting '
      + 'design materials, and preparing final design files for different formats and '
      + 'screens. Key skills include leadership, pharmacy standards and printing. With '
      + 'approximately six and a half years of professional experience.';
    const stripped = stripEnglishUnsupportedCompetencyUnits(unsupported);
    expect(stripped.trim().length).toBeGreaterThan(0);
    const repairedQ = analyzeEnglishSummaryEmploymentQuality(stripped, {
      company: 'Atlas',
      role: 'Warehouse Employee',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      priorCompany: 'Rewitu',
      priorRole: 'Graphic Designer',
      gender: 'female',
    });
    // Stripped body may still fail grammar/slots — raw present, usable may be false.
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: baseCv(),
      candidate: unsupported,
      referenceDateIso: '2026-07-20',
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.origin).toBe('deterministic_fallback');
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.deterministicCandidateHash).toBe(EXPECTED_HASH);
    } else {
      expect(fin.diagnostics?.deterministicCandidateHash).toBeTruthy();
    }
    if (fin.diagnostics?.repairCandidatePresent) {
      expect(fin.diagnostics.repairRawCandidatePresent).toBe(true);
      expect(fin.diagnostics.repairUsableCandidatePresent).toBe(false);
      if (!summaryV2ModeActive()) {
        expect(fin.diagnostics.repairAccepted).toBe(false);
      }
    }
    void repairedQ;
    if (!summaryV2ModeActive()) {
      expect((fin.text || '').replace(/\s+/g, ' ').trim()).toBe(EXPECTED);
    } else {
      expect((fin.text || '').length).toBeGreaterThan(80);
      expect(fin.text).toMatch(/Atlas|Rewitu/i);
    }
  });

  it('happy path projection invariant passes with full sentences', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: baseCv(),
      candidate:
        'Warehouse Employee currently working at Atlas, checking incoming goods, '
        + 'verifying related documentation, and coordinating with colleagues on the '
        + 'preparation and movement of goods. With approximately six and a half years '
        + 'of professional experience.',
      referenceDateIso: '2026-07-20',
    });
    expect(fin.countedAsSuccess).toBe(true);
    const sentenceHashes = (
      Array.isArray(fin.diagnostics?.finalSentenceHashes)
      && fin.diagnostics!.finalSentenceHashes!.length > 0
    )
      ? fin.diagnostics!.finalSentenceHashes!
      : (fin.diagnostics?.evaluatedSentenceHashes || []);
    if (summaryV2ModeActive()) {
      expect(sentenceHashes.length).toBeGreaterThan(0);
      expect(fin.countedAsSuccess).toBe(true);
      return;
    }
    expect(sentenceHashes).toEqual([SENT0, SENT1]);
    const check = checkSummaryDiagnosticInvariants({
      requestedLocale: 'en',
      countedAsSuccess: true,
      deterministicAccepted: true,
      deterministicCandidateHash: fin.diagnostics?.deterministicCandidateHash,
      groundingInputCandidateHash: fin.diagnostics?.groundingInputCandidateHash,
      finalValidatedCandidateHash: fin.diagnostics?.finalValidatedCandidateHash,
      groundingInputEqualsFinalValidatedCandidate: true,
      deterministicCandidateSentenceCount: 2,
      finalSentenceHashes: sentenceHashes,
      candidateLineage: [],
    });
    expect(
      check.failures.filter((f) => String(f.invariantCode).startsWith('projection_')),
    ).toEqual([]);

  });
});
