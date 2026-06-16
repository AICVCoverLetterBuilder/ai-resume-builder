'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { Check, X, Sparkles, Shield, Crown, Star, Globe, ArrowRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';

export default function AboutPage() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <div className="border-b border-border bg-muted/20 px-4 py-14 sm:px-6 sm:py-20 lg:px-8 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium text-muted-foreground mb-6">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {t.about.hero.badge}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t.about.hero.title}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              {t.about.hero.description}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                <Star className="h-3 w-3 text-amber-500" />
                {t.about.hero.ageRating}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                <Globe className="h-3 w-3 text-primary" />
                {t.about.hero.languages}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                <Shield className="h-3 w-3 text-green-600" />
                {t.about.hero.privacyFirst}
              </span>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 space-y-16">

          {/* App Description */}
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4">{t.about.description.title}</h2>
            <div className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4 text-sm text-muted-foreground leading-relaxed">
              {t.about.description.paragraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </section>

          {/* Free vs Pro Features */}
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-6">{t.about.features.title}</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Free */}
              <div className="rounded-xl border border-border bg-card p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">{t.about.features.free.label}</p>
                <ul className="space-y-3">
                  {t.about.features.free.items.map((f, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-foreground/80">
                      <Check className="h-4 w-4 flex-shrink-0 text-foreground/40" />
                      {f}
                    </li>
                  ))}
                  {t.about.features.free.disabledItems.map((f, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground/50">
                      <X className="h-4 w-4 flex-shrink-0 text-muted-foreground/30" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pro */}
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-6 relative">
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {t.about.features.pro.price}
                  </span>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-4">{t.about.features.pro.label}</p>
                <ul className="space-y-3">
                  {t.about.features.pro.items.map((f, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-foreground/80">
                      <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[10px] text-muted-foreground italic">{t.about.features.pro.footer}</p>
              </div>
            </div>
          </section>

          {/* AI Disclosure */}
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4">{t.about.aiDisclosure.title}</h2>
            <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-6 space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-300">
                <Sparkles className="h-4 w-4 flex-shrink-0" />
                {t.about.aiDisclosure.title}
              </p>
              <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-400 leading-relaxed list-disc list-inside">
                {t.about.aiDisclosure.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* Age Rating & Disclaimer */}
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4">{t.about.ageAndContent.title}</h2>
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/30 text-amber-600">
                  <Star className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.about.ageAndContent.ageRating}</p>
                  <p className="text-xs text-muted-foreground">{t.about.ageAndContent.ageRatingDesc}</p>
                </div>
              </div>
              <div className="border-t border-border pt-4 space-y-2 text-sm text-muted-foreground leading-relaxed">
                <p>{t.about.ageAndContent.disclaimer}</p>
                <p>{t.about.ageAndContent.noLiability}</p>
                <p>{t.about.ageAndContent.privacy}</p>
              </div>
            </div>
          </section>

          {/* Supported Languages */}
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4">{t.about.languages.title}</h2>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { flag: '🇺🇸', name: t.about.languages.list[0] },
                  { flag: '🇩🇪', name: t.about.languages.list[1] },
                  { flag: '🇪🇸', name: t.about.languages.list[2] },
                  { flag: '🇫🇷', name: t.about.languages.list[3] },
                  { flag: '🇮🇹', name: t.about.languages.list[4] },
                  { flag: '🇸🇦', name: t.about.languages.list[5] },
                  { flag: '🇷🇸', name: t.about.languages.list[6] },
                  { flag: '🇭🇷', name: t.about.languages.list[7] },
                  { flag: '🇷🇺', name: t.about.languages.list[8] },
                  { flag: '🇧🇷', name: t.about.languages.list[9] },
                  { flag: '🇮🇳', name: t.about.languages.list[10] },
                  { flag: '🇯🇵', name: t.about.languages.list[11] },
                ].map((lang) => (
                  <div key={lang.flag} className="flex items-center gap-2.5 text-sm text-foreground/80">
                    <span className="text-lg leading-none">{lang.flag}</span>
                    <span>{lang.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Restore Purchase */}
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4">{t.about.restorePurchase.title}</h2>
            <div className="rounded-xl border border-border bg-card p-6 flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Crown className="h-5 w-5" />
              </div>
              <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
                <p>{t.about.restorePurchase.description}</p>
              </div>
            </div>
          </section>

          {/* Legal Links */}
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4">{t.about.legal.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href="https://aicvcoverletterbuilder.github.io/cvappai-legal/privacy.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                {t.about.legal.privacyPolicy}
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </a>
              <a
                href="https://aicvcoverletterbuilder.github.io/cvappai-legal/terms.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                {t.about.legal.termsOfService}
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </a>
              <a
                href="mailto:help.cvappai@gmail.com"
                className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                {t.about.legal.contact}
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </a>
              <Link
                href="/pricing"
                className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                {t.about.legal.viewPricing}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

        </div>
      </main>
      <Footer />
    </div>
  );
}
