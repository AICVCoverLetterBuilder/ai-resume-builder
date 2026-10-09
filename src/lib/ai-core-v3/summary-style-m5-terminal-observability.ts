import {
  createSummaryStrongerTerminalDiagnostic,
  type SummaryStrongerTerminalDiagnosticEvent,
  type SummaryStrongerTerminalDiagnosticInput,
} from './summary-v3-production-observability';
import type { SummaryV3Style } from './summary-style-m5';
import {
  readSummaryStyleRepairDiagnostics,
  type SummaryStyleRepairDiagnostics,
} from './summary-style-m5-repair-observability';

export type SummaryStyleTerminalDiagnosticEvent = Omit<SummaryStrongerTerminalDiagnosticEvent, 'style'> & {
  readonly style: SummaryV3Style;
} & Partial<SummaryStyleRepairDiagnostics>;

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
  const repairDiagnostics = input.result.kind === 'not_applicable'
    || input.result.kind === 'route_failure'
    ? null : readSummaryStyleRepairDiagnostics(input.result);
  return {
    ...createSummaryStrongerTerminalDiagnostic(legacyInput),
    style,
    ...(repairDiagnostics ?? {}),
  };
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
