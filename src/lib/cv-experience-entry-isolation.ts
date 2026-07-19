/**
 * Entry-scoped Experience AI isolation: prevent cross-entry fact leakage.
 * Universal semantic fingerprints — not occupation-catalogue branches.
 */
import type { CVData, WorkExperience } from './types';
import { fingerprintText } from './cv-export-diagnostics';
import { extractSourceDutyUnits, stripDutyListPrefix } from './cv-source-fact-identity';
import { splitExperienceBullets } from './cv-canonical-facts';

function fold(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Soft semantic clusters derived from free text (not hardcoded job titles). */
export type SemanticCluster =
  | 'warehouse_goods'
  | 'visual_design'
  | 'documentation'
  | 'customer_service'
  | 'generic';

const CLUSTER_PATTERNS: Array<{ cluster: SemanticCluster; re: RegExp }> = [
  {
    cluster: 'warehouse_goods',
    re: /\b(?:skladist|warehouse|inventar|inventory|rob[aeu]|goods|stock|incoming\s+goods|movement\s+of\s+goods|raspored\s+robe|kretanje\s+robe|пристигл|робе|товара|مستودع|गोदाम|倉庫)\b/iu,
  },
  {
    cluster: 'visual_design',
    re: /\b(?:vizuel|grafick|dizajn|visual\s+identity|graphic|design\s+format|interface\s+spec|finaln(?:e|ih)?\s+grafick|ビジュアル|تصميم|डिज़ाइन|identitet)\b/iu,
  },
  {
    cluster: 'documentation',
    re: /\b(?:dokumentacij|documentation|evidenc|records?|revision\s+table|bill\s+of\s+materials)\b/iu,
  },
  {
    cluster: 'customer_service',
    re: /\b(?:customer|guest|client\s+support|posetilac|gost)\b/iu,
  },
];

export function detectSemanticClusters(text: string): SemanticCluster[] {
  const t = fold(text);
  if (!t.trim()) return [];
  const hits: SemanticCluster[] = [];
  for (const row of CLUSTER_PATTERNS) {
    if (row.re.test(t)) hits.push(row.cluster);
  }
  return hits.length ? hits : ['generic'];
}

export function softDomainClusterFromPosition(position: string): SemanticCluster {
  const t = fold(position || '');
  if (!t.trim()) return 'generic';
  for (const row of CLUSTER_PATTERNS) {
    if (row.re.test(t)) return row.cluster;
  }
  // Free-text preposition domains (u skladištu, warehouse operator, …)
  if (/(skladist|warehouse|magacin|lager)/.test(t)) return 'warehouse_goods';
  if (/(dizajn|design|grafick|visual|ui|ux)/.test(t)) return 'visual_design';
  return 'generic';
}

export function hashExperienceEntryId(id: string | null | undefined): string {
  return fingerprintText(String(id || '').trim() || 'missing-entry-id');
}

export type CrossEntryLeakageResult = {
  ok: boolean;
  reason?: string;
  crossEntryCandidateFactCount: number;
  leakedFromExperienceEntryIdHashes: string[];
  targetEntryIdHash: string;
  targetClusters: SemanticCluster[];
  foreignClusters: SemanticCluster[];
};

function entryDutyText(exp: WorkExperience): string {
  return [
    exp.description,
    exp.canonicalDescription,
    exp.originalUserDescription,
    exp.generatedDescription,
  ]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Reject candidates that materialize another entry's distinctive cluster
 * when that cluster is absent from the target entry's job context.
 */
export function validateCrossEntryExperienceLeakage(options: {
  cv: CVData;
  targetExperienceId: string;
  candidate: string;
  targetPosition?: string;
}): CrossEntryLeakageResult {
  const targetId = options.targetExperienceId;
  const targetHash = hashExperienceEntryId(targetId);
  const target = (options.cv.experience || []).find((e) => e.id === targetId);
  const candidate = (options.candidate || '').trim();
  const targetClusters = new Set<SemanticCluster>([
    ...detectSemanticClusters(options.targetPosition || target?.position || ''),
    ...detectSemanticClusters(candidate),
  ]);
  // Prefer title domain when it is distinctive.
  const titleCluster = softDomainClusterFromPosition(
    options.targetPosition || target?.position || '',
  );
  if (titleCluster !== 'generic') {
    targetClusters.add(titleCluster);
  }

  const leakedFrom: string[] = [];
  let crossEntryCandidateFactCount = 0;
  const foreignClusters = new Set<SemanticCluster>();

  for (const other of options.cv.experience || []) {
    if (!other.id || other.id === targetId) continue;
    const otherText = entryDutyText(other);
    if (!otherText.trim()) continue;
    const otherClusters = detectSemanticClusters(otherText).filter((c) => c !== 'generic');
    if (!otherClusters.length) continue;

    for (const cluster of otherClusters) {
      // Foreign distinctive cluster present in candidate…
      const candidateHas = detectSemanticClusters(candidate).includes(cluster);
      if (!candidateHas) continue;
      // …and not explained by the target title / safe shared documentation.
      const titleOwns = titleCluster === cluster;
      const sharedDocs = cluster === 'documentation'
        && (titleCluster === 'documentation' || titleCluster === 'generic');
      if (titleOwns || sharedDocs) continue;
      // Target title is a different distinctive cluster → leakage.
      if (titleCluster !== 'generic' && titleCluster !== cluster) {
        foreignClusters.add(cluster);
        leakedFrom.push(hashExperienceEntryId(other.id));
        crossEntryCandidateFactCount += 1;
      }
    }
  }

  // Also: candidate warehouse stems while title is design (and vice versa),
  // even when the other entry is empty (poisoned self-content).
  if (titleCluster === 'visual_design') {
    const cand = detectSemanticClusters(candidate);
    if (cand.includes('warehouse_goods')) {
      foreignClusters.add('warehouse_goods');
      crossEntryCandidateFactCount += 1;
    }
  }
  if (titleCluster === 'warehouse_goods') {
    const cand = detectSemanticClusters(candidate);
    if (cand.includes('visual_design')) {
      foreignClusters.add('visual_design');
      crossEntryCandidateFactCount += 1;
    }
  }

  if (foreignClusters.size > 0) {
    return {
      ok: false,
      reason: 'cross_entry_fact_leakage',
      crossEntryCandidateFactCount,
      leakedFromExperienceEntryIdHashes: [...new Set(leakedFrom)],
      targetEntryIdHash: targetHash,
      targetClusters: [...targetClusters],
      foreignClusters: [...foreignClusters],
    };
  }

  return {
    ok: true,
    crossEntryCandidateFactCount: 0,
    leakedFromExperienceEntryIdHashes: [],
    targetEntryIdHash: targetHash,
    targetClusters: [...targetClusters],
    foreignClusters: [],
  };
}

/** Resolve experience by id — never fall back to index 0. */
export function findExperienceById(
  cv: CVData,
  experienceId: string | null | undefined,
): WorkExperience | null {
  if (!experienceId) return null;
  return (cv.experience || []).find((e) => e.id === experienceId) || null;
}

export function experienceIndexForIdStrict(
  cv: CVData,
  experienceId: string | null | undefined,
): number {
  if (!experienceId) return -1;
  return (cv.experience || []).findIndex((e) => e.id === experienceId);
}

/** Material unit fingerprints for entry-local canonical storage diagnostics. */
export function entryLocalFactFingerprints(description: string): string[] {
  return extractSourceDutyUnits(description)
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean)
    .map((u) => fingerprintText(u));
}

export function countOverlappingFactUnits(a: string, b: string): number {
  const fa = new Set(entryLocalFactFingerprints(a));
  const fb = entryLocalFactFingerprints(b);
  let n = 0;
  for (const id of fb) if (fa.has(id)) n += 1;
  return n;
}

export function bulletCount(text: string): number {
  return splitExperienceBullets(text).filter(Boolean).length;
}
