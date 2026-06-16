'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n/context';
import { useTheme } from 'next-themes';
import { Menu, X, Sun, Moon, ChevronDown, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Header() {
  const { t, locale, setLocale, languages, currentLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {t.common.appName}
            </span>
          </Link>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            {t.nav.home}
          </Link>
          <Link href="/cv-builder" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            {t.nav.cvBuilder}
          </Link>
          <Link href="/cover-letter" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            {t.nav.coverLetter}
          </Link>
          <Link href="/templates" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            {t.nav.templates}
          </Link>
          <Link href="/pricing" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            {t.nav.pricing}
          </Link>
          <Link href="/about" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            {t.nav.about}
          </Link>
          <a href="mailto:help.cvappai@gmail.com" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            {t.nav.contact}
          </a>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {/* Language Switcher */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
            >
              <span>{currentLanguage.flag}</span>
              <span className="hidden lg:inline">{currentLanguage.nativeName}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <AnimatePresence>
              {langOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute end-0 top-full mt-1 w-52 rounded-lg border border-border bg-popover p-1 shadow-lg"
                >
                  {languages.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => { setLocale(lang.code); setLangOpen(false); }}
                      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent ${locale === lang.code ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground'}`}
                    >
                      <span className="text-base">{lang.flag}</span>
                      <span>{lang.nativeName}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-md p-2 text-muted-foreground md:hidden">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border md:hidden"
          >
            <div className="space-y-1 px-4 py-3">
              {[
                { href: '/', label: t.nav.home },
                { href: '/cv-builder', label: t.nav.cvBuilder },
                { href: '/cover-letter', label: t.nav.coverLetter },
                { href: '/templates', label: t.nav.templates },
                { href: '/pricing', label: t.nav.pricing },
                { href: '/about', label: t.nav.about },
              ].map(link => (
                <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  {link.label}
                </Link>
              ))}
              <a href="mailto:help.cvappai@gmail.com" onClick={() => setMobileOpen(false)}
                className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                {t.nav.contact}
              </a>

              <div className="border-t border-border pt-2 mt-2">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-muted-foreground">{t.common.language}</span>
                  <select
                    value={locale}
                    onChange={e => setLocale(e.target.value as typeof locale)}
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                  >
                    {languages.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.flag} {lang.nativeName}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === 'dark' ? t.common.lightMode : t.common.darkMode}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
