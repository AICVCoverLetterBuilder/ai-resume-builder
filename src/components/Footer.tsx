'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n/context';
import { FileText, Mail } from 'lucide-react';
import { LEGAL_CONTACT_HREF, LEGAL_LINKS } from '@/lib/legal-links';

export default function Footer() {
  const { t } = useI18n();
  const aiSummary = [t.about.aiDisclosure.items[0], t.about.ageAndContent.disclaimer].filter(Boolean).join(' ');

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <span className="font-bold">{t.common.appName}</span>
            </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="/pricing" className="hover:text-foreground transition-colors">{t.nav.pricing}</Link>
            <Link href="/templates" className="hover:text-foreground transition-colors">{t.nav.templates}</Link>
            <Link href="/about" className="hover:text-foreground transition-colors">{t.nav.about}</Link>
            <Link href={LEGAL_LINKS.privacy} className="hover:text-foreground transition-colors">{t.footer.privacy}</Link>
            <Link href={LEGAL_LINKS.terms} className="hover:text-foreground transition-colors">{t.footer.terms}</Link>
            <a href={LEGAL_CONTACT_HREF} className="hover:text-foreground transition-colors flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {t.nav.contact}
            </a>
          </div>
          <p className="text-sm text-muted-foreground">{t.footer.rights}</p>
        </div>
        {/* AI disclaimer */}
        <div className="mt-6 border-t border-border pt-6 text-center">
          <p className="text-xs text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {aiSummary}
          </p>
        </div>
      </div>
    </footer>
  );
}
