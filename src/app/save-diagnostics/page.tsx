'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clipboard, RefreshCw, Trash2 } from 'lucide-react';
import {
  clearSaveDiagnostics,
  getSaveDiagnostics,
  summarizeSaveDiagnostics,
  type SaveDiagnosticEvent,
} from '@/lib/save-diagnostics';

function value(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

export default function SaveDiagnosticsPage() {
  const [events, setEvents] = useState<SaveDiagnosticEvent[]>([]);
  const [copied, setCopied] = useState(false);

  const summary = useMemo(() => summarizeSaveDiagnostics(events), [events]);

  const refresh = async () => {
    setEvents(await getSaveDiagnostics());
  };

  useEffect(() => {
    void refresh();
  }, []);

  const copyDiagnostics = async () => {
    const payload = {
      summary,
      events,
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const clear = async () => {
    await clearSaveDiagnostics();
    await refresh();
  };

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-xl font-semibold">Save diagnostics</h1>
            <p className="mt-1 text-sm text-gray-400">Test build</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-md bg-gray-800 px-3 py-2 text-sm font-medium text-gray-100 hover:bg-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Pricing
            </Link>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-md bg-gray-800 px-3 py-2 text-sm font-medium text-gray-100 hover:bg-gray-700"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={copyDiagnostics}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              <Clipboard className="h-4 w-4" />
              {copied ? 'Copied' : 'Copy diagnostics'}
            </button>
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-2 rounded-md bg-gray-800 px-3 py-2 text-sm font-medium text-gray-100 hover:bg-gray-700"
            >
              <Trash2 className="h-4 w-4" />
              Clear diagnostics
            </button>
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Last phase', summary.lastPhase],
            ['Format', summary.format],
            ['Blob size', summary.blobSize],
            ['Byte length', summary.byteLength],
            ['Base64 length', summary.base64Length],
            ['Decoded bytes', summary.decodedBytes],
            ['Expected bytes', summary.expectedBytes],
            ['Bytes written', summary.bytesWritten],
            ['Verified size', summary.verifiedSize],
            ['Failed stage', summary.failedStage],
          ].map(([label, item]) => (
            <div key={label} className="rounded-md border border-gray-800 bg-gray-900 p-3">
              <div className="text-xs uppercase text-gray-500">{label}</div>
              <div className="mt-1 break-words text-sm font-semibold text-gray-100">{value(item)}</div>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-md border border-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-xs">
              <thead className="bg-gray-900 text-gray-400">
                <tr>
                  {[
                    'Time',
                    'Source',
                    'Phase',
                    'Format',
                    'Blob',
                    'Bytes',
                    'Base64',
                    'Decoded',
                    'Expected',
                    'Written',
                    'Verified',
                    'Result',
                    'Call',
                    'Data',
                    'Failed stage',
                    'Exception/code',
                    'Authority',
                    'Deleted',
                  ].map(header => (
                    <th key={header} className="border-b border-gray-800 px-3 py-2 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td className="px-3 py-5 text-center text-gray-500" colSpan={18}>
                      No diagnostics recorded
                    </td>
                  </tr>
                ) : (
                  events.map((event, index) => (
                    <tr key={`${event.ts}-${event.phase}-${index}`} className="odd:bg-gray-950 even:bg-gray-900/50">
                      <td className="px-3 py-2 text-gray-400">{formatTime(event.ts)}</td>
                      <td className="px-3 py-2">{event.source}</td>
                      <td className="px-3 py-2 font-medium">{event.phase}</td>
                      <td className="px-3 py-2">{value(event.format)}</td>
                      <td className="px-3 py-2">{value(event.blobSize)}</td>
                      <td className="px-3 py-2">{value(event.byteLength)}</td>
                      <td className="px-3 py-2">{value(event.base64Length)}</td>
                      <td className="px-3 py-2">{value(event.decodedBytes)}</td>
                      <td className="px-3 py-2">{value(event.expectedBytes)}</td>
                      <td className="px-3 py-2">{value(event.bytesWritten)}</td>
                      <td className="px-3 py-2">{value(event.verifiedSize)}</td>
                      <td className="px-3 py-2">{value(event.resultCode)}</td>
                      <td className="px-3 py-2">{value(event.callPresent)}</td>
                      <td className="px-3 py-2">{value(event.dataPresent)}</td>
                      <td className="px-3 py-2">{value(event.failedStage)}</td>
                      <td className="px-3 py-2">{value(event.exceptionClass || event.code)}</td>
                      <td className="px-3 py-2">{value(event.uriAuthority)}</td>
                      <td className="px-3 py-2">{value(event.deleted)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
