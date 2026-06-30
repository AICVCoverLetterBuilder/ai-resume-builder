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
    fileName?: string;
    destination?: string;
  }>;
}

export const SaveFileNative = registerPlugin<SaveFilePluginDefinition>('SaveFile');
