// Task085 TEST-ONLY reconciliation. Historical Git bytes are not current-runtime
// expectations. No production restoration, catch/ignore, approximate source stripping.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { expect } from 'vitest';
import { findExactDurationMeasurements } from '../../exact-duration-measurement';
import { hashSummaryV3StyleValue } from '../../summary-style-m5';
import type { SummaryTenureRemediation } from '../../summary-trusted-tenure-runtime';

export const PRE_TASK084_HEAD = '76bb389448a510eeca2d8485b857d60586d00a21';
export const historicalSourcePins: Readonly<Record<string, string>> = {
  'src/lib/ai-core-v3/summary-style-m5-server.ts': 'd4b836a54b4bad4ab9e73d025d30f3b321e37acc97caf3b152fa4d5f20576be1',
  'src/lib/ai-core-v3/summary-style-m5.ts': '28f26af4d77ebe1e1469d855d6adce9b2c8f8ff589e9f7365b4afe94186af8b5',
  'src/lib/ai-core-v3/summary-style-m5-client.ts': '345e82a450e8f1a4716a3ed66d5c14aa3e4bd28d40b43a3a010edbc063d72230',
  'src/lib/ai-core-v3/summary-style-m5-local-observability.ts': '66d9a1a13199bbea22d29b8e909238938507e301c4ae1d0d1787d30742aa5274',
  'src/lib/ai-core-v3/summary-style-m5-provider.ts': 'dad9f67340fb9b172f0e8cdc3dddbd025b63690722db2e8844e1656f773eca9d',
  'src/lib/ai-core-v3/summary-v3-production-observability.ts': '067d73423ea9fac6d097413ee1d6a95374d65c4cf6cffc1e39345e5ead6822b6',
  'src/lib/cv-experience-duration.ts': '96d99a5474886441ced246984d73680874460b272c3601cef64762f9be9aab48',
  'src/app/cv-builder/page.tsx': '9d9c8049bd1502bc8ae754c8a3f5582b495a222797d12cc9b43955e14188fddb',
};

export function historicalPreTask084Source(relative: string): string {
  return execFileSync('git', ['show', PRE_TASK084_HEAD + ':' + relative],
    { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 20_000_000 });
}

export function expectedLegacyTenureRemediation(summary: string): SummaryTenureRemediation {
  const measurements = findExactDurationMeasurements(summary);
  expect(measurements).toHaveLength(1);
  const m = measurements[0]!;
  return { type: 'employment_tenure_binding_required',
    summaryHash: hashSummaryV3StyleValue(summary),
    durationSpanStart: m.start, durationSpanEnd: m.end,
    durationSpanHash: hashSummaryV3StyleValue(summary.slice(m.start, m.end)) };
}

function functionBody(text: string, name: string): string {
  const source = ts.createSourceFile('test-only-source.ts', text, ts.ScriptTarget.Latest, true);
  const fn = source.statements.filter(ts.isFunctionDeclaration).find(n => n.name?.text === name);
  if (!fn?.body) throw new Error('Missing source-floor authority: ' + name);
  return fn.body.getText(source).replaceAll('\r\n', '\n');
}

/** Current semantic gate, not whole-file old-byte equality. Exactly TWO
 * authorized statements affect this ordered producer body. Require each once;
 * no arbitrary masking of result, producer, membership or diagnostic changes.
 * Existing executable fixture matrices still exercise actual current decisions.
 */
export function assertCurrentTask084SourceFloorContract(current = readFileSync(resolve(
  process.cwd(), 'src/lib/ai-core-v3/summary-style-m5-server.ts'), 'utf8')): void {
  const historical = historicalPreTask084Source('src/lib/ai-core-v3/summary-style-m5-server.ts');
  let body = functionBody(current, 'sourceFloorFirstPositiveProducer');
  const permission = '  snapshot = trustedTenureSourceComparison(snapshot);\n';
  const location = '    observeNumericLocation?.(sourceNumberLocations[firstUnmatchedIndex]!);\n';
  expect(body.split(permission)).toHaveLength(2);
  expect(body.split(location)).toHaveLength(2);
  const precedesPermission = "  if (hasUnsupportedSourceNonnumericMaterialResultRelation(snapshot)) return 'unsupported_source_nonnumeric_material_result_relation';\n";
  expect(body).toContain(precedesPermission + permission + '  const manifestText = ');
  body = body.replace(permission, '').replace(location, '');
  expect(body).toBe(functionBody(historical, 'sourceFloorFirstPositiveProducer'));
  for (const relative of ['summary-style-m5-local-observability.ts', 'summary-v3-production-observability.ts']) {
    const path = 'src/lib/ai-core-v3/' + relative;
    expect(readFileSync(resolve(process.cwd(), path), 'utf8')).toBe(historicalPreTask084Source(path));
  }
}
