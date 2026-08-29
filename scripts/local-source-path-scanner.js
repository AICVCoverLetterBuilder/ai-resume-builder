'use strict';

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const separator = String.raw`(?:/|%2f)`;
const fileScheme = String.raw`file(?:\:|%3a)`;
const drive = String.raw`[a-z](?:\:|%3a)`;
const userDirectory = String.raw`(?:users|home)`;
const pathTail = String.raw`[^\s"'<>\x60]{0,512}`;

const prohibitedPatterns = [
  {
    classification: 'FILE_URI_WINDOWS_USERS',
    expression: new RegExp(
      `${fileScheme}${separator}{1,3}${drive}${separator}users${separator}${pathTail}`,
      'ig',
    ),
  },
  {
    classification: 'FILE_URI_UNIX_USERS',
    expression: new RegExp(
      `${fileScheme}${separator}{1,3}${userDirectory}${separator}${pathTail}`,
      'ig',
    ),
  },
  {
    classification: 'RAW_WINDOWS_USERS',
    expression: new RegExp(`[a-z]:(?:/|\\\\)+users(?:/|\\\\)+${pathTail}`, 'ig'),
  },
  {
    classification: 'RAW_UNIX_USERS',
    expression: new RegExp(`/${userDirectory}/${pathTail}`, 'ig'),
  },
];

const genericFileUri = new RegExp(`${fileScheme}${separator}{1,3}`, 'ig');

function digestLatin1(value) {
  return createHash('sha256').update(Buffer.from(value, 'latin1')).digest('hex');
}

function redactedShape(classification) {
  switch (classification) {
    case 'FILE_URI_WINDOWS_USERS':
      return 'file:///<drive>/<user-directory>/<redacted>/…';
    case 'FILE_URI_UNIX_USERS':
      return 'file:///<home-directory>/<redacted>/…';
    case 'RAW_WINDOWS_USERS':
      return '<drive>:/<user-directory>/<redacted>/…';
    case 'RAW_UNIX_USERS':
      return '/<home-directory>/<redacted>/…';
    default:
      throw new Error(`Unknown local-source-path classification: ${classification}`);
  }
}

function overlaps(span, spans) {
  return spans.some(({ start, end }) => start < span.end && span.start < end);
}

function scanBuffer(buffer, file = '<buffer>') {
  // latin1 preserves a one-to-one byte offset while avoiding UTF-8 decoding
  // changes in binary-like JavaScript assets.
  const text = buffer.toString('latin1');
  const matches = [];
  const uriSpans = [];
  let genericFileUriCount = 0;

  genericFileUri.lastIndex = 0;
  while (genericFileUri.exec(text)) genericFileUriCount += 1;

  for (const pattern of prohibitedPatterns) {
    pattern.expression.lastIndex = 0;
    let found;
    while ((found = pattern.expression.exec(text)) !== null) {
      const start = found.index;
      const end = start + found[0].length;
      const span = { start, end };
      const isUri = pattern.classification.startsWith('FILE_URI_');
      if (!isUri && overlaps(span, uriSpans)) continue;
      if (matches.some((match) => match.offset === start && match.end === end)) continue;

      matches.push({
        file,
        offset: start,
        end,
        classification: pattern.classification,
        redactedShape: redactedShape(pattern.classification),
        matchSha256: digestLatin1(found[0]),
      });
      if (isUri) uriSpans.push(span);
    }
  }

  matches.sort((left, right) => left.offset - right.offset || left.classification.localeCompare(right.classification));
  return {
    bytesScanned: buffer.length,
    genericFileUriCount,
    prohibitedMatchCount: matches.length,
    matches: matches.map(({ end, ...match }) => match),
  };
}

function collectFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.isFile()) {
        files.push(absolute);
      }
    }
  };
  visit(root);
  return files.sort((left, right) => left.localeCompare(right));
}

function scanDirectory(root) {
  const totals = {
    filesScanned: 0,
    bytesScanned: 0,
    genericFileUriCount: 0,
    prohibitedMatchCount: 0,
    matches: [],
  };

  for (const absolute of collectFiles(root)) {
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    const result = scanBuffer(fs.readFileSync(absolute), relative);
    totals.filesScanned += 1;
    totals.bytesScanned += result.bytesScanned;
    totals.genericFileUriCount += result.genericFileUriCount;
    totals.prohibitedMatchCount += result.prohibitedMatchCount;
    totals.matches.push(...result.matches);
  }

  return totals;
}

function main(argv) {
  const roots = [];
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] !== '--root' || !argv[index + 1]) {
      throw new Error('Usage: node scripts/local-source-path-scanner.js --root <generated-directory> [--root <generated-directory>]');
    }
    roots.push(argv[index + 1]);
    index += 1;
  }
  if (roots.length === 0) throw new Error('At least one --root is required.');

  const result = roots.reduce(
    (totals, root) => {
      const scanned = scanDirectory(root);
      totals.filesScanned += scanned.filesScanned;
      totals.bytesScanned += scanned.bytesScanned;
      totals.genericFileUriCount += scanned.genericFileUriCount;
      totals.prohibitedMatchCount += scanned.prohibitedMatchCount;
      totals.matches.push(...scanned.matches);
      return totals;
    },
    {
      scannerVersion: 1,
      rootsScanned: roots.length,
      filesScanned: 0,
      bytesScanned: 0,
      genericFileUriCount: 0,
      prohibitedMatchCount: 0,
      matches: [],
    },
  );

  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.prohibitedMatchCount === 0 ? 0 : 2;
}

if (require.main === module) main(process.argv);

module.exports = { scanBuffer, scanDirectory };
