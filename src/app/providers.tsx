'use client';

import { ThemeProvider } from 'next-themes';
import { I18nProvider } from '@/lib/i18n/context';
import { AppProvider } from '@/lib/store';
import { Toaster } from 'sonner';
import { OnboardingModal } from '@/components/OnboardingModal';
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton';

function BackButtonHandler() {
  useAndroidBackButton();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <I18nProvider>
        <AppProvider>
          {children}
          <OnboardingModal />
          <Toaster position="bottom-right" />
          <BackButtonHandler />
        </AppProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
