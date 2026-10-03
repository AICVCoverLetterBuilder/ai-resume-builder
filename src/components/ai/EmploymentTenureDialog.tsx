'use client';

import { useI18n } from '@/lib/i18n/context';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Presentation only. Selection starts empty in the page owner, including a
 * single-entry CV. Neither this component nor confirmation sends an AI call.
 */
export function EmploymentTenureDialog(props: Readonly<{
  open: boolean;
  durationSurface: string;
  entries: readonly Readonly<{ id: string; position: string; company: string }>[];
  selection: string;
  onSelection: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  const { t } = useI18n();
  if (!props.open) return null;
  const labels = t.employmentTenureConfirmation;
  return (
    <Dialog open={props.open} onOpenChange={(open) => { if (!open) props.onCancel(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{labels.title}</DialogTitle></DialogHeader>
        <DialogDescription>{labels.question}</DialogDescription>
        <p data-tenure-local-surface>{props.durationSurface}</p>
        <label htmlFor="employment-tenure-entry">{labels.select}</label>
        <select id="employment-tenure-entry" data-tenure-entry value={props.selection}
          onChange={(e) => props.onSelection(e.target.value)} className="h-10 rounded-md border px-3">
          <option value="">{labels.select}</option>
          {props.entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.position} — {entry.company}</option>)}
          <option value="not_employment_tenure">{labels.notTenure}</option>
        </select>
        <DialogFooter>
          <button type="button" onClick={props.onCancel}>{t.common.cancel}</button>
          <button type="button" data-tenure-confirm disabled={!props.selection} onClick={props.onConfirm}>{labels.confirm}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
