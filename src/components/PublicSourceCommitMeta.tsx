import React from 'react';
import type { PublicSourceCommitIdentity } from '@/lib/production-source-identity';

/** Stable server-rendered document marker for independent Production verification. */
export function PublicSourceCommitMeta({ identity }: { identity: PublicSourceCommitIdentity }) {
  return <meta name={identity.metaName} content={identity.shortSha} />;
}
