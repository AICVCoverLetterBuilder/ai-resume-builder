export const AI_DIAGNOSTICS_TERMINALIZER_REVISION =
  'ai-diagnostics-terminalizer-412-v1' as const;

export type TerminalizableAiDiagnosticSession<TTrace> = {
  resolveVersions(): Promise<unknown>;
  commit(): TTrace;
};

/**
 * Every started AI diagnostic session must reach a terminal persistence attempt.
 *
 * Version enrichment is best-effort. A version lookup failure must never prevent
 * the diagnostic trace itself from being committed.
 *
 * commit() is intentionally called even when an earlier branch already committed;
 * the diagnostic sessions own idempotency and therefore remain the single source
 * of truth for latest/history persistence.
 */
export async function terminalizeAiDiagnosticSession<TTrace>(
  session: TerminalizableAiDiagnosticSession<TTrace>,
): Promise<TTrace | null> {
  try {
    await session.resolveVersions();
  } catch {
    /* Version enrichment must never suppress terminal diagnostics. */
  }

  try {
    return session.commit();
  } catch {
    /* Diagnostics must never break the user-facing AI operation. */
    return null;
  }
}
