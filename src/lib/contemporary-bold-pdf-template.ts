'use client';

import { createCorporateNavyPdfTemplate } from './corporate-navy-pdf-template';
import { type Locale } from './i18n/translations';
import { type CVData } from './types';

type ContemporaryBoldPdfTemplateOptions = {
  locale?: Locale;
  photoDataUrl?: string | null;
};

function retagCorporateNavyExportNode(root: HTMLElement): HTMLElement {
  root.setAttribute('data-template-id', 'contemporary-bold');
  root.setAttribute('data-contemporary-bold-pdf-root', 'true');
  root.removeAttribute('data-corporate-navy-pdf-root');

  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  elements.forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      if (!attribute.value.includes('corporate-navy') && !attribute.name.includes('corporate-navy')) return;
      const nextName = attribute.name.replaceAll('corporate-navy', 'contemporary-bold');
      const nextValue = attribute.value.replaceAll('corporate-navy', 'contemporary-bold');
      element.removeAttribute(attribute.name);
      element.setAttribute(nextName, nextValue);
    });
  });

  return root;
}

export function createContemporaryBoldPdfTemplate(
  cv: CVData,
  options: ContemporaryBoldPdfTemplateOptions = {},
): HTMLElement {
  const root = createCorporateNavyPdfTemplate(cv, options);
  return retagCorporateNavyExportNode(root);
}
