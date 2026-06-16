#!/usr/bin/env node
/**
 * discover-entitlement-id.js — One-time utility to find a RevenueCat V2
 * internal entitlement ID from the lookup key / display name.
 *
 * Usage:
 *   REVENUECAT_SECRET_API_KEY=sk_v2_... \
 *   REVENUECAT_PROJECT_ID=project_... \
 *   node scripts/discover-entitlement-id.js
 *
 * This script calls:
 *   GET /v2/projects/{project_id}/entitlements
 *
 * and prints the internal ID for the entitlement with lookup_key "CV Pro AI Pro".
 *
 * Required RevenueCat key permission:
 *   Project configuration → Entitlements → Read
 */

const LOOKUP_KEY = 'CV Pro AI Pro';

async function main() {
  const secretKey = process.env.REVENUECAT_SECRET_API_KEY;
  const projectId = process.env.REVENUECAT_PROJECT_ID;

  if (!secretKey || !projectId) {
    console.error(
      'Error: Both REVENUECAT_SECRET_API_KEY and REVENUECAT_PROJECT_ID must be set.\n' +
        'Usage:\n' +
        '  REVENUECAT_SECRET_API_KEY=sk_v2_... \\\n' +
        '  REVENUECAT_PROJECT_ID=project_... \\\n' +
        '  node scripts/discover-entitlement-id.js',
    );
    process.exit(1);
  }

  const url = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/entitlements`;

  console.log(`Fetching entitlements from: ${url}`);
  console.log('');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`RevenueCat API returned ${response.status} ${response.statusText}`);
    const body = await response.text().catch(() => '(empty)');
    console.error('Response body:', body);
    console.error('');
    if (response.status === 401 || response.status === 403) {
      console.error(
        'The API key does not have the required permission.\n' +
          'In RevenueCat Dashboard, ensure the key has:\n' +
          '  Project configuration → Entitlements → Read',
      );
    }
    process.exit(1);
  }

  const data = await response.json();
  const items = data.items || [];

  if (items.length === 0) {
    console.log('No entitlements found in this project.');
    process.exit(0);
  }

  const match = items.find(
    (e: { lookup_key?: string; display_name?: string; id?: string }) =>
      e.lookup_key === LOOKUP_KEY || e.display_name === LOOKUP_KEY,
  );

  if (match) {
    console.log(`Found matching entitlement for lookup key "${LOOKUP_KEY}":`);
    console.log(`  Internal ID:     ${match.id}`);
    console.log(`  Lookup key:      ${match.lookup_key || '(not set)'}`);
    console.log(`  Display name:    ${match.display_name || '(not set)'}`);
    console.log('');
    console.log(
      `Set this in your environment as:\n  REVENUECAT_ENTITLEMENT_ID=${match.id}`,
    );
  } else {
    console.log(`No entitlement found with lookup key or display name "${LOOKUP_KEY}".`);
    console.log('');
    console.log('Available entitlements:');
    for (const e of items) {
      console.log(`  - id=${e.id} lookup_key=${e.lookup_key || '(none)'} display_name=${e.display_name || '(none)'}`);
    }
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});