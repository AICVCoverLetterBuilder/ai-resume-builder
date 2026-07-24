/**
 * AAB-320 — Summary explicit-skill provenance authority.
 *
 * Only truly authoritative user skills may authorize Summary competency claims.
 * Diagnostics expose hashes/canonical IDs only — never raw skill text.
 */
export const SUMMARY_EXPLICIT_SKILL_PROVENANCE_320_REVISION =
  'summary-explicit-skill-provenance-320-v1' as const;
export const SUMMARY_CANDIDATE_PHASE_SEPARATION_320_REVISION =
  'summary-candidate-phase-separation-320-v1' as const;

void SUMMARY_EXPLICIT_SKILL_PROVENANCE_320_REVISION;
void SUMMARY_CANDIDATE_PHASE_SEPARATION_320_REVISION;

export type SummarySkillSourceKind =
  | 'user_entered'
  | 'imported_user_data'
  | 'ai_generated_user_edited'
  | 'ai_generated_unedited'
  | 'suggested_not_selected'
  | 'inferred'
  | 'stale'
  | 'unknown';

export type SummarySkillAuthorityInput = {
  label: string;
  sourceKind?: SummarySkillSourceKind;
  sourceLocale?: string | null;
  targetLocale?: string | null;
  sourceRecordId?: string | null;
  currentlyVisibleInCv?: boolean;
  includedInSnapshot?: boolean;
  /** Material user edit after AI generation — required for ai_generated_user_edited. */
  userMateriallyEdited?: boolean;
};

export type SummarySkillAuthorityRecord = {
  canonicalSkillId: string;
  sourceLabelHash: string;
  localizedTargetLabelHash: string;
  sourceLocale: string | null;
  targetLocale: string | null;
  sourceRecordIdHash: string | null;
  sourceSection: 'skills';
  sourceKind: SummarySkillSourceKind;
  explicitUserFact: boolean;
  currentlyVisibleInCv: boolean;
  includedInSnapshot: boolean;
  canonicalAliasCollapsed: boolean;
  authoritativeForSummary: boolean;
  rejectionReason: string | null;
};

export type SummaryExplicitSkillAuthorityReport = {
  records: SummarySkillAuthorityRecord[];
  rawSkillRecordCount: number;
  nonEmptyVisibleSkillRecordCount: number;
  canonicalSkillIdentityCount: number;
  authoritativeExplicitSkillCount: number;
  rejectedSkillAuthorityCount: number;
  rejectedSkillAuthorityKinds: SummarySkillSourceKind[];
  duplicateSkillAliasCollapseCount: number;
  staleSkillRecordCount: number;
  inferredSkillRecordCount: number;
  suggestedUnselectedSkillRecordCount: number;
  aiGeneratedUneditedSkillRecordCount: number;
  authoritativeSkillSourceKindCounts: Partial<Record<SummarySkillSourceKind, number>>;
};

/** Canonical alias map — Communication / Kommunikation → one identity. */
const CANONICAL_ALIAS_TO_ID: Array<{ id: string; aliases: string[] }> = [
  { id: 'communication', aliases: ['kommunikation', 'kommunikationsfähigkeit', 'kommunikationsstärke', 'communication'] },
  { id: 'leadership', aliases: ['führung', 'führungsstärke', 'leadership'] },
  { id: 'organisation', aliases: ['organisation', 'organisationsfähigkeit', 'organization', 'organisational skills'] },
  { id: 'critical_thinking', aliases: ['kritisches denken', 'critical thinking'] },
  { id: 'adaptability', aliases: ['anpassungsfähigkeit', 'adaptability'] },
  { id: 'problem_solving', aliases: ['problemlösung', 'problemlösungskompetenz', 'problem solving', 'problem-solving'] },
  { id: 'time_management', aliases: ['zeitmanagement', 'time management'] },
  { id: 'emotional_intelligence', aliases: ['emotionale intelligenz', 'emotional intelligence'] },
  { id: 'attention_to_detail', aliases: ['detailgenauigkeit', 'attention to detail'] },
  { id: 'teamwork', aliases: ['teamfähigkeit', 'teamwork', 'team work'] },
  { id: 'resilience', aliases: ['resilienz', 'resilience'] },
  { id: 'scrum', aliases: ['scrum'] },
  { id: 'agile', aliases: ['agile'] },
  { id: 'kanban', aliases: ['kanban'] },
];

const PLACEHOLDER_LABELS = new Set([
  '',
  'skill',
  'skills',
  'fähigkeit',
  'fähigkeiten',
  'kompetenz',
  'add skill',
  'neue fähigkeit',
  'skill name',
  'placeholder',
]);

function hashOpaque(text: string): string {
  let h = 2166136261;
  const s = (text || '').trim();
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a_${(h >>> 0).toString(16)}`;
}

export function normalizeSummarySkillLabel(label: string): string {
  return (label || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function resolveCanonicalSkillId(label: string): string {
  const norm = normalizeSummarySkillLabel(label);
  if (!norm) return 'skill:empty';
  for (const row of CANONICAL_ALIAS_TO_ID) {
    if (row.aliases.some((a) => a === norm)) return row.id;
  }
  return `skill:${norm}`;
}

function isPlaceholderLabel(label: string): boolean {
  const norm = normalizeSummarySkillLabel(label);
  if (!norm) return true;
  if (PLACEHOLDER_LABELS.has(norm)) return true;
  if (/^skill\s*\d+$/i.test(norm)) return true;
  return false;
}

function isAuthoritativeKind(kind: SummarySkillSourceKind, userMateriallyEdited: boolean): boolean {
  if (kind === 'user_entered' || kind === 'imported_user_data') return true;
  if (kind === 'ai_generated_user_edited' && userMateriallyEdited) return true;
  // Product contract: plain visible Skills strings without provenance metadata
  // are treated as user-entered (see buildSummaryExplicitSkillAuthority).
  return false;
}

function rejectionForKind(kind: SummarySkillSourceKind): string {
  switch (kind) {
    case 'suggested_not_selected':
      return 'suggested_skill_not_selected';
    case 'inferred':
      return 'inferred_skill_not_authoritative';
    case 'stale':
      return 'stale_skill_record';
    case 'ai_generated_unedited':
      return 'ai_generated_unedited_skill';
    case 'unknown':
      return 'unknown_skill_provenance';
    case 'ai_generated_user_edited':
      return 'ai_generated_skill_not_materially_edited';
    default:
      return 'skill_not_authoritative';
  }
}

/**
 * Build provenance-aware skill authority.
 * Collapses localized aliases into one canonical identity.
 * Never returns raw skill text in records — hashes/IDs only.
 */
export function buildSummaryExplicitSkillAuthorityReport(
  inputs: SummarySkillAuthorityInput[] | string[] | undefined | null,
  options: { targetLocale?: string | null; sourceLocale?: string | null } = {},
): SummaryExplicitSkillAuthorityReport {
  void SUMMARY_EXPLICIT_SKILL_PROVENANCE_320_REVISION;
  const rawInputs: SummarySkillAuthorityInput[] = (inputs || []).map((item) => {
    if (typeof item === 'string') {
      return {
        label: item,
        sourceKind: 'user_entered' as const,
        currentlyVisibleInCv: true,
        includedInSnapshot: true,
      };
    }
    return item;
  });

  const rawSkillRecordCount = rawInputs.length;
  let nonEmptyVisibleSkillRecordCount = 0;
  let duplicateSkillAliasCollapseCount = 0;
  let staleSkillRecordCount = 0;
  let inferredSkillRecordCount = 0;
  let suggestedUnselectedSkillRecordCount = 0;
  let aiGeneratedUneditedSkillRecordCount = 0;

  const byCanonical = new Map<string, SummarySkillAuthorityRecord>();
  const rejectedKinds: SummarySkillSourceKind[] = [];

  for (let i = 0; i < rawInputs.length; i += 1) {
    const input = rawInputs[i]!;
    const label = String(input.label || '').trim();
    const visible = input.currentlyVisibleInCv !== false;
    if (label && visible) nonEmptyVisibleSkillRecordCount += 1;

    const kind: SummarySkillSourceKind = input.sourceKind
      || (isPlaceholderLabel(label) ? 'suggested_not_selected' : 'user_entered');

    if (kind === 'stale') staleSkillRecordCount += 1;
    if (kind === 'inferred') inferredSkillRecordCount += 1;
    if (kind === 'suggested_not_selected' || isPlaceholderLabel(label)) {
      suggestedUnselectedSkillRecordCount += 1;
    }
    if (kind === 'ai_generated_unedited') aiGeneratedUneditedSkillRecordCount += 1;

    if (!label || isPlaceholderLabel(label) || !visible) {
      rejectedKinds.push(kind === 'user_entered' ? 'suggested_not_selected' : kind);
      continue;
    }

    const canonicalSkillId = resolveCanonicalSkillId(label);
    const userEdited = Boolean(input.userMateriallyEdited);
    const authoritative = isAuthoritativeKind(kind, userEdited)
      && kind !== 'stale'
      && kind !== 'inferred'
      && kind !== 'suggested_not_selected'
      && kind !== 'ai_generated_unedited';

    const record: SummarySkillAuthorityRecord = {
      canonicalSkillId,
      sourceLabelHash: hashOpaque(normalizeSummarySkillLabel(label)),
      localizedTargetLabelHash: hashOpaque(normalizeSummarySkillLabel(label)),
      sourceLocale: input.sourceLocale ?? options.sourceLocale ?? null,
      targetLocale: input.targetLocale ?? options.targetLocale ?? null,
      sourceRecordIdHash: input.sourceRecordId
        ? hashOpaque(String(input.sourceRecordId))
        : hashOpaque(`idx:${i}`),
      sourceSection: 'skills',
      sourceKind: kind,
      explicitUserFact: authoritative,
      currentlyVisibleInCv: visible,
      includedInSnapshot: input.includedInSnapshot !== false,
      canonicalAliasCollapsed: false,
      authoritativeForSummary: authoritative,
      rejectionReason: authoritative ? null : rejectionForKind(kind),
    };

    const existing = byCanonical.get(canonicalSkillId);
    if (existing) {
      duplicateSkillAliasCollapseCount += 1;
      existing.canonicalAliasCollapsed = true;
      // Prefer authoritative record when collapsing aliases.
      if (record.authoritativeForSummary && !existing.authoritativeForSummary) {
        byCanonical.set(canonicalSkillId, {
          ...record,
          canonicalAliasCollapsed: true,
        });
      } else {
        existing.canonicalAliasCollapsed = true;
      }
      continue;
    }
    byCanonical.set(canonicalSkillId, record);
  }

  const records = [...byCanonical.values()];
  const authoritative = records.filter((r) => r.authoritativeForSummary);
  const rejected = records.filter((r) => !r.authoritativeForSummary);
  for (const r of rejected) {
    if (!rejectedKinds.includes(r.sourceKind)) rejectedKinds.push(r.sourceKind);
  }

  const authoritativeSkillSourceKindCounts: Partial<Record<SummarySkillSourceKind, number>> = {};
  for (const r of authoritative) {
    authoritativeSkillSourceKindCounts[r.sourceKind] = (
      authoritativeSkillSourceKindCounts[r.sourceKind] || 0
    ) + 1;
  }

  return {
    records,
    rawSkillRecordCount,
    nonEmptyVisibleSkillRecordCount,
    canonicalSkillIdentityCount: records.length,
    authoritativeExplicitSkillCount: authoritative.length,
    rejectedSkillAuthorityCount: rejected.length + Math.max(
      0,
      rawSkillRecordCount - nonEmptyVisibleSkillRecordCount,
    ),
    rejectedSkillAuthorityKinds: [...new Set(rejectedKinds)],
    duplicateSkillAliasCollapseCount,
    staleSkillRecordCount,
    inferredSkillRecordCount,
    suggestedUnselectedSkillRecordCount,
    aiGeneratedUneditedSkillRecordCount,
    authoritativeSkillSourceKindCounts,
  };
}

/** Legacy-compatible fact list used by competency scanners (authoritative only). */
export function buildSummaryExplicitSkillAuthorityFacts(
  inputs: SummarySkillAuthorityInput[] | string[] | undefined | null,
): Array<{
  canonicalId: string;
  sourceLabel: string;
  localizedLabel: string;
  explicitUserFact: true;
}> {
  const report = buildSummaryExplicitSkillAuthorityReport(inputs);
  // Competency matching still needs labels internally; callers must not serialize them.
  const raw = (inputs || []).map((item) => (
    typeof item === 'string' ? item : item.label
  ));
  const out: Array<{
    canonicalId: string;
    sourceLabel: string;
    localizedLabel: string;
    explicitUserFact: true;
  }> = [];
  const seen = new Set<string>();
  for (const label of raw) {
    const trimmed = String(label || '').trim();
    if (!trimmed || isPlaceholderLabel(trimmed)) continue;
    const id = resolveCanonicalSkillId(trimmed);
    const auth = report.records.find((r) => r.canonicalSkillId === id && r.authoritativeForSummary);
    if (!auth || seen.has(id)) continue;
    seen.add(id);
    out.push({
      canonicalId: id,
      sourceLabel: trimmed,
      localizedLabel: trimmed,
      explicitUserFact: true,
    });
  }
  return out;
}
