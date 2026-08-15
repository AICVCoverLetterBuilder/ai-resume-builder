import { describe, expect, it } from 'vitest';
import {
  evaluateNativeRealizationContract,
  realizeFirstPersonDutyClause,
} from '@/lib/cv-summary-v2/native-surface';
import { validateSummaryV2AgainstManifest } from '@/lib/cv-summary-v2/validator';
import type {
  SummaryV2EntryFact,
  SummaryV2EntryOwned,
  SummaryV2SelectionManifest,
} from '@/lib/cv-summary-v2/types';

describe('AAB453 Russian Summary native morphology', () => {
  it.each([
    ['редактирует графику и изображения', 'редактирую графику и изображения'],
    ['координирует работу команды', 'координирую работу команды'],
    ['разрабатывает визуальные материалы', 'разрабатываю визуальные материалы'],
    ['создает дизайн-концепции', 'создаю дизайн-концепции'],
    ['редактировать графику', 'редактирую графику'],
    ['координировать работу команды', 'координирую работу команды'],
    ['разрабатывать материалы', 'разрабатываю материалы'],
    ['создавать концепции', 'создаю концепции'],
  ])('realizes %s as %s', (source, expected) => {
    expect(realizeFirstPersonDutyClause(source, 'ru', 'present')).toBe(expected);
  });

  it.each([
    'Сейчас я редактируу графику и изображения.',
    'Сейчас я координирууу работу команды.',
  ])('rejects malformed duplicated Russian present morphology: %s', (text) => {
    const contract = evaluateNativeRealizationContract({
      text,
      locale: 'ru',
      perspectiveMode: 'first_person',
    });
    expect(contract.localeVerbMorphologyPassed).toBe(false);
    expect(contract.nativeRealizationRejectionReasons.join('|')).toMatch(
      /ru_malformed_first_person_present/u,
    );
  });

  it('fails closed for post-write corruption instead of preserving green diagnostics', () => {
    const visible = evaluateNativeRealizationContract({
      text: 'Сейчас я редактируу графику и изображения.',
      locale: 'ru',
      perspectiveMode: 'first_person',
    });
    expect(visible.localeVerbMorphologyPassed).toBe(false);
    expect(visible.sentenceCompletenessPassed).toBe(false);
    expect(visible.nativeRealizationRejectionReasons).toContain(
      'locale_verb_morphology:ru_malformed_first_person_present',
    );
  });

  it('feeds Russian morphology rejection into the shared Summary V2 final validator', () => {
    const fact: SummaryV2EntryFact = {
      factId: 'fact-1',
      entryId: 'entry-1',
      bulletText: 'Редактирует графику и изображения.',
      tokenStems: ['редактир', 'график', 'изображен'],
      sourceFactHash: 'fact-hash',
      sourceLocale: 'ru',
    };
    const entry: SummaryV2EntryOwned = {
      entryId: 'entry-1',
      role: 'дизайнер',
      employer: 'Acme',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      employmentState: 'present',
      sourceLocale: 'ru',
      descriptionHash: 'description-hash',
      facts: [fact],
    };
    const manifest: SummaryV2SelectionManifest = {
      revision: 'test',
      snapshotHash: 'snapshot-hash',
      locale: 'ru',
      gender: 'female',
      totalDurationMonths: 12,
      durationPhrase: 'около одного года опыта',
      styleHintUsed: false,
      current: entry,
      priors: [],
      requiredCurrentFacts: [fact],
      requiredPriorFacts: [],
      maxDutiesPerEntry: 3,
    };
    const result = validateSummaryV2AgainstManifest(
      'У меня около одного года опыта. Сейчас я работаю дизайнером в Acme и редактируу графику.',
      manifest,
    );
    expect(result.russianMorphologyValidationPassed).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('malformed_russian_finite_verb');
  });
});
