'use client';

import type { CVData, CoverLetterData } from './types';
import {
  CV_RUNTIME_MIGRATION_VERSION,
  normalizeLegacyCvRuntime,
} from './cv-legacy-runtime-migration';

const CV_DRAFT_KEY = 'cvpro-cv-draft';
const CL_DRAFT_KEY = 'cvpro-cover-letter-draft';

export const CV_DRAFT_STORAGE_KEY = CV_DRAFT_KEY;
export const CL_DRAFT_STORAGE_KEY = CL_DRAFT_KEY;

// ─── CV Draft ─────────────────────────────────────────────────────────────────

export interface CvDraftData {
  cv: CVData;
  /** Persisted CV schema version; absent on pre-migration Android saves. */
  schemaVersion?: number;
  /** Raw uploaded file data URL (never cropped) */
  originalPhoto?: string;
  /** Circular-clip PNG used by circle-shaped templates */
  circularPhoto?: string;
  /** 3:4 JPEG derived from the original upload, used by rectangle templates */
  rectangularPhoto?: string;
  /** ISO timestamp of when the draft was last saved */
  savedAt: string;
}

type PersonalPhotoFields = {
  originalPhoto?: string;
  circularPhoto?: string;
  rectangularPhoto?: string;
};

function withPersonalPhotoFields(data: CvDraftData): CvDraftData {
  const personal = data.cv.personal as typeof data.cv.personal & PersonalPhotoFields;
  const originalPhoto = personal.originalPhoto ?? data.originalPhoto;
  const circularPhoto = personal.circularPhoto ?? data.circularPhoto;
  const rectangularPhoto = personal.rectangularPhoto ?? data.rectangularPhoto;

  return {
    ...data,
    cv: {
      ...data.cv,
      personal: {
        ...personal,
        ...(originalPhoto !== undefined ? { originalPhoto } : {}),
        ...(circularPhoto !== undefined ? { circularPhoto } : {}),
        ...(rectangularPhoto !== undefined ? { rectangularPhoto } : {}),
      },
    },
    originalPhoto,
    circularPhoto,
    rectangularPhoto,
  };
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function saveCvDraft(data: CvDraftData): boolean {
  if (!isBrowser()) return false;
  try {
    const normalized = withPersonalPhotoFields({
      ...data,
      cv: normalizeLegacyCvRuntime(data.cv),
      schemaVersion: CV_RUNTIME_MIGRATION_VERSION,
    });
    localStorage.setItem(CV_DRAFT_KEY, JSON.stringify(normalized));
    return true;
  } catch (err) {
    // localStorage quota exceeded — silently ignore; data survives in RAM
    console.warn('[draft] Failed to save CV draft:', err);
    return false;
  }
}

export function loadCvDraft(): CvDraftData | null {
  if (!isBrowser()) return null;
  try {
    const stored = localStorage.getItem(CV_DRAFT_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as CvDraftData;
    // Basic validation
    if (!parsed.cv || typeof parsed.cv !== 'object') return null;
    const hydrated = withPersonalPhotoFields({
      ...parsed,
      cv: normalizeLegacyCvRuntime(parsed.cv),
      schemaVersion: CV_RUNTIME_MIGRATION_VERSION,
    });
    // Persist the idempotent migration immediately so an export tapped before
    // the builder autosave timer cannot re-read the old Android snapshot.
    if (
      parsed.schemaVersion !== CV_RUNTIME_MIGRATION_VERSION
      || parsed.cv.runtimeMigrationVersion !== CV_RUNTIME_MIGRATION_VERSION
    ) {
      localStorage.setItem(CV_DRAFT_KEY, JSON.stringify(hydrated));
    }
    return hydrated;
  } catch {
    return null;
  }
}

export function clearCvDraft(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(CV_DRAFT_KEY);
  } catch {
    // silently ignore
  }
}

// ─── Cover Letter Draft ───────────────────────────────────────────────────────

export interface ClDraftData {
  coverLetter: CoverLetterData;
  savedAt: string;
}

export function saveClDraft(data: ClDraftData): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(CL_DRAFT_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[draft] Failed to save Cover Letter draft:', err);
  }
}

export function loadClDraft(): ClDraftData | null {
  if (!isBrowser()) return null;
  try {
    const stored = localStorage.getItem(CL_DRAFT_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as ClDraftData;
    if (!parsed.coverLetter || typeof parsed.coverLetter !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearClDraft(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(CL_DRAFT_KEY);
  } catch {
    // silently ignore
  }
}

// ─── Clear All Drafts ─────────────────────────────────────────────────────────

export function clearAllDrafts(): void {
  clearCvDraft();
  clearClDraft();
}
