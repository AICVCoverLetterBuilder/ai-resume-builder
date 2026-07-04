'use client';

import { getLocalizedCvLanguageName } from './cv-language-options';
import { translations, type Locale } from './i18n/translations';
import { regionSettings, type CVData } from './types';

type StyleMap = Partial<CSSStyleDeclaration>;

type CreativeArtisticPdfTemplateOptions = {
  locale?: Locale;
  photoDataUrl?: string | null;
};

const GRADIENT = 'linear-gradient(90deg, #7c3aed 0%, #c026d3 100%)';
const HEADER_BG = '#7c3aed';
const TITLE_LIGHT = '#ddd6fe';
const CONTACT_LIGHT = '#f5d0fe';
const TEXT = '#111827';
const HEADING = '#7c3aed';
const MUTED = '#6b7280';
const MUTED2 = '#4b5563';
const ACCENT = '#8b5cf6';
const BORDER_ACCENT = '#ddd6fe';
const CHIP_BG = '#f5f3ff';
const CHIP_TEXT = '#6d28d9';

function style(element: HTMLElement, styles: StyleMap): void {
  Object.entries(styles).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      (element.style as unknown as Record<string, string>)[key] = String(value);
    }
  });
}

function append(parent: HTMLElement, tag: string, styles?: StyleMap, text?: string): HTMLElement {
  const element = document.createElement(tag);
  if (styles) style(element, styles);
  if (text !== undefined) element.textContent = text;
  parent.appendChild(element);
  return element;
}

// Bold, single-line, highly-visible fields (experience position, education degree)
// render each whitespace-separated segment as its own element inside a wrapping flex
// row with an explicit CSS gap, so the inter-word gap is guaranteed by real element
// box layout instead of a single text node's space-glyph width — the same technique
// already validated for Modern Minimal, Clean Simple, and Professional Classic to
// prevent joined Serbian words ("Nastavnikgeografije") in html2canvas captures.
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
  return container;
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
    fathersName: t.cv.fathersName,
  };
}

// Violet heading, no underline/border — matches the live template's
// `text-violet-600 font-bold` section headings exactly (no uppercase, no rule).
function sectionHeading(parent: HTMLElement, text: string): HTMLElement {
  const heading = append(parent, 'h2', {
    margin: '0 0 7px',
    color: HEADING,
    fontSize: '13px',
    lineHeight: '1.2',
    fontWeight: '700',
  }, text);
  heading.setAttribute('data-export-meaningful', 'true');
  heading.setAttribute('data-export-keep-with-next', 'true');
  return heading;
}

function dateRange(start: string, end: string, present: boolean, presentLabel: string): string {
  return [start, present ? presentLabel : end].filter(Boolean).join(' - ');
}

export function createCreativeArtisticPdfTemplate(
  cv: CVData,
  options: CreativeArtisticPdfTemplateOptions = {},
): HTMLElement {
  const L = labels(options.locale);
  const region = regionSettings[cv.region];
  const root = document.createElement('div');
  root.setAttribute('data-template-id', 'creative-artistic');
  root.setAttribute('data-creative-artistic-pdf-template', 'true');
  style(root, {
    width: '210mm',
    minWidth: '210mm',
    minHeight: '297mm',
    boxSizing: 'border-box',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    color: TEXT,
    fontFamily: 'Arial, Helvetica, NotoSans, NotoSansArabic, NotoSansDevanagari, NotoSansJP, sans-serif',
    fontSize: '10.8px',
    lineHeight: '1.34',
    whiteSpace: 'normal',
    wordSpacing: '0.6px',
    letterSpacing: '0px',
    fontKerning: 'none',
    textRendering: 'auto',
  });

  // ── Header: full-bleed purple/fuchsia gradient, circular photo + name/title/contacts ──
  const header = append(root, 'header', {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    background: GRADIENT,
    backgroundColor: HEADER_BG,
    color: '#ffffff',
    padding: '24px 28px',
    boxSizing: 'border-box',
  });
  header.setAttribute('data-export-meaningful', 'true');

  if (options.photoDataUrl) {
    const frame = append(header, 'div', {
      flexShrink: '0',
      width: '88px',
      height: '88px',
      borderRadius: '9999px',
      overflow: 'hidden',
      border: '2px solid rgba(255, 255, 255, 0.4)',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      boxSizing: 'border-box',
    });
    frame.setAttribute('data-creative-artistic-photo', 'frame');
    const img = document.createElement('img');
    img.src = options.photoDataUrl;
    img.alt = '';
    img.setAttribute('data-export-photo', 'creative-artistic');
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
      fontSize: '12.5px',
      lineHeight: '1.25',
      wordSpacing: '1px',
    }, cv.personal.jobTitle).setAttribute('data-export-meaningful', 'true');
  }
  const contacts = [cv.personal.email, cv.personal.phone, region.showAddress ? cv.personal.address : ''].filter(Boolean);
  if (contacts.length > 0) {
    const contactRow = append(headerText, 'div', {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      marginTop: '8px',
      color: TITLE_LIGHT,
      fontSize: '9.6px',
    });
    contactRow.setAttribute('data-export-contact-row', 'creative-artistic');
    contacts.forEach((item, index) => {
      const wrap = append(contactRow, 'span', {
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        flexShrink: '0',
        wordBreak: 'keep-all',
        overflowWrap: 'normal',
      });
      wrap.setAttribute('data-export-contact-item', 'true');
      if (index > 0) {
        append(wrap, 'span', { color: CONTACT_LIGHT, marginRight: '10px', whiteSpace: 'nowrap', flexShrink: '0' }, '\u2022').setAttribute('data-export-contact-separator', 'true');
      }
      append(wrap, 'span', { display: 'inline-block', whiteSpace: 'nowrap', flexShrink: '0', wordBreak: 'keep-all', overflowWrap: 'normal', marginLeft: index > 0 ? '10px' : '0' }, item as string);
      wrap.setAttribute('data-export-meaningful', 'true');
    });
  }
  if (cv.personal.fathersName) {
    append(headerText, 'p', { margin: '5px 0 0', color: TITLE_LIGHT, fontSize: '9.6px' }, `${L.fathersName}: ${cv.personal.fathersName}`).setAttribute('data-export-meaningful', 'true');
  }

  // ── Body ─────────────────────────────────────────────────────────────────
  const body = append(root, 'div', { padding: '22px 28px 26px', boxSizing: 'border-box', backgroundColor: '#ffffff' });

  if (cv.summary) {
    append(body, 'p', {
      margin: '0 0 14px',
      color: MUTED2,
      fontSize: '10.8px',
      lineHeight: '1.4',
      whiteSpace: 'pre-wrap',
      wordSpacing: '0.9px',
    }, cv.summary).setAttribute('data-export-meaningful', 'true');
  }

  if (cv.experience.length > 0) {
    const sectionEl = append(body, 'section', { margin: '0 0 14px' });
    sectionHeading(sectionEl, L.experience);
    cv.experience.forEach((exp) => {
      // The entire entry (title + meta + description lines) shares a single
      // left purple border accent, matching the live preview's
      // `border-l-2 border-violet-200` wrapper. Each description line is its
      // own paragraph (not one `white-space: pre-line` block) so multi-line
      // bullets stay visually separated instead of collapsing into a single
      // dense paragraph-like block during PDF capture.
      const entry = append(sectionEl, 'div', {
        margin: '0 0 10px',
        paddingLeft: '14px',
        borderLeft: `2px solid ${BORDER_ACCENT}`,
        boxSizing: 'border-box',
        breakInside: 'avoid',
        pageBreakInside: 'avoid',
      });
      entry.setAttribute('data-export-group', 'creative-artistic-experience');
      appendSafeWords(entry, 'h3', exp.position, { color: TEXT, fontSize: '11px', fontWeight: '600', lineHeight: '1.25', margin: '0' }).setAttribute('data-export-meaningful', 'true');
      const metaLine = [exp.company, dateRange(exp.startDate, exp.endDate, exp.isPresent, L.present)].filter(Boolean).join(' | ');
      if (metaLine) {
        append(entry, 'p', { margin: '2px 0 0', color: ACCENT, fontSize: '9.6px', lineHeight: '1.25' }, metaLine).setAttribute('data-export-meaningful', 'true');
      }
      if (exp.description) {
        exp.description.split('\n').forEach((rawLine) => {
          const line = rawLine.trim();
          if (!line) return;
          append(entry, 'p', {
            margin: '4px 0 0',
            color: MUTED2,
            fontSize: '10.1px',
            lineHeight: '1.32',
            wordSpacing: '0.9px',
          }, line).setAttribute('data-export-meaningful', 'true');
        });
      }
    });
  }

  if (cv.education.length > 0) {
    const sectionEl = append(body, 'section', { margin: '0 0 14px' });
    sectionEl.setAttribute('data-export-group', 'education-section');
    sectionHeading(sectionEl, L.education);
    cv.education.forEach((edu) => {
      const entry = append(sectionEl, 'div', { margin: '0 0 6px', breakInside: 'avoid', pageBreakInside: 'avoid' });
      entry.setAttribute('data-export-group', 'education-entry');
      appendSafeWords(entry, 'h3', edu.degree, { color: TEXT, fontSize: '10.6px', fontWeight: '600', lineHeight: '1.25', margin: '0' }).setAttribute('data-export-meaningful', 'true');
      const eduDates = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');
      const metaLine = [edu.school, eduDates].filter(Boolean).join(' | ');
      if (metaLine) {
        append(entry, 'p', { margin: '2px 0 0', color: MUTED, fontSize: '9.6px', lineHeight: '1.25' }, metaLine).setAttribute('data-export-meaningful', 'true');
      }
    });
  }

  // ── Skills + Languages: side-by-side 2-column, matching the live grid-cols-2 ──
  const hasSkills = cv.skills.length > 0;
  const hasLangs = cv.languages.length > 0;
  if (hasSkills || hasLangs) {
    const block = append(body, 'div', {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      columnGap: '24px',
      margin: '0 0 14px',
    });
    block.setAttribute('data-export-group', 'skills-block');

    if (hasSkills) {
      const skillsCol = append(block, 'section', { minWidth: '0' });
      skillsCol.setAttribute('data-export-group', 'skills-section');
      sectionHeading(skillsCol, L.skills);
      const list = append(skillsCol, 'div', {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '4px',
      });
      list.setAttribute('data-export-group', 'skills-row');
      // Render cv.skills completely verbatim — same array, same order, same
      // labels as the DOCX export and the live preview. No canonicalization,
      // localization, or dedup lookup is applied here on purpose: running a
      // skill label through the shared skill-alias resolver can silently
      // coerce one label into a different one (see professional-classic's
      // fix for the "Mentoring" → duplicate "Coaching" regression). Keeping
      // this verbatim guarantees PDF and DOCX always show the exact same
      // skill labels, order, and duplicates from the same source.
      cv.skills.forEach((skill) => {
        const chip = append(list, 'span', {
          display: 'inline-flex',
          alignItems: 'center',
          flexShrink: '0',
          width: 'max-content',
          maxWidth: '100%',
          whiteSpace: 'nowrap',
          wordBreak: 'keep-all',
          overflowWrap: 'normal',
          borderRadius: '9999px',
          backgroundColor: CHIP_BG,
          color: CHIP_TEXT,
          padding: '2px 8px',
          fontSize: '9.6px',
          lineHeight: '1.4',
        }, skill);
        chip.setAttribute('data-export-skill-chip', 'true');
        chip.setAttribute('data-export-meaningful', 'true');
      });
    }

    if (hasLangs) {
      const langsCol = append(block, 'section', { minWidth: '0' });
      langsCol.setAttribute('data-export-group', 'languages-section');
      sectionHeading(langsCol, L.languages);
      cv.languages.forEach((language) => {
        append(langsCol, 'p', { margin: '0 0 4px', color: TEXT, fontSize: '10px', lineHeight: '1.3' }, `${getLocalizedCvLanguageName(language.name, options.locale ?? 'en')} - ${language.level}`).setAttribute('data-export-meaningful', 'true');
      });
    }
  }

  if (cv.certifications.length > 0) {
    const sectionEl = append(body, 'section', { margin: '0', breakInside: 'avoid', pageBreakInside: 'avoid' });
    sectionHeading(sectionEl, L.certifications);
    cv.certifications.forEach((cert) => {
      const p = append(sectionEl, 'p', { margin: '0 0 4px', color: MUTED2, fontSize: '10.1px', lineHeight: '1.3' });
      p.setAttribute('data-export-meaningful', 'true');
      append(p, 'span', {}, cert);
    });
  }

  if (options.locale) root.setAttribute('lang', options.locale);
  return root;
}
