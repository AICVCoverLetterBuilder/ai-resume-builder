'use client';

import { getLocalizedCvLanguageName } from './cv-language-options';
import { getLocalizedCvSkillName } from './cv-skill-options';
import { translations, type Locale } from './i18n/translations';
import { regionSettings, type CVData } from './types';

type StyleMap = Partial<CSSStyleDeclaration>;

type NordicCleanPdfTemplateOptions = {
  locale?: Locale;
  photoDataUrl?: string | null;
};

const TEAL = '#0d9488';
const TEAL_RULE = '#99f6e4';
const TEAL_SOFT = '#f0fdfa';
const TEXT = '#111827';
const BODY = '#4b5563';
const MUTED = '#9ca3af';

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
    experience: t.cv.experience,
    education: t.cv.education,
    skills: t.cv.skills,
    languages: t.cv.languages,
    certifications: t.cv.certifications,
    present: t.cv.present,
  };
}

function descriptionLines(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^(?:[-*]|\u2022|\d+\.)\s+/, ''));
}

function section(parent: HTMLElement, title: string): HTMLElement {
  const sectionEl = append(parent, 'section', {
    margin: '0 0 14px',
    padding: '0',
    breakInside: 'avoid',
    pageBreakInside: 'avoid',
  });
  sectionEl.setAttribute('data-export-group', 'nordic-clean-section');

  const heading = append(sectionEl, 'h2', {
    margin: '0 0 8px',
    padding: '0 0 5px',
    borderBottom: `1px solid ${TEAL_RULE}`,
    color: TEAL,
    fontSize: '10px',
    lineHeight: '1.2',
    fontWeight: '700',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
  }, title.toUpperCase());
  heading.setAttribute('data-export-meaningful', 'true');
  heading.setAttribute('data-export-keep-with-next', 'true');

  return sectionEl;
}

function renderHeader(root: HTMLElement, cv: CVData, locale?: Locale, photoDataUrl?: string | null): void {
  const region = regionSettings[cv.region];
  const contacts = [
    cv.personal.email,
    cv.personal.phone,
    region.showAddress ? cv.personal.address : '',
  ].filter(Boolean);

  const header = append(root, 'header', {
    margin: '0 0 20px',
    padding: '0 0 14px',
    borderBottom: `1px solid ${TEAL_RULE}`,
    boxSizing: 'border-box',
  });
  header.setAttribute('data-export-meaningful', 'true');
  header.setAttribute('data-nordic-clean-pdf-header', 'true');

  const row = append(header, 'div', {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '22px',
  });

  const info = append(row, 'div', {
    flex: '1 1 auto',
    minWidth: '0',
  });

  append(info, 'h1', {
    margin: '0',
    color: TEXT,
    fontSize: '29px',
    lineHeight: '1.08',
    fontWeight: '300',
    letterSpacing: '-0.01em',
  }, cv.personal.fullName || 'Your Name');

  append(info, 'p', {
    margin: '5px 0 0',
    color: TEAL,
    fontSize: '13px',
    lineHeight: '1.3',
    fontWeight: '600',
  }, cv.personal.jobTitle || '');

  if (contacts.length > 0) {
    const contactLine = append(info, 'div', {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0',
      margin: '13px 0 0',
      color: MUTED,
      fontSize: '10.5px',
      lineHeight: '1.35',
    });
    contacts.forEach((contact, index) => {
      if (index > 0) {
        append(contactLine, 'span', {
          display: 'inline-block',
          margin: '0 7px',
          color: MUTED,
          whiteSpace: 'nowrap',
        }, '|');
      }
      append(contactLine, 'span', {
        display: 'inline-block',
        whiteSpace: 'nowrap',
      }, contact);
    });
  }

  if (photoDataUrl) {
    const frame = append(row, 'div', {
      flex: '0 0 auto',
      flexShrink: '0',
      width: '82px',
      minWidth: '82px',
      maxWidth: '82px',
      height: '82px',
      minHeight: '82px',
      maxHeight: '82px',
      aspectRatio: '1 / 1',
      borderRadius: '50%',
      overflow: 'hidden',
      border: '1px solid #f3f4f6',
      boxSizing: 'border-box',
      backgroundColor: '#ffffff',
      lineHeight: '0',
    });
    frame.setAttribute('data-export-photo-frame', 'nordic-clean');
    const img = document.createElement('img');
    img.src = photoDataUrl;
    img.alt = '';
    img.setAttribute('data-export-photo', 'nordic-clean');
    applyStyle(img, {
      display: 'block',
      width: '100%',
      minWidth: '100%',
      maxWidth: '100%',
      height: '100%',
      minHeight: '100%',
      maxHeight: '100%',
      objectFit: 'cover',
      objectPosition: 'center center',
      borderRadius: '0',
      transform: 'none',
    });
    frame.appendChild(img);
  }
}

function renderSummary(root: HTMLElement, cv: CVData): void {
  if (!cv.summary) return;
  const wrap = append(root, 'section', {
    margin: '0 0 17px',
  });
  wrap.setAttribute('data-export-meaningful', 'true');
  append(wrap, 'p', {
    margin: '0',
    color: BODY,
    fontSize: '11.2px',
    lineHeight: '1.35',
  }, cv.summary);
}

function renderExperience(root: HTMLElement, cv: CVData, locale?: Locale): void {
  if (cv.experience.length === 0) return;
  const L = labels(locale);
  const sec = section(root, L.experience);
  cv.experience.forEach((exp) => {
    const item = append(sec, 'div', {
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: '16px',
      margin: '0 0 12px',
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
    });
    item.setAttribute('data-export-meaningful', 'true');
    item.setAttribute('data-export-group', 'nordic-clean-experience');

    const main = append(item, 'div');
    append(main, 'h3', {
      margin: '0',
      color: TEXT,
      fontSize: '13px',
      lineHeight: '1.2',
      fontWeight: '700',
    }, exp.position);
    append(main, 'p', {
      margin: '2px 0 5px',
      color: '#6b7280',
      fontSize: '10.5px',
      lineHeight: '1.25',
    }, exp.company);

    descriptionLines(exp.description).forEach((line) => {
      const bullet = append(main, 'div', {
        display: 'grid',
        gridTemplateColumns: '10px 1fr',
        gap: '3px',
        margin: '0 0 2px',
        color: BODY,
        fontSize: '10.4px',
        lineHeight: '1.28',
      });
      append(bullet, 'span', { color: TEAL }, '-');
      append(bullet, 'span', undefined, line);
    });

    append(item, 'div', {
      color: MUTED,
      fontSize: '10px',
      lineHeight: '1.2',
      whiteSpace: 'nowrap',
      paddingTop: '2px',
      textAlign: 'right',
    }, `${exp.startDate} - ${exp.isPresent ? L.present : exp.endDate}`);
  });
}

function renderEducation(root: HTMLElement, cv: CVData, locale?: Locale): void {
  if (cv.education.length === 0) return;
  const L = labels(locale);
  const sec = section(root, L.education);
  cv.education.forEach((edu) => {
    const row = append(sec, 'div', {
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: '16px',
      margin: '0 0 8px',
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
    });
    row.setAttribute('data-export-meaningful', 'true');

    const left = append(row, 'div');
    append(left, 'h3', {
      margin: '0',
      color: TEXT,
      fontSize: '12.5px',
      lineHeight: '1.2',
      fontWeight: '700',
    }, edu.degree);
    append(left, 'p', {
      margin: '2px 0 0',
      color: '#6b7280',
      fontSize: '10.5px',
      lineHeight: '1.25',
    }, edu.school);
    append(row, 'div', {
      color: MUTED,
      fontSize: '10px',
      lineHeight: '1.2',
      whiteSpace: 'nowrap',
      textAlign: 'right',
    }, [edu.startDate, edu.endDate].filter(Boolean).join(' - '));
  });
}

function renderLower(root: HTMLElement, cv: CVData, locale?: Locale): void {
  const L = labels(locale);
  if (cv.skills.length === 0 && cv.languages.length === 0 && cv.certifications.length === 0) return;
  const lower = append(root, 'div', {
    display: 'grid',
    gridTemplateColumns: cv.languages.length > 0 ? '1fr 1fr' : '1fr',
    gap: '24px',
    margin: '0',
  });

  if (cv.skills.length > 0) {
    const sec = section(lower, L.skills);
    const chips = append(sec, 'div', {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '5px',
    });
    chips.setAttribute('data-export-meaningful', 'true');
    cv.skills.forEach((skill) => {
      append(chips, 'span', {
        display: 'inline-block',
        padding: '2px 7px',
        border: `1px solid ${TEAL_RULE}`,
        borderRadius: '4px',
        backgroundColor: TEAL_SOFT,
        color: '#0f766e',
        fontSize: '10px',
        lineHeight: '1.25',
        whiteSpace: 'nowrap',
      }, getLocalizedCvSkillName(skill, locale ?? 'en'));
    });
  }

  if (cv.languages.length > 0) {
    const sec = section(lower, L.languages);
    cv.languages.forEach((language) => {
      const p = append(sec, 'p', {
        margin: '0 0 3px',
        color: BODY,
        fontSize: '10.5px',
        lineHeight: '1.3',
      }, `${getLocalizedCvLanguageName(language.name, locale ?? 'en')} / ${language.level}`);
      p.setAttribute('data-export-meaningful', 'true');
    });
  }

  if (cv.certifications.length > 0) {
    const sec = section(root, L.certifications);
    cv.certifications.forEach((certification) => {
      const p = append(sec, 'p', {
        margin: '0 0 3px',
        color: BODY,
        fontSize: '10.5px',
        lineHeight: '1.3',
      }, certification);
      p.setAttribute('data-export-meaningful', 'true');
    });
  }
}

export function createNordicCleanPdfTemplate(
  cv: CVData,
  options: NordicCleanPdfTemplateOptions = {},
): HTMLElement {
  const root = document.createElement('div');
  root.setAttribute('data-template-id', 'nordic-clean');
  root.setAttribute('data-nordic-clean-pdf-root', 'true');
  applyStyle(root, {
    width: '210mm',
    minHeight: '297mm',
    padding: '38px 48px',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
    color: TEXT,
    fontFamily: 'Arial, Helvetica, NotoSans, NotoSansArabic, NotoSansDevanagari, NotoSansJP, sans-serif',
    fontSize: '11px',
    lineHeight: '1.35',
    overflow: 'visible',
  });

  renderHeader(root, cv, options.locale, options.photoDataUrl ?? null);
  renderSummary(root, cv);
  renderExperience(root, cv, options.locale);
  renderEducation(root, cv, options.locale);
  renderLower(root, cv, options.locale);

  return root;
}
