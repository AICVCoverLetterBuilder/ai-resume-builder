/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { translations } from '@/lib/i18n/translations';
import type { CVData } from '@/lib/types';

const runtime = vi.hoisted(() => ({
  currentCv: null as CVData | null,
  usage: 0,
  writes: [] as CVData[],
  requests: [] as Array<Record<string, unknown>>,
  candidates: [] as string[],
}));

vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({ locale: 'en', t: translations.en }),
}));
vi.mock('@/lib/store', () => ({
  checkProAccess: () => 'allowed',
  useApp: () => ({
    currentCv: runtime.currentCv,
    setCurrentCv: (next: CVData) => { runtime.currentCv = next; },
    persistCurrentCvTransactionally: (next: CVData) => {
      runtime.currentCv = next;
      runtime.writes.push(next);
      return true;
    },
    isPro: true,
    canDownload: () => true,
    incrementDownloads: vi.fn(),
    markAiRecommendUsed: vi.fn(),
    recordProAiSuccess: () => { runtime.usage += 1; },
    getProAiUsageCount: () => runtime.usage,
    lastCvSavedAt: 0,
    getAiGate: () => ({ status: 'ready', token: 'test-token' }),
  }),
}));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiFetch: vi.fn(async (_path: string, options: { body?: Record<string, unknown> }) => {
      runtime.requests.push(options.body || {});
      return {
        data: { result: runtime.candidates.shift(), providerResultKind: 'text' },
        response: { ok: true, status: 200 },
      };
    }),
  };
});
vi.mock('@/components/Header', () => ({ default: () => <div /> }));
vi.mock('@/components/Footer', () => ({ default: () => <div /> }));

function cvFixture(): CVData {
  return {
    id: 'simple-v1-page',
    name: 'Simple V1 page fixture',
    personal: {
      fullName: 'Candidate',
      email: '',
      phone: '',
      address: '',
      jobTitle: 'Customer Support Specialist',
      gender: 'female',
    },
    summary: 'Customer support specialist who handles customer requests and keeps order records organized. Communicates clearly and provides reliable daily service.',
    contentLocale: 'en',
    experience: [{
      id: 'current-role',
      position: 'Customer Support Specialist',
      company: 'Acme Corporation',
      startDate: '2020-01',
      endDate: '',
      isPresent: true,
      description: 'Handles customer requests and maintains order records.',
    }],
    education: [],
    skills: ['Customer Support', 'Communication'],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

afterEach(() => {
  cleanup();
  delete process.env.NEXT_PUBLIC_CV_SIMPLE_V1;
});

describe('Simple V1 Summary real page routing', () => {
  it('routes Generate, Shorter, Stronger, and Professional only to the shared Simple V1 API action', async () => {
    process.env.NEXT_PUBLIC_CV_SIMPLE_V1 = 'true';
    runtime.currentCv = cvFixture();
    runtime.usage = 0;
    runtime.writes = [];
    runtime.requests = [];
    runtime.candidates = [
      'Customer support specialist experienced in handling requests and maintaining accurate order records. Provides clear communication and reliable daily service.',
      'Customer support specialist who handles requests and keeps accurate records. Communicates clearly and provides reliable service.',
      'Customer support specialist who resolves requests and maintains accurate order records. Delivers clear communication and dependable daily service.',
      'Customer support professional experienced in handling requests and maintaining accurate order records. Communicates clearly and provides dependable service.',
    ];
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);

    fireEvent.click(screen.getByRole('button', { name: translations.en.cv.summary }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.en.cv.generate, 'i') }));
    await waitFor(() => expect(runtime.usage).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.en.cv.short, 'i') }));
    await waitFor(() => expect(runtime.usage).toBe(2));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.en.cv.strong, 'i') }));
    await waitFor(() => expect(runtime.usage).toBe(3));
    const professionalButton = screen.getAllByRole('button', { name: new RegExp(translations.en.cv.professional, 'i') })
      .find((button) => button.textContent?.includes(translations.en.cv.professionalSubtext));
    expect(professionalButton).toBeDefined();
    fireEvent.click(professionalButton as HTMLButtonElement);
    await waitFor(() => expect(runtime.usage).toBe(4));

    expect(runtime.requests).toHaveLength(4);
    expect(runtime.requests.map((request) => request.action)).toEqual([
      'summary-simple-v1',
      'summary-simple-v1',
      'summary-simple-v1',
      'summary-simple-v1',
    ]);
    expect(runtime.requests.map((request) => request.operation)).toEqual([
      'generate',
      'rewrite',
      'rewrite',
      'rewrite',
    ]);
    expect(runtime.requests.map((request) => request.style)).toEqual([
      undefined,
      'shorter',
      'stronger',
      'professional',
    ]);
    expect(runtime.requests[0]).not.toHaveProperty('sourceSummary');
    expect(runtime.requests.slice(1).every((request) => typeof request.sourceSummary === 'string')).toBe(true);
    expect(runtime.writes).toHaveLength(4);
    expect(runtime.currentCv?.summary).toBe('Customer support professional experienced in handling requests and maintaining accurate order records. Communicates clearly and provides dependable service.');
  });
});
