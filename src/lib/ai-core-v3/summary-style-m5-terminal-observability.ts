import {
  createSummaryStrongerTerminalDiagnostic,
  type SummaryStrongerTerminalDiagnosticEvent,
  type SummaryStrongerTerminalDiagnosticInput,
} from './summary-v3-production-observability';
import type { SummaryV3Style } from './summary-style-m5';

export type SummaryStyleTerminalDiagnosticEvent = Omit<SummaryStrongerTerminalDiagnosticEvent, 'style'> & {
  readonly style: SummaryV3Style;
};

export type SummaryStyleTerminalDiagnosticInput = SummaryStrongerTerminalDiagnosticInput & {
  readonly style: SummaryV3Style;
};

/**
 * Keeps the established Stronger terminal event and finite field projection,
 * while carrying the actual M5 style for every Summary style terminal result.
 * The legacy projector remains unchanged for byte-pinned historical contracts.
 */
export function createSummaryStyleTerminalDiagnostic(
  input: SummaryStyleTerminalDiagnosticInput,
): SummaryStyleTerminalDiagnosticEvent {
  const { style, ...legacyInput } = input;
  return { ...createSummaryStrongerTerminalDiagnostic(legacyInput), style };
}

/** Logging is observational and must never alter the HTTP response or decision. */
export function emitSummaryStyleTerminalDiagnostic(
  input: SummaryStyleTerminalDiagnosticInput,
): SummaryStyleTerminalDiagnosticEvent {
  const event = createSummaryStyleTerminalDiagnostic(input);
  try {
    console.info(JSON.stringify(event));
  } catch {
    // A logging failure is deliberately non-interfering.
  }
  return event;
}
