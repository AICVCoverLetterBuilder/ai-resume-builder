'use client';

import { getLocalizedCvLanguageName } from './cv-language-options';
import { getLocalizedCvSkillName } from './cv-skill-options';
import { translations, type Locale } from './i18n/translations';
import { regionSettings, type CVData } from './types';

type StyleMap = Partial<CSSStyleDeclaration>;

type CleanSimplePdfTemplateOptions = {
  locale?: Locale;
  photoDataUrl?: string | null;
};

const TEXT = '#111827';
const MUTED = '#6b7280';
const MUTED2 = '#4b5563';
const GREEN = '#059669';
const RULE = '#e5e7eb';

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

// Bold, single-line, highly-visible fields (experience "position at company",
// education degree) render each whitespace-separated segment as its own element
// inside a wrapping flex row with an explicit CSS `gap`. The gap between segments
// is guaranteed by real element box layout instead of a single text node's
// space-glyph width, which is what visually collapsed on Android WebView
// ("Nastavnikgeografijeat Hfh"). A real space text node is kept between segments
// (suppressed as a flex child per spec) so textContent stays natural.
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
  container.setAttribute('data-clean-simple-safe-words', 'true');
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

function sectionHeading(parent: HTMLElement, text: string, marginBottom: string): HTMLElement {
  const heading = append(parent, 'h2', {
    margin: `0 0 ${marginBottom}`,
    color: GREEN,
    fontSize: '11px',
    lineHeight: '1.2',
    fontWeight: '700',
    letterSpacing: '0.02em',
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
      append(row, 'span', { color: '#d1d5db' }, '|');
    }
    append(row, 'span', { whiteSpace: 'nowrap' }, item).setAttribute('data-export-meaningful', 'true');
  });
  return row;
}

function dateRange(start: string, end: string, present: boolean, presentLabel: string): string {
  return [start, present ? presentLabel : end].filter(Boolean).join(' - ');
}

// Detects real sentence boundaries (including a no-space "matter.Software" glued join)
// so the text-correction pass below can insert the single space that was always meant
// to be there. This never decides where the visible summary is split into blocks —
// the summary is rendered as one flowing paragraph per real user paragraph break, so
// this only ever changes text content (a missing space), never layout.
//
// Exported so export.ts's PDF pagination can reuse the *exact same* sentence-boundary
// detection to locate each sentence's rendered position (via DOM Range measurement) and
// prefer breaking the page before a sentence rather than after just its first line/word
// — without ever creating a new visible block here.
export function splitCleanSimpleSummarySentenceRuns(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (!'.!?…'.includes(char)) continue;

    let end = index + 1;
    while (end < normalized.length && '.!?…'.includes(normalized[end])) end += 1;

    const next = normalized.slice(end).match(/^\s*["'([{“‘]*[A-Z0-9À-ÖØ-ÞЀ-Я]/u);
    if (end >= normalized.length || next) {
      const sentence = normalized.slice(start, end).trim();
      if (sentence) chunks.push(sentence);
      start = end;
    }
    index = end - 1;
  }

  const tail = normalized.slice(start).trim();
  if (tail) chunks.push(tail);
  return chunks.length > 0 ? chunks : [normalized];
}

/**
 * Fixes real text-entry bugs where sentence-ending punctuation is glued directly to the
 * next sentence with no space at all (e.g. "...subject matter.Software engineer...").
 * Reuses the same sentence-boundary detection as `splitCleanSimpleSummarySentenceRuns`
 * (already proven not to fire on ordinary text) purely to repair the missing space, then
 * rejoins every sentence back into ONE continuous string — it never creates a new
 * visible paragraph or block, so the summary keeps flowing exactly like the template's
 * original single/multi-paragraph typography.
 */
function repairCleanSimpleSummarySpacing(paragraphText: string): string {
  return splitCleanSimpleSummarySentenceRuns(paragraphText).join(' ');
}

/**
 * Split summary text into real, user-authored paragraph blocks only (an explicit blank
 * line, or otherwise a single line break) — never at sentence boundaries. Each returned
 * block is rendered as exactly one flowing `<p>`, matching the template's original
 * typography; the only text change applied is `repairCleanSimpleSummarySpacing`'s
 * missing-space fix for glued sentences.
 */
export function splitCleanSimpleSummaryParagraphBlocks(summary: string): string[] {
  const trimmed = summary.trim();
  if (!trimmed) return [];

  const paragraphs = trimmed
    .split(/\n\s*\n+/)
    .map(part => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const baseBlocks = paragraphs.length > 1
    ? paragraphs
    : trimmed.split(/\n/).map(part => part.replace(/\s+/g, ' ').trim()).filter(Boolean);

  const blocks = baseBlocks.length > 0 ? baseBlocks : [trimmed.replace(/\s+/g, ' ')];
  return blocks.map(repairCleanSimpleSummarySpacing);
}

export function createCleanSimplePdfTemplate(
  cv: CVData,
  options: CleanSimplePdfTemplateOptions = {},
): HTMLElement {
  const L = labels(options.locale);
  const region = regionSettings[cv.region];
  const root = document.createElement('div');
  root.setAttribute('data-template-id', 'clean-simple');
  root.setAttribute('data-clean-simple-pdf-template', 'true');
  style(root, {
    width: '210mm',
    minWidth: '210mm',
    minHeight: '297mm',
    boxSizing: 'border-box',
    margin: '0 auto',
    padding: '26px 32px 24px',
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

  const header = append(root, 'header', {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '14px',
  });
  header.setAttribute('data-export-meaningful', 'true');

  if (options.photoDataUrl) {
    const frame = append(header, 'div', {
      flexShrink: '0',
      width: '80px',
      height: '80px',
      borderRadius: '9999px',
      overflow: 'hidden',
      border: '1px solid #e5e7eb',
      backgroundColor: '#f9fafb',
      boxSizing: 'border-box',
    });
    frame.setAttribute('data-clean-simple-photo', 'frame');
    const img = document.createElement('img');
    img.src = options.photoDataUrl;
    img.alt = '';
    img.setAttribute('data-export-photo', 'clean-simple');
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
    color: TEXT,
    fontSize: '22px',
    lineHeight: '1.15',
    fontWeight: '700',
  }, cv.personal.fullName || 'Your Name').setAttribute('data-export-meaningful', 'true');
  if (cv.personal.jobTitle) {
    append(headerText, 'p', {
      margin: '2px 0 0',
      color: GREEN,
      fontSize: '12px',
      lineHeight: '1.2',
      fontWeight: '500',
      wordSpacing: '1.2px',
    }, cv.personal.jobTitle).setAttribute('data-export-meaningful', 'true');
  }
  const contacts = [cv.personal.email, cv.personal.phone, region.showAddress ? cv.personal.address : ''].filter(Boolean);
  if (contacts.length > 0) {
    const contactRow = pipeList(headerText, contacts, { marginTop: '5px', color: MUTED, fontSize: '9.8px' });
    contactRow.setAttribute('data-clean-simple-contact-row', 'true');
  }

  append(root, 'hr', {
    border: 'none',
    borderTop: `1px solid ${RULE}`,
    margin: '0 0 14px',
  });

  if (cv.summary) {
    const sectionEl = append(root, 'section', { margin: '0 0 12px' });
    sectionEl.setAttribute('data-clean-simple-section', 'summary');
    sectionHeading(sectionEl, L.summary, '5px');
    const blocksHost = append(sectionEl, 'div', { margin: '0' });
    blocksHost.setAttribute('data-clean-simple-summary-blocks', 'true');
    // One flowing <p> per real user paragraph break — matching the template's original
    // typography exactly (no per-sentence blocks/margins). Where a paragraph is too
    // tall to fit on the remaining page, the PDF export's line-level safe-break search
    // (see `collectElegantFormalTextLineIntervalsCss` usage in export.ts) finds a real
    // rendered text-line boundary to cut at, so pagination never has to fragment this
    // paragraph into extra visible blocks to control where it may split.
    const summaryBlocks = splitCleanSimpleSummaryParagraphBlocks(cv.summary);
    summaryBlocks.forEach((blockText, index) => {
      const block = append(blocksHost, 'p', {
        margin: index > 0 ? '10px 0 0' : '0',
        color: '#374151',
        fontSize: '10.7px',
        lineHeight: '1.35',
        whiteSpace: 'pre-wrap',
        wordSpacing: '0.9px',
      }, blockText);
      block.setAttribute('data-clean-simple-summary-block', 'true');
      block.setAttribute('data-export-block', 'clean-simple-summary');
      block.setAttribute('data-export-meaningful', 'true');
    });
  }

  if (cv.experience.length > 0) {
    const sectionEl = append(root, 'section', { margin: '0 0 12px' });
    sectionEl.setAttribute('data-clean-simple-section', 'experience');
    sectionHeading(sectionEl, L.experience, '7px');
    cv.experience.forEach((exp) => {
      const entry = append(sectionEl, 'div', { margin: '0 0 8px', breakInside: 'avoid', pageBreakInside: 'avoid' });
      entry.setAttribute('data-export-group', 'clean-simple-experience');
      const row = append(entry, 'div', {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 108px',
        columnGap: '12px',
        alignItems: 'baseline',
      });
      row.setAttribute('data-clean-simple-experience-header', 'true');
      const titleText = exp.company ? `${exp.position} at ${exp.company}` : exp.position;
      appendSafeWords(row, 'div', titleText, { color: TEXT, fontSize: '10.8px', fontWeight: '600', lineHeight: '1.25', minWidth: '0' }).setAttribute('data-export-meaningful', 'true');
      append(row, 'div', { color: '#9ca3af', fontSize: '9.5px', lineHeight: '1.2', textAlign: 'right', whiteSpace: 'nowrap' }, dateRange(exp.startDate, exp.endDate, exp.isPresent, L.present)).setAttribute('data-export-meaningful', 'true');
      if (exp.description) {
        const description = append(entry, 'p', {
          margin: '3px 0 0',
          color: MUTED2,
          fontSize: '10.2px',
          lineHeight: '1.32',
          whiteSpace: 'pre-wrap',
          wordSpacing: '0.9px',
        }, exp.description);
        description.setAttribute('data-export-meaningful', 'true');
        description.setAttribute('data-clean-simple-experience-description', 'true');
      }
    });
  }

  if (cv.education.length > 0) {
    const sectionEl = append(root, 'section', { margin: '0 0 12px' });
    sectionEl.setAttribute('data-clean-simple-section', 'education');
    sectionHeading(sectionEl, L.education, '7px');
    cv.education.forEach((edu) => {
      const entry = append(sectionEl, 'div', { margin: '0 0 6px', breakInside: 'avoid', pageBreakInside: 'avoid' });
      entry.setAttribute('data-export-group', 'clean-simple-education');
      const row = append(entry, 'div', {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 108px',
        columnGap: '12px',
        alignItems: 'baseline',
      });
      row.setAttribute('data-clean-simple-education-header', 'true');
      appendSafeWords(row, 'div', edu.degree, { color: TEXT, fontSize: '10.5px', fontWeight: '600', lineHeight: '1.25', minWidth: '0' }).setAttribute('data-export-meaningful', 'true');
      append(row, 'div', { color: '#9ca3af', fontSize: '9.5px', lineHeight: '1.2', textAlign: 'right', whiteSpace: 'nowrap' }, [edu.startDate, edu.endDate].filter(Boolean).join(' - ')).setAttribute('data-export-meaningful', 'true');
      if (edu.school) {
        append(entry, 'p', { margin: '1px 0 0', color: MUTED, fontSize: '9.8px', lineHeight: '1.25' }, edu.school).setAttribute('data-export-meaningful', 'true');
      }
    });
  }

  const finalSectionsHost = (cv.skills.length > 0 || cv.languages.length > 0)
    ? append(root, 'div', { display: 'block', margin: '0', breakInside: 'avoid', pageBreakInside: 'avoid' })
    : null;
  if (finalSectionsHost) {
    finalSectionsHost.setAttribute('data-clean-simple-final-sections', 'true');
    finalSectionsHost.setAttribute('data-export-meaningful', 'true');
  }

  if (cv.skills.length > 0 && finalSectionsHost) {
    const sectionEl = append(finalSectionsHost, 'section', { margin: '0 0 12px', breakInside: 'avoid', pageBreakInside: 'avoid' });
    sectionEl.setAttribute('data-clean-simple-section', 'skills');
    sectionHeading(sectionEl, L.skills, '5px');
    const list = append(sectionEl, 'div', {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      columnGap: '8px',
      rowGap: '3px',
      color: '#374151',
      fontSize: '10.2px',
    });
    cv.skills.forEach((skill, index) => {
      if (index > 0) append(list, 'span', { color: '#d1d5db' }, '|');
      // whiteSpace: 'nowrap' guarantees a skill word can never split mid-word
      // ("Teamwor k") the way overflow-wrap/break-word can at narrow capture widths.
      const chip = append(list, 'span', { whiteSpace: 'nowrap' }, getLocalizedCvSkillName(skill, options.locale ?? 'en'));
      chip.setAttribute('data-clean-simple-skill', 'item');
      // Marks this chip as real content for measureExportMeaningfulContentBounds() so
      // the export pipeline's semantic content-bottom measurement (and the page-plan it
      // drives) can never place a page break above the last skill, and the pre-slice
      // canvas crop can never trim the canvas short of it either.
      chip.setAttribute('data-export-meaningful', 'true');
    });
  }

  if (cv.languages.length > 0 && finalSectionsHost) {
    const sectionEl = append(finalSectionsHost, 'section', { margin: '0 0 12px', breakInside: 'avoid', pageBreakInside: 'avoid' });
    sectionEl.setAttribute('data-clean-simple-section', 'languages');
    sectionHeading(sectionEl, L.languages, '5px');
    const list = append(sectionEl, 'div', {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      columnGap: '8px',
      rowGap: '3px',
      color: '#374151',
      fontSize: '10.2px',
    });
    cv.languages.forEach((language, index) => {
      if (index > 0) append(list, 'span', { color: '#d1d5db' }, '|');
      // Same data-export-meaningful marker as skill chips above — without it, Languages
      // was the very last thing in the document with no meaningful-content marker below
      // its own heading, so the semantic content-bottom measurement stopped at the
      // heading and treated everything below (the actual language rows) as trimmable.
      append(list, 'span', { whiteSpace: 'nowrap' }, `${getLocalizedCvLanguageName(language.name, options.locale ?? 'en')} (${language.level})`)
        .setAttribute('data-export-meaningful', 'true');
    });
  }

  if (cv.certifications.length > 0) {
    const sectionEl = append(root, 'section', { margin: '0 0 12px', breakInside: 'avoid', pageBreakInside: 'avoid' });
    sectionEl.setAttribute('data-clean-simple-section', 'certifications');
    sectionHeading(sectionEl, L.certifications, '5px');
    cv.certifications.forEach((cert) => {
      append(sectionEl, 'p', { margin: '0 0 2px', color: '#374151', fontSize: '10.2px', lineHeight: '1.25' }, cert).setAttribute('data-export-meaningful', 'true');
    });
  }

  if (options.locale) root.setAttribute('lang', options.locale);
  return root;
}
