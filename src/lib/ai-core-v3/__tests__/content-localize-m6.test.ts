import { beforeEach, describe, expect, it, vi } from 'vitest';

const experienceResolverSpy = vi.hoisted(() => vi.fn());

vi.mock('../../cv-experience-source-locale', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../cv-experience-source-locale')>();
  experienceResolverSpy.mockImplementation(actual.resolveExperienceSourceLocale);
  return { ...actual, resolveExperienceSourceLocale: experienceResolverSpy };
});

import {
  CONTENT_LOCALIZE_M6_TARGET_LOCALES,
  createContentLocalizeM6Operation,
  isContentLocalizeM6TargetLocale,
} from '../content-localize-m6';
import { hashExperienceSourceLocaleText } from '../../cv-experience-source-locale';
import { hashSummarySourceLocaleText } from '../../cv-summary-source-locale';
import type { Locale } from '../../i18n/translations';
import type { CVData, WorkExperience } from '../../types';

const GERMAN_SUMMARY = 'Prüft Prozesse und koordiniert Termine.';
const GERMAN_DESCRIPTION = 'Prüft eingehende Berichte und aktualisiert Dokumentation.';

function experience(overrides: Partial<WorkExperience> = {}): WorkExperience {
  const description = overrides.description ?? GERMAN_DESCRIPTION;
  return {
    id: 'exp-1',
    company: 'Northstar GmbH',
    position: 'Operations Specialist',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description,
    originalUserDescription: description,
    canonicalDescription: description,
    descriptionOrigin: 'user',
    descriptionSourceLocale: 'de',
    descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(description),
    positionProvenance: 'manual',
    positionSourceLocale: 'en',
    ...overrides,
  };
}

function cv(overrides: Partial<CVData> = {}): CVData {
  return {
    id: 'm6-cv',
    name: 'M6 fixture',
    personal: {
      fullName: 'Mila Example',
      email: 'mila@example.test',
      phone: '',
      address: '',
      jobTitle: 'Operations Specialist',
    },
    summary: GERMAN_SUMMARY,
    summaryOrigin: 'user',
    contentLocale: 'en',
    summarySourceLocale: 'de',
    summarySourceLocaleTextHash: hashSummarySourceLocaleText(GERMAN_SUMMARY),
    experience: [experience()],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function ready(result: ReturnType<typeof createContentLocalizeM6Operation>) {
  expect(result.status).toBe('request_ready');
  if (result.status !== 'request_ready') throw new Error(`expected request_ready, got ${result.status}`);
  return result.snapshot;
}

function failure(result: ReturnType<typeof createContentLocalizeM6Operation>, reason: string) {
  expect(result).toEqual({ status: 'handled_failure', reason });
}

describe('M6 cross-locale executor foundation', () => {
  beforeEach(() => {
    experienceResolverSpy.mockClear();
  });

  it('creates an immutable exact-text Summary request snapshot without mutating the CV', () => {
    const inputCv = cv();
    const before = structuredClone(inputCv);
    const snapshot = ready(createContentLocalizeM6Operation({
      operationId: 'op-summary-1', requestId: 'req-summary-1', kind: 'summary',
      targetLocale: 'fr', confirmed: true, cv: inputCv,
    }));

    expect(snapshot).toEqual({
      operationId: 'op-summary-1', requestId: 'req-summary-1', kind: 'summary',
      sourceLocale: 'de', targetLocale: 'fr', sourceText: GERMAN_SUMMARY,
      sourceTextHash: hashSummarySourceLocaleText(GERMAN_SUMMARY),
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(inputCv).toEqual(before);
  });

  it('keeps Summary empty, unresolved, matching-target, unsupported-target, and unconfirmed states non-request-ready', () => {
    expect(createContentLocalizeM6Operation({
      operationId: 'op', requestId: 'req', kind: 'summary', targetLocale: 'fr', confirmed: true,
      cv: cv({ summary: '', summarySourceLocale: undefined, summarySourceLocaleTextHash: undefined }),
    })).toEqual({ status: 'not_applicable', reason: 'empty_source' });
    failure(createContentLocalizeM6Operation({
      operationId: 'op', requestId: 'req', kind: 'summary', targetLocale: 'fr', confirmed: true,
      cv: cv({ contentLocale: undefined, summarySourceLocale: 'pt-PT', summarySourceLocaleTextHash: 'stale' }),
    }), 'source_locale_unresolved');
    failure(createContentLocalizeM6Operation({
      operationId: 'op', requestId: 'req', kind: 'summary', targetLocale: 'de', confirmed: true, cv: cv(),
    }), 'target_matches_source');
    failure(createContentLocalizeM6Operation({
      operationId: 'op', requestId: 'req', kind: 'summary', targetLocale: 'de-DE', confirmed: true, cv: cv(),
    }), 'target_locale_unsupported');
    expect(createContentLocalizeM6Operation({
      operationId: 'op', requestId: 'req', kind: 'summary', targetLocale: 'fr', confirmed: false, cv: cv(),
    })).toEqual({ status: 'not_applicable', reason: 'unconfirmed' });
  });

  it('creates an entry-isolated immutable Experience description snapshot without touching title or sibling fields', () => {
    const first = experience();
    const secondText = 'Coordina solicitudes de clientes y actualiza informes.';
    const second = experience({
      id: 'exp-2', company: 'Other SA', position: 'Unrelated title', description: secondText,
      descriptionSourceLocale: 'es', descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(secondText),
    });
    const inputCv = cv({ experience: [first, second] });
    const before = structuredClone(inputCv);
    const snapshot = ready(createContentLocalizeM6Operation({
      operationId: 'op-exp-1', requestId: 'req-exp-1', kind: 'experience_description',
      experienceEntryId: 'exp-1', targetLocale: 'es', confirmed: true, cv: inputCv,
    }));

    expect(snapshot).toEqual({
      operationId: 'op-exp-1', requestId: 'req-exp-1', kind: 'experience_description', experienceEntryId: 'exp-1',
      sourceLocale: 'de', targetLocale: 'es', sourceText: GERMAN_DESCRIPTION,
      sourceTextHash: hashExperienceSourceLocaleText(GERMAN_DESCRIPTION),
    });
    expect(JSON.stringify(snapshot)).not.toContain(secondText);
    expect(JSON.stringify(snapshot)).not.toContain('exp-2');
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(inputCv).toEqual(before);
    expect(inputCv.experience[0].position).toBe('Operations Specialist');
    expect(inputCv.experience[1].position).toBe('Unrelated title');
  });

  it('fails Experience closed for missing, empty, stale, matching-target, unsupported-target, and unconfirmed states', () => {
    failure(createContentLocalizeM6Operation({
      operationId: 'op', requestId: 'req', kind: 'experience_description', experienceEntryId: 'missing',
      targetLocale: 'es', confirmed: true, cv: cv(),
    }), 'experience_entry_missing');
    expect(createContentLocalizeM6Operation({
      operationId: 'op', requestId: 'req', kind: 'experience_description', experienceEntryId: 'exp-1',
      targetLocale: 'es', confirmed: true, cv: cv({ experience: [experience({ description: '' })] }),
    })).toEqual({ status: 'not_applicable', reason: 'empty_source' });
    failure(createContentLocalizeM6Operation({
      operationId: 'op', requestId: 'req', kind: 'experience_description', experienceEntryId: 'exp-1',
      targetLocale: 'es', confirmed: true,
      cv: cv({ experience: [experience({ descriptionSourceLocaleTextHash: 'stale-binding' })] }),
    }), 'source_locale_unresolved');
    failure(createContentLocalizeM6Operation({
      operationId: 'op', requestId: 'req', kind: 'experience_description', experienceEntryId: 'exp-1',
      targetLocale: 'de', confirmed: true, cv: cv(),
    }), 'target_matches_source');
    failure(createContentLocalizeM6Operation({
      operationId: 'op', requestId: 'req', kind: 'experience_description', experienceEntryId: 'exp-1',
      targetLocale: 'pt_BR', confirmed: true, cv: cv(),
    }), 'target_locale_unsupported');
    expect(createContentLocalizeM6Operation({
      operationId: 'op', requestId: 'req', kind: 'experience_description', experienceEntryId: 'exp-1',
      targetLocale: 'es', confirmed: false, cv: cv(),
    })).toEqual({ status: 'not_applicable', reason: 'unconfirmed' });
  });

  it('rejects unbound or stale Experience source evidence before entering resolver fallback', () => {
    const germanLooking = experience({
      descriptionSourceLocale: undefined,
      descriptionSourceLocaleTextHash: undefined,
    });
    failure(createContentLocalizeM6Operation({
      operationId: 'op-unbound-de', requestId: 'req-unbound-de', kind: 'experience_description',
      experienceEntryId: 'exp-1', targetLocale: 'fr', confirmed: true,
      cv: cv({ experience: [germanLooking] }),
    }), 'source_locale_unresolved');

    const englishLooking = experience({
      description: 'Reviews incoming reports and updates documentation.',
      descriptionSourceLocale: undefined,
      descriptionSourceLocaleTextHash: undefined,
    });
    failure(createContentLocalizeM6Operation({
      operationId: 'op-unbound-en', requestId: 'req-unbound-en', kind: 'experience_description',
      experienceEntryId: 'exp-1', targetLocale: 'fr', confirmed: true,
      cv: cv({ experience: [englishLooking] }),
    }), 'source_locale_unresolved');

    const missingHash = experience({ descriptionSourceLocaleTextHash: undefined });
    failure(createContentLocalizeM6Operation({
      operationId: 'op-missing-hash', requestId: 'req-missing-hash', kind: 'experience_description',
      experienceEntryId: 'exp-1', targetLocale: 'fr', confirmed: true,
      cv: cv({ experience: [missingHash] }),
    }), 'source_locale_unresolved');

    const staleHash = experience({ descriptionSourceLocaleTextHash: 'stale-binding' });
    failure(createContentLocalizeM6Operation({
      operationId: 'op-stale-hash', requestId: 'req-stale-hash', kind: 'experience_description',
      experienceEntryId: 'exp-1', targetLocale: 'fr', confirmed: true,
      cv: cv({ experience: [staleHash] }),
    }), 'source_locale_unresolved');

    expect(experienceResolverSpy).not.toHaveBeenCalled();
  });

  it('enters the existing Experience resolver exactly once only for an exact binding', () => {
    const snapshot = ready(createContentLocalizeM6Operation({
      operationId: 'op-bound', requestId: 'req-bound', kind: 'experience_description',
      experienceEntryId: 'exp-1', targetLocale: 'fr', confirmed: true, cv: cv(),
    }));

    expect(snapshot.sourceLocale).toBe('de');
    expect(experienceResolverSpy).toHaveBeenCalledTimes(1);
  });

  it.each(CONTENT_LOCALIZE_M6_TARGET_LOCALES)('accepts canonical target vocabulary entry %s only', (targetLocale) => {
    expect(isContentLocalizeM6TargetLocale(targetLocale)).toBe(true);
    const result = createContentLocalizeM6Operation({
      operationId: `op-target-${targetLocale}`, requestId: `req-target-${targetLocale}`,
      kind: 'summary', targetLocale, confirmed: true, cv: cv(),
    });
    if (targetLocale === 'de') {
      failure(result, 'target_matches_source');
    } else {
      expect(ready(result).targetLocale).toBe(targetLocale);
    }
  });

  it.each(CONTENT_LOCALIZE_M6_TARGET_LOCALES)('rejects source-equal canonical target %s for every source locale', (locale) => {
    const summary = `Bound source for ${locale}.`;
    const result = createContentLocalizeM6Operation({
      operationId: `op-source-${locale}`, requestId: `req-source-${locale}`, kind: 'summary',
      targetLocale: locale, confirmed: true,
      cv: cv({
        summary,
        summarySourceLocale: locale,
        summarySourceLocaleTextHash: hashSummarySourceLocaleText(summary),
      }),
    });
    failure(result, 'target_matches_source');
  });

  it.each(['en-US', 'de-DE', 'sr-Latn-RS', 'pt_BR', 'PT-br', 'pt-PT', 'pl', 'nl', 'zh', ''] as const)(
    'rejects noncanonical target %s',
    (targetLocale) => {
      expect(isContentLocalizeM6TargetLocale(targetLocale)).toBe(false);
      failure(createContentLocalizeM6Operation({
        operationId: 'op', requestId: 'req', kind: 'summary', targetLocale, confirmed: true, cv: cv(),
      }), 'target_locale_unsupported');
    },
  );

  it('uses exact bound metadata rather than visible text appearance and fails closed when that binding is stale', () => {
    const misleadingText = 'This visible text is English, but its exact bound source locale is German.';
    const summarySnapshot = ready(createContentLocalizeM6Operation({
      operationId: 'op-summary-adversarial', requestId: 'req-summary-adversarial', kind: 'summary',
      targetLocale: 'fr', confirmed: true,
      cv: cv({
        summary: misleadingText,
        summarySourceLocale: 'de',
        summarySourceLocaleTextHash: hashSummarySourceLocaleText(misleadingText),
      }),
    }));
    expect(summarySnapshot.sourceLocale).toBe('de');

    const adversarialExperience = experience({
      description: misleadingText,
      descriptionSourceLocale: 'de',
      descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(misleadingText),
    });
    const experienceSnapshot = ready(createContentLocalizeM6Operation({
      operationId: 'op-exp-adversarial', requestId: 'req-exp-adversarial', kind: 'experience_description',
      experienceEntryId: 'exp-1', targetLocale: 'fr', confirmed: true,
      cv: cv({ experience: [adversarialExperience] }),
    }));
    expect(experienceSnapshot.sourceLocale).toBe('de');

    failure(createContentLocalizeM6Operation({
      operationId: 'op-exp-stale', requestId: 'req-exp-stale', kind: 'experience_description',
      experienceEntryId: 'exp-1', targetLocale: 'fr', confirmed: true,
      cv: cv({ experience: [experience({
        description: misleadingText,
        descriptionSourceLocale: 'de',
        descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText('different exact text'),
      })] }),
    }), 'source_locale_unresolved');
  });

  it('is deterministic for identical semantic inputs and keeps caller identities outside source semantic hash', () => {
    const inputCv = cv();
    const first = ready(createContentLocalizeM6Operation({
      operationId: 'op-a', requestId: 'req-a', kind: 'summary', targetLocale: 'fr', confirmed: true, cv: inputCv,
    }));
    const repeated = ready(createContentLocalizeM6Operation({
      operationId: 'op-a', requestId: 'req-a', kind: 'summary', targetLocale: 'fr', confirmed: true, cv: inputCv,
    }));
    const differentIdentity = ready(createContentLocalizeM6Operation({
      operationId: 'op-b', requestId: 'req-b', kind: 'summary', targetLocale: 'fr', confirmed: true, cv: inputCv,
    }));
    expect(repeated).toEqual(first);
    expect(differentIdentity.sourceTextHash).toBe(first.sourceTextHash);
    expect(differentIdentity.sourceText).toBe(first.sourceText);
    expect(differentIdentity.sourceLocale).toBe(first.sourceLocale);
    expect(differentIdentity.targetLocale).toBe(first.targetLocale);
    expect(differentIdentity.operationId).not.toBe(first.operationId);
  });

  it('does not mutate any Summary, Experience, global-locale, provenance, or canonical input state', () => {
    const inputCv = cv({
      canonicalSnapshot: undefined,
      experience: [experience({
        originalUserDescription: 'Original description.', canonicalDescription: 'Canonical description.',
        generatedDescription: 'Generated description.', generatedLocale: 'fr',
      })],
    });
    const before = structuredClone(inputCv);
    ready(createContentLocalizeM6Operation({
      operationId: 'op-summary-pure', requestId: 'req-summary-pure', kind: 'summary',
      targetLocale: 'fr', confirmed: true, cv: inputCv,
    }));
    ready(createContentLocalizeM6Operation({
      operationId: 'op-exp-pure', requestId: 'req-exp-pure', kind: 'experience_description',
      experienceEntryId: 'exp-1', targetLocale: 'es', confirmed: true, cv: inputCv,
    }));
    expect(inputCv).toEqual(before);
    expect(inputCv.contentLocale).toBe('en');
    expect(inputCv.summarySourceLocale).toBe('de');
    expect(inputCv.summarySourceLocaleTextHash).toBe(hashSummarySourceLocaleText(GERMAN_SUMMARY));
    expect(inputCv.experience[0].description).toBe(GERMAN_DESCRIPTION);
    expect(inputCv.experience[0].descriptionSourceLocale).toBe('de');
    expect(inputCv.experience[0].descriptionSourceLocaleTextHash)
      .toBe(hashExperienceSourceLocaleText(GERMAN_DESCRIPTION));
  });
});
