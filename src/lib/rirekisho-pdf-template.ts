'use client';

import type { Locale } from './i18n/translations';
import { type CVData } from './types';

type StyleMap = Partial<CSSStyleDeclaration>;

type RirekishoPdfTemplateOptions = {
  locale?: Locale;
  photoDataUrl?: string | null;
};

const TEXT = '#111827';
const MUTED = '#4b5563';
const BORDER = '#d1d5db';
const HEADER_BG = '#f3f4f6';
const RIREKISHO_SECTION_BAR_HEIGHT_PX = '28px';
const RIREKISHO_SECTION_BAR_LABEL_NUDGE_PX = '-1px';

function applyStyle(element: HTMLElement, styles: StyleMap): void {
  Object.entries(styles).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      (element.style as unknown as Record<string, string>)[key] = String(value);
    }
  });
}

function appendExportText(element: HTMLElement, text: string): void {
  text.split(/(\n| +)/).forEach((part) => {
    if (!part) return;
    if (part === '\n') {
      element.appendChild(document.createElement('br'));
      return;
    }
    const span = document.createElement('span');
    span.textContent = part;
    if (/^ +$/.test(part)) {
      span.setAttribute('data-rirekisho-export-space', 'true');
      span.style.display = 'inline-block';
      span.style.width = `${part.length * 0.82}em`;
      span.style.minWidth = `${part.length * 0.82}em`;
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

function descriptionLines(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^(?:[-*]|\u2022|\u30fb|\d+\.)\s*/, ''));
}

function dateRange(start?: string, end?: string, present?: boolean): string {
  if (!start && !end && !present) return '';
  return `${start ?? ''}${start ? '〜' : ''}${present ? '現在' : end ?? ''}`;
}

function cell(
  row: HTMLTableRowElement,
  text: string,
  styles?: StyleMap,
  tagName: 'td' | 'th' = 'td',
): HTMLElement {
  const el = document.createElement(tagName);
  applyStyle(el, {
    border: `1px solid ${BORDER}`,
    padding: '5px 7px',
    verticalAlign: 'top',
    color: TEXT,
    fontSize: '10.5px',
    lineHeight: '1.34',
    boxSizing: 'border-box',
    overflowWrap: 'break-word',
    wordBreak: 'normal',
    whiteSpace: 'normal',
    ...styles,
  });
  appendExportText(el, text);
  row.appendChild(el);
  return el;
}

function labelCell(row: HTMLTableRowElement, label: string, width = '22%'): HTMLElement {
  return cell(row, label, {
    width,
    backgroundColor: HEADER_BG,
    fontWeight: '700',
    color: '#374151',
    whiteSpace: 'nowrap',
  }, 'th');
}

function table(parent: HTMLElement, styles?: StyleMap): HTMLTableElement {
  const tableEl = document.createElement('table');
  applyStyle(tableEl, {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    margin: '0',
    ...styles,
  });
  parent.appendChild(tableEl);
  return tableEl;
}

function section(
  parent: HTMLElement,
  title: string,
  options: { kind?: string; allowBreakInside?: boolean } = {},
): HTMLElement {
  const sectionEl = append(parent, 'section', {
    margin: '0 0 10px',
    padding: '0',
    ...(options.allowBreakInside ? {} : { breakInside: 'avoid', pageBreakInside: 'avoid' }),
  });
  sectionEl.setAttribute('data-export-group', 'rirekisho-section');
  if (options.kind) sectionEl.setAttribute('data-rirekisho-section-kind', options.kind);

  const heading = append(sectionEl, 'h2', {
    margin: '0 0 4px',
    padding: '0 8px',
    height: RIREKISHO_SECTION_BAR_HEIGHT_PX,
    minHeight: RIREKISHO_SECTION_BAR_HEIGHT_PX,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#1f2937',
    color: '#ffffff',
    boxSizing: 'border-box',
    overflow: 'visible',
  });
  const label = document.createElement('span');
  label.setAttribute('data-rirekisho-section-bar-label', 'true');
  applyStyle(label, {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '12px',
    lineHeight: '1',
    fontWeight: '700',
    letterSpacing: '0.12em',
    color: '#ffffff',
    transform: `translateY(${RIREKISHO_SECTION_BAR_LABEL_NUDGE_PX})`,
    overflow: 'visible',
    whiteSpace: 'nowrap',
  });
  appendExportText(label, title);
  heading.appendChild(label);
  heading.setAttribute('data-export-meaningful', 'true');
  return sectionEl;
}

function renderHeader(root: HTMLElement, cv: CVData, photoDataUrl?: string | null): void {
  const header = append(root, 'header', {
    margin: '0 0 12px',
    padding: '0 0 8px',
    borderBottom: '2px solid #111827',
    textAlign: 'center',
  });
  header.setAttribute('data-export-meaningful', 'true');
  header.setAttribute('data-rirekisho-pdf-header', 'true');

  append(header, 'h1', {
    margin: '0',
    color: TEXT,
    fontSize: '24px',
    lineHeight: '1.22',
    fontWeight: '700',
    letterSpacing: '0.32em',
  }, '履　歴　書').setAttribute('data-export-meaningful', 'true');

  append(header, 'p', {
    margin: '2px 0 0',
    color: MUTED,
    fontSize: '10px',
    lineHeight: '1.2',
  }, '(Curriculum Vitae)');

  const top = append(root, 'div', {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 102px',
    gap: '14px',
    alignItems: 'start',
    margin: '0 0 10px',
  });
  top.setAttribute('data-export-meaningful', 'true');

  const personal = table(top);
  let row = personal.insertRow();
  labelCell(row, '氏名 / Full Name');
  cell(row, cv.personal.fullName || '', { fontSize: '14px', fontWeight: '700' });

  row = personal.insertRow();
  labelCell(row, '生年月日');
  cell(row, cv.personal.dateOfBirth || '');
  labelCell(row, '性別', '16%');
  cell(row, cv.personal.gender || '', { width: '16%' });

  row = personal.insertRow();
  labelCell(row, '住所');
  cell(row, cv.personal.address || '', { fontSize: '10px' });

  row = personal.insertRow();
  labelCell(row, '電話番号');
  cell(row, cv.personal.phone || '', { fontSize: '9.6px', whiteSpace: 'nowrap' });
  labelCell(row, 'メール', '16%');
  cell(row, cv.personal.email || '', { width: '28%', fontSize: '9.2px', overflowWrap: 'anywhere' });

  const frame = append(top, 'div', {
    width: '90px',
    minWidth: '90px',
    maxWidth: '90px',
    height: '120px',
    minHeight: '120px',
    maxHeight: '120px',
    border: `1px solid ${BORDER}`,
    borderRadius: '3px',
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    justifySelf: 'end',
    boxSizing: 'border-box',
    flexShrink: '0',
    lineHeight: '0',
  });
  frame.setAttribute('data-rirekisho-photo-box', 'true');
  frame.setAttribute('data-export-photo-frame', 'rirekisho');

  if (photoDataUrl) {
    const img = document.createElement('img');
    img.src = photoDataUrl;
    img.alt = '';
    img.setAttribute('data-export-photo', 'rirekisho');
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
  } else {
    const placeholder = append(frame, 'div', {
      color: '#9ca3af',
      fontSize: '10px',
      lineHeight: '1.2',
      textAlign: 'center',
    }, '写真\n3×4cm');
    placeholder.style.whiteSpace = 'pre-line';
  }
}

function renderEducation(parent: HTMLElement, cv: CVData): void {
  if (cv.education.length === 0) return;
  const sectionEl = section(parent, '学　歴', { kind: 'education' });
  const education = table(sectionEl);
  const header = education.insertRow();
  labelCell(header, '期間', '24%');
  labelCell(header, '学校名・学部・学科', '76%');

  cv.education.forEach((edu) => {
    const row = education.insertRow();
    cell(row, dateRange(edu.startDate, edu.endDate), { width: '24%', color: MUTED, whiteSpace: 'nowrap' });
    const detail = [edu.school, edu.degree].filter(Boolean).join('　');
    cell(row, edu.description ? `${detail}\n${edu.description}` : detail, { width: '76%', whiteSpace: 'pre-line' });
    row.setAttribute('data-export-meaningful', 'true');
  });
}

function renderExperience(parent: HTMLElement, cv: CVData): void {
  if (cv.experience.length === 0) return;
  const sectionEl = section(parent, '職　歴', { kind: 'experience' });
  const experience = table(sectionEl);
  const header = experience.insertRow();
  labelCell(header, '期間', '23%');
  labelCell(header, '会社名・職位・職務内容', '77%');

  cv.experience.forEach((exp) => {
    const row = experience.insertRow();
    row.setAttribute('data-export-meaningful', 'true');
    cell(row, dateRange(exp.startDate, exp.endDate, exp.isPresent), { width: '23%', color: MUTED, whiteSpace: 'nowrap' });
    const detailCell = cell(row, '', { width: '77%', padding: '5px 7px' });
    append(detailCell, 'div', { fontWeight: '700', margin: '0 0 2px' }, exp.company);
    if (exp.position) append(detailCell, 'div', { color: '#374151', margin: '0 0 3px' }, exp.position);
    descriptionLines(exp.description).forEach((line) => {
      const bullet = append(detailCell, 'div', {
        display: 'grid',
        gridTemplateColumns: '10px minmax(0, 1fr)',
        columnGap: '3px',
        margin: '0 0 2px',
        color: MUTED,
        fontSize: '9.8px',
        lineHeight: '1.32',
      });
      bullet.setAttribute('data-rirekisho-bullet-row', 'true');
      bullet.setAttribute('data-export-meaningful', 'true');
      append(bullet, 'span', undefined, '・');
      append(bullet, 'span', undefined, line);
    });
  });
}

function renderSkills(parent: HTMLElement, cv: CVData): void {
  if (cv.skills.length === 0) return;
  const sectionEl = section(parent, 'スキル', { kind: 'skills' });
  const skills = table(sectionEl);
  for (let index = 0; index < cv.skills.length; index += 3) {
    const row = skills.insertRow();
    row.setAttribute('data-export-meaningful', 'true');
    for (let offset = 0; offset < 3; offset += 1) {
      const skill = cv.skills[index + offset] ?? '';
      const skillCell = cell(row, skill, { width: '33.33%', backgroundColor: skill ? '#f9fafb' : '#ffffff' });
      if (skill) skillCell.setAttribute('data-rirekisho-skill', 'true');
    }
  }
}

function renderLanguages(parent: HTMLElement, cv: CVData): void {
  if (cv.languages.length === 0) return;
  const sectionEl = section(parent, '語学', { kind: 'languages' });
  const languages = table(sectionEl);
  cv.languages.forEach((language) => {
    const row = languages.insertRow();
    row.setAttribute('data-export-meaningful', 'true');
    cell(row, language.name, { width: '50%', fontWeight: '700' });
    cell(row, language.level || '', { width: '50%', color: MUTED });
  });
}

function renderSummary(parent: HTMLElement, cv: CVData): void {
  if (!cv.summary) return;
  const sectionEl = section(parent, '自己PR', { kind: 'self-pr', allowBreakInside: true });
  const summary = table(sectionEl);
  const row = summary.insertRow();
  row.setAttribute('data-export-meaningful', 'true');
  row.setAttribute('data-rirekisho-summary-row', 'true');
  cell(row, cv.summary, {
    width: '100%',
    minHeight: '70px',
    padding: '8px',
    whiteSpace: 'pre-line',
    lineHeight: '1.38',
  });
}

function renderCertifications(parent: HTMLElement, cv: CVData): void {
  if (cv.certifications.length === 0) return;
  const sectionEl = section(parent, '資格・免許', { kind: 'certifications' });
  const certs = table(sectionEl);
  cv.certifications.forEach((certification) => {
    const row = certs.insertRow();
    row.setAttribute('data-export-meaningful', 'true');
    cell(row, `・${certification}`, { width: '100%' });
  });
}

export function createRirekishoPdfTemplate(
  cv: CVData,
  options: RirekishoPdfTemplateOptions = {},
): HTMLElement {
  const root = document.createElement('div');
  root.setAttribute('data-template-id', 'rirekisho');
  root.setAttribute('data-rirekisho-pdf-root', 'true');
  if (options.locale) root.setAttribute('lang', options.locale);
  applyStyle(root, {
    width: '210mm',
    minWidth: '210mm',
    minHeight: '297mm',
    margin: '0 auto',
    padding: '28px 34px',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
    color: TEXT,
    fontFamily: 'NotoSansJP, NotoSans, "Yu Gothic", Meiryo, Arial, sans-serif',
    fontSize: '10.5px',
    lineHeight: '1.34',
    overflow: 'visible',
    wordSpacing: 'normal',
    letterSpacing: 'normal',
    fontKerning: 'normal',
    fontFeatureSettings: 'normal',
  });

  renderHeader(root, cv, options.photoDataUrl ?? null);
  renderEducation(root, cv);
  renderExperience(root, cv);
  renderSkills(root, cv);
  renderLanguages(root, cv);
  renderSummary(root, cv);
  renderCertifications(root, cv);

  return root;
}
