/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import * as React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { isDeveloperDiagnosticUiEnabled } from '@/lib/developer-diagnostic-ui';
import {
  CoverLetterArabicPdfDiagnosticsButton,
  CoverLetterGenerationDiagnosticsButton,
  CoverLetterGroundingDiagnosticsButton,
} from '@/components/CoverLetterDiagnosticControls';

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: toastMocks,
}));

vi.mock('@/lib/cover-letter-generation-resolve', () => ({
  formatCoverLetterGenerationDiagnosticsForCopy: () => 'generation-diag',
}));

vi.mock('@/lib/cover-letter-arabic-pdf', () => ({
  copyArabicCoverLetterPdfDiagnosticsToClipboard: vi.fn(async () => true),
}));

vi.mock('@/lib/cover-letter-grounding-diagnostics', () => ({
  copyCoverLetterGroundingDiagnosticsToClipboard: vi.fn(async () => true),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  toastMocks.success.mockReset();
  toastMocks.error.mockReset();
});

describe('isDeveloperDiagnosticUiEnabled', () => {
  test('is true outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isDeveloperDiagnosticUiEnabled()).toBe(true);
    vi.stubEnv('NODE_ENV', 'test');
    expect(isDeveloperDiagnosticUiEnabled()).toBe(true);
  });

  test('is false in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isDeveloperDiagnosticUiEnabled()).toBe(false);
  });
});

describe('Cover Letter diagnostic UI visibility', () => {
  test('diagnostic controls render in development when flagged', () => {
    vi.stubEnv('NODE_ENV', 'development');
    render(
      React.createElement(React.Fragment, null,
        React.createElement(CoverLetterGenerationDiagnosticsButton, { show: true }),
        React.createElement(CoverLetterArabicPdfDiagnosticsButton, { show: true }),
        React.createElement(CoverLetterGroundingDiagnosticsButton, { show: true }),
      ),
    );
    expect(screen.getByRole('button', { name: 'Copy generation diagnostics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy PDF diagnostics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy grounding diagnostics' })).toBeInTheDocument();
  });

  test('diagnostic controls do not render in production even when flagged', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { container } = render(
      React.createElement(React.Fragment, null,
        React.createElement(CoverLetterGenerationDiagnosticsButton, { show: true }),
        React.createElement(CoverLetterArabicPdfDiagnosticsButton, { show: true }),
        React.createElement(CoverLetterGroundingDiagnosticsButton, { show: true }),
        React.createElement('button', { type: 'button' }, 'Download PDF'),
        React.createElement('button', { type: 'button' }, 'Download DOCX'),
        React.createElement('button', { type: 'button' }, 'Generate'),
        React.createElement('button', { type: 'button' }, 'Copy'),
      ),
    );
    expect(screen.queryByRole('button', { name: 'Copy generation diagnostics' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy PDF diagnostics' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy grounding diagnostics' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download DOCX' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    // No leftover empty wrappers from diagnostic buttons
    expect(container.querySelectorAll('button').length).toBe(4);
  });

  test('diagnostic buttons stay unmounted when show flags are false in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    render(
      React.createElement(React.Fragment, null,
        React.createElement(CoverLetterGenerationDiagnosticsButton, { show: false }),
        React.createElement(CoverLetterArabicPdfDiagnosticsButton, { show: false }),
        React.createElement(CoverLetterGroundingDiagnosticsButton, { show: false }),
      ),
    );
    expect(screen.queryByRole('button', { name: /diagnostics/i })).not.toBeInTheDocument();
  });

  test('cover-letter page wires diagnostic buttons through the developer UI guard', () => {
    const source = fs.readFileSync(path.resolve('src/app/cover-letter/page.tsx'), 'utf8');
    expect(source).toContain('CoverLetterGenerationDiagnosticsButton');
    expect(source).toContain('CoverLetterArabicPdfDiagnosticsButton');
    expect(source).toContain('CoverLetterGroundingDiagnosticsButton');
    expect(source).not.toMatch(/>\s*Copy generation diagnostics\s*</);
    expect(source).not.toMatch(/>\s*Copy PDF diagnostics\s*</);
    expect(source).not.toMatch(/>\s*Copy grounding diagnostics\s*</);
    // Ordinary user controls remain on the page
    expect(source).toContain('t.coverLetter.downloadCl');
    expect(source).toContain('t.cv.copy');
    expect(source).toContain('handleGenerate');
    expect(source).toContain('toast.error');
    // Diagnostic collection still recorded (not removed)
    expect(source).toContain('updateCoverLetterGroundingDiagnostics');
    expect(source).toContain('setShowGroundingDiagnostics');
    expect(source).toContain('setShowArabicPdfDiagnostics');
  });

  test('diagnostic control module uses the centralized production guard', () => {
    const source = fs.readFileSync(path.resolve('src/components/CoverLetterDiagnosticControls.tsx'), 'utf8');
    expect(source).toContain('isDeveloperDiagnosticUiEnabled');
    expect(source).toContain('formatCoverLetterGenerationDiagnosticsForCopy');
    expect(source).toContain('copyArabicCoverLetterPdfDiagnosticsToClipboard');
    expect(source).toContain('copyCoverLetterGroundingDiagnosticsToClipboard');
  });
});
