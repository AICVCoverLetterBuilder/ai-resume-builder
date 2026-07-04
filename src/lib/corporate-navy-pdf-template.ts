'use client';

import { getLocalizedCvLanguageName } from './cv-language-options';
import { getLocalizedCvSkillName } from './cv-skill-options';
import { translations, type Locale } from './i18n/translations';
import { regionSettings, type CVData } from './types';

type StyleMap = Partial<CSSStyleDeclaration>;

type CorporateNavyPdfTemplateOptions = {
  locale?: Locale;
  photoDataUrl?: string | null;
};

const NAVY = '#0f172a';
const BLUE = '#3b82f6';
const RULE = '#dbeafe';
const TEXT = '#111827';
const BODY = '#374151';
const MUTED = '#6b7280';
const HEADER_MUTED = '#cbd5e1';

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
  sectionEl.setAttribute('data-export-group', 'corporate-navy-section');

  const heading = append(sectionEl, 'h2', {
    margin: '0 0 8px',
    padding: '0 0 5px',
    borderBottom: `1px solid ${RULE}`,
    color: NAVY,
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
    cv.personal.dateOfBirth,
    cv.personal.nationality,
  ].filter(Boolean);

  const header = append(root, 'header', {
    margin: '0',
    padding: '22px 34px 19px',
    backgroundColor: NAVY,
    color: '#ffffff',
    boxSizing: 'border-box',
  });
  header.setAttribute('data-export-meaningful', 'true');
  header.setAttribute('data-corporate-navy-pdf-header', 'true');

  const row = append(header, 'div', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '28px',
  });
  row.setAttribute('data-corporate-navy-header-row', 'true');

  const info = append(row, 'div', {
    flex: '1 1 auto',
    minWidth: '0',
    textAlign: 'left',
  });
  info.setAttribute('data-corporate-navy-header-info', 'true');

  append(info, 'h1', {
    margin: '0',
    color: '#ffffff',
    fontSize: '25px',
    lineHeight: '1.12',
    fontWeight: '700',
    letterSpacing: '0.04em',
    overflowWrap: 'break-word',
  }, cv.personal.fullName || 'Your Name').setAttribute('data-export-meaningful', 'true');

  if (cv.personal.jobTitle) {
    append(info, 'p', {
      margin: '5px 0 0',
      color: '#93c5fd',
      fontSize: '12.2px',
      lineHeight: '1.25',
      fontWeight: '600',
    }, cv.personal.jobTitle).setAttribute('data-export-meaningful', 'true');
  }

  if (contacts.length > 0 || cv.personal.fathersName) {
    const contactRow = append(info, 'div', {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0',
      margin: '11px 0 0',
      color: HEADER_MUTED,
      fontSize: '9.6px',
      lineHeight: '1.35',
      wordSpacing: 'normal',
      letterSpacing: 'normal',
    });
    contactRow.setAttribute('data-corporate-navy-contact-row', 'true');
    contacts.forEach((contact, index) => {
      if (index > 0) append(contactRow, 'span', { margin: '0 7px', color: BLUE }, '|');
      append(contactRow, 'span', { whiteSpace: 'nowrap' }, contact).setAttribute('data-export-meaningful', 'true');
    });
    if (cv.personal.fathersName) {
      if (contacts.length > 0) append(contactRow, 'span', { margin: '0 7px', color: BLUE }, '|');
      append(contactRow, 'span', { whiteSpace: 'nowrap' }, cv.personal.fathersName).setAttribute('data-export-meaningful', 'true');
    }
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
      border: '2px solid #1e293b',
      boxSizing: 'border-box',
      backgroundColor: '#ffffff',
      lineHeight: '0',
    });
    frame.setAttribute('data-corporate-navy-photo-frame', 'true');
    frame.setAttribute('data-export-photo-frame', 'corporate-navy');

    const img = document.createElement('img');
    img.src = photoDataUrl;
    img.alt = '';
    img.setAttribute('data-export-photo', 'corporate-navy');
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

  append(root, 'div', {
    width: '100%',
    height: '2px',
    backgroundColor: BLUE,
    margin: '0 0 24px',
  }).setAttribute('data-corporate-navy-accent-rule', 'true');

  if (locale) root.setAttribute('lang', locale);
}

function renderSummary(root: HTMLElement, cv: CVData, locale?: Locale): void {
  if (!cv.summary) return;
  const sec = section(root, labels(locale).summary);
  append(sec, 'p', {
    margin: '0',
    color: BODY,
    fontSize: '10.8px',
    lineHeight: '1.34',
    whiteSpace: 'normal',
    wordSpacing: 'normal',
    letterSpacing: '0',
  }, cv.summary).setAttribute('data-export-meaningful', 'true');
}

function renderExperience(root: HTMLElement, cv: CVData, locale?: Locale): void {
  if (cv.experience.length === 0) return;
  const L = labels(locale);
  const sec = section(root, L.experience);
  cv.experience.forEach(exp => {
    const item = append(sec, 'div', {
      margin: '0 0 12px',
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
    });
    item.setAttribute('data-export-meaningful', 'true');
    item.setAttribute('data-export-group', 'corporate-navy-experience');

    const row = append(item, 'div', {
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: '14px',
      alignItems: 'baseline',
    });
    append(row, 'h3', {
      margin: '0',
      color: TEXT,
      fontSize: '12.5px',
      lineHeight: '1.2',
      fontWeight: '700',
    }, exp.position);
    append(row, 'div', {
      color: MUTED,
      fontSize: '9.6px',
      lineHeight: '1.2',
      whiteSpace: 'nowrap',
      textAlign: 'right',
      paddingTop: '1px',
    }, `${exp.startDate} - ${exp.isPresent ? L.present : exp.endDate}`);

    append(item, 'p', {
      margin: '2px 0 5px',
      color: BLUE,
      fontSize: '10.2px',
      lineHeight: '1.25',
      fontWeight: '600',
    }, exp.company);

    descriptionLines(exp.description).forEach(line => {
      const bullet = append(item, 'div', {
        display: 'grid',
        gridTemplateColumns: '10px 1fr',
        gap: '3px',
        margin: '0 0 2px',
        color: BODY,
        fontSize: '10.2px',
        lineHeight: '1.28',
      });
      bullet.setAttribute('data-export-meaningful', 'true');
      append(bullet, 'span', { color: BLUE, lineHeight: '1.28' }, '-');
      append(bullet, 'span', {
        whiteSpace: 'normal',
        wordSpacing: 'normal',
        letterSpacing: '0',
      }, line);
    });
  });
}

function renderEducation(root: HTMLElement, cv: CVData, locale?: Locale): void {
  if (cv.education.length === 0) return;
  const sec = section(root, labels(locale).education);
  cv.education.forEach(edu => {
    const row = append(sec, 'div', {
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: '14px',
      margin: '0 0 8px',
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
    });
    row.setAttribute('data-export-meaningful', 'true');

    const left = append(row, 'div');
    append(left, 'h3', {
      margin: '0',
      color: TEXT,
      fontSize: '12px',
      lineHeight: '1.2',
      fontWeight: '700',
    }, edu.degree);
    append(left, 'p', {
      margin: '2px 0 0',
      color: MUTED,
      fontSize: '10px',
      lineHeight: '1.25',
    }, edu.school);
    append(row, 'div', {
      color: MUTED,
      fontSize: '9.6px',
      lineHeight: '1.2',
      whiteSpace: 'nowrap',
      textAlign: 'right',
    }, [edu.startDate, edu.endDate].filter(Boolean).join(' - '));

    if (edu.description) {
      append(sec, 'p', {
        margin: '-3px 0 8px',
        color: BODY,
        fontSize: '10px',
        lineHeight: '1.28',
      }, edu.description).setAttribute('data-export-meaningful', 'true');
    }
  });
}

function renderBottomColumns(root: HTMLElement, cv: CVData, locale?: Locale): void {
  const L = labels(locale);
  const hasSkills = cv.skills.length > 0;
  const hasLanguages = cv.languages.length > 0;
  const hasCerts = cv.certifications.length > 0;
  if (!hasSkills && !hasLanguages && !hasCerts) return;

  const wrap = append(root, 'div', {
    display: 'grid',
    gridTemplateColumns: hasSkills && hasLanguages ? '1.35fr 1fr' : '1fr',
    gap: '22px',
    margin: '0',
    breakInside: 'avoid',
    pageBreakInside: 'avoid',
  });
  wrap.setAttribute('data-corporate-navy-bottom-columns', 'true');

  if (hasSkills) {
    const skillSec = section(wrap, L.skills);
    skillSec.style.margin = '0';
    const chips = append(skillSec, 'div', {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '5px',
      margin: '0',
    });
    cv.skills.forEach(skill => {
      const chip = append(chips, 'span', {
        display: 'inline-block',
        padding: '3px 7px',
        borderRadius: '3px',
        backgroundColor: '#f1f5f9',
        color: '#334155',
        fontSize: '9.4px',
        lineHeight: '1.2',
        whiteSpace: 'normal',
      }, getLocalizedCvSkillName(skill, locale ?? 'en'));
      chip.setAttribute('data-export-meaningful', 'true');
    });
  }

  if (hasLanguages || hasCerts) {
    const meta = append(wrap, 'div', { margin: '0' });
    if (hasLanguages) {
      const langSec = section(meta, L.languages);
      langSec.style.margin = hasCerts ? '0 0 12px' : '0';
      cv.languages.forEach(language => {
        append(langSec, 'p', {
          margin: '0 0 4px',
          color: BODY,
          fontSize: '10px',
          lineHeight: '1.28',
        }, `${getLocalizedCvLanguageName(language.name, locale ?? 'en')} / ${language.level}`).setAttribute('data-export-meaningful', 'true');
      });
    }
    if (hasCerts) {
      const certSec = section(meta, L.certifications);
      certSec.style.margin = '0';
      cv.certifications.forEach(cert => {
        append(certSec, 'p', {
          margin: '0 0 4px',
          color: BODY,
          fontSize: '10px',
          lineHeight: '1.28',
        }, cert).setAttribute('data-export-meaningful', 'true');
      });
    }
  }
}

export function createCorporateNavyPdfTemplate(
  cv: CVData,
  options: CorporateNavyPdfTemplateOptions = {},
): HTMLElement {
  const root = document.createElement('div');
  root.setAttribute('data-template-id', 'corporate-navy');
  root.setAttribute('data-corporate-navy-pdf-root', 'true');
  applyStyle(root, {
    width: '210mm',
    minWidth: '210mm',
    minHeight: '297mm',
    margin: '0 auto',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
    color: TEXT,
    fontFamily: 'Arial, Helvetica, NotoSans, NotoSansArabic, NotoSansDevanagari, NotoSansJP, sans-serif',
    fontSize: '11px',
    lineHeight: '1.35',
    overflow: 'visible',
    wordSpacing: 'normal',
    letterSpacing: 'normal',
    fontKerning: 'normal',
    fontFeatureSettings: 'normal',
  });

  renderHeader(root, cv, options.locale, options.photoDataUrl ?? null);

  const body = append(root, 'main', {
    padding: '0 34px 28px',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
    overflow: 'visible',
  });
  body.setAttribute('data-corporate-navy-pdf-body', 'true');

  renderSummary(body, cv, options.locale);
  renderExperience(body, cv, options.locale);
  renderEducation(body, cv, options.locale);
  renderBottomColumns(body, cv, options.locale);

  return root;
}
