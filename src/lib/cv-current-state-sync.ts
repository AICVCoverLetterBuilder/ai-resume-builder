import type { CVData } from './types';

/**
 * A local edit remains the authoritative current state until the store
 * publishes that exact snapshot. This is intentionally domain-neutral: it
 * coordinates the page's current-CV synchronization only and is not an AI
 * operation owner.
 */
export function shouldAcceptIncomingCurrentCv(options: {
  pendingLocalCv: CVData | null;
  incomingCv: CVData;
}): boolean {
  return options.pendingLocalCv === null
    || options.pendingLocalCv === options.incomingCv;
}
