'use client';

import { getLocalizedCvLanguageName } from './cv-language-options';
import { getLocalizedCvSkillName } from './cv-skill-options';
import { translations, type Locale } from './i18n/translations';
import { regionSettings, type CVData } from './types';

type StyleMap = Partial<CSSStyleDeclaration>;

type AtsStandardPdfTemplateOptions = {
  locale?: Locale;
};

const TEXT = '#111827';
const MUTED = '#4b5563';
const RULE = '#d1d5db';
const BODY_PAD_X = 48;

function applyStyle(element: HTMLElement, styles: StyleMap): void {
  Object.entries(styles).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      (element.style as unknown as Record<string, string>)[key] = String(value);
    }
  });
}

function appendExportText(element: HTMLElement, text: string): void {
  if (!text.includes(' ')) {
    element.textContent = text;
    return;
  }

  text.split(/( +)/).forEach((part) => {
    if (!part) return;
    const span = document.createElement('span');
    span.textContent = part;
    if (/^ +$/.test(part)) {
      span.setAttribute('data-ats-standard-export-space', 'true');
      span.style.display = 'inline-block';
      span.style.width = `${part.length * 0.32}em`;
      span.style.minWidth = `${part.length * 0.32}em`;
      span.style.height = '1em';
      span.style.whiteSpace = 'pre';
    }
    element.appendChild(span);
  });
}

function append(parent: HTMLElement, tagName: string, styles?: StyleMap, text?: string): HTMLElement {
  const element = document.createElement(tagName);
  if (styles) applyStyle(element, styles);
  if (text !== undefined) appendExportText(element, text);
  parent.appendChild(element);
  return element;
}

function applyExportSafeTextStyles(root: HTMLElement): void {
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  elements.forEach((element) => {
    element.style.whiteSpace = 'normal';
    element.style.wordSpacing = 'normal';
    if (element.tagName !== 'H2') {
      element.style.letterSpacing = 'normal';
    }
    element.style.fontKerning = 'normal';
    element.style.textRendering = 'auto';
    element.style.fontVariantLigatures = 'normal';
    element.style.fontFeatureSettings = 'normal';
  });
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

function section(parent: HTMLElement, title: string): HTMLElement {
  const sectionEl = append(parent, 'section', {
    margin: '0 0 12px',
    padding: '0',
    breakInside: 'avoid',
    pageBreakInside: 'avoid',
  });
  sectionEl.setAttribute('data-export-group', 'ats-section');

  const heading = append(sectionEl, 'h2', {
    margin: '0 0 8px',
    padding: '0 0 4px',
    borderBottom: `1px solid ${RULE}`,
    color: TEXT,
    fontSize: '11.5px',
    lineHeight: '1.25',
    fontWeight: '700',
    letterSpacing: '0.02em',
    textAlign: 'left',
    textTransform: 'uppercase',
  }, title.toUpperCase());
  heading.setAttribute('data-export-meaningful', 'true');
  return sectionEl;
}

function descriptionLines(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^(?:[-*]|\u2022|\d+\.)\s+/, ''));
}

function renderHeader(root: HTMLElement, cv: CVData, locale?: Locale): void {
  const region = regionSettings[cv.region];
  const contacts = [
    cv.personal.email,
    cv.personal.phone,
    region.showAddress ? cv.personal.address : '',
  ].filter(Boolean);

  const header = append(root, 'header', {
    backgroundColor: '#ffffff',
    color: TEXT,
    padding: '28px 48px 14px',
    textAlign: 'center',
    boxSizing: 'border-box',
  });
  header.setAttribute('data-ats-standard-pdf-header', 'true');
  header.setAttribute('data-export-meaningful', 'true');

  const name = append(header, 'h1', {
    margin: '0',
    color: TEXT,
    fontSize: '21px',
    lineHeight: '1.2',
    fontWeight: '700',
    letterSpacing: '0',
    textTransform: 'none',
  }, cv.personal.fullName || 'Your Name');
  name.setAttribute('data-export-meaningful', 'true');

  if (cv.personal.jobTitle) {
    const title = append(header, 'p', {
      margin: '3px 0 0',
      color: MUTED,
      fontSize: '12px',
      lineHeight: '1.3',
      fontWeight: '400',
      letterSpacing: '0',
      textTransform: 'none',
    }, cv.personal.jobTitle);
    title.setAttribute('data-export-meaningful', 'true');
  }

  if (contacts.length > 0) {
    const contactRow = append(header, 'div', {
      marginTop: '9px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexWrap: 'wrap',
      color: MUTED,
      fontSize: '10.5px',
      lineHeight: '1.35',
    });
    contactRow.setAttribute('data-export-contact-row', 'ats-standard');

    contacts.forEach((contact, index) => {
      const item = append(contactRow, 'span', {
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        flexShrink: '0',
      });
      item.setAttribute('data-export-contact-item', 'ats-standard');
      item.setAttribute('data-export-meaningful', 'true');
      if (index > 0) {
        const separator = append(item, 'span', {
          color: '#9ca3af',
          paddingLeft: '9px',
          paddingRight: '9px',
        }, '|');
        separator.setAttribute('data-export-contact-separator', 'ats-standard');
      }
      append(item, 'span', undefined, contact);
    });
  }

  if (locale) root.setAttribute('lang', locale);
}

function renderExperience(parent: HTMLElement, cv: CVData, locale?: Locale): void {
  if (cv.experience.length === 0) return;
  const L = labels(locale);
  const sectionEl = section(parent, L.experience);

  cv.experience.forEach((exp) => {
    const entry = append(sectionEl, 'div', {
      margin: '0 0 10px',
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
    });
    entry.setAttribute('data-export-meaningful', 'true');
    entry.setAttribute('data-export-group', 'ats-experience-entry');

    const row = append(entry, 'div', {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      columnGap: '16px',
      alignItems: 'baseline',
    });

    const left = append(row, 'div', {
      minWidth: '0',
      color: TEXT,
      fontSize: '12.5px',
      fontWeight: '700',
      lineHeight: '1.28',
    }, [exp.position, exp.company].filter(Boolean).join(', '));
    left.setAttribute('data-export-meaningful', 'true');

    const dateText = [exp.startDate, exp.isPresent ? L.present : exp.endDate].filter(Boolean).join(' - ');
    const dates = append(row, 'div', {
      color: MUTED,
      fontSize: '10.5px',
      lineHeight: '1.25',
      whiteSpace: 'nowrap',
      textAlign: 'right',
    }, dateText);
    dates.setAttribute('data-export-meaningful', 'true');

    const lines = descriptionLines(exp.description);
    if (lines.length > 0) {
      const list = append(entry, 'ul', {
        margin: '4px 0 0',
        padding: '0',
        listStyleType: 'none',
      });
      lines.forEach((line) => {
        const item = append(list, 'li', {
          display: 'grid',
          gridTemplateColumns: '10px minmax(0, 1fr)',
          columnGap: '4px',
          margin: '0 0 2px',
          color: '#1f2937',
          fontSize: '11.5px',
          lineHeight: '1.36',
        });
        item.setAttribute('data-export-meaningful', 'true');
        item.setAttribute('data-export-bullet-row', 'ats-standard');
        append(item, 'span', { color: TEXT }, '-');
        append(item, 'span', undefined, line);
      });
    }
  });
}

function renderEducation(parent: HTMLElement, cv: CVData, locale?: Locale): void {
  if (cv.education.length === 0) return;
  const L = labels(locale);
  const sectionEl = section(parent, L.education);

  cv.education.forEach((edu) => {
    const entry = append(sectionEl, 'div', {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      columnGap: '16px',
      margin: '0 0 6px',
      color: TEXT,
      fontSize: '11.5px',
      lineHeight: '1.3',
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
    });
    entry.setAttribute('data-export-meaningful', 'true');
    entry.setAttribute('data-export-group', 'ats-education-entry');
    append(entry, 'div', { fontWeight: '700' }, [edu.degree, edu.school].filter(Boolean).join(', '));
    append(entry, 'div', { color: MUTED, fontSize: '10.5px', whiteSpace: 'nowrap', textAlign: 'right' }, [edu.startDate, edu.endDate].filter(Boolean).join(' - '));
    if (edu.description) {
      const desc = append(sectionEl, 'p', {
        margin: '-2px 0 6px',
        color: '#1f2937',
        fontSize: '11px',
        lineHeight: '1.35',
      }, edu.description);
      desc.setAttribute('data-export-meaningful', 'true');
    }
  });
}

export function createAtsStandardPdfTemplate(
  cv: CVData,
  options: AtsStandardPdfTemplateOptions = {},
): HTMLElement {
  const L = labels(options.locale);
  const root = document.createElement('div');
  root.setAttribute('data-template-id', 'ats-standard');
  root.setAttribute('data-ats-standard-pdf-template', 'true');
  applyStyle(root, {
    width: '210mm',
    minWidth: '210mm',
    minHeight: '297mm',
    boxSizing: 'border-box',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    color: TEXT,
    fontFamily: 'Arial, Helvetica, NotoSans, NotoSansArabic, NotoSansDevanagari, NotoSansJP, sans-serif',
    fontSize: '12px',
    lineHeight: '1.36',
  });

  renderHeader(root, cv, options.locale);

  const body = append(root, 'main', {
    padding: `0 ${BODY_PAD_X}px 24px`,
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
  });

  if (cv.summary) {
    const sectionEl = section(body, L.summary);
    const summary = append(sectionEl, 'p', {
      margin: '0',
      color: '#1f2937',
      fontSize: '11.5px',
      lineHeight: '1.42',
      whiteSpace: 'normal',
    }, cv.summary);
    summary.setAttribute('data-export-meaningful', 'true');
  }

  renderExperience(body, cv, options.locale);
  renderEducation(body, cv, options.locale);

  if (cv.skills.length > 0) {
    const sectionEl = section(body, L.skills);
    const skills = append(sectionEl, 'div', {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px 9px',
      color: '#1f2937',
      fontSize: '11.2px',
      lineHeight: '1.35',
    });
    cv.skills.forEach((skill, index) => {
      const item = append(skills, 'span', {
        display: 'inline-flex',
        whiteSpace: 'nowrap',
        flexShrink: '0',
      }, getLocalizedCvSkillName(skill, options.locale ?? 'en'));
      item.setAttribute('data-export-meaningful', 'true');
      item.setAttribute('data-ats-standard-skill', 'item');
      if (index < cv.skills.length - 1) {
        append(item, 'span', { color: '#9ca3af', paddingLeft: '9px' }, '|');
      }
    });
  }

  if (cv.languages.length > 0) {
    const sectionEl = section(body, L.languages);
    cv.languages.forEach((language) => {
      const item = append(sectionEl, 'p', {
        margin: '0 0 3px',
        color: '#1f2937',
        fontSize: '11.2px',
        lineHeight: '1.35',
      }, `${getLocalizedCvLanguageName(language.name, options.locale ?? 'en')} - ${language.level}`);
      item.setAttribute('data-export-meaningful', 'true');
    });
  }

  if (cv.certifications.length > 0) {
    const sectionEl = section(body, L.certifications);
    cv.certifications.forEach((certification) => {
      const item = append(sectionEl, 'p', {
        margin: '0 0 3px',
        color: '#1f2937',
        fontSize: '11.2px',
        lineHeight: '1.35',
      }, certification);
      item.setAttribute('data-export-meaningful', 'true');
    });
  }

  applyExportSafeTextStyles(root);
  return root;
}
