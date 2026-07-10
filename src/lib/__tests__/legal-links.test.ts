/**
 * @vitest-environment jsdom
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  LEGAL_CONTACT_HREF,
  LEGAL_LINKS,
  LEGAL_PRIVACY_PATH,
  LEGAL_TERMS_PATH,
} from '@/lib/legal-links';

const repoRoot = path.resolve(__dirname, '../../..');
const BROKEN_GITHUB_PAGES_HOST = 'aicvcoverletterbuilder.github.io';

function readSource(relPath: string): string {
  const full = path.join(repoRoot, relPath);
  expect(fs.existsSync(full), `${relPath} must exist`).toBe(true);
  return fs.readFileSync(full, 'utf8');
}

function walkDir(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'out') continue;
      walkDir(full, files);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({
    t: {
      common: { appName: 'CV App AI' },
      nav: { pricing: 'Pricing', templates: 'Templates', about: 'About', contact: 'Contact' },
      footer: { privacy: 'Privacy Policy', terms: 'Terms of Service', copyright: '© 2026' },
      about: {
        aiDisclosure: { items: ['AI disclosure'] },
        ageAndContent: { disclaimer: 'Age disclaimer' },
        legal: {
          privacyPolicy: 'Privacy Policy',
          termsOfService: 'Terms of Service',
          contact: 'Contact',
          viewPricing: 'View Pricing',
        },
      },
    },
  }),
}));

vi.mock('next/link', async () => {
  const r = await import('react');
  const MockLink = ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) =>
    r.createElement('a', { href, ...rest }, children);
  return { default: MockLink };
});

describe('legal-links shared constants', () => {
  it('exports internal privacy and terms routes used by footer', () => {
    expect(LEGAL_PRIVACY_PATH).toBe('/privacy');
    expect(LEGAL_TERMS_PATH).toBe('/terms');
    expect(LEGAL_LINKS.privacy).toBe('/privacy');
    expect(LEGAL_LINKS.terms).toBe('/terms');
    expect(LEGAL_CONTACT_HREF).toBe('mailto:help.cvappai@gmail.com');
  });

  it('About page imports and uses shared legal link constants', () => {
    const source = readSource('src/app/about/page.tsx');
    expect(source).toContain("from '@/lib/legal-links'");
    expect(source).toContain('href={LEGAL_LINKS.privacy}');
    expect(source).toContain('href={LEGAL_LINKS.terms}');
    expect(source).toContain('href={LEGAL_CONTACT_HREF}');
    expect(source).not.toContain(BROKEN_GITHUB_PAGES_HOST);
  });

  it('Footer imports and uses the same shared legal link constants', () => {
    const source = readSource('src/components/Footer.tsx');
    expect(source).toContain("from '@/lib/legal-links'");
    expect(source).toContain('href={LEGAL_LINKS.privacy}');
    expect(source).toContain('href={LEGAL_LINKS.terms}');
    expect(source).toContain('href={LEGAL_CONTACT_HREF}');
    expect(source).not.toContain(BROKEN_GITHUB_PAGES_HOST);
  });

  it('Footer renders privacy and terms links with shared routes', async () => {
    const Footer = (await import('@/components/Footer')).default;
    render(React.createElement(Footer));

    const privacy = screen.getByRole('link', { name: 'Privacy Policy' });
    const terms = screen.getByRole('link', { name: 'Terms of Service' });

    expect(privacy.getAttribute('href')).toBe(LEGAL_LINKS.privacy);
    expect(terms.getAttribute('href')).toBe(LEGAL_LINKS.terms);
  });

  it('does not use broken GitHub Pages legal URLs anywhere under src/', () => {
    const srcDir = path.join(repoRoot, 'src');
    const offenders: string[] = [];

    for (const file of walkDir(srcDir)) {
      if (file.includes(`${path.sep}__tests__${path.sep}`) || /\.test\.(ts|tsx)$/.test(file)) {
        continue;
      }
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes(BROKEN_GITHUB_PAGES_HOST)) {
        offenders.push(path.relative(repoRoot, file));
      }
    }

    expect(offenders, `broken host must not appear in: ${offenders.join(', ')}`).toEqual([]);
  });
});
