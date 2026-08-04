/**
 * @vitest-environment jsdom
 */
import { act } from '@testing-library/react';
import * as React from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyCv } from '../cv-defaults';
import { CV_DRAFT_STORAGE_KEY } from '../draft-storage';
import { AppProvider, useApp } from '../store';

const mocks = vi.hoisted(() => ({
  initIAP: vi.fn(),
  syncProEntitlement: vi.fn(),
}));

vi.mock('../iap', () => ({
  initIAP: mocks.initIAP,
  syncProEntitlement: mocks.syncProEntitlement,
}));

let latestApp: ReturnType<typeof useApp> | null = null;
let root: Root | null = null;

function DraftSavedProbe() {
  latestApp = useApp();
  return (
    <div>
      {latestApp.lastCvSavedAt > 0
        ? <span className="animate-pulse">Draft saved</span>
        : <button type="button">Preview</button>}
    </div>
  );
}

function tree() {
  return (
    <AppProvider>
      <DraftSavedProbe />
    </AppProvider>
  );
}

describe('AAB-398 CV Builder hydration closure', () => {
  beforeEach(() => {
    localStorage.clear();
    latestApp = null;
    root = null;
    vi.clearAllMocks();
    mocks.initIAP.mockResolvedValue(undefined);
    mocks.syncProEntitlement.mockImplementation(() => new Promise(() => {}));
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    document.body.innerHTML = '';
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('hydrates a persisted draft without inserting the transient saved indicator', async () => {
    const persistedCv = createEmptyCv();
    localStorage.setItem(CV_DRAFT_STORAGE_KEY, JSON.stringify({
      cv: persistedCv,
      savedAt: '2026-08-04T00:00:00.000Z',
    }));

    const browserWindow = globalThis.window;
    let serverHtml = '';
    try {
      vi.stubGlobal('window', undefined);
      serverHtml = renderToString(tree());
    } finally {
      vi.stubGlobal('window', browserWindow);
    }

    expect(serverHtml).toContain('Preview');
    expect(serverHtml).not.toContain('Draft saved');

    const container = document.createElement('div');
    container.innerHTML = serverHtml;
    document.body.appendChild(container);
    const recoverableErrors: unknown[] = [];

    await act(async () => {
      root = hydrateRoot(container, tree(), {
        onRecoverableError: (error) => recoverableErrors.push(error),
      });
      await Promise.resolve();
    });

    expect(recoverableErrors).toEqual([]);
    expect(container.textContent).toContain('Preview');
    expect(container.textContent).not.toContain('Draft saved');
    expect(latestApp?.currentCv?.id).toBe(persistedCv.id);
    expect(latestApp?.lastCvSavedAt).toBe(0);
  });
});
