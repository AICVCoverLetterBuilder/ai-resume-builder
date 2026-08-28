import { describe, expect, it } from 'vitest';
import type { SourceAuthoritySnapshot } from '../contracts';
import { createSourceAuthoritySnapshot } from '../source-authority';

describe('SourceAuthoritySnapshot', () => {
  it('preserves exact supplied authority and is isolated from later input mutation', () => {
    const mutableInput = {
      operationId: 'operation-source-1',
      operationKind: 'experience_enhance' as const,
      documentId: 'cv-document-1',
      targetEntryId: 'experience-stable-id',
      sourceText: '  Exact supplied text.\nSecond line.  ',
      sourceLocale: 'de',
      targetLocale: 'sr',
      provenance: { origin: 'user_input' as const, detail: 'explicit form source' },
      sourceHash: 'sha256-source-1',
      snapshotHash: 'sha256-snapshot-1',
      employmentState: 'present' as const,
      dates: { start: { year: 2024, month: 2 }, end: null },
      captureToken: 'capture-token-1',
    };

    const snapshot = createSourceAuthoritySnapshot({
      ...mutableInput,
      generatedText: 'must not cross the contract boundary',
    } as typeof mutableInput);
    mutableInput.sourceText = 'mutated';
    mutableInput.targetEntryId = 'different-entry';
    mutableInput.dates.start.year = 1999;

    expect(snapshot.sourceText).toBe('  Exact supplied text.\nSecond line.  ');
    expect(snapshot.targetEntryId).toBe('experience-stable-id');
    expect(snapshot.sourceLocale).toBe('de');
    expect(snapshot.targetLocale).toBe('sr');
    expect(snapshot.dates?.start.year).toBe(2024);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.dates?.start)).toBe(true);
    expect('generatedText' in snapshot).toBe(false);
    expect('prose' in snapshot).toBe(false);
  });

  it('requires stable Experience identity and matching structured employment data', () => {
    const base: SourceAuthoritySnapshot = {
      operationId: 'operation-source-2',
      operationKind: 'experience_generate',
      targetEntryId: 'entry-2',
      sourceText: '',
      sourceLocale: 'de',
      targetLocale: 'de',
      provenance: { origin: 'explicit_caller_input' },
      sourceHash: 'sha256-source-2',
      snapshotHash: 'sha256-snapshot-2',
      employmentState: 'completed',
      dates: { start: { year: 2020 }, end: { year: 2023 } },
      captureToken: 'capture-token-2',
    };
    expect(() => createSourceAuthoritySnapshot({ ...base, targetEntryId: '' })).toThrow(/targetEntryId/);
    expect(() => createSourceAuthoritySnapshot({ ...base, dates: undefined })).toThrow(/supplied together/);
  });
});
