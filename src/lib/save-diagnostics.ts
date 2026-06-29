import { Capacitor } from '@capacitor/core';
import { SaveFileNative } from './save-file-plugin';

export type SaveDiagnosticFormat = 'pdf' | 'docx' | 'other';

export interface SaveDiagnosticEvent {
  ts: number;
  source: 'js' | 'native';
  phase: string;
  format?: SaveDiagnosticFormat;
  blobSize?: number;
  byteLength?: number;
  base64Length?: number;
  expectedBytes?: number;
  decodedBytes?: number;
  bytesWritten?: number;
  verifiedSize?: number;
  failedStage?: string;
  exceptionClass?: string;
  code?: string;
  uriAuthority?: string;
  deleted?: boolean;
  resultCode?: number;
  callPresent?: boolean;
  dataPresent?: boolean;
}

const STORAGE_KEY = 'cvpro-save-diagnostics-v1';
const MAX_EVENTS = 300;

function isNativeAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function readJsEvents(): SaveDiagnosticEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean).slice(-MAX_EVENTS) : [];
  } catch {
    return [];
  }
}

function writeJsEvents(events: SaveDiagnosticEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // Diagnostics must never block export.
  }
}

function cleanEvent(event: SaveDiagnosticEvent): SaveDiagnosticEvent {
  const cleaned: SaveDiagnosticEvent = {
    ts: event.ts,
    source: event.source,
    phase: event.phase,
  };

  for (const key of [
    'format',
    'blobSize',
    'byteLength',
    'base64Length',
    'expectedBytes',
    'decodedBytes',
    'bytesWritten',
    'verifiedSize',
    'failedStage',
    'exceptionClass',
    'code',
    'uriAuthority',
    'deleted',
    'resultCode',
    'callPresent',
    'dataPresent',
  ] as const) {
    const value = event[key];
    if (value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cleaned as any)[key] = value;
    }
  }

  return cleaned;
}

export function recordJsSaveDiagnostic(
  phase: string,
  details: Omit<SaveDiagnosticEvent, 'ts' | 'source' | 'phase'> = {},
): void {
  const event = cleanEvent({
    ts: Date.now(),
    source: 'js',
    phase,
    ...details,
  });
  writeJsEvents([...readJsEvents(), event]);
}

export async function getSaveDiagnostics(): Promise<SaveDiagnosticEvent[]> {
  const jsEvents = readJsEvents();
  if (!isNativeAndroid() || !Capacitor.isPluginAvailable('SaveFile')) {
    return jsEvents.sort((a, b) => a.ts - b.ts);
  }

  try {
    const native = await SaveFileNative.getDiagnostics();
    return [...jsEvents, ...((native.events || []) as SaveDiagnosticEvent[])].sort((a, b) => a.ts - b.ts);
  } catch {
    return jsEvents.sort((a, b) => a.ts - b.ts);
  }
}

export async function clearSaveDiagnostics(): Promise<void> {
  writeJsEvents([]);
  if (!isNativeAndroid() || !Capacitor.isPluginAvailable('SaveFile')) return;
  try {
    await SaveFileNative.clearDiagnostics();
  } catch {
    // Diagnostics must never block the viewer.
  }
}

export function summarizeSaveDiagnostics(events: SaveDiagnosticEvent[]) {
  const last = events[events.length - 1];
  const latest = [...events].reverse();
  const pickNumber = (key: keyof SaveDiagnosticEvent) => {
    const event = latest.find(item => typeof item[key] === 'number');
    return event?.[key] as number | undefined;
  };
  const failed = latest.find(item => item.failedStage || item.phase.endsWith('FAILED'));
  const format = latest.find(item => item.format)?.format;

  return {
    lastPhase: last?.phase || 'None',
    format,
    blobSize: pickNumber('blobSize'),
    byteLength: pickNumber('byteLength'),
    base64Length: pickNumber('base64Length'),
    decodedBytes: pickNumber('decodedBytes'),
    expectedBytes: pickNumber('expectedBytes'),
    bytesWritten: pickNumber('bytesWritten'),
    verifiedSize: pickNumber('verifiedSize'),
    failedStage: failed?.failedStage,
  };
}
