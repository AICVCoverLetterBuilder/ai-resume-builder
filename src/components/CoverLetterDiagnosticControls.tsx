'use client';

import { toast } from 'sonner';
import { formatCoverLetterGenerationDiagnosticsForCopy } from '@/lib/cover-letter-generation-resolve';
import { copyArabicCoverLetterPdfDiagnosticsToClipboard } from '@/lib/cover-letter-arabic-pdf';
import { copyCoverLetterGroundingDiagnosticsToClipboard } from '@/lib/cover-letter-grounding-diagnostics';
import { isDeveloperDiagnosticUiEnabled } from '@/lib/developer-diagnostic-ui';

const diagButtonClass =
  'mt-2 block text-xs text-amber-700 dark:text-amber-400 underline';

/** Dev-only: Copy generation diagnostics */
export function CoverLetterGenerationDiagnosticsButton({ show }: { show: boolean }) {
  if (!isDeveloperDiagnosticUiEnabled() || !show) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(formatCoverLetterGenerationDiagnosticsForCopy());
          toast.success('Generation diagnostics copied');
        } catch {
          toast.error('Could not copy generation diagnostics');
        }
      }}
      className="mt-3 block text-xs text-amber-700 dark:text-amber-400 underline"
    >
      Copy generation diagnostics
    </button>
  );
}

/** Dev-only: Arabic PDF stage diagnostics */
export function CoverLetterArabicPdfDiagnosticsButton({ show }: { show: boolean }) {
  if (!isDeveloperDiagnosticUiEnabled() || !show) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyArabicCoverLetterPdfDiagnosticsToClipboard();
        toast[ok ? 'success' : 'error'](ok ? 'PDF diagnostics copied' : 'Could not copy diagnostics');
      }}
      className={diagButtonClass}
    >
      Copy PDF diagnostics
    </button>
  );
}

/** Dev-only: Grounding diagnostics */
export function CoverLetterGroundingDiagnosticsButton({ show }: { show: boolean }) {
  if (!isDeveloperDiagnosticUiEnabled() || !show) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyCoverLetterGroundingDiagnosticsToClipboard();
        toast[ok ? 'success' : 'error'](
          ok ? 'Grounding diagnostics copied' : 'Could not copy grounding diagnostics',
        );
      }}
      className={diagButtonClass}
    >
      Copy grounding diagnostics
    </button>
  );
}
