/**
 * Canonical CV professional facts — one source of truth for all locales.
 * Localized outputs may rephrase grammar, never invent new duties or claims.
 */
import type { CVData, Education, WorkExperience } from './types';
import type { Locale } from './i18n/translations';

export type CvFactType =
  | 'summary'
  | 'employer'
  | 'role'
  | 'dates'
  | 'experience_bullet'
  | 'skill'
  | 'language_name'
  | 'language_level'
  | 'education_degree'
  | 'education_school'
  | 'education_dates'
  | 'education_description'
  | 'certification'
  | 'identity'
  | 'job_title';

export type CvCanonicalFact = {
  id: string;
  type: CvFactType;
  value: string;
  source: string;
  experienceIndex?: number;
  bulletIndex?: number;
};

export type CvCanonicalFactSet = {
  facts: CvCanonicalFact[];
  localeHint?: Locale | string;
  isSparse: boolean;
};

export function splitExperienceBullets(description: string): string[] {
  if (!description?.trim()) return [];
  return description
    .split(/\r?\n/)
    .map((line) => line.replace(/^[•\-\*\u2022]\s*/, '').trim())
    .filter(Boolean);
}

export function formatExperienceBullets(bullets: string[], bulletPrefix = '• '): string {
  return bullets.map((b) => `${bulletPrefix}${b.replace(/^[•\-\*\u2022]\s*/, '').trim()}`).join('\n');
}

function push(
  facts: CvCanonicalFact[],
  fact: Omit<CvCanonicalFact, 'value'> & { value: string },
): void {
  const value = fact.value.trim();
  if (!value) return;
  facts.push({ ...fact, value });
}

export function buildCvCanonicalFactSet(
  cv: Pick<CVData, 'personal' | 'summary' | 'experience' | 'education' | 'skills' | 'certifications' | 'languages'>,
  options?: { localeHint?: Locale | string },
): CvCanonicalFactSet {
  const facts: CvCanonicalFact[] = [];

  push(facts, {
    id: 'identity-0',
    type: 'identity',
    value: cv.personal?.fullName ?? '',
    source: 'cv.personal.fullName',
  });
  push(facts, {
    id: 'job-title-0',
    type: 'job_title',
    value: cv.personal?.jobTitle ?? '',
    source: 'cv.personal.jobTitle',
  });
  push(facts, {
    id: 'summary-0',
    type: 'summary',
    value: cv.summary ?? '',
    source: 'cv.summary',
  });

  (cv.experience ?? []).forEach((exp, experienceIndex) => {
    push(facts, {
      id: `experience-${experienceIndex}-employer`,
      type: 'employer',
      value: exp.company ?? '',
      source: `cv.experience[${experienceIndex}].company`,
      experienceIndex,
    });
    push(facts, {
      id: `experience-${experienceIndex}-role`,
      type: 'role',
      value: exp.position ?? '',
      source: `cv.experience[${experienceIndex}].position`,
      experienceIndex,
    });
    const dates = [exp.startDate, exp.isPresent ? 'present' : exp.endDate].filter(Boolean).join(' – ');
    push(facts, {
      id: `experience-${experienceIndex}-dates`,
      type: 'dates',
      value: dates,
      source: `cv.experience[${experienceIndex}].dates`,
      experienceIndex,
    });
    splitExperienceBullets(exp.description ?? '').forEach((bullet, bulletIndex) => {
      push(facts, {
        id: `experience-${experienceIndex}-bullet-${bulletIndex}`,
        type: 'experience_bullet',
        value: bullet,
        source: `cv.experience[${experienceIndex}].description[${bulletIndex}]`,
        experienceIndex,
        bulletIndex,
      });
    });
  });

  (cv.skills ?? []).forEach((skill, idx) => {
    push(facts, {
      id: `skill-${idx}`,
      type: 'skill',
      value: skill,
      source: `cv.skills[${idx}]`,
    });
  });

  (cv.languages ?? []).forEach((lang, idx) => {
    push(facts, {
      id: `language-${idx}-name`,
      type: 'language_name',
      value: lang.name ?? '',
      source: `cv.languages[${idx}].name`,
    });
    push(facts, {
      id: `language-${idx}-level`,
      type: 'language_level',
      value: lang.level ?? '',
      source: `cv.languages[${idx}].level`,
    });
  });

  (cv.education ?? []).forEach((edu, idx) => {
    push(facts, {
      id: `education-${idx}-degree`,
      type: 'education_degree',
      value: edu.degree ?? '',
      source: `cv.education[${idx}].degree`,
    });
    push(facts, {
      id: `education-${idx}-school`,
      type: 'education_school',
      value: edu.school ?? '',
      source: `cv.education[${idx}].school`,
    });
    const eduDates = [edu.startDate, edu.endDate].filter(Boolean).join(' – ');
    push(facts, {
      id: `education-${idx}-dates`,
      type: 'education_dates',
      value: eduDates,
      source: `cv.education[${idx}].dates`,
    });
    push(facts, {
      id: `education-${idx}-description`,
      type: 'education_description',
      value: edu.description ?? '',
      source: `cv.education[${idx}].description`,
    });
  });

  (cv.certifications ?? []).forEach((cert, idx) => {
    push(facts, {
      id: `certification-${idx}`,
      type: 'certification',
      value: cert,
      source: `cv.certifications[${idx}]`,
    });
  });

  const professional = facts.filter((f) =>
    ['experience_bullet', 'summary', 'skill', 'employer', 'role'].includes(f.type),
  );
  return {
    facts,
    localeHint: options?.localeHint,
    isSparse: professional.length < 2,
  };
}

export function bulletsForExperience(
  factSet: CvCanonicalFactSet,
  experienceIndex: number,
): CvCanonicalFact[] {
  return factSet.facts
    .filter((f) => f.type === 'experience_bullet' && f.experienceIndex === experienceIndex)
    .sort((a, b) => (a.bulletIndex ?? 0) - (b.bulletIndex ?? 0));
}

export function buildFactSetFromExperienceDescription(
  description: string,
  meta?: { experienceIndex?: number; company?: string; position?: string; startDate?: string; endDate?: string; isPresent?: boolean },
): CvCanonicalFactSet {
  const experienceIndex = meta?.experienceIndex ?? 0;
  const experience: WorkExperience = {
    id: `exp-${experienceIndex}`,
    company: meta?.company ?? '',
    position: meta?.position ?? '',
    startDate: meta?.startDate ?? '',
    endDate: meta?.endDate ?? '',
    isPresent: Boolean(meta?.isPresent),
    description,
  };
  return buildCvCanonicalFactSet({
    personal: { fullName: '', email: '', phone: '', address: '', jobTitle: '' },
    summary: '',
    experience: [experience],
    education: [] as Education[],
    skills: [],
    certifications: [],
    languages: [],
  });
}

export function formatCanonicalBulletsForPrompt(
  bullets: CvCanonicalFact[],
): string {
  if (!bullets.length) return '(none — do not invent duties)';
  return bullets.map((b) => `- [${b.id}] ${b.value}`).join('\n');
}

export function deterministicBulletsFromCanonical(
  bullets: CvCanonicalFact[],
): string {
  if (!bullets.length) return '';
  return formatExperienceBullets(bullets.map((b) => b.value));
}
