// @vitest-environment node
/**
 * Real Chromium viewport checks for the diagnostics modal flex/scroll layout.
 * Skips cleanly when Playwright Chromium is not installed in the environment.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Browser, Page } from 'playwright';

const VIEWPORTS = [
  { name: '360x640', width: 360, height: 640 },
  { name: '393x873', width: 393, height: 873 },
  { name: '412x915', width: 412, height: 915 },
  { name: 'landscape-small', width: 640, height: 360 },
] as const;

function modalFixtureHtml(): string {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { margin: 0; font-family: sans-serif; }
  .overlay {
    position: fixed; inset: 0; z-index: 80; display: flex; align-items: flex-end;
    justify-content: center; background: rgba(0,0,0,.4);
    padding: 1rem; padding-bottom: max(1rem, env(safe-area-inset-bottom));
    padding-top: max(1rem, env(safe-area-inset-top));
  }
  .dialog {
    display: flex; flex-direction: column; width: 100%; max-width: 32rem;
    overflow: hidden; border-radius: 12px; background: #fff;
    max-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem);
  }
  .header, .footer { flex-shrink: 0; padding: 12px 16px; border-bottom: 1px solid #ddd; }
  .footer { border-bottom: 0; border-top: 1px solid #ddd; display: flex; justify-content: flex-end; gap: 8px; }
  .body {
    min-height: 0; flex: 1 1 auto; overflow-y: auto; overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch; touch-action: pan-y; padding: 12px 16px;
  }
  .reset-btn {
    min-height: 44px; width: 100%; pointer-events: auto; margin-top: 8px;
  }
  .json {
    max-height: 10rem; overflow: auto; background: #f4f4f5; padding: 8px;
    font-size: 10px; white-space: pre-wrap; margin-top: 12px;
  }
  .confirm-overlay {
    position: fixed; inset: 0; z-index: 90; display: flex; align-items: flex-end;
    justify-content: center; background: rgba(0,0,0,.5); padding: 1rem;
  }
  .confirm-card { background: #fff; width: 100%; max-width: 24rem; padding: 16px; border-radius: 12px; }
</style></head><body>
<div class="overlay" data-testid="overlay">
  <div class="dialog" data-testid="dialog">
    <div class="header">Export diagnostics</div>
    <div class="body" data-testid="body">
      <div data-testid="internal-ai-usage-reset-panel">
        <div>Build channel: internal</div>
        <div>AI test reset: enabled</div>
        <div data-testid="count">count: 50 / 50</div>
        <button class="reset-btn" data-testid="internal-ai-usage-reset-button">Reset AI test usage</button>
      </div>
      <pre class="json" data-testid="json">${'{"pdf":{"x":1},"docx":{"y":2}}\\n'.repeat(80)}</pre>
    </div>
    <div class="footer" data-testid="footer">
      <button data-testid="copy">Copy diagnostics</button>
    </div>
  </div>
</div>
<script>
  const btn = document.querySelector('[data-testid="internal-ai-usage-reset-button"]');
  btn.addEventListener('click', () => {
    const el = document.createElement('div');
    el.className = 'confirm-overlay';
    el.setAttribute('data-testid', 'internal-ai-usage-reset-confirm-dialog');
    el.innerHTML = '<div class="confirm-card"><button data-testid="internal-ai-usage-reset-confirm" style="min-height:44px">Confirm clear local counter</button></div>';
    document.body.appendChild(el);
    el.querySelector('[data-testid="internal-ai-usage-reset-confirm"]').addEventListener('click', () => {
      document.querySelector('[data-testid="count"]').textContent = 'count: 0 / 50';
      el.remove();
    });
  });
</script>
</body></html>`;
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    return null;
  }
}

describe('Internal AI reset modal layout (Chromium viewports)', () => {
  let browser: Browser | null = null;
  let playwrightAvailable = false;
  let skipReason = 'Playwright Chromium unavailable';

  beforeAll(async () => {
    const pw = await loadPlaywright();
    if (!pw) {
      skipReason = 'playwright package missing';
      return;
    }
    try {
      browser = await pw.chromium.launch();
      playwrightAvailable = true;
    } catch (err) {
      playwrightAvailable = false;
      browser = null;
      skipReason = err instanceof Error ? err.message : String(err);
      console.warn('[ai-reset-modal] Playwright Chromium unavailable:', skipReason);
    }
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  for (const vp of VIEWPORTS) {
    test(`${vp.name}: reset button visible and clickable; confirm → count 0`, async () => {
      if (!playwrightAvailable || !browser) {
        console.warn(`Skipping ${vp.name}: ${skipReason}`);
        return;
      }
      const page: Page = await browser.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.setContent(modalFixtureHtml(), { waitUntil: 'domcontentloaded' });

      const btn = page.locator('[data-testid="internal-ai-usage-reset-button"]');
      const footer = page.locator('[data-testid="footer"]');
      const dialog = page.locator('[data-testid="dialog"]');
      const body = page.locator('[data-testid="body"]');

      expect(await dialog.isVisible()).toBe(true);
      expect(await btn.isVisible()).toBe(true);

      const btnBox = await btn.boundingBox();
      const footerBox = await footer.boundingBox();
      const dialogBox = await dialog.boundingBox();
      expect(btnBox).toBeTruthy();
      expect(footerBox).toBeTruthy();
      expect(dialogBox).toBeTruthy();
      expect(btnBox!.y + btnBox!.height).toBeLessThanOrEqual(footerBox!.y + 1);
      expect(btnBox!.x + btnBox!.width).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width + 1);

      const scrollBefore = await body.evaluate((el) => (el as HTMLElement).scrollTop);
      await body.evaluate((el) => {
        const node = el as HTMLElement;
        node.scrollTop = Math.min(node.scrollHeight, node.clientHeight + 40);
      });
      const scrollAfter = await body.evaluate((el) => (el as HTMLElement).scrollTop);
      expect(scrollAfter).toBeGreaterThanOrEqual(scrollBefore);

      await btn.click();
      expect(await page.locator('[data-testid="internal-ai-usage-reset-confirm-dialog"]').isVisible()).toBe(true);
      await page.locator('[data-testid="internal-ai-usage-reset-confirm"]').click();
      const countText = await page.locator('[data-testid="count"]').innerText();
      expect(countText).toMatch(/count:\s*0\s*\/\s*50/);

      await page.close();
    });
  }

  test('200% text scaling still keeps reset button tappable', async () => {
    if (!playwrightAvailable || !browser) {
      console.warn(`Skipping 200% scaling: ${skipReason}`);
      return;
    }
    const page = await browser.newPage();
    await page.setViewportSize({ width: 360, height: 640 });
    await page.addInitScript(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await page.setContent(modalFixtureHtml(), { waitUntil: 'domcontentloaded' });
    const btn = page.locator('[data-testid="internal-ai-usage-reset-button"]');
    expect(await btn.isVisible()).toBe(true);
    await btn.click();
    expect(await page.locator('[data-testid="internal-ai-usage-reset-confirm-dialog"]').isVisible()).toBe(true);
    await page.close();
  });
});
