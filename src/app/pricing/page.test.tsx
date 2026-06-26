/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';

const mocks = vi.hoisted(() => ({
  purchase: vi.fn(),
  restore: vi.fn(),
  setIsPro: vi.fn(),
  getPurchaseTrace: vi.fn(),
  clearPurchaseTrace: vi.fn(),
  runPurchaseTraceBridgeSelfTest: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
  capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => 'android'),
  },
  clipboard: { writeText: vi.fn() },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: mocks.capacitor,
}));

vi.mock('@/lib/purchase-trace', () => ({
  getPurchaseTrace: mocks.getPurchaseTrace,
  clearPurchaseTrace: mocks.clearPurchaseTrace,
  runPurchaseTraceBridgeSelfTest: mocks.runPurchaseTraceBridgeSelfTest,
}));

vi.mock('@/lib/iap', () => ({
  useIAP: () => ({
    isNativeApp: true,
    purchasing: false,
    purchase: mocks.purchase,
    restore: mocks.restore,
    productPrice: '$3.99',
  }),
}));

vi.mock('@/lib/store', () => ({
  useApp: () => ({
    isPro: false,
    setIsPro: mocks.setIsPro,
    proDiagnostics: {
      clientIsPro: false,
      storedTokenPresent: false,
      memoryTokenPresent: false,
      tokenSyncLastResult: 'not-run',
      tokenSyncLastError: '',
      startupEntitlementResult: 'not-run',
      restoreEntitlementResult: 'not-run',
      aiGateStatus: 'free',
      aiGateTokenPresent: false,
      aiGateIsPro: false,
      aiGateBlockingReason: 'free-user',
    },
  }),
}));

vi.mock('sonner', () => ({
  toast: mocks.toast,
}));

vi.mock('@/components/Header', () => ({
  default: () => React.createElement('header', null, 'Header'),
}));

vi.mock('@/components/Footer', () => ({
  default: () => React.createElement('footer', null, 'Footer'),
}));

vi.mock('next/link', () => ({
  default: (props: Record<string, unknown>) => React.createElement('a', props, props.children),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: Record<string, unknown>) => React.createElement('div', props, props.children),
  },
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
    Check: icon('check'),
    X: icon('x'),
    Shield: icon('shield'),
    ArrowRight: icon('arrow-right'),
    ChevronDown: icon('chevron-down'),
    ChevronUp: icon('chevron-up'),
    RotateCcw: icon('rotate-ccw'),
    Copy: icon('copy'),
    Trash2: icon('trash'),
  };
});

vi.mock('@/lib/i18n/context', () => {
  const t = {
    pricing: {
      title: 'Pricing',
      subtitle: 'Choose a plan',
      popularBadge: 'Popular',
      proActive: 'Pro active',
      restoreTitle: 'Already purchased?',
      restoreDesc: 'Restore access',
      restoreButton: 'Restore Purchase',
      restoringText: 'Restoring...',
      needHelp: 'Need help?',
      tableRowCV: 'CVs',
      tableRowCoverLetter: 'Cover letters',
      tableRowTemplates: 'Templates',
      tableRowAI: 'AI summaries',
      tableRowRewrite: 'Rewrite',
      tableRowAnalyzer: 'Analyzer',
      tableRowLanguages: 'Languages',
      tableRowSupport: 'Support',
      oneCount: '1',
      unlimited: 'Unlimited',
      coverLetterFreeValue: '1',
      coverLetterProValue: 'Unlimited',
      threeStandard: '3',
      proTemplatesCount: '10',
      tableTitle: 'Compare features',
      tableHeaderFeature: 'Feature',
      tableHeaderFree: 'Free',
      tableHeaderPro: 'Pro',
      footerText: 'Footer',
      getStarted: 'Get started',
      bestValueBadge: 'Best value',
      fairUse: 'Fair use',
      free: { name: 'Free', price: '$0', desc: 'Free desc', features: [], cta: 'Start free' },
      pro: {
        badge: 'Pro',
        price: '$3.99',
        desc: 'Pro desc',
        noSubscription: 'One-time payment',
        cta: 'Upgrade',
        footer: 'Secure purchase',
        features: [],
      },
    },
    faq: { title: 'FAQ', items: [] },
    common: {
      cancel: 'Close',
      proAuthorizationUnavailable: 'Pro authorization is syncing. Please try again in a moment.',
    },
  };
  return { useI18n: () => ({ t }) };
});

async function renderPricingPage() {
  const mod = await import('./page');
  render(React.createElement(mod.default));
}

describe('Pricing purchase diagnostics viewer', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.purchase.mockResolvedValue({ success: true, isPro: true, token: 'purchase-token' });
    mocks.restore.mockResolvedValue({ success: true, isPro: true, token: 'restore-token' });
    mocks.capacitor.isNativePlatform.mockReturnValue(true);
    mocks.capacitor.getPlatform.mockReturnValue('android');
    mocks.getPurchaseTrace.mockResolvedValue({
      lastPhase: 'JS_PURCHASE_CALL',
      lastAt: 1_700_000_002_000,
      events: [
        {
          timestamp: 1_700_000_000_000,
          phase: 'JS_PURCHASE_FLOW_STARTED',
          detail: 'email=test@example.com purchaseToken=abcdefghijklmnopqrstuvwxyz123456',
        },
        {
          timestamp: 1_700_000_001_000,
          phase: 'NATIVE_BILLING_RESULT',
          responseCode: 0,
          detail: 'Billing response OK',
        },
      ],
    });
    mocks.clearPurchaseTrace.mockResolvedValue(undefined);
    mocks.runPurchaseTraceBridgeSelfTest.mockResolvedValue({
      nativePlatform: true,
      platform: 'android',
      pluginAvailable: true,
      ping: 'ok',
      mark: 'ok',
      getTrace: 'ok',
      lastPhase: 'VIEWER_SELF_TEST',
      eventCount: 3,
      trace: {
        lastPhase: 'VIEWER_SELF_TEST',
        lastAt: 1_700_000_003_000,
        events: [
          { timestamp: 1_700_000_000_000, phase: 'JS_PURCHASE_FLOW_STARTED' },
          { timestamp: 1_700_000_001_000, phase: 'NATIVE_BILLING_RESULT', responseCode: 0 },
          { timestamp: 1_700_000_003_000, phase: 'VIEWER_SELF_TEST', detail: 'bridge-write-check' },
        ],
      },
    });
    mocks.clipboard.writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: mocks.clipboard,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  test('successful purchase updates canonical Pro state with the returned token', async () => {
    await renderPricingPage();

    fireEvent.click(screen.getByRole('button', { name: /Upgrade/ }));

    await waitFor(() => expect(mocks.purchase).toHaveBeenCalledTimes(1));
    expect(mocks.setIsPro).toHaveBeenCalledWith(
      true,
      'purchase-token',
      expect.objectContaining({ source: 'purchase', entitlementResult: 'active', tokenSyncLastResult: 'success' }),
    );
    expect(mocks.toast.success).toHaveBeenCalledWith('Pro active');
  });

  test('successful restore updates canonical Pro state with the returned token', async () => {
    await renderPricingPage();

    fireEvent.click(screen.getByRole('button', { name: 'Restore Purchase' }));

    await waitFor(() => expect(mocks.restore).toHaveBeenCalledTimes(1));
    expect(mocks.setIsPro).toHaveBeenCalledWith(
      true,
      'restore-token',
      expect.objectContaining({ source: 'restore', entitlementResult: 'active', tokenSyncLastResult: 'success' }),
    );
    expect(mocks.toast.success).toHaveBeenCalledWith('Pro active');
  });

  test('restore token sync failure records recoverable auth state without activating Pro', async () => {
    mocks.restore.mockResolvedValueOnce({
      success: false,
      cancelled: false,
      entitlementActive: true,
      message: 'Entitlement verification temporarily unavailable. Please try again.',
    });
    await renderPricingPage();

    fireEvent.click(screen.getByRole('button', { name: 'Restore Purchase' }));

    await waitFor(() => expect(mocks.restore).toHaveBeenCalledTimes(1));
    expect(mocks.setIsPro).toHaveBeenCalledWith(
      false,
      null,
      expect.objectContaining({
        source: 'restore',
        entitlementResult: 'active',
        tokenSyncLastResult: 'failed',
        tokenSyncLastError: 'Entitlement verification temporarily unavailable. Please try again.',
      }),
    );
    expect(mocks.toast.error).toHaveBeenCalledWith('Entitlement verification temporarily unavailable. Please try again.');
  });

  test('button appears only on native Android', async () => {
    await renderPricingPage();
    expect(screen.getByRole('button', { name: 'Purchase diagnostics (test build)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Purchase diagnostics (test build)' }));
    expect(await screen.findByRole('button', { name: 'Run bridge self-test' })).toBeInTheDocument();

    cleanup();
    mocks.capacitor.getPlatform.mockReturnValue('ios');
    await renderPricingPage();
    expect(screen.queryByRole('button', { name: 'Purchase diagnostics (test build)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run bridge self-test' })).not.toBeInTheDocument();

    cleanup();
    mocks.capacitor.isNativePlatform.mockReturnValue(false);
    mocks.capacitor.getPlatform.mockReturnValue('web');
    await renderPricingPage();
    expect(screen.queryByRole('button', { name: 'Purchase diagnostics (test build)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run bridge self-test' })).not.toBeInTheDocument();
  });

  test('opening the viewer calls getTrace and displays ordered events and last phase', async () => {
    await renderPricingPage();
    fireEvent.click(screen.getByRole('button', { name: 'Purchase diagnostics (test build)' }));

    await waitFor(() => expect(mocks.getPurchaseTrace).toHaveBeenCalledWith(1000));
    expect(screen.getByText('JS_PURCHASE_CALL')).toBeInTheDocument();
    expect(screen.getByText('JS_PURCHASE_FLOW_STARTED')).toBeInTheDocument();
    expect(screen.getByText('NATIVE_BILLING_RESULT')).toBeInTheDocument();
    expect(screen.getByText('responseCode 0')).toBeInTheDocument();
    expect(screen.getByText('clientIsPro: false')).toBeInTheDocument();
    expect(screen.getByText('storedTokenPresent: false')).toBeInTheDocument();
    expect(screen.getByText('memoryTokenPresent: false')).toBeInTheDocument();
    expect(screen.getByText('tokenSyncLastResult: not-run')).toBeInTheDocument();
    expect(screen.getByText('startupEntitlementResult: not-run')).toBeInTheDocument();
    expect(screen.getByText('restoreEntitlementResult: not-run')).toBeInTheDocument();
    expect(screen.getByText('aiGateStatus: free')).toBeInTheDocument();
    expect(screen.getByText('aiGateTokenPresent: false')).toBeInTheDocument();
    expect(screen.getByText('aiGateIsPro: false')).toBeInTheDocument();
    expect(screen.getByText('aiGateBlockingReason: free-user')).toBeInTheDocument();
    expect(screen.queryByText(/test@example\.com/)).not.toBeInTheDocument();
    expect(screen.queryByText(/abcdefghijklmnopqrstuvwxyz123456/)).not.toBeInTheDocument();
  });

  test('copy and clear actions work', async () => {
    await renderPricingPage();
    fireEvent.click(screen.getByRole('button', { name: 'Purchase diagnostics (test build)' }));
    await waitFor(() => expect(mocks.getPurchaseTrace).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Copy trace' }));
    await waitFor(() => expect(mocks.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('last phase: JS_PURCHASE_CALL')));

    fireEvent.click(screen.getByRole('button', { name: 'Clear trace' }));
    await waitFor(() => expect(mocks.clearPurchaseTrace).toHaveBeenCalledWith(1000));
    expect(screen.getByText('No trace events found.')).toBeInTheDocument();
  });

  test('bridge self-test displays native boundary results and the written event', async () => {
    await renderPricingPage();
    fireEvent.click(screen.getByRole('button', { name: 'Purchase diagnostics (test build)' }));
    await waitFor(() => expect(mocks.getPurchaseTrace).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Run bridge self-test' }));

    await waitFor(() => expect(mocks.runPurchaseTraceBridgeSelfTest).toHaveBeenCalledWith(2000));
    expect(screen.getByText('Native platform: true')).toBeInTheDocument();
    expect(screen.getByText('Platform: android')).toBeInTheDocument();
    expect(screen.getByText('Plugin available: true')).toBeInTheDocument();
    expect(screen.getByText('Ping: ok')).toBeInTheDocument();
    expect(screen.getByText('Mark: ok')).toBeInTheDocument();
    expect(screen.getByText('Get trace: ok')).toBeInTheDocument();
    expect(screen.getAllByText('VIEWER_SELF_TEST').length).toBeGreaterThan(0);
  });

  test('plugin unavailable is shown explicitly instead of only None', async () => {
    mocks.getPurchaseTrace.mockResolvedValueOnce({ lastPhase: '', lastAt: 0, events: [] });
    mocks.runPurchaseTraceBridgeSelfTest.mockResolvedValueOnce({
      nativePlatform: true,
      platform: 'android',
      pluginAvailable: false,
      ping: 'failed',
      mark: 'failed',
      getTrace: 'failed',
      errorStage: 'ping',
      errorMessage: 'PurchaseTrace plugin unavailable',
    });

    await renderPricingPage();
    fireEvent.click(screen.getByRole('button', { name: 'Purchase diagnostics (test build)' }));
    await waitFor(() => expect(screen.getByText('None')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Run bridge self-test' }));

    await waitFor(() => expect(screen.getByText('Plugin available: false')).toBeInTheDocument());
    expect(screen.getByText('Failed stage: ping')).toBeInTheDocument();
    expect(screen.getByText('Error: PurchaseTrace plugin unavailable')).toBeInTheDocument();
  });

  test('self-test timeout and rejection results show the exact failed stage', async () => {
    mocks.runPurchaseTraceBridgeSelfTest.mockResolvedValueOnce({
      nativePlatform: true,
      platform: 'android',
      pluginAvailable: true,
      ping: 'timeout',
      mark: 'ok',
      getTrace: 'ok',
      errorStage: 'ping',
      errorMessage: 'ping timed out after 2000ms',
    });

    await renderPricingPage();
    fireEvent.click(screen.getByRole('button', { name: 'Purchase diagnostics (test build)' }));
    await waitFor(() => expect(mocks.getPurchaseTrace).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Run bridge self-test' }));

    await waitFor(() => expect(screen.getByText('Ping: timeout')).toBeInTheDocument());
    expect(screen.getByText('Failed stage: ping')).toBeInTheDocument();
    expect(screen.getByText('Error: ping timed out after 2000ms')).toBeInTheDocument();

    mocks.runPurchaseTraceBridgeSelfTest.mockResolvedValueOnce({
      nativePlatform: true,
      platform: 'android',
      pluginAvailable: true,
      ping: 'ok',
      mark: 'failed',
      getTrace: 'ok',
      errorStage: 'mark',
      errorMessage: 'Native bridge rejected',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run bridge self-test' }));

    await waitFor(() => expect(screen.getByText('Mark: failed')).toBeInTheDocument());
    expect(screen.getByText('Failed stage: mark')).toBeInTheDocument();
    expect(screen.getByText('Error: Native bridge rejected')).toBeInTheDocument();
  });

  test('trace errors do not break the Pricing page', async () => {
    mocks.getPurchaseTrace.mockRejectedValueOnce(new Error('native bridge failed'));

    await renderPricingPage();
    fireEvent.click(screen.getByRole('button', { name: 'Purchase diagnostics (test build)' }));

    await waitFor(() => expect(screen.getByText('Trace read failed.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Upgrade/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Restore Purchase/ })).toBeInTheDocument();
  });

  test('diagnostic viewer does not call purchase methods', async () => {
    await renderPricingPage();
    fireEvent.click(screen.getByRole('button', { name: 'Purchase diagnostics (test build)' }));
    await waitFor(() => expect(mocks.getPurchaseTrace).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Refresh trace' }));
    await waitFor(() => expect(mocks.getPurchaseTrace).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Run bridge self-test' }));
    await waitFor(() => expect(mocks.runPurchaseTraceBridgeSelfTest).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Copy trace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear trace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(mocks.clearPurchaseTrace).toHaveBeenCalledTimes(1));
    expect(mocks.purchase).not.toHaveBeenCalled();
    expect(mocks.restore).not.toHaveBeenCalled();
  });
});
