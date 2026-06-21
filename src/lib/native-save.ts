/**
 * native-save.ts — Platform-aware file saving
 *
 * On Android (Capacitor native): uses the SaveFile plugin to invoke
 * ACTION_CREATE_DOCUMENT, showing the Android system file-save picker.
 *
 * On web: falls back to the standard browser blob-download pattern.
 * The web approach cannot detect cancellation, so it always reports "saved".
 *
 * IMPORTANT: On Android, the function throws SaveCancelledError when the user
 * cancels the save picker. Callers MUST catch this separately to avoid
 * incrementing download counters on cancellation.
 */

import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

// ─── Custom error ─────────────────────────────────────────────────────────────

/**
 * Thrown when the user cancels the Android save-location picker.
 * Do not increment counters or show error toasts for this error.
 */
export class SaveCancelledError extends Error {
  constructor() {
    super('Save cancelled by user');
    this.name = 'SaveCancelledError';
  }
}

/**
 * Thrown when a native file save operation fails unexpectedly.
 * Unlike SaveCancelledError, this represents a technical failure
 * that should be surfaced to the user.
 */
export class SaveFailedError extends Error {
  constructor(message?: string) {
    super(message || 'File save failed');
    this.name = 'SaveFailedError';
  }
}

// ─── Plugin interface ─────────────────────────────────────────────────────────

interface SaveFilePluginDefinition {
  saveFile(options: {
    base64Data: string;
    fileName: string;
    mimeType: string;
  }): Promise<{ result: 'saved' | 'cancelled' | 'failed'; message: string }>;
}

/**
 * Native SaveFile plugin for Android (ACTION_CREATE_DOCUMENT).
 * On web, registerPlugin returns a default stub that will reject.
 * We catch that and fall back to blob download.
 */
const SaveFileNative = registerPlugin<SaveFilePluginDefinition>('SaveFile');

// ─── Result type ──────────────────────────────────────────────────────────────

export interface SaveFileResult {
  result: 'saved' | 'cancelled' | 'failed';
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isNativeAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip the data:...;base64, prefix to get raw base64
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save a file with a system save-location picker (Android) or browser
 * download (web).
 *
 * Throws SaveCancelledError when the user cancels the save dialog (Android only).
 * Callers should catch this separately to avoid incrementing counters.
 *
 * @param blob - The file data
 * @param fileName - Suggested filename including extension (e.g. "cv.pdf")
 * @param mimeType - MIME type (e.g. "application/pdf")
 * @throws SaveCancelledError when user cancels save dialog
 * @returns SaveFileResult indicating saved or failed
 */
export async function saveFileViaPlatform(
  blob: Blob,
  fileName: string,
  mimeType: string,
): Promise<SaveFileResult> {
  // ── Native Android: use ACTION_CREATE_DOCUMENT via Capacitor plugin ──
  if (isNativeAndroid()) {
    try {
      const base64Data = await blobToBase64(blob);
      const result = await SaveFileNative.saveFile({ base64Data, fileName, mimeType });

      if (result.result === 'cancelled') {
        throw new SaveCancelledError();
      }

      if (result.result === 'failed') {
        console.error('[native-save] Save failed:', result.message);
        throw new SaveFailedError(result.message || 'File save failed on native device');
      }

      return result; // 'saved'
    } catch (err: unknown) {
      if (err instanceof SaveCancelledError) throw err;
      if (err instanceof SaveFailedError) throw err;
      const msg = err instanceof Error ? err.message : 'Unknown plugin error';
      console.error('[native-save] Plugin error:', msg);
      throw new SaveFailedError(msg);
    }
  }

  // ── Web Fallback: standard browser download ──
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke after a short delay to allow the download to start
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    // Web cannot detect cancellation — treat as saved
    return { result: 'saved', message: 'Download started' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Download failed';
    console.error('[native-save] Web download error:', msg);
    return { result: 'failed', message: msg };
  }
}

// ─── jsPDF helpers ────────────────────────────────────────────────────────────

/**
 * Extracts a Blob from a jsPDF instance.
 * jsPDF's `output` method supports 'blob' as a type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pdfToBlob(pdfInstance: any): Blob | null {
  try {
    return pdfInstance.output('blob') as Blob;
  } catch {
    return null;
  }
}