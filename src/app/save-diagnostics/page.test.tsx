/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';

const mocks = vi.hoisted(() => ({
  clearSaveDiagnostics: vi.fn(),
  getSaveDiagnostics: vi.fn(),
  summarizeSaveDiagnostics: vi.fn(),
}));

vi.mock('@/lib/save-diagnostics', () => ({
  clearSaveDiagnostics: mocks.clearSaveDiagnostics,
  getSaveDiagnostics: mocks.getSaveDiagnostics,
  summarizeSaveDiagnostics: mocks.summarizeSaveDiagnostics,
}));

vi.mock('next/link', () => ({
  default: (props: Record<string, unknown>) => React.createElement('a', props, props.children),
}));

vi.mock('lucide-react', () => {
  const icon = (name: string) => {
    function MockIcon(props: Record<string, unknown>) {
      return React.createElement('span', { ...props, 'data-testid': name });
    }
    MockIcon.displayName = `Mock${name}`;
    return MockIcon;
  };
  return {
    ArrowLeft: icon('arrow-left'),
    Clipboard: icon('clipboard'),
    RefreshCw: icon('refresh-cw'),
    Trash2: icon('trash-2'),
  };
});

async function renderSaveDiagnosticsPage() {
  const mod = await import('./page');
  await act(async () => {
    render(React.createElement(mod.default));
  });
}

describe('Save diagnostics page', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.getSaveDiagnostics.mockResolvedValue([
      {
        ts: 1000,
        source: 'native',
        phase: 'DESTINATION_READBACK_COMPLETED',
        format: 'pdf',
        expectedBytes: 1234,
        bytesWritten: 1234,
        verifiedSize: 1234,
        resultCode: -1,
        callPresent: true,
        dataPresent: true,
        failedStage: undefined,
        code: undefined,
        uriAuthority: 'com.android.providers.downloads.documents',
      },
    ]);
    mocks.clearSaveDiagnostics.mockResolvedValue(undefined);
    mocks.summarizeSaveDiagnostics.mockReturnValue({
      lastPhase: 'DESTINATION_READBACK_COMPLETED',
      format: 'pdf',
      expectedBytes: 1234,
      bytesWritten: 1234,
      verifiedSize: 1234,
      failedStage: undefined,
    });
  });

  afterEach(() => {
    cleanup();
  });

  test('shows safe diagnostics controls, ordered events, numeric sizes, and back navigation', async () => {
    await renderSaveDiagnosticsPage();

    expect(screen.getByRole('link', { name: /Back to Pricing/ })).toHaveAttribute('href', '/pricing');
    expect(screen.getByRole('button', { name: /Refresh/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy diagnostics/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear diagnostics/ })).toBeInTheDocument();

    await waitFor(() => expect(mocks.getSaveDiagnostics).toHaveBeenCalled());

    expect(screen.getAllByText('DESTINATION_READBACK_COMPLETED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1234').length).toBeGreaterThan(0);
    expect(screen.getByText('-1')).toBeInTheDocument();
    expect(screen.getAllByText('true').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('com.android.providers.downloads.documents')).toBeInTheDocument();
    expect(screen.queryByText(/base64,/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/content:\/\//i)).not.toBeInTheDocument();
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
  });
});
