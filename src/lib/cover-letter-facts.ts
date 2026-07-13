/**
 * Normalized cover-letter source facts built only from supplied CV/form data.
 * Never invents skills, experience, or achievements.
 */
import type { CVData, Education, WorkExperience } from './types';

export type CoverLetterFactType =
  | 'identity'
  | 'target_position'
  | 'target_company'
  | 'work_history'
  | 'responsibility'
  | 'achievement'
  | 'skill'
  | 'tool'
  | 'programming_language'
  | 'education'
  | 'certification'
  | 'language_proficiency'
  | 'leadership'
  | 'years_experience'
  | 'numeric_achievement'
  | 'job_description_requirement'
  | 'summary';

export type CoverLetterFact = {
  id: string;
  type: CoverLetterFactType;
  value: string;
  source: string;
};

export type CoverLetterFactSet = {
  facts: CoverLetterFact[];
  isSparse: boolean;
};

export type CoverLetterFactInput = {
  personalName?: string;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  summary?: string;
  experience?: Array<Pick<WorkExperience, 'company' | 'position' | 'description' | 'startDate' | 'endDate' | 'isPresent'> & { id?: string }>;
  education?: Array<Pick<Education, 'school' | 'degree' | 'description' | 'startDate' | 'endDate'> & { id?: string }>;
  skills?: string[];
  certifications?: string[];
  languages?: Array<{ name?: string; level?: string }>;
};

const LEADERSHIP_RE =
  /\b(led|lead|leading|managed|manage|managing|supervised|directed|headed|coordinated\s+(?:a\s+)?team|owned\s+(?:a\s+)?project|responsible\s+for\s+(?:a\s+)?(?:team|department)|team\s+lead|project\s+lead| नेतृत्व|प्रबंधन|قاد|أدار|أشرف|نسّق الفريق|руководил|управлял|leitete|führte|dirigió|lideró|a dirigé|ha guidato|vodio|vodila|主导)\b/iu;

const YEARS_RE =
  /(\d+)\+?\s*(?:years?|yrs?|Jahre|años|ans|anni|godina|лет|سنوات|वर्ष|年)/iu;

const NUMERIC_ACHIEVEMENT_RE =
  /(\d+\s*%|\d+\s*(?:million|billion|k\b|percent|€|\$|USD|EUR))/iu;

function pushFact(
  facts: CoverLetterFact[],
  counters: Record<string, number>,
  type: CoverLetterFactType,
  value: string,
  source: string,
): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  const key = type;
  counters[key] = (counters[key] ?? 0) + 1;
  facts.push({
    id: `${type}_${counters[key]}`,
    type,
    value: trimmed,
    source,
  });
}

function classifySkillType(skill: string): CoverLetterFactType {
  const s = skill.toLowerCase();
  if (
    /\b(java|python|javascript|typescript|c\+\+|c#|go\b|rust|kotlin|swift|ruby|php|sql|r\b|scala|perl)\b/i.test(s)
  ) {
    return 'programming_language';
  }
  if (
    /\b(react|angular|vue|node\.?js|django|flask|spring|\.net|aws|azure|gcp|docker|kubernetes|git|jira|excel|crm|erp|salesforce|tableau|figma)\b/i.test(
      s,
    )
  ) {
    return 'tool';
  }
  return 'skill';
}

export function buildCoverLetterFactSet(input: CoverLetterFactInput): CoverLetterFactSet {
  const facts: CoverLetterFact[] = [];
  const counters: Record<string, number> = {};

  pushFact(facts, counters, 'identity', input.personalName ?? '', 'form.personalName');
  pushFact(facts, counters, 'target_position', input.jobTitle ?? '', 'form.jobTitle');
  pushFact(facts, counters, 'target_company', input.companyName ?? '', 'form.companyName');
  pushFact(facts, counters, 'summary', input.summary ?? '', 'cv.summary');

  const jd = input.jobDescription?.trim() ?? '';
  if (jd) {
    // Job-description text is recorded as requirements/interest context only —
    // never as candidate experience.
    pushFact(facts, counters, 'job_description_requirement', jd.slice(0, 2000), 'form.jobDescription');
  }

  (input.skills ?? []).forEach((skill, idx) => {
    const value = typeof skill === 'string' ? skill.trim() : '';
    if (!value) return;
    pushFact(facts, counters, classifySkillType(value), value, `cv.skills[${idx}]`);
  });

  (input.certifications ?? []).forEach((cert, idx) => {
    pushFact(facts, counters, 'certification', cert, `cv.certifications[${idx}]`);
  });

  (input.languages ?? []).forEach((lang, idx) => {
    const name = lang?.name?.trim() ?? '';
    if (!name) return;
    const level = lang?.level?.trim() ?? '';
    pushFact(
      facts,
      counters,
      'language_proficiency',
      level ? `${name} (${level})` : name,
      `cv.languages[${idx}]`,
    );
  });

  (input.education ?? []).forEach((edu, idx) => {
    const parts = [edu.degree, edu.school, edu.description].map((p) => (p ?? '').trim()).filter(Boolean);
    if (parts.length === 0) return;
    pushFact(facts, counters, 'education', parts.join(' — '), `cv.education[${idx}]`);
  });

  (input.experience ?? []).forEach((exp, idx) => {
    const roleBits = [exp.position, exp.company].map((p) => (p ?? '').trim()).filter(Boolean);
    if (roleBits.length) {
      const dates = [exp.startDate, exp.isPresent ? 'present' : exp.endDate].filter(Boolean).join('–');
      pushFact(
        facts,
        counters,
        'work_history',
        dates ? `${roleBits.join(' at ')} (${dates})` : roleBits.join(' at '),
        `cv.experience[${idx}]`,
      );
    }
    const description = (exp.description ?? '').trim();
    if (description) {
      pushFact(facts, counters, 'responsibility', description, `cv.experience[${idx}].description`);
      if (LEADERSHIP_RE.test(description)) {
        pushFact(facts, counters, 'leadership', description.slice(0, 280), `cv.experience[${idx}].leadership`);
      }
      const years = description.match(YEARS_RE);
      if (years) {
        pushFact(facts, counters, 'years_experience', years[0], `cv.experience[${idx}].years`);
      }
      const numeric = description.match(NUMERIC_ACHIEVEMENT_RE);
      if (numeric) {
        pushFact(facts, counters, 'numeric_achievement', numeric[0], `cv.experience[${idx}].metric`);
      }
      // Split description lines as softer responsibilities
      description.split(/[\n•;]+/).forEach((line, lineIdx) => {
        const trimmed = line.trim();
        if (trimmed.length < 12) return;
        if (trimmed === description) return;
        pushFact(facts, counters, 'responsibility', trimmed, `cv.experience[${idx}].line[${lineIdx}]`);
      });
    }
  });

  const professional = facts.filter(
    (f) =>
      f.type !== 'identity' &&
      f.type !== 'target_position' &&
      f.type !== 'target_company' &&
      f.type !== 'job_description_requirement',
  );
  return {
    facts,
    isSparse: professional.length === 0,
  };
}

export function buildCoverLetterFactSetFromCv(
  cv: CVData | null | undefined,
  form: { personalName?: string; jobTitle?: string; companyName?: string; jobDescription?: string },
): CoverLetterFactSet {
  return buildCoverLetterFactSet({
    personalName: form.personalName || cv?.personal?.fullName,
    jobTitle: form.jobTitle,
    companyName: form.companyName,
    jobDescription: form.jobDescription,
    summary: cv?.summary,
    experience: cv?.experience,
    education: cv?.education,
    skills: cv?.skills,
    certifications: cv?.certifications,
    languages: cv?.languages,
  });
}

export function formatCoverLetterFactsForPrompt(factSet: CoverLetterFactSet): string {
  if (factSet.facts.length === 0) {
    return 'SOURCE FACTS: (none provided — write a short honest letter with interest/motivation only; invent nothing.)';
  }
  const lines = factSet.facts.map((f) => `- [${f.id}] (${f.type}, ${f.source}): ${f.value}`);
  return [
    'SOURCE FACTS (use ONLY these; every professional claim must cite support from these facts):',
    ...lines,
    factSet.isSparse
      ? 'FACT DENSITY: sparse — prefer a short honest letter; do NOT invent experience, skills, leadership, tools, or metrics.'
      : 'FACT DENSITY: provided — you may use the listed facts; do NOT add extras.',
  ].join('\n');
}

export function factSetAllowsLeadership(factSet: CoverLetterFactSet): boolean {
  return factSet.facts.some((f) => f.type === 'leadership');
}

export function factSetAllowedValues(factSet: CoverLetterFactSet): string[] {
  return factSet.facts.map((f) => f.value);
}

export function serializeCoverLetterFactSet(factSet: CoverLetterFactSet): {
  facts: CoverLetterFact[];
  isSparse: boolean;
} {
  return { facts: factSet.facts, isSparse: factSet.isSparse };
}
