/**
 * Platform-aware file saving.
 *
 * Android uses the custom SaveFile Capacitor plugin and Storage Access
 * Framework ACTION_CREATE_DOCUMENT picker. Web uses a Blob download.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

export class SaveCancelledError extends Error {
  constructor() {
    super('Save cancelled by user');
    this.name = 'SaveCancelledError';
  }
}

export class SaveFailedError extends Error {
  constructor(message?: string) {
    super(message || 'File save failed');
    this.name = 'SaveFailedError';
  }
}

interface SaveFileHealthResult {
  pluginAvailable: boolean;
  cacheWritable: boolean;
  pluginVersion: string;
}

interface SaveFilePluginDefinition {
  healthCheck(): Promise<SaveFileHealthResult>;
  saveFile(options: {
    base64Data: string;
    fileName: string;
    mimeType: string;
  }): Promise<{ result: 'saved' | 'cancelled' | 'failed'; message: string }>;
}

const SaveFileNative = registerPlugin<SaveFilePluginDefinition>('SaveFile');

export interface SaveFileResult {
  result: 'saved' | 'cancelled' | 'failed';
  message: string;
}

function isNativeAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Failed to read blob'));
        return;
      }
      const comma = reader.result.indexOf(',');
      const raw = comma >= 0 ? reader.result.slice(comma + 1) : reader.result;
      if (!raw) {
        reject(new Error('Generated file is empty'));
        return;
      }
      resolve(raw);
    };
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

export async function ensureNativeSaveAvailable(): Promise<SaveFileHealthResult> {
  if (!isNativeAndroid()) {
    return { pluginAvailable: false, cacheWritable: false, pluginVersion: 'web' };
  }

  if (!Capacitor.isPluginAvailable('SaveFile')) {
    throw new SaveFailedError('Native SaveFile plugin is unavailable');
  }

  try {
    const health = await SaveFileNative.healthCheck();
    if (!health.pluginAvailable) {
      throw new SaveFailedError('Native SaveFile plugin is unavailable');
    }
    if (!health.cacheWritable) {
      throw new SaveFailedError('Native export cache is not writable');
    }
    return health;
  } catch (err: unknown) {
    if (err instanceof SaveFailedError) throw err;
    const message = err instanceof Error ? err.message : 'Native SaveFile health check failed';
    throw new SaveFailedError(message);
  }
}

/**
 * Saves a file with the Android system save picker or starts a browser download.
 */
export async function saveFileViaPlatform(
  blob: Blob,
  fileName: string,
  mimeType: string,
): Promise<SaveFileResult> {
  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new SaveFailedError('Generated file is empty');
  }
  if (!fileName.trim() || !mimeType.trim()) {
    throw new SaveFailedError('Invalid file name or MIME type');
  }

  if (isNativeAndroid()) {
    try {
      await ensureNativeSaveAvailable();
      const base64Data = await blobToBase64(blob);
      const result = await SaveFileNative.saveFile({ base64Data, fileName, mimeType });

      if (result.result === 'cancelled') {
        throw new SaveCancelledError();
      }
      if (result.result !== 'saved') {
        throw new SaveFailedError(result.message || 'File save failed on native device');
      }
      return result;
    } catch (err: unknown) {
      if (err instanceof SaveCancelledError || err instanceof SaveFailedError) throw err;
      const message = err instanceof Error ? err.message : 'Unknown native file-save error';
      console.error('[native-save] Plugin error:', message);
      throw new SaveFailedError(message);
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return { result: 'saved', message: 'Download started' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Download failed';
    console.error('[native-save] Web download error:', message);
    return { result: 'failed', message };
  }
}

/** Extract a Blob from a jsPDF instance. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pdfToBlob(pdfInstance: any): Blob | null {
  try {
    return pdfInstance.output('blob') as Blob;
  } catch {
    return null;
  }
}
