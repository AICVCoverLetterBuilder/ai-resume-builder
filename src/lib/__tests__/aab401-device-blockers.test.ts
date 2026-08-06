import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { bulletToGermanWoIchClause } from '@/lib/cv-summary-v2/german-surface';
import {
  looksLikeGermanOccupationalTitle,
  resolveOccupationalTitleForSummary,
} from '@/lib/cv-role-title';
import { translations, type Locale } from '@/lib/i18n/translations';

const CURRENT_DE = [
  'Führt Wartungsarbeiten an Fahrrädern durch.',
  'Prüft Fahrräder auf technische Mängel.',
  'Tauscht defekte Bauteile an Fahrrädern aus.',
].join('\n');

const PRIOR_DE = [
  'Begrüßte Gäste professionell an der Rezeption des Hotels.',
  'Erfasste und verwaltete Reservierungen sowie nahm notwendige Änderungen vor.',
  'Beantwortete Anfragen und Fragen der Gäste kompetent und serviceorientiert.',
].join('\n');

function deviceCv(): CVData {
  return {
    id: 'aab-401-device-regression',
    name: 'John wayn',
    personal: {
      fullName: 'John wayn',
      email: 'device@example.com',
      phone: '',
      address: '',
      jobTitle: 'Fahrradmechaniker',
      gender: 'male',
    },
    summary: '',
    contentLocale: 'de',
    templateId: 'modern-minimal',
    experience: [
      {
        id: 'radwerk',
        position: 'Fahrradmechaniker',
        company: 'RadWerk',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: CURRENT_DE,
        originalUserDescription: CURRENT_DE,
        canonicalDescription: CURRENT_DE,
        descriptionOrigin: 'user',
      },
      {
        id: 'stadthotel',
        position: 'Rezeptionist',
        company: 'StadtHotel',
        startDate: '2023-01',
        endDate: '2023-12',
        isPresent: false,
        description: PRIOR_DE,
        originalUserDescription: PRIOR_DE,
        canonicalDescription: PRIOR_DE,
        descriptionOrigin: 'user',
      },
    ],
    education: [],
    skills: [],
    languages: [],
  } as CVData;
}

describe('AAB-401 real-device blocker closure', () => {
  it('rebuilds the exact German same-locale device CV with grounded first-person morphology', () => {
    const result = prepareExportReadyCv(
      deviceCv(),
      'de',
      'modern-minimal',
      { gender: 'male', referenceDate: '2026-08-06' },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const summary = result.cv.summary || '';
    expect(summary).toContain('bei RadWerk als Fahrradmechaniker');
    expect(summary).toContain('Wartungsarbeiten an Fahrrädern durchführe');
    expect(summary).toContain('Fahrräder auf technische Mängel prüfe');
    expect(summary).toContain('defekte Bauteile an Fahrrädern austausche');
    expect(summary).toContain('bei StadtHotel als Rezeptionist');
    expect(summary).toContain('Gäste professionell an der Rezeption des Hotels begrüßte');
    expect(summary).toContain('Reservierungen erfasste und verwaltete');
    expect(summary).toContain('notwendige Änderungen vornahm');
    expect(summary).toContain('Anfragen und Fragen der Gäste kompetent und serviceorientiert beantwortete');
    expect(summary).not.toMatch(/\bLagermitarbeiter(?:in)?\b/u);
    expect(summary).not.toMatch(/wo ich\s+(?:Führt|Prüft|Tauscht|Begrüßte|Erfasste|Beantwortete)\b/u);
    expect(summary).not.toContain('Rad. Werk');
    expect(summary).not.toContain('Stadt. Hotel');
    expect(result.cv.experience?.[0]?.description).toBe(CURRENT_DE);
    expect(result.cv.experience?.[1]?.description).toBe(PRIOR_DE);
    expect(result.diagnostics.summarySourceFactCount).toBe(6);
    expect(result.diagnostics.summaryCoveredFactCount).toBe(6);
    expect(result.diagnostics.summaryMaterialCoverageResult).toBe('complete');
    expect(result.diagnostics.occupationGenericFallbackUsed).toBe(false);
  });

  it('preserves arbitrary German occupational titles instead of collapsing them to warehouse work', () => {
    for (const role of ['Fahrradmechaniker', 'Rezeptionist', 'Solaranlagentechniker']) {
      expect(looksLikeGermanOccupationalTitle(role)).toBe(true);
      expect(resolveOccupationalTitleForSummary({
        profileJobTitle: role,
        currentExperienceTitle: role,
        locale: 'de',
        dutiesText: 'Prüft technische Komponenten und dokumentiert Ergebnisse.',
      })).toBe(role);
    }
  });

  it('realizes coordinated current and completed German duty predicates correctly', () => {
    expect(bulletToGermanWoIchClause(
      'Erfasste und verwaltete Reservierungen sowie nahm notwendige Änderungen vor.',
      'past',
    )).toBe('Reservierungen erfasste und verwaltete sowie notwendige Änderungen vornahm');
    expect(bulletToGermanWoIchClause(
      'Führt Wartungsarbeiten an Fahrrädern durch.',
      'present',
    )).toBe('Wartungsarbeiten an Fahrrädern durchführe');
    expect(bulletToGermanWoIchClause(
      'Erfasste und bearbeitete Reservierungen sowie vorgenommene Änderungen.',
      'past',
    )).toBe('Reservierungen sowie vorgenommene Änderungen erfasste und bearbeitete');
  });

  it('localizes the Pro limit and controlled purchase failure copy in every supported locale', () => {
    const locales = Object.keys(translations) as Locale[];
    expect(locales).toHaveLength(12);
    for (const locale of locales) {
      expect(translations[locale].common.proUpgradeUnlimited.trim()).not.toBe('');
      expect(translations[locale].common.purchaseSystemUnavailable.trim()).not.toBe('');
      expect(translations[locale].common.noPreviousPurchase.trim()).not.toBe('');
    }
    expect(translations.de.common.proUpgradeUnlimited).toBe(
      'Upgrade auf Pro für unbegrenzten Zugriff.',
    );
  });

  it('keeps internal Android packaging fail-closed on missing RevenueCat configuration', () => {
    const internalBuild = fs.readFileSync(
      path.resolve('scripts/build-android-internal.js'),
      'utf8',
    );
    const staticBuild = fs.readFileSync(
      path.resolve('scripts/build-static-internal.js'),
      'utf8',
    );
    const iap = fs.readFileSync(path.resolve('src/lib/iap.ts'), 'utf8');
    const modal = fs.readFileSync(path.resolve('src/components/UpgradePro.tsx'), 'utf8');

    expect(internalBuild).toContain("requiredEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY')");
    expect(internalBuild).toContain('RevenueCat Android public key is absent from copied Android assets');
    expect(internalBuild).toContain('execFileSync');
    expect(staticBuild).toContain("requiredEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY')");
    expect(staticBuild).toContain('RevenueCat Android public key is absent from built assets');
    expect(iap).toContain("initIAP (from restorePro)");
    expect(iap).toContain("errorCode: 'purchase_system_unavailable'");
    expect(modal).toContain('{t.common.proUpgradeUnlimited}');
    expect(modal).not.toContain("{'Upgrade to Pro for unlimited access.'}");
  });
});
