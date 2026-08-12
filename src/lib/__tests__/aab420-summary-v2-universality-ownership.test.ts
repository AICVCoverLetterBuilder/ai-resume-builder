import { describe, expect, it } from 'vitest';
import type { Locale } from '@/lib/i18n/translations';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  SUMMARY_V2_PRINT_MATERIAL_CATEGORY,
  acceptSummaryV2LocalizationResponse,
  analyzeSummaryV2FinalUnitOwnership,
  auditSummaryV2PrintClaims,
  buildSummaryV2ProviderExperienceEntries,
  buildSummaryV2DeterministicText,
  buildSummaryV2ManifestForCv,
  buildSummaryV2EntrySurfaceTransportPlan,
  buildEntryOwnedFactsFromLiveDescription,
  captureSummaryV2Snapshot,
  classifySummaryV2EntrySurfaceAuthority,
  clearSummaryV2LocalizationCacheForTests,
  detectSummaryV2MaterialClaimCategories,
  hashSummaryV2Text,
  localizeSummaryV2Manifest,
  projectLocalizedSummaryV2Manifest,
  runSummaryV2,
  validateSummaryV2AgainstManifest,
  validateSummaryV2LocalizationResponse,
  type SummaryV2CandidateSourceKind,
  type SummaryV2EntryOwned,
  type SummaryV2LocalizationProviderResponse,
  type SummaryV2LocalizationTransportInput,
  type SummaryV2SelectionManifest,
} from '@/lib/cv-summary-v2';

const REF = '2026-07-01';
const LOCALES: Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
];

const SURFACES: Record<Locale, { role: string; duties: [string, string]; print: string }> = {
  en: {
    role: 'Community archive workflow steward',
    duties: ['I coordinate community archive requests.', 'I maintain detailed service records.'],
    print: 'I prepare materials for print.',
  },
  de: {
    role: 'Koordinatorin für gemeinschaftliche Archivabläufe',
    duties: ['Ich koordiniere Anfragen für das Gemeinschaftsarchiv.', 'Ich pflege ausführliche Servicedokumentationen.'],
    print: 'Ich bereite Materialien für Printmedien vor.',
  },
  es: {
    role: 'Responsable de flujos del archivo comunitario',
    duties: ['Coordino las solicitudes del archivo comunitario.', 'Mantengo registros detallados del servicio.'],
    print: 'Preparo materiales impresos.',
  },
  fr: {
    role: 'Responsable des flux des archives communautaires',
    duties: ['Je coordonne les demandes des archives communautaires.', 'Je tiens des dossiers de service détaillés.'],
    print: 'Je prépare des supports imprimés.',
  },
  it: {
    role: 'Responsabile dei flussi dell’archivio comunitario',
    duties: ['Coordino le richieste dell’archivio comunitario.', 'Mantengo registri di servizio dettagliati.'],
    print: 'Preparo materiali stampati.',
  },
  ar: {
    role: 'مسؤولة سير عمل الأرشيف المجتمعي',
    duties: ['أنسق طلبات الأرشيف المجتمعي.', 'أحافظ على سجلات الخدمة التفصيلية.'],
    print: 'أُعِدُّ المواد المطبوعة.',
  },
  sr: {
    role: 'Koordinatorka tokova arhive zajednice',
    duties: ['Koordiniram zahteve arhive zajednice.', 'Vodim detaljnu evidenciju usluga.'],
    print: 'Pripremam materijale za štampu.',
  },
  hr: {
    role: 'Koordinatorica tijeka arhive zajednice',
    duties: ['Koordiniram zahtjeve arhive zajednice.', 'Vodim detaljnu evidenciju usluga.'],
    print: 'Pripremam tiskane materijale.',
  },
  ru: {
    role: 'Координатор процессов общественного архива',
    duties: ['Я координирую запросы общественного архива.', 'Я веду подробные записи об обслуживании.'],
    print: 'Я готовлю печатные материалы.',
  },
  'pt-BR': {
    role: 'Responsável pelos fluxos do arquivo comunitário',
    duties: ['Coordeno as solicitações do arquivo comunitário.', 'Mantenho registros detalhados do serviço.'],
    print: 'Preparo materiais impressos.',
  },
  hi: {
    role: 'सामुदायिक अभिलेख कार्यप्रवाह समन्वयक',
    duties: ['मैं सामुदायिक अभिलेख अनुरोधों का समन्वय करती हूँ।', 'मैं विस्तृत सेवा अभिलेख बनाए रखती हूँ।'],
    print: 'मैं मुद्रित सामग्री तैयार करती हूँ।',
  },
  ja: {
    role: '地域資料管理業務の調整担当者',
    duties: ['地域資料の依頼を調整します。', '詳細な業務記録を管理します。'],
    print: '印刷物を準備します。',
  },
};

const FOREIGN_SOURCE_BY_TARGET: Record<Locale, Locale> = {
  en: 'ar', de: 'hi', es: 'ru', fr: 'ja', it: 'ar',
  ar: 'en', sr: 'hi', hr: 'ru', ru: 'es', 'pt-BR': 'ja', hi: 'de', ja: 'fr',
};

function entry(options: {
  id: string;
  role: string;
  employer: string;
  state: 'present' | 'completed';
  duties: string[];
  locale?: Locale;
}): SummaryV2EntryOwned {
  const sourceLocale = options.locale || 'en';
  return {
    entryId: options.id,
    role: options.role,
    employer: options.employer,
    startDate: options.state === 'present' ? '2024-01' : '2021-01',
    endDate: options.state === 'present' ? '' : '2023-12',
    isPresent: options.state === 'present',
    employmentState: options.state,
    sourceLocale,
    descriptionHash: `description-${options.id}`,
    facts: buildEntryOwnedFactsFromLiveDescription({
      entryId: options.id,
      liveDescription: options.duties.join('\n'),
      sourceLocale,
    }),
  };
}

function localizationManifest(target: Locale, source: Locale): SummaryV2SelectionManifest {
  const sourceSurface = SURFACES[source];
  const current = entry({
    id: `entry-${target}-${source}`,
    role: sourceSurface.role,
    employer: 'Northstar Labs',
    state: 'present',
    duties: sourceSurface.duties,
    locale: source,
  });
  return {
    revision: 'aab420-partial-surface-matrix',
    snapshotHash: `snapshot-${target}-${source}`,
    locale: target,
    gender: 'female',
    totalDurationMonths: 24,
    durationPhrase: 'approximately two years',
    styleHintUsed: false,
    current,
    priors: [],
    requiredCurrentFacts: current.facts,
    requiredPriorFacts: [],
    maxDutiesPerEntry: 3,
  };
}

function localizationResponse(options: {
  manifest: SummaryV2SelectionManifest;
  role: string;
  duties: string[];
}): SummaryV2LocalizationProviderResponse {
  const current = options.manifest.current!;
  return {
    targetLocale: options.manifest.locale,
    entries: [{
      entryId: current.entryId,
      localizedRoleTitle: options.role,
      facts: current.facts.map((fact, index) => ({
        factId: fact.factId,
        localizedText: options.duties[index]!,
      })),
    }],
  };
}

function work(options: {
  id: string; role: string; employer: string; present: boolean; duties: string[];
  sourceLocale?: Locale;
}): WorkExperience {
  return {
    id: options.id,
    position: options.role,
    company: options.employer,
    startDate: options.present ? '2024-01' : '2021-01',
    endDate: options.present ? '' : '2023-12',
    isPresent: options.present,
    description: options.duties.join('\n'),
    canonicalDescription: options.duties.join('\n'),
    descriptionOrigin: 'user',
    generatedLocale: options.sourceLocale || 'en',
  };
}

function cv(experience: WorkExperience[]): CVData {
  return {
    id: 'aab420-universal-ownership',
    name: 'AAB 420 ownership',
    personal: {
      fullName: 'Private', email: '', phone: '', address: '', jobTitle: '', gender: 'female',
    },
    summary: '', experience, education: [], skills: [], certifications: [], languages: [],
    templateId: 'modern-minimal', region: 'EU',
    createdAt: '2026-01-01', updatedAt: '2026-01-01', contentLocale: 'en',
  };
}

function twoEntryManifest(options: {
  sameDuty?: boolean; sameRole?: boolean; sameEmployer?: boolean; printOwner?: 'current' | 'prior';
} = {}): SummaryV2SelectionManifest {
  const sharedDuty = 'Maintains shared operational records';
  const currentDuties = options.sameDuty
    ? [sharedDuty, 'Coordinates active service requests']
    : ['Coordinates active service requests', 'Maintains current service records'];
  const priorDuties = options.sameDuty
    ? [sharedDuty, 'Reviewed completed archive requests']
    : ['Reviewed completed archive requests', 'Maintained historical service records'];
  if (options.printOwner === 'current') currentDuties[1] = 'Prepares materials for print';
  if (options.printOwner === 'prior') priorDuties[1] = 'Prepared materials for print';
  return buildSummaryV2ManifestForCv({
    cv: cv([
      work({
        id: 'current-entry',
        role: options.sameRole ? 'Operations Steward' : 'Active Service Steward',
        employer: options.sameEmployer ? 'Shared Works' : 'Northstar Labs',
        present: true,
        duties: currentDuties,
      }),
      work({
        id: 'prior-entry',
        role: options.sameRole ? 'Operations Steward' : 'Archive Service Steward',
        employer: options.sameEmployer ? 'Shared Works' : 'Harbor Archive',
        present: false,
        duties: priorDuties,
      }),
    ]),
    locale: 'en',
    referenceDateIso: REF,
  });
}

describe('AAB 420 shared Summary V2 universality and ownership gate', () => {
  it('runs a separate 12 locale × 4 partial-surface matrix (48/48)', () => {
    let executed = 0;
    for (const target of LOCALES) {
      const source = FOREIGN_SOURCE_BY_TARGET[target];
      const manifest = localizationManifest(target, source);
      const targetSurface = SURFACES[target];
      const foreignSurface = SURFACES[source];
      const cases = [
        {
          topology: 'A_target_duties_foreign_arbitrary_role',
          role: foreignSurface.role,
          duties: targetSurface.duties,
          expected: false,
        },
        {
          topology: 'B_target_role_one_foreign_duty',
          role: targetSurface.role,
          duties: [targetSurface.duties[0], foreignSurface.duties[1]],
          expected: false,
        },
        {
          topology: 'C_target_surfaces_protected_latin_employer',
          role: targetSurface.role,
          duties: [
            `${targetSurface.duties[0]} Northstar Labs`,
            targetSurface.duties[1],
          ],
          expected: true,
        },
        {
          topology: 'D_all_valid_target_surfaces',
          role: targetSurface.role,
          duties: targetSurface.duties,
          expected: true,
        },
      ];
      for (const matrixCase of cases) {
        const response = localizationResponse({
          manifest,
          role: matrixCase.role,
          duties: matrixCase.duties,
        });
        const validation = validateSummaryV2LocalizationResponse(manifest, response);
        expect(validation.ok, `${target}/${source}/${matrixCase.topology}`)
          .toBe(matrixCase.expected);
        if (matrixCase.expected) {
          expect(acceptSummaryV2LocalizationResponse({
            manifest,
            response,
            source: 'provider',
          }).manifest, `${target}/${source}/${matrixCase.topology}/accepted`).not.toBeNull();
        }
        executed += 1;
      }
    }
    expect(executed).toBe(48);
  });

  it('maps 12 locale print surfaces to one entry-owned canonical category (24/24)', () => {
    let positive = 0;
    let negative = 0;
    for (const locale of LOCALES) {
      expect(detectSummaryV2MaterialClaimCategories(SURFACES[locale].print, locale), locale)
        .toEqual([SUMMARY_V2_PRINT_MATERIAL_CATEGORY]);
      expect(detectSummaryV2MaterialClaimCategories(SURFACES[locale].duties[0], locale), locale)
        .toEqual([]);

      const withoutAuthority = entry({
        id: `without-print-${locale}`,
        role: SURFACES[locale].role,
        employer: 'Northstar Labs',
        state: 'present',
        duties: SURFACES[locale].duties,
        locale,
      });
      const withoutAuthorityManifest: SummaryV2SelectionManifest = {
        revision: 'aab420-print-negative', snapshotHash: `print-negative-${locale}`,
        locale, gender: 'female', totalDurationMonths: 24,
        durationPhrase: 'duration', styleHintUsed: false, current: withoutAuthority,
        priors: [], requiredCurrentFacts: withoutAuthority.facts,
        requiredPriorFacts: [], maxDutiesPerEntry: 3,
      };
      const withoutAuthorityText = `${SURFACES[locale].role} — Northstar Labs — ${SURFACES[locale].print}`;
      const withoutAuthorityOwnership = analyzeSummaryV2FinalUnitOwnership(
        withoutAuthorityText,
        withoutAuthorityManifest,
        { candidateSource: 'provider' },
      );
      expect(withoutAuthorityOwnership.passed, `${locale}/negative/ownership`).toBe(true);
      expect(auditSummaryV2PrintClaims(
        withoutAuthorityText,
        withoutAuthorityManifest,
        withoutAuthorityOwnership.evidence,
      ).unsupportedPrintClaimCount, `${locale}/negative/authority`).toBe(1);
      negative += 1;

      const withAuthority = entry({
        id: `with-print-${locale}`,
        role: SURFACES[locale].role,
        employer: 'Northstar Labs',
        state: 'present',
        duties: [SURFACES[locale].print],
        locale,
      });
      const withAuthorityManifest: SummaryV2SelectionManifest = {
        ...withoutAuthorityManifest,
        revision: 'aab420-print-positive',
        snapshotHash: `print-positive-${locale}`,
        current: withAuthority,
        requiredCurrentFacts: withAuthority.facts,
      };
      const withAuthorityText = `${SURFACES[locale].role} — Northstar Labs — ${SURFACES[locale].print}`;
      const withAuthorityOwnership = analyzeSummaryV2FinalUnitOwnership(
        withAuthorityText,
        withAuthorityManifest,
        { candidateSource: 'provider' },
      );
      expect(withAuthorityOwnership.passed, `${locale}/positive/ownership`).toBe(true);
      expect(auditSummaryV2PrintClaims(
        withAuthorityText,
        withAuthorityManifest,
        withAuthorityOwnership.evidence,
      ).unsupportedPrintClaimCount, `${locale}/positive/authority`).toBe(0);
      positive += 1;
    }
    expect({ positive, negative }).toEqual({ positive: 12, negative: 12 });
  });

  it('does not borrow the shared print category across entry ownership', () => {
    const manifest = twoEntryManifest({ printOwner: 'prior' });
    const valid = buildSummaryV2DeterministicText(manifest);
    expect(validateSummaryV2AgainstManifest(valid, manifest, {
      candidateSource: 'deterministic', preserveConstructionOrder: true,
    }).ok).toBe(true);
    const currentWithoutAuthority = valid.replace(
      /maintain current service records/iu,
      'Prepares materials for print',
    );
    const invalid = validateSummaryV2AgainstManifest(currentWithoutAuthority, manifest, {
      candidateSource: 'deterministic', preserveConstructionOrder: true,
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.unsupportedPrintClaimCount).toBeGreaterThan(0);
  });

  it('credits exact duplicate duty text only from each fact owning entry unit', () => {
    const manifest = twoEntryManifest({ sameDuty: true, sameRole: true });
    const text = buildSummaryV2DeterministicText(manifest);
    const result = validateSummaryV2AgainstManifest(text, manifest, {
      candidateSource: 'deterministic', preserveConstructionOrder: true,
    });
    expect(result.ok, result.reason || '').toBe(true);
    const duplicateFactIds = [
      manifest.requiredCurrentFacts[0]!.factId,
      manifest.requiredPriorFacts[0]!.factId,
    ];
    const shared = result.factUnitCoverageEvidence.filter((evidence) => (
      duplicateFactIds.includes(evidence.factId)
    ));
    expect(shared).toHaveLength(2);
    expect(shared.every((evidence) => evidence.ownershipPassed && evidence.covered)).toBe(true);
    expect(shared[0]!.owningEntryHash).not.toBe(shared[1]!.owningEntryHash);
    expect(shared[0]!.matchedUnitOwnerHashes).toEqual([shared[0]!.owningEntryHash]);
    expect(shared[1]!.matchedUnitOwnerHashes).toEqual([shared[1]!.owningEntryHash]);
    expect(shared.map((evidence) => evidence.matchedUnitRoleSlots[0])).toEqual([
      'current_role', 'prior_role',
    ]);
  });

  it('uses employer evidence for identical roles/duties and accepts reordered provider units', () => {
    const manifest = twoEntryManifest({ sameDuty: true, sameRole: true });
    const deterministic = buildSummaryV2DeterministicText(manifest);
    const units = deterministic.split(/(?<=[.!?])\s+/u);
    const reordered = [units[0], units[2], units[1]].join(' ');
    const ownership = analyzeSummaryV2FinalUnitOwnership(reordered, manifest, {
      candidateSource: 'provider',
    });
    expect(ownership.passed, ownership.reason || '').toBe(true);
    expect(validateSummaryV2AgainstManifest(reordered, manifest, {
      candidateSource: 'provider',
    }).ok).toBe(true);
  });

  it('fails closed for missing, duplicate, and ambiguous provider role units', () => {
    const unique = twoEntryManifest();
    const text = buildSummaryV2DeterministicText(unique);
    const units = text.split(/(?<=[.!?])\s+/u);
    for (const candidate of [
      units.slice(0, -1).join(' '),
      [...units, units[units.length - 1]].join(' '),
    ]) {
      expect(analyzeSummaryV2FinalUnitOwnership(candidate, unique, {
        candidateSource: 'provider',
      }).passed).toBe(false);
    }

    const duplicatePrior = twoEntryManifest({ sameRole: true, sameEmployer: true });
    const clonedPrior: SummaryV2EntryOwned = {
      ...duplicatePrior.priors[0]!,
      entryId: 'second-identical-prior',
      facts: duplicatePrior.priors[0]!.facts.map((fact, index) => ({
        ...fact,
        entryId: 'second-identical-prior',
        factId: `second-identical-prior-${index}`,
      })),
    };
    const ambiguousManifest: SummaryV2SelectionManifest = {
      ...duplicatePrior,
      priors: [...duplicatePrior.priors, clonedPrior],
      requiredPriorFacts: [
        ...duplicatePrior.requiredPriorFacts,
        ...clonedPrior.facts,
      ],
    };
    const deterministic = buildSummaryV2DeterministicText(ambiguousManifest);
    expect(validateSummaryV2AgainstManifest(deterministic, ambiguousManifest, {
      candidateSource: 'deterministic', preserveConstructionOrder: true,
    }).ok).toBe(true);
    const providerOwnership = analyzeSummaryV2FinalUnitOwnership(deterministic, ambiguousManifest, {
      candidateSource: 'provider',
    });
    expect(providerOwnership.passed).toBe(false);
    expect(providerOwnership.reason).toBe('final_unit_entry_ownership_ambiguous');
  });

  it('preserves ownership with three prior entries and overlapping duty text', () => {
    const experiences = [
      work({ id: 'current', role: 'Current Steward', employer: 'Current Works', present: true, duties: ['Maintains shared operational records'] }),
      work({ id: 'prior-a', role: 'Prior Alpha', employer: 'Alpha Works', present: false, duties: ['Maintains shared operational records'] }),
      work({ id: 'prior-b', role: 'Prior Beta', employer: 'Beta Works', present: false, duties: ['Maintains shared operational records'] }),
      work({ id: 'prior-c', role: 'Prior Gamma', employer: 'Gamma Works', present: false, duties: ['Maintains shared operational records'] }),
    ];
    const snapshot = captureSummaryV2Snapshot({
      cv: cv(experiences), locale: 'en', gender: 'female', referenceDateIso: REF,
    });
    const current = snapshot.entries.find((candidate) => candidate.entryId === 'current')!;
    const priors = snapshot.entries.filter((candidate) => candidate.entryId !== 'current');
    const manifest: SummaryV2SelectionManifest = {
      revision: 'aab420-three-prior-ownership', snapshotHash: 'three-prior', locale: 'en',
      gender: 'female', totalDurationMonths: snapshot.totalDurationMonths,
      durationPhrase: snapshot.durationPhrase, styleHintUsed: false, current, priors,
      requiredCurrentFacts: current.facts,
      requiredPriorFacts: priors.flatMap((candidate) => candidate.facts),
      maxDutiesPerEntry: 3,
    };
    const text = buildSummaryV2DeterministicText(manifest);
    const result = validateSummaryV2AgainstManifest(text, manifest, {
      candidateSource: 'deterministic', preserveConstructionOrder: true,
    });
    expect(result.ok, result.reason || '').toBe(true);
    expect(result.finalUnitOwnership.filter((unit) => unit.roleSlot === 'prior_role'))
      .toHaveLength(3);
    expect(new Set(result.factUnitCoverageEvidence.map((fact) => fact.owningEntryHash)).size)
      .toBe(4);
  });

  it('repairs only the foreign partial surface through transport and final pipeline (24/24)', async () => {
    const failures: Array<{
      target: Locale;
      source: Locale;
      topology: 'role' | 'fact';
      resolvedEntrySourceLocale: Locale;
      transportCallCount: number;
      roleSurfaceCount: number;
      factSurfaceCount: number;
      reason: string | null;
    }> = [];
    const evidence: Array<{
      target: Locale;
      source: Locale;
      topology: 'role' | 'fact';
      roleSurfaceCount: number;
      factSurfaceCount: number;
      bypassedSurfaceCount: number;
      protectedEntityCount: number;
      sourceEntryHash: string;
      recombinedEntryHash: string;
      entryIdentityParity: boolean;
      factIdParity: boolean;
      provenance: string[];
      acceptedLocale: Locale;
      finalSurfaceValidationPassed: boolean;
    }> = [];

    for (const target of LOCALES) {
      const source = FOREIGN_SOURCE_BY_TARGET[target];
      for (const topology of ['role', 'fact'] as const) {
        clearSummaryV2LocalizationCacheForTests();
        const targetSurface = SURFACES[target];
        const foreignSurface = SURFACES[source];
        const id = `partial-${topology}-${target}-${source}`;
        const sourceCv = cv([work({
          id,
          role: topology === 'role' ? foreignSurface.role : targetSurface.role,
          employer: 'Northstar Labs',
          present: true,
          duties: topology === 'fact'
            ? [targetSurface.duties[0], foreignSurface.duties[1]]
            : targetSurface.duties,
          // The entry itself belongs to the target-locale CV; only one embedded
          // linguistic surface is foreign and must be routed to localization.
          sourceLocale: target,
        })]);
        sourceCv.contentLocale = target;
        const manifest = buildSummaryV2ManifestForCv({
          cv: sourceCv,
          locale: target,
          gender: 'female',
          referenceDateIso: REF,
        });
        const current = manifest.current!;
        const authority = classifySummaryV2EntrySurfaceAuthority({ manifest, entry: current });
        expect(authority.roleTitleTargetNative, `${target}/${source}/${topology}/role-authority`)
          .toBe(topology === 'fact');
        expect(authority.localizationRequiredFactIds, `${target}/${source}/${topology}/fact-authority`)
          .toEqual(topology === 'fact' ? [current.facts[1]!.factId] : []);

        const calls: SummaryV2LocalizationTransportInput[] = [];
        const targetDutyByFactId = new Map(current.facts.map((fact, index) => [
          fact.factId,
          targetSurface.duties[index]!,
        ]));
        const outcome = await localizeSummaryV2Manifest({
          manifest,
          transport: async (input) => {
            calls.push(input);
            const requested = input.entries[0]!;
            return {
              targetLocale: target,
              entries: [{
                entryId: requested.entryId,
                localizedRoleTitle: topology === 'role'
                  ? targetSurface.role
                  : requested.roleTitle,
                facts: requested.facts.map((fact) => ({
                  factId: fact.factId,
                  localizedText: targetDutyByFactId.get(fact.factId)!,
                })),
              }],
            };
          },
        });
        const request = calls[0]?.entries[0];
        if (!request) {
          failures.push({
            target,
            source,
            topology,
            resolvedEntrySourceLocale: current.sourceLocale,
            transportCallCount: calls.length,
            roleSurfaceCount: 0,
            factSurfaceCount: 0,
            reason: outcome.reason,
          });
          continue;
        }
        const roleSurfaceCount = request.translateRoleTitle ? 1 : 0;
        const factSurfaceCount = request.facts.length;
        const expectedCounts = topology === 'role'
          ? { roleSurfaceCount: 1, factSurfaceCount: 0 }
          : { roleSurfaceCount: 0, factSurfaceCount: 1 };
        if (
          calls.length !== 1
          || roleSurfaceCount !== expectedCounts.roleSurfaceCount
          || factSurfaceCount !== expectedCounts.factSurfaceCount
          || !outcome.manifest
        ) {
          failures.push({
            target,
            source,
            topology,
            resolvedEntrySourceLocale: current.sourceLocale,
            transportCallCount: calls.length,
            roleSurfaceCount,
            factSurfaceCount,
            reason: outcome.reason,
          });
          continue;
        }
        expect({ roleSurfaceCount, factSurfaceCount }, `${target}/${source}/${topology}/granularity`)
          .toEqual(expectedCounts);
        expect(request.employer).toBe('Northstar Labs');
        expect(outcome.reason, `${target}/${source}/${topology}/outcome`).toBeNull();
        expect(outcome.validation?.ok, `${target}/${source}/${topology}/localization-validation`)
          .toBe(true);
        expect(outcome.localizationSource).toBe('mixed_authoritative');
        expect(outcome.manifest?.targetLocale).toBe(target);

        const localized = outcome.manifest!.entries[0]!;
        expect(localized.entryId).toBe(current.entryId);
        expect(localized.employer).toBe(current.employer);
        expect(localized.localizedRoleTitle).toBe(targetSurface.role);
        expect(localized.facts.map((fact) => fact.factId)).toEqual(current.facts.map((fact) => fact.factId));
        expect(localized.facts.map((fact) => fact.localizedText)).toEqual(targetSurface.duties);
        if (topology === 'role') {
          expect(localized.localizedRoleTitleLocalizationSource).toBe('provider');
          expect(localized.facts.map((fact) => fact.localizationSource))
            .toEqual(['same_locale_authoritative', 'same_locale_authoritative']);
        } else {
          expect(localized.localizedRoleTitleLocalizationSource).toBe('same_locale_authoritative');
          expect(localized.facts.map((fact) => fact.localizationSource))
            .toEqual(['same_locale_authoritative', 'provider']);
        }

        const projected = projectLocalizedSummaryV2Manifest({
          manifest,
          localized: outcome.manifest!,
        });
        expect(projected, `${target}/${source}/${topology}/projection`).not.toBeNull();
        expect(projected!.current!.entryId).toBe(current.entryId);
        expect(projected!.current!.startDate).toBe(current.startDate);
        expect(projected!.current!.endDate).toBe(current.endDate);
        expect(projected!.current!.facts.map((fact) => fact.factId))
          .toEqual(current.facts.map((fact) => fact.factId));
        const providerInput = buildSummaryV2ProviderExperienceEntries({
          manifest,
          localized: outcome.manifest!,
        });
        expect(providerInput, `${target}/${source}/${topology}/provider-input`).not.toBeNull();
        expect(providerInput![0]!.position).toBe(targetSurface.role);
        expect(providerInput![0]!.company).toBe('Northstar Labs');
        expect(providerInput![0]!.description).toContain(targetSurface.duties[0]);
        expect(providerInput![0]!.description).toContain(targetSurface.duties[1]);

        const pipeline = runSummaryV2({
          cv: sourceCv,
          locale: target,
          gender: 'female',
          candidate: '',
          referenceDateIso: REF,
          localizedManifest: outcome.manifest,
        });
        expect(pipeline.blocked, `${target}/${source}/${topology}/pipeline-blocked`).toBe(false);
        expect(pipeline.countedAsSuccess, `${target}/${source}/${topology}/pipeline-eligible`).toBe(true);
        expect(pipeline.validation.ok, `${target}/${source}/${topology}/final-validation`).toBe(true);
        expect(pipeline.validation.roleTitleSurfaceValidationPassed).toBe(true);
        expect(pipeline.validation.unitOwnershipValidationPassed).toBe(true);
        expect(pipeline.validation.factUnitOwnershipValidationPassed).toBe(true);
        const finalSurfaces = [
          pipeline.text,
          providerInput![0]!.position,
          providerInput![0]!.description,
        ].join('\n');
        const foreignRawSurface = topology === 'role'
          ? foreignSurface.role
          : foreignSurface.duties[1];
        expect(finalSurfaces.includes(foreignRawSurface), `${target}/${source}/${topology}/foreign-residue`)
          .toBe(false);

        evidence.push({
          target,
          source,
          topology,
          roleSurfaceCount,
          factSurfaceCount,
          bypassedSurfaceCount: 2,
          protectedEntityCount: 1,
          sourceEntryHash: hashSummaryV2Text(current.entryId),
          recombinedEntryHash: hashSummaryV2Text(localized.entryId),
          entryIdentityParity: localized.entryId === current.entryId,
          factIdParity: localized.facts.map((fact) => fact.factId).join('|')
            === current.facts.map((fact) => fact.factId).join('|'),
          provenance: [
            localized.localizedRoleTitleLocalizationSource,
            ...localized.facts.map((fact) => fact.localizationSource),
          ],
          acceptedLocale: outcome.manifest!.targetLocale,
          finalSurfaceValidationPassed: pipeline.validation.ok,
        });
      }
    }

    expect(failures, JSON.stringify(failures)).toEqual([]);
    expect(evidence).toHaveLength(24);
    expect(evidence.every((row) => (
      row.sourceEntryHash === row.recombinedEntryHash
      && row.entryIdentityParity
      && row.factIdParity
      && row.bypassedSurfaceCount === 2
      && row.protectedEntityCount === 1
      && row.acceptedLocale === row.target
      && row.finalSurfaceValidationPassed
    ))).toBe(true);
  });

  it('keeps one surface plan through homogeneous, mixed, cache, repair, recovery, and uncertain controls', async () => {
    const target = 'ar' as const;
    const native = SURFACES.ar;
    const foreign = SURFACES.en;
    const makeManifest = (id: string, role: string, duties: string[], sourceLocale: Locale) => {
      const sourceCv = cv([work({
        id, role, duties, sourceLocale, employer: 'Northstar Labs', present: true,
      })]);
      sourceCv.contentLocale = target;
      return buildSummaryV2ManifestForCv({
        cv: sourceCv, locale: target, gender: 'female', referenceDateIso: REF,
      });
    };
    const localizedResponse = (
      input: SummaryV2LocalizationTransportInput,
      role: string,
      facts: Map<string, string>,
    ): SummaryV2LocalizationProviderResponse => ({
      targetLocale: input.targetLocale,
      entries: input.entries.map((requested) => ({
        entryId: requested.entryId,
        localizedRoleTitle: role,
        facts: requested.facts.map((fact) => ({
          factId: fact.factId,
          localizedText: facts.get(fact.factId) || '',
        })),
      })),
    });

    clearSummaryV2LocalizationCacheForTests();
    const allTarget = makeManifest('all-target', native.role, native.duties, target);
    let noTransportCalls = 0;
    const allTargetOutcome = await localizeSummaryV2Manifest({
      manifest: allTarget,
      transport: async () => { noTransportCalls += 1; throw new Error('unexpected transport'); },
    });
    expect(noTransportCalls).toBe(0);
    expect(allTargetOutcome.surfaceTransportPlans[0]).toMatchObject({
      plannedRoleSurfaceCount: 0, plannedFactSurfaceCount: 0,
      actualRoleSurfaceCount: 0, actualFactSurfaceCount: 0,
      bypassedSurfaceCount: 3, protectedSurfaceCount: 1,
    });

    clearSummaryV2LocalizationCacheForTests();
    const allForeign = makeManifest('all-foreign', foreign.role, foreign.duties, 'en');
    const allForeignFacts = new Map(allForeign.current!.facts.map((fact, index) => [
      fact.factId, native.duties[index]!,
    ]));
    const wholeRequests: SummaryV2LocalizationTransportInput[] = [];
    const allForeignOutcome = await localizeSummaryV2Manifest({
      manifest: allForeign,
      transport: async (input) => {
        wholeRequests.push(input);
        return localizedResponse(input, native.role, allForeignFacts);
      },
    });
    expect(wholeRequests[0]!.entries[0]!.translateRoleTitle).toBe(true);
    expect(wholeRequests[0]!.entries[0]!.facts).toHaveLength(2);
    expect(allForeignOutcome.localizationSource).toBe('provider');

    clearSummaryV2LocalizationCacheForTests();
    const mixed = makeManifest(
      'mixed-cache', foreign.role, [foreign.duties[0], native.duties[1]], target,
    );
    const mixedFact = mixed.current!.facts[0]!;
    const mixedFacts = new Map([[mixedFact.factId, native.duties[0]]]);
    const mixedRequests: SummaryV2LocalizationTransportInput[] = [];
    const mixedOutcome = await localizeSummaryV2Manifest({
      manifest: mixed,
      transport: async (input) => {
        mixedRequests.push(input);
        return localizedResponse(input, native.role, mixedFacts);
      },
    });
    expect(mixedRequests[0]!.entries[0]!.translateRoleTitle).toBe(true);
    expect(mixedRequests[0]!.entries[0]!.facts.map((fact) => fact.factId))
      .toEqual([mixedFact.factId]);
    expect(mixedOutcome.surfaceTransportPlans[0]).toMatchObject({
      plannedRoleSurfaceCount: 1, plannedFactSurfaceCount: 1,
      actualRoleSurfaceCount: 1, actualFactSurfaceCount: 1,
      bypassedSurfaceCount: 1, protectedSurfaceCount: 1,
    });

    const changed = makeManifest(
      'mixed-cache', foreign.role,
      ['I coordinate the archive with detailed records.', native.duties[1]], target,
    );
    const changedFact = changed.current!.facts[0]!;
    const changedFacts = new Map([[changedFact.factId, native.duties[0]]]);
    const cacheRequests: SummaryV2LocalizationTransportInput[] = [];
    const cachedOutcome = await localizeSummaryV2Manifest({
      manifest: changed,
      transport: async (input) => {
        cacheRequests.push(input);
        return localizedResponse(input, native.role, changedFacts);
      },
    });
    expect(cacheRequests[0]!.entries[0]!.translateRoleTitle).toBe(false);
    expect(cacheRequests[0]!.entries[0]!.facts.map((fact) => fact.factId))
      .toEqual([changedFact.factId]);
    expect(cachedOutcome.manifest?.entries[0]!.localizedRoleTitleLocalizationSource)
      .toBe('validated_cache');
    expect(cachedOutcome.manifest?.entries[0]!.facts.map((fact) => fact.localizationSource))
      .toEqual(['provider', 'same_locale_authoritative']);

    clearSummaryV2LocalizationCacheForTests();
    const parity = makeManifest(
      'attempt-parity', foreign.role, [foreign.duties[0], native.duties[1]], target,
    );
    const parityFact = parity.current!.facts[0]!;
    const good = new Map([[parityFact.factId, native.duties[0]]]);
    const bad = new Map([[parityFact.factId, foreign.duties[0]]]);
    const providerCalls: SummaryV2LocalizationTransportInput[] = [];
    const recoveryCalls: SummaryV2LocalizationTransportInput[] = [];
    const recovered = await localizeSummaryV2Manifest({
      manifest: parity,
      transport: async (input) => {
        providerCalls.push(input);
        return localizedResponse(input, foreign.role, bad);
      },
      recoveryTransport: async (input) => {
        recoveryCalls.push(input);
        return localizedResponse(input, native.role, good);
      },
    });
    expect(providerCalls).toHaveLength(2);
    expect(recoveryCalls).toHaveLength(1);
    const canonicalPlan = (input: SummaryV2LocalizationTransportInput) => ({
      entryId: input.entries[0]!.entryId,
      role: input.entries[0]!.translateRoleTitle,
      facts: input.entries[0]!.facts.map((fact) => fact.factId),
      employer: input.entries[0]!.employer,
    });
    expect(canonicalPlan(providerCalls[0]!)).toEqual(canonicalPlan(providerCalls[1]!));
    expect(canonicalPlan(providerCalls[0]!)).toEqual(canonicalPlan(recoveryCalls[0]!));
    expect(recovered.localizationRecoveryAccepted).toBe(true);
    expect(recovered.manifest).not.toBeNull();

    const uncertain = entry({
      id: 'uncertain', role: '---', employer: 'Northstar Labs', state: 'present',
      duties: [SURFACES.en.duties[0]], locale: 'en',
    });
    const uncertainManifest: SummaryV2SelectionManifest = {
      revision: 'uncertain', snapshotHash: 'uncertain', locale: 'en', gender: 'female',
      totalDurationMonths: 12, durationPhrase: 'one year', styleHintUsed: false,
      current: uncertain, priors: [], requiredCurrentFacts: uncertain.facts,
      requiredPriorFacts: [], maxDutiesPerEntry: 3,
    };
    expect(buildSummaryV2EntrySurfaceTransportPlan({
      manifest: uncertainManifest, entry: uncertain,
    }).role.authority).toBe('uncertain_rejected');
    let uncertainCalls = 0;
    const uncertainOutcome = await localizeSummaryV2Manifest({
      manifest: uncertainManifest,
      transport: async () => { uncertainCalls += 1; throw new Error('unexpected transport'); },
    });
    expect(uncertainCalls).toBe(0);
    expect(uncertainOutcome.reason).toBe('localization_surface_authority_uncertain');
  });

  it('applies identical negative final gates to all four candidate source kinds', () => {
    const manifest = twoEntryManifest();
    const valid = buildSummaryV2DeterministicText(manifest);
    const units = valid.split(/(?<=[.!?])\s+/u);
    const swappedDuties = [
      units[0],
      units[1]!.replace('coordinate active service requests', 'reviewed completed archive requests'),
      units[2]!.replace('reviewed completed archive requests', 'coordinate active service requests'),
    ].join(' ');
    const invalidCandidates = {
      foreign_role: valid.replace('Active Service Steward', 'Responsable de archivos comunitarios'),
      foreign_duty: valid.replace('coordinate active service requests', 'coordino solicitudes del archivo'),
      unsupported_material_claim: valid.replace('current service records', 'current service records for print'),
      cross_entry_ownership: swappedDuties,
      invalid_native_perspective: valid.replace('where I coordinate', 'where she coordinates'),
    };
    const sources: SummaryV2CandidateSourceKind[] = [
      'provider', 'repaired_provider', 'deterministic', 'final_selected',
    ];
    let executed = 0;
    for (const source of sources) {
      for (const [kind, candidate] of Object.entries(invalidCandidates)) {
        const result = validateSummaryV2AgainstManifest(candidate, manifest, {
          candidateSource: source,
          preserveConstructionOrder: source === 'deterministic',
        });
        expect(result.ok, `${source}/${kind}`).toBe(false);
        executed += 1;
      }
    }
    expect(executed).toBe(20);
  });
});
