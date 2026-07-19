#!/usr/bin/env node
/**
 * Verify internal AI reset markers in a static export / Capacitor assets tree.
 *
 * Usage:
 *   node scripts/verify-internal-ai-reset-assets.mjs --dir out --expect enabled
 *   node scripts/verify-internal-ai-reset-assets.mjs --dir android/app/src/main/assets/public --expect enabled
 *   node scripts/verify-internal-ai-reset-assets.mjs --dir out --expect disabled
 */
import fs from 'node:fs';
import path from 'node:path';

const MARKER = 'CVPRO_INTERNAL_AI_RESET_ENABLED_V1';
const RESET_BUTTON = 'Reset AI test usage';
const CHANNEL_LABEL = 'Build channel: internal';
const STATUS_LABEL = 'AI test reset: enabled';

const EXPERIENCE_AI_TRACE_MARKER = 'CVPRO_EXPERIENCE_AI_TRACE_V1';
const EXPERIENCE_AI_COPY = 'Copy Experience AI diagnostics';
const EXPERIENCE_AI_FIELD_FAILURE = 'finalTypedFailureReason';
const EXPERIENCE_AI_FIELD_SOURCE = 'selectedSourceKind';
const EXPERIENCE_AI_FIELD_FALLBACK = 'fallbackCoveredFactCount';
const SUMMARY_AI_TRACE_MARKER = 'CVPRO_SUMMARY_AI_TRACE_V1';
const SUMMARY_AI_COPY = 'Copy Summary AI diagnostics';

function fail(msg) {
  console.error(`[verify-internal-ai-reset] FAIL: ${msg}`);
  process.exit(1);
}

function log(msg) {
  console.log(`[verify-internal-ai-reset] ${msg}`);
}

function collectTextFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectTextFiles(full, out);
    else if (/\.(js|html|txt|css|json)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function readAll(dir) {
  const files = collectTextFiles(dir);
  let blob = '';
  for (const f of files) {
    try {
      blob += fs.readFileSync(f, 'utf8');
      blob += '\n';
    } catch {
      /* ignore binary/unreadable */
    }
  }
  return { files: files.length, blob };
}

function parseArgs(argv) {
  let dir = '';
  let expect = '';
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--dir') dir = argv[++i] || '';
    else if (argv[i] === '--expect') expect = argv[++i] || '';
  }
  return { dir, expect };
}

const { dir, expect } = parseArgs(process.argv);
if (!dir || (expect !== 'enabled' && expect !== 'disabled')) {
  fail('usage: --dir <path> --expect enabled|disabled');
}
const abs = path.resolve(dir);
if (!fs.existsSync(abs)) fail(`directory missing: ${abs}`);

const { files, blob } = readAll(abs);
log(`scanned ${files} files under ${abs}`);

const hasMarker = blob.includes(MARKER);
const hasButton = blob.includes(RESET_BUTTON);
const hasChannel = blob.includes(CHANNEL_LABEL);
const hasStatus = blob.includes(STATUS_LABEL);

if (expect === 'enabled') {
  if (!hasMarker) fail(`missing marker ${MARKER}`);
  if (!hasButton) fail(`missing button text "${RESET_BUTTON}"`);
  if (!hasChannel) fail(`missing "${CHANNEL_LABEL}"`);
  if (!hasStatus) fail(`missing "${STATUS_LABEL}"`);
  if (!blob.includes(EXPERIENCE_AI_TRACE_MARKER)) {
    fail(`missing Experience AI marker ${EXPERIENCE_AI_TRACE_MARKER}`);
  }
  if (!blob.includes(EXPERIENCE_AI_COPY)) {
    fail(`missing "${EXPERIENCE_AI_COPY}"`);
  }
  if (!blob.includes(EXPERIENCE_AI_FIELD_FAILURE)) {
    fail(`missing field marker "${EXPERIENCE_AI_FIELD_FAILURE}"`);
  }
  if (!blob.includes(EXPERIENCE_AI_FIELD_SOURCE)) {
    fail(`missing field marker "${EXPERIENCE_AI_FIELD_SOURCE}"`);
  }
  if (!blob.includes(EXPERIENCE_AI_FIELD_FALLBACK)) {
    fail(`missing field marker "${EXPERIENCE_AI_FIELD_FALLBACK}"`);
  }
  if (!blob.includes(SUMMARY_AI_TRACE_MARKER)) {
    fail(`missing Summary AI marker ${SUMMARY_AI_TRACE_MARKER}`);
  }
  if (!blob.includes(SUMMARY_AI_COPY)) {
    fail(`missing "${SUMMARY_AI_COPY}"`);
  }
  log('OK enabled assets contain marker, button, build-channel labels, and Experience AI + Summary AI trace markers');
} else if (hasMarker) {
  fail(`enabled marker must be absent in disabled assets (${MARKER})`);
} else if (blob.includes(EXPERIENCE_AI_TRACE_MARKER)) {
  fail(`Experience AI trace marker must be absent in disabled assets (${EXPERIENCE_AI_TRACE_MARKER})`);
} else if (blob.includes(SUMMARY_AI_TRACE_MARKER)) {
  fail(`Summary AI trace marker must be absent in disabled assets (${SUMMARY_AI_TRACE_MARKER})`);
} else {
  log(`OK disabled assets: marker absent (button=${hasButton}, channel=${hasChannel}, status=${hasStatus})`);
}
