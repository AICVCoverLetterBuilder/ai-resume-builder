/** Public server-rendered build identity; independent of client diagnostics. */
export const PUBLIC_SOURCE_COMMIT_META_NAME = 'cv-pro-source-commit' as const;

export type PublicSourceCommitIdentity = {
  shortSha: string;
  metaName: typeof PUBLIC_SOURCE_COMMIT_META_NAME;
};

const SHA_RE = /^[0-9a-f]{7,40}$/i;

export function resolvePublicSourceCommitIdentity(raw: string | null | undefined): PublicSourceCommitIdentity | null {
  const normalized = String(raw || '').trim();
  if (!SHA_RE.test(normalized)) return null;
  return { shortSha: normalized.slice(0, 7).toLowerCase(), metaName: PUBLIC_SOURCE_COMMIT_META_NAME };
}

/** Fail server rendering/build closed when Production lacks a valid identity. */
export function requireProductionSourceCommitIdentity(options?: {
  raw?: string | null | undefined;
  nodeEnv?: string | null | undefined;
}): PublicSourceCommitIdentity | null {
  const identity = resolvePublicSourceCommitIdentity(options?.raw ?? process.env.NEXT_PUBLIC_SOURCE_COMMIT_SHORT);
  if ((options?.nodeEnv ?? process.env.NODE_ENV) === 'production' && !identity) {
    throw new Error('Production source identity contract failed: NEXT_PUBLIC_SOURCE_COMMIT_SHORT must be a 7-40 character Git SHA.');
  }
  return identity;
}

/** Fail-closed agreement check for deployment and packaging verification. */
export function assertProductionSourceIdentity(options: {
  expectedFullSha: string;
  remoteFullSha: string;
  liveMarker: string | null | undefined;
}): PublicSourceCommitIdentity {
  const expected = resolvePublicSourceCommitIdentity(options.expectedFullSha);
  const marker = resolvePublicSourceCommitIdentity(options.liveMarker);
  if (!expected) throw new Error('Production source identity verification failed: expected SHA is invalid.');
  if (String(options.remoteFullSha || '').trim().toLowerCase() !== String(options.expectedFullSha || '').trim().toLowerCase()) {
    throw new Error('Production source identity verification failed: remote branch SHA differs from expected SHA.');
  }
  if (!marker) throw new Error('Production source identity verification failed: public HTML marker is absent or unavailable_by_contract.');
  if (marker.shortSha !== expected.shortSha) {
    throw new Error('Production source identity verification failed: public HTML marker differs from expected SHA.');
  }
  return marker;
}
