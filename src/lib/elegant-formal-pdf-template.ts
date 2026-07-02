'use client';

import { getLocalizedCvLanguageName } from './cv-language-options';
import { getLocalizedCvSkillName } from './cv-skill-options';
import {
  ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT,
  ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH,
  ELEGANT_FORMAL_PHOTO_HEIGHT,
  ELEGANT_FORMAL_PHOTO_WIDTH,
} from './elegant-formal-photo';
import { translations, type Locale } from './i18n/translations';
import { regionSettings, type CVData } from './types';

type StyleMap = Partial<CSSStyleDeclaration>;

type ElegantFormalPdfTemplateOptions = {
  photoDataUrl?: string | null;
  locale?: Locale;
};

const AMBER = '#b45309';
const TEXT = '#111827';
const MUTED = '#4b5563';
const LIGHT = '#9ca3af';
const RULE = '#e5e7eb';

function applyStyle(element: HTMLElement, styles: StyleMap): void {
  Object.entries(styles).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      (element.style as unknown as Record<string, string>)[key] = String(value);
    }
  });
}

function append(parent: HTMLElement, tagName: string, styles?: StyleMap, text?: string): HTMLElement {
  const element = document.createElement(tagName);
  if (styles) applyStyle(element, styles);
  if (text !== undefined) element.textContent = text;
  parent.appendChild(element);
  return element;
}

function labels(locale?: Locale) {
  const t = translations[locale ?? 'en'] ?? translations.en;
  return {
    summary: t.cv.summary,
    experience: t.cv.experience,
    education: t.cv.education,
    skills: t.cv.skills,
    languages: t.cv.languages,
    certifications: t.cv.certifications,
    present: t.cv.present,
  };
}

function sectionHeading(parent: HTMLElement, text: string, withRule = false): HTMLElement {
  return append(parent, 'h2', {
    margin: withRule ? '0 0 9px' : '0 0 6px',
    paddingBottom: withRule ? '3px' : '0',
    borderBottom: withRule ? `1px solid ${RULE}` : '0',
    color: AMBER,
    fontSize: '12px',
    fontWeight: '600',
    lineHeight: '1.25',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
  }, text);
}

function descriptionLines(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^(?:[-*]|\u2022|\d+\.)\s+/, ''));
}

function presentableSkills(skills: string[], locale?: Locale): string[] {
  return skills.map(skill => getLocalizedCvSkillName(skill, locale ?? 'en'));
}

function presentableLanguages(languages: CVData['languages'], locale?: Locale): CVData['languages'] {
  return languages.map(language => ({
    ...language,
    name: getLocalizedCvLanguageName(language.name, locale ?? 'en'),
  }));
}

function hasPhotoEnabled(cv: CVData): boolean {
  if (cv.personal.photoEnabled !== undefined) return cv.personal.photoEnabled;
  return cv.region !== 'US';
}

function renderHeader(root: HTMLElement, cv: CVData, photoDataUrl: string | null | undefined): void {
  const region = regionSettings[cv.region];
  const contacts = [
    cv.personal.email,
    cv.personal.phone,
    region.showAddress ? cv.personal.address : '',
  ].filter(Boolean);

  const header = append(root, 'header', {
    marginBottom: '14px',
    paddingBottom: '14px',
    borderBottom: '1px solid #d1d5db',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
  });
  header.setAttribute('data-export-meaningful', 'true');

  const row = append(header, 'div', {
    display: 'grid',
    gridTemplateColumns: `${ELEGANT_FORMAL_PHOTO_WIDTH}px minmax(0, 1fr) ${ELEGANT_FORMAL_PHOTO_WIDTH}px`,
    columnGap: '18px',
    alignItems: 'start',
  });
  row.setAttribute('data-elegant-formal-pdf-header-row', 'true');

  const leftSlot = append(row, 'div', {
    width: `${ELEGANT_FORMAL_PHOTO_WIDTH}px`,
    height: `${ELEGANT_FORMAL_PHOTO_HEIGHT}px`,
  });

  if (photoDataUrl && hasPhotoEnabled(cv)) {
    const frame = append(leftSlot, 'div', {
      width: `${ELEGANT_FORMAL_PHOTO_WIDTH}px`,
      height: `${ELEGANT_FORMAL_PHOTO_HEIGHT}px`,
      minWidth: `${ELEGANT_FORMAL_PHOTO_WIDTH}px`,
      overflow: 'hidden',
      borderRadius: '2px',
      border: '0 solid transparent',
      backgroundColor: 'transparent',
      boxSizing: 'border-box',
      display: 'block',
    });
    frame.setAttribute('data-elegant-formal-photo', 'frame');
    frame.setAttribute('data-export-meaningful', 'true');

    const img = document.createElement('img');
    img.src = photoDataUrl;
    img.alt = '';
    img.width = ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH;
    img.height = ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT;
    applyStyle(img, {
      width: `${ELEGANT_FORMAL_PHOTO_WIDTH}px`,
      height: `${ELEGANT_FORMAL_PHOTO_HEIGHT}px`,
      objectFit: 'cover',
      objectPosition: '50% 35%',
      display: 'block',
      borderRadius: '2px',
      clipPath: 'none',
      maskImage: 'none',
      webkitMaskImage: 'none',
    });
    img.setAttribute('data-elegant-formal-pdf-photo', 'canonical');
    img.setAttribute('data-export-photo', 'elegant-formal');
    frame.appendChild(img);
  }

  const center = append(row, 'div', {
    minWidth: '0',
    textAlign: 'center',
  });

  const name = append(center, 'h1', {
    margin: '0',
    color: '#1f2937',
    fontSize: '29px',
    lineHeight: '1.15',
    fontWeight: '300',
    letterSpacing: '0.025em',
  }, cv.personal.fullName || 'Your Name');
  name.setAttribute('data-export-meaningful', 'true');

  const title = append(center, 'p', {
    margin: '4px 0 0',
    color: AMBER,
    fontSize: '12px',
    lineHeight: '1.35',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  }, cv.personal.jobTitle);
  title.setAttribute('data-export-meaningful', 'true');

  const contactRow = append(center, 'div', {
    marginTop: '10px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0',
    flexWrap: 'wrap',
    color: LIGHT,
    fontSize: '12px',
    lineHeight: '1.3',
  });
  contactRow.setAttribute('data-export-contact-row', 'elegant-formal');

  contacts.forEach((contact, index) => {
    const item = append(contactRow, 'span', {
      display: 'inline-flex',
      alignItems: 'center',
      whiteSpace: 'nowrap',
      flexShrink: '0',
    });
    item.setAttribute('data-export-contact-item', 'elegant-formal');
    item.setAttribute('data-export-meaningful', 'true');
    if (index > 0) {
      const separator = append(item, 'span', {
        color: '#d1d5db',
        paddingLeft: '12px',
        paddingRight: '12px',
      }, '|');
      separator.setAttribute('data-export-contact-separator', 'elegant-formal');
    }
    append(item, 'span', undefined, contact);
  });

  append(row, 'div', {
    width: `${ELEGANT_FORMAL_PHOTO_WIDTH}px`,
    minHeight: '1px',
  });

  if (!cv.personal.jobTitle) title.textContent = '';
  if (contacts.length === 0) contactRow.style.display = 'none';
}

function renderSummary(root: HTMLElement, cv: CVData, locale?: Locale): void {
  if (!cv.summary.trim()) return;
  const l = labels(locale);
  const section = append(root, 'section', { marginBottom: '14px' });
  section.setAttribute('data-export-group', 'summary-section');
  sectionHeading(section, l.summary);
  const summary = append(section, 'p', {
    margin: '0',
    color: '#374151',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: '1.34',
    whiteSpace: 'break-spaces',
  }, cv.summary);
  summary.setAttribute('data-export-meaningful', 'true');
}

function renderExperience(root: HTMLElement, cv: CVData, locale?: Locale): void {
  if (cv.experience.length === 0) return;
  const l = labels(locale);
  const section = append(root, 'section', { marginBottom: '14px' });
  section.setAttribute('data-export-group', 'experience-section');
  sectionHeading(section, l.experience, true);

  cv.experience.forEach((exp) => {
    const entry = append(section, 'div', { marginBottom: '10px' });
    entry.setAttribute('data-export-group', 'experience-entry');
    entry.setAttribute('data-export-meaningful', 'true');

    const row = append(entry, 'div', {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      alignItems: 'baseline',
      columnGap: '16px',
    });
    row.setAttribute('data-elegant-formal-entry-row', 'true');

    append(row, 'h3', {
      margin: '0',
      minWidth: '0',
      color: TEXT,
      fontSize: '13px',
      fontWeight: '600',
      lineHeight: '1.25',
    }, exp.position);
    append(row, 'span', {
      color: LIGHT,
      fontSize: '12px',
      fontStyle: 'italic',
      whiteSpace: 'nowrap',
    }, `${exp.startDate} - ${exp.isPresent ? l.present : exp.endDate}`);

    append(entry, 'p', {
      margin: '3px 0 0',
      color: AMBER,
      fontSize: '12px',
      lineHeight: '1.25',
    }, exp.company);

    const lines = descriptionLines(exp.description);
    if (lines.length > 0) {
      const list = append(entry, 'ul', {
        margin: '4px 0 0',
        paddingLeft: '18px',
        color: MUTED,
        listStyleType: 'disc',
        listStylePosition: 'outside',
      });
      list.setAttribute('data-export-bullet-list', 'elegant-formal');
      lines.forEach((line, index) => {
        const item = append(list, 'li', {
          margin: '0 0 2px',
          paddingLeft: '2px',
          whiteSpace: 'normal',
          lineHeight: '1.24',
        }, line);
        item.setAttribute('data-export-meaningful', 'true');
        item.setAttribute('data-export-bullet-item', 'elegant-formal');
        item.setAttribute('data-elegant-formal-bullet-row', `${exp.id}-${index}`);
      });
    }
  });
}

function renderEducation(root: HTMLElement, cv: CVData, locale?: Locale): void {
  if (cv.education.length === 0) return;
  const l = labels(locale);
  const section = append(root, 'section', { marginBottom: '13px', textAlign: 'center' });
  section.setAttribute('data-export-group', 'education-section');
  sectionHeading(section, l.education, true);

  cv.education.forEach((edu) => {
    const entry = append(section, 'div', { marginBottom: '7px', textAlign: 'center' });
    entry.setAttribute('data-export-group', 'education-entry');
    entry.setAttribute('data-export-meaningful', 'true');
    append(entry, 'h3', {
      margin: '0',
      color: TEXT,
      fontSize: '13px',
      fontWeight: '600',
      lineHeight: '1.25',
    }, edu.degree);
    append(entry, 'p', {
      margin: '1px 0 0',
      color: '#6b7280',
      fontSize: '12px',
      lineHeight: '1.25',
    }, `${edu.school} | ${edu.startDate} - ${edu.endDate}`);
  });
}

function inlineItems(parent: HTMLElement, attr: string, items: string[]): void {
  const row = append(parent, 'div', {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '4px 10px',
    lineHeight: '1.3',
  });
  row.setAttribute(attr, 'elegant-formal');
  items.forEach((item, index) => {
    const chip = append(row, 'span', {
      display: 'inline-flex',
      whiteSpace: 'nowrap',
      flexShrink: '0',
      color: MUTED,
      fontSize: '12px',
    }, item);
    chip.setAttribute('data-export-meaningful', 'true');
    if (attr === 'data-export-skill-row') chip.setAttribute('data-export-skill-chip', 'elegant-formal');
    chip.setAttribute('data-elegant-formal-inline-item', String(index));
  });
}

function renderLowerSections(root: HTMLElement, cv: CVData, locale?: Locale): void {
  const l = labels(locale);
  const sections: Array<{ key: string; heading: string; items: string[]; rowAttr: string }> = [];
  const skills = presentableSkills(cv.skills, locale);
  const languages = presentableLanguages(cv.languages, locale).map(language => `${language.name} (${language.level})`);
  if (skills.length > 0) sections.push({ key: 'skills', heading: l.skills, items: skills, rowAttr: 'data-export-skill-row' });
  if (languages.length > 0) sections.push({ key: 'languages', heading: l.languages, items: languages, rowAttr: 'data-export-language-row' });
  if (cv.certifications.length > 0) sections.push({ key: 'certifications', heading: l.certifications, items: cv.certifications, rowAttr: 'data-export-certification-row' });
  if (sections.length === 0) return;

  const grid = append(root, 'div', {
    display: 'grid',
    gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))`,
    gap: '14px',
    textAlign: 'center',
    borderTop: `1px solid ${RULE}`,
    paddingTop: '9px',
    boxSizing: 'border-box',
  });
  grid.setAttribute('data-export-group', 'skills-languages-block');

  sections.forEach(({ key, heading, items, rowAttr }) => {
    const section = append(grid, 'section');
    section.setAttribute('data-export-group', `${key}-section`);
    sectionHeading(section, heading);
    inlineItems(section, rowAttr, items);
  });
}

export function createElegantFormalPdfTemplate(
  cv: CVData,
  options: ElegantFormalPdfTemplateOptions = {},
): HTMLElement {
  const root = document.createElement('div');
  root.setAttribute('data-template-id', 'elegant-formal');
  root.setAttribute('data-elegant-formal-pdf-template', 'true');
  root.dir = options.locale === 'ar' ? 'rtl' : 'ltr';
  applyStyle(root, {
    width: '210mm',
    minWidth: '210mm',
    maxWidth: '210mm',
    minHeight: '297mm',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
    padding: '34px',
    color: TEXT,
    fontFamily: 'Georgia, "Times New Roman", Times, NotoSans, NotoSansArabic, NotoSansDevanagari, NotoSansJP, serif',
    fontSize: '13px',
    lineHeight: '1.42',
    wordSpacing: 'normal',
    letterSpacing: '0',
    whiteSpace: 'normal',
    fontKerning: 'normal',
    overflowX: 'hidden',
    overflowY: 'visible',
  });

  renderHeader(root, cv, options.photoDataUrl);
  renderSummary(root, cv, options.locale);
  renderExperience(root, cv, options.locale);
  renderEducation(root, cv, options.locale);
  renderLowerSections(root, cv, options.locale);
  return root;
}
