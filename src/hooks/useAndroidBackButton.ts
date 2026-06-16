'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import type { PluginListenerHandle } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * Android back button handler for Capacitor + Next.js App Router.
 *
 * Behavior:
 * 1. If a modal, dialog, or menu is open → dispatch Escape to close it first.
 * 2. If there is a previous page (not on root) → navigate back via history.back().
 * 3. If already on root/home → exit/minimize the app via App.exitApp().
 *
 * The listener is registered exactly once and cleaned up on unmount.
 */
export function useAndroidBackButton() {
  const pathname = usePathname();
  const isOnRootRef = useRef(pathname === '/');
  const isBackNavRef = useRef(false);

  // Track pathname changes without creating duplicate history entries.
  // When we call history.back(), the pathname changes reactively — we have
  // already popped the stack, so we skip re-pushing it.
  useEffect(() => {
    if (isBackNavRef.current) {
      // This pathname change was caused by our own history.back() call.
      // Reset the flag and do not treat this as a forward navigation.
      isBackNavRef.current = false;
      return;
    }
    isOnRootRef.current = pathname === '/';
  }, [pathname]);

  // Register the Capacitor App backButton listener exactly once (Android only).
  useEffect(() => {
    // Only register on native Android — not on Web / iOS / SSR.
    if (typeof window === 'undefined') return;
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

    let handler: PluginListenerHandle | null = null;

    (async () => {
      handler = await App.addListener('backButton', () => {
        if (!handler) return;

        // 1. Check for open modals, dialogs, sheets, or menus.
        // Radix / shadcn components use data-state="open".
        // Custom framer-motion modals (OnboardingModal, UpgradePro modals)
        // use aria-modal="true" (unmount when closed, so no data-state check needed).
        const openOverlay = document.querySelector<HTMLElement>(
          '[aria-modal="true"], ' +
          '[role="dialog"][data-state="open"], ' +
          '[role="alertdialog"][data-state="open"], ' +
          '[role="menu"][data-state="open"]'
        );
        if (openOverlay) {
          // Dispatch Escape keydown — Radix / shadcn components listen
          // on the document for this event and close themselves.
          // Custom modals should listen for 'keydown' Escape in an effect.
          document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
          );
          return;
        }

        // 2. If not on the root page, navigate back one step.
        if (!isOnRootRef.current) {
          isBackNavRef.current = true;
          window.history.back();
          return;
        }

        // 3. On the root page — exit / minimize the app.
        App.exitApp();
      });
    })();

    return () => {
      if (handler) {
        handler.remove();
      }
    };
  }, []);
}