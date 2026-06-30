/**
 * Platform-aware file saving.
 *
 * Android uses the custom SaveFile Capacitor plugin. Android 10+ saves
 * directly to MediaStore Downloads; older Android versions use the native
 * fallback provided by the plugin. Web uses a Blob download.
 */

import { Capacitor } from '@capacitor/core';
import { SaveFileNative, type SaveFileHealthResult } from './save-file-plugin';

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

export interface SaveFileResult {
  result: 'saved' | 'cancelled' | 'failed';
  message: string;
  platform?: 'android' | 'ios' | 'web' | 'other';
  fileName?: string;
  destination?: string;
  bytesWritten?: number;
  verifiedSize?: number;
  sourceBytes?: number;
}

type SaveFileFormat = 'pdf' | 'docx' | 'other';

function isNativeAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function getCurrentPlatform(): SaveFileResult['platform'] {
  if (typeof window === 'undefined') return 'web';
  const platform = Capacitor.getPlatform();
  if (platform === 'android' || platform === 'ios' || platform === 'web') return platform;
  return 'other';
}

function getFormatLabel(mimeType: string): SaveFileFormat {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  return 'other';
}

function logSaveBoundary(
  stage: string,
  details: Record<string, string | number | boolean | undefined>,
): void {
  if (process.env.NODE_ENV === 'test') return;
  console.info('[native-save]', { stage, ...details });
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function blobToBase64Payload(blob: Blob): Promise<{
  base64Data: string;
  byteLength: number;
}> {
  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new SaveFailedError('Generated file is empty');
  }

  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength <= 0) {
    throw new SaveFailedError('Generated file is empty');
  }

  const base64Data = bytesToBase64(bytes);
  if (!base64Data) {
    throw new SaveFailedError('Generated file could not be encoded');
  }

  return { base64Data, byteLength: bytes.byteLength };
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
  const format = getFormatLabel(mimeType);
  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new SaveFailedError('Generated file is empty');
  }
  if (!fileName.trim() || !mimeType.trim()) {
    throw new SaveFailedError('Invalid file name or MIME type');
  }

  if (isNativeAndroid()) {
    try {
      logSaveBoundary('android_prepare', {
        format,
        sourceBlobSize: blob.size,
      });
      await ensureNativeSaveAvailable();
      const { base64Data, byteLength } = await blobToBase64Payload(blob);
      logSaveBoundary('android_encoded', {
        format,
        sourceByteLength: byteLength,
        base64Length: base64Data.length,
      });
      const result = await SaveFileNative.saveFile({
        base64Data,
        fileName,
        mimeType,
        expectedBytes: byteLength,
      });
      logSaveBoundary('android_result', {
        format,
        sourceByteLength: byteLength,
        bytesWritten: result.bytesWritten,
        verifiedSize: result.verifiedSize,
        saved: result.result === 'saved',
      });

      if (result.result === 'cancelled') {
        throw new SaveCancelledError();
      }
      if (result.result !== 'saved') {
        throw new SaveFailedError(result.message || 'File save failed on native device');
      }
      if (
        typeof result.bytesWritten !== 'number' ||
        typeof result.verifiedSize !== 'number' ||
        result.bytesWritten <= 0 ||
        result.verifiedSize <= 0
      ) {
        throw new SaveFailedError('Native file save did not verify non-empty output');
      }
      if (result.bytesWritten !== byteLength || result.verifiedSize !== byteLength) {
        throw new SaveFailedError('Native file save byte count did not match generated file');
      }
      return {
        ...result,
        platform: 'android',
        fileName: result.fileName || fileName,
        sourceBytes: byteLength,
      };
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
    return {
      result: 'saved',
      message: 'Download started',
      platform: getCurrentPlatform(),
      fileName,
      sourceBytes: blob.size,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Download failed';
    console.error('[native-save] Web download error:', message);
    return { result: 'failed', message, platform: getCurrentPlatform(), fileName };
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
