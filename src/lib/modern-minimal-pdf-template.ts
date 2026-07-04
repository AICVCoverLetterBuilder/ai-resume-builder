'use client';

import { getLocalizedCvLanguageName } from './cv-language-options';
import { getLocalizedCvSkillName } from './cv-skill-options';
import { translations, type Locale } from './i18n/translations';
import { regionSettings, type CVData } from './types';

type StyleMap = Partial<CSSStyleDeclaration>;

type ModernMinimalPdfTemplateOptions = {
  locale?: Locale;
  photoDataUrl?: string | null;
};

const TEXT = '#111827';
const MUTED = '#4b5563';
const INDIGO = '#4f46e5';
const RULE = '#c7d2fe';

function style(element: HTMLElement, styles: StyleMap): void {
  Object.entries(styles).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      (element.style as unknown as Record<string, string>)[key] = String(value);
    }
  });
}

function appendText(element: HTMLElement, text: string): void {
  element.textContent = text;
}

function append(parent: HTMLElement, tag: string, styles?: StyleMap, text?: string): HTMLElement {
  const element = document.createElement(tag);
  if (styles) style(element, styles);
  if (text !== undefined) appendText(element, text);
  parent.appendChild(element);
  return element;
}

// Bold, single-line, highly-visible fields (work position titles, education
// degree/school lines) render each whitespace-separated segment as its own
// element inside a wrapping flex row with an explicit CSS `gap`. The gap
// between segments is then guaranteed by real element box layout (the same
// well-tested flexbox positioning html2canvas already relies on elsewhere in
// this template, e.g. the contact row and skill chips), instead of depending
// on a single text node's internal space-glyph width — which is what could
// still visually collapse on some WebView/html2canvas font/text-shaping
// combinations even with extra word-spacing. A real space character is kept
// between segments too (as a suppressed whitespace-only flex child) so
// textContent/copy semantics stay natural.
function appendSafeWords(parent: HTMLElement, tag: string, text: string, styles: StyleMap): HTMLElement {
  const container = append(parent, tag, {
    ...styles,
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: '0.32em',
    rowGap: '1px',
    alignItems: 'baseline',
  });
  const words = text.split(/\s+/).filter(Boolean);
  words.forEach((word, index) => {
    const span = document.createElement('span');
    span.textContent = word;
    container.appendChild(span);
    if (index < words.length - 1) container.appendChild(document.createTextNode(' '));
  });
  container.setAttribute('data-modern-minimal-safe-words', 'true');
  return container;
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
    margin: '0 0 9px',
    breakInside: 'avoid',
    pageBreakInside: 'avoid',
  });
  sectionEl.setAttribute('data-export-group', 'modern-minimal-section');
  const heading = append(sectionEl, 'h2', {
    margin: '0 0 5px',
    padding: '0 0 3px',
    borderBottom: `1px solid ${RULE}`,
    color: INDIGO,
    fontSize: '10.5px',
    lineHeight: '1.2',
    fontWeight: '700',
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
  }, title.toUpperCase());
  heading.setAttribute('data-export-meaningful', 'true');
  heading.setAttribute('data-export-keep-with-next', 'true');
  return sectionEl;
}

function lines(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^(?:[-*]|\u2022|\d+\.)\s+/, ''));
}

function dateRange(start: string, end: string, present: boolean, presentLabel: string): string {
  return [start, present ? presentLabel : end].filter(Boolean).join(' - ');
}

export function createModernMinimalPdfTemplate(
  cv: CVData,
  options: ModernMinimalPdfTemplateOptions = {},
): HTMLElement {
  const L = labels(options.locale);
  const region = regionSettings[cv.region];
  const root = document.createElement('div');
  root.setAttribute('data-template-id', 'modern-minimal');
  root.setAttribute('data-modern-minimal-pdf-template', 'true');
  style(root, {
    width: '210mm',
    minWidth: '210mm',
    minHeight: '297mm',
    boxSizing: 'border-box',
    margin: '0 auto',
    padding: '24px 34px 22px',
    backgroundColor: '#ffffff',
    color: TEXT,
    fontFamily: 'Arial, Helvetica, NotoSans, NotoSansArabic, NotoSansDevanagari, NotoSansJP, sans-serif',
    fontSize: '10.8px',
    lineHeight: '1.28',
    whiteSpace: 'normal',
    // Explicit numeric values (not the 'normal' keyword) everywhere below: some
    // WebView/html2canvas combinations serialize/measure the 'normal' keyword for
    // word-spacing and letter-spacing inconsistently, which can visibly shrink or
    // collapse inter-word gaps during PDF rasterization even though the underlying
    // text nodes are correct. A small positive word-spacing also adds a safety
    // margin so spaces stay visible after html2canvas's capture scaling.
    wordSpacing: '0.6px',
    letterSpacing: '0px',
    fontKerning: 'none',
    textRendering: 'auto',
  });

  const header = append(root, 'header', {
    display: 'grid',
    gridTemplateColumns: options.photoDataUrl ? 'minmax(0, 1fr) 100px' : '1fr',
    columnGap: '18px',
    alignItems: 'start',
    paddingBottom: '10px',
    marginBottom: '11px',
    borderBottom: `2px solid ${INDIGO}`,
  });
  header.setAttribute('data-export-meaningful', 'true');

  const headerText = append(header, 'div', { minWidth: '0' });
  append(headerText, 'h1', {
    margin: '0',
    color: TEXT,
    fontSize: '22px',
    lineHeight: '1.12',
    fontWeight: '700',
  }, cv.personal.fullName || 'Your Name').setAttribute('data-export-meaningful', 'true');
  if (cv.personal.jobTitle) {
    append(headerText, 'p', {
      margin: '3px 0 0',
      color: INDIGO,
      fontSize: '12px',
      lineHeight: '1.2',
      fontWeight: '600',
      // Extra safety margin on this short, highly-visible one-line label.
      wordSpacing: '1.2px',
    }, cv.personal.jobTitle).setAttribute('data-export-meaningful', 'true');
  }
  const contacts = [cv.personal.email, cv.personal.phone, region.showAddress ? cv.personal.address : ''].filter(Boolean);
  if (contacts.length > 0) {
    const contactRow = append(headerText, 'div', {
      marginTop: '7px',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '3px 12px',
      color: MUTED,
      fontSize: '9.8px',
      lineHeight: '1.25',
    });
    contactRow.setAttribute('data-modern-minimal-contact-row', 'true');
    contacts.forEach((contact) => {
      const item = append(contactRow, 'span', { whiteSpace: 'nowrap', flexShrink: '0' }, contact);
      item.setAttribute('data-export-meaningful', 'true');
    });
  }

  if (options.photoDataUrl) {
    const frame = append(header, 'div', {
      width: '100px',
      height: '100px',
      borderRadius: '9999px',
      overflow: 'hidden',
      border: '1px solid #e5e7eb',
      boxSizing: 'border-box',
    });
    frame.setAttribute('data-modern-minimal-photo-frame', 'true');
    const img = document.createElement('img');
    img.src = options.photoDataUrl;
    img.alt = '';
    img.setAttribute('data-export-photo', 'modern-minimal');
    style(img, {
      width: '100%',
      height: '100%',
      // The photo is already canonically square + circularly cropped
      // (see cropModernMinimalPdfPhoto in export.ts, same crop math as the
      // Modern Minimal DOCX export), so no extra object-position offset is
      // needed here — the crop/zoom already matches DOCX framing.
      objectFit: 'cover',
      objectPosition: '50% 50%',
      display: 'block',
    });
    frame.appendChild(img);
  }

  if (cv.summary) {
    const sectionEl = section(root, L.summary);
    append(sectionEl, 'p', {
      margin: '0',
      color: '#374151',
      fontSize: '10.7px',
      lineHeight: '1.32',
      wordSpacing: '0.9px',
    }, cv.summary).setAttribute('data-export-meaningful', 'true');
  }

  if (cv.experience.length > 0) {
    const sectionEl = section(root, L.experience);
    cv.experience.forEach((exp) => {
      const entry = append(sectionEl, 'div', { margin: '0 0 7px', breakInside: 'avoid', pageBreakInside: 'avoid' });
      entry.setAttribute('data-export-group', 'modern-minimal-experience');
      const row = append(entry, 'div', {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 104px',
        columnGap: '12px',
        alignItems: 'baseline',
      });
      appendSafeWords(row, 'div', exp.position, { color: TEXT, fontSize: '11px', fontWeight: '700', lineHeight: '1.22', minWidth: '0', wordSpacing: '1.2px' }).setAttribute('data-export-meaningful', 'true');
      append(row, 'div', { color: '#6b7280', fontSize: '9.5px', lineHeight: '1.2', textAlign: 'right', whiteSpace: 'nowrap' }, dateRange(exp.startDate, exp.endDate, exp.isPresent, L.present)).setAttribute('data-export-meaningful', 'true');
      if (exp.company) append(entry, 'p', { margin: '1px 0 2px', color: '#6b7280', fontSize: '10px', lineHeight: '1.2', wordSpacing: '1.2px' }, exp.company).setAttribute('data-export-meaningful', 'true');
      lines(exp.description).forEach((line) => {
        const bullet = append(entry, 'div', {
          display: 'grid',
          gridTemplateColumns: '8px minmax(0, 1fr)',
          columnGap: '4px',
          color: '#374151',
          fontSize: '10.2px',
          lineHeight: '1.28',
          wordSpacing: '0.9px',
        });
        bullet.setAttribute('data-export-meaningful', 'true');
        append(bullet, 'span', undefined, '-');
        append(bullet, 'span', undefined, line);
      });
    });
  }

  if (cv.education.length > 0) {
    const sectionEl = section(root, L.education);
    cv.education.forEach((edu) => {
      const row = append(sectionEl, 'div', {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 104px',
        columnGap: '12px',
        margin: '0 0 4px',
        alignItems: 'baseline',
        breakInside: 'avoid',
        pageBreakInside: 'avoid',
      });
      row.setAttribute('data-export-group', 'modern-minimal-education');
      appendSafeWords(row, 'div', [edu.degree, edu.school].filter(Boolean).join(' / '), { color: TEXT, fontSize: '10.5px', fontWeight: '700', lineHeight: '1.22', minWidth: '0', wordSpacing: '1.2px' }).setAttribute('data-export-meaningful', 'true');
      append(row, 'div', { color: '#6b7280', fontSize: '9.5px', lineHeight: '1.2', textAlign: 'right', whiteSpace: 'nowrap' }, [edu.startDate, edu.endDate].filter(Boolean).join(' - ')).setAttribute('data-export-meaningful', 'true');
    });
  }

  const hasSkills = cv.skills.length > 0;
  const hasLanguages = cv.languages.length > 0;
  if (hasSkills || hasLanguages) {
    const grid = append(root, 'div', {
      display: 'grid',
      gridTemplateColumns: hasSkills && hasLanguages ? '1.35fr 1fr' : '1fr',
      columnGap: '18px',
      marginTop: '2px',
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
    });
    grid.setAttribute('data-export-group', 'modern-minimal-skills-languages');
    if (hasSkills) {
      const sectionEl = section(grid, L.skills);
      const skills = append(sectionEl, 'div', { display: 'flex', flexWrap: 'wrap', gap: '4px' });
      cv.skills.forEach((skill) => {
        append(skills, 'span', {
          display: 'inline-block',
          padding: '2px 6px',
          borderRadius: '9999px',
          backgroundColor: '#eef2ff',
          color: '#4338ca',
          fontSize: '9.5px',
          lineHeight: '1.2',
          whiteSpace: 'nowrap',
        }, getLocalizedCvSkillName(skill, options.locale ?? 'en')).setAttribute('data-export-meaningful', 'true');
      });
    }
    if (hasLanguages) {
      const sectionEl = section(grid, L.languages);
      cv.languages.forEach((language) => {
        append(sectionEl, 'p', {
          margin: '0 0 2px',
          color: '#374151',
          fontSize: '10.2px',
          lineHeight: '1.25',
        }, `${getLocalizedCvLanguageName(language.name, options.locale ?? 'en')} - ${language.level}`).setAttribute('data-export-meaningful', 'true');
      });
    }
  }

  if (cv.certifications.length > 0) {
    const sectionEl = section(root, L.certifications);
    cv.certifications.forEach((cert) => {
      append(sectionEl, 'p', { margin: '0 0 2px', color: '#374151', fontSize: '10.2px', lineHeight: '1.25' }, cert).setAttribute('data-export-meaningful', 'true');
    });
  }

  if (options.locale) root.setAttribute('lang', options.locale);
  return root;
}
