'use client';

import { getLocalizedCvLanguageName } from './cv-language-options';
import { translations, type Locale } from './i18n/translations';
import { regionSettings, type CVData } from './types';

type StyleMap = Partial<CSSStyleDeclaration>;

type ProfessionalClassicPdfTemplateOptions = {
  locale?: Locale;
  photoDataUrl?: string | null;
};

const DARK = '#1f2937';
const TITLE_LIGHT = '#cbd5e1';
const CONTACT_LIGHT = '#94a3b8';
const TEXT = '#111827';
const HEADING = '#1e293b';
const RULE = '#e2e8f0';
const MUTED = '#6b7280';
const MUTED2 = '#4b5563';
const CHIP_BG = '#f1f5f9';
const CHIP_TEXT = '#374151';

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

// Bold, single-line, highly-visible fields (experience position, education degree)
// render each whitespace-separated segment as its own element inside a wrapping flex
// row with an explicit CSS gap, so the inter-word gap is guaranteed by real element
// box layout instead of a single text node's space-glyph width — the same technique
// already validated for Modern Minimal and Clean Simple to prevent joined Serbian
// words ("Nastavnikgeografije") in html2canvas/Android WebView captures.
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
  container.setAttribute('data-professional-classic-safe-words', 'true');
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

function sectionHeading(parent: HTMLElement, text: string): HTMLElement {
  const heading = append(parent, 'h2', {
    margin: '0 0 6px',
    padding: '0 0 4px',
    color: HEADING,
    fontSize: '12px',
    lineHeight: '1.2',
    fontWeight: '700',
    borderBottom: `1px solid ${RULE}`,
  }, text.toUpperCase());
  heading.setAttribute('data-export-meaningful', 'true');
  heading.setAttribute('data-export-keep-with-next', 'true');
  return heading;
}

function pipeList(parent: HTMLElement, items: string[], styles: StyleMap): HTMLElement {
  const row = append(parent, 'div', {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: '8px',
    rowGap: '3px',
    ...styles,
  });
  items.forEach((item, index) => {
    if (index > 0) {
      append(row, 'span', { color: CONTACT_LIGHT }, '|');
    }
    append(row, 'span', { whiteSpace: 'nowrap', wordBreak: 'keep-all' }, item).setAttribute('data-export-meaningful', 'true');
  });
  return row;
}

function dateRange(start: string, end: string, present: boolean, presentLabel: string): string {
  return [start, present ? presentLabel : end].filter(Boolean).join(' - ');
}

export function createProfessionalClassicPdfTemplate(
  cv: CVData,
  options: ProfessionalClassicPdfTemplateOptions = {},
): HTMLElement {
  const L = labels(options.locale);
  const region = regionSettings[cv.region];
  const root = document.createElement('div');
  root.setAttribute('data-template-id', 'professional-classic');
  root.setAttribute('data-professional-classic-pdf-template', 'true');
  style(root, {
    width: '210mm',
    minWidth: '210mm',
    minHeight: '297mm',
    boxSizing: 'border-box',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    color: TEXT,
    fontFamily: 'Inter, Arial, Helvetica, NotoSans, NotoSansArabic, NotoSansDevanagari, NotoSansJP, sans-serif',
    fontSize: '10.8px',
    lineHeight: '1.32',
    whiteSpace: 'normal',
    // Explicit numeric values (never the 'normal' keyword — some WebView/html2canvas
    // combinations serialize/measure it inconsistently and can visibly collapse
    // inter-word gaps during PDF rasterization).
    wordSpacing: '0.6px',
    letterSpacing: '0px',
    fontKerning: 'none',
    textRendering: 'auto',
  });

  // ── Header: full-bleed dark navy band, circular photo + name/title/contacts ──
  const header = append(root, 'header', {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    backgroundColor: DARK,
    color: '#ffffff',
    padding: '26px 32px',
    boxSizing: 'border-box',
  });
  header.setAttribute('data-professional-classic-header', 'true');
  header.setAttribute('data-export-meaningful', 'true');

  if (options.photoDataUrl) {
    const frame = append(header, 'div', {
      flexShrink: '0',
      width: '90px',
      height: '90px',
      borderRadius: '9999px',
      overflow: 'hidden',
      border: '2px solid #475569',
      backgroundColor: '#334155',
      boxSizing: 'border-box',
    });
    frame.setAttribute('data-professional-classic-photo', 'frame');
    const img = document.createElement('img');
    img.src = options.photoDataUrl;
    img.alt = '';
    img.setAttribute('data-export-photo', 'professional-classic');
    style(img, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: '50% 50%',
      display: 'block',
    });
    frame.appendChild(img);
  }

  const headerText = append(header, 'div', { minWidth: '0', flex: '1 1 auto' });
  append(headerText, 'h1', {
    margin: '0',
    color: '#ffffff',
    fontSize: '22px',
    lineHeight: '1.2',
    fontWeight: '700',
  }, cv.personal.fullName || 'Your Name').setAttribute('data-export-meaningful', 'true');
  if (cv.personal.jobTitle) {
    append(headerText, 'p', {
      margin: '3px 0 0',
      color: TITLE_LIGHT,
      fontSize: '12px',
      lineHeight: '1.2',
      wordSpacing: '1.2px',
    }, cv.personal.jobTitle).setAttribute('data-export-meaningful', 'true');
  }
  const contacts = [cv.personal.email, cv.personal.phone, region.showAddress ? cv.personal.address : ''].filter(Boolean);
  if (contacts.length > 0) {
    const contactRow = pipeList(headerText, contacts, { marginTop: '6px', color: CONTACT_LIGHT, fontSize: '9.6px' });
    contactRow.setAttribute('data-professional-classic-contact-row', 'true');
  }
  if (cv.personal.fathersName) {
    append(headerText, 'p', { margin: '4px 0 0', color: CONTACT_LIGHT, fontSize: '9.6px' }, `${translations[options.locale ?? 'en']?.cv.fathersName ?? translations.en.cv.fathersName}: ${cv.personal.fathersName}`);
  }

  // ── Body ─────────────────────────────────────────────────────────────────
  const body = append(root, 'div', { padding: '18px 32px 26px', boxSizing: 'border-box' });

  if (cv.summary) {
    const sectionEl = append(body, 'section', { margin: '0 0 14px', breakInside: 'avoid', pageBreakInside: 'avoid' });
    sectionEl.setAttribute('data-professional-classic-section', 'summary');
    sectionHeading(sectionEl, L.summary);
    append(sectionEl, 'p', {
      margin: '0',
      color: CHIP_TEXT,
      fontSize: '10.6px',
      lineHeight: '1.35',
      whiteSpace: 'pre-wrap',
      wordSpacing: '0.9px',
    }, cv.summary).setAttribute('data-export-meaningful', 'true');
  }

  if (cv.experience.length > 0) {
    const sectionEl = append(body, 'section', { margin: '0 0 14px' });
    sectionEl.setAttribute('data-professional-classic-section', 'experience');
    sectionHeading(sectionEl, L.experience);
    cv.experience.forEach((exp) => {
      const entry = append(sectionEl, 'div', { margin: '0 0 10px', breakInside: 'avoid', pageBreakInside: 'avoid' });
      entry.setAttribute('data-export-group', 'professional-classic-experience');
      const row = append(entry, 'div', {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 108px',
        columnGap: '12px',
        alignItems: 'baseline',
      });
      appendSafeWords(row, 'div', exp.position, { color: TEXT, fontSize: '10.8px', fontWeight: '600', lineHeight: '1.25', minWidth: '0' }).setAttribute('data-export-meaningful', 'true');
      append(row, 'div', { color: '#9ca3af', fontSize: '9.4px', lineHeight: '1.2', textAlign: 'right', whiteSpace: 'nowrap', fontStyle: 'italic' }, dateRange(exp.startDate, exp.endDate, exp.isPresent, L.present)).setAttribute('data-export-meaningful', 'true');
      if (exp.company) {
        append(entry, 'p', { margin: '1px 0 0', color: MUTED, fontSize: '10px', lineHeight: '1.25' }, exp.company).setAttribute('data-export-meaningful', 'true');
      }
      if (exp.description) {
        exp.description.split('\n').forEach((rawLine) => {
          const line = rawLine.trim();
          if (!line) return;
          const bulletText = line.replace(/^(?:[-*]|\u2022|\d+\.)\s+/, '');
          const isBullet = bulletText !== line;
          const p = append(entry, 'p', {
            margin: '3px 0 0',
            color: MUTED2,
            fontSize: '10.1px',
            lineHeight: '1.32',
            wordSpacing: '0.9px',
          });
          if (isBullet) append(p, 'span', { color: '#475569' }, '\u2022 ');
          append(p, 'span', {}, bulletText);
        });
      }
    });
  }

  if (cv.education.length > 0) {
    const sectionEl = append(body, 'section', { margin: '0 0 14px' });
    sectionEl.setAttribute('data-professional-classic-section', 'education');
    sectionHeading(sectionEl, L.education);
    cv.education.forEach((edu) => {
      const entry = append(sectionEl, 'div', { margin: '0 0 6px', breakInside: 'avoid', pageBreakInside: 'avoid' });
      entry.setAttribute('data-export-group', 'professional-classic-education');
      const row = append(entry, 'div', {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 108px',
        columnGap: '12px',
        alignItems: 'baseline',
      });
      appendSafeWords(row, 'div', edu.degree, { color: TEXT, fontSize: '10.5px', fontWeight: '600', lineHeight: '1.25', minWidth: '0' }).setAttribute('data-export-meaningful', 'true');
      const eduDates = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');
      append(row, 'div', { color: '#9ca3af', fontSize: '9.4px', lineHeight: '1.2', textAlign: 'right', whiteSpace: 'nowrap' }, eduDates).setAttribute('data-export-meaningful', 'true');
      if (edu.school) {
        append(entry, 'p', { margin: '1px 0 0', color: MUTED, fontSize: '9.8px', lineHeight: '1.25' }, edu.school).setAttribute('data-export-meaningful', 'true');
      }
      if (edu.description) {
        append(entry, 'p', { margin: '2px 0 0', color: CHIP_TEXT, fontSize: '10.1px', lineHeight: '1.32' }, edu.description).setAttribute('data-export-meaningful', 'true');
      }
    });
  }

  // ── Skills + Languages: side-by-side 2-column, matching the live grid-cols-2 ──
  const hasSkills = cv.skills.length > 0;
  const hasLangs = cv.languages.length > 0;
  if (hasSkills || hasLangs) {
    const grid = append(body, 'div', {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      columnGap: '24px',
      margin: '0 0 14px',
    });

    if (hasSkills) {
      const skillsCol = append(grid, 'section', { minWidth: '0' });
      skillsCol.setAttribute('data-professional-classic-section', 'skills');
      sectionHeading(skillsCol, L.skills);
      const list = append(skillsCol, 'div', {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '4px',
      });
      // Render cv.skills completely verbatim — same array, same order, same
      // labels as the DOCX export and the live preview. No canonicalization,
      // localization, or dedup lookup is applied here on purpose: running a
      // skill label through the shared skill-alias resolver can silently
      // coerce an unrelated label into a different one (e.g. a literal
      // "Mentoring" skill is listed as a search alias of "Coaching" in
      // cv-skill-options.ts and would resolve to "Coaching" if looked up),
      // which previously caused the PDF to show duplicate "Coaching" instead
      // of "Coaching" + "Mentoring". Keeping this verbatim guarantees PDF and
      // DOCX always show the exact same skill labels from the same source.
      cv.skills.forEach((skill) => {
        append(list, 'span', {
          backgroundColor: CHIP_BG,
          color: CHIP_TEXT,
          fontSize: '9.6px',
          lineHeight: '1.3',
          padding: '2px 7px',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
        }, skill).setAttribute('data-professional-classic-skill', 'item');
      });
    }

    if (hasLangs) {
      const langsCol = append(grid, 'section', { minWidth: '0' });
      langsCol.setAttribute('data-professional-classic-section', 'languages');
      sectionHeading(langsCol, L.languages);
      cv.languages.forEach((language) => {
        append(langsCol, 'p', { margin: '0 0 3px', color: CHIP_TEXT, fontSize: '10.2px', lineHeight: '1.3' }, `${getLocalizedCvLanguageName(language.name, options.locale ?? 'en')} - ${language.level}`).setAttribute('data-export-meaningful', 'true');
      });
    }
  }

  if (cv.certifications.length > 0) {
    const sectionEl = append(body, 'section', { margin: '0', breakInside: 'avoid', pageBreakInside: 'avoid' });
    sectionEl.setAttribute('data-professional-classic-section', 'certifications');
    sectionHeading(sectionEl, L.certifications);
    cv.certifications.forEach((cert) => {
      const p = append(sectionEl, 'p', { margin: '0 0 3px', color: CHIP_TEXT, fontSize: '10.1px', lineHeight: '1.3' });
      append(p, 'span', { color: '#475569' }, '\u2022 ');
      append(p, 'span', {}, cert);
      p.setAttribute('data-export-meaningful', 'true');
    });
  }

  if (options.locale) root.setAttribute('lang', options.locale);
  return root;
}
