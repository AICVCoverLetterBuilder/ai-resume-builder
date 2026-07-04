'use client';

import { getLocalizedCvLanguageName } from './cv-language-options';
import { getLocalizedCvSkillName } from './cv-skill-options';
import { translations, type Locale } from './i18n/translations';
import type { CVData } from './types';

type StyleMap = Partial<CSSStyleDeclaration>;

type ExecutivePremiumPdfTemplateOptions = {
  locale?: Locale;
  photoDataUrl?: string | null;
};

const NAVY = '#111827';
const GOLD = '#D97706';
const SOFT_GOLD = '#FCD34D';
const TEXT = '#111827';
const BODY = '#374151';
const MUTED = '#6B7280';
const HEADING = '#9CA3AF';
const RULE = '#E5E7EB';

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

function section(parent: HTMLElement, title: string, centered = false): HTMLElement {
  const sectionEl = append(parent, 'section', {
    margin: '0 0 13px',
    padding: '0',
    breakInside: 'avoid',
    pageBreakInside: 'avoid',
  });
  sectionEl.setAttribute('data-export-group', 'executive-premium-section');

  const heading = append(sectionEl, 'h2', {
    margin: '0 0 8px',
    padding: '0 0 5px',
    borderBottom: `1px solid ${RULE}`,
    color: HEADING,
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '10.5px',
    lineHeight: '1.2',
    fontWeight: '700',
    letterSpacing: '0.22em',
    textAlign: centered ? 'center' : 'left',
    textTransform: 'uppercase',
    wordSpacing: 'normal',
    whiteSpace: 'normal',
  }, title.toUpperCase());
  heading.setAttribute('data-export-meaningful', 'true');
  heading.setAttribute('data-export-keep-with-next', 'true');
  return sectionEl;
}

function renderHeader(root: HTMLElement, cv: CVData, locale?: Locale, photoDataUrl?: string | null): void {
  const contacts = [
    cv.personal.email,
    cv.personal.phone,
    cv.personal.address,
  ].filter(Boolean);

  const headerWrap = append(root, 'header', {
    padding: '24px 48px 15px',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
  });
  headerWrap.setAttribute('data-export-meaningful', 'true');

  const block = append(headerWrap, 'div', {
    width: '540px',
    maxWidth: '100%',
    margin: '0 auto',
    padding: photoDataUrl ? '18px 36px 17px' : '24px 36px 20px',
    backgroundColor: NAVY,
    color: '#ffffff',
    textAlign: 'center',
    boxSizing: 'border-box',
  });
  block.setAttribute('data-executive-premium-pdf-header', 'true');

  if (photoDataUrl) {
    const frame = append(block, 'div', {
      width: '54px',
      height: '72px',
      margin: '0 auto 10px',
      overflow: 'hidden',
      borderRadius: '2px',
      backgroundColor: '#ffffff',
      boxSizing: 'border-box',
    });
    frame.setAttribute('data-export-meaningful', 'true');
    frame.setAttribute('data-executive-premium-photo-frame', 'true');
    const img = append(frame, 'img', {
      display: 'block',
      width: '54px',
      height: '72px',
      objectFit: 'cover',
      borderRadius: '0',
      border: 'none',
      filter: 'grayscale(100%) contrast(1.02)',
    }) as HTMLImageElement;
    img.src = photoDataUrl;
    img.alt = '';
    img.setAttribute('data-export-photo', 'executive-premium');
  }

  const name = append(block, 'h1', {
    margin: '0',
    color: '#ffffff',
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '24px',
    lineHeight: '1.18',
    fontWeight: '400',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    wordSpacing: '0.08em',
  }, (cv.personal.fullName || 'YOUR NAME').toUpperCase());
  name.setAttribute('data-export-meaningful', 'true');

  append(block, 'div', {
    width: '70px',
    height: '1px',
    margin: '9px auto 8px',
    backgroundColor: GOLD,
  }).setAttribute('data-export-meaningful', 'true');

  if (cv.personal.jobTitle) {
    const title = append(block, 'p', {
      margin: '0',
      color: SOFT_GOLD,
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '11.5px',
      lineHeight: '1.25',
      letterSpacing: '0.12em',
    }, cv.personal.jobTitle);
    title.setAttribute('data-export-meaningful', 'true');
  }

  if (contacts.length > 0) {
    const contactRow = append(block, 'div', {
      marginTop: '10px',
      display: 'flex',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: '0 8px',
      color: '#D1D5DB',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '9.5px',
      lineHeight: '1.35',
      wordSpacing: 'normal',
      letterSpacing: 'normal',
    });
    contactRow.setAttribute('data-export-contact-row', 'executive-premium');
    contacts.forEach((contact, index) => {
      if (index > 0) append(contactRow, 'span', { color: GOLD }, '|').setAttribute('data-export-contact-separator', 'executive-premium');
      append(contactRow, 'span', { whiteSpace: 'nowrap' }, contact).setAttribute('data-export-meaningful', 'true');
    });
  }

  if (locale) root.setAttribute('lang', locale);
}

export function createExecutivePremiumPdfTemplate(
  cv: CVData,
  options: ExecutivePremiumPdfTemplateOptions = {},
): HTMLElement {
  const L = labels(options.locale);
  const root = document.createElement('div');
  root.setAttribute('data-template-id', 'executive-premium');
  root.setAttribute('data-executive-premium-pdf-template', 'true');
  applyStyle(root, {
    width: '210mm',
    minWidth: '210mm',
    minHeight: '297mm',
    margin: '0 auto',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
    color: TEXT,
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '11.2px',
    lineHeight: '1.34',
    wordSpacing: 'normal',
    letterSpacing: 'normal',
    fontKerning: 'normal',
    fontFeatureSettings: 'normal',
  });

  renderHeader(root, cv, options.locale, options.photoDataUrl);

  const body = append(root, 'main', {
    padding: '0 58px 24px',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
  });

  if (cv.summary) {
    const sectionEl = append(body, 'section', {
      margin: '0 0 14px',
      textAlign: 'center',
    });
    sectionEl.setAttribute('data-export-meaningful', 'true');
    append(sectionEl, 'p', {
      margin: '0 auto',
      maxWidth: '600px',
      color: BODY,
      fontSize: '11.4px',
      lineHeight: '1.42',
      fontStyle: 'italic',
      wordSpacing: 'normal',
      letterSpacing: 'normal',
    }, cv.summary).setAttribute('data-export-meaningful', 'true');
  }

  if (cv.experience.length > 0) {
    const sectionEl = section(body, L.experience);
    cv.experience.forEach((exp) => {
      const entry = append(sectionEl, 'div', {
        margin: '0 0 10px',
        breakInside: 'avoid',
        pageBreakInside: 'avoid',
      });
      entry.setAttribute('data-export-meaningful', 'true');
      entry.setAttribute('data-export-group', 'executive-premium-experience-entry');

      const row = append(entry, 'div', {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        columnGap: '18px',
        alignItems: 'baseline',
      });
      append(row, 'div', {
        minWidth: '0',
        color: TEXT,
        fontSize: '12.2px',
        lineHeight: '1.26',
        fontWeight: '700',
      }, [exp.position, exp.company].filter(Boolean).join(', ')).setAttribute('data-export-meaningful', 'true');
      append(row, 'div', {
        color: HEADING,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '10px',
        lineHeight: '1.25',
        textAlign: 'right',
        whiteSpace: 'nowrap',
        fontStyle: 'italic',
      }, [exp.startDate, exp.isPresent ? L.present : exp.endDate].filter(Boolean).join(' - ')).setAttribute('data-export-meaningful', 'true');

      const lines = descriptionLines(exp.description);
      if (lines.length > 0) {
        const list = append(entry, 'ul', {
          margin: '4px 0 0',
          padding: '0',
          listStyleType: 'none',
          fontFamily: 'Arial, Helvetica, sans-serif',
        });
        lines.forEach((line) => {
          const item = append(list, 'li', {
            display: 'grid',
            gridTemplateColumns: '10px minmax(0, 1fr)',
            columnGap: '4px',
            margin: '0 0 2px',
            color: BODY,
            fontSize: '10.8px',
            lineHeight: '1.34',
            wordSpacing: 'normal',
            letterSpacing: 'normal',
          });
          item.setAttribute('data-export-meaningful', 'true');
          item.setAttribute('data-export-bullet-row', 'executive-premium');
          append(item, 'span', { color: TEXT }, '-');
          append(item, 'span', undefined, line);
        });
      }
    });
  }

  if (cv.education.length > 0) {
    const sectionEl = section(body, L.education, true);
    cv.education.forEach((edu) => {
      const entry = append(sectionEl, 'div', {
        margin: '0 0 5px',
        textAlign: 'center',
        color: TEXT,
        fontSize: '11.2px',
        lineHeight: '1.3',
      });
      entry.setAttribute('data-export-meaningful', 'true');
      entry.setAttribute('data-export-group', 'executive-premium-education-entry');
      append(entry, 'div', { fontWeight: '700' }, edu.degree);
      const meta = [edu.school, [edu.startDate, edu.endDate].filter(Boolean).join(' - ')].filter(Boolean).join(' | ');
      append(entry, 'div', { color: MUTED, fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10px' }, meta);
    });
  }

  const hasSkills = cv.skills.length > 0;
  const hasLanguages = cv.languages.length > 0;
  if (hasSkills || hasLanguages) {
    const lower = append(body, 'div', {
      display: 'grid',
      gridTemplateColumns: hasSkills && hasLanguages ? '1fr 1fr' : '1fr',
      gap: '24px',
      borderTop: `1px solid ${RULE}`,
      paddingTop: '10px',
      marginTop: '4px',
    });
    lower.setAttribute('data-export-group', 'executive-premium-lower-layout');

    if (hasSkills) {
      const skills = append(lower, 'section', {});
      append(skills, 'h2', {
        margin: '0 0 6px',
        color: HEADING,
        fontSize: '10px',
        fontWeight: '700',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
      }, L.skills.toUpperCase()).setAttribute('data-export-meaningful', 'true');
      const text = cv.skills.map(skill => getLocalizedCvSkillName(skill, options.locale ?? 'en')).join(' | ');
      append(skills, 'p', {
        margin: '0',
        color: BODY,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '10.6px',
        lineHeight: '1.36',
      }, text).setAttribute('data-export-meaningful', 'true');
      cv.skills.forEach((_skill, index) => {
        lower.setAttribute(`data-executive-premium-skill-${index}`, 'true');
      });
    }

    if (hasLanguages) {
      const languages = append(lower, 'section', {});
      append(languages, 'h2', {
        margin: '0 0 6px',
        color: HEADING,
        fontSize: '10px',
        fontWeight: '700',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
      }, L.languages.toUpperCase()).setAttribute('data-export-meaningful', 'true');
      cv.languages.forEach((language) => {
        append(languages, 'p', {
          margin: '0 0 3px',
          color: BODY,
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '10.6px',
          lineHeight: '1.34',
        }, `${getLocalizedCvLanguageName(language.name, options.locale ?? 'en')} - ${language.level}`).setAttribute('data-export-meaningful', 'true');
      });
    }
  }

  if (cv.certifications.length > 0) {
    const sectionEl = section(body, L.certifications, true);
    cv.certifications.forEach((certification) => {
      append(sectionEl, 'p', {
        margin: '0 0 3px',
        textAlign: 'center',
        color: BODY,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '10.6px',
        lineHeight: '1.34',
      }, certification).setAttribute('data-export-meaningful', 'true');
    });
  }

  return root;
}
