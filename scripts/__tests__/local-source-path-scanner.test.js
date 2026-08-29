'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { scanBuffer } = require('../local-source-path-scanner');
const thirdPartyLocalPathLoader = require('../webpack-third-party-local-path-loader.cjs');

const join = (...parts) => parts.join('');
const scan = (value) => scanBuffer(Buffer.from(value, 'latin1'), 'synthetic.bin');

test('flags file URI Windows user paths without preserving their value', () => {
  const result = scan(join('file:', '/', '/', '/', 'C:', '/', 'Users', '/', 'redacted', '/', 'module.js'));
  assert.equal(result.prohibitedMatchCount, 1);
  assert.equal(result.matches[0].classification, 'FILE_URI_WINDOWS_USERS');
  assert.equal(result.matches[0].redactedShape, 'file:///<drive>/<user-directory>/<redacted>/…');
  assert.match(result.matches[0].matchSha256, /^[0-9a-f]{64}$/);
});

test('flags compact and percent-encoded Windows file URIs', () => {
  const compact = scan(join('file:', '/', 'C:', '/', 'Users', '/', 'redacted'));
  const encoded = scan(join('file%3A', '%2F', '%2F', '%2F', 'C%3A', '%2F', 'Users', '%2F', 'redacted'));
  assert.equal(compact.matches[0].classification, 'FILE_URI_WINDOWS_USERS');
  assert.equal(encoded.matches[0].classification, 'FILE_URI_WINDOWS_USERS');
});

test('flags macOS and Linux file URI user paths', () => {
  const mac = scan(join('file:', '/', '/', '/', 'Users', '/', 'redacted', '/', 'module.js'));
  const linux = scan(join('file:', '/', '/', '/', 'home', '/', 'redacted', '/', 'module.js'));
  assert.equal(mac.matches[0].classification, 'FILE_URI_UNIX_USERS');
  assert.equal(linux.matches[0].classification, 'FILE_URI_UNIX_USERS');
});

test('flags raw Windows, macOS, and Linux user paths', () => {
  const windows = scan(join('C:', '\\', 'Users', '\\', 'redacted', '\\', 'module.js'));
  const mac = scan(join('/', 'Users', '/', 'redacted', '/', 'module.js'));
  const linux = scan(join('/', 'home', '/', 'redacted', '/', 'module.js'));
  assert.equal(windows.matches[0].classification, 'RAW_WINDOWS_USERS');
  assert.equal(mac.matches[0].classification, 'RAW_UNIX_USERS');
  assert.equal(linux.matches[0].classification, 'RAW_UNIX_USERS');
});

test('does not double-count a raw path inside a file URI', () => {
  const result = scan(join('file:', '/', '/', '/', 'C:', '/', 'Users', '/', 'redacted'));
  assert.equal(result.prohibitedMatchCount, 1);
});

test('allows Android asset file URIs while reporting generic URI telemetry', () => {
  const result = scan(join('file:', '/', '/', '/', 'android_asset', '/', 'public', '/'));
  assert.equal(result.prohibitedMatchCount, 0);
  assert.equal(result.genericFileUriCount, 1);
});

test('allows non-path text containing the word file', () => {
  const result = scan('profile file status: ready');
  assert.equal(result.prohibitedMatchCount, 0);
  assert.equal(result.genericFileUriCount, 0);
});

test('allows Preview HTTPS URLs and dormant localhost validation text', () => {
  const preview = scan('https://ai-resume-builder-7ytramv29-aicvcoverletterbuilders-projects.vercel.app');
  const localhost = scan('localhost validation is dormant outside the internal test channel');
  assert.equal(preview.prohibitedMatchCount, 0);
  assert.equal(localhost.prohibitedMatchCount, 0);
});

test('reports deterministic hashes and redacted shapes without retaining private text', () => {
  const privateTail = join('Example', '/', 'project', '/', 'src', '/', 'file.ts');
  const source = join('file:', '/', '/', '/', 'C:', '/', 'Users', '/', privateTail);
  const first = scan(source);
  const second = scan(source);
  const serialized = JSON.stringify(first);
  assert.equal(first.matches[0].matchSha256, second.matches[0].matchSha256);
  assert.equal(first.matches[0].redactedShape, second.matches[0].redactedShape);
  assert.equal(serialized.includes(privateTail), false);
  assert.equal(serialized.includes(source), false);
});

test('canonicalizes only the two fail-closed third-party producers', () => {
  const context = { cacheable() {} };
  const yoga = thirdPartyLocalPathLoader.call(context, 'var _scriptDir = import.meta.url;');
  const pdfKit = thirdPartyLocalPathLoader.call(
    context,
    join('var __dirname = \'', '/', 'home', '/', 'Example', '/', 'project', '\';'),
  );
  assert.equal(yoga.includes('import.meta.url'), false);
  assert.equal(pdfKit, "var __dirname = '.';");
  assert.throws(
    () => thirdPartyLocalPathLoader.call(context, 'unrelated third-party module'),
    /unrecognized scoped source/,
  );
});
