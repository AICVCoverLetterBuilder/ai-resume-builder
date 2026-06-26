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
  toast: { success: vi.fn(), error: vi.fn() },
  iapState: {
    isNativeApp: true,
    purchasing: false,
  },
  appState: {
    isPro: false,
  },
}));

vi.mock('@/lib/iap', () => ({
  useIAP: () => ({
    isNativeApp: mocks.iapState.isNativeApp,
    purchasing: mocks.iapState.purchasing,
    purchase: mocks.purchase,
    restore: mocks.restore,
    productPrice: '$3.99',
  }),
}));

vi.mock('@/lib/store', () => ({
  useApp: () => ({
    isPro: mocks.appState.isPro,
    setIsPro: mocks.setIsPro,
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

describe('Pricing page production purchase surface', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.purchase.mockResolvedValue({ success: true, isPro: true, token: 'purchase-token' });
    mocks.restore.mockResolvedValue({ success: true, isPro: true, token: 'restore-token' });
    mocks.iapState.isNativeApp = true;
    mocks.iapState.purchasing = false;
    mocks.appState.isPro = false;
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

  test('temporary purchase diagnostics are absent from the production pricing page', async () => {
    await renderPricingPage();

    expect(screen.getByRole('button', { name: /Upgrade/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore Purchase' })).toBeInTheDocument();
    expect(screen.getByText('One-time payment')).toBeInTheDocument();
    expect(screen.getByText('help.cvappai@gmail.com')).toBeInTheDocument();

    expect(screen.queryByText(new RegExp('Purchase' + ' diagnostics', 'i'))).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp('test' + ' build', 'i'))).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp('bridge self' + '-test', 'i'))).not.toBeInTheDocument();
    expect(screen.queryByText(/Refresh trace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Copy trace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Clear trace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/clientIsPro/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tokenSyncLastResult/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/aiGate/i)).not.toBeInTheDocument();
  });

  test('Pro Active state still disables Restore Purchase', async () => {
    mocks.appState.isPro = true;
    await renderPricingPage();

    expect(screen.getAllByText('Pro active').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Pro active/ })).toBeDisabled();
  });
});
