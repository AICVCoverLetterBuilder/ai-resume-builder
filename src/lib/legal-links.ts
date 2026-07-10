/** Shared in-app legal routes — single source of truth for footer, About, and legal pages. */
export const LEGAL_PRIVACY_PATH = '/privacy' as const;
export const LEGAL_TERMS_PATH = '/terms' as const;
export const LEGAL_CONTACT_EMAIL = 'help.cvappai@gmail.com' as const;
export const LEGAL_CONTACT_HREF = `mailto:${LEGAL_CONTACT_EMAIL}` as const;

export const LEGAL_LINKS = {
  privacy: LEGAL_PRIVACY_PATH,
  terms: LEGAL_TERMS_PATH,
  contact: LEGAL_CONTACT_HREF,
} as const;
