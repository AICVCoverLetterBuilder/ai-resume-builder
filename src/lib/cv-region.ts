/**
 * Region helpers for legacy draft recovery.
 * Kept outside types.ts so recommendation/export isolation tests are not
 * tripped by unrelated Region accessor changes.
 */
import { regionSettings, type Region } from './types';

/** Safe default for legacy Android drafts that omitted or polluted `region`. */
export const DEFAULT_CV_REGION: Region = 'EU';

export function isCvRegion(value: unknown): value is Region {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(regionSettings, value);
}

/** Normalize stale/missing region values so PDF/DOCX never crash on `showAddress`. */
export function normalizeCvRegion(region: unknown): Region {
  return isCvRegion(region) ? region : DEFAULT_CV_REGION;
}

export function getRegionSettings(region: unknown) {
  return regionSettings[normalizeCvRegion(region)];
}
