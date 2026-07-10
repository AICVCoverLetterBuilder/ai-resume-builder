'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useI18n } from '@/lib/i18n/context';
import { en } from '@/lib/i18n/translations';
import { LEGAL_CONTACT_HREF, LEGAL_LINKS } from '@/lib/legal-links';

// English fallback content — always visible even if i18n fails
const FALLBACK_TERMS = en.legal.terms;

export default function TermsPage() {
  const { t } = useI18n();

  // Safely resolve translated content, falling back to English
  const rawTerms = t?.legal?.terms;
  const terms = {
    title: rawTerms?.title || FALLBACK_TERMS.title,
    effectiveDate: rawTerms?.effectiveDate || FALLBACK_TERMS.effectiveDate,
    sections: Array.isArray(rawTerms?.sections) && rawTerms.sections.length > 0
      ? rawTerms.sections
      : FALLBACK_TERMS.sections,
  };

  const commonLegal = t?.common?.legal || 'Legal';
  const appName = t?.common?.appName || 'CV Pro AI';
  const contactLabel = t?.nav?.contact || 'Contact';
  const backToHome = t?.footer?.backToHome || 'Back to home';
  const privacyTitle = t?.legal?.privacy?.title || en.legal.privacy.title;

  const ageContentTitle = t?.about?.ageAndContent?.title || en.about.ageAndContent.title;
  const ageContentDisclaimer = t?.about?.ageAndContent?.disclaimer || en.about.ageAndContent.disclaimer;
  const ageContentRating = t?.about?.ageAndContent?.ageRating || en.about.ageAndContent.ageRating;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Page header */}
        <div className="border-b border-border bg-muted/20 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{commonLegal}</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{terms.title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {terms.effectiveDate}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          {/* AI Disclaimer Notice */}
          <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3">
            <p className="text-sm text-amber-800 dark:text-amber-300 font-medium mb-1">{ageContentTitle}</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              {ageContentDisclaimer} {ageContentRating}
            </p>
          </div>

          <div className="prose prose-sm sm:prose max-w-none text-foreground
            prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground
            prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:border-border prose-h2:pb-2
            prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
            prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:my-3
            prose-li:text-muted-foreground prose-li:leading-relaxed
            prose-ul:my-3 prose-ul:space-y-1
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-strong:text-foreground">

            {terms.sections.map((section, idx) => (
              <div key={idx}>
                <h2>{section.title}</h2>
                {section.content && <p>{section.content}</p>}
                {Array.isArray((section as { items?: string[] }).items) && (section as { items?: string[] }).items!.length > 0 && (
                  <ul>
                    {(section as { items?: string[] }).items!.map((item, itemIdx) => (
                      <li key={itemIdx}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            <p className="text-xs text-muted-foreground">
              {terms.title} — {appName} · {contactLabel}: <a href={LEGAL_CONTACT_HREF}>{LEGAL_CONTACT_HREF.replace('mailto:', '')}</a>
            </p>
          </div>

          {/* Bottom nav */}
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8 text-sm">
            <Link href={LEGAL_LINKS.privacy} className="text-primary hover:underline">
              {privacyTitle} →
            </Link>
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              ← {backToHome}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
