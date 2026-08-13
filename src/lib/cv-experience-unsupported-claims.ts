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
  | 'quality_scope_expansion'
  | 'project_scope_expansion'
  | 'requirements_scope_expansion'
  | 'standards_scope_expansion'
  | 'unsupported_modifier_expansion'
  | 'frequency_scope_claim'
  | 'repeated_generic_enrichment';

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

function hasFrequencyScopeSupport(source: string): boolean {
  return /(?:\bdaily\b|\bweekly\b|\bregularly\b|\bevery\s+(?:day|week)\b|\bday-to-day\b|\bdnevno\b|\bsvakodnev\w*\b|\bredovit\w*\b|\btäglich\b|दैनिक|प्रतिदिन|साप्ताहिक|नियमित\s*(?:रूप\s*से)?|हर\s*(?:दिन|सप्ताह))/iu
    .test(source);
}

function hasOrganizationVerbSupport(source: string): boolean {
  // Verb stems only — adjective "organiziran(o)" is not ownership escalation.
  return /\b(?:organizira(?:la|lo|li|ju|ti)?|organizuje(?:m|š|mo|te|ju)?|organizovala|organizovao|organise[ds]?|organizes?|organising|organizing|verantwortlich\s+für|Steuerung|Überwachung)\b/iu
    .test(source);
}

function isSouthSlavicToEnglishSurface(source: string, candidate: string): boolean {
  const sourceSouthSlavic = /[čćđšž]|(?:priprem\w*|kuhinj\w*|održ\w*|sarad\w*|sarađ\w*)/iu.test(source);
  const candidateEnglish = /\b(?:the|and|with|as|part|role|duties|day-to-day|prepare|maintain|collaborate)\b/iu
    .test(candidate);
  return sourceSouthSlavic && candidateEnglish;
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
  const crossLocaleTranslationSurface = isSouthSlavicToEnglishSurface(source, joined);
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

  if (
    !crossLocaleTranslationSurface
    &&
    source.trim()
    &&
    /(?:\bdaily\b|\bweekly\b|\bregularly\b|\bevery\s+(?:day|week)\b|\bday-to-day\b|\bdnevno\b|\bsvakodnev\w*\b|\bredovit\w*\b|\btäglich\b|दैनिक|प्रतिदिन|साप्ताहिक|नियमित\s*(?:रूप\s*से)?|हर\s*(?:दिन|सप्ताह))/iu
      .test(joined)
    && !hasFrequencyScopeSupport(source)
  ) {
    kinds.push('frequency_scope_claim');
    labels.push('frequency_scope_claim');
  }

  const genericFillerHits = (joined.match(/(?:दैनिक\s+भूमिका\s+के\s+अंतर्गत|नियमित\s+भूमिका\s+के\s+अंतर्गत|as\s+part\s+of\s+(?:day-to-day\s+)?role\s+duties|within\s+regular\s+assigned\s+duties)/giu) || []).length;
  const sourceGenericFillerHits = (source.match(/(?:दैनिक\s+भूमिका\s+के\s+अंतर्गत|नियमित\s+भूमिका\s+के\s+अंतर्गत|as\s+part\s+of\s+(?:day-to-day\s+)?role\s+duties|within\s+regular\s+assigned\s+duties)/giu) || []).length;
  if (
    !crossLocaleTranslationSurface
    && source.trim()
    && genericFillerHits >= 2
    && sourceGenericFillerHits === 0
  ) {
    kinds.push('repeated_generic_enrichment');
    labels.push('repeated_generic_enrichment');
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

  // The AAB-432 no-op safety contract is exercised on the Hindi native
  // surface. Existing non-Hindi deterministic/cross-locale surfaces already
  // have their own locale-specific grounding contracts; do not reinterpret
  // their established frequency wording as a new generic enrichment kind.
  if (!/[\u0900-\u097F]/u.test(`${source}\n${joined}`)) {
    for (const kind of ['frequency_scope_claim', 'repeated_generic_enrichment'] as const) {
      while (kinds.includes(kind)) kinds.splice(kinds.indexOf(kind), 1);
    }
    for (const label of ['frequency_scope_claim', 'repeated_generic_enrichment']) {
      while (labels.includes(label)) labels.splice(labels.indexOf(label), 1);
    }
  }

  const uniqueKinds = [...new Set(kinds)];
  const uniqueLabels = [...new Set(labels)];
  return {
    kinds: uniqueKinds,
    count: uniqueKinds.length,
    labels: uniqueLabels,
    scopeExpansionDetected: uniqueKinds.includes('standards_compliance_claim')
      || uniqueKinds.includes('quality_claim')
      || uniqueKinds.includes('universal_scope_claim')
      || uniqueKinds.includes('frequency_scope_claim')
      || uniqueKinds.includes('repeated_generic_enrichment'),
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
  if (scan.kinds.includes('frequency_scope_claim')) return 'unsupported_frequency_scope_claim';
  if (scan.kinds.includes('repeated_generic_enrichment')) return 'unsupported_repeated_generic_enrichment';
  if (scan.kinds.includes('organization_responsibility_claim')) {
    return 'unsupported_organization_responsibility_claim';
  }
  if (scan.kinds.includes('leadership_claim')) return 'unsupported_leadership_claim';
  return 'unsupported_generated_duty';
}

/** Packaged asset marker — empty-source generation claim safety (AAB-366). */
export const EXPERIENCE_GENERATION_CLAIM_SAFETY_366_REVISION =
  'experience-generation-claim-safety-366-v1' as const;

void EXPERIENCE_GENERATION_CLAIM_SAFETY_366_REVISION;

function foldGenerationToken(value: string): string {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff\u0600-\u06ff\u0900-\u097f\u3040-\u30ff\u3400-\u9fff]+/g, '');
}

function titleGroundsGenerationToken(position: string, token: string): boolean {
  const title = foldGenerationToken(position);
  const tok = foldGenerationToken(token);
  if (!title || tok.length < 4) return false;
  const needle = tok.slice(0, Math.min(tok.length, Math.max(4, Math.floor(tok.length * 0.8))));
  return needle.length >= 4 && title.includes(needle);
}

/**
 * Empty-source / generate_from_job_context inventiveness gate.
 * Allows only safe generic duties; rejects concrete environments, tools/components,
 * regulated standards/compliance, maintenance responsibility escalations, metrics
 * and outcomes unless the same token is grounded in the entered role title.
 * Universal — no per-occupation production branches.
 */
export function detectExperienceGenerationUnsupportedClaims(options: {
  candidateText: string;
  position?: string;
}): ExperienceUnsupportedClaimScan {
  void EXPERIENCE_GENERATION_CLAIM_SAFETY_366_REVISION;
  const joined = norm(options.candidateText);
  const position = options.position || '';
  const base = detectExperienceUnsupportedClaimExpansion('', joined);
  const kinds: ExperienceUnsupportedClaimKind[] = [...base.kinds];
  const labels: string[] = [...base.labels];

  const push = (kind: ExperienceUnsupportedClaimKind) => {
    if (!kinds.includes(kind)) {
      kinds.push(kind);
      labels.push(kind);
    }
  };

  // Named tools / KPI / awards already covered for enhancement; keep for generation.
  if (
    /(?:\bKPI\b|\bOKR\b|\bExcel\b|\bSalesforce\b|\bSAP\b|\bCRM\b|\bJira\b|\bSlack\b|%\s*(?:increase|growth)|team\s+of\s+\d+|managed\s+\d+|increased\s+revenue|\bISO\s*\d+|\bawards?\b|\bcertificat)/iu
      .test(joined)
  ) {
    if (/\b(?:Excel|Salesforce|SAP|CRM|Jira|Slack)\b/iu.test(joined)) {
      push('unsupported_tool_claim');
    }
    if (/(?:\bKPI\b|\bOKR\b|%\s*(?:increase|growth)|increased\s+revenue|\bISO\s*\d+)/iu.test(joined)) {
      push('unsupported_metric_claim');
    }
    if (/(?:\bawards?\b|\bcertificat)/iu.test(joined)) {
      push('unsupported_generated_duty');
    }
  }

  // Concrete environments / customer venue scope (unless title names them).
  const environmentChecks: Array<{ token: string; re: RegExp }> = [
    { token: 'residential', re: /\bresidential\b/iu },
    { token: 'commercial', re: /\bcommercial\b/iu },
    { token: 'rooftop', re: /\brooftops?\b/iu },
    { token: 'roof', re: /\broofs?\b/iu },
    { token: 'customer', re: /\bcustomer\s+sites?\b/iu },
    { token: 'client', re: /\bclient\s+sites?\b/iu },
  ];
  for (const { token, re } of environmentChecks) {
    if (re.test(joined) && !titleGroundsGenerationToken(position, token)) {
      push('object_scope_expansion');
      break;
    }
  }

  // Tools / components not named in the role title.
  const componentChecks: Array<{ token: string; re: RegExp }> = [
    { token: 'wiring', re: /\bwiring\b/iu },
    { token: 'inverter', re: /\binverters?\b/iu },
    { token: 'mounting', re: /\bmounting\s+hardware\b/iu },
    { token: 'transformer', re: /\btransformers?\b/iu },
    { token: 'scaffolding', re: /\bscaffolding\b/iu },
    { token: 'multimeter', re: /\bmultimeters?\b/iu },
  ];
  for (const { token, re } of componentChecks) {
    if (re.test(joined) && !titleGroundsGenerationToken(position, token)) {
      push('unsupported_tool_claim');
      break;
    }
  }

  // Regulated standards / compliance phrasing (title must name standard/compliance).
  if (
    /(?:\belectrical\s+safety\s+standards?\b|\bsafety\s+standards?\b|\bmanufacturer\s+standards?\b|\band\s+compliance\b|\bensures?\s+compliance\b|\bregulatory\s+compliance\b)/iu
      .test(joined)
    && !titleGroundsGenerationToken(position, 'standard')
    && !titleGroundsGenerationToken(position, 'compliance')
    && !titleGroundsGenerationToken(position, 'safety')
  ) {
    push('standards_compliance_claim');
  }

  // Extra inspection/maintenance responsibility and outcome ownership.
  if (
    /(?:\binspection\s+and\s+maintenance\b|\bmaintenance\s+responsibility\b|\bperforms?\s+(?:regular\s+)?(?:inspection|maintenance)\b|\bensures?\s+optimal\b|\boptimal\s+performance\b)/iu
      .test(joined)
    && !titleGroundsGenerationToken(position, 'maintenance')
    && !titleGroundsGenerationToken(position, 'inspection')
  ) {
    push('organization_responsibility_claim');
    if (/\boptimal\s+performance\b|\bensures?\s+optimal\b/iu.test(joined)) {
      push('performance_claim');
    }
  }

  const uniqueKinds = [...new Set(kinds)];
  const uniqueLabels = [...new Set(labels)];
  return {
    kinds: uniqueKinds,
    count: uniqueKinds.length,
    labels: uniqueLabels,
    scopeExpansionDetected: uniqueKinds.includes('standards_compliance_claim')
      || uniqueKinds.includes('quality_claim')
      || uniqueKinds.includes('universal_scope_claim')
      || uniqueKinds.includes('object_scope_expansion'),
    universalQuantifierDetected: uniqueKinds.includes('universal_scope_claim'),
    responsibilityEscalationDetected: uniqueKinds.includes('organization_responsibility_claim')
      || uniqueKinds.includes('leadership_claim'),
  };
}
