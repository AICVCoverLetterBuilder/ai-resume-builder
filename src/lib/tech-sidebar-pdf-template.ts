'use client';

import { getLocalizedCvLanguageName } from './cv-language-options';
import { getLocalizedCvSkillName } from './cv-skill-options';
import { translations, type Locale } from './i18n/translations';
import { regionSettings, type CVData } from './types';

type StyleMap = Partial<CSSStyleDeclaration>;

type TechSidebarPdfTemplateOptions = {
  locale?: Locale;
  photoDataUrl?: string | null;
};

const NAVY = '#0f172a';
const NAVY_SOFT = '#1e293b';
const BLUE = '#2563eb';
const BLUE_LIGHT = '#60a5fa';
const RULE = '#bfdbfe';
const TEXT = '#111827';
const BODY = '#374151';
const MUTED = '#64748b';
const SIDEBAR_MUTED = '#cbd5e1';

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

function sidebarHeading(parent: HTMLElement, title: string): HTMLElement {
  const heading = append(parent, 'h2', {
    margin: '0 0 7px',
    padding: '0 0 5px',
    borderBottom: '1px solid #334155',
    color: BLUE_LIGHT,
    fontSize: '9.5px',
    lineHeight: '1.2',
    fontWeight: '700',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  }, title.toUpperCase());
  heading.setAttribute('data-export-meaningful', 'true');
  heading.setAttribute('data-export-keep-with-next', 'true');
  return heading;
}

function mainSection(parent: HTMLElement, title: string): HTMLElement {
  const section = append(parent, 'section', {
    margin: '0 0 15px',
    padding: '0',
    breakInside: 'avoid',
    pageBreakInside: 'avoid',
  });
  section.setAttribute('data-export-group', 'tech-sidebar-section');

  const heading = append(section, 'h2', {
    margin: '0 0 8px',
    padding: '0 0 5px',
    borderBottom: `1px solid ${RULE}`,
    color: BLUE,
    fontSize: '10px',
    lineHeight: '1.2',
    fontWeight: '700',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  }, title.toUpperCase());
  heading.setAttribute('data-export-meaningful', 'true');
  heading.setAttribute('data-export-keep-with-next', 'true');

  return section;
}

function renderSidebar(sidebar: HTMLElement, cv: CVData, locale?: Locale, photoDataUrl?: string | null): void {
  const region = regionSettings[cv.region];
  const L = labels(locale);
  const contacts = [
    cv.personal.email,
    cv.personal.phone,
    region.showAddress ? cv.personal.address : '',
  ].filter(Boolean);

  sidebar.setAttribute('data-export-meaningful', 'true');
  sidebar.setAttribute('data-tech-sidebar-pdf-sidebar', 'true');

  if (photoDataUrl) {
    const frame = append(sidebar, 'div', {
      width: '88px',
      minWidth: '88px',
      maxWidth: '88px',
      height: '88px',
      minHeight: '88px',
      maxHeight: '88px',
      aspectRatio: '1 / 1',
      borderRadius: '50%',
      overflow: 'hidden',
      margin: '0 auto 16px',
      border: '2px solid #334155',
      boxSizing: 'border-box',
      backgroundColor: NAVY_SOFT,
      lineHeight: '0',
      flexShrink: '0',
    });
    frame.setAttribute('data-export-photo-frame', 'tech-sidebar');

    const img = document.createElement('img');
    img.src = photoDataUrl;
    img.alt = '';
    img.setAttribute('data-export-photo', 'tech-sidebar');
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

  append(sidebar, 'h1', {
    margin: '0',
    color: '#ffffff',
    fontSize: '18px',
    lineHeight: '1.12',
    fontWeight: '700',
    overflowWrap: 'break-word',
  }, cv.personal.fullName || 'Your Name');

  if (cv.personal.jobTitle) {
    append(sidebar, 'p', {
      margin: '5px 0 12px',
      color: BLUE_LIGHT,
      fontSize: '10.8px',
      lineHeight: '1.25',
      fontWeight: '600',
    }, cv.personal.jobTitle);
  }

  if (contacts.length > 0 || cv.personal.fathersName) {
    const contactWrap = append(sidebar, 'div', {
      margin: '0 0 17px',
      color: SIDEBAR_MUTED,
      fontSize: '9.4px',
      lineHeight: '1.35',
    });
    contacts.forEach(contact => {
      const p = append(contactWrap, 'p', { margin: '0 0 3px', overflowWrap: 'break-word' }, contact);
      p.setAttribute('data-export-meaningful', 'true');
    });
    if (cv.personal.fathersName) {
      append(contactWrap, 'p', { margin: '0 0 3px', overflowWrap: 'break-word' }, cv.personal.fathersName);
    }
  }

  if (cv.skills.length > 0) {
    const skillBlock = append(sidebar, 'section', { margin: '0 0 15px' });
    skillBlock.setAttribute('data-tech-sidebar-skills', 'sidebar');
    sidebarHeading(skillBlock, L.skills);
    const chips = append(skillBlock, 'div', {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '5px',
      margin: '0',
    });
    cv.skills.forEach(skill => {
      const chip = append(chips, 'span', {
        display: 'inline-block',
        padding: '3px 6px',
        borderRadius: '3px',
        backgroundColor: NAVY_SOFT,
        color: '#e2e8f0',
        fontSize: '9.2px',
        lineHeight: '1.2',
        whiteSpace: 'normal',
      }, getLocalizedCvSkillName(skill, locale ?? 'en'));
      chip.setAttribute('data-export-meaningful', 'true');
    });
  }

  if (cv.languages.length > 0) {
    const languageBlock = append(sidebar, 'section', { margin: '0 0 15px' });
    sidebarHeading(languageBlock, L.languages);
    cv.languages.forEach(language => {
      const p = append(languageBlock, 'p', {
        margin: '0 0 4px',
        color: '#e2e8f0',
        fontSize: '9.6px',
        lineHeight: '1.3',
      }, `${getLocalizedCvLanguageName(language.name, locale ?? 'en')} / ${language.level}`);
      p.setAttribute('data-export-meaningful', 'true');
    });
  }

  if (cv.certifications.length > 0) {
    const certBlock = append(sidebar, 'section', { margin: '0' });
    sidebarHeading(certBlock, L.certifications);
    cv.certifications.forEach(certification => {
      const p = append(certBlock, 'p', {
        margin: '0 0 4px',
        color: '#e2e8f0',
        fontSize: '9.6px',
        lineHeight: '1.3',
      }, certification);
      p.setAttribute('data-export-meaningful', 'true');
    });
  }
}

function renderSummary(main: HTMLElement, cv: CVData, locale?: Locale): void {
  if (!cv.summary) return;
  const sec = mainSection(main, labels(locale).summary);
  const p = append(sec, 'p', {
    margin: '0',
    color: BODY,
    fontSize: '10.7px',
    lineHeight: '1.34',
    whiteSpace: 'normal',
    wordSpacing: 'normal',
    letterSpacing: '0',
  }, cv.summary);
  p.setAttribute('data-export-meaningful', 'true');
}

function renderExperience(main: HTMLElement, cv: CVData, locale?: Locale): void {
  if (cv.experience.length === 0) return;
  const L = labels(locale);
  const sec = mainSection(main, L.experience);
  cv.experience.forEach((exp) => {
    const item = append(sec, 'div', {
      margin: '0 0 12px',
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
    });
    item.setAttribute('data-export-meaningful', 'true');
    item.setAttribute('data-export-group', 'tech-sidebar-experience');

    const row = append(item, 'div', {
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: '14px',
      alignItems: 'baseline',
    });
    append(row, 'h3', {
      margin: '0',
      color: TEXT,
      fontSize: '12.4px',
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

function renderEducation(main: HTMLElement, cv: CVData, locale?: Locale): void {
  if (cv.education.length === 0) return;
  const sec = mainSection(main, labels(locale).education);
  cv.education.forEach((edu) => {
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
      const p = append(sec, 'p', {
        margin: '-3px 0 8px',
        color: BODY,
        fontSize: '10px',
        lineHeight: '1.28',
      }, edu.description);
      p.setAttribute('data-export-meaningful', 'true');
    }
  });
}

export function createTechSidebarPdfTemplate(
  cv: CVData,
  options: TechSidebarPdfTemplateOptions = {},
): HTMLElement {
  const root = document.createElement('div');
  root.setAttribute('data-template-id', 'tech-sidebar');
  root.setAttribute('data-tech-sidebar-pdf-root', 'true');
  applyStyle(root, {
    width: '210mm',
    minHeight: '297mm',
    display: 'grid',
    gridTemplateColumns: '64mm 1fr',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
    color: TEXT,
    fontFamily: 'Arial, Helvetica, NotoSans, NotoSansArabic, NotoSansDevanagari, NotoSansJP, sans-serif',
    fontSize: '11px',
    lineHeight: '1.35',
    overflow: 'visible',
  });

  const sidebar = append(root, 'aside', {
    backgroundColor: NAVY,
    color: '#ffffff',
    padding: '24px 18px',
    boxSizing: 'border-box',
    minHeight: '297mm',
    width: '64mm',
    overflow: 'visible',
  });
  const main = append(root, 'main', {
    backgroundColor: '#ffffff',
    padding: '30px 32px 28px',
    boxSizing: 'border-box',
    minHeight: '297mm',
    overflow: 'visible',
  });
  main.setAttribute('data-tech-sidebar-pdf-main', 'true');

  renderSidebar(sidebar, cv, options.locale, options.photoDataUrl ?? null);
  renderSummary(main, cv, options.locale);
  renderExperience(main, cv, options.locale);
  renderEducation(main, cv, options.locale);

  return root;
}
