import type { CVData } from './types';
import type { Locale } from './i18n/translations';

/** Production blank CV — no demo/sample personal data. */
export function createEmptyCv(contentLocale?: Locale): CVData {
  return {
    id: crypto.randomUUID(),
    name: '',
    personal: { fullName: '', email: '', phone: '', address: '', jobTitle: '' },
    summary: '',
    ...(contentLocale ? { contentLocale } : {}),
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'US',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** True when CV has no user-entered personal or section content. */
export function isBlankCv(cv: CVData): boolean {
  const personal = cv.personal;
  const hasPersonal = Boolean(
    personal.fullName?.trim()
    || personal.email?.trim()
    || personal.phone?.trim()
    || personal.address?.trim()
    || personal.jobTitle?.trim()
    || personal.photo
    || (personal as { originalPhoto?: string }).originalPhoto,
  );
  if (hasPersonal) return false;
  if (cv.summary?.trim()) return false;
  if (cv.experience.length > 0) return false;
  if (cv.education.length > 0) return false;
  if (cv.skills.length > 0) return false;
  if (cv.certifications.length > 0) return false;
  if (cv.languages.length > 0) return false;
  return true;
}
