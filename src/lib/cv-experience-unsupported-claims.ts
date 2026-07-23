/**
 * Experience AI grounding: detect unsupported factual expansions beyond
 * source-duty coverage. Coverage of source anchors is necessary but not
 * sufficient — quality/standards/scope/leadership escalations must fail closed.
 */

/** Packaged asset marker — must survive minification / DCE. */
export const EXPERIENCE_AI_UNSUPPORTED_EXPANSION_REVISION =
  'experience-ai-unsupported-expansion-295-v1' as const;

export type ExperienceUnsupportedClaimKind =
  | 'quality_claim'
  | 'standards_compliance_claim'
  | 'universal_scope_claim'
  | 'organization_responsibility_claim'
  | 'leadership_claim'
  | 'unsupported_tool_claim'
  | 'unsupported_metric_claim'
  | 'unsupported_generated_duty'
  | 'guarantee_escalation'
  | 'assurance_escalation'
  | 'responsibility_escalation'
  | 'outcome_ownership'
  | 'quality_guarantee'
  | 'completeness_guarantee'
  | 'compliance_guarantee'
  | 'efficiency_claim'
  | 'performance_claim'
  | 'optimization_claim'
  | 'productivity_claim'
  | 'speed_claim'
  | 'accuracy_claim'
  | 'error_free_claim'
  | 'object_scope_expansion'
  | 'logistics_scope_expansion'
  | 'unsupported_object_expansion'
  | 'action_scope_expansion'
  | 'coordinated_predicate_expansion'
  | 'document_management_expansion'
  | 'workflow_expansion'
  | 'approval_authority_expansion'
  | 'supervision_expansion'
  | 'compliance_scope_expansion'
  | 'conformity_object_expansion'
  | 'certification_scope_expansion'
  | 'approval_scope_expansion'
  | 'quality_scope_expansion';

export type ExperienceUnsupportedClaimScan = {
  kinds: ExperienceUnsupportedClaimKind[];
  count: number;
  /** Safe categorical labels (no raw user/provider text). */
  labels: string[];
  scopeExpansionDetected: boolean;
  universalQuantifierDetected: boolean;
  responsibilityEscalationDetected: boolean;
};

function norm(text: string): string {
  return (text || '').normalize('NFKC');
}

function hasQualitySupport(source: string): boolean {
  return /(?:kvalitet|Qualität|qualit(?:y|ät)|quality\s+(?:control|inspection|assurance|check)|kontrola?\s+kvalitet|qc\b|Qualitäts(?:kontrolle|prüfung|sicherung))/iu
    .test(source);
}

function hasStandardsSupport(source: string): boolean {
  return /(?:\bstandard|compliance|regulacij|propis|procedur|politik|važeć\w*\s+standard|Vorschrift|Richtlinie)/iu
    .test(source);
}

function hasUniversalScopeSupport(source: string): boolean {
  return /(?:\bsvih\b|\bcjelokupn\w*\b|\bsve\s+(?:dokumentacije|robe|artikle|artikala|uskladišten)\b|\ball\s+(?:stored|goods|items|documentation|records)\b|\bevery\s+(?:item|good|document)\b|\bentire\s+|\bsämtlich\w*\b|\balle\s+(?:Prozesse|Waren|Bereiche|Unterlagen)\b|\bunternehmensweit\b|\bdurchgängig\b)/iu
    .test(source);
}

function hasOrganizationVerbSupport(source: string): boolean {
  // Verb stems only — adjective "organiziran(o)" is not ownership escalation.
  return /\b(?:organizira(?:la|lo|li|ju|ti)?|organizuje(?:m|š|mo|te|ju)?|organizovala|organizovao|organise[ds]?|organizes?|organising|organizing|verantwortlich\s+für|Steuerung|Überwachung)\b/iu
    .test(source);
}

function hasLeadershipSupport(source: string): boolean {
  return /\b(?:vodi\s+tim|vodila\s+tim|vodio\s+tim|nadzir(?:e|ala|ao)|upravlja(?:la|o)?\s+(?:tim|aktivnost)|managed?\s+a\s+team|led\s+a\s+team|leadership|supervis(?:e|ed|ing|ion)|Leitung|Führung|führt\s+das\s+Team|leitet\s+das\s+Team)\b/iu
    .test(source);
}

function hasToolSupport(source: string, tool: string): boolean {
  return new RegExp(`\\b${tool}\\b`, 'iu').test(source);
}

/**
 * Semantic unsupported-claim scan for Experience enhancement / no-op repair.
 * Does not store or return source/candidate text — only categorical kinds.
 */
export function detectExperienceUnsupportedClaimExpansion(
  sourceDescription: string,
  candidateDescription: string,
): ExperienceUnsupportedClaimScan {
  const source = norm(sourceDescription);
  const joined = norm(candidateDescription);
  const kinds: ExperienceUnsupportedClaimKind[] = [];
  const labels: string[] = [];

  if (!joined.trim()) {
    return {
      kinds: [],
      count: 0,
      labels: [],
      scopeExpansionDetected: false,
      universalQuantifierDetected: false,
      responsibilityEscalationDetected: false,
    };
  }

  // Quality inspection / QC — distinct from ispravnost / condition / correctness.
  if (
    /(?:provjer\w*|prover\w*|pregled\w*|kontrola?|check(?:s|ing)?|inspect(?:s|ion|ing)?|prüf\w*|kontroll\w*).{0,24}(?:kvalitet|quality|Qualität)|(?:kvalitet|quality|Qualität).{0,24}(?:provjer|prover|pregled|kontrol|check|inspect|prüf|kontroll)|(?:kontrola?\s+kvalitet|quality\s+(?:control|inspection|assurance)|Qualitäts(?:kontrolle|prüfung|sicherung|steigerung)|höchste\s+Qualität|hervorragende\s+Qualität|Sicherstellung\s+höchster\s+Standards)/iu
      .test(joined)
    && !hasQualitySupport(source)
  ) {
    kinds.push('quality_claim');
    labels.push('quality_claim');
  }

  // Standards / compliance / regulations — not "usklađuje aktivnosti s timom".
  if (
    /(?:usklađenost.{0,48}(?:standard|propis|regulacij|procedur|politik)|(?:važeć\w*|važeći|važećim)\s+standard\w*|s\s+važećim\s+standardima|poštuje.{0,24}standard|osigurava\s+usklađenost|compliance|regulacij\w*|propisima|prema\s+(?:važeć\w*\s+)?standard|Sicherstellung\s+höchster\s+Standards|nach\s+(?:geltenden\s+)?Standards?|Vorschriften)/iu
      .test(joined)
    && !hasStandardsSupport(source)
  ) {
    kinds.push('standards_compliance_claim');
    labels.push('standards_compliance_claim');
  }

  // Universal quantifiers that expand factual scope.
  if (
    /(?:\bsvih\b|\bcjelokupn\w*\b|\bsve\s+(?:dokumentacije|robe|artikle|artikala)\b|\ball\s+(?:stored|goods|items|documentation|records)\b|\bevery\s+(?:stored\s+)?(?:item|good|document)\b|\bentire\s+(?:warehouse|inventory|stock)\b|\bsämtlich\w*\b|\balle\s+Prozesse\b|\bin\s+allen\s+Bereichen\b|\bunternehmensweit\b|\bdurchgängig\b)/iu
      .test(joined)
    && !hasUniversalScopeSupport(source)
  ) {
    kinds.push('universal_scope_claim');
    labels.push('universal_scope_claim');
  }

  // Organization verb escalation (not adjective "organizirano skladištenje").
  if (
    /\b(?:organizira(?:la|lo|li|ju)?|organizuje|organizovala|organizovao|organises?|organizes?|verantwortlich\s+für\s+den\s+gesamten|vollständige\s+Verantwortung|Steuerung\s+des\s+gesamten|Überwachung\s+aller)\b/iu
      .test(joined)
    && !hasOrganizationVerbSupport(source)
  ) {
    kinds.push('organization_responsibility_claim');
    labels.push('organization_responsibility_claim');
  }

  // Leadership / supervision / managing a team.
  if (
    /\b(?:vodi\s+tim|vodila\s+tim|vodio\s+tim|nadzir(?:e|ala|ao)\b|nadzire\s+(?:rad|koleg|skladišt)|upravlja(?:la|o)?\s+(?:tim|aktivnost)|managed?\s+a\s+team|led\s+a\s+team|leadership|supervis(?:e|ed|ing|ion)\b|\bLeitung\b|\bFührung\b|führt\s+das\s+Team|leitet\s+das\s+Team)/iu
      .test(joined)
    && !hasLeadershipSupport(source)
  ) {
    kinds.push('leadership_claim');
    labels.push('leadership_claim');
  }

  for (const tool of ['Excel', 'Salesforce', 'Slack', 'Jira', 'SAP', 'Tableau', 'Photoshop', 'Illustrator', 'InDesign', 'Adobe'] as const) {
    if (new RegExp(`\\b${tool}\\b`, 'iu').test(joined) && !hasToolSupport(source, tool)) {
      kinds.push('unsupported_tool_claim');
      labels.push('unsupported_tool_claim');
      break;
    }
  }

  if (
    (/\b(?:KPI|OKRs?|ROI)\b/iu.test(joined) || /\d+\s*%|\bProduktivitätssteigerung\b|\bEinsparungen?\b/iu.test(joined))
    && !(/\b(?:KPI|OKRs?|ROI)\b/iu.test(source) || /\d+\s*%/.test(source))
  ) {
    kinds.push('unsupported_metric_claim');
    labels.push('unsupported_metric_claim');
  }

  const uniqueKinds = [...new Set(kinds)];
  const uniqueLabels = [...new Set(labels)];
  return {
    kinds: uniqueKinds,
    count: uniqueKinds.length,
    labels: uniqueLabels,
    scopeExpansionDetected: uniqueKinds.includes('standards_compliance_claim')
      || uniqueKinds.includes('quality_claim')
      || uniqueKinds.includes('universal_scope_claim'),
    universalQuantifierDetected: uniqueKinds.includes('universal_scope_claim'),
    responsibilityEscalationDetected: uniqueKinds.includes('organization_responsibility_claim')
      || uniqueKinds.includes('leadership_claim'),
  };
}

export function experienceUnsupportedClaimRejectionReason(
  scan: ExperienceUnsupportedClaimScan,
): string | null {
  if (scan.count <= 0) return null;
  if (scan.kinds.includes('quality_claim')) return 'unsupported_quality_claim';
  if (scan.kinds.includes('standards_compliance_claim')) {
    return 'unsupported_standards_compliance_claim';
  }
  if (scan.kinds.includes('universal_scope_claim')) return 'unsupported_universal_scope_claim';
  if (scan.kinds.includes('organization_responsibility_claim')) {
    return 'unsupported_organization_responsibility_claim';
  }
  if (scan.kinds.includes('leadership_claim')) return 'unsupported_leadership_claim';
  return 'unsupported_generated_duty';
}
