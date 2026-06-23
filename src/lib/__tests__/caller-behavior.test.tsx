/**
 * @vitest-environment jsdom
 */
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor, renderHook } from '@testing-library/react';
import * as React from 'react';

// ---- Hoisted state (accessible in vi.mock factories) ----

const { mockPurchase, mockSetIsPro, mockToast, mockIAPState } = vi.hoisted(() => {
  const pfn = vi.fn();
  pfn.mockResolvedValue({ success: true, isPro: true, token: 'default' });
  return {
    mockPurchase: pfn,
    mockSetIsPro: vi.fn(),
    mockToast: { success: vi.fn(), error: vi.fn() },
    mockIAPState: { purchasing: false, productPrice: '$3.99', isNativeApp: true },
  };
});

vi.mock('@/lib/iap', () => ({
  useIAP: () => ({
    isNativeApp: mockIAPState.isNativeApp,
    purchasing: mockIAPState.purchasing,
    purchase: mockPurchase,
    restore: vi.fn<() => Promise<import('@/lib/iap').IAPResult>>(),
    productPrice: mockIAPState.productPrice,
  }),
  purchasePro: mockPurchase,
}));

vi.mock('@/lib/i18n/context', () => {
  function s(v: string) { return v; }
  function arr() { return [] as string[]; }

  const t = {
    pricing: {
      pro: { badge: s('badge'), price: s('$3.99'), desc: s('desc'), noSubscription: s('once'), cta: s('Upgrade'), footer: s('footer'), features: arr() },
      free: { name: s('Free'), price: s('$0'), desc: s('desc'), features: arr(), cta: s('Start') },
      popularBadge: s('Popular'), proActive: s('Pro Active'),
      restoreTitle: s('Restore'), restoreDesc: s('desc'), restoreButton: s('Restore'), restoringText: s('Restoring...'), needHelp: s('Help'),
      tableRowCV: s('CV'), tableRowCoverLetter: s('CL'), tableRowTemplates: s('Templates'),
      tableRowAI: s('AI'), tableRowRewrite: s('Rewrite'), tableRowAnalyzer: s('Analyzer'),
      tableRowLanguages: s('Languages'), tableRowSupport: s('Support'),
      oneCount: s('1'), unlimited: s('∞'), coverLetterFreeValue: s('1'), coverLetterProValue: s('∞'),
      threeStandard: s('3'), proTemplatesCount: s('10'),
      tableCaption: s('Compare'), tableTitle: s('Features'), tableHeaderFeature: s('Feat'), tableHeaderFree: s('Free'), tableHeaderPro: s('Pro'),
      title: s('title'), subtitle: s('sub'), oneTime: s('once'), getStarted: s('start'), footerText: s('text'), fairUse: s('fair'), bestValueBadge: s('best'),
    },
    dashboard: { upgrade: s('Upgrade'), upgradeDesc: s('desc'), myCVs: s(''), myCoverLetters: s(''), createNew: s(''), edit: s(''), delete: s(''), lastEdited: s(''), plan: s(''), welcome: s(''), noCVs: s(''), noLetters: s('') },
    cv: { aiBullets: s('AI'), proHint: s('Pro'), name: s(''), jobTitle: s(''), email: s(''), phone: s(''), location: s(''), website: s(''), linkedin: s(''), summary: s(''), experience: s(''), education: s(''), skills: s(''), languages: s(''), certifications: s('') },
    common: { cancel: s('Cancel'), or: s(''), close: s(''), loading: s(''), save: s(''), delete: s(''), confirm: s(''), back: s(''), next: s(''), done: s(''), skip: s('') },
    onboarding: { title: s('Pro'), subtitle: s('desc'), freeLabel: s('Free'), freeFeatures: arr(), proLabel: s('Pro'), proFeatures: arr(), proRecommendedBadge: s('Best'), oneTimePayment: s('once'), aiFeatureTitle: s('AI'), aiFeatureDesc: s('desc'), startFree: s('Free'), upgradeToPro: s('upgradeToPro'), secureCheckout: s('secure') },
    faq: { title: s('FAQ'), items: arr() },
  } as Record<string, unknown>;
  return { useI18n: () => ({ t }) };
});

vi.mock('sonner', () => ({
  toast: mockToast,
}));

vi.mock('next/link', async () => {
  const r = await import('react');
  const MockLink = (props: Record<string, unknown>) => r.createElement('a', props, props.children);
  return { default: MockLink };
});

vi.mock('@/lib/store', () => ({
  useApp: () => ({ setIsPro: mockSetIsPro }),
}));

vi.mock('framer-motion', async () => {
  const r = await import('react');
  return {
    motion: {
      div: (props: Record<string, unknown>) => r.createElement('div', props, props.children),
      section: (props: Record<string, unknown>) => r.createElement('section', props, props.children),
    },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
  };
});

vi.mock('lucide-react', async () => {
  const r = await import('react');
  const mkIcon = (tid: string) => (props: Record<string, unknown>) =>
    r.createElement('span', { ...props, 'data-testid': tid });
  return {
    Check: mkIcon('check-icon'), X: mkIcon('x-icon'), Crown: mkIcon('crown-icon'),
    Shield: mkIcon('shield-icon'), ArrowRight: mkIcon('arrow-icon'), Lock: mkIcon('lock-icon'),
    Sparkles: mkIcon('sparkles-icon'), RotateCcw: mkIcon('rotate-icon'),
  };
});

// ---- localStorage mock ----
const mockLocalStorage: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem: (key: string) => mockLocalStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
  removeItem: (key: string) => { delete mockLocalStorage[key]; },
  clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); },
  get length() { return Object.keys(mockLocalStorage).length; },
  key: (i: number) => Object.keys(mockLocalStorage)[i] ?? null,
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true });

function resetAll() {
  mockIAPState.purchasing = false;
  mockIAPState.productPrice = '$3.99';
  mockIAPState.isNativeApp = true;
  mockPurchase.mockReset();
  mockPurchase.mockResolvedValue({ success: true, isPro: true, token: 'default' });
  mockSetIsPro.mockReset();
  mockToast.success.mockReset();
  mockToast.error.mockReset();
  Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]);
}


async function clickAndSettle(el: HTMLElement) {
  await act(async () => { el.click(); });
}

function findUpgradeBtn(container?: HTMLElement): HTMLElement {
  const btns = (container
    ? Array.from(container.querySelectorAll('button'))
    : Array.from(screen.getAllByRole('button'))) as HTMLButtonElement[];
  const primary = btns.find(b => b.className.includes('bg-foreground'));
  if (primary) return primary;
  if (btns.length > 0) return btns[0];
  throw new Error('No purchase button found');
}

// Patch sonner once at init
describe('caller-level component behavior', () => {
  beforeEach(() => {
    resetAll();
  });

  // ──── useIAP hook state via renderHook ─────────────────────
  describe('useIAP shared purchasing state', () => {
    test('shared state and purchase lock reset after every result', async () => {
      mockPurchase.mockResolvedValue({ success: false, cancelled: true, message: '' });
      const { useIAP } = await import('@/lib/iap');
      const { result, unmount } = renderHook(() => useIAP());

      expect(result.current.purchasing).toBe(false);
      await act(async () => {
        await result.current.purchase();
      });
      expect(result.current.purchasing).toBe(false);

      mockPurchase.mockResolvedValue({ success: true, isPro: true, token: 't' });
      await act(async () => {
        await result.current.purchase();
      });
      expect(result.current.purchasing).toBe(false);
      unmount();
    });

    test('sequential purchase calls both succeed (no lock stuck)', async () => {
      mockPurchase.mockResolvedValue({ success: true, isPro: true, token: 't' });
      const { useIAP } = await import('@/lib/iap');
      const { result, unmount } = renderHook(() => useIAP());

      await act(async () => { await result.current.purchase(); });
      expect(result.current.purchasing).toBe(false);

      await act(async () => { await result.current.purchase(); });
      expect(result.current.purchasing).toBe(false);
      unmount();
    });
  });

  // ──── UpgradeButton (in UpgradeProSection) ────────────────
  describe('shared UpgradeButton', () => {
    test('displays ... while pending, returns to normal after failure', async () => {
      mockPurchase.mockResolvedValue({ success: false, cancelled: false, message: 'Billing failed' });
      const mod = await import('@/components/UpgradePro');
      const { container } = render(React.createElement(mod.UpgradeProSection));

      const btn = findUpgradeBtn(container);
      expect(btn.textContent).not.toContain('...');
      clickAndSettle(btn);

      await waitFor(() => expect(mockPurchase).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(btn.textContent).not.toContain('...'));
    });

    test('handles success:true/isPro:false without closing', async () => {
      mockPurchase.mockResolvedValue({ success: true, isPro: false, token: 'abc' });
      const mod = await import('@/components/UpgradePro');
      const { container } = render(React.createElement(mod.UpgradeProSection));
      clickAndSettle(findUpgradeBtn(container));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining('contact support')
        );
        expect(mockSetIsPro).not.toHaveBeenCalled();
      });
    });
  });

  // ──── FreeLimitModal ──────────────────────────────────────
  describe('FreeLimitModal', () => {
    test('remains open and button resets after cancellation', async () => {
      const onClose = vi.fn();
      mockPurchase.mockResolvedValue({ success: false, cancelled: true, message: '' });
      const mod = await import('@/components/UpgradePro');
      const { container } = render(React.createElement(mod.FreeLimitModal, { open: true, onClose }));
      clickAndSettle(findUpgradeBtn(container));

      await waitFor(() => {
        expect(mockPurchase).toHaveBeenCalledTimes(1);
        expect(mockToast.error).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
      });
      expect(findUpgradeBtn(container).textContent).not.toContain('...');
    });

    test('handles success:true/isPro:false without closing', async () => {
      const onClose = vi.fn();
      mockPurchase.mockResolvedValue({ success: true, isPro: false, token: 'abc' });
      const mod = await import('@/components/UpgradePro');
      const { container } = render(React.createElement(mod.FreeLimitModal, { open: true, onClose }));
      clickAndSettle(findUpgradeBtn(container));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('contact support'));
        expect(mockSetIsPro).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
      });
    });
  });

  // ──── CoverLetterProModal ─────────────────────────────────
  describe('CoverLetterProModal', () => {
    test('handles success:true/isPro:false and resets', async () => {
      const onClose = vi.fn();
      mockPurchase.mockResolvedValue({ success: true, isPro: false, token: 'abc' });
      const mod = await import('@/components/UpgradePro');
      const { container } = render(React.createElement(mod.CoverLetterProModal, { open: true, onClose }));
      clickAndSettle(findUpgradeBtn(container));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('contact support'));
        expect(mockSetIsPro).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
      });
    });
  });

  // ──── UpgradeBuilderBanner ────────────────────────────────
  describe('UpgradeBuilderBanner', () => {
    test('handles success:true/isPro:false and resets', async () => {
      mockPurchase.mockResolvedValue({ success: true, isPro: false, token: 'abc' });
      const mod = await import('@/components/UpgradePro');
      const { container } = render(React.createElement(mod.UpgradeBuilderBanner));
      clickAndSettle(findUpgradeBtn(container));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('contact support'));
        expect(mockSetIsPro).not.toHaveBeenCalled();
      });
    });
  });

  // ──── OnboardingModal ─────────────────────────────────────
  describe('OnboardingModal', () => {
    test('closes only after success:true/isPro:true', async () => {
      mockPurchase.mockResolvedValue({ success: true, isPro: true, token: 'abc' });
      const mod = await import('@/components/OnboardingModal');
      render(React.createElement(mod.OnboardingModal));

      await waitFor(() => {
        expect(screen.queryAllByRole('button').length).toBeGreaterThan(0);
      });

      clickAndSettle(findUpgradeBtn());
      await waitFor(() => {
        expect(mockPurchase).toHaveBeenCalledTimes(1);
        expect(mockSetIsPro).toHaveBeenCalledWith(true);
        expect(mockToast.success).toHaveBeenCalled();
      });
    });
  });
});
