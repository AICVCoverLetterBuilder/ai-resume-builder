import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicSourceCommitMeta } from '@/components/PublicSourceCommitMeta';
import {
  assertProductionSourceIdentity,
  PUBLIC_SOURCE_COMMIT_META_NAME,
  requireProductionSourceCommitIdentity,
  resolvePublicSourceCommitIdentity,
} from '../production-source-identity';

describe('Production public source identity contract', () => {
  it('exposes the supplied SHA through the stable public meta contract', () => {
    const identity = requireProductionSourceCommitIdentity({ raw: '99c1345fabe4c2cd2e63d3fccb37f0a769e35a4d', nodeEnv: 'production' });
    expect(identity).toEqual({ metaName: PUBLIC_SOURCE_COMMIT_META_NAME, shortSha: '99c1345' });
    expect(renderToStaticMarkup(React.createElement(PublicSourceCommitMeta, { identity: identity! })))
      .toBe('<meta name="cv-pro-source-commit" content="99c1345"/>');
  });

  it('fails closed for missing, unavailable, and non-SHA Production input', () => {
    for (const raw of [undefined, '', 'unavailable_by_contract', 'not-a-sha']) {
      expect(() => requireProductionSourceCommitIdentity({ raw, nodeEnv: 'production' })).toThrow(/Production source identity contract failed/);
    }
  });

  it('is independent of internal diagnostics and serializes only the short SHA', () => {
    expect(resolvePublicSourceCommitIdentity('99c1345fabe4c2cd2e63d3fccb37f0a769e35a4d'))
      .toEqual(resolvePublicSourceCommitIdentity('99c1345'));
    expect(JSON.stringify(resolvePublicSourceCommitIdentity('99c1345')))
      .toBe('{"shortSha":"99c1345","metaName":"cv-pro-source-commit"}');
  });

  it('rejects stale live markers and remote branch mismatches', () => {
    expect(() => assertProductionSourceIdentity({
      expectedFullSha: '99c1345fabe4c2cd2e63d3fccb37f0a769e35a4d', remoteFullSha: '99c1345fabe4c2cd2e63d3fccb37f0a769e35a4d', liveMarker: '3a2be82',
    })).toThrow(/marker differs/);
    expect(() => assertProductionSourceIdentity({
      expectedFullSha: '99c1345fabe4c2cd2e63d3fccb37f0a769e35a4d', remoteFullSha: '3a2be82cb7e09c76b4901a1b7d25972f5ba5aaf2', liveMarker: '99c1345',
    })).toThrow(/remote branch SHA differs/);
  });
});
