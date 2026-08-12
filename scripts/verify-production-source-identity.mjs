import { execFileSync } from 'node:child_process';

const markerName = 'cv-pro-source-commit';
const expectedFullSha = String(process.env.EXPECTED_SOURCE_COMMIT_FULL || '').trim().toLowerCase();
const canonicalHost = String(process.env.CANONICAL_PRODUCTION_HOST || '').trim();
const remoteRef = String(process.env.PRODUCTION_SOURCE_REMOTE_REF || 'origin refs/heads/final-production-cleanup').trim().split(/\s+/u);

if (!/^[0-9a-f]{40}$/u.test(expectedFullSha)) {
  throw new Error('EXPECTED_SOURCE_COMMIT_FULL must be an exact 40-character Git SHA.');
}
if (!/^https:\/\//iu.test(canonicalHost)) {
  throw new Error('CANONICAL_PRODUCTION_HOST must be an HTTPS URL.');
}

const remoteLine = execFileSync('git', ['ls-remote', ...remoteRef], { encoding: 'utf8' }).trim();
const remoteFullSha = remoteLine.split(/\s+/u)[0]?.toLowerCase();
if (remoteFullSha !== expectedFullSha) {
  throw new Error(`Remote Production SHA mismatch: expected ${expectedFullSha}, received ${remoteFullSha || 'absent'}.`);
}

const response = await fetch(canonicalHost, { redirect: 'follow' });
if (!response.ok) throw new Error(`Canonical host HTTP failure: ${response.status}.`);
const html = await response.text();
const meta = new RegExp(`<meta\\s+name=["']${markerName}["']\\s+content=["']([^"']+)["']\\s*/?>`, 'iu').exec(html);
const liveMarker = meta?.[1]?.trim().toLowerCase();
const expectedShortSha = expectedFullSha.slice(0, 7);
if (!/^[0-9a-f]{7}$/u.test(liveMarker || '')) {
  throw new Error('Public Production source identity marker is absent or unavailable_by_contract.');
}
if (liveMarker !== expectedShortSha) {
  throw new Error(`Public Production source identity mismatch: expected ${expectedShortSha}, received ${liveMarker}.`);
}

console.log(JSON.stringify({ markerName, sourceCommitShort: liveMarker, httpStatus: response.status, remoteFullSha }));
