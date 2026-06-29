import { registerPlugin } from '@capacitor/core';

export interface SaveFileHealthResult {
  pluginAvailable: boolean;
  cacheWritable: boolean;
  pluginVersion: string;
}

export interface SaveFilePluginDefinition {
  healthCheck(): Promise<SaveFileHealthResult>;
  saveFile(options: {
    base64Data: string;
    fileName: string;
    mimeType: string;
    expectedBytes: number;
  }): Promise<{
    result: 'saved' | 'cancelled' | 'failed';
    message: string;
    bytesWritten?: number;
    verifiedSize?: number;
    uriAuthority?: string;
    displayName?: string;
  }>;
  getDiagnostics(): Promise<{ events: unknown[] }>;
  clearDiagnostics(): Promise<{ cleared: boolean }>;
}

export const SaveFileNative = registerPlugin<SaveFilePluginDefinition>('SaveFile');
