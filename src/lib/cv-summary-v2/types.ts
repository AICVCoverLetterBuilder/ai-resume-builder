import type { Locale } from '@/lib/i18n/translations';

export type SummaryV2EmploymentState = 'present' | 'completed';

export type SummaryV2EntryFact = {
  factId: string;
  entryId: string;
  bulletText: string;
  /** Lowercase significant tokens for coverage matching. */
  tokenStems: string[];
  sourceFactHash: string;
};

export type SummaryV2EntryOwned = {
  entryId: string;
  role: string;
  employer: string;
  startDate: string;
  endDate: string;
  isPresent: boolean;
  employmentState: SummaryV2EmploymentState;
  /** Hash of live description used at snapshot time. */
  descriptionHash: string;
  /** All live bullets (pre-selection). */
  facts: SummaryV2EntryFact[];
};

export type SummaryV2Snapshot = {
  revision: string;
  capturedAtIso: string;
  referenceDateIso: string;
  locale: Locale;
  gender: string;
  /** Existing Summary — style hint only; never factual authority. */
  styleHintSummary: string;
  entries: SummaryV2EntryOwned[];
  totalDurationMonths: number;
  durationApproxYears: number | null;
  durationPhrase: string;
};

export type SummaryV2SelectionManifest = {
  revision: string;
  snapshotHash: string;
  locale: Locale;
  gender: string;
  totalDurationMonths: number;
  durationPhrase: string;
  styleHintUsed: boolean;
  current: SummaryV2EntryOwned | null;
  /** Bounded prior entries (ownership preserved; no cross-entry merge). */
  priors: SummaryV2EntryOwned[];
  requiredCurrentFacts: SummaryV2EntryFact[];
  requiredPriorFacts: SummaryV2EntryFact[];
  maxDutiesPerEntry: number;
};

export type SummaryV2ValidationResult = {
  ok: boolean;
  reason: string | null;
  requiredCurrentFactCount: number;
  coveredCurrentFactCount: number;
  requiredPriorFactCount: number;
  coveredPriorFactCount: number;
  durationExpressionCount: number;
  currentRolePresent: boolean;
  currentEmployerPresent: boolean;
  currentStateExpressed: boolean;
  priorRolePresent: boolean;
  priorEmployerPresent: boolean;
  priorStateExpressed: boolean;
  /** EN: current-entry duties appear in present tense from employmentState. */
  currentDutyTenseOk: boolean;
  /** EN: completed-entry duties appear in past tense from employmentState. */
  priorDutyTenseOk: boolean;
  staleResidueDetected: boolean;
  unsupportedClaimCount: number;
};

export type SummaryV2PipelineResult = {
  blocked: boolean;
  reason?: string;
  text: string;
  origin: 'ai_generated' | 'ai_repaired' | 'deterministic_fallback';
  countedAsSuccess: boolean;
  manifest: SummaryV2SelectionManifest;
  validation: SummaryV2ValidationResult;
  snapshot: SummaryV2Snapshot;
  /** Rewrite-style / provider rejection lineage (AAB-384). */
  pipelineDiagnostics?: {
    rewriteStyle: 'shorter' | 'stronger' | 'professional' | null;
    rewriteStylePropagatedToProvider: boolean;
    rewriteStylePropagatedToRepair: boolean;
    rewriteStylePropagatedToDeterministic: boolean;
    providerRejectionReason: string | null;
    providerRejectionReasons: string[];
    repairAttempted: boolean;
    repairApplied: boolean;
    candidateTransformationKind: string | null;
    candidateTransformationBeforeHash: string | null;
    candidateTransformationAfterHash: string | null;
    styleFulfillment: {
      shorterStyleFulfilled: boolean;
      strongerStyleFulfilled: boolean;
      professionalStyleFulfilled: boolean;
      styleValidationPassed: boolean;
      styleRejectionReasons: string[];
      selectedCandidateMateriallyDiffersFromSource: boolean;
      selectedCandidateDiffersFromOtherStyleFixtures?: boolean | null;
      sourceNormalizedLength: number;
      candidateNormalizedLength: number;
      lengthDelta: number;
      lengthDeltaPercent: number;
      sourceUnitCount: number;
      candidateUnitCount: number;
      sourceClauseCount: number;
      candidateClauseCount: number;
      unitDelta: number;
      clauseDelta: number;
      localeAwareShorterThresholdPercent: number | null;
      semanticStyleOperationsApplied: string[];
      markerOnlyStyleChange: boolean;
      styleMaterialityPassed?: boolean;
      nativeSurfaceValidationPassed?: boolean;
      nativeSurfaceRejectionReasons?: string[];
      capitalizationValidationPassed?: boolean;
      grammaticalPersonValidationPassed?: boolean;
      currentTenseValidationPassed?: boolean;
      priorTenseValidationPassed?: boolean;
      finiteClauseValidationPassed?: boolean;
      nativePunctuationValidationPassed?: boolean;
      internalMarkerLeakageDetected?: boolean;
      englishMorphologyLeakageDetected?: boolean;
      unresolvedGenderPlaceholderDetected?: boolean;
      finiteDurationSentencePassed?: boolean;
      firstPersonPredicateChainPassed?: boolean;
      localeVerbMorphologyPassed?: boolean;
      roleCaseValidationPassed?: boolean;
      nativeCoordinationValidationPassed?: boolean;
      sentenceCompletenessPassed?: boolean;
      structuralCompressionCount?: number;
      coordinatedPredicateCount?: number;
      transformedCoordinatedPredicateCount?: number;
      untransformedFinitePredicateCount?: number;
      mixedPersonPredicateDetected?: boolean;
      mixedTensePredicateDetected?: boolean;
      predicateChainValidationPassed?: boolean;
      predicateChainRejectionReasons?: string[];
      sourcePredicateChainHash?: string;
      finalPredicateChainHash?: string;
      repeatedStyleModifierCount?: number;
      repeatedStyleModifierLemmas?: string[];
      stackedModifierDetected?: boolean;
      modifierOnlyTransformationDetected?: boolean;
      strongerVerbTransformationCount?: number;
      structuralStrengtheningCount?: number;
      nativeStrongSurfacePassed?: boolean;
      nativeStrongSurfaceRejectionReasons?: string[];
    } | null;
    styleNoSafeMaterialChange: boolean;
  };
};
